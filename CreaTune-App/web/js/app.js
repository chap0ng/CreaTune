// app.js - Main application script
document.addEventListener('DOMContentLoaded', () => {
  console.log('CreaTune Application Initializing...');
  
  // Global settings
  window.lastESP32ActivityTime = Date.now(); // For timeout tracking
  
  // Set up global error handler for better debugging
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Show error to user if UIManager is available
    if (window.UIManager) {
      window.UIManager.showErrorMessage(`Error: ${event.error.message}`);
    }
  });
  
  // Special handling for touch - initialize audio on touch events
  function initAudioOnTouch(e) {
    if (window.SynthEngine && window.SynthEngine.ensureAudioStarted) {
      window.SynthEngine.ensureAudioStarted();
    }
    // Remove listeners after first touch
    document.removeEventListener('touchstart', initAudioOnTouch);
    document.removeEventListener('mousedown', initAudioOnTouch);
  }
  
  // Add touch/mouse listeners for audio initialization
  document.addEventListener('touchstart', initAudioOnTouch);
  document.addEventListener('mousedown', initAudioOnTouch);
  
  // Initialize Simulator if available
  function initializeSimulator() {
    // Check if simulator exists every 500ms up to 10 times
    let attempts = 0;
    const checkInterval = setInterval(() => {
      if (window.ESP32Simulator) {
        console.log('ESP32 Simulator found and ready');
        clearInterval(checkInterval);
      } else {
        attempts++;
        if (attempts >= 10) {
          console.log('ESP32 Simulator not found after 10 attempts');
          clearInterval(checkInterval);
        }
      }
    }, 500);
  }
  
  // Check WebSocket connection periodically
  function monitorConnection() {
    setInterval(() => {
      if (window.WebSocketClient) {
        // Check connection and reconnect if needed
        window.WebSocketClient.checkConnection();
      }
      
      // Update activity time to prevent false disconnections
      if (window.lastESP32ActivityTime) {
        // Only update if no data for more than 10 seconds
        if (Date.now() - window.lastESP32ActivityTime > 10000) {
          window.lastESP32ActivityTime = Date.now();
        }
      }
    }, 15000);
  }
  
  // Auto-initialize audio on first data from ESP32
  function setupAutoAudio() {
    // Listen for ESP32 data
    if (window.EventBus) {
      window.EventBus.subscribe('webSocketMessage', (data) => {
        if (data && data.type === 'sensor_data') {
          console.log('Received sensor data, auto-initializing audio');
          if (window.SynthEngine && window.SynthEngine.ensureAudioStarted) {
            window.SynthEngine.ensureAudioStarted();
          }
        }
      });
    }
  }
  
  // Show ready message when everything is initialized
  function notifyInitialized() {
    console.log('CreaTune Application Initialized');
    
    // Show welcome message with auto-dismiss
    if (window.UIManager) {
      window.UIManager.showInfoMessage('CreaTune ready. Connect ESP32 devices or use Random State button.', 4000);
    }
    
    // Also attempt to start audio now
    if (window.SynthEngine) {
      window.SynthEngine.ensureAudioStarted();
    }
  }
  
  // Initialize all
  function initialize() {
    // Setup auto-audio
    setupAutoAudio();
    
    // Initialize simulator
    initializeSimulator();
    
    // Monitor WebSocket connection
    monitorConnection();
    
    // Notify when initialized
    notifyInitialized();
    
    // Emit event for other components
    if (window.EventBus) {
      window.EventBus.emit('appInitialized');
    }
  }
  
  // Initialize
  initialize();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    // Clean up Tone.js resources if possible
    if (window.Tone && window.Tone.context) {
      window.Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
    }
    
    console.log('Application cleanup complete');
  });
});
