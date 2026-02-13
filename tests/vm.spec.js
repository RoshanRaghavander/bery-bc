import { test, describe, before, after, it } from 'node:test';
import assert from 'node:assert';
import { LevelDB } from '../dist/storage/index.js';
import { StateManager } from '../dist/state/state_manager.js';
import { VMExecutor } from '../dist/vm/index.js';
import { Transaction } from '../dist/core/transaction.js';
import { Account } from '../dist/state/account.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import fs from 'fs-extra';
import path from 'path';
import BN from 'bn.js';

describe('VMExecutor', () => {
    const dbPath = path.join(process.cwd(), 'test-vm-db-' + Date.now());
    let db;
    let stateManager;
    let vmExecutor;
    let senderKey;
    let receiverKey;

    before(async () => {
        await fs.remove(dbPath);
        await fs.ensureDir(dbPath);
        db = new LevelDB(dbPath);
        stateManager = new StateManager(db);
        vmExecutor = new VMExecutor(stateManager);
        
        senderKey = new KeyPair();
        receiverKey = new KeyPair();

        // Setup initial state
        const senderAccount = new Account();
        senderAccount.balance = new BN(1000);
        senderAccount.nonce = new BN(0);
        
        await stateManager.putAccount(senderKey.getAddress(), senderAccount);
    });

    after(async () => {
        await db.close();
        await fs.remove(dbPath);
    });

    it('should execute a valid value transfer', async () => {
        const amount = new BN(100);
        const tx = new Transaction({
            from: senderKey.getAddress(),
            to: receiverKey.getAddress(),
            value: amount,
            nonce: 0,
            gasPrice: new BN(1),
            gasLimit: 21000,
            data: Buffer.alloc(0)
        });
        
        tx.sign(senderKey);

        await vmExecutor.executeBlock([tx]);

        const sender = await stateManager.getAccount(senderKey.getAddress());
        const receiver = await stateManager.getAccount(receiverKey.getAddress());

        assert.strictEqual(sender.balance.toString(), '900');
        assert.strictEqual(receiver.balance.toString(), '100');
        assert.strictEqual(sender.nonce.toString(), '1');
    });

    it('should fail transaction with insufficient funds', async () => {
        const amount = new BN(2000); // More than balance
        // Note: Nonce should be 1 now
        const tx = new Transaction({
            from: senderKey.getAddress(),
            to: receiverKey.getAddress(),
            value: amount,
            nonce: 1,
            gasPrice: new BN(1),
            gasLimit: 21000,
            data: Buffer.alloc(0)
        });
        
        tx.sign(senderKey);

        await vmExecutor.executeBlock([tx]);

        // State should remain unchanged from previous test
        const sender = await stateManager.getAccount(senderKey.getAddress());
        const receiver = await stateManager.getAccount(receiverKey.getAddress());

        assert.strictEqual(sender.balance.toString(), '900');
        assert.strictEqual(receiver.balance.toString(), '100');
        assert.strictEqual(sender.nonce.toString(), '1');
    });

    it('should fail transaction with invalid nonce', async () => {
        const amount = new BN(50);
        const tx = new Transaction({
            from: senderKey.getAddress(),
            to: receiverKey.getAddress(),
            value: amount,
            nonce: 5, // Invalid nonce
            gasPrice: new BN(1),
            gasLimit: 21000,
            data: Buffer.alloc(0)
        });
        
        tx.sign(senderKey);

        await vmExecutor.executeBlock([tx]);

        // State should remain unchanged
        const sender = await stateManager.getAccount(senderKey.getAddress());
        
        assert.strictEqual(sender.nonce.toString(), '1');
    });
});
