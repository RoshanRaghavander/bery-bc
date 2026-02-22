import { P2PNetwork } from './network/p2p.js';
import { BFTConsensus } from './consensus/bft.js';
import { Mempool } from './mempool/index.js';
import { StateManager } from './state/state_manager.js';
import { LevelDB } from './storage/index.js';
import { KeyPair } from './crypto/keypair.js';
import { Transaction } from './core/transaction.js';
import { APIServer } from './api/index.js';
import { VMExecutor } from './vm/index.js';
import fs from 'fs-extra';
import path from 'path';
import { keys } from '@libp2p/crypto';
import { multiaddr } from '@multiformats/multiaddr';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';

import { Account } from './state/account.js';
import BN from 'bn.js';
import { UserStore, IUserStore } from './auth/user_store.js';
import { PostgresUserStore } from './auth/postgres_user_store.js';

async function main() {
    const dataDir = config.storage.dataDir;
    const p2pPort = config.network.p2pPort;
    const apiPort = config.api.port;
    const privateKeyHex = config.consensus.privateKey;
    const bootstrapPeers = config.network.bootstrapPeers;
    const validatorsList = config.consensus.validators;

    await fs.ensureDir(dataDir);

    // Initialize Components
    const db = new LevelDB(path.join(dataDir, 'db'));
    const stateManager = new StateManager(db);
    const mempool = new Mempool(stateManager);
    const vmExecutor = new VMExecutor(stateManager);
    
    // Keys
    let keyPair: KeyPair;
    if (privateKeyHex) {
        keyPair = KeyPair.fromPrivateKey(privateKeyHex);
    } else {
        keyPair = new KeyPair();
        logger.info(`Generated new KeyPair. Address: ${keyPair.getAddress()}`);
    }

    // Convert to Libp2p Key
    const libp2pKey = await keys.privateKeyFromRaw(keyPair.privateKey);

    // Config P2P
    const listenAddr = config.network.listenAddress || '0.0.0.0';
    const network = new P2PNetwork({
        listenAddresses: [`/ip4/${listenAddr}/tcp/${p2pPort}`],
        bootstrapPeers: bootstrapPeers,
        privateKey: libp2pKey
    });

    // Validators
    // BFT Consensus expects validators to be identified by their Address (20 bytes hex)
    let validators;
    if (validatorsList.length > 0) {
        validators = validatorsList.map((addr: string) => ({ publicKey: addr, power: 10 }));
    } else {
        // Use Address, not Public Key
        validators = [{ publicKey: keyPair.getAddress(), power: 10 }];
    }

    // Genesis: Seed validators with funds if state is empty
    const root = await stateManager.getRoot();
    
    // Check if validator[0] has balance.
    const genesisValidatorId = validators[0].publicKey;
    
    // Determine if ID is Address or Public Key
    let genesisValidatorAddress: string;
    if (genesisValidatorId.length === 66 || genesisValidatorId.length === 130) {
         genesisValidatorAddress = KeyPair.addressFromPublicKey(Buffer.from(genesisValidatorId, 'hex'));
    } else {
         // Assume it's already an address
         genesisValidatorAddress = genesisValidatorId;
    }
    
    const genesisAcc = await stateManager.getAccount(genesisValidatorAddress);
    if (genesisAcc.balance.isZero() && genesisAcc.nonce.isZero()) {
        logger.info('Genesis: Seeding validator accounts with funds...');
        for (const v of validators) {
             let addr: string;
             if (v.publicKey.length === 66 || v.publicKey.length === 130) {
                 addr = KeyPair.addressFromPublicKey(Buffer.from(v.publicKey, 'hex'));
             } else {
                 addr = v.publicKey;
             }
             
             const acc = new Account(new BN(0), new BN('1000000000000000000000000')); // 1 Million BRY (18 decimals)
             await stateManager.putAccount(addr, acc);
             logger.info(`Funded ${addr} (Val: ${v.publicKey.slice(0,8)}...)`);
        }
        await stateManager.checkpoint(); // Should commit immediately?
        await stateManager.commit();
        logger.info('Genesis state committed.');
    }

    // Consensus
    const consensus = new BFTConsensus(keyPair, stateManager, mempool, network, vmExecutor, validators);

    // Auth - PostgreSQL if DATABASE_URL set, else JSON file
    let userStore: IUserStore;
    if (config.database?.url) {
        userStore = new PostgresUserStore(config.database.url);
        await userStore.load();
        logger.info('Auth: Using PostgreSQL');
    } else {
        userStore = new UserStore(dataDir);
        await userStore.load();
        logger.info('Auth: Using JSON file (set DATABASE_URL for PostgreSQL)');
    }

    // API
    const api = new APIServer(apiPort, mempool, stateManager, network, consensus, userStore);

    // Start Everything
    await network.start();
    api.listen();

    // Manual dial bootstrap peers
    if (bootstrapPeers.length > 0) {
        logger.info('Dialing bootstrap peers...');
        for (const peer of bootstrapPeers) {
             try {
                 const ma = multiaddr(peer);
                 logger.debug(`Dialing: ${peer}`);
                 await network['node']?.dial(ma);
                 logger.info(`Successfully dialed: ${peer}`);
             } catch (e: any) {
                 logger.warn(`Failed to dial: ${peer} - ${e.message}`);
             }
        }
    }

    // Wait for peers if we are not a solo validator
    if (validators.length > 1) {
        logger.info('Waiting for peers to form consensus mesh...');
        await new Promise<void>(resolve => {
            const checkPeers = () => {
            const peers = network.getPeers();
            const blockPeers = network.getTopicPeers('block');
            const txPeers = network.getTopicPeers('tx');
            logger.debug(`checkPeers. Connected: ${peers.length}, Block Sub: ${blockPeers}, Tx Sub: ${txPeers}`);
            
            // Wait for at least 1 peer that is subscribed to block topic
            if (peers.length > 0 && blockPeers > 0) {
                logger.info('Found subscribed peers, resolving');
                resolve();
                return true;
            }
            return false;
        };

            if (checkPeers()) return;

            network.on('peer:connect', () => {
                logger.debug('Peer connected event fired');
                // Give some time for pubsub handshake
                setTimeout(checkPeers, 2000); 
            });

            // Also listen for subscription changes if we could (not exposed directly easily, but we can poll)
            const interval = setInterval(() => {
                if (checkPeers()) {
                    clearInterval(interval);
                }
            }, 1000);
            
            // Fallback timeout
            setTimeout(() => {
                logger.warn('Peer wait timeout fired');
                clearInterval(interval);
                if (checkPeers()) return;
                logger.warn('Proceeding without full mesh (risk of fork)...');
                resolve();
            }, 60000); // Increased timeout to 60s
        });
        logger.info('Peer connected and mesh formed! Starting consensus...');
    }

    await consensus.start();

    // Wire up mempool and network events
    mempool.on('tx', (tx) => {
        network.broadcastTx(tx);
    });

    network.on('tx', async (txData) => {
        try {
            const tx = Transaction.fromJSON(txData);
            await mempool.add(tx);
        } catch (e) {
            logger.error('Failed to add network tx to mempool', e);
        }
    });

    logger.info('Blockchain Node Started!');
    
    // Handle cleanup
    process.on('SIGINT', async () => {
        logger.info('Stopping node...');
        await network.stop();
        await db.close();
        process.exit(0);
    });
}

main().catch(err => {
    logger.error('Fatal error in main loop', err);
});
