// Memories System / Photo Mode
// Stores key event timestamps and creates a family memory log

class MemoriesSystem {
    constructor() {
        this.familyMemories = new Map(); // roomCode -> family memories
        this.eventTypes = this.initializeEventTypes();
    }

    // Initialize memory event types
    initializeEventTypes() {
        return {
            // Life Events
            'egg_laid': {
                name: 'New Egg',
                description: 'A new egg appeared in the family',
                icon: '🥚',
                importance: 'high',
                category: 'life'
            },
            'hatching': {
                name: 'Hatching Day',
                description: 'A bunny hatched from its egg',
                icon: '🐣',
                importance: 'high',
                category: 'life'
            },
            'first_steps': {
                name: 'First Steps',
                description: 'Baby bunny took its first steps',
                icon: '👶',
                importance: 'high',
                category: 'life'
            },
            'growth_milestone': {
                name: 'Growing Up',
                description: 'Bunny reached a new growth stage',
                icon: '🌱',
                importance: 'medium',
                category: 'growth'
            },
            'full_grown': {
                name: 'Adult Bunny',
                description: 'Bunny reached full maturity',
                icon: '🐰',
                importance: 'high',
                category: 'growth'
            },

            // Care Moments
            'first_meal': {
                name: 'First Meal',
                description: 'Bunny enjoyed its very first carrot',
                icon: '🥕',
                importance: 'medium',
                category: 'care'
            },
            'perfect_care_day': {
                name: 'Perfect Care Day',
                description: 'All needs kept above 90% for a full day',
                icon: '⭐',
                importance: 'medium',
                category: 'care'
            },
            'first_cleaning': {
                name: 'Squeaky Clean',
                description: 'First time getting cleaned and loving it',
                icon: '✨',
                importance: 'low',
                category: 'care'
            },
            'first_playtime': {
                name: 'Playtime Fun',
                description: 'First time playing and having a blast',
                icon: '🎾',
                importance: 'medium',
                category: 'care'
            },
            'bedtime_story': {
                name: 'Sweet Dreams',
                description: 'First time sleeping peacefully',
                icon: '😴',
                importance: 'low',
                category: 'care'
            },

            // Family Bonding
            'family_photo': {
                name: 'Family Photo',
                description: 'A special moment captured with the whole family',
                icon: '📸',
                importance: 'high',
                category: 'family'
            },
            'parent_bonding': {
                name: 'Parent Bonding',
                description: 'Both parents caring together',
                icon: '💕',
                importance: 'medium',
                category: 'family'
            },
            'sibling_play': {
                name: 'Sibling Fun',
                description: 'Multiple bunnies playing together',
                icon: '👯',
                importance: 'medium',
                category: 'family'
            },
            'generation_milestone': {
                name: 'New Generation',
                description: 'Welcome to the next generation',
                icon: '🌟',
                importance: 'high',
                category: 'family'
            },

            // Special Moments
            'perfect_cooperation': {
                name: 'Perfect Teamwork',
                description: 'Amazing cooperation between parents',
                icon: '🤝',
                importance: 'medium',
                category: 'cooperation'
            },
            'garden_success': {
                name: 'Garden Mastery',
                description: 'Successfully grew a perfect garden',
                icon: '🌻',
                importance: 'medium',
                category: 'garden'
            },
            'weather_event': {
                name: 'Weather Memory',
                description: 'A special weather event occurred',
                icon: '🌦️',
                importance: 'low',
                category: 'environment'
            },
            'decoration_milestone': {
                name: 'Home Decoration',
                description: 'Made the nest feel more like home',
                icon: '🏡',
                importance: 'low',
                category: 'decoration'
            },
            'achievement_unlock': {
                name: 'Achievement Unlocked',
                description: 'Reached an important milestone',
                icon: '🏆',
                importance: 'medium',
                category: 'achievement'
            }
        };
    }

    // Record a new memory
    recordMemory(roomCode, eventType, data = {}) {
        let familyData = this.familyMemories.get(roomCode) || {
            memories: [],
            milestones: new Map(),
            firstEvents: new Set(),
            statistics: {
                totalMemories: 0,
                categoryCounts: {},
                specialMoments: 0
            }
        };

        const eventInfo = this.eventTypes[eventType];
        if (!eventInfo) {
            console.warn(`Unknown memory event type: ${eventType}`);
            return null;
        }

        const memory = {
            id: this.generateMemoryId(),
            type: eventType,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            ...eventInfo,
            data: {
                ...data,
                roomCode,
                participants: data.participants || [],
                location: data.location || 'nest'
            }
        };

        // Enhance memory with contextual data
        memory.data.gameDay = this.calculateGameDay(roomCode, memory.timestamp);
        memory.data.season = this.getGameSeason(memory.timestamp);
        
        // Check if this is a first-time event
        const firstTimeKey = `${eventType}_${data.babyId || 'general'}`;
        if (!familyData.firstEvents.has(firstTimeKey)) {
            memory.isFirstTime = true;
            memory.importance = 'high'; // First times are always important
            familyData.firstEvents.add(firstTimeKey);
        }

        // Add special context based on event type
        switch (eventType) {
            case 'hatching':
                memory.data.genetics = data.genetics;
                memory.data.hatchTime = data.hatchTime || 'unknown';
                memory.customDescription = `${data.babyName} hatched into a beautiful ${data.genetics?.color} bunny!`;
                break;
            case 'growth_milestone':
                memory.customDescription = `${data.babyName} grew from ${data.oldStage} to ${data.newStage}!`;
                break;
            case 'perfect_cooperation':
                memory.customDescription = `${data.action} performed together - perfect teamwork!`;
                break;
            case 'achievement_unlock':
                memory.customDescription = `Unlocked "${data.achievementName}" - ${data.achievementDescription}`;
                break;
            case 'weather_event':
                memory.customDescription = `${data.weatherType} visited the garden today`;
                break;
        }

        familyData.memories.push(memory);
        familyData.statistics.totalMemories++;
        
        // Update category counts
        const category = eventInfo.category;
        familyData.statistics.categoryCounts[category] = 
            (familyData.statistics.categoryCounts[category] || 0) + 1;

        if (eventInfo.importance === 'high' || memory.isFirstTime) {
            familyData.statistics.specialMoments++;
        }

        // Store milestone markers
        if (this.isMilestone(eventType, data)) {
            familyData.milestones.set(memory.id, {
                ...memory,
                milestoneType: this.getMilestoneType(eventType, data)
            });
        }

        this.familyMemories.set(roomCode, familyData);

        // Auto-create family photos for special moments (skip for family_photo to prevent infinite recursion)
        if ((memory.importance === 'high' || memory.isFirstTime) && eventType !== 'family_photo') {
            this.createFamilyPhoto(roomCode, memory);
        }

        return memory;
    }

    // Create a family photo memory
    createFamilyPhoto(roomCode, triggerMemory = null) {
        const photoData = {
            trigger: triggerMemory?.type,
            captureReason: triggerMemory ? `Celebrating ${triggerMemory.name}` : 'Family moment',
            participants: this.getFamilyMembers(roomCode),
            timestamp: Date.now()
        };

        return this.recordMemory(roomCode, 'family_photo', photoData);
    }

    // Get all memories for a family
    getFamilyMemories(roomCode, filters = {}) {
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) {
            return {
                memories: [],
                milestones: [],
                statistics: {}
            };
        }

        let memories = [...familyData.memories];

        // Apply filters
        if (filters.category) {
            memories = memories.filter(m => m.category === filters.category);
        }
        if (filters.importance) {
            memories = memories.filter(m => m.importance === filters.importance);
        }
        if (filters.babyId) {
            memories = memories.filter(m => m.data.babyId === filters.babyId);
        }
        if (filters.dateFrom) {
            memories = memories.filter(m => m.timestamp >= filters.dateFrom);
        }
        if (filters.dateTo) {
            memories = memories.filter(m => m.timestamp <= filters.dateTo);
        }

        // Sort by timestamp (newest first)
        memories.sort((a, b) => b.timestamp - a.timestamp);

        return {
            memories,
            milestones: Array.from(familyData.milestones.values()),
            statistics: familyData.statistics
        };
    }

    // Get memory timeline
    getMemoryTimeline(roomCode, days = 30) {
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) return [];

        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const recentMemories = familyData.memories.filter(m => m.timestamp >= cutoff);

        // Group by day
        const timeline = new Map();
        
        recentMemories.forEach(memory => {
            const dateKey = new Date(memory.timestamp).toDateString();
            if (!timeline.has(dateKey)) {
                timeline.set(dateKey, []);
            }
            timeline.get(dateKey).push(memory);
        });

        return Array.from(timeline.entries()).map(([date, memories]) => ({
            date,
            memories: memories.sort((a, b) => b.timestamp - a.timestamp),
            count: memories.length,
            highlights: memories.filter(m => m.importance === 'high' || m.isFirstTime)
        }));
    }

    // Get memory highlights
    getMemoryHighlights(roomCode, limit = 10) {
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) return [];

        return familyData.memories
            .filter(m => m.importance === 'high' || m.isFirstTime)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    // Get specific memory by ID
    getMemory(roomCode, memoryId) {
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) return null;

        return familyData.memories.find(m => m.id === memoryId);
    }

    // Helper methods
    generateMemoryId() {
        return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    calculateGameDay(roomCode, timestamp) {
        // Calculate which "day" of the family's life this is
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData || familyData.memories.length === 0) return 1;

        const firstMemory = familyData.memories.reduce((earliest, current) => 
            current.timestamp < earliest.timestamp ? current : earliest
        );

        const daysPassed = Math.floor((timestamp - firstMemory.timestamp) / (24 * 60 * 60 * 1000));
        return daysPassed + 1;
    }

    getGameSeason(timestamp) {
        const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
        const monthIndex = new Date(timestamp).getMonth();
        return seasons[Math.floor(monthIndex / 3)];
    }

    isMilestone(eventType, data) {
        const milestoneEvents = [
            'hatching', 'full_grown', 'generation_milestone',
            'perfect_care_day', 'achievement_unlock', 'family_photo'
        ];
        return milestoneEvents.includes(eventType);
    }

    getMilestoneType(eventType, data) {
        switch (eventType) {
            case 'hatching': return 'birth';
            case 'full_grown': return 'maturity';
            case 'generation_milestone': return 'generation';
            case 'perfect_care_day': return 'care_excellence';
            case 'achievement_unlock': return 'achievement';
            case 'family_photo': return 'memory_capture';
            default: return 'general';
        }
    }

    getFamilyMembers(roomCode) {
        // This would integrate with the game state to get current family members
        // For now, return placeholder data
        return ['parent1', 'parent2', 'baby1'];
    }

    // Delete old memories (privacy/storage management)
    cleanupOldMemories(roomCode, maxAge = 365) { // days
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) return;

        const cutoff = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
        const keepMemories = familyData.memories.filter(m => 
            m.timestamp >= cutoff || m.importance === 'high' || m.isFirstTime
        );

        familyData.memories = keepMemories;
        this.familyMemories.set(roomCode, familyData);
    }

    // Export family memories
    exportFamilyMemories(roomCode) {
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) return null;

        return {
            familyId: roomCode,
            exportDate: new Date().toISOString(),
            totalMemories: familyData.statistics.totalMemories,
            memories: familyData.memories,
            milestones: Array.from(familyData.milestones.values()),
            statistics: familyData.statistics
        };
    }

    // Persistence methods
    serialize() {
        return {
            familyMemories: Array.from(this.familyMemories.entries()).map(([roomCode, data]) => [
                roomCode,
                {
                    ...data,
                    firstEvents: Array.from(data.firstEvents),
                    milestones: Array.from(data.milestones.entries())
                }
            ])
        };
    }

    deserialize(data) {
        if (data && data.familyMemories) {
            this.familyMemories = new Map(
                data.familyMemories.map(([roomCode, familyData]) => [
                    roomCode,
                    {
                        ...familyData,
                        firstEvents: new Set(familyData.firstEvents),
                        milestones: new Map(familyData.milestones)
                    }
                ])
            );
        }
    }

    // Get memory statistics
    getMemoryStatistics(roomCode) {
        const familyData = this.familyMemories.get(roomCode);
        if (!familyData) {
            return {
                totalMemories: 0,
                categoryCounts: {},
                specialMoments: 0,
                firstEvents: 0,
                averagePerDay: 0
            };
        }

        const stats = { ...familyData.statistics };
        stats.firstEvents = familyData.firstEvents.size;
        
        if (familyData.memories.length > 0) {
            const oldestMemory = familyData.memories.reduce((oldest, current) => 
                current.timestamp < oldest.timestamp ? current : oldest
            );
            const daysSinceFirst = Math.max(1, (Date.now() - oldestMemory.timestamp) / (24 * 60 * 60 * 1000));
            stats.averagePerDay = familyData.memories.length / daysSinceFirst;
        }

        return stats;
    }
}

module.exports = MemoriesSystem;