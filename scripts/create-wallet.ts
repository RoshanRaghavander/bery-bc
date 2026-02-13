import { KeyPair } from '../dist/crypto/keypair.js';

function main() {
    console.log('Generating new wallet...');
    try {
        const kp = new KeyPair();
        console.log('----------------------------------------------------------------');
        console.log(`Private Key: ${kp.privateKey.toString('hex')}`);
        console.log(`Public Key:  ${kp.publicKey.toString('hex')}`);
        console.log(`Address:     ${kp.getAddress()}`);
        console.log('----------------------------------------------------------------');
        console.log('IMPORTANT: Save your Private Key securely! It cannot be recovered.');
    } catch (e: any) {
        console.error('Error generating wallet:', e.message);
    }
}

main();
