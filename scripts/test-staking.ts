import fs from 'fs-extra';
import { Level } from 'level';
import { StateManager } from '../src/state/state_manager.js';
import { VMExecutor } from '../src/vm/index.js';
import { Transaction, STAKING_ADDRESS } from '../src/core/transaction.js';
import { Account } from '../src/state/account.js';
import { KeyPair } from '../src/crypto/keypair.js';
import BN from 'bn.js';
import { logger } from '../src/utils/logger.js';

import path from 'path';

const DB_PATH = './data-test-staking';

async function main() {
    // Cleanup
    await fs.remove(DB_PATH);
    
    // Setup
    const db = new Level(DB_PATH, { valueEncoding: 'binary' });
    const stateManager = new StateManager(db);
    // Point to compiled worker
    const workerPath = path.resolve(process.cwd(), 'dist/vm/worker.js');
    const vmExecutor = new VMExecutor(stateManager, workerPath);
    
    try {
        // 1. Setup Test Account
        const keyPair = new KeyPair();
        const address = keyPair.getAddress();
        const initialBalance = new BN('1000000000000000000'); // 1 ETH
        
        const account = new Account();
        account.balance = initialBalance;
        await stateManager.putAccount(address, account);
        
        logger.info(`Test Account: ${address}`);
        logger.info(`Initial Balance: ${initialBalance.toString()}`);
        
        // 2. Create STAKE Transaction (Stake 100 tokens)
        const stakeAmount = new BN('100');
        const stakeTx = new Transaction({
            from: address,
            to: STAKING_ADDRESS,
            value: stakeAmount,
            nonce: 1,
            gasLimit: 100000,
            gasPrice: new BN(1),
            data: Buffer.from([0x01]) // Command: STAKE
        });
        stakeTx.sign(keyPair);
        
        logger.info('Executing STAKE transaction...');
        const results1 = await vmExecutor.executeBlock([stakeTx]);
        
        if (results1.length !== 1) {
            throw new Error('STAKE Transaction failed');
        }
        
        // 3. Verify Stake
        // Use getContractStorage instead of dump because SecureTrie hashes keys
        const senderKeyBuf = Buffer.from(address, 'hex');
        const stakeBuf = await stateManager.getContractStorage(STAKING_ADDRESS, senderKeyBuf);
        
        if (!stakeBuf) throw new Error('Stake not found in storage');
        const storedStake = new BN(stakeBuf);
        
        logger.info(`Stored Stake: ${storedStake.toString()}`);
        if (!storedStake.eq(stakeAmount)) throw new Error('Stake amount mismatch');
        
        // 4. Create UNSTAKE Transaction (Unstake 50 tokens)
        const unstakeAmount = new BN('50');
        const unstakeData = Buffer.concat([
            Buffer.from([0x02]), // Command: UNSTAKE
            Buffer.from(unstakeAmount.toArray('be', 32)) // Amount (32 bytes)
        ]);
        
        // UNSTAKE tx should have 0 value, but needs gas
        const unstakeTx = new Transaction({
            from: address,
            to: STAKING_ADDRESS,
            value: new BN(0),
            nonce: 2,
            gasLimit: 100000,
            gasPrice: new BN(1),
            data: unstakeData
        });
        unstakeTx.sign(keyPair);
        
        logger.info('Executing UNSTAKE transaction...');
        const results2 = await vmExecutor.executeBlock([unstakeTx]);
        
        if (results2.length !== 1) {
            throw new Error('UNSTAKE Transaction failed');
        }
        
        // 5. Verify Updated Stake and Balance
        const stakeBuf2 = await stateManager.getContractStorage(STAKING_ADDRESS, senderKeyBuf);
        // stakeBuf2 might be null if 0? No, if 0 it might be stored as '00' or '' depending on logic.
        // Worker logic: if newStake.isZero() -> '' (empty string)
        
        let storedStake2 = new BN(0);
        if (stakeBuf2 && stakeBuf2.length > 0) {
            storedStake2 = new BN(stakeBuf2);
        }
        
        logger.info(`Updated Stake: ${storedStake2.toString()}`);
        if (!storedStake2.eq(stakeAmount.sub(unstakeAmount))) throw new Error('Updated stake mismatch');
        
        const finalAccount = await stateManager.getAccount(address);
        logger.info(`Final Balance: ${finalAccount.balance.toString()}`);
        
        // Expected: Initial - Stake(100) - Gas1 + Refund(50) - Gas2
        // Note: Stake(100) deducted 100 from balance. Unstake(50) added 50 back.
        // Net: -50 - Gas.
        
        logger.info('SUCCESS: Staking logic verified!');
        
    } catch (e) {
        logger.error('Test Failed:', e);
        process.exit(1);
    } finally {
        await db.close();
        await fs.remove(DB_PATH);
    }
}

main();
