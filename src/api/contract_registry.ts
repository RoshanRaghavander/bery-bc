/**
 * Simple contract verification registry.
 * Stores verified contract metadata (name, source, ABI) keyed by address.
 */
import fs from 'fs-extra';
import path from 'path';

export interface VerifiedContract {
  address: string;
  name: string;
  compilerVersion?: string;
  source: string;
  abi: any[];
  verifiedAt: number;
}

export class ContractRegistry {
  private filePath: string;
  private store: Map<string, VerifiedContract> = new Map();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'verified_contracts.json');
  }

  loadSync(): void {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const arr = JSON.parse(data);
      if (Array.isArray(arr)) {
        for (const c of arr) {
          const addr = (c.address || '').replace(/^0x/, '').toLowerCase();
          if (addr.length === 40) this.store.set(addr, c);
        }
      }
    } catch {
      // File doesn't exist or invalid - start fresh
    }
  }

  async save(): Promise<void> {
    const arr = Array.from(this.store.values());
    await fs.ensureDir(path.dirname(this.filePath));
    await fs.writeFile(this.filePath, JSON.stringify(arr, null, 2));
  }

  async add(contract: Omit<VerifiedContract, 'verifiedAt'>): Promise<VerifiedContract> {
    const addr = (contract.address || '').replace(/^0x/, '').toLowerCase();
    if (addr.length !== 40) throw new Error('Invalid address');
    const rec: VerifiedContract = {
      ...contract,
      address: '0x' + addr,
      verifiedAt: Date.now(),
    };
    this.store.set(addr, rec);
    this.save().catch(() => {});
    return rec;
  }

  get(address: string): VerifiedContract | null {
    const addr = (address || '').replace(/^0x/, '').toLowerCase();
    return this.store.get(addr) || null;
  }

  list(limit = 50): VerifiedContract[] {
    return Array.from(this.store.values()).slice(-limit);
  }
}
