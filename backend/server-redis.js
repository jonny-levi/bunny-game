// Bunny Family - Redis-enabled Multiplayer Tamagotchi Game Server
// Production version with Redis persistence and improved scaling

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const Redis = require('redis');
const WishSystem = require('./wishSystem');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Redis Configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_AUTH_TOKEN || undefined,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
};

console.log('Redis Config:', { ...redisConfig, password: redisConfig.password ? '[HIDDEN]' : 'none' });

// Create Redis client
const redis = Redis.createClient(redisConfig);

redis.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

redis.on('ready', () => {
    console.log('Redis client ready');
});

// Connect to Redis
redis.connect().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory storage (with Redis backup)
const rooms = new Map();
const playerSockets = new Map();
const wishSystem = new WishSystem();
// Simple per-action rate-limit tracker shared by wish events (stand-in for the
// GameValidator map used in server.js — this redis server is a thinner shell).
const wishRateLimits = new Map(); // key: `${playerId}:${action}` -> [timestamps]

// Game configuration
const GAME_CONFIG = {
    DECAY_RATES: {
        hunger: 1,
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
        cooldown: 30000
    }
};

// Redis Helper Functions
async function saveGameState(roomCode, gameState) {
    try {
        await redis.setEx(`room:${roomCode}`, 3600, JSON.stringify(gameState));
        console.log(`Game state saved for room ${roomCode}`);
    } catch (error) {
        console.error('Error saving game state:', error);
    }
}

async function loadGameState(roomCode) {
    try {
        const stateData = await redis.get(`room:${roomCode}`);
        if (stateData) {
            console.log(`Game state loaded for room ${roomCode}`);
            return JSON.parse(stateData);
        }
    } catch (error) {
        console.error('Error loading game state:', error);
    }
    return null;
}

async function deleteGameState(roomCode) {
    try {
        await redis.del(`room:${roomCode}`);
        console.log(`Game state deleted for room ${roomCode}`);
    } catch (error) {
        console.error('Error deleting game state:', error);
    }
}

async function savePlayerConnection(roomCode, playerId, socketId, playerType) {
    try {
        const playerData = {
            playerId,
            socketId,
            playerType,
            connected: true,
            lastSeen: Date.now()
        };
        await redis.hSet(`room:${roomCode}:players`, playerId, JSON.stringify(playerData));
    } catch (error) {
        console.error('Error saving player connection:', error);
    }
}

class GameRoom {
    constructor(roomCode, existingState = null) {
        this.roomCode = roomCode;
        this.players = new Map();
        this.gameState = existingState || this.initializeGameState();
        this.lastUpdate = Date.now();
        this.gameLoop = null;
        this.saveInterval = null;
        
        // Start periodic saves
        this.startPeriodicSave();
    }

    initializeGameState() {
        return {
            carrots: 5,
            gems: 0,
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
            gameStartTime: Date.now(),
            totalPlayTime: 0,
            coupleStats: {
                wishesHidden: 0,
                wishesDiscovered: 0,
                wishJarsOpened: 0
            },
            // NEW V4: Whispered Wishes / Wish Jar
            wishSystem: WishSystem.defaultState(),
            version: '1.0.0'
        };
    }

    getRandomBabyName() {
        const names = ['Cocoa', 'Snowball', 'Pepper', 'Sugar', 'Mocha', 'Vanilla'];
        return names[Math.floor(Math.random() * names.length)];
    }

    generateGenetics() {
        const colors = ['black', 'white', 'gray', 'brown'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    startPeriodicSave() {
        // Save game state every 30 seconds
        this.saveInterval = setInterval(async () => {
            await saveGameState(this.roomCode, this.gameState);
        }, 30000);
    }

    async addPlayer(playerId, socketId, playerType) {
        const existing = this.players.get(playerId);
        if (existing) {
            // V4.1 (B-2): reconnecting player — refresh socket binding and
            // re-emit wish_jar_ready so the overlay re-renders.
            existing.socketId = socketId;
            existing.connected = true;
            const ws = this.gameState && this.gameState.wishSystem;
            if (ws && ws.currentJar && ws.currentJar.expiresAt > Date.now()) {
                const sock = io.sockets.sockets.get(socketId);
                if (sock) {
                    try {
                        sock.emit('wish_jar_ready', {
                            jarId: ws.currentJar.jarId,
                            expiresAt: ws.currentJar.expiresAt
                        });
                    } catch (_e) { /* ignore stale */ }
                }
            }
        } else {
            this.players.set(playerId, {
                id: playerId,
                socketId: socketId,
                type: playerType,
                connected: true,
                joinTime: Date.now()
            });
        }

        // Save to Redis
        await savePlayerConnection(this.roomCode, playerId, socketId, playerType);

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
            
            // Clear save interval
            if (this.saveInterval) {
                clearInterval(this.saveInterval);
                this.saveInterval = null;
            }
        }
    }

    startGameLoop() {
        this.gameLoop = setInterval(() => {
            this.updateNeeds();
            this.checkGrowth();
            this.updateDayNightCycle();
            // V4.1 (B-8): mirror server.js decay-loop wiring so wishes/jars
            // actually expire in the redis-backed path.
            this.expireWishesAndNotify();
            this.broadcastGameState();
        }, 5000);
    }

    // V4.1 (B-8): registered players helper for the redis path.
    getRegisteredPlayerIds() {
        return Array.from(this.players.keys());
    }

    // V4.1 (B-8, B-7): expire aged wishes + jar, notify authors, spawn a
    // fresh jar if the 24h condition just flipped true. Mirrors the
    // behaviour in server.js.
    expireWishesAndNotify() {
        try {
            const registered = this.getRegisteredPlayerIds();
            const { expiredJarId, expiredWishes } = wishSystem.expireWishes(this.gameState);
            if (expiredJarId) {
                broadcastToRoom(this, 'wish_jar_expired', { jarId: expiredJarId });
            }
            if (Array.isArray(expiredWishes)) {
                for (const e of expiredWishes) {
                    if (!e || !e.authorId) continue;
                    emitToPlayerInRoom(this, e.authorId, 'wish_expired', { wishId: e.wishId });
                }
            }
            if (registered.length >= 2) {
                const newJar = wishSystem.maybeSpawnJar(this.gameState, registered);
                if (newJar) {
                    broadcastToRoom(this, 'wish_jar_ready', {
                        jarId: newJar.jarId,
                        expiresAt: newJar.expiresAt
                    });
                }
            }
        } catch (err) {
            console.error('expireWishesAndNotify error:', err);
        }
    }

    updateNeeds() {
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') return;

            const decayMultiplier = this.getDecayMultiplier(baby.stage);
            
            baby.hunger = Math.max(0, baby.hunger - GAME_CONFIG.DECAY_RATES.hunger * decayMultiplier);
            baby.happiness = Math.max(0, baby.happiness - GAME_CONFIG.DECAY_RATES.happiness * decayMultiplier);
            baby.energy = Math.max(0, baby.energy - GAME_CONFIG.DECAY_RATES.energy * decayMultiplier);
            baby.cleanliness = Math.max(0, baby.cleanliness - GAME_CONFIG.DECAY_RATES.cleanliness * decayMultiplier);

            if (baby.sleeping) {
                baby.energy = Math.min(100, baby.energy + 2);
            }

            const careScore = (baby.hunger + baby.happiness + baby.energy + baby.cleanliness) / 4;
            if (careScore > 60) {
                baby.growthPoints += Math.floor(careScore / 20);
            }
        });

        // Update total play time
        this.gameState.totalPlayTime += 5000;
    }

    getDecayMultiplier(stage) {
        switch (stage) {
            case 'newborn': return 1.5;
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
        this.broadcastEvent('baby_grew', {
            babyId: baby.id,
            oldStage: oldStage,
            newStage: baby.stage,
            message: `${baby.name} has grown into a ${baby.stage} bunny! 🎉`
        });
    }

    updateDayNightCycle() {
        const gameTime = (Date.now() - this.gameState.gameStartTime) / 1000;
        const cycleLength = 300;
        this.gameState.dayNightCycle = (Math.floor(gameTime / cycleLength) % 2 === 0) ? 'day' : 'night';
    }

    // Game Actions (same as original but with async save)
    async feedBaby(playerId) {
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
        await saveGameState(this.roomCode, this.gameState);
        return { success: true };
    }

    // ... (other game action methods remain the same but with async saves)

    broadcastGameState() {
        // V4.1 (P0-1): per-recipient redaction. Never send another player's
        // wish plaintext in the broadcast frame.
        this.players.forEach((player, pid) => {
            if (player.connected) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    socket.emit('game_state_update', this._projectGameStateFor(pid));
                }
            }
        });
    }

    // V4.1 (P0-1): build a per-player copy of gameState. activeWishes is
    // reduced to the caller's own wish; other players' wishes and the
    // recentDiscoveries metadata are stripped from the broadcast payload.
    _projectGameStateFor(playerId) {
        const wsRaw = this.gameState.wishSystem || {};
        const ownWish = (wsRaw.activeWishes || {})[playerId] || null;
        return {
            ...this.gameState,
            wishSystem: {
                currentJar:          wsRaw.currentJar || null,
                jarCooldownUntil:    wsRaw.jarCooldownUntil || 0,
                wishJarsOpenedTotal: wsRaw.wishJarsOpenedTotal || 0,
                activeWishes:        ownWish ? { [playerId]: ownWish } : {}
            }
        };
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

    async cleanup() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
        }
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        await saveGameState(this.roomCode, this.gameState);
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

async function createRoom() {
    let roomCode;
    do {
        roomCode = generateRoomCode();
    } while (rooms.has(roomCode));

    const room = new GameRoom(roomCode);
    rooms.set(roomCode, room);
    return room;
}

async function getOrCreateRoom(roomCode) {
    if (rooms.has(roomCode)) {
        return rooms.get(roomCode);
    }

    // Try to load from Redis
    const existingState = await loadGameState(roomCode);
    if (existingState) {
        // NEW V4: normalize legacy saves that don't have a wishSystem block.
        existingState.wishSystem = WishSystem.sanitize(existingState.wishSystem);
        if (!existingState.coupleStats) existingState.coupleStats = {};
        const room = new GameRoom(roomCode, existingState);
        rooms.set(roomCode, room);
        return room;
    }

    return null;
}

// Registered-player check for V4 wish events — unknown/guest sockets fail.
function getRegisteredPlayerIds(room) {
    return Array.from(room.players.keys());
}

function broadcastToRoom(room, event, payload) {
    room.players.forEach(p => {
        if (p.connected) {
            const sock = io.sockets.sockets.get(p.socketId);
            if (sock) { try { sock.emit(event, payload); } catch (e) { /* stale */ } }
        }
    });
}

function emitToPlayerInRoom(room, playerId, event, payload) {
    const p = room.players.get(playerId);
    if (!p || !p.connected) return;
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) { try { sock.emit(event, payload); } catch (e) { /* stale */ } }
}

// Simple rolling-window rate limit for the wish events in this thin server.
function checkWishRateLimit(playerId, action, maxPerWindow, windowMs) {
    const key = `${playerId}:${action}`;
    const now = Date.now();
    const arr = (wishRateLimits.get(key) || []).filter(t => t > now - windowMs);
    if (arr.length >= maxPerWindow) return false;
    arr.push(now);
    wishRateLimits.set(key, arr);
    return true;
}

// Message sanitizer: strips HTML, control chars, bidi + zero-width unicode
// tricks, clamps to 140. V4.1 (P2-2, P2-4, B-4): reject oversize payloads
// up-front, strip the same unicode set server.js does, and reject (rather
// than silently truncate) messages longer than 140 chars after cleaning.
function sanitizeWishMessage(msg) {
    if (typeof msg !== 'string') return null;
    if (msg.length > 1000) return null; // fast-reject before regex work
    let out = msg
        .replace(/<[^>]*>/g, '')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
    try { out = out.normalize('NFC'); } catch (_e) { /* ignore */ }
    out = out.trim();
    if (out.length === 0) return null;
    if (out.length > 140) return null; // reject instead of clamp
    return out;
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Socket.io connection handling (simplified, main logic remains the same)
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('create_room', async () => {
        try {
            const room = await createRoom();
            const playerId = generatePlayerId();
            const playerType = 'black';

            await room.addPlayer(playerId, socket.id, playerType);
            playerSockets.set(socket.id, { roomCode: room.roomCode, playerId });

            socket.join(room.roomCode);
            
            // V4.1 (P0-1): per-player redacted projection so the initial
            // frame doesn't leak any partner wish plaintext.
            socket.emit('room_created', {
                roomCode: room.roomCode,
                playerId: playerId,
                playerType: playerType,
                gameState: room._projectGameStateFor(playerId)
            });

            console.log(`Room created: ${room.roomCode} by player: ${playerId}`);
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('error', { message: 'Failed to create room' });
        }
    });

    socket.on('join_room', async (data) => {
        try {
            const { roomCode } = data;
            
            let room = await getOrCreateRoom(roomCode);
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }

            if (room.isFull()) {
                socket.emit('error', { message: 'Room is full' });
                return;
            }

            const playerId = generatePlayerId();
            const playerType = 'white';

            await room.addPlayer(playerId, socket.id, playerType);
            playerSockets.set(socket.id, { roomCode: room.roomCode, playerId });

            socket.join(room.roomCode);

            // V4.1 (P0-1): per-player redacted projection so the initial
            // frame doesn't leak any partner wish plaintext.
            socket.emit('joined_room', {
                roomCode: room.roomCode,
                playerId: playerId,
                playerType: playerType,
                gameState: room._projectGameStateFor(playerId)
            });

            socket.to(roomCode).emit('partner_connected');
            console.log(`Player ${playerId} joined room: ${roomCode}`);
            room.broadcastGameState();
        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Game action handlers (same as original)
    socket.on('feed_baby', async () => {
        const playerData = playerSockets.get(socket.id);
        if (!playerData) return;

        const room = rooms.get(playerData.roomCode);
        if (!room) return;

        const result = await room.feedBaby(playerData.playerId);
        if (result.success) {
            room.broadcastGameState();
        } else {
            socket.emit('action_failed', result);
        }
    });

    // ... (other game action handlers)

    // === V4: Whispered Wishes / Wish Jar ===

    socket.on('hide_wish', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const registered = getRegisteredPlayerIds(room);
            if (!registered.includes(playerData.playerId)) {
                socket.emit('action_failed', { message: 'Only room members can hide wishes' });
                return;
            }

            // 1 per 60s per player
            if (!checkWishRateLimit(playerData.playerId, 'hide_wish', 1, 60000)) {
                socket.emit('action_failed', { message: 'Please wait before hiding another wish' });
                return;
            }

            if (!WishSystem.VALID_SPOT_IDS.includes(data.spotId)) {
                socket.emit('action_failed', { message: 'Invalid hiding spot' });
                return;
            }

            const cleaned = sanitizeWishMessage(data.message);
            if (!cleaned) {
                socket.emit('action_failed', { message: 'Invalid wish message' });
                return;
            }

            const result = wishSystem.hideWish(room.gameState, playerData.playerId, data.spotId, cleaned, registered);
            if (!result.success) {
                socket.emit('action_failed', { message: result.message || 'Could not hide wish' });
                return;
            }

            socket.emit('wish_hidden', {
                wishId: result.wishId,
                spotId: result.spotId,
                expiresAt: result.expiresAt
            });

            if (!room.gameState.coupleStats) room.gameState.coupleStats = {};
            room.gameState.coupleStats.wishesHidden = (room.gameState.coupleStats.wishesHidden || 0) + 1;

            await saveGameState(room.roomCode, room.gameState);
        } catch (error) {
            console.error('hide_wish error:', error);
            socket.emit('action_failed', { message: 'Failed to hide wish' });
        }
    });

    socket.on('get_my_wishes', (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            const room = rooms.get(playerData.roomCode);
            if (!room) return;
            const registered = getRegisteredPlayerIds(room);
            if (!registered.includes(playerData.playerId)) return;
            const result = wishSystem.getMyWishes(room.gameState, playerData.playerId, registered);
            socket.emit('my_wishes', { wishes: result.wishes });
        } catch (error) {
            console.error('get_my_wishes error:', error);
        }
    });

    socket.on('cancel_wish', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            const room = rooms.get(playerData.roomCode);
            if (!room) return;
            const registered = getRegisteredPlayerIds(room);
            if (!registered.includes(playerData.playerId)) {
                socket.emit('action_failed', { message: 'Only room members can cancel wishes' });
                return;
            }
            const result = wishSystem.cancelWish(room.gameState, playerData.playerId, registered);
            if (result.success) {
                socket.emit('wish_cancelled', { wishId: result.wishId });
                await saveGameState(room.roomCode, room.gameState);
            } else {
                socket.emit('action_failed', { message: 'No active wish to cancel' });
            }
        } catch (error) {
            console.error('cancel_wish error:', error);
        }
    });

    socket.on('attempt_wish_discovery', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            const room = rooms.get(playerData.roomCode);
            if (!room) return;
            const registered = getRegisteredPlayerIds(room);
            if (!registered.includes(playerData.playerId)) return;

            // 20 per 10s
            if (!checkWishRateLimit(playerData.playerId, 'attempt_wish_discovery', 20, 10000)) return;

            if (!WishSystem.VALID_SPOT_IDS.includes(data.spotId)) return;
            const validTriggers = ['feed', 'play', 'pet', 'clean', 'harvest', 'water', 'sleep', 'cave_enter', 'cave_exit'];
            if (!validTriggers.includes(data.triggerAction)) return;

            const result = wishSystem.tryDiscoverAt(room.gameState, playerData.playerId, data.spotId, data.triggerAction, registered);
            if (!result.success || !result.discovered) return;

            const authorPlayer = room.players.get(result.wish.authorId);
            const fromPlayerName = authorPlayer && authorPlayer.name ? authorPlayer.name : 'Partner';

            const rewardLoveTokens = 1;
            if (typeof room.gameState.gems !== 'number') room.gameState.gems = 0;
            room.gameState.gems += rewardLoveTokens * 2;

            if (!room.gameState.coupleStats) room.gameState.coupleStats = {};
            room.gameState.coupleStats.wishesDiscovered = (room.gameState.coupleStats.wishesDiscovered || 0) + 1;

            socket.emit('wish_discovered', {
                wishId:  result.wish.wishId,
                message: result.wish.message,
                fromPlayerName,
                spotId:  result.wish.spotId,
                rewardLoveTokens
            });

            emitToPlayerInRoom(room, result.wish.authorId, 'wish_author_notified', {
                wishId: result.wish.wishId,
                spotId: result.wish.spotId
            });

            const newJar = wishSystem.maybeSpawnJar(room.gameState, registered);
            if (newJar) {
                broadcastToRoom(room, 'wish_jar_ready', {
                    jarId: newJar.jarId,
                    expiresAt: newJar.expiresAt
                });
            }

            room.broadcastGameState();
            await saveGameState(room.roomCode, room.gameState);
        } catch (error) {
            console.error('attempt_wish_discovery error:', error);
        }
    });

    socket.on('tap_wish_jar', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;
            const room = rooms.get(playerData.roomCode);
            if (!room) return;
            const registered = getRegisteredPlayerIds(room);
            if (!registered.includes(playerData.playerId)) {
                socket.emit('action_failed', { message: 'Only room members can tap the jar' });
                return;
            }

            // 1 per 1s
            if (!checkWishRateLimit(playerData.playerId, 'tap_wish_jar', 1, 1000)) return;

            // Spec §7.3 — ignore client-supplied data.timestamp; use server time.
            const result = wishSystem.registerTap(room.gameState, playerData.playerId, registered);
            if (!result.success) {
                if (result.code === 'no_jar') {
                    socket.emit('action_failed', { message: 'No active wish jar' });
                }
                return;
            }

            if (result.status === 'waiting') {
                broadcastToRoom(room, 'wish_jar_tapped', {
                    jarId: result.jarId,
                    tappedBy: result.tappedBy
                });
                return;
            }
            // V4.1 (B-9): emit wish_jar_tapped for the resolving 2nd tap too.
            if (result.status === 'opened' || result.status === 'failed') {
                broadcastToRoom(room, 'wish_jar_tapped', {
                    jarId: result.jarId,
                    tappedBy: playerData.playerId
                });
            }
            if (result.status === 'expired') {
                broadcastToRoom(room, 'wish_jar_expired', { jarId: result.jarId });
                return;
            }
            if (result.status === 'failed') {
                broadcastToRoom(room, 'wish_jar_failed', {
                    reason: result.reason,
                    cooldownEndsAt: result.cooldownEndsAt
                });
                await saveGameState(room.roomCode, room.gameState);
                return;
            }
            if (result.status === 'opened') {
                if (typeof room.gameState.gems !== 'number') room.gameState.gems = 0;
                room.gameState.gems += result.rewards.gems || 0;
                if (!room.gameState.coupleStats) room.gameState.coupleStats = {};
                room.gameState.coupleStats.wishJarsOpened = (room.gameState.coupleStats.wishJarsOpened || 0) + 1;

                broadcastToRoom(room, 'wish_jar_opened', {
                    rewards: result.rewards,
                    memoryId: `jar_${result.jarId}`
                });
                room.broadcastGameState();
                await saveGameState(room.roomCode, room.gameState);
            }
        } catch (error) {
            console.error('tap_wish_jar error:', error);
            socket.emit('action_failed', { message: 'Tap failed' });
        }
    });

    socket.on('disconnect', async () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        const playerData = playerSockets.get(socket.id);
        if (playerData) {
            const room = rooms.get(playerData.roomCode);
            if (room) {
                room.removePlayer(playerData.playerId);
                
                // Clean up empty rooms after 5 minutes
                setTimeout(async () => {
                    if (room.getConnectedPlayerCount() === 0) {
                        await room.cleanup();
                        rooms.delete(playerData.roomCode);
                        await deleteGameState(playerData.roomCode);
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
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        rooms: rooms.size,
        players: playerSockets.size,
        uptime: process.uptime(),
        redis: 'disconnected'
    };

    try {
        await redis.ping();
        health.redis = 'connected';
    } catch (error) {
        health.redis = 'error';
        health.status = 'degraded';
    }

    res.json(health);
});

// Graceful shutdown
async function gracefulShutdown() {
    console.log('Shutting down server...');
    
    // Save all room states
    for (const [roomCode, room] of rooms) {
        await room.cleanup();
    }
    
    // Close Redis connection
    await redis.disconnect();
    
    server.close(() => {
        console.log('Server shut down');
        process.exit(0);
    });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🐰❤️ Bunny Family server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Redis: ${redisConfig.host}:${redisConfig.port}`);
});

// Clean up inactive rooms every hour
setInterval(async () => {
    let cleanedCount = 0;
    for (const [roomCode, room] of rooms) {
        if (room.getConnectedPlayerCount() === 0) {
            await room.cleanup();
            rooms.delete(roomCode);
            await deleteGameState(roomCode);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive rooms`);
    }
}, 3600000);