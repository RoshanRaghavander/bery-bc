import { LevelDB } from './index.js';
import { Block } from '../core/block.js';
import { logger } from '../utils/logger.js';
import { Hash } from '../crypto/hash.js';

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

    async saveReceipts(height: number, blockHash: string, receipts: any[]): Promise<void> {
        let blockGasUsed = 0;
        const allLogs: any[] = [];
        for (const r of receipts) {
            blockGasUsed += r.gasUsed || 0;
            const key = Buffer.from(`receipt:${r.transactionHash}`);
            const val = Buffer.from(JSON.stringify({
                ...r,
                blockNumber: height,
                blockHash
            }));
            await this.db.put(key, val);
            if (Array.isArray(r.logs)) {
                for (let i = 0; i < r.logs.length; i++) {
                    const log = r.logs[i];
                    allLogs.push({
                        ...log,
                        logIndex: i,
                        transactionHash: r.transactionHash,
                        blockNumber: height,
                        blockHash
                    });
                }
            }
        }
        const logsKey = Buffer.from(`logs:${height}`);
        await this.db.put(logsKey, Buffer.from(JSON.stringify(allLogs)));

        const bloom = this.computeLogsBloom(allLogs);
        await this.db.put(Buffer.from(`meta:blockGasUsed:${height}`), Buffer.from(blockGasUsed.toString()));
        await this.db.put(Buffer.from(`meta:logsBloom:${height}`), Buffer.from(bloom));
    }

    async getReceipt(txHash: string): Promise<any | null> {
        const data = await this.db.get(Buffer.from(`receipt:${txHash}`));
        if (!data) return null;
        try {
            const json = JSON.parse(data.toString());
            return {
                transactionHash: '0x' + json.transactionHash,
                transactionIndex: '0x' + Number(json.transactionIndex || 0).toString(16),
                blockHash: '0x' + json.blockHash,
                blockNumber: '0x' + Number(json.blockNumber).toString(16),
                from: '0x' + json.from,
                to: json.to ? '0x' + json.to : null,
                cumulativeGasUsed: '0x' + Number(json.cumulativeGasUsed || 0).toString(16),
                gasUsed: '0x' + Number(json.gasUsed || 0).toString(16),
                contractAddress: json.contractAddress ? '0x' + json.contractAddress : null,
                logs: (json.logs || []).map((l: any) => ({
                    address: l.address,
                    topics: l.topics,
                    data: l.data,
                    blockHash: '0x' + json.blockHash,
                    blockNumber: '0x' + Number(json.blockNumber).toString(16),
                    transactionHash: '0x' + json.transactionHash,
                    logIndex: '0x' + Number(l.logIndex || 0).toString(16),
                    transactionIndex: '0x' + Number(json.transactionIndex || 0).toString(16)
                })),
                status: json.status,
                effectiveGasPrice: '0x' + Number(json.effectiveGasPrice || 0).toString(16)
            };
        } catch (e) {
            return null;
        }
    }

    async getLogs(filter: { fromBlock?: number; toBlock?: number; address?: string; topics?: string[] }): Promise<any[]> {
        const head = await this.getHead();
        const start = filter.fromBlock ?? 0;
        const end = filter.toBlock ?? (head ? head.height : start);
        const out: any[] = [];
        for (let h = start; h <= end; h++) {
            const data = await this.db.get(Buffer.from(`logs:${h}`));
            if (!data) continue;
            try {
                const arr = JSON.parse(data.toString());
                for (const log of arr) {
                    if (filter.address && log.address.toLowerCase() !== filter.address.toLowerCase()) continue;
                    if (filter.topics && filter.topics.length > 0) {
                        let ok = true;
                        for (let i = 0; i < filter.topics.length; i++) {
                            const t = filter.topics[i];
                            if (t && (!log.topics[i] || log.topics[i].toLowerCase() !== t.toLowerCase())) {
                                ok = false;
                                break;
                            }
                        }
                        if (!ok) continue;
                    }
                    out.push({
                        address: log.address,
                        topics: log.topics,
                        data: log.data,
                        blockHash: '0x' + log.blockHash,
                        blockNumber: '0x' + Number(log.blockNumber).toString(16),
                        transactionHash: '0x' + log.transactionHash,
                        logIndex: '0x' + Number(log.logIndex || 0).toString(16),
                        transactionIndex: '0x' + Number(log.transactionIndex || 0).toString(16)
                    });
                }
            } catch {}
        }
        return out;
    }

    async getBlockMeta(height: number): Promise<{ gasUsed: number; logsBloom: string } | null> {
        const gasData = await this.db.get(Buffer.from(`meta:blockGasUsed:${height}`));
        const bloomData = await this.db.get(Buffer.from(`meta:logsBloom:${height}`));
        if (!gasData || !bloomData) return null;
        return { gasUsed: parseInt(gasData.toString()), logsBloom: bloomData.toString() };
    }

    private computeLogsBloom(logs: any[]): string {
        const size = 256;
        const bloom = Buffer.alloc(size);
        for (const log of logs) {
            const items = [log.address.replace('0x',''), ...(log.topics || []).map((t: string) => t.replace('0x',''))];
            for (const it of items) {
                const h = Hash.keccak256(Buffer.from(it, 'hex'));
                const i1 = h[0] % size;
                const i2 = h[1] % size;
                const i3 = h[2] % size;
                bloom[i1] = 0xff;
                bloom[i2] = 0xff;
                bloom[i3] = 0xff;
            }
        }
        return bloom.toString('hex');
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
