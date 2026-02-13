import { randomBytes } from 'crypto';
import secp256k1 from 'secp256k1';
import { Hash } from './hash.js';

export class KeyPair {
  public readonly privateKey: Buffer;
  public readonly publicKey: Buffer;

  constructor(privateKey?: Buffer) {
    if (privateKey) {
      if (!secp256k1.privateKeyVerify(privateKey)) {
        throw new Error('Invalid private key');
      }
      this.privateKey = privateKey;
    } else {
      do {
        this.privateKey = randomBytes(32);
      } while (!secp256k1.privateKeyVerify(this.privateKey));
    }
    this.publicKey = Buffer.from(secp256k1.publicKeyCreate(this.privateKey));
  }

  public sign(message: Buffer): Buffer {
    // We sign the hash of the message
    const msgHash = Hash.hash(message);
    const { signature, recid } = secp256k1.ecdsaSign(msgHash, this.privateKey);
    
    // Return 65 bytes: 64 bytes signature + 1 byte recovery ID
    return Buffer.concat([Buffer.from(signature), Buffer.from([recid])]);
  }

  public static verify(signature: Buffer, message: Buffer, publicKey: Buffer): boolean {
    const msgHash = Hash.hash(message);
    // Handle both 64-byte and 65-byte signatures for backward compatibility or flexibility
    const sig = signature.length === 65 ? signature.subarray(0, 64) : signature;
    return secp256k1.ecdsaVerify(sig, msgHash, publicKey);
  }

  public static recover(signature: Buffer, message: Buffer): Buffer {
      if (signature.length !== 65) {
          throw new Error('Invalid signature length for recovery (expected 65 bytes)');
      }
      const sig = signature.subarray(0, 64);
       const recid = signature[64];
       const msgHash = Hash.hash(message);
       
       // Recover compressed public key (compressed=true) to match publicKeyCreate default
       const pubKey = secp256k1.ecdsaRecover(sig, recid, msgHash, true); 
       return Buffer.from(pubKey);
   }
  
  public getAddress(): string {
    return KeyPair.addressFromPublicKey(this.publicKey);
  }

  public static addressFromPublicKey(publicKey: Buffer): string {
      // Bery Chain Address: Keccak256(PublicKey).slice(-20)
      const hash = Hash.keccak256(publicKey);
      return hash.subarray(hash.length - 20).toString('hex');
  }

  public static fromPrivateKey(privateKeyHex: string): KeyPair {
    return new KeyPair(Buffer.from(privateKeyHex, 'hex'));
  }
}
