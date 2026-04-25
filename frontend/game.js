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
        { id: 'toy_ball', name: 'Bouncy Ball', price: 5, icon: '🏀', desc: 'Boosts happiness' },
        { id: 'soft_blanket', name: 'Soft Blanket', price: 8, icon: '🧣', desc: 'Better sleep & energy' },
        { id: 'carrot_treat', name: 'Carrot Treat', price: 3, icon: '🥕', desc: 'Satisfies hunger' },
        { id: 'decorative_plant', name: 'Plant', price: 12, icon: '🌿', desc: 'Passive happiness' },
        { id: 'night_light', name: 'Night Light', price: 15, icon: '🌙', desc: 'Better sleep quality' }
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

// Cave system state
let caveState = {
    isEnabled: false,
    bunniesInCave: new Set(),
    caveArea: { x: 50, y: 50, width: 150, height: 100 }
};

// Draggable bunnies state
let dragState = {
    isDragging: false,
    targetBunny: null,
    dragOffset: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 }
};
let bunnyPositions = {};
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
        return false;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('❌ Canvas context not available!');
        return false;
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
    return true;
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
            
            // Re-apply device pixel ratio scaling
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width && canvas.height) {
                ctx.scale(dpr, dpr);
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
    
    // Re-sync bunny positions after resize without discarding persisted positions
    if (gameState && gameState.babies) {
        syncBunnyPositionsFromGameState();
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
    // Use current host for socket connection to avoid CORS issues
    const socketUrl = window.location.origin;
    socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        forceNew: true
    });

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
    socket.on('achievements_data', onAchievementsData);
    socket.on('customization_saved', onCustomizationSaved);
    socket.on('memory_saved', onMemorySaved);
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
    
    // Show user-friendly reconnection message
    if (reason === 'io server disconnect') {
        showMessage('Game server restarted. Please refresh the page.', 'error');
    } else {
        showMessage('Connection lost. Attempting to reconnect...', 'error');
    }
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
    
    // CRITICAL FIX: Force initial render after successful room creation
    setTimeout(() => {
        if (canvas && ctx) {
            render();
            console.log('🎨 Initial render completed after room creation');
        }
    }, 200);
}

function onJoinedRoom(data) {
    console.log('🚪 Joined room:', data);
    roomCode = data.roomCode;
    myPlayerId = data.playerId;
    myPlayerType = data.playerType;
    gameState = data.gameState;
    
    // Save session data
    const playerName = getPlayerName();
    const bunnyColor = getSelectedBunnyColor();
    saveSessionData(roomCode, playerName, bunnyColor);
    
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

function onPartnerConnected() {
    console.log('👫 Partner connected!');
    updateConnectionStatus('connected', 'Both partners connected');
    hideRoomCodeBanner();
    showMessage('Your partner has joined! Time to care for your bunny family together! 💕', 'success');
}

function onGameStateUpdate(newGameState) {
    console.log('🎮 Game state update received:', newGameState);
    gameState = newGameState;
    syncBunnyPositionsFromGameState();
    
    // Sync inventory from server game state
    if (newGameState.shop && newGameState.shop.inventory) {
        // Find our player's inventory (check all player inventories)
        const allInv = newGameState.shop.inventory;
        const merged = {};
        Object.values(allInv).forEach(playerInv => {
            Object.entries(playerInv).forEach(([itemId, qty]) => {
                merged[itemId] = (merged[itemId] || 0) + qty;
            });
        });
        inventoryState = merged;
    }
    
    updateGameUI();
    
    // CRITICAL FIX: Force render when game state updates
    if (currentPhase === 'game' && canvas && ctx) {
        render();
    }
}

function onPlayerAction(data) {
    console.log('🎮 Player action:', data);
    
    // Create visual effect for the action
    createActionEffect(data.action, data.playerId);
    
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
    
    const baby = data.baby;
    showGrowthCelebration(baby);
    
    // Update cached game state if available
    if (gameState && gameState.babies && gameState.babies[baby.id]) {
        gameState.babies[baby.id] = baby;
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
    console.log('🐰 Bunny moved by partner:', data);
    
    if (!gameState) return;
    
    // Find the baby and update position
    const baby = gameState.babies.find(b => b.id === data.babyId);
    if (baby) {
        if (!baby.position) baby.position = { x: 400, y: 300 };
        baby.position.x = data.x;
        baby.position.y = data.y;
        baby.targetPosition = { x: data.x, y: data.y };

        const localPos = bunnyPositions[data.babyId] || getBunnyPosition(data.babyId);
        localPos.x = data.x;
        localPos.y = data.y;
        localPos.targetX = data.x;
        localPos.targetY = data.y;
        
        // Show visual feedback that partner moved the bunny
        if (data.movedBy !== myPlayerId) {
            showFloatingEffect(data.x, data.y, '👥');
        }
        
        console.log(`🐰 Updated ${data.babyId} position:`, data.x, data.y);
    }
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
        const newX = Math.max(50, Math.min((baby.position?.x || 400) + deltaX, canvas.width - 50));
        const newY = Math.max(50, Math.min((baby.position?.y || 300) + deltaY, canvas.height - 50));
        
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
    
    // CRITICAL FIX: Properly initialize canvas with retry mechanism
    let retryCount = 0;
    const maxRetries = 5;
    
    function tryInitializeCanvas() {
        const success = initializeCanvas();
        if (success !== false) {
            updateGameUI();
            
            // Ensure render loop is running
            if (!animationId) {
                startGameLoop();
            }
            
            console.log('✅ Game view activated, canvas ready:', canvas.width, 'x', canvas.height);
        } else if (retryCount < maxRetries) {
            retryCount++;
            console.log(`⏳ Canvas initialization failed, retry ${retryCount}/${maxRetries}...`);
            setTimeout(tryInitializeCanvas, 200);
        } else {
            console.error('❌ Failed to initialize canvas after multiple retries');
            showMessage('Failed to initialize game canvas. Please refresh the page.', 'error');
        }
    }
    
    // Start initialization after a short delay
    setTimeout(tryInitializeCanvas, 100);
}

// ===== GAME ACTIONS =====
let lastActionTime = {};
const ACTION_COOLDOWN = 500; // 500ms between same action

function performAction(action) {
    const now = Date.now();
    if (lastActionTime[action] && now - lastActionTime[action] < ACTION_COOLDOWN) {
        console.log(`Action ${action} still on cooldown`);
        return; // Cooldown active
    }
    lastActionTime[action] = now;
    
    if (!socket) {
        showMessage('Game not initialized. Please refresh the page.', 'error');
        return;
    }
    
    if (!socket.connected) {
        showMessage('Not connected to server. Trying to reconnect...', 'error');
        socket.connect();
        return;
    }
    
    if (!gameState || !gameState.babies) {
        showMessage('Game state not loaded yet. Please wait...', 'error');
        return;
    }
    
    if (!selectedBabyId) {
        showMessage('Please select a baby first by clicking on it.', 'error');
        return;
    }
    
    // Find the selected baby
    const baby = gameState.babies.find(b => b.id === selectedBabyId);
    if (!baby) {
        showMessage('Selected baby not found. Please select another baby.', 'error');
        // Auto-select first available baby
        if (gameState.babies.length > 0) {
            selectedBabyId = gameState.babies[0].id;
            updateBabySelection();
        }
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
            setScene('kitchen', 6000);
        } else if (action === 'play') {
            setScene('playground', 6000);
        } else if (action === 'sleep') {
            // Sleep scene stays until wake
        } else if (action === 'clean') {
            setScene('bathroom', 6000);
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
    if (!gameState || !gameState.babies) return;
    
    const clickedBaby = findBunnyAt(x, y);
    
    if (clickedBaby) {
        // Start dragging this bunny
        dragState.isDragging = true;
        dragState.targetBunny = clickedBaby;
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
    
    // Update bunny position with smooth following
    const bunnyId = dragState.targetBunny.id;
    if (!bunnyPositions[bunnyId]) {
        bunnyPositions[bunnyId] = getBunnyPosition(bunnyId);
    }
    
    // Smooth following with lerp
    const lerpFactor = 0.8;
    bunnyPositions[bunnyId].targetX = boundedX;
    bunnyPositions[bunnyId].targetY = boundedY;
    bunnyPositions[bunnyId].x = lerp(bunnyPositions[bunnyId].x, boundedX, lerpFactor);
    bunnyPositions[bunnyId].y = lerp(bunnyPositions[bunnyId].y, boundedY, lerpFactor);

    const baby = gameState?.babies?.find(b => b.id === bunnyId);
    if (baby) {
        baby.position = { x: bunnyPositions[bunnyId].x, y: bunnyPositions[bunnyId].y };
        baby.targetPosition = { x: boundedX, y: boundedY };
    }
}

function endDrag() {
    if (!dragState.isDragging || !dragState.targetBunny) return;
    
    const bunnyId = dragState.targetBunny.id;
    
    // Detect tap (short click, minimal movement) — tap eggs to hatch
    const dx = dragState.currentPosition.x - dragState.startPosition.x;
    const dy = dragState.currentPosition.y - dragState.startPosition.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);
    if (dragDist < 10) {
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
    
    // Create drop effect
    if (bunnyPositions[bunnyId]) {
        const finalX = bunnyPositions[bunnyId].targetX ?? bunnyPositions[bunnyId].x;
        const finalY = bunnyPositions[bunnyId].targetY ?? bunnyPositions[bunnyId].y;
        bunnyPositions[bunnyId].x = finalX;
        bunnyPositions[bunnyId].y = finalY;
        createDropEffect(finalX, finalY);

        const baby = gameState?.babies?.find(b => b.id === bunnyId);
        if (baby) {
            baby.position = { x: finalX, y: finalY };
            baby.targetPosition = { x: finalX, y: finalY };
        }

        if (dragDist >= 10 && socket && socket.connected) {
            socket.emit('move_bunny', {
                babyId: bunnyId,
                x: finalX,
                y: finalY,
                timestamp: Date.now()
            });
        }
    }
    
    // Check if bunny was dropped on a special interaction area
    checkDropInteractions();
    
    // Reset drag state
    dragState.isDragging = false;
    dragState.targetBunny = null;
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
        const baby = gameState?.babies?.find(b => b.id === bunnyId);
        const babyIndex = gameState?.babies?.findIndex(b => b.id === bunnyId) ?? 0;
        const rect = canvas.getBoundingClientRect();
        const fallbackX = rect.width * (0.4 + (babyIndex * 0.2));
        const fallbackY = rect.height * 0.7;
        const sourceX = baby?.targetPosition?.x ?? baby?.position?.x ?? fallbackX;
        const sourceY = baby?.targetPosition?.y ?? baby?.position?.y ?? fallbackY;
        bunnyPositions[bunnyId] = {
            x: sourceX,
            y: sourceY,
            targetX: sourceX,
            targetY: sourceY
        };
    }
    return bunnyPositions[bunnyId];
}

function syncBunnyPositionsFromGameState() {
    if (!gameState?.babies || !canvas) return;

    const rect = canvas.getBoundingClientRect();

    gameState.babies.forEach((baby, index) => {
        const fallbackX = rect.width * (0.4 + (index * 0.2));
        const fallbackY = rect.height * 0.7;
        const sourceX = baby?.targetPosition?.x ?? baby?.position?.x ?? fallbackX;
        const sourceY = baby?.targetPosition?.y ?? baby?.position?.y ?? fallbackY;

        if (!bunnyPositions[baby.id]) {
            bunnyPositions[baby.id] = {
                x: sourceX,
                y: sourceY,
                targetX: sourceX,
                targetY: sourceY
            };
            return;
        }

        if (dragState.isDragging && dragState.targetBunny?.id === baby.id) {
            return;
        }

        bunnyPositions[baby.id].x = sourceX;
        bunnyPositions[baby.id].y = sourceY;
        bunnyPositions[baby.id].targetX = sourceX;
        bunnyPositions[baby.id].targetY = sourceY;
    });
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
    // Always render if dragging
    if (dragState.isDragging) return true;
    
    // Render if particles are active
    if (activeParticles.length > 0) return true;
    
    // Render if any bunny animations are active
    for (const animState of Object.values(bunnyAnimStates)) {
        if (Math.abs(animState.bounceSpeed) > 0.1 || Math.abs(animState.scale - animState.targetScale) > 0.01) {
            return true;
        }
    }
    
    // Render if background needs refresh
    if (backgroundNeedsRedraw || dirtyBackground) {
        dirtyBackground = false;
        return true;
    }
    
    // Render every 2 seconds to catch missed updates
    if (timestamp % 2000 < 33) return true;
    
    return false;
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
    drawActiveParticles();
    drawWeatherEffects();
    drawUI();
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

function setScene(scene, durationMs) {
    if (currentScene !== scene) {
        backgroundNeedsRedraw = true;
        dirtyBackground = true;
    }
    currentScene = scene;
    if (sceneTimer) clearTimeout(sceneTimer);
    if (durationMs) {
        sceneTimer = setTimeout(() => { 
            currentScene = 'default'; 
            sceneTimer = null; 
            backgroundNeedsRedraw = true;
            dirtyBackground = true;
        }, durationMs);
    }
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
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#e3f2fd'); // Sky blue
    gradient.addColorStop(0.7, '#c8e6c9'); // Gentle green
    gradient.addColorStop(1, '#a5d6a7'); // Darker green
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    
    drawCloudsToContext(context, width, height);
    drawFlowersToContext(context, width, height);
    drawCaveToContext(context, width, height);
}

function drawNightBackgroundToContext(context, width, height) {
    // Dark sky gradient
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a3e'); // Deep navy
    gradient.addColorStop(0.4, '#2d2b55'); // Dark purple
    gradient.addColorStop(0.7, '#3d3566'); // Soft purple
    gradient.addColorStop(1, '#2a2a4a'); // Dark floor
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    
    // Simple stars for cached background
    const starPositions = [
        {x: 0.1, y: 0.08}, {x: 0.25, y: 0.15}, {x: 0.4, y: 0.05},
        {x: 0.55, y: 0.12}, {x: 0.7, y: 0.07}, {x: 0.85, y: 0.18}
    ];
    
    context.fillStyle = 'rgba(255, 255, 200, 0.8)';
    starPositions.forEach((star, i) => {
        context.beginPath();
        context.arc(star.x * width, star.y * height, 2, 0, Math.PI * 2);
        context.fill();
    });
    
    // Simple moon
    const moonX = width * 0.82;
    const moonY = height * 0.12;
    context.fillStyle = '#fffde7';
    context.beginPath();
    context.arc(moonX, moonY, 25, 0, Math.PI * 2);
    context.fill();
    
    // Floor
    context.fillStyle = '#4a3f6b';
    context.fillRect(0, height * 0.75, width, height * 0.25);
}

function drawKitchenBackground(width, height) {
    // Warm kitchen walls
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#fff8e1'); // Warm cream ceiling
    gradient.addColorStop(0.3, '#ffe0b2'); // Peach wall
    gradient.addColorStop(1, '#ffcc80'); // Warm orange floor
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Tiled floor
    ctx.fillStyle = '#ffe0b2';
    const floorY = height * 0.72;
    ctx.fillRect(0, floorY, width, height - floorY);
    // Tile pattern
    const tileSize = 30;
    for (let tx = 0; tx < width; tx += tileSize) {
        for (let ty = floorY; ty < height; ty += tileSize) {
            if ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0) {
                ctx.fillStyle = '#ffecb3';
            } else {
                ctx.fillStyle = '#ffe0b2';
            }
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
        // Handle
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
    ctx.fillStyle = '#757575';
    ctx.beginPath();
    ctx.arc(fridgeX + 10, floorY - fridgeH * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Food bowl on counter
    ctx.fillStyle = '#ff8a80';
    ctx.beginPath();
    ctx.ellipse(width * 0.45, floorY - 20, 25, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffab91';
    ctx.beginPath();
    ctx.ellipse(width * 0.45, floorY - 22, 20, 8, 0, 0, Math.PI);
    ctx.fill();
    
    // Carrot on counter
    ctx.fillStyle = '#ff9800';
    ctx.beginPath();
    ctx.moveTo(width * 0.55, floorY - 15);
    ctx.lineTo(width * 0.55 + 15, floorY - 25);
    ctx.lineTo(width * 0.55 + 5, floorY - 15);
    ctx.fill();
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.moveTo(width * 0.55 + 12, floorY - 25);
    ctx.lineTo(width * 0.55 + 18, floorY - 32);
    ctx.lineTo(width * 0.55 + 8, floorY - 28);
    ctx.fill();
    
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
    // Bright blue sky
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#81d4fa'); // Bright sky
    gradient.addColorStop(0.5, '#b3e5fc'); // Light sky
    gradient.addColorStop(0.65, '#aed581'); // Grass start
    gradient.addColorStop(1, '#7cb342'); // Rich grass
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Sun
    const time = Date.now() * 0.001;
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
    
    const groundY = height * 0.62;
    
    // Swing set
    const swingX = width * 0.25;
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 4;
    // Frame
    ctx.beginPath();
    ctx.moveTo(swingX - 30, groundY);
    ctx.lineTo(swingX, groundY - 80);
    ctx.lineTo(swingX + 30, groundY);
    ctx.stroke();
    // Ropes and seat
    const swingOffset = Math.sin(time * 2) * 8;
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(swingX - 8, groundY - 75);
    ctx.lineTo(swingX - 8 + swingOffset, groundY - 25);
    ctx.moveTo(swingX + 8, groundY - 75);
    ctx.lineTo(swingX + 8 + swingOffset, groundY - 25);
    ctx.stroke();
    ctx.fillStyle = '#ff7043';
    ctx.fillRect(swingX - 12 + swingOffset, groundY - 27, 24, 5);
    
    // Slide
    const slideX = width * 0.6;
    ctx.fillStyle = '#e040fb';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(slideX, groundY - 70);
    ctx.quadraticCurveTo(slideX + 30, groundY - 30, slideX + 55, groundY);
    ctx.lineTo(slideX + 45, groundY);
    ctx.quadraticCurveTo(slideX + 22, groundY - 25, slideX + 8, groundY - 70);
    ctx.closePath();
    ctx.fill();
    // Ladder
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(slideX - 5, groundY);
    ctx.lineTo(slideX, groundY - 70);
    ctx.moveTo(slideX - 12, groundY);
    ctx.lineTo(slideX - 7, groundY - 70);
    ctx.stroke();
    for (let r = 0; r < 4; r++) {
        const ry = groundY - 15 - r * 15;
        ctx.beginPath();
        ctx.moveTo(slideX - 11 + r * 0.5, ry);
        ctx.lineTo(slideX - 4 + r * 0.3, ry);
        ctx.stroke();
    }
    
    // Sandbox
    const sandX = width * 0.42, sandY = groundY + 10;
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.ellipse(sandX, sandY, 35, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4a24e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sandX, sandY, 35, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Tiny bucket
    ctx.fillStyle = '#f44336';
    ctx.fillRect(sandX + 10, sandY - 12, 10, 10);
    ctx.fillStyle = '#ffcdd2';
    ctx.fillRect(sandX + 10, sandY - 14, 10, 3);
    
    // Flowers in grass
    const flowerColors = ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#ff9800'];
    for (let i = 0; i < 8; i++) {
        const fx = width * (0.05 + i * 0.12);
        const fy = groundY + 25 + Math.sin(i * 2.5) * 10;
        drawFlower(fx, fy, flowerColors[i % flowerColors.length]);
    }
    
    // Butterflies
    ctx.fillStyle = `rgba(255, 105, 180, ${0.6 + 0.3 * Math.sin(time * 3)})`;
    const bfx = width * 0.7 + Math.sin(time * 1.5) * 20;
    const bfy = height * 0.35 + Math.cos(time * 2) * 10;
    ctx.font = '14px Arial';
    ctx.fillText('🦋', bfx, bfy);
    ctx.fillText('🦋', bfx - 60, bfy + 20);
}

function drawBathroomBackground(width, height) {
    // Soft blue-white bathroom
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#e8f5e9'); // Light mint ceiling
    gradient.addColorStop(0.5, '#e0f7fa'); // Soft cyan wall
    gradient.addColorStop(1, '#b2ebf2'); // Tile floor
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
    
    // Bathtub
    const tubX = width * 0.25, tubY = height * 0.55, tubW = width * 0.5, tubH = 60;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(tubX + tubW / 2, tubY + tubH / 2, tubW / 2, tubH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(tubX + tubW / 2, tubY + tubH / 2, tubW / 2, tubH / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Water
    ctx.fillStyle = 'rgba(129, 212, 250, 0.5)';
    ctx.beginPath();
    ctx.ellipse(tubX + tubW / 2, tubY + tubH / 2 + 5, tubW / 2 - 8, tubH / 2 - 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Bubbles
    const time = Date.now() * 0.001;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let b = 0; b < 6; b++) {
        const bx = tubX + 30 + b * (tubW / 7);
        const by = tubY + 10 + Math.sin(time * 2 + b) * 8;
        const br = 4 + Math.sin(time + b * 0.7) * 2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Rubber duck
    ctx.font = '20px Arial';
    const duckX = tubX + tubW * 0.65 + Math.sin(time * 1.5) * 5;
    ctx.fillText('🐤', duckX, tubY + 25);
    
    // Soap bottle
    ctx.fillStyle = '#ce93d8';
    ctx.fillRect(width * 0.8, height * 0.4, 15, 30);
    ctx.fillStyle = '#ab47bc';
    ctx.fillRect(width * 0.8 + 3, height * 0.38, 9, 8);
}

function drawCloudsToContext(context, width, height) {
    const time = Date.now() * 0.001;
    
    context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    
    // Cloud 1
    const cloud1X = (time * 10) % (width + 100) - 50;
    const cloud1Y = 30;
    drawCloudToContext(context, cloud1X, cloud1Y, 30);
    
    // Cloud 2
    const cloud2X = (time * 15) % (width + 120) - 60;
    const cloud2Y = 60;
    drawCloudToContext(context, cloud2X, cloud2Y, 25);
}

function drawCloudToContext(context, x, y, size) {
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.arc(x + size * 0.7, y, size * 0.8, 0, Math.PI * 2);
    context.arc(x + size * 1.3, y, size * 0.6, 0, Math.PI * 2);
    context.arc(x + size * 0.65, y - size * 0.5, size * 0.7, 0, Math.PI * 2);
    context.fill();
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
    
    // Cave entrance - brown rocky arch
    context.fillStyle = '#5d4037'; // Dark brown
    context.beginPath();
    context.arc(cave.x + cave.width/2, cave.y + cave.height, cave.width/2, Math.PI, 0);
    context.fill();
    
    // Cave interior - darker, cozy
    context.fillStyle = '#3e2723'; // Very dark brown
    context.beginPath();
    context.arc(cave.x + cave.width/2, cave.y + cave.height - 10, cave.width/2 - 10, Math.PI, 0);
    context.fill();
    
    // Cozy details - soft hay/blankets
    context.fillStyle = '#ffb74d'; // Warm golden hay color
    for (let i = 0; i < 3; i++) {
        const hayX = cave.x + 20 + i * 30;
        const hayY = cave.y + cave.height - 15;
        context.beginPath();
        context.ellipse(hayX, hayY, 12, 6, 0, 0, Math.PI * 2);
        context.fill();
    }
    
    // Warm glow effect
    const gradient = context.createRadialGradient(
        cave.x + cave.width/2, cave.y + cave.height/2, 0,
        cave.x + cave.width/2, cave.y + cave.height/2, cave.width/2
    );
    gradient.addColorStop(0, 'rgba(255, 183, 77, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 183, 77, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cave.x + cave.width/2, cave.y + cave.height/2, cave.width/2, 0, Math.PI * 2);
    context.fill();
    
    // Cave label
    context.fillStyle = '#3e2723';
    context.font = 'bold 14px Arial';
    context.textAlign = 'center';
    context.fillText('🏔️ Cozy Cave', cave.x + cave.width/2, cave.y - 5);
    context.textAlign = 'left'; // Reset
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
    
    // Black parent bunny (left side)
    const blackX = width * 0.2;
    const blackY = height * 0.6;
    drawParentBunny(blackX, blackY, '#2c2c2c', 'black');
    
    // White parent bunny (right side)
    const whiteX = width * 0.8;
    const whiteY = height * 0.6;
    drawParentBunny(whiteX, whiteY, '#ffffff', 'white');
    
    // Draw player names if available
    drawPlayerNames(blackX, blackY, whiteX, whiteY, width, height);
}

function drawParentBunny(x, y, color, type) {
    const size = 40;
    const time = Date.now() * 0.003;
    
    // Gentle bounce animation
    const bounceY = y + Math.sin(time + (type === 'black' ? 0 : Math.PI)) * 3;
    
    ctx.save();
    ctx.translate(x, bounceY);
    
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (color === '#ffffff') {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Ears
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.8, size * 0.3, size * 0.6, -0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.8, size * 0.3, size * 0.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner ears
    ctx.fillStyle = type === 'white' ? '#ffb3d9' : '#ff69b4';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.7, size * 0.15, size * 0.3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.7, size * 0.15, size * 0.3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    drawBunnyFace(0, -size * 0.2, size * 0.8);
    
    // Tail
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-size * 0.8, size * 0.3, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    if (color === '#ffffff') {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.stroke();
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
    
    // Try to get player names from localStorage or game state
    if (gameState.players) {
        gameState.players.forEach(player => {
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
    const time = Date.now() * 0.004;
    
    ctx.save();
    
    // Apply scaling and bounce animation
    if (animState) {
        const bounceY = y + animState.bounceOffset;
        ctx.translate(x, bounceY);
        ctx.scale(animState.scale, animState.scale);
        
        // Draw shadow when being dragged
        if (animState.isBeingDragged) {
            drawBunnyShadow(0, 20, animState.scale);
        }
        
        ctx.translate(-x, -bounceY);
    }
    
    // Enhanced selection indicator
    if (isSelected) {
        drawSelectionIndicator(x, y, animState);
    }
    
    // Draw drag indicator if being dragged
    if (dragState.isDragging && dragState.targetBunny?.id === baby.id) {
        drawDragIndicator(x, y);
    }
    
    if (stage === 'egg') {
        drawEgg(x, y, baby);
    } else {
        drawBunnyBaby(x, y, baby);
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
    
    // Body
    ctx.fillStyle = bunnyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (bunnyColor === '#ffffff' || genetics.color === 'spotted') {
        ctx.strokeStyle = '#ddd';
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
    
    // Ears
    ctx.fillStyle = bunnyColor;
    const earSize = size * 0.4;
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.9, earSize * 0.6, earSize, -0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.9, earSize * 0.6, earSize, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner ears
    ctx.fillStyle = '#ffb3d9';
    ctx.beginPath();
    ctx.ellipse(-size * 0.3, -size * 0.8, earSize * 0.3, earSize * 0.6, -0.3, 0, Math.PI * 2);
    ctx.ellipse(size * 0.3, -size * 0.8, earSize * 0.3, earSize * 0.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Face
    drawBunnyFace(0, -size * 0.3, size * 0.6, baby.sleeping);
    
    // Tail
    ctx.fillStyle = bunnyColor;
    ctx.beginPath();
    ctx.arc(-size * 0.9, size * 0.2, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
    
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

function drawBunnyFace(x, y, size, sleeping = false) {
    // Eyes
    if (sleeping) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.3, y - size * 0.1);
        ctx.lineTo(x - size * 0.1, y + size * 0.1);
        ctx.moveTo(x + size * 0.1, y + size * 0.1);
        ctx.lineTo(x + size * 0.3, y - size * 0.1);
        ctx.stroke();
    } else {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y, size * 0.1, 0, Math.PI * 2);
        ctx.arc(x + size * 0.2, y, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Nose
    ctx.fillStyle = '#ff69b4';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.3, size * 0.06, size * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.35);
    ctx.quadraticCurveTo(x - size * 0.1, y + size * 0.5, x - size * 0.15, y + size * 0.45);
    ctx.moveTo(x, y + size * 0.35);
    ctx.quadraticCurveTo(x + size * 0.1, y + size * 0.5, x + size * 0.15, y + size * 0.45);
    ctx.stroke();
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
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = -Math.random() * 3 - 1;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.size = Math.random() * 8 + 4;
        this.type = type;
        this.color = color;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }
    
    reset() {
        this.life = 0;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
    }
    
    update(deltaTime) {
        this.x += this.vx * deltaTime * 0.1;
        this.y += this.vy * deltaTime * 0.1;
        this.vy += deltaTime * 0.005; // gravity
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
            ctx.fillStyle = this.color;
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('❤️', 0, 0);
        } else if (this.type === 'sparkle') {
            ctx.fillStyle = this.color;
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('✨', 0, 0);
        } else if (this.type === 'star') {
            ctx.fillStyle = this.color;
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('⭐', 0, 0);
        } else if (this.type === 'pickup') {
            ctx.fillStyle = this.color;
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('✋', 0, 0);
        } else if (this.type === 'drop') {
            ctx.fillStyle = this.color;
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('💨', 0, 0);
        } else if (this.type === 'confetti') {
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        }
        
        ctx.restore();
    }
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
    // This is handled by socket events
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
    
    if (bar) {
        bar.style.width = `${value}%`;
    }
    if (valueEl) {
        valueEl.textContent = value;
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
    const rect = canvas.getBoundingClientRect();
    
    // Check black bunny
    const blackX = rect.width * 0.2;
    const blackY = rect.height * 0.6;
    const blackDistance = Math.sqrt((x - blackX) ** 2 + (y - blackY) ** 2);
    
    if (blackDistance < 40) {
        return { type: 'black', x: blackX, y: blackY };
    }
    
    // Check white bunny
    const whiteX = rect.width * 0.8;
    const whiteY = rect.height * 0.6;
    const whiteDistance = Math.sqrt((x - whiteX) ** 2 + (y - whiteY) ** 2);
    
    if (whiteDistance < 40) {
        return { type: 'white', x: whiteX, y: whiteY };
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
function showGrowthCelebration(baby) {
    // Create confetti particles
    for (let i = 0; i < 20; i++) {
        createConfettiParticle();
    }
    
    // Show celebration message
    const celebrationEl = document.createElement('div');
    celebrationEl.className = 'growth-celebration';
    celebrationEl.innerHTML = `
        <div class="celebration-content">
            <h2>🎉 ${baby.name || 'Baby'} Grew! 🎉</h2>
            <p>Now a ${baby.stage}!</p>
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
    
    if (!gameState || !gameState.babies || gameState.babies.length === 0) {
        showMessage('No bunnies to give items to!', 'error');
        return;
    }
    
    const item = shopState.items.find(i => i.id === itemId);
    
    let bunniesHtml = gameState.babies.filter(b => b.stage !== 'egg').map(baby => `
        <button class="action-btn pet bunny-pick-btn" data-baby-id="${baby.id}" style="margin:5px;min-width:120px;">
            ${baby.genetics?.color === 'black' ? '🐰⬛' : '🐰⬜'} ${baby.name || baby.id}
        </button>
    `).join('');
    
    if (!bunniesHtml) {
        bunniesHtml = '<div style="padding:10px;color:#999;">No hatched bunnies yet!</div>';
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
    const baby = gameState.babies.find(b => b.id === babyId);
    showMessage(`Gave ${item ? item.name : 'item'} to ${baby ? baby.name : 'bunny'}! ${item ? item.icon : '🎁'}`, 'success');
    
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
    if (shopCarrotEl && gameState && gameState.carrots !== undefined) {
        shopCarrotEl.textContent = gameState.carrots;
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
function drawBabyWithStageVisuals(baby, x, y) {
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