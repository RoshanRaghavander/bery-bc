
import axios from 'axios';
import { Transaction } from '../dist/core/transaction.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import BN from 'bn.js';

async function main() {
    // 1. Generate Sender
    // Use Validator 1 Private Key (from .env/start-v1.ps1)
    const privKey = 'c0c237c395fa01d975651c346995e378ab199cc1b40c6dbb353fad9363c2d621';
    const keyPair = KeyPair.fromPrivateKey(privKey);
    const from = keyPair.getAddress();
    console.log(`Sender Address (Validator 1): ${from}`);

    // 2. Create Transaction
    const tx = new Transaction({
        from: from,
        to: '0000000000000000000000000000000000000000', // Burn address or whatever
        value: new BN(100), // Send 100 wei
        nonce: 0, // Should be 0 if first tx, or fetch from API
        gasLimit: 100000,
        gasPrice: new BN(1),
        chainId: 1
    });

    // Fetch nonce from API to be safe
    try {
        const nonceRes = await axios.get(`http://localhost:8080/balance/${from}`);
        console.log(`Current Nonce: ${nonceRes.data.nonce}`);
        tx.nonce = parseInt(nonceRes.data.nonce);
        // If pending txs, nonce might be higher?
        // Simple logic: use confirmed nonce + 1?
        // Actually, if nonce is 0 (fresh), use 0.
        // If 0, use 0.
        // Wait, Account starts with nonce 0.
        // First tx should have nonce 1? Or 0?
        // worker.ts: if (tx.nonce !== sender.nonce.toNumber() + 1 && tx.nonce !== sender.nonce.toNumber())
        // It allows nonce or nonce+1?
        // "if (tx.nonce !== sender.nonce.toNumber())" -> throws.
        // Wait, I should check worker.ts logic.
    } catch (e) {
        console.log('Could not fetch nonce, assuming 0');
    }

    // 3. Sign
    tx.sign(keyPair);
    console.log(`Transaction Hash: ${tx.hash.toString('hex')}`);

    const payload = {
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(10),
        nonce: tx.nonce,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice.toString(10),
        signature: tx.signature.toString('hex')
    };

    try {
        // 4. Submit to Validator 1
        console.log('Submitting to Validator 1 (port 8080)...');
        const res = await axios.post('http://localhost:8080/tx', payload);
        console.log('Response:', res.data);

        // 5. Check Validator 2 Mempool/Status
        console.log('Checking Validator 2 (port 8081) mempool...');
        // Wait a bit for propagation
        await new Promise(r => setTimeout(r, 2000));
        
        const res2 = await axios.get('http://localhost:8081/status');
        console.log('Validator 2 Status:', res2.data);
        
        console.log('Validator 2 Mempool Size:', res2.data.mempoolSize);

        // 6. Wait for block inclusion (monitor logs manually or query status repeatedly)
        console.log('Waiting for block inclusion...');
        for (let i = 0; i < 20; i++) { // Increase wait time
            await new Promise(r => setTimeout(r, 2000));
            try {
                const balanceRes = await axios.get(`http://localhost:8081/balance/${from}`);
                console.log(`Check ${i+1}: Sender Nonce at V2:`, balanceRes.data.nonce);
                if (parseInt(balanceRes.data.nonce) > 0) {
                    console.log('SUCCESS: Transaction confirmed on Validator 2!');
                    break;
                }
            } catch (e) {
                console.log(`Check ${i+1}: Account not found yet or error`);
            }
        }

    } catch (e) {
        console.error('Error Object:', e);
        if (e.response) {
            console.error('Response Status:', e.response.status);
            console.error('Response Data:', JSON.stringify(e.response.data));
        } else {
            console.error('Error Message:', e.message);
        }
    }
}

main();
