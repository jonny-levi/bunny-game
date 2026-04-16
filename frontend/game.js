// Bunny Family 2D - Complete HTML5 Canvas Game Implementation
// Replaces Three.js with beautiful 2D graphics

// ===== GLOBAL VARIABLES =====
let socket = null;
let gameState = null;
let myPlayerId = null;
let myPlayerType = null; // 'black' or 'white'
let roomCode = null;
let selectedBabyId = 'baby1';

// Canvas and rendering
let canvas = null;
let currentScene = 'default'; // 'default', 'kitchen', 'playground', 'bedroom'
let sceneTimer = null;
let ctx = null;
let animationId = null;
let lastFrameTime = 0;

// New features state
let weatherState = {
    type: 'sunny', // 'rain', 'snow', 'sunny'
    particles: [],
    maxParticles: 30,
    lastWeatherChange: 0,
    changeInterval: 180000 // 3 minutes
};

let shopState = {
    isOpen: false,
    items: [
        // === Essentials ===
        { id: 'carrot_treat', name: 'Carrot Necklace', price: 3, icon: '🥕', desc: 'Cute carrot pendant', type: 'wearable' },
        { id: 'toy_ball', name: 'Bouncy Ball', price: 5, icon: '🏀', desc: 'Carries it around', type: 'wearable' },
        { id: 'soft_blanket', name: 'Soft Blanket', price: 8, icon: '🧣', desc: 'Cozy blanket cape', type: 'wearable' },
        { id: 'bow_pink', name: 'Pink Bow', price: 8, icon: '🎀', desc: 'Adorable pink bow', type: 'wearable' },
        { id: 'scarf_red', name: 'Red Scarf', price: 10, icon: '🧣', desc: 'Cozy red scarf', type: 'wearable' },
        { id: 'scarf_blue', name: 'Blue Scarf', price: 10, icon: '🧣', desc: 'Stylish blue scarf', type: 'wearable' },
        { id: 'decorative_plant', name: 'Flower Crown', price: 12, icon: '🌸', desc: 'Beautiful flower crown', type: 'wearable' },
        { id: 'glasses', name: 'Cool Glasses', price: 12, icon: '🕶️', desc: 'Stylish sunglasses', type: 'wearable' },
        { id: 'night_light', name: 'Glowing Amulet', price: 15, icon: '✨', desc: 'Magical glowing amulet', type: 'wearable' },
        { id: 'hat_top', name: 'Top Hat', price: 20, icon: '🎩', desc: 'Fancy top hat', type: 'wearable' },
        // === Designer & Sportswear ===
        { id: 'hopmes_scarf', name: 'Hopmès Silk Carré', price: 25, icon: '🧡', desc: 'Maison Hopmès — orange silk', type: 'wearable' },
        { id: 'louis_bunitton', name: 'Louis Bunitton Bag', price: 30, icon: '👜', desc: 'Iconic LB monogram', type: 'wearable' },
        { id: 'dior_shades', name: 'Dior-able Shades', price: 22, icon: '🕶️', desc: 'Gold frame aviators', type: 'wearable' },
        { id: 'hike_cap', name: 'Hike Signature Cap', price: 18, icon: '🧢', desc: 'Just Hop It', type: 'wearable' },
        { id: 'hoppidas_jacket', name: 'Hoppidas Trefoil', price: 20, icon: '🧥', desc: 'Three-stripe classic', type: 'wearable' },
        { id: 'cloud_kicks', name: 'On Cloud-Hop Kicks', price: 22, icon: '👟', desc: 'Swiss cushion pods', type: 'wearable' },
        { id: 'bunnci_beanie', name: 'Bunnci Beanie', price: 19, icon: '🎩', desc: 'Green-red stripe classic', type: 'wearable' },
        { id: 'chanel_pearls', name: 'Chabun N°5 Pearls', price: 28, icon: '⚪', desc: 'Baroque pearl strands', type: 'wearable' }
    ]
};
let inventoryState = {}; // { itemId: quantity }

let notificationQueue = [];

// Performance optimizations
let backgroundCache = new Map();
let backgroundNeedsRedraw = true;
let lastScene = null;
let particlePool = [];
let activeParticles = [];
let dirtyBackground = true;
let cachedDOMRefs = {};
let textMeasureCache = new Map();

// Game state tracking
let currentPhase = 'lobby'; // 'lobby', 'game'
let lastUpdateTime = Date.now();
let effectsQueue = [];

// Football mini-game state
let footballGame = {
    active: false,
    ballX: 0,
    ballY: 0,
    ballVX: 0,
    ballVY: 0,
    blackScore: 0,
    whiteScore: 0,
    goalMessage: '',
    goalMessageTime: 0,
    winMessage: '',
    winMessageTime: 0,
    paused: false
};

// Keyboard state for football
let keysPressed = {};

// ===== MINI-GAME SYSTEM STATE =====
let miniGameState = {
    activeGame: null, // 'memory', 'racing', 'cooking', 'maze' or null
    data: {}          // game-specific data
};

// Persistent scoreboard
let miniGameScores = { football: [], memory: [], racing: [], cooking: [], maze: [] };

// Load scores from localStorage
(function loadMiniGameScores() {
    try {
        const saved = localStorage.getItem('bunnyGame_miniGameScores');
        if (saved) {
            const parsed = JSON.parse(saved);
            miniGameScores = Object.assign(miniGameScores, parsed);
        }
    } catch (e) { /* ignore */ }
})();

function saveMiniGameScores() {
    try {
        localStorage.setItem('bunnyGame_miniGameScores', JSON.stringify(miniGameScores));
    } catch (e) { /* ignore */ }
}

function addMiniGameScore(gameId, score, playerName) {
    if (!miniGameScores[gameId]) miniGameScores[gameId] = [];
    miniGameScores[gameId].push({ score: score, date: Date.now(), playerName: playerName || 'Bunny' });
    miniGameScores[gameId].sort((a, b) => {
        // Lower is better for memory (moves) and maze (time); higher is better for racing and cooking
        if (gameId === 'memory' || gameId === 'maze') return a.score - b.score;
        return b.score - a.score;
    });
    miniGameScores[gameId] = miniGameScores[gameId].slice(0, 10);
    saveMiniGameScores();
}

function quitMiniGame() {
    miniGameState.activeGame = null;
    miniGameState.data = {};
}

function showMiniGameScoreboard(gameId) {
    const overlay = document.createElement('div');
    overlay.id = 'minigame-scores-overlay';
    overlay.className = 'shop-overlay';

    const gameNames = {
        football: '⚽ Football',
        memory: '🧠 Memory Match',
        racing: '🏁 Bunny Race',
        cooking: '🍳 Cooking Challenge',
        maze: '🌀 Garden Maze'
    };

    const scoreLabelMap = {
        football: 'Goals',
        memory: 'Moves',
        racing: 'Distance',
        cooking: 'Score',
        maze: 'Seconds'
    };

    let tabsHtml = Object.keys(gameNames).map(id =>
        `<button class="score-tab-btn" data-tab="${id}" style="padding:6px 12px;margin:2px;border:none;border-radius:8px;cursor:pointer;background:${id === gameId ? '#ff6f00' : '#eee'};color:${id === gameId ? '#fff' : '#333'};font-size:0.85em;">${gameNames[id]}</button>`
    ).join('');

    function buildScoreTable(gid) {
        const scores = miniGameScores[gid] || [];
        if (scores.length === 0) return '<div style="text-align:center;color:#999;padding:20px;">No scores yet! Play the game to set a record.</div>';
        return `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <tr style="background:#fff3e0;"><th style="padding:8px;text-align:left;">#</th><th style="padding:8px;text-align:left;">Player</th><th style="padding:8px;text-align:right;">${scoreLabelMap[gid]}</th><th style="padding:8px;text-align:right;">Date</th></tr>
            ${scores.slice(0, 5).map((s, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};"><td style="padding:6px 8px;">${['🥇','🥈','🥉','4','5'][i]}</td><td style="padding:6px 8px;">${s.playerName}</td><td style="padding:6px 8px;text-align:right;font-weight:bold;">${s.score}</td><td style="padding:6px 8px;text-align:right;font-size:0.8em;color:#999;">${new Date(s.date).toLocaleDateString()}</td></tr>`).join('')}
        </table>`;
    }

    overlay.innerHTML = `
        <div class="shop-modal">
            <div class="shop-header">
                <h2>🏆 Scoreboard</h2>
                <button class="close-shop" id="close-scores-btn">×</button>
            </div>
            <div style="padding:10px;text-align:center;">${tabsHtml}</div>
            <div class="shop-content" id="score-table-container" style="padding:10px;">
                ${buildScoreTable(gameId)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#close-scores-btn').addEventListener('click', () => {
        overlay.classList.add('hide');
        setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    });

    overlay.querySelectorAll('.score-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            overlay.querySelectorAll('.score-tab-btn').forEach(b => {
                b.style.background = '#eee';
                b.style.color = '#333';
            });
            this.style.background = '#ff6f00';
            this.style.color = '#fff';
            const tabId = this.getAttribute('data-tab');
            overlay.querySelector('#score-table-container').innerHTML = buildScoreTable(tabId);
        });
    });

    setTimeout(() => overlay.classList.add('show'), 50);
}

// Cave system state
let caveState = {
    isEnabled: false,
    bunniesInCave: new Set(),
    caveArea: { x: 30, y: 30, width: 250, height: 180 }
};

// Draggable bunnies state
let dragState = {
    isDragging: false,
    targetBunny: null,
    isParent: false,
    dragOffset: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
};
let bunnyPositions = {};
let parentBunnyPositions = {
    parent_black: { x: 0, y: 0, targetX: 0, targetY: 0, initialized: false },
    parent_white: { x: 0, y: 0, targetX: 0, targetY: 0, initialized: false, _lastLocalMove: 0 }
};
let bunnyAnimStates = {};
const ARROW_MOVE_SPEED = 8;

// UI Elements
let menuScreen, gameContainer;
let roomCodeBanner, roomCodeDisplay, roomCodeCopy;
let connectionStatus, connectionText, dayNightIndicator, dayNightIcon, dayNightText;
let carrotCount, babyName, hungerBar, happinessBar, energyBar, cleanlinessBar, loveBar;
let hungerValue, happinessValue, energyValue, cleanlinessValue, loveValue;
let gardenPlot, gardenQuality, harvestTimer;
let feedBtn, playBtn, sleepBtn, cleanBtn, petBtn;

// 2D Graphics Assets
let bunnySprites = {
    black: { adult: null, baby: null },
    white: { adult: null, baby: null }
};

// Animation system
let animations = new Map();
let particles = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🐰 Bunny Family 2D - Initializing...');
    
    initializeDOM();
    // DON'T initialize canvas yet - do it when switching to game view
    initializeSocketConnection();
    initializeEventListeners();
    // DON'T start game loop yet - start it when switching to game view
    
    console.log('✅ Lobby initialized successfully! Canvas will init when starting game.');
});

function initializeDOM() {
    // Cache all DOM references for performance
    const elementsToCache = [
        'menuScreen', 'gameContainer', 'roomCodeBanner', 'roomCodeDisplay', 'roomCodeCopy',
        'connectionStatus', 'connectionText', 'dayNightIndicator', 'dayNightIcon', 'dayNightText',
        'carrotCount', 'babyName', 'hungerBar', 'happinessBar', 'energyBar', 'cleanlinessBar', 'loveBar',
        'hungerValue', 'happinessValue', 'energyValue', 'cleanlinessValue', 'loveValue',
        'gardenPlot', 'gardenQuality', 'harvestTimer', 'feedBtn', 'playBtn', 'sleepBtn', 'cleanBtn', 'petBtn', 'caveBtn'
    ];
    
    elementsToCache.forEach(id => {
        cachedDOMRefs[id] = document.getElementById(id);
    });
    
    // Set legacy variables for backward compatibility
    menuScreen = cachedDOMRefs.menuScreen;
    gameContainer = cachedDOMRefs.gameContainer;
    roomCodeBanner = cachedDOMRefs.roomCodeBanner;
    roomCodeDisplay = cachedDOMRefs.roomCodeDisplay;
    roomCodeCopy = cachedDOMRefs.roomCodeCopy;
    connectionStatus = cachedDOMRefs.connectionStatus;
    connectionText = cachedDOMRefs.connectionText;
    dayNightIndicator = cachedDOMRefs.dayNightIndicator;
    dayNightIcon = cachedDOMRefs.dayNightIcon;
    dayNightText = cachedDOMRefs.dayNightText;
    carrotCount = cachedDOMRefs.carrotCount;
    babyName = cachedDOMRefs.babyName;
    hungerBar = cachedDOMRefs.hungerBar;
    happinessBar = cachedDOMRefs.happinessBar;
    energyBar = cachedDOMRefs.energyBar;
    cleanlinessBar = cachedDOMRefs.cleanlinessBar;
    loveBar = cachedDOMRefs.loveBar;
    hungerValue = cachedDOMRefs.hungerValue;
    happinessValue = cachedDOMRefs.happinessValue;
    energyValue = cachedDOMRefs.energyValue;
    cleanlinessValue = cachedDOMRefs.cleanlinessValue;
    loveValue = cachedDOMRefs.loveValue;
    gardenPlot = cachedDOMRefs.gardenPlot;
    gardenQuality = cachedDOMRefs.gardenQuality;
    harvestTimer = cachedDOMRefs.harvestTimer;
    feedBtn = cachedDOMRefs.feedBtn;
    playBtn = cachedDOMRefs.playBtn;
    sleepBtn = cachedDOMRefs.sleepBtn;
    cleanBtn = cachedDOMRefs.cleanBtn;
    petBtn = cachedDOMRefs.petBtn;
}

function initializeCanvas() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('❌ Canvas element not found!');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('❌ Canvas context not available!');
        return;
    }
    
    // Set canvas size
    resizeCanvas();
    
    // Enable smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Add enhanced canvas event listeners for dragging
    setupDragEventListeners();
    
    // CRITICAL FIX: Add canvas context lost/restored event handlers
    setupCanvasContextHandlers();
    
    // Initial canvas clear
    clearCanvas();
    
    console.log('🎨 Canvas initialized:', canvas.width, 'x', canvas.height);
}

// CRITICAL FIX: Canvas context lost/restored handlers
function setupCanvasContextHandlers() {
    if (!canvas) return;
    
    canvas.addEventListener('contextlost', function(event) {
        console.error('🚨 Canvas context lost!');
        event.preventDefault();
        
        // Stop game loop to prevent errors
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // Clear caches to free memory
        backgroundCache.clear();
        textMeasureCache.clear();
        activeParticles.length = 0;
        
        // Clean up event listeners
        cleanupDragEventListeners();
        
        console.log('🛑 Game loop stopped and caches cleared due to context loss');
    });
    
    canvas.addEventListener('contextrestored', function(event) {
        console.log('✅ Canvas context restored! Reinitializing...');
        
        // Reinitialize canvas context
        ctx = canvas.getContext('2d');
        if (ctx) {
            // Re-enable smooth rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Re-apply device pixel ratio scaling (use setTransform to avoid accumulation)
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width && canvas.height) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
            
            // Clear flags to force background redraw
            backgroundNeedsRedraw = true;
            dirtyBackground = true;
            
            // Restart game loop if we're in game phase
            if (currentPhase === 'game' && !animationId) {
                startGameLoop();
            }
            
            console.log('🎮 Canvas context restored and game loop restarted');
        }
    });
}

function resizeCanvas() {
    if (!canvas) {
        console.warn('Canvas not available for resizing');
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Ensure canvas has valid dimensions
    if (rect.width === 0 || rect.height === 0) {
        console.warn('Canvas has zero dimensions, using fallback size');
        // Fallback dimensions
        canvas.width = 800 * dpr;
        canvas.height = 600 * dpr;
        canvas.style.width = '800px';
        canvas.style.height = '600px';
    } else {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }
    
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset then scale (prevents accumulation)
    }
    
    // Clear caches on resize
    backgroundCache.clear();
    backgroundNeedsRedraw = true;
    dirtyBackground = true;
    
    // Adjust bunny positions proportionally on resize (don't reset — preserve server positions)
    if (gameState && gameState.babies) {
        gameState.babies.forEach((baby, index) => {
            const bunnyId = baby.id;
            if (!bunnyPositions[bunnyId]) {
                // Only initialize if not yet positioned
                bunnyPositions[bunnyId] = {
                    x: rect.width * (0.35 + (index * 0.15)),
                    y: rect.height * 0.65,
                    targetX: rect.width * (0.35 + (index * 0.15)),
                    targetY: rect.height * 0.65
                };
            }
        });
    }
    
    console.log('📐 Canvas resized to:', canvas.width, 'x', canvas.height, 'CSS:', canvas.style.width, 'x', canvas.style.height);
}

// Enhanced resize handler with DevTools detection
function handleWindowResize() {
    // Debounce resize events to avoid excessive calls
    if (window.resizeTimeout) {
        clearTimeout(window.resizeTimeout);
    }
    
    window.resizeTimeout = setTimeout(() => {
        console.log('🔧 Window resize detected, adjusting canvas...');
        
        // Force a more thorough resize
        if (canvas && currentPhase === 'game') {
            // Store current dimensions to detect changes
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;
            
            // Perform resize
            resizeCanvas();
            
            // If dimensions actually changed, force a render
            if (canvas.width !== oldWidth || canvas.height !== oldHeight) {
                console.log('📏 Canvas dimensions changed from', oldWidth, 'x', oldHeight, 'to', canvas.width, 'x', canvas.height);
                
                // Force immediate background redraw
                backgroundNeedsRedraw = true;
                dirtyBackground = true;
                
                // Force a render cycle
                if (ctx && currentPhase === 'game') {
                    render();
                }
            }
        }
        
        // Clear the timeout
        window.resizeTimeout = null;
    }, 100); // 100ms debounce
}

function clearCanvas() {
    if (!ctx || !canvas) {
        console.warn('Canvas or context not available for clearing');
        return;
    }
    
    // Use proper canvas dimensions
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
}

// ===== SOCKET.IO CONNECTION =====
function initializeSocketConnection() {
    socket = io();

    // Connection events
    socket.on('connect', onSocketConnect);
    socket.on('disconnect', onSocketDisconnect);
    socket.on('error', onSocketError);
    socket.on('connect_error', onSocketError);

    // Room management
    socket.on('room_created', onRoomCreated);
    socket.on('joined_room', onJoinedRoom);
    socket.on('partner_connected', onPartnerConnected);

    // Game state updates
    socket.on('game_state_update', onGameStateUpdate);
    socket.on('player_action', onPlayerAction);
    socket.on('game_event', onGameEvent);
    socket.on('action_failed', onActionFailed);

    // New feature events
    socket.on('daily_reward_status', onDailyRewardStatus);
    socket.on('daily_reward_claimed', onDailyRewardClaimed);
    socket.on('daily_reward_result', onDailyRewardClaimed);
    socket.on('achievements_data', onAchievementsData);
    socket.on('customization_saved', onCustomizationSaved);
    socket.on('customization_result', onCustomizationSaved);
    socket.on('memory_saved', onMemorySaved);
    socket.on('photo_captured', onMemorySaved);
    socket.on('minigame_started', onMinigameStarted);
    socket.on('minigame_completed', onMinigameCompleted);

    // New feature events
    socket.on('new_egg', onNewEgg);
    socket.on('baby_grew', onBabyGrew);
    socket.on('item_purchased', onItemPurchased);
    socket.on('purchase_failed', onPurchaseFailed);
    socket.on('item_used', (data) => {
        console.log('✅ Item used:', data);
        showMessage(data.message || 'Item used!', 'success');
    });
    socket.on('item_use_failed', (data) => {
        console.log('❌ Item use failed:', data);
        showMessage(data.message || 'Failed to use item', 'error');
        // Revert optimistic update - refetch inventory from game state
    });
    
    // Movement sync event
    socket.on('bunny_moved', onBunnyMoved);
    
    // Cave events
    socket.on('cave_entered', onCaveEntered);
    socket.on('cave_exited', onCaveExited);

    console.log('🔌 Socket.IO connection initialized');
}

// ===== SOCKET EVENT HANDLERS =====
function onSocketConnect() {
    console.log('✅ Connected to server');
    updateConnectionStatus('connected', 'Connected');
}

function onSocketDisconnect(reason) {
    console.log('❌ Disconnected from server:', reason);
    updateConnectionStatus('disconnected', 'Disconnected');
    
    // Show reconnection message
    showMessage('Connection lost. Attempting to reconnect...', 'error');
}

function onSocketError(error) {
    console.error('💥 Socket error:', error);
    updateConnectionStatus('disconnected', 'Connection Error');
    showMessage('Connection error. Please check your internet connection.', 'error');
}

function onRoomCreated(data) {
    console.log('🏠 Room created:', data);
    roomCode = data.roomCode;
    myPlayerId = data.playerId;
    myPlayerType = data.playerType;
    gameState = data.gameState;

    // Save session data
    const playerName = getPlayerName();
    const bunnyColor = getSelectedBunnyColor();
    saveSessionData(roomCode, playerName, bunnyColor);

    switchToGameView();
    showRoomCodeBanner(roomCode);
    updateConnectionStatus('waiting', 'Waiting for partner...');

    // Reset bunny positions so they get initialized fresh from game state
    bunnyPositions = {};

    // CRITICAL FIX: Force initial render after successful room creation
    // Use 300ms to ensure canvas is fully initialized (canvas init is 100ms)
    setTimeout(() => {
        if (canvas && ctx) {
            backgroundNeedsRedraw = true;
            dirtyBackground = true;
            render();
            console.log('🎨 Initial render completed after room creation');
        }
    }, 300);
}

function onJoinedRoom(data) {
    console.log('🚪 Joined room:', data);
    roomCode = data.roomCode;
    myPlayerId = data.playerId;
    myPlayerType = data.playerType;
    gameState = data.gameState;

    // The server may have reassigned our bunny color if the one we picked was taken
    const assignedColor = data.playerType;
    const requestedColor = getSelectedBunnyColor();
    if (assignedColor !== requestedColor) {
        showMessage(`The ${requestedColor} bunny was taken — you are the ${assignedColor} bunny!`, 'info');
        // Update local selection UI
        const colorOptions = document.querySelectorAll('.bunny-color-option');
        colorOptions.forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-color') === assignedColor) {
                opt.classList.add('selected');
            }
        });
    }

    // Save session data with the actually assigned color
    const playerName = getPlayerName();
    saveSessionData(roomCode, playerName, assignedColor);

    showMessage(`Joined room ${roomCode}!`, 'success');
    switchToGameView();
    updateConnectionStatus('connected', 'Connected');

    // CRITICAL FIX: Force initial render after successful room join
    setTimeout(() => {
        if (canvas && ctx) {
            render();
            console.log('🎨 Initial render completed after room join');
        }
    }, 200);
}

function onPartnerConnected(data) {
    console.log('👫 Partner connected!', data);
    const partnerName = (data && data.partnerName) || 'Partner';
    updateConnectionStatus('connected', `${partnerName} connected`);
    hideRoomCodeBanner();

    // Dismiss share code overlay if still open
    const shareOverlay = document.getElementById('shareCodeOverlay');
    if (shareOverlay) shareOverlay.remove();

    showMessage(`${partnerName} has joined! Time to care for your bunny family together!`, 'success');
}

function onGameStateUpdate(newGameState) {
    gameState = newGameState;

    // Debug: log wearables
    if (newGameState.babies) {
        newGameState.babies.forEach(b => {
            if (b.wearables && Object.keys(b.wearables).length > 0) {
                console.log(`[WEARABLES] ${b.name} wearing:`, JSON.stringify(b.wearables));
            }
        });
    }

    // Sync baby positions from server — only if not recently moved locally
    if (newGameState.babies) {
        newGameState.babies.forEach(baby => {
            if (baby.position) {
                const pos = getBunnyPosition(baby.id);
                const isDragging = dragState.isDragging && dragState.targetBunny?.id === baby.id;
                const recentlyMoved = pos._lastLocalMove && (Date.now() - pos._lastLocalMove < 3000);
                if (!isDragging && !recentlyMoved) {
                    pos.targetX = baby.position.x;
                    pos.targetY = baby.position.y;
                }
            }
        });
    }
    
    // Sync inventory from server game state — only show current player's items
    if (newGameState.shop && newGameState.shop.inventory && myPlayerId) {
        inventoryState = newGameState.shop.inventory[myPlayerId] || {};
    }
    
    // Sync scene based on baby sleeping status — but respect user scene lock
    if (newGameState.babies && Date.now() > sceneLockUntil) {
        const anySleeping = newGameState.babies.some(b => b.sleeping);
        if (anySleeping && currentScene === 'default') {
            // Only auto-switch to night from default scene, not from kitchen/playground/bathroom
            setScene('night');
        } else if (!anySleeping && currentScene === 'night') {
            setScene('default');
        }
    }

    // Sync parent bunny positions from server — only if not recently moved locally
    if (newGameState.parentPositions) {
        ['parent_black', 'parent_white'].forEach(pid => {
            if (newGameState.parentPositions[pid]) {
                const pp = parentBunnyPositions[pid];
                const isDragging = dragState.isDragging && dragState.isParent && dragState.targetBunny?.id === pid;
                const recentlyMoved = pp._lastLocalMove && (Date.now() - pp._lastLocalMove < 3000);
                // Also skip if football game is active and this is my bunny
                const myParent = (myPlayerType === 'black' && pid === 'parent_black') || (myPlayerType === 'white' && pid === 'parent_white');
                const footballActive = typeof footballGame !== 'undefined' && footballGame.active && myParent;
                if (!isDragging && !recentlyMoved && !footballActive) {
                    pp.targetX = newGameState.parentPositions[pid].x;
                    pp.targetY = newGameState.parentPositions[pid].y;
                }
            }
        });
    }

    // Auto-select first baby if none selected
    if (!selectedBabyId && newGameState.babies && newGameState.babies.length > 0) {
        selectedBabyId = newGameState.babies[0].id;
    }

    updateGameUI();

    // CRITICAL FIX: Force render when game state updates
    if (currentPhase === 'game' && canvas && ctx) {
        render();
    }
}

function onPlayerAction(data) {
    // Create visual effect for the action
    createActionEffect(data.action, data.playerId);

    // Sync scene from partner's action (with lock)
    if (data.playerId !== myPlayerId) {
        if (data.action === 'feed') setScene('kitchen', { lock: true });
        else if (data.action === 'play') setScene('playground', { lock: true });
        else if (data.action === 'clean') setScene('bathroom', { lock: true });
        else if (data.action === 'sleep') setScene('cave', { lock: true });
    }

    // Handle special actions
    if (data.action === 'hatch_egg' && data.progressGain) {
        showMessage(`Egg progress: ${data.progress}% (+${data.progressGain})`, 'info');
    }
    
    if (data.cooperativeBonus) {
        showCooperativeBonus(data.action);
    }
}

function onGameEvent(data) {
    console.log('🎉 Game event:', data);
    
    switch (data.type) {
        case 'baby_grew':
            showGrowthCelebration(data);
            break;
        case 'egg_hatched':
            showHatchCelebration(data);
            break;
        case 'cooperative_bonus':
            showCooperativeBonus(data.action);
            break;
        case 'cycle_changed':
            updateDayNightCycle(data.newCycle);
            showMessage(data.message, 'info');
            break;
        case 'weather':
            showMessage(data.message, 'info');
            break;
        case 'achievement_unlocked':
            showAchievementNotification(data);
            break;
        case 'daily_reward_claimed':
            showMessage(data.message, 'success');
            break;
    }
}

function onActionFailed(data) {
    console.log('❌ Action failed:', data);
    showMessage(data.message, 'error');
}

// New feature handlers
function onDailyRewardStatus(data) {
    console.log('🎁 Daily reward status:', data);
    // Handle daily reward UI updates
}

function onDailyRewardClaimed(data) {
    console.log('🎁 Daily reward claimed:', data);
    showMessage(`Daily reward claimed! Streak: ${data.streak}`, 'success');
}

function onAchievementsData(data) {
    console.log('🏆 Achievements data:', data);
    // Handle achievements display
}

function onCustomizationSaved(data) {
    console.log('🎨 Customization saved:', data);
    if (data.success) {
        showMessage('Customization saved!', 'success');
    }
}

function onMemorySaved(data) {
    console.log('📸 Memory saved:', data);
    if (data.success) {
        showMessage('Memory saved!', 'success');
    }
}

function onMinigameStarted(data) {
    console.log('🎮 Mini-game started:', data);
    // Handle mini-game UI
}

function onMinigameCompleted(data) {
    console.log('🎮 Mini-game completed:', data);
    showMessage(data.message, 'success');
}

// New feature event handlers
function onNewEgg(data) {
    console.log('🥚 New egg appeared:', data);
    
    let message = "🥚 A new egg appeared! Your family is growing!";
    let notificationType = 'egg';
    
    // Special messages for special egg types
    if (data.eggType === 'golden') {
        message = "✨🥚 A golden egg has appeared! How magical! ✨";
        notificationType = 'golden_egg';
    } else if (data.eggType === 'twin') {
        message = "👯🥚 Twins egg detected! Double the love! 👯";
        notificationType = 'twin_egg';
    } else if (data.eggType === 'rainbow') {
        message = "🌈🥚 A rare rainbow egg! Incredible luck! 🌈";
        notificationType = 'rainbow_egg';
    }
    
    showEggNotification(message, notificationType, data);
}

function onBabyGrew(data) {
    console.log('👶 Baby grew:', data);

    // Normalize — server sends babyName/newStage at top level, or baby sub-object
    const celebrationData = {
        babyName: data.babyName || (data.baby && data.baby.name) || 'Baby',
        newStage: data.newStage || (data.baby && data.baby.stage) || 'grown'
    };
    showGrowthCelebration(celebrationData);
    const baby = data.baby || data;
    
    // Update cached game state if available
    if (gameState && gameState.babies) {
        const idx = gameState.babies.findIndex(b => b.id === (baby && baby.id));
        if (idx !== -1 && baby) gameState.babies[idx] = { ...gameState.babies[idx], ...baby };
    }
    
    showMessage(`🎉 ${baby.name || 'Baby'} grew to ${baby.stage}! 🎉`, 'success');
}

function onItemPurchased(data) {
    console.log('🛒 Item purchased:', data);
    
    // Backend sends { item: {name, cost, ...}, quantity, remainingCarrots }
    const itemId = data.itemId || (data.item ? shopState.items.find(i => data.item.name && data.item.name.toLowerCase().includes(i.name.toLowerCase()))?.id : null);
    const shopItem = shopState.items.find(i => i.id === itemId) || (data.item ? shopState.items.find(i => data.item.name && data.item.name.toLowerCase().includes(i.name.toLowerCase())) : null);
    
    if (shopItem) {
        showPurchaseSuccess(shopItem, data);
    }
    
    // Update inventory
    if (itemId) {
        inventoryState[itemId] = (inventoryState[itemId] || 0) + 1;
    } else if (data.item) {
        // fallback: use first matching shop item
        const fallbackItem = shopState.items.find(i => data.item.name && data.item.name.includes(i.name));
        if (fallbackItem) inventoryState[fallbackItem.id] = (inventoryState[fallbackItem.id] || 0) + 1;
    }
    
    // Update carrot count
    if (data.remainingCarrots !== undefined) {
        updateCarrotDisplay(data.remainingCarrots);
    }
    
    // Refresh basket UI if open
    updateBasketUI();
    // Refresh shop carrot count if open
    updateShopCarrotCount();
}

function onPurchaseFailed(data) {
    console.log('❌ Purchase failed:', data);
    showMessage(data.message || 'Purchase failed!', 'error');
}

function onBunnyMoved(data) {
    if (!gameState) return;

    // Handle parent bunny movements
    if (data.babyId === 'parent_black' || data.babyId === 'parent_white') {
        if (parentBunnyPositions[data.babyId]) {
            parentBunnyPositions[data.babyId].targetX = data.x;
            parentBunnyPositions[data.babyId].targetY = data.y;
        }
        return;
    }

    // Update game state position
    const baby = gameState.babies.find(b => b.id === data.babyId);
    if (baby) {
        if (!baby.position) baby.position = { x: 400, y: 300 };
        baby.position.x = data.x;
        baby.position.y = data.y;
    }

    // Update renderer positions (this is what the canvas actually reads)
    const pos = getBunnyPosition(data.babyId);
    pos.targetX = data.x;
    pos.targetY = data.y;
}

function onCaveEntered(data) {
    console.log('🏔️ Bunny entered cave:', data);
    
    if (!gameState) return;
    
    const baby = gameState.babies.find(b => b.id === data.babyId);
    if (baby) {
        baby.inCave = true;
        baby.position = baby.position || { x: 400, y: 300 };
        baby.position.x = caveState.caveArea.x + caveState.caveArea.width / 2;
        baby.position.y = caveState.caveArea.y + caveState.caveArea.height / 2;
        caveState.bunniesInCave.add(data.babyId);
        
        // Show visual feedback
        if (data.movedBy !== myPlayerId) {
            showFloatingEffect(baby.position.x, baby.position.y, '🏔️');
        }
    }
}

function onCaveExited(data) {
    console.log('🌅 Bunny exited cave:', data);
    
    if (!gameState) return;
    
    const baby = gameState.babies.find(b => b.id === data.babyId);
    if (baby) {
        baby.inCave = false;
        if (data.x !== undefined && data.y !== undefined) {
            baby.position = baby.position || { x: 400, y: 300 };
            baby.position.x = data.x;
            baby.position.y = data.y;
        }
        caveState.bunniesInCave.delete(data.babyId);
        
        // Show visual feedback
        if (data.movedBy !== myPlayerId) {
            showFloatingEffect(baby.position.x, baby.position.y, '🌅');
        }
    }
}

// ===== UI EVENT LISTENERS =====
function initializeEventListeners() {
    // Load saved session data
    loadSessionData();
    
    // Menu buttons
    document.getElementById('createRoomBtn').addEventListener('click', createRoom);
    document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
    document.getElementById('resumeGameBtn').addEventListener('click', resumeGame);
    document.getElementById('roomCodeInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinRoom();
        }
    });

    // NEW: Bunny color selection
    const colorOptions = document.querySelectorAll('.bunny-color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove selected class from all options
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            // Add selected class to clicked option
            this.classList.add('selected');
            
            // Save selection to localStorage
            const selectedColor = this.getAttribute('data-color');
            savePlayerSettings(getPlayerName(), selectedColor);
        });
    });

    // Room code copy button
    if (roomCodeCopy) {
        roomCodeCopy.addEventListener('click', copyRoomCodeToClipboard);
    }
    
    // NEW: Arrow key movement
    document.addEventListener('keydown', handleArrowKeyMovement);

    // Mini-game keyboard tracking
    document.addEventListener('keydown', function(e) {
        keysPressed[e.key] = true;
        // Route to active mini-game
        if (miniGameState.activeGame) {
            if (handleMiniGameKeydown(e.key)) {
                e.preventDefault();
            }
            // Prevent arrow keys from scrolling/moving bunnies during mini-games
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
                e.preventDefault();
            }
        }
    });
    document.addEventListener('keyup', function(e) {
        keysPressed[e.key] = false;
    });

    // Action buttons
    feedBtn.addEventListener('click', () => performAction('feed'));
    playBtn.addEventListener('click', () => performAction('play'));
    sleepBtn.addEventListener('click', () => performAction('sleep'));
    cleanBtn.addEventListener('click', () => performAction('clean'));
    petBtn.addEventListener('click', () => performAction('pet'));
    cachedDOMRefs.caveBtn.addEventListener('click', () => toggleCave());
    
    // Shop button
    const shopBtn = document.getElementById('shopBtn');
    if (shopBtn) {
        shopBtn.addEventListener('click', toggleShop);
    }
    
    const basketBtn = document.getElementById('basketBtn');
    if (basketBtn) {
        basketBtn.addEventListener('click', toggleBasket);
    }

    const minigameBtn = document.getElementById('minigameBtn');
    if (minigameBtn) {
        minigameBtn.addEventListener('click', toggleMiniGameMenu);
    }

    // Garden interaction
    gardenPlot.addEventListener('click', harvestCarrots);

    // Canvas interactions - defer until canvas exists
    // These are added in initializeCanvas() instead

    // Window events - Add more robust resize handling
    window.addEventListener('resize', handleWindowResize);
    
    // Also listen for DevTools open/close events
    window.addEventListener('orientationchange', handleWindowResize);
    
    // Removed MutationObserver — was firing handleWindowResize on every DOM change, causing lag
    if (false && window.MutationObserver) {
        const resizeObserver = new MutationObserver(handleWindowResize);
        resizeObserver.observe(document.body, { attributes: true, subtree: true });
    }
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });

    // Arrow key movement — handled by handleArrowKeyMovement()

    console.log('🎮 Event listeners initialized');
}

// ===== SESSION PERSISTENCE =====
function savePlayerSettings(playerName, bunnyColor) {
    try {
        localStorage.setItem('bunnyGame_playerName', playerName || '');
        localStorage.setItem('bunnyGame_bunnyColor', bunnyColor || 'white');
        console.log('📝 Player settings saved:', { playerName, bunnyColor });
    } catch (error) {
        console.warn('Failed to save player settings:', error);
    }
}

function saveSessionData(roomCode, playerName, bunnyColor) {
    try {
        localStorage.setItem('bunnyGame_lastRoomCode', roomCode || '');
        savePlayerSettings(playerName, bunnyColor);
        console.log('💾 Session data saved:', { roomCode, playerName, bunnyColor });
    } catch (error) {
        console.warn('Failed to save session data:', error);
    }
}

function loadSessionData() {
    try {
        const savedRoomCode = localStorage.getItem('bunnyGame_lastRoomCode');
        const savedPlayerName = localStorage.getItem('bunnyGame_playerName');
        const savedBunnyColor = localStorage.getItem('bunnyGame_bunnyColor');
        
        // Populate player name input
        const playerNameInput = document.getElementById('playerNameInput');
        if (playerNameInput && savedPlayerName) {
            playerNameInput.value = savedPlayerName;
        }
        
        // Set bunny color selection
        if (savedBunnyColor) {
            const colorOptions = document.querySelectorAll('.bunny-color-option');
            colorOptions.forEach(option => {
                option.classList.remove('selected');
                if (option.getAttribute('data-color') === savedBunnyColor) {
                    option.classList.add('selected');
                }
            });
        }
        
        // Show resume button if we have a saved room
        if (savedRoomCode && savedPlayerName) {
            const resumeBtn = document.getElementById('resumeGameBtn');
            if (resumeBtn) {
                resumeBtn.style.display = 'inline-block';
                resumeBtn.innerHTML = `🔄 Resume Game (${savedRoomCode})`;
            }
        }
        
        console.log('📂 Session data loaded:', { savedRoomCode, savedPlayerName, savedBunnyColor });
    } catch (error) {
        console.warn('Failed to load session data:', error);
    }
}

function getPlayerName() {
    const input = document.getElementById('playerNameInput');
    return input ? input.value.trim() || 'Player' : 'Player';
}

function getSelectedBunnyColor() {
    const selectedOption = document.querySelector('.bunny-color-option.selected');
    return selectedOption ? selectedOption.getAttribute('data-color') || 'white' : 'white';
}

// ===== ARROW KEY MOVEMENT =====
function handleArrowKeyMovement(event) {
    // Only handle arrow keys when in game mode and not typing in an input
    if (currentPhase !== 'game' || event.target.tagName === 'INPUT') {
        return;
    }

    // When any mini-game is active, arrow keys are handled by the mini-game
    if ((footballGame.active || miniGameState.activeGame) && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', ' '].includes(event.key)) {
        event.preventDefault();
        return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        
        if (!gameState || !selectedBabyId) return;
        
        const baby = gameState.babies.find(b => b.id === selectedBabyId);
        if (!baby) return;
        
        let deltaX = 0;
        let deltaY = 0;
        
        switch (event.key) {
            case 'ArrowLeft':
                deltaX = -ARROW_MOVE_SPEED;
                break;
            case 'ArrowRight':
                deltaX = ARROW_MOVE_SPEED;
                break;
            case 'ArrowUp':
                deltaY = -ARROW_MOVE_SPEED;
                break;
            case 'ArrowDown':
                deltaY = ARROW_MOVE_SPEED;
                break;
        }
        
        // Calculate new position
        const arrowRect = canvas.getBoundingClientRect();
        const newX = Math.max(50, Math.min((baby.position?.x || 400) + deltaX, arrowRect.width - 50));
        const newY = Math.max(50, Math.min((baby.position?.y || 300) + deltaY, arrowRect.height - 50));
        
        // Update local position immediately for responsiveness
        if (!baby.position) baby.position = { x: 400, y: 300 };
        baby.position.x = newX;
        baby.position.y = newY;
        
        // Also update bunnyPositions (used by canvas renderer)
        const bpos = getBunnyPosition(selectedBabyId);
        bpos.x = newX;
        bpos.y = newY;
        bpos.targetX = newX;
        bpos.targetY = newY;
        bpos._lastLocalMove = Date.now();

        // Send move to server
        socket.emit('move_bunny', {
            babyId: selectedBabyId,
            x: newX,
            y: newY,
            timestamp: Date.now()
        });
        
        console.log(`🏃 Moving ${selectedBabyId} to:`, newX, newY);
    }
}

function resumeGame() {
    try {
        const savedRoomCode = localStorage.getItem('bunnyGame_lastRoomCode');
        const savedPlayerName = localStorage.getItem('bunnyGame_playerName');
        const savedBunnyColor = localStorage.getItem('bunnyGame_bunnyColor');
        
        if (savedRoomCode) {
            // Populate inputs before calling joinRoom
            const roomCodeInput = document.getElementById('roomCodeInput');
            if (roomCodeInput) roomCodeInput.value = savedRoomCode;
            
            const nameInput = document.getElementById('playerNameInput');
            if (nameInput && savedPlayerName) nameInput.value = savedPlayerName;
            
            // Set bunny color selection
            if (savedBunnyColor) {
                const colorOptions = document.querySelectorAll('.bunny-color-option');
                colorOptions.forEach(opt => {
                    opt.classList.remove('selected');
                    if (opt.getAttribute('data-color') === savedBunnyColor) {
                        opt.classList.add('selected');
                    }
                });
            }
            
            // Join the saved room
            joinRoom();
        } else {
            showMessage('No saved game found!', 'error');
        }
    } catch (error) {
        console.error('Failed to resume game:', error);
        showMessage('Failed to resume game!', 'error');
    }
}

// ===== CAVE FUNCTIONALITY =====
function toggleCave() {
    if (!gameState || !selectedBabyId) {
        showMessage('Please select a bunny first!', 'error');
        return;
    }
    
    const baby = gameState.babies.find(b => b.id === selectedBabyId);
    if (!baby) {
        showMessage('Selected bunny not found!', 'error');
        return;
    }
    
    const isInCave = baby.inCave || false;
    
    if (isInCave) {
        // Remove from cave
        moveBunnyFromCave(selectedBabyId);
    } else {
        // Move to cave
        moveBunnyToCave(selectedBabyId);
    }
}

function moveBunnyToCave(babyId) {
    if (!gameState) return;
    
    const baby = gameState.babies.find(b => b.id === babyId);
    if (!baby) return;
    
    // Animate movement to cave
    const caveX = caveState.caveArea.x + caveState.caveArea.width / 2;
    const caveY = caveState.caveArea.y + caveState.caveArea.height / 2;
    
    // Update local state immediately
    baby.inCave = true;
    baby.position = { x: caveX, y: caveY };
    caveState.bunniesInCave.add(babyId);
    
    // Emit to server
    socket.emit('cave_entered', {
        babyId: babyId,
        timestamp: Date.now()
    });
    
    showMessage(`${baby.name || 'Baby'} entered the cozy cave! 🏔️`, 'success');
    console.log(`🏔️ ${babyId} entered cave`);
}

function moveBunnyFromCave(babyId) {
    if (!gameState) return;
    
    const baby = gameState.babies.find(b => b.id === babyId);
    if (!baby) return;
    
    // Move to default position outside cave
    const newX = 400 + Math.random() * 200 - 100; // Random position near center
    const newY = 300 + Math.random() * 100 - 50;
    
    // Update local state immediately
    baby.inCave = false;
    baby.position = { x: newX, y: newY };
    caveState.bunniesInCave.delete(babyId);
    
    // Emit to server
    socket.emit('cave_exited', {
        babyId: babyId,
        x: newX,
        y: newY,
        timestamp: Date.now()
    });
    
    showMessage(`${baby.name || 'Baby'} left the cozy cave! 🌅`, 'success');
    console.log(`🌅 ${babyId} exited cave`);
}

// ===== ROOM MANAGEMENT =====
function createRoom() {
    if (!socket || !socket.connected) {
        showMessage('Not connected to server. Please refresh the page.', 'error');
        return;
    }
    
    const playerName = getPlayerName();
    const bunnyColor = getSelectedBunnyColor();
    
    if (!playerName || playerName.length === 0) {
        showMessage('Please enter your name!', 'error');
        return;
    }
    
    showMessage('Creating room...', 'info');
    socket.emit('create_room', {
        playerName: playerName,
        bunnyColor: bunnyColor
    });
    
    // Save settings
    savePlayerSettings(playerName, bunnyColor);
}

function joinRoom() {
    const roomCodeInput = document.getElementById('roomCodeInput');
    const code = roomCodeInput.value.trim().toUpperCase();
    
    if (!code) {
        showMessage('Please enter a room code.', 'error');
        return;
    }
    
    if (code.length !== 6) {
        showMessage('Room code must be 6 characters long.', 'error');
        return;
    }
    
    const playerName = getPlayerName();
    const bunnyColor = getSelectedBunnyColor();
    
    if (!playerName || playerName.length === 0) {
        showMessage('Please enter your name!', 'error');
        return;
    }
    
    if (!socket || !socket.connected) {
        showMessage('Not connected to server. Please refresh the page.', 'error');
        return;
    }
    
    showMessage('Joining room...', 'info');
    socket.emit('join_room', { 
        roomCode: code,
        playerName: playerName,
        bunnyColor: bunnyColor
    });
    
    // Save settings
    savePlayerSettings(playerName, bunnyColor);
}

function switchToGameView() {
    console.log('🎮 Switching to game view...');
    menuScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
    currentPhase = 'game';
    
    // CRITICAL FIX: Properly initialize canvas when switching to game view
    setTimeout(() => {
        initializeCanvas(); // Initialize canvas (setTransform prevents DPR accumulation)
        updateGameUI();
        
        // Ensure render loop is running
        if (!animationId) {
            startGameLoop();
        }
        
        console.log('✅ Game view activated, canvas ready:', canvas.width, 'x', canvas.height);
    }, 100);
}

// ===== GAME ACTIONS =====
let lastActionTime = {};
const ACTION_COOLDOWN = 500; // 500ms between same action

function performAction(action) {
    const now = Date.now();
    if (lastActionTime[action] && now - lastActionTime[action] < ACTION_COOLDOWN) {
        return; // Cooldown active
    }
    lastActionTime[action] = now;
    
    if (!socket || !socket.connected) {
        showMessage('Not connected to server.', 'error');
        return;
    }
    
    if (!gameState) {
        showMessage('Game state not loaded yet.', 'error');
        return;
    }
    
    // Find the selected baby
    const baby = gameState.babies.find(b => b.id === selectedBabyId);
    if (!baby) {
        showMessage('No baby selected.', 'error');
        return;
    }
    
    // Send action to server
    const actionMap = {
        'feed': 'feed_baby',
        'play': 'play_with_baby',
        'sleep': 'sleep_baby',
        'clean': 'clean_baby',
        'pet': 'pet_baby'
    };
    
    const socketAction = actionMap[action];
    if (socketAction) {
        socket.emit(socketAction, { babyId: selectedBabyId });
        
        // Switch scene based on action (with lock so it doesn't get auto-overridden)
        if (action === 'feed') {
            setScene('kitchen', { lock: true });
        } else if (action === 'play') {
            setScene('playground', { lock: true });
        } else if (action === 'sleep') {
            setScene('cave', { lock: true }); // sleep now goes to a cozy cave scene
        } else if (action === 'clean') {
            setScene('bathroom', { lock: true });
        }
        
        // Visual feedback
        createActionEffect(action, myPlayerId);
    }
}

function harvestCarrots() {
    if (!socket || !socket.connected) {
        showMessage('Not connected to server.', 'error');
        return;
    }
    
    socket.emit('harvest_carrots');
}

// ===== ENHANCED CANVAS INTERACTIONS WITH DRAGGING =====
function setupDragEventListeners() {
    if (!canvas) return;
    
    // HIGH FIX: Remove existing event listeners first to prevent memory leaks
    canvas.removeEventListener('mousedown', onPointerDown);
    canvas.removeEventListener('mousemove', onPointerMove);
    canvas.removeEventListener('mouseup', onPointerUp);
    canvas.removeEventListener('mouseleave', onPointerUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
    
    // Mouse events
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp); // End drag if mouse leaves canvas
    
    // Touch events
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    
    console.log('🎮 Drag event listeners setup complete');
}

// HIGH FIX: Function to clean up event listeners when switching back to lobby/menu
function cleanupDragEventListeners() {
    if (!canvas) return;
    
    canvas.removeEventListener('mousedown', onPointerDown);
    canvas.removeEventListener('mousemove', onPointerMove);
    canvas.removeEventListener('mouseup', onPointerUp);
    canvas.removeEventListener('mouseleave', onPointerUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('touchcancel', onTouchEnd);
    
    // Reset drag state
    dragState.isDragging = false;
    dragState.targetBunny = null;
    
    console.log('🧹 Drag event listeners cleaned up');
}

function getCanvasCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    // CRITICAL FIX: Account for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;
    
    const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0);
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function onPointerDown(event) {
    const coords = getCanvasCoordinates(event);
    startDrag(coords.x, coords.y, 'mouse');
}

function onPointerMove(event) {
    const coords = getCanvasCoordinates(event);
    updateDrag(coords.x, coords.y);
}

function onPointerUp(event) {
    endDrag();
}

function onTouchStart(event) {
    event.preventDefault();
    const coords = getCanvasCoordinates(event);
    startDrag(coords.x, coords.y, 'touch');
}

function onTouchMove(event) {
    event.preventDefault();
    const coords = getCanvasCoordinates(event);
    updateDrag(coords.x, coords.y);
}

function onTouchEnd(event) {
    event.preventDefault();
    endDrag();
}

function startDrag(x, y, inputType) {
    // Intercept clicks for active mini-games
    if (miniGameState.activeGame) {
        handleMiniGameClick(x, y);
        return;
    }

    // Intercept clicks when the luxury shop scene is open
    if (currentScene === 'shop' && shopState.isOpen) {
        if (handleShopClick(x, y)) return;
    }

    if (!gameState || !gameState.babies) return;

    const clickedBaby = findBunnyAt(x, y);

    if (clickedBaby) {
        // Start dragging this baby bunny
        dragState.isDragging = true;
        dragState.targetBunny = clickedBaby;
        dragState.isParent = false;
        dragState.startPosition = { x, y };
        dragState.currentPosition = { x, y };

        // Calculate offset from bunny center
        const bunnyPos = getBunnyPosition(clickedBaby.id);
        dragState.dragOffset = {
            x: x - bunnyPos.x,
            y: y - bunnyPos.y
        };

        // Set baby as selected
        selectedBabyId = clickedBaby.id;
        updateBabySelection();

        // Initialize bunny animation state
        if (!bunnyAnimStates[clickedBaby.id]) {
            bunnyAnimStates[clickedBaby.id] = {
                scale: 1.0,
                targetScale: 1.2,
                bounceOffset: 0,
                bounceSpeed: 0,
                isBeingDragged: true
            };
        }
        bunnyAnimStates[clickedBaby.id].isBeingDragged = true;
        bunnyAnimStates[clickedBaby.id].targetScale = 1.2;
        bunnyAnimStates[clickedBaby.id].bounceSpeed = -8; // Initial pickup bounce

        // Create pickup effect
        createPickupEffect(x, y);

        return;
    }

    // Check for parent bunny drag
    const clickedParent = findParentBunnyAt(x, y);
    if (clickedParent) {
        dragState.isDragging = true;
        dragState.targetBunny = { id: clickedParent.id, type: clickedParent.type };
        dragState.isParent = true;
        dragState.startPosition = { x, y };
        dragState.currentPosition = { x, y };

        const parentPos = parentBunnyPositions[clickedParent.id];
        dragState.dragOffset = {
            x: x - parentPos.x,
            y: y - parentPos.y
        };

        // Initialize animation state for parent
        if (!bunnyAnimStates[clickedParent.id]) {
            bunnyAnimStates[clickedParent.id] = {
                scale: 1.0,
                targetScale: 1.15,
                bounceOffset: 0,
                bounceSpeed: 0,
                isBeingDragged: true
            };
        }
        bunnyAnimStates[clickedParent.id].isBeingDragged = true;
        bunnyAnimStates[clickedParent.id].targetScale = 1.15;
        bunnyAnimStates[clickedParent.id].bounceSpeed = -6;

        createPickupEffect(x, y);
        return;
    }

    // If not dragging a bunny, check for other interactions
    handleNonDragInteraction(x, y);
}

function updateDrag(x, y) {
    if (!dragState.isDragging || !dragState.targetBunny) return;

    // Update current position
    dragState.currentPosition = { x, y };

    // Calculate new bunny position with offset
    const newX = x - dragState.dragOffset.x;
    const newY = y - dragState.dragOffset.y;

    // Apply boundaries to keep bunny within canvas
    const rect = canvas.getBoundingClientRect();
    const margin = 40;
    const boundedX = Math.max(margin, Math.min(rect.width - margin, newX));
    const boundedY = Math.max(margin, Math.min(rect.height - margin, newY));

    const bunnyId = dragState.targetBunny.id;

    if (dragState.isParent) {
        // Update parent bunny position
        const lerpFactor = 0.8;
        parentBunnyPositions[bunnyId].targetX = boundedX;
        parentBunnyPositions[bunnyId].targetY = boundedY;
        parentBunnyPositions[bunnyId].x = lerp(parentBunnyPositions[bunnyId].x, boundedX, lerpFactor);
        parentBunnyPositions[bunnyId].y = lerp(parentBunnyPositions[bunnyId].y, boundedY, lerpFactor);
        parentBunnyPositions[bunnyId]._lastLocalMove = Date.now();

        // Sync to server during drag (throttled to ~10fps)
        const now = Date.now();
        if (!updateDrag._lastEmit || now - updateDrag._lastEmit > 100) {
            updateDrag._lastEmit = now;
            if (socket && socket.connected) {
                socket.emit('move_bunny', {
                    babyId: bunnyId,
                    x: parentBunnyPositions[bunnyId].x,
                    y: parentBunnyPositions[bunnyId].y,
                    timestamp: now
                });
            }
        }
    } else {
        // Update baby bunny position
        if (!bunnyPositions[bunnyId]) {
            bunnyPositions[bunnyId] = getBunnyPosition(bunnyId);
        }

        // Smooth following with lerp
        const lerpFactor = 0.8;
        bunnyPositions[bunnyId].targetX = boundedX;
        bunnyPositions[bunnyId].targetY = boundedY;
        bunnyPositions[bunnyId].x = lerp(bunnyPositions[bunnyId].x, boundedX, lerpFactor);
        bunnyPositions[bunnyId].y = lerp(bunnyPositions[bunnyId].y, boundedY, lerpFactor);
        bunnyPositions[bunnyId]._lastLocalMove = Date.now();

        // Also update baby.position in gameState for consistency
        if (gameState && gameState.babies) {
            const baby = gameState.babies.find(b => b.id === bunnyId);
            if (baby) {
                if (!baby.position) baby.position = { x: 400, y: 300 };
                baby.position.x = bunnyPositions[bunnyId].x;
                baby.position.y = bunnyPositions[bunnyId].y;
            }
        }

        // Sync to server during drag (throttled to ~10fps)
        const now = Date.now();
        if (!updateDrag._lastEmit || now - updateDrag._lastEmit > 100) {
            updateDrag._lastEmit = now;
            if (socket && socket.connected) {
                socket.emit('move_bunny', {
                    babyId: bunnyId,
                    x: bunnyPositions[bunnyId].x,
                    y: bunnyPositions[bunnyId].y,
                    timestamp: now
                });
            }
        }
    }
}

function endDrag() {
    if (!dragState.isDragging || !dragState.targetBunny) return;

    const bunnyId = dragState.targetBunny.id;

    // Detect tap (short click, minimal movement) — tap eggs to hatch
    const dx = dragState.currentPosition.x - dragState.startPosition.x;
    const dy = dragState.currentPosition.y - dragState.startPosition.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    if (dragDist < 10 && !dragState.isParent) {
        const baby = gameState && gameState.babies ? gameState.babies.find(b => b.id === bunnyId) : null;
        if (baby && baby.stage === 'egg') {
            performAction('pet');
        }
    }

    // Update animation state for drop
    if (bunnyAnimStates[bunnyId]) {
        bunnyAnimStates[bunnyId].isBeingDragged = false;
        bunnyAnimStates[bunnyId].targetScale = 1.0;
        bunnyAnimStates[bunnyId].bounceSpeed = -4; // Drop bounce
    }

    if (dragState.isParent) {
        // Create drop effect for parent
        createDropEffect(parentBunnyPositions[bunnyId].x, parentBunnyPositions[bunnyId].y);

        // Emit final position to server
        if (socket && socket.connected) {
            socket.emit('move_bunny', {
                babyId: bunnyId,
                x: parentBunnyPositions[bunnyId].x,
                y: parentBunnyPositions[bunnyId].y,
                timestamp: Date.now()
            });
        }
    } else {
        // Create drop effect
        if (bunnyPositions[bunnyId]) {
            createDropEffect(bunnyPositions[bunnyId].x, bunnyPositions[bunnyId].y);
        }

        // Emit final position to server
        if (bunnyPositions[bunnyId] && socket && socket.connected) {
            socket.emit('move_bunny', {
                babyId: bunnyId,
                x: bunnyPositions[bunnyId].x,
                y: bunnyPositions[bunnyId].y,
                timestamp: Date.now()
            });
        }

        // Check if bunny was dropped on a special interaction area
        checkDropInteractions();
    }

    // Reset drag state
    dragState.isDragging = false;
    dragState.targetBunny = null;
    dragState.isParent = false;
}

function handleNonDragInteraction(x, y) {
    // Check if clicked on parent bunnies for interaction
    const parentBunny = findParentBunnyAt(x, y);
    if (parentBunny) {
        createHeartEffect(x, y);
    }
}

function checkDropInteractions() {
    if (!dragState.targetBunny || !bunnyPositions[dragState.targetBunny.id]) return;
    
    const bunnyPos = bunnyPositions[dragState.targetBunny.id];
    
    // Check if dropped on special areas (feeding area, play area, etc.)
    // This could trigger special interactions
    
    // For now, just create a settle effect
    createSettleEffect(bunnyPos.x, bunnyPos.y);
}

// ===== BUNNY POSITION MANAGEMENT =====
function getBunnyPosition(bunnyId) {
    if (!bunnyPositions[bunnyId]) {
        // Initialize bunny position based on default layout or server position
        const baby = gameState && gameState.babies ? gameState.babies.find(b => b.id === bunnyId) : null;
        const babyIndex = gameState && gameState.babies ? Math.max(0, gameState.babies.findIndex(b => b.id === bunnyId)) : 0;
        const rect = canvas ? canvas.getBoundingClientRect() : { width: 800, height: 600 };
        const w = rect.width || 800;
        const h = rect.height || 600;

        // Use server position if available, otherwise calculate default
        let initX, initY;
        if (baby && baby.position && baby.position.x !== 400) {
            initX = baby.position.x;
            initY = baby.position.y;
        } else {
            initX = w * (0.35 + (babyIndex * 0.15));
            initY = h * 0.65;
        }

        bunnyPositions[bunnyId] = {
            x: initX,
            y: initY,
            targetX: initX,
            targetY: initY
        };
    }
    return bunnyPositions[bunnyId];
}

function updateBunnyPositions(deltaTime) {
    if (!gameState || !gameState.babies) return;
    
    gameState.babies.forEach((baby, index) => {
        const bunnyId = baby.id;
        let position = bunnyPositions[bunnyId];
        
        if (!position) {
            position = getBunnyPosition(bunnyId);
        }
        
        // Only update position if not being dragged
        if (!dragState.isDragging || dragState.targetBunny?.id !== bunnyId) {
            // Smooth movement towards target
            const lerpFactor = 0.1;
            position.x = lerp(position.x, position.targetX, lerpFactor);
            position.y = lerp(position.y, position.targetY, lerpFactor);
        }
        
        // Update animation states
        if (bunnyAnimStates[bunnyId]) {
            updateBunnyAnimationState(bunnyId, deltaTime);
        }
    });
}

function updateBunnyAnimationState(bunnyId, deltaTime) {
    const animState = bunnyAnimStates[bunnyId];
    if (!animState) return;
    
    const dt = deltaTime / 1000;
    
    // Scale animation
    const scaleLerpFactor = 0.1;
    animState.scale = lerp(animState.scale, animState.targetScale, scaleLerpFactor);
    
    // Bounce animation
    animState.bounceSpeed += 25 * dt; // Gravity
    animState.bounceOffset += animState.bounceSpeed * dt;
    
    if (animState.bounceOffset > 0) {
        animState.bounceOffset = 0;
        animState.bounceSpeed *= -0.6; // Bounce damping
        
        if (Math.abs(animState.bounceSpeed) < 1) {
            animState.bounceSpeed = 0;
        }
    }
}

// ===== BACKGROUND CACHING SYSTEM =====
function createBackgroundCache(scene) {
    if (!canvas || !ctx) return null;
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    if (width === 0 || height === 0) return null;
    
    // Create offscreen canvas for background
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    // Draw background to offscreen canvas
    drawBackgroundToContext(offscreenCtx, width, height, scene);
    
    return offscreenCanvas;
}

function getCachedBackground(scene) {
    const cacheKey = scene;
    
    // Check if scene changed or cache is invalid
    if (lastScene !== scene || !backgroundCache.has(cacheKey)) {
        // HIGH FIX: Implement max cache size and clear old entries when scene changes
        const MAX_CACHE_SIZE = 10;
        
        // Clear cache if scene changed (different scene = clear all)
        if (lastScene !== scene) {
            backgroundCache.clear();
            console.log('🧹 Background cache cleared for scene change');
        }
        
        // If cache is at max size, clear oldest entries
        if (backgroundCache.size >= MAX_CACHE_SIZE) {
            const oldestKey = backgroundCache.keys().next().value;
            backgroundCache.delete(oldestKey);
            console.log('🧹 Removed oldest background cache entry:', oldestKey);
        }
        
        backgroundCache.set(cacheKey, createBackgroundCache(scene));
        lastScene = scene;
        backgroundNeedsRedraw = false;
    }
    
    return backgroundCache.get(cacheKey);
}

// ===== OBJECT POOLING FOR PARTICLES =====
function initializeParticlePool() {
    particlePool = [];
    activeParticles = [];
    
    // Pre-create 50 particles
    for (let i = 0; i < 50; i++) {
        particlePool.push(new Particle(0, 0, 'heart'));
    }
}

function getParticleFromPool() {
    if (particlePool.length > 0) {
        return particlePool.pop();
    }
    return new Particle(0, 0, 'heart');
}

function returnParticleToPool(particle) {
    particle.reset();
    particlePool.push(particle);
}

function updateParticleSystem(deltaTime) {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const particle = activeParticles[i];
        particle.update(deltaTime);
        
        if (particle.life <= 0) {
            activeParticles.splice(i, 1);
            returnParticleToPool(particle);
        }
    }
}

function createParticleEffect(x, y, type, color, count = 3) {
    // CRITICAL FIX: Add MAX_PARTICLES limit to prevent memory growth
    const MAX_PARTICLES = 100;
    
    for (let i = 0; i < count; i++) {
        // Don't add particles if we're already at the max limit
        if (activeParticles.length >= MAX_PARTICLES) {
            console.warn('🚨 Particle limit reached, skipping new particles');
            break;
        }
        
        const particle = getParticleFromPool();
        particle.init(
            x + (Math.random() - 0.5) * 20,
            y + (Math.random() - 0.5) * 20,
            type,
            color
        );
        activeParticles.push(particle);
    }
}

// ===== 2D GRAPHICS RENDERING =====
function startGameLoop() {
    // CRITICAL FIX: Always cancel existing animation before starting new
    if (animationId) {
        console.log('🎮 Canceling existing game loop before starting new one');
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Initialize particle pool
    initializeParticlePool();
    
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    let accumulator = 0;
    
    function gameLoop(timestamp) {
        if (currentPhase === 'game' && canvas && ctx) {
            const deltaTime = timestamp - lastFrameTime;
            lastFrameTime = timestamp;
            accumulator += deltaTime;
            
            // Cap to 30fps to save CPU
            if (accumulator >= FRAME_INTERVAL) {
                accumulator -= FRAME_INTERVAL;
                
                // Update systems
                updateAnimations(deltaTime);
                updateParticleSystem(deltaTime);
                updateBunnyPositions(deltaTime);
                updateWeatherEffects(deltaTime);
                updateBunnyMoodAnimations(deltaTime);
                updateFootballGame();
                updateMiniGames(deltaTime);
                
                // Only render if something has changed
                if (shouldRender(timestamp)) {
                    render();
                }
            }
        }
        
        animationId = requestAnimationFrame(gameLoop);
    }
    
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
    console.log('🎮 Game loop started with optimizations');
}

function shouldRender(timestamp) {
    // Always render — bunnies have continuous floating animation
    return true;
}

function render() {
    clearCanvas();
    
    // Draw background directly (detailed scenes use global ctx)
    drawBackground();
    drawParentBunnies(); // Draw parent bunnies even without game state
    
    if (!gameState) {
        drawLoadingScreen();
        return;
    }
    
    drawDraggableBabies();
    drawSceneOverlays();
    drawActiveParticles();
    drawWeatherEffects();
    if (footballGame.active && canvas) {
        const rect = canvas.getBoundingClientRect();
        drawFootballOverlay(rect.width, rect.height);
    }
    drawMiniGames();
    drawUI();
}

function drawSceneOverlays() {
    if (!gameState || !gameState.babies) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const time = Date.now() * 0.001;
    const scene = currentScene;
    const anySleeping = gameState.babies.some(b => b.sleeping);

    if (scene === 'bathroom') {
        // Water drops falling over the bunnies
        ctx.save();
        gameState.babies.forEach((baby, i) => {
            const pos = getBunnyPosition(baby.id);
            for (let d = 0; d < 3; d++) {
                const dropPhase = (time * 2.5 + d * 1.2 + i * 0.7) % 2;
                const dx = pos.x - 8 + d * 8;
                const dy = pos.y - 30 + dropPhase * 50;
                const alpha = 0.4 - dropPhase * 0.2;
                if (alpha > 0) {
                    ctx.fillStyle = `rgba(100, 181, 246, ${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(dx, dy - 3);
                    ctx.quadraticCurveTo(dx + 2, dy, dx, dy + 3);
                    ctx.quadraticCurveTo(dx - 2, dy, dx, dy - 3);
                    ctx.fill();
                }
            }
        });
        ctx.restore();
    }

    if ((scene === 'night' || anySleeping) && gameState.babies.some(b => b.sleeping)) {
        // Zzz bubbles rising from sleeping bunnies
        ctx.save();
        gameState.babies.forEach((baby, i) => {
            if (!baby.sleeping) return;
            const pos = getBunnyPosition(baby.id);
            for (let z = 0; z < 3; z++) {
                const zPhase = (time * 0.6 + z * 1.5 + i) % 4;
                const zx = pos.x + 20 + z * 8 + Math.sin(time + z) * 5;
                const zy = pos.y - 20 - zPhase * 20;
                const zAlpha = 0.7 - zPhase * 0.18;
                const zSize = 8 + zPhase * 3;
                if (zAlpha > 0) {
                    ctx.font = `${zSize}px Comic Sans MS`;
                    ctx.fillStyle = `rgba(180, 180, 255, ${zAlpha})`;
                    ctx.textAlign = 'center';
                    ctx.fillText('Z', zx, zy);
                }
            }
        });
        ctx.restore();
    }

    if (scene === 'kitchen') {
        // Small food crumb particles near eating bunnies
        ctx.save();
        gameState.babies.forEach((baby, i) => {
            const pos = getBunnyPosition(baby.id);
            for (let c = 0; c < 2; c++) {
                const cPhase = (time * 1.5 + c * 2 + i * 0.9) % 3;
                const cx = pos.x + (c - 0.5) * 15 + Math.sin(time + c + i) * 3;
                const cy = pos.y + 10 + cPhase * 8;
                const cAlpha = 0.5 - cPhase * 0.17;
                if (cAlpha > 0) {
                    ctx.fillStyle = `rgba(255, 152, 0, ${cAlpha})`;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        ctx.restore();
    }
}

function drawCachedBackground() {
    // Check if any baby is sleeping or it's nighttime
    const isNight = gameState && gameState.dayNightCycle === 'night';
    const anySleeping = gameState && gameState.babies && gameState.babies.some(b => b.sleeping);
    
    let sceneKey = currentScene;
    if (anySleeping || isNight) {
        sceneKey = 'night';
    }
    
    const cachedBg = getCachedBackground(sceneKey);
    if (cachedBg) {
        ctx.drawImage(cachedBg, 0, 0);
    } else {
        // Fallback to direct drawing
        drawBackground();
    }
}

function drawActiveParticles() {
    activeParticles.forEach(particle => particle.draw(ctx));
}

function drawLoadingScreen() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(255, 179, 217, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    // Loading text with cute animation
    const time = Date.now() * 0.003;
    const bounce = Math.sin(time * 2) * 5;
    
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 24px Comic Sans MS';
    ctx.textAlign = 'center';
    ctx.fillText('🐰 Loading Bunny Family... 💕', width / 2, height / 2 + bounce);
    
    // Cute loading hearts
    const hearts = ['💖', '💝', '💕', '💗'];
    for (let i = 0; i < 4; i++) {
        const angle = time + (i * Math.PI / 2);
        const heartX = width / 2 + Math.cos(angle) * 30;
        const heartY = height / 2 + 40 + Math.sin(angle) * 20;
        
        ctx.font = '20px Arial';
        ctx.fillText(hearts[i], heartX, heartY);
    }
}

// Scene lock — prevents auto-logic (like sleeping → night) from overriding
// a user-chosen scene (feed/play/clean) for a few seconds
let sceneLockUntil = 0;
function setScene(scene, options) {
    options = options || {};
    if (currentScene !== scene) {
        backgroundNeedsRedraw = true;
        dirtyBackground = true;
    }
    currentScene = scene;
    if (sceneTimer) clearTimeout(sceneTimer);
    sceneTimer = null;
    // User-triggered scenes hold for 10 seconds against auto-overrides
    if (options.lock) {
        sceneLockUntil = Date.now() + (options.lockMs || 10000);
    }

    // Football mini-game activation
    if (scene === 'playground') {
        if (!footballGame.active) {
            footballGame.active = true;
            footballGame.blackScore = 0;
            footballGame.whiteScore = 0;
            footballGame.goalMessage = '';
            footballGame.goalMessageTime = 0;
            footballGame.winMessage = '';
            footballGame.winMessageTime = 0;
            resetFootball();
        }
    } else {
        footballGame.active = false;
    }
}

function resetFootball() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    footballGame.ballX = rect.width / 2;
    footballGame.ballY = rect.height * 0.75;
    footballGame.ballVX = 0;
    footballGame.ballVY = 0;
    footballGame.paused = false;
    footballGame.goalMessage = '';
    footballGame.winMessage = '';
}

function updateFootballGame() {
    if (!footballGame.active || !canvas || footballGame.paused) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const groundY = height * 0.55;
    const fieldBottom = height - 10;
    const BALL_RADIUS = 10;
    const BUNNY_RADIUS = 40;
    const KICK_STRENGTH = 7;
    const FOOTBALL_SPEED = 4;

    // Move current player's parent bunny with arrow keys
    if (myPlayerType) {
        const parentKey = myPlayerType === 'black' ? 'parent_black' : 'parent_white';
        const pos = parentBunnyPositions[parentKey];
        let dx = 0, dy = 0;
        if (keysPressed['ArrowLeft'] || keysPressed['a'] || keysPressed['A']) dx -= FOOTBALL_SPEED;
        if (keysPressed['ArrowRight'] || keysPressed['d'] || keysPressed['D']) dx += FOOTBALL_SPEED;
        if (keysPressed['ArrowUp'] || keysPressed['w'] || keysPressed['W']) dy -= FOOTBALL_SPEED;
        if (keysPressed['ArrowDown'] || keysPressed['s'] || keysPressed['S']) dy += FOOTBALL_SPEED;

        if (dx !== 0 || dy !== 0) {
            const newX = Math.max(30, Math.min(pos.x + dx, width - 30));
            const newY = Math.max(groundY, Math.min(pos.y + dy, fieldBottom));
            pos.x = newX;
            pos.y = newY;
            pos.targetX = newX;
            pos.targetY = newY;
            pos._lastLocalMove = Date.now();

            // Sync movement to partner
            if (socket && socket.connected) {
                socket.emit('move_bunny', {
                    babyId: parentKey,
                    x: newX,
                    y: newY,
                    timestamp: Date.now()
                });
            }
        }
    }

    // Apply friction to ball
    footballGame.ballVX *= 0.98;
    footballGame.ballVY *= 0.98;

    // Update ball position
    footballGame.ballX += footballGame.ballVX;
    footballGame.ballY += footballGame.ballVY;

    // Bounce off top/bottom walls (field area)
    if (footballGame.ballY - BALL_RADIUS < groundY) {
        footballGame.ballY = groundY + BALL_RADIUS;
        footballGame.ballVY = -footballGame.ballVY * 0.7;
    }
    if (footballGame.ballY + BALL_RADIUS > fieldBottom) {
        footballGame.ballY = fieldBottom - BALL_RADIUS;
        footballGame.ballVY = -footballGame.ballVY * 0.7;
    }

    // Bounce off left/right unless in goal area
    const goalTop = height * 0.65;
    const goalBottom = height * 0.85;
    const inGoalYRange = footballGame.ballY > goalTop && footballGame.ballY < goalBottom;

    if (footballGame.ballX - BALL_RADIUS < 0 && !inGoalYRange) {
        footballGame.ballX = BALL_RADIUS;
        footballGame.ballVX = -footballGame.ballVX * 0.7;
    }
    if (footballGame.ballX + BALL_RADIUS > width && !inGoalYRange) {
        footballGame.ballX = width - BALL_RADIUS;
        footballGame.ballVX = -footballGame.ballVX * 0.7;
    }

    // Check collision with parent bunnies
    ['parent_black', 'parent_white'].forEach(parentKey => {
        const pos = parentBunnyPositions[parentKey];
        if (!pos) return;
        const distX = footballGame.ballX - pos.x;
        const distY = footballGame.ballY - pos.y;
        const dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < BUNNY_RADIUS + BALL_RADIUS) {
            // Kick ball in direction of bunny movement or away from bunny
            let kickDirX = distX;
            let kickDirY = distY;
            const len = Math.sqrt(kickDirX * kickDirX + kickDirY * kickDirY) || 1;
            kickDirX /= len;
            kickDirY /= len;
            footballGame.ballVX = kickDirX * KICK_STRENGTH;
            footballGame.ballVY = kickDirY * KICK_STRENGTH;

            // Push ball out of bunny
            footballGame.ballX = pos.x + kickDirX * (BUNNY_RADIUS + BALL_RADIUS + 1);
            footballGame.ballY = pos.y + kickDirY * (BUNNY_RADIUS + BALL_RADIUS + 1);
        }
    });

    // Check goal scoring
    // Left goal: white scores (ball goes past left goal posts)
    if (footballGame.ballX < width * 0.05 && inGoalYRange) {
        footballGame.whiteScore++;
        footballGame.goalMessage = 'GOAL! White scores!';
        footballGame.goalMessageTime = Date.now();
        if (!checkFootballWin()) {
            // Only reset ball if not a win (win handler resets after 3s)
            setTimeout(() => { if (!footballGame.paused) resetFootball(); }, 1000);
        }
    }
    // Right goal: black scores (ball goes past right goal posts)
    if (footballGame.ballX > width * 0.95 && inGoalYRange) {
        footballGame.blackScore++;
        footballGame.goalMessage = 'GOAL! Black scores!';
        footballGame.goalMessageTime = Date.now();
        if (!checkFootballWin()) {
            setTimeout(() => { if (!footballGame.paused) resetFootball(); }, 1000);
        }
    }
}

function checkFootballWin() {
    if (footballGame.winMessage) return true; // Already showing win
    if (footballGame.blackScore >= 10) {
        footballGame.winMessage = 'Black Bunny Wins! 🏆';
        footballGame.winMessageTime = Date.now();
        footballGame.paused = true;
        addMiniGameScore('football', footballGame.blackScore);
        setTimeout(() => {
            footballGame.blackScore = 0;
            footballGame.whiteScore = 0;
            footballGame.winMessage = '';
            footballGame.paused = false;
            resetFootball();
        }, 3000);
        return true;
    } else if (footballGame.whiteScore >= 10) {
        footballGame.winMessage = 'White Bunny Wins! 🏆';
        footballGame.winMessageTime = Date.now();
        footballGame.paused = true;
        addMiniGameScore('football', footballGame.whiteScore);
        setTimeout(() => {
            footballGame.blackScore = 0;
            footballGame.whiteScore = 0;
            footballGame.winMessage = '';
            footballGame.paused = false;
            resetFootball();
        }, 3000);
        return true;
    }
    return false;
}

function drawFootballOverlay(width, height) {
    if (!footballGame.active) return;

    // Score overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const scoreWidth = 200;
    ctx.fillRect(width / 2 - scoreWidth / 2, 5, scoreWidth, 35);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Black ${footballGame.blackScore} - ${footballGame.whiteScore} White`, width / 2, 28);

    // Goal message flash
    if (footballGame.goalMessage && Date.now() - footballGame.goalMessageTime < 2000) {
        const alpha = 1 - (Date.now() - footballGame.goalMessageTime) / 2000;
        const scale = 1 + (1 - alpha) * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.floor(36 * scale)}px Arial`;
        ctx.fillStyle = '#ffeb3b';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(footballGame.goalMessage, width / 2, height * 0.4);
        ctx.fillText(footballGame.goalMessage, width / 2, height * 0.4);
        ctx.restore();
    }

    // Win celebration message
    if (footballGame.winMessage && Date.now() - footballGame.winMessageTime < 3000) {
        const alpha = 1 - (Date.now() - footballGame.winMessageTime) / 3000;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(footballGame.winMessage, width / 2, height * 0.35);
        ctx.fillText(footballGame.winMessage, width / 2, height * 0.35);
        // Sparkles around the text
        for (let i = 0; i < 8; i++) {
            const angle = (Date.now() * 0.003) + (i * Math.PI / 4);
            const sparkX = width / 2 + Math.cos(angle) * 120;
            const sparkY = height * 0.35 + Math.sin(angle) * 40;
            ctx.font = '20px Arial';
            ctx.fillText('✨', sparkX, sparkY);
        }
        ctx.restore();
    }

    ctx.textAlign = 'left';
    ctx.restore();
}

function drawBackground() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    drawBackgroundToContext(ctx, width, height, currentScene);
}

function drawBackgroundToContext(context, width, height, scene) {
    // Check if any baby is sleeping or it's nighttime
    const isNight = gameState && gameState.dayNightCycle === 'night';
    const anySleeping = gameState && gameState.babies && gameState.babies.some(b => b.sleeping);
    
    // User-chosen scene always wins — the scene state is source of truth.
    if (scene === 'shop') {
        drawShopBackground(width, height);
    } else if (scene === 'cave') {
        drawCaveSleepingScene(width, height);
    } else if (scene === 'kitchen') {
        drawKitchenBackground(width, height);
    } else if (scene === 'playground') {
        drawPlaygroundBackground(width, height);
    } else if (scene === 'bathroom') {
        drawBathroomBackground(width, height);
    } else if (scene === 'night' || anySleeping || isNight) {
        drawNightBackgroundToContext(ctx, width, height);
    } else {
        drawDayBackgroundToContext(ctx, width, height);
    }
}

function drawDayBackgroundToContext(context, width, height) {
    // === REALISTIC FOREST BACKGROUND ===
    const time = Date.now() * 0.001;
    const horizon = height * 0.55;

    // Multi-stop sky — atmospheric perspective (deep blue at zenith, hazy near horizon)
    const skyGrad = context.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, '#4a8fc7');     // deep zenith blue
    skyGrad.addColorStop(0.35, '#7ab8de');  // mid sky
    skyGrad.addColorStop(0.7, '#bfdcf0');   // pale haze
    skyGrad.addColorStop(0.95, '#e8d8b8');  // warm horizon
    skyGrad.addColorStop(1, '#dccda8');     // ground haze
    context.fillStyle = skyGrad;
    context.fillRect(0, 0, width, horizon);

    // Sun — softer, more diffuse with multi-layer glow
    const sunX = width * 0.82;
    const sunY = height * 0.13;

    // Outer atmospheric glow (huge, faint)
    const outerGlow = context.createRadialGradient(sunX, sunY, 30, sunX, sunY, 220);
    outerGlow.addColorStop(0, 'rgba(255, 240, 180, 0.35)');
    outerGlow.addColorStop(0.5, 'rgba(255, 230, 160, 0.12)');
    outerGlow.addColorStop(1, 'rgba(255, 220, 140, 0)');
    context.fillStyle = outerGlow;
    context.fillRect(sunX - 220, sunY - 220, 440, 440);

    // Inner bright glow
    const innerGlow = context.createRadialGradient(sunX, sunY, 5, sunX, sunY, 70);
    innerGlow.addColorStop(0, 'rgba(255, 252, 220, 0.95)');
    innerGlow.addColorStop(0.4, 'rgba(255, 245, 180, 0.5)');
    innerGlow.addColorStop(1, 'rgba(255, 240, 160, 0)');
    context.fillStyle = innerGlow;
    context.fillRect(sunX - 70, sunY - 70, 140, 140);

    // Sun disk
    context.fillStyle = '#fff8c8';
    context.beginPath();
    context.arc(sunX, sunY, 24, 0, Math.PI * 2);
    context.fill();

    // Subtle god-ray fan from sun
    context.save();
    context.translate(sunX, sunY);
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI * 0.5 + (i - 2.5) * 0.15;
        const rayG = context.createLinearGradient(0, 0, Math.cos(angle) * 600, Math.sin(angle) * 600);
        rayG.addColorStop(0, 'rgba(255, 245, 180, 0.18)');
        rayG.addColorStop(1, 'rgba(255, 245, 180, 0)');
        context.fillStyle = rayG;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(Math.cos(angle - 0.04) * 700, Math.sin(angle - 0.04) * 700);
        context.lineTo(Math.cos(angle + 0.04) * 700, Math.sin(angle + 0.04) * 700);
        context.closePath();
        context.fill();
    }
    context.restore();

    // Clouds (drifting layers)
    drawCloudsToContext(context, width, height);

    // === MULTI-LAYER MOUNTAINS (atmospheric perspective) ===
    // Far mountains — bluest, hazy
    _drawHillLayer(context, width, horizon - height * 0.15, height * 0.18, '#9eb8c9', '#8aa5b8', 0.018, 1.7, 25);
    // Mid mountains — slightly green-blue
    _drawHillLayer(context, width, horizon - height * 0.08, height * 0.13, '#7a9a8a', '#6a8a7a', 0.022, 0.8, 20);
    // Near hills — green
    _drawHillLayer(context, width, horizon - height * 0.02, height * 0.08, '#5a9a5a', '#4a8a4a', 0.028, 2.4, 18);

    // === GROUND ===
    // Multi-band grass for depth
    const grassGrad = context.createLinearGradient(0, horizon, 0, height);
    grassGrad.addColorStop(0, '#7ec07e');     // sun-kissed grass at horizon
    grassGrad.addColorStop(0.15, '#6cb56c');
    grassGrad.addColorStop(0.5, '#5aa55a');
    grassGrad.addColorStop(1, '#3f8a3f');     // shaded foreground
    context.fillStyle = grassGrad;
    context.fillRect(0, horizon, width, height - horizon);

    // Subtle grass color patches (variation)
    context.globalAlpha = 0.25;
    for (let i = 0; i < 8; i++) {
        const px = (i * 137) % width;
        const py = horizon + ((i * 89) % (height - horizon));
        const pr = 60 + (i * 17) % 40;
        const patchG = context.createRadialGradient(px, py, 0, px, py, pr);
        patchG.addColorStop(0, i % 2 ? '#6aa86a' : '#84c084');
        patchG.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = patchG;
        context.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    context.globalAlpha = 1;

    // Dense grass blades — multiple sizes/colors for realism
    const bladeColors = ['#52a852', '#48a048', '#5cb05c', '#6abf6a', '#3e8a3e'];
    for (let i = 0; i < 140; i++) {
        const gx = (i * 41 + Math.sin(i * 3.7) * 15) % width;
        const depth = ((i * 73) % 100) / 100;
        const gy = horizon + 4 + depth * (height - horizon - 8);
        const bladeH = 4 + depth * 14;
        context.strokeStyle = bladeColors[i % bladeColors.length];
        context.lineWidth = 1 + depth * 0.8;
        context.beginPath();
        context.moveTo(gx, gy);
        context.quadraticCurveTo(gx + (i % 3 - 1) * 2, gy - bladeH * 0.6, gx + (i % 5 - 2), gy - bladeH);
        context.stroke();
    }

    // Atmospheric haze band at horizon (softens far→near transition)
    const hazeG = context.createLinearGradient(0, horizon - height * 0.04, 0, horizon + height * 0.03);
    hazeG.addColorStop(0, 'rgba(220, 215, 195, 0)');
    hazeG.addColorStop(0.5, 'rgba(220, 215, 195, 0.35)');
    hazeG.addColorStop(1, 'rgba(220, 215, 195, 0)');
    context.fillStyle = hazeG;
    context.fillRect(0, horizon - height * 0.04, width, height * 0.07);

    // Background trees (far, hazy, smaller, bluer)
    context.save();
    context.globalAlpha = 0.65;
    _drawForestTree(context, width * 0.05, height * 0.52, 28, '#6b9a7b', '#5a8a6a');
    _drawForestTree(context, width * 0.18, height * 0.50, 34, '#688a76', '#577a66');
    _drawForestTree(context, width * 0.82, height * 0.51, 30, '#6a957a', '#598565');
    _drawForestTree(context, width * 0.95, height * 0.53, 26, '#6c987d', '#5b8868');
    context.restore();

    // Foreground trees (large, saturated)
    _drawForestTree(context, width * 0.06, height * 0.64, 65, '#4a8f4a', '#356a35');
    _drawForestTree(context, width * 0.94, height * 0.62, 70, '#4c914c', '#376c37');

    // Bushes
    _drawBush(context, width * 0.15, height * 0.68, 30, '#5aad5a');
    _drawBush(context, width * 0.35, height * 0.75, 22, '#62b862');
    _drawBush(context, width * 0.65, height * 0.72, 26, '#58ab58');
    _drawBush(context, width * 0.85, height * 0.70, 20, '#5fb05f');

    // Rocks
    _drawRock(context, width * 0.25, height * 0.82, 15);
    _drawRock(context, width * 0.72, height * 0.85, 12);
    _drawRock(context, width * 0.50, height * 0.90, 10);

    // Flowers scattered on ground
    const flowerPositions = [
        { x: 0.12, y: 0.78, c: '#ff6b6b' },
        { x: 0.22, y: 0.85, c: '#feca57' },
        { x: 0.40, y: 0.80, c: '#ff9ff3' },
        { x: 0.55, y: 0.88, c: '#54a0ff' },
        { x: 0.70, y: 0.76, c: '#ff6b6b' },
        { x: 0.78, y: 0.84, c: '#feca57' },
        { x: 0.88, y: 0.78, c: '#ff9ff3' },
        { x: 0.32, y: 0.92, c: '#fd79a8' },
        { x: 0.60, y: 0.93, c: '#a29bfe' },
        { x: 0.48, y: 0.82, c: '#ff7675' }
    ];
    flowerPositions.forEach(f => {
        drawFlowerToContext(context, f.x * width, f.y * height, f.c);
    });

    // Mushrooms (more variety)
    _drawMushroom(context, width * 0.18, height * 0.80, 8);
    _drawMushroom(context, width * 0.75, height * 0.88, 6);
    _drawMushroom(context, width * 0.28, height * 0.90, 5);
    _drawMushroom(context, width * 0.62, height * 0.86, 7);

    // === POND with reflection ===
    const pondX = width * 0.55, pondY = height * 0.72, pondW = width * 0.12, pondH = height * 0.04;
    // Pond shadow
    context.fillStyle = 'rgba(0, 0, 0, 0.2)';
    context.beginPath();
    context.ellipse(pondX, pondY + 2, pondW, pondH, 0, 0, Math.PI * 2);
    context.fill();
    // Water gradient
    const pondG = context.createRadialGradient(pondX - pondW * 0.3, pondY - pondH * 0.4, 0, pondX, pondY, pondW);
    pondG.addColorStop(0, '#b8e4f0');
    pondG.addColorStop(0.5, '#6ab4dc');
    pondG.addColorStop(1, '#2a6a9c');
    context.fillStyle = pondG;
    context.beginPath();
    context.ellipse(pondX, pondY, pondW, pondH, 0, 0, Math.PI * 2);
    context.fill();
    // Rim
    context.strokeStyle = '#4a3a20';
    context.lineWidth = 1.5;
    context.stroke();
    // Ripples
    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
        const rRadius = (pondW * 0.35) * (1 - r * 0.25);
        const rAlpha = 0.5 - r * 0.15 + Math.sin(time * 1.5 + r) * 0.1;
        context.globalAlpha = Math.max(0, rAlpha);
        context.beginPath();
        context.ellipse(pondX, pondY, rRadius, rRadius * (pondH / pondW), 0, 0, Math.PI * 2);
        context.stroke();
    }
    context.globalAlpha = 1;
    // Lily pads
    for (let lp = 0; lp < 2; lp++) {
        const lpx = pondX + (lp ? pondW * 0.4 : -pondW * 0.3);
        const lpy = pondY + (lp ? -pondH * 0.2 : pondH * 0.3);
        context.fillStyle = '#3a8a3a';
        context.beginPath();
        context.ellipse(lpx, lpy, 8, 5, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#2a6a2a';
        context.stroke();
    }

    // === TALL GRASS TUFTS in foreground ===
    for (let gt = 0; gt < 8; gt++) {
        const gtx = width * (0.05 + gt * 0.12);
        const gty = height * (0.88 + (gt % 2) * 0.05);
        context.strokeStyle = '#3e8a3e';
        context.lineWidth = 1.2;
        for (let b = 0; b < 4; b++) {
            const bh = 8 + (b % 2) * 4;
            ctx.beginPath();
            context.moveTo(gtx + b * 2 - 3, gty);
            context.quadraticCurveTo(gtx + b * 2 - 3 + (b - 1.5), gty - bh * 0.6, gtx + b * 2 - 2, gty - bh);
            context.stroke();
        }
    }

    // === FLYING BIRDS (V-shaped silhouettes) ===
    context.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    context.lineWidth = 1.5;
    context.lineCap = 'round';
    const birdFlap = Math.sin(time * 6) * 0.25 + 0.15;
    const birdX1 = (time * 20) % (width + 60) - 30;
    const birdY1 = height * 0.15 + Math.sin(time * 0.5) * 8;
    context.beginPath();
    context.moveTo(birdX1 - 8, birdY1 + birdFlap * 4);
    context.lineTo(birdX1, birdY1);
    context.lineTo(birdX1 + 8, birdY1 + birdFlap * 4);
    context.stroke();
    const birdX2 = (time * 20 - 30) % (width + 60) - 30;
    const birdY2 = height * 0.18 + Math.cos(time * 0.6) * 5;
    context.beginPath();
    context.moveTo(birdX2 - 6, birdY2 + birdFlap * 3);
    context.lineTo(birdX2, birdY2);
    context.lineTo(birdX2 + 6, birdY2 + birdFlap * 3);
    context.stroke();
    context.lineCap = 'butt';

    // === FALLEN LOG ===
    const logX = width * 0.38, logY = height * 0.88, logW = 45, logH = 9;
    const logG = context.createLinearGradient(0, logY - logH, 0, logY + logH);
    logG.addColorStop(0, '#8a5c30');
    logG.addColorStop(0.5, '#5a3820');
    logG.addColorStop(1, '#3a2212');
    context.fillStyle = logG;
    context.fillRect(logX, logY, logW, logH);
    // Log end cap (circle showing rings)
    context.fillStyle = '#7a4a20';
    context.beginPath();
    context.ellipse(logX + logW, logY + logH / 2, 3, logH / 2, 0, 0, Math.PI * 2);
    context.fill();
    // Rings
    context.strokeStyle = '#4a2812';
    context.lineWidth = 0.5;
    for (let r = 1; r < 3; r++) {
        context.beginPath();
        context.ellipse(logX + logW, logY + logH / 2, r, (logH / 2) * (r / 3), 0, 0, Math.PI * 2);
        context.stroke();
    }
    // Moss on top of log
    context.fillStyle = '#5fa05f';
    context.beginPath();
    context.ellipse(logX + logW * 0.3, logY, 8, 3, 0, Math.PI, Math.PI * 2);
    context.ellipse(logX + logW * 0.7, logY, 6, 2.5, 0, Math.PI, Math.PI * 2);
    context.fill();

    // === BUTTERFLIES (drawn, not emoji) ===
    [
        { x: width * 0.3 + Math.sin(time * 1.2) * 25, y: height * 0.45 + Math.cos(time * 1.8) * 12, c1: '#ff69b4', c2: '#ffd23a' },
        { x: width * 0.7 + Math.sin(time * 0.9 + 2) * 30, y: height * 0.50 + Math.cos(time * 1.5 + 1) * 14, c1: '#9b5fff', c2: '#7ec4f0' }
    ].forEach(b => {
        const wingFlap = Math.sin(time * 12) * 0.5 + 0.5;
        context.save();
        context.translate(b.x, b.y);
        // Body
        context.fillStyle = '#2a1a1a';
        context.fillRect(-0.8, -3, 1.6, 7);
        // Wings (4 parts, flapping)
        context.fillStyle = b.c1;
        context.beginPath();
        context.ellipse(-4 * wingFlap, -2, 5 * wingFlap, 3.5, -0.3, 0, Math.PI * 2);
        context.ellipse(4 * wingFlap, -2, 5 * wingFlap, 3.5, 0.3, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = b.c2;
        context.beginPath();
        context.ellipse(-3.5 * wingFlap, 1.5, 4 * wingFlap, 2.5, -0.3, 0, Math.PI * 2);
        context.ellipse(3.5 * wingFlap, 1.5, 4 * wingFlap, 2.5, 0.3, 0, Math.PI * 2);
        context.fill();
        // Antennae
        context.strokeStyle = '#2a1a1a';
        context.lineWidth = 0.6;
        context.beginPath();
        context.moveTo(-0.5, -3);
        context.lineTo(-1.5, -5);
        context.moveTo(0.5, -3);
        context.lineTo(1.5, -5);
        context.stroke();
        context.restore();
    });

    // === DAPPLED SUNLIGHT SPOTS on ground ===
    context.fillStyle = 'rgba(255, 240, 180, 0.2)';
    for (let s = 0; s < 5; s++) {
        const sx = width * (0.15 + s * 0.18 + Math.sin(s) * 0.03);
        const sy = height * (0.78 + (s % 2) * 0.08);
        context.beginPath();
        context.ellipse(sx, sy, 18 + (s % 3) * 4, 7, 0, 0, Math.PI * 2);
        context.fill();
    }

    // Cave is no longer in the forest — moved to its own sleep scene
}

// Multi-layer mountain silhouette with smooth ridgeline
function _drawHillLayer(ctx2, width, baseY, amplitude, topColor, bottomColor, freq, phaseSeed, step) {
    const grad = ctx2.createLinearGradient(0, baseY - amplitude, 0, baseY + amplitude);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx2.fillStyle = grad;
    ctx2.beginPath();
    ctx2.moveTo(0, baseY + amplitude);
    for (let x = 0; x <= width; x += step) {
        const y = baseY - amplitude * 0.4
            + Math.sin(x * freq + phaseSeed) * amplitude * 0.6
            + Math.sin(x * freq * 2.3 + phaseSeed * 1.7) * amplitude * 0.25;
        ctx2.lineTo(x, y);
    }
    ctx2.lineTo(width, baseY + amplitude);
    ctx2.closePath();
    ctx2.fill();
}

function _drawForestTree(ctx2, x, y, size, leafColor, darkLeafColor) {
    // Gentle sway — phase derived from x so trees don't sync
    const t = Date.now() * 0.0008;
    const swayPhase = x * 0.017;
    const sway = Math.sin(t + swayPhase) * (size * 0.03);

    // Soft ground shadow under tree
    ctx2.save();
    ctx2.globalAlpha = 0.22;
    ctx2.fillStyle = '#000';
    ctx2.beginPath();
    ctx2.ellipse(x, y + size * 0.45, size * 0.55, size * 0.12, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();

    // Trunk with vertical gradient (light side / shadow side)
    const trunkW = size * 0.22;
    const trunkH = size * 0.7;
    const trunkX = x - trunkW / 2;
    const trunkY = y - trunkH * 0.2;
    const trunkG = ctx2.createLinearGradient(trunkX, 0, trunkX + trunkW, 0);
    trunkG.addColorStop(0, '#5a3d25');
    trunkG.addColorStop(0.5, '#7a5a40');
    trunkG.addColorStop(1, '#4a3020');
    ctx2.fillStyle = trunkG;
    ctx2.fillRect(trunkX, trunkY, trunkW, trunkH);
    // Bark texture lines
    ctx2.strokeStyle = 'rgba(50, 30, 15, 0.5)';
    ctx2.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
        const tx = trunkX + trunkW * (0.25 + i * 0.25);
        ctx2.beginPath();
        ctx2.moveTo(tx, trunkY + 4);
        ctx2.lineTo(tx + Math.sin(i + x * 0.01) * 1.5, trunkY + trunkH - 4);
        ctx2.stroke();
    }

    // Foliage layers (bottom to top) — apply sway, multi-tone with highlights
    x += sway;
    const foliageY = y - trunkH * 0.2;

    // Helper: draw a round foliage cluster with light/shadow
    const cluster = (cx, cy, r, base, dark) => {
        const g = ctx2.createRadialGradient(cx - r * 0.4, cy - r * 0.4, 0, cx, cy, r * 1.1);
        g.addColorStop(0, base);
        g.addColorStop(0.7, base);
        g.addColorStop(1, dark);
        ctx2.fillStyle = g;
        ctx2.beginPath();
        ctx2.arc(cx, cy, r, 0, Math.PI * 2);
        ctx2.fill();
    };

    // Shadow-side clusters (back layer)
    cluster(x - size * 0.25, foliageY - size * 0.05, size * 0.55, darkLeafColor, '#1a3a1a');
    cluster(x + size * 0.25, foliageY - size * 0.0, size * 0.5, darkLeafColor, '#1a3a1a');
    // Mid clusters
    cluster(x, foliageY - size * 0.3, size * 0.62, leafColor, darkLeafColor);
    cluster(x - size * 0.18, foliageY - size * 0.55, size * 0.42, leafColor, darkLeafColor);
    cluster(x + size * 0.12, foliageY - size * 0.5, size * 0.38, leafColor, darkLeafColor);
    // Top highlights (lighter)
    const lightLeaf = '#9bd49b';
    ctx2.fillStyle = lightLeaf;
    ctx2.globalAlpha = 0.55;
    ctx2.beginPath();
    ctx2.arc(x - size * 0.18, foliageY - size * 0.62, size * 0.18, 0, Math.PI * 2);
    ctx2.arc(x + size * 0.05, foliageY - size * 0.58, size * 0.15, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = 1;
}

function _drawBush(ctx2, x, y, size, color) {
    ctx2.fillStyle = color;
    ctx2.beginPath();
    ctx2.arc(x, y, size, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x - size * 0.6, y + size * 0.1, size * 0.7, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x + size * 0.6, y + size * 0.15, size * 0.65, 0, Math.PI * 2);
    ctx2.fill();
    // Highlight
    ctx2.fillStyle = 'rgba(255,255,255,0.12)';
    ctx2.beginPath();
    ctx2.arc(x, y - size * 0.3, size * 0.5, 0, Math.PI * 2);
    ctx2.fill();
}

function _drawRock(ctx2, x, y, size) {
    ctx2.fillStyle = '#8e8e8e';
    ctx2.beginPath();
    ctx2.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = '#a0a0a0';
    ctx2.beginPath();
    ctx2.ellipse(x - size * 0.1, y - size * 0.15, size * 0.6, size * 0.35, -0.2, 0, Math.PI * 2);
    ctx2.fill();
}

function _drawMushroom(ctx2, x, y, size) {
    // Stem
    ctx2.fillStyle = '#f5f0e0';
    ctx2.fillRect(x - size * 0.2, y - size * 0.3, size * 0.4, size * 0.6);
    // Cap
    ctx2.fillStyle = '#e74c3c';
    ctx2.beginPath();
    ctx2.arc(x, y - size * 0.4, size * 0.5, Math.PI, 0);
    ctx2.fill();
    // Spots
    ctx2.fillStyle = '#fff';
    ctx2.beginPath();
    ctx2.arc(x - size * 0.15, y - size * 0.5, size * 0.1, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x + size * 0.1, y - size * 0.55, size * 0.07, 0, Math.PI * 2);
    ctx2.fill();
}

function drawNightBackgroundToContext(context, width, height) {
    const time = Date.now() * 0.001;
    const horizon = height * 0.55;

    // Deep night sky — multi-stop with subtle aurora tinge
    const sky = context.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#06061f');     // near-black zenith
    sky.addColorStop(0.4, '#0e1336');   // deep indigo
    sky.addColorStop(0.7, '#1c2055');   // royal blue
    sky.addColorStop(1, '#2d2870');     // horizon haze
    context.fillStyle = sky;
    context.fillRect(0, 0, width, horizon);

    // Subtle aurora band (faint magenta/teal wash)
    context.save();
    context.globalCompositeOperation = 'lighter';
    const aurora = context.createLinearGradient(0, height * 0.05, 0, height * 0.4);
    aurora.addColorStop(0, 'rgba(0,0,0,0)');
    aurora.addColorStop(0.5, 'rgba(80, 200, 180, 0.08)');
    aurora.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = aurora;
    context.fillRect(0, 0, width, height * 0.45);
    context.restore();

    // === DENSE STARFIELD with depth (parallax & size variation) ===
    // Far layer — many tiny faint stars (nearly static)
    for (let i = 0; i < 80; i++) {
        const sx = (i * 137.508) % width;
        const sy = (i * 89.13) % (horizon * 0.85);
        const baseAlpha = 0.25 + (i % 5) * 0.1;
        const tw = 0.6 + 0.4 * Math.abs(Math.sin(time * (0.6 + (i % 7) * 0.13) + i));
        context.fillStyle = `rgba(220, 230, 255, ${baseAlpha * tw})`;
        context.beginPath();
        context.arc(sx, sy, 0.7, 0, Math.PI * 2);
        context.fill();
    }
    // Mid layer — featured twinkling stars
    const featuredStars = [
        {x: 0.05, y: 0.06}, {x: 0.12, y: 0.18}, {x: 0.22, y: 0.08},
        {x: 0.3, y: 0.2}, {x: 0.38, y: 0.04}, {x: 0.45, y: 0.14},
        {x: 0.55, y: 0.09}, {x: 0.62, y: 0.22}, {x: 0.7, y: 0.06},
        {x: 0.78, y: 0.16}, {x: 0.88, y: 0.1}, {x: 0.95, y: 0.2},
        {x: 0.17, y: 0.25}, {x: 0.48, y: 0.26}, {x: 0.75, y: 0.28}
    ];
    featuredStars.forEach((star, i) => {
        const twinkle = 0.5 + 0.5 * Math.abs(Math.sin(time * (1.2 + i * 0.3) + i * 1.7));
        const sz = 1.6 + Math.sin(time * 2 + i) * 0.6;
        const sx = star.x * width, sy = star.y * height;
        // 4-point starburst glow for brightest stars
        if (i % 3 === 0) {
            context.strokeStyle = `rgba(255, 255, 220, ${twinkle * 0.55})`;
            context.lineWidth = 0.8;
            context.beginPath();
            context.moveTo(sx - sz * 4, sy); context.lineTo(sx + sz * 4, sy);
            context.moveTo(sx, sy - sz * 4); context.lineTo(sx, sy + sz * 4);
            context.stroke();
        }
        // Glow halo
        const haloG = context.createRadialGradient(sx, sy, 0, sx, sy, sz * 6);
        haloG.addColorStop(0, `rgba(255, 250, 220, ${twinkle * 0.4})`);
        haloG.addColorStop(1, 'rgba(255, 250, 220, 0)');
        context.fillStyle = haloG;
        context.fillRect(sx - sz * 6, sy - sz * 6, sz * 12, sz * 12);
        // Core
        context.fillStyle = `rgba(255, 255, 240, ${twinkle})`;
        context.beginPath();
        context.arc(sx, sy, sz, 0, Math.PI * 2);
        context.fill();
    });

    // === MOON with realistic glow + craters ===
    const moonX = width * 0.82;
    const moonY = height * 0.13;
    // Big atmospheric glow
    const bigGlow = context.createRadialGradient(moonX, moonY, 25, moonX, moonY, 180);
    bigGlow.addColorStop(0, 'rgba(255, 250, 220, 0.3)');
    bigGlow.addColorStop(0.5, 'rgba(220, 230, 255, 0.1)');
    bigGlow.addColorStop(1, 'rgba(220, 230, 255, 0)');
    context.fillStyle = bigGlow;
    context.fillRect(moonX - 180, moonY - 180, 360, 360);
    // Inner glow
    const moonGlow = context.createRadialGradient(moonX, moonY, 8, moonX, moonY, 70);
    moonGlow.addColorStop(0, 'rgba(255, 253, 231, 0.6)');
    moonGlow.addColorStop(1, 'rgba(255, 253, 231, 0)');
    context.fillStyle = moonGlow;
    context.fillRect(moonX - 70, moonY - 70, 140, 140);
    // Moon disk with subtle gradient (terminator shading)
    const moonDisk = context.createRadialGradient(moonX - 8, moonY - 8, 5, moonX, moonY, 28);
    moonDisk.addColorStop(0, '#fffef0');
    moonDisk.addColorStop(0.6, '#f2eed0');
    moonDisk.addColorStop(1, '#c8c1a0');
    context.fillStyle = moonDisk;
    context.beginPath();
    context.arc(moonX, moonY, 28, 0, Math.PI * 2);
    context.fill();
    // Craters
    context.fillStyle = 'rgba(150, 145, 110, 0.45)';
    [[-8, -4, 4], [6, -2, 3], [2, 8, 5], [-10, 6, 2.5], [10, 10, 2]].forEach(([cx, cy, cr]) => {
        context.beginPath();
        context.arc(moonX + cx, moonY + cy, cr, 0, Math.PI * 2);
        context.fill();
    });

    // === DISTANT MOUNTAIN SILHOUETTES ===
    _drawHillLayer(context, width, horizon - height * 0.05, height * 0.12, '#1a2240', '#12182d', 0.022, 1.7, 22);
    _drawHillLayer(context, width, horizon - height * 0.01, height * 0.08, '#0e1428', '#080d1c', 0.028, 0.8, 18);

    // === BEDROOM FLOOR (wood-look) ===
    const floorY = horizon;
    const floorG = context.createLinearGradient(0, floorY, 0, height);
    floorG.addColorStop(0, '#2a2243');
    floorG.addColorStop(0.5, '#221a36');
    floorG.addColorStop(1, '#181225');
    context.fillStyle = floorG;
    context.fillRect(0, floorY, width, height - floorY);
    // Wood plank lines
    context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    context.lineWidth = 1;
    for (let py = floorY + 25; py < height; py += 25) {
        context.beginPath();
        context.moveTo(0, py);
        context.lineTo(width, py);
        context.stroke();
    }
    // Subtle moonlight cast on floor
    const moonlight = context.createRadialGradient(width * 0.5, floorY, 0, width * 0.5, floorY, width * 0.6);
    moonlight.addColorStop(0, 'rgba(180, 200, 240, 0.12)');
    moonlight.addColorStop(1, 'rgba(180, 200, 240, 0)');
    context.fillStyle = moonlight;
    context.fillRect(0, floorY, width, height - floorY);

    // === BED with realistic shading ===
    const bedX = width * 0.2, bedW = width * 0.6, bedH = 55;
    const bedY = floorY - bedH;
    // Shadow under bed
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.beginPath();
    context.ellipse(bedX + bedW / 2, floorY + 6, bedW * 0.55, 8, 0, 0, Math.PI * 2);
    context.fill();
    // Headboard with wood grain
    const headG = context.createLinearGradient(bedX - 12, 0, bedX + bedW + 12, 0);
    headG.addColorStop(0, '#4a3022');
    headG.addColorStop(0.5, '#7a5530');
    headG.addColorStop(1, '#3d2818');
    context.fillStyle = headG;
    context.beginPath();
    context.moveTo(bedX - 12, bedY - 30);
    context.quadraticCurveTo(bedX + bedW / 2, bedY - 65, bedX + bedW + 12, bedY - 30);
    context.lineTo(bedX + bedW + 12, bedY + 8);
    context.lineTo(bedX - 12, bedY + 8);
    context.closePath();
    context.fill();
    // Posts
    context.fillStyle = '#3d2818';
    context.fillRect(bedX - 8, bedY - 32, 8, bedH + 32);
    context.fillRect(bedX + bedW, bedY - 32, 8, bedH + 32);
    // Mattress
    const mattressG = context.createLinearGradient(0, bedY, 0, bedY + bedH);
    mattressG.addColorStop(0, '#f5e8ee');
    mattressG.addColorStop(1, '#d8c0d0');
    context.fillStyle = mattressG;
    context.fillRect(bedX, bedY, bedW, bedH);
    // Blanket — soft purple with wave + fold shadows
    const blanketG = context.createLinearGradient(0, bedY + 12, 0, bedY + bedH);
    blanketG.addColorStop(0, '#b245c5');
    blanketG.addColorStop(0.6, '#8225a0');
    blanketG.addColorStop(1, '#5e1875');
    context.fillStyle = blanketG;
    context.beginPath();
    context.moveTo(bedX, bedY + 18);
    for (let bx = 0; bx <= bedW; bx += 16) {
        context.lineTo(bedX + bx, bedY + 14 + Math.sin(time * 0.8 + bx * 0.05) * 3);
    }
    context.lineTo(bedX + bedW, bedY + bedH);
    context.lineTo(bedX, bedY + bedH);
    context.closePath();
    context.fill();
    // Blanket fold-line highlights
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.lineWidth = 1;
    for (let bx = 30; bx < bedW; bx += 60) {
        context.beginPath();
        context.moveTo(bedX + bx, bedY + 22);
        context.lineTo(bedX + bx + 8, bedY + bedH - 4);
        context.stroke();
    }
    // Pillows with shading
    [bedX + 45, bedX + bedW - 45].forEach((px, i) => {
        const pillG = context.createRadialGradient(px - 6, bedY + 4, 2, px, bedY + 8, 28);
        pillG.addColorStop(0, '#fffce0');
        pillG.addColorStop(1, '#e8d488');
        context.fillStyle = pillG;
        context.beginPath();
        context.ellipse(px, bedY + 8, 28, 13, i ? 0.1 : -0.1, 0, Math.PI * 2);
        context.fill();
    });

    // Subtle vignette darkens edges for nighttime mood
    // === NIGHTSTAND with glowing lamp ===
    const nsX = bedX - 30, nsY = floorY - 50;
    // Nightstand body
    const nsG = context.createLinearGradient(nsX, 0, nsX + 32, 0);
    nsG.addColorStop(0, '#3a2818');
    nsG.addColorStop(0.5, '#5a4028');
    nsG.addColorStop(1, '#2a1808');
    context.fillStyle = nsG;
    context.fillRect(nsX, nsY, 32, 50);
    // Drawer line
    context.strokeStyle = '#2a1808';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(nsX + 2, nsY + 20);
    context.lineTo(nsX + 30, nsY + 20);
    context.stroke();
    // Drawer knob
    context.fillStyle = '#d4af37';
    context.beginPath();
    context.arc(nsX + 16, nsY + 14, 1.8, 0, Math.PI * 2);
    context.fill();

    // Lamp on nightstand
    const lampX = nsX + 16, lampBaseY = nsY - 2;
    // Big warm glow (bathes the area)
    const lampGlow = context.createRadialGradient(lampX, lampBaseY - 12, 0, lampX, lampBaseY - 12, 80);
    lampGlow.addColorStop(0, 'rgba(255, 200, 120, 0.55)');
    lampGlow.addColorStop(0.5, 'rgba(255, 170, 80, 0.2)');
    lampGlow.addColorStop(1, 'rgba(255, 170, 80, 0)');
    context.fillStyle = lampGlow;
    context.fillRect(lampX - 80, lampBaseY - 80, 160, 100);
    // Lamp base
    context.fillStyle = '#7a5230';
    context.fillRect(lampX - 4, lampBaseY - 8, 8, 8);
    // Lamp post
    context.fillStyle = '#3a2818';
    context.fillRect(lampX - 1, lampBaseY - 20, 2, 12);
    // Lamp shade (cone, lit from inside)
    const shadeG = context.createLinearGradient(lampX - 10, 0, lampX + 10, 0);
    shadeG.addColorStop(0, '#c08060');
    shadeG.addColorStop(0.5, '#ffd890');
    shadeG.addColorStop(1, '#8a5030');
    context.fillStyle = shadeG;
    context.beginPath();
    context.moveTo(lampX - 10, lampBaseY - 20);
    context.lineTo(lampX + 10, lampBaseY - 20);
    context.lineTo(lampX + 7, lampBaseY - 32);
    context.lineTo(lampX - 7, lampBaseY - 32);
    context.closePath();
    context.fill();

    // === WINDOW with night sky ===
    const nwinX = width * 0.65, nwinY = height * 0.08, nwinW = 90, nwinH = 70;
    context.fillStyle = '#3a2818';
    context.fillRect(nwinX - 4, nwinY - 4, nwinW + 8, nwinH + 8);
    // Night sky inside
    const nwinSky = context.createLinearGradient(0, nwinY, 0, nwinY + nwinH);
    nwinSky.addColorStop(0, '#0a1038');
    nwinSky.addColorStop(1, '#2a2870');
    context.fillStyle = nwinSky;
    context.fillRect(nwinX, nwinY, nwinW, nwinH);
    // Stars in window
    for (let ws = 0; ws < 8; ws++) {
        const wsx = nwinX + (ws * 13) % nwinW;
        const wsy = nwinY + (ws * 9) % nwinH;
        const wsw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + ws));
        context.fillStyle = `rgba(255, 255, 220, ${wsw})`;
        context.beginPath();
        context.arc(wsx, wsy, 0.8, 0, Math.PI * 2);
        context.fill();
    }
    // Window cross
    context.strokeStyle = '#2a1808';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(nwinX + nwinW / 2, nwinY);
    context.lineTo(nwinX + nwinW / 2, nwinY + nwinH);
    context.moveTo(nwinX, nwinY + nwinH / 2);
    context.lineTo(nwinX + nwinW, nwinY + nwinH / 2);
    context.stroke();
    // Curtains
    context.fillStyle = '#7a4a80';
    context.beginPath();
    context.moveTo(nwinX - 4, nwinY - 4);
    context.quadraticCurveTo(nwinX - 16, nwinY + nwinH / 2, nwinX - 4, nwinY + nwinH + 4);
    context.lineTo(nwinX + 4, nwinY + nwinH + 4);
    context.lineTo(nwinX + 4, nwinY - 4);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(nwinX + nwinW + 4, nwinY - 4);
    context.quadraticCurveTo(nwinX + nwinW + 16, nwinY + nwinH / 2, nwinX + nwinW + 4, nwinY + nwinH + 4);
    context.lineTo(nwinX + nwinW - 4, nwinY + nwinH + 4);
    context.lineTo(nwinX + nwinW - 4, nwinY - 4);
    context.closePath();
    context.fill();

    // === DRESSER (right side) ===
    const drX = bedX + bedW + 15, drY = floorY - 70;
    const drW = 70, drH = 70;
    // Body with wood gradient
    const drG = context.createLinearGradient(drX, 0, drX + drW, 0);
    drG.addColorStop(0, '#3a2414');
    drG.addColorStop(0.5, '#6a4828');
    drG.addColorStop(1, '#2a1808');
    context.fillStyle = drG;
    context.fillRect(drX, drY, drW, drH);
    // Drawers
    context.strokeStyle = '#1a0a04';
    context.lineWidth = 1;
    for (let d = 0; d < 3; d++) {
        const dY = drY + 3 + d * 22;
        context.strokeRect(drX + 3, dY, drW - 6, 20);
        // Drawer knob
        context.fillStyle = '#d4af37';
        context.beginPath();
        context.arc(drX + drW / 2, dY + 10, 2, 0, Math.PI * 2);
        context.fill();
    }
    // Photo frame on top of dresser
    context.fillStyle = '#d4af37';
    context.fillRect(drX + 10, drY - 18, 22, 18);
    context.fillStyle = '#8aa5d8';
    context.fillRect(drX + 12, drY - 16, 18, 14);
    // Photo silhouette (two bunnies)
    context.fillStyle = '#1a1a1a';
    context.beginPath();
    context.arc(drX + 18, drY - 9, 2.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(drX + 25, drY - 9, 2.5, 0, Math.PI * 2);
    context.fill();
    // Alarm clock on dresser
    const clX = drX + 42, clY = drY - 10;
    context.fillStyle = '#2a1a1a';
    context.fillRect(clX, clY, 18, 10);
    context.fillStyle = '#ff4040';
    context.font = 'bold 8px Courier';
    context.fillText('23:47', clX + 1, clY + 8);
    // Bells on top
    context.fillStyle = '#d4af37';
    context.beginPath();
    context.arc(clX + 2, clY - 2, 2.5, 0, Math.PI * 2);
    context.arc(clX + 16, clY - 2, 2.5, 0, Math.PI * 2);
    context.fill();

    // === CIRCULAR RUG on the floor ===
    const rugX = bedX + bedW / 2, rugY = floorY + 25;
    // Outer ring
    const rugG = context.createRadialGradient(rugX, rugY, 0, rugX, rugY, 100);
    rugG.addColorStop(0, '#a02828');
    rugG.addColorStop(0.5, '#6a1818');
    rugG.addColorStop(0.8, '#a02828');
    rugG.addColorStop(1, '#4a0808');
    context.fillStyle = rugG;
    context.beginPath();
    context.ellipse(rugX, rugY, 100, 25, 0, 0, Math.PI * 2);
    context.fill();
    // Inner concentric rings
    context.strokeStyle = '#d4af37';
    context.lineWidth = 1;
    for (let rr = 0; rr < 3; rr++) {
        context.beginPath();
        context.ellipse(rugX, rugY, 100 - rr * 30, 25 - rr * 8, 0, 0, Math.PI * 2);
        context.stroke();
    }
    // Tassels on ends
    context.strokeStyle = '#8a2828';
    context.lineWidth = 1.2;
    for (let t = 0; t < 10; t++) {
        context.beginPath();
        context.moveTo(rugX - 100 + t * 0.5, rugY);
        context.lineTo(rugX - 103 + t * 0.5, rugY + 4);
        context.moveTo(rugX + 100 - t * 0.5, rugY);
        context.lineTo(rugX + 103 - t * 0.5, rugY + 4);
        context.stroke();
    }

    // === TEDDY BEAR on the bed ===
    const tbX = bedX + 75, tbY = bedY - 2;
    // Body
    context.fillStyle = '#8b5a2b';
    context.beginPath();
    context.arc(tbX, tbY, 9, 0, Math.PI * 2);
    context.fill();
    // Head
    context.beginPath();
    context.arc(tbX, tbY - 10, 6, 0, Math.PI * 2);
    context.fill();
    // Ears
    context.beginPath();
    context.arc(tbX - 4, tbY - 14, 2.5, 0, Math.PI * 2);
    context.arc(tbX + 4, tbY - 14, 2.5, 0, Math.PI * 2);
    context.fill();
    // Inner ears
    context.fillStyle = '#d8a870';
    context.beginPath();
    context.arc(tbX - 4, tbY - 14, 1.2, 0, Math.PI * 2);
    context.arc(tbX + 4, tbY - 14, 1.2, 0, Math.PI * 2);
    context.fill();
    // Muzzle
    context.beginPath();
    context.arc(tbX, tbY - 8, 2.5, 0, Math.PI * 2);
    context.fill();
    // Eyes
    context.fillStyle = '#1a1a1a';
    context.beginPath();
    context.arc(tbX - 2, tbY - 11, 0.8, 0, Math.PI * 2);
    context.arc(tbX + 2, tbY - 11, 0.8, 0, Math.PI * 2);
    context.fill();
    // Nose
    context.beginPath();
    context.arc(tbX, tbY - 8, 0.6, 0, Math.PI * 2);
    context.fill();
    // Bow tie
    context.fillStyle = '#c4302a';
    context.beginPath();
    context.moveTo(tbX - 3, tbY - 5);
    context.lineTo(tbX + 3, tbY - 5);
    context.lineTo(tbX + 1, tbY - 4);
    context.lineTo(tbX - 1, tbY - 4);
    context.closePath();
    context.fill();

    // === WALL ART / PICTURE FRAME ===
    const pfX = bedX - 60, pfY = height * 0.2;
    const pfW = 45, pfH = 35;
    context.fillStyle = '#d4af37';
    context.fillRect(pfX - 3, pfY - 3, pfW + 6, pfH + 6);
    // Inner image (moon landscape)
    const pictG = context.createLinearGradient(0, pfY, 0, pfY + pfH);
    pictG.addColorStop(0, '#1a2a5a');
    pictG.addColorStop(0.6, '#4a3a80');
    pictG.addColorStop(1, '#6a5aa0');
    context.fillStyle = pictG;
    context.fillRect(pfX, pfY, pfW, pfH);
    // Moon in picture
    context.fillStyle = '#f0e8a0';
    context.beginPath();
    context.arc(pfX + 10, pfY + 10, 4, 0, Math.PI * 2);
    context.fill();
    // Mountains in picture
    context.fillStyle = '#2a1830';
    context.beginPath();
    context.moveTo(pfX, pfY + pfH);
    context.lineTo(pfX + 12, pfY + pfH - 12);
    context.lineTo(pfX + 22, pfY + pfH - 6);
    context.lineTo(pfX + 32, pfY + pfH - 14);
    context.lineTo(pfX + pfW, pfY + pfH - 4);
    context.lineTo(pfX + pfW, pfY + pfH);
    context.closePath();
    context.fill();

    const vign = context.createRadialGradient(width / 2, height / 2, height * 0.4, width / 2, height / 2, height * 0.85);
    vign.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vign.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    context.fillStyle = vign;
    context.fillRect(0, 0, width, height);
}

function drawKitchenBackground(width, height) {
    const time = Date.now() * 0.001;
    const floorY = height * 0.72;

    // Warm wall — vertical gradient with subtle wallpaper texture
    const wallG = ctx.createLinearGradient(0, 0, 0, floorY);
    wallG.addColorStop(0, '#fff5d8');
    wallG.addColorStop(0.5, '#fde0a8');
    wallG.addColorStop(1, '#f5c878');
    ctx.fillStyle = wallG;
    ctx.fillRect(0, 0, width, floorY);

    // Subtle stripe pattern (wallpaper)
    ctx.strokeStyle = 'rgba(180, 130, 60, 0.08)';
    ctx.lineWidth = 1;
    for (let sx = 0; sx < width; sx += 28) {
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, floorY);
        ctx.stroke();
    }

    // Wall-floor baseboard with shadow
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(0, floorY - 6, width, 6);
    const baseShadowG = ctx.createLinearGradient(0, floorY - 14, 0, floorY - 6);
    baseShadowG.addColorStop(0, 'rgba(0,0,0,0)');
    baseShadowG.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = baseShadowG;
    ctx.fillRect(0, floorY - 14, width, 8);

    // === REALISTIC TILED FLOOR with perspective shading ===
    const tileSize = 32;
    for (let tx = 0; tx < width; tx += tileSize) {
        for (let ty = floorY; ty < height; ty += tileSize) {
            const isLight = (Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0;
            const baseColor = isLight ? '#fff0c8' : '#f0d090';
            ctx.fillStyle = baseColor;
            ctx.fillRect(tx, ty, tileSize, tileSize);
            // Subtle inner shading per tile
            const tg = ctx.createLinearGradient(tx, ty, tx + tileSize, ty + tileSize);
            tg.addColorStop(0, 'rgba(255,255,255,0.18)');
            tg.addColorStop(1, 'rgba(120,80,30,0.15)');
            ctx.fillStyle = tg;
            ctx.fillRect(tx, ty, tileSize, tileSize);
            // Grout lines
            ctx.strokeStyle = 'rgba(100, 70, 30, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx, ty, tileSize, tileSize);
        }
    }

    // === UPPER CABINETS — wood with grain and metal handles ===
    const cabW = 70, cabH = 60, cabY = height * 0.05;
    for (let i = 0; i < 3; i++) {
        const cx = width * 0.15 + i * (cabW + 18);
        // Cabinet body with vertical wood grain gradient
        const cabG = ctx.createLinearGradient(cx, 0, cx + cabW, 0);
        cabG.addColorStop(0, '#7c5a3c');
        cabG.addColorStop(0.5, '#a07a52');
        cabG.addColorStop(1, '#6b4a2e');
        ctx.fillStyle = cabG;
        ctx.fillRect(cx, cabY, cabW, cabH);
        // Inner panel (recessed look)
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx + 6, cabY + 6, cabW - 12, cabH - 12);
        ctx.strokeStyle = 'rgba(255,240,200,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 6, cabY + cabH - 6);
        ctx.lineTo(cx + 6, cabY + 6);
        ctx.lineTo(cx + cabW - 6, cabY + 6);
        ctx.stroke();
        // Wood grain lines
        ctx.strokeStyle = 'rgba(60, 35, 15, 0.18)';
        for (let g = 0; g < 4; g++) {
            ctx.beginPath();
            ctx.moveTo(cx + 8, cabY + 12 + g * 12);
            ctx.bezierCurveTo(cx + cabW * 0.4, cabY + 14 + g * 12, cx + cabW * 0.6, cabY + 10 + g * 12, cx + cabW - 8, cabY + 14 + g * 12);
            ctx.stroke();
        }
        // Metal handle (vertical, with shine)
        const handleG = ctx.createLinearGradient(cx + cabW / 2 - 2, 0, cx + cabW / 2 + 2, 0);
        handleG.addColorStop(0, '#888');
        handleG.addColorStop(0.5, '#e8e8e8');
        handleG.addColorStop(1, '#666');
        ctx.fillStyle = handleG;
        ctx.fillRect(cx + cabW / 2 - 2, cabY + cabH - 18, 4, 12);
    }

    // === FRIDGE — stainless with reflections ===
    const fridgeX = width * 0.78, fridgeW = 60, fridgeH = height * 0.5;
    const fridgeY = floorY - fridgeH;
    const fridgeG = ctx.createLinearGradient(fridgeX, 0, fridgeX + fridgeW, 0);
    fridgeG.addColorStop(0, '#bdbdbd');
    fridgeG.addColorStop(0.4, '#f0f0f0');
    fridgeG.addColorStop(0.6, '#ffffff');
    fridgeG.addColorStop(1, '#a8a8a8');
    ctx.fillStyle = fridgeG;
    ctx.fillRect(fridgeX, fridgeY, fridgeW, fridgeH);
    // Door divider
    ctx.fillStyle = '#888';
    ctx.fillRect(fridgeX, fridgeY + fridgeH * 0.32, fridgeW, 2);
    // Door handles
    ctx.fillStyle = '#666';
    ctx.fillRect(fridgeX + fridgeW - 8, fridgeY + 12, 4, 22);
    ctx.fillRect(fridgeX + fridgeW - 8, fridgeY + fridgeH * 0.32 + 12, 4, 22);
    // Outline
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fridgeX, fridgeY, fridgeW, fridgeH);

    // === DINING TABLE with realistic wood ===
    const tableX = width * 0.3, tableW = width * 0.35, tableH = 14;
    const tableY = floorY - 55;
    // Shadow under table
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(tableX + tableW / 2, floorY + 4, tableW * 0.55, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.fillStyle = '#5a3820';
    ctx.fillRect(tableX + 12, tableY + tableH, 7, 44);
    ctx.fillRect(tableX + tableW - 19, tableY + tableH, 7, 44);
    // Table top with wood gradient + grain
    const topG = ctx.createLinearGradient(0, tableY, 0, tableY + tableH);
    topG.addColorStop(0, '#a87844');
    topG.addColorStop(1, '#7a5430');
    ctx.fillStyle = topG;
    ctx.fillRect(tableX, tableY, tableW, tableH);
    // Wood grain lines on top
    ctx.strokeStyle = 'rgba(60, 35, 15, 0.3)';
    ctx.lineWidth = 0.7;
    for (let g = 0; g < 5; g++) {
        ctx.beginPath();
        ctx.moveTo(tableX + 5, tableY + 3 + g * 2.5);
        ctx.bezierCurveTo(
            tableX + tableW * 0.3, tableY + 2 + g * 2.5,
            tableX + tableW * 0.7, tableY + 4 + g * 2.5,
            tableX + tableW - 5, tableY + 3 + g * 2.5
        );
        ctx.stroke();
    }

    // Carrots on table — realistic with shine
    const carrots = [
        { x: tableX + 25, rot: -0.3 },
        { x: tableX + 55, rot: 0.1 },
        { x: tableX + tableW - 65, rot: 0.4 },
        { x: tableX + tableW - 35, rot: -0.2 }
    ];
    carrots.forEach((c, i) => {
        ctx.save();
        ctx.translate(c.x, tableY - 2);
        ctx.rotate(c.rot);
        // Carrot body — gradient
        const carG = ctx.createLinearGradient(-6, 0, 6, 0);
        carG.addColorStop(0, '#c25400');
        carG.addColorStop(0.5, '#ff8c1a');
        carG.addColorStop(1, '#a04500');
        ctx.fillStyle = carG;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(6, -22);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        // Shine highlight
        ctx.strokeStyle = 'rgba(255, 220, 180, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-2, -2);
        ctx.lineTo(2, -18);
        ctx.stroke();
        // Carrot ridges
        ctx.strokeStyle = 'rgba(120, 50, 0, 0.4)';
        ctx.lineWidth = 0.6;
        for (let r = 0; r < 3; r++) {
            const ry = -5 - r * 5;
            ctx.beginPath();
            ctx.moveTo(-3 + r, ry);
            ctx.lineTo(3 - r, ry);
            ctx.stroke();
        }
        // Greens — multi-leaf with depth
        ['#3a8a3a', '#4caf50', '#5fc05f'].forEach((gc, gi) => {
            ctx.fillStyle = gc;
            ctx.beginPath();
            ctx.ellipse(gi - 1, -22 - gi, 2.5 - gi * 0.3, 7 - gi, 0.3 - gi * 0.2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    });

    // === FOOD BOWL with steam ===
    const bowlX = tableX + tableW / 2;
    const bowlY = tableY - 6;
    // Bowl outer (ceramic with shading)
    const bowlG = ctx.createLinearGradient(bowlX, bowlY - 8, bowlX, bowlY + 12);
    bowlG.addColorStop(0, '#ffd0c8');
    bowlG.addColorStop(0.5, '#ff8a80');
    bowlG.addColorStop(1, '#c4524a');
    ctx.fillStyle = bowlG;
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY, 28, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bowl rim shine
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY - 1, 26, 9, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // Soup inside
    ctx.fillStyle = '#e0a060';
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY - 2, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Soup highlight
    ctx.fillStyle = 'rgba(255, 220, 180, 0.5)';
    ctx.beginPath();
    ctx.ellipse(bowlX - 6, bowlY - 4, 8, 2.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Steam — multiple curling tendrils with feathered edges
    for (let s = 0; s < 5; s++) {
        const steamPhase = time * 1.2 + s * 1.4;
        const steamCycle = (steamPhase % 4) / 4;
        const steamX = bowlX - 12 + s * 6 + Math.sin(steamPhase * 2) * 6;
        const steamY = bowlY - 12 - steamCycle * 32;
        const steamAlpha = (1 - steamCycle) * 0.45;
        if (steamAlpha > 0.02) {
            const sg = ctx.createRadialGradient(steamX, steamY, 0, steamX, steamY, 8 + steamCycle * 6);
            sg.addColorStop(0, `rgba(255, 255, 255, ${steamAlpha})`);
            sg.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = sg;
            ctx.fillRect(steamX - 14, steamY - 14, 28, 28);
        }
    }

    // === WINDOW with sky view + frame ===
    const winX = width * 0.4, winY = height * 0.08, winW = 75, winH = 55;
    // Window frame (wood)
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(winX - 5, winY - 5, winW + 10, winH + 10);
    // Sky view inside
    const skyView = ctx.createLinearGradient(0, winY, 0, winY + winH);
    skyView.addColorStop(0, '#7ec4f0');
    skyView.addColorStop(0.7, '#bce0f5');
    skyView.addColorStop(1, '#dceec0');
    ctx.fillStyle = skyView;
    ctx.fillRect(winX, winY, winW, winH);
    // Distant cloud in window
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(winX + winW * 0.3 + Math.sin(time * 0.3) * 5, winY + winH * 0.3, 8, 0, Math.PI * 2);
    ctx.arc(winX + winW * 0.4 + Math.sin(time * 0.3) * 5, winY + winH * 0.32, 6, 0, Math.PI * 2);
    ctx.fill();
    // Window cross + frame inner
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH / 2);
    ctx.lineTo(winX + winW, winY + winH / 2);
    ctx.stroke();
    // Glass shine
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(winX + 6, winY + 6);
    ctx.lineTo(winX + winW / 2 - 4, winY + winH / 2 - 4);
    ctx.stroke();

    // === WALL CLOCK ===
    const clockX = width * 0.65, clockY = height * 0.15, clockR = 22;
    // Clock housing gradient
    const clockG = ctx.createRadialGradient(clockX - 6, clockY - 6, 2, clockX, clockY, clockR);
    clockG.addColorStop(0, '#fff');
    clockG.addColorStop(0.7, '#f0dfb8');
    clockG.addColorStop(1, '#a07a40');
    ctx.fillStyle = clockG;
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hour marks
    ctx.fillStyle = '#3a2818';
    for (let h = 0; h < 12; h++) {
        const ha = (h / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(clockX + Math.cos(ha) * (clockR - 5), clockY + Math.sin(ha) * (clockR - 5), 1.2, 0, Math.PI * 2);
        ctx.fill();
    }
    // Clock hands (animated — slow minute, slower hour)
    const minA = (time / 10) % (Math.PI * 2);
    const hourA = (time / 120) % (Math.PI * 2);
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + Math.cos(hourA - Math.PI / 2) * (clockR - 10), clockY + Math.sin(hourA - Math.PI / 2) * (clockR - 10));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(clockX + Math.cos(minA - Math.PI / 2) * (clockR - 5), clockY + Math.sin(minA - Math.PI / 2) * (clockR - 5));
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Center dot
    ctx.fillStyle = '#3a2818';
    ctx.beginPath();
    ctx.arc(clockX, clockY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // === HANGING POTS above table (chef-style) ===
    const potY = height * 0.18;
    [width * 0.32, width * 0.4, width * 0.48].forEach((px, pi) => {
        // Hanging wire
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, height * 0.15);
        ctx.lineTo(px, potY);
        ctx.stroke();
        // Pot body (gradient copper)
        const potG = ctx.createLinearGradient(px - 12, 0, px + 12, 0);
        potG.addColorStop(0, '#8a4020');
        potG.addColorStop(0.5, '#d06830');
        potG.addColorStop(1, '#6a3010');
        ctx.fillStyle = potG;
        const potSize = 10 + pi * 2;
        ctx.fillRect(px - potSize, potY, potSize * 2, potSize * 1.4);
        // Handle
        ctx.strokeStyle = '#3a1808';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, potY, potSize * 1.1, 0, Math.PI, true);
        ctx.stroke();
    });

    // === FRUIT BOWL on left ===
    const fbX = tableX + 12, fbY = tableY - 6;
    // Bowl
    const fbG = ctx.createLinearGradient(fbX, fbY - 5, fbX, fbY + 8);
    fbG.addColorStop(0, '#e0c8a8');
    fbG.addColorStop(1, '#a07a50');
    ctx.fillStyle = fbG;
    ctx.beginPath();
    ctx.ellipse(fbX, fbY, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fruits (apple red, orange, green apple)
    const fruits = [
        { c: '#c4302a', x: fbX - 5, y: fbY - 3, r: 4 },
        { c: '#ff8c1a', x: fbX + 3, y: fbY - 4, r: 4 },
        { c: '#7ac070', x: fbX, y: fbY - 5, r: 3.5 }
    ];
    fruits.forEach(f => {
        const fg = ctx.createRadialGradient(f.x - 1, f.y - 1, 0.5, f.x, f.y, f.r);
        fg.addColorStop(0, shiftColor(f.c, 40));
        fg.addColorStop(1, f.c);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        // Tiny highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(f.x - f.r * 0.3, f.y - f.r * 0.4, f.r * 0.2, 0, Math.PI * 2);
        ctx.fill();
    });

    // === POTTED PLANT on windowsill ===
    const plantX = winX + winW + 8, plantY = winY + winH - 5;
    // Pot
    ctx.fillStyle = '#a04030';
    ctx.beginPath();
    ctx.moveTo(plantX - 10, plantY);
    ctx.lineTo(plantX + 10, plantY);
    ctx.lineTo(plantX + 8, plantY + 14);
    ctx.lineTo(plantX - 8, plantY + 14);
    ctx.closePath();
    ctx.fill();
    // Pot rim
    ctx.fillStyle = '#c05040';
    ctx.fillRect(plantX - 11, plantY, 22, 2);
    // Leaves (animated slight sway)
    const psway = Math.sin(time * 1.5) * 1.5;
    ctx.fillStyle = '#3a8a3a';
    for (let l = 0; l < 5; l++) {
        const la = (l / 4) * Math.PI - Math.PI / 2;
        const llx = plantX + Math.cos(la) * 8 + psway * Math.cos(la);
        const lly = plantY - 5 + Math.sin(la) * 10;
        ctx.beginPath();
        ctx.ellipse(llx, lly, 4, 8, la + psway * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }

    // === STOVE with glowing burners ===
    const stoveX = width * 0.55, stoveY = floorY - 50;
    // Stove body (stainless)
    const stoveG = ctx.createLinearGradient(stoveX, stoveY, stoveX, stoveY + 50);
    stoveG.addColorStop(0, '#c0c0c0');
    stoveG.addColorStop(0.4, '#e8e8e8');
    stoveG.addColorStop(1, '#707070');
    ctx.fillStyle = stoveG;
    ctx.fillRect(stoveX, stoveY, 55, 50);
    // Oven window
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(stoveX + 6, stoveY + 22, 43, 22);
    ctx.strokeStyle = '#888';
    ctx.strokeRect(stoveX + 6, stoveY + 22, 43, 22);
    // Warm glow from oven
    const ovenGlow = ctx.createRadialGradient(stoveX + 28, stoveY + 33, 0, stoveX + 28, stoveY + 33, 20);
    ovenGlow.addColorStop(0, 'rgba(255, 140, 40, 0.6)');
    ovenGlow.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = ovenGlow;
    ctx.fillRect(stoveX + 8, stoveY + 24, 39, 18);
    // Oven handle
    ctx.fillStyle = '#555';
    ctx.fillRect(stoveX + 5, stoveY + 19, 45, 3);
    // Burners (2 on top)
    [stoveX + 14, stoveX + 40].forEach((bx, bi) => {
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(bx, stoveY + 9, 7, 0, Math.PI * 2);
        ctx.fill();
        // Burner glow (one is on, one is off)
        if (bi === 0) {
            const burnGlow = ctx.createRadialGradient(bx, stoveY + 9, 0, bx, stoveY + 9, 8);
            burnGlow.addColorStop(0, 'rgba(255, 60, 20, 0.9)');
            burnGlow.addColorStop(1, 'rgba(255, 60, 20, 0)');
            ctx.fillStyle = burnGlow;
            ctx.fillRect(bx - 10, stoveY - 1, 20, 20);
            // Coil
            ctx.strokeStyle = '#ff4020';
            ctx.lineWidth = 1;
            for (let rr = 1; rr < 4; rr++) {
                ctx.beginPath();
                ctx.arc(bx, stoveY + 9, rr * 1.5, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    });
    // Knobs
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(stoveX + 15, stoveY + 55, 3, 0, Math.PI * 2);
    ctx.arc(stoveX + 40, stoveY + 55, 3, 0, Math.PI * 2);
    ctx.fill();

    // === COFFEE MAKER ===
    const cmX = stoveX + 65, cmY = floorY - 35;
    // Body
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cmX, cmY, 20, 35);
    // Top cap
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cmX - 2, cmY, 24, 4);
    // Glass carafe (half-full of coffee)
    ctx.fillStyle = '#4a2818';
    ctx.fillRect(cmX + 3, cmY + 20, 14, 10);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(cmX + 3, cmY + 8, 14, 22);
    // Handle
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cmX + 17, cmY + 14);
    ctx.quadraticCurveTo(cmX + 22, cmY + 20, cmX + 17, cmY + 28);
    ctx.stroke();
    // Power LED (green)
    ctx.fillStyle = '#4aff4a';
    ctx.beginPath();
    ctx.arc(cmX + 16, cmY + 6, 1, 0, Math.PI * 2);
    ctx.fill();
    // Steam rising
    for (let s = 0; s < 3; s++) {
        const stPhase = (time * 1.5 + s * 0.8) % 3;
        const stX = cmX + 10 + Math.sin(stPhase * 2) * 3;
        const stY = cmY - 2 - stPhase * 8;
        const stA = (1 - stPhase / 3) * 0.4;
        if (stA > 0.02) {
            const stG = ctx.createRadialGradient(stX, stY, 0, stX, stY, 5);
            stG.addColorStop(0, `rgba(255, 255, 255, ${stA})`);
            stG.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = stG;
            ctx.fillRect(stX - 6, stY - 6, 12, 12);
        }
    }

    // === COOKBOOK on counter ===
    const bkX = tableX + tableW + 8, bkY = tableY;
    // Stacked books
    [
        { c: '#c62828', h: 4 },
        { c: '#2e7d32', h: 3 },
        { c: '#6a1b9a', h: 3 }
    ].forEach((bk, bi) => {
        const yOff = bkY - 2 - bi * 4;
        ctx.fillStyle = bk.c;
        ctx.fillRect(bkX, yOff, 20 - bi * 2, bk.h);
        // Spine detail
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(bkX + 1, yOff + 1, 18 - bi * 2, 0.8);
    });

    // === HANGING UTENSILS on rail ===
    const railX = stoveX + 6, railY = stoveY - 25;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(railX - 3, railY);
    ctx.lineTo(railX + 50, railY);
    ctx.stroke();
    // Spatula
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(railX + 5, railY);
    ctx.lineTo(railX + 5, railY + 14);
    ctx.stroke();
    ctx.fillStyle = '#ff6040';
    ctx.fillRect(railX + 3, railY + 10, 4, 8);
    // Whisk
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(railX + 18, railY);
    ctx.lineTo(railX + 18, railY + 14);
    ctx.stroke();
    for (let w = -2; w <= 2; w++) {
        ctx.beginPath();
        ctx.moveTo(railX + 18, railY + 10);
        ctx.quadraticCurveTo(railX + 18 + w * 2, railY + 16, railX + 18, railY + 20);
        ctx.stroke();
    }
    // Wooden spoon
    ctx.strokeStyle = '#8a5a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(railX + 32, railY);
    ctx.lineTo(railX + 32, railY + 15);
    ctx.stroke();
    ctx.fillStyle = '#8a5a30';
    ctx.beginPath();
    ctx.ellipse(railX + 32, railY + 19, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // === BREAD LOAF on cutting board ===
    const cbX = tableX + 20, cbY = tableY - 3;
    ctx.fillStyle = '#6a4020';
    ctx.fillRect(cbX, cbY, 28, 2);
    // Loaf
    ctx.fillStyle = '#c09060';
    ctx.beginPath();
    ctx.ellipse(cbX + 14, cbY - 3, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a5a30';
    ctx.beginPath();
    ctx.ellipse(cbX + 14, cbY - 5, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crust highlights
    ctx.strokeStyle = '#6a3810';
    ctx.lineWidth = 0.6;
    for (let cr = -2; cr <= 2; cr++) {
        ctx.beginPath();
        ctx.moveTo(cbX + 14 + cr * 3, cbY - 6);
        ctx.lineTo(cbX + 14 + cr * 3, cbY - 3);
        ctx.stroke();
    }
}

function drawPlaygroundBackground(width, height) {
    const time = Date.now() * 0.001;
    const horizon = height * 0.55;

    // Realistic sky with multi-stop gradient
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#4a8fc7');
    sky.addColorStop(0.45, '#7ab8de');
    sky.addColorStop(0.85, '#bce0f5');
    sky.addColorStop(1, '#dbe8c5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon);

    // Sun with multi-layer glow (matching forest)
    const sunX = width * 0.85, sunY = height * 0.12;
    const outerSun = ctx.createRadialGradient(sunX, sunY, 30, sunX, sunY, 200);
    outerSun.addColorStop(0, 'rgba(255, 240, 180, 0.35)');
    outerSun.addColorStop(0.5, 'rgba(255, 230, 160, 0.12)');
    outerSun.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = outerSun;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    const innerSun = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 60);
    innerSun.addColorStop(0, 'rgba(255, 252, 220, 0.95)');
    innerSun.addColorStop(0.5, 'rgba(255, 245, 180, 0.5)');
    innerSun.addColorStop(1, 'rgba(255, 240, 160, 0)');
    ctx.fillStyle = innerSun;
    ctx.fillRect(sunX - 60, sunY - 60, 120, 120);
    ctx.fillStyle = '#fff8c8';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Realistic drifting clouds
    drawCloudsToContext(ctx, width, height);

    // Distant hills behind field for depth
    _drawHillLayer(ctx, width, horizon - height * 0.04, height * 0.10, '#7da57d', '#6a9070', 0.022, 1.5, 22);

    const groundY = horizon;

    // Realistic grass field with depth gradient
    const fieldG = ctx.createLinearGradient(0, groundY, 0, height);
    fieldG.addColorStop(0, '#7ec07e');
    fieldG.addColorStop(0.3, '#5eaf5e');
    fieldG.addColorStop(1, '#3e8a3e');
    ctx.fillStyle = fieldG;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Mowed-stripe pattern (alternating darker bands across field)
    ctx.globalAlpha = 0.18;
    for (let stripe = 0; stripe < 6; stripe++) {
        ctx.fillStyle = stripe % 2 === 0 ? '#2d6a2d' : '#7ec07e';
        const sy = groundY + stripe * ((height - groundY) / 6);
        ctx.fillRect(0, sy, width, (height - groundY) / 6);
    }
    ctx.globalAlpha = 1;

    // Scattered grass blades
    for (let i = 0; i < 80; i++) {
        const gx = (i * 53 + Math.sin(i * 3.7) * 12) % width;
        const depth = ((i * 79) % 100) / 100;
        const gy = groundY + 4 + depth * (height - groundY - 8);
        const bladeH = 3 + depth * 8;
        ctx.strokeStyle = depth > 0.5 ? '#3a7a3a' : '#5aa55a';
        ctx.lineWidth = 0.8 + depth * 0.5;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(gx + (i % 3 - 1), gy - bladeH * 0.6, gx + (i % 5 - 2), gy - bladeH);
        ctx.stroke();
    }

    // === FOOTBALL FIELD AND PASSING GAME ===

    // Field lines
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.75, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.75, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(width * 0.05, groundY, width * 0.9, height - groundY - 10);

    // Goal posts with chrome shading + net mesh
    const drawGoal = (postX, sideMul) => {
        const topY = height * 0.65, botY = height * 0.85;
        const armX = postX + sideMul * width * 0.07;
        // Net mesh (drawn first, behind frame)
        ctx.strokeStyle = 'rgba(220, 220, 220, 0.4)';
        ctx.lineWidth = 0.6;
        for (let nx = postX; sideMul > 0 ? nx <= armX : nx >= armX; nx += sideMul * 6) {
            ctx.beginPath();
            ctx.moveTo(nx, topY);
            ctx.lineTo(nx, botY);
            ctx.stroke();
        }
        for (let ny = topY; ny <= botY; ny += 6) {
            ctx.beginPath();
            ctx.moveTo(postX, ny);
            ctx.lineTo(armX, ny);
            ctx.stroke();
        }
        // Frame with chrome gradient
        const postG = ctx.createLinearGradient(postX - 2, 0, postX + 2, 0);
        postG.addColorStop(0, '#ccc');
        postG.addColorStop(0.5, '#fff');
        postG.addColorStop(1, '#999');
        ctx.fillStyle = postG;
        ctx.fillRect(postX - 2, topY, 4, botY - topY);
        // Crossbar
        const barG = ctx.createLinearGradient(0, topY - 2, 0, topY + 2);
        barG.addColorStop(0, '#ccc');
        barG.addColorStop(0.5, '#fff');
        barG.addColorStop(1, '#999');
        ctx.fillStyle = barG;
        ctx.fillRect(Math.min(postX, armX) - 2, topY - 2, Math.abs(armX - postX) + 4, 4);
        // Bottom bar (back of goal)
        ctx.fillStyle = '#aaa';
        ctx.fillRect(Math.min(postX, armX) - 2, botY - 2, Math.abs(armX - postX) + 4, 4);
    };
    drawGoal(width * 0.05, 1);
    drawGoal(width * 0.95, -1);

    // Football: use mini-game ball position when active, otherwise show passing animation
    if (footballGame.active) {
        // Draw the football at the mini-game ball position
        const fbX = footballGame.ballX;
        const fbY = footballGame.ballY;

        // Ball shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(fbX, fbY + 15, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Football with spin
        ctx.save();
        ctx.translate(fbX, fbY);
        ctx.rotate(time * 8);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#333';
        for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    } else {
        // Original passing animation
        const fieldPlayers = [];
        const blackPos = parentBunnyPositions.parent_black;
        const whitePos = parentBunnyPositions.parent_white;
        if (blackPos) fieldPlayers.push({ x: blackPos.x, y: blackPos.y });
        if (whitePos) fieldPlayers.push({ x: whitePos.x, y: whitePos.y });
        if (gameState && gameState.babies) {
            gameState.babies.forEach(baby => {
                if (baby.stage !== 'egg') {
                    const pos = getBunnyPosition(baby.id);
                    fieldPlayers.push({ x: pos.x, y: pos.y });
                }
            });
        }

        if (fieldPlayers.length >= 2) {
            const passSpeed = 1.5;
            const totalCycle = fieldPlayers.length * passSpeed;
            const cycleTime = time % totalCycle;
            const passIdx = Math.floor(cycleTime / passSpeed);
            const progress = (cycleTime % passSpeed) / passSpeed;

            const from = fieldPlayers[passIdx % fieldPlayers.length];
            const to = fieldPlayers[(passIdx + 1) % fieldPlayers.length];

            const fbX = from.x + (to.x - from.x) * progress;
            const fbBaseY = from.y + (to.y - from.y) * progress;
            const arcH = Math.sin(progress * Math.PI) * 45;
            const fbY = fbBaseY - arcH;

            // Ball shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.ellipse(fbX, fbBaseY + 20, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Football with spin
            ctx.save();
            ctx.translate(fbX, fbY);
            ctx.rotate(time * 8);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#333';
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Pass trail
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Highlight receiver
            ctx.strokeStyle = `rgba(255, 235, 59, ${0.3 + progress * 0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(to.x, to.y, 25 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Scoreboard (only when not in mini-game, mini-game has its own)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(width / 2 - 55, 5, 110, 30);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚽ PLAY TIME! ⚽', width / 2, 25);
        ctx.textAlign = 'left';
    }

    // Corner flags
    const flagWave = Math.sin(time * 4) * 5;
    [[width * 0.05, groundY], [width * 0.95, groundY], [width * 0.05, height - 10], [width * 0.95, height - 10]].forEach(([cx, cy]) => {
        ctx.strokeStyle = '#795548';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - 25);
        ctx.stroke();
        ctx.fillStyle = '#f44336';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 25);
        ctx.lineTo(cx + 10 + flagWave, cy - 22);
        ctx.lineTo(cx, cy - 18);
        ctx.fill();
    });

    // === SLIDE (playground equipment) ===
    // Equipment scale — bump everything up so the set is sized to a parent
    // bunny (~60px radius) instead of the previous toy-town look.
    const PLAY_EQUIP_SCALE = 1.8;
    const slideX = width * 0.18, slideBaseY = height * 0.88;
    ctx.save();
    ctx.translate(slideX, slideBaseY);
    ctx.scale(PLAY_EQUIP_SCALE, PLAY_EQUIP_SCALE);
    ctx.translate(-slideX, -slideBaseY);
    // Ladder posts
    ctx.fillStyle = '#c04020';
    ctx.fillRect(slideX - 2, slideBaseY - 45, 3, 45);
    ctx.fillRect(slideX + 14, slideBaseY - 45, 3, 45);
    // Platform
    ctx.fillStyle = '#e0a030';
    ctx.fillRect(slideX - 3, slideBaseY - 48, 18, 4);
    // Ladder rungs
    ctx.strokeStyle = '#a03010';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 4; r++) {
        ctx.beginPath();
        ctx.moveTo(slideX - 1, slideBaseY - 10 - r * 10);
        ctx.lineTo(slideX + 15, slideBaseY - 10 - r * 10);
        ctx.stroke();
    }
    // Slide surface (curved metal)
    const slideG = ctx.createLinearGradient(slideX + 15, 0, slideX + 50, 0);
    slideG.addColorStop(0, '#ffc850');
    slideG.addColorStop(0.5, '#fff0a8');
    slideG.addColorStop(1, '#c07018');
    ctx.fillStyle = slideG;
    ctx.beginPath();
    ctx.moveTo(slideX + 15, slideBaseY - 45);
    ctx.quadraticCurveTo(slideX + 35, slideBaseY - 30, slideX + 50, slideBaseY - 5);
    ctx.lineTo(slideX + 56, slideBaseY - 5);
    ctx.quadraticCurveTo(slideX + 41, slideBaseY - 38, slideX + 21, slideBaseY - 48);
    ctx.closePath();
    ctx.fill();
    // Slide rails (sides)
    ctx.strokeStyle = '#a05010';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(slideX + 15, slideBaseY - 45);
    ctx.quadraticCurveTo(slideX + 35, slideBaseY - 30, slideX + 50, slideBaseY - 5);
    ctx.moveTo(slideX + 21, slideBaseY - 48);
    ctx.quadraticCurveTo(slideX + 41, slideBaseY - 38, slideX + 56, slideBaseY - 5);
    ctx.stroke();

    ctx.restore();

    // === SWING SET ===
    const swX = width * 0.75, swY = height * 0.68;
    ctx.save();
    ctx.translate(swX, swY);
    ctx.scale(PLAY_EQUIP_SCALE, PLAY_EQUIP_SCALE);
    ctx.translate(-swX, -swY);
    // A-frame posts
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(swX - 30, swY + 38);
    ctx.lineTo(swX, swY);
    ctx.lineTo(swX + 30, swY + 38);
    ctx.stroke();
    // Top bar
    ctx.beginPath();
    ctx.moveTo(swX - 20, swY);
    ctx.lineTo(swX + 20, swY);
    ctx.stroke();
    // Swing ropes (swaying)
    const swingAngle = Math.sin(time * 1.2) * 0.15;
    const seatX = swX + Math.sin(swingAngle) * 20;
    const seatY = swY + 25 + (1 - Math.cos(swingAngle)) * 5;
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(swX - 8, swY);
    ctx.lineTo(seatX - 6, seatY);
    ctx.moveTo(swX + 8, swY);
    ctx.lineTo(seatX + 6, seatY);
    ctx.stroke();
    // Seat
    ctx.fillStyle = '#c04020';
    ctx.fillRect(seatX - 10, seatY, 20, 4);
    ctx.fillStyle = '#ff8060';
    ctx.fillRect(seatX - 10, seatY, 20, 1);

    ctx.restore();

    // === SEESAW ===
    const ssX = width * 0.48, ssY = height * 0.78;
    ctx.save();
    ctx.translate(ssX, ssY);
    ctx.scale(PLAY_EQUIP_SCALE, PLAY_EQUIP_SCALE);
    ctx.translate(-ssX, -ssY);
    const ssPivot = Math.sin(time * 1.4) * 0.25;
    // Pivot fulcrum
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(ssX - 8, ssY + 18);
    ctx.lineTo(ssX + 8, ssY + 18);
    ctx.lineTo(ssX, ssY);
    ctx.closePath();
    ctx.fill();
    // Plank (rocks on pivot)
    ctx.save();
    ctx.translate(ssX, ssY);
    ctx.rotate(ssPivot);
    // Plank body (painted red/yellow stripes)
    const plankG = ctx.createLinearGradient(-50, 0, 50, 0);
    plankG.addColorStop(0, '#e84020');
    plankG.addColorStop(0.5, '#ffc820');
    plankG.addColorStop(1, '#e84020');
    ctx.fillStyle = plankG;
    ctx.fillRect(-50, -4, 100, 6);
    // Plank outline
    ctx.strokeStyle = '#a02810';
    ctx.lineWidth = 1;
    ctx.strokeRect(-50, -4, 100, 6);
    // Handle bars on both ends (for bunnies to hold)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-48, -4);
    ctx.lineTo(-48, -10);
    ctx.moveTo(48, -4);
    ctx.lineTo(48, -10);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // === SANDBOX with toys ===
    const sbX = width * 0.35, sbY = height * 0.88;
    ctx.save();
    ctx.translate(sbX, sbY);
    ctx.scale(PLAY_EQUIP_SCALE, PLAY_EQUIP_SCALE);
    ctx.translate(-sbX, -sbY);
    const sbW = 60, sbH = 18;
    // Wood frame
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(sbX, sbY, sbW, sbH);
    // Inner sand
    const sandG = ctx.createLinearGradient(0, sbY + 3, 0, sbY + sbH);
    sandG.addColorStop(0, '#f8e8a0');
    sandG.addColorStop(1, '#d4b060');
    ctx.fillStyle = sandG;
    ctx.fillRect(sbX + 3, sbY + 3, sbW - 6, sbH - 6);
    // Sand grain texture (dots)
    ctx.fillStyle = 'rgba(150, 100, 40, 0.4)';
    for (let g = 0; g < 20; g++) {
        const gX = sbX + 4 + (g * 7) % (sbW - 8);
        const gY = sbY + 5 + (g * 13) % (sbH - 8);
        ctx.beginPath();
        ctx.arc(gX, gY, 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
    // Sand bucket
    const bkX = sbX + 8;
    ctx.fillStyle = '#ff5722';
    ctx.beginPath();
    ctx.moveTo(bkX, sbY + 4);
    ctx.lineTo(bkX + 10, sbY + 4);
    ctx.lineTo(bkX + 8, sbY + 12);
    ctx.lineTo(bkX + 2, sbY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c03010';
    ctx.stroke();
    // Bucket handle
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bkX + 5, sbY + 4, 4, Math.PI, 0);
    ctx.stroke();
    // Sand shovel
    ctx.strokeStyle = '#0a78d8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sbX + sbW - 18, sbY + 5);
    ctx.lineTo(sbX + sbW - 14, sbY + 12);
    ctx.stroke();
    ctx.fillStyle = '#0a78d8';
    ctx.beginPath();
    ctx.moveTo(sbX + sbW - 16, sbY + 10);
    ctx.lineTo(sbX + sbW - 10, sbY + 12);
    ctx.lineTo(sbX + sbW - 13, sbY + 14);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // === PICNIC TABLE (distant, behind field) ===
    const ptX = width * 0.6, ptY = height * 0.60;
    ctx.save();
    ctx.translate(ptX, ptY);
    ctx.scale(PLAY_EQUIP_SCALE, PLAY_EQUIP_SCALE);
    ctx.translate(-ptX, -ptY);
    // Umbrella pole + fabric
    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ptX, ptY - 22);
    ctx.lineTo(ptX, ptY - 2);
    ctx.stroke();
    // Umbrella
    const umbG = ctx.createLinearGradient(ptX - 18, 0, ptX + 18, 0);
    umbG.addColorStop(0, '#e84040');
    umbG.addColorStop(0.5, '#ffffff');
    umbG.addColorStop(1, '#e84040');
    ctx.fillStyle = umbG;
    ctx.beginPath();
    ctx.moveTo(ptX - 18, ptY - 22);
    ctx.quadraticCurveTo(ptX, ptY - 32, ptX + 18, ptY - 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a02810';
    ctx.stroke();
    // Umbrella segments
    for (let u = -1; u <= 1; u++) {
        ctx.beginPath();
        ctx.moveTo(ptX, ptY - 28);
        ctx.lineTo(ptX + u * 10, ptY - 22);
        ctx.stroke();
    }
    // Table
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(ptX - 16, ptY - 2, 32, 3);
    // Table legs
    ctx.fillRect(ptX - 14, ptY + 1, 2, 8);
    ctx.fillRect(ptX + 12, ptY + 1, 2, 8);
    // Bench
    ctx.fillStyle = '#a07040';
    ctx.fillRect(ptX - 16, ptY + 6, 32, 2);
    ctx.restore();
}


function drawBathroomBackground(width, height) {
    const time = Date.now() * 0.001;

    // Wall gradient — soft cyan to teal
    const wallG = ctx.createLinearGradient(0, 0, 0, height);
    wallG.addColorStop(0, '#e6f5ee');
    wallG.addColorStop(0.5, '#cfeaf0');
    wallG.addColorStop(1, '#a8d5e0');
    ctx.fillStyle = wallG;
    ctx.fillRect(0, 0, width, height);

    // === REALISTIC CERAMIC TILE WALL with grout, shading, and shine ===
    const tileSize = 32;
    const tileBandY = height * 0.55;
    for (let tx = 0; tx < width; tx += tileSize) {
        for (let ty = 0; ty < tileBandY; ty += tileSize) {
            // Subway tile offset: every other row shifted half a tile
            const rowShift = (Math.floor(ty / tileSize) % 2) * (tileSize / 2);
            const x = tx + rowShift;
            // Ceramic tint variation
            const tint = (((tx * 7) ^ (ty * 13)) % 100) / 100;
            const baseR = 218 + Math.floor(tint * 18);
            const baseG = 235 + Math.floor(tint * 12);
            const baseB = 240 + Math.floor(tint * 10);
            const tileGrad = ctx.createLinearGradient(x, ty, x + tileSize, ty + tileSize);
            tileGrad.addColorStop(0, `rgb(${baseR + 10}, ${baseG + 8}, ${baseB + 5})`);
            tileGrad.addColorStop(0.5, `rgb(${baseR}, ${baseG}, ${baseB})`);
            tileGrad.addColorStop(1, `rgb(${baseR - 25}, ${baseG - 18}, ${baseB - 12})`);
            ctx.fillStyle = tileGrad;
            ctx.fillRect(x, ty, tileSize, tileSize);
            // Glossy highlight (top edge)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillRect(x + 2, ty + 2, tileSize - 4, 3);
            // Grout
            ctx.strokeStyle = 'rgba(120, 140, 150, 0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, ty, tileSize, tileSize);
        }
    }

    // Tile-to-wall divider (decorative trim)
    ctx.fillStyle = '#90c7d2';
    ctx.fillRect(0, tileBandY, width, 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(0, tileBandY, width, 1);

    // === REALISTIC SHOWER HEAD with chrome ===
    const showerX = width * 0.7;
    // Pipe (chrome gradient)
    const pipeG = ctx.createLinearGradient(showerX - 4, 0, showerX + 4, 0);
    pipeG.addColorStop(0, '#7a8a92');
    pipeG.addColorStop(0.5, '#e8eef0');
    pipeG.addColorStop(1, '#5a6a72');
    ctx.fillStyle = pipeG;
    ctx.fillRect(showerX - 4, height * 0.08, 8, height * 0.18);
    // Shower head (chrome dome)
    const headG = ctx.createRadialGradient(showerX - 4, height * 0.27 - 4, 2, showerX, height * 0.27, 18);
    headG.addColorStop(0, '#ffffff');
    headG.addColorStop(0.4, '#d0d8de');
    headG.addColorStop(1, '#7a8a92');
    ctx.fillStyle = headG;
    ctx.beginPath();
    ctx.ellipse(showerX, height * 0.27, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a6a72';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Spray nozzle dots
    ctx.fillStyle = '#3a4a52';
    for (let n = -3; n <= 3; n++) {
        ctx.beginPath();
        ctx.arc(showerX + n * 4, height * 0.27 + 5, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Animated water drops from shower — elongated teardrops with shine
    for (let d = 0; d < 14; d++) {
        const dropPhase = (time * 2.5 + d * 0.4) % 4;
        const dropX = showerX - 12 + (d % 7) * 4 + Math.sin(d * 1.3) * 2;
        const dropY = height * 0.30 + dropPhase * (height * 0.10);
        const dropAlpha = 0.7 - dropPhase * 0.15;
        if (dropAlpha > 0) {
            // Streak (motion blur)
            ctx.strokeStyle = `rgba(100, 181, 246, ${dropAlpha * 0.4})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(dropX, dropY - 8);
            ctx.lineTo(dropX, dropY - 2);
            ctx.stroke();
            // Drop body
            ctx.fillStyle = `rgba(100, 181, 246, ${dropAlpha})`;
            ctx.beginPath();
            ctx.moveTo(dropX, dropY - 4);
            ctx.quadraticCurveTo(dropX + 2.5, dropY, dropX, dropY + 5);
            ctx.quadraticCurveTo(dropX - 2.5, dropY, dropX, dropY - 4);
            ctx.fill();
            // Highlight
            ctx.fillStyle = `rgba(255, 255, 255, ${dropAlpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(dropX - 0.8, dropY - 1, 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === REALISTIC BATHTUB — porcelain with shading + shadow ===
    const tubX = width * 0.2, tubY = height * 0.6, tubW = width * 0.5, tubH = 75;
    const tubCx = tubX + tubW / 2, tubCy = tubY + tubH / 2;
    // Floor shadow under tub
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(tubCx, tubY + tubH + 8, tubW / 2 + 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tub outer shape (porcelain with subtle shading)
    const tubG = ctx.createLinearGradient(tubX, tubY, tubX, tubY + tubH);
    tubG.addColorStop(0, '#ffffff');
    tubG.addColorStop(0.5, '#f5f8fa');
    tubG.addColorStop(1, '#c8d2da');
    ctx.fillStyle = tubG;
    ctx.beginPath();
    ctx.ellipse(tubCx, tubCy, tubW / 2, tubH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner basin (darker — gives recessed look)
    const innerG = ctx.createRadialGradient(tubCx - 20, tubCy - 12, 8, tubCx, tubCy, tubW / 2 - 10);
    innerG.addColorStop(0, '#dae8ee');
    innerG.addColorStop(1, '#9bb5c0');
    ctx.fillStyle = innerG;
    ctx.beginPath();
    ctx.ellipse(tubCx, tubCy + 4, tubW / 2 - 12, tubH / 2 - 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tub rim outline + chrome shine
    ctx.strokeStyle = '#a0b0b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(tubCx, tubCy, tubW / 2, tubH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(tubCx, tubCy, tubW / 2 - 1, tubH / 2 - 1, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Water with translucent depth + reflection
    const waterCenterX = tubCx;
    const waterCenterY = tubCy + 6;
    const waterRX = tubW / 2 - 14;
    const waterRY = tubH / 2 - 12;
    const waterG = ctx.createRadialGradient(waterCenterX - 15, waterCenterY - 8, 5, waterCenterX, waterCenterY, waterRX);
    waterG.addColorStop(0, 'rgba(180, 230, 250, 0.7)');
    waterG.addColorStop(0.6, 'rgba(100, 181, 246, 0.55)');
    waterG.addColorStop(1, 'rgba(40, 110, 180, 0.6)');
    ctx.fillStyle = waterG;
    ctx.beginPath();
    ctx.ellipse(waterCenterX, waterCenterY, waterRX, waterRY, 0, 0, Math.PI * 2);
    ctx.fill();
    // Surface light reflection (animated)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        const refY = waterCenterY - waterRY * 0.4 + r * 4;
        for (let wx = waterCenterX - waterRX * 0.7; wx <= waterCenterX + waterRX * 0.7; wx += 3) {
            const wy = refY + Math.sin(time * 2 + wx * 0.08 + r) * 1.5;
            if (wx === waterCenterX - waterRX * 0.7) ctx.moveTo(wx, wy);
            else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
    }
    // Floating soap bubbles (animated, floating upward)
    for (let b = 0; b < 10; b++) {
        const bubPhase = (time * 0.8 + b * 1.3) % 5;
        const bx = tubX + 20 + (b * 37) % (tubW - 40);
        const by = tubY + 10 - bubPhase * 15;
        const br = 3 + Math.sin(time + b) * 1.5;
        const bubAlpha = 0.5 - bubPhase * 0.1;
        if (bubAlpha > 0) {
            // Bubble body
            ctx.beginPath();
            ctx.arc(bx + Math.sin(time * 2 + b) * 5, by, br, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${bubAlpha})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(180, 220, 255, ${bubAlpha * 0.7})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            // Bubble highlight
            ctx.fillStyle = `rgba(255, 255, 255, ${bubAlpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(bx + Math.sin(time * 2 + b) * 5 - br * 0.3, by - br * 0.3, br * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // === RUBBER DUCK (drawn, not emoji) ===
    const duckX = tubX + tubW * 0.65 + Math.sin(time * 1.5) * 8;
    const duckY = tubY + 22 + Math.sin(time * 2) * 3;
    ctx.save();
    ctx.translate(duckX, duckY);
    ctx.rotate(Math.sin(time * 1.5) * 0.15);
    // Body — yellow with shading
    const dBody = ctx.createRadialGradient(-3, -3, 2, 0, 0, 14);
    dBody.addColorStop(0, '#fff8a0');
    dBody.addColorStop(0.6, '#ffd83a');
    dBody.addColorStop(1, '#d6a800');
    ctx.fillStyle = dBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(8, -6, 7, 0, Math.PI * 2);
    ctx.fill();
    // Beak (orange)
    ctx.fillStyle = '#ff9a2a';
    ctx.beginPath();
    ctx.moveTo(13, -7);
    ctx.lineTo(20, -5);
    ctx.lineTo(13, -4);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(10, -8, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(10.5, -8.4, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Wing
    ctx.fillStyle = '#e0b800';
    ctx.beginPath();
    ctx.ellipse(-3, 0, 6, 3.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // === SOAP BOTTLE — pump-style with shine ===
    const sbX = width * 0.82, sbY = height * 0.4;
    // Bottle body — translucent purple with gradient
    const sbG = ctx.createLinearGradient(sbX, 0, sbX + 18, 0);
    sbG.addColorStop(0, '#a84cb8');
    sbG.addColorStop(0.5, '#e0a8e8');
    sbG.addColorStop(1, '#7a2c8a');
    ctx.fillStyle = sbG;
    ctx.fillRect(sbX, sbY, 18, 36);
    // Bottle outline
    ctx.strokeStyle = '#5a1f6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sbX, sbY, 18, 36);
    // Pump head (chrome)
    const pumpG = ctx.createLinearGradient(sbX + 4, 0, sbX + 14, 0);
    pumpG.addColorStop(0, '#888');
    pumpG.addColorStop(0.5, '#e8e8e8');
    pumpG.addColorStop(1, '#555');
    ctx.fillStyle = pumpG;
    ctx.fillRect(sbX + 4, sbY - 8, 10, 10);
    ctx.fillRect(sbX + 13, sbY - 4, 8, 3); // nozzle
    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(sbX + 2, sbY + 10, 14, 14);
    ctx.fillStyle = '#7a2c8a';
    ctx.font = 'bold 6px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SOAP', sbX + 9, sbY + 19);
    ctx.textAlign = 'left';
    // Bottle shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(sbX + 2, sbY + 2, 2, 30);

    // === TOWEL RACK — chrome bar with hung towel ===
    const trX = width * 0.05, trY = height * 0.3;
    // Bracket arms
    ctx.strokeStyle = '#7a8a92';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trX, trY);
    ctx.lineTo(trX + 16, trY);
    ctx.moveTo(trX, trY + 35);
    ctx.lineTo(trX + 16, trY + 35);
    ctx.stroke();
    // Vertical rod (chrome)
    const rodG = ctx.createLinearGradient(trX + 14, 0, trX + 18, 0);
    rodG.addColorStop(0, '#aaa');
    rodG.addColorStop(0.5, '#fff');
    rodG.addColorStop(1, '#888');
    ctx.fillStyle = rodG;
    ctx.fillRect(trX + 14, trY, 4, 35);
    ctx.lineCap = 'butt';
    // Folded towel hanging
    const towelG = ctx.createLinearGradient(trX + 5, 0, trX + 18, 0);
    towelG.addColorStop(0, '#d05a4a');
    towelG.addColorStop(0.5, '#ff8060');
    towelG.addColorStop(1, '#a84030');
    ctx.fillStyle = towelG;
    ctx.fillRect(trX + 5, trY + 4, 14, 32);
    // Towel stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(trX + 5, trY + 8, 14, 2);
    ctx.fillRect(trX + 5, trY + 30, 14, 2);
    // Towel fringe at bottom
    ctx.strokeStyle = '#a84030';
    ctx.lineWidth = 0.6;
    for (let f = 0; f < 5; f++) {
        ctx.beginPath();
        ctx.moveTo(trX + 5 + f * 3, trY + 36);
        ctx.lineTo(trX + 5 + f * 3, trY + 39);
        ctx.stroke();
    }

    // === MIRROR with frame and reflection sparkle ===
    const mX = width * 0.3, mY = height * 0.1, mW = 80, mH = 60;
    // Frame (gold)
    const mFrameG = ctx.createLinearGradient(mX, mY, mX + mW, mY + mH);
    mFrameG.addColorStop(0, '#d4af37');
    mFrameG.addColorStop(0.5, '#fff0b0');
    mFrameG.addColorStop(1, '#a07010');
    ctx.fillStyle = mFrameG;
    ctx.fillRect(mX - 4, mY - 4, mW + 8, mH + 8);
    // Mirror glass with subtle reflection
    const mirrorG = ctx.createLinearGradient(mX, mY, mX + mW, mY + mH);
    mirrorG.addColorStop(0, '#d8e8ee');
    mirrorG.addColorStop(0.4, '#e8f2f6');
    mirrorG.addColorStop(0.7, '#c0d8e0');
    mirrorG.addColorStop(1, '#a8c8d4');
    ctx.fillStyle = mirrorG;
    ctx.fillRect(mX, mY, mW, mH);
    // Sparkle highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mX + 8, mY + 8);
    ctx.lineTo(mX + 22, mY + 22);
    ctx.moveTo(mX + 8, mY + 22);
    ctx.lineTo(mX + 22, mY + 8);
    ctx.stroke();

    // === SINK / VANITY ===
    const vxX = width * 0.25, vxY = height * 0.65, vxW = 60, vxH = 40;
    // Counter top (marble-ish)
    const counterG = ctx.createLinearGradient(vxX, vxY, vxX, vxY + 6);
    counterG.addColorStop(0, '#ffffff');
    counterG.addColorStop(1, '#d4d0c0');
    ctx.fillStyle = counterG;
    ctx.fillRect(vxX, vxY, vxW, 6);
    // Cabinet below
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(vxX + 4, vxY + 6, vxW - 8, vxH - 6);
    // Cabinet door line
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 1;
    ctx.strokeRect(vxX + 6, vxY + 10, vxW - 12, vxH - 14);
    // Drawer handle
    ctx.fillStyle = '#c0a050';
    ctx.fillRect(vxX + vxW / 2 - 3, vxY + vxH - 8, 6, 2);
    // Sink basin (recessed oval)
    const sinkG = ctx.createRadialGradient(vxX + vxW / 2 - 6, vxY - 2, 0, vxX + vxW / 2, vxY + 2, 20);
    sinkG.addColorStop(0, '#f0f4f6');
    sinkG.addColorStop(1, '#8a9ea8');
    ctx.fillStyle = sinkG;
    ctx.beginPath();
    ctx.ellipse(vxX + vxW / 2, vxY + 2, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Faucet
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(vxX + vxW / 2, vxY - 12);
    ctx.lineTo(vxX + vxW / 2, vxY - 2);
    ctx.stroke();
    // Faucet shine
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vxX + vxW / 2 - 1, vxY - 10);
    ctx.lineTo(vxX + vxW / 2 - 1, vxY - 4);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Knob
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.arc(vxX + vxW / 2, vxY - 13, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // === BATH MAT in front of tub ===
    const matX = tubX + tubW * 0.15, matY = tubY + tubH + 10, matW = tubW * 0.6, matH = 14;
    const matG = ctx.createLinearGradient(0, matY, 0, matY + matH);
    matG.addColorStop(0, '#c04090');
    matG.addColorStop(1, '#8a2060');
    ctx.fillStyle = matG;
    ctx.fillRect(matX, matY, matW, matH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let ms = 0; ms < 5; ms++) {
        ctx.beginPath();
        ctx.moveTo(matX, matY + 3 + ms * 3);
        ctx.lineTo(matX + matW, matY + 3 + ms * 3);
        ctx.stroke();
    }

    // === TOILET with porcelain shading ===
    const tlX = width * 0.85, tlY = height * 0.70;
    // Water tank (back)
    const tankG = ctx.createLinearGradient(tlX, tlY, tlX, tlY + 30);
    tankG.addColorStop(0, '#ffffff');
    tankG.addColorStop(1, '#c8d2dc');
    ctx.fillStyle = tankG;
    ctx.fillRect(tlX, tlY, 26, 30);
    ctx.strokeStyle = '#a0b0b8';
    ctx.strokeRect(tlX, tlY, 26, 30);
    // Flush lever (chrome)
    ctx.fillStyle = '#ccc';
    ctx.fillRect(tlX + 22, tlY + 5, 4, 2);
    // Bowl (seat)
    const bowlG = ctx.createLinearGradient(tlX - 8, tlY + 30, tlX - 8, tlY + 55);
    bowlG.addColorStop(0, '#ffffff');
    bowlG.addColorStop(1, '#a8b8c0');
    ctx.fillStyle = bowlG;
    ctx.beginPath();
    ctx.ellipse(tlX + 13, tlY + 42, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a0b0b8';
    ctx.stroke();
    // Seat opening (darker)
    ctx.fillStyle = '#3a4858';
    ctx.beginPath();
    ctx.ellipse(tlX + 13, tlY + 42, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Base
    ctx.fillStyle = '#c8d2dc';
    ctx.fillRect(tlX + 4, tlY + 48, 18, 8);

    // === WALL SHELF with toiletries ===
    const shX = width * 0.42, shY = height * 0.32;
    // Shelf board
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(shX, shY, 70, 5);
    // Under shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(shX, shY + 5, 70, 2);
    // Bottle 1 (shampoo — blue)
    ctx.fillStyle = '#1e88e5';
    ctx.fillRect(shX + 5, shY - 20, 8, 20);
    ctx.fillStyle = '#0d47a1';
    ctx.fillRect(shX + 5, shY - 22, 8, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(shX + 6, shY - 15, 6, 5);
    // Bottle 2 (conditioner — green)
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(shX + 18, shY - 18, 7, 18);
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(shX + 18, shY - 20, 7, 3);
    // Candle in jar
    ctx.fillStyle = '#e8d4a8';
    ctx.fillRect(shX + 30, shY - 14, 10, 14);
    ctx.strokeStyle = '#a88040';
    ctx.strokeRect(shX + 30, shY - 14, 10, 14);
    // Wick flame
    ctx.fillStyle = '#333';
    ctx.fillRect(shX + 34.5, shY - 18, 1, 4);
    const flicker = 0.7 + Math.sin(time * 10) * 0.3;
    const flG = ctx.createRadialGradient(shX + 35, shY - 20, 0, shX + 35, shY - 20, 5);
    flG.addColorStop(0, `rgba(255, 200, 80, ${flicker})`);
    flG.addColorStop(1, 'rgba(255, 100, 30, 0)');
    ctx.fillStyle = flG;
    ctx.fillRect(shX + 30, shY - 25, 10, 10);
    // Flame core
    ctx.fillStyle = `rgba(255, 230, 140, ${flicker})`;
    ctx.beginPath();
    ctx.ellipse(shX + 35, shY - 19, 1, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Plant (spa feel)
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(shX + 48, shY - 10, 10, 10);
    ctx.fillStyle = '#3a8a3a';
    for (let l = 0; l < 4; l++) {
        const la = (l / 3) * Math.PI - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(shX + 53 + Math.cos(la) * 4, shY - 12 + Math.sin(la) * 4, 3, 5, la, 0, Math.PI * 2);
        ctx.fill();
    }

    // === TOOTHBRUSH HOLDER on sink counter ===
    const thX = vxX + vxW - 12, thY = vxY - 2;
    // Cup
    ctx.fillStyle = '#e8f2f6';
    ctx.fillRect(thX, thY - 10, 8, 10);
    ctx.strokeStyle = '#a0b8c0';
    ctx.strokeRect(thX, thY - 10, 8, 10);
    // Toothbrushes sticking out
    ctx.fillStyle = '#ff6090';
    ctx.fillRect(thX + 1, thY - 22, 1.5, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(thX + 1, thY - 24, 1.5, 3);
    ctx.fillStyle = '#2090f0';
    ctx.fillRect(thX + 5, thY - 20, 1.5, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(thX + 5, thY - 22, 1.5, 3);
}

// ===== LUXURY DESIGNER SHOP SCENE =====
// Shop item click zones — updated per-frame for hit testing
let shopItemClickZones = [];
// Shop basket — items added but not yet purchased
let shopBasket = [];

function drawShopBackground(width, height) {
    const time = Date.now() * 0.001;
    const floorY = height * 0.70;
    shopItemClickZones = []; // reset each frame

    // === WALLS — rich cream with damask wallpaper pattern ===
    const wallG = ctx.createLinearGradient(0, 0, 0, floorY);
    wallG.addColorStop(0, '#f5ead0');
    wallG.addColorStop(0.5, '#e8d4a8');
    wallG.addColorStop(1, '#d8bc80');
    ctx.fillStyle = wallG;
    ctx.fillRect(0, 0, width, floorY);

    // Damask-style subtle pattern (diamond grid)
    ctx.strokeStyle = 'rgba(180, 140, 60, 0.12)';
    ctx.lineWidth = 0.6;
    for (let dx = -40; dx < width + 40; dx += 60) {
        for (let dy = 0; dy < floorY; dy += 60) {
            const offset = (Math.floor(dy / 60) % 2) * 30;
            ctx.beginPath();
            ctx.ellipse(dx + offset, dy + 30, 12, 18, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // === GOLD CROWN MOLDING at top ===
    const crownG = ctx.createLinearGradient(0, 0, 0, 18);
    crownG.addColorStop(0, '#f0c84a');
    crownG.addColorStop(0.5, '#fff5c0');
    crownG.addColorStop(1, '#8a6010');
    ctx.fillStyle = crownG;
    ctx.fillRect(0, 0, width, 14);
    // Molding detail
    ctx.fillStyle = 'rgba(90, 60, 10, 0.6)';
    for (let mx = 0; mx < width; mx += 25) {
        ctx.fillRect(mx, 10, 12, 4);
    }

    // === WAINSCOTING (dark wood paneling along bottom of wall) ===
    const wainH = 50;
    const wainY = floorY - wainH;
    const wainG = ctx.createLinearGradient(0, wainY, 0, floorY);
    wainG.addColorStop(0, '#4a3020');
    wainG.addColorStop(0.5, '#6a4a30');
    wainG.addColorStop(1, '#2a1810');
    ctx.fillStyle = wainG;
    ctx.fillRect(0, wainY, width, wainH);
    // Panel divisions
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    for (let px = 0; px < width; px += 70) {
        ctx.strokeRect(px + 5, wainY + 5, 60, wainH - 10);
    }
    // Top trim
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(0, wainY - 3, width, 3);

    // === MARBLE FLOOR with reflections ===
    const floorG = ctx.createLinearGradient(0, floorY, 0, height);
    floorG.addColorStop(0, '#f0e8dc');
    floorG.addColorStop(0.3, '#d8cfc0');
    floorG.addColorStop(1, '#a89a80');
    ctx.fillStyle = floorG;
    ctx.fillRect(0, floorY, width, height - floorY);
    // Marble veins
    ctx.strokeStyle = 'rgba(120, 100, 70, 0.3)';
    ctx.lineWidth = 0.6;
    for (let v = 0; v < 6; v++) {
        ctx.beginPath();
        ctx.moveTo(v * width / 5, floorY + 4);
        ctx.bezierCurveTo(
            v * width / 5 + 40, floorY + 10,
            v * width / 5 - 20, floorY + 40,
            v * width / 5 + 50, height - 10
        );
        ctx.stroke();
    }
    // Diamond tile pattern on floor
    ctx.strokeStyle = 'rgba(100, 80, 50, 0.25)';
    ctx.lineWidth = 1;
    const tileSize = 40;
    for (let tx = 0; tx < width + tileSize; tx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(tx, floorY);
        ctx.lineTo(tx + (height - floorY), height);
        ctx.stroke();
    }
    for (let ty = floorY; ty < height + tileSize; ty += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, ty);
        ctx.lineTo(width, ty - (width) * 0.5);
        ctx.stroke();
    }

    // === CHANDELIER hanging from ceiling ===
    const chX = width / 2;
    const chY = height * 0.08;
    // Chain
    ctx.strokeStyle = '#8a6010';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(chX, 0);
    ctx.lineTo(chX, chY);
    ctx.stroke();
    // Chandelier body
    ctx.fillStyle = '#e0b040';
    ctx.beginPath();
    ctx.ellipse(chX, chY, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crystals hanging
    for (let c = -2; c <= 2; c++) {
        const crX = chX + c * 12;
        const crY = chY + 10;
        const crG = ctx.createLinearGradient(crX, crY, crX, crY + 14);
        crG.addColorStop(0, '#fff8c8');
        crG.addColorStop(0.5, '#ffeb8a');
        crG.addColorStop(1, '#d0a030');
        ctx.fillStyle = crG;
        ctx.beginPath();
        ctx.moveTo(crX - 3, crY);
        ctx.lineTo(crX + 3, crY);
        ctx.lineTo(crX, crY + 14);
        ctx.closePath();
        ctx.fill();
    }
    // Glow halo
    const chGlow = ctx.createRadialGradient(chX, chY + 5, 5, chX, chY + 5, 80);
    chGlow.addColorStop(0, 'rgba(255, 240, 180, 0.5)');
    chGlow.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = chGlow;
    ctx.fillRect(chX - 80, chY - 75, 160, 160);

    // === DISPLAY SHELVES with wall items ===
    const items = shopState.items;
    const cols = 6;
    const rows = 3;
    const shelfMarginX = width * 0.06;
    const shelfMarginY = height * 0.11;
    const shelfW = width - shelfMarginX * 2 - width * 0.28; // leave room on right for counter
    const shelfH = wainY - shelfMarginY - 20;
    const cellW = shelfW / cols;
    const cellH = shelfH / rows;

    // Shelf boards (2 horizontal shelves)
    for (let r = 0; r <= rows; r++) {
        const sy = shelfMarginY + r * cellH;
        // Shelf board
        const boardG = ctx.createLinearGradient(0, sy - 3, 0, sy + 6);
        boardG.addColorStop(0, '#c8a050');
        boardG.addColorStop(0.5, '#f0d080');
        boardG.addColorStop(1, '#8a6010');
        ctx.fillStyle = boardG;
        ctx.fillRect(shelfMarginX - 10, sy, shelfW + 20, 6);
        // Shelf shadow underneath
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(shelfMarginX - 10, sy + 6, shelfW + 20, 3);
    }

    // Items displayed on the shelves
    items.forEach((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        if (row >= rows) return;
        const cellX = shelfMarginX + col * cellW;
        const cellY = shelfMarginY + row * cellH;
        const itemCx = cellX + cellW / 2;
        const itemCy = cellY + cellH * 0.55;

        // Display pedestal
        const pedG = ctx.createLinearGradient(itemCx - 30, 0, itemCx + 30, 0);
        pedG.addColorStop(0, '#2a1810');
        pedG.addColorStop(0.5, '#4a3020');
        pedG.addColorStop(1, '#1a1008');
        ctx.fillStyle = pedG;
        ctx.fillRect(itemCx - 30, cellY + cellH - 22, 60, 15);
        // Pedestal top shine
        ctx.fillStyle = '#c8a050';
        ctx.fillRect(itemCx - 30, cellY + cellH - 22, 60, 2);

        // Soft spotlight from above on each item
        const spotG = ctx.createRadialGradient(itemCx, itemCy - 10, 0, itemCx, itemCy, 45);
        spotG.addColorStop(0, 'rgba(255, 250, 220, 0.35)');
        spotG.addColorStop(1, 'rgba(255, 250, 220, 0)');
        ctx.fillStyle = spotG;
        ctx.fillRect(itemCx - 45, cellY, 90, cellH);

        // Draw a mini wearable preview
        drawShopItemPreview(item, itemCx, itemCy);

        // Item name (elegant font)
        ctx.fillStyle = '#2a1810';
        ctx.font = 'bold 10px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, itemCx, cellY + cellH - 30);
        // Price in gold
        ctx.fillStyle = '#8a6010';
        ctx.font = 'italic 11px Georgia';
        ctx.fillText(item.price + ' carrots', itemCx, cellY + cellH - 1);

        // Already in basket indicator
        const inBasket = shopBasket.includes(item.id);
        if (inBasket) {
            ctx.strokeStyle = '#c8a050';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(cellX + 2, cellY + 2, cellW - 4, cellH - 4);
            ctx.setLineDash([]);
            // "IN BASKET" badge
            ctx.fillStyle = '#c8a050';
            ctx.fillRect(cellX + 4, cellY + 4, 56, 14);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('✓ IN CART', cellX + 32, cellY + 14);
        }

        // Register click zone
        shopItemClickZones.push({
            x: cellX, y: cellY, w: cellW, h: cellH, itemId: item.id
        });
        ctx.textAlign = 'left';
    });

    // === COUNTER on the right side with sales bunny ===
    const countX = width - width * 0.25;
    const countY = wainY - 40;
    const countW = width * 0.22;
    const countH = floorY - countY;
    // Counter body (mahogany)
    const countG = ctx.createLinearGradient(0, countY, 0, countY + countH);
    countG.addColorStop(0, '#7a3818');
    countG.addColorStop(0.5, '#a05830');
    countG.addColorStop(1, '#4a1a08');
    ctx.fillStyle = countG;
    ctx.fillRect(countX, countY, countW, countH);
    // Counter top (marble)
    const topMarbleG = ctx.createLinearGradient(0, countY, 0, countY + 8);
    topMarbleG.addColorStop(0, '#ffffff');
    topMarbleG.addColorStop(1, '#c8c0b0');
    ctx.fillStyle = topMarbleG;
    ctx.fillRect(countX - 5, countY, countW + 10, 8);
    // Counter panels
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(countX + 8, countY + 15, countW - 16, countH - 25);
    // Gold trim
    ctx.strokeStyle = '#c8a050';
    ctx.lineWidth = 1;
    ctx.strokeRect(countX + 10, countY + 17, countW - 20, countH - 29);

    // Cash register on counter
    const regX = countX + countW * 0.3, regY = countY - 18;
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(regX, regY, 26, 18);
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(regX + 2, regY + 2, 22, 8);
    ctx.fillStyle = '#8bc34a';
    ctx.fillRect(regX + 4, regY + 4, 18, 4);
    ctx.fillStyle = '#8a6010';
    ctx.fillRect(regX + 4, regY + 12, 18, 2);
    ctx.fillRect(regX + 8, regY + 12, 10, 4);

    // === SALES BUNNY behind counter (top half visible) ===
    const sbX = countX + countW * 0.65;
    const sbY = countY - 8;
    drawSalesBunny(sbX, sbY, time);

    // "Welcome!" speech bubble
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = '#c8a050';
    ctx.lineWidth = 2;
    const bubbleX = sbX - 85, bubbleY = sbY - 55, bubbleW = 75, bubbleH = 30;
    ctx.beginPath();
    ctx.moveTo(bubbleX + 5, bubbleY);
    ctx.lineTo(bubbleX + bubbleW - 5, bubbleY);
    ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + 5);
    ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - 5);
    ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - 5, bubbleY + bubbleH);
    ctx.lineTo(bubbleX + bubbleW * 0.75, bubbleY + bubbleH);
    ctx.lineTo(bubbleX + bubbleW * 0.7, bubbleY + bubbleH + 6);
    ctx.lineTo(bubbleX + bubbleW * 0.65, bubbleY + bubbleH);
    ctx.lineTo(bubbleX + 5, bubbleY + bubbleH);
    ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - 5);
    ctx.lineTo(bubbleX, bubbleY + 5);
    ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + 5, bubbleY);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4a3020';
    ctx.font = 'italic 10px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText("Bonjour! 🐰", bubbleX + bubbleW / 2, bubbleY + 13);
    ctx.fillText("Try me!", bubbleX + bubbleW / 2, bubbleY + 25);
    ctx.textAlign = 'left';
    ctx.restore();

    // === BRAND SIGN at top (behind chandelier is the wall logo) ===
    ctx.save();
    ctx.font = 'bold italic 20px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a6010';
    ctx.fillText('Bunny Couture', width / 2, height * 0.05);
    ctx.fillStyle = '#c8a050';
    ctx.fillText('Bunny Couture', width / 2 - 1, height * 0.05 - 1);
    ctx.font = 'italic 9px Georgia';
    ctx.fillStyle = '#8a6010';
    ctx.fillText('— maison de haute couture —', width / 2, height * 0.07);
    ctx.textAlign = 'left';
    ctx.restore();

    // === BASKET UI (top-right corner) ===
    drawShopBasketUI(width, height);

    // === CLOSE X button (top-left) ===
    ctx.fillStyle = 'rgba(40, 20, 10, 0.85)';
    ctx.beginPath();
    ctx.arc(30, 30, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8a050';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(23, 23); ctx.lineTo(37, 37);
    ctx.moveTo(37, 23); ctx.lineTo(23, 37);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Register close zone
    shopItemClickZones.push({ x: 12, y: 12, w: 36, h: 36, action: 'close' });
}

function drawSalesBunny(x, y, time) {
    const size = 26;
    ctx.save();
    ctx.translate(x, y);
    // Breathing
    const breath = 1 + Math.sin(time * 2) * 0.03;
    ctx.scale(breath, breath);

    // Body (sitting, only top half visible over counter)
    ctx.fillStyle = bodyGradient('#ffffff', size, size * 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Black bowtie
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-12, 12);
    ctx.lineTo(0, 8);
    ctx.lineTo(12, 12);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(0, 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Ears (subtle twitch)
    const twitch = earTwitch(1.5, time);
    ctx.fillStyle = bodyGradient('#ffffff', size * 0.3, size * 0.6);
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.8, size * 0.3, size * 0.6, -0.3 - twitch, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.8, size * 0.3, size * 0.6, 0.3 + twitch, 0, Math.PI * 2);
    ctx.fill();
    // Inner ears
    ctx.fillStyle = '#ffb3d9';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.7, size * 0.15, size * 0.3, -0.3 - twitch, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.7, size * 0.15, size * 0.3, 0.3 + twitch, 0, Math.PI * 2);
    ctx.fill();

    // Top hat (sales bunny is dressed up)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-size * 0.35, -size * 1.4, size * 0.7, size * 0.5);
    ctx.fillRect(-size * 0.5, -size * 0.9, size * 1.0, size * 0.1);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-size * 0.35, -size * 1.0, size * 0.7, size * 0.08);

    // Face — shiny eye look
    const blink = isBlinking(1.5, time);
    drawBunnyFace(0, -size * 0.2, size * 0.75, false, blink, 'happy', EYE_COLORS[2]);

    ctx.restore();
}

// Draw a mini preview of each shop item on its shelf pedestal
function drawShopItemPreview(item, cx, cy) {
    ctx.save();
    // Map item IDs to their slot + item props
    const fakeWearables = {};
    const neckItems = { carrot_treat: '#e53935', scarf_red: '#c4302a', scarf_blue: '#2a6ab8', night_light: '#e53935', hopmes_scarf: '#ff7518', chanel_pearls: '#f8f4e8' };
    const backItems = { soft_blanket: '#9c5bc5', louis_bunitton: '#5a3a20', hoppidas_jacket: '#1a1a1a' };
    const headItems = { bow_pink: '#e91e63', hat_top: '#1a1a1a', decorative_plant: '#66bb6a', hike_cap: '#ffffff', bunnci_beanie: '#006633' };
    const eyesItems = { glasses: '#1a1a1a', dior_shades: '#d4af37' };
    const heldItems = { toy_ball: '#ff5722', cloud_kicks: '#f0f0f0' };

    if (neckItems[item.id]) {
        fakeWearables.neck = { itemId: item.id, color: neckItems[item.id] };
    } else if (backItems[item.id]) {
        fakeWearables.back = { itemId: item.id, color: backItems[item.id] };
    } else if (headItems[item.id]) {
        fakeWearables.head = { itemId: item.id, color: headItems[item.id] };
    } else if (eyesItems[item.id]) {
        fakeWearables.eyes = { itemId: item.id, color: eyesItems[item.id] };
    } else if (heldItems[item.id]) {
        fakeWearables.held = { itemId: item.id, color: heldItems[item.id] };
    }
    // Subtle spotlight backdrop
    const bgG = ctx.createRadialGradient(cx, cy, 5, cx, cy, 35);
    bgG.addColorStop(0, 'rgba(255, 250, 220, 0.6)');
    bgG.addColorStop(1, 'rgba(255, 250, 220, 0)');
    ctx.fillStyle = bgG;
    ctx.fillRect(cx - 35, cy - 35, 70, 70);
    // Draw a "mannequin" (featureless bunny outline) wearing it
    ctx.fillStyle = 'rgba(220, 220, 220, 0.8)';
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Tiny ears
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 17, 4, 10, -0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + 6, cy - 17, 4, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Overlay the wearable scaled down
    drawBunnyWearables(cx, cy - 3, 12, fakeWearables);
    ctx.restore();
}

function drawShopBasketUI(width, height) {
    const bxX = width - 150, bxY = 14;
    // Basket panel
    const bxG = ctx.createLinearGradient(bxX, bxY, bxX, bxY + 80);
    bxG.addColorStop(0, 'rgba(40, 20, 10, 0.95)');
    bxG.addColorStop(1, 'rgba(20, 10, 5, 0.95)');
    ctx.fillStyle = bxG;
    ctx.fillRect(bxX, bxY, 136, 80);
    ctx.strokeStyle = '#c8a050';
    ctx.lineWidth = 2;
    ctx.strokeRect(bxX, bxY, 136, 80);
    // Title
    ctx.fillStyle = '#c8a050';
    ctx.font = 'bold italic 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('Your Basket', bxX + 68, bxY + 18);
    // Items count + total
    const totalPrice = shopBasket.reduce((sum, id) => {
        const item = shopState.items.find(i => i.id === id);
        return sum + (item ? item.price : 0);
    }, 0);
    ctx.fillStyle = '#fff';
    ctx.font = '11px Georgia';
    ctx.fillText(`${shopBasket.length} item(s)`, bxX + 68, bxY + 35);
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 12px Georgia';
    ctx.fillText(`Total: ${totalPrice} 🥕`, bxX + 68, bxY + 50);
    // Checkout button
    if (shopBasket.length > 0) {
        const btnG = ctx.createLinearGradient(0, bxY + 58, 0, bxY + 76);
        btnG.addColorStop(0, '#f0c84a');
        btnG.addColorStop(1, '#8a6010');
        ctx.fillStyle = btnG;
        ctx.fillRect(bxX + 8, bxY + 58, 120, 18);
        ctx.strokeStyle = '#fff8c8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bxX + 8, bxY + 58, 120, 18);
        ctx.fillStyle = '#2a1810';
        ctx.font = 'bold 11px Georgia';
        ctx.fillText('✨ CHECKOUT ✨', bxX + 68, bxY + 71);
        shopItemClickZones.push({ x: bxX + 8, y: bxY + 58, w: 120, h: 18, action: 'checkout' });
    } else {
        ctx.fillStyle = 'rgba(200, 160, 80, 0.5)';
        ctx.font = 'italic 10px Georgia';
        ctx.fillText('(basket empty)', bxX + 68, bxY + 70);
    }
    ctx.textAlign = 'left';
}

// Handle clicks on the shop canvas
function handleShopClick(x, y) {
    for (const zone of shopItemClickZones) {
        if (x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) {
            if (zone.action === 'close') {
                toggleShop();
                return true;
            }
            if (zone.action === 'checkout') {
                // Buy all items in basket sequentially
                shopBasket.forEach(itemId => buyItem(itemId));
                shopBasket = [];
                return true;
            }
            if (zone.itemId) {
                const idx = shopBasket.indexOf(zone.itemId);
                if (idx >= 0) {
                    shopBasket.splice(idx, 1); // toggle off
                } else {
                    shopBasket.push(zone.itemId);
                }
                return true;
            }
        }
    }
    return false;
}

function drawCloudsToContext(context, width, height) {
    const time = Date.now() * 0.001;

    // Far layer — slow, faint, smaller (distant clouds)
    context.fillStyle = 'rgba(255, 255, 255, 0.35)';
    const farCloud1X = (time * 4 + 80) % (width + 120) - 60;
    drawCloudToContext(context, farCloud1X, 20, 18);
    const farCloud2X = (time * 5 + 300) % (width + 140) - 70;
    drawCloudToContext(context, farCloud2X, 45, 22);

    // Mid layer (original)
    context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const cloud1X = (time * 10) % (width + 100) - 50;
    drawCloudToContext(context, cloud1X, 30, 30);
    const cloud2X = (time * 15) % (width + 120) - 60;
    drawCloudToContext(context, cloud2X, 60, 25);

    // Near layer — brighter, faster (foreground puff)
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const nearCloudX = (time * 22 + 150) % (width + 160) - 80;
    drawCloudToContext(context, nearCloudX, 85, 32);
}

function drawCloudToContext(context, x, y, size) {
    // Soft feathery cloud — multi-radial gradient blobs for fluffy edges
    const baseColor = context.fillStyle; // capture caller's tint
    // Match alpha from the active fillStyle string (e.g. rgba(...,0.7))
    let alpha = 0.7;
    const m = String(baseColor).match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/);
    if (m) alpha = parseFloat(m[1]);

    const blob = (bx, by, br) => {
        const g = context.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        g.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.85})`);
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = g;
        context.fillRect(bx - br, by - br, br * 2, br * 2);
    };

    // Stack of soft blobs forming a cloud shape
    blob(x, y, size * 1.1);
    blob(x + size * 0.7, y + size * 0.05, size * 0.95);
    blob(x + size * 1.4, y, size * 0.75);
    blob(x + size * 0.65, y - size * 0.5, size * 0.85);
    blob(x + size * 0.2, y - size * 0.3, size * 0.7);

    // Subtle shadow underside
    const shadow = context.createLinearGradient(x, y, x, y + size * 0.6);
    shadow.addColorStop(0, 'rgba(180, 195, 210, 0)');
    shadow.addColorStop(1, `rgba(180, 195, 210, ${alpha * 0.18})`);
    context.fillStyle = shadow;
    context.fillRect(x - size, y, size * 3, size * 0.6);

    // Restore caller's fillStyle
    context.fillStyle = baseColor;
}

// Alias used by playground background
function drawCloud(x, y, size) {
    drawCloudToContext(ctx, x, y, size);
}

function drawFlowersToContext(context, width, height) {
    // Static flower positions (so they don't move every frame)
    const flowers = [
        { x: width * 0.15, y: height * 0.85, color: '#ff6b6b' },
        { x: width * 0.35, y: height * 0.9, color: '#feca57' },
        { x: width * 0.8, y: height * 0.88, color: '#ff9ff3' },
        { x: width * 0.9, y: height * 0.82, color: '#54a0ff' }
    ];
    
    flowers.forEach(flower => {
        drawFlowerToContext(context, flower.x, flower.y, flower.color);
    });
}

function drawFlowerToContext(context, x, y, color) {
    const size = 8;
    
    // Petals
    context.fillStyle = color;
    for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        const petalX = x + Math.cos(angle) * size;
        const petalY = y + Math.sin(angle) * size;
        
        context.beginPath();
        context.arc(petalX, petalY, size * 0.6, 0, Math.PI * 2);
        context.fill();
    }
    
    // Center
    context.fillStyle = '#ffd700';
    context.beginPath();
    context.arc(x, y, size * 0.4, 0, Math.PI * 2);
    context.fill();
}

// ===== IMPRESSIVE SLEEPING-CAVE SCENE =====
function drawCaveSleepingScene(width, height) {
    const time = Date.now() * 0.001;

    // === DEEP CAVE WALLS — gradient from outside light to deep dark ===
    const wallG = ctx.createRadialGradient(width * 0.5, height * 0.45, 50, width * 0.5, height * 0.5, Math.max(width, height) * 0.85);
    wallG.addColorStop(0, '#3a2818');
    wallG.addColorStop(0.4, '#1a1008');
    wallG.addColorStop(0.8, '#0a0604');
    wallG.addColorStop(1, '#000');
    ctx.fillStyle = wallG;
    ctx.fillRect(0, 0, width, height);

    // === DISTANT CAVE OPENING (top) showing night sky with stars ===
    const openX = width * 0.5, openY = -10;
    const openR = width * 0.18;
    // Sky behind opening
    const skyG = ctx.createLinearGradient(0, 0, 0, openR);
    skyG.addColorStop(0, '#0a1638');
    skyG.addColorStop(1, '#1a2a5a');
    ctx.fillStyle = skyG;
    ctx.beginPath();
    ctx.arc(openX, openY, openR, 0, Math.PI);
    ctx.lineTo(openX - openR, openY);
    ctx.fill();
    // Stars in opening
    for (let s = 0; s < 12; s++) {
        const sa = (s / 11) * Math.PI;
        const sr = openR * (0.4 + (s % 4) * 0.15);
        const sx = openX + Math.cos(sa + Math.PI) * sr;
        const sy = openY + Math.sin(sa + Math.PI) * sr * 0.5;
        if (sy < openR) {
            const tw = 0.5 + 0.5 * Math.abs(Math.sin(time * 1.5 + s));
            ctx.fillStyle = `rgba(255, 250, 220, ${tw})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Cave opening rim with jagged rocks
    ctx.fillStyle = '#1a0e08';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(openX - openR, 0);
    for (let r = 0; r <= 12; r++) {
        const t = r / 12;
        const rx = openX - openR + t * (openR * 2);
        const ry = Math.sin(t * Math.PI) * openR * 0.85 + Math.sin(r * 2.3) * 8;
        ctx.lineTo(rx, ry);
    }
    ctx.lineTo(width, 0);
    ctx.lineTo(width, openR + 30);
    ctx.lineTo(0, openR + 30);
    ctx.closePath();
    ctx.fill();

    // Moon-light beam streaming down through the opening
    ctx.save();
    const beam = ctx.createLinearGradient(openX, openR, openX, height * 0.8);
    beam.addColorStop(0, 'rgba(180, 200, 240, 0.25)');
    beam.addColorStop(0.6, 'rgba(180, 200, 240, 0.08)');
    beam.addColorStop(1, 'rgba(180, 200, 240, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(openX - openR * 0.6, openR);
    ctx.lineTo(openX + openR * 0.6, openR);
    ctx.lineTo(openX + openR * 1.5, height * 0.85);
    ctx.lineTo(openX - openR * 1.5, height * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // === STALACTITES from ceiling (varying sizes) ===
    const stalactiteData = [
        { x: 0.05, h: 70, w: 18 }, { x: 0.13, h: 45, w: 14 },
        { x: 0.22, h: 60, w: 16 }, { x: 0.32, h: 38, w: 12 },
        { x: 0.78, h: 55, w: 16 }, { x: 0.86, h: 42, w: 13 },
        { x: 0.95, h: 65, w: 17 }
    ];
    stalactiteData.forEach(s => {
        const sx = width * s.x;
        const stG = ctx.createLinearGradient(sx, 0, sx, s.h);
        stG.addColorStop(0, '#3a2818');
        stG.addColorStop(0.5, '#2a1810');
        stG.addColorStop(1, '#1a0e06');
        ctx.fillStyle = stG;
        ctx.beginPath();
        ctx.moveTo(sx - s.w / 2, 0);
        ctx.lineTo(sx + s.w / 2, 0);
        ctx.lineTo(sx, s.h);
        ctx.closePath();
        ctx.fill();
        // Highlight
        ctx.strokeStyle = 'rgba(180, 140, 80, 0.25)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(sx - s.w / 4, 5);
        ctx.lineTo(sx - s.w / 8, s.h - 5);
        ctx.stroke();
        // Tip drip (water droplet hanging)
        if (s.h > 50) {
            const dripT = ((time + s.x * 7) % 4) / 4;
            const dripY = s.h + dripT * (height * 0.25);
            const dripA = 1 - dripT;
            if (dripA > 0.1) {
                ctx.fillStyle = `rgba(140, 180, 220, ${dripA * 0.7})`;
                ctx.beginPath();
                ctx.ellipse(sx, dripY, 1.5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });

    // === STALAGMITES on floor ===
    const stalagmiteData = [
        { x: 0.08, h: 35, w: 22 }, { x: 0.18, h: 22, w: 16 },
        { x: 0.85, h: 30, w: 20 }, { x: 0.93, h: 25, w: 18 }
    ];
    stalagmiteData.forEach(s => {
        const sx = width * s.x;
        const sy = height - 20;
        const sgG = ctx.createLinearGradient(sx, sy - s.h, sx, sy);
        sgG.addColorStop(0, '#1a0e06');
        sgG.addColorStop(1, '#3a2818');
        ctx.fillStyle = sgG;
        ctx.beginPath();
        ctx.moveTo(sx - s.w / 2, sy);
        ctx.lineTo(sx + s.w / 2, sy);
        ctx.lineTo(sx, sy - s.h);
        ctx.closePath();
        ctx.fill();
    });

    // === GLOWING CRYSTALS embedded in walls ===
    const crystals = [
        { x: 0.08, y: 0.5, c: '#7fcfff', s: 6 }, { x: 0.92, y: 0.55, c: '#d590ff', s: 7 },
        { x: 0.05, y: 0.7, c: '#5fe5b5', s: 5 }, { x: 0.95, y: 0.72, c: '#ff9ac0', s: 6 },
        { x: 0.15, y: 0.35, c: '#7fe5e8', s: 4 }, { x: 0.85, y: 0.32, c: '#ffc070', s: 5 }
    ];
    crystals.forEach(c => {
        const cx = c.x * width, cy = c.y * height;
        const pulse = 0.7 + Math.sin(time * 2 + c.x * 10) * 0.3;
        // Glow halo
        const gG = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.s * 5);
        gG.addColorStop(0, c.c.replace(')', `, ${pulse * 0.5})`).replace('rgb', 'rgba'));
        // Hex format → use hex with manual alpha
        gG.addColorStop(0, c.c + Math.floor(pulse * 100).toString(16).padStart(2, '0'));
        gG.addColorStop(1, c.c + '00');
        ctx.fillStyle = gG;
        ctx.fillRect(cx - c.s * 5, cy - c.s * 5, c.s * 10, c.s * 10);
        // Crystal shape (diamond facets)
        ctx.fillStyle = c.c;
        ctx.beginPath();
        ctx.moveTo(cx, cy - c.s);
        ctx.lineTo(cx + c.s * 0.7, cy);
        ctx.lineTo(cx, cy + c.s);
        ctx.lineTo(cx - c.s * 0.7, cy);
        ctx.closePath();
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - c.s * 0.2, cy - c.s * 0.5);
        ctx.lineTo(cx + c.s * 0.2, cy - c.s * 0.2);
        ctx.lineTo(cx, cy + c.s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // === CAVE FLOOR (worn rock) ===
    const floorY = height * 0.78;
    const floorG = ctx.createLinearGradient(0, floorY, 0, height);
    floorG.addColorStop(0, '#2a1810');
    floorG.addColorStop(0.4, '#1a0e06');
    floorG.addColorStop(1, '#0a0402');
    ctx.fillStyle = floorG;
    ctx.fillRect(0, floorY, width, height - floorY);
    // Floor texture lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 0.6;
    for (let f = 0; f < 12; f++) {
        ctx.beginPath();
        ctx.moveTo((f * 90) % width, floorY + 5 + (f % 3) * 8);
        ctx.lineTo((f * 90 + 60) % width, floorY + 8 + (f % 3) * 8);
        ctx.stroke();
    }

    // === HAY BEDS scattered across the cave floor (multiple sleeping spots) ===
    const beds = [
        { x: width * 0.18, y: floorY + 35, w: 90 },
        { x: width * 0.35, y: floorY + 50, w: 80 },
        { x: width * 0.52, y: floorY + 30, w: 100 },
        { x: width * 0.72, y: floorY + 45, w: 85 }
    ];
    beds.forEach(b => {
        // Hay base
        ctx.fillStyle = '#a87440';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.w / 2, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // Top hay strands (lighter)
        ctx.fillStyle = '#e8b060';
        for (let h = 0; h < 6; h++) {
            const hx = b.x - b.w * 0.4 + h * (b.w * 0.13);
            ctx.beginPath();
            ctx.ellipse(hx, b.y - 2, 12, 5, Math.sin(h) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        // Tiny straw bits
        ctx.strokeStyle = '#c08020';
        ctx.lineWidth = 0.6;
        for (let s = 0; s < 8; s++) {
            const sx = b.x - b.w * 0.4 + s * (b.w * 0.1);
            ctx.beginPath();
            ctx.moveTo(sx, b.y - 4);
            ctx.lineTo(sx + (s % 2 ? 1 : -1), b.y - 9);
            ctx.stroke();
        }
    });

    // === SLEEPING BUNNIES on the hay beds (background bunnies) ===
    const sleepers = [
        { x: width * 0.18, y: floorY + 28, color: '#ffffff', size: 22, phase: 0 },
        { x: width * 0.18 + 30, y: floorY + 32, color: '#8b4513', size: 18, phase: 1.2 },
        { x: width * 0.35, y: floorY + 43, color: '#2c2c2c', size: 24, phase: 2.1 },
        { x: width * 0.52, y: floorY + 22, color: '#f5deb3', size: 20, phase: 0.8 },
        { x: width * 0.52 + 35, y: floorY + 26, color: '#808080', size: 22, phase: 1.7 },
        { x: width * 0.72, y: floorY + 38, color: '#ffffff', size: 20, phase: 2.5 },
        { x: width * 0.72 + 28, y: floorY + 41, color: '#8b4513', size: 16, phase: 0.4 }
    ];
    sleepers.forEach(s => {
        drawSleepingBunny(s.x, s.y, s.color, s.size, time, s.phase);
    });

    // === GLOWING LANTERNS on cave walls (cozy ambiance) ===
    const lanterns = [
        { x: width * 0.12, y: height * 0.45 },
        { x: width * 0.88, y: height * 0.48 },
        { x: width * 0.5, y: height * 0.38 }
    ];
    lanterns.forEach(l => {
        const flicker = 0.85 + Math.sin(time * 7 + l.x * 0.01) * 0.1 + Math.sin(time * 13 + l.y * 0.01) * 0.05;
        // Big warm glow
        const lG = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 80);
        lG.addColorStop(0, `rgba(255, 200, 100, ${0.5 * flicker})`);
        lG.addColorStop(0.5, `rgba(255, 150, 50, ${0.2 * flicker})`);
        lG.addColorStop(1, 'rgba(255, 150, 50, 0)');
        ctx.fillStyle = lG;
        ctx.fillRect(l.x - 80, l.y - 80, 160, 160);
        // Hanging chain
        ctx.strokeStyle = '#3a2410';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y - 30);
        ctx.lineTo(l.x, l.y - 5);
        ctx.stroke();
        // Lantern body (metal cage)
        ctx.fillStyle = '#3a2410';
        ctx.fillRect(l.x - 6, l.y - 5, 12, 4);
        ctx.fillRect(l.x - 6, l.y + 16, 12, 4);
        // Glass
        const glG = ctx.createRadialGradient(l.x, l.y + 8, 1, l.x, l.y + 8, 8);
        glG.addColorStop(0, `rgba(255, 240, 150, ${flicker})`);
        glG.addColorStop(1, `rgba(180, 60, 10, ${flicker * 0.7})`);
        ctx.fillStyle = glG;
        ctx.fillRect(l.x - 5, l.y - 1, 10, 17);
        // Cage bars
        ctx.strokeStyle = '#1a0e06';
        ctx.lineWidth = 0.8;
        for (let bar = 0; bar < 3; bar++) {
            ctx.beginPath();
            ctx.moveTo(l.x - 5 + bar * 5, l.y - 1);
            ctx.lineTo(l.x - 5 + bar * 5, l.y + 16);
            ctx.stroke();
        }
        // Flame core
        ctx.fillStyle = `rgba(255, 220, 100, ${flicker})`;
        ctx.beginPath();
        ctx.ellipse(l.x, l.y + 9, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // === MUSHROOMS on cave floor ===
    const mushrooms = [
        { x: width * 0.08, y: height - 20, c: '#c02a2a', s: 8 },
        { x: width * 0.45, y: height - 18, c: '#e04040', s: 6 },
        { x: width * 0.65, y: height - 22, c: '#a01818', s: 7 },
        { x: width * 0.92, y: height - 16, c: '#c02a2a', s: 5 }
    ];
    mushrooms.forEach(m => {
        const capG = ctx.createRadialGradient(m.x - m.s * 0.3, m.y - m.s * 0.3, 0, m.x, m.y, m.s);
        capG.addColorStop(0, shiftColor(m.c, 40));
        capG.addColorStop(1, m.c);
        ctx.fillStyle = capG;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.s, Math.PI, 0);
        ctx.fill();
        // Stem
        ctx.fillStyle = '#f5ead0';
        ctx.fillRect(m.x - m.s * 0.35, m.y, m.s * 0.7, m.s * 1.2);
        // Glowing dots on cap
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.arc(m.x - m.s * 0.4, m.y - m.s * 0.5, m.s * 0.18, 0, Math.PI * 2);
        ctx.arc(m.x + m.s * 0.3, m.y - m.s * 0.5, m.s * 0.15, 0, Math.PI * 2);
        ctx.fill();
    });

    // === FIREFLIES floating around ===
    for (let f = 0; f < 8; f++) {
        const ffPhase = time * 0.5 + f * 0.7;
        const ffX = width * (0.2 + (f / 7) * 0.6) + Math.sin(ffPhase) * 30;
        const ffY = height * (0.4 + (f % 3) * 0.1) + Math.cos(ffPhase * 1.3) * 20;
        const ffPulse = 0.6 + Math.sin(time * 3 + f) * 0.4;
        const ffG = ctx.createRadialGradient(ffX, ffY, 0, ffX, ffY, 8);
        ffG.addColorStop(0, `rgba(180, 255, 100, ${ffPulse * 0.8})`);
        ffG.addColorStop(1, 'rgba(180, 255, 100, 0)');
        ctx.fillStyle = ffG;
        ctx.fillRect(ffX - 8, ffY - 8, 16, 16);
        // Body dot
        ctx.fillStyle = `rgba(220, 255, 150, ${ffPulse})`;
        ctx.beginPath();
        ctx.arc(ffX, ffY, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }

    // === Z's floating up from sleeping bunnies (text) ===
    ctx.font = 'italic 18px Arial';
    ctx.fillStyle = 'rgba(180, 200, 240, 0.7)';
    sleepers.forEach((s, i) => {
        if (i % 2 === 0) {
            const zPhase = (time * 0.4 + i * 0.5) % 3;
            const zX = s.x + 15 + Math.sin(zPhase * 3) * 5;
            const zY = s.y - 15 - zPhase * 25;
            const zA = (1 - zPhase / 3) * 0.6;
            ctx.fillStyle = `rgba(180, 200, 240, ${zA})`;
            ctx.fillText('z', zX, zY);
        }
    });

    // Vignette to enhance cozy darkness
    const vign = ctx.createRadialGradient(width / 2, height / 2, height * 0.3, width / 2, height / 2, height * 0.85);
    vign.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vign.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, width, height);
}

// Sleeping bunny — cute curled position with breathing
function drawSleepingBunny(x, y, color, size, time, phase) {
    ctx.save();
    ctx.translate(x, y);
    const breath = 1 + Math.sin(time * 0.8 + phase) * 0.04;
    ctx.scale(breath, 1);
    // Body (lying down — wider than tall)
    ctx.fillStyle = bodyGradient(color, size * 1.3, size * 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.3, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    if (color === '#ffffff') {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    // Head tucked at one end
    ctx.fillStyle = bodyGradient(color, size * 0.75, size * 0.6);
    ctx.beginPath();
    ctx.ellipse(-size * 0.95, -size * 0.05, size * 0.65, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    if (color === '#ffffff') ctx.stroke();
    // Ears folded back (lying flat along body)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-size * 1.1, -size * 0.45, size * 0.18, size * 0.4, 0.4, 0, Math.PI * 2);
    ctx.ellipse(-size * 0.95, -size * 0.5, size * 0.15, size * 0.35, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Closed eye (single — viewed from side)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-size * 1.1, -size * 0.05, size * 0.1, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Nose
    ctx.fillStyle = '#ff7080';
    ctx.beginPath();
    ctx.arc(-size * 1.45, size * 0.1, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    // Tail at the other end
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size * 1.15, -size * 0.15, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    if (color === '#ffffff') ctx.stroke();
    ctx.restore();
}


function drawCaveToContext(context, width, height) {
    // === RESPONSIVE POSITIONING — cave sits into the hillside, not top-left ===
    // Cave mouth lands at ~75% height (the ground zone), safely below any top UI bar
    const caveWidth = Math.min(220, width * 0.25);
    const caveHeight = caveWidth * 0.7;
    const caveBaseX = Math.max(15, width * 0.03); // left edge with a small margin
    const caveMouthY = height * 0.78;             // cave opening centered here
    caveState.caveArea.x = caveBaseX;
    caveState.caveArea.y = caveMouthY - caveHeight;
    caveState.caveArea.width = caveWidth;
    caveState.caveArea.height = caveHeight;

    const cave = caveState.caveArea;
    const cx = cave.x + cave.width / 2;
    const cy = cave.y + cave.height;
    const time = Date.now() * 0.001;

    context.save();

    // === ROCKY HILLSIDE MOUND — blends with forest terrain, grass-covered top ===
    // Base rock gradient (earth tones that blend with hill colors)
    const moundG = context.createLinearGradient(0, cave.y - 75, 0, cy + 25);
    moundG.addColorStop(0, '#6a7a5a');   // mossy top (transitions to hill green)
    moundG.addColorStop(0.35, '#7a6a50'); // mid earth
    moundG.addColorStop(0.7, '#5a4838');  // darker rock
    moundG.addColorStop(1, '#3a8a3a');    // grass base meeting ground
    context.fillStyle = moundG;
    // Soft mound shape — not jagged anymore, flows like a hill with a cave carved in
    context.beginPath();
    context.moveTo(cave.x - 45, cy + 25);
    const steps = 20;
    const topY = cave.y - 70;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = cave.x - 40 + t * (cave.width + 80);
        // Gentle curved mound top with subtle crags
        const baseHeight = Math.sin(t * Math.PI) * -28;
        const noise = Math.sin(i * 1.7 + cave.x * 0.01) * 5 + Math.sin(i * 3.1) * 3;
        const py = topY + baseHeight + noise;
        context.lineTo(px, py);
    }
    context.lineTo(cave.x + cave.width + 45, cy + 25);
    context.closePath();
    context.fill();

    // Grass cap on the mound (blends the top with the forest)
    context.fillStyle = '#4a8a4a';
    context.beginPath();
    context.moveTo(cave.x - 45, cy + 25);
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = cave.x - 40 + t * (cave.width + 80);
        const baseHeight = Math.sin(t * Math.PI) * -28;
        const noise = Math.sin(i * 1.7 + cave.x * 0.01) * 5 + Math.sin(i * 3.1) * 3;
        const py = topY + baseHeight + noise;
        // Grass layer on upper half only
        if (py < cy - 10) {
            context.lineTo(px, py + 7);
        } else {
            context.lineTo(px, py);
        }
    }
    context.lineTo(cave.x + cave.width + 45, cy + 25);
    context.closePath();
    context.save();
    context.globalAlpha = 0.55;
    context.fill();
    context.restore();

    // Little grass blades sprouting on the mound top
    context.strokeStyle = '#3e8a3e';
    context.lineWidth = 0.9;
    for (let b = 0; b < 14; b++) {
        const t = (b + 1) / 15;
        const bx = cave.x - 40 + t * (cave.width + 80);
        const baseHeight = Math.sin(t * Math.PI) * -28;
        const noise = Math.sin(b * 1.7 + cave.x * 0.01) * 5 + Math.sin(b * 3.1) * 3;
        const by = topY + baseHeight + noise;
        if (by < cy - 10) {
            context.beginPath();
            context.moveTo(bx, by + 1);
            context.lineTo(bx + (b % 2 ? 1 : -1), by - 4);
            context.stroke();
        }
    }

    // Subtle right-side shadow
    const shadowG = context.createLinearGradient(cx, 0, cave.x + cave.width + 45, 0);
    shadowG.addColorStop(0, 'rgba(0,0,0,0)');
    shadowG.addColorStop(1, 'rgba(0,0,0,0.25)');
    context.fillStyle = shadowG;
    context.beginPath();
    context.moveTo(cx, cy + 25);
    context.quadraticCurveTo(cave.x + cave.width + 25, cave.y - 40, cave.x + cave.width + 45, cy + 25);
    context.closePath();
    context.fill();

    // Rock crack/texture lines — muted earth tones, not high-contrast
    context.strokeStyle = 'rgba(60, 45, 25, 0.35)';
    context.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const lx = cave.x - 15 + i * ((cave.width + 30) / 6);
        const ly = cave.y - 25 + Math.sin(i * 1.7) * 12;
        context.beginPath();
        context.moveTo(lx, ly);
        context.quadraticCurveTo(lx + 5 + Math.sin(i * 3) * 3, ly + 10, lx + 3 + Math.cos(i) * 6, ly + 20);
        context.stroke();
    }

    // Soft light highlights on upper-left (light source, subtle)
    context.strokeStyle = 'rgba(255, 245, 210, 0.18)';
    context.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
        const hx = cave.x - 10 + i * ((cave.width / 3) / 2);
        context.beginPath();
        context.moveTo(hx, cave.y - 30 - i * 3);
        context.lineTo(hx + 7, cave.y - 25 - i * 3);
        context.stroke();
    }

    // === CAVE INTERIOR — deep dark arch with fade ===
    const caveW = cave.width - 30;
    const caveR = caveW / 2;
    context.save();
    context.beginPath();
    context.arc(cx, cy, caveR, Math.PI, 0);
    context.lineTo(cx + caveR, cy);
    context.lineTo(cx - caveR, cy);
    context.closePath();
    context.clip();
    // Deep gradient from dark center to darker edges
    const interiorG = context.createRadialGradient(cx, cy - 20, caveR * 0.2, cx, cy - 10, caveR);
    interiorG.addColorStop(0, '#4a2818');
    interiorG.addColorStop(0.4, '#201008');
    interiorG.addColorStop(1, '#060302');
    context.fillStyle = interiorG;
    context.fillRect(cx - caveR - 5, cy - caveR - 5, caveR * 2 + 10, caveR + 10);
    context.restore();

    // Cave mouth outline (rocky rim)
    context.strokeStyle = '#3a241a';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(cx, cy, caveR, Math.PI, 0);
    context.stroke();
    context.strokeStyle = 'rgba(90, 60, 30, 0.5)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(cx, cy, caveR - 2, Math.PI, 0);
    context.stroke();

    // === STALACTITES hanging from cave mouth ===
    context.fillStyle = '#3a2416';
    const stalactites = [
        { a: Math.PI + 0.15, h: 14 }, { a: Math.PI + 0.5, h: 9 },
        { a: Math.PI + 0.85, h: 12 }, { a: Math.PI + 1.25, h: 8 },
        { a: Math.PI + 1.65, h: 11 }
    ];
    stalactites.forEach(s => {
        const sx = cx + Math.cos(s.a) * caveR;
        const sy = cy + Math.sin(s.a) * caveR;
        context.beginPath();
        context.moveTo(sx - 4, sy);
        context.lineTo(sx, sy + s.h);
        context.lineTo(sx + 4, sy);
        context.closePath();
        context.fill();
        // Highlight
        context.strokeStyle = 'rgba(255, 200, 140, 0.2)';
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(sx - 2, sy + 1);
        context.lineTo(sx - 1, sy + s.h - 2);
        context.stroke();
    });

    // === WARM INTERIOR GLOW (lantern light spill) ===
    const glow = context.createRadialGradient(cx - 15, cy - 35, 0, cx - 15, cy - 35, caveR * 1.1);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
    glow.addColorStop(0.5, 'rgba(255, 150, 50, 0.22)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = glow;
    context.save();
    context.beginPath();
    context.arc(cx, cy, caveR, Math.PI, 0);
    context.lineTo(cx + caveR, cy);
    context.lineTo(cx - caveR, cy);
    context.closePath();
    context.clip();
    context.fillRect(cx - caveR, cy - caveR, caveR * 2, caveR + 5);
    context.restore();

    // === HAY BED — layered strands with depth ===
    context.fillStyle = '#e8a030';
    for (let i = 0; i < 10; i++) {
        const hx = cave.x + 25 + i * ((cave.width - 50) / 9);
        const hy = cy - 14 + Math.sin(i * 0.8) * 3;
        context.beginPath();
        context.ellipse(hx, hy, 20, 9, Math.sin(i) * 0.4, 0, Math.PI * 2);
        context.fill();
    }
    context.fillStyle = '#ffd870';
    for (let i = 0; i < 7; i++) {
        const hx = cave.x + 35 + i * ((cave.width - 70) / 6);
        const hy = cy - 10 + Math.cos(i * 1.1) * 2;
        context.beginPath();
        context.ellipse(hx, hy, 16, 7, Math.sin(i * 1.4) * 0.3, 0, Math.PI * 2);
        context.fill();
    }
    // Individual straws sticking up
    context.strokeStyle = '#c08020';
    context.lineWidth = 0.8;
    for (let i = 0; i < 12; i++) {
        const sx = cave.x + 20 + (i * 17) % (cave.width - 40);
        const sy = cy - 8;
        const sh = 4 + (i % 3) * 2;
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(sx + (i % 2 ? 2 : -2), sy - sh);
        context.stroke();
    }

    // === LANTERN — detailed metal frame with flickering flame ===
    const lx = cave.x + 32, ly = cave.y + cave.height * 0.42;
    // Lantern big glow (flickers)
    const flicker = 0.85 + Math.sin(time * 8) * 0.1 + Math.sin(time * 13) * 0.05;
    const bigGlow = context.createRadialGradient(lx, ly, 2, lx, ly, 45);
    bigGlow.addColorStop(0, `rgba(255, 200, 80, ${0.6 * flicker})`);
    bigGlow.addColorStop(0.4, `rgba(255, 150, 40, ${0.25 * flicker})`);
    bigGlow.addColorStop(1, 'rgba(255, 150, 40, 0)');
    context.fillStyle = bigGlow;
    context.fillRect(lx - 45, ly - 45, 90, 90);
    // Lantern body — metal frame
    context.fillStyle = '#3a2818';
    context.fillRect(lx - 6, ly - 2, 12, 16);
    context.fillRect(lx - 8, ly - 4, 16, 3);
    context.fillRect(lx - 8, ly + 13, 16, 3);
    // Hanging chain
    context.strokeStyle = '#4a3828';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(lx, ly - 4);
    context.lineTo(lx, ly - 16);
    context.stroke();
    // Glass panel with warm glow inside
    const glassG = context.createRadialGradient(lx, ly + 6, 1, lx, ly + 6, 8);
    glassG.addColorStop(0, `rgba(255, 240, 150, ${flicker})`);
    glassG.addColorStop(0.6, `rgba(255, 180, 60, ${flicker * 0.8})`);
    glassG.addColorStop(1, 'rgba(180, 60, 10, 0.6)');
    context.fillStyle = glassG;
    context.fillRect(lx - 5, ly, 10, 13);
    // Flame flicker
    context.fillStyle = `rgba(255, 210, 100, ${flicker})`;
    context.beginPath();
    context.ellipse(lx, ly + 8, 1.5, 3, 0, 0, Math.PI * 2);
    context.fill();

    // === MUSHROOMS — cluster of 3 varying sizes ===
    const mushPositions = [
        { x: cave.x + cave.width - 28, y: cy - 2, r: 8, cap: '#c02a2a' },
        { x: cave.x + cave.width - 18, y: cy + 3, r: 5, cap: '#e04040' },
        { x: cave.x + cave.width - 38, y: cy, r: 6, cap: '#a01818' }
    ];
    mushPositions.forEach(m => {
        // Cap with gradient
        const capG = context.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, 0, m.x, m.y, m.r);
        capG.addColorStop(0, shiftColor(m.cap, 40));
        capG.addColorStop(1, m.cap);
        context.fillStyle = capG;
        context.beginPath();
        context.arc(m.x, m.y, m.r, Math.PI, 0);
        context.fill();
        // Stem
        context.fillStyle = '#f5ead0';
        context.fillRect(m.x - m.r * 0.35, m.y, m.r * 0.7, m.r * 1.2);
        context.strokeStyle = '#d0c0a0';
        context.strokeRect(m.x - m.r * 0.35, m.y, m.r * 0.7, m.r * 1.2);
        // White dots on cap
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.beginPath();
        context.arc(m.x - m.r * 0.4, m.y - m.r * 0.4, m.r * 0.2, 0, Math.PI * 2);
        context.arc(m.x + m.r * 0.3, m.y - m.r * 0.5, m.r * 0.15, 0, Math.PI * 2);
        context.fill();
    });

    // === VINES — more detailed with multiple leaves, slight sway ===
    for (let i = 0; i < 4; i++) {
        const vx = cave.x + 15 + i * ((cave.width - 30) / 3);
        const swayX = Math.sin(time * 0.5 + i) * 2;
        context.strokeStyle = '#2d6a2d';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(vx, cave.y - 20);
        context.quadraticCurveTo(vx + swayX + 4, cave.y, vx + swayX - 2, cave.y + 25);
        context.stroke();
        // Leaves along the vine
        for (let l = 0; l < 3; l++) {
            const lyv = cave.y - 10 + l * 12;
            const lxv = vx + swayX + Math.sin(l + i) * 2;
            context.fillStyle = l % 2 ? '#3a8a3a' : '#5fc05f';
            context.beginPath();
            context.ellipse(lxv + (l % 2 ? 4 : -4), lyv, 5, 2.5, l % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
            context.fill();
        }
    }

    // === ROCKS at cave entrance ===
    const rockPositions = [
        { x: cave.x + 8, y: cy + 2, w: 14, h: 7 },
        { x: cave.x + cave.width - 22, y: cy + 4, w: 18, h: 8 }
    ];
    rockPositions.forEach(r => {
        const rG = context.createLinearGradient(r.x, r.y - r.h, r.x, r.y + r.h);
        rG.addColorStop(0, '#999');
        rG.addColorStop(1, '#555');
        context.fillStyle = rG;
        context.beginPath();
        context.ellipse(r.x, r.y, r.w, r.h, 0, 0, Math.PI * 2);
        context.fill();
        // Shadow line
        context.strokeStyle = 'rgba(0,0,0,0.4)';
        context.lineWidth = 1;
        context.beginPath();
        context.ellipse(r.x, r.y + 1, r.w, r.h, 0, 0, Math.PI);
        context.stroke();
    });

    // Label
    context.fillStyle = '#fff';
    context.font = 'bold 15px Comic Sans MS';
    context.textAlign = 'center';
    context.shadowColor = 'rgba(0,0,0,0.5)';
    context.shadowBlur = 4;
    context.fillText('Cozy Cave', cx, cave.y - 55);
    context.shadowBlur = 0;
    context.textAlign = 'left';

    // Show count of bunnies inside
    if (caveState.bunniesInCave.size > 0) {
        context.fillStyle = '#ffe082';
        context.font = '12px Arial';
        context.textAlign = 'center';
        context.fillText(`${caveState.bunniesInCave.size} bunny inside`, cx, cy - 45);
        context.textAlign = 'left';
    }

    context.restore();
}

// Simplified background functions for other scenes
function drawKitchenBackgroundToContext(context, width, height) {
    // Simplified kitchen background for caching
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#fff8e1');
    gradient.addColorStop(1, '#ffcc80');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
}

function drawPlaygroundBackgroundToContext(context, width, height) {
    // Simplified playground background for caching
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#81d4fa');
    gradient.addColorStop(0.65, '#aed581');
    gradient.addColorStop(1, '#7cb342');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
}

function drawBathroomBackgroundToContext(context, width, height) {
    // Simplified bathroom background for caching
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#e8f5e9');
    gradient.addColorStop(1, '#b2ebf2');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
}

function drawFlower(x, y, color) {
    const size = 8;
    
    // Petals
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        const petalX = x + Math.cos(angle) * size;
        const petalY = y + Math.sin(angle) * size;
        
        ctx.beginPath();
        ctx.arc(petalX, petalY, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Center
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
}

function drawParentBunnies() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Ensure canvas has valid dimensions
    if (width === 0 || height === 0) {
        console.warn('Canvas has zero dimensions, skipping parent bunny rendering');
        return;
    }

    // Initialize default positions if not set
    if (!parentBunnyPositions.parent_black.initialized) {
        parentBunnyPositions.parent_black.x = width * 0.2;
        parentBunnyPositions.parent_black.y = height * 0.6;
        parentBunnyPositions.parent_black.targetX = width * 0.2;
        parentBunnyPositions.parent_black.targetY = height * 0.6;
        parentBunnyPositions.parent_black.initialized = true;
    }
    if (!parentBunnyPositions.parent_white.initialized) {
        parentBunnyPositions.parent_white.x = width * 0.8;
        parentBunnyPositions.parent_white.y = height * 0.6;
        parentBunnyPositions.parent_white.targetX = width * 0.8;
        parentBunnyPositions.parent_white.targetY = height * 0.6;
        parentBunnyPositions.parent_white.initialized = true;
    }

    // Smooth lerp toward target positions
    const lerpFactor = 0.15;
    parentBunnyPositions.parent_black.x = lerp(parentBunnyPositions.parent_black.x, parentBunnyPositions.parent_black.targetX, lerpFactor);
    parentBunnyPositions.parent_black.y = lerp(parentBunnyPositions.parent_black.y, parentBunnyPositions.parent_black.targetY, lerpFactor);
    parentBunnyPositions.parent_white.x = lerp(parentBunnyPositions.parent_white.x, parentBunnyPositions.parent_white.targetX, lerpFactor);
    parentBunnyPositions.parent_white.y = lerp(parentBunnyPositions.parent_white.y, parentBunnyPositions.parent_white.targetY, lerpFactor);

    // Black parent bunny
    const blackX = parentBunnyPositions.parent_black.x;
    const blackY = parentBunnyPositions.parent_black.y;
    drawParentBunny(blackX, blackY, '#2c2c2c', 'black');

    // White parent bunny
    const whiteX = parentBunnyPositions.parent_white.x;
    const whiteY = parentBunnyPositions.parent_white.y;
    drawParentBunny(whiteX, whiteY, '#ffffff', 'white');

    // Draw player names if available
    drawPlayerNames(blackX, blackY, whiteX, whiteY, width, height);
}

// ===== GRADIENT SHADING HELPERS =====
function shiftColor(hex, amount) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex;
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
// Radial gradient for a body centered at (0,0) — light from upper-left
function bodyGradient(color, rx, ry) {
    const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, 0, 0, 0, Math.max(rx, ry) * 1.25);
    g.addColorStop(0, shiftColor(color, 35));
    g.addColorStop(0.6, color);
    g.addColorStop(1, shiftColor(color, -40));
    return g;
}

// ===== IDLE ANIMATION HELPERS =====
// Per-entity phase keeps bunnies from animating in sync
function idlePhase(seed) {
    if (typeof seed === 'string') {
        let h = 0;
        for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
        return (h / 0xffff) * Math.PI * 2;
    }
    return (seed * 0.013) % (Math.PI * 2);
}
function breathingScale(phase, time) {
    return 1 + Math.sin(time * 2 + phase) * 0.035;
}
function isBlinking(phase, time) {
    const cycle = 4.5, dur = 0.12;
    return ((time + phase) % cycle) < dur;
}
function earTwitch(phase, time) {
    const cycle = 6, dur = 0.45;
    const t = (time + phase) % cycle;
    return t < dur ? Math.sin((t / dur) * Math.PI) * 0.18 : 0;
}
function tailWag(phase, time) {
    return Math.sin(time * 3 + phase) * 0.05;
}
// Gentle head tilt (Cromimi-style) — slow sway between ~±8°
function headTilt(phase, time) {
    return Math.sin(time * 0.6 + phase) * 0.14;
}

function drawParentBunny(x, y, color, type) {
    const size = 60; // bigger figures (was 40)
    const time = Date.now() * 0.003;

    // Gentle floating/hover animation (matches baby bunnies)
    const floatPhase = type === 'black' ? 0 : Math.PI;
    const bounceY = y + Math.sin(time * 1.5 + floatPhase) * 5;

    // Draw ground shadow
    ctx.save();
    const shadowScale = 1 - Math.sin(time * 1.5 + floatPhase) * 0.02;
    ctx.globalAlpha = 0.15 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.9, size * 0.6, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    ctx.save();
    ctx.translate(x, bounceY);

    // Idle animation state
    const phase = idlePhase(type);
    const breath = breathingScale(phase, time);
    const twitch = earTwitch(phase, time);
    const blink = isBlinking(phase, time);
    const wagDx = tailWag(phase, time) * size;
    const tilt = headTilt(phase, time);

    // Apply gentle head tilt to the whole bunny (Cromimi-style)
    ctx.rotate(tilt * 0.4);

    // Body (with subtle breathing scale + radial gradient shading)
    ctx.save();
    ctx.scale(breath, breath);
    ctx.fillStyle = bodyGradient(color, size, size * 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (color === '#ffffff') {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Ears (with idle twitch rotation + gradient shading)
    ctx.fillStyle = bodyGradient(color, size * 0.3, size * 0.6);
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.8, size * 0.3, size * 0.6, -0.3 - twitch, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.8, size * 0.3, size * 0.6, 0.3 + twitch, 0, Math.PI * 2);
    ctx.fill();

    // Inner ears
    ctx.fillStyle = type === 'white' ? '#ffb3d9' : '#ff69b4';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.7, size * 0.15, size * 0.3, -0.3 - twitch, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.7, size * 0.15, size * 0.3, 0.3 + twitch, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Face (blinks on idle cycle, vibrant per-parent eye color)
    const parentEyeColor = type === 'black' ? EYE_COLORS[0] : EYE_COLORS[3]; // blue / pink
    drawBunnyFace(0, -size * 0.2, size * 0.8, false, blink, 'content', parentEyeColor);

    // Blush for white bunny
    if (type === 'white') {
        ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
        ctx.beginPath();
        ctx.arc(-size * 0.35, size * 0.05, size * 0.12, 0, Math.PI * 2);
        ctx.arc(size * 0.35, size * 0.05, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    // Tail (with subtle wag + shading)
    const tailG = ctx.createRadialGradient(
        -size * 0.85 + wagDx, size * 0.22, 0,
        -size * 0.8 + wagDx, size * 0.3, size * 0.3
    );
    tailG.addColorStop(0, shiftColor(color, 40));
    tailG.addColorStop(1, shiftColor(color, -25));
    ctx.fillStyle = tailG;
    ctx.beginPath();
    ctx.arc(-size * 0.8 + wagDx, size * 0.3, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    if (color === '#ffffff') {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw parent wearables if any
    const parentWearableKey = type === 'black' ? 'parent_black' : 'parent_white';
    if (gameState && gameState.parentWearables && gameState.parentWearables[parentWearableKey]) {
        drawBunnyWearables(0, 0, size, gameState.parentWearables[parentWearableKey]);
    }

    ctx.restore();
}

function drawPlayerNames(blackX, blackY, whiteX, whiteY, width, height) {
    if (!gameState) return;
    
    ctx.save();
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    
    // Find player names from game state or stored data
    let blackPlayerName = 'Black Player';
    let whitePlayerName = 'White Player';

    // Try to get player names from game state (players is an object, not an array)
    if (gameState.players) {
        Object.values(gameState.players).forEach(player => {
            if (player.type === 'black' || player.bunnyColor === 'black') {
                blackPlayerName = player.name || 'Black Player';
            } else if (player.type === 'white' || player.bunnyColor === 'white') {
                whitePlayerName = player.name || 'White Player';
            }
        });
    }
    
    // If we're the current player, use our stored name
    if (myPlayerType === 'black') {
        blackPlayerName = getPlayerName() || blackPlayerName;
    } else if (myPlayerType === 'white') {
        whitePlayerName = getPlayerName() || whitePlayerName;
    }
    
    // Draw black player name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeText(blackPlayerName, blackX, blackY + 70);
    ctx.fillText(blackPlayerName, blackX, blackY + 70);
    
    // Draw white player name
    ctx.strokeText(whitePlayerName, whiteX, whiteY + 70);
    ctx.fillText(whitePlayerName, whiteX, whiteY + 70);
    
    ctx.restore();
}

function drawDraggableBabies() {
    if (!gameState || !gameState.babies) return;
    
    gameState.babies.forEach((baby, index) => {
        const position = getBunnyPosition(baby.id);
        const isSelected = selectedBabyId === baby.id;
        const animState = bunnyAnimStates[baby.id];
        
        drawDraggableBaby(position.x, position.y, baby, isSelected, animState);
    });
}

function drawDraggableBaby(x, y, baby, isSelected, animState) {
    const stage = baby.stage;
    const time = Date.now() * 0.003;

    // Floating / hovering animation — unique phase per bunny
    const floatPhase = (baby.id ? baby.id.charCodeAt(baby.id.length - 1) : 0) * 1.3;
    const floatY = Math.sin(time * 1.5 + floatPhase) * 6; // gentle 6px bob
    const floatX = Math.cos(time * 0.8 + floatPhase) * 2; // very subtle horizontal sway

    const drawX = x + floatX;
    const drawY = y + floatY;

    ctx.save();

    // Apply scaling and bounce animation from drag
    if (animState) {
        const bounceY = drawY + animState.bounceOffset;
        ctx.translate(drawX, bounceY);
        ctx.scale(animState.scale, animState.scale);

        // Draw shadow — size varies with float height
        const shadowScale = 1 - floatY * 0.015; // shadow shrinks when bunny floats up
        const isDragging = animState.isBeingDragged;
        drawBunnyShadow(0, 20 - floatY * 0.5, isDragging ? animState.scale : shadowScale);

        ctx.translate(-drawX, -bounceY);
    } else {
        // Even without animState, draw a ground shadow
        const shadowScale = 1 - floatY * 0.015;
        ctx.save();
        ctx.globalAlpha = 0.2 * shadowScale;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(drawX, y + 25, 20, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Enhanced selection indicator
    if (isSelected) {
        drawSelectionIndicator(drawX, drawY, animState);
    }

    // Draw drag indicator if being dragged
    if (dragState.isDragging && dragState.targetBunny?.id === baby.id) {
        drawDragIndicator(drawX, drawY);
    }

    if (stage === 'egg') {
        drawEgg(drawX, drawY, baby);
    } else {
        drawBunnyBaby(drawX, drawY, baby);
    }

    ctx.restore();
}

function drawBunnyShadow(x, y, scale) {
    ctx.save();
    ctx.globalAlpha = 0.3 * scale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, 25 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawSelectionIndicator(x, y, animState) {
    const pulseFactor = 1 + 0.2 * Math.sin(Date.now() * 0.008);
    const radius = 60 * pulseFactor;
    
    ctx.strokeStyle = dragState.isDragging ? '#ff6b6b' : '#ff69b4';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
}

function drawDragIndicator(x, y) {
    const time = Date.now() * 0.01;
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time);
    ctx.strokeStyle = '#ffb6c1';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(x, y, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawEgg(x, y, baby) {
    const size = 30;
    const hatchProgress = baby.hatchProgress || 0;
    const time = Date.now() * 0.005;
    
    // Gentle wobble if being tapped
    const wobble = Math.sin(time * 10) * (hatchProgress > 90 ? 3 : 0);
    
    ctx.save();
    ctx.translate(x + wobble, y);
    
    // Egg shell
    const gradient = ctx.createLinearGradient(-size, -size, size, size);
    gradient.addColorStop(0, '#f8f8f8');
    gradient.addColorStop(1, '#e0e0e0');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Egg pattern (spots)
    ctx.fillStyle = 'rgba(255, 179, 217, 0.3)';
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.5, size * 0.2, 0, Math.PI * 2);
    ctx.arc(size * 0.4, size * 0.2, size * 0.15, 0, Math.PI * 2);
    ctx.arc(0, size * 0.6, size * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
    // Cracks if almost ready to hatch
    if (hatchProgress > 70) {
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, -size * 0.8);
        ctx.lineTo(size * 0.1, -size * 0.6);
        ctx.moveTo(size * 0.3, 0);
        ctx.lineTo(-size * 0.1, size * 0.3);
        ctx.stroke();
    }
    
    // Draw wearables on egg too
    if (baby.wearables) {
        drawBunnyWearables(0, 0, size, baby.wearables);
    }

    ctx.restore();

    // Progress indicator
    if (hatchProgress > 0) {
        ctx.fillStyle = '#ff69b4';
        ctx.font = '12px Comic Sans MS';
        ctx.textAlign = 'center';
        ctx.fillText(`${hatchProgress}%`, x, y + 50);
    }
}

function drawBunnyBaby(x, y, baby) {
    const stage = baby.stage;
    let size;
    
    switch (stage) {
        case 'newborn': size = 32; break;
        case 'toddler': size = 40; break;
        case 'young': size = 48; break;
        case 'grown': size = 56; break;
        default: size = 32;
    }
    
    const time = Date.now() * 0.003;
    
    // Sleeping animation
    const sleepOffset = baby.sleeping ? Math.sin(time * 2) * 2 : 0;
    const bounceY = baby.sleeping ? y : y + Math.sin(time * 2 + x * 0.01) * 2;
    
    ctx.save();
    ctx.translate(x, bounceY + sleepOffset);

    // Determine color based on genetics
    const genetics = baby.genetics || { color: 'gray', parentInfluence: 'black' };
    let bunnyColor;

    switch (genetics.color) {
        case 'black': bunnyColor = '#2c2c2c'; break;
        case 'white': bunnyColor = '#ffffff'; break;
        case 'gray': bunnyColor = '#808080'; break;
        case 'brown': bunnyColor = '#8b4513'; break;
        case 'cream': bunnyColor = '#f5deb3'; break;
        case 'spotted': bunnyColor = '#ffffff'; break;
        default: bunnyColor = '#808080';
    }

    // Idle animation state (sleeping babies don't blink/twitch — just breathe slowly)
    const phase = idlePhase(baby.id || baby.name || x);
    const breath = baby.sleeping
        ? 1 + Math.sin(time * 0.8 + phase) * 0.025
        : breathingScale(phase, time);
    const twitch = baby.sleeping ? 0 : earTwitch(phase, time);
    const blink = baby.sleeping ? false : isBlinking(phase, time);
    const wagDx = baby.sleeping ? 0 : tailWag(phase, time) * size;
    const tilt = baby.sleeping ? 0 : headTilt(phase, time);

    // Apply gentle head tilt to the whole baby (Cromimi-style)
    ctx.rotate(tilt * 0.4);

    // Body (with breathing scale + gradient shading)
    ctx.save();
    ctx.scale(breath, breath);
    ctx.fillStyle = bodyGradient(bunnyColor, size, size * 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (bunnyColor === '#ffffff' || genetics.color === 'spotted') {
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Spots for spotted bunnies
    if (genetics.color === 'spotted') {
        ctx.fillStyle = '#2c2c2c';
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.2, size * 0.2, 0, Math.PI * 2);
        ctx.arc(size * 0.2, size * 0.3, size * 0.15, 0, Math.PI * 2);
        ctx.fill();
    }

    // Ears (with idle twitch + gradient shading)
    const earSize = size * 0.4;
    ctx.fillStyle = bodyGradient(bunnyColor, earSize * 0.6, earSize);
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.9, earSize * 0.6, earSize, -0.3 - twitch, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.9, earSize * 0.6, earSize, 0.3 + twitch, 0, Math.PI * 2);
    ctx.fill();

    // Inner ears
    ctx.fillStyle = '#ffb3d9';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.8, earSize * 0.3, earSize * 0.6, -0.3 - twitch, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.8, earSize * 0.3, earSize * 0.6, 0.3 + twitch, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Face (blinks on idle cycle + mood expression + per-baby eye color)
    const babyEyeColor = pickEyeColor(baby.id || baby.name || x);
    drawBunnyFace(0, -size * 0.3, size * 0.6, baby.sleeping, blink, deriveMood(baby), babyEyeColor);

    // Tail (with subtle wag + shading)
    const babyTailG = ctx.createRadialGradient(
        -size * 0.95 + wagDx, size * 0.12, 0,
        -size * 0.9 + wagDx, size * 0.2, size * 0.25
    );
    babyTailG.addColorStop(0, shiftColor(bunnyColor, 40));
    babyTailG.addColorStop(1, shiftColor(bunnyColor, -25));
    ctx.fillStyle = babyTailG;
    ctx.beginPath();
    ctx.arc(-size * 0.9 + wagDx, size * 0.2, size * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Draw wearables
    if (baby.wearables) {
        drawBunnyWearables(0, 0, size, baby.wearables);
    }

    ctx.restore();

    // Name tag
    if (baby.name) {
        ctx.fillStyle = '#ff69b4';
        ctx.font = `${Math.max(10, size * 0.4)}px Comic Sans MS`;
        ctx.textAlign = 'center';
        ctx.fillText(baby.name, x, y + size + 20);
    }
    
    // Status indicators
    if (baby.sleeping) {
        ctx.fillStyle = '#3f51b5';
        ctx.font = '16px Comic Sans MS';
        ctx.textAlign = 'center';
        ctx.fillText('💤', x + 30, y - 20);
    }
}

function drawBunnyWearables(x, y, size, wearables) {
    if (!wearables || typeof wearables !== 'object') return;
    // Wearables are drawn relative to the bunny's own size. Scale down from
    // 1.6× → 1.1× so hats, scarves and bags actually hug the silhouette
    // instead of floating above/around it.
    size = size * 1.1;
    const time = Date.now() * 0.003;

    // === BACK SLOT — cape/blanket/bag/jacket ===
    if (wearables.back) {
        const backItem = wearables.back;
        if (backItem.itemId === 'louis_bunitton') {
            // Louis Bunitton monogram shoulder bag
            const bagX = x + size * 0.2, bagY = y + size * 0.3, bagW = size * 0.55, bagH = size * 0.5;
            // Strap (goes over shoulder)
            ctx.strokeStyle = '#3a2410';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.1, y - size * 0.35);
            ctx.quadraticCurveTo(x + size * 0.1, y, bagX, bagY);
            ctx.moveTo(x - size * 0.1, y - size * 0.35);
            ctx.quadraticCurveTo(x + size * 0.3, y - size * 0.2, bagX + bagW, bagY);
            ctx.stroke();
            // Bag body (LV-inspired monogram brown)
            const bagG = ctx.createLinearGradient(bagX, bagY, bagX, bagY + bagH);
            bagG.addColorStop(0, '#8a5a30');
            bagG.addColorStop(0.5, '#5a3a20');
            bagG.addColorStop(1, '#3a2810');
            ctx.fillStyle = bagG;
            ctx.fillRect(bagX, bagY, bagW, bagH);
            // Bag corners rounded
            ctx.fillStyle = '#3a2810';
            ctx.fillRect(bagX + bagW - 3, bagY + 3, 3, bagH - 6);
            // Monogram pattern (golden LB dots/fleurs)
            ctx.fillStyle = '#d4af37';
            for (let my = 0; my < 4; my++) {
                for (let mx = 0; mx < 3; mx++) {
                    const dx = bagX + 4 + mx * 8 + (my % 2) * 4;
                    const dy = bagY + 6 + my * 9;
                    if (dx < bagX + bagW - 3 && dy < bagY + bagH - 3) {
                        // Tiny flower shape
                        for (let fp = 0; fp < 4; fp++) {
                            const fa = (fp / 4) * Math.PI * 2;
                            ctx.beginPath();
                            ctx.arc(dx + Math.cos(fa) * 1, dy + Math.sin(fa) * 1, 0.8, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        ctx.beginPath();
                        ctx.arc(dx, dy, 0.6, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            // Gold clasp
            ctx.fillStyle = '#f0c84a';
            ctx.fillRect(bagX + bagW / 2 - 4, bagY - 2, 8, 5);
            ctx.strokeStyle = '#8a6010';
            ctx.strokeRect(bagX + bagW / 2 - 4, bagY - 2, 8, 5);
        } else if (backItem.itemId === 'hoppidas_jacket') {
            // Hoppidas track jacket — black with 3 white stripes
            const jG = ctx.createLinearGradient(x - size * 0.6, 0, x + size * 0.6, 0);
            jG.addColorStop(0, '#0a0a0a');
            jG.addColorStop(0.5, '#2a2a2a');
            jG.addColorStop(1, '#0a0a0a');
            ctx.fillStyle = jG;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.6, y - size * 0.3);
            ctx.quadraticCurveTo(x, y + size * 1.1, x + size * 0.6, y - size * 0.3);
            ctx.lineTo(x + size * 0.5, y - size * 0.5);
            ctx.quadraticCurveTo(x, y + size * 0.8, x - size * 0.5, y - size * 0.5);
            ctx.fill();
            // 3 white stripes on shoulders (signature)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            for (let st = 0; st < 3; st++) {
                const yOff = y - size * 0.2 + st * size * 0.12;
                ctx.beginPath();
                ctx.moveTo(x - size * 0.55, yOff);
                ctx.quadraticCurveTo(x - size * 0.45, yOff + size * 0.1, x - size * 0.35, yOff);
                ctx.moveTo(x + size * 0.35, yOff);
                ctx.quadraticCurveTo(x + size * 0.45, yOff + size * 0.1, x + size * 0.55, yOff);
                ctx.stroke();
            }
            // Trefoil logo (tiny) on chest
            ctx.fillStyle = '#fff';
            const tfX = x - size * 0.05, tfY = y + size * 0.15;
            ctx.beginPath();
            ctx.moveTo(tfX, tfY - 4);
            ctx.lineTo(tfX - 3, tfY + 2);
            ctx.lineTo(tfX + 3, tfY + 2);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tfX, tfY, 1, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Default cape/blanket with velvet gradient + gold trim
        const color = backItem.color || '#7e57c2';
        const capeG = ctx.createLinearGradient(x - size * 0.6, 0, x + size * 0.6, 0);
        capeG.addColorStop(0, shiftColor(color, -40));
        capeG.addColorStop(0.3, color);
        capeG.addColorStop(0.6, shiftColor(color, 25));
        capeG.addColorStop(1, shiftColor(color, -40));
        ctx.fillStyle = capeG;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.6, y - size * 0.3);
        ctx.quadraticCurveTo(x, y + size * 1.1, x + size * 0.6, y - size * 0.3);
        ctx.lineTo(x + size * 0.5, y - size * 0.5);
        ctx.quadraticCurveTo(x, y + size * 0.8, x - size * 0.5, y - size * 0.5);
        ctx.fill();
        // Gold trim
        ctx.strokeStyle = '#f0c84a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.6, y - size * 0.3);
        ctx.quadraticCurveTo(x, y + size * 1.1, x + size * 0.6, y - size * 0.3);
        ctx.stroke();
        // Fold-line shadows (gives fabric drape)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 1.2;
        for (let f = -2; f <= 2; f++) {
            ctx.beginPath();
            ctx.moveTo(x + f * size * 0.15, y - size * 0.35);
            ctx.quadraticCurveTo(x + f * size * 0.12, y + size * 0.4, x + f * size * 0.08, y + size * 0.85);
            ctx.stroke();
        }
        } // close default else block
    }

    // === NECK SLOT ===
    if (wearables.neck) {
        const w = wearables.neck;
        const color = w.color || '#e53935';
        if (w.itemId === 'hopmes_scarf') {
            // Hopmès-inspired silk carré — vivid orange with fine pattern
            const silkG = ctx.createLinearGradient(0, y + size * 0.4, 0, y + size * 1.0);
            silkG.addColorStop(0, '#ff8a20');
            silkG.addColorStop(0.5, '#ff6610');
            silkG.addColorStop(1, '#c04000');
            ctx.fillStyle = silkG;
            ctx.beginPath();
            ctx.ellipse(x, y + size * 0.5, size * 0.75, size * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            // Hanging scarf ends with diagonal fold
            ctx.fillRect(x + size * 0.3, y + size * 0.5, size * 0.18, size * 0.55);
            ctx.fillRect(x + size * 0.52, y + size * 0.55, size * 0.14, size * 0.45);
            // Pattern: tiny golden "H" marks
            ctx.strokeStyle = '#ffd890';
            ctx.lineWidth = 0.8;
            for (let p = 0; p < 5; p++) {
                const px = x + size * (0.32 + (p % 3) * 0.08);
                const py = y + size * (0.6 + Math.floor(p / 3) * 0.2);
                ctx.beginPath();
                ctx.moveTo(px, py); ctx.lineTo(px, py + 3);
                ctx.moveTo(px + 3, py); ctx.lineTo(px + 3, py + 3);
                ctx.moveTo(px, py + 1.5); ctx.lineTo(px + 3, py + 1.5);
                ctx.stroke();
            }
            // Tag with gold trim
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(x - size * 0.3, y + size * 0.48, size * 0.08, size * 0.05);
        } else if (w.itemId === 'chanel_pearls') {
            // Multi-strand baroque pearl necklace
            for (let strand = 0; strand < 3; strand++) {
                const radius = size * (0.38 + strand * 0.06);
                const yOff = y + size * (0.12 + strand * 0.08);
                // Draw pearls along arc
                for (let p = 0; p < 14; p++) {
                    const pa = Math.PI + 0.3 + (p / 13) * (Math.PI - 0.6);
                    const px = x + Math.cos(pa) * radius;
                    const py = yOff + Math.sin(pa) * radius;
                    const pG = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, 2.5);
                    pG.addColorStop(0, '#ffffff');
                    pG.addColorStop(0.5, '#f0e8d0');
                    pG.addColorStop(1, '#a89878');
                    ctx.fillStyle = pG;
                    ctx.beginPath();
                    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // Gold clasp pendant
            ctx.fillStyle = '#d4af37';
            ctx.beginPath();
            ctx.arc(x, y + size * 0.52, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff8c8';
            ctx.font = 'bold 4px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('C', x, y + size * 0.54);
            ctx.textAlign = 'left';
        } else if (w.itemId === 'night_light') {
            // Glowing gem amulet
            const glow = 0.6 + Math.sin(time * 2) * 0.3;
            // Outer halo
            const haloG = ctx.createRadialGradient(x, y + size * 0.45, 0, x, y + size * 0.45, size * 0.5);
            haloG.addColorStop(0, `rgba(255, 230, 80, ${glow * 0.6})`);
            haloG.addColorStop(1, 'rgba(255, 230, 80, 0)');
            ctx.fillStyle = haloG;
            ctx.fillRect(x - size * 0.5, y + size * 0.45 - size * 0.5, size, size);
            // Gem with multi-facet gradient
            const gemG = ctx.createRadialGradient(x - size * 0.05, y + size * 0.4, 0, x, y + size * 0.45, size * 0.2);
            gemG.addColorStop(0, '#ffffe0');
            gemG.addColorStop(0.5, '#ffd94a');
            gemG.addColorStop(1, '#b88a10');
            ctx.fillStyle = gemG;
            ctx.beginPath();
            ctx.arc(x, y + size * 0.45, size * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#8a6810';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Sparkle
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x - size * 0.06, y + size * 0.4, size * 0.03, 0, Math.PI * 2);
            ctx.fill();
            // Chain (dotted gold links)
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 1]);
            ctx.beginPath();
            ctx.arc(x, y + size * 0.15, size * 0.4, 0.3, Math.PI - 0.3);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (w.itemId === 'carrot_treat') {
            // Chain
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 1]);
            ctx.beginPath();
            ctx.arc(x, y + size * 0.15, size * 0.4, 0.3, Math.PI - 0.3);
            ctx.stroke();
            ctx.setLineDash([]);
            // Carrot pendant (3D)
            const carG = ctx.createLinearGradient(x - size * 0.1, 0, x + size * 0.1, 0);
            carG.addColorStop(0, '#c25400');
            carG.addColorStop(0.5, '#ff8c1a');
            carG.addColorStop(1, '#a04500');
            ctx.fillStyle = carG;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.09, y + size * 0.4);
            ctx.lineTo(x + size * 0.09, y + size * 0.4);
            ctx.lineTo(x, y + size * 0.68);
            ctx.closePath();
            ctx.fill();
            // Shine
            ctx.strokeStyle = 'rgba(255, 220, 180, 0.6)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.03, y + size * 0.42);
            ctx.lineTo(x + size * 0.02, y + size * 0.62);
            ctx.stroke();
            // Greens (3 leaves)
            ['#3a8a3a', '#4caf50', '#5fc05f'].forEach((gc, gi) => {
                ctx.fillStyle = gc;
                ctx.beginPath();
                ctx.ellipse(x + (gi - 1) * size * 0.03, y + size * 0.33 - gi * 0.02, size * 0.03, size * 0.08, (gi - 1) * 0.3, 0, Math.PI * 2);
                ctx.fill();
            });
        } else {
            // Knitted scarf with gradient
            const scarfG = ctx.createLinearGradient(0, y + size * 0.4, 0, y + size * 1.0);
            scarfG.addColorStop(0, shiftColor(color, 25));
            scarfG.addColorStop(0.5, color);
            scarfG.addColorStop(1, shiftColor(color, -30));
            ctx.fillStyle = scarfG;
            // Main wrap
            ctx.beginPath();
            ctx.ellipse(x, y + size * 0.5, size * 0.7, size * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Hanging ends with fabric drape
            ctx.fillRect(x + size * 0.3, y + size * 0.5, size * 0.15, size * 0.5);
            ctx.fillRect(x + size * 0.5, y + size * 0.55, size * 0.12, size * 0.4);
            // Knit texture stripes
            ctx.strokeStyle = shiftColor(color, -35);
            ctx.lineWidth = 0.6;
            for (let k = 0; k < 6; k++) {
                const ky = y + size * 0.55 + k * size * 0.08;
                ctx.beginPath();
                ctx.moveTo(x + size * 0.3, ky);
                ctx.lineTo(x + size * 0.45, ky);
                ctx.moveTo(x + size * 0.5, ky);
                ctx.lineTo(x + size * 0.62, ky);
                ctx.stroke();
            }
            // Fringe at ends
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            for (let f = 0; f < 3; f++) {
                ctx.beginPath();
                ctx.moveTo(x + size * 0.32 + f * size * 0.04, y + size * 1.0);
                ctx.lineTo(x + size * 0.32 + f * size * 0.04, y + size * 1.04);
                ctx.stroke();
            }
        }
    }

    // === HEAD SLOT ===
    if (wearables.head) {
        const w = wearables.head;
        if (w.itemId === 'hike_cap') {
            // Hike (Nike-inspired) baseball cap — white with red swoosh-like mark
            const capColor = '#ffffff';
            // Crown (dome) with gradient
            const capG = ctx.createLinearGradient(0, y - size * 1.25, 0, y - size * 0.9);
            capG.addColorStop(0, '#ffffff');
            capG.addColorStop(1, '#e0e0e0');
            ctx.fillStyle = capG;
            ctx.beginPath();
            ctx.ellipse(x, y - size * 1.05, size * 0.42, size * 0.28, 0, Math.PI, 0);
            ctx.fill();
            // Brim/visor extending forward (right)
            ctx.fillStyle = '#d8d8d8';
            ctx.beginPath();
            ctx.ellipse(x + size * 0.25, y - size * 0.88, size * 0.3, size * 0.09, 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // Swoosh-like mark
            ctx.strokeStyle = '#e8341a';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x - size * 0.15, y - size * 1.0);
            ctx.quadraticCurveTo(x + size * 0.05, y - size * 1.18, x + size * 0.2, y - size * 1.05);
            ctx.stroke();
            ctx.lineCap = 'butt';
        } else if (w.itemId === 'bunnci_beanie') {
            // Bunnci-inspired beanie — green with red/green stripe
            // Crown shape
            ctx.fillStyle = '#006633';
            ctx.beginPath();
            ctx.arc(x, y - size * 1.0, size * 0.4, Math.PI, 0);
            ctx.lineTo(x + size * 0.42, y - size * 0.85);
            ctx.lineTo(x - size * 0.42, y - size * 0.85);
            ctx.closePath();
            ctx.fill();
            // Cuff
            ctx.fillStyle = '#004422';
            ctx.fillRect(x - size * 0.44, y - size * 0.88, size * 0.88, size * 0.08);
            // Signature stripe (red/green/red)
            ctx.fillStyle = '#006633';
            ctx.fillRect(x - size * 0.44, y - size * 0.96, size * 0.88, size * 0.025);
            ctx.fillStyle = '#c4302a';
            ctx.fillRect(x - size * 0.44, y - size * 0.935, size * 0.88, size * 0.025);
            ctx.fillStyle = '#006633';
            ctx.fillRect(x - size * 0.44, y - size * 0.91, size * 0.88, size * 0.025);
            // Pom pom on top
            const pomG = ctx.createRadialGradient(x - 2, y - size * 1.38, 0, x, y - size * 1.36, size * 0.1);
            pomG.addColorStop(0, '#f0f0f0');
            pomG.addColorStop(1, '#a0a0a0');
            ctx.fillStyle = pomG;
            ctx.beginPath();
            ctx.arc(x, y - size * 1.36, size * 0.09, 0, Math.PI * 2);
            ctx.fill();
        } else if (w.itemId === 'hat_top') {
            // Top hat with silk sheen
            const hatColor = w.color || '#1a1a1a';
            // Brim
            const brimG = ctx.createLinearGradient(0, y - size * 0.9, 0, y - size * 0.8);
            brimG.addColorStop(0, shiftColor(hatColor, 30));
            brimG.addColorStop(1, hatColor);
            ctx.fillStyle = brimG;
            ctx.beginPath();
            ctx.ellipse(x, y - size * 0.9, size * 0.55, size * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            // Crown with silk highlight
            const crownG = ctx.createLinearGradient(x - size * 0.4, 0, x + size * 0.4, 0);
            crownG.addColorStop(0, hatColor);
            crownG.addColorStop(0.3, shiftColor(hatColor, 40));
            crownG.addColorStop(0.6, hatColor);
            crownG.addColorStop(1, shiftColor(hatColor, -20));
            ctx.fillStyle = crownG;
            ctx.fillRect(x - size * 0.4, y - size * 1.5, size * 0.8, size * 0.62);
            // Top ellipse
            ctx.fillStyle = shiftColor(hatColor, 15);
            ctx.beginPath();
            ctx.ellipse(x, y - size * 1.5, size * 0.4, size * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            // Satin band
            const bandG = ctx.createLinearGradient(0, y - size * 1.0, 0, y - size * 0.92);
            bandG.addColorStop(0, '#c03030');
            bandG.addColorStop(0.5, '#ff6060');
            bandG.addColorStop(1, '#800000');
            ctx.fillStyle = bandG;
            ctx.fillRect(x - size * 0.4, y - size * 1.0, size * 0.8, size * 0.08);
        } else if (w.itemId === 'bow_pink') {
            // Satin bow with shading + knot + ribbon tails
            const bowColor = w.color || '#e91e63';
            // Left loop
            const loopG = ctx.createRadialGradient(x - size * 0.25, y - size * 1.15, 2, x - size * 0.25, y - size * 1.05, size * 0.4);
            loopG.addColorStop(0, shiftColor(bowColor, 35));
            loopG.addColorStop(1, shiftColor(bowColor, -20));
            ctx.fillStyle = loopG;
            ctx.beginPath();
            ctx.moveTo(x, y - size * 0.95);
            ctx.quadraticCurveTo(x - size * 0.6, y - size * 1.4, x - size * 0.2, y - size * 1.0);
            ctx.quadraticCurveTo(x - size * 0.3, y - size * 0.9, x, y - size * 0.95);
            ctx.closePath();
            ctx.fill();
            // Right loop
            const loopG2 = ctx.createRadialGradient(x + size * 0.25, y - size * 1.15, 2, x + size * 0.25, y - size * 1.05, size * 0.4);
            loopG2.addColorStop(0, shiftColor(bowColor, 35));
            loopG2.addColorStop(1, shiftColor(bowColor, -20));
            ctx.fillStyle = loopG2;
            ctx.beginPath();
            ctx.moveTo(x, y - size * 0.95);
            ctx.quadraticCurveTo(x + size * 0.6, y - size * 1.4, x + size * 0.2, y - size * 1.0);
            ctx.quadraticCurveTo(x + size * 0.3, y - size * 0.9, x, y - size * 0.95);
            ctx.closePath();
            ctx.fill();
            // Ribbon tails
            ctx.fillStyle = shiftColor(bowColor, -15);
            ctx.beginPath();
            ctx.moveTo(x - size * 0.05, y - size * 0.9);
            ctx.quadraticCurveTo(x - size * 0.15, y - size * 0.7, x - size * 0.12, y - size * 0.6);
            ctx.lineTo(x + size * 0.02, y - size * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x + size * 0.05, y - size * 0.9);
            ctx.quadraticCurveTo(x + size * 0.15, y - size * 0.7, x + size * 0.12, y - size * 0.6);
            ctx.lineTo(x - size * 0.02, y - size * 0.7);
            ctx.closePath();
            ctx.fill();
            // Center knot
            const knotG = ctx.createRadialGradient(x, y - size * 0.97, 1, x, y - size * 0.95, size * 0.12);
            knotG.addColorStop(0, shiftColor(bowColor, 20));
            knotG.addColorStop(1, shiftColor(bowColor, -40));
            ctx.fillStyle = knotG;
            ctx.beginPath();
            ctx.ellipse(x, y - size * 0.95, size * 0.12, size * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.beginPath();
            ctx.arc(x - size * 0.02, y - size * 0.98, size * 0.03, 0, Math.PI * 2);
            ctx.fill();
        } else if (w.itemId === 'decorative_plant') {
            // Flower crown — 3D petal flowers + leaves
            const flowerColors = ['#e91e63', '#ff9800', '#9c27b0', '#2196f3', '#4caf50'];
            const crownRadius = size * 0.5;
            // Vine base (with shading)
            ctx.strokeStyle = '#2a6a2a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y - size * 0.7, crownRadius, Math.PI + 0.3, -0.3);
            ctx.stroke();
            ctx.strokeStyle = '#5fc05f';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Leaves
            for (let l = 0; l < 6; l++) {
                const la = Math.PI + 0.5 + (l / 5) * (Math.PI - 1);
                const lx = x + Math.cos(la) * crownRadius;
                const ly = (y - size * 0.7) + Math.sin(la) * crownRadius;
                ctx.fillStyle = l % 2 ? '#3a8a3a' : '#5fc05f';
                ctx.beginPath();
                ctx.ellipse(lx + Math.cos(la + 0.3) * 4, ly + Math.sin(la + 0.3) * 4, size * 0.05, size * 0.03, la, 0, Math.PI * 2);
                ctx.fill();
            }
            // Flowers (5 layered petals each)
            for (let i = 0; i < 5; i++) {
                const angle = Math.PI + 0.4 + (i / 4) * (Math.PI - 0.8);
                const fx = x + Math.cos(angle) * crownRadius;
                const fy = (y - size * 0.7) + Math.sin(angle) * crownRadius;
                const petalR = size * 0.07;
                // 5 petals
                ctx.fillStyle = flowerColors[i];
                for (let p = 0; p < 5; p++) {
                    const pa = (p / 5) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(fx + Math.cos(pa) * petalR * 0.7, fy + Math.sin(pa) * petalR * 0.7, petalR, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Center
                ctx.fillStyle = '#ffd23a';
                ctx.beginPath();
                ctx.arc(fx, fy, size * 0.04, 0, Math.PI * 2);
                ctx.fill();
                // Tiny highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.arc(fx - size * 0.015, fy - size * 0.02, size * 0.015, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // === EYES SLOT — sunglasses with chrome frame + lens reflection ===
    if (wearables.eyes) {
        const isDior = wearables.eyes.itemId === 'dior_shades';
        const frameColor = isDior ? '#d4af37' : (wearables.eyes.color || '#1a1a1a');
        const glassSize = size * 0.22;
        const lx = x - size * 0.2, rx = x + size * 0.2, ey = y - size * 0.35;
        // Tinted lenses with subtle gradient
        const lensG1 = ctx.createRadialGradient(lx - glassSize * 0.3, ey - glassSize * 0.3, 0, lx, ey, glassSize);
        lensG1.addColorStop(0, 'rgba(80, 80, 100, 0.4)');
        lensG1.addColorStop(1, 'rgba(20, 20, 30, 0.85)');
        ctx.fillStyle = lensG1;
        ctx.beginPath();
        ctx.arc(lx, ey, glassSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rx, ey, glassSize, 0, Math.PI * 2);
        ctx.fill();
        // Lens reflections (bright crescent)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        [lx, rx].forEach(cx => {
            ctx.beginPath();
            ctx.arc(cx - glassSize * 0.3, ey - glassSize * 0.35, glassSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
        });
        // Frame with chrome gradient
        const frameG = ctx.createLinearGradient(0, ey - glassSize, 0, ey + glassSize);
        frameG.addColorStop(0, shiftColor(frameColor, 40));
        frameG.addColorStop(0.5, frameColor);
        frameG.addColorStop(1, shiftColor(frameColor, -30));
        ctx.strokeStyle = frameG;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(lx, ey, glassSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(rx, ey, glassSize, 0, Math.PI * 2);
        ctx.stroke();
        // Bridge
        ctx.beginPath();
        ctx.moveTo(lx + glassSize, ey);
        ctx.lineTo(rx - glassSize, ey);
        ctx.stroke();
        // Arms
        ctx.beginPath();
        ctx.moveTo(lx - glassSize, ey);
        ctx.lineTo(x - size * 0.5, ey + 5);
        ctx.moveTo(rx + glassSize, ey);
        ctx.lineTo(x + size * 0.5, ey + 5);
        ctx.stroke();
    }

    // === HELD SLOT — bouncy ball or designer shoes ===
    if (wearables.held) {
        if (wearables.held.itemId === 'cloud_kicks') {
            // On Cloud-inspired runner — carried beside the bunny
            const shoeX = x + size * 0.85, shoeY = y + size * 0.45;
            // Shoe sole (cloud pod style)
            const soleG = ctx.createLinearGradient(0, shoeY + 5, 0, shoeY + 12);
            soleG.addColorStop(0, '#f0f0f0');
            soleG.addColorStop(1, '#a0a0a0');
            ctx.fillStyle = soleG;
            // Cloud pods underneath
            for (let pod = 0; pod < 5; pod++) {
                ctx.beginPath();
                ctx.arc(shoeX - 10 + pod * 5, shoeY + 10, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
            // Upper shoe (white mesh)
            const upG = ctx.createLinearGradient(0, shoeY - 5, 0, shoeY + 6);
            upG.addColorStop(0, '#ffffff');
            upG.addColorStop(1, '#d8d8d8');
            ctx.fillStyle = upG;
            ctx.beginPath();
            ctx.ellipse(shoeX, shoeY + 3, 13, 7, 0, Math.PI, 0);
            ctx.lineTo(shoeX + 13, shoeY + 8);
            ctx.lineTo(shoeX - 13, shoeY + 8);
            ctx.closePath();
            ctx.fill();
            // Toe cap
            ctx.fillStyle = '#bcbcbc';
            ctx.beginPath();
            ctx.ellipse(shoeX + 8, shoeY + 5, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            // Laces
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 0.8;
            for (let lc = 0; lc < 3; lc++) {
                ctx.beginPath();
                ctx.moveTo(shoeX - 2 - lc * 3, shoeY);
                ctx.lineTo(shoeX + 3 - lc * 3, shoeY + 2);
                ctx.stroke();
            }
            // Brand mark (little swoosh/C logo)
            ctx.strokeStyle = '#2a6aa8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(shoeX - 2, shoeY + 3, 3, Math.PI * 0.2, Math.PI * 0.8);
            ctx.stroke();
            return;
        }
        const color = wearables.held.color || '#ff5722';
        const bounce = Math.abs(Math.sin(time * 3)) * size * 0.12;
        const bx = x + size * 0.95, by = y + size * 0.35 - bounce;
        const br = size * 0.2;
        // Ball shadow (stretches at peak)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        const shadowStretch = 1 - bounce / (size * 0.12) * 0.3;
        ctx.beginPath();
        ctx.ellipse(bx, y + size * 0.55, br * shadowStretch, br * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Sphere gradient — gives 3D feel
        const sphereG = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.4, 0, bx, by, br * 1.2);
        sphereG.addColorStop(0, shiftColor(color, 60));
        sphereG.addColorStop(0.4, shiftColor(color, 20));
        sphereG.addColorStop(1, shiftColor(color, -40));
        ctx.fillStyle = sphereG;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        // Colorful stripe (spirals around ball)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, br, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        // Specular highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(bx - br * 0.35, by - br * 0.4, br * 0.25, br * 0.12, -0.3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Derive mood keyword from baby stats (used by drawBunnyFace)
function deriveMood(baby) {
    if (!baby) return 'content';
    const happy = baby.happiness || 0;
    const hunger = baby.hunger || 0;
    const energy = baby.energy || 0;
    if (hunger < 30) return 'hungry';
    if (energy < 30) return 'tired';
    if (happy > 75) return 'happy';
    if (happy < 30) return 'sad';
    return 'content';
}

// Vibrant eye-color palette (Cromimi-style jewel tones)
const EYE_COLORS = [
    { light: '#7fcfff', dark: '#1a5fc7' },  // sky blue
    { light: '#5fe5b5', dark: '#0f8a6a' },  // emerald
    { light: '#d590ff', dark: '#6a2aaa' },  // amethyst
    { light: '#ff9ac0', dark: '#c72a6f' },  // rose pink
    { light: '#ffc070', dark: '#c0701a' },  // amber
    { light: '#7fe5e8', dark: '#0a8a8d' },  // teal
];
function pickEyeColor(seed) {
    if (typeof seed === 'string') {
        let h = 0;
        for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
        return EYE_COLORS[h % EYE_COLORS.length];
    }
    return EYE_COLORS[Math.abs(Math.floor(seed)) % EYE_COLORS.length];
}

// Cromimi-style shiny eye — big colorful iris with gradient + sparkles
function drawShinyEye(cx, cy, r, eyeColor) {
    eyeColor = eyeColor || EYE_COLORS[0];
    // Eye white (big base)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Iris with radial gradient — bright center to deep outer (jewel-like)
    const irisG = ctx.createRadialGradient(cx, cy + r * 0.1, r * 0.1, cx, cy + r * 0.1, r * 0.85);
    irisG.addColorStop(0, eyeColor.light);
    irisG.addColorStop(0.6, eyeColor.dark);
    irisG.addColorStop(1, eyeColor.dark);
    ctx.fillStyle = irisG;
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.1, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    // Pupil (black inner)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.1, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Big shine (upper-left) — the Cromimi signature
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Small secondary shine (lower-right)
    ctx.beginPath();
    ctx.arc(cx + r * 0.4, cy + r * 0.4, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // Tiny tertiary glint
    ctx.beginPath();
    ctx.arc(cx - r * 0.05, cy - r * 0.5, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Outline for definition
    ctx.strokeStyle = '#2a1a1a';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
}

function drawBunnyFace(x, y, size, sleeping = false, blinking = false, mood = 'content', eyeColor = null) {
    // VERY big Cromimi eyes — 0.30 of face size
    const eyeR = size * 0.30;
    const eyeOffsetX = size * 0.30;
    const eyeY = y + size * 0.04;

    // Eyes
    if (sleeping) {
        // Sleep eyes — soft closed curves
        ctx.strokeStyle = '#333';
        ctx.lineWidth = Math.max(2, size * 0.04);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x - eyeOffsetX, eyeY, eyeR * 0.9, Math.PI * 0.15, Math.PI * 0.85);
        ctx.arc(x + eyeOffsetX, eyeY, eyeR * 0.9, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else if (blinking) {
        // Blink: smooth closed curves (matching big eye width)
        ctx.strokeStyle = '#2a1a1a';
        ctx.lineWidth = Math.max(2, size * 0.04);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x - eyeOffsetX, eyeY, eyeR * 0.85, Math.PI * 0.15, Math.PI * 0.85);
        ctx.arc(x + eyeOffsetX, eyeY, eyeR * 0.85, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else if (mood === 'tired') {
        // Droopy: half eyes — bottom half of the big eye visible
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - size, eyeY, size * 2, eyeR * 1.2);
        ctx.clip();
        drawShinyEye(x - eyeOffsetX, eyeY, eyeR, eyeColor);
        drawShinyEye(x + eyeOffsetX, eyeY, eyeR, eyeColor);
        ctx.restore();
        // Heavy eyelid line
        ctx.strokeStyle = '#2a1a1a';
        ctx.lineWidth = Math.max(2, size * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - eyeOffsetX - eyeR, eyeY);
        ctx.lineTo(x - eyeOffsetX + eyeR, eyeY);
        ctx.moveTo(x + eyeOffsetX - eyeR, eyeY);
        ctx.lineTo(x + eyeOffsetX + eyeR, eyeY);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else if (mood === 'happy') {
        // Happy upward-crescent eyes (^_^) — bigger and cuter
        ctx.strokeStyle = '#2a1a1a';
        ctx.lineWidth = Math.max(2.5, size * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x - eyeOffsetX, eyeY + size * 0.08, eyeR * 0.9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.arc(x + eyeOffsetX, eyeY + size * 0.08, eyeR * 0.9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else {
        // Default — big shiny Cromimi-style eyes
        drawShinyEye(x - eyeOffsetX, eyeY, eyeR, eyeColor);
        drawShinyEye(x + eyeOffsetX, eyeY, eyeR, eyeColor);
    }

    // Blush cheeks — always visible (not just when happy), more prominent Cromimi-style
    if (!sleeping) {
        const blushAlpha = mood === 'happy' ? 0.55 : 0.3;
        ctx.fillStyle = `rgba(255, 130, 160, ${blushAlpha})`;
        ctx.beginPath();
        ctx.arc(x - size * 0.42, y + size * 0.28, size * 0.11, 0, Math.PI * 2);
        ctx.arc(x + size * 0.42, y + size * 0.28, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Nose — vivid pink heart-shape with highlight (Cromimi-style)
    const nx = x, ny = y + size * 0.32;
    const nw = size * 0.09, nh = size * 0.07;
    ctx.fillStyle = '#ff4a8f';
    ctx.beginPath();
    ctx.moveTo(nx, ny + nh * 0.5);
    ctx.bezierCurveTo(nx + nw, ny - nh, nx + nw * 1.2, ny + nh * 0.2, nx, ny + nh);
    ctx.bezierCurveTo(nx - nw * 1.2, ny + nh * 0.2, nx - nw, ny - nh, nx, ny + nh * 0.5);
    ctx.closePath();
    ctx.fill();
    // Nose shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(nx - nw * 0.3, ny, nw * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth — shape varies by mood
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    const my = y + size * 0.38;
    if (mood === 'hungry') {
        // Open "o" mouth
        ctx.fillStyle = '#7a2c2c';
        ctx.beginPath();
        ctx.ellipse(x, my + size * 0.04, size * 0.09, size * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (mood === 'sad') {
        // Frown (inverted curve)
        ctx.beginPath();
        ctx.moveTo(x - size * 0.15, my + size * 0.08);
        ctx.quadraticCurveTo(x, my - size * 0.04, x + size * 0.15, my + size * 0.08);
        ctx.stroke();
    } else if (mood === 'happy') {
        // Big smile
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2, my - size * 0.02);
        ctx.quadraticCurveTo(x, my + size * 0.18, x + size * 0.2, my - size * 0.02);
        ctx.stroke();
    } else {
        // Default gentle W-shaped bunny mouth
        ctx.beginPath();
        ctx.moveTo(x, my - size * 0.03);
        ctx.quadraticCurveTo(x - size * 0.1, my + size * 0.12, x - size * 0.15, my + size * 0.07);
        ctx.moveTo(x, my - size * 0.03);
        ctx.quadraticCurveTo(x + size * 0.1, my + size * 0.12, x + size * 0.15, my + size * 0.07);
        ctx.stroke();
    }
}

// ===== PARTICLES AND EFFECTS =====
// Legacy particle arrays for backwards compatibility (particles already declared above)

function updateParticles(deltaTime) {
    // Legacy particle system - redirect to new system
    updateParticleSystem(deltaTime);
    
    // Handle any remaining legacy particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update(deltaTime);
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
            returnParticleToPool(particle);
        }
    }
}

function drawParticles() {
    // Legacy function - redirect to new system
    drawActiveParticles();
    
    // Draw any remaining legacy particles
    particles.forEach(particle => particle.draw(ctx));
}

class Particle {
    constructor(x, y, type, color = '#ff69b4') {
        this.init(x, y, type, color);
    }
    
    init(x, y, type, color = '#ff69b4') {
        this.x = x;
        this.y = y;
        // Curved launch: angle-based velocity, not straight up
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = 2 + Math.random() * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.size = Math.random() * 8 + 6;
        this.type = type;
        this.color = color;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.spiralPhase = Math.random() * Math.PI * 2;
        this.age = 0;
    }

    reset() {
        this.life = 0;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.age = 0;
    }

    update(deltaTime) {
        this.age += deltaTime;
        // Hearts float up with gentle sinusoidal sway
        if (this.type === 'heart') {
            this.x += (this.vx + Math.sin(this.age * 0.005 + this.spiralPhase) * 0.8) * deltaTime * 0.1;
            this.y += this.vy * deltaTime * 0.1;
            this.vy += deltaTime * 0.002; // lighter gravity for hearts
        } else {
            this.x += this.vx * deltaTime * 0.1;
            this.y += this.vy * deltaTime * 0.1;
            this.vy += deltaTime * 0.005;
        }
        this.life -= deltaTime * 0.001;
        this.rotation += this.rotationSpeed * deltaTime * 0.01;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'heart') {
            drawHeartShape(ctx, this.size, this.color);
        } else if (this.type === 'sparkle') {
            drawSparkleShape(ctx, this.size, this.color);
        } else if (this.type === 'star') {
            drawStarShape(ctx, this.size, this.color);
        } else if (this.type === 'pickup') {
            drawSparkleShape(ctx, this.size * 0.9, this.color);
        } else if (this.type === 'drop') {
            // Puff of "dust"
            ctx.fillStyle = this.color;
            ctx.globalAlpha = alpha * 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'confetti') {
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.5);
        }

        ctx.restore();
    }
}

// ===== PARTICLE SHAPE DRAWERS =====
function drawHeartShape(ctx, size, color) {
    const s = size * 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(s, -s * 0.5, s * 1.5, s * 0.4, 0, s * 1.2);
    ctx.bezierCurveTo(-s * 1.5, s * 0.4, -s, -s * 0.5, 0, s * 0.3);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, s * 0.1, s * 0.2, s * 0.3, -0.4, 0, Math.PI * 2);
    ctx.fill();
}

function drawStarShape(ctx, size, color) {
    const outer = size * 0.6, inner = size * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawSparkleShape(ctx, size, color) {
    const s = size * 0.5;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.12);
    ctx.lineCap = 'round';
    // 4-point sparkle (starburst)
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(0, s);
    ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
    ctx.moveTo(-s * 0.6, -s * 0.6); ctx.lineTo(s * 0.6, s * 0.6);
    ctx.moveTo(-s * 0.6, s * 0.6); ctx.lineTo(s * 0.6, -s * 0.6);
    ctx.stroke();
    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'butt';
}

function createActionEffect(action, playerId) {
    const rect = canvas.getBoundingClientRect();
    const x = rect.width * (playerId === myPlayerId ? 0.3 : 0.7);
    const y = rect.height * 0.7;
    
    let type, color;
    switch (action) {
        case 'feed':
            type = 'sparkle';
            color = '#ff9800';
            break;
        case 'play':
            type = 'star';
            color = '#4caf50';
            break;
        case 'sleep':
            type = 'sparkle';
            color = '#3f51b5';
            break;
        case 'clean':
            type = 'sparkle';
            color = '#00bcd4';
            break;
        case 'pet':
            type = 'heart';
            color = '#ff6b6b';
            break;
        default:
            type = 'sparkle';
            color = '#ff69b4';
    }
    
    createParticleEffect(x, y, type, color, 5);
}

function createClickEffect(x, y) {
    createParticleEffect(x, y, 'sparkle', '#ff69b4', 3);
}

function createHeartEffect(x, y) {
    createParticleEffect(x, y, 'heart', '#ff6b6b', 4);
}

function createPickupEffect(x, y) {
    createParticleEffect(x, y, 'pickup', '#ffd700', 2);
    createParticleEffect(x, y, 'sparkle', '#ff69b4', 3);
}

function createDropEffect(x, y) {
    createParticleEffect(x, y, 'drop', '#87ceeb', 2);
}

function createSettleEffect(x, y) {
    createParticleEffect(x, y, 'sparkle', '#98fb98', 4);
}

// ===== UI UPDATES =====
function updateGameUI() {
    if (!gameState) return;
    
    updateConnectionInfo();
    updateDayNightCycle(gameState.dayNightCycle);
    updateCarrotCount();
    updateBabyStatus();
    updateGardenStatus();
    updateActionButtons();
}

function updateConnectionInfo() {
    // Display player names from game state (players is an object keyed by playerId)
    if (!gameState || !gameState.players) return;
    const el = document.getElementById('playerNames');
    if (!el) return;
    const playersList = typeof gameState.players === 'object' && !Array.isArray(gameState.players)
        ? Object.values(gameState.players)
        : gameState.players;
    const names = playersList
        .map(p => {
            const icon = p.type === 'black' ? '🐰' : '🐇';
            const status = p.connected ? '' : ' (offline)';
            return `${icon} ${p.name}${status}`;
        });
    el.textContent = names.join('  •  ');
}

function updateDayNightCycle(cycle) {
    if (!dayNightIndicator) return;
    
    if (cycle === 'night') {
        dayNightIndicator.classList.add('night');
        dayNightIcon.textContent = '🌙';
        dayNightText.textContent = 'Night';
    } else {
        dayNightIndicator.classList.remove('night');
        dayNightIcon.textContent = '☀️';
        dayNightText.textContent = 'Day';
    }
}

function updateCarrotCount() {
    if (carrotCount && gameState.garden) {
        carrotCount.textContent = gameState.garden.carrots || 0;
    }
}

function updateBabyStatus() {
    if (!gameState.babies || !selectedBabyId) return;
    
    const baby = gameState.babies.find(b => b.id === selectedBabyId);
    if (!baby) return;
    
    // Update baby name
    if (babyName) {
        babyName.textContent = baby.name || 'Baby Bunny';
    }
    
    // Update status bars
    updateStatusBar('hunger', baby.hunger || 0);
    updateStatusBar('happiness', baby.happiness || 0);
    updateStatusBar('energy', baby.energy || 0);
    updateStatusBar('cleanliness', baby.cleanliness || 0);
    updateStatusBar('love', baby.love || 0);
}

function updateStatusBar(type, value) {
    const bar = document.getElementById(`${type}Bar`);
    const valueEl = document.getElementById(`${type}Value`);
    const rounded = Math.round(value);

    if (bar) {
        bar.style.width = `${rounded}%`;
    }
    if (valueEl) {
        valueEl.textContent = `${rounded}%`;
    }
}

function updateGardenStatus() {
    if (!gameState.garden) return;
    
    if (gardenQuality) {
        gardenQuality.textContent = Math.round(gameState.garden.quality || 0);
    }
    
    if (harvestTimer) {
        const now = Date.now();
        const lastHarvest = gameState.garden.lastHarvest || 0;
        const cooldown = 45000; // 45 seconds
        const remaining = Math.max(0, cooldown - (now - lastHarvest));
        
        if (remaining > 0) {
            const seconds = Math.ceil(remaining / 1000);
            harvestTimer.textContent = `${seconds}s`;
            harvestTimer.style.color = '#ff9800';
        } else {
            harvestTimer.textContent = 'Ready!';
            harvestTimer.style.color = '#4caf50';
        }
    }
}

function updateActionButtons() {
    if (!gameState.babies || !selectedBabyId) return;
    
    const baby = gameState.babies.find(b => b.id === selectedBabyId);
    if (!baby) return;
    
    // Update button states based on baby status and game state
    const carrots = gameState.garden?.carrots || 0;
    
    if (feedBtn) {
        feedBtn.disabled = baby.stage === 'egg' || carrots <= 0 || (baby.hunger || 0) > 90;
    }
    
    if (playBtn) {
        playBtn.disabled = baby.stage === 'egg' || (baby.energy || 0) < 15 || baby.sleeping;
    }
    
    if (sleepBtn) {
        sleepBtn.disabled = baby.stage === 'egg';
        sleepBtn.textContent = baby.sleeping ? '😴 Wake' : '💤 Sleep';
    }
    
    if (cleanBtn) {
        cleanBtn.disabled = baby.stage === 'egg' || (baby.cleanliness || 0) > 85;
    }
    
    if (petBtn) {
        petBtn.disabled = false; // Can always pet/tap
        petBtn.textContent = baby.stage === 'egg' ? '👆 Tap' : '❤️ Pet';
    }
}

function updateBabySelection() {
    updateBabyStatus();
    updateActionButtons();
}

// ===== HELPER FUNCTIONS =====
function findBunnyAt(x, y) {
    if (!gameState || !gameState.babies) return null;

    // Hit radius scaled to the baby's visible size (which grew in recent updates)
    const hitRadius = {
        egg: 40,
        newborn: 45,
        toddler: 55,
        young: 65,
        grown: 75
    };

    // Check in reverse order so top bunnies are checked first
    for (let i = gameState.babies.length - 1; i >= 0; i--) {
        const baby = gameState.babies[i];
        const position = getBunnyPosition(baby.id);

        const distance = Math.sqrt((x - position.x) ** 2 + (y - position.y) ** 2);
        const r = hitRadius[baby.stage] || 50;

        if (distance < r) {
            return baby;
        }
    }

    return null;
}

function findParentBunnyAt(x, y) {
    // Check black bunny using tracked positions
    const blackX = parentBunnyPositions.parent_black.x;
    const blackY = parentBunnyPositions.parent_black.y;
    const blackDistance = Math.sqrt((x - blackX) ** 2 + (y - blackY) ** 2);

    if (blackDistance < 45) {
        return { type: 'black', id: 'parent_black', x: blackX, y: blackY };
    }

    // Check white bunny using tracked positions
    const whiteX = parentBunnyPositions.parent_white.x;
    const whiteY = parentBunnyPositions.parent_white.y;
    const whiteDistance = Math.sqrt((x - whiteX) ** 2 + (y - whiteY) ** 2);

    if (whiteDistance < 45) {
        return { type: 'white', id: 'parent_white', x: whiteX, y: whiteY };
    }

    return null;
}

function updateConnectionStatus(status, text) {
    if (!connectionStatus || !connectionText) return;
    
    connectionStatus.className = `status-dot ${status}`;
    connectionText.textContent = text;
}

function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    
    if (type === 'error') {
        messageEl.className = 'error-message';
    } else {
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            padding: 15px 25px;
            border-radius: 20px;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            z-index: 1000;
            animation: fadeIn 0.5s ease-in-out;
        `;
    }
    
    document.body.appendChild(messageEl);
    
    // Auto remove after delay
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.style.opacity = '0';
            messageEl.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 500);
        }
    }, type === 'error' ? 4000 : 2500);
}

function showFloatingEffect(x, y, emoji) {
    if (!canvas || !ctx) return;
    
    // Create floating effect element
    const effectEl = document.createElement('div');
    effectEl.textContent = emoji;
    effectEl.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        font-size: 1.5em;
        pointer-events: none;
        z-index: 100;
        animation: floatUp 2s ease-out forwards;
    `;
    
    document.body.appendChild(effectEl);
    
    // Remove after animation
    setTimeout(() => {
        if (effectEl.parentNode) {
            effectEl.parentNode.removeChild(effectEl);
        }
    }, 2000);
}

function showGrowthCelebration(data) {
    const celebrationEl = document.createElement('div');
    celebrationEl.className = 'growth-celebration';
    celebrationEl.innerHTML = `
        <div>🎉 ${data.babyName} grew up! 🎉</div>
        <div>Now a ${data.newStage} bunny!</div>
    `;
    
    document.body.appendChild(celebrationEl);
    
    setTimeout(() => {
        if (celebrationEl.parentNode) {
            celebrationEl.parentNode.removeChild(celebrationEl);
        }
    }, 3000);
}

function showHatchCelebration(data) {
    const celebrationEl = document.createElement('div');
    celebrationEl.className = 'growth-celebration';
    celebrationEl.innerHTML = `
        <div>🐣 ${data.babyName} hatched! 🐣</div>
        <div>A beautiful ${data.genetics.color} bunny!</div>
    `;
    
    document.body.appendChild(celebrationEl);
    
    setTimeout(() => {
        if (celebrationEl.parentNode) {
            celebrationEl.parentNode.removeChild(celebrationEl);
        }
    }, 3000);
}

function showCooperativeBonus(action) {
    const bonusEl = document.createElement('div');
    bonusEl.className = 'coop-bonus';
    bonusEl.innerHTML = `
        <div>✨ TEAMWORK BONUS! ✨</div>
        <div>Great cooperation!</div>
    `;
    
    document.body.appendChild(bonusEl);
    
    setTimeout(() => {
        if (bonusEl.parentNode) {
            bonusEl.parentNode.removeChild(bonusEl);
        }
    }, 4000);
}

function showAchievementNotification(data) {
    const achievementEl = document.createElement('div');
    achievementEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ffd700, #ffb300);
        color: #333;
        padding: 15px 20px;
        border-radius: 15px;
        font-weight: bold;
        text-align: center;
        box-shadow: 0 5px 20px rgba(255, 215, 0, 0.4);
        z-index: 200;
        animation: slideInRight 0.5s ease-out;
    `;
    achievementEl.innerHTML = `
        <div>🏆 Achievement Unlocked!</div>
        <div>${data.achievement.title}</div>
    `;
    
    document.body.appendChild(achievementEl);
    
    setTimeout(() => {
        if (achievementEl.parentNode) {
            achievementEl.style.opacity = '0';
            achievementEl.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (achievementEl.parentNode) {
                    achievementEl.parentNode.removeChild(achievementEl);
                }
            }, 500);
        }
    }, 5000);
}

// ===== ROOM CODE BANNER MANAGEMENT =====
function showRoomCodeBanner(code) {
    if (!roomCodeBanner || !roomCodeDisplay) {
        console.warn('Room code banner elements not found');
        return;
    }

    roomCodeDisplay.textContent = code;
    roomCodeBanner.classList.remove('hidden');

    // Also show a prominent overlay message so the user knows to share the code
    const shareOverlay = document.createElement('div');
    shareOverlay.id = 'shareCodeOverlay';
    shareOverlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 500;
        animation: fadeIn 0.3s ease;
    `;
    shareOverlay.innerHTML = `
        <div style="background: white; border-radius: 25px; padding: 30px; text-align: center; max-width: 350px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
            <div style="font-size: 2em; margin-bottom: 10px;">🏠</div>
            <div style="font-size: 1.3em; font-weight: bold; color: #ff69b4; margin-bottom: 15px;">Share this code with your partner!</div>
            <div style="font-size: 2.5em; font-weight: 900; letter-spacing: 0.2em; font-family: monospace; color: #333; background: #f0f0f0; padding: 15px 25px; border-radius: 15px; margin-bottom: 15px;">${code}</div>
            <div style="font-size: 0.9em; color: #999; margin-bottom: 20px;">Your partner enters this code to join your family</div>
            <button id="shareCodeDismiss" style="background: linear-gradient(135deg, #ff69b4, #ffb3d9); color: white; border: none; padding: 12px 30px; border-radius: 20px; font-size: 1.1em; cursor: pointer; font-weight: bold;">Got it!</button>
        </div>
    `;
    document.body.appendChild(shareOverlay);
    shareOverlay.querySelector('#shareCodeDismiss').addEventListener('click', () => {
        shareOverlay.remove();
    });
    // Also dismiss on background click
    shareOverlay.addEventListener('click', (e) => {
        if (e.target === shareOverlay) shareOverlay.remove();
    });

    console.log(`🏠 Showing room code banner: ${code}`);
}

function hideRoomCodeBanner() {
    if (!roomCodeBanner) {
        console.warn('Room code banner element not found');
        return;
    }
    
    // Add a nice fadeout animation
    roomCodeBanner.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
    roomCodeBanner.style.opacity = '0';
    roomCodeBanner.style.transform = 'translateY(-100%)';
    
    setTimeout(() => {
        roomCodeBanner.classList.add('hidden');
        // Reset for future use
        roomCodeBanner.style.opacity = '';
        roomCodeBanner.style.transform = '';
        roomCodeBanner.style.transition = '';
    }, 800);
    
    console.log('🏠 Hiding room code banner - partner connected');
}

function copyRoomCodeToClipboard() {
    if (!roomCode) {
        showMessage('No room code to copy!', 'error');
        return;
    }
    
    // Try to use the modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(roomCode).then(() => {
            showMessage(`Room code ${roomCode} copied to clipboard! 📋`, 'success');
            
            // Visual feedback on copy button
            if (roomCodeCopy) {
                const originalText = roomCodeCopy.textContent;
                roomCodeCopy.textContent = '✓';
                roomCodeCopy.style.background = 'rgba(76, 175, 80, 0.8)';
                setTimeout(() => {
                    roomCodeCopy.textContent = originalText;
                    roomCodeCopy.style.background = '';
                }, 1000);
            }
        }).catch(err => {
            console.error('Failed to copy room code:', err);
            fallbackCopyRoomCode();
        });
    } else {
        fallbackCopyRoomCode();
    }
}

function fallbackCopyRoomCode() {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = roomCode;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showMessage(`Room code ${roomCode} copied to clipboard! 📋`, 'success');
        } else {
            showMessage(`Copy failed. Room code is: ${roomCode}`, 'info');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showMessage(`Copy failed. Room code is: ${roomCode}`, 'info');
    }
    
    document.body.removeChild(textArea);
}

// ===== ANIMATION SYSTEM =====
function updateAnimations(deltaTime) {
    animations.forEach((animation, id) => {
        const result = animation(deltaTime);
        if (result === false) { // Animation completed
            animations.delete(id);
        }
    });
}

function addAnimation(id, animationFunction) {
    animations.set(id, animationFunction);
}

// ===== UI HELPERS =====
function drawUI() {
    // Any additional UI elements that need to be drawn on canvas
    // Most UI is handled by HTML/CSS
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', function() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (socket && socket.connected) {
        socket.disconnect();
    }
});

// ===== UTILITY FUNCTIONS =====
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// ===== NEW FEATURES IMPLEMENTATION =====

// Egg notification system
function showEggNotification(message, type, data) {
    const notification = {
        id: Date.now(),
        message: message,
        type: type,
        timestamp: Date.now(),
        duration: 5000,
        data: data
    };
    
    notificationQueue.push(notification);
    displayNotification(notification);
    
    // Add egg bouncing animation
    if (data && data.position) {
        animateEggAppearance(data.position, type);
    }
}

function displayNotification(notification) {
    const notificationEl = document.createElement('div');
    notificationEl.className = 'egg-notification';
    notificationEl.innerHTML = `
        <div class="notification-content ${notification.type}">
            <div class="notification-text">${notification.message}</div>
            <div class="notification-sparkles"></div>
        </div>
    `;
    
    // Add to DOM
    document.body.appendChild(notificationEl);
    
    // Trigger animation
    setTimeout(() => {
        notificationEl.classList.add('show');
    }, 100);
    
    // Remove after duration
    setTimeout(() => {
        notificationEl.classList.add('hide');
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.parentNode.removeChild(notificationEl);
            }
        }, 500);
    }, notification.duration);
}

function animateEggAppearance(position, type) {
    const animation = {
        startTime: Date.now(),
        duration: 2000,
        position: position,
        type: type
    };
    
    addAnimation('egg_bounce_' + Date.now(), (deltaTime) => {
        const elapsed = Date.now() - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        
        if (progress >= 1) return false; // Animation complete
        
        // Draw bouncing egg animation on canvas
        drawBouncingEgg(animation.position, progress, type);
        return true;
    });
}

function drawBouncingEgg(position, progress, type) {
    if (!ctx) return;
    
    ctx.save();
    
    // Calculate bounce height
    const bounceHeight = Math.sin(progress * Math.PI * 3) * 20 * (1 - progress);
    const x = position.x || canvas.width / 2;
    const y = (position.y || canvas.height / 2) - bounceHeight;
    
    // Draw egg with special effects
    ctx.translate(x, y);
    
    if (type === 'golden_egg') {
        // Golden sparkles
        ctx.fillStyle = '#ffd700';
        for (let i = 0; i < 8; i++) {
            const angle = (progress * Math.PI * 2) + (i * Math.PI / 4);
            const sparkleX = Math.cos(angle) * 30;
            const sparkleY = Math.sin(angle) * 30;
            ctx.fillRect(sparkleX - 2, sparkleY - 2, 4, 4);
        }
    } else if (type === 'rainbow_egg') {
        // Rainbow effect
        const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 40);
        gradient.addColorStop(0, `hsl(${(progress * 360) % 360}, 70%, 60%)`);
        gradient.addColorStop(1, `hsl(${((progress * 360) + 120) % 360}, 70%, 60%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(-40, -40, 80, 80);
    }
    
    // Draw the egg
    ctx.fillStyle = type === 'golden_egg' ? '#ffd700' : 
                   type === 'rainbow_egg' ? '#ff69b4' : '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

// Baby growth celebration
function showGrowthCelebration_legacy(baby) {
    // Replaced by the version at line ~4569 which handles both data formats
    const celebrationEl = document.createElement('div');
    celebrationEl.className = 'growth-celebration';
    celebrationEl.innerHTML = `
        <div class="celebration-content">
            <h2>🎉 ${baby.babyName || baby.name || 'Baby'} Grew! 🎉</h2>
            <p>Now a ${baby.newStage || baby.stage}!</p>
            <div class="confetti-container"></div>
        </div>
    `;
    
    document.body.appendChild(celebrationEl);
    
    setTimeout(() => {
        celebrationEl.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        celebrationEl.classList.add('hide');
        setTimeout(() => {
            if (celebrationEl.parentNode) {
                celebrationEl.parentNode.removeChild(celebrationEl);
            }
        }, 500);
    }, 4000);
}

function createConfettiParticle() {
    const colors = ['#ff69b4', '#ffd700', '#9370db', '#ff6b6b', '#4ecdc4'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create a confetti particle using the existing particle system
    const particle = getParticleFromPool();
    particle.init(canvas.width / 2, canvas.height / 2, 'confetti', color);
    
    // Override some properties for confetti behavior
    particle.vx = (Math.random() - 0.5) * 10;
    particle.vy = -Math.random() * 8 - 2;
    particle.rotation = 0;
    particle.rotationSpeed = (Math.random() - 0.5) * 0.3;
    particle.life = 1;
    particle.decay = 0.02;
    
    activeParticles.push(particle);
}

// Shop UI system
// Remember previous scene so we can restore it when shop closes
let _sceneBeforeShop = null;
function toggleShop() {
    shopState.isOpen = !shopState.isOpen;

    if (shopState.isOpen) {
        _sceneBeforeShop = currentScene;
        // Clear basket each time shop opens
        shopBasket = [];
        // Full canvas luxury shop scene
        setScene('shop', { lock: true, lockMs: 60000 });
    } else {
        // Restore previous scene
        setScene(_sceneBeforeShop || 'default', { lock: true, lockMs: 500 });
        _sceneBeforeShop = null;
    }
}

function showShopUI() {
    // Shop is now rendered as a full canvas scene; no HTML overlay needed.
    // Kept as a no-op for backward compatibility.
    return;
    // eslint-disable-next-line no-unreachable
    const shopEl = document.createElement('div');
    shopEl.id = 'shop-overlay';
    shopEl.className = 'shop-overlay';
    
    let itemsHtml = shopState.items.map(item => `
        <div class="shop-item">
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-price">${item.price}🥕</div>
            <button class="buy-button" data-item-id="${item.id}">Buy</button>
        </div>
    `).join('');
    
    shopEl.innerHTML = `
        <div class="shop-modal">
            <div class="shop-header">
                <h2>🛒 Bunny Shop</h2>
                <button class="close-shop">×</button>
            </div>
            <div class="shop-content">
                <div class="carrot-count-shop">Your Carrots: <span id="shop-carrot-count">0</span>🥕</div>
                <div class="shop-items">${itemsHtml}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(shopEl);
    
    // Add proper event listeners for buy buttons
    const buyButtons = shopEl.querySelectorAll('.buy-button');
    buyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const itemId = this.getAttribute('data-item-id');
            buyItem(itemId);
        });
    });
    
    // Add proper event listener for close button
    const closeButton = shopEl.querySelector('.close-shop');
    closeButton.addEventListener('click', function() {
        toggleShop();
    });
    
    // Update carrot count display
    updateShopCarrotCount();
    
    setTimeout(() => {
        shopEl.classList.add('show');
    }, 100);
}

function hideShopUI() {
    const shopEl = document.getElementById('shop-overlay');
    if (shopEl) {
        shopEl.classList.add('hide');
        setTimeout(() => {
            if (shopEl.parentNode) {
                shopEl.parentNode.removeChild(shopEl);
            }
        }, 300);
    }
}

function buyItem(itemId) {
    if (!socket || !socket.connected) {
        showMessage('Not connected to server', 'error');
        return;
    }
    
    socket.emit('buy_item', { itemId: itemId });
}

// ===== MINI GAMES MENU =====
let miniGameMenuOpen = false;

function toggleMiniGameMenu() {
    miniGameMenuOpen = !miniGameMenuOpen;
    if (miniGameMenuOpen) {
        showMiniGameMenu();
    } else {
        hideMiniGameMenu();
    }
}

function showMiniGameMenu() {
    hideMiniGameMenu();

    const menuEl = document.createElement('div');
    menuEl.id = 'minigame-overlay';
    menuEl.className = 'shop-overlay';

    const games = [
        { id: 'football', name: '⚽ Football Match', desc: 'Score 10 goals to win! Use arrow keys to move.', available: true },
        { id: 'racing', name: '🏁 Bunny Race', desc: 'Tap/click to jump over obstacles!', available: true },
        { id: 'memory', name: '🧠 Memory Match', desc: 'Match pairs of bunny-themed cards!', available: true },
        { id: 'cooking', name: '🍳 Cooking Challenge', desc: 'Catch ingredients, avoid trash! 30s.', available: true },
        { id: 'maze', name: '🌀 Garden Maze', desc: 'Navigate the maze to find the carrot!', available: true },
    ];

    const gamesHtml = games.map(g => `
        <div class="shop-item" style="opacity:${g.available ? 1 : 0.5}">
            <div class="item-icon" style="font-size:1.8em;">${g.name.split(' ')[0]}</div>
            <div class="item-name">${g.name}</div>
            <div class="item-price" style="font-size:0.8em;color:#777;">${g.desc}</div>
            <button class="buy-button minigame-start-btn" data-game-id="${g.id}"
                style="background:${g.available ? 'linear-gradient(135deg, #ff6f00, #e65100)' : '#999'}"
                ${g.available ? '' : 'disabled'}>
                ${g.available ? 'Play!' : 'Soon'}
            </button>
        </div>
    `).join('');

    menuEl.innerHTML = `
        <div class="shop-modal">
            <div class="shop-header">
                <h2>🎮 Mini Games</h2>
                <button class="close-shop">×</button>
            </div>
            <div style="text-align:center;padding:8px;">
                <button id="minigame-scores-btn" style="padding:8px 20px;border:none;border-radius:8px;background:linear-gradient(135deg,#ffd700,#ffb300);color:#333;font-weight:bold;font-size:1em;cursor:pointer;">🏆 Scores</button>
            </div>
            <div class="shop-content">
                <div class="shop-items">${gamesHtml}</div>
            </div>
        </div>
    `;

    document.body.appendChild(menuEl);

    menuEl.querySelectorAll('.minigame-start-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const gameId = this.getAttribute('data-game-id');
            startMiniGame(gameId);
            hideMiniGameMenu();
            miniGameMenuOpen = false;
        });
    });

    menuEl.querySelector('#minigame-scores-btn').addEventListener('click', () => {
        showMiniGameScoreboard('memory');
    });

    menuEl.querySelector('.close-shop').addEventListener('click', () => {
        toggleMiniGameMenu();
    });

    setTimeout(() => menuEl.classList.add('show'), 50);
}

function hideMiniGameMenu() {
    const el = document.getElementById('minigame-overlay');
    if (el) {
        el.classList.add('hide');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
}

function startMiniGame(gameId) {
    switch (gameId) {
        case 'football':
            setScene('playground');
            showMessage('⚽ Football Match started! Use arrow keys to move your bunny and score goals!', 'success');
            break;
        case 'memory':
            initMemoryGame();
            break;
        case 'racing':
            initRacingGame();
            break;
        case 'cooking':
            initCookingGame();
            break;
        case 'maze':
            initMazeGame();
            break;
        default:
            showMessage('This mini-game is coming soon!', 'info');
    }
}

// ===== MEMORY MATCH GAME =====
function initMemoryGame() {
    const emojis = ['🐰','🥕','🌸','🎀','🧣','🏀','🎩','🕶️'];
    let cards = [];
    emojis.forEach((e, i) => {
        cards.push({ id: i * 2, emoji: e, flipped: false, matched: false });
        cards.push({ id: i * 2 + 1, emoji: e, flipped: false, matched: false });
    });
    // Shuffle
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    miniGameState.activeGame = 'memory';
    miniGameState.data = {
        cards: cards,
        flippedIndices: [],
        moves: 0,
        matchedPairs: 0,
        totalPairs: 8,
        lockBoard: false,
        startTime: Date.now(),
        gameOver: false,
        resultShown: false
    };
    showMessage('🧠 Memory Match! Click cards to find matching pairs.', 'success');
}

function handleMemoryClick(x, y) {
    const d = miniGameState.data;
    if (!d || d.lockBoard || d.gameOver) return;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;

    // Check quit button (top-right)
    if (x >= w - 50 && x <= w - 10 && y >= 10 && y <= 45) {
        quitMiniGame();
        return;
    }

    // Card grid layout
    const cols = 4, rows = 4;
    const cardW = Math.min(80, (w - 100) / cols);
    const cardH = cardW * 1.2;
    const gap = 10;
    const gridW = cols * (cardW + gap) - gap;
    const gridH = rows * (cardH + gap) - gap;
    const startX = (w - gridW) / 2;
    const startY = (h - gridH) / 2 + 20;

    for (let i = 0; i < d.cards.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = startX + col * (cardW + gap);
        const cy = startY + row * (cardH + gap);
        if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH) {
            if (d.cards[i].flipped || d.cards[i].matched) return;
            if (d.flippedIndices.length >= 2) return;

            d.cards[i].flipped = true;
            d.flippedIndices.push(i);
            d.moves++;

            if (d.flippedIndices.length === 2) {
                d.lockBoard = true;
                const [a, b] = d.flippedIndices;
                if (d.cards[a].emoji === d.cards[b].emoji) {
                    d.cards[a].matched = true;
                    d.cards[b].matched = true;
                    d.matchedPairs++;
                    d.flippedIndices = [];
                    d.lockBoard = false;
                    if (d.matchedPairs >= d.totalPairs) {
                        d.gameOver = true;
                        const elapsed = Math.floor((Date.now() - d.startTime) / 1000);
                        setTimeout(() => {
                            addMiniGameScore('memory', d.moves, 'Bunny');
                            showMiniGameScoreboard('memory');
                            quitMiniGame();
                        }, 800);
                    }
                } else {
                    setTimeout(() => {
                        d.cards[a].flipped = false;
                        d.cards[b].flipped = false;
                        d.flippedIndices = [];
                        d.lockBoard = false;
                    }, 800);
                }
            }
            return;
        }
    }
}

function drawMemoryGame() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const d = miniGameState.data;

    // Gradient overlay background (deep purple → black)
    const bgG = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
    bgG.addColorStop(0, 'rgba(60, 20, 90, 0.92)');
    bgG.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, w, h);

    // Sparkle stars in background
    const memTime = Date.now() * 0.001;
    for (let s = 0; s < 30; s++) {
        const sx = (s * 83) % w;
        const sy = (s * 47) % h;
        const alpha = 0.3 + 0.4 * Math.abs(Math.sin(memTime * (0.5 + (s % 5) * 0.2) + s));
        ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    // Title with glow
    ctx.shadowColor = 'rgba(255, 200, 255, 0.8)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🧠 Memory Match', w / 2, 35);
    ctx.shadowBlur = 0;

    // Stats
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffd700';
    const elapsed = Math.floor((Date.now() - d.startTime) / 1000);
    ctx.fillText(`Moves: ${d.moves}  |  Time: ${elapsed}s  |  Pairs: ${d.matchedPairs}/${d.totalPairs}`, w / 2, 58);

    // Quit button
    ctx.fillStyle = 'rgba(255,60,60,0.85)';
    ctx.fillRect(w - 50, 10, 40, 35);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X', w - 30, 34);

    // Card grid
    const cols = 4, rows = 4;
    const cardW = Math.min(80, (w - 100) / cols);
    const cardH = cardW * 1.2;
    const gap = 10;
    const gridW = cols * (cardW + gap) - gap;
    const gridH = rows * (cardH + gap) - gap;
    const startX = (w - gridW) / 2;
    const startY = (h - gridH) / 2 + 20;

    for (let i = 0; i < d.cards.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = startX + col * (cardW + gap);
        const cy = startY + row * (cardH + gap);
        const card = d.cards[i];

        ctx.save();
        // Drop shadow for 3D feel
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        // Gradient fill
        const cardG = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
        if (card.matched) {
            cardG.addColorStop(0, 'rgba(140, 230, 140, 0.9)');
            cardG.addColorStop(1, 'rgba(50, 140, 50, 0.9)');
        } else if (card.flipped) {
            cardG.addColorStop(0, 'rgba(255, 255, 255, 1)');
            cardG.addColorStop(1, 'rgba(220, 220, 230, 1)');
        } else {
            cardG.addColorStop(0, 'rgba(200, 90, 230, 0.95)');
            cardG.addColorStop(1, 'rgba(100, 30, 150, 0.95)');
        }
        ctx.fillStyle = cardG;
        // Rounded rect
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + cardW - r, cy);
        ctx.quadraticCurveTo(cx + cardW, cy, cx + cardW, cy + r);
        ctx.lineTo(cx + cardW, cy + cardH - r);
        ctx.quadraticCurveTo(cx + cardW, cy + cardH, cx + cardW - r, cy + cardH);
        ctx.lineTo(cx + r, cy + cardH);
        ctx.quadraticCurveTo(cx, cy + cardH, cx, cy + cardH - r);
        ctx.lineTo(cx, cy + r);
        ctx.quadraticCurveTo(cx, cy, cx + r, cy);
        ctx.closePath();
        ctx.fill();
        // Reset shadow for detail elements
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Card edge highlight (glossy top)
        if (!card.matched) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.fillRect(cx + r, cy + 2, cardW - r * 2, 4);
        }
        // Card outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + r, cy);
        ctx.lineTo(cx + cardW - r, cy);
        ctx.quadraticCurveTo(cx + cardW, cy, cx + cardW, cy + r);
        ctx.lineTo(cx + cardW, cy + cardH - r);
        ctx.quadraticCurveTo(cx + cardW, cy + cardH, cx + cardW - r, cy + cardH);
        ctx.lineTo(cx + r, cy + cardH);
        ctx.quadraticCurveTo(cx, cy + cardH, cx, cy + cardH - r);
        ctx.lineTo(cx, cy + r);
        ctx.quadraticCurveTo(cx, cy, cx + r, cy);
        ctx.closePath();
        ctx.stroke();

        if (card.flipped || card.matched) {
            ctx.font = `${Math.floor(cardW * 0.5)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(card.emoji, cx + cardW / 2, cy + cardH / 2 + cardW * 0.15);
        } else {
            // Decorative back pattern
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            const cx2 = cx + cardW / 2, cy2 = cy + cardH / 2;
            ctx.beginPath();
            ctx.arc(cx2, cy2, cardW * 0.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx2, cy2, cardW * 0.12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = `${Math.floor(cardW * 0.4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText('🐰', cx + cardW / 2, cy + cardH / 2 + cardW * 0.12);
        }
        ctx.restore();
    }
}

// ===== BUNNY RACE GAME =====
function initRacingGame() {
    miniGameState.activeGame = 'racing';
    miniGameState.data = {
        bunnyX: 80,
        bunnyY: 0, // set in update based on ground
        velocityY: 0,
        isJumping: false,
        obstacles: [],
        obstacleTimer: 0,
        distance: 0,
        speed: 4,
        gameOver: false,
        groundY: 0,
        startTime: Date.now(),
        gravity: 0.6,
        jumpStrength: -12
    };
    showMessage('🏁 Bunny Race! Click or press Space to jump!', 'success');
}

function updateRacingGame(deltaTime) {
    const d = miniGameState.data;
    if (!d || d.gameOver || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    d.groundY = h * 0.75;

    // Initialize bunny Y
    if (d.bunnyY === 0) d.bunnyY = d.groundY - 30;

    // Speed increases over time
    d.speed = 4 + d.distance * 0.002;

    // Jump input
    if ((keysPressed[' '] || keysPressed['ArrowUp']) && !d.isJumping) {
        d.velocityY = d.jumpStrength;
        d.isJumping = true;
    }

    // Apply gravity
    d.velocityY += d.gravity;
    d.bunnyY += d.velocityY;

    // Ground collision
    if (d.bunnyY >= d.groundY - 30) {
        d.bunnyY = d.groundY - 30;
        d.velocityY = 0;
        d.isJumping = false;
    }

    // Update distance
    d.distance += d.speed * 0.1;

    // Spawn obstacles
    d.obstacleTimer += deltaTime || 33;
    const spawnInterval = Math.max(600, 1500 - d.distance * 2);
    if (d.obstacleTimer > spawnInterval) {
        d.obstacleTimer = 0;
        const obstacleTypes = ['🥕', '🪨', '🌵', '🍄'];
        const obsH = 25 + Math.random() * 15;
        d.obstacles.push({
            x: w + 20,
            y: d.groundY - obsH,
            w: 30,
            h: obsH,
            emoji: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)]
        });
    }

    // Move obstacles
    for (let i = d.obstacles.length - 1; i >= 0; i--) {
        d.obstacles[i].x -= d.speed;
        if (d.obstacles[i].x < -40) {
            d.obstacles.splice(i, 1);
            continue;
        }
        // Collision check
        const obs = d.obstacles[i];
        const bunnyLeft = d.bunnyX - 15;
        const bunnyRight = d.bunnyX + 15;
        const bunnyTop = d.bunnyY - 15;
        const bunnyBottom = d.bunnyY + 15;
        if (bunnyRight > obs.x && bunnyLeft < obs.x + obs.w &&
            bunnyBottom > obs.y && bunnyTop < obs.y + obs.h) {
            d.gameOver = true;
            const finalScore = Math.floor(d.distance);
            setTimeout(() => {
                addMiniGameScore('racing', finalScore, 'Bunny');
                showMiniGameScoreboard('racing');
                quitMiniGame();
            }, 1000);
        }
    }
}

function handleRacingClick(x, y) {
    const d = miniGameState.data;
    if (!d || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Quit button
    if (x >= rect.width - 50 && x <= rect.width - 10 && y >= 10 && y <= 45) {
        quitMiniGame();
        return;
    }
    // Jump on click
    if (!d.gameOver && !d.isJumping) {
        d.velocityY = d.jumpStrength;
        d.isJumping = true;
    }
}

function drawRacingGame() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const d = miniGameState.data;

    // Sky with gradient + distant mountains
    const racingSky = ctx.createLinearGradient(0, 0, 0, d.groundY);
    racingSky.addColorStop(0, '#5aa5d8');
    racingSky.addColorStop(0.5, '#95c8e0');
    racingSky.addColorStop(1, '#d4e8d4');
    ctx.fillStyle = racingSky;
    ctx.fillRect(0, 0, w, d.groundY);

    // Distant mountain parallax
    _drawHillLayer(ctx, w, d.groundY - 30, 30, '#8aa0b0', '#6a8090', 0.02, 1.2, 25);

    // Ground gradient
    const groundG = ctx.createLinearGradient(0, d.groundY, 0, h);
    groundG.addColorStop(0, '#7ec07e');
    groundG.addColorStop(1, '#3a8a3a');
    ctx.fillStyle = groundG;
    ctx.fillRect(0, d.groundY, w, h - d.groundY);

    // Scrolling grass tufts for speed sense
    const offset = (d.distance * 10) % 40;
    ctx.strokeStyle = '#5ba05b';
    ctx.lineWidth = 1.5;
    for (let gx = -offset; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, d.groundY + 2);
        ctx.lineTo(gx + 2, d.groundY - 4);
        ctx.lineTo(gx + 4, d.groundY + 2);
        ctx.stroke();
    }
    // Speed lines (ground)
    ctx.strokeStyle = 'rgba(60, 110, 60, 0.5)';
    ctx.lineWidth = 2;
    for (let sl = 0; sl < 5; sl++) {
        const slX = (w - (offset * (1 + sl * 0.3)) * 3) % w;
        ctx.beginPath();
        ctx.moveTo(slX, d.groundY + 10 + sl * 10);
        ctx.lineTo(slX - 20, d.groundY + 10 + sl * 10);
        ctx.stroke();
    }

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const cloudOff = (d.distance * 2) % w;
    for (let ci = 0; ci < 3; ci++) {
        const cx = ((ci * w / 3) - cloudOff + w) % w;
        ctx.beginPath();
        ctx.arc(cx, 60 + ci * 20, 30, 0, Math.PI * 2);
        ctx.arc(cx + 25, 55 + ci * 20, 25, 0, Math.PI * 2);
        ctx.arc(cx - 20, 60 + ci * 20, 22, 0, Math.PI * 2);
        ctx.fill();
    }

    // Obstacles
    d.obstacles.forEach(obs => {
        ctx.font = `${Math.floor(obs.h)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(obs.emoji, obs.x + obs.w / 2, obs.y + obs.h);
    });

    // Bunny
    const bounce = d.isJumping ? 0 : Math.sin(Date.now() * 0.01) * 2;
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🐰', d.bunnyX, d.bunnyY + bounce);

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`🏁 Bunny Race  |  Distance: ${Math.floor(d.distance)}`, w / 2, 30);

    // Quit button
    ctx.fillStyle = 'rgba(255,60,60,0.85)';
    ctx.fillRect(w - 50, 10, 40, 35);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X', w - 30, 34);

    if (d.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ff5252';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', w / 2, h / 2 - 20);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Distance: ${Math.floor(d.distance)}`, w / 2, h / 2 + 20);
    }
}

// ===== COOKING CHALLENGE GAME =====
function initCookingGame() {
    miniGameState.activeGame = 'cooking';
    miniGameState.data = {
        potX: 0, // set in update
        potW: 60,
        items: [],
        spawnTimer: 0,
        score: 0,
        lives: 3,
        timeLimit: 30000,
        startTime: Date.now(),
        gameOver: false,
        groundY: 0
    };
    showMessage('🍳 Cooking Challenge! Arrow keys to move the pot. Catch ingredients, avoid trash!', 'success');
}

function updateCookingGame(deltaTime) {
    const d = miniGameState.data;
    if (!d || d.gameOver || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    d.groundY = h - 60;

    if (d.potX === 0) d.potX = w / 2;

    // Timer check
    const elapsed = Date.now() - d.startTime;
    if (elapsed >= d.timeLimit) {
        d.gameOver = true;
        const finalScore = d.score;
        setTimeout(() => {
            addMiniGameScore('cooking', finalScore, 'Bunny');
            showMiniGameScoreboard('cooking');
            quitMiniGame();
        }, 1000);
        return;
    }

    // Move pot
    const potSpeed = 6;
    if (keysPressed['ArrowLeft'] || keysPressed['a'] || keysPressed['A']) d.potX -= potSpeed;
    if (keysPressed['ArrowRight'] || keysPressed['d'] || keysPressed['D']) d.potX += potSpeed;
    d.potX = Math.max(d.potW / 2, Math.min(w - d.potW / 2, d.potX));

    // Spawn items
    d.spawnTimer += deltaTime || 33;
    if (d.spawnTimer > 500) {
        d.spawnTimer = 0;
        const goodItems = ['🥕','🥬','🍅','🧅','🍎','🧀'];
        const badItems = ['🗑️','💀'];
        const isGood = Math.random() > 0.25;
        const emoji = isGood
            ? goodItems[Math.floor(Math.random() * goodItems.length)]
            : badItems[Math.floor(Math.random() * badItems.length)];
        d.items.push({
            x: 30 + Math.random() * (w - 60),
            y: -20,
            emoji: emoji,
            good: isGood,
            speed: 2 + Math.random() * 2 + elapsed / 15000
        });
    }

    // Update items
    for (let i = d.items.length - 1; i >= 0; i--) {
        d.items[i].y += d.items[i].speed;

        // Catch check
        if (d.items[i].y >= d.groundY - 10 &&
            Math.abs(d.items[i].x - d.potX) < d.potW / 2 + 15) {
            if (d.items[i].good) {
                d.score += 10;
            } else {
                d.lives--;
                if (d.lives <= 0) {
                    d.gameOver = true;
                    const finalScore = d.score;
                    setTimeout(() => {
                        addMiniGameScore('cooking', finalScore, 'Bunny');
                        showMiniGameScoreboard('cooking');
                        quitMiniGame();
                    }, 1000);
                    return;
                }
            }
            d.items.splice(i, 1);
            continue;
        }

        // Off screen
        if (d.items[i].y > h + 20) {
            d.items.splice(i, 1);
        }
    }
}

function handleCookingClick(x, y) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (x >= rect.width - 50 && x <= rect.width - 10 && y >= 10 && y <= 45) {
        quitMiniGame();
    }
}

function drawCookingGame() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const d = miniGameState.data;

    // Background
    ctx.fillStyle = '#FFF8E1';
    ctx.fillRect(0, 0, w, h);

    // Kitchen counter
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(0, d.groundY, w, h - d.groundY);
    ctx.fillStyle = '#A1887F';
    ctx.fillRect(0, d.groundY, w, 6);

    // Falling items
    d.items.forEach(item => {
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.emoji, item.x, item.y);
    });

    // Pot
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🍲', d.potX, d.groundY + 5);

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, 55);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    const timeLeft = Math.max(0, Math.ceil((d.timeLimit - (Date.now() - d.startTime)) / 1000));
    ctx.fillText(`🍳 Cooking  |  Score: ${d.score}  |  Lives: ${'❤️'.repeat(Math.max(0, d.lives))}  |  Time: ${timeLeft}s`, w / 2, 28);

    // Quit button
    ctx.fillStyle = 'rgba(255,60,60,0.85)';
    ctx.fillRect(w - 50, 10, 40, 35);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X', w - 30, 34);

    if (d.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(d.lives <= 0 ? 'Game Over!' : 'Time Up!', w / 2, h / 2 - 20);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Score: ${d.score}`, w / 2, h / 2 + 20);
    }
}

// ===== GARDEN MAZE GAME =====
function initMazeGame() {
    const size = 10;
    const maze = generateMaze(size, size);
    miniGameState.activeGame = 'maze';
    miniGameState.data = {
        maze: maze,
        size: size,
        playerR: 0,
        playerC: 0,
        goalR: size - 1,
        goalC: size - 1,
        startTime: Date.now(),
        gameOver: false
    };
    showMessage('🌀 Garden Maze! Use arrow keys to reach the carrot!', 'success');
}

function generateMaze(rows, cols) {
    // Create grid: each cell has walls {top, right, bottom, left}
    const grid = [];
    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
            grid[r][c] = { top: true, right: true, bottom: true, left: true, visited: false };
        }
    }

    // DFS maze generation
    const stack = [];
    const startR = 0, startC = 0;
    grid[startR][startC].visited = true;
    stack.push([startR, startC]);

    while (stack.length > 0) {
        const [cr, cc] = stack[stack.length - 1];
        const neighbors = [];
        // top
        if (cr > 0 && !grid[cr - 1][cc].visited) neighbors.push([cr - 1, cc, 'top', 'bottom']);
        // bottom
        if (cr < rows - 1 && !grid[cr + 1][cc].visited) neighbors.push([cr + 1, cc, 'bottom', 'top']);
        // left
        if (cc > 0 && !grid[cr][cc - 1].visited) neighbors.push([cr, cc - 1, 'left', 'right']);
        // right
        if (cc < cols - 1 && !grid[cr][cc + 1].visited) neighbors.push([cr, cc + 1, 'right', 'left']);

        if (neighbors.length === 0) {
            stack.pop();
        } else {
            const [nr, nc, wall, opposite] = neighbors[Math.floor(Math.random() * neighbors.length)];
            grid[cr][cc][wall] = false;
            grid[nr][nc][opposite] = false;
            grid[nr][nc].visited = true;
            stack.push([nr, nc]);
        }
    }
    return grid;
}

function handleMazeKeydown(key) {
    const d = miniGameState.data;
    if (!d || d.gameOver) return false;
    const cell = d.maze[d.playerR][d.playerC];
    let moved = false;

    if ((key === 'ArrowUp' || key === 'w' || key === 'W') && !cell.top) {
        d.playerR--;
        moved = true;
    } else if ((key === 'ArrowDown' || key === 's' || key === 'S') && !cell.bottom) {
        d.playerR++;
        moved = true;
    } else if ((key === 'ArrowLeft' || key === 'a' || key === 'A') && !cell.left) {
        d.playerC--;
        moved = true;
    } else if ((key === 'ArrowRight' || key === 'd' || key === 'D') && !cell.right) {
        d.playerC++;
        moved = true;
    }

    if (moved && d.playerR === d.goalR && d.playerC === d.goalC) {
        d.gameOver = true;
        d.endTime = Date.now();
        const elapsed = Math.floor((d.endTime - d.startTime) / 1000);
        setTimeout(() => {
            addMiniGameScore('maze', elapsed, 'Bunny');
            showMiniGameScoreboard('maze');
            quitMiniGame();
        }, 800);
    }
    return moved;
}

function handleMazeClick(x, y) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (x >= rect.width - 50 && x <= rect.width - 10 && y >= 10 && y <= 45) {
        quitMiniGame();
    }
}

function drawMazeGame() {
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const d = miniGameState.data;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);

    // Title + Timer
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    const elapsed = Math.floor(((d.endTime || Date.now()) - d.startTime) / 1000);
    ctx.fillText(`🌀 Garden Maze  |  Time: ${elapsed}s`, w / 2, 32);

    // Quit button
    ctx.fillStyle = 'rgba(255,60,60,0.85)';
    ctx.fillRect(w - 50, 10, 40, 35);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('X', w - 30, 34);

    // Draw maze
    const cellSize = Math.min((w - 60) / d.size, (h - 100) / d.size);
    const mazeW = cellSize * d.size;
    const mazeH = cellSize * d.size;
    const ox = (w - mazeW) / 2;
    const oy = (h - mazeH) / 2 + 20;

    // Maze background
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(ox - 2, oy - 2, mazeW + 4, mazeH + 4);
    ctx.fillStyle = '#C8E6C9';
    ctx.fillRect(ox, oy, mazeW, mazeH);

    // Walls
    ctx.strokeStyle = '#33691E';
    ctx.lineWidth = 2;
    for (let r = 0; r < d.size; r++) {
        for (let c = 0; c < d.size; c++) {
            const x = ox + c * cellSize;
            const y2 = oy + r * cellSize;
            const cell = d.maze[r][c];
            if (cell.top) {
                ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(x + cellSize, y2); ctx.stroke();
            }
            if (cell.right) {
                ctx.beginPath(); ctx.moveTo(x + cellSize, y2); ctx.lineTo(x + cellSize, y2 + cellSize); ctx.stroke();
            }
            if (cell.bottom) {
                ctx.beginPath(); ctx.moveTo(x, y2 + cellSize); ctx.lineTo(x + cellSize, y2 + cellSize); ctx.stroke();
            }
            if (cell.left) {
                ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(x, y2 + cellSize); ctx.stroke();
            }
        }
    }

    // Goal (carrot)
    ctx.font = `${Math.floor(cellSize * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('🥕', ox + d.goalC * cellSize + cellSize / 2, oy + d.goalR * cellSize + cellSize * 0.7);

    // Player (bunny)
    ctx.font = `${Math.floor(cellSize * 0.6)}px Arial`;
    ctx.fillText('🐰', ox + d.playerC * cellSize + cellSize / 2, oy + d.playerR * cellSize + cellSize * 0.7);

    if (d.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('You found the carrot!', w / 2, h / 2 - 20);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`Time: ${elapsed}s`, w / 2, h / 2 + 20);
    }
}

// ===== MINI-GAME UPDATE & DRAW DISPATCHERS =====
function updateMiniGames(deltaTime) {
    if (!miniGameState.activeGame) return;
    switch (miniGameState.activeGame) {
        case 'racing': updateRacingGame(deltaTime); break;
        case 'cooking': updateCookingGame(deltaTime); break;
        // memory and maze don't need continuous updates
    }
}

function drawMiniGames() {
    if (!miniGameState.activeGame) return;
    switch (miniGameState.activeGame) {
        case 'memory': drawMemoryGame(); break;
        case 'racing': drawRacingGame(); break;
        case 'cooking': drawCookingGame(); break;
        case 'maze': drawMazeGame(); break;
    }
}

function handleMiniGameClick(x, y) {
    if (!miniGameState.activeGame) return false;
    switch (miniGameState.activeGame) {
        case 'memory': handleMemoryClick(x, y); return true;
        case 'racing': handleRacingClick(x, y); return true;
        case 'cooking': handleCookingClick(x, y); return true;
        case 'maze': handleMazeClick(x, y); return true;
    }
    return false;
}

function handleMiniGameKeydown(key) {
    if (!miniGameState.activeGame) return false;
    if (miniGameState.activeGame === 'maze') {
        return handleMazeKeydown(key);
    }
    return false;
}

// ===== BASKET / INVENTORY SYSTEM =====
let basketOpen = false;

function toggleBasket() {
    basketOpen = !basketOpen;
    if (basketOpen) {
        showBasketUI();
    } else {
        hideBasketUI();
    }
}

function showBasketUI() {
    hideBasketUI(); // Remove existing
    
    const hasItems = Object.keys(inventoryState).some(k => inventoryState[k] > 0);
    
    let itemsHtml = '';
    if (!hasItems) {
        itemsHtml = '<div style="text-align:center;color:#999;padding:20px;">Your basket is empty! Buy items from the Shop 🛒</div>';
    } else {
        shopState.items.forEach(item => {
            const qty = inventoryState[item.id] || 0;
            if (qty > 0) {
                itemsHtml += `
                    <div class="shop-item" style="cursor:pointer" data-item-id="${item.id}">
                        <div class="item-icon">${item.icon}</div>
                        <div class="item-name">${item.name} (x${qty})</div>
                        <button class="buy-button use-item-btn" data-item-id="${item.id}" style="background:linear-gradient(135deg, #4caf50, #388e3c);">Give to bunny</button>
                    </div>
                `;
            }
        });
    }
    
    const basketEl = document.createElement('div');
    basketEl.id = 'basket-overlay';
    basketEl.className = 'shop-overlay';
    basketEl.innerHTML = `
        <div class="shop-modal">
            <div class="shop-header">
                <h2>🧺 Basket</h2>
                <button class="close-shop">×</button>
            </div>
            <div class="shop-items">${itemsHtml}</div>
        </div>
    `;
    
    document.body.appendChild(basketEl);
    
    // Use item buttons -> show bunny picker
    basketEl.querySelectorAll('.use-item-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const itemId = this.getAttribute('data-item-id');
            showBunnyPicker(itemId);
        });
    });
    
    basketEl.querySelector('.close-shop').addEventListener('click', () => toggleBasket());
    
    setTimeout(() => basketEl.classList.add('show'), 50);
}

function hideBasketUI() {
    const el = document.getElementById('basket-overlay');
    if (el) {
        el.classList.add('hide');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
}

function updateBasketUI() {
    if (basketOpen) showBasketUI();
}

function showBunnyPicker(itemId) {
    // Remove existing picker
    const existing = document.getElementById('bunny-picker');
    if (existing) existing.remove();
    
    if (!gameState) {
        showMessage('No bunnies to give items to!', 'error');
        return;
    }
    
    const item = shopState.items.find(i => i.id === itemId);
    
    // All items are wearable — show all babies plus parent bunnies
    const availableBabies = gameState.babies;

    let bunniesHtml = '';

    // Add parent bunnies as options
    bunniesHtml += `
        <button class="action-btn pet bunny-pick-btn" data-baby-id="parent_black" style="margin:5px;min-width:120px;">
            🐰⬛ Black Parent
        </button>
        <button class="action-btn pet bunny-pick-btn" data-baby-id="parent_white" style="margin:5px;min-width:120px;">
            🐰⬜ White Parent
        </button>
    `;

    bunniesHtml += availableBabies.map(baby => `
        <button class="action-btn pet bunny-pick-btn" data-baby-id="${baby.id}" style="margin:5px;min-width:120px;">
            ${baby.stage === 'egg' ? '🥚' : (baby.genetics?.color === 'black' ? '🐰⬛' : '🐰⬜')} ${baby.name || baby.id}
        </button>
    `).join('');

    if (!bunniesHtml) {
        bunniesHtml = '<div style="padding:10px;color:#999;">No bunnies yet!</div>';
    }
    
    const pickerEl = document.createElement('div');
    pickerEl.id = 'bunny-picker';
    pickerEl.className = 'shop-overlay';
    pickerEl.innerHTML = `
        <div class="shop-modal" style="max-width:350px;">
            <div class="shop-header">
                <h2>${item ? item.icon : '🎁'} Give ${item ? item.name : 'item'} to...</h2>
                <button class="close-shop">×</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;padding:15px;">
                ${bunniesHtml}
            </div>
        </div>
    `;
    
    document.body.appendChild(pickerEl);
    
    pickerEl.querySelectorAll('.bunny-pick-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const babyId = this.getAttribute('data-baby-id');
            useItemOnBunny(itemId, babyId);
            pickerEl.remove();
        });
    });
    
    pickerEl.querySelector('.close-shop').addEventListener('click', () => pickerEl.remove());
    
    setTimeout(() => pickerEl.classList.add('show'), 50);
}

function useItemOnBunny(itemId, babyId) {
    if (!socket || !socket.connected) {
        showMessage('Not connected to server', 'error');
        return;
    }
    
    socket.emit('use_item', { itemId, babyId });
    
    // Optimistic local update
    if (inventoryState[itemId] > 0) {
        inventoryState[itemId]--;
        if (inventoryState[itemId] <= 0) delete inventoryState[itemId];
    }
    
    const item = shopState.items.find(i => i.id === itemId);
    let targetName = 'bunny';
    if (babyId === 'parent_black') targetName = 'Black Parent';
    else if (babyId === 'parent_white') targetName = 'White Parent';
    else {
        const baby = gameState.babies.find(b => b.id === babyId);
        if (baby) targetName = baby.name;
    }
    showMessage(`Gave ${item ? item.name : 'item'} to ${targetName}! ${item ? item.icon : '🎁'}`, 'success');
    
    // Close basket
    if (basketOpen) toggleBasket();
}

function showPurchaseSuccess(item, data) {
    const successEl = document.createElement('div');
    successEl.className = 'purchase-success';
    successEl.innerHTML = `
        <div class="success-content">
            <div class="success-icon">${item.icon}</div>
            <div class="success-text">Purchased ${item.name}!</div>
            <div class="success-sparkles"></div>
        </div>
    `;
    
    document.body.appendChild(successEl);
    
    setTimeout(() => {
        successEl.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        successEl.classList.add('hide');
        setTimeout(() => {
            if (successEl.parentNode) {
                successEl.parentNode.removeChild(successEl);
            }
        }, 500);
    }, 3000);
    
    // Update shop carrot count if shop is open
    updateShopCarrotCount();
}

function updateShopCarrotCount() {
    const shopCarrotEl = document.getElementById('shop-carrot-count');
    if (shopCarrotEl && gameState) {
        // Use garden carrots (from harvesting) + shop carrots as total
        const gardenCarrots = gameState.garden ? (gameState.garden.carrots || 0) : 0;
        const shopCarrots = gameState.carrots || 0;
        shopCarrotEl.textContent = gardenCarrots + shopCarrots;
    }
}

function updateCarrotDisplay(newCount) {
    if (gameState) {
        gameState.carrots = newCount;
    }
    
    if (carrotCount) {
        carrotCount.textContent = newCount;
    }
    
    // Update shop display if open
    updateShopCarrotCount();
}

// Weather effects system
function updateWeatherEffects(deltaTime) {
    const now = Date.now();
    
    // Change weather periodically
    if (now - weatherState.lastWeatherChange > weatherState.changeInterval) {
        changeWeather();
        weatherState.lastWeatherChange = now;
    }
    
    // Update weather particles
    updateWeatherParticles(deltaTime);
}

function changeWeather() {
    const weatherTypes = ['sunny', 'rain', 'snow'];
    const currentHour = new Date().getHours();
    
    // Rain more likely at night
    let weights = currentHour >= 20 || currentHour <= 6 ? 
                 [1, 3, 1] : [3, 1, 1];
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < weatherTypes.length; i++) {
        currentWeight += weights[i];
        if (random <= currentWeight) {
            weatherState.type = weatherTypes[i];
            break;
        }
    }
    
    // Clear old particles when weather changes
    weatherState.particles = [];
    
    console.log(`🌦️ Weather changed to: ${weatherState.type}`);
}

function updateWeatherParticles(deltaTime) {
    // Remove dead particles
    weatherState.particles = weatherState.particles.filter(p => p.life > 0);
    
    // Add new particles if needed
    if (weatherState.particles.length < weatherState.maxParticles && weatherState.type !== 'sunny') {
        for (let i = weatherState.particles.length; i < weatherState.maxParticles; i++) {
            createWeatherParticle();
        }
    }
    
    // Update existing particles
    weatherState.particles.forEach(particle => {
        updateWeatherParticle(particle, deltaTime);
    });
}

function createWeatherParticle() {
    const particle = {
        x: Math.random() * canvas.width,
        y: -10,
        life: 1,
        decay: 0.005,
        depth: Math.random(), // 0 = far, 1 = near
        phase: Math.random() * Math.PI * 2,
        spin: 0
    };

    if (weatherState.type === 'rain') {
        // Wind-angled rain, depth-scaled speed
        particle.vx = -0.8 - Math.random() * 0.6;
        particle.vy = 6 + particle.depth * 6;
        particle.color = particle.depth > 0.5 ? '#7ec8e8' : '#5a9bc4';
        particle.size = 1 + particle.depth * 1.5;
        particle.length = 8 + particle.depth * 10;
    } else if (weatherState.type === 'snow') {
        particle.vx = (Math.random() - 0.5) * 0.5;
        particle.vy = 0.6 + particle.depth * 1.4;
        particle.color = '#ffffff';
        particle.size = 1.5 + particle.depth * 3.5;
        particle.spinRate = (Math.random() - 0.5) * 0.05;
    }

    weatherState.particles.push(particle);
}

function updateWeatherParticle(particle, deltaTime) {
    particle.x += particle.vx || 0;
    particle.y += particle.vy || 0;
    particle.life -= particle.decay;
    // Snow drifts sinusoidally
    if (weatherState.type === 'snow') {
        particle.phase += 0.02;
        particle.x += Math.sin(particle.phase) * 0.5;
        particle.spin = (particle.spin || 0) + (particle.spinRate || 0);
    }
    if (particle.y > canvas.height + 10) {
        particle.life = 0;
    }
}

function drawWeatherEffects() {
    if (!ctx || weatherState.type === 'sunny') return;
    
    ctx.save();
    
    if (weatherState.type === 'sunny') {
        // Draw lens flare / warm glow
        const gradient = ctx.createRadialGradient(
            canvas.width * 0.8, canvas.height * 0.2, 0,
            canvas.width * 0.8, canvas.height * 0.2, 200
        );
        gradient.addColorStop(0, 'rgba(255, 255, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Draw particles with depth-based rendering
        weatherState.particles.forEach(particle => {
            const depth = particle.depth != null ? particle.depth : 0.5;
            ctx.globalAlpha = particle.life * (0.4 + depth * 0.6);

            if (weatherState.type === 'rain') {
                // Angled streak with fading tail
                const len = particle.length || 8;
                const dx = particle.vx || -1;
                const dy = particle.vy || 6;
                const nx = particle.x - dx * (len / dy);
                const ny = particle.y - len;
                const grad = ctx.createLinearGradient(nx, ny, particle.x, particle.y);
                grad.addColorStop(0, 'rgba(120, 180, 220, 0)');
                grad.addColorStop(1, particle.color);
                ctx.strokeStyle = grad;
                ctx.lineWidth = particle.size;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(nx, ny);
                ctx.lineTo(particle.x, particle.y);
                ctx.stroke();
            } else if (weatherState.type === 'snow') {
                // Six-armed snowflake for larger near flakes, dot for far
                if (particle.size > 3) {
                    ctx.save();
                    ctx.translate(particle.x, particle.y);
                    ctx.rotate(particle.spin || 0);
                    ctx.strokeStyle = particle.color;
                    ctx.lineWidth = 0.8;
                    ctx.lineCap = 'round';
                    for (let a = 0; a < 6; a++) {
                        const ang = (a / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(Math.cos(ang) * particle.size, Math.sin(ang) * particle.size);
                        // Small branches
                        const bx = Math.cos(ang) * particle.size * 0.5;
                        const by = Math.sin(ang) * particle.size * 0.5;
                        ctx.moveTo(bx, by);
                        ctx.lineTo(bx + Math.cos(ang + 1.0) * particle.size * 0.25, by + Math.sin(ang + 1.0) * particle.size * 0.25);
                        ctx.moveTo(bx, by);
                        ctx.lineTo(bx + Math.cos(ang - 1.0) * particle.size * 0.25, by + Math.sin(ang - 1.0) * particle.size * 0.25);
                        ctx.stroke();
                    }
                    ctx.lineCap = 'butt';
                    ctx.restore();
                } else {
                    ctx.fillStyle = particle.color;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
    }
    
    ctx.restore();
}

// Mood-based bunny animations
function updateBunnyMoodAnimations(deltaTime) {
    if (!gameState || !gameState.babies) return;
    
    Object.values(gameState.babies).forEach(baby => {
        updateBunnyMoodForBaby(baby, deltaTime);
    });
}

function updateBunnyMoodForBaby(baby, deltaTime) {
    const happiness = baby.happiness || 0;
    const hunger = baby.hunger || 0;
    const energy = baby.energy || 0;
    const cleanliness = baby.cleanliness || 0;
    
    const now = Date.now();
    
    // Happy - zoomies and hearts
    if (happiness > 80 && Math.random() < 0.001) {
        startZoomies(baby.id);
    }
    
    // Hungry - look toward kitchen
    if (hunger < 30 && Math.random() < 0.002) {
        showHungryAnimation(baby.id);
    }
    
    // Tired - droopy eyes and yawning
    if (energy < 30 && Math.random() < 0.003) {
        showTiredAnimation(baby.id);
    }
    
    // Dirty - stink lines
    if (cleanliness < 30 && Math.random() < 0.001) {
        showDirtyAnimation(baby.id);
    }
}

function startZoomies(babyId) {
    const animation = {
        babyId: babyId,
        startTime: Date.now(),
        duration: 2000,
        path: generateZoomiesPath()
    };
    
    addAnimation('zoomies_' + babyId, (deltaTime) => {
        return drawZoomiesAnimation(animation, deltaTime);
    });
}

function generateZoomiesPath() {
    return [
        { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
        { x: Math.random() * canvas.width, y: Math.random() * canvas.height },
        { x: Math.random() * canvas.width, y: Math.random() * canvas.height }
    ];
}

function drawZoomiesAnimation(animation, deltaTime) {
    const elapsed = Date.now() - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    
    if (progress >= 1) return false;
    
    // Draw hearts floating up
    for (let i = 0; i < 3; i++) {
        const heartX = canvas.width / 2 + (Math.random() - 0.5) * 100;
        const heartY = canvas.height / 2 - progress * 100 - i * 20;
        
        ctx.save();
        ctx.font = '20px Arial';
        ctx.fillStyle = '#ff69b4';
        ctx.globalAlpha = 1 - progress;
        ctx.fillText('💖', heartX, heartY);
        ctx.restore();
    }
    
    return true;
}

function showHungryAnimation(babyId) {
    // Show stomach rumble icon
    const animation = {
        babyId: babyId,
        startTime: Date.now(),
        duration: 3000
    };
    
    addAnimation('hungry_' + babyId, (deltaTime) => {
        const elapsed = Date.now() - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        
        if (progress >= 1) return false;
        
        ctx.save();
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ff9800';
        ctx.globalAlpha = 0.8;
        
        // Rumble effect
        const rumbleX = canvas.width / 2 + (Math.random() - 0.5) * 4;
        const rumbleY = canvas.height / 2 + 40;
        
        ctx.fillText('🍽️', rumbleX, rumbleY);
        ctx.restore();
        
        return true;
    });
}

function showTiredAnimation(babyId) {
    // Show yawn and droopy eyes
    const animation = {
        babyId: babyId,
        startTime: Date.now(),
        duration: 2500
    };
    
    addAnimation('tired_' + babyId, (deltaTime) => {
        const elapsed = Date.now() - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        
        if (progress >= 1) return false;
        
        ctx.save();
        ctx.font = '20px Arial';
        ctx.fillStyle = '#9e9e9e';
        ctx.globalAlpha = Math.sin(progress * Math.PI);
        
        ctx.fillText('😴', canvas.width / 2 - 20, canvas.height / 2 - 40);
        ctx.restore();
        
        return true;
    });
}

function showDirtyAnimation(babyId) {
    // Show stink lines and flies
    const animation = {
        babyId: babyId,
        startTime: Date.now(),
        duration: 4000,
        flies: []
    };
    
    // Create flies
    for (let i = 0; i < 3; i++) {
        animation.flies.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 60,
            y: canvas.height / 2 + (Math.random() - 0.5) * 60,
            angle: Math.random() * Math.PI * 2,
            speed: 0.05
        });
    }
    
    addAnimation('dirty_' + babyId, (deltaTime) => {
        const elapsed = Date.now() - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        
        if (progress >= 1) return false;
        
        ctx.save();
        
        // Draw stink lines
        ctx.strokeStyle = '#8bc34a';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        
        for (let i = 0; i < 3; i++) {
            const x = canvas.width / 2 + i * 15 - 15;
            const y = canvas.height / 2 - 50 + Math.sin(elapsed * 0.005 + i) * 10;
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 5, y - 10);
            ctx.stroke();
        }
        
        // Draw buzzing flies
        ctx.fillStyle = '#333';
        animation.flies.forEach(fly => {
            fly.angle += fly.speed;
            const flyX = fly.x + Math.cos(fly.angle) * 20;
            const flyY = fly.y + Math.sin(fly.angle) * 15;
            
            ctx.fillRect(flyX, flyY, 3, 3);
        });
        
        ctx.restore();
        
        return true;
    });
}

// Updated drawing function to include new features
// Dead code removed — drawBabyWithStageVisuals was never called.
// The render path uses drawBunnyBaby() instead.
function _drawBabyWithStageVisuals_removed() { return; }
function drawBabyWithStageVisuals(baby, x, y) {
    // Redirect to the actual renderer
    drawBunnyBaby(x, y, baby);
    return;
    // Original dead code below (kept for reference, never reached):
    if (!ctx) return;
    ctx.save();

    // Stage-based size changes
    let size;
    switch (baby.stage) {
        case 'egg':
            size = 20;
            break;
        case 'newborn':
            size = 15;
            break;
        case 'baby':
            size = 20;
            break;
        case 'toddler':
            size = 30;
            break;
        case 'child':
            size = 40;
            break;
        default:
            size = 25;
    }
    
    // Draw based on stage
    if (baby.stage === 'egg') {
        // Draw egg
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size + 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        // Draw bunny body
        ctx.fillStyle = baby.color === 'black' ? '#2c2c2c' : '#ffffff';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // Body
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Ears
        const earHeight = size * 0.8;
        ctx.beginPath();
        ctx.ellipse(x - size/2, y - size, size/4, earHeight, -0.3, 0, Math.PI * 2);
        ctx.ellipse(x + size/2, y - size, size/4, earHeight, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Eyes (closed for newborns)
        if (baby.stage === 'newborn') {
            // Closed eyes
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - size/3, y - size/4);
            ctx.lineTo(x - size/6, y - size/4);
            ctx.moveTo(x + size/6, y - size/4);
            ctx.lineTo(x + size/3, y - size/4);
            ctx.stroke();
        } else {
            // Open eyes
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(x - size/3, y - size/4, 3, 0, Math.PI * 2);
            ctx.arc(x + size/3, y - size/4, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Accessories for children
        if (baby.stage === 'child') {
            ctx.fillStyle = '#ff69b4';
            ctx.beginPath();
            ctx.arc(x, y - size - 10, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Toddlers have bouncy animation
        if (baby.stage === 'toddler') {
            const bounce = Math.sin(Date.now() * 0.005) * 3;
            ctx.translate(0, bounce);
        }

        // Draw wearables (fallback path)
        if (baby.wearables) {
            drawBunnyWearables(x, y, size, baby.wearables);
        }
    }

    ctx.restore();
}

// ===== TEXT MEASUREMENT CACHE =====
function getCachedTextWidth(text, font) {
    const key = `${text}|${font}`;
    
    if (!textMeasureCache.has(key)) {
        // HIGH FIX: Add max size limit to prevent unbounded cache growth
        const MAX_TEXT_CACHE_SIZE = 200;
        
        // If cache is at max size, clear oldest entries (simple FIFO)
        if (textMeasureCache.size >= MAX_TEXT_CACHE_SIZE) {
            const oldestKey = textMeasureCache.keys().next().value;
            textMeasureCache.delete(oldestKey);
            console.log('🧹 Text cache limit reached, removed oldest entry');
        }
        
        ctx.save();
        ctx.font = font;
        const width = ctx.measureText(text).width;
        ctx.restore();
        textMeasureCache.set(key, width);
    }
    
    return textMeasureCache.get(key);
}

// ===== DEBUG FUNCTIONS (for development) =====
function debugGameState() {
    console.log('Current game state:', gameState);
    console.log('My player ID:', myPlayerId);
    console.log('My player type:', myPlayerType);
    console.log('Room code:', roomCode);
    console.log('Selected baby:', selectedBabyId);
}

// Make functions available globally for HTML onclick handlers
window.debugBunnyGame = debugGameState;
window.buyItem = buyItem;
window.toggleShop = toggleShop;
window.toggleBasket = toggleBasket;
window.useItemOnBunny = useItemOnBunny;

console.log('🐰 Bunny Family 2D Game - Loaded successfully!');
console.log('💡 Tip: Type debugBunnyGame() in console to see current game state');