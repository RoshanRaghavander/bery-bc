import axios from 'axios';

const API_URL = 'http://localhost:8080/v1';
const ROOT_URL = 'http://localhost:8080';

async function verify() {
    console.log('Verifying Integration...');

    // 1. Check Health
    try {
        const health = await axios.get(`${ROOT_URL}/health`);
        console.log('Health:', health.data);
    } catch (e: any) {
        console.error('Health check failed:', e.message);
        return;
    }

    // 2. Check Static File Serving
    try {
        console.log('Checking Static Serving...');
        const index = await axios.get(`${ROOT_URL}/`);
        if (index.data.includes('<!doctype html>') || index.data.includes('<title>')) {
            console.log('Static Serving: OK (index.html found)');
        } else {
            console.log('Static Serving: WARNING (Content might not be HTML)');
            console.log('Preview:', index.data.substring(0, 100));
        }
    } catch (e: any) {
        console.error('Static serving failed:', e.message);
    }

    // 3. Check Blocks (Wait for block production)
    console.log('Waiting 10s for blocks...');
    await new Promise(r => setTimeout(r, 10000));

    try {
        console.log('Fetching blocks...');
        const blocks = await axios.get(`${API_URL}/blocks`);
        console.log(`Blocks found: ${blocks.data.blocks.length}`);
        if (blocks.data.blocks.length > 0) {
            // API returns { blocks: [ { header: {...}, transactions: [] } ] }
            const headBlock = blocks.data.blocks[0];
            const height = headBlock.header ? headBlock.header.height : headBlock.height;
            console.log('Head Block Height:', height);
        }
    } catch (e: any) {
        console.error('Blocks check failed:', e.message);
    }

    // 4. Check Faucet (Again to see if previous tx was included)
    try {
        console.log('Testing Faucet...');
        // Use a random address
        const randomAddress = '0x1234567890123456789012345678901234567890';
        const faucet = await axios.post(`${API_URL}/faucet`, {
            address: randomAddress,
            amount: '1000000000000000000' // 1 BRY
        });
        console.log('Faucet result:', faucet.data);
    } catch (e: any) {
        console.error('Faucet check failed:', e.response ? e.response.data : e.message);
    }
}

verify();
