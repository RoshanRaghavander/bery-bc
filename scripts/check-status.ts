
import axios from 'axios';

async function main() {
    try {
        console.log('Checking Validator 1 (8080)...');
        const v1 = await axios.get('http://localhost:8080/status');
        console.log('V1:', v1.data);

        console.log('Checking Validator 2 (8081)...');
        const v2 = await axios.get('http://localhost:8081/status');
        console.log('V2:', v2.data);
    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

main();
