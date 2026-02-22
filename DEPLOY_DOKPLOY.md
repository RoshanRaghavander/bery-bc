# Deploy Bery Chain with Dokploy + GitHub

Deploy Bery to your VPS using [Dokploy](https://dokploy.com) with automatic deployments from GitHub.

## Prerequisites

- VPS with Docker installed
- Dokploy installed on your VPS
- GitHub repository with this code
- Domain (optional, for HTTPS)

## 1. Dokploy Setup

1. Create a GitHub App in Dokploy: **Git** → **GitHub** → **Install & Authorize**
2. Select your Bery repository
3. Create a new **Docker Compose** application
4. Connect the repo and set **Compose Path** to `docker-compose.yml`
5. Set **Branch** to `main` (or your default branch)

## 2. Environment Variables

In Dokploy, go to **Environment** and add:

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | 64 hex-char validator private key (`npm run gen-keys`) |
| `JWT_SECRET` | Yes | 32+ char secret for auth |
| `BOOTSTRAP_PEERS` | No | Comma-separated multiaddrs for non-first nodes |
| `FAUCET_ENABLED` | No | `true` to enable faucet |
| `FAUCET_TOKEN` | No | Secret token for faucet (if enabled) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins (e.g. `https://app.bery.in`) |
| `VITE_RPC_URL` | No | Full RPC URL for frontend (e.g. `https://your-domain.com/rpc`) – set if app and API use different origins |

## 3. Domain (HTTPS)

1. Add your domain in **Domains** tab (e.g. `app.bery.in`)
2. Point the A record to your VPS IP
3. Dokploy will add Traefik labels and obtain Let’s Encrypt certificates
4. The app will be served on port 8080 (API + frontend)

## 4. P2P Port

Port **3000** must stay open so other validator nodes can connect. Ensure your firewall allows TCP 3000.

## 5. Deploy

1. Click **Deploy**
2. Dokploy will clone the repo, build the image, and start the container
3. Future pushes to the configured branch will trigger redeployments

## 6. First Node vs. Additional Nodes

- **First node**: Leave `BOOTSTRAP_PEERS` empty.
- **Additional nodes**: Set `BOOTSTRAP_PEERS` to the first node’s multiaddr:
  ```
  /ip4/<FIRST_NODE_IP>/tcp/3000/p2p/<PEER_ID>
  ```
  You can read the peer ID from the first node’s logs or status.

## 7. Build Args (Optional)

If the frontend must call an RPC URL on another domain, set:

- **Build arg**: `VITE_RPC_URL` = `https://your-domain.com/rpc`

## Troubleshooting

- **Build fails**: Ensure `frontend/` and `src/` exist and are not excluded by `.dockerignore`
- **Network error**: Confirm `dokploy-network` exists (Dokploy usually creates it)
- **P2P not connecting**: Open port 3000 and use `LISTEN_ADDRESS=0.0.0.0` (default)
