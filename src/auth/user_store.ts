import fs from 'fs-extra';
import path from 'path';
import bcrypt from 'bcrypt';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

const SALT_ROUNDS = 10;

export class UserStore {
  private filePath: string;
  private users: Map<string, User> = new Map();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'users.json');
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const arr = JSON.parse(data);
      this.users.clear();
      for (const u of arr) this.users.set(u.email.toLowerCase(), u);
    } catch {
      this.users.clear();
    }
  }

  private async save(): Promise<void> {
    const arr = Array.from(this.users.values());
    await fs.writeFile(this.filePath, JSON.stringify(arr, null, 2));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.get(email.toLowerCase()) || null;
  }

  async create(email: string, password: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new Error('Email already registered');
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user: User = { id, email: email.toLowerCase(), passwordHash, createdAt: Date.now() };
    this.users.set(user.email, user);
    await this.save();
    return user;
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }
}
