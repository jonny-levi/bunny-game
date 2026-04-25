// Bunny Family - Multiplayer Tamagotchi Game Server
// Enhanced backend implementation with persistence, validation, and improved error handling

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

// Import real implementations
const GameStateManager = require('./gameState');
const { GameValidator, ValidationError } = require('./validation');
const DailyRewardManager = require('./dailyRewards');
const AchievementManager = require('./achievements');
const MemoryManager = require('./memoryManager');
const CustomizationManager = require('./customization');

const app = express();
const server = http.createServer(app);

// Secure CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:3000', 'http://127.0.0.1:3000'];

const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    // Additional security options
    allowEIO3: false,
    transports: ['websocket', 'polling']
});

// CRITICAL FIX: Add Redis adapter to share Socket.IO sessions across replicas
// This fixes the WebSocket connect/disconnect loop when behind a load balancer
async function setupRedisAdapter() {
    try {
        console.log('🔄 Setting up Redis adapter for Socket.IO...');
        
        // Create Redis clients for pub/sub
        const pubClient = createClient({ 
            url: 'redis://bunny-redis:6379',
            socket: {
                reconnectDelay: 1000,
                connectTimeout: 5000,
                commandTimeout: 5000
            }
        });
        const subClient = pubClient.duplicate();

        // Handle Redis connection errors
        pubClient.on('error', (err) => {
            console.error('Redis pub client error:', err);
        });
        subClient.on('error', (err) => {
            console.error('Redis sub client error:', err);
        });

        pubClient.on('connect', () => {
            console.log('✅ Redis pub client connected');
        });
        subClient.on('connect', () => {
            console.log('✅ Redis sub client connected');
        });

        // Connect to Redis
        await pubClient.connect();
        await subClient.connect();

        // Create and set the adapter
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Redis adapter configured - sessions now shared across replicas');
        
        return { pubClient, subClient };
    } catch (error) {
        console.error('❌ Failed to setup Redis adapter:', error);
        console.log('⚠️ Continuing without Redis adapter - may cause issues with multiple replicas');
        return null;
    }
}

// Initialize Redis adapter (non-blocking)
let redisClients = null;
setupRedisAdapter().then((clients) => {
    redisClients = clients;
}).catch((error) => {
    console.error('Redis adapter setup failed:', error);
});

// Connection limiting
const connectionsByIP = new Map();
const MAX_CONNECTIONS_PER_IP = 10;
const MAX_TOTAL_CONNECTIONS = 1000;

// Security headers middleware
const nonce = crypto.randomBytes(16).toString('base64');
app.use((req, res, next) => {
    req.nonce = nonce;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // FIX: Remove unsafe-inline from CSP header, use nonce instead
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:;`);
    next();
});

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Game state storage
const rooms = new Map();
const playerSockets = new Map();
const rateLimits = new Map();
const movementThrottles = new Map(); // Special throttling for movement updates
const gameStateManager = new GameStateManager();

// FIX: Rate limit memory leak prevention - track cleanup intervals
let cleanupIntervals = [];
const addCleanupInterval = (interval) => {
    cleanupIntervals.push(interval);
};
const clearAllCleanupIntervals = () => {
    cleanupIntervals.forEach(interval => clearInterval(interval));
    cleanupIntervals = [];
};

// New feature managers
const dailyRewardManager = new DailyRewardManager();
const achievementManager = new AchievementManager();
const memoryManager = new MemoryManager();
const customizationManager = new CustomizationManager();

// Enhanced game configuration
const GAME_CONFIG = {
    DECAY_RATES: {
        hunger: 0.8,      // Points lost every update cycle (more balanced)
        happiness: 0.4,
        energy: 0.6,
        cleanliness: 0.5,
        love: 0.1         // Love decays very slowly
    },
    ACTION_EFFECTS: {
        feed: { hunger: 20, happiness: 8, energy: 2 },
        play: { happiness: 18, energy: -8, love: 2 },
        sleep: { energy: 25, happiness: 5, hunger: -3 },
        clean: { cleanliness: 25, happiness: 10, love: 1 },
        pet: { happiness: 12, love: 5, energy: 1 }
    },
    GROWTH_THRESHOLDS: {
        newborn: 0,
        toddler: 150,     // Increased for more balanced progression
        young: 400,
        grown: 800
    },
    CARROT_HARVEST: {
        baseAmount: 2,
        bonusAmount: 1,   // Bonus based on garden care
        cooldown: 45000   // 45 seconds (more balanced)
    },
    DAY_NIGHT_CYCLE: {
        dayLength: 600,   // 10 minutes (more reasonable)
        nightLength: 400  // 6.67 minutes
    },
    HATCH_CONFIG: {
        baseProgress: 8,  // Base progress per tap
        bonusProgress: 4, // Bonus for cooperative tapping
        maxProgress: 100
    },
    MAX_BABIES: 4,        // Support up to 4 babies
    AUTO_SAVE_INTERVAL: 30000, // Auto-save every 30 seconds
    GAME_LOOP_INTERVAL: 8000,  // Game loop every 8 seconds
    BABY_NAMES: [
        'Cocoa', 'Snowball', 'Pepper', 'Sugar', 'Mocha', 'Vanilla',
        'Oreo', 'Marshmallow', 'Cinnamon', 'Pearl', 'Shadow', 'Cloud',
        'Honey', 'Storm', 'Dusty', 'Smokey', 'Cream', 'Patches',
        'Buttons', 'Mittens', 'Whiskers', 'Snuggles', 'Bamboo', 'Poppy'
    ],
    GENETICS: {
        colors: ['black', 'white', 'gray', 'brown', 'cream', 'spotted'],
        traits: ['energetic', 'sleepy', 'playful', 'gentle', 'curious', 'cuddly']
    },
    PERSONALITY_TRAITS: {
        curious: { exploration: 1.2, sleep: 0.9, playfulness: 1.1, hungerRate: 1.0 },
        sleepy: { sleep: 1.3, activity: 0.8, mood_stability: 1.2, energyDecay: 1.1 },
        energetic: { playfulness: 1.3, hunger: 1.2, sleep: 0.8, energyDecay: 1.3 },
        social: { bonding: 1.2, separation_anxiety: 1.1, happiness: 1.1 },
        independent: { self_care: 1.2, bonding: 0.9, exploration: 1.1, hungerRate: 0.9 }
    },
    LOVE_LETTER_CONFIG: {
        maxLength: 100,
        historyLimit: 10,
        cooldown: 5000 // 5 seconds between messages
    },
    // NEW: Egg spawning system configuration
    EGG_SPAWNING: {
        triggerStage: 'newborn', // Once the first egg hatches, a new egg can appear after the cooldown
        cooldown: 300000, // 5 minutes between new eggs
        coupleCooldownMultiplier: 0.5, // Halved cooldown when both parents online
        cost: 10, // Carrot cost to "discover" new egg
        maxBabies: 4, // Maximum total babies allowed
        specialEggChance: 0.1, // 10% chance for special eggs
        specialEggs: {
            golden: { 
                chance: 0.06, // 6% of special eggs
                hatchSpeedMultiplier: 2.0,
                name: 'Golden Egg',
                description: 'Hatches twice as fast!'
            },
            twin: {
                chance: 0.03, // 3% of special eggs 
                twinChance: 1.0,
                name: 'Twin Egg',
                description: 'Contains two babies!'
            },
            rainbow: {
                chance: 0.01, // 1% of special eggs
                rareGenetics: true,
                name: 'Rainbow Egg',
                description: 'Rare genetics inside!'
            }
        }
    },
    // NEW: Baby growth and aging system
    GROWTH_SYSTEM: {
        stages: ['egg', 'newborn', 'baby', 'toddler', 'child'],
        baseGrowthTime: 600000, // 10 minutes per stage with active care
        neglectedGrowthTime: 1200000, // 20 minutes if neglected
        careThreshold: 60, // Average care level needed for fast growth
        growthPointsPerStage: 100 // Points needed to advance to next stage
    },
    // NEW: Shop system configuration
    SHOP: {
        items: {
            toy_ball: { 
                name: 'Bouncy Ball', 
                cost: 5, 
                effect: { happiness: 10 },
                type: 'consumable',
                description: 'A fun ball that boosts happiness when used!'
            },
            soft_blanket: {
                name: 'Soft Blanket',
                cost: 8,
                effect: { energy: 15, sleep_efficiency: 1.2 },
                type: 'consumable', 
                description: 'Helps bunnies sleep better and recover energy.'
            },
            carrot_treat: {
                name: 'Premium Carrot Treat',
                cost: 3,
                effect: { hunger: 15, happiness: 5 },
                type: 'consumable',
                description: 'Delicious treat that satisfies hunger and brings joy.'
            },
            decorative_plant: {
                name: 'Decorative Plant',
                cost: 12,
                effect: { happiness_passive: 2 },
                type: 'decoration',
                description: 'Beautiful plant that provides ongoing happiness.'
            },
            night_light: {
                name: 'Soothing Night Light',
                cost: 15,
                effect: { sleep_quality: 1.3, fear_reduction: 10 },
                type: 'decoration',
                description: 'Helps bunnies sleep peacefully through the night.'
            }
        }
    }
};

class GameRoom {
    constructor(roomCode, savedState = null) {
        this.roomCode = roomCode;
        this.players = new Map(); // playerId -> playerData
        this.gameState = savedState ? this.loadSavedGameState(savedState) : this.initializeGameState();
        this.lastUpdate = Date.now();
        this.gameLoop = null;
        this.actionQueue = [];
        this.lastSave = Date.now();
        this.intervals = []; // Track all intervals for proper cleanup
        
        // Load saved players if available
        if (savedState && savedState.players) {
            savedState.players.forEach(playerData => {
                this.players.set(playerData.id, {
                    ...playerData,
                    socketId: null, // Will be set when player reconnects
                    connected: false
                });
            });
        }
    }

    initializeGameState() {
        return {
            carrots: 8,
            babies: [
                {
                    id: 'baby1',
                    name: this.getRandomBabyName(),
                    stage: 'egg',
                    hunger: 85,
                    happiness: 85,
                    energy: 85,
                    cleanliness: 85,
                    love: 5,
                    growthPoints: 0,
                    hatchProgress: 0,
                    genetics: this.generateGenetics(),
                    birthTime: Date.now(),
                    sleeping: false,
                    lastFed: Date.now(),
                    lastPlayed: Date.now(),
                    lastCleaned: Date.now(),
                    cooperativeBonuses: {
                        feeding: 0,
                        playing: 0,
                        hatching: 0
                    },
                    // NEW: Position tracking for draggable bunnies
                    position: { x: 400, y: 300 },
                    targetPosition: { x: 400, y: 300 }
                }
            ],
            garden: {
                carrots: 8,
                quality: 50,
                lastHarvest: 0,
                waterLevel: 100,
                lastWatered: Date.now()
            },
            dayNightCycle: 'day',
            cycleStartTime: Date.now(),
            gameStartTime: Date.now(),
            cooperativeActions: 0,
            totalActions: 0,
            // NEW: Love letter/message system
            loveLetters: [],
            // NEW: Couple stats tracking
            coupleStats: {
                feedsTogether: 0,
                totalPlayTime: 0, // minutes
                connectionStartTime: Date.now(),
                actionsPerPlayer: {},
                lastTogetherFeed: 0,
                playTimeStarted: Date.now()
            },
            // NEW: Egg spawning system
            eggSpawning: {
                lastNewEggTime: 0,
                discoveredEggs: [], // Eggs waiting to be discovered
                totalEggsSpawned: 1 // Start with 1 (the initial egg)
            },
            // NEW: Shop system
            shop: {
                inventory: {}, // playerId -> { itemId -> quantity }
                purchaseHistory: [] // Track purchase history
            },
            // NEW: Growth system tracking
            growthSystem: {
                stageTransitions: [], // History of stage changes
                lastGrowthCheck: Date.now()
            }
        };
    }

    loadSavedGameState(savedState) {
        try {
            // Validate and restore game state
            GameValidator.validateGameState(savedState.gameState);
            
            const gameState = { ...savedState.gameState };
            
            // Update timestamps to current time to prevent issues
            const now = Date.now();
            gameState.babies.forEach(baby => {
                if (!baby.lastFed) baby.lastFed = now;
                if (!baby.lastPlayed) baby.lastPlayed = now;
                if (!baby.lastCleaned) baby.lastCleaned = now;
                if (!baby.cooperativeBonuses) {
                    baby.cooperativeBonuses = { feeding: 0, playing: 0, hatching: 0 };
                }
            });
            
            // Ensure garden exists
            if (!gameState.garden) {
                gameState.garden = {
                    carrots: gameState.carrots || 8,
                    quality: 50,
                    lastHarvest: gameState.lastCarrotHarvest || 0,
                    waterLevel: 100,
                    lastWatered: now
                };
            }

            // NEW: Ensure new features exist in loaded state
            if (!gameState.loveLetters) {
                gameState.loveLetters = [];
            }

            if (!gameState.coupleStats) {
                gameState.coupleStats = {
                    feedsTogether: 0,
                    totalPlayTime: 0,
                    actionsPerPlayer: {},
                    lastTogetherFeed: 0,
                    playTimeStarted: now
                };
            }

            // NEW: Initialize egg spawning system for legacy saves
            if (!gameState.eggSpawning) {
                gameState.eggSpawning = {
                    lastNewEggTime: 0,
                    discoveredEggs: [],
                    totalEggsSpawned: gameState.babies.length // Count existing babies
                };
            }

            // NEW: Initialize shop system for legacy saves
            if (!gameState.shop) {
                gameState.shop = {
                    inventory: {},
                    purchaseHistory: []
                };
            }

            // NEW: Initialize growth system for legacy saves
            if (!gameState.growthSystem) {
                gameState.growthSystem = {
                    stageTransitions: [],
                    lastGrowthCheck: now
                };
            }

            // NEW: Ensure babies have position data and validate personality
            gameState.babies.forEach(baby => {
                if (!baby.position) {
                    baby.position = { x: 400, y: 300 };
                }
                if (!baby.targetPosition) {
                    baby.targetPosition = { x: 400, y: 300 };
                }
                
                // Add personality if missing (for legacy saves)
                if (!baby.genetics?.personality) {
                    if (baby.genetics) {
                        baby.genetics.personality = this.generatePersonality();
                    }
                } else {
                    // Validate existing personality data
                    baby.genetics.personality = this.validatePersonality(baby.genetics.personality);
                }
                
                // Ensure moveSequence exists for position sync
                if (!baby.moveSequence) {
                    baby.moveSequence = 0;
                }
            });
            
            // Migrate old fields
            if (gameState.lastCarrotHarvest && !gameState.garden.lastHarvest) {
                gameState.garden.lastHarvest = gameState.lastCarrotHarvest;
                delete gameState.lastCarrotHarvest;
            }
            
            return gameState;
        } catch (error) {
            console.warn(`Failed to load saved state for room ${this.roomCode}: ${error.message}`);
            console.warn('Initializing with default state instead');
            return this.initializeGameState();
        }
    }

    getRandomBabyName() {
        return GAME_CONFIG.BABY_NAMES[Math.floor(Math.random() * GAME_CONFIG.BABY_NAMES.length)];
    }

    generateGenetics() {
        // FIX: Add genetics validation to ensure data format is correct
        const genetics = {
            color: GAME_CONFIG.GENETICS.colors[Math.floor(Math.random() * GAME_CONFIG.GENETICS.colors.length)],
            trait: GAME_CONFIG.GENETICS.traits[Math.floor(Math.random() * GAME_CONFIG.GENETICS.traits.length)],
            parentInfluence: Math.random() < 0.5 ? 'black' : 'white', // Which parent bunny they favor
            personality: this.generatePersonality() // NEW: Baby personality system
        };
        
        // Validate generated genetics
        if (!GAME_CONFIG.GENETICS.colors.includes(genetics.color)) {
            genetics.color = GAME_CONFIG.GENETICS.colors[0]; // fallback
        }
        if (!GAME_CONFIG.GENETICS.traits.includes(genetics.trait)) {
            genetics.trait = GAME_CONFIG.GENETICS.traits[0]; // fallback
        }
        if (!['black', 'white'].includes(genetics.parentInfluence)) {
            genetics.parentInfluence = 'black'; // fallback
        }
        
        return genetics;
    }

    // NEW: Generate random personality traits for baby bunnies with validation
    generatePersonality() {
        const availableTraits = Object.keys(GAME_CONFIG.PERSONALITY_TRAITS);
        
        // Validate that we have available traits
        if (availableTraits.length === 0) {
            console.error('No personality traits available in configuration');
            return this.getDefaultPersonality();
        }
        
        const primaryTrait = availableTraits[Math.floor(Math.random() * availableTraits.length)];
        
        // Validate primary trait exists in config
        if (!GAME_CONFIG.PERSONALITY_TRAITS[primaryTrait]) {
            console.error(`Invalid primary trait generated: ${primaryTrait}`);
            return this.getDefaultPersonality();
        }
        
        // 70% chance for a secondary trait
        let secondaryTrait = null;
        if (Math.random() < 0.7) {
            const remaining = availableTraits.filter(t => t !== primaryTrait);
            if (remaining.length > 0) {
                secondaryTrait = remaining[Math.floor(Math.random() * remaining.length)];
                
                // Validate secondary trait
                if (!GAME_CONFIG.PERSONALITY_TRAITS[secondaryTrait]) {
                    console.error(`Invalid secondary trait generated: ${secondaryTrait}`);
                    secondaryTrait = null;
                }
            }
        }
        
        const personality = {
            primary: primaryTrait,
            secondary: secondaryTrait,
            strength: Math.max(0.5, Math.min(1.5, Math.random() * 0.5 + 0.75)) // Clamped 0.5-1.5
        };
        
        return this.validatePersonality(personality);
    }

    // Helper method to get default personality if generation fails
    getDefaultPersonality() {
        return {
            primary: 'curious',
            secondary: null,
            strength: 1.0
        };
    }

    // Validate personality data integrity
    validatePersonality(personality) {
        if (!personality || typeof personality !== 'object') {
            console.warn('Invalid personality object, using default');
            return this.getDefaultPersonality();
        }
        
        // Validate primary trait
        if (!personality.primary || typeof personality.primary !== 'string') {
            console.warn('Invalid primary personality trait, using default');
            return this.getDefaultPersonality();
        }
        
        if (!GAME_CONFIG.PERSONALITY_TRAITS[personality.primary]) {
            console.warn(`Unknown primary personality trait: ${personality.primary}, using default`);
            return this.getDefaultPersonality();
        }
        
        // Validate secondary trait if present
        if (personality.secondary) {
            if (typeof personality.secondary !== 'string' || !GAME_CONFIG.PERSONALITY_TRAITS[personality.secondary]) {
                console.warn(`Invalid secondary personality trait: ${personality.secondary}, removing`);
                personality.secondary = null;
            }
        }
        
        // Validate strength
        if (typeof personality.strength !== 'number' || isNaN(personality.strength)) {
            console.warn('Invalid personality strength, using default');
            personality.strength = 1.0;
        }
        
        // Clamp strength to reasonable bounds
        personality.strength = Math.max(0.5, Math.min(1.5, personality.strength));
        
        return personality;
    }

    addPlayer(playerId, socketId, playerType, playerData = {}) {
        const existingPlayer = this.players.get(playerId);
        
        if (existingPlayer) {
            // Reconnecting player
            existingPlayer.socketId = socketId;
            existingPlayer.connected = true;
            console.log(`Player ${playerId} reconnected to room ${this.roomCode}`);
        } else {
            // New player
            this.players.set(playerId, {
                id: playerId,
                socketId: socketId,
                type: playerType, // 'black' or 'white'
                connected: true,
                joinTime: Date.now(),
                name: playerData.name || 'Player',
                bunnyColor: playerData.color || playerType,
                totalActions: 0,
                cooperativeActions: 0
            });
            console.log(`Player ${playerId} joined room ${this.roomCode} as ${playerType} bunny`);
        }

        // Start game loop when any players are connected
        if (this.getConnectedPlayerCount() > 0 && !this.gameLoop) {
            this.startGameLoop();
        }
    }

    removePlayer(playerId) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).connected = false;
        }

        // Stop game loop and clean up all intervals if no players connected
        const connectedPlayers = Array.from(this.players.values()).filter(p => p.connected);
        if (connectedPlayers.length === 0) {
            this.cleanup();
        }
    }

    // Clean up all intervals and timers for this room
    cleanup() {
        // Clear main game loop
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        // Clear all tracked intervals
        this.intervals.forEach(interval => {
            if (interval) {
                clearInterval(interval);
            }
        });
        this.intervals = [];
        
        // Clear action queue
        this.actionQueue = [];
        
        // FIX: Clear love letter history to prevent memory leak
        if (this.gameState.loveLetters) {
            this.gameState.loveLetters = [];
        }
        
        // Clear any other memory-consuming data structures
        if (this.gameState.shop) {
            this.gameState.shop.inventory = {};
        }
        
        console.log(`Room ${this.roomCode} cleaned up all intervals, timers, and memory`);
    }

    startGameLoop() {
        // FIX: Enhanced game loop with isolated error handling per function
        this.gameLoop = setInterval(() => {
            // Isolate each update function to prevent cascading failures
            const updateFunctions = [
                { name: 'updateNeeds', fn: () => this.updateNeeds() },
                { name: 'checkGrowth', fn: () => this.checkGrowth() },
                { name: 'checkEggSpawning', fn: () => this.checkEggSpawning() }, // NEW: Check for new egg spawning
                { name: 'checkBabyGrowth', fn: () => this.checkBabyGrowth() }, // NEW: Check baby growth/aging
                { name: 'updateDayNightCycle', fn: () => this.updateDayNightCycle() },
                { name: 'updateGarden', fn: () => this.updateGarden() },
                { name: 'processActionQueue', fn: () => this.processActionQueue() },
                { name: 'autoSaveIfNeeded', fn: () => this.autoSaveIfNeeded() },
                { name: 'broadcastCoupleStats', fn: () => this.broadcastCoupleStats() } // NEW: Periodic couple stats broadcast
            ];

            let successfulUpdates = 0;
            for (const update of updateFunctions) {
                try {
                    update.fn();
                    successfulUpdates++;
                } catch (error) {
                    console.error(`Game loop error in room ${this.roomCode} - ${update.name}:`, error);
                    // Log error but continue with other updates
                }
            }

            // Only broadcast if at least core updates succeeded
            if (successfulUpdates >= 3) {
                try {
                    this.broadcastGameState();
                } catch (error) {
                    console.error(`Failed to broadcast game state in room ${this.roomCode}:`, error);
                }
            }
        }, GAME_CONFIG.GAME_LOOP_INTERVAL);
        
        // Track interval for cleanup
        this.intervals.push(this.gameLoop);
        
        console.log(`Game loop started for room ${this.roomCode}`);
    }

    updateNeeds() {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdate;
        this.lastUpdate = now;
        
        // Time-based decay factor (normalize to per-second)
        const timeMultiplier = Math.min(timeSinceLastUpdate / 1000, 10); // Cap at 10 seconds
        
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') {
                // Eggs don't have needs but may auto-hatch over time
                if (now - baby.birthTime > 300000) { // 5 minutes
                    baby.hatchProgress = Math.min(100, baby.hatchProgress + 0.5);
                }
                return;
            }

            // Decay needs based on time, baby stage, genetics, and personality
            const decayMultiplier = this.getDecayMultiplier(baby.stage);
            const traitMultiplier = this.getTraitMultiplier(baby.genetics?.trait);
            const personalityMultiplier = this.getPersonalityMultiplier(baby.genetics?.personality);
            
            // FIX: Prevent integer overflow by clamping individual multipliers and total
            const safeDecayMultiplier = Math.max(0.1, Math.min(3.0, decayMultiplier || 1.0));
            const safeTraitMultiplier = Math.max(0.1, Math.min(3.0, traitMultiplier || 1.0));
            const safePersonalityMultiplier = Math.max(0.1, Math.min(3.0, personalityMultiplier || 1.0));
            const safeTimeMultiplier = Math.max(0.1, Math.min(10.0, timeMultiplier || 1.0));
            
            const totalMultiplier = Math.max(0.01, Math.min(20.0, 
                safeDecayMultiplier * safeTraitMultiplier * safePersonalityMultiplier * safeTimeMultiplier
            ));
            
            baby.hunger = Math.max(0, baby.hunger - GAME_CONFIG.DECAY_RATES.hunger * totalMultiplier);
            baby.happiness = Math.max(0, baby.happiness - GAME_CONFIG.DECAY_RATES.happiness * totalMultiplier);
            baby.energy = Math.max(0, baby.energy - GAME_CONFIG.DECAY_RATES.energy * totalMultiplier);
            baby.cleanliness = Math.max(0, baby.cleanliness - GAME_CONFIG.DECAY_RATES.cleanliness * totalMultiplier);
            baby.love = Math.max(0, baby.love - GAME_CONFIG.DECAY_RATES.love * totalMultiplier);

            // Special mechanics
            if (baby.sleeping) {
                // Sleeping restores energy and reduces hunger decay
                baby.energy = Math.min(100, baby.energy + 3 * timeMultiplier);
                baby.hunger = Math.max(0, baby.hunger - 0.3 * timeMultiplier); // Hunger increases while sleeping
                
                // Wake up if energy is full or if too hungry
                if (baby.energy >= 100 || baby.hunger < 20) {
                    baby.sleeping = false;
                }
            }

            // Cave bonuses
            if (baby.inCave) {
                // Bunnies in the cave get comfort bonuses
                baby.energy = Math.min(100, baby.energy + 5 * timeMultiplier);
                baby.happiness = Math.min(100, baby.happiness + 3 * timeMultiplier);
                // Reduced hunger in the cozy cave
                baby.hunger = Math.max(0, baby.hunger - 0.5 * timeMultiplier);
                console.log(`🏔️ Cave bonuses applied to ${baby.id}: energy +5, happiness +3`);
            }

            // Night effects
            if (this.gameState.dayNightCycle === 'night') {
                baby.energy = Math.max(0, baby.energy - 0.2 * timeMultiplier); // Get tired at night
                if (baby.energy < 30 && !baby.sleeping) {
                    baby.sleeping = true; // Auto-sleep when very tired at night
                }
            }

            // NEW: Apply personality-specific effects
            this.applyPersonalityEffects(baby, timeSinceLastUpdate);

            // Update growth points based on care quality
            const careScore = (baby.hunger + baby.happiness + baby.energy + baby.cleanliness) / 4;
            if (careScore > 50) {
                const growthBonus = Math.floor(careScore / 25) * timeMultiplier;
                baby.growthPoints += growthBonus;
                
                // Cooperative bonus
                if (this.getConnectedPlayerCount() === 2) {
                    baby.growthPoints += growthBonus * 0.2; // 20% bonus for cooperative care
                }
            }

            // Validate needs bounds
            baby.hunger = Math.max(0, Math.min(100, Math.round(baby.hunger)));
            baby.happiness = Math.max(0, Math.min(100, Math.round(baby.happiness)));
            baby.energy = Math.max(0, Math.min(100, Math.round(baby.energy)));
            baby.cleanliness = Math.max(0, Math.min(100, Math.round(baby.cleanliness)));
            baby.love = Math.max(0, Math.min(100, Math.round(baby.love)));
            baby.growthPoints = Math.max(0, Math.round(baby.growthPoints));
        });
    }

    getDecayMultiplier(stage) {
        switch (stage) {
            case 'newborn': return 1.4; // Needs frequent care but not overwhelming
            case 'toddler': return 1.1;
            case 'young': return 0.9;
            case 'grown': return 0.7; // Adults are more self-sufficient
            default: return 1;
        }
    }

    getTraitMultiplier(trait) {
        switch (trait) {
            case 'energetic': return 1.2; // Needs more food and play
            case 'sleepy': return 0.8; // Lower overall needs
            case 'playful': return 1.1; // Slightly higher happiness decay
            case 'gentle': return 0.9; // Lower needs overall
            case 'curious': return 1.0; // Balanced
            case 'cuddly': return 0.95; // Slightly lower needs when loved
            default: return 1;
        }
    }

    // NEW: Get personality-based stat decay multiplier
    getPersonalityMultiplier(personality) {
        if (!personality || !personality.primary) return 1.0;
        
        const primaryConfig = GAME_CONFIG.PERSONALITY_TRAITS[personality.primary];
        if (!primaryConfig) return 1.0;
        
        let multiplier = 1.0;
        const strength = personality.strength || 1.0;
        
        // Apply primary personality effects
        if (primaryConfig.hungerRate) {
            multiplier *= (1 + (primaryConfig.hungerRate - 1) * strength * 0.3);
        }
        if (primaryConfig.energyDecay) {
            multiplier *= (1 + (primaryConfig.energyDecay - 1) * strength * 0.2);
        }
        
        // Apply secondary personality effects (50% strength)
        if (personality.secondary) {
            const secondaryConfig = GAME_CONFIG.PERSONALITY_TRAITS[personality.secondary];
            if (secondaryConfig) {
                if (secondaryConfig.hungerRate) {
                    multiplier *= (1 + (secondaryConfig.hungerRate - 1) * strength * 0.15);
                }
                if (secondaryConfig.energyDecay) {
                    multiplier *= (1 + (secondaryConfig.energyDecay - 1) * strength * 0.1);
                }
            }
        }
        
        return Math.max(0.5, Math.min(2.0, multiplier)); // Clamp between 0.5x and 2x
    }

    // NEW: Apply personality-specific stat changes
    applyPersonalityEffects(baby, deltaTime) {
        if (!baby.genetics?.personality) return;
        
        const personality = baby.genetics.personality;
        const primaryConfig = GAME_CONFIG.PERSONALITY_TRAITS[personality.primary];
        if (!primaryConfig) return;
        
        const strength = personality.strength || 1.0;
        const timeMultiplier = deltaTime / 1000;
        
        // Curious bunnies lose energy faster from exploring
        if (personality.primary === 'curious') {
            baby.energy = Math.max(0, baby.energy - 0.3 * strength * timeMultiplier);
        }
        
        // Sleepy bunnies recover energy faster when sleeping
        if (personality.primary === 'sleepy' && baby.sleeping) {
            baby.energy = Math.min(100, baby.energy + 1.0 * strength * timeMultiplier);
        }
        
        // Energetic bunnies get hungry faster
        if (personality.primary === 'energetic') {
            baby.hunger = Math.max(0, baby.hunger - 0.4 * strength * timeMultiplier);
        }
        
        // Social bunnies are happier when both players are connected
        if (personality.primary === 'social' && this.getConnectedPlayerCount() === 2) {
            baby.happiness = Math.min(100, baby.happiness + 0.2 * strength * timeMultiplier);
        }
        
        // Independent bunnies maintain cleanliness better
        if (personality.primary === 'independent') {
            baby.cleanliness = Math.min(100, baby.cleanliness + 0.1 * strength * timeMultiplier);
        }
    }

    checkGrowth() {
        // FIX: Prevent growth stage skipping with proper sequential progression
        this.gameState.babies.forEach(async (baby) => {
            if (baby.stage === 'egg') return;

            const oldStage = baby.stage;
            let newStage = null;
            
            // Check growth progression sequentially to prevent skipping
            switch (baby.stage) {
                case 'newborn':
                    if (baby.growthPoints >= GAME_CONFIG.GROWTH_THRESHOLDS.toddler) {
                        newStage = 'toddler';
                    }
                    break;
                case 'toddler':
                    if (baby.growthPoints >= GAME_CONFIG.GROWTH_THRESHOLDS.young) {
                        newStage = 'young';
                    }
                    break;
                case 'young':
                    if (baby.growthPoints >= GAME_CONFIG.GROWTH_THRESHOLDS.grown) {
                        newStage = 'grown';
                    }
                    break;
                // 'grown' is final stage
            }

            if (newStage && newStage !== oldStage) {
                baby.stage = newStage;
                
                // Celebrate growth and record memory
                await this.celebrateGrowth(baby, oldStage);
                
                // Record growth memory
                const participants = Array.from(this.players.values())
                    .filter(p => p.connected)
                    .map(p => p.id);
                
                await memoryManager.recordGrowth(this.roomCode, baby, oldStage, newStage, participants);

                // Update player stats for achievements
                participants.forEach(async (playerId) => {
                    const player = this.players.get(playerId);
                    if (player) {
                        player.bunniesRaised = (player.bunniesRaised || 0) + (newStage === 'grown' ? 1 : 0);
                        
                        // Check growth achievements
                        if (newStage === 'grown') {
                            const result = await achievementManager.checkAndUpdateAchievements(playerId, 'event', { 
                                event: 'baby_grew', 
                                stage: 'grown' 
                            });
                            
                            if (result.newlyUnlocked.length > 0) {
                                this.broadcastAchievements(playerId, result.newlyUnlocked);
                            }
                        }
                    }
                });
            }
        });
    }

    async celebrateGrowth(baby, oldStage) {
        // Send special growth celebration event
        this.broadcastEvent('baby_grew', {
            babyId: baby.id,
            oldStage: oldStage,
            newStage: baby.stage,
            message: `${baby.name} has grown into a ${baby.stage} bunny! 🎉`
        });
    }

    // Helper method to broadcast achievement notifications
    broadcastAchievements(playerId, achievements) {
        achievements.forEach(achievement => {
            this.broadcastEvent('achievement_unlocked', {
                playerId,
                achievement,
                message: `🏆 Achievement unlocked: ${achievement.title}!`
            });
            
            // Record achievement memory
            memoryManager.recordAchievement(this.roomCode, achievement, playerId).catch(error => {
                console.error('Failed to record achievement memory:', error);
            });
        });
    }

    // Helper method to broadcast new features
    async broadcastDailyReward(playerId, rewardResult) {
        if (rewardResult.success) {
            this.broadcastEvent('daily_reward_claimed', {
                playerId,
                reward: rewardResult.reward,
                streak: rewardResult.streak,
                message: rewardResult.message
            });
        }
    }

    // Helper method to get partner player ID
    getPartnerPlayerId(currentPlayerId) {
        for (const [playerId, player] of this.players) {
            if (playerId !== currentPlayerId && player.connected) {
                return playerId;
            }
        }
        return null;
    }

    updateDayNightCycle() {
        const now = Date.now();
        const timeSinceCycleStart = now - this.gameState.cycleStartTime;
        const currentCycle = this.gameState.dayNightCycle;
        
        const cycleLength = currentCycle === 'day' ? 
            GAME_CONFIG.DAY_NIGHT_CYCLE.dayLength * 1000 : 
            GAME_CONFIG.DAY_NIGHT_CYCLE.nightLength * 1000;
        
        // FIX: Account for server downtime - if gap is too large, fast-forward cycles
        if (timeSinceCycleStart > cycleLength * 10) { // More than 10 cycles worth of time
            // Fast forward through missed cycles
            const missedCycles = Math.floor(timeSinceCycleStart / cycleLength);
            const newCycleType = missedCycles % 2 === 0 ? currentCycle : (currentCycle === 'day' ? 'night' : 'day');
            
            this.gameState.dayNightCycle = newCycleType;
            this.gameState.cycleStartTime = now - (timeSinceCycleStart % cycleLength);
            
            console.log(`Room ${this.roomCode}: Fast-forwarded ${missedCycles} cycles due to server downtime`);
        }
        
        const adjustedTimeSinceCycleStart = now - this.gameState.cycleStartTime;
        
        if (adjustedTimeSinceCycleStart >= cycleLength) {
            const newCycle = currentCycle === 'day' ? 'night' : 'day';
            this.gameState.dayNightCycle = newCycle;
            this.gameState.cycleStartTime = now;
            
            // Broadcast cycle change
            this.broadcastEvent('cycle_changed', {
                newCycle,
                message: newCycle === 'day' ? 
                    '🌅 The sun rises! Your bunnies feel more energetic.' :
                    '🌙 Night falls. Time for your bunnies to rest.'
            });
            
            console.log(`Room ${this.roomCode}: ${currentCycle} -> ${newCycle}`);
        }
    }

    updateGarden() {
        const now = Date.now();
        const garden = this.gameState.garden;
        
        // Water level decreases over time
        // FIX: Garden water going negative - clamp to 0
        const timeSinceWatered = now - garden.lastWatered;
        const waterDecay = Math.floor(timeSinceWatered / (60 * 1000)) * 2; // 2% per minute
        garden.waterLevel = Math.max(0, Math.min(100, garden.waterLevel - waterDecay));
        garden.lastWatered = now; // Update last watered time to prevent excessive decay
        
        // Garden quality improves with water and time
        if (garden.waterLevel > 30) {
            garden.quality = Math.min(100, garden.quality + 0.1);
        } else {
            garden.quality = Math.max(0, garden.quality - 0.5);
        }
        
        // Auto-water rain during some night cycles (10% chance)
        if (this.gameState.dayNightCycle === 'night' && Math.random() < 0.001) { // Very rare
            garden.waterLevel = Math.min(100, garden.waterLevel + 30);
            garden.lastWatered = now;
            this.broadcastEvent('weather', {
                type: 'rain',
                message: '🌧️ It\'s raining! The garden gets watered naturally.'
            });
        }
    }

    processActionQueue() {
        // Process any queued actions (for future use)
        while (this.actionQueue.length > 0) {
            const action = this.actionQueue.shift();
            try {
                this.executeQueuedAction(action);
            } catch (error) {
                console.error(`Failed to process queued action in room ${this.roomCode}:`, error);
            }
        }
    }

    executeQueuedAction(action) {
        // Implementation for delayed actions (future feature)
        console.log(`Executing queued action: ${action.type} in room ${this.roomCode}`);
    }

    autoSaveIfNeeded() {
        const now = Date.now();
        const timeSinceLastSave = now - this.lastSave;
        
        if (timeSinceLastSave >= GAME_CONFIG.AUTO_SAVE_INTERVAL && this.getConnectedPlayerCount() > 0) {
            this.saveGameState();
            this.lastSave = now;
        }
    }

    async saveGameState() {
        try {
            await gameStateManager.saveRoomState(this.roomCode, this.gameState, this.players);
            console.log(`Game state saved for room ${this.roomCode}`);
        } catch (error) {
            console.error(`Failed to save game state for room ${this.roomCode}:`, error);
        }
    }

    // Enhanced Game Actions with validation, cooperative mechanics, and new features
    async feedBaby(playerId, babyId = 'baby1') {
        try {
            GameValidator.validatePlayerId(playerId);
            GameValidator.validateBabyId(babyId);
            
            // FIX: Add proper validation checks for empty arrays
            if (!this.gameState.babies || this.gameState.babies.length === 0) {
                return { success: false, message: 'No babies found!' };
            }

            if (this.gameState.garden.carrots <= 0) {
                return { success: false, message: 'No carrots left! Harvest some from the garden.' };
            }

            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found!' };
            }
            
            if (baby.stage === 'egg') {
                return { success: false, message: 'Cannot feed an egg!' };
            }
            
            if (baby.hunger > 90) {
                return { success: false, message: `${baby.name} is not hungry right now.` };
            }

            const effects = { ...GAME_CONFIG.ACTION_EFFECTS.feed };
            const now = Date.now();
            const isNight = this.gameState.dayNightCycle === 'night';
            let cooperativeBonus = false;
            
            // Cooperative bonus: if fed by both players recently (within 30 seconds)
            // FIX: Add minimum timing window to prevent exploitation
            const recentFeeding = now - baby.lastFed < 30000;
            const minimumGap = now - baby.lastFed > 3000; // Minimum 3 seconds gap
            const lastFeeder = baby.lastFeedPlayerId;
            
            if (recentFeeding && minimumGap && lastFeeder && lastFeeder !== playerId && this.getConnectedPlayerCount() === 2) {
                effects.hunger += 5;
                effects.happiness += 3;
                baby.cooperativeBonuses.feeding++;
                this.gameState.cooperativeActions++;
                cooperativeBonus = true;
                
                this.broadcastEvent('cooperative_bonus', {
                    action: 'feed',
                    babyId: baby.id,
                    message: `Great teamwork! ${baby.name} loves being fed by both parents! 💕`
                });

                // Record cooperative memory
                await memoryManager.recordCooperativeAction(this.roomCode, 'feed', [lastFeeder, playerId], [baby.id]);
            }
            
            // Apply trait modifiers
            if (baby.genetics?.trait === 'energetic') {
                effects.hunger += 3;
                effects.energy += 2;
            }

            baby.hunger = Math.min(100, baby.hunger + effects.hunger);
            baby.happiness = Math.min(100, baby.happiness + effects.happiness);
            baby.energy = Math.min(100, baby.energy + (effects.energy || 0));
            baby.lastFed = now;
            baby.lastFeedPlayerId = playerId;
            
            this.gameState.garden.carrots--;
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('feed', playerId);
            
            // Track player stats and achievements
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
                player.feedCount = (player.feedCount || 0) + 1;

                // Check achievements (async but don't wait)
                achievementManager.updateForAction(playerId, 'feed', isNight).then(result => {
                    if (result.newlyUnlocked.length > 0) {
                        this.broadcastAchievements(playerId, result.newlyUnlocked);
                    }
                }).catch(error => {
                    console.error('Achievement update failed:', error);
                });

                // Check first time feeding
                if (player.feedCount === 1) {
                    memoryManager.recordFirstTime(this.roomCode, 'feed', [playerId], [baby.id]);
                }
            }

            // Check for love milestones
            if (baby.happiness >= 100 && baby.love >= 25 && baby.love % 25 === 0) {
                await memoryManager.recordLoveMilestone(this.roomCode, baby, baby.love, [playerId]);
            }

            this.broadcastAction('feed', playerId, baby.id, { effects, cooperativeBonus });
            return { success: true };
        } catch (error) {
            console.error(`Feed baby error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to feed baby. Please try again.' };
        }
    }

    playWithBaby(playerId, babyId = 'baby1') {
        try {
            GameValidator.validatePlayerId(playerId);
            GameValidator.validateBabyId(babyId);
            
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found!' };
            }
            
            if (baby.stage === 'egg') {
                return { success: false, message: 'Cannot play with an egg!' };
            }

            if (baby.energy < 15) {
                return { success: false, message: `${baby.name} is too tired to play!` };
            }
            
            if (baby.sleeping) {
                return { success: false, message: `${baby.name} is sleeping! 😴` };
            }

            const effects = { ...GAME_CONFIG.ACTION_EFFECTS.play };
            const now = Date.now();
            
            // Cooperative bonus: if played with by both players recently
            // FIX: Add minimum timing window to prevent exploitation
            const recentPlay = now - baby.lastPlayed < 45000;
            const minimumGap = now - baby.lastPlayed > 3000; // Minimum 3 seconds gap
            const lastPlayer = baby.lastPlayPlayerId;
            
            if (recentPlay && minimumGap && lastPlayer && lastPlayer !== playerId && this.getConnectedPlayerCount() === 2) {
                effects.happiness += 5;
                effects.love += 3;
                baby.cooperativeBonuses.playing++;
                this.gameState.cooperativeActions++;
                
                this.broadcastEvent('cooperative_bonus', {
                    action: 'play',
                    babyId: baby.id,
                    message: `${baby.name} is having so much fun playing with both parents! 🎉`
                });
            }
            
            // Trait bonuses
            if (baby.genetics?.trait === 'playful') {
                effects.happiness += 3;
                effects.energy -= 2; // Playful bunnies use less energy
            }

            baby.happiness = Math.min(100, baby.happiness + effects.happiness);
            baby.energy = Math.max(0, baby.energy + effects.energy);
            baby.love = Math.min(100, baby.love + (effects.love || 0));
            baby.lastPlayed = now;
            baby.lastPlayPlayerId = playerId;
            
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('play', playerId);
            
            // Track player stats
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
            }

            this.broadcastAction('play', playerId, baby.id, { effects });
            return { success: true };
        } catch (error) {
            console.error(`Play with baby error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to play with baby. Please try again.' };
        }
    }

    putBabyToSleep(playerId, babyId = 'baby1') {
        try {
            GameValidator.validatePlayerId(playerId);
            GameValidator.validateBabyId(babyId);
            
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found!' };
            }
            
            if (baby.stage === 'egg') {
                return { success: false, message: 'Eggs don\'t need sleep!' };
            }

            const wasSleeping = baby.sleeping;
            baby.sleeping = !baby.sleeping;
            
            if (baby.sleeping) {
                const effects = { ...GAME_CONFIG.ACTION_EFFECTS.sleep };
                
                // Sleepy trait bonus
                if (baby.genetics?.trait === 'sleepy') {
                    effects.energy += 5;
                    effects.happiness += 2;
                }
                
                baby.energy = Math.min(100, baby.energy + effects.energy);
                baby.happiness = Math.min(100, baby.happiness + effects.happiness);
                baby.hunger = Math.max(0, baby.hunger + effects.hunger);
                
                this.broadcastAction('sleep', playerId, baby.id, { 
                    sleeping: true, 
                    effects,
                    message: `${baby.name} is now sleeping peacefully 😴`
                });
            } else {
                this.broadcastAction('sleep', playerId, baby.id, { 
                    sleeping: false,
                    message: `${baby.name} woke up! 😊`
                });
            }
            
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('sleep', playerId);
            
            // Track player stats
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
            }

            return { success: true };
        } catch (error) {
            console.error(`Sleep baby error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to change sleep state. Please try again.' };
        }
    }

    cleanBaby(playerId, babyId = 'baby1') {
        try {
            GameValidator.validatePlayerId(playerId);
            GameValidator.validateBabyId(babyId);
            
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found!' };
            }
            
            if (baby.stage === 'egg') {
                return { success: false, message: 'Eggs are naturally clean!' };
            }
            
            if (baby.cleanliness > 85) {
                return { success: false, message: `${baby.name} is already very clean!` };
            }

            const effects = { ...GAME_CONFIG.ACTION_EFFECTS.clean };
            
            // Gentle trait gets extra happiness from cleaning
            if (baby.genetics?.trait === 'gentle') {
                effects.happiness += 3;
                effects.love += 2;
            }
            
            baby.cleanliness = Math.min(100, baby.cleanliness + effects.cleanliness);
            baby.happiness = Math.min(100, baby.happiness + effects.happiness);
            baby.love = Math.min(100, baby.love + (effects.love || 0));
            baby.lastCleaned = Date.now();
            
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('clean', playerId);
            
            // Track player stats
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
            }

            this.broadcastAction('clean', playerId, baby.id, { effects });
            return { success: true };
        } catch (error) {
            console.error(`Clean baby error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to clean baby. Please try again.' };
        }
    }

    petBaby(playerId, babyId = 'baby1') {
        try {
            GameValidator.validatePlayerId(playerId);
            GameValidator.validateBabyId(babyId);
            
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found!' };
            }
            
            if (baby.stage === 'egg') {
                return this.tapEgg(playerId, babyId);
            }

            const effects = { ...GAME_CONFIG.ACTION_EFFECTS.pet };
            
            // Cuddly trait gets extra benefits from petting
            if (baby.genetics?.trait === 'cuddly') {
                effects.happiness += 4;
                effects.love += 2;
                effects.energy += 1;
            }
            
            baby.happiness = Math.min(100, baby.happiness + effects.happiness);
            baby.love = Math.min(100, baby.love + effects.love);
            baby.energy = Math.min(100, baby.energy + (effects.energy || 0));
            
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('pet', playerId);
            
            // Track player stats
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
            }

            this.broadcastAction('pet', playerId, baby.id, { effects });
            return { success: true };
        } catch (error) {
            console.error(`Pet baby error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to pet baby. Please try again.' };
        }
    }

    async tapEgg(playerId, babyId = 'baby1') {
        try {
            GameValidator.validatePlayerId(playerId);
            GameValidator.validateBabyId(babyId);
            
            // FIX: Add proper validation for empty baby arrays
            if (!this.gameState.babies || this.gameState.babies.length === 0) {
                return { success: false, message: 'No babies found!' };
            }
            
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found!' };
            }
            
            if (baby.stage !== 'egg') {
                return { success: false, message: 'Not an egg!' };
            }

            let progress = GAME_CONFIG.HATCH_CONFIG.baseProgress;
            const now = Date.now();
            let cooperativeBonus = false;
            
            // Cooperative hatching bonus
            // FIX: Add minimum timing window to prevent exploitation
            const recentTap = now - (baby.lastHatchTap || 0) < 10000; // 10 seconds
            const minimumGap = now - (baby.lastHatchTap || 0) > 1000; // Minimum 1 second gap
            const lastTapper = baby.lastHatchTapperId;
            
            if (recentTap && minimumGap && lastTapper && lastTapper !== playerId && this.getConnectedPlayerCount() === 2) {
                progress += GAME_CONFIG.HATCH_CONFIG.bonusProgress;
                baby.cooperativeBonuses.hatching++;
                this.gameState.cooperativeActions++;
                cooperativeBonus = true;
                
                this.broadcastEvent('cooperative_bonus', {
                    action: 'hatch',
                    babyId: baby.id,
                    message: `Both parents are helping the egg hatch! 🥚✨`
                });

                // Record cooperative memory
                await memoryManager.recordCooperativeAction(this.roomCode, 'hatch', [lastTapper, playerId], [baby.id]);
            }

            baby.hatchProgress = Math.min(GAME_CONFIG.HATCH_CONFIG.maxProgress, baby.hatchProgress + progress);
            baby.lastHatchTap = now;
            baby.lastHatchTapperId = playerId;

            if (baby.hatchProgress >= GAME_CONFIG.HATCH_CONFIG.maxProgress) {
                // Hatch the egg!
                baby.stage = 'newborn';
                baby.hatchProgress = 0;
                baby.growthPoints = 0;
                baby.hunger = 90;
                baby.happiness = 90;
                baby.energy = 85;
                baby.cleanliness = 100;
                baby.love = 10;

                this.broadcastEvent('egg_hatched', {
                    babyId: baby.id,
                    babyName: baby.name,
                    genetics: baby.genetics,
                    cooperativeHatch: baby.cooperativeBonuses.hatching > 0,
                    message: `🎉 ${baby.name} has hatched into a beautiful ${baby.genetics.color} ${baby.genetics.trait} bunny!`
                });

                // Record birth memory
                const participants = Array.from(this.players.values())
                    .filter(p => p.connected)
                    .map(p => p.id);
                await memoryManager.recordBirth(this.roomCode, baby, participants);

                // Update achievements for hatching
                participants.forEach(async (pId) => {
                    const player = this.players.get(pId);
                    if (player) {
                        player.eggsHatched = (player.eggsHatched || 0) + 1;
                        
                        const result = await achievementManager.checkAndUpdateAchievements(pId, 'event', { 
                            event: 'egg_hatched' 
                        });
                        
                        if (result.newlyUnlocked.length > 0) {
                            this.broadcastAchievements(pId, result.newlyUnlocked);
                        }
                    }
                });
            }
            
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('hatch', playerId);
            
            // Track player stats and achievements
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
                
                // Check cooperative achievements if bonus occurred
                if (cooperativeBonus) {
                    const result = await achievementManager.checkAndUpdateAchievements(playerId, 'cooperative_bonus');
                    if (result.newlyUnlocked.length > 0) {
                        this.broadcastAchievements(playerId, result.newlyUnlocked);
                    }
                }
            }

            this.broadcastAction('hatch_egg', playerId, baby.id, { 
                progress: baby.hatchProgress,
                progressGain: progress,
                cooperativeBonus
            });
            return { success: true };
        } catch (error) {
            console.error(`Tap egg error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to tap egg. Please try again.' };
        }
    }

    harvestCarrots(playerId) {
        try {
            GameValidator.validatePlayerId(playerId);
            
            const now = Date.now();
            const garden = this.gameState.garden;
            const timeSinceLastHarvest = now - garden.lastHarvest;

            if (timeSinceLastHarvest < GAME_CONFIG.CARROT_HARVEST.cooldown) {
                const remaining = Math.ceil((GAME_CONFIG.CARROT_HARVEST.cooldown - timeSinceLastHarvest) / 1000);
                return { success: false, message: `Garden needs ${remaining} seconds to grow more carrots!` };
            }

            let harvestAmount = GAME_CONFIG.CARROT_HARVEST.baseAmount;
            
            // Quality bonus
            if (garden.quality > 70) {
                harvestAmount += GAME_CONFIG.CARROT_HARVEST.bonusAmount;
            }
            
            // Water bonus
            if (garden.waterLevel > 50) {
                harvestAmount += 1;
            }
            
            // Cooperative bonus: if both players harvest within same cycle
            // FIX: Add minimum timing window to prevent exploitation
            const recentHarvest = now - garden.lastHarvest < 60000; // 1 minute
            const minimumGap = now - garden.lastHarvest > 5000; // Minimum 5 seconds gap
            const lastHarvester = garden.lastHarvesterId;
            
            if (recentHarvest && minimumGap && lastHarvester && lastHarvester !== playerId && this.getConnectedPlayerCount() === 2) {
                harvestAmount += 1;
                this.gameState.cooperativeActions++;
                
                this.broadcastEvent('cooperative_bonus', {
                    action: 'harvest',
                    message: `Great teamwork in the garden! Extra carrots harvested! 🥕✨`
                });
            }
            
            garden.carrots += harvestAmount;
            garden.lastHarvest = now;
            garden.lastHarvesterId = playerId;
            
            // Reduce garden quality slightly after harvest
            garden.quality = Math.max(20, garden.quality - 5);
            
            this.gameState.totalActions++;
            
            // NEW: Update couple stats
            this.updateCoupleStats('harvest', playerId);
            
            // Track player stats
            const player = this.players.get(playerId);
            if (player) {
                player.totalActions = (player.totalActions || 0) + 1;
            }

            this.broadcastAction('harvest', playerId, 'garden', { 
                amount: harvestAmount,
                totalCarrots: garden.carrots,
                gardenQuality: garden.quality
            });
            return { success: true, amount: harvestAmount };
        } catch (error) {
            console.error(`Harvest carrots error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to harvest carrots. Please try again.' };
        }
    }

    // Communication methods
    broadcastGameState() {
        // NEW: Enhance game state with personality info and positions
        const enhancedGameState = {
            ...this.gameState,
            babies: this.gameState.babies.map(baby => ({
                ...baby,
                personalityInfo: baby.genetics?.personality ? {
                    primary: baby.genetics.personality.primary,
                    secondary: baby.genetics.personality.secondary,
                    strength: baby.genetics.personality.strength,
                    traits: this.getPersonalityTraitNames(baby.genetics.personality)
                } : null,
                position: baby.position || { x: 400, y: 300 },
                targetPosition: baby.targetPosition || { x: 400, y: 300 }
            }))
        };

        this.players.forEach(player => {
            if (player.connected) {
                const socket = io.sockets.sockets.get(player.socketId);
                if (socket) {
                    socket.emit('game_state_update', enhancedGameState);
                }
            }
        });
    }

    // NEW: Get human-readable personality trait names
    getPersonalityTraitNames(personality) {
        const traitNames = [];
        
        if (personality.primary) {
            traitNames.push(personality.primary);
        }
        
        if (personality.secondary) {
            traitNames.push(personality.secondary);
        }
        
        return traitNames;
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

    // NEW: Update couple stats tracking
    updateCoupleStats(action, playerId) {
        if (!this.gameState.coupleStats) {
            this.gameState.coupleStats = {
                feedsTogether: 0,
                totalPlayTime: 0,
                actionsPerPlayer: {},
                lastTogetherFeed: 0,
                playTimeStarted: Date.now()
            };
        }

        const stats = this.gameState.coupleStats;
        
        // Track actions per player
        if (!stats.actionsPerPlayer[playerId]) {
            stats.actionsPerPlayer[playerId] = 0;
        }
        stats.actionsPerPlayer[playerId]++;

        // Track feeding together
        if (action === 'feed') {
            const now = Date.now();
            const timeSinceLastFeed = now - stats.lastTogetherFeed;
            
            // If another player fed within 10 seconds, count as feeding together
            if (timeSinceLastFeed <= 10000 && timeSinceLastFeed > 0) {
                stats.feedsTogether++;
                this.broadcastEvent('feeds_together', {
                    count: stats.feedsTogether,
                    message: `Great teamwork! You've fed together ${stats.feedsTogether} times! 💕`
                });
            }
            stats.lastTogetherFeed = now;
        }

        // Update total play time when both players are connected
        if (this.getConnectedPlayerCount() === 2) {
            const now = Date.now();
            const sessionTime = (now - stats.playTimeStarted) / (1000 * 60); // minutes
            stats.totalPlayTime = sessionTime;
        }
    }

    // NEW: Broadcast couple stats periodically
    broadcastCoupleStats() {
        if (!this.gameState.coupleStats) return;
        
        const stats = this.gameState.coupleStats;
        this.broadcastEvent('couple_stats', {
            feedsTogether: stats.feedsTogether,
            totalPlayTime: Math.round(stats.totalPlayTime),
            actionsPerPlayer: stats.actionsPerPlayer,
            connectedPlayers: this.getConnectedPlayerCount()
        });
    }

    getConnectedPlayerCount() {
        return Array.from(this.players.values()).filter(p => p.connected).length;
    }

    isFull() {
        return this.players.size >= 2;
    }

    // NEW: Check for egg spawning conditions
    checkEggSpawning() {
        if (!this.gameState.eggSpawning) return;
        
        const now = Date.now();
        const config = GAME_CONFIG.EGG_SPAWNING;
        
        // Check if we've reached the maximum baby limit
        if (this.gameState.babies.length >= config.maxBabies) return;
        
        // Check if any bunny has matured enough to unlock another egg.
        // Some legacy saves can skip or rename intermediate stages, so treat any
        // non-egg bunny at or beyond the trigger stage as eligible.
        const stageOrder = GAME_CONFIG.GROWTH_SYSTEM?.stages || ['egg', 'newborn', 'baby', 'toddler', 'child'];
        const triggerStageIndex = Math.max(0, stageOrder.indexOf(config.triggerStage));
        const eligibleBabies = this.gameState.babies.filter(baby => {
            const babyStageIndex = stageOrder.indexOf(baby.stage);
            return babyStageIndex >= triggerStageIndex && !baby.triggeredEggSpawn;
        });
        
        if (eligibleBabies.length === 0) return;
        
        // Check cooldown
        const timeSinceLastEgg = now - this.gameState.eggSpawning.lastNewEggTime;
        let requiredCooldown = config.cooldown;
        
        // Apply couple bonus (halved cooldown if both players online)
        if (this.getConnectedPlayerCount() === 2) {
            requiredCooldown *= config.coupleCooldownMultiplier;
        }
        
        if (timeSinceLastEgg < requiredCooldown) return;

        // Cooldown elapsed — clear stale trigger flags so a baby that has
        // already triggered once can trigger again on the next cycle.
        // Without this, the first eligible baby blocked all future spawns
        // permanently until a brand-new baby grew up.
        this.gameState.babies.forEach(b => { b.triggeredEggSpawn = false });

        // Conditions met! Create a discoverable egg
        const newEgg = this.createNewEgg();

        // Mark the baby that triggered this (cleared on next cooldown elapse)
        eligibleBabies[0].triggeredEggSpawn = true;
        
        // Add to discovered eggs (waiting for carrot payment)
        this.gameState.eggSpawning.discoveredEggs.push(newEgg);
        this.gameState.eggSpawning.lastNewEggTime = now;
        
        // Notify both players
        this.broadcastEvent('new_egg_available', {
            eggId: newEgg.id,
            eggType: newEgg.type,
            eggName: newEgg.name,
            cost: config.cost,
            message: `🥚 A ${newEgg.name} has appeared! Spend ${config.cost} carrots to discover it.`
        });
        
        console.log(`New egg spawned in room ${this.roomCode}: ${newEgg.name}`);
    }

    // NEW: Create a new egg with potential special properties
    createNewEgg() {
        const config = GAME_CONFIG.EGG_SPAWNING;
        const now = Date.now();
        
        let eggType = 'normal';
        let eggData = {
            name: 'Mysterious Egg',
            description: 'A normal egg waiting to hatch.',
            hatchSpeedMultiplier: 1.0,
            specialProperties: {}
        };
        
        // Roll for special egg
        if (Math.random() < config.specialEggChance) {
            const specialTypes = Object.keys(config.specialEggs);
            let totalChance = 0;
            
            for (const type of specialTypes) {
                totalChance += config.specialEggs[type].chance;
                if (Math.random() < totalChance) {
                    eggType = type;
                    const specialConfig = config.specialEggs[type];
                    
                    eggData = {
                        name: specialConfig.name,
                        description: specialConfig.description,
                        hatchSpeedMultiplier: specialConfig.hatchSpeedMultiplier || 1.0,
                        specialProperties: {
                            twinChance: specialConfig.twinChance || 0,
                            rareGenetics: specialConfig.rareGenetics || false
                        }
                    };
                    break;
                }
            }
        }
        
        return {
            id: `egg_${now}_${Math.random().toString(36).substr(2, 9)}`,
            type: eggType,
            ...eggData,
            createdAt: now,
            discovered: false
        };
    }

    // NEW: Handle egg discovery (carrot payment)
    discoverEgg(playerId, eggId) {
        const config = GAME_CONFIG.EGG_SPAWNING;
        
        // Check if player has enough carrots
        if (this.gameState.garden.carrots < config.cost) {
            return { success: false, message: `Need ${config.cost} carrots to discover the egg!` };
        }
        
        // Find the egg
        const eggIndex = this.gameState.eggSpawning.discoveredEggs.findIndex(egg => egg.id === eggId);
        if (eggIndex === -1) {
            return { success: false, message: 'Egg not found or already discovered!' };
        }
        
        const egg = this.gameState.eggSpawning.discoveredEggs[eggIndex];
        
        // Pay the cost
        this.gameState.garden.carrots -= config.cost;
        
        // Create the actual baby egg
        const newBaby = {
            id: `baby${this.gameState.babies.length + 1}`,
            name: this.getRandomBabyName(),
            stage: 'egg',
            hunger: 85,
            happiness: 85,
            energy: 85,
            cleanliness: 85,
            love: 5,
            growthPoints: 0,
            hatchProgress: 0,
            genetics: egg.specialProperties.rareGenetics ? this.generateRareGenetics() : this.generateGenetics(),
            birthTime: Date.now(),
            sleeping: false,
            lastFed: Date.now(),
            lastPlayed: Date.now(),
            lastCleaned: Date.now(),
            cooperativeBonuses: { feeding: 0, playing: 0, hatching: 0 },
            position: { x: 400 + Math.random() * 200 - 100, y: 300 + Math.random() * 100 - 50 },
            targetPosition: { x: 400 + Math.random() * 200 - 100, y: 300 + Math.random() * 100 - 50 },
            // Special properties from the egg
            eggType: egg.type,
            hatchSpeedMultiplier: egg.hatchSpeedMultiplier,
            specialProperties: egg.specialProperties
        };
        
        this.gameState.babies.push(newBaby);
        this.gameState.eggSpawning.discoveredEggs.splice(eggIndex, 1);
        this.gameState.eggSpawning.totalEggsSpawned++;
        
        // Broadcast the new egg
        this.broadcastEvent('egg_discovered', {
            baby: newBaby,
            eggType: egg.type,
            cost: config.cost,
            remainingCarrots: this.gameState.garden.carrots
        });
        
        return { success: true, baby: newBaby };
    }

    // NEW: Check baby growth and aging system
    checkBabyGrowth() {
        if (!this.gameState.growthSystem) return;
        
        const now = Date.now();
        const config = GAME_CONFIG.GROWTH_SYSTEM;
        
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') return; // Eggs don't age through this system
            
            // Calculate average care level
            const careLevel = (baby.hunger + baby.happiness + baby.energy + baby.cleanliness) / 4;
            const isWellCared = careLevel > config.careThreshold;
            
            // Determine growth time based on care quality
            const growthTime = isWellCared ? config.baseGrowthTime : config.neglectedGrowthTime;
            const timeSinceLastCheck = now - (baby.lastGrowthCheck || baby.birthTime);
            
            // Add growth points based on time and care
            if (timeSinceLastCheck > 60000) { // Only check once per minute
                const growthPoints = Math.floor(timeSinceLastCheck / growthTime * config.growthPointsPerStage);
                baby.growthPoints = (baby.growthPoints || 0) + growthPoints;
                baby.lastGrowthCheck = now;
                
                // Check if ready to advance stage
                if (baby.growthPoints >= config.growthPointsPerStage) {
                    const currentStageIndex = config.stages.indexOf(baby.stage);
                    if (currentStageIndex >= 0 && currentStageIndex < config.stages.length - 1) {
                        const oldStage = baby.stage;
                        const newStage = config.stages[currentStageIndex + 1];
                        
                        baby.stage = newStage;
                        baby.growthPoints = 0; // Reset for next stage
                        
                        // Record the transition
                        this.gameState.growthSystem.stageTransitions.push({
                            babyId: baby.id,
                            babyName: baby.name,
                            oldStage,
                            newStage,
                            timestamp: now,
                            careLevel
                        });
                        
                        // Broadcast the growth event
                        this.broadcastEvent('baby_grew', {
                            babyId: baby.id,
                            babyName: baby.name,
                            oldStage,
                            newStage,
                            message: `🎉 ${baby.name} has grown from ${oldStage} to ${newStage}!`
                        });
                        
                        console.log(`Baby ${baby.name} grew from ${oldStage} to ${newStage} in room ${this.roomCode}`);
                    }
                }
            }
        });
    }

    // NEW: Generate rare genetics for special eggs
    generateRareGenetics() {
        const rareColors = ['rainbow', 'golden', 'silver', 'pearl', 'cosmic'];
        const rareTraits = ['magical', 'wise', 'lucky', 'healing', 'empathic'];
        
        return {
            color: rareColors[Math.floor(Math.random() * rareColors.length)],
            trait: rareTraits[Math.floor(Math.random() * rareTraits.length)],
            personality: this.generatePersonality(),
            rarity: 'rare'
        };
    }

    // NEW: Shop system methods
    getShopItems() {
        return GAME_CONFIG.SHOP.items;
    }

    buyShopItem(playerId, itemId) {
        const items = GAME_CONFIG.SHOP.items;
        const item = items[itemId];
        
        if (!item) {
            return { success: false, message: 'Item not found!' };
        }
        
        // Check if player has enough carrots
        if (this.gameState.carrots < item.cost) {
            return { success: false, message: `Need ${item.cost} carrots to buy ${item.name}!` };
        }
        
        // Deduct carrots
        this.gameState.carrots -= item.cost;
        
        // Add to inventory
        if (!this.gameState.shop.inventory[playerId]) {
            this.gameState.shop.inventory[playerId] = {};
        }
        
        const playerInventory = this.gameState.shop.inventory[playerId];
        playerInventory[itemId] = (playerInventory[itemId] || 0) + 1;
        
        // Record purchase
        this.gameState.shop.purchaseHistory.push({
            playerId,
            itemId,
            itemName: item.name,
            cost: item.cost,
            timestamp: Date.now()
        });
        
        return { 
            success: true, 
            item: item,
            quantity: playerInventory[itemId],
            remainingCarrots: this.gameState.carrots,
            message: `Purchased ${item.name} for ${item.cost} carrots!`
        };
    }

    useShopItem(playerId, itemId, babyId) {
        const items = GAME_CONFIG.SHOP.items;
        const item = items[itemId];
        
        if (!item) {
            return { success: false, message: 'Item not found!' };
        }
        
        // Check inventory
        const playerInventory = this.gameState.shop.inventory[playerId] || {};
        if (!playerInventory[itemId] || playerInventory[itemId] <= 0) {
            return { success: false, message: `You don't have any ${item.name}!` };
        }
        
        // Find baby if specified
        let targetBaby = null;
        if (babyId) {
            targetBaby = this.gameState.babies.find(b => b.id === babyId);
            if (!targetBaby) {
                return { success: false, message: 'Baby not found!' };
            }
        }
        
        // Apply item effect
        let effectResult = null;
        if (item.type === 'consumable') {
            if (!targetBaby) {
                return { success: false, message: 'This item requires selecting a baby!' };
            }
            
            effectResult = this.applyItemEffect(targetBaby, item);
            
            // Consume the item
            playerInventory[itemId]--;
        } else if (item.type === 'decoration') {
            // Decorations provide passive effects, don't get consumed
            effectResult = { success: true, message: `${item.name} is now active!` };
        }
        
        return effectResult;
    }

    applyItemEffect(baby, item) {
        const effects = item.effect;
        let message = `Used ${item.name} on ${baby.name}! `;
        
        // Apply stat boosts
        if (effects.happiness) {
            baby.happiness = Math.min(100, baby.happiness + effects.happiness);
            message += `+${effects.happiness} happiness `;
        }
        
        if (effects.hunger) {
            baby.hunger = Math.min(100, baby.hunger + effects.hunger);
            message += `+${effects.hunger} hunger `;
        }
        
        if (effects.energy) {
            baby.energy = Math.min(100, baby.energy + effects.energy);
            message += `+${effects.energy} energy `;
        }
        
        if (effects.cleanliness) {
            baby.cleanliness = Math.min(100, baby.cleanliness + effects.cleanliness);
            message += `+${effects.cleanliness} cleanliness `;
        }
        
        // Apply special effects
        if (effects.sleep_efficiency) {
            if (!baby.specialEffects) baby.specialEffects = {};
            baby.specialEffects.sleepEfficiency = effects.sleep_efficiency;
            baby.specialEffectExpiry = Date.now() + 3600000; // 1 hour
            message += `(Better sleep for 1 hour) `;
        }
        
        return { success: true, message: message.trim() };
    }

    getPlayerInventory(playerId) {
        return this.gameState.shop.inventory[playerId] || {};
    }

    // NEW: Love letter/message system
    sendLoveNote(playerId, message) {
        try {
            // Validate input
            if (!message || typeof message !== 'string') {
                return { success: false, message: 'Invalid message' };
            }
            
            message = message.trim();
            if (message.length === 0) {
                return { success: false, message: 'Message cannot be empty' };
            }
            
            if (message.length > GAME_CONFIG.LOVE_LETTER_CONFIG.maxLength) {
                return { success: false, message: `Message too long (max ${GAME_CONFIG.LOVE_LETTER_CONFIG.maxLength} characters)` };
            }

            // Check cooldown
            const now = Date.now();
            const player = this.players.get(playerId);
            if (player && player.lastLoveNote && (now - player.lastLoveNote) < GAME_CONFIG.LOVE_LETTER_CONFIG.cooldown) {
                const remaining = Math.ceil((GAME_CONFIG.LOVE_LETTER_CONFIG.cooldown - (now - player.lastLoveNote)) / 1000);
                return { success: false, message: `Please wait ${remaining} seconds before sending another message` };
            }

            // Find partner
            const partnerPlayerId = this.getPartnerPlayerId(playerId);
            if (!partnerPlayerId) {
                return { success: false, message: 'No partner connected to receive your message' };
            }

            // Create love note
            const loveNote = {
                id: `note_${now}_${Math.random().toString(36).substr(2, 9)}`,
                from: playerId,
                to: partnerPlayerId,
                message: sanitizeInput(message),
                timestamp: now,
                read: false
            };

            // Add to history (maintain limit)
            if (!this.gameState.loveLetters) {
                this.gameState.loveLetters = [];
            }
            
            this.gameState.loveLetters.push(loveNote);
            
            // Keep only last N messages
            if (this.gameState.loveLetters.length > GAME_CONFIG.LOVE_LETTER_CONFIG.historyLimit) {
                this.gameState.loveLetters = this.gameState.loveLetters.slice(-GAME_CONFIG.LOVE_LETTER_CONFIG.historyLimit);
            }

            // Update sender's cooldown
            if (player) {
                player.lastLoveNote = now;
            }

            // Send to partner - FIX: Add connection validation to prevent race conditions
            const partnerPlayer = this.players.get(partnerPlayerId);
            if (partnerPlayer && partnerPlayer.connected && partnerPlayer.socketId) {
                // Validate socket still exists and is connected before sending
                const partnerSocket = io.sockets.sockets.get(partnerPlayer.socketId);
                if (partnerSocket && partnerSocket.connected) {
                    try {
                        partnerSocket.emit('love_note_received', {
                            noteId: loveNote.id,
                            message: loveNote.message,
                            timestamp: loveNote.timestamp,
                            from: playerId
                        });
                    } catch (socketError) {
                        // Socket might be in the process of disconnecting
                        console.warn(`Failed to deliver love note to partner ${partnerPlayerId}:`, socketError.message);
                        // Mark partner as disconnected to prevent future issues
                        partnerPlayer.connected = false;
                        partnerPlayer.socketId = null;
                    }
                } else {
                    // Partner socket is stale, update player state
                    partnerPlayer.connected = false;
                    partnerPlayer.socketId = null;
                }
            }

            // Record memory of love note
            memoryManager.recordCooperativeAction(this.roomCode, 'love_note', [playerId, partnerPlayerId], []).catch(error => {
                console.error('Failed to record love note memory:', error);
            });

            return { success: true, noteId: loveNote.id };
        } catch (error) {
            console.error(`Send love note error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to send message. Please try again.' };
        }
    }

    // NEW: Get love letter history
    getLoveLetterHistory(playerId, limit = 10) {
        if (!this.gameState.loveLetters) {
            return [];
        }
        
        // Return messages involving this player
        return this.gameState.loveLetters
            .filter(note => note.from === playerId || note.to === playerId)
            .slice(-Math.min(limit, 20)) // Cap at 20
            .map(note => ({
                id: note.id,
                message: note.message,
                timestamp: note.timestamp,
                from: note.from,
                to: note.to,
                read: note.read,
                isOwn: note.from === playerId
            }));
    }

    // NEW: Bunny position sync system with sequence numbers
    moveBunny(playerId, babyId, x, y, sequenceNumber = null) {
        try {
            // Validate input
            if (typeof x !== 'number' || typeof y !== 'number') {
                return { success: false, message: 'Invalid coordinates' };
            }
            
            if (!babyId || typeof babyId !== 'string') {
                return { success: false, message: 'Invalid baby ID' };
            }

            // Find the baby
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found' };
            }

            // Validate bounds (reasonable screen coordinates)
            x = Math.max(0, Math.min(1200, Math.round(x)));
            y = Math.max(0, Math.min(800, Math.round(y)));
            
            // FIX: Enhanced movement validation - distance and speed checking
            const now = Date.now();
            const currentPos = baby.position || { x: 400, y: 300 };
            const lastMoveTime = baby.lastMovedTime || (now - 1000);
            const timeDelta = Math.max(100, now - lastMoveTime); // Min 100ms between moves
            
            // Calculate movement distance
            const distance = Math.sqrt(Math.pow(x - currentPos.x, 2) + Math.pow(y - currentPos.y, 2));
            
            // Maximum reasonable movement speed (pixels per second)
            const maxSpeed = 500; // 500 pixels per second max
            const maxDistance = (maxSpeed * timeDelta) / 1000;
            
            // If movement is too fast, reject it
            if (distance > maxDistance && distance > 50) { // Allow small teleports for UI corrections
                return { 
                    success: false, 
                    message: `Movement too fast: ${Math.round(distance)}px in ${timeDelta}ms (max: ${Math.round(maxDistance)}px)`
                };
            }

            // Initialize position tracking if not exists
            if (!baby.position) {
                baby.position = { x: 400, y: 300 };
            }
            if (!baby.targetPosition) {
                baby.targetPosition = { x: 400, y: 300 };
            }
            if (!baby.moveSequence) {
                baby.moveSequence = 0;
            }

            // Sequence number validation to prevent out-of-order updates
            if (sequenceNumber !== null) {
                if (sequenceNumber <= baby.moveSequence) {
                    // Ignore old or duplicate movement updates
                    return { success: false, message: 'Out of sequence movement update ignored' };
                }
                baby.moveSequence = sequenceNumber;
            } else {
                // Increment sequence for non-sequenced updates
                baby.moveSequence++;
            }

            // Update position
            baby.position.x = x;
            baby.position.y = y;
            baby.targetPosition.x = x;
            baby.targetPosition.y = y;
            baby.lastMovedBy = playerId;
            baby.lastMovedTime = Date.now();

            // Broadcast to partner with sequence number
            const partnerPlayerId = this.getPartnerPlayerId(playerId);
            if (partnerPlayerId) {
                const partnerPlayer = this.players.get(partnerPlayerId);
                if (partnerPlayer && partnerPlayer.connected) {
                    const partnerSocket = io.sockets.sockets.get(partnerPlayer.socketId);
                    if (partnerSocket) {
                        partnerSocket.emit('bunny_moved', {
                            babyId: babyId,
                            x: x,
                            y: y,
                            movedBy: playerId,
                            timestamp: Date.now(),
                            sequenceNumber: baby.moveSequence
                        });
                    }
                }
            }

            // Update action count
            this.updateCoupleStats('move_bunny', playerId);

            return { success: true, sequenceNumber: baby.moveSequence };
        } catch (error) {
            console.error(`Move bunny error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to move bunny. Please try again.' };
        }
    }

    moveBunnyToCave(playerId, babyId) {
        try {
            // Validate input
            if (!babyId || typeof babyId !== 'string') {
                return { success: false, message: 'Invalid baby ID' };
            }

            // Find the baby
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found' };
            }

            // Mark baby as in cave
            baby.inCave = true;
            if (!baby.position) baby.position = { x: 400, y: 300 };
            baby.position.x = 125; // Cave center X
            baby.position.y = 125; // Cave center Y
            
            // Initialize cave data if needed
            if (!this.gameState.cave) {
                this.gameState.cave = {
                    bunniesInside: [],
                    bonusMultiplier: 1.5
                };
            }
            
            // Add to cave list if not already there
            if (!this.gameState.cave.bunniesInside.includes(babyId)) {
                this.gameState.cave.bunniesInside.push(babyId);
            }

            // Save game state
            this.saveGameState();

            console.log(`🏔️ ${babyId} entered cave in room ${this.roomCode}`);
            return { success: true };
        } catch (error) {
            console.error(`Cave enter error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to enter cave. Please try again.' };
        }
    }

    moveBunnyFromCave(playerId, babyId, x, y) {
        try {
            // Validate input
            if (!babyId || typeof babyId !== 'string') {
                return { success: false, message: 'Invalid baby ID' };
            }

            // Find the baby
            const baby = this.gameState.babies.find(b => b.id === babyId);
            if (!baby) {
                return { success: false, message: 'Baby not found' };
            }

            // Mark baby as not in cave
            baby.inCave = false;
            
            // Update position if provided
            if (x !== undefined && y !== undefined) {
                if (!baby.position) baby.position = { x: 400, y: 300 };
                baby.position.x = Math.max(50, Math.min(1200, Math.round(x)));
                baby.position.y = Math.max(50, Math.min(800, Math.round(y)));
            }
            
            // Remove from cave list
            if (this.gameState.cave && this.gameState.cave.bunniesInside) {
                const index = this.gameState.cave.bunniesInside.indexOf(babyId);
                if (index > -1) {
                    this.gameState.cave.bunniesInside.splice(index, 1);
                }
            }

            // Save game state
            this.saveGameState();

            console.log(`🌅 ${babyId} exited cave in room ${this.roomCode}`);
            return { success: true };
        } catch (error) {
            console.error(`Cave exit error in room ${this.roomCode}:`, error);
            return { success: false, message: 'Failed to exit cave. Please try again.' };
        }
    }
}

// Room management functions with race condition fix
const roomCreationMutex = new Set();

function generateRoomCode() {
    // FIX: Use crypto-secure generation to prevent collisions
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(3).toString('hex').toUpperCase();
    let code = (timestamp + randomBytes).substring(0, 6).toUpperCase();
    
    // Ensure it's exactly 6 characters with fallback
    if (code.length < 6) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        while (code.length < 6) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }
    
    return code.substring(0, 6);
}

async function createRoom() {
    // FIX: Prevent race condition in room creation with atomic check-and-set
    let roomCode;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
        roomCode = generateRoomCode();
        attempts++;
        
        // ATOMIC OPERATION: Check if code exists OR is being created, and reserve it in one step
        // Since Node.js is single-threaded, this operation is atomic as long as there are no awaits
        if (roomCreationMutex.has(roomCode) || rooms.has(roomCode)) {
            continue; // Code already in use or being created
        }
        
        // Reserve this code atomically (no await between check and set)
        roomCreationMutex.add(roomCode);
        break;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique room code');
    }

    try {
        // Now safely create the room - no other request can use this code
        const savedState = await gameStateManager.loadRoomState(roomCode);
        const room = new GameRoom(roomCode, savedState);
        
        // Add to rooms atomically (before releasing mutex)
        rooms.set(roomCode, room);
        
        console.log(`Room ${roomCode} created${savedState ? ' (loaded from save)' : ' (new)'}`);
        return room;
    } finally {
        // Always release the mutex
        roomCreationMutex.delete(roomCode);
    }
}

function generatePlayerId() {
    // Use cryptographically secure random generation
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `player_${timestamp}_${randomBytes}`;
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // First strip HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Escape HTML entities to prevent XSS
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    
    // Character whitelist: allow letters, numbers, spaces, basic punctuation, and common emoji characters
    sanitized = sanitized.replace(/[^\w\s.,!?:;()💕❤️🐰]/g, '');
    
    return sanitized.substring(0, 500).trim();
}

function checkConnectionLimit(socket) {
    const clientIP = socket.handshake.address;
    const currentConnections = connectionsByIP.get(clientIP) || 0;
    
    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
        socket.emit('action_failed', { message: 'Too many connections from this IP' });
        socket.disconnect(true);
        return false;
    }
    
    if (io.engine.clientsCount >= MAX_TOTAL_CONNECTIONS) {
        socket.emit('action_failed', { message: 'Server at capacity' });
        socket.disconnect(true);
        return false;
    }
    
    connectionsByIP.set(clientIP, currentConnections + 1);
    return true;
}

function cleanupConnection(socket) {
    const clientIP = socket.handshake.address;
    const currentConnections = connectionsByIP.get(clientIP) || 0;
    if (currentConnections > 0) {
        connectionsByIP.set(clientIP, currentConnections - 1);
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    // Security: Check connection limits
    if (!checkConnectionLimit(socket)) {
        return;
    }
    
    console.log(`Player connected: ${socket.id} from ${socket.handshake.address}`);

    // Trigger session start for achievements (reset session counters)
    socket.on('session_started', async (data = {}) => {
        const playerData = playerSockets.get(socket.id);
        if (playerData) {
            try {
                await achievementManager.checkAndUpdateAchievements(playerData.playerId, 'session_start');
            } catch (error) {
                console.error('Session start achievement update failed:', error);
            }
        }
    });

    socket.on('create_room', async (data = {}) => {
        try {
            // Security: Rate limiting check
            const playerData = playerSockets.get(socket.id);
            if (playerData) {
                try {
                    GameValidator.validateRateLimit(playerData.playerId, 'create_room', rateLimits);
                } catch (error) {
                    socket.emit('action_failed', { message: error.message });
                    return;
                }
            }

            // FIX: Properly await async createRoom function
            const room = await createRoom();
            const playerId = generatePlayerId();
            const playerName = sanitizeInput(data.playerName || 'Player');
            const bunnyColor = data.bunnyColor === 'white' ? 'white' : 'black'; // Default to black, allow white
            const playerType = bunnyColor; // Use bunny color as player type

            room.addPlayer(playerId, socket.id, playerType, { name: playerName, color: bunnyColor });
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
            console.error('Error creating room:', sanitizeInput(error.message));
            socket.emit('action_failed', { message: 'Failed to create room' });
        }
    });

    socket.on('join_room', async (data) => {
        try {
            // Security: Input validation
            if (!data || typeof data !== 'object') {
                socket.emit('action_failed', { message: 'Invalid request data' });
                return;
            }

            const { roomCode, playerName, bunnyColor } = data;
            
            // Security: Validate room code format
            let validatedRoomCode;
            try {
                validatedRoomCode = GameValidator.validateRoomCode(roomCode);
            } catch (error) {
                socket.emit('action_failed', { message: 'Invalid room code format' });
                return;
            }
            
            // Security: Rate limiting
            const playerData = playerSockets.get(socket.id);
            if (playerData) {
                try {
                    GameValidator.validateRateLimit(playerData.playerId, 'join_room', rateLimits);
                } catch (error) {
                    socket.emit('action_failed', { message: error.message });
                    return;
                }
            }
            
            let room = rooms.get(validatedRoomCode);
            
            // If room not in memory, try to restore from saved state
            if (!room) {
                try {
                    const savedState = await gameStateManager.loadRoomState(validatedRoomCode);
                    if (savedState) {
                        room = new GameRoom(validatedRoomCode, savedState);
                        rooms.set(validatedRoomCode, room);
                        console.log(`Room ${validatedRoomCode} restored from save for rejoin`);
                    } else {
                        socket.emit('action_failed', { message: 'Room not found' });
                        return;
                    }
                } catch (err) {
                    console.error(`Failed to restore room ${validatedRoomCode}:`, err);
                    socket.emit('action_failed', { message: 'Room not found' });
                    return;
                }
            }

            if (room.isFull()) {
                socket.emit('action_failed', { message: 'Room is full' });
                return;
            }

            const playerId = generatePlayerId();
            const sanitizedPlayerName = sanitizeInput(playerName || 'Player');
            const requestedColor = bunnyColor === 'black' ? 'black' : 'white'; // Default to white
            
            // Check if requested color is already taken by existing player
            let playerType = requestedColor;
            const existingPlayer = Array.from(room.players.values()).find(p => p.type === requestedColor);
            if (existingPlayer) {
                // Give them the other color
                playerType = requestedColor === 'black' ? 'white' : 'black';
            }

            room.addPlayer(playerId, socket.id, playerType, { name: sanitizedPlayerName, color: playerType });
            playerSockets.set(socket.id, { roomCode: room.roomCode, playerId });

            socket.join(room.roomCode);

            socket.emit('joined_room', {
                roomCode: room.roomCode,
                playerId: playerId,
                playerType: playerType,
                gameState: room.gameState
            });

            // Notify the other player
            socket.to(validatedRoomCode).emit('partner_connected');

            console.log(`Player ${playerId} joined room: ${validatedRoomCode}`);

            // Send initial game state to both players
            room.broadcastGameState();
        } catch (error) {
            console.error('Error joining room:', sanitizeInput(error.message));
            socket.emit('action_failed', { message: 'Failed to join room' });
        }
    });

    // Game action handlers
    socket.on('feed_baby', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) {
                socket.emit('action_failed', { message: 'Player not found' });
                return;
            }

            // Security: Rate limiting
            try {
                GameValidator.validateRateLimit(playerData.playerId, 'feed_baby', rateLimits);
            } catch (error) {
                socket.emit('action_failed', { message: error.message });
                return;
            }

            // Security: Validate action
            try {
                GameValidator.validateGameAction('feed_baby', data);
            } catch (error) {
                socket.emit('action_failed', { message: 'Invalid action data' });
                return;
            }

            const room = rooms.get(playerData.roomCode);
            if (!room) {
                socket.emit('action_failed', { message: 'Room not found' });
                return;
            }

            const result = await room.feedBaby(playerData.playerId, data.babyId || 'baby1');
            if (result.success) {
                room.broadcastGameState();
                // Update achievements for feeding action
                try {
                    await achievementManager.updateForAction(playerData.playerId, 'feed', room.gameState.dayNightCycle === 'night');
                } catch (achievementError) {
                    console.error('Achievement update failed:', achievementError);
                }
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in feed_baby:', sanitizeInput(error.message));
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('play_with_baby', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'play_with_baby', rateLimits);
            GameValidator.validateGameAction('play_with_baby', data);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.playWithBaby(playerData.playerId, data.babyId || 'baby1');
            if (result.success) {
                room.broadcastGameState();
                // Update achievements for play action
                try {
                    await achievementManager.updateForAction(playerData.playerId, 'play', room.gameState.dayNightCycle === 'night');
                } catch (achievementError) {
                    console.error('Achievement update failed:', achievementError);
                }
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in play_with_baby:', error);
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('sleep_baby', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'sleep_baby', rateLimits);
            GameValidator.validateGameAction('sleep_baby', data);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.putBabyToSleep(playerData.playerId, data.babyId || 'baby1');
            if (result.success) {
                room.broadcastGameState();
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in sleep_baby:', error);
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('clean_baby', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'clean_baby', rateLimits);
            GameValidator.validateGameAction('clean_baby', data);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.cleanBaby(playerData.playerId, data.babyId || 'baby1');
            if (result.success) {
                room.broadcastGameState();
                // Update achievements for clean action
                try {
                    await achievementManager.updateForAction(playerData.playerId, 'clean', room.gameState.dayNightCycle === 'night');
                } catch (achievementError) {
                    console.error('Achievement update failed:', achievementError);
                }
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in clean_baby:', error);
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('pet_baby', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'pet_baby', rateLimits);
            GameValidator.validateGameAction('pet_baby', data);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.petBaby(playerData.playerId, data.babyId || 'baby1');
            if (result.success) {
                room.broadcastGameState();
                // Update achievements for pet action
                try {
                    await achievementManager.updateForAction(playerData.playerId, 'pet', room.gameState.dayNightCycle === 'night');
                } catch (achievementError) {
                    console.error('Achievement update failed:', achievementError);
                }
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in pet_baby:', error);
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('hatch_egg', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'hatch_egg', rateLimits);
            GameValidator.validateGameAction('hatch_egg', data);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.tapEgg(playerData.playerId);
            if (result.success) {
                room.broadcastGameState();
                // Update achievements for hatch action
                try {
                    await achievementManager.updateForAction(playerData.playerId, 'hatch', room.gameState.dayNightCycle === 'night');
                } catch (achievementError) {
                    console.error('Achievement update failed:', achievementError);
                }
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in hatch_egg:', error);
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('harvest_carrots', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'harvest_carrots', rateLimits);
            GameValidator.validateGameAction('harvest_carrots', data);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.harvestCarrots(playerData.playerId);
            if (result.success) {
                room.broadcastGameState();
                // Update achievements for harvest action
                try {
                    await achievementManager.updateForAction(playerData.playerId, 'harvest', room.gameState.dayNightCycle === 'night');
                } catch (achievementError) {
                    console.error('Achievement update failed:', achievementError);
                }
            } else {
                socket.emit('action_failed', result);
            }
        } catch (error) {
            console.error('Error in harvest_carrots:', error);
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    socket.on('decay_needs', (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            // This is a debug action - limit it heavily
            GameValidator.validateRateLimit(playerData.playerId, 'decay_needs', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            // Manual trigger for needs decay (backup for game loop)
            room.updateNeeds();
            room.checkGrowth();
            room.broadcastGameState();
        } catch (error) {
            socket.emit('action_failed', { message: 'Action failed' });
        }
    });

    // NEW FEATURE HANDLERS

    socket.on('check_daily_reward', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'check_daily_reward', rateLimits);

            const rewardStatus = await dailyRewardManager.checkDailyReward(playerData.playerId, playerData.roomCode);
            socket.emit('daily_reward_status', rewardStatus);
        } catch (error) {
            console.error('Check daily reward error:', error);
            socket.emit('action_failed', { message: 'Failed to check daily reward' });
        }
    });

    socket.on('claim_daily_reward', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'claim_daily_reward', rateLimits);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const partnerPlayerId = room.getPartnerPlayerId(playerData.playerId);
            const result = await dailyRewardManager.claimDailyReward(
                playerData.playerId, 
                playerData.roomCode, 
                partnerPlayerId
            );

            if (result.success) {
                // Apply rewards to game state
                room.gameState.garden.carrots += result.reward.carrots;
                
                // Update player stats for achievements
                const player = room.players.get(playerData.playerId);
                if (player) {
                    player.dailyStreak = result.streak;
                    
                    // Check daily streak achievements
                    const achievementResult = await achievementManager.checkAndUpdateAchievements(
                        playerData.playerId, 
                        'daily_streak', 
                        { streak: result.streak }
                    );
                    
                    if (achievementResult.newlyUnlocked.length > 0) {
                        room.broadcastAchievements(playerData.playerId, achievementResult.newlyUnlocked);
                    }
                }

                await room.broadcastDailyReward(playerData.playerId, result);
                room.broadcastGameState();

                // Record milestone memory for significant streaks
                if (result.streak === 7 || result.streak === 30 || result.streak === 100) {
                    await memoryManager.recordMilestone(playerData.roomCode, {
                        title: `${result.streak} Day Streak!`,
                        description: `Maintained daily care for ${result.streak} consecutive days!`,
                        metadata: { streak: result.streak, rewardsClaimed: true }
                    }, [playerData.playerId]);
                }
            }

            socket.emit('daily_reward_result', result);
        } catch (error) {
            console.error('Claim daily reward error:', error);
            socket.emit('action_failed', { message: 'Failed to claim daily reward' });
        }
    });

    socket.on('get_achievements', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const achievements = await achievementManager.getPlayerAchievements(playerData.playerId);
            socket.emit('achievements_data', achievements);
        } catch (error) {
            console.error('Get achievements error:', error);
            socket.emit('action_failed', { message: 'Failed to get achievements' });
        }
    });

    socket.on('customize_bunny', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'customize_bunny', rateLimits);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const customization = {
                name: data.name,
                color: data.color,
                trait: data.trait,
                accessory: data.accessory
            };

            const result = await customizationManager.customizeBunny(
                playerData.playerId,
                data.babyId || 'baby1',
                customization
            );

            if (result.success) {
                // Update baby in game state if name was changed
                const baby = room.gameState.babies.find(b => b.id === (data.babyId || 'baby1'));
                if (baby && result.customization.name) {
                    baby.name = result.customization.name;
                    baby.customColor = result.customization.color;
                    baby.customTrait = result.customization.trait;
                    baby.customAccessory = result.customization.accessory;
                }

                room.broadcastGameState();
            }

            socket.emit('customization_result', result);
        } catch (error) {
            console.error('Customize bunny error:', error);
            socket.emit('action_failed', { message: 'Failed to customize bunny' });
        }
    });

    socket.on('get_customizations', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const customizations = await customizationManager.getPlayerCustomizations(playerData.playerId);
            socket.emit('customizations_data', customizations);
        } catch (error) {
            console.error('Get customizations error:', error);
            socket.emit('action_failed', { message: 'Failed to get customizations' });
        }
    });

    socket.on('get_memories', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const limit = Math.min(data.limit || 20, 50); // Cap at 50
            const memories = await memoryManager.getRecentMemories(playerData.roomCode, limit);
            const milestones = await memoryManager.getMilestones(playerData.roomCode);
            
            socket.emit('memories_data', {
                recent: memories,
                milestones: milestones.slice(0, 10), // Top 10 milestones
                stats: await memoryManager.getMemoryStats(playerData.roomCode)
            });
        } catch (error) {
            console.error('Get memories error:', error);
            socket.emit('action_failed', { message: 'Failed to get memories' });
        }
    });

    socket.on('capture_photo', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'capture_photo', rateLimits);

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const photoData = {
                caption: data.caption,
                filter: data.filter,
                participants: [playerData.playerId],
                babies: data.babies || [],
                imageData: data.imageData,
                gameState: room.gameState
            };

            const photo = await memoryManager.capturePhoto(playerData.roomCode, photoData);
            
            if (photo) {
                socket.emit('photo_captured', {
                    success: true,
                    photo,
                    message: 'Photo captured successfully! 📸'
                });
                
                // Broadcast photo event to partner
                room.broadcastEvent('photo_taken', {
                    playerId: playerData.playerId,
                    caption: photo.caption,
                    timestamp: photo.timestamp
                });
            } else {
                socket.emit('photo_captured', {
                    success: false,
                    message: 'Failed to capture photo'
                });
            }
        } catch (error) {
            console.error('Capture photo error:', error);
            socket.emit('action_failed', { message: 'Failed to capture photo' });
        }
    });

    // FIX: Add backend handlers for new frontend features
    
    // Daily Rewards System
    socket.on('check_daily_reward', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'check_daily_reward', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await dailyRewardManager.checkDailyReward(playerData.playerId, playerData.roomCode);
            socket.emit('daily_reward_status', result);
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to check daily reward' });
        }
    });

    socket.on('claim_daily_reward', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'claim_daily_reward', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            // Find partner player for couple bonus
            let partnerPlayerId = null;
            for (const [pid, player] of room.players) {
                if (pid !== playerData.playerId && player.connected) {
                    partnerPlayerId = pid;
                    break;
                }
            }

            const result = await dailyRewardManager.claimDailyReward(playerData.playerId, playerData.roomCode, partnerPlayerId);
            
            if (result.success) {
                // Add rewards to game state
                room.gameState.garden.carrots += result.reward.carrots;
                room.broadcastGameState();
                
                socket.emit('daily_reward_claimed', result);
                
                // Update achievements
                await achievementManager.checkAndUpdateAchievements(playerData.playerId, 'daily_streak', { streak: result.streak });
            } else {
                socket.emit('daily_reward_failed', result);
            }
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to claim daily reward' });
        }
    });

    // Achievement System
    socket.on('get_achievements', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'get_achievements', rateLimits);
            
            const achievements = await achievementManager.getPlayerAchievements(playerData.playerId);
            socket.emit('achievements_data', achievements);
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to get achievements' });
        }
    });

    // Customization System
    socket.on('save_customization', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'save_customization', rateLimits);
            GameValidator.validateGameAction('save_customization', data);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await customizationManager.saveCustomization(playerData.playerId, data.customization);
            socket.emit('customization_saved', { success: result });
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to save customization' });
        }
    });

    socket.on('load_customization', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const customization = await customizationManager.loadCustomization(playerData.playerId);
            socket.emit('customization_loaded', { customization });
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to load customization' });
        }
    });

    // Photo/Memory System
    socket.on('save_memory', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'save_memory', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await memoryManager.saveMemory(playerData.playerId, data.memory);
            socket.emit('memory_saved', { success: result });
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to save memory' });
        }
    });

    socket.on('get_memories', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const memories = await memoryManager.getMemories(playerData.playerId);
            socket.emit('memories_loaded', { memories });
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to load memories' });
        }
    });

    // Mini-Game System  
    socket.on('start_minigame', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'start_minigame', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            // Basic mini-game validation
            const validGames = ['memory_match', 'carrot_catch', 'bunny_race'];
            if (!data.gameType || !validGames.includes(data.gameType)) {
                socket.emit('action_failed', { message: 'Invalid mini-game type' });
                return;
            }

            socket.emit('minigame_started', {
                gameType: data.gameType,
                gameId: `${playerData.playerId}_${Date.now()}`,
                timestamp: Date.now()
            });
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to start mini-game' });
        }
    });

    socket.on('submit_minigame_score', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'submit_minigame_score', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            // Basic score validation
            if (!data.score || typeof data.score !== 'number' || data.score < 0 || data.score > 10000) {
                socket.emit('action_failed', { message: 'Invalid score' });
                return;
            }

            // Award small carrot bonus for mini-game completion
            const bonus = Math.min(3, Math.floor(data.score / 100));
            room.gameState.garden.carrots += bonus;
            
            room.broadcastGameState();
            socket.emit('minigame_completed', {
                score: data.score,
                bonus: bonus,
                message: `Great job! You earned ${bonus} bonus carrots!`
            });

            // Update achievements
            await achievementManager.checkAndUpdateAchievements(playerData.playerId, 'action', { action: 'play_minigame' });
        } catch (error) {
            socket.emit('action_failed', { message: 'Failed to submit score' });
        }
    });

    // NEW: Love Letter / Message System Socket Handlers
    socket.on('send_love_note', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) {
                socket.emit('action_failed', { message: 'Player not found' });
                return;
            }

            // Rate limiting
            GameValidator.validateRateLimit(playerData.playerId, 'send_love_note', rateLimits);

            const room = rooms.get(playerData.roomCode);
            if (!room) {
                socket.emit('action_failed', { message: 'Room not found' });
                return;
            }

            const result = await room.sendLoveNote(playerData.playerId, data.message);
            
            if (result.success) {
                socket.emit('love_note_sent', {
                    noteId: result.noteId,
                    message: 'Love note sent successfully! 💕'
                });
            } else {
                socket.emit('love_note_failed', result);
            }
        } catch (error) {
            console.error('Send love note error:', error);
            socket.emit('action_failed', { message: 'Failed to send love note' });
        }
    });

    socket.on('get_love_letters', (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const letters = room.getLoveLetterHistory(playerData.playerId, data.limit || 10);
            socket.emit('love_letters_history', { letters });
        } catch (error) {
            console.error('Get love letters error:', error);
            socket.emit('action_failed', { message: 'Failed to get love letters' });
        }
    });

    // NEW: Bunny Position Sync Socket Handlers with throttling
    socket.on('move_bunny', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            // Movement-specific throttling (max 10 updates per second)
            try {
                GameValidator.validateMovementThrottle(playerData.playerId, movementThrottles);
            } catch (error) {
                // Silently drop throttled movements
                return;
            }

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = await room.moveBunny(
                playerData.playerId, 
                data.babyId || 'baby1', 
                data.x, 
                data.y,
                data.sequenceNumber || null
            );
            
            if (result.success) {
                // Broadcast back to sender for confirmation with sequence number
                socket.emit('bunny_position_confirmed', {
                    babyId: data.babyId || 'baby1',
                    x: data.x,
                    y: data.y,
                    sequenceNumber: result.sequenceNumber
                });
            }
        } catch (error) {
            console.error('Move bunny error:', error);
            // Don't emit error for movement to avoid spam
        }
    });

    socket.on('get_couple_stats', (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            // Force broadcast current couple stats
            room.broadcastCoupleStats();
        } catch (error) {
            console.error('Get couple stats error:', error);
            socket.emit('action_failed', { message: 'Failed to get couple stats' });
        }
    });

    // NEW: Cave system socket handlers
    socket.on('cave_entered', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'cave_action', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = room.moveBunnyToCave(playerData.playerId, data.babyId);
            
            if (result.success) {
                // Broadcast to partner
                const partnerPlayerId = room.getPartnerPlayerId(playerData.playerId);
                if (partnerPlayerId) {
                    const partnerPlayer = room.players.get(partnerPlayerId);
                    if (partnerPlayer && partnerPlayer.connected) {
                        const partnerSocket = io.sockets.sockets.get(partnerPlayer.socketId);
                        if (partnerSocket) {
                            partnerSocket.emit('cave_entered', {
                                babyId: data.babyId,
                                movedBy: playerData.playerId,
                                timestamp: Date.now()
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Cave entered error:', error);
            socket.emit('action_failed', { message: 'Failed to enter cave' });
        }
    });

    socket.on('cave_exited', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'cave_action', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = room.moveBunnyFromCave(playerData.playerId, data.babyId, data.x, data.y);
            
            if (result.success) {
                // Broadcast to partner
                const partnerPlayerId = room.getPartnerPlayerId(playerData.playerId);
                if (partnerPlayerId) {
                    const partnerPlayer = room.players.get(partnerPlayerId);
                    if (partnerPlayer && partnerPlayer.connected) {
                        const partnerSocket = io.sockets.sockets.get(partnerPlayer.socketId);
                        if (partnerSocket) {
                            partnerSocket.emit('cave_exited', {
                                babyId: data.babyId,
                                x: data.x,
                                y: data.y,
                                movedBy: playerData.playerId,
                                timestamp: Date.now()
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Cave exited error:', error);
            socket.emit('action_failed', { message: 'Failed to exit cave' });
        }
    });

    // NEW: Egg spawning system socket handlers
    socket.on('discover_egg', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'discover_egg', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = room.discoverEgg(playerData.playerId, data.eggId);
            
            if (result.success) {
                socket.emit('egg_discovered_success', {
                    baby: result.baby,
                    message: 'New egg discovered! 🥚✨'
                });
                // Broadcast to partner as well
                room.broadcastGameState();
            } else {
                socket.emit('egg_discovery_failed', result);
            }
        } catch (error) {
            console.error('Discover egg error:', error);
            socket.emit('action_failed', { message: 'Failed to discover egg' });
        }
    });

    // NEW: Shop system socket handlers
    socket.on('get_shop_items', (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const shopItems = room.getShopItems();
            const playerInventory = room.getPlayerInventory(playerData.playerId);

            socket.emit('shop_items', {
                items: shopItems,
                inventory: playerInventory,
                carrots: room.gameState.carrots
            });
        } catch (error) {
            console.error('Get shop items error:', error);
            socket.emit('action_failed', { message: 'Failed to get shop items' });
        }
    });

    socket.on('buy_item', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'buy_item', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = room.buyShopItem(playerData.playerId, data.itemId);
            
            if (result.success) {
                socket.emit('item_purchased', result);
                // Update both players' view
                room.broadcastGameState();
            } else {
                socket.emit('purchase_failed', result);
            }
        } catch (error) {
            console.error('Buy item error:', error);
            socket.emit('action_failed', { message: 'Failed to buy item' });
        }
    });

    socket.on('use_item', async (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            GameValidator.validateRateLimit(playerData.playerId, 'use_item', rateLimits);
            
            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const result = room.useShopItem(playerData.playerId, data.itemId, data.babyId);
            
            if (result.success) {
                socket.emit('item_used', result);
                // Update game state to reflect stat changes
                room.broadcastGameState();
            } else {
                socket.emit('item_use_failed', result);
            }
        } catch (error) {
            console.error('Use item error:', error);
            socket.emit('action_failed', { message: 'Failed to use item' });
        }
    });

    socket.on('get_inventory', (data = {}) => {
        try {
            const playerData = playerSockets.get(socket.id);
            if (!playerData) return;

            const room = rooms.get(playerData.roomCode);
            if (!room) return;

            const inventory = room.getPlayerInventory(playerData.playerId);
            socket.emit('player_inventory', { inventory });
        } catch (error) {
            console.error('Get inventory error:', error);
            socket.emit('action_failed', { message: 'Failed to get inventory' });
        }
    });

    socket.on('disconnect', async () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Security: Clean up connection tracking
        cleanupConnection(socket);
        
        const playerData = playerSockets.get(socket.id);
        if (playerData) {
            const room = rooms.get(playerData.roomCode);
            if (room) {
                // CRITICAL FIX: Save game state immediately when player disconnects
                try {
                    await room.saveGameState();
                    console.log(`Game state saved for room ${playerData.roomCode} on player disconnect`);
                } catch (error) {
                    console.error(`Failed to save game state on disconnect for room ${playerData.roomCode}:`, error);
                }
                
                room.removePlayer(playerData.playerId);
                
                // Clean up empty rooms after 5 minutes
                setTimeout(() => {
                    if (room && room.getConnectedPlayerCount() === 0) {
                        // Use the proper cleanup method
                        room.cleanup();
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

// Photo serving endpoint
app.get('/api/photos/:filename', (req, res) => {
    try {
        const filename = req.params.filename.replace(/[^a-zA-Z0-9\-_.]/g, ''); // Sanitize filename
        const photoPath = path.join(__dirname, 'saves', 'photos', filename);
        
        // Basic security check
        if (!filename.endsWith('.png') && !filename.endsWith('.jpg') && !filename.endsWith('.jpeg')) {
            return res.status(400).json({ error: 'Invalid file type' });
        }
        
        res.sendFile(photoPath, (err) => {
            if (err) {
                res.status(404).json({ error: 'Photo not found' });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint (reduced information exposure)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🐰❤️ Bunny Family Enhanced server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play!`);
    console.log(`Features: Persistence, Validation, Cooperative Gameplay, Enhanced Genetics`);
    
    // Start auto-save system
    gameStateManager.startAutoSave(rooms);
    console.log('✅ Auto-save system started');
    
    // Log available saved rooms
    try {
        const savedRooms = await gameStateManager.listSavedRooms();
        if (savedRooms.length > 0) {
            console.log(`📁 Found ${savedRooms.length} saved rooms available for restoration`);
        }
    } catch (error) {
        console.warn('Could not list saved rooms:', error.message);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    
    // Save all active rooms before shutdown
    console.log('💾 Saving all active rooms...');
    const savePromises = [];
    for (const [roomCode, room] of rooms) {
        if (room.getConnectedPlayerCount() > 0 || room.gameState.totalActions > 0) {
            savePromises.push(room.saveGameState());
        }
    }
    
    try {
        await Promise.all(savePromises);
        console.log(`✅ Saved ${savePromises.length} rooms`);
    } catch (error) {
        console.error('❌ Error saving rooms during shutdown:', error);
    }
    
    // Stop auto-save system
    gameStateManager.stopAutoSave();
    
    // Clean up Redis connections
    if (redisClients) {
        try {
            console.log('🔌 Closing Redis connections...');
            await redisClients.pubClient.quit();
            await redisClients.subClient.quit();
            console.log('✅ Redis connections closed');
        } catch (error) {
            console.error('❌ Error closing Redis connections:', error);
        }
    }
    
    // FIX: Clear all cleanup intervals to prevent memory leaks on restart
    clearAllCleanupIntervals();
    
    server.close(() => {
        console.log('Server shut down gracefully');
        process.exit(0);
    });
});

// FIX: Rate limit memory leak - register cleanup intervals properly
// Security: Clean up inactive rooms and rate limit data every hour
const hourlyCleanup = setInterval(() => {
    let cleanedCount = 0;
    rooms.forEach((room, roomCode) => {
        if (room.getConnectedPlayerCount() === 0) {
            // Use proper cleanup method
            room.cleanup();
            rooms.delete(roomCode);
            cleanedCount++;
        }
    });
    
    // Clean up old rate limit entries
    const now = Date.now();
    const cutoff = now - 3600000; // 1 hour old
    let rateLimitCleaned = 0;
    
    rateLimits.forEach((attempts, key) => {
        const recentAttempts = attempts.filter(time => time > cutoff);
        if (recentAttempts.length === 0) {
            rateLimits.delete(key);
            rateLimitCleaned++;
        } else if (recentAttempts.length !== attempts.length) {
            rateLimits.set(key, recentAttempts);
        }
    });
    
    // Clean up old movement throttle entries
    let movementThrottleCleaned = 0;
    movementThrottles.forEach((attempts, key) => {
        const recentAttempts = attempts.filter(time => time > cutoff);
        if (recentAttempts.length === 0) {
            movementThrottles.delete(key);
            movementThrottleCleaned++;
        } else if (recentAttempts.length !== attempts.length) {
            movementThrottles.set(key, recentAttempts);
        }
    });
    
    // Clean up old connection tracking
    let connectionsCleaned = 0;
    connectionsByIP.forEach((count, ip) => {
        if (count <= 0) {
            connectionsByIP.delete(ip);
            connectionsCleaned++;
        }
    });
    
    if (cleanedCount > 0 || rateLimitCleaned > 0 || movementThrottleCleaned > 0 || connectionsCleaned > 0) {
        console.log(`Cleanup: ${cleanedCount} rooms, ${rateLimitCleaned} rate limits, ${movementThrottleCleaned} movement throttles, ${connectionsCleaned} connections`);
    }
}, 3600000); // 1 hour
addCleanupInterval(hourlyCleanup);

// Security: Periodic cleanup of rate limits (more frequent)
const minuteCleanup = setInterval(() => {
    const now = Date.now();
    const cutoff = now - 60000; // 1 minute old
    
    rateLimits.forEach((attempts, key) => {
        const recentAttempts = attempts.filter(time => time > cutoff);
        if (recentAttempts.length === 0) {
            rateLimits.delete(key);
        } else if (recentAttempts.length !== attempts.length) {
            rateLimits.set(key, recentAttempts);
        }
    });
    
    // Also clean movement throttles more frequently (they are shorter lived)
    const movementCutoff = now - 10000; // 10 seconds old
    movementThrottles.forEach((attempts, key) => {
        const recentAttempts = attempts.filter(time => time > movementCutoff);
        if (recentAttempts.length === 0) {
            movementThrottles.delete(key);
        } else if (recentAttempts.length !== attempts.length) {
            movementThrottles.set(key, recentAttempts);
        }
    });
}, 300000); // 5 minutes
addCleanupInterval(minuteCleanup);