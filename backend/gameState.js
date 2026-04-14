// Game State Persistence Module
const fs = require('fs').promises;
const path = require('path');

const SAVE_DIR = path.join(__dirname, 'saves');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Security: Helper function to sanitize room codes
function sanitizeRoomCode(roomCode) {
    if (!roomCode || typeof roomCode !== 'string') {
        throw new Error('Invalid room code');
    }
    
    // Only allow alphanumeric characters, exactly 6 characters
    const sanitized = roomCode.replace(/[^A-Z0-9]/g, '').substring(0, 6);
    
    if (sanitized.length !== 6) {
        throw new Error('Room code must be exactly 6 alphanumeric characters');
    }
    
    return sanitized;
}

class GameStateManager {
    constructor() {
        this.saveInterval = null;
        // FIX: Auto-save race conditions - prevent concurrent file writes
        this.saveQueue = new Map(); // roomCode -> promise
        this.saveLocks = new Set(); // Track which rooms are being saved
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(SAVE_DIR, { recursive: true });
            await fs.mkdir(BACKUP_DIR, { recursive: true });
        } catch (error) {
            console.error('Failed to create save directories:', error);
        }
    }

    async saveRoomState(roomCode, gameState, players) {
        // FIX: Prevent concurrent file writes using queue/lock mechanism
        const sanitizedRoomCode = sanitizeRoomCode(roomCode);
        
        // If already saving this room, wait for existing save to complete
        if (this.saveQueue.has(sanitizedRoomCode)) {
            try {
                await this.saveQueue.get(sanitizedRoomCode);
            } catch (error) {
                // Previous save failed, continue with new save
            }
        }
        
        // Create a new save operation
        const savePromise = this._performSave(sanitizedRoomCode, gameState, players);
        this.saveQueue.set(sanitizedRoomCode, savePromise);
        
        try {
            const result = await savePromise;
            return result;
        } finally {
            // Clean up queue entry when save completes
            this.saveQueue.delete(sanitizedRoomCode);
        }
    }

    async _performSave(sanitizedRoomCode, gameState, players) {
        try {
            // Prevent multiple concurrent saves of the same room
            if (this.saveLocks.has(sanitizedRoomCode)) {
                console.warn(`Save already in progress for room ${sanitizedRoomCode}, skipping`);
                return false;
            }
            
            this.saveLocks.add(sanitizedRoomCode);
            
            const saveData = {
                roomCode: sanitizedRoomCode,
                gameState,
                players: Array.from(players.values()).map(player => ({
                    id: player.id,
                    type: player.type,
                    joinTime: player.joinTime,
                    connected: player.connected
                })),
                lastSaved: Date.now()
            };

            const filename = `room_${sanitizedRoomCode}.json`;
            const filepath = path.join(SAVE_DIR, filename);
            
            // Create backup first
            await this.createBackup(sanitizedRoomCode);
            
            // Save current state atomically by writing to temp file first
            const tempFilepath = filepath + '.tmp';
            await fs.writeFile(tempFilepath, JSON.stringify(saveData, null, 2));
            await fs.rename(tempFilepath, filepath);
            
            return true;
        } catch (error) {
            console.error(`Failed to save room ${sanitizedRoomCode}:`, error);
            return false;
        } finally {
            this.saveLocks.delete(sanitizedRoomCode);
        }
    }

    async loadRoomState(roomCode) {
        try {
            // Security: Sanitize room code to prevent path traversal
            const sanitizedRoomCode = sanitizeRoomCode(roomCode);
            
            const filename = `room_${sanitizedRoomCode}.json`;
            const filepath = path.join(SAVE_DIR, filename);
            
            const data = await fs.readFile(filepath, 'utf8');
            const saveData = JSON.parse(data);
            
            // Validate save data
            if (saveData.roomCode !== sanitizedRoomCode) {
                throw new Error('Room code mismatch in save file');
            }
            
            // Check if save is too old (older than 24 hours)
            const saveAge = Date.now() - saveData.lastSaved;
            if (saveAge > 24 * 60 * 60 * 1000) {
                console.warn(`Save file for room ${roomCode} is old (${Math.round(saveAge / (60 * 60 * 1000))} hours)`);
            }
            
            return saveData;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Failed to load room ${roomCode}:`, error);
            }
            return null;
        }
    }

    async createBackup(roomCode) {
        try {
            // Security: Sanitize room code to prevent path traversal
            const sanitizedRoomCode = sanitizeRoomCode(roomCode);
            
            const filename = `room_${sanitizedRoomCode}.json`;
            const filepath = path.join(SAVE_DIR, filename);
            
            // Check if current save exists
            try {
                await fs.access(filepath);
            } catch {
                return; // No current save to backup
            }
            
            const backupFilename = `room_${sanitizedRoomCode}_${Date.now()}.json`;
            const backupPath = path.join(BACKUP_DIR, backupFilename);
            
            await fs.copyFile(filepath, backupPath);
            
            // Clean old backups (keep only last 5 per room)
            await this.cleanOldBackups(sanitizedRoomCode);
        } catch (error) {
            console.error(`Failed to create backup for room ${roomCode}:`, error);
        }
    }

    async cleanOldBackups(roomCode) {
        try {
            // Security: Sanitize room code to prevent path traversal
            const sanitizedRoomCode = sanitizeRoomCode(roomCode);
            
            const files = await fs.readdir(BACKUP_DIR);
            const roomBackups = files
                .filter(f => f.startsWith(`room_${sanitizedRoomCode}_`) && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(BACKUP_DIR, f),
                    timestamp: parseInt(f.match(/_(\d+)\.json$/)[1])
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            // Keep only the 5 most recent backups
            const toDelete = roomBackups.slice(5);
            for (const backup of toDelete) {
                try {
                    await fs.unlink(backup.path);
                } catch (deleteError) {
                    // FIX: Handle file permission errors gracefully
                    if (deleteError.code === 'EACCES' || deleteError.code === 'EPERM') {
                        console.warn(`Permission denied deleting backup ${backup.name}:`, deleteError.message);
                        // Try to change permissions and retry once
                        try {
                            await fs.chmod(backup.path, 0o666);
                            await fs.unlink(backup.path);
                        } catch (retryError) {
                            console.error(`Failed to delete backup even after chmod ${backup.name}:`, retryError.message);
                            // Don't fail the entire cleanup process
                        }
                    } else if (deleteError.code === 'ENOENT') {
                        // File already deleted, ignore
                    } else {
                        console.error(`Unexpected error deleting backup ${backup.name}:`, deleteError.message);
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to clean old backups for room ${roomCode}:`, error);
        }
    }

    async deleteRoomState(roomCode) {
        let sanitizedRoomCode;
        try {
            sanitizedRoomCode = sanitizeRoomCode(roomCode);
            const filename = `room_${sanitizedRoomCode}.json`;
            const filepath = path.join(SAVE_DIR, filename);
            await fs.unlink(filepath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Failed to delete room ${sanitizedRoomCode || roomCode}:`, error);
            }
        }
    }

    async listSavedRooms() {
        try {
            const files = await fs.readdir(SAVE_DIR);
            const roomFiles = files.filter(f => f.startsWith('room_') && f.endsWith('.json'));
            
            const rooms = [];
            for (const file of roomFiles) {
                try {
                    const data = await fs.readFile(path.join(SAVE_DIR, file), 'utf8');
                    const saveData = JSON.parse(data);
                    rooms.push({
                        roomCode: saveData.roomCode,
                        lastSaved: saveData.lastSaved,
                        playerCount: saveData.players.length,
                        babies: saveData.gameState.babies.length
                    });
                } catch (error) {
                    console.error(`Failed to read save file ${file}:`, error);
                }
            }
            
            return rooms;
        } catch (error) {
            console.error('Failed to list saved rooms:', error);
            return [];
        }
    }

    startAutoSave(rooms, intervalMs = 60000) {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        
        this.saveInterval = setInterval(async () => {
            for (const [roomCode, room] of rooms) {
                if (room.getConnectedPlayerCount() > 0) {
                    await this.saveRoomState(roomCode, room.gameState, room.players);
                }
            }
        }, intervalMs);
        
        console.log(`Auto-save started with ${intervalMs}ms interval`);
    }

    stopAutoSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
            console.log('Auto-save stopped');
        }
    }
}

module.exports = GameStateManager;