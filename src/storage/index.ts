import { Level } from 'level';

export interface BatchOp {
  type: 'put' | 'del';
  key: Buffer;
  value?: Buffer;
}

export interface IDatabase {
  put(key: Buffer, value: Buffer): Promise<void>;
  get(key: Buffer): Promise<Buffer | null>;
  del(key: Buffer): Promise<void>;
  batch(ops: BatchOp[]): Promise<void>;
  close(): Promise<void>;
}

export class LevelDB implements IDatabase {
  private db: Level<string, string>;

  constructor(path: string) {
    // Level defaults to utf8 encoding. We want raw buffers usually, but modern Level uses encoding options per call or global.
    // To store Buffers, we should specify valueEncoding: 'buffer'
    // Actually modern 'level' (v8+) is a wrapper around 'level-transcoder'.
    // We can just pass valueEncoding: 'buffer' in options.
    this.db = new Level(path, { valueEncoding: 'buffer', keyEncoding: 'buffer' }) as any;
  }

  async put(key: Buffer, value: Buffer): Promise<void> {
    await this.db.put(key as any, value as any);
  }

  async get(key: Buffer): Promise<Buffer | null> {
    try {
      return await this.db.get(key as any) as unknown as Buffer;
    } catch (err: any) {
      if (err.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw err;
    }
  }

  async del(key: Buffer): Promise<void> {
    await this.db.del(key as any);
  }

  async batch(ops: BatchOp[]): Promise<void> {
    const levelOps = ops.map(op => ({
      type: op.type,
      key: op.key,
      value: op.value
    }));
    await this.db.batch(levelOps as any);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
