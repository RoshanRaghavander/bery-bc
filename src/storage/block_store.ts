import { LevelDB } from './index.js';
import { Block } from '../core/block.js';
import { logger } from '../utils/logger.js';

export class BlockStore {
    private db: LevelDB;

    constructor(dbPath: string) {
        this.db = new LevelDB(dbPath);
    }

    async saveBlock(block: Block): Promise<void> {
        const height = block.header.height;
        const blockHash = block.hash.toString('hex');
        
        const key = Buffer.from(`block:${height}`);
        const value = Buffer.from(JSON.stringify(block.toJSON()));
        
        await this.db.put(key, value);

        // Index Block Hash -> Height
        await this.db.put(Buffer.from(`index:blockHash:${blockHash}`), Buffer.from(height.toString()));

        // Index Transactions -> Height
        for (const tx of block.transactions) {
            const txHash = tx.hash.toString('hex');
            await this.db.put(Buffer.from(`index:tx:${txHash}`), Buffer.from(height.toString()));
        }
        
        // Update Head
        await this.saveHead(height, blockHash);
    }

    async getBlock(height: number): Promise<Block | null> {
        const key = Buffer.from(`block:${height}`);
        const data = await this.db.get(key);
        if (!data) return null;
        
        try {
            const json = JSON.parse(data.toString());
            return Block.fromJSON(json);
        } catch (e) {
            logger.error(`Failed to load block ${height}`, e);
            return null;
        }
    }

    async getBlockByHash(hash: string): Promise<Block | null> {
        const heightData = await this.db.get(Buffer.from(`index:blockHash:${hash}`));
        if (!heightData) return null;
        const height = parseInt(heightData.toString());
        return this.getBlock(height);
    }

    async getTransactionLocation(txHash: string): Promise<number | null> {
        const data = await this.db.get(Buffer.from(`index:tx:${txHash}`));
        if (!data) return null;
        return parseInt(data.toString());
    }

    async getTransaction(txHash: string): Promise<{ tx: any, blockHeight: number, blockHash: string } | null> {
        const height = await this.getTransactionLocation(txHash);
        if (height === null) return null;

        const block = await this.getBlock(height);
        if (!block) return null;

        const tx = block.transactions.find(t => t.hash.toString('hex') === txHash);
        if (!tx) return null;

        return {
            tx,
            blockHeight: height,
            blockHash: block.hash.toString('hex')
        };
    }
    
    async saveHead(height: number, hash: string): Promise<void> {
        await this.db.put(Buffer.from('meta:head'), Buffer.from(JSON.stringify({ height, hash })));
    }

    async getHead(): Promise<{ height: number, hash: string } | null> {
        const data = await this.db.get(Buffer.from('meta:head'));
        if (!data) return null;
        return JSON.parse(data.toString());
    }

    async saveSlashedValidators(validators: string[]): Promise<void> {
        await this.db.put(Buffer.from('meta:slashed'), Buffer.from(JSON.stringify(validators)));
    }

    async getSlashedValidators(): Promise<string[]> {
        const data = await this.db.get(Buffer.from('meta:slashed'));
        if (!data) return [];
        try {
            return JSON.parse(data.toString());
        } catch (e) {
            return [];
        }
    }

    async close() {
        await this.db.close();
    }
}
