# Bery Chain Specification (L1)

## Network Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Chain Name** | Bery | Human-readable name |
| **Chain ID** | 8379 | Unique Identifier (EIP-155 compatible) |
| **Symbol** | BRY | Native Token Symbol |
| **Decimals** | 18 | Native Token Precision (1 BRY = 10^18 wei) |
| **Block Time** | 5 Seconds | Target interval between blocks |
| **Consensus** | BFT (PBFT-style) | Deterministic Finality |
| **Finality** | Instant (1 Block) | Transactions are final once included in a committed block |

## Finality Model

Bery Chain uses a BFT (Byzantine Fault Tolerant) consensus engine. 
- **Deterministic Finality**: A block is considered **final** as soon as it is committed to the chain.
- **No Reorgs**: Unlike PoW chains (Bitcoin/Ethereum 1.0), Bery Chain does not experience deep reorganizations under normal operation. Once a block is committed (2/3+ validators signed), it is permanent.
- **Confirmation Rule**: Integrators should consider a transaction **CONFIRMED** after **1 Block Confirmation**.

## JSON-RPC / API

The node exposes a RESTful JSON API at port `8080` (default).

### Base URL
`http://<node-ip>:8080/v1`

### Endpoints

#### `GET /v1/chain/info`
Returns chain parameters and current node status.
```json
{
  "chainId": 8379,
  "height": 105,
  "finality": "Instant (BFT)",
  "decimals": 18
  ...
}
```

#### `GET /v1/account/:address`
Returns account balance and nonce.
- **address**: Hex string (20 bytes, e.g., `0x123...`)

#### `POST /v1/tx/send`
Submit a signed transaction to the network.
- **Payload**: `{ from, to, value, nonce, gasLimit, gasPrice, data, signature }`

#### `GET /v1/tx/:hash`
Get transaction details by hash.
- **hash**: 32-byte hex string (without 0x prefix usually, but check implementation)

#### `GET /v1/block/:id`
Get block by Height (number) or Hash (hex string).
- **id**: `123` or `aabbcc...` or `latest`

## Address Format
- **Type**: Secp256k1 (Ethereum-style)
- **Derivation**: `Keccak256(PublicKey).slice(-20)`
- **Prefix**: None mandatory, but `0x` representation is standard.

## Max Throughput
- **Target TPS**: ~100-500 TPS (Single Threaded VM execution)
- **Block Size**: Dynamic (Gas Limit constrained)
