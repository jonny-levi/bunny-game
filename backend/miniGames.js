// Mini-Games System
// Handles various mini-games including enhanced garden system

class MiniGamesSystem {
    constructor() {
        this.gameInstances = new Map(); // roomCode -> game instances
        this.playerScores = new Map(); // playerId -> scores across games
        this.gameDefinitions = this.initializeGames();
    }

    // Initialize available mini-games
    initializeGames() {
        return {
            'enhanced_garden': {
                name: 'Enhanced Garden',
                description: 'Plant, water, and harvest carrots with strategic timing',
                maxPlayers: 2,
                duration: 300000, // 5 minutes
                rewards: {
                    carrotsPerSuccess: 3,
                    decorationPoints: 2,
                    experiencePoints: 5
                }
            },
            'bunny_races': {
                name: 'Bunny Races',
                description: 'Race your bunnies through obstacle courses',
                maxPlayers: 2,
                duration: 180000, // 3 minutes
                rewards: {
                    carrotsPerSuccess: 2,
                    decorationPoints: 1,
                    experiencePoints: 3
                }
            },
            'memory_match': {
                name: 'Carrot Memory',
                description: 'Match pairs of carrots to win rewards',
                maxPlayers: 2,
                duration: 240000, // 4 minutes
                rewards: {
                    carrotsPerSuccess: 1,
                    decorationPoints: 3,
                    experiencePoints: 4
                }
            },
            'cooperative_puzzle': {
                name: 'Nest Puzzle',
                description: 'Work together to solve nest decoration puzzles',
                maxPlayers: 2,
                duration: 360000, // 6 minutes
                rewards: {
                    carrotsPerSuccess: 4,
                    decorationPoints: 5,
                    experiencePoints: 8
                }
            }
        };
    }

    // Start a mini-game
    startMiniGame(roomCode, gameType, playerIds = []) {
        const gameDefinition = this.gameDefinitions[gameType];
        if (!gameDefinition) {
            return { success: false, message: 'Unknown game type' };
        }

        if (playerIds.length > gameDefinition.maxPlayers) {
            return { success: false, message: 'Too many players for this game' };
        }

        let gameInstance;
        switch (gameType) {
            case 'enhanced_garden':
                gameInstance = this.createEnhancedGarden(roomCode, playerIds);
                break;
            case 'bunny_races':
                gameInstance = this.createBunnyRaces(roomCode, playerIds);
                break;
            case 'memory_match':
                gameInstance = this.createMemoryMatch(roomCode, playerIds);
                break;
            case 'cooperative_puzzle':
                gameInstance = this.createCooperativePuzzle(roomCode, playerIds);
                break;
            default:
                return { success: false, message: 'Game type not implemented' };
        }

        this.gameInstances.set(roomCode, gameInstance);
        
        return {
            success: true,
            gameInstance,
            message: `${gameDefinition.name} started!`
        };
    }

    // Enhanced Garden Game Implementation
    createEnhancedGarden(roomCode, playerIds) {
        return {
            type: 'enhanced_garden',
            roomCode,
            playerIds,
            startTime: Date.now(),
            endTime: Date.now() + this.gameDefinitions.enhanced_garden.duration,
            status: 'active',
            phase: 'planting', // planting -> watering -> growing -> harvesting
            
            garden: {
                plots: this.generateGardenPlots(12), // 3x4 grid
                totalPlots: 12,
                plantedPlots: 0,
                wateredPlots: 0,
                grownPlots: 0,
                harvestedPlots: 0
            },
            
            playerStats: playerIds.reduce((stats, playerId) => {
                stats[playerId] = {
                    plantsPlanted: 0,
                    plotsWatered: 0,
                    carrotsHarvested: 0,
                    comboMultiplier: 1,
                    lastActionTime: Date.now(),
                    score: 0
                };
                return stats;
            }, {}),
            
            weather: {
                current: 'sunny',
                forecast: this.generateWeatherForecast(),
                rainBonus: false,
                droughtPenalty: false
            },
            
            specialEvents: {
                fertilizerBonus: false,
                pestChallenge: false,
                cooperationBonus: false
            },
            
            gameEvents: []
        };
    }

    // Generate garden plots with different types
    generateGardenPlots(count) {
        const plotTypes = ['normal', 'fertile', 'rocky', 'sandy'];
        const plots = [];
        
        for (let i = 0; i < count; i++) {
            const randomType = plotTypes[Math.floor(Math.random() * plotTypes.length)];
            plots.push({
                id: i,
                type: randomType,
                state: 'empty', // empty -> planted -> watered -> growing -> ready -> harvested
                plantedBy: null,
                wateredBy: null,
                harvestedBy: null,
                plantTime: null,
                waterTime: null,
                growthProgress: 0,
                readyTime: null,
                quality: this.getPlotBaseQuality(randomType)
            });
        }
        
        return plots;
    }

    // Get base quality for plot type
    getPlotBaseQuality(plotType) {
        switch (plotType) {
            case 'fertile': return 90;
            case 'normal': return 70;
            case 'sandy': return 60;
            case 'rocky': return 40;
            default: return 70;
        }
    }

    // Generate weather forecast
    generateWeatherForecast() {
        const weatherTypes = ['sunny', 'cloudy', 'rainy', 'stormy'];
        const forecast = [];
        
        for (let i = 0; i < 5; i++) {
            forecast.push({
                time: Date.now() + (i * 60000), // Every minute
                weather: weatherTypes[Math.floor(Math.random() * weatherTypes.length)],
                intensity: Math.random()
            });
        }
        
        return forecast;
    }

    // Handle garden game action
    handleGardenAction(roomCode, playerId, action, data = {}) {
        const gameInstance = this.gameInstances.get(roomCode);
        if (!gameInstance || gameInstance.type !== 'enhanced_garden') {
            return { success: false, message: 'No active garden game' };
        }

        if (gameInstance.status !== 'active') {
            return { success: false, message: 'Game is not active' };
        }

        const now = Date.now();
        if (now > gameInstance.endTime) {
            this.endMiniGame(roomCode);
            return { success: false, message: 'Game has ended' };
        }

        const playerStats = gameInstance.playerStats[playerId];
        if (!playerStats) {
            return { success: false, message: 'Player not in game' };
        }

        switch (action) {
            case 'plant_seed':
                return this.handlePlantSeed(gameInstance, playerId, data);
            case 'water_plot':
                return this.handleWaterPlot(gameInstance, playerId, data);
            case 'harvest_carrot':
                return this.handleHarvestCarrot(gameInstance, playerId, data);
            case 'use_fertilizer':
                return this.handleUseFertilizer(gameInstance, playerId, data);
            case 'cooperative_action':
                return this.handleCooperativeAction(gameInstance, playerId, data);
            default:
                return { success: false, message: 'Unknown garden action' };
        }
    }

    // Handle planting seeds
    handlePlantSeed(gameInstance, playerId, data) {
        const plotId = data.plotId;
        const plot = gameInstance.garden.plots[plotId];
        
        if (!plot || plot.state !== 'empty') {
            return { success: false, message: 'Plot not available for planting' };
        }

        plot.state = 'planted';
        plot.plantedBy = playerId;
        plot.plantTime = Date.now();
        
        const playerStats = gameInstance.playerStats[playerId];
        playerStats.plantsPlanted++;
        playerStats.lastActionTime = Date.now();
        playerStats.score += 10;

        gameInstance.garden.plantedPlots++;
        
        // Check for combo bonus (planting multiple plots quickly)
        if (this.checkComboBonus(gameInstance, playerId, 'plant')) {
            playerStats.comboMultiplier += 0.2;
            playerStats.score += 5;
        }

        this.addGameEvent(gameInstance, 'plant', {
            playerId,
            plotId,
            plotType: plot.type
        });

        return {
            success: true,
            plot,
            playerStats: gameInstance.playerStats[playerId],
            message: `Planted seed in ${plot.type} plot!`
        };
    }

    // Handle watering plots
    handleWaterPlot(gameInstance, playerId, data) {
        const plotId = data.plotId;
        const plot = gameInstance.garden.plots[plotId];
        
        if (!plot || plot.state !== 'planted') {
            return { success: false, message: 'Plot not ready for watering' };
        }

        plot.state = 'watered';
        plot.wateredBy = playerId;
        plot.waterTime = Date.now();
        plot.growthProgress = 20;
        
        const playerStats = gameInstance.playerStats[playerId];
        playerStats.plotsWatered++;
        playerStats.lastActionTime = Date.now();
        playerStats.score += 15;

        gameInstance.garden.wateredPlots++;

        // Weather bonus
        if (gameInstance.weather.current === 'rainy') {
            plot.quality += 10;
            playerStats.score += 5;
        }

        // Cooperative bonus if watered by different player than planter
        if (plot.plantedBy !== playerId) {
            playerStats.score += 10;
            gameInstance.specialEvents.cooperationBonus = true;
            
            this.addGameEvent(gameInstance, 'cooperation', {
                action: 'cross_watering',
                planter: plot.plantedBy,
                waterer: playerId,
                plotId
            });
        }

        this.addGameEvent(gameInstance, 'water', {
            playerId,
            plotId,
            cooperation: plot.plantedBy !== playerId
        });

        return {
            success: true,
            plot,
            playerStats: gameInstance.playerStats[playerId],
            message: plot.plantedBy !== playerId ? 'Great teamwork! Cross-watering bonus!' : 'Plot watered!'
        };
    }

    // Handle harvesting carrots
    handleHarvestCarrot(gameInstance, playerId, data) {
        const plotId = data.plotId;
        const plot = gameInstance.garden.plots[plotId];
        
        if (!plot || plot.state !== 'ready') {
            return { success: false, message: 'Carrot not ready for harvest' };
        }

        plot.state = 'harvested';
        plot.harvestedBy = playerId;
        
        const playerStats = gameInstance.playerStats[playerId];
        playerStats.carrotsHarvested++;
        playerStats.lastActionTime = Date.now();
        
        // Calculate harvest value based on quality and timing
        const baseValue = 20;
        const qualityBonus = Math.floor(plot.quality / 10);
        const timingBonus = this.calculateTimingBonus(plot);
        const totalScore = (baseValue + qualityBonus + timingBonus) * playerStats.comboMultiplier;
        
        playerStats.score += totalScore;
        gameInstance.garden.harvestedPlots++;

        this.addGameEvent(gameInstance, 'harvest', {
            playerId,
            plotId,
            quality: plot.quality,
            score: totalScore
        });

        return {
            success: true,
            plot,
            playerStats: gameInstance.playerStats[playerId],
            harvestValue: totalScore,
            message: `Harvested carrot! Quality: ${plot.quality}%`
        };
    }

    // Handle fertilizer usage
    handleUseFertilizer(gameInstance, playerId, data) {
        const plotId = data.plotId;
        const plot = gameInstance.garden.plots[plotId];
        
        if (!plot || !['planted', 'watered', 'growing'].includes(plot.state)) {
            return { success: false, message: 'Cannot use fertilizer on this plot' };
        }

        plot.quality += 20;
        plot.growthProgress += 30;
        
        if (plot.growthProgress >= 100) {
            plot.state = 'ready';
            plot.readyTime = Date.now();
        }

        const playerStats = gameInstance.playerStats[playerId];
        playerStats.score += 5;
        playerStats.lastActionTime = Date.now();

        gameInstance.specialEvents.fertilizerBonus = true;

        this.addGameEvent(gameInstance, 'fertilizer', {
            playerId,
            plotId,
            qualityIncrease: 20
        });

        return {
            success: true,
            plot,
            playerStats: gameInstance.playerStats[playerId],
            message: 'Fertilizer applied! Growth boosted!'
        };
    }

    // Handle cooperative actions
    handleCooperativeAction(gameInstance, playerId, data) {
        const action = data.action;
        const targetPlayerId = data.targetPlayerId;
        
        if (!gameInstance.playerStats[targetPlayerId]) {
            return { success: false, message: 'Target player not in game' };
        }

        const playerStats = gameInstance.playerStats[playerId];
        const targetStats = gameInstance.playerStats[targetPlayerId];

        switch (action) {
            case 'share_tools':
                // Both players get small bonus
                playerStats.score += 8;
                targetStats.score += 8;
                playerStats.comboMultiplier += 0.1;
                targetStats.comboMultiplier += 0.1;
                break;
                
            case 'team_fertilizer':
                // Apply fertilizer to multiple plots
                gameInstance.garden.plots.forEach(plot => {
                    if (['planted', 'watered'].includes(plot.state)) {
                        plot.quality += 10;
                        plot.growthProgress += 15;
                    }
                });
                playerStats.score += 20;
                targetStats.score += 20;
                break;
                
            case 'synchronized_watering':
                // Bonus if both players water at nearly same time
                const timeDiff = Math.abs(playerStats.lastActionTime - targetStats.lastActionTime);
                if (timeDiff < 5000) { // Within 5 seconds
                    playerStats.score += 25;
                    targetStats.score += 25;
                    gameInstance.specialEvents.cooperationBonus = true;
                }
                break;
        }

        this.addGameEvent(gameInstance, 'cooperative_action', {
            playerId,
            targetPlayerId,
            action,
            timestamp: Date.now()
        });

        return {
            success: true,
            playerStats: gameInstance.playerStats[playerId],
            targetStats: gameInstance.playerStats[targetPlayerId],
            message: 'Cooperative action successful!'
        };
    }

    // Update garden game state (called periodically)
    updateGardenGame(roomCode) {
        const gameInstance = this.gameInstances.get(roomCode);
        if (!gameInstance || gameInstance.type !== 'enhanced_garden') {
            return null;
        }

        const now = Date.now();
        
        // Check if game should end
        if (now > gameInstance.endTime) {
            return this.endMiniGame(roomCode);
        }

        // Update plot growth
        gameInstance.garden.plots.forEach(plot => {
            if (plot.state === 'watered') {
                const timeWatered = now - plot.waterTime;
                const growthRate = this.getGrowthRate(plot.type, gameInstance.weather.current);
                plot.growthProgress = Math.min(100, 20 + (timeWatered / 1000) * growthRate);
                
                if (plot.growthProgress >= 100) {
                    plot.state = 'ready';
                    plot.readyTime = now;
                }
            }
        });

        // Update weather
        this.updateGameWeather(gameInstance);
        
        // Check for special events
        this.checkSpecialEvents(gameInstance);

        return gameInstance;
    }

    // Calculate timing bonus for harvest
    calculateTimingBonus(plot) {
        if (!plot.readyTime) return 0;
        
        const readyDuration = Date.now() - plot.readyTime;
        // Bonus decreases over time, max bonus for immediate harvest
        const maxBonus = 15;
        const decayRate = 0.001; // Per millisecond
        return Math.max(0, maxBonus - (readyDuration * decayRate));
    }

    // Check for combo bonuses
    checkComboBonus(gameInstance, playerId, actionType) {
        const playerStats = gameInstance.playerStats[playerId];
        const recentActions = gameInstance.gameEvents
            .filter(event => 
                event.playerId === playerId && 
                event.type === actionType && 
                Date.now() - event.timestamp < 10000 // Within 10 seconds
            );
        
        return recentActions.length >= 3; // 3+ actions in 10 seconds
    }

    // Get growth rate based on plot type and weather
    getGrowthRate(plotType, weather) {
        let baseRate = 1;
        
        switch (plotType) {
            case 'fertile': baseRate = 1.5; break;
            case 'normal': baseRate = 1.0; break;
            case 'sandy': baseRate = 0.8; break;
            case 'rocky': baseRate = 0.6; break;
        }
        
        switch (weather) {
            case 'rainy': return baseRate * 1.3;
            case 'sunny': return baseRate * 1.1;
            case 'cloudy': return baseRate * 1.0;
            case 'stormy': return baseRate * 0.7;
            default: return baseRate;
        }
    }

    // Update weather conditions
    updateGameWeather(gameInstance) {
        const now = Date.now();
        const currentForecast = gameInstance.weather.forecast.find(f => 
            now >= f.time && now < f.time + 60000
        );
        
        if (currentForecast && currentForecast.weather !== gameInstance.weather.current) {
            gameInstance.weather.current = currentForecast.weather;
            
            this.addGameEvent(gameInstance, 'weather_change', {
                newWeather: currentForecast.weather,
                intensity: currentForecast.intensity
            });
        }
    }

    // Check for special events
    checkSpecialEvents(gameInstance) {
        // Random chance for special events
        if (Math.random() < 0.02) { // 2% chance per update
            const eventTypes = ['pest_attack', 'fertility_boost', 'drought_warning'];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            
            this.triggerSpecialEvent(gameInstance, eventType);
        }
    }

    // Trigger special event
    triggerSpecialEvent(gameInstance, eventType) {
        switch (eventType) {
            case 'pest_attack':
                gameInstance.specialEvents.pestChallenge = true;
                gameInstance.garden.plots.forEach(plot => {
                    if (Math.random() < 0.3) { // 30% of plots affected
                        plot.quality -= 15;
                    }
                });
                break;
                
            case 'fertility_boost':
                gameInstance.specialEvents.fertilizerBonus = true;
                gameInstance.garden.plots.forEach(plot => {
                    if (['planted', 'watered'].includes(plot.state)) {
                        plot.quality += 10;
                    }
                });
                break;
                
            case 'drought_warning':
                gameInstance.specialEvents.droughtPenalty = true;
                // Players need to water more frequently
                break;
        }

        this.addGameEvent(gameInstance, 'special_event', {
            eventType,
            timestamp: Date.now()
        });
    }

    // Add game event
    addGameEvent(gameInstance, eventType, data) {
        gameInstance.gameEvents.push({
            type: eventType,
            timestamp: Date.now(),
            ...data
        });

        // Keep only recent events (last 50)
        if (gameInstance.gameEvents.length > 50) {
            gameInstance.gameEvents = gameInstance.gameEvents.slice(-50);
        }
    }

    // End mini-game and calculate rewards
    endMiniGame(roomCode) {
        const gameInstance = this.gameInstances.get(roomCode);
        if (!gameInstance) {
            return null;
        }

        gameInstance.status = 'ended';
        gameInstance.endTime = Date.now();

        const results = this.calculateGameResults(gameInstance);
        
        // Store final scores
        Object.keys(gameInstance.playerStats).forEach(playerId => {
            this.updatePlayerScore(playerId, gameInstance.type, gameInstance.playerStats[playerId]);
        });

        this.gameInstances.delete(roomCode);
        
        return {
            gameInstance,
            results,
            message: 'Mini-game completed!'
        };
    }

    // Calculate final game results
    calculateGameResults(gameInstance) {
        const results = {
            winner: null,
            scores: {},
            rewards: {},
            achievements: []
        };

        let highestScore = 0;
        let winner = null;

        Object.entries(gameInstance.playerStats).forEach(([playerId, stats]) => {
            results.scores[playerId] = stats.score;
            
            if (stats.score > highestScore) {
                highestScore = stats.score;
                winner = playerId;
            }

            // Calculate rewards
            const gameRewards = this.gameDefinitions[gameInstance.type].rewards;
            results.rewards[playerId] = {
                carrots: Math.floor(stats.score / 10) * gameRewards.carrotsPerSuccess,
                decorationPoints: Math.floor(stats.score / 20) * gameRewards.decorationPoints,
                experiencePoints: stats.score * 0.1
            };
        });

        results.winner = winner;

        // Check for achievements
        if (gameInstance.specialEvents.cooperationBonus) {
            results.achievements.push('garden_cooperation');
        }

        return results;
    }

    // Update player scores
    updatePlayerScore(playerId, gameType, gameStats) {
        let playerData = this.playerScores.get(playerId) || {
            totalGamesPlayed: 0,
            gamesWon: 0,
            gameStats: {}
        };

        playerData.totalGamesPlayed++;
        
        if (!playerData.gameStats[gameType]) {
            playerData.gameStats[gameType] = {
                gamesPlayed: 0,
                bestScore: 0,
                totalScore: 0,
                averageScore: 0
            };
        }

        const gameTypeStats = playerData.gameStats[gameType];
        gameTypeStats.gamesPlayed++;
        gameTypeStats.totalScore += gameStats.score;
        gameTypeStats.averageScore = gameTypeStats.totalScore / gameTypeStats.gamesPlayed;
        
        if (gameStats.score > gameTypeStats.bestScore) {
            gameTypeStats.bestScore = gameStats.score;
        }

        this.playerScores.set(playerId, playerData);
    }

    // Get active mini-game
    getActiveGame(roomCode) {
        return this.gameInstances.get(roomCode);
    }

    // Get player scores
    getPlayerScores(playerId) {
        return this.playerScores.get(playerId) || {
            totalGamesPlayed: 0,
            gamesWon: 0,
            gameStats: {}
        };
    }

    // Get available games
    getAvailableGames() {
        return this.gameDefinitions;
    }

    // Persistence methods
    serialize() {
        return {
            gameInstances: Array.from(this.gameInstances.entries()),
            playerScores: Array.from(this.playerScores.entries())
        };
    }

    deserialize(data) {
        if (data && data.gameInstances) {
            this.gameInstances = new Map(data.gameInstances);
        }
        if (data && data.playerScores) {
            this.playerScores = new Map(data.playerScores);
        }
    }
}

module.exports = MiniGamesSystem;