// Bunny Family - Multiplayer Tamagotchi Game Server
// Complete backend implementation with Socket.io, game state management, and multiplayer logic

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Game state storage
const rooms = new Map();
const playerSockets = new Map();

// Game configuration
const GAME_CONFIG = {
    DECAY_RATES: {
        hunger: 1,      // Points lost every 5 seconds
        happiness: 0.5,
        energy: 0.3,
        cleanliness: 0.7
    },
    ACTION_EFFECTS: {
        feed: { hunger: 15, happiness: 5 },
        play: { happiness: 15, energy: -5 },
        sleep: { energy: 20, happiness: 2 },
        clean: { cleanliness: 20, happiness: 5 },
        pet: { happiness: 8, love: 3 }
    },
    GROWTH_THRESHOLDS: {
        newborn: 0,
        toddler: 100,
        young: 300,
        grown: 600
    },
    CARROT_HARVEST: {
        amount: 2,
        cooldown: 30000 // 30 seconds
    },
    BABY_NAMES: [
        'Cocoa', 'Snowball', 'Pepper', 'Sugar', 'Mocha', 'Vanilla',
        'Oreo', 'Marshmallow', 'Cinnamon', 'Pearl', 'Shadow', 'Cloud'
    ]
};

class GameRoom {
    constructor(roomCode) {
        this.roomCode = roomCode;
        this.players = new Map(); // playerId -> playerData
        this.gameState = this.initializeGameState();
        this.lastUpdate = Date.now();
        this.gameLoop = null;
    }

    initializeGameState() {
        return {
            carrots: 5,
            babies: [
                {
                    id: 'baby1',
                    name: this.getRandomBabyName(),
                    stage: 'egg',
                    hunger: 80,
                    happiness: 80,
                    energy: 80,
                    cleanliness: 80,
                    love: 0,
                    growthPoints: 0,
                    hatchProgress: 0,
                    genetics: this.generateGenetics(),
                    birthTime: Date.now(),
                    sleeping: false,
                    lastFed: Date.now(),
                    lastPlayed: Date.now(),
                    lastCleaned: Date.now()
                }
            ],
            lastCarrotHarvest: 0,
            dayNightCycle: 'day',
            gameStartTime: Date.now()
        };
    }

    getRandomBabyName() {
        return GAME_CONFIG.BABY_NAMES[Math.floor(Math.random() * GAME_CONFIG.BABY_NAMES.length)];
    }

    generateGenetics() {
        const colors = ['black', 'white', 'gray', 'brown'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    addPlayer(playerId, socketId, playerType) {
        this.players.set(playerId, {
            id: playerId,
            socketId: socketId,
            type: playerType, // 'black' or 'white'
            connected: true,
            joinTime: Date.now()
        });

        // Start game loop when both players are connected
        if (this.players.size === 2 && !this.gameLoop) {
            this.startGameLoop();
        }
    }

    removePlayer(playerId) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).connected = false;
        }

        // Stop game loop if no players connected
        const connectedPlayers = Array.from(this.players.values()).filter(p => p.connected);
        if (connectedPlayers.length === 0 && this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }

    startGameLoop() {
        // Game loop runs every 5 seconds for need decay
        this.gameLoop = setInterval(() => {
            this.updateNeeds();
            this.checkGrowth();
            this.updateDayNightCycle();
            this.broadcastGameState();
        }, 5000);
    }

    updateNeeds() {
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') return;

            // Decay needs based on time and baby stage
            const decayMultiplier = this.getDecayMultiplier(baby.stage);
            
            baby.hunger = Math.max(0, baby.hunger - GAME_CONFIG.DECAY_RATES.hunger * decayMultiplier);
            baby.happiness = Math.max(0, baby.happiness - GAME_CONFIG.DECAY_RATES.happiness * decayMultiplier);
            baby.energy = Math.max(0, baby.energy - GAME_CONFIG.DECAY_RATES.energy * decayMultiplier);
            baby.cleanliness = Math.max(0, baby.cleanliness - GAME_CONFIG.DECAY_RATES.cleanliness * decayMultiplier);

            // Energy decreases slower when sleeping
            if (baby.sleeping) {
                baby.energy = Math.min(100, baby.energy + 2);
            }

            // Update growth points based on care quality
            const careScore = (baby.hunger + baby.happiness + baby.energy + baby.cleanliness) / 4;
            if (careScore > 60) {
                baby.growthPoints += Math.floor(careScore / 20);
            }
        });
    }

    getDecayMultiplier(stage) {
        switch (stage) {
            case 'newborn': return 1.5; // Needs more frequent care
            case 'toddler': return 1.2;
            case 'young': return 0.8;
            case 'grown': return 0.5;
            default: return 1;
        }
    }

    checkGrowth() {
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') return;

            const oldStage = baby.stage;
            
            if (baby.growthPoints >= GAME_CONFIG.GROWTH_THRESHOLDS.grown && baby.stage !== 'grown') {
                baby.stage = 'grown';
                this.celebrateGrowth(baby, oldStage);
            } else if (baby.growthPoints >= GAME_CONFIG.GROWTH_THRESHOLDS.young && baby.stage === 'toddler') {
                baby.stage = 'young';
            } else if (baby.growthPoints >= GAME_CONFIG.GROWTH_THRESHOLDS.toddler && baby.stage === 'newborn') {
                baby.stage = 'toddler';
            }
        });
    }

    celebrateGrowth(baby, oldStage) {
        // Send special growth celebration event
        this.broadcastEvent('baby_grew', {
            babyId: baby.id,
            oldStage: oldStage,
            newStage: baby.stage,
            message: `${baby.name} has grown into a ${baby.stage} bunny! 🎉`
        });
    }

    updateDayNightCycle() {
        const gameTime = (Date.now() - this.gameState.gameStartTime) / 1000; // seconds
        const cycleLength = 300; // 5 minute cycles
        this.gameState.dayNightCycle = (Math.floor(gameTime / cycleLength) % 2 === 0) ? 'day' : 'night';
    }

    // Game Actions
    feedBaby(playerId) {
        if (this.gameState.carrots <= 0) {
            return { success: false, message: 'No carrots left!' };
        }

        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Cannot feed an egg!' };
        }

        const effects = GAME_CONFIG.ACTION_EFFECTS.feed;
        baby.hunger = Math.min(100, baby.hunger + effects.hunger);
        baby.happiness = Math.min(100, baby.happiness + effects.happiness);
        baby.lastFed = Date.now();
        
        this.gameState.carrots--;

        this.broadcastAction('feed', playerId, baby.id);
        return { success: true };
    }

    playWithBaby(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Cannot play with an egg!' };
        }

        if (baby.energy < 20) {
            return { success: false, message: `${baby.name} is too tired to play!` };
        }

        const effects = GAME_CONFIG.ACTION_EFFECTS.play;
        baby.happiness = Math.min(100, baby.happiness + effects.happiness);
        baby.energy = Math.max(0, baby.energy + effects.energy);
        baby.lastPlayed = Date.now();

        this.broadcastAction('play', playerId, baby.id);
        return { success: true };
    }

    putBabyToSleep(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Eggs don\'t sleep!' };
        }

        baby.sleeping = !baby.sleeping;
        
        if (baby.sleeping) {
            const effects = GAME_CONFIG.ACTION_EFFECTS.sleep;
            baby.energy = Math.min(100, baby.energy + effects.energy);
            baby.happiness = Math.min(100, baby.happiness + effects.happiness);
        }

        this.broadcastAction('sleep', playerId, baby.id, { sleeping: baby.sleeping });
        return { success: true };
    }

    cleanBaby(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Eggs are naturally clean!' };
        }

        const effects = GAME_CONFIG.ACTION_EFFECTS.clean;
        baby.cleanliness = Math.min(100, baby.cleanliness + effects.cleanliness);
        baby.happiness = Math.min(100, baby.happiness + effects.happiness);
        baby.lastCleaned = Date.now();

        this.broadcastAction('clean', playerId, baby.id);
        return { success: true };
    }

    petBaby(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return this.tapEgg(playerId);
        }

        const effects = GAME_CONFIG.ACTION_EFFECTS.pet;
        baby.happiness = Math.min(100, baby.happiness + effects.happiness);
        baby.love = Math.min(100, baby.love + effects.love);

        this.broadcastAction('pet', playerId, baby.id);
        return { success: true };
    }

    tapEgg(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage !== 'egg') {
            return { success: false, message: 'Not an egg!' };
        }

        baby.hatchProgress = Math.min(100, baby.hatchProgress + 10);

        if (baby.hatchProgress >= 100) {
            // Hatch the egg!
            baby.stage = 'newborn';
            baby.hatchProgress = 0;
            baby.growthPoints = 0;

            this.broadcastEvent('egg_hatched', {
                babyId: baby.id,
                babyName: baby.name,
                genetics: baby.genetics
            });
        }

        this.broadcastAction('tap_egg', playerId, baby.id);
        return { success: true };
    }

    harvestCarrots(playerId) {
        const now = Date.now();
        const timeSinceLastHarvest = now - this.gameState.lastCarrotHarvest;

        if (timeSinceLastHarvest < GAME_CONFIG.CARROT_HARVEST.cooldown) {
            const remaining = Math.ceil((GAME_CONFIG.CARROT_HARVEST.cooldown - timeSinceLastHarvest) / 1000);
            return { success: false, message: `Garden needs ${remaining} seconds to grow more carrots!` };
        }

        this.gameState.carrots += GAME_CONFIG.CARROT_HARVEST.amount;
        this.gameState.lastCarrotHarvest = now;

        this.broadcastAction('harvest', playerId, 'garden');
        return { success: true };
    }

    // Communication methods
    broadcastGameState() {
        this.players.forEach(player => {
            if (player.connected) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    socket.emit('game_state_update', this.gameState);
                }
            }
        });
    }

    broadcastAction(action, playerId, targetId, data = {}) {
        this.players.forEach(player => {
            if (player.connected) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    socket.emit('player_action', {
                        action,
                        playerId,
                        targetId,
                        timestamp: Date.now(),
                        ...data
                    });
                }
            }
        });
    }

    broadcastEvent(eventType, data) {
        this.players.forEach(player => {
            if (player.connected) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    socket.emit('game_event', {
                        type: eventType,
                        timestamp: Date.now(),
                        ...data
                    });
                }
            }
        });
    }

    getConnectedPlayerCount() {
        return Array.from(this.players.values()).filter(p => p.connected).length;
    }

    isFull() {
        return this.players.size >= 2;
    }
}

// Room management functions
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function createRoom() {
    let roomCode;
    do {
        roomCode = generateRoomCode();
    } while (rooms.has(roomCode));

    const room = new GameRoom(roomCode);
    rooms.set(roomCode, room);
    return room;
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('create_room', () => {
        try {
            const room = createRoom();
            const playerId = generatePlayerId();
            const playerType = 'black'; // First player is black bunny

            room.addPlayer(playerId, socket.id, playerType);
            playerSockets.set(socket.id, { roomCode: room.roomCode, playerId });

            socket.join(room.roomCode);
            
            socket.emit('room_created', {
                roomCode: room.roomCode,
                playerId: playerId,
                playerType: playerType,
                gameState: room.gameState
            });

            console.log(`Room created: ${room.roomCode} by player: ${playerId}`);
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    socket.on('join_room', (data) => {
        try {
            const { roomCode } = data;
            
            if (!rooms.has(roomCode)) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            const room = rooms.get(roomCode);

            if (room.isFull()) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }

            const playerId = generatePlayerId();
            const playerType = 'white'; // Second player is white bunny

            room.addPlayer(playerId, socket.id, playerType);
            playerSockets.set(socket.id, { roomCode: room.roomCode, playerId });

            socket.join(room.roomCode);

            socket.emit('joined_room', {
                roomCode: room.roomCode,
                playerId: playerId,
                playerType: playerType,
                gameState: room.gameState
            });

            // Notify the other player
            socket.to(roomCode).emit('partner_connected');

            console.log(`Player ${playerId} joined room: ${roomCode}`);

            // Send initial game state to both players
            room.broadcastGameState();
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Game action handlers
    socket.on('feed_baby', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.feedBaby(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('play_with_baby', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.playWithBaby(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('sleep_baby', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.putBabyToSleep(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('clean_baby', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.cleanBaby(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('pet_baby', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.petBaby(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('hatch_egg', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.tapEgg(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('harvest_carrots', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = room.harvestCarrots(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    socket.on('decay_needs', () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        // Manual trigger for needs decay (backup for game loop)
        room.updateNeeds();
        room.checkGrowth();
        room.broadcastGameState();
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        const playerData = playerSockets.get(socket.id);
        if (playerData) {
            const room = rooms.get(playerData.roomCode);
            if (room) {
                room.removePlayer(playerData.playerId);
                
                // Clean up empty rooms after 5 minutes
                setTimeout(() => {
                    if (room.getConnectedPlayerCount() === 0) {
                        rooms.delete(playerData.roomCode);
                        console.log(`Room cleaned up: ${playerData.roomCode}`);
                    }
                }, 300000);
            }
            playerSockets.delete(socket.id);
        }
    });
});

// Serve frontend files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        rooms: rooms.size,
        players: playerSockets.size,
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🐰❤️ Bunny Family server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
});

// Clean up inactive rooms every hour
setInterval(() => {
    let cleanedCount = 0;
    rooms.forEach((room, roomCode) => {
        if (room.getConnectedPlayerCount() === 0) {
            rooms.delete(roomCode);
            cleanedCount++;
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive rooms`);
    }
}, 3600000); // 1 hour