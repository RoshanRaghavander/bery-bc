import pg from 'pg';
import bcrypt from 'bcrypt';
import { User, IUserStore } from './user_store.js';

const SALT_ROUNDS = 10;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
`;

export class PostgresUserStore implements IUserStore {
  private pool: pg.Pool;

  constructor(connectionUrl: string) {
    this.pool = new pg.Pool({
      connectionString: connectionUrl,
      ssl: connectionUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
  }

  async load(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(INIT_SQL);
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const res = await this.pool.query(
      'SELECT id, email, password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return { id: r.id, email: r.email, passwordHash: r.passwordHash, createdAt: Number(r.createdAt) };
  }

  async create(email: string, password: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new Error('Email already registered');
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const createdAt = Date.now();
    await this.pool.query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
      [id, email.toLowerCase(), passwordHash, createdAt]
    );
    return { id, email: email.toLowerCase(), passwordHash, createdAt };
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
