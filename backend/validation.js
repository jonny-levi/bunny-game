// Input Validation and Security Module

class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class GameValidator {
    static validateRoomCode(roomCode) {
        if (!roomCode) {
            throw new ValidationError('Room code is required', 'roomCode');
        }
        
        if (typeof roomCode !== 'string') {
            throw new ValidationError('Room code must be a string', 'roomCode');
        }
        
        if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
            throw new ValidationError('Room code must be 6 characters (A-Z, 0-9)', 'roomCode');
        }
        
        return roomCode.toUpperCase();
    }
    
    static validatePlayerId(playerId) {
        if (!playerId) {
            throw new ValidationError('Player ID is required', 'playerId');
        }
        
        if (typeof playerId !== 'string') {
            throw new ValidationError('Player ID must be a string', 'playerId');
        }
        
        if (playerId.length < 10 || playerId.length > 50) {
            throw new ValidationError('Player ID has invalid length', 'playerId');
        }
        
        if (!/^player_[a-z0-9]+_[a-z0-9]+$/.test(playerId)) {
            throw new ValidationError('Player ID has invalid format', 'playerId');
        }
        
        return playerId;
    }
    
    static validateBabyId(babyId) {
        if (!babyId) {
            throw new ValidationError('Baby ID is required', 'babyId');
        }

        if (typeof babyId !== 'string') {
            throw new ValidationError('Baby ID must be a string', 'babyId');
        }

        if (!/^baby\d+$/.test(babyId)) {
            throw new ValidationError('Baby ID has invalid format', 'babyId');
        }

        return babyId;
    }

    static validateBunnyId(bunnyId) {
        if (!bunnyId) {
            throw new ValidationError('Bunny ID is required', 'bunnyId');
        }

        if (typeof bunnyId !== 'string') {
            throw new ValidationError('Bunny ID must be a string', 'bunnyId');
        }

        if (!/^(baby\d+|parent_black|parent_white)$/.test(bunnyId)) {
            throw new ValidationError('Bunny ID has invalid format', 'bunnyId');
        }

        return bunnyId;
    }
    
    static validateGameAction(action, data = {}) {
        const validActions = [
            'feed_baby', 'play_with_baby', 'sleep_baby', 
            'clean_baby', 'pet_baby', 'hatch_egg', 
            'harvest_carrots', 'decay_needs'
        ];
        
        if (!validActions.includes(action)) {
            throw new ValidationError(`Invalid game action: ${action}`, 'action');
        }
        
        // Validate action-specific data
        switch (action) {
            case 'feed_baby':
                this.validateFeedAction(data);
                break;
            case 'play_with_baby':
                this.validatePlayAction(data);
                break;
            case 'hatch_egg':
                this.validateHatchAction(data);
                break;
        }
        
        return { action, data };
    }
    
    static validateFeedAction(data) {
        // Could add food type validation if implemented
        if (data.foodType && typeof data.foodType !== 'string') {
            throw new ValidationError('Food type must be a string', 'foodType');
        }
    }
    
    static validatePlayAction(data) {
        // Could add activity type validation if implemented
        if (data.activityType && typeof data.activityType !== 'string') {
            throw new ValidationError('Activity type must be a string', 'activityType');
        }
    }
    
    static validateHatchAction(data) {
        // Could add tap strength validation if implemented
        if (data.tapStrength && (typeof data.tapStrength !== 'number' || data.tapStrength < 0 || data.tapStrength > 10)) {
            throw new ValidationError('Tap strength must be a number between 0 and 10', 'tapStrength');
        }
    }
    
    static validateBabyName(name) {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Baby name must be a non-empty string', 'name');
        }
        
        if (name.length < 1 || name.length > 20) {
            throw new ValidationError('Baby name must be 1-20 characters', 'name');
        }
        
        // Allow letters, numbers, spaces, and basic punctuation
        if (!/^[a-zA-Z0-9\s\-'\.]+$/.test(name)) {
            throw new ValidationError('Baby name contains invalid characters', 'name');
        }
        
        return name.trim();
    }
    
    static validateNeedValue(value, needType) {
        if (typeof value !== 'number') {
            throw new ValidationError(`${needType} must be a number`, needType);
        }
        
        if (value < 0 || value > 100) {
            throw new ValidationError(`${needType} must be between 0 and 100`, needType);
        }
        
        return Math.round(value);
    }
    
    static validateGrowthStage(stage) {
        const validStages = ['egg', 'newborn', 'toddler', 'young', 'grown'];
        
        if (!validStages.includes(stage)) {
            throw new ValidationError(`Invalid growth stage: ${stage}`, 'stage');
        }
        
        return stage;
    }
    
    static sanitizeMessage(message) {
        if (!message || typeof message !== 'string') {
            return '';
        }

        // Remove HTML tags and limit length
        return message
            .replace(/<[^>]*>/g, '')
            .substring(0, 500)
            .trim();
    }

    // --- Wish System (Whispered Wishes) -----------------------------------
    // Hardcoded whitelist of hiding-spot identifiers. Anything else is
    // rejected before reaching the wish system to prevent arbitrary keys
    // being written into gameState.wishSystem.activeWishes.
    static validateWishSpotId(spotId) {
        const validSpots = ['bowl', 'garden', 'pad', 'pile', 'shelf', 'shadow', 'cave'];
        if (typeof spotId !== 'string') {
            throw new ValidationError('Spot id must be a string', 'spotId');
        }
        if (!validSpots.includes(spotId)) {
            throw new ValidationError('Invalid hiding spot', 'spotId');
        }
        return spotId;
    }

    // Whitelist of gameplay actions that can reveal a wish. Matches the
    // triggers in wishSystem.js SPOT_TRIGGER_ACTIONS — keep in sync.
    static validateWishTriggerAction(action) {
        const validTriggers = ['feed', 'play', 'pet', 'clean', 'harvest', 'water', 'sleep', 'cave_enter', 'cave_exit'];
        if (typeof action !== 'string') {
            throw new ValidationError('Trigger action must be a string', 'triggerAction');
        }
        if (!validTriggers.includes(action)) {
            throw new ValidationError('Invalid trigger action', 'triggerAction');
        }
        return action;
    }

    // Wish text: <=140 chars, strip control chars + HTML tags, reject empty.
    // Called server-side BEFORE storage; returns the cleaned string.
    static validateWishMessage(message) {
        if (typeof message !== 'string') {
            throw new ValidationError('Wish message must be a string', 'message');
        }
        // P2-4: reject oversize payloads BEFORE running the regex so a 1MB
        // submission full of `<x>` tokens can't burn CPU in the stripper.
        if (message.length > 1000) {
            throw new ValidationError('Wish message too long', 'message');
        }
        // Strip HTML tags first
        let cleaned = message.replace(/<[^>]*>/g, '');
        // Strip ASCII control chars (0x00-0x1F, 0x7F) except nothing — no
        // whitespace like tab/newline is allowed inside a wish, matches the
        // send_love_note style of keeping the text single-line.
        cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
        // P2-2: strip zero-width + bidi override + format chars so an attacker
        // can't render a wish that looks empty or says the opposite of what
        // was sent.
        cleaned = cleaned.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
        // Normalize so combining-accent + base-char count the same towards
        // the 140-char cap as a pre-composed glyph.
        try { cleaned = cleaned.normalize('NFC'); } catch (_e) { /* ignore */ }
        // Trim surrounding whitespace
        cleaned = cleaned.trim();
        if (cleaned.length === 0) {
            throw new ValidationError('Wish message cannot be empty', 'message');
        }
        // B-4: spec §7.6 asks for REJECT on oversize after cleaning, not clamp.
        if (cleaned.length > 140) {
            throw new ValidationError('Wish message too long (max 140)', 'message');
        }
        return cleaned;
    }

    // V4.1 (P1-1): rolling-window rate-limit check parameterised by window
    // length. The default validateRateLimit uses a fixed 60s window with
    // per-action caps which is wrong for bursty actions (e.g. 20/10s
    // attempt_wish_discovery) — a client could fire the whole budget in one
    // tick. This helper enforces a true rolling window.
    //
    // Keys are suffixed with windowMs so this check lives alongside (not
    // instead of) the existing validateRateLimit global cap.
    static checkRollingWindow(playerId, action, maxInWindow, windowMs, rateLimits) {
        if (!playerId || typeof playerId !== 'string') {
            throw new ValidationError('Invalid player ID for rate limiting');
        }
        if (!action || typeof action !== 'string') {
            throw new ValidationError('Invalid action for rate limiting');
        }
        if (playerId.length > 100 || action.length > 50) {
            throw new ValidationError('Player ID or action too long');
        }
        const key = `${playerId}:${action}:rw${windowMs}`;
        const now = Date.now();
        const arr = (rateLimits.get(key) || []).filter(t => t > now - windowMs);
        if (arr.length >= maxInWindow) {
            throw new ValidationError('Rate limit exceeded. Please slow down.', 'rateLimit');
        }
        arr.push(now);
        rateLimits.set(key, arr);
        return true;
    }
    
    static validateRateLimit(playerId, action, rateLimits) {
        // Security: Validate inputs first
        if (!playerId || typeof playerId !== 'string') {
            throw new ValidationError('Invalid player ID for rate limiting');
        }
        
        if (!action || typeof action !== 'string') {
            throw new ValidationError('Invalid action for rate limiting');
        }
        
        // Security: Limit key length to prevent memory attacks
        if (playerId.length > 100 || action.length > 50) {
            throw new ValidationError('Player ID or action too long');
        }
        
        const key = `${playerId}:${action}`;
        const now = Date.now();
        
        if (!rateLimits.has(key)) {
            rateLimits.set(key, []);
        }
        
        const attempts = rateLimits.get(key);
        
        // Clean old attempts (older than 1 minute)
        const cutoff = now - 60000;
        const recentAttempts = attempts.filter(time => time > cutoff);
        
        // Different rate limits for different actions
        let maxAttempts = 30; // Default: 30 per minute
        if (action === 'create_room' || action === 'join_room') {
            maxAttempts = 5; // More restrictive for room actions
        } else if (action === 'decay_needs') {
            maxAttempts = 3; // Very restrictive for debug actions
        } else if (action === 'pet_baby') {
            maxAttempts = 60; // Egg tapping needs higher limit
        } else if (action === 'move_bunny') {
            maxAttempts = 120; // Movement needs high limit
        } else if (action === 'buy_item' || action === 'use_item') {
            maxAttempts = 20;
        } else if (action === 'hide_wish') {
            // V4 spec: 1 per 60s per player. The 60s window matches the
            // rate-limiter's cutoff so we simply cap at 1.
            maxAttempts = 1;
        } else if (action === 'tap_wish_jar') {
            // V4 spec: 1 per 1s — the 60s-window-based max here (60) is an
            // upper bound; the wishSystem itself idempotently handles repeat
            // taps from the same player within a jar.
            maxAttempts = 60;
        } else if (action === 'attempt_wish_discovery') {
            // V4 spec: 20 per 10s. Over a 60s window that's 120 — cap here.
            maxAttempts = 120;
        }
        
        // Check rate limit
        if (recentAttempts.length >= maxAttempts) {
            throw new ValidationError('Rate limit exceeded. Please slow down.', 'rateLimit');
        }
        
        // Add current attempt
        recentAttempts.push(now);
        rateLimits.set(key, recentAttempts);
        
        return true;
    }
    
    static validateMovementThrottle(playerId, movementThrottles) {
        if (!playerId || typeof playerId !== 'string') {
            throw new ValidationError('Invalid player ID for movement throttling');
        }
        const now = Date.now();
        if (!movementThrottles.has(playerId)) {
            movementThrottles.set(playerId, []);
        }
        const attempts = movementThrottles.get(playerId);
        const cutoff = now - 1000;
        const recentAttempts = attempts.filter(time => time > cutoff);
        if (recentAttempts.length >= 10) {
            throw new ValidationError('Movement throttled');
        }
        recentAttempts.push(now);
        movementThrottles.set(playerId, recentAttempts);
        return true;
    }

    static validateGameState(gameState) {
        if (!gameState || typeof gameState !== 'object') {
            throw new ValidationError('Game state must be an object', 'gameState');
        }
        
        // FIX: Handle deeply nested objects and circular references
        const visited = new WeakSet();
        
        function checkCircularReferences(obj, depth = 0) {
            if (depth > 20) {
                throw new ValidationError('Game state is too deeply nested', 'gameState');
            }
            
            if (typeof obj === 'object' && obj !== null) {
                if (visited.has(obj)) {
                    throw new ValidationError('Game state contains circular references', 'gameState');
                }
                visited.add(obj);
                
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        checkCircularReferences(obj[key], depth + 1);
                    }
                }
            }
        }
        
        try {
            checkCircularReferences(gameState);
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError('Game state validation failed due to complex structure', 'gameState');
        }
        
        // Validate carrots
        if (typeof gameState.carrots !== 'number' || gameState.carrots < 0) {
            throw new ValidationError('Carrots must be a non-negative number', 'carrots');
        }
        
        // Validate babies array
        if (!Array.isArray(gameState.babies)) {
            throw new ValidationError('Babies must be an array', 'babies');
        }
        
        // Limit babies array size to prevent memory issues
        if (gameState.babies.length > 10) {
            throw new ValidationError('Too many babies in game state (max 10)', 'babies');
        }
        
        // Validate each baby
        gameState.babies.forEach((baby, index) => {
            try {
                this.validateBaby(baby);
            } catch (error) {
                throw new ValidationError(`Baby ${index}: ${error.message}`, `babies[${index}]`);
            }
        });
        
        // Validate day/night cycle
        if (!['day', 'night'].includes(gameState.dayNightCycle)) {
            throw new ValidationError('Day/night cycle must be "day" or "night"', 'dayNightCycle');
        }
        
        return true;
    }
    
    static validateBaby(baby) {
        if (!baby || typeof baby !== 'object') {
            throw new ValidationError('Baby must be an object');
        }
        
        // Required fields
        const requiredFields = ['id', 'name', 'stage'];
        for (const field of requiredFields) {
            if (!(field in baby)) {
                throw new ValidationError(`Baby missing required field: ${field}`);
            }
        }
        
        // Validate baby fields
        this.validateBabyId(baby.id);
        this.validateBabyName(baby.name);
        this.validateGrowthStage(baby.stage);
        
        // Validate needs (if not egg)
        if (baby.stage !== 'egg') {
            const needs = ['hunger', 'happiness', 'energy', 'cleanliness'];
            for (const need of needs) {
                if (need in baby) {
                    this.validateNeedValue(baby[need], need);
                }
            }
            
            if ('love' in baby) {
                this.validateNeedValue(baby.love, 'love');
            }
        }
        
        // Validate growth points
        if ('growthPoints' in baby && (typeof baby.growthPoints !== 'number' || baby.growthPoints < 0)) {
            throw new ValidationError('Growth points must be a non-negative number');
        }
        
        // Validate hatch progress (for eggs)
        if (baby.stage === 'egg' && 'hatchProgress' in baby) {
            this.validateNeedValue(baby.hatchProgress, 'hatchProgress');
        }
        
        return true;
    }
}

module.exports = { GameValidator, ValidationError };