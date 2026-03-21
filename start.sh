#!/bin/bash

echo "🐰❤️ Starting Bunny Family - Cooperative Tamagotchi Game..."
echo ""

# Change to backend directory
cd backend

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Starting Bunny Family server on port 3000..."
echo "Game will be available at: http://localhost:3000"
echo ""
echo "📱 Perfect for couples to play together on their phones!"
echo "💕 Share the family code with your partner to start raising bunny babies!"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
node server.js