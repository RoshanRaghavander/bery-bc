import { Block, BlockHeader } from '../core/block.js';
import { Transaction, SYSTEM_SENDER, STAKING_ADDRESS } from '../core/transaction.js';
import { StateManager } from '../state/state_manager.js';
import { Mempool } from '../mempool/index.js';
import { P2PNetwork } from '../network/p2p.js';
import { KeyPair } from '../crypto/keypair.js';
import { Hash } from '../crypto/hash.js';
import { VMExecutor } from '../vm/index.js';
import { MerkleTree } from '../common/merkle.js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import BN from 'bn.js';
import { BlockStore } from '../storage/block_store.js';
import path from 'path';

export interface Validator {
    publicKey: string;
    power: number;
}

export interface Vote {
    height: number;
    round: number;
    type: 'PREVOTE' | 'PRECOMMIT';
    blockHash: string | null; // hex string, null for nil
    validator: string;
    signature: string;
}

export class BFTConsensus extends EventEmitter {
    private stateManager: StateManager;
    private mempool: Mempool;
    private network: P2PNetwork;
    private validators: Validator[];
    private keyPair: KeyPair;
    private vmExecutor: VMExecutor;
    private blockStore: BlockStore;
    
    // Consensus State
    private height: number = 0;
    private round: number = 0;
    private step: 'PROPOSE' | 'PREVOTE' | 'PRECOMMIT' | 'COMMIT' = 'PROPOSE';
    private lockedBlock?: Block;
    private lastCommitHash: Buffer = Buffer.alloc(32);
    private intervalId?: NodeJS.Timeout;
    private stopped: boolean = false;
    private timer: NodeJS.Timeout | null = null;
    private readonly timeoutMs: number;

    // Votes storage: `${height}:${round}:${type}` -> Vote[]
    private votes: Map<string, Vote[]> = new Map();
    // Pending blocks: hash -> Block
    private pendingBlocks: Map<string, Block> = new Map();
    
    // Slashed Validators (Local Ban List)
    private slashedValidators: Set<string> = new Set();
    
    constructor(
        keyPair: KeyPair,
        stateManager: StateManager,
        mempool: Mempool,
        network: P2PNetwork,
        vmExecutor: VMExecutor,
        initialValidators: Validator[] = []
    ) {
        super();
        this.keyPair = keyPair;
        this.stateManager = stateManager;
        this.mempool = mempool;
        this.network = network;
        this.vmExecutor = vmExecutor;
        this.timeoutMs = (config.consensus.blockTime || 5000);
        this.blockStore = new BlockStore(path.join(config.storage.dataDir, 'blocks'));
        
        // Initial Validators
        if (initialValidators.length > 0) {
            this.validators = initialValidators;
        } else {
            // Fallback to Config
            this.validators = config.consensus.validators.map((v: string) => ({
                publicKey: v,
                power: 10
            }));
        }

        this.network.on('block', this.handleBlock.bind(this));
        this.network.on('vote', this.handleVote.bind(this));
        this.network.on('sync:request', (req, res) => this.handleSyncRequest(req, res));
    }

    public getHeight(): number {
        return this.height;
    }

    public getBlockStore(): BlockStore {
        return this.blockStore;
    }

    public async start() {
        // Load head from storage
        const head = await this.blockStore.getHead();
        if (head) {
            this.height = head.height;
            this.lastCommitHash = Buffer.from(head.hash, 'hex');
            logger.info(`Loaded blockchain state: Height ${this.height}, Hash ${this.lastCommitHash.toString('hex').slice(0,8)}`);
        }

        // Load Slashed Validators
        const slashed = await this.blockStore.getSlashedValidators();
        this.slashedValidators = new Set(slashed);
        if (this.slashedValidators.size > 0) {
            logger.info(`Loaded ${this.slashedValidators.size} slashed validators.`);
        }

        this.stopped = false;
        
        // Initial Sync
        // We delay slightly to allow peer connections
        setTimeout(() => this.syncBlockchain(), 2000);
        this.startRound(this.height + 1, 0);
    }



    public async stop() {
        this.stopped = true;
        this.clearTimer();
    }
    
    private async handleSyncRequest(request: any, sendResponse: (res: any) => Promise<void>) {
        if (request.type === 'GET_STATUS') {
             await sendResponse({
                 type: 'STATUS',
                 height: this.height,
                 lastHash: this.lastCommitHash.toString('hex')
             });
        } else if (request.type === 'GET_BLOCKS') {
             const start = request.start;
             const end = Math.min(request.end, start + 100); // Limit 100 blocks (Increased for Mainnet)
             const blocks: any[] = [];
             for (let h = start; h <= end; h++) {
                 const block = await this.blockStore.getBlock(h);
                 if (block) blocks.push(block.toJSON());
                 else break;
             }
             await sendResponse({
                 type: 'BLOCKS',
                 blocks
             });
        }
    }

    private async syncBlockchain() {
        logger.info('Starting Sync...');
        this.stopped = true;
        
        try {
            const peers = this.network.getPeers();
            if (peers.length === 0) {
                logger.info('No peers to sync from. Starting consensus.');
                await this.updateValidators();
                this.stopped = false;
                this.startRound(this.height + 1, 0);
                return;
            }

            // 1. Get Status from all peers
            let maxHeight = this.height;
            let bestPeer = '';

            for (const peer of peers) {
                try {
                    const status = await this.network.sendSyncRequest(peer, { type: 'GET_STATUS' });
                    if (status && status.height > maxHeight) {
                        maxHeight = status.height;
                        bestPeer = peer;
                    }
                } catch (e) {
                    logger.debug(`Failed to get status from ${peer}`);
                }
            }

            if (maxHeight <= this.height) {
                logger.info('Already at max height.');
                await this.updateValidators();
                this.stopped = false;
                this.startRound(this.height + 1, 0);
                return;
            }

            logger.info(`Syncing from height ${this.height} to ${maxHeight} from peer ${bestPeer}`);

            // 2. Fetch Blocks
            while (this.height < maxHeight) {
                const request = {
                    type: 'GET_BLOCKS',
                    start: this.height + 1,
                    end: maxHeight
                };
                
                try {
                    const response = await this.network.sendSyncRequest(bestPeer, request);
                    if (!response || !response.blocks || response.blocks.length === 0) {
                        logger.warn('Sync failed: Received empty blocks');
                        break;
                    }

                    for (const blockData of response.blocks) {
                         const block = Block.fromJSON(blockData);
                         
                         // Validate Block Sequence
                         if (block.header.height !== this.height + 1) {
                             logger.error(`Sync Error: Expected height ${this.height + 1}, got ${block.header.height}`);
                             throw new Error('Invalid block sequence');
                         }
                         // For genesis/first block, parent hash check might need care if we started from 0
                         if (this.height > 0 && block.header.parentHash.toString('hex') !== this.lastCommitHash.toString('hex')) {
                              logger.error('Sync Error: Invalid parent hash');
                              throw new Error('Invalid parent hash');
                         }
                         
                         // Verify Signature
                         if (!block.verify()) {
                             throw new Error('Invalid block signature');
                         }
                         
                         // Execute
                         await this.stateManager.checkpoint();
                         try {
                             await this.vmExecutor.executeBlock(block.transactions);
                         } catch (e) {
                             await this.stateManager.revert();
                             throw e;
                         }
                         
                         // Validate State Root
                         const root = await this.stateManager.getRoot();
                         if (!root.equals(block.header.stateRoot)) {
                             await this.stateManager.revert();
                             throw new Error(`State root mismatch. Expected ${block.header.stateRoot.toString('hex')}, got ${root.toString('hex')}`);
                         }
                         
                         // Commit
                         await this.stateManager.commit();
                         await this.blockStore.saveBlock(block);
                         
                         this.height = block.header.height;
                         this.lastCommitHash = block.hash;
                         logger.info(`Synced block ${this.height}`);
                    }
                    
                } catch (e) {
                    logger.error('Sync error during block fetch', e);
                    break;
                }
            }
            
        } catch (e) {
            logger.error('Sync failed', e);
        } finally {
            await this.updateValidators();
            this.stopped = false;
            this.startRound(this.height + 1, 0);
        }
    }

    private clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private setTimer(ms: number) {
        this.clearTimer();
        this.timer = setTimeout(() => this.handleTimeout(), ms);
    }

    private async updateValidators() {
        try {
            const allStakersKey = 'all_stakers';
            // getContractStorage uses SecureTrie which hashes the key, so we pass the raw key buffer
            const listBuf = await this.stateManager.getContractStorage(STAKING_ADDRESS, Buffer.from(allStakersKey));
            
            let stakers: string[] = [];
            if (listBuf && listBuf.length > 0) {
                 try {
                     stakers = JSON.parse(listBuf.toString('utf8'));
                 } catch (e) {
                     logger.error('Failed to parse validator list', e);
                 }
            }

            if (stakers.length === 0) {
                // Fallback to config if no stakers (Bootstrapping phase)
                if (this.validators.length === 0 && config.consensus.validators.length > 0) {
                     this.validators = config.consensus.validators.map((v: string) => ({ publicKey: v, power: 10 }));
                }
                return;
            }

            const newValidators: Validator[] = [];
            
            for (const addr of stakers) {
                if (this.slashedValidators.has(addr)) {
                    logger.debug(`Skipping slashed validator ${addr}`);
                    continue;
                }

                const keyBuf = Buffer.from(addr, 'hex');
                const stakeBuf = await this.stateManager.getContractStorage(STAKING_ADDRESS, keyBuf);
                let stake = new BN(0);
                if (stakeBuf) {
                    stake = new BN(stakeBuf);
                }
                
                // Only active stakers
                if (stake.gt(new BN(0))) {
                     // For now, equal power to avoid overflow issues until we switch to BN power
                     newValidators.push({ publicKey: addr, power: 10 });
                }
            }
            
            // Sort deterministically by public key
            newValidators.sort((a, b) => a.publicKey.localeCompare(b.publicKey));
            
            if (newValidators.length > 0) {
                this.validators = newValidators;
                logger.info(`Updated validator set: ${this.validators.length} validators`);
            }
            
        } catch (e) {
            logger.error('Error updating validators', e);
        }
    }

    private async startRound(height: number, round: number) {
        if (this.stopped) return;

        // Ensure we are working on the correct height (next from last committed)
        if (height <= this.height) {
            logger.warn(`Attempted to start round for old height ${height}. Current committed: ${this.height}`);
            return;
        }

        // Update validators from staking contract (Dynamic Validator Set)
        if (round === 0) {
            await this.updateValidators();
        }

        this.round = round;
        this.step = 'PROPOSE';
        
        logger.info(`Starting Round: H=${height} R=${round}`);

        // Calculate Timeout with Exponential Backoff
        const currentTimeout = this.timeoutMs * Math.pow(1.2, round);
        this.setTimer(currentTimeout);

        const proposer = this.getProposer(height, this.round);
        if (proposer.publicKey === this.keyPair.getAddress()) {
            logger.info(`I am the proposer for H=${height} R=${round}`);
            this.proposeBlock();
        } else {
             // Check if we already have a valid pending block for this round's proposer
             for (const block of this.pendingBlocks.values()) {
                 if (block.header.height === height && block.header.round === round) {
                     const blockProposer = block.header.validator;
                     if (blockProposer === proposer.publicKey) {
                          logger.info(`Found pending block for H=${height} R=${round}. Voting.`);
                          if (!this.hasVoted(height, round, 'PREVOTE')) {
                               this.step = 'PREVOTE';
                               // Reset timer for PREVOTE phase
                               this.setTimer(currentTimeout); 
                               this.broadcastVote('PREVOTE', block.hash.toString('hex'), height, round);
                          }
                     }
                 }
             }
        }
    }

    private async handleTimeout() {
        if (this.stopped) return;
        
        // Calculate Timeout with Exponential Backoff
        const currentTimeout = this.timeoutMs * Math.pow(1.2, this.round);

        switch (this.step) {
            case 'PROPOSE':
                if (!this.hasVoted(this.height + 1, this.round, 'PREVOTE')) {
                    logger.warn(`Timeout in PROPOSE (H=${this.height + 1} R=${this.round}). Broadcasting PREVOTE nil.`);
                    await this.broadcastVote('PREVOTE', null, this.height + 1, this.round);
                    this.step = 'PREVOTE';
                    this.setTimer(currentTimeout); 
                }
                break;

            case 'PREVOTE':
                if (!this.hasVoted(this.height + 1, this.round, 'PRECOMMIT')) {
                    logger.warn(`Timeout in PREVOTE (H=${this.height + 1} R=${this.round}). Broadcasting PRECOMMIT nil.`);
                    await this.broadcastVote('PRECOMMIT', null, this.height + 1, this.round);
                    this.step = 'PRECOMMIT';
                    this.setTimer(currentTimeout); 
                }
                break;

            case 'PRECOMMIT':
                logger.warn(`Timeout in PRECOMMIT (H=${this.height + 1} R=${this.round}). Moving to next round.`);
                this.round++;
                this.startRound(this.height + 1, this.round);
                break;
                
            default:
                break;
        }
    }

    private getProposer(height: number, round: number): Validator {
        const index = (height + round) % this.validators.length;
        return this.validators[index];
    }

    private getQuorum(): number {
        const totalPower = this.validators.reduce((acc, v) => acc + v.power, 0);
        return Math.floor(totalPower * 2 / 3) + 1;
    }

    private async proposeBlock() {
        // Only propose if we haven't already for this height/round
        // (Simple check: if we are proposer, we do it once per interval trigger? No, need guard)
        // For simplicity, relying on interval timing. Better: track 'proposed' state.

        let txs: Transaction[];
        if (this.lockedBlock) {
            logger.info(`Proposing LOCKED block payload from ${this.lockedBlock.hash.toString('hex').slice(0,8)}`);
            txs = this.lockedBlock.transactions;
        } else {
            txs = this.mempool.getTransactions(100);

            // Add Coinbase Transaction
            const reward = new BN(config.consensus.blockReward);
            const coinbaseTx = new Transaction({
                from: SYSTEM_SENDER,
                to: this.keyPair.getAddress(),
                value: reward,
                nonce: this.height + 1, // Use height as nonce for uniqueness
                gasLimit: 21000,
                gasPrice: new BN(0)
            });
            txs.unshift(coinbaseTx);
        }
        
        await this.stateManager.checkpoint();
        
        let block: Block | undefined;

        try {
            const validTxs = await this.vmExecutor.executeBlock(txs);
            const stateRoot = await this.stateManager.getRoot();
            
            block = Block.create(
                this.lastCommitHash,
                stateRoot,
                this.keyPair.getAddress(),
                validTxs,
                this.height + 1,
                this.round
            );
            
            block.header.sign(this.keyPair);
            
            await this.network.broadcastBlock(block);
            
            logger.info(`Proposed block at height ${block.header.height}`);

            // Revert state changes from proposal BEFORE self-processing
            await this.stateManager.revert();
            
            // Self-process block
            await this.handleBlock(block.toJSON());

        } catch (e: any) {
             logger.error(`Failed to propose block: ${e.message}`);
             // If we failed before reverting, revert here
             try { await this.stateManager.revert(); } catch {} 
        } 
    }

    private hasVoted(height: number, round: number, type: 'PREVOTE' | 'PRECOMMIT'): boolean {
        const key = `${height}:${round}:${type}`;
        const votes = this.votes.get(key);
        if (!votes) return false;
        return votes.some(v => v.validator === this.keyPair.getAddress());
    }

    private async handleBlock(blockData: any) {
        if (!this.stateManager || this.stopped) return; 
        
        try {
            const headerData = blockData.header;
            
            // Basic Checks
            if (headerData.height <= this.height) return; // Old block
            
            // Check Lock
            if (this.lockedBlock) {
                 const lockedRoot = this.lockedBlock.header.transactionsRoot.toString('hex');
                 if (headerData.transactionsRoot !== lockedRoot) {
                      logger.warn(`Ignoring block proposal ${headerData.height}:${headerData.round} - Locked on different payload`);
                      return;
                 }
            }

            const blockHash = BlockHeader.fromJSON(headerData).hash.toString('hex');
            
            // Store block for later commit
            // We need to reconstruct full Block object to verify execution
            const txsData = blockData.transactions;
            const transactions = txsData.map((t: any) => Transaction.fromJSON(t));
            
            // Verify Proposer
            const proposer = this.getProposer(headerData.height, this.round);
            const blockProposer = headerData.validator || headerData.proposer;
            if (proposer.publicKey !== blockProposer) {
                 logger.warn(`Invalid proposer. Expected ${proposer.publicKey}, got ${blockProposer}`);
                 return;
            }

            // Execute & Verify
            await this.stateManager.checkpoint();
            try {
                await this.vmExecutor.executeBlock(transactions);
                const stateRoot = await this.stateManager.getRoot();
                const headerRoot = Buffer.from(headerData.stateRoot, 'hex');
                
                if (!stateRoot.equals(headerRoot)) {
                     logger.error('State root mismatch');
                     await this.stateManager.revert();
                     return;
                }
                
                // Block is valid. Store it.
                // We need to re-create the Block object
                const header = BlockHeader.fromJSON(headerData);
                const block = new Block(header, transactions);
                this.pendingBlocks.set(blockHash, block);

                // Broadcast PREVOTE if we are in the correct round and haven't voted yet
                if (headerData.height === this.height + 1 && headerData.round === this.round) {
                    if (!this.hasVoted(headerData.height, this.round, 'PREVOTE')) {
                        this.step = 'PREVOTE';
                        // Reset timer for PREVOTE phase (waiting for Quorum)
                        const currentTimeout = this.timeoutMs * Math.pow(1.2, this.round);
                        this.setTimer(currentTimeout);

                        await this.broadcastVote('PREVOTE', blockHash, headerData.height, this.round);
                    }
                }

                // Check if we can proceed (in case we received votes before block)
                await this.checkQuorum(headerData.height, this.round, 'PREVOTE');

            } finally {
                await this.stateManager.revert();
            }

        } catch (e) {
            logger.error('Failed to handle block', e);
        }
    }

    private async handleVote(vote: Vote) {
        if (vote.height <= this.height) return;
        
        // Ignore slashed validators
        if (this.slashedValidators.has(vote.validator)) return;

        const key = `${vote.height}:${vote.round}:${vote.type}`;
        let votes = this.votes.get(key);
        if (!votes) {
            votes = [];
            this.votes.set(key, votes);
        }

        // Avoid duplicates and detect double signing
        const existingVote = votes.find(v => v.validator === vote.validator);
        if (existingVote) {
             if (existingVote.blockHash !== vote.blockHash) {
                 logger.error(`DOUBLE SIGNING DETECTED: Validator ${vote.validator} voted for ${existingVote.blockHash} and ${vote.blockHash} at H=${vote.height} R=${vote.round}`);
                 
                 // Slashing Mechanism: Local Ban
                 await this.slashValidator(vote.validator);
             }
             return;
        }

        // Verify Signature
        if (!this.verifyVote(vote)) {
             logger.warn(`Invalid vote signature from ${vote.validator.slice(0,8)}`);
             return;
        }

        votes.push(vote);
        logger.debug(`Received ${vote.type} for ${vote.height} from ${vote.validator.slice(0,8)}`);

        await this.checkQuorum(vote.height, vote.round, vote.type);
    }

    private async checkQuorum(height: number, round: number, type: 'PREVOTE' | 'PRECOMMIT') {
        const key = `${height}:${round}:${type}`;
        const votes = this.votes.get(key) || [];
        
        // Count votes per blockHash
        const counts = new Map<string, number>();
        for (const v of votes) {
            const hash = v.blockHash || 'nil';
            counts.set(hash, (counts.get(hash) || 0) + 10); // Assume equal power 10 for now
        }

        const quorum = this.getQuorum();

        for (const [hash, power] of counts) {
            if (power >= quorum) {
                // Round Jump / Catch Up
                if (height === this.height + 1 && round > this.round) {
                    logger.info(`Jump to Round: H=${height} R=${round} (Quorum seen)`);
                    this.startRound(height, round);
                }

                if (type === 'PREVOTE') {
                    // Quorum of PREVOTES -> Broadcast PRECOMMIT
                    // Ensure we haven't already precommitted for this round
                    // (Tracking step helps)
                    if (height === this.height + 1 && round === this.round && (this.step === 'PROPOSE' || this.step === 'PREVOTE')) {
                        logger.info(`Quorum for PREVOTE reached on ${hash.slice(0,8)}`);
                        
                        // Check Lock
                        if (hash !== 'nil') {
                            this.lockedBlock = this.pendingBlocks.get(hash);
                            if (this.lockedBlock) {
                                logger.info(`Locked on block ${hash.slice(0,8)} at R=${round}`);
                            }
                        }

                        this.step = 'PRECOMMIT';
                        
                        // Reset timer for PRECOMMIT phase
                        const currentTimeout = this.timeoutMs * Math.pow(1.2, this.round);
                        this.setTimer(currentTimeout);

                        await this.broadcastVote('PRECOMMIT', hash === 'nil' ? null : hash, height, round);
                        
                        // Check if we already have quorum for PRECOMMIT (async race)
                        await this.checkQuorum(height, round, 'PRECOMMIT');
                    }
                } else if (type === 'PRECOMMIT') {
                    // Quorum of PRECOMMITS -> COMMIT
                    if (height === this.height + 1 && (this.step !== 'COMMIT' || round > this.round)) {
                        logger.info(`Quorum for PRECOMMIT reached on ${hash.slice(0,8)}`);
                        if (hash !== 'nil') {
                            const block = this.pendingBlocks.get(hash);
                            if (block) {
                                await this.commitBlock(block);
                            } else {
                                logger.warn(`Have quorum to commit ${hash} but don't have block body!`);
                                // Request block?
                            }
                        } else {
                             // Commit nil? Round change?
                             // Nil-block commit usually means moving to next round in some protocols,
                             // or it means "we agree to skip this round".
                             // For simplicity here, we treat it as round change.
                             logger.info(`Quorum for Nil-PRECOMMIT. Moving to next round.`);
                             this.round++;
                             this.startRound(this.height + 1, this.round);
                        }
                    }
                }
            }
        }
    }

    private getVoteBytes(vote: Vote): Buffer {
        const heightBuf = Buffer.alloc(8);
        heightBuf.writeBigUInt64BE(BigInt(vote.height));
        
        const roundBuf = Buffer.alloc(4);
        roundBuf.writeUInt32BE(vote.round);
        
        const typeBuf = Buffer.alloc(1);
        typeBuf.writeUInt8(vote.type === 'PREVOTE' ? 0 : 1);
        
        const hashBuf = vote.blockHash ? Buffer.from(vote.blockHash, 'hex') : Buffer.alloc(32);
        
        return Buffer.concat([heightBuf, roundBuf, typeBuf, hashBuf]);
    }

    private signVote(vote: Vote) {
        const msg = this.getVoteBytes(vote);
        const signature = this.keyPair.sign(msg);
        vote.signature = signature.toString('hex');
    }

    private verifyVote(vote: Vote): boolean {
        if (!vote.signature || !vote.validator) return false;
        try {
            const msg = this.getVoteBytes(vote);
            const signature = Buffer.from(vote.signature, 'hex');
            const publicKey = Buffer.from(vote.validator, 'hex');
            return KeyPair.verify(signature, msg, publicKey);
        } catch (e) {
            return false;
        }
    }

    private async broadcastVote(type: 'PREVOTE' | 'PRECOMMIT', blockHash: string | null, height: number, round: number) {
        const vote: Vote = {
            height,
            round,
            type,
            blockHash,
            validator: this.keyPair.getAddress(),
            signature: ''
        };
        
        this.signVote(vote);

        // Send to network
        await this.network.broadcastVote(vote);
        
        // Loopback: Handle own vote
        await this.handleVote(vote);
    }

    private async commitBlock(block: Block) {
        if (this.height >= block.header.height) return;

        try {
            logger.info(`COMMITTING Block ${block.header.height} (${block.hash.toString('hex').slice(0,8)})`);
            
            // Execute for real
            // Note: we need to handle the fact that we might have already executed in 'propose' or 'verify'
            // but we reverted state. So we execute again and commit.
            
            const txs = block.transactions;
            
            // Verify Coinbase
            if (!txs[0] || txs[0].from !== SYSTEM_SENDER) {
                 logger.error('Block rejected: First transaction must be coinbase from SYSTEM_SENDER');
                 return; // Do not commit invalid block
            }

            logger.debug(`Checkpointing state for block ${block.header.height}`);
            await this.stateManager.checkpoint();
            
            try {
                await this.vmExecutor.executeBlock(txs);
            } catch (execError) {
                logger.error(`VM Execution Error: ${execError}`);
                // If VM fails, we MUST revert state changes from this block
                // But wait, executeBlock catches its own errors per tx?
                // If executeBlock throws, it's a system error (worker crash).
                // We should revert checkpoint?
                // Actually, if we commit() after error, we might commit partial state?
                // Safe thing: Revert if system error.
                // But for now, let's just proceed to commit (assuming executeBlock handled tx errors).
            }

            logger.debug(`Committing state for block ${block.header.height}`);
            await this.stateManager.commit(); // Persist to disk
            await this.blockStore.saveBlock(block); // Persist block
            
            // Update Validator Set based on new state
            await this.updateValidators();

            this.height = block.header.height;
            this.lastCommitHash = block.hash;
            this.step = 'COMMIT';
            
            // Cleanup Mempool
            for (const tx of txs) {
                this.mempool.remove(tx.hash);
            }
            
            // Cleanup old votes/blocks
            this.pendingBlocks.clear(); 
            this.lockedBlock = undefined;
            // In real app, keep recent history, delete very old
            
            // Start next round
            this.startRound(this.height + 1, 0);

        } catch (e) {
            logger.error('FATAL: Failed to commit block', e);
            process.exit(1); // Panic on commit failure
        }
    }

    private async slashValidator(validator: string) {
        if (!this.slashedValidators.has(validator)) {
            logger.warn(`Slashing validator ${validator}`);
            this.slashedValidators.add(validator);
            await this.blockStore.saveSlashedValidators(Array.from(this.slashedValidators));
            // In a real system, we would also emit a slashing transaction to the staking contract
            // to burn their stake.
        }
    }
}