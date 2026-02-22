import BN from 'bn.js';
import { Hash, KeyPair } from '../crypto/index.js';

export const SYSTEM_SENDER = '0000000000000000000000000000000000000000'; // 20 bytes
export const STAKING_ADDRESS = '0000000000000000000000000000000000000100'; // 20 bytes

export interface TransactionData {
  from: string;
  to: string;
  value: BN;
  nonce: number;
  gasLimit?: number;
  gasPrice?: BN;
  data?: Buffer;
  signature?: Buffer;
  /** Ethereum tx hash override - when set, used for eth_getTransactionByHash lookup */
  ethHash?: Buffer;
}

export class Transaction {
  public readonly from: string;
  public readonly to: string;
  public readonly value: BN;
  public readonly nonce: number;
  public readonly gasLimit: number;
  public readonly gasPrice: BN;
  public readonly data: Buffer;
  public signature?: Buffer;
  private _hash?: Buffer;
  private _ethHash?: Buffer;

  constructor(txData: TransactionData) {
    this.from = txData.from;
    this.to = txData.to;
    this.value = txData.value;
    this.nonce = txData.nonce;
    this.gasLimit = txData.gasLimit || 1000000; // Default gas limit
    this.gasPrice = txData.gasPrice || new BN(1); // Default gas price
    this.data = txData.data || Buffer.alloc(0);
    this.signature = txData.signature;
    this._ethHash = txData.ethHash;
  }

  /**
   * Serializes the transaction for signing (excludes signature)
   */
  public getBytes(): Buffer {
    const fromBuf = Buffer.from(this.from, 'hex');
    const toBuf = Buffer.from(this.to, 'hex');
    const valueBuf = Buffer.from(this.value.toString(16).padStart(64, '0'), 'hex'); // 32 bytes for value
    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64BE(BigInt(this.nonce));
    
    const gasLimitBuf = Buffer.alloc(8);
    gasLimitBuf.writeBigUInt64BE(BigInt(this.gasLimit));
    
    const gasPriceBuf = Buffer.from(this.gasPrice.toString(16).padStart(64, '0'), 'hex'); // 32 bytes

    return Buffer.concat([
      fromBuf,
      toBuf,
      valueBuf,
      nonceBuf,
      gasLimitBuf,
      gasPriceBuf,
      this.data
    ]);
  }

  /**
   * Computes the hash of the transaction (including signature if present)
   */
  public get hash(): Buffer {
    if (this._ethHash) return this._ethHash;
    if (this._hash) return this._hash;
    
    const base = this.getBytes();
    if (this.signature) {
      this._hash = Hash.hash(Buffer.concat([base, this.signature]));
    } else {
      this._hash = Hash.hash(base);
    }
    return this._hash;
  }

  public sign(keyPair: KeyPair): void {
    if (keyPair.getAddress() !== this.from) {
      throw new Error('Signer does not match transaction sender');
    }
    const msg = this.getBytes();
    this.signature = keyPair.sign(msg);
    this._hash = undefined; // Invalidate cached hash
  }

  public verify(): boolean {
    if (this.from === SYSTEM_SENDER) return true; // System transactions don't need signature
    if (!this.signature) return false;
    
    try {
        const msg = this.getBytes();
        // Recover Public Key from Signature
        // We assume signature is 65 bytes (r, s, v)
        // If it's 64 bytes (legacy), we can't recover easily without trying both v=0/1 and matching address
        
        let recoveredPubKey: Buffer;
        if (this.signature.length === 65) {
             // Recover compressed public key (to match KeyPair generation)
             recoveredPubKey = KeyPair.recover(this.signature, msg);
        } else {
             // Fallback or fail?
             // Serious L1 requires recovery.
             return false; 
        }

        const recoveredAddress = KeyPair.addressFromPublicKey(recoveredPubKey);
        return recoveredAddress === this.from;
    } catch (e) {
        // logger.error('Tx verification failed', e);
        return false;
    }
  }

  public toJSON() {
    return {
      from: this.from,
      to: this.to,
      value: this.value.toString(10),
      nonce: this.nonce,
      gasLimit: this.gasLimit,
      gasPrice: this.gasPrice.toString(10),
      data: this.data.toString('hex'),
      signature: this.signature?.toString('hex'),
      hash: this.hash.toString('hex'),
      ethHash: this._ethHash?.toString('hex')
    };
  }

  public static fromJSON(json: any): Transaction {
      return new Transaction({
          from: json.from,
          to: json.to,
          value: new BN(json.value),
          nonce: json.nonce,
          gasLimit: json.gasLimit,
          gasPrice: json.gasPrice ? new BN(json.gasPrice) : undefined,
          data: json.data ? Buffer.from(json.data, 'hex') : undefined,
          signature: json.signature ? Buffer.from(json.signature, 'hex') : undefined,
          ethHash: json.ethHash ? Buffer.from(json.ethHash, 'hex') : undefined
      });
  }
}