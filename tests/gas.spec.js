import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { StateManager } from '../dist/state/state_manager.js';
import { VMExecutor } from '../dist/vm/index.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import { LevelDB } from '../dist/storage/index.js';
import { Transaction } from '../dist/core/transaction.js';
import fs from 'fs';
import path from 'path';
import BN from 'bn.js';

describe('Gas Metering', () => {
    let stateManager;
    let vmExecutor;
    let db;
    let keyPair;
    let tmpDir;

    before(async () => {
        tmpDir = path.join(process.cwd(), 'test-db-gas-' + Date.now());
        fs.mkdirSync(tmpDir, { recursive: true });
        db = new LevelDB(tmpDir);
        stateManager = new StateManager(db);
        vmExecutor = new VMExecutor(stateManager);
        keyPair = new KeyPair();
        
        // Create account with balance
        const acc = await stateManager.getAccount(keyPair.getAddress());
        acc.balance = new BN(10000);
        await stateManager.putAccount(keyPair.getAddress(), acc);
        await stateManager.checkpoint();
        await stateManager.commit();
    });

    after(async () => {
        await db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should fail transaction with insufficient gas for base cost', async () => {
        const tx = new Transaction({
            from: keyPair.getAddress(),
            to: keyPair.getAddress(), // Self-transfer
            value: new BN(10),
            nonce: 0,
            gasLimit: 10000, // < 21000 BASE COST
            gasPrice: new BN(1)
        });
        tx.sign(keyPair);

        // Execute block (we just need to see if it processes or logs failure)
        // VMExecutor doesn't throw on tx failure, it logs warning.
        // We can check if state changed.
        
        await vmExecutor.executeBlock([tx]);
        
        // Check nonce - should NOT have incremented if tx failed entirely?
        // Actually, in Ethereum, if gas fails, nonce increments and you pay gas.
        // But in our simplified implementation:
        // worker.ts throws "Out of gas".
        // executor.ts catches and resolves.
        // executor.ts checks result.success.
        // If !success, state changes are NOT applied.
        // So nonce should be 0.
        
        const acc = await stateManager.getAccount(keyPair.getAddress());
        assert.strictEqual(acc.nonce.toNumber(), 0, 'Nonce should not increment on base gas failure (simplified)');
    });

    it('should succeed transaction with sufficient gas', async () => {
        const tx = new Transaction({
            from: keyPair.getAddress(),
            to: keyPair.getAddress(),
            value: new BN(10),
            nonce: 0, // Retrying with correct nonce
            gasLimit: 30000, // > 21000
            gasPrice: new BN(1)
        });
        tx.sign(keyPair);

        await vmExecutor.executeBlock([tx]);

                const acc = await stateManager.getAccount(keyPair.getAddress());
                // console.log('Retrieved account nonce:', acc.nonce.toString());
                // console.log('Address:', keyPair.getAddress());
                assert.strictEqual(acc.nonce.toNumber(), 1, 'Nonce should increment on success');
            });
});
