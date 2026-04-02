#!/bin/bash

# Bunny Game Optimized Deployment Script
# This applies all the optimized Kubernetes manifests

set -e

echo "🐰 Deploying Optimized Bunny Game..."

# Set kubeconfig
export KUBECONFIG=/tmp/kubeconfig.yaml
KUBECTL=/usr/bin/kubectl

echo "📋 Checking cluster connectivity..."
$KUBECTL cluster-info

echo "🗂️  Creating namespace if it doesn't exist..."
$KUBECTL create namespace bunny-game --dry-run=client -o yaml | $KUBECTL apply -f -

echo "💾 Applying Persistent Volume Claims..."
$KUBECTL apply -f postgres-pvc.yaml
$KUBECTL apply -f redis-pvc.yaml

echo "⏳ Waiting for PVCs to be bound..."
$KUBECTL wait --for=condition=Bound pvc/bunny-postgres-pvc -n bunny-game --timeout=60s
$KUBECTL wait --for=condition=Bound pvc/bunny-redis-pvc -n bunny-game --timeout=60s

echo "🗄️  Deploying Database services..."
$KUBECTL apply -f postgres-deployment.yaml
$KUBECTL apply -f postgres-service.yaml
$KUBECTL apply -f redis-deployment.yaml
$KUBECTL apply -f redis-service.yaml

echo "⏳ Waiting for database pods to be ready..."
$KUBECTL wait --for=condition=available --timeout=300s deployment/bunny-postgres -n bunny-game
$KUBECTL wait --for=condition=available --timeout=300s deployment/bunny-redis -n bunny-game

echo "🚀 Deploying Application services..."
$KUBECTL apply -f backend-deployment.yaml
$KUBECTL apply -f backend-service.yaml
$KUBECTL apply -f frontend-deployment.yaml
$KUBECTL apply -f frontend-service.yaml

echo "⏳ Waiting for application pods to be ready..."
$KUBECTL wait --for=condition=available --timeout=300s deployment/bunny-backend -n bunny-game
$KUBECTL wait --for=condition=available --timeout=300s deployment/bunny-frontend -n bunny-game

echo "📈 Applying HPA (Horizontal Pod Autoscalers)..."
$KUBECTL apply -f backend-hpa.yaml
$KUBECTL apply -f frontend-hpa.yaml

echo "✅ Deployment completed successfully!"
echo ""
echo "📊 Current status:"
$KUBECTL get all -n bunny-game
echo ""
echo "🔗 Frontend URL: http://172.20.10.114"
echo "📈 Monitor HPA with: kubectl get hpa -n bunny-game -w"