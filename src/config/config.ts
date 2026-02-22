import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  P2P_PORT: Joi.number().default(3000),
  API_PORT: Joi.number().default(8080),
  DATA_DIR: Joi.string().default('./data'),
  PRIVATE_KEY: Joi.string().hex().length(64).optional(),
  LISTEN_ADDRESS: Joi.string().default('0.0.0.0'),
  BOOTSTRAP_PEERS: Joi.string().allow('').default(''),
  VALIDATORS: Joi.string().allow('').default(''),
  BLOCK_TIME: Joi.number().default(5000), // ms
  BLOCK_REWARD: Joi.number().default(13), // Base reward (used if inflation decay disabled)
  INFLATION_DECAY_ENABLED: Joi.boolean().default(true),
  INFLATION_INITIAL_RATE: Joi.number().default(0.08), // 8% year 1 (Solana-style)
  INFLATION_DECAY_RATE: Joi.number().default(0.15), // -15% per year (Solana-style)
  INFLATION_LONG_TERM_RATE: Joi.number().default(0.015), // 1.5% long-term
  BLOCKS_PER_YEAR: Joi.number().default(6_307_200), // 5s blocks: 365*24*3600/5
  FEE_BURN_RATIO: Joi.number().min(0).max(1).default(0.5), // 50% burned, 50% to proposer (Solana-style)
  GENESIS_SUPPLY_TOTAL: Joi.number().default(1_000_000_000), // Total BRY at genesis (1B), split among validators
  CHAIN_NAME: Joi.string().default('Bery'),
  SYMBOL: Joi.string().default('BRY'),
  NETWORK_ID: Joi.string().default('my-chain-1'),
  CHAIN_ID: Joi.number().default(8379), // BERY in phone keypad-ish
  DECIMALS: Joi.number().default(18),
  ALLOWED_ORIGINS: Joi.string().allow('').default(''),
  FAUCET_ENABLED: Joi.boolean().default(false),
  FAUCET_TOKEN: Joi.string().allow('').default(''),
  BASE_FEE: Joi.number().default(1),
  PRIORITY_FEE: Joi.number().default(1),
  JWT_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', { is: 'production', then: Joi.string().invalid('bery-insecure-default-change-in-production') })
    .default('bery-insecure-default-change-in-production'),
  DATABASE_URL: Joi.string().allow('').default(''),
  CHAIN_VERSION: Joi.string().allow('').default('1.0.0')
}).unknown().required();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  chain: {
    name: envVars.CHAIN_NAME,
    symbol: envVars.SYMBOL,
    chainId: envVars.CHAIN_ID,
    decimals: envVars.DECIMALS,
    version: envVars.CHAIN_VERSION,
  },
  network: {
    p2pPort: envVars.P2P_PORT,
    listenAddress: envVars.LISTEN_ADDRESS,
    bootstrapPeers: envVars.BOOTSTRAP_PEERS ? envVars.BOOTSTRAP_PEERS.split(',') : [],
    networkId: envVars.NETWORK_ID,
  },
  api: {
    port: process.env.PORT ? parseInt(process.env.PORT) : envVars.API_PORT,
    allowedOrigins: envVars.ALLOWED_ORIGINS ? envVars.ALLOWED_ORIGINS.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : [],
    faucetEnabled: !!envVars.FAUCET_ENABLED,
    faucetToken: envVars.FAUCET_TOKEN
  },
  storage: {
    dataDir: envVars.DATA_DIR,
  },
  consensus: {
    privateKey: envVars.PRIVATE_KEY,
    validators: envVars.VALIDATORS ? envVars.VALIDATORS.split(',') : [],
    blockTime: envVars.BLOCK_TIME,
    blockReward: envVars.BLOCK_REWARD,
    genesisSupplyTotal: envVars.GENESIS_SUPPLY_TOTAL,
    inflationDecayEnabled: envVars.INFLATION_DECAY_ENABLED,
    inflationInitialRate: envVars.INFLATION_INITIAL_RATE,
    inflationDecayRate: envVars.INFLATION_DECAY_RATE,
    inflationLongTermRate: envVars.INFLATION_LONG_TERM_RATE,
    blocksPerYear: envVars.BLOCKS_PER_YEAR,
    feeBurnRatio: envVars.FEE_BURN_RATIO,
  },
  fees: {
    baseFee: envVars.BASE_FEE,
    priorityFee: envVars.PRIORITY_FEE
  },
  auth: {
    jwtSecret: envVars.JWT_SECRET
  },
  database: {
    url: envVars.DATABASE_URL || null
  }
};
