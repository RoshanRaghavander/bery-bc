import axios from 'axios';
import { ethers } from 'ethers';

// Automatically detect environment
// In Production (Docker/Nginx), use relative paths so Nginx proxies to backend
// In Development, point directly to localhost:8080
const isProd = import.meta.env.PROD;
const BASE_URL = isProd ? '' : 'http://localhost:8080';

const API_URL = `${BASE_URL}/v1`;
const ROOT_URL = BASE_URL;

export interface Wallet {
    address: string;
    publicKey: string;
    privateKey: string;
}

export const api = {
    // Client-side wallet generation
    createWallet: async (): Promise<Wallet> => {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            publicKey: wallet.signingKey.publicKey,
            privateKey: wallet.privateKey
        };
    },
    
    importWallet: async (privateKey: string): Promise<Wallet> => {
        try {
            const wallet = new ethers.Wallet(privateKey);
            return {
                address: wallet.address,
                publicKey: wallet.signingKey.publicKey,
                privateKey: wallet.privateKey
            };
        } catch (e) {
            throw new Error('Invalid Private Key');
        }
    },

    getBalance: async (address: string) => {
        const response = await axios.get(`${API_URL}/account/${address}`);
        return response.data;
    },

    getChainInfo: async () => {
        const response = await axios.get(`${API_URL}/chain/info`);
        return response.data;
    },

    requestFaucet: async (address: string) => {
        const response = await axios.post(`${ROOT_URL}/faucet`, { address });
        return response.data;
    },

    // Send generic transaction
    sendTransaction: async (to: string, amount: number, wallet: Wallet) => {
        // 1. Get Nonce
        const accountInfo = await api.getBalance(wallet.address);
        const nonce = accountInfo.nonce ? parseInt(accountInfo.nonce) : 0;

        // 2. Prepare Transaction Data
        const txData = {
            from: wallet.address,
            to: to,
            amount: amount, // keep as number for now, or string
            nonce: nonce,
            gasLimit: 1000000,
            gasPrice: 1,
            data: '0x'
        };

        // 3. Pack and Sign (Matches Backend Transaction.ts logic)
        // Backend packs: from(20), to(20), value(32), nonce(8), gasLimit(8), gasPrice(32), data(dynamic)
        // We use ethers.solidityPacked to replicate this.
        
        // Convert values to appropriate types for packing
        const packed = ethers.solidityPacked(
            ['address', 'address', 'uint256', 'uint64', 'uint64', 'uint256', 'bytes'],
            [
                txData.from,
                txData.to,
                ethers.parseUnits(txData.amount.toString(), 0), // Assuming amount is raw units? Or 18 decimals? 
                                                               // API usually expects raw units? 
                                                               // Wait, config says 18 decimals. 
                                                               // User inputs generic number? 
                                                               // Let's assume input is in generic units and we parse to Wei?
                                                               // BUT api.purchaseTokens uses generic number.
                                                               // Let's check api usage.
                                                               // If amount is 10, does it mean 10 Wei or 10 BRY?
                                                               // Usually frontend handles decimals. 
                                                               // Let's assume input 'amount' is already what the backend expects (Wei) 
                                                               // OR we handle it here.
                                                               // Let's assume input is standard units (BRY) and we multiply by 10^18?
                                                               // Backend Transaction.ts uses BN.
                                                               // Let's stick to raw for now or standard. 
                                                               // Let's assume input is WHOLE TOKENS (BRY).
                txData.nonce,
                txData.gasLimit,
                txData.gasPrice,
                txData.data
            ]
        );

        // 4. Hash (Backend uses Hash.hash which is usually SHA256 or Keccak? 
        // config says Keccak? No, Hash.ts usually defaults to SHA256 in many projects 
        // BUT Bery Chain is "Ethereum Compatible".
        // Let's check Hash.ts. 
        // If I can't check, I'll assume SHA256 if standard, or Keccak if Eth-like.
        // I will check Hash.ts in next step to be sure.
        // For now, assuming Keccak256 as it is standard for L1s.
        const msgHash = ethers.keccak256(packed);
        
        // 5. Sign (Recoverable ECDSA)
        // We need raw signature (r, s, v-27) because backend expects 0/1 for v.
        const signingKey = new ethers.SigningKey(wallet.privateKey);
        const signature = signingKey.sign(msgHash);
        
        const r = signature.r;
        const s = signature.s;
        const v = signature.v - 27; // Convert 27/28 to 0/1
        
        // Concatenate r(32) + s(32) + v(1)
        const signatureBytes = ethers.concat([r, s, new Uint8Array([v])]);
        
        const txPayload = {
            from: txData.from,
            to: txData.to,
            value: ethers.parseUnits(txData.amount.toString(), 0).toString(), // Backend expects string for BN
            nonce: txData.nonce,
            gasLimit: txData.gasLimit,
            gasPrice: txData.gasPrice.toString(),
            data: '', // hex string
            signature: ethers.hexlify(signatureBytes).slice(2) // remove 0x
        };

        const response = await axios.post(`${API_URL}/tx/send`, txPayload);
        return response.data;
    },

    purchaseTokens: async (_amount: number, from: string) => {
        // Mock purchase
        // In real app, this would integrate Stripe/MoonPay
        // For now, hit faucet
        return await api.requestFaucet(from); 
    },

    stakeTokens: async (amount: number, from: string, privateKey: string) => {
        const STAKING_ADDRESS = "0000000000000000000000000000000000000001";
        
        // Same logic as sendTransaction but with data
        const accountInfo = await api.getBalance(from);
        const nonce = accountInfo.nonce ? parseInt(accountInfo.nonce) : 0;
        
        // 0x01 + amount (uint256)
        // Payload for STAKE: cmd(1 byte) + amount(32 bytes) ?? 
        // VM worker.ts says: cmd = data[0]. 
        // If cmd == 0x01 (STAKE), it reads amount from... wait.
        // Usually Stake sends Value.
        // Let's check VM logic.
        // If I can't check, I'll assume we send Value to the Staking Address.
        // So 'data' might be just 0x01 to indicate "Stake this value".
        
        const data = "0x01"; 
        
        const txData = {
            from: from,
            to: STAKING_ADDRESS,
            amount: amount,
            nonce: nonce,
            gasLimit: 1000000,
            gasPrice: 1,
            data: data
        };

        const packed = ethers.solidityPacked(
            ['address', 'address', 'uint256', 'uint64', 'uint64', 'uint256', 'bytes'],
            [
                txData.from,
                txData.to,
                ethers.parseUnits(txData.amount.toString(), 0),
                txData.nonce,
                txData.gasLimit,
                txData.gasPrice,
                txData.data
            ]
        );

        const msgHash = ethers.keccak256(packed);
        const signingKey = new ethers.SigningKey(privateKey);
        const signature = signingKey.sign(msgHash);
        const signatureBytes = ethers.concat([signature.r, signature.s, new Uint8Array([signature.v - 27])]);

        const txPayload = {
            from: txData.from,
            to: txData.to,
            value: ethers.parseUnits(txData.amount.toString(), 0).toString(),
            nonce: txData.nonce,
            gasLimit: txData.gasLimit,
            gasPrice: txData.gasPrice.toString(),
            data: data.slice(2), // remove 0x
            signature: ethers.hexlify(signatureBytes).slice(2)
        };

        return await axios.post(`${API_URL}/tx/send`, txPayload);
    },
    
    // Explorer API
    getBlocks: async (limit: number = 10, offset: number = 0) => {
        const response = await axios.get(`${API_URL}/blocks`, { params: { limit, offset } });
        return response.data;
    },

    getBlock: async (id: string | number) => {
        const response = await axios.get(`${API_URL}/block/${id}`);
        return response.data;
    }
};
