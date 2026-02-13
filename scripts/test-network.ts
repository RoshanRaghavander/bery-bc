
import { Transaction } from '../dist/core/transaction.js';
import { KeyPair } from '../dist/crypto/keypair.js';
import BN from 'bn.js';

async function main() {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    console.log('--- Checking Node Status ---');
    try {
        const status1 = await fetch('http://localhost:8080/status').then(r => r.json());
        console.log('Node 1 Status:', status1);
        const status2 = await fetch('http://localhost:8081/status').then(r => r.json());
        console.log('Node 2 Status:', status2);
    } catch (e) {
        console.error('Failed to fetch status:', e);
        return;
    }

    console.log('\n--- Sending Transaction to Node 1 ---');
    // Create a transaction
    // Sender: Validator 1 (we have its private key from env or gen-keys)
    // PRIVATE_KEY=c0c237c395fa01d975651c346995e378ab199cc1b40c6dbb353fad9363c2d621
    // Address: 02cfd6051b83667280446c38510b303f327729f8dbbdfee157595ca1ec51d1e801
    
    // Receiver: Random address
    const receiver = new KeyPair().getAddress();
    
    const kp = KeyPair.fromPrivateKey('c0c237c395fa01d975651c346995e378ab199cc1b40c6dbb353fad9363c2d621');
    const tx = new Transaction({
        from: kp.getAddress(),
        to: receiver,
        value: new BN(100),
        nonce: 1, // First tx
        gasLimit: 21000,
        gasPrice: new BN(1)
    });
    
    tx.sign(kp);
    
    console.log(`Sending Tx ${tx.hash.toString('hex')} from ${tx.from} to ${tx.to}`);
    
    try {
        const res = await fetch('http://localhost:8080/tx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: tx.from,
                to: tx.to,
                value: tx.value.toString(10),
                nonce: tx.nonce,
                gasLimit: tx.gasLimit,
                gasPrice: tx.gasPrice.toString(10),
                signature: tx.signature!.toString('hex')
            })
        });
        
        const json = await res.json();
        console.log('Submit Result:', json);
    } catch (e) {
        console.error('Failed to submit tx:', e);
    }

    console.log('\n--- Waiting for Confirmation ---');
    for (let i = 0; i < 10; i++) {
        await sleep(2000);
        const status1 = await fetch('http://localhost:8080/status').then(r => r.json());
        const status2 = await fetch('http://localhost:8081/status').then(r => r.json());
        console.log(`[${i*2}s] Height: V1=${status1.height} V2=${status2.height} Mempool: V1=${status1.mempoolSize} V2=${status2.mempoolSize}`);
        
        if (status1.height > 0 || status2.height > 0) {
            console.log('Block committed!');
            // Check balance
            const balRes = await fetch(`http://localhost:8080/balance/${receiver}`).then(r => r.json());
            console.log('Receiver Balance:', balRes);
            break;
        }
    }
}

main().catch(console.error);
