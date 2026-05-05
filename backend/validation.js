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
    
    static validateGameAction(action, data = {}) {
        const validActions = [
            'feed_baby', 'play_with_baby', 'sleep_baby',
            'clean_baby', 'pet_baby', 'hatch_egg',
            'harvest_carrots', 'decay_needs',
            // V7 Bubble Bath Duet
            'bath_grab_station', 'bath_release_station'
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
            case 'bath_grab_station':
            case 'bath_release_station':
                this.validateBathStationAction(data);
                break;
        }

        return { action, data };
    }

    // V7: Validate bath station action data shape
    static validateBathStationAction(data) {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Bath station action requires an object payload', 'data');
        }
        if (typeof data.station !== 'string' || !['sponge', 'tap'].includes(data.station)) {
            throw new ValidationError('Bath station must be "sponge" or "tap"', 'station');
        }
        return data;
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