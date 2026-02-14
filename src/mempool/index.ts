import { Transaction, SYSTEM_SENDER } from '../core/transaction.js';
import { EventEmitter } from 'events';
import BN from 'bn.js';
import { StateManager } from '../state/state_manager.js';

export class Mempool extends EventEmitter {
  private txs: Map<string, Transaction> = new Map();
  private readonly MAX_SIZE = 5000;
  private stateManager?: StateManager;

  constructor(stateManager?: StateManager) {
    super();
    this.stateManager = stateManager;
  }

  public async add(tx: Transaction): Promise<boolean> {
    // Basic verification
    if (!tx.verify()) return false;

    // Reject System Transactions (they are only for Block Rewards)
    if (tx.from === SYSTEM_SENDER) return false;
    // Enforce nonce policy if state available
    if (this.stateManager) {
        // Simple rule: require next nonce
        // More advanced: allow queuing per sender; omitted for now
        try {
            const senderAcc = await this.stateManager.getAccount(tx.from);
            const expected = senderAcc.nonce.toNumber() + 1;
            if (tx.nonce !== expected) {
                return false;
            }
        } catch {
            // If state read fails, reject conservatively
            return false;
        }
    }
    
    const hash = tx.hash.toString('hex');
    if (this.txs.has(hash)) return false;

    // DOS Protection: Mempool Limit
    if (this.txs.size >= this.MAX_SIZE) {
        // Eviction Strategy: Remove lowest fee transaction
        const lowest = this.getLowestFeeTransaction();
        if (lowest) {
            // Only replace if new tx has higher gas price
            if (tx.gasPrice.gt(lowest.gasPrice)) {
                this.remove(lowest.hash);
            } else {
                return false; // Reject new tx if it pays less than the worst in mempool
            }
        } else {
            return false;
        }
    }
    
    this.txs.set(hash, tx);
    this.emit('tx', tx);
    return true;
  }

  private getLowestFeeTransaction(): Transaction | null {
      let lowest: Transaction | null = null;
      for (const tx of this.txs.values()) {
          if (!lowest || tx.gasPrice.lt(lowest.gasPrice)) {
              lowest = tx;
          }
      }
      return lowest;
  }

  public remove(txHash: string | Buffer) {
    const hashStr = Buffer.isBuffer(txHash) ? txHash.toString('hex') : txHash;
    this.txs.delete(hashStr);
  }
  
  public getTransactions(limit: number): Transaction[] {
      // Sort by Gas Price (Descending)
      return Array.from(this.txs.values())
          .sort((a, b) => b.gasPrice.cmp(a.gasPrice))
          .slice(0, limit);
  }
  
  public has(txHash: string | Buffer): boolean {
      const hashStr = Buffer.isBuffer(txHash) ? txHash.toString('hex') : txHash;
      return this.txs.has(hashStr);
  }

  public size(): number {
      return this.txs.size;
  }
}
