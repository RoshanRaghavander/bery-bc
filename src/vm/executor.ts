import { Worker } from 'worker_threads';
import { Transaction, STAKING_ADDRESS } from '../core/transaction.js';
import { StateManager } from '../state/state_manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

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

  public async executeBlock(transactions: Transaction[]): Promise<Transaction[]> {
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

    try {
      for (const tx of transactions) {
        try {
            const success = await this.processTx(worker, tx);
            if (success) {
                validTxs.push(tx);
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
    return validTxs;
  }

  private async processTx(worker: Worker, tx: Transaction): Promise<boolean> {
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
        // Check if receiver has code (Contract Call) or is Staking Address
        if ((receiver.codeHash && !receiver.codeHash.equals(Buffer.alloc(32))) || tx.to === STAKING_ADDRESS) {
            if (receiver.codeHash && !receiver.codeHash.equals(Buffer.alloc(32))) {
                code = await this.stateManager.getCode(receiver.codeHash);
            }
            storage = await this.stateManager.dumpContractStorage(tx.to);
        }
    }

    // 2. Send to Worker
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

          resolve(true);
        } else {
          console.warn(`Tx failed: ${result.error}`);
          resolve(false); // We resolve even on failure, just don't apply state
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
      }, 5000); // 5s timeout per tx
    });
  }
}
