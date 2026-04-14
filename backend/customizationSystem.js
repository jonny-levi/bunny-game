// Customization System
// Handles bunny customization, decorations, and unlock system

class CustomizationSystem {
    constructor() {
        this.playerCustomizations = new Map(); // playerId -> customization data
        this.roomDecorations = new Map(); // roomCode -> decoration data
        this.unlocks = this.initializeUnlockableItems();
        this.careQualityThresholds = this.initializeCareThresholds();
    }

    // Initialize all unlockable items
    initializeUnlockableItems() {
        return {
            // Bunny Colors
            colors: {
                'default': { name: 'Natural', unlocked: true, cost: 0, requirement: null },
                'black': { name: 'Midnight Black', unlocked: true, cost: 0, requirement: null },
                'white': { name: 'Snow White', unlocked: true, cost: 0, requirement: null },
                'gray': { name: 'Silver Gray', unlocked: true, cost: 0, requirement: null },
                'brown': { name: 'Chocolate Brown', unlocked: true, cost: 0, requirement: null },
                'cream': { name: 'Vanilla Cream', unlocked: false, cost: 50, requirement: { type: 'care_quality', value: 80 } },
                'spotted': { name: 'Spotted', unlocked: false, cost: 75, requirement: { type: 'care_quality', value: 85 } },
                'golden': { name: 'Golden', unlocked: false, cost: 100, requirement: { type: 'care_quality', value: 90 } },
                'silver': { name: 'Silver', unlocked: false, cost: 150, requirement: { type: 'perfect_care_days', value: 7 } },
                'rainbow': { name: 'Rainbow', unlocked: false, cost: 200, requirement: { type: 'achievement', value: 'perfectionist' } }
            },

            // Bunny Accessories
            accessories: {
                'none': { name: 'None', unlocked: true, cost: 0, requirement: null },
                'bow_red': { name: 'Red Bow', unlocked: false, cost: 20, requirement: { type: 'love_level', value: 50 } },
                'bow_blue': { name: 'Blue Bow', unlocked: false, cost: 20, requirement: { type: 'happiness_milestone', value: 100 } },
                'bow_pink': { name: 'Pink Bow', unlocked: false, cost: 25, requirement: { type: 'cooperative_actions', value: 20 } },
                'hat_party': { name: 'Party Hat', unlocked: false, cost: 40, requirement: { type: 'birthdays_celebrated', value: 5 } },
                'hat_winter': { name: 'Winter Hat', unlocked: false, cost: 35, requirement: { type: 'season_unlock', value: 'winter' } },
                'glasses': { name: 'Smart Glasses', unlocked: false, cost: 60, requirement: { type: 'intelligence_level', value: 75 } },
                'flower_crown': { name: 'Flower Crown', unlocked: false, cost: 80, requirement: { type: 'garden_mastery', value: 100 } },
                'crown_gold': { name: 'Golden Crown', unlocked: false, cost: 150, requirement: { type: 'achievement', value: 'five_generations' } },
                'wings_fairy': { name: 'Fairy Wings', unlocked: false, cost: 120, requirement: { type: 'magic_moments', value: 10 } },
                'cape_hero': { name: 'Hero Cape', unlocked: false, cost: 100, requirement: { type: 'achievement', value: 'cooperation_master' } }
            },

            // Nest Decorations
            decorations: {
                'wooden_floor': { name: 'Wooden Floor', category: 'floor', unlocked: true, cost: 0 },
                'stone_floor': { name: 'Stone Floor', category: 'floor', unlocked: false, cost: 30 },
                'grass_floor': { name: 'Grass Floor', category: 'floor', unlocked: false, cost: 25 },
                'marble_floor': { name: 'Marble Floor', category: 'floor', unlocked: false, cost: 100 },
                
                'basic_walls': { name: 'Basic Walls', category: 'walls', unlocked: true, cost: 0 },
                'brick_walls': { name: 'Brick Walls', category: 'walls', unlocked: false, cost: 40 },
                'floral_walls': { name: 'Floral Wallpaper', category: 'walls', unlocked: false, cost: 50 },
                'starry_walls': { name: 'Starry Night', category: 'walls', unlocked: false, cost: 80 },
                
                'small_plant': { name: 'Small Plant', category: 'furniture', unlocked: false, cost: 15 },
                'toy_box': { name: 'Toy Box', category: 'furniture', unlocked: false, cost: 35 },
                'bookshelf': { name: 'Bookshelf', category: 'furniture', unlocked: false, cost: 45 },
                'music_box': { name: 'Music Box', category: 'furniture', unlocked: false, cost: 60 },
                'fountain': { name: 'Fountain', category: 'furniture', unlocked: false, cost: 120 },
                
                'ceiling_fan': { name: 'Ceiling Fan', category: 'ceiling', unlocked: false, cost: 50 },
                'chandelier': { name: 'Chandelier', category: 'ceiling', unlocked: false, cost: 100 },
                'sky_light': { name: 'Skylight', category: 'ceiling', unlocked: false, cost: 80 },
                
                'warm_lighting': { name: 'Warm Lighting', category: 'lighting', unlocked: false, cost: 25 },
                'party_lights': { name: 'Party Lights', category: 'lighting', unlocked: false, cost: 40 },
                'aurora_lights': { name: 'Aurora Lights', category: 'lighting', unlocked: false, cost: 90 }
            },

            // Nest Themes (preset combinations)
            themes: {
                'cozy_cabin': { 
                    name: 'Cozy Cabin', 
                    items: ['wooden_floor', 'brick_walls', 'small_plant', 'warm_lighting'],
                    unlocked: false, 
                    cost: 80,
                    requirement: { type: 'comfort_level', value: 70 }
                },
                'garden_paradise': { 
                    name: 'Garden Paradise', 
                    items: ['grass_floor', 'floral_walls', 'fountain', 'small_plant'],
                    unlocked: false, 
                    cost: 120,
                    requirement: { type: 'garden_mastery', value: 80 }
                },
                'royal_palace': { 
                    name: 'Royal Palace', 
                    items: ['marble_floor', 'starry_walls', 'chandelier', 'bookshelf'],
                    unlocked: false, 
                    cost: 200,
                    requirement: { type: 'achievement', value: 'five_generations' }
                },
                'party_zone': { 
                    name: 'Party Zone', 
                    items: ['wooden_floor', 'basic_walls', 'music_box', 'party_lights'],
                    unlocked: false, 
                    cost: 100,
                    requirement: { type: 'celebrations', value: 10 }
                }
            }
        };
    }

    // Initialize care quality thresholds for unlocks
    initializeCareThresholds() {
        return {
            excellent: 90,  // 90%+ average care
            good: 80,       // 80%+ average care  
            decent: 70,     // 70%+ average care
            basic: 60       // 60%+ average care
        };
    }

    // Customize a bunny
    customizeBunny(playerId, babyId, customizations = {}) {
        let playerData = this.getPlayerCustomizations(playerId);
        
        if (!playerData.bunnyCustomizations[babyId]) {
            playerData.bunnyCustomizations[babyId] = {
                name: null,
                color: null,
                accessory: 'none',
                unlocked: []
            };
        }

        const bunnyData = playerData.bunnyCustomizations[babyId];
        const changes = [];

        // Update name
        if (customizations.name && this.validateBunnyName(customizations.name)) {
            const oldName = bunnyData.name;
            bunnyData.name = customizations.name;
            changes.push({ type: 'name', old: oldName, new: customizations.name });
        }

        // Update color (if unlocked and affordable)
        if (customizations.color) {
            const colorInfo = this.unlocks.colors[customizations.color];
            if (colorInfo && this.isUnlocked(playerId, 'color', customizations.color)) {
                const cost = colorInfo.cost;
                if (playerData.decorationPoints >= cost) {
                    playerData.decorationPoints -= cost;
                    bunnyData.color = customizations.color;
                    changes.push({ type: 'color', new: customizations.color, cost });
                } else {
                    return { success: false, message: 'Not enough decoration points' };
                }
            } else {
                return { success: false, message: 'Color not unlocked' };
            }
        }

        // Update accessory (if unlocked and affordable)
        if (customizations.accessory) {
            const accessoryInfo = this.unlocks.accessories[customizations.accessory];
            if (accessoryInfo && this.isUnlocked(playerId, 'accessory', customizations.accessory)) {
                const cost = accessoryInfo.cost;
                if (playerData.decorationPoints >= cost) {
                    playerData.decorationPoints -= cost;
                    bunnyData.accessory = customizations.accessory;
                    changes.push({ type: 'accessory', new: customizations.accessory, cost });
                } else {
                    return { success: false, message: 'Not enough decoration points' };
                }
            } else {
                return { success: false, message: 'Accessory not unlocked' };
            }
        }

        this.playerCustomizations.set(playerId, playerData);

        return {
            success: true,
            changes,
            bunnyData,
            remainingPoints: playerData.decorationPoints
        };
    }

    // Get player's customization data
    getPlayerCustomizations(playerId) {
        return this.playerCustomizations.get(playerId) || {
            decorationPoints: 10, // Starting points
            bunnyCustomizations: {},
            unlockedItems: new Set(['default', 'black', 'white', 'gray', 'brown', 'none']),
            achievements: new Set(),
            careQuality: {
                totalCareHours: 0,
                excellentCareHours: 0,
                perfectCareDays: 0,
                averageCareScore: 0
            }
        };
    }

    // Update room decorations
    updateRoomDecorations(roomCode, decorations = {}, playerId = null) {
        let roomData = this.roomDecorations.get(roomCode) || {
            theme: 'default',
            floor: 'wooden_floor',
            walls: 'basic_walls',
            ceiling: null,
            lighting: null,
            furniture: [],
            lastUpdated: Date.now(),
            updatedBy: null
        };

        const changes = [];
        let totalCost = 0;

        // Validate and apply decoration changes
        for (const [category, item] of Object.entries(decorations)) {
            if (this.unlocks.decorations[item]) {
                const itemInfo = this.unlocks.decorations[item];
                
                if (playerId && !this.isUnlocked(playerId, 'decoration', item)) {
                    return { success: false, message: `Decoration "${itemInfo.name}" not unlocked` };
                }

                totalCost += itemInfo.cost;

                switch (category) {
                    case 'floor':
                    case 'walls':
                    case 'ceiling':
                    case 'lighting':
                        roomData[category] = item;
                        changes.push({ type: category, item: item, cost: itemInfo.cost });
                        break;
                    case 'furniture':
                        if (Array.isArray(item)) {
                            roomData.furniture = item;
                            changes.push({ type: 'furniture', items: item, cost: itemInfo.cost });
                        } else {
                            if (!roomData.furniture.includes(item)) {
                                roomData.furniture.push(item);
                                changes.push({ type: 'furniture_add', item: item, cost: itemInfo.cost });
                            }
                        }
                        break;
                }
            }
        }

        // Apply theme if specified
        if (decorations.theme && this.unlocks.themes[decorations.theme]) {
            const themeInfo = this.unlocks.themes[decorations.theme];
            if (playerId && !this.isUnlocked(playerId, 'theme', decorations.theme)) {
                return { success: false, message: `Theme "${themeInfo.name}" not unlocked` };
            }

            // Apply all theme items
            this.applyTheme(roomData, decorations.theme);
            totalCost += themeInfo.cost;
            changes.push({ type: 'theme', theme: decorations.theme, cost: themeInfo.cost });
        }

        // Deduct decoration points if player specified
        if (playerId && totalCost > 0) {
            const playerData = this.getPlayerCustomizations(playerId);
            if (playerData.decorationPoints < totalCost) {
                return { success: false, message: 'Not enough decoration points' };
            }
            playerData.decorationPoints -= totalCost;
            this.playerCustomizations.set(playerId, playerData);
        }

        roomData.lastUpdated = Date.now();
        roomData.updatedBy = playerId;
        this.roomDecorations.set(roomCode, roomData);

        return {
            success: true,
            changes,
            roomDecorations: roomData,
            totalCost
        };
    }

    // Apply a theme to a room
    applyTheme(roomData, themeId) {
        const theme = this.unlocks.themes[themeId];
        if (!theme) return;

        theme.items.forEach(item => {
            const decoration = this.unlocks.decorations[item];
            if (decoration) {
                switch (decoration.category) {
                    case 'floor':
                        roomData.floor = item;
                        break;
                    case 'walls':
                        roomData.walls = item;
                        break;
                    case 'ceiling':
                        roomData.ceiling = item;
                        break;
                    case 'lighting':
                        roomData.lighting = item;
                        break;
                    case 'furniture':
                        if (!roomData.furniture.includes(item)) {
                            roomData.furniture.push(item);
                        }
                        break;
                }
            }
        });

        roomData.theme = themeId;
    }

    // Check if item is unlocked for player
    isUnlocked(playerId, itemType, itemId) {
        const playerData = this.getPlayerCustomizations(playerId);
        
        // Check if already unlocked
        if (playerData.unlockedItems.has(itemId)) {
            return true;
        }

        // Check unlock requirements
        const item = this.unlocks[itemType + 's']?.[itemId] || this.unlocks[itemType]?.[itemId];
        if (!item || !item.requirement) {
            return item?.unlocked || false;
        }

        return this.checkUnlockRequirement(playerId, item.requirement);
    }

    // Check if unlock requirement is met
    checkUnlockRequirement(playerId, requirement) {
        const playerData = this.getPlayerCustomizations(playerId);

        switch (requirement.type) {
            case 'care_quality':
                return playerData.careQuality.averageCareScore >= requirement.value;
            case 'perfect_care_days':
                return playerData.careQuality.perfectCareDays >= requirement.value;
            case 'love_level':
                // Would check bunny's love level (simplified for now)
                return true;
            case 'happiness_milestone':
                // Would check happiness achievements
                return true;
            case 'cooperative_actions':
                // Would check cooperation count
                return true;
            case 'achievement':
                return playerData.achievements.has(requirement.value);
            case 'garden_mastery':
                // Would check garden quality
                return true;
            case 'season_unlock':
                // Would check if player has experienced all seasons
                return true;
            default:
                return false;
        }
    }

    // Update care quality metrics
    updateCareQuality(playerId, careData) {
        const playerData = this.getPlayerCustomizations(playerId);
        
        playerData.careQuality.totalCareHours += (careData.hours || 1);
        
        if (careData.excellentCare) {
            playerData.careQuality.excellentCareHours += (careData.hours || 1);
        }
        
        if (careData.perfectDay) {
            playerData.careQuality.perfectCareDays += 1;
        }

        // Recalculate average
        playerData.careQuality.averageCareScore = 
            (playerData.careQuality.excellentCareHours / playerData.careQuality.totalCareHours) * 100;

        // Check for new unlocks
        const newUnlocks = this.checkForNewUnlocks(playerId);
        
        this.playerCustomizations.set(playerId, playerData);

        return { careQuality: playerData.careQuality, newUnlocks };
    }

    // Check for new unlocks based on current progress
    checkForNewUnlocks(playerId) {
        const playerData = this.getPlayerCustomizations(playerId);
        const newUnlocks = [];

        // Check all unlockable items
        const allItems = {
            ...this.unlocks.colors,
            ...this.unlocks.accessories,
            ...this.unlocks.decorations,
            ...this.unlocks.themes
        };

        for (const [itemId, item] of Object.entries(allItems)) {
            if (!playerData.unlockedItems.has(itemId) && item.requirement) {
                if (this.checkUnlockRequirement(playerId, item.requirement)) {
                    playerData.unlockedItems.add(itemId);
                    newUnlocks.push({
                        id: itemId,
                        name: item.name,
                        category: item.category || this.getItemCategory(itemId),
                        cost: item.cost
                    });
                }
            }
        }

        return newUnlocks;
    }

    // Get item category for unlocks
    getItemCategory(itemId) {
        if (this.unlocks.colors[itemId]) return 'color';
        if (this.unlocks.accessories[itemId]) return 'accessory';
        if (this.unlocks.decorations[itemId]) return 'decoration';
        if (this.unlocks.themes[itemId]) return 'theme';
        return 'unknown';
    }

    // Validate bunny name
    validateBunnyName(name) {
        if (!name || typeof name !== 'string') return false;
        if (name.length < 1 || name.length > 20) return false;
        return /^[a-zA-Z0-9\s\-'\.]+$/.test(name);
    }

    // Get room decorations
    getRoomDecorations(roomCode) {
        return this.roomDecorations.get(roomCode) || {
            theme: 'default',
            floor: 'wooden_floor',
            walls: 'basic_walls',
            ceiling: null,
            lighting: null,
            furniture: []
        };
    }

    // Get available items for player
    getAvailableItems(playerId) {
        const playerData = this.getPlayerCustomizations(playerId);
        const available = {
            colors: [],
            accessories: [],
            decorations: [],
            themes: []
        };

        // Process each category
        for (const [category, items] of Object.entries(this.unlocks)) {
            for (const [itemId, item] of Object.entries(items)) {
                const isUnlocked = this.isUnlocked(playerId, category.slice(0, -1), itemId);
                const canAfford = playerData.decorationPoints >= item.cost;
                
                available[category].push({
                    id: itemId,
                    ...item,
                    unlocked: isUnlocked,
                    canAfford,
                    owned: playerData.unlockedItems.has(itemId)
                });
            }
        }

        return available;
    }

    // Award decoration points
    awardDecorationPoints(playerId, points, reason = 'gameplay') {
        const playerData = this.getPlayerCustomizations(playerId);
        playerData.decorationPoints += points;
        this.playerCustomizations.set(playerId, playerData);

        return {
            newTotal: playerData.decorationPoints,
            awarded: points,
            reason
        };
    }

    // Persistence methods
    serialize() {
        return {
            playerCustomizations: Array.from(this.playerCustomizations.entries()).map(([id, data]) => [
                id,
                {
                    ...data,
                    unlockedItems: Array.from(data.unlockedItems),
                    achievements: Array.from(data.achievements)
                }
            ]),
            roomDecorations: Array.from(this.roomDecorations.entries())
        };
    }

    deserialize(data) {
        if (data && data.playerCustomizations) {
            this.playerCustomizations = new Map(
                data.playerCustomizations.map(([id, data]) => [
                    id,
                    {
                        ...data,
                        unlockedItems: new Set(data.unlockedItems),
                        achievements: new Set(data.achievements)
                    }
                ])
            );
        }
        if (data && data.roomDecorations) {
            this.roomDecorations = new Map(data.roomDecorations);
        }
    }
}

module.exports = CustomizationSystem;