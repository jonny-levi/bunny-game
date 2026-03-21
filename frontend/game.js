// Game state variables
let socket = null;
let currentRoom = null;
let playerId = null;
let playerColor = null;
let game = null;
let gameScene = null;
let gameStarted = false;

// Game state
let gameState = null;
let selectedBabyId = null;
let babySprites = new Map();
let animations = new Map();
let lastGameState = null;

// Initialize socket connection
function initSocket() {
    socket = io();
    
    // Room events
    socket.on('roomCreated', (data) => {
        currentRoom = data.roomCode;
        playerId = data.playerId;
        playerColor = data.playerColor;
        showLobby();
    });
    
    socket.on('roomJoined', (data) => {
        currentRoom = data.roomCode;
        playerId = data.playerId;
        playerColor = data.playerColor;
        showLobby();
    });
    
    socket.on('roomState', (data) => {
        updateLobbyPlayers(data.players);
    });
    
    socket.on('gameStart', () => {
        startGame();
    });
    
    socket.on('gameState', (data) => {
        gameState = data;
        updateGameDisplay();
    });
    
    socket.on('babyGrowth', (data) => {
        showNotification(data.message);
    });
    
    socket.on('babyHatched', (data) => {
        showNotification(data.message);
    });
    
    socket.on('error', (message) => {
        showError(message);
    });
}

// UI Functions
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        showError('Please enter your name!');
        return;
    }
    
    if (!socket) initSocket();
    socket.emit('createRoom', playerName);
}

function joinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!playerName) {
        showError('Please enter your name!');
        return;
    }
    
    if (!roomCode) {
        showError('Please enter a family code!');
        return;
    }
    
    if (!socket) initSocket();
    socket.emit('joinRoom', { roomCode, playerName });
}

function playerReady() {
    if (socket && currentRoom) {
        socket.emit('playerReady', currentRoom);
        document.getElementById('readyButton').style.display = 'none';
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.getElementById('notifications').appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showLobby() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('roomCodeDisplay').textContent = currentRoom;
}

function updateLobbyPlayers(players) {
    const statusDiv = document.getElementById('playersStatus');
    statusDiv.innerHTML = '';
    
    players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-status ${player.ready ? 'ready' : 'not-ready'}`;
        
        const icon = player.color === 'black' ? '🐰⬛' : '🐰⬜';
        const status = player.ready ? '✅ Ready' : '⏳ Not Ready';
        
        playerDiv.innerHTML = `${icon} ${player.name} ${status}`;
        statusDiv.appendChild(playerDiv);
    });
    
    // Show ready button if we have 2 players and current player isn't ready
    const currentPlayer = players.find(p => p.id === playerId);
    if (players.length >= 2 && currentPlayer && !currentPlayer.ready) {
        document.getElementById('readyButton').style.display = 'block';
    }
}

function backToMenu() {
    if (game) {
        game.destroy(true);
        game = null;
    }
    
    gameStarted = false;
    currentRoom = null;
    playerId = null;
    playerColor = null;
    selectedBabyId = null;
    
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'block';
    
    // Reset forms
    document.getElementById('playerName').value = '';
    document.getElementById('roomCode').value = '';
    document.getElementById('readyButton').style.display = 'none';
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// Game Functions
function startGame() {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    gameStarted = true;
    
    initPhaser();
}

function initPhaser() {
    const gameArea = document.getElementById('gameArea');
    const rect = gameArea.getBoundingClientRect();
    
    const config = {
        type: Phaser.AUTO,
        width: rect.width || 800,
        height: rect.height || 400,
        parent: 'phaserCanvas',
        backgroundColor: 'transparent',
        scene: {
            preload: preload,
            create: create,
            update: update
        },
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };
    
    game = new Phaser.Game(config);
}

function preload() {
    // No external assets needed - we'll draw everything programmatically
}

function create() {
    gameScene = this;
    
    // Initialize sprite containers
    babySprites.clear();
    animations.clear();
    
    // Make game area clickable
    this.input.on('pointerdown', (pointer) => {
        const x = pointer.x;
        const y = pointer.y;
        
        // Check if clicking on a baby
        if (gameState && gameState.family) {
            gameState.family.babies.forEach(baby => {
                const distance = Math.sqrt(Math.pow(baby.x - x, 2) + Math.pow(baby.y - y, 2));
                if (distance < 50) {
                    selectBaby(baby.id);
                }
            });
        }
    });
}

function update() {
    if (!gameState) return;
    
    // Update baby sprites
    updateBabySprites();
    
    // Update animations
    updateAnimations();
}

function updateGameDisplay() {
    if (!gameState) return;
    
    // Update connection status
    updateConnectionStatus();
    
    // Update day/night cycle
    updateDayNight();
    
    // Update family stats
    updateFamilyStats();
    
    // Update baby status cards
    updateBabyStatusCards();
    
    // Update garden
    updateGarden();
    
    lastGameState = JSON.parse(JSON.stringify(gameState));
}

function updateConnectionStatus() {
    const players = gameState.players || [];
    
    players.forEach((player, index) => {
        const prefix = index === 0 ? 'player1' : 'player2';
        document.getElementById(`${prefix}Name`).textContent = player.name;
        
        const statusElement = document.getElementById(`${prefix}Status`);
        statusElement.className = `status-indicator ${player.connected ? '' : 'disconnected'}`;
    });
}

function updateDayNight() {
    const isDaytime = gameState.dayNightCycle === 'day';
    document.getElementById('dayNightIcon').textContent = isDaytime ? '☀️' : '🌙';
    document.getElementById('timeDisplay').textContent = isDaytime ? 'Day' : 'Night';
    
    // Change game area background based on time
    const gameArea = document.getElementById('gameArea');
    if (isDaytime) {
        gameArea.style.background = 'linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 100%)';
    } else {
        gameArea.style.background = 'linear-gradient(135deg, #191970 0%, #4b0082 100%)';
    }
}

function updateFamilyStats() {
    document.getElementById('carrotCount').textContent = gameState.family.carrots;
    document.getElementById('familyLove').textContent = Math.round(gameState.family.love);
    document.getElementById('generation').textContent = gameState.family.generation;
}

function updateBabyStatusCards() {
    const container = document.getElementById('babiesStatus');
    container.innerHTML = '';
    
    gameState.family.babies.forEach(baby => {
        const card = createBabyStatusCard(baby);
        container.appendChild(card);
    });
}

function createBabyStatusCard(baby) {
    const card = document.createElement('div');
    card.className = `baby-card ${selectedBabyId === baby.id ? 'selected-baby' : ''}`;
    card.onclick = () => selectBaby(baby.id);
    
    const stageEmoji = getStageEmoji(baby.stage);
    const moodEmoji = getMoodEmoji(baby.mood);
    
    card.innerHTML = `
        <div class="baby-name">
            ${stageEmoji} ${baby.name} ${moodEmoji}
            <span class="baby-stage">${baby.stage}</span>
            ${baby.isCrying ? '<span style="color: red;">😭</span>' : ''}
        </div>
        ${baby.stage === 'egg' ? createEggProgress(baby) : createNeedsGrid(baby)}
    `;
    
    return card;
}

function createEggProgress(baby) {
    return `
        <div style="text-align: center; padding: 10px;">
            <p><strong>🥚 Hatching Progress</strong></p>
            <div class="meter-bar" style="margin: 10px auto; width: 80%;">
                <div class="meter-fill" style="width: ${baby.hatchProgress}%; background: #ff69b4;"></div>
            </div>
            <p>Tap together to hatch! (${baby.hatchProgress}%)</p>
        </div>
    `;
}

function createNeedsGrid(baby) {
    const needs = [
        { label: '🥕', value: baby.hunger, type: 'hunger' },
        { label: '😊', value: baby.happiness, type: 'happiness' },
        { label: '💤', value: baby.energy, type: 'energy' },
        { label: '🧹', value: baby.cleanliness, type: 'cleanliness' },
        { label: '❤️', value: baby.love, type: 'love' }
    ];
    
    let html = '<div class="needs-grid">';
    needs.forEach(need => {
        html += `
            <div class="need-meter">
                <div class="need-label">${need.label}</div>
                <div class="meter-bar">
                    <div class="meter-fill ${need.type}" style="width: ${need.value}%;"></div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

function updateGarden() {
    const gardenContainer = document.getElementById('gardenCarrots');
    const gardenCount = document.getElementById('gardenCount');
    
    gardenCount.textContent = gameState.garden.carrots;
    
    // Clear and repopulate garden carrots
    gardenContainer.innerHTML = '';
    for (let i = 0; i < gameState.garden.carrots; i++) {
        const carrot = document.createElement('div');
        carrot.textContent = '🥕';
        carrot.style.fontSize = '1.2em';
        gardenContainer.appendChild(carrot);
    }
}

function updateBabySprites() {
    if (!gameScene || !gameState) return;
    
    gameState.family.babies.forEach(baby => {
        let sprite = babySprites.get(baby.id);
        
        if (!sprite) {
            sprite = createBabySprite(baby);
            babySprites.set(baby.id, sprite);
        } else {
            updateBabySprite(sprite, baby);
        }
    });
    
    // Remove sprites for babies that no longer exist
    babySprites.forEach((sprite, babyId) => {
        const exists = gameState.family.babies.some(baby => baby.id === babyId);
        if (!exists) {
            sprite.destroy();
            babySprites.delete(babyId);
        }
    });
}

function createBabySprite(baby) {
    const sprite = gameScene.add.group();
    
    // Create visual elements based on stage
    const elements = createBabyVisual(baby);
    sprite.addMultiple(elements);
    
    // Store reference to elements for easy updating
    sprite.babyData = {
        id: baby.id,
        elements: elements,
        lastX: baby.x,
        lastY: baby.y
    };
    
    return sprite;
}

function createBabyVisual(baby) {
    const elements = [];
    const x = baby.x;
    const y = baby.y;
    const size = baby.size * 30; // Base size
    
    if (baby.stage === 'egg') {
        // Draw egg
        const egg = gameScene.add.ellipse(x, y, size * 0.8, size, 0xffffff);
        egg.setStrokeStyle(3, 0xd3d3d3);
        elements.push(egg);
        
        // Add some spots
        const spot1 = gameScene.add.circle(x - 5, y - 5, 3, 0xffb3d9);
        const spot2 = gameScene.add.circle(x + 3, y + 8, 2, 0xffb3d9);
        elements.push(spot1, spot2);
    } else {
        // Draw bunny body
        const body = gameScene.add.circle(x, y, size, baby.color);
        body.setStrokeStyle(2, 0x000000);
        elements.push(body);
        
        // Draw ears
        const ear1 = gameScene.add.triangle(x - size * 0.4, y - size * 0.7, 0, 0, 8, 20, 16, 0, 0xffb3d9);
        const ear2 = gameScene.add.triangle(x + size * 0.4, y - size * 0.7, 0, 0, 8, 20, 16, 0, 0xffb3d9);
        elements.push(ear1, ear2);
        
        // Draw eyes based on mood
        if (baby.isAwake && baby.stage !== 'egg') {
            const eyeSize = Math.max(2, size * 0.15);
            const eye1 = gameScene.add.circle(x - size * 0.3, y - size * 0.2, eyeSize, 0x000000);
            const eye2 = gameScene.add.circle(x + size * 0.3, y - size * 0.2, eyeSize, 0x000000);
            
            if (baby.mood === 'happy') {
                // Add sparkles in eyes
                const sparkle1 = gameScene.add.circle(x - size * 0.25, y - size * 0.25, 1, 0xffffff);
                const sparkle2 = gameScene.add.circle(x + size * 0.35, y - size * 0.25, 1, 0xffffff);
                elements.push(sparkle1, sparkle2);
            }
            
            elements.push(eye1, eye2);
        } else if (!baby.isAwake) {
            // Sleeping eyes (curved lines)
            const sleepEye1 = gameScene.add.arc(x - size * 0.3, y - size * 0.2, 8, 0, Math.PI, false, 0x000000);
            const sleepEye2 = gameScene.add.arc(x + size * 0.3, y - size * 0.2, 8, 0, Math.PI, false, 0x000000);
            elements.push(sleepEye1, sleepEye2);
        }
        
        // Draw nose
        const nose = gameScene.add.circle(x, y + size * 0.1, 2, 0xff69b4);
        elements.push(nose);
        
        // Add mood-specific elements
        if (baby.isCrying) {
            // Add tears
            const tear1 = gameScene.add.circle(x - size * 0.4, y, 3, 0x87ceeb);
            const tear2 = gameScene.add.circle(x + size * 0.4, y, 3, 0x87ceeb);
            elements.push(tear1, tear2);
        }
    }
    
    // Make interactive
    elements.forEach(element => {
        element.setInteractive();
        element.on('pointerdown', () => selectBaby(baby.id));
    });
    
    return elements;
}

function updateBabySprite(sprite, baby) {
    const data = sprite.babyData;
    const elements = data.elements;
    
    // Update position if moved
    if (baby.x !== data.lastX || baby.y !== data.lastY) {
        const deltaX = baby.x - data.lastX;
        const deltaY = baby.y - data.lastY;
        
        elements.forEach(element => {
            element.x += deltaX;
            element.y += deltaY;
        });
        
        data.lastX = baby.x;
        data.lastY = baby.y;
    }
    
    // Apply animations
    baby.animations.forEach(anim => {
        applyAnimation(elements, anim);
    });
    
    // Apply crying shake
    if (baby.isCrying) {
        const shake = Math.sin(Date.now() * 0.02) * 2;
        elements.forEach(element => {
            element.x += shake;
        });
    }
}

function updateAnimations() {
    animations.forEach((anim, key) => {
        if (Date.now() - anim.startTime > anim.duration) {
            animations.delete(key);
        }
    });
}

function applyAnimation(elements, anim) {
    const progress = Math.min(1, (Date.now() - anim.startTime) / anim.duration);
    
    switch (anim.type) {
        case 'hearts':
            if (!animations.has(`hearts_${anim.startTime}`)) {
                // Create floating hearts
                for (let i = 0; i < 3; i++) {
                    const heart = gameScene.add.text(
                        elements[0].x + (Math.random() - 0.5) * 40,
                        elements[0].y - 20,
                        '❤️',
                        { fontSize: '16px' }
                    );
                    
                    gameScene.tweens.add({
                        targets: heart,
                        y: heart.y - 50,
                        alpha: 0,
                        duration: 2000,
                        onComplete: () => heart.destroy()
                    });
                }
                
                animations.set(`hearts_${anim.startTime}`, anim);
            }
            break;
            
        case 'celebrate':
            // Bounce animation
            const bounce = Math.sin(progress * Math.PI * 6) * 10;
            elements.forEach(element => {
                element.y += bounce * 0.1;
            });
            break;
            
        case 'eating':
            // Simple size pulse
            const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
            elements[0].scaleX = scale;
            elements[0].scaleY = scale;
            break;
    }
}

function getStageEmoji(stage) {
    switch (stage) {
        case 'egg': return '🥚';
        case 'newborn': return '👶';
        case 'toddler': return '🧒';
        case 'young': return '🧑';
        case 'adult': return '👨';
        default: return '🐰';
    }
}

function getMoodEmoji(mood) {
    switch (mood) {
        case 'happy': return '😊';
        case 'content': return '😌';
        case 'sad': return '😔';
        case 'crying': return '😭';
        case 'sleeping': return '💤';
        default: return '🙂';
    }
}

function selectBaby(babyId) {
    selectedBabyId = babyId;
    
    // Update visual selection
    updateBabyStatusCards();
    
    // Highlight selected baby sprite
    babySprites.forEach((sprite, id) => {
        const elements = sprite.babyData.elements;
        if (id === babyId) {
            // Add selection glow
            elements.forEach(element => {
                element.setTint(0xffff88);
            });
        } else {
            // Remove glow
            elements.forEach(element => {
                element.clearTint();
            });
        }
    });
}

// Game Actions
function performAction(actionType) {
    if (!socket || !currentRoom || !selectedBabyId) {
        showNotification('Please select a baby first!');
        return;
    }
    
    const baby = gameState.family.babies.find(b => b.id === selectedBabyId);
    if (!baby) return;
    
    // Special handling for egg tapping
    if (baby.stage === 'egg' && (actionType === 'feed' || actionType === 'pet')) {
        socket.emit('tapEgg', { roomCode: currentRoom, babyId: selectedBabyId });
        return;
    }
    
    // Regular actions
    switch (actionType) {
        case 'feed':
            if (gameState.family.carrots > 0) {
                socket.emit('feedBaby', { roomCode: currentRoom, babyId: selectedBabyId });
            } else {
                showNotification('No carrots! Harvest some from the garden! 🥕');
            }
            break;
            
        case 'play':
            socket.emit('playWithBaby', { roomCode: currentRoom, babyId: selectedBabyId });
            break;
            
        case 'sleep':
            if (baby.isAwake) {
                socket.emit('sleepBaby', { roomCode: currentRoom, babyId: selectedBabyId });
            } else {
                socket.emit('wakeBaby', { roomCode: currentRoom, babyId: selectedBabyId });
            }
            break;
            
        case 'clean':
            socket.emit('cleanBaby', { roomCode: currentRoom, babyId: selectedBabyId });
            break;
            
        case 'pet':
            socket.emit('petBaby', { roomCode: currentRoom, babyId: selectedBabyId });
            break;
    }
}

function harvestCarrot() {
    if (!socket || !currentRoom) return;
    
    if (gameState.garden.carrots > 0) {
        socket.emit('harvestCarrot', currentRoom);
    } else {
        showNotification('No carrots ready! Wait for them to grow! 🌱');
    }
}

// Auto-select first baby when game starts
function autoSelectBaby() {
    if (gameState && gameState.family.babies.length > 0 && !selectedBabyId) {
        selectBaby(gameState.family.babies[0].id);
    }
}

// URL parameter handling for direct room joins
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('family');
    
    if (roomFromUrl) {
        document.getElementById('roomCode').value = roomFromUrl.toUpperCase();
    }
    
    // Initialize socket if not already done
    if (!socket) {
        initSocket();
    }
});

// Handle window resize for Phaser
window.addEventListener('resize', () => {
    if (game) {
        const gameArea = document.getElementById('gameArea');
        const rect = gameArea.getBoundingClientRect();
        game.scale.resize(rect.width || 800, rect.height || 400);
    }
});

// Override updateGameDisplay to include auto-selection
const originalUpdateGameDisplay = updateGameDisplay;
updateGameDisplay = function() {
    originalUpdateGameDisplay();
    autoSelectBaby();
};