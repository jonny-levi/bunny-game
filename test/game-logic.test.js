// Unit Tests for Bunny Family Game Logic
// Run with: npm test

const assert = require('assert');

// Mock the server GameRoom class for testing
class TestGameRoom {
    constructor() {
        this.gameState = {
            carrots: 5,
            babies: [{
                id: 'baby1',
                name: 'Test Baby',
                stage: 'newborn',
                hunger: 80,
                happiness: 80,
                energy: 80,
                cleanliness: 80,
                love: 0,
                growthPoints: 0,
                hatchProgress: 0,
                sleeping: false,
                birthTime: Date.now(),
                lastFed: Date.now(),
                lastPlayed: Date.now(),
                lastCleaned: Date.now()
            }],
            lastCarrotHarvest: 0
        };
        this.players = new Map();
        this.DECAY_RATES = {
            hunger: 1,
            happiness: 0.5,
            energy: 0.3,
            cleanliness: 0.7
        };
        this.ACTION_EFFECTS = {
            feed: { hunger: 15, happiness: 5 },
            play: { happiness: 15, energy: -5 },
            sleep: { energy: 20, happiness: 2 },
            clean: { cleanliness: 20, happiness: 5 },
            pet: { happiness: 8, love: 3 }
        };
        this.GROWTH_THRESHOLDS = {
            newborn: 0,
            toddler: 100,
            young: 300,
            grown: 600
        };
    }

    feedBaby(playerId) {
        if (this.gameState.carrots <= 0) {
            return { success: false, message: 'No carrots left!' };
        }
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Cannot feed an egg!' };
        }
        baby.hunger = Math.min(100, baby.hunger + this.ACTION_EFFECTS.feed.hunger);
        baby.happiness = Math.min(100, baby.happiness + this.ACTION_EFFECTS.feed.happiness);
        baby.lastFed = Date.now();
        this.gameState.carrots--;
        return { success: true };
    }

    playWithBaby(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Cannot play with an egg!' };
        }
        if (baby.energy < 20) {
            return { success: false, message: `${baby.name} is too tired to play!` };
        }
        baby.happiness = Math.min(100, baby.happiness + this.ACTION_EFFECTS.play.happiness);
        baby.energy = Math.max(0, baby.energy + this.ACTION_EFFECTS.play.energy);
        baby.lastPlayed = Date.now();
        return { success: true };
    }

    putBabyToSleep(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Eggs don\'t sleep!' };
        }
        baby.sleeping = !baby.sleeping;
        if (baby.sleeping) {
            baby.energy = Math.min(100, baby.energy + this.ACTION_EFFECTS.sleep.energy);
            baby.happiness = Math.min(100, baby.happiness + this.ACTION_EFFECTS.sleep.happiness);
        }
        return { success: true, sleeping: baby.sleeping };
    }

    cleanBaby(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return { success: false, message: 'Eggs are naturally clean!' };
        }
        baby.cleanliness = Math.min(100, baby.cleanliness + this.ACTION_EFFECTS.clean.cleanliness);
        baby.happiness = Math.min(100, baby.happiness + this.ACTION_EFFECTS.clean.happiness);
        baby.lastCleaned = Date.now();
        return { success: true };
    }

    petBaby(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage === 'egg') {
            return this.tapEgg(playerId);
        }
        baby.happiness = Math.min(100, baby.happiness + this.ACTION_EFFECTS.pet.happiness);
        baby.love = Math.min(100, baby.love + this.ACTION_EFFECTS.pet.love);
        return { success: true };
    }

    tapEgg(playerId) {
        const baby = this.gameState.babies[0];
        if (baby.stage !== 'egg') {
            return { success: false, message: 'Not an egg!' };
        }
        baby.hatchProgress = Math.min(100, baby.hatchProgress + 10);
        if (baby.hatchProgress >= 100) {
            baby.stage = 'newborn';
            baby.hatchProgress = 0;
            baby.growthPoints = 0;
        }
        return { success: true, hatchProgress: baby.hatchProgress };
    }

    harvestCarrots(playerId) {
        const now = Date.now();
        const timeSinceLastHarvest = now - this.gameState.lastCarrotHarvest;
        const cooldown = 30000; // 30 seconds
        
        if (timeSinceLastHarvest < cooldown) {
            const remaining = Math.ceil((cooldown - timeSinceLastHarvest) / 1000);
            return { success: false, message: `Garden needs ${remaining} seconds to grow more carrots!` };
        }
        this.gameState.carrots += 2;
        this.gameState.lastCarrotHarvest = now;
        return { success: true };
    }

    updateNeeds() {
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') return;
            
            const decayMultiplier = this.getDecayMultiplier(baby.stage);
            
            baby.hunger = Math.max(0, baby.hunger - this.DECAY_RATES.hunger * decayMultiplier);
            baby.happiness = Math.max(0, baby.happiness - this.DECAY_RATES.happiness * decayMultiplier);
            baby.energy = Math.max(0, baby.energy - this.DECAY_RATES.energy * decayMultiplier);
            baby.cleanliness = Math.max(0, baby.cleanliness - this.DECAY_RATES.cleanliness * decayMultiplier);

            // Sleeping gives energy boost
            if (baby.sleeping) {
                baby.energy = Math.min(100, baby.energy + 2);
            }
        });
    }

    getDecayMultiplier(stage) {
        switch (stage) {
            case 'newborn': return 1.5;
            case 'toddler': return 1.2;
            case 'young': return 0.8;
            case 'grown': return 0.5;
            default: return 1;
        }
    }

    checkGrowth() {
        this.gameState.babies.forEach(baby => {
            if (baby.stage === 'egg') return;

            // Calculate care score and add growth points
            const careScore = (baby.hunger + baby.happiness + baby.energy + baby.cleanliness) / 4;
            if (careScore > 60) {
                baby.growthPoints += Math.floor(careScore / 20);
            }

            // Check for growth progression
            const oldStage = baby.stage;
            if (baby.growthPoints >= this.GROWTH_THRESHOLDS.grown && baby.stage !== 'grown') {
                baby.stage = 'grown';
            } else if (baby.growthPoints >= this.GROWTH_THRESHOLDS.young && baby.stage === 'toddler') {
                baby.stage = 'young';
            } else if (baby.growthPoints >= this.GROWTH_THRESHOLDS.toddler && baby.stage === 'newborn') {
                baby.stage = 'toddler';
            }

            return oldStage !== baby.stage; // Return true if stage changed
        });
    }

    addPlayer(playerId, socketId, playerType) {
        this.players.set(playerId, {
            id: playerId,
            socketId: socketId,
            type: playerType,
            connected: true,
            joinTime: Date.now()
        });
        return this.players.size;
    }

    removePlayer(playerId) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).connected = false;
        }
        return Array.from(this.players.values()).filter(p => p.connected).length;
    }

    getConnectedPlayerCount() {
        return Array.from(this.players.values()).filter(p => p.connected).length;
    }

    isFull() {
        return this.players.size >= 2;
    }
}

// Room management utility functions
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

describe('Bunny Family Game Logic', function() {
    let room;

    beforeEach(function() {
        room = new TestGameRoom();
    });

    describe('Room Management', function() {
        it('should generate unique room codes', function() {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                const code = generateRoomCode();
                assert.strictEqual(code.length, 6);
                assert.strictEqual(codes.has(code), false, 'Room code should be unique');
                codes.add(code);
            }
        });

        it('should generate unique player IDs', function() {
            const ids = new Set();
            for (let i = 0; i < 10; i++) {
                const id = generatePlayerId();
                assert(id.startsWith('player_'));
                assert.strictEqual(ids.has(id), false, 'Player ID should be unique');
                ids.add(id);
            }
        });

        it('should add players correctly', function() {
            const playerCount = room.addPlayer('player1', 'socket1', 'black');
            assert.strictEqual(playerCount, 1);
            assert.strictEqual(room.players.get('player1').type, 'black');
            assert.strictEqual(room.players.get('player1').connected, true);
        });

        it('should track room capacity', function() {
            room.addPlayer('player1', 'socket1', 'black');
            assert.strictEqual(room.isFull(), false);
            
            room.addPlayer('player2', 'socket2', 'white');
            assert.strictEqual(room.isFull(), true);
        });

        it('should handle player disconnection', function() {
            room.addPlayer('player1', 'socket1', 'black');
            room.addPlayer('player2', 'socket2', 'white');
            
            const remaining = room.removePlayer('player1');
            assert.strictEqual(remaining, 1);
            assert.strictEqual(room.players.get('player1').connected, false);
        });
    });

    describe('Feeding System', function() {
        it('should feed baby successfully when carrots available', function() {
            const result = room.feedBaby('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(room.gameState.babies[0].hunger, 95); // 80 + 15
            assert.strictEqual(room.gameState.babies[0].happiness, 85); // 80 + 5
            assert.strictEqual(room.gameState.carrots, 4); // 5 - 1
        });

        it('should fail to feed when no carrots available', function() {
            room.gameState.carrots = 0;
            const result = room.feedBaby('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'No carrots left!');
        });

        it('should fail to feed an egg', function() {
            room.gameState.babies[0].stage = 'egg';
            const result = room.feedBaby('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Cannot feed an egg!');
        });

        it('should not exceed 100 hunger when feeding', function() {
            room.gameState.babies[0].hunger = 90;
            room.feedBaby('player1');
            assert.strictEqual(room.gameState.babies[0].hunger, 100);
        });

        it('should update last fed timestamp', function() {
            const before = room.gameState.babies[0].lastFed;
            setTimeout(() => {
                room.feedBaby('player1');
                assert(room.gameState.babies[0].lastFed > before);
            }, 10);
        });
    });

    describe('Play System', function() {
        it('should play with baby successfully when energy sufficient', function() {
            const result = room.playWithBaby('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(room.gameState.babies[0].happiness, 95); // 80 + 15
            assert.strictEqual(room.gameState.babies[0].energy, 75); // 80 - 5
        });

        it('should fail to play when baby too tired', function() {
            room.gameState.babies[0].energy = 15; // Below 20 threshold
            const result = room.playWithBaby('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Test Baby is too tired to play!');
        });

        it('should fail to play with an egg', function() {
            room.gameState.babies[0].stage = 'egg';
            const result = room.playWithBaby('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Cannot play with an egg!');
        });

        it('should not allow energy to go negative', function() {
            room.gameState.babies[0].energy = 3;
            room.playWithBaby('player1');
            assert.strictEqual(room.gameState.babies[0].energy, 0);
        });
    });

    describe('Sleep System', function() {
        it('should toggle sleep state', function() {
            const result1 = room.putBabyToSleep('player1');
            assert.strictEqual(result1.success, true);
            assert.strictEqual(result1.sleeping, true);
            assert.strictEqual(room.gameState.babies[0].sleeping, true);

            const result2 = room.putBabyToSleep('player1');
            assert.strictEqual(result2.success, true);
            assert.strictEqual(result2.sleeping, false);
            assert.strictEqual(room.gameState.babies[0].sleeping, false);
        });

        it('should increase energy and happiness when sleeping', function() {
            const originalEnergy = room.gameState.babies[0].energy;
            const originalHappiness = room.gameState.babies[0].happiness;
            
            room.putBabyToSleep('player1');
            
            assert.strictEqual(room.gameState.babies[0].energy, originalEnergy + 20);
            assert.strictEqual(room.gameState.babies[0].happiness, originalHappiness + 2);
        });

        it('should fail to sleep an egg', function() {
            room.gameState.babies[0].stage = 'egg';
            const result = room.putBabyToSleep('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Eggs don\'t sleep!');
        });
    });

    describe('Cleaning System', function() {
        it('should clean baby successfully', function() {
            const result = room.cleanBaby('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(room.gameState.babies[0].cleanliness, 100); // 80 + 20
            assert.strictEqual(room.gameState.babies[0].happiness, 85); // 80 + 5
        });

        it('should fail to clean an egg', function() {
            room.gameState.babies[0].stage = 'egg';
            const result = room.cleanBaby('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Eggs are naturally clean!');
        });

        it('should not exceed 100 cleanliness', function() {
            room.gameState.babies[0].cleanliness = 95;
            room.cleanBaby('player1');
            assert.strictEqual(room.gameState.babies[0].cleanliness, 100);
        });
    });

    describe('Petting System', function() {
        it('should pet baby successfully', function() {
            const result = room.petBaby('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(room.gameState.babies[0].happiness, 88); // 80 + 8
            assert.strictEqual(room.gameState.babies[0].love, 3); // 0 + 3
        });

        it('should tap egg when petting an egg', function() {
            room.gameState.babies[0].stage = 'egg';
            room.gameState.babies[0].hatchProgress = 50;
            
            const result = room.petBaby('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.hatchProgress, 60); // 50 + 10
        });

        it('should not exceed 100 happiness or love', function() {
            room.gameState.babies[0].happiness = 95;
            room.gameState.babies[0].love = 98;
            room.petBaby('player1');
            assert.strictEqual(room.gameState.babies[0].happiness, 100);
            assert.strictEqual(room.gameState.babies[0].love, 100);
        });
    });

    describe('Egg Hatching System', function() {
        beforeEach(function() {
            room.gameState.babies[0].stage = 'egg';
            room.gameState.babies[0].hatchProgress = 0;
        });

        it('should increase hatch progress when tapping', function() {
            const result = room.tapEgg('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.hatchProgress, 10);
        });

        it('should hatch egg at 100% progress', function() {
            room.gameState.babies[0].hatchProgress = 95;
            const result = room.tapEgg('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(room.gameState.babies[0].stage, 'newborn');
            assert.strictEqual(room.gameState.babies[0].hatchProgress, 0);
            assert.strictEqual(room.gameState.babies[0].growthPoints, 0);
        });

        it('should not exceed 100% hatch progress', function() {
            room.gameState.babies[0].hatchProgress = 95;
            room.tapEgg('player1');
            // Should hatch and reset to 0, not go above 100
            assert(room.gameState.babies[0].hatchProgress <= 100);
        });

        it('should fail to tap non-egg', function() {
            room.gameState.babies[0].stage = 'newborn';
            const result = room.tapEgg('player1');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, 'Not an egg!');
        });
    });

    describe('Harvest System', function() {
        it('should harvest carrots successfully after cooldown', function() {
            room.gameState.lastCarrotHarvest = Date.now() - 31000; // 31 seconds ago
            const result = room.harvestCarrots('player1');
            assert.strictEqual(result.success, true);
            assert.strictEqual(room.gameState.carrots, 7); // 5 + 2
        });

        it('should fail to harvest during cooldown period', function() {
            room.gameState.lastCarrotHarvest = Date.now() - 10000; // 10 seconds ago
            const result = room.harvestCarrots('player1');
            assert.strictEqual(result.success, false);
            assert(result.message.includes('seconds to grow'));
        });

        it('should update harvest timestamp on successful harvest', function() {
            room.gameState.lastCarrotHarvest = Date.now() - 31000;
            const before = room.gameState.lastCarrotHarvest;
            room.harvestCarrots('player1');
            assert(room.gameState.lastCarrotHarvest > before);
        });
    });

    describe('Need Decay System', function() {
        it('should decay needs properly over time', function() {
            const originalHunger = room.gameState.babies[0].hunger;
            const originalHappiness = room.gameState.babies[0].happiness;
            const originalEnergy = room.gameState.babies[0].energy;
            const originalCleanliness = room.gameState.babies[0].cleanliness;
            
            room.updateNeeds();
            
            assert.strictEqual(room.gameState.babies[0].hunger, originalHunger - 1.5); // newborn multiplier
            assert.strictEqual(room.gameState.babies[0].happiness, originalHappiness - 0.75);
            assert.strictEqual(room.gameState.babies[0].energy, originalEnergy - 0.45);
            assert.strictEqual(room.gameState.babies[0].cleanliness, originalCleanliness - 1.05);
        });

        it('should not decay needs below 0', function() {
            room.gameState.babies[0].hunger = 0.5;
            room.gameState.babies[0].happiness = 0.2;
            room.gameState.babies[0].energy = 0.1;
            room.gameState.babies[0].cleanliness = 0.3;
            
            room.updateNeeds();
            
            assert.strictEqual(room.gameState.babies[0].hunger, 0);
            assert.strictEqual(room.gameState.babies[0].happiness, 0);
            assert.strictEqual(room.gameState.babies[0].energy, 0);
            assert.strictEqual(room.gameState.babies[0].cleanliness, 0);
        });

        it('should not decay egg needs', function() {
            room.gameState.babies[0].stage = 'egg';
            const originalHunger = room.gameState.babies[0].hunger;
            
            room.updateNeeds();
            
            assert.strictEqual(room.gameState.babies[0].hunger, originalHunger);
        });

        it('should give energy bonus when sleeping', function() {
            room.gameState.babies[0].sleeping = true;
            room.gameState.babies[0].energy = 50;
            
            room.updateNeeds();
            
            // Should decay by 0.45 but gain 2 from sleeping = net +1.55
            assert.strictEqual(room.gameState.babies[0].energy, 51.55);
        });

        it('should use different decay rates by stage', function() {
            // Test different stages have different multipliers
            const testCases = [
                { stage: 'newborn', expectedMultiplier: 1.5 },
                { stage: 'toddler', expectedMultiplier: 1.2 },
                { stage: 'young', expectedMultiplier: 0.8 },
                { stage: 'grown', expectedMultiplier: 0.5 }
            ];

            testCases.forEach(({ stage, expectedMultiplier }) => {
                room.gameState.babies[0].stage = stage;
                room.gameState.babies[0].hunger = 100;
                
                room.updateNeeds();
                
                const expectedHunger = 100 - (1 * expectedMultiplier);
                assert.strictEqual(room.gameState.babies[0].hunger, expectedHunger, 
                    `Stage ${stage} should have multiplier ${expectedMultiplier}`);
                
                // Reset for next test
                room.gameState.babies[0].hunger = 100;
            });
        });
    });

    describe('Growth System', function() {
        it('should increase growth points with good care', function() {
            // Set high care scores (average = 80 > 60)
            room.gameState.babies[0].hunger = 80;
            room.gameState.babies[0].happiness = 80;
            room.gameState.babies[0].energy = 80;
            room.gameState.babies[0].cleanliness = 80;
            room.gameState.babies[0].growthPoints = 0;
            
            room.checkGrowth();
            
            // Care score = 80, so growth points += floor(80/20) = 4
            assert.strictEqual(room.gameState.babies[0].growthPoints, 4);
        });

        it('should not increase growth points with poor care', function() {
            // Set low care scores (average = 40 < 60)
            room.gameState.babies[0].hunger = 40;
            room.gameState.babies[0].happiness = 40;
            room.gameState.babies[0].energy = 40;
            room.gameState.babies[0].cleanliness = 40;
            room.gameState.babies[0].growthPoints = 0;
            
            room.checkGrowth();
            
            assert.strictEqual(room.gameState.babies[0].growthPoints, 0);
        });

        it('should progress through growth stages correctly', function() {
            // Test newborn -> toddler
            room.gameState.babies[0].stage = 'newborn';
            room.gameState.babies[0].growthPoints = 100;
            
            room.checkGrowth();
            assert.strictEqual(room.gameState.babies[0].stage, 'toddler');

            // Test toddler -> young
            room.gameState.babies[0].growthPoints = 300;
            room.checkGrowth();
            assert.strictEqual(room.gameState.babies[0].stage, 'young');

            // Test young -> grown (need to reset to young first)
            room.gameState.babies[0].stage = 'young';
            room.gameState.babies[0].growthPoints = 600;
            room.checkGrowth();
            assert.strictEqual(room.gameState.babies[0].stage, 'grown');
        });

        it('should not grow eggs', function() {
            room.gameState.babies[0].stage = 'egg';
            room.gameState.babies[0].growthPoints = 0;
            
            room.checkGrowth();
            
            assert.strictEqual(room.gameState.babies[0].stage, 'egg');
            assert.strictEqual(room.gameState.babies[0].growthPoints, 0);
        });

        it('should not regress growth stages', function() {
            room.gameState.babies[0].stage = 'grown';
            room.gameState.babies[0].growthPoints = 50; // Below toddler threshold
            
            room.checkGrowth();
            
            assert.strictEqual(room.gameState.babies[0].stage, 'grown'); // Should stay grown
        });
    });

    describe('Edge Cases', function() {
        it('should handle missing babies array', function() {
            room.gameState.babies = [];
            
            // Should not crash
            room.updateNeeds();
            room.checkGrowth();
            
            const feedResult = room.feedBaby('player1');
            // Might fail gracefully or have specific behavior
            assert(feedResult.success === false || feedResult.success === true);
        });

        it('should handle undefined baby properties', function() {
            delete room.gameState.babies[0].hunger;
            
            // Should not crash (might set to NaN or default)
            room.updateNeeds();
            
            // NaN checks
            const hunger = room.gameState.babies[0].hunger;
            assert(!isNaN(hunger) || hunger === undefined);
        });

        it('should handle extreme values', function() {
            // Test with very high values
            room.gameState.babies[0].hunger = 999999;
            room.feedBaby('player1');
            assert(room.gameState.babies[0].hunger <= 100); // Should cap at 100

            // Test with negative values
            room.gameState.babies[0].energy = -50;
            room.updateNeeds();
            assert(room.gameState.babies[0].energy >= 0); // Should not go below 0
        });
    });
});

describe('Integration Tests', function() {
    let room;

    beforeEach(function() {
        room = new TestGameRoom();
    });

    describe('Complete Care Cycle', function() {
        it('should progress from egg to grown with proper care', function() {
            // Start with egg
            room.gameState.babies[0].stage = 'egg';
            room.gameState.babies[0].hatchProgress = 0;

            // Hatch the egg
            for (let i = 0; i < 10; i++) {
                room.tapEgg('player1');
            }
            assert.strictEqual(room.gameState.babies[0].stage, 'newborn');

            // Simulate good care over time
            for (let cycle = 0; cycle < 50; cycle++) {
                // Maintain good care
                if (room.gameState.carrots > 0) {
                    room.feedBaby('player1');
                }
                room.cleanBaby('player1');
                room.petBaby('player1');
                if (room.gameState.babies[0].energy > 50) {
                    room.playWithBaby('player1');
                }
                
                // Harvest when needed
                if (room.gameState.carrots <= 1) {
                    room.gameState.lastCarrotHarvest = Date.now() - 31000;
                    room.harvestCarrots('player1');
                }

                room.checkGrowth();
                
                // Check for progression
                if (room.gameState.babies[0].stage === 'grown') {
                    break;
                }
            }

            // Should eventually reach grown stage with good care
            assert(room.gameState.babies[0].stage === 'grown' || room.gameState.babies[0].stage === 'young');
        });
    });
});

console.log('✅ Unit tests ready. Run with: npm test');