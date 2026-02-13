import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { BFTConsensus } from '../dist/consensus/bft.js';
import { StateManager } from '../dist/state/state_manager.js';
import { Mempool } from '../dist/mempool/index.js';
import { VMExecutor } from '../dist/vm/index.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import { LevelDB } from '../dist/storage/index.js';
import { MockP2PNetwork } from './mocks/p2p.js';
import { Transaction } from '../dist/core/transaction.js';
import { Hash } from '../dist/crypto/hash.js';
import fs from 'fs';
import path from 'path';
import BN from 'bn.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('WASM and Consensus Commit', () => {
    let consensus;
    let stateManager;
    let mempool;
    let network;
    let vmExecutor;
    let db;
    let keyPair;
    let tmpDir;
    let interval;

    before(async () => {
        tmpDir = path.join(process.cwd(), 'test-db-wasm-' + Date.now());
        fs.mkdirSync(tmpDir, { recursive: true });
        db = new LevelDB(tmpDir);
        stateManager = new StateManager(db);
        mempool = new Mempool();
        network = new MockP2PNetwork();
        vmExecutor = new VMExecutor(stateManager);
        keyPair = new KeyPair();
        
        // Create account with balance
        const acc = await stateManager.getAccount(keyPair.getAddress());
        acc.balance = new BN(1000);
        await stateManager.putAccount(keyPair.getAddress(), acc);
        await stateManager.checkpoint();
        await stateManager.commit(); // Commit genesis state

        // Mock validators
        const validators = [{ publicKey: keyPair.getAddress(), power: 1 }];
        
        consensus = new BFTConsensus(
            stateManager,
            mempool,
            network,
            validators,
            keyPair,
            vmExecutor
        );
        
        // Start consensus (which sets up listeners)
        // await consensus.start(); 
        // We will manually trigger runRound to avoid race conditions with setInterval in test
    });

    after(async () => {
        if (consensus['interval']) clearInterval(consensus['interval']);
        await db.close();
        // fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should deploy a WASM contract and commit the block', async () => {
        // 1. Create Deployment Transaction
        // Minimal valid WASM: \0asm\1\0\0\0
        const wasmCode = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
        
        const tx = new Transaction({
            from: keyPair.getAddress(),
            to: '', // Creation
            value: new BN(0),
            nonce: 0,
            data: wasmCode
        });
        tx.sign(keyPair);

        // 2. Add to Mempool
        await mempool.add(tx);

        // 3. Trigger Proposal Manually
        // Access private method via any cast or just wait if we started it.
        // We didn't start it. Let's call runRound.
        await consensus['runRound']();

        // 4. Wait for processing (handleBlock is async)
        await new Promise(resolve => setTimeout(resolve, 1000));

        assert.strictEqual(consensus.getHeight(), 1, 'Height should be 1');

        // 5. Verify Code in State
        const codeHash = Hash.hash(wasmCode);
        
        const storedCode = await stateManager.getCode(codeHash);
        assert.ok(storedCode, 'Code should be stored in DB');
        assert.deepStrictEqual(storedCode, wasmCode, 'Stored code should match');
    });
});
