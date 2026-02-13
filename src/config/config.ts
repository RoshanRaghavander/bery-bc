import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  P2P_PORT: Joi.number().default(6001),
  API_PORT: Joi.number().default(8080),
  DATA_DIR: Joi.string().default('./data'),
  PRIVATE_KEY: Joi.string().hex().length(64).optional(),
  BOOTSTRAP_PEERS: Joi.string().allow('').default(''),
  VALIDATORS: Joi.string().allow('').default(''),
  BLOCK_TIME: Joi.number().default(5000), // ms
  BLOCK_REWARD: Joi.number().default(10), // Tokens per block
  CHAIN_NAME: Joi.string().default('Bery'),
  SYMBOL: Joi.string().default('BRY'),
  NETWORK_ID: Joi.string().default('my-chain-1'),
  CHAIN_ID: Joi.number().default(8379), // BERY in phone keypad-ish
  DECIMALS: Joi.number().default(18),
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
  },
  network: {
    p2pPort: envVars.P2P_PORT,
    bootstrapPeers: envVars.BOOTSTRAP_PEERS ? envVars.BOOTSTRAP_PEERS.split(',') : [],
    networkId: envVars.NETWORK_ID,
  },
  api: {
    port: process.env.PORT ? parseInt(process.env.PORT) : envVars.API_PORT,
  },
  storage: {
    dataDir: envVars.DATA_DIR,
  },
  consensus: {
    privateKey: envVars.PRIVATE_KEY,
    validators: envVars.VALIDATORS ? envVars.VALIDATORS.split(',') : [],
    blockTime: envVars.BLOCK_TIME,
    blockReward: envVars.BLOCK_REWARD,
  },
};