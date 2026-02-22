# Bery Chain

**Bery** is an AI-native, EVM-compatible blockchain with BFT consensus, designed for seamless value transfer between autonomous AI agents and humans.

[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

---

## Features

- **EVM compatible** — Deploy Solidity contracts, use MetaMask, ethers.js
- **BFT consensus** — Instant finality, no reorgs
- **libp2p P2P** — Robust peer discovery and sync
- **JSON-RPC** — Standard `eth_*` methods
- **Auth & dashboard** — JWT + optional PostgreSQL
- **Faucet** — Optional test token distribution

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Install & run

```bash
npm install
cp .env.example .env
# Edit .env: set PRIVATE_KEY (npm run gen-keys) and JWT_SECRET
npm run build
npm start
```

Backend: `http://localhost:8080`  
RPC: `http://localhost:8080/rpc`

### Development

```bash
# Backend
npm run start:dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

---

## Project Structure

```
├── src/                 # Backend
│   ├── api/             # Express REST + JSON-RPC
│   ├── consensus/       # BFT consensus
│   ├── network/         # libp2p P2P
│   ├── state/           # Merkle Patricia state
│   ├── vm/              # EVM execution
│   ├── auth/            # JWT, PostgreSQL/JSON user store
│   └── crypto/          # Keypair, hash, secp256k1
├── frontend/            # React + Vite app
├── scripts/             # gen-keys, create-wallet, etc.
└── tests/               # Node.js test runner
```

---

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes (prod) | 64 hex validator key — `npm run gen-keys` |
| `JWT_SECRET` | Yes (prod) | 32+ char secret for auth |
| `DATABASE_URL` | Prod | PostgreSQL for auth (optional: uses JSON file) |
| `GENESIS_SUPPLY_TOTAL` | No | Total BRY at genesis (1B default, split among validators) |
| `BLOCK_REWARD` | No | BRY per block (13 default, ~8% inflation on 1B) |
| `P2P_PORT` | No | Default 3000 |
| `API_PORT` | No | Default 8080 |
| `FAUCET_ENABLED` | No | Enable faucet |
| `FAUCET_TOKEN` | If faucet | Secret token for faucet requests |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |

See [.env.example](.env.example) for the full list.

---

## Add Bery to MetaMask

| Field | Value |
|-------|--------|
| Network name | Bery |
| RPC URL | `https://bery.in/rpc` |
| Chain ID | 8379 |
| Currency symbol | BRY |

---

## Deployment

### Docker / Dokploy

See [DEPLOY_DOKPLOY.md](DEPLOY_DOKPLOY.md).

### Production checklist

- [ ] Set `PRIVATE_KEY` and `JWT_SECRET`
- [ ] Use `DATABASE_URL` for auth (PostgreSQL)
- [ ] Configure `ALLOWED_ORIGINS` for CORS
- [ ] Open P2P port (3000) for validators
- [ ] Set `FAUCET_TOKEN` if faucet is enabled

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run gen-keys` | Generate validator keys |
| `npm run create-wallet` | Create a new wallet |
| `npm run build` | Build backend + frontend |
| `npm start` | Start the node |
| `npm test` | Run tests |

---

## License

ISC
