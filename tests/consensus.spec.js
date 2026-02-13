import { test, describe, before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert';
import { LevelDB } from '../dist/storage/index.js';
import { StateManager } from '../dist/state/state_manager.js';
import { Mempool } from '../dist/mempool/index.js';
import { BFTConsensus } from '../dist/consensus/bft.js';
import { VMExecutor } from '../dist/vm/index.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import { Block } from '../dist/core/block.js';
import { Transaction } from '../dist/core/transaction.js';
import { Account } from '../dist/state/account.js';
import { MockP2PNetwork } from './mocks/p2p.js';
import fs from 'fs-extra';
import path from 'path';
import BN from 'bn.js';

describe('BFTConsensus', () => {
    const dbPath = path.join(process.cwd(), 'test-consensus-db-' + Date.now());
    let db;
    let stateManager;
    let mempool;
    let network;
    let vmExecutor;
    let consensus;
    let keyPair;
    let otherKeyPair;

    beforeEach(async () => {
        await fs.remove(dbPath);
        await fs.ensureDir(dbPath);
        db = new LevelDB(dbPath);
        stateManager = new StateManager(db);
        mempool = new Mempool();
        network = new MockP2PNetwork();
        vmExecutor = new VMExecutor(stateManager);
        
        keyPair = new KeyPair();
        otherKeyPair = new KeyPair();
        const validators = [
            { publicKey: otherKeyPair.getAddress(), power: 10 },
            { publicKey: keyPair.getAddress(), power: 10 }
        ];
        
        // Fund accounts for testing
        const senderAccount = new Account();
        senderAccount.balance = new BN(1000);
        await stateManager.putAccount(otherKeyPair.getAddress(), senderAccount);
        
        // Ensure state is committed/root is available for the block creation
        // But our VM execution relies on current state.
        
        consensus = new BFTConsensus(stateManager, mempool, network, validators, keyPair, vmExecutor);
    });

    afterEach(async () => {
        if (consensus) consensus.stop();
        await db.close();
        await fs.remove(dbPath);
    });

    it('should propose a block when it is the proposer', async () => {
        // Mock network broadcast to capture the block
        let broadcastedBlock = null;
        
        const broadcastPromise = new Promise(resolve => {
            network.on('broadcast_block', (block) => {
                broadcastedBlock = block;
                resolve(block);
            });
        });

        // Trigger consensus round
        await consensus.start();

        // Wait for broadcast (max 2s)
        await Promise.race([
            broadcastPromise,
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        assert.ok(broadcastedBlock, 'Block should be broadcasted');
        assert.strictEqual(broadcastedBlock.header.height, 1); // Height is 1 (0 is genesis/empty)
        assert.strictEqual(broadcastedBlock.header.validator, keyPair.getAddress());
    });

    it('should verify a valid incoming block', async () => {
        // 1. Create a transaction
        const tx = new Transaction({
            from: otherKeyPair.getAddress(),
            to: keyPair.getAddress(),
            value: new BN(100),
            nonce: 0,
            gasPrice: new BN(1),
            gasLimit: 21000,
            data: Buffer.alloc(0)
        });
        tx.sign(otherKeyPair);

        // 2. Execute it temporarily to get state root
        await stateManager.checkpoint();
        await vmExecutor.executeBlock([tx]);
        const expectedRoot = await stateManager.getRoot();
        await stateManager.revert(); 

        // 3. Create Block
        const block = Block.create(
            Buffer.alloc(32), // Parent hash matches initial lastCommitHash
            expectedRoot,
            otherKeyPair.getAddress(),
            [tx],
            2 // Height 2 (Index 0 is proposer)
        );
        block.header.sign(otherKeyPair);

        // 4. Simulate network receiving block
        let verified = false;
        
        const verifiedPromise = new Promise(resolve => {
            consensus.on('block:verified', (b) => {
                if (b.header.height === 2) {
                    verified = true;
                    resolve(true);
                }
            });
        });

        network.emit('block', block.toJSON());

        await Promise.race([
            verifiedPromise,
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        assert.strictEqual(verified, true, 'Block should be verified');
    });
});
