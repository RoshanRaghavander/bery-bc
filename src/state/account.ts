import BN from 'bn.js';

export class Account {
  public nonce: BN;
  public balance: BN;
  public storageRoot: Buffer;
  public codeHash: Buffer;

  constructor(nonce: BN = new BN(0), balance: BN = new BN(0), storageRoot: Buffer = Buffer.alloc(32), codeHash: Buffer = Buffer.alloc(32)) {
    this.nonce = nonce;
    this.balance = balance;
    this.storageRoot = storageRoot;
    this.codeHash = codeHash;
  }

  public serialize(): Buffer {
    // Simple serialization
    const nonceBuf = Buffer.alloc(32); // Use 32 bytes for nonce to be safe, or 8. BN can be large.
    // BN.toArrayLike(Buffer, 'be', length)
    // console.error(`Serialize: nonce=${this.nonce.toString()}`);
    const n = this.nonce.toArrayLike(Buffer, 'be', 32);
    const b = this.balance.toArrayLike(Buffer, 'be', 32);
    
    return Buffer.concat([n, b, this.storageRoot, this.codeHash]);
  }

  public static deserialize(buf: Buffer): Account {
    if (buf.length < 128) { // 32*4
      // Handle empty or partial?
      return new Account();
    }
    const nonce = new BN(buf.slice(0, 32));
    const balance = new BN(buf.slice(32, 64));
    const storageRoot = buf.slice(64, 96);
    const codeHash = buf.slice(96, 128);
    return new Account(nonce, balance, storageRoot, codeHash);
  }
}
