
import axios from 'axios';
import { KeyPair } from '../src/crypto/keypair';
import { Transaction, STAKING_ADDRESS } from '../src/core/transaction';
import BN from 'bn.js';

// V1 Private Key
const PRIV_KEY = 'c0c237c395fa01d975651c346995e378ab199cc1b40c6dbb353fad9363c2d621';
const API_URL = 'http://localhost:8080';

async function main() {
    // 1. Setup KeyPair
    const kp = KeyPair.fromPrivateKey(PRIV_KEY);
    console.log('Sender Address:', kp.getAddress());

    // 2. Create Transaction
    // STAKE command: 0x01
    const data = Buffer.from([0x01]); 
    
    // We assume nonce 0 for fresh chain. 
    // If you ran txs before, this might fail.
    const nonce = 0;

    const tx = new Transaction({
        from: kp.getAddress(),
        to: STAKING_ADDRESS,
        value: new BN(100), // Stake 100 units
        nonce: nonce,
        gasLimit: 100000, // Generous gas limit
        gasPrice: new BN(1),
        data: data
    });

    // 3. Sign
    tx.sign(kp);

    // 4. Send
    console.log('Sending STAKE transaction:', tx.hash.toString('hex'));
    
    try {
        const payload = {
            from: tx.from,
            to: tx.to,
            value: tx.value.toString(),
            nonce: tx.nonce,
            gasLimit: tx.gasLimit.toString(),
            gasPrice: tx.gasPrice.toString(),
            data: tx.data.toString('hex'),
            signature: tx.signature.toString('hex')
        };
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const res = await axios.post(`${API_URL}/tx`, payload);
        
        console.log('Success! Response:', res.data);
    } catch (e: any) {
        console.error('Error sending tx:', e.response ? e.response.data : e.message);
    }
}

main().catch(console.error);
