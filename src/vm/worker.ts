import { parentPort, workerData } from 'worker_threads';
import { Transaction } from '../core/transaction.js';
import { SYSTEM_SENDER, STAKING_ADDRESS } from '../core/transaction.js';
import { Account } from '../state/account.js';
import { Hash } from '../crypto/hash.js';
import BN from 'bn.js';

interface TxTask {
  txData: any;
  senderAccountData: Buffer | null; // Null if account doesn't exist
  receiverAccountData: Buffer | null;
  code: Buffer | null;
  isCreate: boolean;
  storage?: Record<string, string>;
  gasLimit?: number;
}

interface TxResult {
  success: boolean;
  error?: string;
  stateChanges?: {
    address: string;
    accountData: Buffer;
  }[];
  newCode?: {
      hash: Buffer;
      code: Buffer;
  };
  storageChanges?: Record<string, string>;
  contractAddress?: string;
  gasUsed?: number;
}

const GAS_COSTS = {
    BASE: 21000,
    STORAGE_READ: 200,
    STORAGE_WRITE: 20000,
    WASM_EXECUTION_BASE: 1000, // Fixed cost for launching WASM
};

parentPort?.on('message', async (task: TxTask) => {
  try {
    const tx = Transaction.fromJSON(task.txData);
    
    // 0. Setup Gas
    const gasLimit = task.gasLimit || 10000000;
    let gasUsed = GAS_COSTS.BASE;

    if (gasUsed > gasLimit) {
        throw new Error('Out of gas (base cost)');
    }

    const checkGas = (amount: number) => {
        gasUsed += amount;
        if (gasUsed > gasLimit) {
            throw new Error(`Out of gas: used ${gasUsed} > limit ${gasLimit}`);
        }
    };

    // 1. Verify Signature
    if (!tx.verify()) {
      throw new Error('Invalid signature');
    }

    // 2. Deserialize Accounts
    let sender: Account;
    if (task.senderAccountData) {
      sender = Account.deserialize(Buffer.from(task.senderAccountData));
    } else {
      sender = new Account(); // Empty account
    }

    let receiver: Account;
    let receiverAddress = tx.to;

    // Check if contract creation
    if (task.isCreate) {
        // Compute new address: Keccak256(RLP([sender, nonce])) -> slice(-20)
        // Simplified: Keccak256(sender + nonce) -> slice(-20)
        const nonceBuf = Buffer.alloc(8);
        nonceBuf.writeBigUInt64BE(BigInt(sender.nonce.toString()));
        const addrBuf = Hash.keccak256(Buffer.concat([Buffer.from(tx.from, 'hex'), nonceBuf]));
        receiverAddress = addrBuf.subarray(addrBuf.length - 20).toString('hex');
        receiver = new Account();
    } else {
        if (receiverAddress === tx.from) {
            receiver = sender;
        } else if (task.receiverAccountData) {
            receiver = Account.deserialize(Buffer.from(task.receiverAccountData));
        } else {
            receiver = new Account();
        }
    }

    const isSystemTx = tx.from === SYSTEM_SENDER;

    // 3. Check Nonce
    if (!isSystemTx) {
      if (tx.nonce !== sender.nonce.toNumber() + 1 && tx.nonce !== sender.nonce.toNumber()) {
         if (tx.nonce !== sender.nonce.toNumber()) {
            throw new Error(`Invalid nonce. Expected ${sender.nonce.toNumber()}, got ${tx.nonce}`);
         }
      }
    }

    // 4. Check Balance (Value + Gas)
    // Simplified: Just check Value for now. Gas fees logic usually pre-deducts.
    if (!isSystemTx) {
       const totalCost = tx.value.add(new BN(gasLimit).mul(tx.gasPrice));
       if (sender.balance.lt(totalCost)) {
           throw new Error(`Insufficient balance. Have ${sender.balance}, need ${totalCost}`);
       }
    }

    // 5. Deduct Gas (Upfront)
    if (!isSystemTx) {
       const upfrontGasCost = new BN(gasLimit).mul(tx.gasPrice);
       sender.balance = sender.balance.sub(upfrontGasCost);
    }
    
    // 6. Execute Logic (Transfer or Contract)
    // Decrement sender value
    if (!isSystemTx) {
      sender.balance = sender.balance.sub(tx.value);
      sender.nonce = sender.nonce.add(new BN(1));
    }
    
    receiver.balance = receiver.balance.add(tx.value); // Only add value to receiver

    let newCodeResult;
    
    // 6. Execute Code (WASM) or Native Staking Logic
    const storageChanges: Record<string, string> = {};
    const storage = task.storage || {};

    // --- Native Staking Logic ---
    if (tx.to === STAKING_ADDRESS && !task.isCreate) {
        if (!tx.data || tx.data.length === 0) {
             throw new Error('Staking tx missing data');
        }
        
        const cmd = tx.data[0];
        
        // Use sender address as key for storage mapping
        const senderKey = Buffer.from(tx.from, 'hex').toString('hex');
        // Calculate Hash of key to lookup in storage (SecureTrie dump has hashed keys)
        // SecureTrie uses Keccak256
        const senderKeyHash = Hash.keccak256(Buffer.from(senderKey, 'hex')).toString('hex');
        
        // Staker List Management
        const ALL_STAKERS_KEY = 'all_stakers';
        const allStakersKeyRaw = Buffer.from(ALL_STAKERS_KEY).toString('hex');
        const allStakersKeyHash = Hash.keccak256(Buffer.from(ALL_STAKERS_KEY)).toString('hex');
        
        let stakersList: string[] = [];
        if (storage[allStakersKeyHash]) {
            try {
                const jsonStr = Buffer.from(storage[allStakersKeyHash], 'hex').toString('utf8');
                stakersList = JSON.parse(jsonStr);
            } catch (e) {
                stakersList = [];
            }
        }

        // Get current stake
        const currentStakeHex = storage[senderKeyHash] || '00';
        const currentStake = new BN(currentStakeHex, 'hex');
        
        if (cmd === 0x01) { // STAKE
             // Add tx.value to stake
             const newStake = currentStake.add(tx.value);
             storageChanges[senderKey] = newStake.toString('hex');
             
             // Add to staker list if not present
             if (!stakersList.includes(tx.from)) {
                 stakersList.push(tx.from);
                 stakersList.sort();
                 const newJsonStr = JSON.stringify(stakersList);
                 storageChanges[allStakersKeyRaw] = Buffer.from(newJsonStr, 'utf8').toString('hex');
             }
             
        } else if (cmd === 0x02) { // UNSTAKE
             // Amount is in data[1:]
             const amountData = tx.data.subarray(1);
             if (amountData.length === 0) throw new Error('Unstake missing amount');
             
             const amount = new BN(amountData);
             
             if (currentStake.lt(amount)) {
                 throw new Error('Insufficient stake');
             }
             
             // Deduct from stake
             const newStake = currentStake.sub(amount);
             if (newStake.isZero()) {
                 storageChanges[senderKey] = ''; // Delete if zero? Or just 00
                 
                 // Remove from staker list
                 const idx = stakersList.indexOf(tx.from);
                 if (idx !== -1) {
                     stakersList.splice(idx, 1);
                     stakersList.sort();
                     const newJsonStr = JSON.stringify(stakersList);
                     storageChanges[allStakersKeyRaw] = Buffer.from(newJsonStr, 'utf8').toString('hex');
                 }
             } else {
                 storageChanges[senderKey] = newStake.toString('hex');
             }
             
             // Refund tokens: Staking Account -> Sender
             if (receiver.balance.lt(amount)) {
                  throw new Error('System Staking Contract insolvent (critical error)');
             }
             receiver.balance = receiver.balance.sub(amount);
             sender.balance = sender.balance.add(amount);
        } else {
            throw new Error('Unknown staking command');
        }
    }
    // --- End Native Staking Logic ---

    if (task.isCreate && task.code) {
        // Contract Creation: simplified - code is just stored
        // In real EVM/WASM, init code runs and returns body.
        // We will just store the code.
        const codeHash = Hash.hash(task.code);
        receiver.codeHash = codeHash;
        newCodeResult = {
            hash: codeHash,
            code: Buffer.from(task.code)
        };
        
        checkGas(GAS_COSTS.STORAGE_WRITE * (task.code.length / 32)); // Rough cost for code storage

    } else if (task.code && !task.isCreate) {
        // Contract Call
        checkGas(GAS_COSTS.WASM_EXECUTION_BASE);

        // Instantiate WASM
        try {
            let memory: WebAssembly.Memory;
            
            const imports = {
                env: {
                    // Minimal mocks
                    abort: () => { throw new Error('WASM Abort'); },
                    
                    // get_state(key_ptr, key_len, out_ptr) -> len
                    get_state: (key_ptr: number, key_len: number, out_ptr: number): number => {
                        checkGas(GAS_COSTS.STORAGE_READ);
                        
                        if (!memory) return 0;
                        const memBuf = memory.buffer;
                        // Copying from shared memory might be unsafe if resizing, but for this sync execution it's fine
                        const keyBuf = Buffer.from(memBuf.slice(key_ptr, key_ptr + key_len));
                        const keyHex = keyBuf.toString('hex');
                        
                        // Check storageChanges first, then storage
                        let valHex = storageChanges[keyHex] || storage[keyHex];
                        
                        if (!valHex) return 0;
                        
                        const valBuf = Buffer.from(valHex, 'hex');
                        if (out_ptr !== 0) {
                            const outView = new Uint8Array(memBuf);
                            outView.set(valBuf, out_ptr);
                        }
                        return valBuf.length;
                    },
                    
                    // set_state(key_ptr, key_len, val_ptr, val_len)
                    set_state: (key_ptr: number, key_len: number, val_ptr: number, val_len: number) => {
                         checkGas(GAS_COSTS.STORAGE_WRITE);

                         if (!memory) return;
                         const memBuf = memory.buffer;
                         const keyBuf = Buffer.from(memBuf.slice(key_ptr, key_ptr + key_len));
                         const valBuf = Buffer.from(memBuf.slice(val_ptr, val_ptr + val_len));
                         
                         storageChanges[keyBuf.toString('hex')] = valBuf.toString('hex');
                    },

                    // gas(amount) - explicit gas charge from WASM
                    gas: (amount: number) => {
                        checkGas(amount);
                    }
                }
            };

            const wasmModule = await WebAssembly.instantiate(task.code, imports) as any;
            
            // Set memory for imports to use
            memory = wasmModule.instance.exports.memory;

            // Execute 'main' if exists
            const exports = wasmModule.instance.exports as any;
            if (exports.main) {
                exports.main();
            }
        } catch (e: any) {
            console.error('WASM Execution failed:', e);
            throw new Error(`WASM Execution failed: ${e.message || e}`);
        }
    }

    // Refund unused gas
    const unusedGas = gasLimit - gasUsed;
    if (unusedGas > 0) {
        const refund = new BN(unusedGas).mul(tx.gasPrice);
        sender.balance = sender.balance.add(refund);
    }

    // 7. Return Changes
    const changes = [
      {
        address: tx.from,
        accountData: sender.serialize()
      },
      {
        address: receiverAddress,
        accountData: receiver.serialize()
      }
    ];

    const result: TxResult = {
      success: true,
      stateChanges: changes,
      storageChanges: Object.keys(storageChanges).length > 0 ? storageChanges : undefined,
      contractAddress: receiverAddress,
      gasUsed: gasUsed
    };

    if (newCodeResult) {
        result.newCode = newCodeResult;
    }

    parentPort?.postMessage(result);

  } catch (e: any) {
    parentPort?.postMessage({
      success: false,
      error: e.message
    } as TxResult);
  }
});