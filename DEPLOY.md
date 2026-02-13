# Deployment Instructions

This project is ready for deployment using Docker. It includes:
1. **Backend Validator Node**: Runs the blockchain, API, and P2P network.
2. **Frontend App**: A React interface for users to interact with the chain.
3. **Nginx Proxy**: Serves the frontend and proxies API requests to the backend.

## Prerequisites
- A server (VPS, Dedicated, or Cloud Instance)
- Docker & Docker Compose installed
- Ports 80 (Frontend), 8080 (API), 3000 (P2P) open

## Setup Steps

1. **Upload Code**: Copy this entire directory to your server.
   ```bash
   scp -r "Blockchain Final" user@your-server:/path/to/project
   ```

2. **Configure Environment**:
   Rename `.env.example` to `.env` and set your private key.
   ```bash
   cp .env.example .env
   nano .env
   ```
   *Note: Ensure your `PRIVATE_KEY` corresponds to a validator if you are bootstrapping the network.*

3. **Start Services**:
   Run the following command to build and start the containers:
   ```bash
   docker-compose up -d --build
   ```

4. **Verify Deployment**:
   - **Frontend**: Visit `http://<your-server-ip>`
   - **API**: Visit `http://<your-server-ip>/v1/chain/info`
   - **Logs**: Check logs with `docker-compose logs -f`

## Architecture
- **Nginx (Port 80)**:
  - Serves React App (Static Files)
  - Proxies `/v1/*` -> Backend API
  - Proxies `/ws/*` -> Backend WebSocket

- **Backend (Internal Port 8080)**:
  - Validates blocks (BFT Consensus)
  - Manages Mempool & State
  - Syncs with peers on Port 3000

## Notes
- To add more validators, you can run additional nodes on different servers and update the `BOOTSTRAP_PEERS` in `.env` (you'll need to modify docker-compose to accept a peer list env var if not already supported, or use the `peers.json` discovery).
- The current setup runs a single validator node. To run a network, deploy this setup to multiple servers with different keys.
