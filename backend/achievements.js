// Achievement System
// Server-side achievement tracking and awarding

const fs = require('fs').promises;
const path = require('path');

const ACHIEVEMENTS_SAVE_DIR = path.join(__dirname, 'saves', 'achievements');

class AchievementManager {
    constructor() {
        this.playerAchievements = new Map();
        this.achievementDefinitions = this.initializeAchievements();
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(ACHIEVEMENTS_SAVE_DIR, { recursive: true });
        } catch (error) {
            console.error('Failed to create achievements directory:', error);
        }
    }

    initializeAchievements() {
        return {
            // First Steps
            'first_feed': {
                id: 'first_feed',
                title: '🥕 First Bite',
                description: 'Feed your bunny for the first time',
                category: 'basic',
                reward: { carrots: 2, experience: 5 },
                criteria: { action: 'feed', count: 1 }
            },
            'first_play': {
                id: 'first_play',
                title: '🎾 Playtime',
                description: 'Play with your bunny for the first time',
                category: 'basic',
                reward: { carrots: 2, experience: 5 },
                criteria: { action: 'play', count: 1 }
            },
            'first_hatch': {
                id: 'first_hatch',
                title: '🥚 New Life',
                description: 'Help hatch your first egg',
                category: 'basic',
                reward: { carrots: 5, experience: 10 },
                criteria: { event: 'egg_hatched', count: 1 }
            },
            'first_partner': {
                id: 'first_partner',
                title: '👫 Better Together',
                description: 'Play with a partner for the first time',
                category: 'social',
                reward: { carrots: 3, experience: 10 },
                criteria: { event: 'partner_connected', count: 1 }
            },

            // Care Achievements
            'caring_parent': {
                id: 'caring_parent',
                title: '❤️ Caring Parent',
                description: 'Perform 50 care actions',
                category: 'care',
                reward: { carrots: 10, experience: 25 },
                criteria: { actions: ['feed', 'play', 'clean', 'pet'], total: 50 }
            },
            'master_caregiver': {
                id: 'master_caregiver',
                title: '🏆 Master Caregiver',
                description: 'Perform 200 care actions',
                category: 'care',
                reward: { carrots: 25, experience: 50 },
                criteria: { actions: ['feed', 'play', 'clean', 'pet'], total: 200 }
            },
            'feeding_frenzy': {
                id: 'feeding_frenzy',
                title: '🥕 Feeding Frenzy',
                description: 'Feed bunnies 100 times',
                category: 'care',
                reward: { carrots: 20, experience: 30 },
                criteria: { action: 'feed', count: 100 }
            },
            'playtime_champion': {
                id: 'playtime_champion',
                title: '🎮 Playtime Champion',
                description: 'Play with bunnies 100 times',
                category: 'care',
                reward: { carrots: 15, experience: 35 },
                criteria: { action: 'play', count: 100 }
            },

            // Growth Achievements
            'proud_parent': {
                id: 'proud_parent',
                title: '👨‍👩‍👧‍👦 Proud Parent',
                description: 'Raise a bunny to grown stage',
                category: 'growth',
                reward: { carrots: 15, experience: 40 },
                criteria: { event: 'baby_grew', stage: 'grown', count: 1 }
            },
            'family_builder': {
                id: 'family_builder',
                title: '🏠 Family Builder',
                description: 'Raise 3 bunnies to grown stage',
                category: 'growth',
                reward: { carrots: 30, experience: 75 },
                criteria: { event: 'baby_grew', stage: 'grown', count: 3 }
            },
            'bunny_farm': {
                id: 'bunny_farm',
                title: '🐰 Bunny Farm',
                description: 'Raise 10 bunnies to grown stage',
                category: 'growth',
                reward: { carrots: 50, experience: 100 },
                criteria: { event: 'baby_grew', stage: 'grown', count: 10 }
            },

            // Cooperation Achievements
            'team_player': {
                id: 'team_player',
                title: '🤝 Team Player',
                description: 'Perform 25 cooperative actions',
                category: 'cooperation',
                reward: { carrots: 15, experience: 30 },
                criteria: { event: 'cooperative_bonus', count: 25 }
            },
            'perfect_partners': {
                id: 'perfect_partners',
                title: '💕 Perfect Partners',
                description: 'Perform 100 cooperative actions',
                category: 'cooperation',
                reward: { carrots: 35, experience: 60 },
                criteria: { event: 'cooperative_bonus', count: 100 }
            },
            'synchronized': {
                id: 'synchronized',
                title: '⚡ Synchronized',
                description: 'Get 10 cooperative bonuses in one session',
                category: 'cooperation',
                reward: { carrots: 20, experience: 40 },
                criteria: { event: 'cooperative_bonus', session: 10 }
            },

            // Daily/Streak Achievements
            'daily_visitor': {
                id: 'daily_visitor',
                title: '📅 Daily Visitor',
                description: 'Claim daily rewards for 7 days in a row',
                category: 'dedication',
                reward: { carrots: 20, experience: 50 },
                criteria: { daily_streak: 7 }
            },
            'dedicated_parent': {
                id: 'dedicated_parent',
                title: '⭐ Dedicated Parent',
                description: 'Claim daily rewards for 30 days in a row',
                category: 'dedication',
                reward: { carrots: 50, experience: 100 },
                criteria: { daily_streak: 30 }
            },
            'legendary_caregiver': {
                id: 'legendary_caregiver',
                title: '👑 Legendary Caregiver',
                description: 'Claim daily rewards for 100 days in a row',
                category: 'dedication',
                reward: { carrots: 100, experience: 200 },
                criteria: { daily_streak: 100 }
            },

            // Garden Achievements
            'green_thumb': {
                id: 'green_thumb',
                title: '🌱 Green Thumb',
                description: 'Harvest carrots 50 times',
                category: 'garden',
                reward: { carrots: 25, experience: 30 },
                criteria: { action: 'harvest', count: 50 }
            },
            'master_gardener': {
                id: 'master_gardener',
                title: '🌿 Master Gardener',
                description: 'Harvest carrots 200 times',
                category: 'garden',
                reward: { carrots: 50, experience: 75 },
                criteria: { action: 'harvest', count: 200 }
            },

            // Special Achievements
            'night_owl': {
                id: 'night_owl',
                title: '🌙 Night Owl',
                description: 'Care for bunnies during 25 night cycles',
                category: 'special',
                reward: { carrots: 15, experience: 35 },
                criteria: { night_actions: 25 }
            },
            'early_bird': {
                id: 'early_bird',
                title: '🌅 Early Bird',
                description: 'Care for bunnies during 25 day cycles',
                category: 'special',
                reward: { carrots: 15, experience: 35 },
                criteria: { day_actions: 25 }
            },
            'love_guru': {
                id: 'love_guru',
                title: '💖 Love Guru',
                description: 'Pet bunnies 150 times',
                category: 'special',
                reward: { carrots: 20, experience: 45 },
                criteria: { action: 'pet', count: 150 }
            },
            'cleanliness_expert': {
                id: 'cleanliness_expert',
                title: '✨ Cleanliness Expert',
                description: 'Clean bunnies 100 times',
                category: 'special',
                reward: { carrots: 18, experience: 40 },
                criteria: { action: 'clean', count: 100 }
            },

            // Milestone Achievements
            'time_traveler': {
                id: 'time_traveler',
                title: '⏰ Time Traveler',
                description: 'Play for 24 hours total',
                category: 'milestone',
                reward: { carrots: 30, experience: 60 },
                criteria: { play_time: 24 * 60 * 60 * 1000 } // 24 hours in milliseconds
            },
            'bunny_whisperer': {
                id: 'bunny_whisperer',
                title: '🗣️ Bunny Whisperer',
                description: 'Have 5 bunnies with maximum love (100)',
                category: 'milestone',
                reward: { carrots: 40, experience: 80 },
                criteria: { max_love_bunnies: 5 }
            }
        };
    }

    async loadPlayerAchievements(playerId) {
        try {
            const filePath = path.join(ACHIEVEMENTS_SAVE_DIR, `${playerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            const achievementData = JSON.parse(data);
            
            // Ensure progress exists for all achievements
            const progress = achievementData.progress || {};
            const unlocked = achievementData.unlocked || [];
            
            return {
                progress,
                unlocked,
                totalRewards: achievementData.totalRewards || { carrots: 0, experience: 0 },
                lastUpdate: achievementData.lastUpdate || Date.now()
            };
        } catch (error) {
            // File doesn't exist, create new achievement data
            return {
                progress: {},
                unlocked: [],
                totalRewards: { carrots: 0, experience: 0 },
                lastUpdate: Date.now()
            };
        }
    }

    async savePlayerAchievements(playerId, achievementData) {
        try {
            const filePath = path.join(ACHIEVEMENTS_SAVE_DIR, `${playerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            achievementData.lastUpdate = Date.now();
            await fs.writeFile(filePath, JSON.stringify(achievementData, null, 2));
        } catch (error) {
            console.error(`Failed to save achievements for player ${playerId}:`, error);
        }
    }

    async checkAndUpdateAchievements(playerId, eventType, data = {}) {
        const playerData = await this.loadPlayerAchievements(playerId);
        let newlyUnlocked = [];

        // Update progress for relevant achievements
        for (const [achievementId, definition] of Object.entries(this.achievementDefinitions)) {
            // Skip if already unlocked
            if (playerData.unlocked.includes(achievementId)) {
                continue;
            }

            const criteria = definition.criteria;
            let progress = playerData.progress[achievementId] || {};
            let shouldCheck = false;

            // Update progress based on event type
            if (eventType === 'action' && criteria.action && criteria.action === data.action) {
                progress.count = (progress.count || 0) + 1;
                shouldCheck = progress.count >= criteria.count;
            } else if (eventType === 'action' && criteria.actions && criteria.actions.includes(data.action)) {
                progress.total = (progress.total || 0) + 1;
                shouldCheck = progress.total >= criteria.total;
            } else if (eventType === 'event' && criteria.event && criteria.event === data.event) {
                if (criteria.stage && data.stage !== criteria.stage) {
                    continue; // Stage-specific event doesn't match
                }
                progress.count = (progress.count || 0) + 1;
                shouldCheck = progress.count >= criteria.count;
            } else if (eventType === 'daily_streak' && criteria.daily_streak) {
                shouldCheck = data.streak >= criteria.daily_streak;
            } else if (eventType === 'night_action' && criteria.night_actions) {
                progress.count = (progress.count || 0) + 1;
                shouldCheck = progress.count >= criteria.night_actions;
            } else if (eventType === 'day_action' && criteria.day_actions) {
                progress.count = (progress.count || 0) + 1;
                shouldCheck = progress.count >= criteria.day_actions;
            } else if (eventType === 'cooperative_bonus') {
                if (criteria.event === 'cooperative_bonus') {
                    progress.count = (progress.count || 0) + 1;
                    progress.sessionCount = (progress.sessionCount || 0) + 1;
                    shouldCheck = progress.count >= (criteria.count || criteria.session || 0);
                }
            } else if (eventType === 'session_start') {
                // Reset session counters
                Object.keys(playerData.progress).forEach(id => {
                    if (playerData.progress[id].sessionCount !== undefined) {
                        playerData.progress[id].sessionCount = 0;
                    }
                });
            }

            // Check if achievement is unlocked
            if (shouldCheck && !playerData.unlocked.includes(achievementId)) {
                playerData.unlocked.push(achievementId);
                newlyUnlocked.push(definition);
                
                // Add rewards
                if (definition.reward) {
                    if (definition.reward.carrots) {
                        playerData.totalRewards.carrots += definition.reward.carrots;
                    }
                    if (definition.reward.experience) {
                        playerData.totalRewards.experience += definition.reward.experience;
                    }
                }
                
                console.log(`Player ${playerId} unlocked achievement: ${definition.title}`);
            }

            // Update progress
            playerData.progress[achievementId] = progress;
        }

        // Save updated data
        await this.savePlayerAchievements(playerId, playerData);

        return {
            newlyUnlocked,
            totalUnlocked: playerData.unlocked.length,
            totalRewards: playerData.totalRewards,
            progress: playerData.progress
        };
    }

    async getPlayerAchievements(playerId) {
        const playerData = await this.loadPlayerAchievements(playerId);
        
        const achievements = {
            unlocked: playerData.unlocked.map(id => ({
                ...this.achievementDefinitions[id],
                unlockedAt: playerData.lastUpdate
            })),
            inProgress: [],
            locked: []
        };

        // Categorize achievements
        for (const [achievementId, definition] of Object.entries(this.achievementDefinitions)) {
            if (playerData.unlocked.includes(achievementId)) {
                continue; // Already in unlocked list
            }

            const progress = playerData.progress[achievementId];
            const progressInfo = this.getAchievementProgress(definition, progress);

            if (progressInfo.hasProgress) {
                achievements.inProgress.push({
                    ...definition,
                    progress: progressInfo
                });
            } else {
                achievements.locked.push(definition);
            }
        }

        return {
            ...achievements,
            stats: {
                totalUnlocked: achievements.unlocked.length,
                totalAchievements: Object.keys(this.achievementDefinitions).length,
                completionPercentage: Math.round((achievements.unlocked.length / Object.keys(this.achievementDefinitions).length) * 100),
                totalRewards: playerData.totalRewards
            }
        };
    }

    getAchievementProgress(definition, progress = {}) {
        const criteria = definition.criteria;
        
        if (criteria.count) {
            return {
                hasProgress: (progress.count || 0) > 0,
                current: progress.count || 0,
                required: criteria.count,
                percentage: Math.min(100, Math.round(((progress.count || 0) / criteria.count) * 100))
            };
        } else if (criteria.total) {
            return {
                hasProgress: (progress.total || 0) > 0,
                current: progress.total || 0,
                required: criteria.total,
                percentage: Math.min(100, Math.round(((progress.total || 0) / criteria.total) * 100))
            };
        } else if (criteria.daily_streak) {
            return {
                hasProgress: false,
                required: criteria.daily_streak,
                description: `Maintain ${criteria.daily_streak} day streak`
            };
        }

        return { hasProgress: false };
    }

    // Convenience method for common achievement updates
    async updateForAction(playerId, action, isNight = false) {
        const updates = [];
        
        // Basic action update
        updates.push(this.checkAndUpdateAchievements(playerId, 'action', { action }));
        
        // Time-based updates
        if (isNight) {
            updates.push(this.checkAndUpdateAchievements(playerId, 'night_action'));
        } else {
            updates.push(this.checkAndUpdateAchievements(playerId, 'day_action'));
        }

        const results = await Promise.all(updates);
        
        // Combine results
        const combined = {
            newlyUnlocked: [],
            totalRewards: { carrots: 0, experience: 0 }
        };

        results.forEach(result => {
            combined.newlyUnlocked.push(...result.newlyUnlocked);
            combined.totalRewards.carrots += result.totalRewards.carrots || 0;
            combined.totalRewards.experience += result.totalRewards.experience || 0;
        });

        return combined;
    }

    // Admin/Debug functions
    async resetPlayerAchievements(playerId) {
        const resetData = {
            progress: {},
            unlocked: [],
            totalRewards: { carrots: 0, experience: 0 },
            lastUpdate: Date.now()
        };
        await this.savePlayerAchievements(playerId, resetData);
        return resetData;
    }

    async getGlobalStats() {
        try {
            const files = await fs.readdir(ACHIEVEMENTS_SAVE_DIR);
            let totalPlayers = 0;
            let totalUnlocked = 0;
            const achievementCounts = {};

            for (const file of files) {
                try {
                    const filePath = path.join(ACHIEVEMENTS_SAVE_DIR, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const achievementData = JSON.parse(data);
                    
                    totalPlayers++;
                    totalUnlocked += achievementData.unlocked.length;
                    
                    achievementData.unlocked.forEach(id => {
                        achievementCounts[id] = (achievementCounts[id] || 0) + 1;
                    });
                } catch (error) {
                    console.error(`Failed to read achievement file ${file}:`, error);
                }
            }

            const totalPossible = totalPlayers * Object.keys(this.achievementDefinitions).length;
            
            return {
                totalPlayers,
                totalUnlocked,
                totalPossible,
                completionRate: totalPossible > 0 ? Math.round((totalUnlocked / totalPossible) * 100) : 0,
                mostUnlocked: Object.entries(achievementCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([id, count]) => ({
                        achievement: this.achievementDefinitions[id],
                        unlockedBy: count
                    }))
            };
        } catch (error) {
            console.error('Failed to generate global achievement stats:', error);
            return null;
        }
    }
}

module.exports = AchievementManager;