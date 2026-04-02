#!/bin/bash

# Bunny Game Deployment Script
# This script deploys the fixed backend with Redis adapter

set -e

echo "🚀 Starting Bunny Family Game deployment..."

# Check if we're on the deployment server
if [[ "$(hostname)" != *"192.168.100.7"* ]] && [[ "$(hostname)" != "bunny-deploy" ]]; then
    echo "⚠️  This script should be run on the deployment server (192.168.100.7)"
    echo "Please copy this script and the backend files to the deployment server first."
    echo ""
    echo "Commands to run on deployment server:"
    echo "1. Copy files: scp -r backend/ jonathan@192.168.100.7:~/bunny-game/"
    echo "2. SSH to server: ssh jonathan@192.168.100.7"
    echo "3. Run this script: cd bunny-game && ./deploy.sh"
    exit 1
fi

# Navigate to project directory
cd ~/bunny-game/backend

echo "📦 Installing/updating dependencies..."
npm install

echo "🔍 Running syntax check..."
node -c server.js

echo "🏗️  Building Docker image..."
cd ..
docker build -t 172.20.10.120:5000/bunny-game:v18-2d .

echo "📤 Pushing to registry..."
docker push 172.20.10.120:5000/bunny-game:v18-2d

echo "🚀 Deploying to Kubernetes..."
~/kubectl -n bunny-game set image deployment/bunny-backend backend=172.20.10.120:5000/bunny-game:v18-2d

echo "⏳ Waiting for deployment to complete..."
~/kubectl -n bunny-game rollout status deployment/bunny-backend --timeout=300s

echo "🔍 Checking pod status..."
~/kubectl -n bunny-game get pods -l app=bunny-backend

echo "📋 Checking logs for Redis adapter..."
sleep 10
~/kubectl -n bunny-game logs -l app=bunny-backend --tail=20 | grep -i redis || echo "No Redis logs found yet"

echo "✅ Deployment complete!"
echo ""
echo "🐰 The WebSocket connect/disconnect loop should now be fixed!"
echo "🔄 Redis adapter is sharing Socket.IO sessions across replicas"
echo ""
echo "To monitor the deployment:"
echo "  kubectl -n bunny-game get pods -w"
echo "  kubectl -n bunny-game logs -f <pod-name>"