// Find the processESPEvent function in esp-manager.js and replace/update it with:

// Process ESP event locally
function processESPEvent(data) {
  try {
    // Find which ESP this event is for
    let espId = null;
    
    if (data.name === (ESP32.ESP1?.name || 'ESP32-1') || data.sensor === 'soil') {
      espId = 'esp1';
    } else if (data.name === (ESP32.ESP2?.name || 'ESP32-2') || data.sensor === 'light') {
      espId = 'esp2';
    } else if (data.name === (ESP32.ESP3?.name || 'ESP32-3') || data.sensor === 'temperature') {
      espId = 'esp3';
    }
    
    if (!espId) {
      console.warn('Unknown ESP device:', data.name, data.sensor);
      return;
    }
    
    // Update last activity time to prevent timeout
    window.lastESP32ActivityTime = Date.now();
    
    // Also store the last activity time for this specific ESP
    if (!window.lastESPActivityTimes) {
      window.lastESPActivityTimes = {};
    }
    window.lastESPActivityTimes[espId] = Date.now();
    
    // Process based on event type
    if (data.type === 'esp_connected') {
      // ESP connected
      espStatus[espId].connected = true;
      espStatus[espId].valid = false; // Wait for valid data
      console.log(`ESP ${espId} connected`);
    } 
    else if (data.type === 'esp_disconnected') {
      // ESP disconnected
      espStatus[espId].connected = false;
      espStatus[espId].valid = false;
      espStatus[espId].value = null;
      console.log(`ESP ${espId} disconnected`);
    } 
    else if (data.type === 'sensor_data') {
      // Sensor data received
      if (data.value !== undefined && data.value !== null) {
        // Make sure this ESP is marked as connected when we get data from it
        espStatus[espId].connected = true;
        
        // Check if value is in valid range (0.4 to 0.8)
        const validRange = { min: 0.4, max: 0.8 };
        espStatus[espId].valid = data.value >= validRange.min && data.value <= validRange.max;
        espStatus[espId].value = data.value;
        
        console.log(`ESP ${espId} data: ${data.value.toFixed(2)} (${espStatus[espId].valid ? 'valid' : 'invalid'})`);
      } else {
        // Invalid data but keep the connection status
        espStatus[espId].valid = false;
        espStatus[espId].value = null;
        
        console.log(`ESP ${espId} invalid data`);
      }
    }
    
    // Notify state change if StateManager exists
    if (window.StateManager && typeof window.StateManager.stateFromESPStatus === 'function') {
      window.StateManager.stateFromESPStatus(espStatus);
    }
    
    // Emit ESP status change event
    if (window.EventBus) {
      window.EventBus.emit('espStatusChanged', espStatus);
    }
  } catch (err) {
    console.error('Error processing ESP event:', err);
  }
}

// Also replace the setupTimeoutCheck function with this version:

// Check for ESP timeouts
function setupTimeoutCheck() {
  try {
    // Increase this value for more stable connections
    const timeoutInterval = 10000; // 10 seconds
    
    setInterval(() => {
      try {
        const now = Date.now();
        
        // Check each ESP individually for timeout
        let stateChanged = false;
        
        // Use individual ESP timeouts if available
        if (window.lastESPActivityTimes) {
          for (const [espId, status] of Object.entries(espStatus)) {
            const lastActivity = window.lastESPActivityTimes[espId] || 0;
            const timeSinceLastActivity = now - lastActivity;
            
            // Only timeout if this specific ESP hasn't sent data
            if (status.connected && timeSinceLastActivity > timeoutInterval) {
              console.log(`ESP32 ${espId} timeout detected - ${timeSinceLastActivity}ms since last activity`);
              status.connected = false;
              status.valid = false;
              status.value = null;
              stateChanged = true;
            }
          }
        } 
        // Fallback to global timeout
        else {
          const timeSinceLastActivity = now - window.lastESP32ActivityTime;
          
          // Only timeout all ESPs if we haven't received any data at all
          if (timeSinceLastActivity > timeoutInterval) {
            console.log(`Global ESP32 timeout detected - ${timeSinceLastActivity}ms since last activity`);
            
            // Check each connected ESP and mark as disconnected
            for (const [espId, status] of Object.entries(espStatus)) {
              if (status.connected) {
                status.connected = false;
                status.valid = false;
                status.value = null;
                stateChanged = true;
              }
            }
          }
        }
        
        // If any state changed, notify
        if (stateChanged) {
          if (window.EventBus) {
            window.EventBus.emit('espStatusChanged', espStatus);
          }
          
          if (window.StateManager && typeof window.StateManager.stateFromESPStatus === 'function') {
            window.StateManager.stateFromESPStatus(espStatus);
          }
        }
      } catch (err) {
        console.error('Error in ESP timeout check:', err);
      }
    }, 1000); // Check every second
  } catch (err) {
    console.error('Error setting up ESP timeout check:', err);
  }
}