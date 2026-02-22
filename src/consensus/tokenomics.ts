/**
 * Solana-style inflation decay for block rewards.
 * Initial ~8% annual, -15% decay per year, long-term ~1.5%.
 * Returns reward in wei (18 decimals).
 */
import { config } from '../config/config.js';
import BN from 'bn.js';

const WEI = new BN('1000000000000000000'); // 10^18

export function getBlockReward(height: number): BN {
  const base = config.consensus.blockReward; // whole BRY
  if (!config.consensus.inflationDecayEnabled) {
    return new BN(base).mul(WEI);
  }
  const blocksPerYear = config.consensus.blocksPerYear;
  const years = height / blocksPerYear;
  const decay = config.consensus.inflationDecayRate;
  const longTerm = config.consensus.inflationLongTermRate;
  const decayFactor = Math.pow(1 - decay, years);
  const supplyWei = BigInt(config.consensus.genesisSupplyTotal) * BigInt(1e18);
  const minRewardWei = Number((supplyWei * BigInt(Math.floor(longTerm * 1e6))) / BigInt(Math.floor(blocksPerYear * 1e6)));
  const baseWei = BigInt(base) * BigInt(1e18);
  const decayedRewardWei = Number((baseWei * BigInt(Math.floor(decayFactor * 1e6))) / BigInt(1e6));
  const rewardWei = Math.max(minRewardWei, decayedRewardWei);
  return new BN(rewardWei.toString());
}
