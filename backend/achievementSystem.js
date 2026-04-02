// Achievement System
// Tracks and awards achievements across different categories

class AchievementSystem {
    constructor() {
        this.playerAchievements = new Map(); // playerId -> achievement data
        this.roomAchievements = new Map(); // roomCode -> room achievement data
        this.achievements = this.initializeAchievements();
    }

    // Initialize all available achievements
    initializeAchievements() {
        return {
            // Care Milestones
            'first_feeding': {
                id: 'first_feeding',
                name: 'First Meal',
                description: 'Fed a bunny for the first time',
                category: 'care',
                type: 'milestone',
                target: 1,
                reward: { carrots: 5, decorationPoints: 2 }
            },
            'fed_100_carrots': {
                id: 'fed_100_carrots',
                name: 'Carrot Connoisseur',
                description: 'Fed bunnies 100 carrots total',
                category: 'care',
                type: 'count',
                target: 100,
                reward: { carrots: 20, decorationPoints: 5, unlock: 'golden_carrot_badge' }
            },
            'fed_500_carrots': {
                id: 'fed_500_carrots',
                name: 'Nutrition Master',
                description: 'Fed bunnies 500 carrots total',
                category: 'care',
                type: 'count',
                target: 500,
                reward: { carrots: 50, decorationPoints: 15, unlock: 'master_feeder_title' }
            },
            'playtime_hero': {
                id: 'playtime_hero',
                name: 'Playtime Hero',
                description: 'Played with bunnies 100 times',
                category: 'care',
                type: 'count',
                target: 100,
                reward: { carrots: 15, decorationPoints: 8, unlock: 'toy_collection' }
            },
            'clean_sweep': {
                id: 'clean_sweep',
                name: 'Clean Sweep',
                description: 'Cleaned bunnies 50 times',
                category: 'care',
                type: 'count',
                target: 50,
                reward: { carrots: 10, decorationPoints: 6, unlock: 'sparkle_brush' }
            },

            // Cooperation Achievements
            'first_cooperation': {
                id: 'first_cooperation',
                name: 'Team Player',
                description: 'Performed first cooperative action',
                category: 'cooperation',
                type: 'milestone',
                target: 1,
                reward: { carrots: 8, decorationPoints: 5 }
            },
            'cooperation_master': {
                id: 'cooperation_master',
                name: 'Cooperation Master',
                description: 'Performed 50 cooperative actions',
                category: 'cooperation',
                type: 'count',
                target: 50,
                reward: { carrots: 25, decorationPoints: 12, unlock: 'harmony_decoration' }
            },
            'simultaneous_feeding': {
                id: 'simultaneous_feeding',
                name: 'Perfect Timing',
                description: 'Both fed same bunny simultaneously',
                category: 'cooperation',
                type: 'special',
                target: 1,
                reward: { carrots: 12, decorationPoints: 8, unlock: 'sync_hearts' }
            },
            'synchronized_care': {
                id: 'synchronized_care',
                name: 'Synchronized Care',
                description: 'Both players cared for bunny within 10 seconds 20 times',
                category: 'cooperation',
                type: 'count',
                target: 20,
                reward: { carrots: 30, decorationPoints: 15, unlock: 'twin_souls_badge' }
            },

            // Family Growth
            'first_hatching': {
                id: 'first_hatching',
                name: 'New Life',
                description: 'Witnessed first bunny hatching',
                category: 'family',
                type: 'milestone',
                target: 1,
                reward: { carrots: 10, decorationPoints: 8 }
            },
            'growth_watcher': {
                id: 'growth_watcher',
                name: 'Growth Watcher',
                description: 'Raised a bunny to adult stage',
                category: 'family',
                type: 'milestone',
                target: 1,
                reward: { carrots: 20, decorationPoints: 12, unlock: 'family_tree' }
            },
            'five_generations': {
                id: 'five_generations',
                name: 'Legacy Builder',
                description: 'Raised 5 generations of bunnies',
                category: 'family',
                type: 'count',
                target: 5,
                reward: { carrots: 50, decorationPoints: 25, unlock: 'ancestral_shrine' }
            },
            'big_family': {
                id: 'big_family',
                name: 'Big Family',
                description: 'Had 4 bunnies at the same time',
                category: 'family',
                type: 'special',
                target: 4,
                reward: { carrots: 35, decorationPoints: 20, unlock: 'family_portrait' }
            },

            // Garden & Resources
            'green_thumb': {
                id: 'green_thumb',
                name: 'Green Thumb',
                description: 'Harvested carrots 50 times',
                category: 'garden',
                type: 'count',
                target: 50,
                reward: { carrots: 15, decorationPoints: 10, unlock: 'premium_seeds' }
            },
            'master_gardener': {
                id: 'master_gardener',
                name: 'Master Gardener',
                description: 'Achieved 100% garden quality',
                category: 'garden',
                type: 'special',
                target: 100,
                reward: { carrots: 25, decorationPoints: 15, unlock: 'golden_watering_can' }
            },
            'abundant_harvest': {
                id: 'abundant_harvest',
                name: 'Abundant Harvest',
                description: 'Harvested 1000 carrots total',
                category: 'garden',
                type: 'count',
                target: 1000,
                reward: { carrots: 100, decorationPoints: 30, unlock: 'cornucopia_decoration' }
            },

            // Special Achievements
            'night_owl': {
                id: 'night_owl',
                name: 'Night Owl',
                description: 'Cared for bunnies during 20 night cycles',
                category: 'special',
                type: 'count',
                target: 20,
                reward: { carrots: 18, decorationPoints: 12, unlock: 'moon_lamp' }
            },
            'early_bird': {
                id: 'early_bird',
                name: 'Early Bird',
                description: 'Cared for bunnies during 20 day cycles',
                category: 'special',
                type: 'count',
                target: 20,
                reward: { carrots: 18, decorationPoints: 12, unlock: 'sun_decoration' }
            },
            'dedication': {
                id: 'dedication',
                name: 'Dedicated Caretaker',
                description: 'Played for 10 consecutive days',
                category: 'special',
                type: 'streak',
                target: 10,
                reward: { carrots: 40, decorationPoints: 25, unlock: 'dedication_crown' }
            },
            'perfectionist': {
                id: 'perfectionist',
                name: 'Perfectionist',
                description: 'Kept all bunny needs above 80% for 24 hours',
                category: 'special',
                type: 'special',
                target: 1,
                reward: { carrots: 30, decorationPoints: 20, unlock: 'perfect_care_medal' }
            }
        };
    }

    // Track an event for achievement progress
    trackEvent(playerId, roomCode, eventType, data = {}) {
        let playerData = this.playerAchievements.get(playerId) || {
            achieved: new Set(),
            progress: new Map(),
            stats: {
                feedings: 0,
                playTimes: 0,
                cleanings: 0,
                cooperativeActions: 0,
                synchronizedActions: 0,
                harvests: 0,
                totalCarrots: 0,
                nightActions: 0,
                dayActions: 0,
                bunniesRaised: 0,
                hatchingsWitnessed: 0,
                perfectCareHours: 0,
                loginStreak: 0
            }
        };

        const newAchievements = [];

        switch (eventType) {
            case 'feed':
                playerData.stats.feedings++;
                playerData.stats.totalCarrots += (data.carrots || 1);
                if (this.getCurrentCycle(roomCode) === 'day') {
                    playerData.stats.dayActions++;
                } else {
                    playerData.stats.nightActions++;
                }
                break;

            case 'play':
                playerData.stats.playTimes++;
                if (this.getCurrentCycle(roomCode) === 'day') {
                    playerData.stats.dayActions++;
                } else {
                    playerData.stats.nightActions++;
                }
                break;

            case 'clean':
                playerData.stats.cleanings++;
                if (this.getCurrentCycle(roomCode) === 'day') {
                    playerData.stats.dayActions++;
                } else {
                    playerData.stats.nightActions++;
                }
                break;

            case 'cooperation':
                playerData.stats.cooperativeActions++;
                break;

            case 'synchronized_action':
                playerData.stats.synchronizedActions++;
                break;

            case 'harvest':
                playerData.stats.harvests++;
                break;

            case 'hatching':
                playerData.stats.hatchingsWitnessed++;
                break;

            case 'bunny_growth':
                if (data.stage === 'grown') {
                    playerData.stats.bunniesRaised++;
                }
                break;

            case 'perfect_care':
                playerData.stats.perfectCareHours += (data.hours || 1);
                break;

            case 'login_streak':
                playerData.stats.loginStreak = data.streak || 0;
                break;
        }

        // Check for newly achieved achievements
        for (const achievement of Object.values(this.achievements)) {
            if (!playerData.achieved.has(achievement.id)) {
                if (this.checkAchievementProgress(achievement, playerData, data)) {
                    playerData.achieved.add(achievement.id);
                    newAchievements.push(achievement);
                }
            }
        }

        this.playerAchievements.set(playerId, playerData);
        return newAchievements;
    }

    // Check if achievement criteria is met
    checkAchievementProgress(achievement, playerData, eventData = {}) {
        switch (achievement.id) {
            case 'first_feeding':
                return playerData.stats.feedings >= 1;
            case 'fed_100_carrots':
                return playerData.stats.totalCarrots >= 100;
            case 'fed_500_carrots':
                return playerData.stats.totalCarrots >= 500;
            case 'playtime_hero':
                return playerData.stats.playTimes >= 100;
            case 'clean_sweep':
                return playerData.stats.cleanings >= 50;
            case 'first_cooperation':
                return playerData.stats.cooperativeActions >= 1;
            case 'cooperation_master':
                return playerData.stats.cooperativeActions >= 50;
            case 'simultaneous_feeding':
                return eventData.simultaneous === true;
            case 'synchronized_care':
                return playerData.stats.synchronizedActions >= 20;
            case 'first_hatching':
                return playerData.stats.hatchingsWitnessed >= 1;
            case 'growth_watcher':
                return playerData.stats.bunniesRaised >= 1;
            case 'five_generations':
                return playerData.stats.bunniesRaised >= 5;
            case 'big_family':
                return eventData.familySize >= 4;
            case 'green_thumb':
                return playerData.stats.harvests >= 50;
            case 'master_gardener':
                return eventData.gardenQuality >= 100;
            case 'abundant_harvest':
                return playerData.stats.totalCarrots >= 1000;
            case 'night_owl':
                return playerData.stats.nightActions >= 20;
            case 'early_bird':
                return playerData.stats.dayActions >= 20;
            case 'dedication':
                return playerData.stats.loginStreak >= 10;
            case 'perfectionist':
                return playerData.stats.perfectCareHours >= 24;
            default:
                return false;
        }
    }

    // Get player's achievement status
    getPlayerAchievements(playerId) {
        const playerData = this.playerAchievements.get(playerId);
        if (!playerData) {
            return {
                achieved: [],
                progress: [],
                stats: {}
            };
        }

        const achieved = Array.from(playerData.achieved).map(id => ({
            ...this.achievements[id],
            unlockedAt: Date.now() // TODO: Store actual unlock timestamp
        }));

        const progress = [];
        for (const achievement of Object.values(this.achievements)) {
            if (!playerData.achieved.has(achievement.id)) {
                const progressValue = this.calculateProgressValue(achievement, playerData);
                if (progressValue > 0) {
                    progress.push({
                        ...achievement,
                        progress: progressValue,
                        target: achievement.target
                    });
                }
            }
        }

        return {
            achieved,
            progress,
            stats: playerData.stats
        };
    }

    // Calculate current progress for an achievement
    calculateProgressValue(achievement, playerData) {
        switch (achievement.id) {
            case 'fed_100_carrots':
            case 'fed_500_carrots':
            case 'abundant_harvest':
                return playerData.stats.totalCarrots;
            case 'playtime_hero':
                return playerData.stats.playTimes;
            case 'clean_sweep':
                return playerData.stats.cleanings;
            case 'cooperation_master':
                return playerData.stats.cooperativeActions;
            case 'synchronized_care':
                return playerData.stats.synchronizedActions;
            case 'five_generations':
                return playerData.stats.bunniesRaised;
            case 'green_thumb':
                return playerData.stats.harvests;
            case 'night_owl':
                return playerData.stats.nightActions;
            case 'early_bird':
                return playerData.stats.dayActions;
            case 'dedication':
                return playerData.stats.loginStreak;
            case 'perfectionist':
                return playerData.stats.perfectCareHours;
            default:
                return 0;
        }
    }

    // Check for special room-based achievements
    checkRoomAchievements(roomCode, gameState, eventData = {}) {
        const achievements = [];
        
        // Big family achievement
        if (gameState.babies && gameState.babies.length >= 4) {
            achievements.push({
                type: 'big_family',
                familySize: gameState.babies.length
            });
        }

        // Master gardener achievement
        if (gameState.garden && gameState.garden.quality >= 100) {
            achievements.push({
                type: 'master_gardener',
                gardenQuality: gameState.garden.quality
            });
        }

        return achievements;
    }

    // Helper method to get current day/night cycle
    getCurrentCycle(roomCode) {
        // This would be called with the actual game state
        // For now, return 'day' as default
        return 'day';
    }

    // Get achievement statistics for a room
    getRoomAchievementStats(roomCode, playerIds) {
        const stats = {
            totalAchievements: 0,
            uniqueAchievements: new Set(),
            mostAchieved: null,
            cooperationScore: 0
        };

        let maxAchievements = 0;
        let cooperationTotal = 0;

        for (const playerId of playerIds) {
            const playerData = this.playerAchievements.get(playerId);
            if (playerData) {
                const achievementCount = playerData.achieved.size;
                stats.totalAchievements += achievementCount;
                
                playerData.achieved.forEach(id => stats.uniqueAchievements.add(id));
                cooperationTotal += playerData.stats.cooperativeActions;

                if (achievementCount > maxAchievements) {
                    maxAchievements = achievementCount;
                    stats.mostAchieved = playerId;
                }
            }
        }

        stats.cooperationScore = cooperationTotal;
        return stats;
    }

    // Persistence methods
    serialize() {
        return {
            playerAchievements: Array.from(this.playerAchievements.entries()).map(([id, data]) => [
                id,
                {
                    ...data,
                    achieved: Array.from(data.achieved)
                }
            ]),
            roomAchievements: Array.from(this.roomAchievements.entries())
        };
    }

    deserialize(data) {
        if (data && data.playerAchievements) {
            this.playerAchievements = new Map(
                data.playerAchievements.map(([id, data]) => [
                    id,
                    {
                        ...data,
                        achieved: new Set(data.achieved)
                    }
                ])
            );
        }
        if (data && data.roomAchievements) {
            this.roomAchievements = new Map(data.roomAchievements);
        }
    }

    // Get achievement by ID
    getAchievementById(id) {
        return this.achievements[id];
    }

    // Get all achievements in a category
    getAchievementsByCategory(category) {
        return Object.values(this.achievements).filter(a => a.category === category);
    }
}

module.exports = AchievementSystem;