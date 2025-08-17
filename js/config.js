// Configuration for Trump Against Humanity
// This file contains environment-specific settings

window.TRUMP_CONFIG = {
    // Environment detection
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    
    // Backend server configuration
    BACKEND_URL: (() => {
        // Auto-detect environment and return appropriate backend URL
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Development environment
            return 'http://localhost:3000';
        } else {
            // Production environment
            // TODO: Update this URL after deploying to Render
            return 'https://trump-against-humanity.onrender.com';
        }
    })(),
    
    // Socket.io connection options
    socketOptions: {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    },
    
    // Game configuration
    game: {
        maxPlayers: 5,
        minPlayers: 2,
        roundTimer: 60, // seconds
        judgeTimer: 30  // seconds
    },
    
    // Debug settings
    debug: window.location.hostname === 'localhost'
};

// Log configuration on load
console.log('🎺 Trump Against Humanity Configuration:');
console.log(`🌍 Environment: ${window.TRUMP_CONFIG.isDevelopment ? 'Development' : 'Production'}`);
console.log(`🔗 Backend URL: ${window.TRUMP_CONFIG.BACKEND_URL}`);
console.log(`🐛 Debug mode: ${window.TRUMP_CONFIG.debug ? 'ON' : 'OFF'}`);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.TRUMP_CONFIG;
}
