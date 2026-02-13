import { createSecp256k1PeerId } from '@libp2p/peer-id-factory';
import { KeyPair } from '../dist/crypto/keypair.js';

async function generate() {
    console.log('--- Generating Validator 1 ---');
    const val1PeerId = await createSecp256k1PeerId();
    if (val1PeerId.privateKey) {
        // Skip first 4 bytes (protobuf header) to get raw 32 bytes private key
        const val1PrivHex = Buffer.from(val1PeerId.privateKey).slice(4).toString('hex');
        console.log(`PRIVATE_KEY=${val1PrivHex}`);
        console.log(`PEER_ID=${val1PeerId.toString()}`);
        
        const kp = KeyPair.fromPrivateKey(val1PrivHex);
        console.log(`ADDRESS=${kp.getAddress()}`);
    }

    console.log('\n--- Generating Validator 2 ---');
    const val2PeerId = await createSecp256k1PeerId();
    if (val2PeerId.privateKey) {
        const val2PrivHex = Buffer.from(val2PeerId.privateKey).slice(4).toString('hex');
        console.log(`PRIVATE_KEY=${val2PrivHex}`);
        console.log(`PEER_ID=${val2PeerId.toString()}`);
        
        const kp = KeyPair.fromPrivateKey(val2PrivHex);
        console.log(`ADDRESS=${kp.getAddress()}`);
    }
}

generate().catch(console.error);
