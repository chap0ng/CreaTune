// main.js - Main application initialization with clean UI preservation

// Global state
const CreaTuneApp = {
    // App state
    isInitialized: false,
    
    // Initialize the application
    init: function() {
        if (this.isInitialized) return;
        
        // Load modules in correct order
        this.initModules();
        
        // Register service worker for PWA
        this.registerServiceWorker();
        
        // Setup fullscreen on mobile
        this.setupFullscreen();
        
        // Initial log message
        UIController.logToUI('CreaTune initialized with sprite animation');
        
        // Mark as initialized
        this.isInitialized = true;
    },
    
    // Initialize modules in correct order
    initModules: function() {
        // We need to be careful about the initialization order
        // First UI, then sensors, audio, and finally integration
        UIController.init();
        SensorManager.init();
        AudioEngine.init();
        WebSocketManager.init();
        
        // Initialize sprite integration last (after other modules are ready)
        setTimeout(() => {
            // Make sure sprite animation is available
            if (window.spriteAnimation) {
                SpriteIntegration.init();
                UIController.logToUI('Sprite animation integrated with audio engine');
            } else {
                UIController.logToUI('Warning: Sprite animation not available');
            }
        }, 500);
    },
    
    // Register service worker for PWA functionality
    registerServiceWorker: function() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(reg => console.log('Service Worker registered'))
                    .catch(err => console.log('Service Worker registration failed:', err));
            });
        }
    },
    
    // Setup fullscreen mode for mobile devices
    setupFullscreen: function() {
        // Check if it's a mobile device
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            // Add fullscreen class
            document.body.classList.add('fullscreen-ready');
            
            // Request fullscreen on touch
            document.addEventListener('click', () => {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(err => {
                        // Ignore errors - not all browsers allow fullscreen
                    });
                }
            }, { once: true });
            
            // Specifically enhance for Nothing Phone 2a
            if (navigator.userAgent.indexOf('2102') !== -1) {
                UIController.logToUI('Nothing Phone 2a detected - optimizing UI');
                document.body.classList.add('nothing-phone');
            }
        }
    }
};

// Initialize app on load - but wait for original scripts to complete
document.addEventListener('DOMContentLoaded', () => {
    // Allow a small delay to make sure original sprite animation is loaded
    setTimeout(() => {
        CreaTuneApp.init();
    }, 300);
});