# Bery Chain Network Information

This document contains all the necessary information to connect to the Bery Chain Mainnet and Testnet.

## 🌐 Network Details

| Parameter | Value |
|Str|Str|
| **Network Name** | Bery Chain |
| **Chain ID** | `8379` (Mainnet) |
| **Currency Symbol** | `BRY` |
| **Decimals** | `18` |
| **Consensus** | BFT (Instant Finality) |
| **Block Time** | 5 Seconds |
| **Gas Token** | BRY |
| **Average Fee** | ~0.001 BRY |

## 🔌 RPC Endpoints

Use these endpoints to connect your wallet, node, or application.

### Mainnet
*   **RPC URL**: `https://rpc.berychain.xyz` (Coming Soon)
*   **WebSocket**: `wss://rpc.berychain.xyz`
*   **Localhost**: `http://localhost:8080` (Default Port)

### Testnet
*   **RPC URL**: `https://testnet-rpc.berychain.xyz`
*   **Faucet**: `https://faucet.berychain.xyz`

## 🔍 Block Explorers

View blocks, transactions, and account balances.

*   **Mainnet Explorer**: `https://explorer.berychain.xyz` (Coming Soon)
*   **Local Explorer**: Access the "Explorer" tab in the official Web Wallet (`http://localhost`)

## 📜 Smart Contracts & System Addresses

Bery Chain uses pre-compiled system contracts for core functionality.

| Name | Address | Description |
|Str|Str|Str|
| **Staking Contract** | `0000000000000000000000000000000000000001` | Send `STAKE` (0x01) or `UNSTAKE` (0x02) commands here. |
| **System Sender** | `0000000000000000000000000000000000000000` | Address used for block rewards (Coinbase). |

## ⚙️ Technical Specifications

*   **VM Compatibility**: Custom BeryVM (Ethereum-like State Trie)
*   **Address Format**: 20-byte Ethereum-style addresses (derived via `Keccak256(PubKey).slice(-20)`)
*   **Signature Scheme**: ECDSA (secp256k1)
*   **Transaction Type**: 
    *   Legacy-like structure
    *   Fields: `to`, `value`, `nonce`, `gasLimit`, `gasPrice`, `data`
    *   Signing: `Keccak256(RLP_Packed_Fields)`
*   **Finality**: **Instant**. Once a block is committed by >2/3 validators, it is final. No reorganizations.

## 🛠️ Developer Integration

### Install SDK
```bash
npm install @bery-chain/sdk
```

### Connect with ethers.js (Compatible Mode)
```javascript
const provider = new ethers.JsonRpcProvider('http://localhost:8080/v1');
// Note: Bery Chain API v1 uses REST-like JSON, but we are working on full Web3 JSON-RPC compatibility.
```

### Sending a Transaction (Raw)
```javascript
// POST http://localhost:8080/v1/tx/send
{
  "to": "0x...",
  "value": "1000000000000000000", // 1 BRY
  "nonce": 0,
  "gasLimit": 21000,
  "gasPrice": "1",
  "data": "0x",
  "signature": "0x..." // ECDSA Signature of packed tx data
}
```
