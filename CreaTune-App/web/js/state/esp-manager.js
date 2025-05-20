// esp-manager.js
// ESP32 device management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { ESP32, STATES } = window.CreaTuneConfig;
  
  // ESP32 device status
  const espStatus = {
    esp1: { connected: false, valid: false, value: null, name: ESP32.ESP1.name },
    esp2: { connected: false, valid: false, value: null, name: ESP32.ESP2.name },
    esp3: { connected: false, valid: false, value: null, name: ESP32.ESP3.name }
  };
  
  // Last ESP32 activity timestamp
  let lastESP32ActivityTime = Date.now();
  let ESP32TimeoutCheck;
  
  // Handle WebSocket messages for ESP32 data
  function handleWebSocketMessage(data) {
    // Update activity timestamp to prevent timeout
    lastESP32ActivityTime = Date.now();
    
    // Process ESP32 sensor data
    if (data.sensor) {
      let espId = null;
      
      // Determine which ESP32 sent the data
      if (data.sensor.includes('soil') || data.sensor === ESP32.ESP1.name) {
        espId = 'esp1';
      } else if (data.sensor.includes('light') || data.sensor === ESP32.ESP2.name) {
        espId = 'esp2';
      } else if (data.sensor.includes('temp') || data.sensor === ESP32.ESP3.name) {
        espId = 'esp3';
      }
      
      if (espId) {
        // Update ESP status
        espStatus[espId].connected = true;
        espStatus[espId].value = data.value;
        
        // Validate data - check if it's in the acceptable range (0.4 to 0.8)
        const normalizedValue = data.value;
        espStatus[espId].valid = normalizedValue !== undefined && 
                                  normalizedValue !== null && 
                                  normalizedValue >= 0.4 && 
                                  normalizedValue <= 0.8;
        
        // Initialize audio if not already initialized
        autoInitializeAudio();
        
        // Notify state change
        EventBus.emit('espStatusChanged', { ...espStatus });
        
        // Log data received
        console.log(`ESP32 ${espId} data received:`, normalizedValue);
      }
    }
    
    // Process ESP32 connection status
    if (data.type === 'esp_connected') {
      let espId = null;
      if (data.name === ESP32.ESP1.name || data.name.includes('soil')) {
        espId = 'esp1';
      } else if (data.name === ESP32.ESP2.name || data.name.includes('light')) {
        espId = 'esp2';
      } else if (data.name === ESP32.ESP3.name || data.name.includes('temp')) {
        espId = 'esp3';
      }
      
      if (espId) {
        espStatus[espId].connected = true;
        espStatus[espId].name = data.name;
        
        // Initialize audio if not already initialized
        autoInitializeAudio();
        
        // Notify state change
        EventBus.emit('espStatusChanged', { ...espStatus });
        
        // Log connection
        console.log(`ESP32 ${espId} connected`);
      }
    }
    
    // Process ESP32 disconnection
    if (data.type === 'esp_disconnected') {
      let espId = null;
      if (data.name === ESP32.ESP1.name || data.name.includes('soil')) {
        espId = 'esp1';
      } else if (data.name === ESP32.ESP2.name || data.name.includes('light')) {
        espId = 'esp2';
      } else if (data.name === ESP32.ESP3.name || data.name.includes('temp')) {
        espId = 'esp3';
      }
      
      if (espId) {
        espStatus[espId].connected = false;
        espStatus[espId].valid = false;
        espStatus[espId].value = null;
        
        // Notify state change
        EventBus.emit('espStatusChanged', { ...espStatus });
        
        // Log disconnection
        console.log(`ESP32 ${espId} disconnected`);
      }
    }
  }
  
  // Auto-initialize audio when ESP32 connects
  function autoInitializeAudio() {
    // Check if any ESP32 is connected
    const anyEspConnected = Object.values(espStatus).some(esp => esp.connected);
    
    // If we have an ESP32 connected and audio isn't initialized, start it
    if (anyEspConnected && window.SynthEngine && !window.SynthEngine.isInitialized()) {
      console.log('Auto-initializing audio due to ESP32 connection');
      
      // Initialize with status callback
      window.SynthEngine.init(showAudioStatus);
    }
  }
  
  // Show audio initialization status
  function showAudioStatus(status) {
    if (!status) return;
    
    // Create temporary status message
    let statusEl = document.getElementById('autoInitStatus');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'autoInitStatus';
      statusEl.style.position = 'fixed';
      statusEl.style.bottom = '20px';
      statusEl.style.left = '0';
      statusEl.style.width = '100%';
      statusEl.style.textAlign = 'center';
      statusEl.style.color = 'white';
      statusEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      statusEl.style.padding = '10px';
      statusEl.style.zIndex = '1000';
      statusEl.style.fontFamily = 'VT323, monospace';
      document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = status;
    
    if (status === 'Audio initialized') {
      // Remove status after 2 seconds
      setTimeout(() => {
        if (statusEl && statusEl.parentNode) {
          statusEl.parentNode.removeChild(statusEl);
        }
      }, 2000);
    }
  }
  
  // Create debug random state button (for testing)
  function createDebugButton() {
    const button = document.createElement('button');
    button.id = 'debugStateButton';
    button.textContent = 'Random State';
    button.style.position = 'fixed';
    button.style.bottom = '10px';
    button.style.right = '10px';
    button.style.zIndex = '1000';
    button.style.padding = '8px';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = '#333';
    button.style.color = 'white';
    button.style.cursor = 'pointer';
    
    button.addEventListener('click', () => {
      // Toggle random ESP32 connections
      espStatus.esp1.connected = Math.random() > 0.5;
      espStatus.esp2.connected = Math.random() > 0.5;
      espStatus.esp3.connected = Math.random() > 0.5;
      
      // Set random valid data within the 0.4 to 0.8 range
      if (espStatus.esp1.connected) {
        espStatus.esp1.valid = Math.random() > 0.3;
        espStatus.esp1.value = espStatus.esp1.valid ? (0.4 + Math.random() * 0.4) : (Math.random() * 0.3);
      }
      if (espStatus.esp2.connected) {
        espStatus.esp2.valid = Math.random() > 0.3;
        espStatus.esp2.value = espStatus.esp2.valid ? (0.4 + Math.random() * 0.4) : (Math.random() * 0.3);
      }
      if (espStatus.esp3.connected) {
        espStatus.esp3.valid = Math.random() > 0.3;
        espStatus.esp3.value = espStatus.esp3.valid ? (0.4 + Math.random() * 0.4) : (Math.random() * 0.3);
      }
      
      // Auto-initialize audio if any ESP is connected
      autoInitializeAudio();
      
      // Notify state change
      EventBus.emit('espStatusChanged', { ...espStatus });
      
      // Update activity timestamp
      lastESP32ActivityTime = Date.now();
      
      console.log('Random state generated:', espStatus);
    });
    
    document.body.appendChild(button);
  }

  // Setup ESP32 timeout check
  function setupESP32TimeoutCheck() {
    // Check every 10 seconds if ESP32 is still active
    ESP32TimeoutCheck = setInterval(() => {
      // If ESP32 was connected but no data for 15 seconds
      const anyConnected = Object.values(espStatus).some(esp => esp.connected);
      
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
  
  // Initialize
  function initialize() {
    createDebugButton();
    setupESP32TimeoutCheck();
    
    // If WebSocket client is available, try to connect
    if (window.wsClient && window.wsClient.reconnect) {
      window.wsClient.reconnect();
    }
  }
  
  // Initialize the ESP manager
  initialize();
  
  // Cleanup on window unload
  window.addEventListener('beforeunload', function() {
    if (ESP32TimeoutCheck) {
      clearInterval(ESP32TimeoutCheck);
      ESP32TimeoutCheck = null;
    }
  });
  
  // Expose API
  window.ESPManager = {
    getESPStatus: () => ({ ...espStatus }),
    handleWebSocketMessage: handleWebSocketMessage,
    autoInitializeAudio: autoInitializeAudio
  };
});
