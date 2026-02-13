import { Transaction, SYSTEM_SENDER } from './transaction.js';
import { Hash, KeyPair } from '../crypto/index.js';
import { MerkleTree } from '../common/merkle.js';

export interface BlockHeaderData {
  version: number;
  height: number;
  round: number;
  timestamp: number;
  parentHash: Buffer;
  stateRoot: Buffer;
  transactionsRoot: Buffer;
  validator: string; // Public key of validator
  signature?: Buffer;
}

export class BlockHeader {
  public readonly version: number;
  public readonly height: number;
  public readonly round: number;
  public readonly timestamp: number;
  public readonly parentHash: Buffer;
  public readonly stateRoot: Buffer;
  public readonly transactionsRoot: Buffer;
  public readonly validator: string;
  public signature?: Buffer;
  private _hash?: Buffer;

  constructor(data: BlockHeaderData) {
    this.version = data.version;
    this.height = data.height;
    this.round = data.round || 0; // Default to 0 for backward compatibility
    this.timestamp = data.timestamp;
    this.parentHash = data.parentHash;
    this.stateRoot = data.stateRoot;
    this.transactionsRoot = data.transactionsRoot;
    this.validator = data.validator;
    this.signature = data.signature;
  }

  public getBytes(): Buffer {
    const versionBuf = Buffer.alloc(4);
    versionBuf.writeUInt32BE(this.version);
    
    const heightBuf = Buffer.alloc(8);
    heightBuf.writeBigUInt64BE(BigInt(this.height));

    const roundBuf = Buffer.alloc(4);
    roundBuf.writeUInt32BE(this.round);
    
    const timestampBuf = Buffer.alloc(8);
    timestampBuf.writeBigUInt64BE(BigInt(this.timestamp));

    const validatorBuf = Buffer.from(this.validator, 'hex');

    return Buffer.concat([
      versionBuf,
      heightBuf,
      roundBuf,
      timestampBuf,
      this.parentHash,
      this.stateRoot,
      this.transactionsRoot,
      validatorBuf
    ]);
  }

  public get hash(): Buffer {
    if (this._hash) return this._hash;
    // Hash does NOT include signature for signing purposes usually, 
    // but the block ID should probably include the signature if we want to commit to the specific validator choice?
    // In Tendermint, the BlockID is hash of header. Header includes proposer address.
    // The signature is usually separate (in Commit) or part of the header.
    // If signature is IN header, we sign everything EXCEPT signature.
    
    const bytes = this.getBytes();
    if (this.signature) {
         // If we want the hash to represent the FULL header including signature:
         this._hash = Hash.hash(Buffer.concat([bytes, this.signature]));
    } else {
         this._hash = Hash.hash(bytes);
    }
    return this._hash;
  }

  public sign(keyPair: KeyPair): void {
    if (keyPair.getAddress() !== this.validator) {
      throw new Error('Signer does not match block validator');
    }
    const msg = this.getBytes();
    this.signature = keyPair.sign(msg);
    this._hash = undefined;
  }

  public verify(): boolean {
    if (!this.signature) return false;
    const msg = this.getBytes();
    try {
        return KeyPair.verify(this.signature, msg, Buffer.from(this.validator, 'hex'));
    } catch (e) {
        return false;
    }
  }

  public toJSON() {
    return {
      version: this.version,
      height: this.height,
      round: this.round,
      timestamp: this.timestamp,
      parentHash: this.parentHash.toString('hex'),
      stateRoot: this.stateRoot.toString('hex'),
      transactionsRoot: this.transactionsRoot.toString('hex'),
      validator: this.validator,
      signature: this.signature?.toString('hex'),
      hash: this.hash.toString('hex')
    };
  }

  public static fromJSON(json: any): BlockHeader {
      return new BlockHeader({
          version: json.version,
          height: json.height,
          round: json.round,
          timestamp: json.timestamp,
          parentHash: Buffer.from(json.parentHash, 'hex'),
          stateRoot: Buffer.from(json.stateRoot, 'hex'),
          transactionsRoot: Buffer.from(json.transactionsRoot, 'hex'),
          validator: json.validator,
          signature: json.signature ? Buffer.from(json.signature, 'hex') : undefined
      });
  }
}

export class Block {
  public readonly header: BlockHeader;
  public readonly transactions: Transaction[];

  constructor(header: BlockHeader, transactions: Transaction[]) {
    this.header = header;
    this.transactions = transactions;
  }

  public static create(
    parentHash: Buffer,
    stateRoot: Buffer,
    validator: string,
    transactions: Transaction[],
    height: number,
    round: number = 0,
    timestamp: number = Date.now()
  ): Block {
    const txHashes = transactions.map(tx => tx.hash);
    const transactionsRoot = MerkleTree.computeRoot(txHashes);

    const header = new BlockHeader({
      version: 1,
      height,
      round,
      timestamp,
      parentHash,
      stateRoot,
      transactionsRoot,
      validator
    });

    return new Block(header, transactions);
  }

  public get hash(): Buffer {
    return this.header.hash;
  }

  public verify(): boolean {
      // 1. Verify header signature
      if (!this.header.verify()) return false;
      
      // 2. Verify transactions root
      const txHashes = this.transactions.map(tx => tx.hash);
      const computedRoot = MerkleTree.computeRoot(txHashes);
      if (!computedRoot.equals(this.header.transactionsRoot)) return false;

      // 3. Verify all transactions (signatures)
      for (let i = 0; i < this.transactions.length; i++) {
          const tx = this.transactions[i];
          if (!tx.verify()) return false;

          // Enforce Coinbase Rule: Only the first transaction can be from SYSTEM_SENDER
          if (tx.from === SYSTEM_SENDER && i !== 0) {
              return false;
          }
      }

      return true;
  }
  
  public toJSON() {
      return {
          header: this.header.toJSON(),
          transactions: this.transactions.map(tx => tx.toJSON())
      }
  }

  public static fromJSON(json: any): Block {
      const header = BlockHeader.fromJSON(json.header);
      const transactions = json.transactions.map((tx: any) => Transaction.fromJSON(tx));
      return new Block(header, transactions);
  }
}