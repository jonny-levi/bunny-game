// Memory and Event Logging System
// Manages key moments, photos, and memorable events

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const MEMORY_SAVE_DIR = path.join(__dirname, 'saves', 'memories');
const PHOTO_SAVE_DIR = path.join(__dirname, 'saves', 'photos');

class MemoryManager {
    constructor() {
        this.eventTypes = {
            birth: { icon: '🐣', priority: 'high', title: 'New Bunny Born' },
            growth: { icon: '🌱', priority: 'high', title: 'Bunny Grew Up' },
            achievement: { icon: '🏆', priority: 'medium', title: 'Achievement Unlocked' },
            milestone: { icon: '🎯', priority: 'high', title: 'Milestone Reached' },
            first_time: { icon: '⭐', priority: 'medium', title: 'First Time Event' },
            cooperative: { icon: '🤝', priority: 'medium', title: 'Teamwork Moment' },
            special: { icon: '✨', priority: 'high', title: 'Special Moment' },
            daily: { icon: '📅', priority: 'low', title: 'Daily Event' },
            photo: { icon: '📸', priority: 'medium', title: 'Photo Captured' },
            love: { icon: '💕', priority: 'medium', title: 'Love Milestone' }
        };
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(MEMORY_SAVE_DIR, { recursive: true });
            await fs.mkdir(PHOTO_SAVE_DIR, { recursive: true });
        } catch (error) {
            console.error('Failed to create memory directories:', error);
        }
    }

    async createMemory(roomCode, eventData) {
        try {
            const memory = {
                id: crypto.randomUUID(),
                roomCode: sanitizeInput(roomCode),
                timestamp: Date.now(),
                type: eventData.type || 'special',
                title: eventData.title,
                description: eventData.description,
                participants: eventData.participants || [],
                babies: eventData.babies || [],
                metadata: eventData.metadata || {},
                ...this.eventTypes[eventData.type] || this.eventTypes.special
            };

            // Save individual memory
            const memoryFile = path.join(MEMORY_SAVE_DIR, `${roomCode}_memories.json`);
            const memories = await this.loadRoomMemories(roomCode);
            memories.push(memory);

            // Keep only last 1000 memories per room to prevent file bloat
            if (memories.length > 1000) {
                memories.splice(0, memories.length - 1000);
            }

            await fs.writeFile(memoryFile, JSON.stringify(memories, null, 2));
            
            console.log(`Memory created for room ${roomCode}: ${memory.title}`);
            return memory;
        } catch (error) {
            console.error('Failed to create memory:', error);
            return null;
        }
    }

    async loadRoomMemories(roomCode) {
        try {
            const memoryFile = path.join(MEMORY_SAVE_DIR, `${sanitizeInput(roomCode)}_memories.json`);
            const data = await fs.readFile(memoryFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // File doesn't exist, return empty array
            return [];
        }
    }

    async getRecentMemories(roomCode, limit = 20) {
        const memories = await this.loadRoomMemories(roomCode);
        return memories
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit)
            .map(memory => ({
                ...memory,
                timeAgo: this.getTimeAgo(memory.timestamp)
            }));
    }

    async getMilestones(roomCode) {
        const memories = await this.loadRoomMemories(roomCode);
        return memories
            .filter(memory => memory.priority === 'high')
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(memory => ({
                ...memory,
                timeAgo: this.getTimeAgo(memory.timestamp)
            }));
    }

    async capturePhoto(roomCode, photoData) {
        try {
            const photo = {
                id: crypto.randomUUID(),
                roomCode: sanitizeInput(roomCode),
                timestamp: Date.now(),
                caption: sanitizeInput(photoData.caption || ''),
                participants: photoData.participants || [],
                babies: photoData.babies || [],
                filter: photoData.filter || 'none',
                scene: photoData.scene || 'default',
                metadata: {
                    camera: photoData.camera || 'default',
                    lighting: photoData.lighting || 'auto',
                    gameState: photoData.gameState || null
                }
            };

            // If actual image data provided, save it
            if (photoData.imageData) {
                const imageFile = `${photo.id}.png`;
                const imagePath = path.join(PHOTO_SAVE_DIR, imageFile);
                
                // Validate and save image data
                const imageBuffer = this.validateImageData(photoData.imageData);
                if (imageBuffer) {
                    await fs.writeFile(imagePath, imageBuffer);
                    photo.imageFile = imageFile;
                    photo.hasImage = true;
                } else {
                    photo.hasImage = false;
                }
            } else {
                photo.hasImage = false;
            }

            // Create memory event for photo
            await this.createMemory(roomCode, {
                type: 'photo',
                title: 'Photo Captured',
                description: photo.caption || 'A memorable moment',
                participants: photo.participants,
                babies: photo.babies,
                metadata: { photoId: photo.id, filter: photo.filter }
            });

            // Save photo data
            const photoFile = path.join(MEMORY_SAVE_DIR, `${roomCode}_photos.json`);
            const photos = await this.loadRoomPhotos(roomCode);
            photos.push(photo);

            // Keep only last 500 photos per room
            if (photos.length > 500) {
                const oldPhotos = photos.splice(0, photos.length - 500);
                // Delete old photo files
                for (const oldPhoto of oldPhotos) {
                    if (oldPhoto.imageFile) {
                        try {
                            await fs.unlink(path.join(PHOTO_SAVE_DIR, oldPhoto.imageFile));
                        } catch (error) {
                            console.warn(`Failed to delete old photo ${oldPhoto.imageFile}:`, error);
                        }
                    }
                }
            }

            await fs.writeFile(photoFile, JSON.stringify(photos, null, 2));
            
            console.log(`Photo captured for room ${roomCode}: ${photo.caption}`);
            return photo;
        } catch (error) {
            console.error('Failed to capture photo:', error);
            return null;
        }
    }

    async loadRoomPhotos(roomCode) {
        try {
            const photoFile = path.join(MEMORY_SAVE_DIR, `${sanitizeInput(roomCode)}_photos.json`);
            const data = await fs.readFile(photoFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    async getRecentPhotos(roomCode, limit = 12) {
        const photos = await this.loadRoomPhotos(roomCode);
        return photos
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit)
            .map(photo => ({
                ...photo,
                timeAgo: this.getTimeAgo(photo.timestamp),
                imageUrl: photo.imageFile ? `/api/photos/${photo.imageFile}` : null
            }));
    }

    validateImageData(imageData) {
        try {
            // Check if it's a valid data URL
            if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
                return null;
            }

            const matches = imageData.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);
            if (!matches) {
                return null;
            }

            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Basic size validation (max 5MB)
            if (buffer.length > 5 * 1024 * 1024) {
                console.warn('Image too large, rejecting');
                return null;
            }

            return buffer;
        } catch (error) {
            console.error('Failed to validate image data:', error);
            return null;
        }
    }

    // Preset memory creators for common events
    async recordBirth(roomCode, baby, participants) {
        return await this.createMemory(roomCode, {
            type: 'birth',
            title: `${baby.name} was born!`,
            description: `A beautiful ${baby.genetics?.color || 'bunny'} ${baby.genetics?.trait || ''} bunny entered the world`,
            participants,
            babies: [baby.id],
            metadata: {
                babyName: baby.name,
                genetics: baby.genetics,
                birthTime: baby.birthTime
            }
        });
    }

    async recordGrowth(roomCode, baby, oldStage, newStage, participants) {
        return await this.createMemory(roomCode, {
            type: 'growth',
            title: `${baby.name} grew up!`,
            description: `${baby.name} evolved from ${oldStage} to ${newStage}`,
            participants,
            babies: [baby.id],
            metadata: {
                babyName: baby.name,
                oldStage,
                newStage,
                growthPoints: baby.growthPoints
            }
        });
    }

    async recordAchievement(roomCode, achievement, playerId) {
        return await this.createMemory(roomCode, {
            type: 'achievement',
            title: achievement.title,
            description: achievement.description,
            participants: [playerId],
            metadata: {
                achievementId: achievement.id,
                category: achievement.category,
                reward: achievement.reward
            }
        });
    }

    async recordMilestone(roomCode, milestone, participants) {
        return await this.createMemory(roomCode, {
            type: 'milestone',
            title: milestone.title,
            description: milestone.description,
            participants,
            metadata: milestone.metadata || {}
        });
    }

    async recordCooperativeAction(roomCode, action, participants, babies = []) {
        return await this.createMemory(roomCode, {
            type: 'cooperative',
            title: `Perfect teamwork!`,
            description: `Both parents worked together to ${action}`,
            participants,
            babies,
            metadata: { action }
        });
    }

    async recordLoveMilestone(roomCode, baby, loveLevel, participants) {
        const milestones = {
            25: 'first affection',
            50: 'growing bond',
            75: 'deep love',
            100: 'unconditional love'
        };

        const milestone = milestones[loveLevel];
        if (milestone) {
            return await this.createMemory(roomCode, {
                type: 'love',
                title: `${baby.name} feels ${milestone}!`,
                description: `${baby.name}'s love has reached ${loveLevel}%`,
                participants,
                babies: [baby.id],
                metadata: {
                    babyName: baby.name,
                    loveLevel,
                    milestone
                }
            });
        }
        return null;
    }

    async recordFirstTime(roomCode, eventType, participants, babies = []) {
        const firstTimeEvents = {
            feed: 'First feeding',
            play: 'First playtime',
            clean: 'First cleaning',
            pet: 'First petting',
            harvest: 'First harvest',
            partner_join: 'First partner connection'
        };

        const title = firstTimeEvents[eventType];
        if (title) {
            return await this.createMemory(roomCode, {
                type: 'first_time',
                title,
                description: `A special first moment in the bunny family`,
                participants,
                babies,
                metadata: { eventType }
            });
        }
        return null;
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days > 0) {
            return days === 1 ? '1 day ago' : `${days} days ago`;
        } else if (hours > 0) {
            return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
        } else if (minutes > 0) {
            return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
        } else {
            return 'Just now';
        }
    }

    async getMemoryStats(roomCode) {
        const memories = await this.loadRoomMemories(roomCode);
        const photos = await this.loadRoomPhotos(roomCode);

        const stats = {
            totalMemories: memories.length,
            totalPhotos: photos.length,
            oldestMemory: memories.length > 0 ? Math.min(...memories.map(m => m.timestamp)) : null,
            newestMemory: memories.length > 0 ? Math.max(...memories.map(m => m.timestamp)) : null,
            byType: {},
            recentActivity: memories.filter(m => Date.now() - m.timestamp < 24 * 60 * 60 * 1000).length
        };

        // Count by type
        memories.forEach(memory => {
            stats.byType[memory.type] = (stats.byType[memory.type] || 0) + 1;
        });

        return stats;
    }

    // Admin/Debug functions
    async deleteRoomMemories(roomCode) {
        try {
            const memoryFile = path.join(MEMORY_SAVE_DIR, `${sanitizeInput(roomCode)}_memories.json`);
            const photoFile = path.join(MEMORY_SAVE_DIR, `${sanitizeInput(roomCode)}_photos.json`);
            
            // Delete photos and photo files
            const photos = await this.loadRoomPhotos(roomCode);
            for (const photo of photos) {
                if (photo.imageFile) {
                    try {
                        await fs.unlink(path.join(PHOTO_SAVE_DIR, photo.imageFile));
                    } catch (error) {
                        console.warn(`Failed to delete photo file ${photo.imageFile}:`, error);
                    }
                }
            }

            // Delete memory and photo data files
            await fs.unlink(memoryFile).catch(() => {});
            await fs.unlink(photoFile).catch(() => {});

            console.log(`Deleted all memories for room ${roomCode}`);
        } catch (error) {
            console.error(`Failed to delete memories for room ${roomCode}:`, error);
        }
    }

    async exportMemories(roomCode, format = 'json') {
        try {
            const memories = await this.loadRoomMemories(roomCode);
            const photos = await this.loadRoomPhotos(roomCode);
            
            const exportData = {
                roomCode,
                exportDate: new Date().toISOString(),
                stats: await this.getMemoryStats(roomCode),
                memories: memories.sort((a, b) => a.timestamp - b.timestamp),
                photos: photos.sort((a, b) => a.timestamp - b.timestamp)
            };

            if (format === 'json') {
                return JSON.stringify(exportData, null, 2);
            } else if (format === 'text') {
                return this.formatMemoriesAsText(exportData);
            }

            return exportData;
        } catch (error) {
            console.error(`Failed to export memories for room ${roomCode}:`, error);
            return null;
        }
    }

    formatMemoriesAsText(exportData) {
        let text = `Bunny Family Memory Book - Room ${exportData.roomCode}\n`;
        text += `Generated: ${exportData.exportDate}\n\n`;
        
        text += `=== STATISTICS ===\n`;
        text += `Total Memories: ${exportData.stats.totalMemories}\n`;
        text += `Total Photos: ${exportData.stats.totalPhotos}\n`;
        if (exportData.stats.oldestMemory) {
            text += `First Memory: ${new Date(exportData.stats.oldestMemory).toLocaleString()}\n`;
        }
        text += `\n`;

        text += `=== MEMORY TIMELINE ===\n`;
        exportData.memories.forEach(memory => {
            const date = new Date(memory.timestamp).toLocaleString();
            text += `${date} - ${memory.icon} ${memory.title}\n`;
            text += `  ${memory.description}\n`;
            if (memory.participants.length > 0) {
                text += `  Participants: ${memory.participants.join(', ')}\n`;
            }
            text += `\n`;
        });

        return text;
    }
}

// Helper function to sanitize input
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
}

module.exports = MemoryManager;