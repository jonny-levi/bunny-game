// Daily Rewards System
// Manages streak tracking, couple bonuses, and reward distribution

const fs = require('fs').promises;
const path = require('path');

const REWARDS_SAVE_DIR = path.join(__dirname, 'saves', 'rewards');

class DailyRewardManager {
    constructor() {
        this.playerStreaks = new Map();
        this.rewardConfig = {
            baseRewards: {
                carrots: 3,
                experience: 10,
                coins: 5 // Future currency system
            },
            streakMultipliers: {
                3: 1.2,   // 3 days: 20% bonus
                7: 1.5,   // 7 days: 50% bonus
                14: 2.0,  // 14 days: 100% bonus
                30: 2.5   // 30 days: 150% bonus
            },
            coupleBonus: {
                multiplier: 1.3, // 30% bonus when both players claim
                timeWindow: 3600000 // 1 hour window for couple bonus
            },
            specialDays: {
                weekend: 1.25, // 25% weekend bonus
                milestone: 3.0  // 300% bonus on milestone days (7, 30, 100 days)
            }
        };
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(REWARDS_SAVE_DIR, { recursive: true });
        } catch (error) {
            console.error('Failed to create rewards directory:', error);
        }
    }

    async loadPlayerStreak(playerId) {
        try {
            const filePath = path.join(REWARDS_SAVE_DIR, `${playerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            const data = await fs.readFile(filePath, 'utf8');
            const streakData = JSON.parse(data);
            
            // Validate streak data
            if (!streakData.lastClaim || !streakData.streak || streakData.streak < 0) {
                return this.createNewStreak();
            }
            
            return streakData;
        } catch (error) {
            // File doesn't exist or is corrupted, create new streak
            return this.createNewStreak();
        }
    }

    async savePlayerStreak(playerId, streakData) {
        try {
            const filePath = path.join(REWARDS_SAVE_DIR, `${playerId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
            await fs.writeFile(filePath, JSON.stringify(streakData, null, 2));
        } catch (error) {
            console.error(`Failed to save streak for player ${playerId}:`, error);
        }
    }

    createNewStreak() {
        return {
            streak: 0,
            lastClaim: null,
            totalClaims: 0,
            bestStreak: 0,
            rewards: {
                totalCarrots: 0,
                totalExperience: 0,
                totalCoins: 0
            }
        };
    }

    async checkDailyReward(playerId, roomCode) {
        const streakData = await this.loadPlayerStreak(playerId);
        const now = new Date();
        const lastClaim = streakData.lastClaim ? new Date(streakData.lastClaim) : null;

        // Check if player can claim today
        const canClaim = this.canClaimToday(lastClaim, now);
        const isConsecutive = this.isConsecutiveDay(lastClaim, now);

        return {
            canClaim,
            streak: streakData.streak,
            lastClaim: streakData.lastClaim,
            nextReward: this.calculateReward(streakData.streak + (isConsecutive ? 1 : 0), roomCode),
            hoursUntilNext: lastClaim ? this.hoursUntilNextClaim(lastClaim, now) : 0
        };
    }

    async claimDailyReward(playerId, roomCode, partnerPlayerId = null) {
        const streakData = await this.loadPlayerStreak(playerId);
        const now = new Date();
        const lastClaim = streakData.lastClaim ? new Date(streakData.lastClaim) : null;

        // Validate claim
        if (!this.canClaimToday(lastClaim, now)) {
            return {
                success: false,
                message: 'Daily reward already claimed today!',
                hoursUntilNext: this.hoursUntilNextClaim(lastClaim, now)
            };
        }

        // Update streak
        const isConsecutive = this.isConsecutiveDay(lastClaim, now);
        if (isConsecutive) {
            streakData.streak += 1;
        } else {
            streakData.streak = 1; // Reset streak but start new one
        }

        streakData.lastClaim = now.toISOString();
        streakData.totalClaims += 1;
        streakData.bestStreak = Math.max(streakData.bestStreak, streakData.streak);

        // Calculate rewards
        let reward = this.calculateReward(streakData.streak, roomCode);

        // Apply couple bonus if partner also claimed recently
        if (partnerPlayerId) {
            const coupleBonus = await this.checkCoupleBonus(partnerPlayerId, now);
            if (coupleBonus.eligible) {
                reward = this.applyCoupleBonus(reward);
                reward.bonuses.push('Couple Bonus: +30% rewards!');
            }
        }

        // Update cumulative rewards
        streakData.rewards.totalCarrots += reward.carrots;
        streakData.rewards.totalExperience += reward.experience;
        streakData.rewards.totalCoins += reward.coins;

        // Save updated streak
        await this.savePlayerStreak(playerId, streakData);

        return {
            success: true,
            reward,
            streak: streakData.streak,
            message: this.getRewardMessage(streakData.streak, reward)
        };
    }

    canClaimToday(lastClaim, now) {
        if (!lastClaim) return true;

        const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return currentDate > lastClaimDate;
    }

    isConsecutiveDay(lastClaim, now) {
        if (!lastClaim) return false;

        const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());
        const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        
        return lastClaimDate.getTime() === yesterdayDate.getTime();
    }

    hoursUntilNextClaim(lastClaim, now) {
        if (!lastClaim) return 0;

        const nextClaim = new Date(lastClaim);
        nextClaim.setDate(nextClaim.getDate() + 1);
        nextClaim.setHours(0, 0, 0, 0); // Next day at midnight

        const diff = nextClaim - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
    }

    calculateReward(streak, roomCode) {
        let reward = { ...this.rewardConfig.baseRewards };
        let bonuses = [];

        // Apply streak multiplier
        const streakBonus = this.getStreakMultiplier(streak);
        if (streakBonus > 1) {
            reward.carrots = Math.floor(reward.carrots * streakBonus);
            reward.experience = Math.floor(reward.experience * streakBonus);
            reward.coins = Math.floor(reward.coins * streakBonus);
            bonuses.push(`${streak}-day streak bonus: +${Math.round((streakBonus - 1) * 100)}%!`);
        }

        // Weekend bonus
        const now = new Date();
        if (now.getDay() === 0 || now.getDay() === 6) { // Sunday or Saturday
            const weekendMultiplier = this.rewardConfig.specialDays.weekend;
            reward.carrots = Math.floor(reward.carrots * weekendMultiplier);
            reward.experience = Math.floor(reward.experience * weekendMultiplier);
            reward.coins = Math.floor(reward.coins * weekendMultiplier);
            bonuses.push('Weekend bonus: +25%!');
        }

        // Milestone bonus
        if (this.isMilestoneDay(streak)) {
            const milestoneMultiplier = this.rewardConfig.specialDays.milestone;
            reward.carrots = Math.floor(reward.carrots * milestoneMultiplier);
            reward.experience = Math.floor(reward.experience * milestoneMultiplier);
            reward.coins = Math.floor(reward.coins * milestoneMultiplier);
            bonuses.push(`🎉 ${streak}-day milestone bonus: +200%!`);
        }

        reward.bonuses = bonuses;
        return reward;
    }

    getStreakMultiplier(streak) {
        const multipliers = this.rewardConfig.streakMultipliers;
        const thresholds = Object.keys(multipliers).map(Number).sort((a, b) => b - a);
        
        for (const threshold of thresholds) {
            if (streak >= threshold) {
                return multipliers[threshold];
            }
        }
        
        return 1.0;
    }

    applyCoupleBonus(reward) {
        const multiplier = this.rewardConfig.coupleBonus.multiplier;
        return {
            carrots: Math.floor(reward.carrots * multiplier),
            experience: Math.floor(reward.experience * multiplier),
            coins: Math.floor(reward.coins * multiplier),
            bonuses: [...(reward.bonuses || []), 'Couple bonus applied!']
        };
    }

    async checkCoupleBonus(partnerPlayerId, currentTime) {
        try {
            const partnerStreak = await this.loadPlayerStreak(partnerPlayerId);
            if (!partnerStreak.lastClaim) return { eligible: false };

            const partnerLastClaim = new Date(partnerStreak.lastClaim);
            const timeDiff = currentTime - partnerLastClaim;
            
            return {
                eligible: timeDiff <= this.rewardConfig.coupleBonus.timeWindow,
                partnerStreak: partnerStreak.streak
            };
        } catch (error) {
            return { eligible: false };
        }
    }

    isMilestoneDay(streak) {
        const milestones = [7, 30, 50, 100, 200, 365];
        return milestones.includes(streak);
    }

    getRewardMessage(streak, reward) {
        if (streak === 1) {
            return `Welcome to your daily rewards! Claim every day to build your streak. 🎁`;
        } else if (streak < 7) {
            return `Great job! ${streak} days in a row! Keep it up! 🔥`;
        } else if (streak < 30) {
            return `Amazing streak! ${streak} days of dedication! You're on fire! 🌟`;
        } else {
            return `Incredible! ${streak} days straight! You're a true bunny parent! 🏆`;
        }
    }

    // Admin/Debug functions
    async resetPlayerStreak(playerId) {
        const newStreak = this.createNewStreak();
        await this.savePlayerStreak(playerId, newStreak);
        return newStreak;
    }

    async getLeaderboard() {
        try {
            const files = await fs.readdir(REWARDS_SAVE_DIR);
            const streaks = [];

            for (const file of files) {
                try {
                    const filePath = path.join(REWARDS_SAVE_DIR, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const streakData = JSON.parse(data);
                    
                    streaks.push({
                        playerId: file.replace('.json', ''),
                        currentStreak: streakData.streak,
                        bestStreak: streakData.bestStreak,
                        totalClaims: streakData.totalClaims
                    });
                } catch (error) {
                    console.error(`Failed to read streak file ${file}:`, error);
                }
            }

            return streaks.sort((a, b) => b.currentStreak - a.currentStreak);
        } catch (error) {
            console.error('Failed to generate leaderboard:', error);
            return [];
        }
    }
}

module.exports = DailyRewardManager;