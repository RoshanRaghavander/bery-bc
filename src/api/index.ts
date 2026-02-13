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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class APIServer {
  private app: express.Application;
  private server: any; // HTTP Server
  private wss: WebSocketServer;
  private port: number;
  private mempool: Mempool;
  private stateManager: StateManager;
  private network: P2PNetwork;
  private consensus?: BFTConsensus;

  constructor(port: number, mempool: Mempool, stateManager: StateManager, network: P2PNetwork, consensus?: BFTConsensus) {
    this.app = express();
    this.port = port;
    this.mempool = mempool;
    this.stateManager = stateManager;
    this.network = network;
    this.consensus = consensus;

    // Create HTTP Server for WS upgrade
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupV1Routes();
    this.setupFrontendServing();
    this.setupWebSockets();
  }

  private setupFrontendServing() {
    // Serve static files from the React frontend app
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    this.app.use(express.static(frontendPath));

    // Health check
    this.app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: Date.now() });
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
              // Handle subscriptions (e.g., { type: 'SUBSCRIBE', topic: 'blocks' })
              // For now, we broadcast everything to everyone for simplicity
          });
      });

      // Hook into Consensus events if available
      if (this.consensus) {
          this.network.on('block', (block) => { // Or better, listen to consensus commit event
              this.broadcast({ type: 'NEW_BLOCK', block: block });
          });
      }
      
      // We should really listen to 'committedBlock' from BFTConsensus, but 'block' from network is a start
      // Let's add a proper event listener if BFTConsensus emits it. 
      // BFTConsensus extends EventEmitter but we didn't add a specific commit event.
      // We can use network.on('block') but that's PROPOSAL, not COMMIT.
      // Let's stick to network block for now as "New Block Proposed".
      // Better: BFTConsensus should emit 'committed'.
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
      this.app.use(cors());
      this.app.use(helmet());
      this.app.use(compression());
      this.app.use(bodyParser.json({ limit: '100kb' })); // Limit body size

      // Rate limiter: 100 requests per 15 minutes
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, 
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
      });
      this.app.use(limiter);
  }

  private setupV1Routes() {
    const router = express.Router();

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
            const address = req.params.address;
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

    // POST /v1/tx/send
    router.post('/tx/send', async (req, res) => {
        try {
            const { from, to, value, nonce, signature, gasLimit, gasPrice, data } = req.body;
            
            if (!from || !signature) {
                 return res.status(400).json({ error: 'Missing required fields' });
            }

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

            if (this.mempool.add(tx)) {
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

            // If not in block, maybe in mempool?
            // TODO: Add get(hash) to Mempool
            
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
        const address = req.params.address;
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

    this.app.post('/wallet/create', (req, res) => {
        try {
            const kp = new KeyPair();
            res.json({
                address: kp.getAddress(),
                publicKey: kp.publicKey.toString('hex'),
                privateKey: kp.privateKey.toString('hex')
            });
        } catch (e: any) {
            logger.error(`API Error /wallet/create: ${e.message}`);
            res.status(500).json({ error: e.message });
        }
    });

    this.app.post('/faucet', async (req, res) => {
        try {
            const { address } = req.body;
            if (!address) return res.status(400).json({ error: 'Address required' });

            const account = await this.stateManager.getAccount(address);
            // Grant 1000 Tokens
            account.balance = account.balance.add(new BN(1000));
            await this.stateManager.putAccount(address, account);
            
            logger.info(`Faucet: Funded ${address} with 1000 BRY`);
            res.json({ 
                success: true, 
                message: 'Faucet funded 1000 Bery', 
                newBalance: account.balance.toString(10) 
            });
        } catch (e: any) {
            logger.error(`API Error /faucet: ${e.message}`);
            res.status(500).json({ error: e.message });
        }
    });

    this.app.post('/tx', async (req, res) => {
      try {
        const { from, to, value, nonce, signature, gasLimit, gasPrice, data } = req.body;
        
        // Basic Validation
        if (!from || !signature) {
             return res.status(400).json({ error: 'Missing required fields' });
        }

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

        if (this.mempool.add(tx)) {
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

  public async start() {
    this.server.listen(this.port, () => {
      logger.info(`API Server running on port ${this.port}`);
      logger.info(`WebSocket Server ready on ws://localhost:${this.port}`);
    });
  }
}
