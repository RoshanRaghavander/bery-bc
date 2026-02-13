import { test, describe, before, after, it } from 'node:test';
import assert from 'node:assert';
import { APIServer } from '../dist/api/index.js';
import { Mempool } from '../dist/mempool/index.js';
import { StateManager } from '../dist/state/state_manager.js';
import { LevelDB } from '../dist/storage/index.js';
import { MockP2PNetwork } from './mocks/p2p.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import { Transaction } from '../dist/core/transaction.js';
import fs from 'fs-extra';
import BN from 'bn.js';

// Update MockP2PNetwork for API requirements
MockP2PNetwork.prototype.getPeers = function() { return ['peer1', 'peer2']; };
Object.defineProperty(MockP2PNetwork.prototype, 'peerId', { get: function() { return 'mock-node-id'; } });

describe('APIServer', () => {
    const dbPath = './data/test-api-db';
    let db;
    let stateManager;
    let mempool;
    let network;
    let api;
    let server;
    let port = 3333;

    before(async () => {
        await fs.remove(dbPath);
        await fs.ensureDir(dbPath);
        db = new LevelDB(dbPath);
        stateManager = new StateManager(db);
        mempool = new Mempool();
        network = new MockP2PNetwork();
        
        // Pass undefined for consensus as it's optional
        api = new APIServer(port, mempool, stateManager, network);
        server = api.start();
    });

    after(async () => {
        if (server) server.close();
        await db.close();
        await fs.remove(dbPath);
    });

    it('should return node status', async () => {
        const res = await fetch(`http://localhost:${port}/status`);
        const data = await res.json();
        
        assert.strictEqual(data.height, 0); // Default if no consensus
        assert.strictEqual(data.peers, 2);
        assert.strictEqual(data.nodeId, 'mock-node-id');
    });

    it('should accept a valid transaction', async () => {
        const keyPair = new KeyPair();
        const tx = new Transaction({
            from: keyPair.getAddress(),
            to: '00'.repeat(32), // Random address
            value: new BN(100),
            nonce: 0,
            data: Buffer.alloc(0)
        });
        tx.sign(keyPair);

        const res = await fetch(`http://localhost:${port}/tx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: tx.from,
                to: tx.to,
                value: tx.value.toString(10),
                nonce: tx.nonce,
                signature: tx.signature.toString('hex')
            })
        });

        const data = await res.json();
        assert.ok(data.hash);
        assert.strictEqual(mempool.size(), 1);
    });
});
