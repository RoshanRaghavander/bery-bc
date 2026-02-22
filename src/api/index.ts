import express from 'express';
import cors = require('cors');
import bodyParser from 'body-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Mempool } from '../mempool/index.js';
import { StateManager } from '../state/state_manager.js';
import { Transaction } from '../core/transaction.js';
import { P2PNetwork } from '../network/p2p.js';
import { BFTConsensus } from '../consensus/bft.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { KeyPair } from '../crypto/keypair.js';
import BN from 'bn.js';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { Hash } from '../crypto/hash.js';
import { IUserStore } from '../auth/user_store.js';
import { signToken, verifyToken } from '../auth/jwt.js';

const __filename = fileURLToPath(import.meta.url);

const ADDRESS_REGEX = /^[a-fA-F0-9]{40}$/;
const HEX_REGEX = /^[a-fA-F0-9]+$/;

function isValidAddress(addr: string): boolean {
  const clean = String(addr || '').replace(/^0x/, '');
  return ADDRESS_REGEX.test(clean);
}

function validateFaucetBody(body: any): { address: string; amount?: string } | { error: string } {
  const address = body?.address;
  if (!address || typeof address !== 'string') return { error: 'Address required' };
  const addrClean = address.replace(/^0x/, '');
  if (!ADDRESS_REGEX.test(addrClean)) return { error: 'Invalid address format (expected 40 hex chars)' };
  const amount = body?.amount;
  if (amount != null && (typeof amount !== 'string' || !/^\d+$/.test(amount))) {
    return { error: 'Amount must be a non-negative integer string (wei)' };
  }
  return { address: addrClean, amount: amount || '1000000000000000000' };
}

function validateTxBody(body: any): { error?: string } {
  if (!body?.from || typeof body.from !== 'string') return { error: 'Missing required field: from' };
  if (!body?.signature || typeof body.signature !== 'string') return { error: 'Missing required field: signature' };
  const fromClean = body.from.replace(/^0x/, '');
  if (!ADDRESS_REGEX.test(fromClean)) return { error: 'Invalid from address' };
  if (body.to != null && body.to !== '' && !ADDRESS_REGEX.test(String(body.to).replace(/^0x/, ''))) {
    return { error: 'Invalid to address' };
  }
  if (body.signature && !HEX_REGEX.test(body.signature.replace(/^0x/, ''))) return { error: 'Invalid signature (hex)' };
  return {};
}
const __dirname = path.dirname(__filename);

const FAUCET_ADDRESS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per address

export class APIServer {
  private app: express.Application;
  private server: any; // HTTP Server
  private wss: WebSocketServer;
  private port: number;
  private mempool: Mempool;
  private stateManager: StateManager;
  private network: P2PNetwork;
  private consensus?: BFTConsensus;
  private faucetLastByAddress: Map<string, number> = new Map();
  private userStore?: IUserStore;

  constructor(port: number, mempool: Mempool, stateManager: StateManager, network: P2PNetwork, consensus?: BFTConsensus, userStore?: IUserStore) {
    this.app = express();
    this.port = port;
    this.mempool = mempool;
    this.stateManager = stateManager;
    this.network = network;
    this.consensus = consensus;
    this.userStore = userStore;

    // Create HTTP Server for WS upgrade
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupAuthRoutes();
    this.setupRoutes();
    this.setupV1Routes();
    this.setupFrontendServing();
    this.setupWebSockets();
  }

  private setupFrontendServing() {
    // Serve static files from the React frontend app
    // Docker: cwd = /app, frontend at /app/frontend/dist
    // Local: cwd = project root, or use __dirname from dist/api
    const cwdPath = path.resolve(process.cwd(), 'frontend', 'dist');
    const relPath = path.resolve(__dirname, '../../frontend/dist');
    const frontendPath = fs.existsSync(cwdPath) ? cwdPath : relPath;
    this.app.use(express.static(frontendPath));

    this.app.get('/favicon.ico', (req, res) => {
        res.status(204).end();
    });

    // Health check (liveness - process is running)
    this.app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Readiness (ready to serve - consensus synced)
    this.app.get('/ready', async (req, res) => {
        try {
            const consensusReady = !!this.consensus;
            const height = this.consensus ? this.consensus.getHeight() : 0;
            res.status(consensusReady ? 200 : 503).json({
                ready: consensusReady,
                height,
                timestamp: Date.now(),
            });
        } catch {
            res.status(503).json({ ready: false, timestamp: Date.now() });
        }
    });

    // Anything that doesn't match the above, send back index.html
    this.app.get(/(.*)/, (req, res) => {
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
      } else {
          res.send('Bery Chain API is running. Frontend not found (run npm run build-frontend).');
      }
    });
  }

  private setupWebSockets() {
      this.wss.on('connection', (ws: WebSocket) => {
          logger.info('API: WebSocket Client connected');
          ws.send(JSON.stringify({ type: 'WELCOME', message: 'Connected to Bery Chain API' }));
          
          ws.on('message', (message: string) => {
              // Handle subscriptions if needed
          });
      });

      if (this.consensus) {
          this.consensus.on('committed', (blockJson: any) => {
              this.broadcast({ type: 'COMMITTED_BLOCK', block: blockJson });
          });
      }
  }

  private broadcast(data: any) {
      const msg = JSON.stringify(data);
      this.wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
              client.send(msg);
          }
      });
  }

  private setupMiddleware() {
      const allowed = config.api.allowedOrigins;
      const corsOptions = {
          origin: (origin: any, callback: any) => {
              if (!origin) return callback(null, true); // Allow non-browser clients
              // If no explicit allowed origins are configured, allow all origins.
              if (allowed.length === 0) return callback(null, true);
              if (allowed.includes(origin)) return callback(null, true);
              return callback(null, false);
          }
      } as any;
      this.app.use(cors(corsOptions));
      this.app.use(helmet());
      this.app.use(compression());
      this.app.use(bodyParser.json({ limit: '100kb' })); // Limit body size

      // Request ID for tracing
      this.app.use((req: any, _res, next) => {
        req.id = req.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        next();
      });

      // General rate limiter: 300 requests per 15 minutes for read-heavy traffic
      const generalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false,
      });
      this.app.use(generalLimiter);

      // Store stricter limiters for sensitive routes (applied in setupRoutes)
      this.app.locals.faucetLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5,
        standardHeaders: true,
        message: { error: 'Faucet rate limit exceeded. Try again later.' },
      });
      this.app.locals.txLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 60,
        standardHeaders: true,
        message: { error: 'Transaction submission rate limit exceeded.' },
      });
  }

  private setupAuthRoutes() {
    if (!this.userStore) return;
    const store = this.userStore;

    this.app.post('/auth/signup', async (req, res) => {
      try {
        const { email, password } = req.body || {};
        if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
          return res.status(400).json({ error: 'Email and password required' });
        }
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
        const user = await store.create(email.trim(), password);
        const token = signToken({ userId: user.id, email: user.email });
        res.json({ token, user: { id: user.id, email: user.email } });
      } catch (e: any) {
        res.status(400).json({ error: e.message || 'Signup failed' });
      }
    });

    this.app.post('/auth/signin', async (req, res) => {
      try {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await store.verifyPassword(email.trim(), password);
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        const token = signToken({ userId: user.id, email: user.email });
        res.json({ token, user: { id: user.id, email: user.email } });
      } catch {
        res.status(500).json({ error: 'Signin failed' });
      }
    });

    this.app.get('/auth/me', (req, res) => {
      const auth = req.headers.authorization;
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Not authenticated' });
      const payload = verifyToken(token);
      if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
      res.json({ user: { id: payload.userId, email: payload.email } });
    });
  }

  private setupV1Routes() {
    const router = express.Router();

    // GET /v1/blocks
    router.get('/blocks', async (req, res) => {
        try {
            if (!this.consensus) return res.status(503).json({ error: 'Consensus not ready' });
            const store = this.consensus.getBlockStore();
            const head = await store.getHead();
            if (!head) return res.json({ blocks: [], total: 0 });

            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            // Iterate backwards from head
            const startHeight = Math.max(0, head.height - offset);
            const endHeight = Math.max(0, startHeight - limit + 1);

            const blocks = [];
            for (let h = startHeight; h >= endHeight; h--) {
                const block = await store.getBlock(h);
                if (block) blocks.push(block.toJSON());
            }
            res.json({ blocks, total: head.height + 1 });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /v1/block/:id
    router.get('/block/:id', async (req, res) => {
        try {
            if (!this.consensus) return res.status(503).json({ error: 'Consensus not ready' });
            const store = this.consensus.getBlockStore();
            const id = req.params.id;
            let block;
            if (id.startsWith('0x') || id.length === 64) {
                 block = await store.getBlockByHash(id.replace('0x', ''));
            } else {
                 block = await store.getBlock(parseInt(id));
            }
            if (!block) return res.status(404).json({ error: 'Block not found' });
            res.json(block.toJSON());
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST /v1/faucet (stricter rate limit + per-address cooldown)
    router.post('/faucet', (req: any, res: any, next: any) => {
      (this.app.locals.faucetLimiter as any)(req, res, next);
    }, async (req, res) => {
        try {
             if (!config.api.faucetEnabled) return res.status(403).json({ error: 'Faucet disabled' });
             const token = req.header('x-faucet-token');
             if (config.api.faucetToken && token !== config.api.faucetToken) return res.status(401).json({ error: 'Unauthorized' });
             const validated = validateFaucetBody(req.body);
             if ('error' in validated) return res.status(400).json({ error: validated.error });
             const { address, amount } = validated;
             const last = this.faucetLastByAddress.get(address);
             if (last && Date.now() - last < FAUCET_ADDRESS_COOLDOWN_MS) {
               return res.status(429).json({ error: `Address cooldown. Try again in ${Math.ceil((FAUCET_ADDRESS_COOLDOWN_MS - (Date.now() - last)) / 60000)} minutes.` });
             }
             if (!this.consensus) return res.status(503).json({ error: 'Consensus not ready' });
             
             // Use Node's Wallet
             const wallet = this.consensus.getKeyPair();
             const myAddress = wallet.getAddress();
             
             // Get Nonce
             const account = await this.stateManager.getAccount(myAddress);
             const nonce = account.nonce.toNumber(); // BN
             
             // Create Tx
             const tx = new Transaction({
                 from: myAddress,
                 to: address,
                 value: new BN(amount || '1000000000000000000'), // Default 1 BRY
                 nonce: nonce,
                 gasLimit: 21000,
                 gasPrice: new BN(1),
                 data: Buffer.alloc(0)
             });
             
             tx.sign(wallet);
             
            if (await this.mempool.add(tx)) {
                 await this.network.broadcastTx(tx);
                 this.faucetLastByAddress.set(address, Date.now());
                 res.json({ hash: tx.hash.toString('hex'), message: 'Funds sent!' });
             } else {
                 res.status(400).json({ error: 'Failed to add faucet tx to mempool' });
             }
        } catch (e: any) {
             res.status(500).json({ error: e.message });
        }
    });

    // GET /v1/chain/info
    router.get('/chain/info', async (req, res) => {
        const height = this.consensus ? this.consensus.getHeight() : 0;
        res.json({
            chainId: config.chain.chainId,
            networkId: config.network.networkId,
            name: config.chain.name,
            symbol: config.chain.symbol,
            decimals: config.chain.decimals,
            blockTimeTarget: config.consensus.blockTime,
            height,
            peers: this.network.getPeers().length,
            mempoolSize: this.mempool.size(),
            finality: 'Instant (BFT)',
            version: '1.0.0'
        });
    });

    // GET /v1/account/:address
    router.get('/account/:address', async (req, res) => {
        try {
            const address = (req.params.address || '').replace(/^0x/, '');
            if (!isValidAddress(address)) return res.status(400).json({ error: 'Invalid address format' });
            const account = await this.stateManager.getAccount(address);
            res.json({
                address,
                balance: account.balance.toString(10),
                nonce: account.nonce.toString(10)
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /v1/address/:address/transactions (indexed)
    router.get('/address/:address/transactions', async (req, res) => {
        try {
            if (!this.consensus) return res.status(503).json({ error: 'Node not ready' });
            const address = (req.params.address || '').replace(/^0x/, '');
            if (!isValidAddress(address)) return res.status(400).json({ error: 'Invalid address format' });
            const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
            const offset = parseInt(req.query.offset as string) || 0;
            const store = this.consensus.getBlockStore();
            const txs = await store.getTransactionsByAddress(address, limit, offset);
            res.json({ transactions: txs, address });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST /v1/tx/send (stricter rate limit)
    router.post('/tx/send', (req: any, res: any, next: any) => {
      (this.app.locals.txLimiter as any)(req, res, next);
    }, async (req, res) => {
        try {
            const val = validateTxBody(req.body);
            if (val.error) return res.status(400).json({ error: val.error });
            const { from, to, value, nonce, signature, gasLimit, gasPrice, data } = req.body;

            const tx = new Transaction({
                from,
                to,
                value: new BN(value),
                nonce,
                gasLimit: gasLimit ? parseInt(gasLimit) : undefined,
                gasPrice: gasPrice ? new BN(gasPrice) : undefined,
                signature: Buffer.from(signature, 'hex'),
                data: data ? Buffer.from(data, 'hex') : undefined
            });

            if (!tx.verify()) {
                return res.status(400).json({ error: 'Invalid signature' });
            }

            if (await this.mempool.add(tx)) {
                await this.network.broadcastTx(tx);
                logger.info(`API: Tx accepted ${tx.hash.toString('hex')}`);
                res.json({ hash: tx.hash.toString('hex') });
            } else {
                res.status(400).json({ error: 'Tx already exists or invalid' });
            }
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /v1/tx/:hash
    router.get('/tx/:hash', async (req, res) => {
        try {
            const hash = req.params.hash;
            
            // Check mempool first
            // Note: Mempool structure might need to be iterated or we add get() method.
            // Assuming mempool doesn't support get(hash) efficiently yet, skipping or iterating.
            // But let's check BlockStore.
            
            if (!this.consensus) {
                return res.status(503).json({ error: 'Node not ready' });
            }

            const blockStore = this.consensus.getBlockStore();
            const txData = await blockStore.getTransaction(hash);

            if (txData) {
                return res.json({
                    status: 'confirmed',
                    hash,
                    blockHeight: txData.blockHeight,
                    blockHash: txData.blockHash,
                    tx: txData.tx.toJSON()
                });
            }

            // Check mempool for pending transactions
            const hashNormalized = hash.replace(/^0x/, '');
            const pendingTx = this.mempool.get(hashNormalized);
            if (pendingTx) {
                return res.json({
                    status: 'pending',
                    hash: hashNormalized,
                    blockHeight: null,
                    blockHash: null,
                    tx: pendingTx.toJSON()
                });
            }
            
            res.status(404).json({ error: 'Transaction not found' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /v1/blocks
    // Query: limit (default 10), offset (default 0)
    router.get('/blocks', async (req, res) => {
        try {
            if (!this.consensus) {
                return res.status(503).json({ error: 'Node not ready' });
            }

            const limit = parseInt(req.query.limit as string) || 10;
            const offset = parseInt(req.query.offset as string) || 0;
            const currentHeight = this.consensus.getHeight();
            
            // Calculate range
            // We want latest blocks, so start from currentHeight - offset
            const startHeight = Math.max(0, currentHeight - offset);
            const endHeight = Math.max(0, startHeight - limit + 1);
            
            const blockStore = this.consensus.getBlockStore();
            const blocks = [];

            for (let h = startHeight; h >= endHeight; h--) {
                const block = await blockStore.getBlock(h);
                if (block) {
                    blocks.push({
                        height: h,
                        hash: block.hash.toString('hex'),
                        txCount: block.transactions.length,
                        timestamp: block.header.timestamp,
                        proposer: block.header.validator
                    });
                }
            }

            res.json({
                total: currentHeight,
                blocks
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /v1/block/:id (height or hash)
    router.get('/block/:id', async (req, res) => {
        try {
            if (!this.consensus) {
                return res.status(503).json({ error: 'Node not ready' });
            }
            
            const id = req.params.id;
            const blockStore = this.consensus.getBlockStore();
            let block;

            if (id.length === 64) {
                // Assume hash
                block = await blockStore.getBlockByHash(id);
            } else {
                // Assume height
                const height = parseInt(id);
                block = await blockStore.getBlock(height);
            }

            if (block) {
                res.json(block.toJSON());
            } else {
                res.status(404).json({ error: 'Block not found' });
            }
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    this.app.use('/v1', router);
  }

  private setupRoutes() {
    this.app.get('/status', async (req, res) => {
        res.json({
            name: config.chain.name,
            symbol: config.chain.symbol,
            networkId: config.network.networkId,
            height: this.consensus ? this.consensus.getHeight() : 0,
            peers: this.network.getPeers().length,
            mempoolSize: this.mempool.size(),
            nodeId: this.network.peerId
        });
    });

    this.app.get('/balance/:address', async (req, res) => {
      try {
        const address = (req.params.address || '').replace(/^0x/, '');
        if (!isValidAddress(address)) return res.status(400).json({ error: 'Invalid address format' });
        const account = await this.stateManager.getAccount(address);
        res.json({
          address,
          balance: account.balance.toString(10),
          nonce: account.nonce.toString(10)
        });
      } catch (e: any) {
        logger.error(`API Error /balance/${req.params.address}: ${e.message}`);
        res.status(500).json({ error: e.message });
      }
    });

    this.app.post('/rpc', async (req, res) => {
        try {
            const { id, method, params } = req.body || {};
            const rpc = async () => {
                switch (method) {
                    case 'eth_chainId':
                        return '0x' + config.chain.chainId.toString(16);
                    case 'net_version':
                        return config.chain.chainId.toString(10);
                    case 'eth_blockNumber':
                        return '0x' + (this.consensus ? this.consensus.getHeight() : 0).toString(16);
                    case 'eth_getBalance': {
                        const address = params?.[0]?.replace('0x', '') || '';
                        const acc = await this.stateManager.getAccount(address);
                        return '0x' + acc.balance.toString(16);
                    }
                    case 'eth_getTransactionByHash': {
                        const hash = (params?.[0] || '').replace('0x', '');
                        const bs = this.consensus?.getBlockStore();
                        if (bs) {
                            const txData = await bs.getTransaction(hash);
                            if (txData) {
                                const t = txData.tx;
                                return {
                                    hash: '0x' + t.hash.toString('hex'),
                                    from: '0x' + t.from,
                                    to: t.to ? '0x' + t.to : null,
                                    nonce: '0x' + t.nonce.toString(16),
                                    value: '0x' + t.value.toString(16),
                                    gas: '0x' + t.gasLimit.toString(16),
                                    gasPrice: '0x' + t.gasPrice.toString(16),
                                    input: '0x' + t.data.toString('hex'),
                                    blockHash: '0x' + txData.blockHash,
                                    blockNumber: '0x' + txData.blockHeight.toString(16),
                                };
                            }
                        }
                        const pending = this.mempool.get(hash);
                        if (pending) {
                            const t = pending;
                            return {
                                hash: '0x' + t.hash.toString('hex'),
                                from: '0x' + t.from,
                                to: t.to ? '0x' + t.to : null,
                                nonce: '0x' + t.nonce.toString(16),
                                value: '0x' + t.value.toString(16),
                                gas: '0x' + t.gasLimit.toString(16),
                                gasPrice: '0x' + t.gasPrice.toString(16),
                                input: '0x' + t.data.toString('hex'),
                                blockHash: null,
                                blockNumber: null,
                            };
                        }
                        return null;
                    }
                    case 'eth_getBlockByNumber': {
                        const tag = params?.[0] || 'latest';
                        const full = !!params?.[1];
                        if (!this.consensus) return null;
                        const bs = this.consensus.getBlockStore();
                        let height = this.consensus.getHeight();
                        if (typeof tag === 'string' && tag.startsWith('0x')) height = parseInt(tag, 16);
                        const block = await bs.getBlock(height);
                        if (!block) return null;
                        const json = block.toJSON();
                        const meta = await bs.getBlockMeta(json.header.height);
                        return {
                            number: '0x' + json.header.height.toString(16),
                            hash: '0x' + json.header.hash,
                            parentHash: '0x' + json.header.parentHash,
                            timestamp: '0x' + json.header.timestamp.toString(16),
                            miner: '0x' + json.header.validator,
                            baseFeePerGas: '0x' + new BN(config.fees.baseFee).toString(16),
                            difficulty: '0x0',
                            totalDifficulty: '0x0',
                            size: '0x0',
                            gasLimit: '0x' + (10000000).toString(16),
                            gasUsed: '0x' + ((meta ? meta.gasUsed : 0).toString(16)),
                            mixHash: '0x' + '0'.repeat(64),
                            receiptsRoot: '0x' + json.header.transactionsRoot,
                            logsBloom: '0x' + (meta ? meta.logsBloom : '0'.repeat(512)),
                            transactions: full ? json.transactions.map((tx: any) => '0x' + tx.hash) : json.transactions.map((tx: any) => '0x' + tx.hash)
                        };
                    }
                    case 'eth_getBlockByHash': {
                        const hash = (params?.[0] || '').replace('0x', '');
                        const full = !!params?.[1];
                        if (!this.consensus) return null;
                        const bs = this.consensus.getBlockStore();
                        const block = await bs.getBlockByHash(hash);
                        if (!block) return null;
                        const json = block.toJSON();
                        return {
                            number: '0x' + json.header.height.toString(16),
                            hash: '0x' + json.header.hash,
                            parentHash: '0x' + json.header.parentHash,
                            timestamp: '0x' + json.header.timestamp.toString(16),
                            miner: '0x' + json.header.validator,
                            baseFeePerGas: '0x' + new BN(config.fees.baseFee).toString(16),
                            difficulty: '0x0',
                            totalDifficulty: '0x0',
                            size: '0x0',
                            gasLimit: '0x' + (10000000).toString(16),
                            gasUsed: '0x' + (0).toString(16),
                            mixHash: '0x' + '0'.repeat(64),
                            receiptsRoot: '0x' + json.header.transactionsRoot,
                            logsBloom: '0x' + '0'.repeat(512),
                            transactions: full ? json.transactions.map((tx: any) => '0x' + tx.hash) : json.transactions.map((tx: any) => '0x' + tx.hash)
                        };
                    }
                    case 'eth_getTransactionCount': {
                        const address = (params?.[0] || '').replace('0x', '');
                        const acc = await this.stateManager.getAccount(address);
                        return '0x' + acc.nonce.toString(16);
                    }
                    case 'eth_getCode': {
                        const address = (params?.[0] || '').replace('0x', '');
                        const acc = await this.stateManager.getAccount(address);
                        if (!acc.codeHash || acc.codeHash.equals(Buffer.alloc(32))) return '0x';
                        const code = await this.stateManager.getCode(acc.codeHash);
                        return code ? '0x' + code.toString('hex') : '0x';
                    }
                    case 'eth_getStorageAt': {
                        const address = (params?.[0] || '').replace('0x', '');
                        const keyHex = (params?.[1] || '').replace('0x', '');
                        const val = await this.stateManager.getContractStorage(address, Buffer.from(keyHex, 'hex'));
                        return val ? '0x' + val.toString('hex') : '0x';
                    }
                    case 'eth_getTransactionReceipt': {
                        const hash = (params?.[0] || '').replace('0x', '');
                        if (!this.consensus) return null;
                        const bs = this.consensus.getBlockStore();
                        const receipt = await bs.getReceipt(hash);
                        return receipt;
                    }
                    case 'eth_gasPrice': {
                        return '0x' + new BN(config.fees.baseFee).toString(16);
                    }
                    case 'eth_maxPriorityFeePerGas': {
                        return '0x' + new BN(config.fees.priorityFee).toString(16);
                    }
                    case 'eth_feeHistory': {
                        const blocks = Number(params?.[0] || 1);
                        const newest = params?.[1] || 'latest';
                        const oldest = newest === 'latest' ? '0x' + (this.consensus ? this.consensus.getHeight() : 0).toString(16) : newest;
                        const baseFees = Array(blocks).fill('0x' + new BN(config.fees.baseFee).toString(16));
                        const gasRatios = Array(blocks).fill(0);
                        return { oldestBlock: oldest, baseFeePerGas: baseFees, gasUsedRatio: gasRatios };
                    }
                    case 'eth_getLogs': {
                        const filter = params?.[0] || {};
                        if (!this.consensus) return [];
                        const bs = this.consensus.getBlockStore();
                        const fromTag = filter.fromBlock;
                        const toTag = filter.toBlock;
                        const from = typeof fromTag === 'string' && fromTag.startsWith('0x') ? parseInt(fromTag, 16) : (fromTag === 'earliest' ? 0 : this.consensus.getHeight());
                        const to = typeof toTag === 'string' && toTag.startsWith('0x') ? parseInt(toTag, 16) : (toTag === 'latest' || !toTag ? this.consensus.getHeight() : this.consensus.getHeight());
                        const address = filter.address;
                        const topics = filter.topics;
                        const logs = await bs.getLogs({ fromBlock: from, toBlock: to, address, topics });
                        return logs;
                    }
                    case 'eth_call': {
                        const callObj = params?.[0] || {};
                        const result = await (await import('../evm/index.js')).evmCall(this.stateManager, config.chain.chainId, {
                            from: callObj.from,
                            to: (callObj.to || '').replace('0x', ''),
                            data: callObj.data,
                            value: callObj.value,
                            gas: callObj.gas
                        });
                        return result.returnData;
                    }
                    case 'eth_estimateGas': {
                        const callObj = params?.[0] || {};
                        const result = await (await import('../evm/index.js')).evmEstimateGas(this.stateManager, config.chain.chainId, {
                            from: callObj.from,
                            to: (callObj.to || '').replace('0x', ''),
                            data: callObj.data,
                            value: callObj.value,
                            gas: callObj.gas
                        });
                        return result;
                    }
                    case 'eth_sendRawTransaction': {
                        const raw = (params?.[0] || '').replace('0x', '');
                        const txMod: any = await import('@ethereumjs/tx');
                        const utilMod: any = await import('@ethereumjs/util');
                        const EthTx = txMod.Transaction;
                        const tx = EthTx.fromSerializedTx(Buffer.from(raw, 'hex'));
                        const sender = tx.getSenderAddress();
                        const to = tx.to ? tx.to.toString() : '';
                        const value = tx.value;
                        const nonce = Number(tx.nonce);
                        const gasLimit = Number(tx.gasLimit);
                        const gasPrice = tx.gasPrice || tx.maxFeePerGas || tx.maxPriorityFeePerGas || new BN(config.fees.baseFee + config.fees.priorityFee);
                        const data = tx.data;
                        const ethHash = Buffer.from(tx.hash().slice(2), 'hex');
                        let vNum = Number(tx.v);
                        let recid = 0;
                        const chainId = tx.common.customChain?.chainId || tx.common.chainIdBN()?.toNumber() || config.chain.chainId;
                        if (vNum === 27 || vNum === 28) {
                            recid = vNum - 27;
                        } else {
                            const base = 35 + chainId * 2;
                            recid = vNum - base;
                            if (recid !== 0 && recid !== 1) recid = (vNum - (36 + chainId * 2));
                            if (recid !== 0 && recid !== 1) recid = 0;
                        }
                        const r = tx.r;
                        const s = tx.s;
                        const sig = Buffer.concat([r.toArrayLike(Buffer, 'be', 32), s.toArrayLike(Buffer, 'be', 32), Buffer.from([recid])]);
                        const ourTx = new Transaction({
                            from: sender.toString().replace('0x', ''),
                            to: to ? to.replace('0x', '') : '',
                            value: new BN(value.toString()),
                            nonce,
                            gasLimit,
                            gasPrice: new BN(gasPrice.toString()),
                            data: Buffer.from(data),
                            signature: sig,
                            ethHash
                        });
                        if (!ourTx.verify()) return { error: 'Invalid signature' };
                        if (await this.mempool.add(ourTx)) {
                            await this.network.broadcastTx(ourTx);
                            return '0x' + ethHash.toString('hex');
                        }
                        return { error: 'Rejected' };
                    }
                    default:
                        return { error: 'Method not supported' };
                }
            };
            const result = await rpc();
            res.json({ jsonrpc: '2.0', id, result });
        } catch (e: any) {
            res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: e.message } });
        }
    });

    // Wallet creation: returns address + publicKey only. Never returns privateKey in production.
    // For secure wallets, use client-side creation (MetaMask, ethers.Wallet.createRandom()).
    this.app.post('/wallet/create', (req, res) => {
        try {
            const kp = new KeyPair();
            res.json({
                address: kp.getAddress(),
                publicKey: kp.publicKey.toString('hex'),
                message: 'Use client-side wallet creation (MetaMask, ethers.js) for production. Private keys must never touch the server.'
            });
        } catch (e: any) {
            logger.error(`API Error /wallet/create: ${e.message}`);
            res.status(500).json({ error: e.message });
        }
    });

    this.app.post('/faucet', (req: any, res: any, next: any) => {
      (this.app.locals.faucetLimiter as any)(req, res, next);
    }, async (req, res) => {
        try {
            if (!config.api.faucetEnabled) return res.status(403).json({ error: 'Faucet disabled' });
            const token = req.header('x-faucet-token');
            if (config.api.faucetToken && token !== config.api.faucetToken) return res.status(401).json({ error: 'Unauthorized' });
            const validated = validateFaucetBody(req.body);
            if ('error' in validated) return res.status(400).json({ error: validated.error });
            const { address, amount } = validated;
            const last = this.faucetLastByAddress.get(address);
            if (last && Date.now() - last < FAUCET_ADDRESS_COOLDOWN_MS) {
              return res.status(429).json({ error: `Address cooldown. Try again in ${Math.ceil((FAUCET_ADDRESS_COOLDOWN_MS - (Date.now() - last)) / 60000)} minutes.` });
            }

            if (!this.consensus) return res.status(503).json({ error: 'Consensus not ready' });

            // Use Node's Wallet
            const wallet = this.consensus.getKeyPair();
            const myAddress = wallet.getAddress();

            // Get Nonce
            const account = await this.stateManager.getAccount(myAddress);
            // Ideally we should track pending nonce in mempool, but for now using state nonce
            // If high concurrency, this might fail with "Nonce too low" in mempool
            const nonce = account.nonce.toNumber(); 

            // Create Tx
            const tx = new Transaction({
                from: myAddress,
                to: address,
                value: new BN(amount || '1000000000000000000'), // Default 1 BRY
                nonce: nonce,
                gasLimit: 21000,
                gasPrice: new BN(1),
                data: Buffer.alloc(0)
            });

            tx.sign(wallet);

            if (await this.mempool.add(tx)) {
                await this.network.broadcastTx(tx);
                this.faucetLastByAddress.set(address, Date.now());
                logger.info(`Faucet: Sent 1 BRY to ${address} (Tx: ${tx.hash.toString('hex')})`);
                res.json({ 
                    success: true, 
                    message: 'Funds sent! (Tx broadcasted)', 
                    hash: tx.hash.toString('hex')
                });
            } else {
                res.status(400).json({ error: 'Failed to add faucet tx to mempool (likely nonce conflict, try again)' });
            }
        } catch (e: any) {
            logger.error(`API Error /faucet: ${e.message}`);
            res.status(500).json({ error: e.message });
        }
    });

    this.app.post('/tx', (req: any, res: any, next: any) => {
      (this.app.locals.txLimiter as any)(req, res, next);
    }, async (req, res) => {
      try {
        const val = validateTxBody(req.body);
        if (val.error) return res.status(400).json({ error: val.error });
        const { from, to, value, nonce, signature, gasLimit, gasPrice, data } = req.body;

        const tx = new Transaction({
            from,
            to,
            value: new BN(value),
            nonce,
            gasLimit: gasLimit ? parseInt(gasLimit) : undefined,
            gasPrice: gasPrice ? new BN(gasPrice) : undefined,
            signature: Buffer.from(signature, 'hex'),
            data: data ? Buffer.from(data, 'hex') : undefined
        });

        if (!tx.verify()) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        if (await this.mempool.add(tx)) {
            await this.network.broadcastTx(tx);
            logger.info(`API: Tx accepted ${tx.hash.toString('hex')}`);
            res.json({ hash: tx.hash.toString('hex') });
        } else {
            res.status(400).json({ error: 'Tx already exists or invalid' });
        }
      } catch (e: any) {
        logger.error(`API Error /tx: ${e.message}`);
        res.status(500).json({ error: e.message });
      }
    });
    
    this.app.get('/mempool', (req, res) => {
        res.json({ size: this.mempool.size() });
    });

    this.app.get('/block/last', async (req, res) => {
        try {
            if (!this.consensus) {
                return res.status(503).json({ error: 'Consensus not ready' });
            }
            // Hack to get last block: we need storage access or cache
            // For now, return height
            res.json({ height: this.consensus.getHeight() });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });
  }

  public listen() {
    this.server.listen(this.port, () => {
      logger.info(`API Server running on port ${this.port}`);
      logger.info(`WebSocket Server ready on port ${this.port}`);
    });
  }
}
