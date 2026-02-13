$User = "u588690005"
$Server = "145.79.210.156"
$Port = "65002"
$RemotePath = "~/bery-chain"

Write-Host "1. Creating deployment archive (excluding node_modules)..."
tar -czf deploy.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=frontend/node_modules --exclude=frontend/dist --exclude=data .

Write-Host "2. Uploading archive to $Server (You may be asked for password)..."
scp -P $Port deploy.tar.gz ${User}@${Server}:deploy.tar.gz

Write-Host "3. Executing remote deployment commands (You may be asked for password again)..."
$RemoteCommands = "
    mkdir -p $RemotePath
    mv deploy.tar.gz $RemotePath/
    cd $RemotePath
    tar -xzf deploy.tar.gz
    rm deploy.tar.gz
    
    # Check for docker compose (v2) or docker-compose (v1)
    if command -v docker-compose &> /dev/null; then
        docker-compose down
        docker-compose up -d --build
    else
        docker compose down
        docker compose up -d --build
    fi
"

ssh -p $Port ${User}@${Server} $RemoteCommands

Write-Host "4. Cleaning up local archive..."
Remove-Item deploy.tar.gz

Write-Host "Deployment script finished."
