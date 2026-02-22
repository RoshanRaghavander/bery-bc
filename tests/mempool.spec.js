import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Mempool } from '../dist/mempool/index.js';
import { Transaction } from '../dist/core/transaction.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import BN from 'bn.js';

describe('Mempool', () => {
  it('adds and retrieves transaction', async () => {
    const mempool = new Mempool();
    const kp = new KeyPair();
    const tx = new Transaction({
      from: kp.getAddress(),
      to: '0'.repeat(40),
      value: new BN(1000),
      nonce: 1,
      gasLimit: 21000,
      gasPrice: new BN(1),
    });
    tx.sign(kp);

    const added = await mempool.add(tx);
    assert.strictEqual(added, true);
    assert.strictEqual(mempool.size(), 1);
    const got = mempool.get(tx.hash);
    assert.ok(got);
    assert.strictEqual(got.hash.toString('hex'), tx.hash.toString('hex'));
  });

  it('rejects duplicate tx', async () => {
    const mempool = new Mempool();
    const kp = new KeyPair();
    const tx = new Transaction({
      from: kp.getAddress(),
      to: '0'.repeat(40),
      value: new BN(1000),
      nonce: 1,
    });
    tx.sign(kp);

    await mempool.add(tx);
    const added2 = await mempool.add(tx);
    assert.strictEqual(added2, false);
    assert.strictEqual(mempool.size(), 1);
  });

  it('remove works', async () => {
    const mempool = new Mempool();
    const kp = new KeyPair();
    const tx = new Transaction({
      from: kp.getAddress(),
      to: '0'.repeat(40),
      value: new BN(1000),
      nonce: 1,
    });
    tx.sign(kp);
    await mempool.add(tx);
    mempool.remove(tx.hash);
    assert.strictEqual(mempool.size(), 0);
    assert.strictEqual(mempool.get(tx.hash), undefined);
  });
});
