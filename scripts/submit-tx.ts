
import axios from 'axios';
import { Transaction } from '../src/core/transaction.js';
import { KeyPair } from '../src/crypto/keypair.js';
import BN from 'bn.js';

async function main() {
    // 1. Generate Sender
    const keyPair = new KeyPair();
    const from = keyPair.getAddress();
    console.log(`Sender Address: ${from}`);

    // 2. Create Transaction
    const tx = new Transaction({
        from: from,
        to: '0000000000000000000000000000000000000000', // Burn address or whatever
        value: new BN(0),
        nonce: 0,
        gasLimit: 100000,
        gasPrice: new BN(1),
        chainId: 1
    });

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
        
        const resMempool = await axios.get('http://localhost:8081/mempool');
        console.log('Validator 2 Mempool Size:', resMempool.data);

        // 6. Wait for block inclusion (monitor logs manually or query status repeatedly)
        console.log('Waiting for block inclusion...');
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const balanceRes = await axios.get(`http://localhost:8081/balance/${from}`);
            console.log(`Check ${i+1}: Sender Nonce at V2:`, balanceRes.data.nonce);
            if (parseInt(balanceRes.data.nonce) > 0) {
                console.log('SUCCESS: Transaction confirmed on Validator 2!');
                break;
            }
        }

    } catch (e: any) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

main();
