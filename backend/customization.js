// Bunny Customization and Naming System
// Manages bunny names, colors, traits, and unlockable customizations

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CUSTOMIZATION_SAVE_DIR = path.join(__dirname, 'saves', 'customization');

class CustomizationManager {
    constructor() {
        this.defaultColors = ['gray', 'white', 'black', 'brown'];
        this.defaultTraits = ['gentle', 'playful', 'sleepy', 'curious'];
        
        this.unlockableContent = {
            colors: {
                'cream': { requirement: 'raise_5_bunnies', cost: 0, rarity: 'common' },
                'golden': { requirement: 'daily_streak_7', cost: 0, rarity: 'uncommon' },
                'silver': { requirement: 'achievement_10', cost: 0, rarity: 'uncommon' },
                'chocolate': { requirement: 'feed_100_times', cost: 0, rarity: 'common' },
                'strawberry': { requirement: 'play_100_times', cost: 0, rarity: 'common' },
                'mint': { requirement: 'clean_50_times', cost: 0, rarity: 'common' },
                'lavender': { requirement: 'love_milestone_5', cost: 0, rarity: 'uncommon' },
                'rose': { requirement: 'cooperative_50', cost: 0, rarity: 'uncommon' },
                'azure': { requirement: 'daily_streak_30', cost: 0, rarity: 'rare' },
                'rainbow': { requirement: 'complete_all_basic', cost: 0, rarity: 'legendary' }
            },
            traits: {
                'energetic': { requirement: 'play_50_times', cost: 0, rarity: 'common' },
                'cuddly': { requirement: 'pet_50_times', cost: 0, rarity: 'common' },
                'smart': { requirement: 'achievement_5', cost: 0, rarity: 'uncommon' },
                'brave': { requirement: 'hatch_10_eggs', cost: 0, rarity: 'uncommon' },
                'magical': { requirement: 'daily_streak_14', cost: 0, rarity: 'rare' },
                'royal': { requirement: 'cooperative_100', cost: 0, rarity: 'rare' },
                'legendary': { requirement: 'daily_streak_100', cost: 0, rarity: 'legendary' }
            },
            accessories: {
                'bow_tie': { requirement: 'achievement_3', cost: 0, rarity: 'common' },
                'flower_crown': { requirement: 'love_milestone_3', cost: 0, rarity: 'common' },
                'tiny_hat': { requirement: 'raise_3_bunnies', cost: 0, rarity: 'common' },
                'sparkles': { requirement: 'daily_streak_14', cost: 0, rarity: 'uncommon' },
                'wings': { requirement: 'achievement_15', cost: 0, rarity: 'rare' },
                'crown': { requirement: 'daily_streak_50', cost: 0, rarity: 'legendary' }
            }
        };

        this.nameFilters = {
            prohibited: [
                // Common inappropriate words - basic filter
                'admin', 'mod', 'null', 'undefined', 'system', 'server',
                'test', 'debug', 'error', 'bot', 'script'
            ],
            reserved: ['Baby1', 'Baby2', 'Baby3', 'Baby4', 'Default', 'Unnamed']
        };

        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(CUSTOMIZATION_SAVE_DIR, { recursive: true });
        } catch (error) {
            console.error('Failed to create customization directory:', error);
        }
    }

    async loadPlayerCustomization(playerId) {
        try {
            const filePath = path.join(CUSTOMIZATION_SAVE_DIR, `${playerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            const customizationData = JSON.parse(data);

            return {
                unlockedColors: customizationData.unlockedColors || [...this.defaultColors],
                unlockedTraits: customizationData.unlockedTraits || [...this.defaultTraits],
                unlockedAccessories: customizationData.unlockedAccessories || ['none'],
                customNames: customizationData.customNames || {},
                preferences: customizationData.preferences || {
                    defaultColor: 'gray',
                    defaultTrait: 'gentle',
                    defaultAccessory: 'none'
                },
                stats: customizationData.stats || {
                    totalCustomizations: 0,
                    favoriteName: null,
                    unlockHistory: []
                },
                lastUpdate: customizationData.lastUpdate || Date.now()
            };
        } catch (error) {
            // Return default customization data
            return {
                unlockedColors: [...this.defaultColors],
                unlockedTraits: [...this.defaultTraits],
                unlockedAccessories: ['none'],
                customNames: {},
                preferences: {
                    defaultColor: 'gray',
                    defaultTrait: 'gentle',
                    defaultAccessory: 'none'
                },
                stats: {
                    totalCustomizations: 0,
                    favoriteName: null,
                    unlockHistory: []
                },
                lastUpdate: Date.now()
            };
        }
    }

    async savePlayerCustomization(playerId, customizationData) {
        try {
            const filePath = path.join(CUSTOMIZATION_SAVE_DIR, `${playerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            customizationData.lastUpdate = Date.now();
            await fs.writeFile(filePath, JSON.stringify(customizationData, null, 2));
        } catch (error) {
            console.error(`Failed to save customization for player ${playerId}:`, error);
        }
    }

    async customizeBunny(playerId, babyId, customization) {
        try {
            const playerData = await this.loadPlayerCustomization(playerId);
            
            // Validate customization options
            const validation = await this.validateCustomization(playerData, customization);
            if (!validation.valid) {
                return { success: false, message: validation.message };
            }

            // Create customization record
            const customRecord = {
                id: crypto.randomUUID(),
                babyId,
                timestamp: Date.now(),
                name: customization.name ? this.sanitizeName(customization.name) : null,
                color: customization.color || playerData.preferences.defaultColor,
                trait: customization.trait || playerData.preferences.defaultTrait,
                accessory: customization.accessory || playerData.preferences.defaultAccessory,
                playerId
            };

            // Save custom name if provided
            if (customRecord.name) {
                playerData.customNames[babyId] = {
                    name: customRecord.name,
                    setAt: Date.now(),
                    setBy: playerId
                };
            }

            // Update stats
            playerData.stats.totalCustomizations++;
            playerData.stats.unlockHistory.push({
                timestamp: Date.now(),
                type: 'customization',
                details: customRecord
            });

            // Keep only last 100 unlock history items
            if (playerData.stats.unlockHistory.length > 100) {
                playerData.stats.unlockHistory = playerData.stats.unlockHistory.slice(-100);
            }

            await this.savePlayerCustomization(playerId, playerData);

            console.log(`Bunny ${babyId} customized by player ${playerId}: ${customRecord.name || 'unnamed'}`);
            
            return {
                success: true,
                customization: customRecord,
                message: customRecord.name ? 
                    `${customRecord.name} looks adorable!` : 
                    'Bunny customization applied!'
            };
        } catch (error) {
            console.error('Failed to customize bunny:', error);
            return { success: false, message: 'Failed to apply customization. Please try again.' };
        }
    }

    async validateCustomization(playerData, customization) {
        // Validate name
        if (customization.name) {
            const nameValidation = this.validateName(customization.name);
            if (!nameValidation.valid) {
                return { valid: false, message: nameValidation.message };
            }
        }

        // Validate color
        if (customization.color && !playerData.unlockedColors.includes(customization.color)) {
            return { valid: false, message: `Color '${customization.color}' is not unlocked yet!` };
        }

        // Validate trait
        if (customization.trait && !playerData.unlockedTraits.includes(customization.trait)) {
            return { valid: false, message: `Trait '${customization.trait}' is not unlocked yet!` };
        }

        // Validate accessory
        if (customization.accessory && !playerData.unlockedAccessories.includes(customization.accessory)) {
            return { valid: false, message: `Accessory '${customization.accessory}' is not unlocked yet!` };
        }

        return { valid: true };
    }

    validateName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, message: 'Name must be a text string' };
        }

        const trimmedName = name.trim();
        
        if (trimmedName.length < 1) {
            return { valid: false, message: 'Name cannot be empty' };
        }

        if (trimmedName.length > 20) {
            return { valid: false, message: 'Name must be 20 characters or less' };
        }

        // Check for prohibited words
        const lowerName = trimmedName.toLowerCase();
        for (const prohibited of this.nameFilters.prohibited) {
            if (lowerName.includes(prohibited.toLowerCase())) {
                return { valid: false, message: 'Name contains inappropriate content' };
            }
        }

        // Check for reserved names
        for (const reserved of this.nameFilters.reserved) {
            if (lowerName === reserved.toLowerCase()) {
                return { valid: false, message: 'This name is reserved' };
            }
        }

        // Allow letters, numbers, spaces, and basic punctuation
        if (!/^[a-zA-Z0-9\s\-'\.]+$/.test(trimmedName)) {
            return { valid: false, message: 'Name can only contain letters, numbers, spaces, hyphens, apostrophes, and periods' };
        }

        return { valid: true, name: trimmedName };
    }

    sanitizeName(name) {
        if (!name || typeof name !== 'string') return '';
        
        return name
            .trim()
            .substring(0, 20)
            .replace(/[^a-zA-Z0-9\s\-'\.]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async checkUnlocks(playerId, playerStats) {
        const playerData = await this.loadPlayerCustomization(playerId);
        let newUnlocks = [];

        // Check color unlocks
        for (const [color, requirements] of Object.entries(this.unlockableContent.colors)) {
            if (!playerData.unlockedColors.includes(color)) {
                if (this.checkRequirement(requirements.requirement, playerStats)) {
                    playerData.unlockedColors.push(color);
                    newUnlocks.push({
                        type: 'color',
                        item: color,
                        rarity: requirements.rarity,
                        category: 'Colors'
                    });
                }
            }
        }

        // Check trait unlocks
        for (const [trait, requirements] of Object.entries(this.unlockableContent.traits)) {
            if (!playerData.unlockedTraits.includes(trait)) {
                if (this.checkRequirement(requirements.requirement, playerStats)) {
                    playerData.unlockedTraits.push(trait);
                    newUnlocks.push({
                        type: 'trait',
                        item: trait,
                        rarity: requirements.rarity,
                        category: 'Traits'
                    });
                }
            }
        }

        // Check accessory unlocks
        for (const [accessory, requirements] of Object.entries(this.unlockableContent.accessories)) {
            if (!playerData.unlockedAccessories.includes(accessory)) {
                if (this.checkRequirement(requirements.requirement, playerStats)) {
                    playerData.unlockedAccessories.push(accessory);
                    newUnlocks.push({
                        type: 'accessory',
                        item: accessory,
                        rarity: requirements.rarity,
                        category: 'Accessories'
                    });
                }
            }
        }

        // Update unlock history
        if (newUnlocks.length > 0) {
            newUnlocks.forEach(unlock => {
                playerData.stats.unlockHistory.push({
                    timestamp: Date.now(),
                    type: 'unlock',
                    details: unlock
                });
            });

            await this.savePlayerCustomization(playerId, playerData);
            console.log(`Player ${playerId} unlocked ${newUnlocks.length} new customization options`);
        }

        return newUnlocks;
    }

    checkRequirement(requirement, stats) {
        // Parse requirement string and check against stats
        const [action, target] = requirement.split('_');
        const targetNum = parseInt(target) || 0;

        switch (requirement) {
            case 'raise_5_bunnies':
                return (stats.bunniesRaised || 0) >= 5;
            case 'raise_3_bunnies':
                return (stats.bunniesRaised || 0) >= 3;
            case 'daily_streak_7':
                return (stats.dailyStreak || 0) >= 7;
            case 'daily_streak_14':
                return (stats.dailyStreak || 0) >= 14;
            case 'daily_streak_30':
                return (stats.dailyStreak || 0) >= 30;
            case 'daily_streak_50':
                return (stats.dailyStreak || 0) >= 50;
            case 'daily_streak_100':
                return (stats.dailyStreak || 0) >= 100;
            case 'achievement_3':
                return (stats.achievementsUnlocked || 0) >= 3;
            case 'achievement_5':
                return (stats.achievementsUnlocked || 0) >= 5;
            case 'achievement_10':
                return (stats.achievementsUnlocked || 0) >= 10;
            case 'achievement_15':
                return (stats.achievementsUnlocked || 0) >= 15;
            case 'feed_100_times':
                return (stats.feedCount || 0) >= 100;
            case 'play_50_times':
                return (stats.playCount || 0) >= 50;
            case 'play_100_times':
                return (stats.playCount || 0) >= 100;
            case 'clean_50_times':
                return (stats.cleanCount || 0) >= 50;
            case 'pet_50_times':
                return (stats.petCount || 0) >= 50;
            case 'love_milestone_3':
                return (stats.loveMilestones || 0) >= 3;
            case 'love_milestone_5':
                return (stats.loveMilestones || 0) >= 5;
            case 'cooperative_50':
                return (stats.cooperativeActions || 0) >= 50;
            case 'cooperative_100':
                return (stats.cooperativeActions || 0) >= 100;
            case 'hatch_10_eggs':
                return (stats.eggsHatched || 0) >= 10;
            case 'complete_all_basic':
                return stats.achievementsUnlocked >= 5 && 
                       stats.bunniesRaised >= 3 && 
                       stats.dailyStreak >= 7;
            default:
                return false;
        }
    }

    async getBunnyName(roomCode, babyId) {
        try {
            // Try to find custom name from any player in the room
            const files = await fs.readdir(CUSTOMIZATION_SAVE_DIR);
            
            for (const file of files) {
                try {
                    const filePath = path.join(CUSTOMIZATION_SAVE_DIR, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const customizationData = JSON.parse(data);
                    
                    if (customizationData.customNames && customizationData.customNames[babyId]) {
                        return customizationData.customNames[babyId].name;
                    }
                } catch (error) {
                    continue; // Skip corrupted files
                }
            }
        } catch (error) {
            console.error('Failed to get bunny name:', error);
        }
        
        return null; // No custom name found
    }

    async getPlayerCustomizations(playerId) {
        const playerData = await this.loadPlayerCustomization(playerId);
        
        return {
            unlocked: {
                colors: playerData.unlockedColors,
                traits: playerData.unlockedTraits,
                accessories: playerData.unlockedAccessories
            },
            available: {
                colors: this.getAllColors(),
                traits: this.getAllTraits(),
                accessories: this.getAllAccessories()
            },
            customNames: playerData.customNames,
            preferences: playerData.preferences,
            stats: playerData.stats,
            unlockProgress: this.getUnlockProgress(playerData)
        };
    }

    getAllColors() {
        return {
            unlocked: this.defaultColors,
            unlockable: Object.keys(this.unlockableContent.colors)
        };
    }

    getAllTraits() {
        return {
            unlocked: this.defaultTraits,
            unlockable: Object.keys(this.unlockableContent.traits)
        };
    }

    getAllAccessories() {
        return {
            unlocked: ['none'],
            unlockable: Object.keys(this.unlockableContent.accessories)
        };
    }

    getUnlockProgress(playerData) {
        const progress = {};
        
        // Calculate progress for each unlockable item
        const allUnlockables = {
            ...this.unlockableContent.colors,
            ...this.unlockableContent.traits,
            ...this.unlockableContent.accessories
        };

        for (const [item, requirements] of Object.entries(allUnlockables)) {
            const isUnlocked = playerData.unlockedColors.includes(item) ||
                              playerData.unlockedTraits.includes(item) ||
                              playerData.unlockedAccessories.includes(item);
            
            progress[item] = {
                unlocked: isUnlocked,
                requirement: requirements.requirement,
                rarity: requirements.rarity
            };
        }

        return progress;
    }

    // Admin/Debug functions
    async resetPlayerCustomization(playerId) {
        const resetData = {
            unlockedColors: [...this.defaultColors],
            unlockedTraits: [...this.defaultTraits],
            unlockedAccessories: ['none'],
            customNames: {},
            preferences: {
                defaultColor: 'gray',
                defaultTrait: 'gentle',
                defaultAccessory: 'none'
            },
            stats: {
                totalCustomizations: 0,
                favoriteName: null,
                unlockHistory: []
            },
            lastUpdate: Date.now()
        };
        
        await this.savePlayerCustomization(playerId, resetData);
        return resetData;
    }

    async unlockAllForPlayer(playerId) {
        const playerData = await this.loadPlayerCustomization(playerId);
        
        playerData.unlockedColors = [...this.defaultColors, ...Object.keys(this.unlockableContent.colors)];
        playerData.unlockedTraits = [...this.defaultTraits, ...Object.keys(this.unlockableContent.traits)];
        playerData.unlockedAccessories = ['none', ...Object.keys(this.unlockableContent.accessories)];
        
        await this.savePlayerCustomization(playerId, playerData);
        return playerData;
    }
}

module.exports = CustomizationManager;