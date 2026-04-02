#!/bin/bash

# Bunny Game Resource Monitoring Script

export KUBECONFIG=/tmp/kubeconfig.yaml
KUBECTL=/usr/bin/kubectl

echo "🐰 Bunny Game Resource Monitor"
echo "================================"
echo ""

echo "📊 Cluster Nodes:"
$KUBECTL get nodes -o wide

echo ""
echo "🎯 Bunny Game Pods:"
$KUBECTL get pods -n bunny-game -o wide

echo ""
echo "📈 Resource Usage:"
$KUBECTL top nodes
echo ""
$KUBECTL top pods -n bunny-game

echo ""
echo "🔄 HPA Status:"
$KUBECTL get hpa -n bunny-game

echo ""
echo "🌐 Services & Endpoints:"
$KUBECTL get svc -n bunny-game
$KUBECTL get endpoints -n bunny-game

echo ""
echo "💾 Persistent Volumes:"
$KUBECTL get pvc -n bunny-game

echo ""
echo "⚡ Recent Events:"
$KUBECTL get events -n bunny-game --sort-by=.metadata.creationTimestamp | tail -10