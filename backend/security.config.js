// Security Configuration for Bunny Family Game
// This file contains security-related configuration settings

const SECURITY_CONFIG = {
    // Connection limits
    MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 10,
    MAX_TOTAL_CONNECTIONS: parseInt(process.env.MAX_TOTAL_CONNECTIONS) || 1000,
    
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
    RATE_LIMITS: {
        default: 10,
        create_room: 5,
        join_room: 5,
        decay_needs: 3
    },
    
    // CORS settings
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000', 'http://127.0.0.1:3000'],
    
    // Input validation limits
    MAX_ROOM_CODE_LENGTH: 6,
    MAX_PLAYER_ID_LENGTH: 100,
    MAX_ACTION_LENGTH: 50,
    MAX_BABY_NAME_LENGTH: 20,
    MAX_MESSAGE_LENGTH: 500,
    
    // Session management
    ROOM_CLEANUP_DELAY_MS: 300000, // 5 minutes
    RATE_LIMIT_CLEANUP_INTERVAL_MS: 300000, // 5 minutes
    INACTIVE_ROOM_CLEANUP_INTERVAL_MS: 3600000, // 1 hour
    
    // Security headers
    SECURITY_HEADERS: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:;"
    },
    
    // File system security
    ALLOWED_FILE_EXTENSIONS: ['.json'],
    SAVE_DIR_NAME: 'saves',
    BACKUP_DIR_NAME: 'backups',
    MAX_BACKUPS_PER_ROOM: 5,
    
    // Logging
    LOG_SENSITIVE_DATA: false,
    SANITIZE_LOGS: true
};

module.exports = SECURITY_CONFIG;