import sodium from 'sodium-native';
import { keccak_256 } from '@noble/hashes/sha3.js';

// @ts-ignore
const sodiumFn = sodium.default || sodium;

export class Hash {
  /**
   * Computes BLAKE2b hash of the input
   * @param data - The data to hash
   * @returns The 32-byte hash as a Buffer
   */
  static hash(data: Buffer | string): Buffer {
    const out = Buffer.alloc(sodiumFn.crypto_generichash_BYTES);
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
    sodiumFn.crypto_generichash(out, input);
    return out;
  }

  /**
   * Computes Keccak-256 hash of the input (Ethereum standard)
   * @param data - The data to hash
   * @returns The 32-byte hash as a Buffer
   */
  static keccak256(data: Buffer | string): Buffer {
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.from(keccak_256(input));
  }

  /**
   * Computes SHA256 hash of the input (useful for Merkle Trees / compatibility)
   * @param data - The data to hash
   * @returns The 32-byte hash as a Buffer
   */
  static sha256(data: Buffer | string): Buffer {
    const out = Buffer.alloc(sodiumFn.crypto_hash_sha256_BYTES);
    const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
    sodiumFn.crypto_hash_sha256(out, input);
    return out;
  }
}
