// Daily Rewards System
// Tracks daily logins, streaks, and couple coordination bonuses

class RewardsSystem {
    constructor() {
        this.loginData = new Map(); // playerId -> login info
        this.coupleRewards = new Map(); // roomCode -> couple reward info
    }

    // Check if player has logged in today
    hasLoggedInToday(playerId) {
        const loginInfo = this.loginData.get(playerId);
        if (!loginInfo) return false;
        
        const today = this.getTodayDateString();
        return loginInfo.lastLoginDate === today;
    }

    // Process daily login for a player
    processDailyLogin(playerId, roomCode = null) {
        const today = this.getTodayDateString();
        const now = Date.now();
        
        let loginInfo = this.loginData.get(playerId) || {
            lastLoginDate: null,
            currentStreak: 0,
            longestStreak: 0,
            totalLogins: 0,
            lastLoginTimestamp: 0,
            rewardsEarned: []
        };

        // Check if already logged in today
        if (loginInfo.lastLoginDate === today) {
            return { alreadyLoggedIn: true, loginInfo };
        }

        // Calculate streak
        const yesterday = this.getYesterdayDateString();
        if (loginInfo.lastLoginDate === yesterday) {
            loginInfo.currentStreak += 1;
        } else if (loginInfo.lastLoginDate !== today) {
            loginInfo.currentStreak = 1; // Reset streak if gap
        }

        // Update login info
        loginInfo.lastLoginDate = today;
        loginInfo.lastLoginTimestamp = now;
        loginInfo.totalLogins += 1;
        loginInfo.longestStreak = Math.max(loginInfo.longestStreak, loginInfo.currentStreak);

        this.loginData.set(playerId, loginInfo);

        // Calculate rewards
        const rewards = this.calculateDailyRewards(loginInfo, roomCode, playerId);
        
        return {
            alreadyLoggedIn: false,
            loginInfo,
            rewards,
            isNewStreak: loginInfo.currentStreak > 1
        };
    }

    // Calculate couple coordination bonus
    checkCoupleCoordination(roomCode, playerId) {
        if (!roomCode) return null;

        let coupleInfo = this.coupleRewards.get(roomCode) || {
            lastCoordinatedDate: null,
            coordinatedDays: 0,
            longestCoordinatedStreak: 0,
            bonusesEarned: []
        };

        const today = this.getTodayDateString();
        const partnerLogins = this.getPartnersLoggedInToday(roomCode, playerId);
        
        if (partnerLogins.length > 0) {
            // Both partners logged in today
            if (coupleInfo.lastCoordinatedDate !== today) {
                const yesterday = this.getYesterdayDateString();
                if (coupleInfo.lastCoordinatedDate === yesterday) {
                    coupleInfo.coordinatedDays += 1;
                } else {
                    coupleInfo.coordinatedDays = 1;
                }
                
                coupleInfo.lastCoordinatedDate = today;
                coupleInfo.longestCoordinatedStreak = Math.max(
                    coupleInfo.longestCoordinatedStreak, 
                    coupleInfo.coordinatedDays
                );

                this.coupleRewards.set(roomCode, coupleInfo);

                return {
                    coordinated: true,
                    streak: coupleInfo.coordinatedDays,
                    bonus: this.calculateCoordinationBonus(coupleInfo.coordinatedDays)
                };
            }
        }

        return { coordinated: false };
    }

    // Get partners who logged in today
    getPartnersLoggedInToday(roomCode, playerId) {
        const today = this.getTodayDateString();
        const partners = [];
        
        for (const [pid, loginInfo] of this.loginData.entries()) {
            if (pid !== playerId && loginInfo.lastLoginDate === today) {
                // Check if this player is in the same room (simplified)
                partners.push(pid);
            }
        }
        
        return partners;
    }

    // Calculate daily rewards based on streak
    calculateDailyRewards(loginInfo, roomCode, playerId) {
        const rewards = {
            carrots: 0,
            decorationPoints: 0,
            unlocks: [],
            special: null
        };

        const streak = loginInfo.currentStreak;

        // Base rewards
        rewards.carrots = 3;
        rewards.decorationPoints = 1;

        // Streak bonuses
        if (streak >= 3) rewards.carrots += 2;
        if (streak >= 7) {
            rewards.carrots += 3;
            rewards.decorationPoints += 2;
        }
        if (streak >= 14) {
            rewards.carrots += 5;
            rewards.decorationPoints += 3;
            rewards.unlocks.push('golden_carrot_decoration');
        }
        if (streak >= 30) {
            rewards.special = 'streak_master_title';
            rewards.decorationPoints += 10;
        }

        // Milestone rewards
        if (loginInfo.totalLogins === 7) {
            rewards.unlocks.push('weekly_warrior_badge');
        }
        if (loginInfo.totalLogins === 30) {
            rewards.unlocks.push('monthly_champion_badge');
        }
        if (loginInfo.totalLogins === 100) {
            rewards.unlocks.push('dedication_master_badge');
        }

        // Couple coordination bonus
        const coupleBonus = this.checkCoupleCoordination(roomCode, playerId);
        if (coupleBonus && coupleBonus.coordinated) {
            rewards.carrots += coupleBonus.bonus.carrots;
            rewards.decorationPoints += coupleBonus.bonus.decorationPoints;
            if (coupleBonus.bonus.unlocks) {
                rewards.unlocks.push(...coupleBonus.bonus.unlocks);
            }
        }

        return rewards;
    }

    // Calculate couple coordination bonus
    calculateCoordinationBonus(coordinatedDays) {
        const bonus = {
            carrots: 2,
            decorationPoints: 1,
            unlocks: []
        };

        if (coordinatedDays >= 3) {
            bonus.carrots += 3;
            bonus.decorationPoints += 2;
        }
        if (coordinatedDays >= 7) {
            bonus.carrots += 5;
            bonus.decorationPoints += 3;
            bonus.unlocks.push('couple_harmony_decoration');
        }
        if (coordinatedDays >= 14) {
            bonus.unlocks.push('soulmate_title');
        }

        return bonus;
    }

    // Get player's reward status
    getPlayerRewardStatus(playerId) {
        const loginInfo = this.loginData.get(playerId);
        if (!loginInfo) {
            return {
                hasLoggedInToday: false,
                currentStreak: 0,
                totalLogins: 0,
                canClaimRewards: false
            };
        }

        return {
            hasLoggedInToday: this.hasLoggedInToday(playerId),
            currentStreak: loginInfo.currentStreak,
            longestStreak: loginInfo.longestStreak,
            totalLogins: loginInfo.totalLogins,
            canClaimRewards: !this.hasLoggedInToday(playerId)
        };
    }

    // Helper functions
    getTodayDateString() {
        const today = new Date();
        return today.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    getYesterdayDateString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    // Persistence methods
    serialize() {
        return {
            loginData: Array.from(this.loginData.entries()),
            coupleRewards: Array.from(this.coupleRewards.entries())
        };
    }

    deserialize(data) {
        if (data && data.loginData) {
            this.loginData = new Map(data.loginData);
        }
        if (data && data.coupleRewards) {
            this.coupleRewards = new Map(data.coupleRewards);
        }
    }

    // Reset daily data (for testing or admin use)
    resetDailyData() {
        this.loginData.clear();
        this.coupleRewards.clear();
    }

    // Get statistics for a room
    getRoomStatistics(roomCode, playerIds) {
        const stats = {
            totalLogins: 0,
            averageStreak: 0,
            coordinatedDays: 0,
            activePlayers: 0
        };

        let totalStreak = 0;
        let activeCount = 0;

        for (const playerId of playerIds) {
            const loginInfo = this.loginData.get(playerId);
            if (loginInfo) {
                stats.totalLogins += loginInfo.totalLogins;
                totalStreak += loginInfo.currentStreak;
                
                if (this.hasLoggedInToday(playerId)) {
                    activeCount++;
                }
            }
        }

        stats.activePlayers = activeCount;
        stats.averageStreak = playerIds.length > 0 ? totalStreak / playerIds.length : 0;

        const coupleInfo = this.coupleRewards.get(roomCode);
        if (coupleInfo) {
            stats.coordinatedDays = coupleInfo.coordinatedDays;
        }

        return stats;
    }
}

module.exports = RewardsSystem;