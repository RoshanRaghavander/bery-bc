import axios from 'axios';

const API_URL = 'http://localhost:8080';
// Validator 1 Public Key (Address)
const ADDRESS = '02cfd6051b83667280446c38510b303f327729f8dbbdfee157595ca1ec51d1e801'; 

async function check() {
    try {
        console.log('Checking status...');
        const statusRes = await axios.get(`${API_URL}/status`);
        console.log('Height:', statusRes.data.height);
        
        if (statusRes.data.height < 2) {
             console.log('Not enough blocks yet.');
             return;
        }

        console.log('Checking balance...');
        const balanceRes = await axios.get(`${API_URL}/balance/${ADDRESS}`);
        console.log('Balance Response:', balanceRes.data);
        
        const balance = BigInt(balanceRes.data.balance);
        console.log(`Validator Balance: ${balance.toString()}`);

        if (balance > 0n) {
            console.log('SUCCESS: Minting verified! Balance is greater than 0.');
        } else {
            console.log('FAILURE: Balance is zero.');
        }

    } catch (e: any) {
        if (e.code === 'ECONNREFUSED') {
            console.log('Connection refused. Node might be starting up...');
        } else {
            console.error('Error:', e.message || e);
            if (e.response) {
                console.error('Response data:', e.response.data);
            }
        }
    }
}

check();
