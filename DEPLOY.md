# Deployment Instructions

## 1. Prerequisites
- Docker and Docker Compose installed on the remote server.
- SSH access to the server.

## 2. Deploying to Production Server
We have created a helper script to automate the deployment process.

**Server Details:**
- IP: `145.79.210.156`
- User: `u588690005`
- Port: `65002`

**Steps:**
1. Open PowerShell.
2. Run the deployment script:
   ```powershell
   .\scripts\deploy.ps1
   ```
3. Enter your SSH password when prompted (it may ask twice: once for upload, once for execution).

The script will:
1. Compress your project (excluding `node_modules`).
2. Upload it to `~/bery-chain` on the server.
3. Unzip and rebuild the Docker containers.

## 3. Manual Deployment
If you prefer to deploy manually:
1. Archive the project:
   ```bash
   tar -czf deploy.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .
   ```
2. Upload to server:
   ```bash
   scp -P 65002 deploy.tar.gz u588690005@145.79.210.156:~
   ```
3. SSH into server:
   ```bash
   ssh -p 65002 u588690005@145.79.210.156
   ```
4. Run commands on server:
   ```bash
   mkdir -p ~/bery-chain
   mv deploy.tar.gz ~/bery-chain/
   cd ~/bery-chain
   tar -xzf deploy.tar.gz
   docker-compose up -d --build
   ```

## 4. Troubleshooting
- **Permission Denied**: Ensure your user has permissions to write to the directory and run docker.
- **Ports Occupied**: Check if ports 80, 8080, or 3000 are already in use.
