
const axios = require('axios');

const ROOT_URL = 'http://localhost:8080';
const API_URL = 'http://localhost:8080/v1';

async function main() {
    console.log("Checking health...");
    try {
        const res = await axios.get(`${ROOT_URL}/health`);
        console.log("Health:", res.data);
    } catch (e) {
        console.error("Health failed:", e.message);
    }

    console.log("Checking blocks...");
    try {
        const res = await axios.get(`${API_URL}/blocks`);
        console.log("Blocks:", res.data);
    } catch (e) {
        console.error("Blocks failed:", e.message);
    }
}

main();
