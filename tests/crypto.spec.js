import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KeyPair } from '../dist/crypto/keypair.js';
import { Hash } from '../dist/crypto/hash.js';

describe('KeyPair', () => {
  it('creates a new keypair', () => {
    const kp = new KeyPair();
    assert.ok(kp.privateKey.length === 32);
    assert.ok(kp.publicKey.length === 33);
    const addr = kp.getAddress();
    assert.ok(/^[a-f0-9]{40}$/.test(addr), 'address is 40 hex chars');
  });

  it('restores from private key hex', () => {
    const kp1 = new KeyPair();
    const hex = kp1.privateKey.toString('hex');
    const kp2 = KeyPair.fromPrivateKey(hex);
    assert.strictEqual(kp2.getAddress(), kp1.getAddress());
  });

  it('signs and verifies', () => {
    const kp = new KeyPair();
    const msg = Buffer.from('hello bery');
    const sig = kp.sign(msg);
    assert.ok(sig.length === 65);
    assert.ok(KeyPair.verify(sig, msg, kp.publicKey));
  });

  it('recovers address from signature', () => {
    const kp = new KeyPair();
    const msg = Buffer.from('test');
    const sig = kp.sign(msg);
    const pubKey = KeyPair.recover(sig, msg);
    const addr = KeyPair.addressFromPublicKey(pubKey);
    assert.strictEqual(addr, kp.getAddress());
  });
});

describe('Hash', () => {
  it('hash produces 32 bytes', () => {
    const h = Hash.hash(Buffer.from('test'));
    assert.strictEqual(h.length, 32);
  });

  it('keccak256 produces 32 bytes', () => {
    const h = Hash.keccak256(Buffer.from('test'));
    assert.strictEqual(h.length, 32);
  });
});
