// app.js - Simplified version for direct script loading
// Only contains event initialization and application-wide utilities

document.addEventListener('DOMContentLoaded', () => {
  console.log('CreaTune Application Initializing...');
  
  // Initialize ESP32 timeout check
  let lastESP32ActivityTime = Date.now();
  
  function setupESP32TimeoutCheck() {
    // Check every 10 seconds if ESP32 is still active
    return setInterval(() => {
      if (!window.ESPManager) return;
      
      const espStatus = window.ESPManager.getESPStatus();
      const anyConnected = Object.values(espStatus).some(esp => esp.connected);
      
      // If ESP32 was connected but no data for 15 seconds
      if (anyConnected && (Date.now() - lastESP32ActivityTime > 15000)) {
        // Reset all ESP statuses
        Object.keys(espStatus).forEach(key => {
          if (espStatus[key].connected) {
            console.log(`ESP32 ${key} timeout - no data received for 15s`);
            espStatus[key].connected = false;
            espStatus[key].valid = false;
            espStatus[key].value = null;
          }
        });
        
        // Notify state change
        EventBus.emit('espStatusChanged', { ...espStatus });
      }
    }, 10000);
  }
  
  // Start ESP32 timeout check
  const ESP32TimeoutCheck = setupESP32TimeoutCheck();
  
  // Listen for ESP32 activity to reset timeout
  EventBus.subscribe('espStatusChanged', () => {
    lastESP32ActivityTime = Date.now();
  });
  
  // Set up global error handler for better debugging
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Show error to user if UIManager is available
    if (window.UIManager) {
      window.UIManager.showErrorMessage(`Error: ${event.error.message}`);
    }
  });
  
  // Show ready message when everything is initialized
  EventBus.subscribe('appInitialized', () => {
    console.log('CreaTune Application Initialized');
    
    // Show welcome message
    if (window.UIManager) {
      window.UIManager.showInfoMessage('CreaTune ready. Connect ESP32 devices or use Random State button.', 4000);
    }
  });
  
  // Send initialization event after a short delay to ensure all components are ready
  setTimeout(() => {
    EventBus.emit('appInitialized');
  }, 500);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    // Clear ESP32 timeout check
    if (ESP32TimeoutCheck) {
      clearInterval(ESP32TimeoutCheck);
    }
    
    // Stop any recording in progress
    if (window.RecordingManager && window.RecordingManager.isRecording()) {
      window.RecordingManager.stopRecording();
    }
    
    // Clean up Tone.js resources if possible
    if (window.Tone && window.Tone.context) {
      window.Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
    }
    
    console.log('Application cleanup complete');
  });
});
