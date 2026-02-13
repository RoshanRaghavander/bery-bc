import { SecureTrie } from 'merkle-patricia-tree';
import { Account } from './account.js';
import { LevelDB } from '../storage/index.js';

export class StateManager {
  private trie: any; // SecureTrie type is tricky to import correctly sometimes

  constructor(db: any) {
    // Handle both LevelDB wrapper and raw Level instance
    const levelDb = db.db || db;
    this.trie = new SecureTrie(levelDb); 
  }

  async getAccount(address: string): Promise<Account> {
    const data = await this.trie.get(Buffer.from(address, 'hex'));
    if (!data) {
      return new Account();
    }
    return Account.deserialize(data);
  }

  async putAccount(address: string, account: Account): Promise<void> {
    await this.trie.put(Buffer.from(address, 'hex'), account.serialize());
  }

  async getRoot(): Promise<Buffer> {
    return this.trie.root;
  }
  
  async setRoot(root: Buffer): Promise<void> {
    this.trie.root = root;
  }

  /**
   * Commits the state (persists the trie nodes to DB)
   * The Trie implementation usually writes to DB immediately or on checkpoint commit.
   * With standard Trie, put() writes to DB.
   */
  async checkpoint(): Promise<void> {
      this.trie.checkpoint();
  }

  async commit(): Promise<void> {
      try {
          await this.trie.commit();
      } catch (e: any) {
          console.error('StateManager.commit failed:', e);
          throw e;
      }
  }

  async revert(): Promise<void> {
      await this.trie.revert();
  }

  async putCode(codeHash: Buffer, code: Buffer): Promise<void> {
    const key = Buffer.concat([Buffer.from('CODE:'), codeHash]);
    // access underlying db directly
    await (this.trie.db as any).put(key, code);
  }

  async getCode(codeHash: Buffer): Promise<Buffer | null> {
    const key = Buffer.concat([Buffer.from('CODE:'), codeHash]);
    try {
        const code = await (this.trie.db as any).get(key);
        return code;
    } catch (e) {
        return null;
    }
  }

  async getContractStorage(address: string, key: Buffer): Promise<Buffer | null> {
      const account = await this.getAccount(address);
      if (account.storageRoot.equals(Buffer.alloc(32))) return null;
      
      const storageTrie = new SecureTrie(this.trie.db, account.storageRoot);
      return storageTrie.get(key);
  }

  async putContractStorage(address: string, key: Buffer, value: Buffer): Promise<void> {
      const account = await this.getAccount(address);
      
      let root: Buffer | undefined = account.storageRoot;
      if (root.equals(Buffer.alloc(32))) {
          root = undefined;
      }

      const storageTrie = new SecureTrie(this.trie.db, root);
      
      await storageTrie.put(key, value);
      
      account.storageRoot = storageTrie.root;
      await this.putAccount(address, account);
  }

  async dumpContractStorage(address: string): Promise<Record<string, string>> {
      const account = await this.getAccount(address);
      const storage: Record<string, string> = {};
      
      if (!account.storageRoot || account.storageRoot.equals(Buffer.alloc(32))) return storage;

      const storageTrie = new SecureTrie(this.trie.db, account.storageRoot);
      
      return new Promise((resolve, reject) => {
          storageTrie.createReadStream()
            .on('data', (data: any) => {
                storage[data.key.toString('hex')] = data.value.toString('hex');
            })
            .on('end', () => resolve(storage))
            .on('error', reject);
      });
  }
}
