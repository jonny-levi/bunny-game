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
        { id: 'carrot_treat', name: 'Carrot Necklace', price: 3, icon: '🥕', desc: 'Cute carrot pendant', type: 'wearable' },
        { id: 'toy_ball', name: 'Bouncy Ball', price: 5, icon: '🏀', desc: 'Bunny carries it around', type: 'wearable' },
        { id: 'soft_blanket', name: 'Soft Blanket', price: 8, icon: '🧣', desc: 'Cozy blanket cape', type: 'wearable' },
        { id: 'bow_pink', name: 'Pink Bow', price: 8, icon: '🎀', desc: 'Adorable pink bow', type: 'wearable' },
        { id: 'scarf_red', name: 'Red Scarf', price: 10, icon: '🧣', desc: 'Cozy red scarf', type: 'wearable' },
        { id: 'scarf_blue', name: 'Blue Scarf', price: 10, icon: '🧣', desc: 'Stylish blue scarf', type: 'wearable' },
        { id: 'decorative_plant', name: 'Flower Crown', price: 12, icon: '🌸', desc: 'Beautiful flower crown', type: 'wearable' },
        { id: 'glasses', name: 'Cool Glasses', price: 12, icon: '🕶️', desc: 'Stylish sunglasses', type: 'wearable' },
        { id: 'night_light', name: 'Glowing Amulet', price: 15, icon: '✨', desc: 'Magical glowing amulet', type: 'wearable' },
        { id: 'hat_top', name: 'Top Hat', price: 20, icon: '🎩', desc: 'Fancy top hat', type: 'wearable' }
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
    
    // Sync scene based on baby sleeping status
    if (newGameState.babies) {
        const anySleeping = newGameState.babies.some(b => b.sleeping);
        if (anySleeping) {
            setScene('night');
        } else if (currentScene === 'night') {
            // All babies woke up — go back to default
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

    // Sync scene from partner's action
    if (data.playerId !== myPlayerId) {
        if (data.action === 'feed') setScene('kitchen');
        else if (data.action === 'play') setScene('playground');
        else if (data.action === 'clean') setScene('bathroom');
        else if (data.action === 'sleep') setScene('night');
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
        
        // Switch scene based on action
        if (action === 'feed') {
            setScene('kitchen');
        } else if (action === 'play') {
            setScene('playground');
        } else if (action === 'sleep') {
            setScene('night');
        } else if (action === 'clean') {
            setScene('bathroom');
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

function setScene(scene) {
    if (currentScene !== scene) {
        backgroundNeedsRedraw = true;
        dirtyBackground = true;
    }
    currentScene = scene;
    if (sceneTimer) clearTimeout(sceneTimer);
    sceneTimer = null;

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
    
    if (anySleeping || isNight || scene === 'night') {
        drawNightBackgroundToContext(ctx, width, height);
    } else if (scene === 'kitchen') {
        drawKitchenBackground(width, height);
    } else if (scene === 'playground') {
        drawPlaygroundBackground(width, height);
    } else if (scene === 'bathroom') {
        drawBathroomBackground(width, height);
    } else {
        drawDayBackgroundToContext(ctx, width, height);
    }
}

function drawDayBackgroundToContext(context, width, height) {
    // === FOREST BACKGROUND ===
    const time = Date.now() * 0.001;

    // Sky gradient — warm daylight
    const skyGrad = context.createLinearGradient(0, 0, 0, height * 0.55);
    skyGrad.addColorStop(0, '#87ceeb');   // light sky blue
    skyGrad.addColorStop(0.5, '#b5e6f0'); // pale cyan
    skyGrad.addColorStop(1, '#d4f0d4');   // sky meets treetops
    context.fillStyle = skyGrad;
    context.fillRect(0, 0, width, height * 0.55);

    // Sun with glow
    const sunX = width * 0.85;
    const sunY = height * 0.1;
    const sunGlow = context.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
    sunGlow.addColorStop(0, 'rgba(255, 250, 200, 0.9)');
    sunGlow.addColorStop(0.4, 'rgba(255, 240, 150, 0.3)');
    sunGlow.addColorStop(1, 'rgba(255, 240, 150, 0)');
    context.fillStyle = sunGlow;
    context.fillRect(sunX - 80, sunY - 80, 160, 160);
    context.fillStyle = '#fff7b0';
    context.beginPath();
    context.arc(sunX, sunY, 22, 0, Math.PI * 2);
    context.fill();

    // Clouds
    drawCloudsToContext(context, width, height);

    // Distant hills / tree line
    const hillGrad = context.createLinearGradient(0, height * 0.35, 0, height * 0.55);
    hillGrad.addColorStop(0, '#5a9e5a');
    hillGrad.addColorStop(1, '#4a8b4a');
    context.fillStyle = hillGrad;
    context.beginPath();
    context.moveTo(0, height * 0.55);
    for (let x = 0; x <= width; x += 30) {
        const hillY = height * 0.45 + Math.sin(x * 0.008 + 1.5) * 20 + Math.sin(x * 0.015) * 10;
        context.lineTo(x, hillY);
    }
    context.lineTo(width, height * 0.55);
    context.closePath();
    context.fill();

    // Ground — lush grass
    const grassGrad = context.createLinearGradient(0, height * 0.55, 0, height);
    grassGrad.addColorStop(0, '#6abf6a');  // bright grass
    grassGrad.addColorStop(0.3, '#5aad5a');
    grassGrad.addColorStop(1, '#4a9a4a');  // darker ground
    context.fillStyle = grassGrad;
    context.fillRect(0, height * 0.55, width, height * 0.45);

    // Grass texture — small blades
    context.strokeStyle = '#52a852';
    context.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
        const gx = (i * width / 40) + Math.sin(i * 3.7) * 10;
        const gy = height * 0.56 + Math.abs(Math.sin(i * 2.3)) * (height * 0.35);
        const bladeH = 8 + Math.sin(i * 1.7) * 4;
        context.beginPath();
        context.moveTo(gx, gy);
        context.quadraticCurveTo(gx + 3, gy - bladeH, gx + 1, gy - bladeH - 2);
        context.stroke();
    }

    // Background trees (far)
    _drawForestTree(context, width * 0.05, height * 0.52, 25, '#3d7a3d', '#2d6a2d');
    _drawForestTree(context, width * 0.18, height * 0.50, 30, '#3a783a', '#2a682a');
    _drawForestTree(context, width * 0.82, height * 0.51, 28, '#3c7c3c', '#2c6c2c');
    _drawForestTree(context, width * 0.95, height * 0.53, 22, '#3e7e3e', '#2e6e2e');

    // Foreground trees (closer, larger)
    _drawForestTree(context, width * 0.08, height * 0.62, 50, '#4a8f4a', '#3a7f3a');
    _drawForestTree(context, width * 0.92, height * 0.60, 55, '#4c914c', '#3c813c');

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

    // Mushrooms
    _drawMushroom(context, width * 0.18, height * 0.80, 8);
    _drawMushroom(context, width * 0.75, height * 0.88, 6);

    // Butterflies (animated)
    context.font = '14px Arial';
    context.fillStyle = 'rgba(255, 105, 180, 0.8)';
    const bf1x = width * 0.3 + Math.sin(time * 1.2) * 20;
    const bf1y = height * 0.45 + Math.cos(time * 1.8) * 10;
    context.fillText('\uD83E\uDD8B', bf1x, bf1y);
    const bf2x = width * 0.7 + Math.sin(time * 0.9 + 2) * 25;
    const bf2y = height * 0.50 + Math.cos(time * 1.5 + 1) * 12;
    context.fillText('\uD83E\uDD8B', bf2x, bf2y);

    // Draw cave on top
    drawCaveToContext(context, width, height);
}

function _drawForestTree(ctx2, x, y, size, leafColor, darkLeafColor) {
    // Gentle sway — phase derived from x so trees don't sync
    const t = Date.now() * 0.0008;
    const swayPhase = x * 0.017;
    const sway = Math.sin(t + swayPhase) * (size * 0.03);

    // Trunk (no sway — stays rooted)
    ctx2.fillStyle = '#6d4c31';
    const trunkW = size * 0.2;
    const trunkH = size * 0.7;
    ctx2.fillRect(x - trunkW / 2, y - trunkH * 0.2, trunkW, trunkH);
    // Trunk detail
    ctx2.fillStyle = '#5a3d25';
    ctx2.fillRect(x - trunkW / 4, y - trunkH * 0.1, trunkW / 2, trunkH * 0.8);

    // Foliage layers (bottom to top) — apply sway
    x += sway;
    const foliageY = y - trunkH * 0.2;
    ctx2.fillStyle = darkLeafColor;
    ctx2.beginPath();
    ctx2.arc(x - size * 0.2, foliageY - size * 0.1, size * 0.55, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x + size * 0.2, foliageY - size * 0.05, size * 0.5, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = leafColor;
    ctx2.beginPath();
    ctx2.arc(x, foliageY - size * 0.3, size * 0.6, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x - size * 0.15, foliageY - size * 0.55, size * 0.4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x + size * 0.1, foliageY - size * 0.5, size * 0.35, 0, Math.PI * 2);
    ctx2.fill();
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

    // Dark sky gradient
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0d0d2b'); // Deep navy
    gradient.addColorStop(0.4, '#1a1a3e'); // Dark navy
    gradient.addColorStop(0.7, '#2d2555'); // Soft purple
    gradient.addColorStop(1, '#1e1e3a'); // Dark floor
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // Twinkling stars
    const starPositions = [
        {x: 0.05, y: 0.06}, {x: 0.12, y: 0.18}, {x: 0.22, y: 0.08},
        {x: 0.3, y: 0.2}, {x: 0.38, y: 0.04}, {x: 0.45, y: 0.14},
        {x: 0.55, y: 0.09}, {x: 0.62, y: 0.22}, {x: 0.7, y: 0.06},
        {x: 0.78, y: 0.16}, {x: 0.88, y: 0.1}, {x: 0.95, y: 0.2},
        {x: 0.17, y: 0.25}, {x: 0.48, y: 0.26}, {x: 0.75, y: 0.28}
    ];
    starPositions.forEach((star, i) => {
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * (1.2 + i * 0.3) + i * 1.7));
        const sz = 1.5 + Math.sin(time * 2 + i) * 0.8;
        context.fillStyle = `rgba(255, 255, 220, ${twinkle})`;
        context.beginPath();
        context.arc(star.x * width, star.y * height, sz, 0, Math.PI * 2);
        context.fill();
        // Star glow
        context.fillStyle = `rgba(255, 255, 200, ${twinkle * 0.15})`;
        context.beginPath();
        context.arc(star.x * width, star.y * height, sz * 3, 0, Math.PI * 2);
        context.fill();
    });

    // Moon with glow
    const moonX = width * 0.82;
    const moonY = height * 0.12;
    const moonGlow = context.createRadialGradient(moonX, moonY, 10, moonX, moonY, 60);
    moonGlow.addColorStop(0, 'rgba(255, 253, 231, 0.4)');
    moonGlow.addColorStop(1, 'rgba(255, 253, 231, 0)');
    context.fillStyle = moonGlow;
    context.beginPath();
    context.arc(moonX, moonY, 60, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fffde7';
    context.beginPath();
    context.arc(moonX, moonY, 25, 0, Math.PI * 2);
    context.fill();
    // Moon crescent shadow
    context.fillStyle = '#d4d0a0';
    context.beginPath();
    context.arc(moonX + 8, moonY - 3, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fffde7';
    context.beginPath();
    context.arc(moonX, moonY, 25, 0, Math.PI * 2);
    context.fill();

    // Floor (bedroom)
    const floorY = height * 0.68;
    context.fillStyle = '#2a2550';
    context.fillRect(0, floorY, width, height - floorY);

    // Bed frame
    const bedX = width * 0.2, bedW = width * 0.6, bedH = 50;
    const bedY = floorY - bedH;
    // Headboard
    context.fillStyle = '#5d4037';
    context.fillRect(bedX - 5, bedY - 30, 10, bedH + 30);
    context.fillRect(bedX + bedW - 5, bedY - 30, 10, bedH + 30);
    context.fillStyle = '#6d4c41';
    context.beginPath();
    context.moveTo(bedX - 10, bedY - 30);
    context.quadraticCurveTo(bedX + bedW / 2, bedY - 60, bedX + bedW + 10, bedY - 30);
    context.lineTo(bedX + bedW + 10, bedY);
    context.lineTo(bedX - 10, bedY);
    context.closePath();
    context.fill();
    // Mattress
    context.fillStyle = '#e8d5e0';
    context.fillRect(bedX, bedY, bedW, bedH);
    // Blanket
    const blanketWave = Math.sin(time * 0.5) * 2;
    context.fillStyle = '#9c27b0';
    context.globalAlpha = 0.7;
    context.beginPath();
    context.moveTo(bedX, bedY + 15);
    for (let bx = 0; bx <= bedW; bx += 20) {
        context.lineTo(bedX + bx, bedY + 12 + Math.sin(time * 0.8 + bx * 0.05) * 3);
    }
    context.lineTo(bedX + bedW, bedY + bedH);
    context.lineTo(bedX, bedY + bedH);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    // Pillows
    context.fillStyle = '#fff9c4';
    context.beginPath();
    context.ellipse(bedX + 40, bedY + 8, 25, 12, -0.1, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(bedX + bedW - 40, bedY + 8, 25, 12, 0.1, 0, Math.PI * 2);
    context.fill();
}

function drawKitchenBackground(width, height) {
    const time = Date.now() * 0.001;

    // Warm kitchen walls
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#fff8e1');
    gradient.addColorStop(0.3, '#ffe0b2');
    gradient.addColorStop(1, '#ffcc80');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Tiled floor
    const floorY = height * 0.72;
    const tileSize = 30;
    for (let tx = 0; tx < width; tx += tileSize) {
        for (let ty = floorY; ty < height; ty += tileSize) {
            ctx.fillStyle = ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0) ? '#ffecb3' : '#ffe0b2';
            ctx.fillRect(tx, ty, tileSize, tileSize);
        }
    }

    // Counter / table
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, floorY - 8, width, 8);

    // Cabinets on top
    ctx.fillStyle = '#a1887f';
    const cabW = 60, cabH = 50, cabY = height * 0.05;
    for (let i = 0; i < 3; i++) {
        const cx = width * 0.15 + i * (cabW + 20);
        ctx.fillRect(cx, cabY, cabW, cabH);
        ctx.strokeStyle = '#795548';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cabY, cabW, cabH);
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath();
        ctx.arc(cx + cabW / 2, cabY + cabH / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a1887f';
    }

    // Fridge
    ctx.fillStyle = '#e0e0e0';
    const fridgeX = width * 0.78, fridgeW = 50, fridgeH = height * 0.55;
    ctx.fillRect(fridgeX, floorY - fridgeH, fridgeW, fridgeH);
    ctx.strokeStyle = '#bdbdbd';
    ctx.lineWidth = 2;
    ctx.strokeRect(fridgeX, floorY - fridgeH, fridgeW, fridgeH);

    // Table with food
    const tableX = width * 0.3, tableW = width * 0.35, tableH = 12;
    const tableY = floorY - 50;
    // Table legs
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(tableX + 10, tableY + tableH, 6, 42);
    ctx.fillRect(tableX + tableW - 16, tableY + tableH, 6, 42);
    // Table top
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(tableX, tableY, tableW, tableH);

    // Carrots on table
    const carrots = [
        { x: tableX + 20, rot: -0.3 },
        { x: tableX + 50, rot: 0.1 },
        { x: tableX + tableW - 60, rot: 0.4 },
        { x: tableX + tableW - 30, rot: -0.2 }
    ];
    carrots.forEach((c, i) => {
        ctx.save();
        ctx.translate(c.x, tableY - 5);
        ctx.rotate(c.rot);
        // Carrot body
        ctx.fillStyle = '#ff9800';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(5, -18);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
        // Greens
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.ellipse(3, -18, 3, 6, 0.3, 0, Math.PI * 2);
        ctx.ellipse(-1, -19, 2, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Food bowl with steam
    const bowlX = tableX + tableW / 2;
    const bowlY = tableY - 8;
    ctx.fillStyle = '#ff8a80';
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY, 25, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffab91';
    ctx.beginPath();
    ctx.ellipse(bowlX, bowlY - 3, 20, 8, 0, 0, Math.PI);
    ctx.fill();

    // Animated steam rising from bowl
    ctx.save();
    for (let s = 0; s < 3; s++) {
        const steamX = bowlX - 10 + s * 10;
        const steamPhase = time * 2 + s * 2;
        const steamY = bowlY - 15 - (steamPhase % 3) * 12;
        const steamAlpha = 0.4 - ((steamPhase % 3) / 3) * 0.4;
        if (steamAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${steamAlpha})`;
            ctx.beginPath();
            ctx.arc(steamX + Math.sin(steamPhase * 1.5) * 5, steamY, 4 + (steamPhase % 3) * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    // Window
    ctx.fillStyle = '#e3f2fd';
    const winX = width * 0.35, winY = height * 0.08, winW = 60, winH = 45;
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH / 2);
    ctx.lineTo(winX + winW, winY + winH / 2);
    ctx.stroke();
}

function drawPlaygroundBackground(width, height) {
    const time = Date.now() * 0.001;

    // Bright green field with blue sky
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#64b5f6');
    gradient.addColorStop(0.4, '#90caf9');
    gradient.addColorStop(0.55, '#66bb6a');
    gradient.addColorStop(1, '#43a047');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Sun
    ctx.fillStyle = '#ffee58';
    ctx.shadowColor = '#ffee58';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(width * 0.85, height * 0.12, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    drawCloud(width * 0.2 + Math.sin(time * 0.3) * 10, height * 0.08, 20);
    drawCloud(width * 0.6 + Math.sin(time * 0.2 + 1) * 15, height * 0.15, 25);

    const groundY = height * 0.55;

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

    // Goal posts
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.05, height * 0.65);
    ctx.lineTo(width * 0.05, height * 0.85);
    ctx.moveTo(width * 0.05, height * 0.65);
    ctx.lineTo(width * 0.12, height * 0.65);
    ctx.moveTo(width * 0.05, height * 0.85);
    ctx.lineTo(width * 0.12, height * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.95, height * 0.65);
    ctx.lineTo(width * 0.95, height * 0.85);
    ctx.moveTo(width * 0.95, height * 0.65);
    ctx.lineTo(width * 0.88, height * 0.65);
    ctx.moveTo(width * 0.95, height * 0.85);
    ctx.lineTo(width * 0.88, height * 0.85);
    ctx.stroke();

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

}


function drawBathroomBackground(width, height) {
    const time = Date.now() * 0.001;

    // Soft blue-white bathroom
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#e8f5e9');
    gradient.addColorStop(0.5, '#e0f7fa');
    gradient.addColorStop(1, '#b2ebf2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Tile wall pattern
    const tileSize = 25;
    for (let tx = 0; tx < width; tx += tileSize) {
        for (let ty = 0; ty < height * 0.5; ty += tileSize) {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx, ty, tileSize, tileSize);
        }
    }

    // Shower head on wall
    const showerX = width * 0.65;
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(showerX - 3, height * 0.1, 6, height * 0.25);
    ctx.fillStyle = '#cfd8dc';
    ctx.beginPath();
    ctx.ellipse(showerX, height * 0.1, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animated water drops from shower
    ctx.fillStyle = 'rgba(100, 181, 246, 0.5)';
    for (let d = 0; d < 8; d++) {
        const dropPhase = (time * 3 + d * 0.8) % 4;
        const dropX = showerX - 10 + (d % 4) * 6 + Math.sin(d * 1.3) * 3;
        const dropY = height * 0.18 + dropPhase * (height * 0.12);
        const dropAlpha = 0.6 - dropPhase * 0.15;
        if (dropAlpha > 0) {
            ctx.fillStyle = `rgba(100, 181, 246, ${dropAlpha})`;
            ctx.beginPath();
            ctx.moveTo(dropX, dropY - 4);
            ctx.quadraticCurveTo(dropX + 3, dropY, dropX, dropY + 4);
            ctx.quadraticCurveTo(dropX - 3, dropY, dropX, dropY - 4);
            ctx.fill();
        }
    }

    // Bathtub
    const tubX = width * 0.2, tubY = height * 0.55, tubW = width * 0.5, tubH = 65;
    // Tub body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(tubX + tubW / 2, tubY + tubH / 2, tubW / 2, tubH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(tubX + tubW / 2, tubY + tubH / 2, tubW / 2, tubH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Water with gentle wave
    ctx.fillStyle = 'rgba(129, 212, 250, 0.5)';
    ctx.beginPath();
    const waterCenterX = tubX + tubW / 2;
    const waterCenterY = tubY + tubH / 2 + 5;
    const waterRX = tubW / 2 - 8;
    const waterRY = tubH / 2 - 8;
    ctx.ellipse(waterCenterX, waterCenterY, waterRX, waterRY, 0, 0, Math.PI * 2);
    ctx.fill();
    // Water surface wave
    ctx.strokeStyle = 'rgba(100, 181, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let wx = tubX + 20; wx < tubX + tubW - 20; wx += 3) {
        const wy = tubY + 18 + Math.sin(time * 3 + wx * 0.08) * 3;
        if (wx === tubX + 20) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
    }
    ctx.stroke();

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

    // Rubber duck bobbing
    ctx.font = '22px Arial';
    const duckX = tubX + tubW * 0.65 + Math.sin(time * 1.5) * 8;
    const duckY = tubY + 22 + Math.sin(time * 2) * 3;
    ctx.save();
    ctx.translate(duckX, duckY);
    ctx.rotate(Math.sin(time * 1.5) * 0.15);
    ctx.fillText('🐤', -10, 5);
    ctx.restore();

    // Soap bottle
    ctx.fillStyle = '#ce93d8';
    ctx.fillRect(width * 0.8, height * 0.4, 15, 30);
    ctx.fillStyle = '#ab47bc';
    ctx.fillRect(width * 0.8 + 3, height * 0.38, 9, 8);
    // Soap label
    ctx.fillStyle = '#f3e5f5';
    ctx.fillRect(width * 0.8 + 2, height * 0.42, 11, 10);

    // Towel rack
    ctx.strokeStyle = '#90a4ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.08, height * 0.3);
    ctx.lineTo(width * 0.08, height * 0.45);
    ctx.stroke();
    // Towel
    ctx.fillStyle = '#ffab91';
    ctx.fillRect(width * 0.05, height * 0.33, 10, 25);
    ctx.fillStyle = '#ef9a9a';
    ctx.fillRect(width * 0.05, height * 0.35, 10, 3);
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
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.arc(x + size * 0.7, y, size * 0.8, 0, Math.PI * 2);
    context.arc(x + size * 1.3, y, size * 0.6, 0, Math.PI * 2);
    context.arc(x + size * 0.65, y - size * 0.5, size * 0.7, 0, Math.PI * 2);
    context.fill();
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

function drawCaveToContext(context, width, height) {
    const cave = caveState.caveArea;
    const cx = cave.x + cave.width / 2;
    const cy = cave.y + cave.height;

    context.save();

    // Large rocky cliff/overhang behind the cave
    context.fillStyle = '#6d4c41';
    context.beginPath();
    context.moveTo(cave.x - 20, cy + 10);
    context.quadraticCurveTo(cave.x - 10, cave.y - 40, cx, cave.y - 50);
    context.quadraticCurveTo(cave.x + cave.width + 10, cave.y - 40, cave.x + cave.width + 20, cy + 10);
    context.fill();

    // Rock texture lines
    context.strokeStyle = '#5d4037';
    context.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
        const lx = cave.x + 10 + i * (cave.width / 5);
        const ly = cave.y - 20 + Math.sin(i * 1.2) * 15;
        context.beginPath();
        context.moveTo(lx, ly);
        context.lineTo(lx + 20, ly + 10 + Math.cos(i) * 8);
        context.stroke();
    }

    // Cave interior — dark arch
    context.fillStyle = '#2c1810';
    context.beginPath();
    context.arc(cx, cy, cave.width / 2 - 15, Math.PI, 0);
    context.lineTo(cx + cave.width / 2 - 15, cy);
    context.lineTo(cx - cave.width / 2 + 15, cy);
    context.fill();

    // Warm interior glow
    const glow = context.createRadialGradient(cx, cy - 30, 0, cx, cy - 30, cave.width / 2);
    glow.addColorStop(0, 'rgba(255, 183, 77, 0.45)');
    glow.addColorStop(0.5, 'rgba(255, 152, 48, 0.2)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy - 30, cave.width / 2, Math.PI, 0);
    context.fill();

    // Cozy hay bed at bottom
    context.fillStyle = '#ffe082';
    for (let i = 0; i < 7; i++) {
        const hx = cave.x + 30 + i * ((cave.width - 60) / 6);
        const hy = cy - 12 + Math.sin(i * 0.8) * 3;
        context.beginPath();
        context.ellipse(hx, hy, 18, 8, Math.sin(i) * 0.3, 0, Math.PI * 2);
        context.fill();
    }
    // Darker hay accents
    context.fillStyle = '#ffc107';
    for (let i = 0; i < 4; i++) {
        const hx = cave.x + 50 + i * ((cave.width - 100) / 3);
        context.beginPath();
        context.ellipse(hx, cy - 8, 12, 5, 0, 0, Math.PI * 2);
        context.fill();
    }

    // Small lantern/light on the left wall
    context.fillStyle = '#ffcc02';
    context.beginPath();
    context.arc(cave.x + 30, cave.y + cave.height * 0.4, 6, 0, Math.PI * 2);
    context.fill();
    // Lantern glow
    const lanternGlow = context.createRadialGradient(cave.x + 30, cave.y + cave.height * 0.4, 0, cave.x + 30, cave.y + cave.height * 0.4, 25);
    lanternGlow.addColorStop(0, 'rgba(255, 200, 50, 0.4)');
    lanternGlow.addColorStop(1, 'rgba(255, 200, 50, 0)');
    context.fillStyle = lanternGlow;
    context.beginPath();
    context.arc(cave.x + 30, cave.y + cave.height * 0.4, 25, 0, Math.PI * 2);
    context.fill();

    // Small mushrooms near entrance
    context.fillStyle = '#d32f2f';
    context.beginPath();
    context.arc(cave.x + cave.width - 25, cy - 6, 7, Math.PI, 0);
    context.fill();
    context.fillStyle = '#f5f5dc';
    context.fillRect(cave.x + cave.width - 27, cy - 6, 4, 8);
    // White dots on mushroom
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(cave.x + cave.width - 27, cy - 10, 2, 0, Math.PI * 2);
    context.arc(cave.x + cave.width - 22, cy - 12, 1.5, 0, Math.PI * 2);
    context.fill();

    // Vines hanging from top
    context.strokeStyle = '#4caf50';
    context.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const vx = cave.x + 20 + i * (cave.width / 3);
        context.beginPath();
        context.moveTo(vx, cave.y - 20);
        context.quadraticCurveTo(vx + 5, cave.y, vx - 3, cave.y + 20);
        context.stroke();
        // Tiny leaf
        context.fillStyle = '#66bb6a';
        context.beginPath();
        context.ellipse(vx - 3, cave.y + 20, 4, 2.5, 0.5, 0, Math.PI * 2);
        context.fill();
    }

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

function drawParentBunny(x, y, color, type) {
    const size = 40;
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

    // Face (blinks on idle cycle)
    drawBunnyFace(0, -size * 0.2, size * 0.8, false, blink);

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
        case 'newborn': size = 20; break;
        case 'toddler': size = 25; break;
        case 'young': size = 30; break;
        case 'grown': size = 35; break;
        default: size = 20;
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

    // Face (blinks on idle cycle + mood expression)
    drawBunnyFace(0, -size * 0.3, size * 0.6, baby.sleeping, blink, deriveMood(baby));

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

    // Scale up all wearables for visibility
    size = size * 1.6;

    // Back slot — blanket/cape draped over body
    if (wearables.back) {
        const color = wearables.back.color || '#7e57c2';
        ctx.fillStyle = color;
        // Cape shape behind bunny
        ctx.beginPath();
        ctx.moveTo(x - size * 0.6, y - size * 0.3);
        ctx.quadraticCurveTo(x, y + size * 1.1, x + size * 0.6, y - size * 0.3);
        ctx.lineTo(x + size * 0.5, y - size * 0.5);
        ctx.quadraticCurveTo(x, y + size * 0.8, x - size * 0.5, y - size * 0.5);
        ctx.fill();
        // Blanket edge detail
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.55, y - size * 0.35);
        ctx.quadraticCurveTo(x, y + size * 1.0, x + size * 0.55, y - size * 0.35);
        ctx.stroke();
    }

    // Neck slot — scarf, necklace, or amulet
    if (wearables.neck) {
        const w = wearables.neck;
        const color = w.color || '#e53935';
        if (w.itemId === 'night_light') {
            // Glowing amulet
            const time = Date.now() * 0.003;
            const glow = 0.5 + Math.sin(time * 2) * 0.3;
            ctx.fillStyle = `rgba(255, 235, 59, ${glow})`;
            ctx.beginPath();
            ctx.arc(x, y + size * 0.45, size * 0.18, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffc107';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Chain
            ctx.strokeStyle = '#bdbdbd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y + size * 0.15, size * 0.4, 0.3, Math.PI - 0.3);
            ctx.stroke();
        } else if (w.itemId === 'carrot_treat') {
            // Carrot pendant necklace
            ctx.strokeStyle = '#bdbdbd';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y + size * 0.15, size * 0.4, 0.3, Math.PI - 0.3);
            ctx.stroke();
            // Carrot pendant
            ctx.fillStyle = '#ff9800';
            ctx.beginPath();
            ctx.moveTo(x - size * 0.08, y + size * 0.4);
            ctx.lineTo(x + size * 0.08, y + size * 0.4);
            ctx.lineTo(x, y + size * 0.65);
            ctx.fill();
            // Carrot top
            ctx.fillStyle = '#4caf50';
            ctx.beginPath();
            ctx.moveTo(x, y + size * 0.38);
            ctx.lineTo(x - size * 0.06, y + size * 0.3);
            ctx.lineTo(x + size * 0.06, y + size * 0.3);
            ctx.fill();
        } else {
            // Scarf
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(x, y + size * 0.5, size * 0.7, size * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Scarf ends hanging
            ctx.fillRect(x + size * 0.3, y + size * 0.5, size * 0.15, size * 0.5);
            ctx.fillRect(x + size * 0.5, y + size * 0.55, size * 0.12, size * 0.4);
        }
    }

    // Head slot — hat, bow, or flower crown
    if (wearables.head) {
        const w = wearables.head;
        if (w.itemId === 'hat_top') {
            // Top hat
            ctx.fillStyle = w.color || '#333';
            ctx.fillRect(x - size * 0.4, y - size * 1.5, size * 0.8, size * 0.6);
            ctx.fillRect(x - size * 0.55, y - size * 0.95, size * 1.1, size * 0.15);
            // Hat band
            ctx.fillStyle = '#e53935';
            ctx.fillRect(x - size * 0.4, y - size * 1.0, size * 0.8, size * 0.08);
        } else if (w.itemId === 'bow_pink') {
            // Big pink bow
            ctx.fillStyle = w.color || '#e91e63';
            ctx.beginPath();
            ctx.moveTo(x, y - size * 0.85);
            ctx.quadraticCurveTo(x - size * 0.6, y - size * 1.4, x, y - size * 1.15);
            ctx.quadraticCurveTo(x + size * 0.6, y - size * 1.4, x, y - size * 0.85);
            ctx.fill();
            // Center knot
            ctx.fillStyle = '#c2185b';
            ctx.beginPath();
            ctx.arc(x, y - size * 0.95, size * 0.1, 0, Math.PI * 2);
            ctx.fill();
        } else if (w.itemId === 'decorative_plant') {
            // Flower crown
            const flowers = ['#e91e63', '#ff9800', '#9c27b0', '#2196f3', '#4caf50'];
            const crownRadius = size * 0.5;
            // Vine base
            ctx.strokeStyle = '#4caf50';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x, y - size * 0.7, crownRadius, Math.PI + 0.3, -0.3);
            ctx.stroke();
            // Flowers along the crown
            for (let i = 0; i < 5; i++) {
                const angle = Math.PI + 0.3 + (i / 4) * (Math.PI - 0.6);
                const fx = x + Math.cos(angle) * crownRadius;
                const fy = (y - size * 0.7) + Math.sin(angle) * crownRadius;
                ctx.fillStyle = flowers[i];
                ctx.beginPath();
                ctx.arc(fx, fy, size * 0.1, 0, Math.PI * 2);
                ctx.fill();
                // Flower center
                ctx.fillStyle = '#ffeb3b';
                ctx.beginPath();
                ctx.arc(fx, fy, size * 0.04, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Eyes slot — glasses
    if (wearables.eyes) {
        ctx.strokeStyle = wearables.eyes.color || '#333';
        ctx.lineWidth = 2.5;
        const glassSize = size * 0.22;
        // Left lens
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y - size * 0.35, glassSize, 0, Math.PI * 2);
        ctx.stroke();
        // Right lens
        ctx.beginPath();
        ctx.arc(x + size * 0.2, y - size * 0.35, glassSize, 0, Math.PI * 2);
        ctx.stroke();
        // Bridge
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2 + glassSize, y - size * 0.35);
        ctx.lineTo(x + size * 0.2 - glassSize, y - size * 0.35);
        ctx.stroke();
        // Arms
        ctx.beginPath();
        ctx.moveTo(x - size * 0.2 - glassSize, y - size * 0.35);
        ctx.lineTo(x - size * 0.5, y - size * 0.3);
        ctx.moveTo(x + size * 0.2 + glassSize, y - size * 0.35);
        ctx.lineTo(x + size * 0.5, y - size * 0.3);
        ctx.stroke();
        // Tinted lenses
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y - size * 0.35, glassSize, 0, Math.PI * 2);
        ctx.arc(x + size * 0.2, y - size * 0.35, glassSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // Held slot — ball
    if (wearables.held) {
        const color = wearables.held.color || '#ff5722';
        const time = Date.now() * 0.003;
        const bounce = Math.abs(Math.sin(time * 3)) * size * 0.1;
        // Ball next to bunny
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + size * 0.9, y + size * 0.3 - bounce, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Ball highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x + size * 0.85, y + size * 0.22 - bounce, size * 0.07, 0, Math.PI * 2);
        ctx.fill();
        // Ball stripe
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + size * 0.9, y + size * 0.3 - bounce, size * 0.15, -0.5, 0.5);
        ctx.stroke();
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

function drawBunnyFace(x, y, size, sleeping = false, blinking = false, mood = 'content') {
    // Eyes
    if (sleeping) {
        // Sleep eyes (upward curves — "Z" style)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.3, y - size * 0.1);
        ctx.lineTo(x - size * 0.1, y + size * 0.1);
        ctx.moveTo(x + size * 0.1, y + size * 0.1);
        ctx.lineTo(x + size * 0.3, y - size * 0.1);
        ctx.stroke();
    } else if (blinking) {
        // Blink: horizontal closed-eye lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - size * 0.28, y);
        ctx.lineTo(x - size * 0.12, y);
        ctx.moveTo(x + size * 0.12, y);
        ctx.lineTo(x + size * 0.28, y);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else if (mood === 'tired') {
        // Droopy half-closed eyes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y + size * 0.02, size * 0.1, Math.PI * 0.1, Math.PI * 0.9);
        ctx.arc(x + size * 0.2, y + size * 0.02, size * 0.1, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else if (mood === 'happy') {
        // Happy upward-crescent eyes (^_^)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y + size * 0.05, size * 0.1, Math.PI * 1.1, Math.PI * 1.9);
        ctx.arc(x + size * 0.2, y + size * 0.05, size * 0.1, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.lineCap = 'butt';
    } else {
        // Default round eyes (with highlight for more life)
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y, size * 0.1, 0, Math.PI * 2);
        ctx.arc(x + size * 0.2, y, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Tiny highlight dot for sparkle
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - size * 0.17, y - size * 0.03, size * 0.03, 0, Math.PI * 2);
        ctx.arc(x + size * 0.23, y - size * 0.03, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
    }

    // Blush cheeks when happy
    if (mood === 'happy' && !sleeping) {
        ctx.fillStyle = 'rgba(255, 120, 150, 0.45)';
        ctx.beginPath();
        ctx.arc(x - size * 0.32, y + size * 0.2, size * 0.09, 0, Math.PI * 2);
        ctx.arc(x + size * 0.32, y + size * 0.2, size * 0.09, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Nose
    ctx.fillStyle = '#ff69b4';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.3, size * 0.06, size * 0.04, 0, 0, Math.PI * 2);
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
    
    // Check in reverse order so top bunnies are checked first
    for (let i = gameState.babies.length - 1; i >= 0; i--) {
        const baby = gameState.babies[i];
        const position = getBunnyPosition(baby.id);
        
        const distance = Math.sqrt((x - position.x) ** 2 + (y - position.y) ** 2);
        const size = baby.stage === 'egg' ? 35 : 40; // Slightly larger hit area
        
        if (distance < size) {
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
function toggleShop() {
    shopState.isOpen = !shopState.isOpen;
    
    if (shopState.isOpen) {
        showShopUI();
    } else {
        hideShopUI();
    }
}

function showShopUI() {
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

    // Overlay background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🧠 Memory Match', w / 2, 35);

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
        if (card.matched) {
            ctx.fillStyle = 'rgba(76, 175, 80, 0.6)';
        } else if (card.flipped) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        } else {
            ctx.fillStyle = 'rgba(156, 39, 176, 0.85)';
        }
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

        if (card.flipped || card.matched) {
            ctx.font = `${Math.floor(cardW * 0.5)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.fillText(card.emoji, cx + cardW / 2, cy + cardH / 2 + cardW * 0.15);
        } else {
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

    // Background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = '#8BC34A';
    ctx.fillRect(0, d.groundY, w, h - d.groundY);

    // Scrolling grass detail
    ctx.fillStyle = '#7CB342';
    const offset = (d.distance * 10) % 40;
    for (let gx = -offset; gx < w; gx += 40) {
        ctx.fillRect(gx, d.groundY, 20, 4);
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
        decay: 0.005
    };
    
    if (weatherState.type === 'rain') {
        particle.vx = 0;
        particle.vy = 3 + Math.random() * 2;
        particle.color = '#4fc3f7';
        particle.size = 2;
    } else if (weatherState.type === 'snow') {
        particle.vx = (Math.random() - 0.5) * 1;
        particle.vy = 1 + Math.random();
        particle.color = '#ffffff';
        particle.size = 3 + Math.random() * 3;
    }
    
    weatherState.particles.push(particle);
}

function updateWeatherParticle(particle, deltaTime) {
    particle.x += particle.vx || 0;
    particle.y += particle.vy || 0;
    particle.life -= particle.decay;
    
    // Remove particles that fall off screen
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
        // Draw particles
        weatherState.particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.life;
            
            if (weatherState.type === 'rain') {
                ctx.fillRect(particle.x, particle.y, 2, 8);
            } else if (weatherState.type === 'snow') {
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
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