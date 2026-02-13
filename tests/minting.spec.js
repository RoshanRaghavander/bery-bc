import { test, describe, before, after, it } from 'node:test';
import assert from 'node:assert';
import { LevelDB } from '../dist/storage/index.js';
import { StateManager } from '../dist/state/state_manager.js';
import { VMExecutor } from '../dist/vm/index.js';
import { Transaction, SYSTEM_SENDER } from '../dist/core/transaction.js';
import { Account } from '../dist/state/account.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import fs from 'fs-extra';
import path from 'path';
import BN from 'bn.js';

describe('Minting (Coinbase)', () => {
    const dbPath = path.join(process.cwd(), 'test-minting-db-' + Date.now());
    let db;
    let stateManager;
    let vmExecutor;
    let receiverKey;

    before(async () => {
        await fs.remove(dbPath);
        await fs.ensureDir(dbPath);
        db = new LevelDB(dbPath);
        stateManager = new StateManager(db);
        vmExecutor = new VMExecutor(stateManager);
        
        receiverKey = new KeyPair();
    });

    after(async () => {
        await db.close();
        await fs.remove(dbPath);
    });

    it('should execute a SYSTEM_SENDER transaction (minting)', async () => {
        const amount = new BN('1000000000000000000'); // 1 Token
        const tx = new Transaction({
            from: SYSTEM_SENDER,
            to: receiverKey.getAddress(),
            value: amount,
            nonce: 1, // Nonce doesn't matter for System, but usually height
            gasPrice: new BN(0),
            gasLimit: 21000,
            data: Buffer.alloc(0)
        });
        
        await vmExecutor.executeBlock([tx]);

        const receiver = await stateManager.getAccount(receiverKey.getAddress());

        // Check Balance: Should be 1 Token
        assert.strictEqual(receiver.balance.toString(), amount.toString());
    });

    it('should allow arbitrary nonce for SYSTEM_SENDER', async () => {
        const amount = new BN('1000000000000000000');
        const tx = new Transaction({
            from: SYSTEM_SENDER,
            to: receiverKey.getAddress(),
            value: amount,
            nonce: 99999, // Arbitrary nonce
            gasPrice: new BN(0),
            gasLimit: 21000
        });

        await vmExecutor.executeBlock([tx]);

        const receiver = await stateManager.getAccount(receiverKey.getAddress());
        // Should be 2 Tokens now
        assert.strictEqual(receiver.balance.toString(), amount.mul(new BN(2)).toString());
    });
});
