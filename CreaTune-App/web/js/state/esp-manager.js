// esp-manager.js
// Manages ESP32 device connections and data for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  console.log('ESPManager initializing...');
  
  // Import configuration
  const { ESP32 } = window.CreaTuneConfig || {
    ESP32: {
      ESP1: { name: 'ESP32-1', sensor: 'soil' },
      ESP2: { name: 'ESP32-2', sensor: 'light' },
      ESP3: { name: 'ESP32-3', sensor: 'temperature' }
    }
  };
  
  // ESP status tracking
  const espStatus = {
    esp1: { connected: false, valid: false, value: null, name: ESP32.ESP1?.name || 'ESP32-1' },
    esp2: { connected: false, valid: false, value: null, name: ESP32.ESP2?.name || 'ESP32-2' },
    esp3: { connected: false, valid: false, value: null, name: ESP32.ESP3?.name || 'ESP32-3' }
  };
  
  // Time of last ESP32 activity for timeout detection
  window.lastESP32ActivityTime = Date.now();
  
  // Listen for simulator events
  function setupSimulatorListener() {
    console.log('Setting up ESP simulator event listener');
    
    document.addEventListener('espEvent', (event) => {
      try {
        const data = event.detail;
        console.log('ESPManager received esp event:', data);
        
        // Process ESP event locally first
        processESPEvent(data);
        
        // Forward to WebSocket server if connected
        if (window.serverSocket && window.serverSocket.readyState === WebSocket.OPEN) {
          console.log('Forwarding ESP event to server:', data);
          window.serverSocket.send(JSON.stringify(data));
        } else {
          console.warn('WebSocket not connected, cannot forward ESP event');
          
          // If server not available, update UI based on local state
          if (window.StateManager && window.StateManager.updateUIForState) {
            window.StateManager.updateUIForState(
              window.StateManager.getState(),
              espStatus
            );
          }
        }
      } catch (err) {
        console.error('Error processing ESP simulator event:', err);
      }
    });
  }
  
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
      
      // Update last activity time
      window.lastESP32ActivityTime = Date.now();
      
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
          espStatus[espId].connected = true;
          
          // Check if value is in valid range (0.4 to 0.8)
          const validRange = { min: 0.4, max: 0.8 };
          espStatus[espId].valid = data.value >= validRange.min && data.value <= validRange.max;
          espStatus[espId].value = data.value;
          
          console.log(`ESP ${espId} data: ${data.value.toFixed(2)} (${espStatus[espId].valid ? 'valid' : 'invalid'})`);
        } else {
          // Invalid data
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
  
  // Process state update from server
  function processStateUpdate(serverState) {
    try {
      // Update local ESP status based on server state
      for (const [espId, status] of Object.entries(serverState)) {
        if (espStatus[espId]) {
          espStatus[espId].connected = status.connected;
          espStatus[espId].valid = status.valid;
          espStatus[espId].value = status.value;
        }
      }
      
      // Emit ESP status change event
      if (window.EventBus) {
        window.EventBus.emit('espStatusChanged', espStatus);
      }
    } catch (err) {
      console.error('Error processing state update from server:', err);
    }
  }
  
  // Check for ESP timeouts
  function setupTimeoutCheck() {
    try {
      const timeoutInterval = 6000; // 6 seconds (slightly longer than server timeout)
      
      setInterval(() => {
        try {
          const now = Date.now();
          const timeSinceLastActivity = now - window.lastESP32ActivityTime;
          
          // Check if we haven't heard from any ESP32 for too long
          if (timeSinceLastActivity > timeoutInterval) {
            // Check each connected ESP and mark as disconnected if timeout
            let stateChanged = false;
            
            for (const [espId, status] of Object.entries(espStatus)) {
              if (status.connected) {
                console.log(`ESP32 ${espId} timeout detected`);
                status.connected = false;
                status.valid = false;
                status.value = null;
                stateChanged = true;
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
          }
        } catch (err) {
          console.error('Error in ESP timeout check:', err);
        }
      }, 1000); // Check every second
    } catch (err) {
      console.error('Error setting up ESP timeout check:', err);
    }
  }
  
  // Initialize
  function initialize() {
    try {
      setupSimulatorListener();
      setupTimeoutCheck();
      
      // Listen for state updates from server
      if (window.EventBus) {
        window.EventBus.subscribe('serverStateUpdate', (data) => {
          processStateUpdate(data.state);
        });
      }
      
      console.log('ESPManager initialized');
    } catch (err) {
      console.error('Error initializing ESPManager:', err);
    }
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.ESPManager = {
    // Get current ESP status
    getESPStatus: () => ({...espStatus}),
    
    // Get a specific ESP status
    getESP: (espId) => espStatus[espId] ? {...espStatus[espId]} : null,
    
    // Check if specific ESP is connected
    isESPConnected: (espId) => espStatus[espId] ? espStatus[espId].connected : false,
    
    // Check if specific ESP has valid data
    isESPValid: (espId) => espStatus[espId] ? (espStatus[espId].connected && espStatus[espId].valid) : false,
    
    // Get ESP value
    getESPValue: (espId) => espStatus[espId] ? espStatus[espId].value : null,
    
    // Process ESP event manually (for testing)
    processESPEvent,
    
    // Update timestamp to prevent timeouts
    updateActivityTimestamp: () => {
      window.lastESP32ActivityTime = Date.now();
    }
  };
  
  console.log('ESPManager API exposed to window');
});