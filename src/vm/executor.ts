import { Worker } from 'worker_threads';
import { Transaction, STAKING_ADDRESS, SYSTEM_SENDER } from '../core/transaction.js';
import { StateManager } from '../state/state_manager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/config.js';
import { Hash } from '../crypto/hash.js';
import BN from 'bn.js';

// ESM dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VMExecutor {
  private stateManager: StateManager;
  private workerPath: string;

  constructor(stateManager: StateManager, workerPath?: string) {
    this.stateManager = stateManager;
    // Point to compiled JS worker
    this.workerPath = workerPath || path.resolve(__dirname, 'worker.js');
  }

  public async executeBlock(transactions: Transaction[]): Promise<{ validTxs: Transaction[]; receipts: any[] }> {
    // Naive parallel execution:
    // 1. We could spin up N workers.
    // 2. Or just one worker for now to prove concept.
    // 3. For true parallel, we need to check conflicts.
    
    // Conflict Detection (Simple)
    // Map<Address, PendingTx>
    // If a tx touches an address already in the batch, wait.
    
    // For this implementation, let's process sequentially BUT use the Worker thread to offload logic.
    // In a real high-throughput system, we would batch non-conflicting txs to multiple workers.

    let worker = new Worker(this.workerPath);
    const validTxs: Transaction[] = [];
    const receipts: any[] = [];
    let cumulativeGasUsed = 0;

    try {
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        try {
            const result = await this.processTx(worker, tx);
            if (result.applied) {
                validTxs.push(tx);
                cumulativeGasUsed += result.receipt.gasUsed;
                result.receipt.cumulativeGasUsed = cumulativeGasUsed;
                result.receipt.transactionIndex = i;
                receipts.push(result.receipt);
            }
        } catch (e: any) {
            if (e.message === 'Transaction execution timed out') {
                console.warn('Tx timed out, restarting worker');
                await worker.terminate();
                worker = new Worker(this.workerPath);
            } else {
                // If it's another error, maybe just log and continue? 
                // In processTx we usually resolve() on logic errors.
                // Rejection means system error.
                console.error('System error during tx execution:', e);
            }
        }
      }
    } finally {
      await worker.terminate();
    }
    return { validTxs, receipts };
  }

  private async processTx(worker: Worker, tx: Transaction): Promise<{ applied: boolean; receipt: any }> {
    // 1. Fetch State
    const sender = await this.stateManager.getAccount(tx.from);
    
    let receiver;
    let code: Buffer | null = null;
    let isCreate = false;
    let storage: Record<string, string> = {};

    // Detect Contract Creation
    if (!tx.to || tx.to === '' || tx.to === '0'.repeat(40)) {
        isCreate = true;
        receiver = null; // Will be created in worker
        code = tx.data;
    } else {
        receiver = await this.stateManager.getAccount(tx.to);
        if (receiver.codeHash && !receiver.codeHash.equals(Buffer.alloc(32))) {
            code = await this.stateManager.getCode(receiver.codeHash);
            storage = await this.stateManager.dumpContractStorage(tx.to);
        } else if (tx.to === STAKING_ADDRESS) {
            storage = await this.stateManager.dumpContractStorage(tx.to);
        }
    }

    const isContractCall = !!code && !isCreate && tx.to !== STAKING_ADDRESS;
    if (isContractCall) {
      return this.executeEvmCall(tx, sender, receiver);
    }

    if (isCreate && code) {
      return this.executeEvmCreate(tx, sender);
    }

    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout;

      const messageHandler = async (result: any) => {
              clearTimeout(timeout);
              // console.log('Worker result:', JSON.stringify(result, null, 2)); // Debug log
              
              if (result.success) {
                // 3. Apply Changes
                for (const change of result.stateChanges) {
                   const { Account } = await import('../state/account.js');
                   const acc = Account.deserialize(change.accountData);
                   await this.stateManager.putAccount(change.address, acc);
                }
          
          // 4. Store Code if created
          if (result.newCode) {
              await this.stateManager.putCode(result.newCode.hash, result.newCode.code);
          }

          // 5. Apply Storage Changes
          if (result.storageChanges) {
              const targetAddr = result.contractAddress || tx.to;
              for (const [key, value] of Object.entries(result.storageChanges)) {
                  // Key/Value are hex strings from worker
                  await this.stateManager.putContractStorage(
                      targetAddr, 
                      Buffer.from(key as string, 'hex'), 
                      Buffer.from(value as string, 'hex')
                  );
              }
          }
          resolve({ applied: true, receipt: {
            transactionHash: tx.hash.toString('hex'),
            from: tx.from,
            to: tx.to || '',
            contractAddress: result.contractAddress || null,
            gasUsed: result.gasUsed || 0,
            effectiveGasPrice: tx.gasPrice.toString(10),
            status: '0x1',
            logs: []
          } });
        } else {
          console.warn(`Tx failed: ${result.error}`);
          resolve({ applied: false, receipt: {
            transactionHash: tx.hash.toString('hex'),
            from: tx.from,
            to: tx.to || '',
            contractAddress: null,
            gasUsed: 0,
            effectiveGasPrice: tx.gasPrice.toString(10),
            status: '0x0',
            logs: []
          } });
        }
        
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
      };

      const errorHandler = (err: Error) => {
        clearTimeout(timeout);
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(err);
      };

      worker.on('message', messageHandler);
      worker.on('error', errorHandler);

      worker.postMessage({
        txData: tx.toJSON(),
        senderAccountData: sender ? sender.serialize() : null,
        receiverAccountData: receiver ? receiver.serialize() : null,
        code: code,
        isCreate: isCreate,
        storage: storage,
        gasLimit: tx.gasLimit
      });

      timeout = setTimeout(() => {
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(new Error('Transaction execution timed out'));
      }, 5000);
    });
  }

  private async executeEvmCall(tx: Transaction, senderAcc: any, receiverAcc: any): Promise<{ applied: boolean; receipt: any }> {
    const evmMod: any = await import('../evm/index.js');
    const from = '0x' + tx.from;
    const to = (tx.to ? '0x' + tx.to : '0x').replace('0x0', '0x');
    const res = await evmMod.evmCall(this.stateManager, config.chain.chainId, {
      from,
      to: to.replace('0x', ''),
      data: '0x' + tx.data.toString('hex'),
      value: '0x' + tx.value.toString(16),
      gas: tx.gasLimit
    });

    const utilMod: any = await import('@ethereumjs/util');
    const { Address, Account } = utilMod;
    const fromAddr = Address.fromString('0x' + tx.from);
    const toAddr = Address.fromString('0x' + (tx.to || ''));
    const vm = await evmMod.createVM(config.chain.chainId);
    await vm.stateManager.putAccount(fromAddr, new Account());
    await vm.stateManager.putAccount(toAddr, new Account());

    const senderUpdated = await this.stateManager.getAccount(tx.from);
    const receiverUpdated = await this.stateManager.getAccount(tx.to || '');
    await this.stateManager.putAccount(tx.from, senderUpdated);
    if (tx.to) await this.stateManager.putAccount(tx.to, receiverUpdated);

    const receipt = {
      transactionHash: tx.hash.toString('hex'),
      from: tx.from,
      to: tx.to || '',
      contractAddress: null,
      gasUsed: res.gasUsed || 0,
      effectiveGasPrice: tx.gasPrice.toString(10),
      status: '0x1',
      logs: res.logs.map((l: any) => ({
        address: l.address,
        topics: l.topics,
        data: l.data,
        transactionHash: tx.hash.toString('hex')
      }))
    };

    return { applied: true, receipt };
  }

  private async executeEvmCreate(tx: Transaction, senderAcc: any): Promise<{ applied: boolean; receipt: any }> {
    const isSystemTx = tx.from === SYSTEM_SENDER;
    if (!tx.verify()) {
      return { applied: false, receipt: { transactionHash: tx.hash.toString('hex'), status: '0x0', logs: [], gasUsed: 0 } };
    }

    const sender = await this.stateManager.getAccount(tx.from);
    const gasLimit = tx.gasLimit;
    const gasPrice = tx.gasPrice;
    const upfrontGasCost = new BN(gasLimit).mul(gasPrice);

    if (!isSystemTx) {
      const expected = sender.nonce.toNumber() + 1;
      if (tx.nonce !== expected) {
        return { applied: false, receipt: { transactionHash: tx.hash.toString('hex'), status: '0x0', logs: [], gasUsed: 0 } };
      }
      const totalCost = tx.value.add(upfrontGasCost);
      if (sender.balance.lt(totalCost)) {
        return { applied: false, receipt: { transactionHash: tx.hash.toString('hex'), status: '0x0', logs: [], gasUsed: 0 } };
      }
      sender.balance = sender.balance.sub(upfrontGasCost);
      sender.balance = sender.balance.sub(tx.value);
      sender.nonce = sender.nonce.add(new BN(1));
    }

    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64BE(BigInt(sender.nonce.toNumber() - 1));
    const addrBuf = Hash.keccak256(Buffer.concat([Buffer.from(tx.from, 'hex'), nonceBuf]));
    const contractAddress = addrBuf.subarray(addrBuf.length - 20).toString('hex');
    const receiver = await this.stateManager.getAccount(contractAddress);
    receiver.balance = receiver.balance.add(tx.value);

    const evmMod: any = await import('../evm/index.js');
    const res = await evmMod.evmCreate(this.stateManager, config.chain.chainId, {
      from: '0x' + tx.from,
      initCode: '0x' + tx.data.toString('hex'),
      value: '0x' + tx.value.toString(16),
      gas: gasLimit
    });

    const unusedGas = Math.max(gasLimit - (res.gasUsed || 0), 0);
    if (!isSystemTx && unusedGas > 0) {
      const refund = new BN(unusedGas).mul(gasPrice);
      sender.balance = sender.balance.add(refund);
    }

    const runtimeCode = Buffer.from(res.runtimeCode);
    const codeHash = Hash.hash(runtimeCode);
    receiver.codeHash = codeHash;

    await this.stateManager.putAccount(tx.from, sender);
    await this.stateManager.putAccount(contractAddress, receiver);
    await this.stateManager.putCode(codeHash, runtimeCode);

    const receipt = {
      transactionHash: tx.hash.toString('hex'),
      from: tx.from,
      to: '',
      contractAddress,
      gasUsed: res.gasUsed || gasLimit,
      effectiveGasPrice: tx.gasPrice.toString(10),
      status: '0x1',
      logs: (res.logs || []).map((l: any) => ({
        address: l.address,
        topics: l.topics,
        data: l.data,
        transactionHash: tx.hash.toString('hex')
      }))
    };

    return { applied: true, receipt };
  }
}
