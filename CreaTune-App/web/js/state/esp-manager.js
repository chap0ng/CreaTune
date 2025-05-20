// esp-manager.js
// ESP32 device management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  console.log('ESP Manager initializing...');
  
  // Import configuration
  const { ESP32 } = window.CreaTuneConfig || {
    ESP32: {
      ESP1: {
        name: 'ESP32-1',
        sensor: 'soil',
        description: 'Soil Moisture Sensor',
        validRange: { min: 0.4, max: 0.8 }
      },
      ESP2: {
        name: 'ESP32-2',
        sensor: 'light',
        description: 'Light Sensor',
        validRange: { min: 0.4, max: 0.8 }
      },
      ESP3: {
        name: 'ESP32-3',
        sensor: 'temperature',
        description: 'Temperature Sensor',
        validRange: { min: 0.4, max: 0.8 }
      }
    }
  };
  
  // ESP status
  const espStatus = {
    esp1: { connected: false, valid: false, value: null, lastActive: 0 },
    esp2: { connected: false, valid: false, value: null, lastActive: 0 },
    esp3: { connected: false, valid: false, value: null, lastActive: 0 }
  };
  
  // Sensor name to ESP ID mapping for faster lookups
  const sensorMapping = {
    'soil': 'esp1',
    'light': 'esp2',
    'temperature': 'esp3',
    'MoistureSensor': 'esp1',  // Also handle the esp-specific names
    'ESP32-1': 'esp1',
    'ESP32-2': 'esp2',
    'ESP32-3': 'esp3'
  };
  
  // Track reconnection status
  let reconnecting = false;

  // Process WebSocket messages about ESP32 devices
  function processWebSocketMessage(data) {
    if (!data) return;
    
    try {
      // Different types of messages
      switch (data.type) {
        case 'sensor_data':
          handleSensorData(data);
          break;
          
        case 'esp_connected':
          handleESPConnection(data);
          break;
          
        case 'esp_disconnected':
          handleESPDisconnection(data);
          break;
          
        case 'state_update':
          if (data.state) {
            handleStateUpdate(data.state);
          }
          break;
      }
      
      // Update lastESP32ActivityTime if we have any valid ESP32 activity
      if ((data.type === 'sensor_data' || data.type === 'esp_connected') && 
          window.lastESP32ActivityTime !== undefined) {
        window.lastESP32ActivityTime = Date.now();
      }
      
    } catch (err) {
      console.error('Error processing ESP32 message:', err);
    }
  }
  
  // Handle sensor data from ESP32
  function handleSensorData(data) {
    // Determine which ESP this is
    let espId = getESPIdFromSensorData(data);
    if (!espId) return;
    
    // Update connection status
    espStatus[espId].connected = true;
    espStatus[espId].lastActive = Date.now();
    
    // Get the sensor value
    let value = data.value;
    
    // Handle different formats from moisture sensor
    if (value === undefined || value === null) {
      // Try to get the value from moisture_app_value or voltage
      value = data.moisture_app_value || data.voltage;
    }
    
    // Check if value is valid
    const validRange = getValidRangeForESP(espId);
    const isValid = value !== undefined && 
                    value !== null && 
                    value >= validRange.min && 
                    value <= validRange.max;
    
    // Update status
    espStatus[espId].value = value;
    espStatus[espId].valid = isValid;
    
    // Log the update
    console.log(`ESP32 [${espId}] data: ${value} (${isValid ? 'valid' : 'invalid'})`);
    
    // If we have a SynthEngine, ensure audio is started
    if (window.SynthEngine && isValid) {
      window.SynthEngine.ensureAudioStarted();
      
      // Trigger a sound based on the sensor value
      if (window.SynthEngine.isAudioReady()) {
        window.SynthEngine.triggerSynthFromValue(value);
      }
    }
    
    // Emit event about the update
    EventBus.emit('espUpdated', {
      espId: espId,
      data: data,
      valid: isValid,
      value: value,
      status: { ...espStatus }
    });
  }
  
  // Handle ESP connection event
  function handleESPConnection(data) {
    // Determine which ESP this is
    let espId = getESPIdFromName(data.name);
    if (!espId) return;
    
    // Update status
    espStatus[espId].connected = true;
    espStatus[espId].lastActive = Date.now();
    
    // Check if this is a reconnection
    if (data.reconnected) {
      reconnecting = true;
      console.log(`ESP32 [${espId}] reconnected`);
      
      // Show notification if UI manager exists
      if (window.UIManager) {
        window.UIManager.showInfoMessage(`ESP32 ${data.name} reconnected`, 3000);
      }
      
      // Ensure audio is initialized for reconnection
      if (window.SynthEngine) {
        window.SynthEngine.ensureAudioStarted();
      }
    } else {
      console.log(`ESP32 [${espId}] connected`);
    }
    
    // Emit event about the connection
    EventBus.emit('espConnected', {
      espId: espId,
      name: data.name,
      reconnected: data.reconnected || false,
      status: { ...espStatus }
    });
  }
  
  // Handle ESP disconnection event
  function handleESPDisconnection(data) {
    // Determine which ESP this is
    let espId = getESPIdFromName(data.name);
    if (!espId) return;
    
    // Update status
    espStatus[espId].connected = false;
    espStatus[espId].valid = false;
    espStatus[espId].value = null;
    
    console.log(`ESP32 [${espId}] disconnected`);
    
    // Force immediate creature and synth updates
    if (window.CreatureManager) {
      window.CreatureManager.stopAnimation(`creature${espId.charAt(3)}`);
    }
    
    if (window.SynthEngine) {
      window.SynthEngine.setButtonState(parseInt(espId.charAt(3)), false);
    }
    
    // Emit event about the disconnection
    EventBus.emit('espDisconnected', {
      espId: espId,
      name: data.name,
      status: { ...espStatus }
    });
  }
  
  // Handle state update event
  function handleStateUpdate(state) {
    // Update our internal state from the server state
    for (const [key, value] of Object.entries(state)) {
      if (espStatus[key]) {
        espStatus[key].connected = value.connected;
        espStatus[key].valid = value.valid;
        espStatus[key].value = value.value;
      }
    }
    
    // Emit event about the state update
    EventBus.emit('espStateUpdate', {
      state: state,
      status: { ...espStatus }
    });
  }
  
  // Get ESP ID from sensor data
  function getESPIdFromSensorData(data) {
    if (!data) return null;
    
    // Check known mappings first
    if (data.sensor && sensorMapping[data.sensor]) {
      return sensorMapping[data.sensor];
    }
    
    if (data.name && sensorMapping[data.name]) {
      return sensorMapping[data.name];
    }
    
    // Special case for MoistureSensor
    if (data.sensor === 'MoistureSensor' || data.sensor === 'moisture') {
      return 'esp1';
    }
    
    // Try to guess based on patterns
    const sensorType = data.sensor || '';
    const nameType = data.name || '';
    
    if (sensorType.includes('soil') || nameType.includes('soil') || 
        sensorType.includes('moisture') || nameType.includes('moisture') ||
        nameType.includes('ESP32-1')) {
      return 'esp1';
    }
    
    if (sensorType.includes('light') || nameType.includes('light') ||
        nameType.includes('ESP32-2')) {
      return 'esp2';
    }
    
    if (sensorType.includes('temp') || nameType.includes('temp') ||
        nameType.includes('ESP32-3')) {
      return 'esp3';
    }
    
    // Default to esp1 if we can't determine
    return 'esp1';
  }
  
  // Get ESP ID from device name
  function getESPIdFromName(name) {
    if (!name) return null;
    
    // Check known mappings first
    if (sensorMapping[name]) {
      return sensorMapping[name];
    }
    
    // Try to guess based on patterns
    if (name.includes('1') || name.includes('soil') || name.includes('moisture')) {
      return 'esp1';
    }
    
    if (name.includes('2') || name.includes('light')) {
      return 'esp2';
    }
    
    if (name.includes('3') || name.includes('temp')) {
      return 'esp3';
    }
    
    // Default to esp1 if we can't determine
    return 'esp1';
  }
  
  // Get valid range for an ESP
  function getValidRangeForESP(espId) {
    switch (espId) {
      case 'esp1':
        return ESP32.ESP1.validRange;
      case 'esp2':
        return ESP32.ESP2.validRange;
      case 'esp3':
        return ESP32.ESP3.validRange;
      default:
        return { min: 0.4, max: 0.8 }; // Default range
    }
  }
  
  // Check if all ESP32s are disconnected
  function areAllESPsDisconnected() {
    return !espStatus.esp1.connected && 
           !espStatus.esp2.connected && 
           !espStatus.esp3.connected;
  }
  
  // Initialize ESP Manager
  function initialize() {
    // Set up WebSocket event listeners
    if (window.EventBus) {
      // Listen for WebSocket messages from state-manager
      window.EventBus.subscribe('webSocketMessage', (data) => {
        processWebSocketMessage(data);
      });
      
      // Listen for ESP32 simulator events
      document.addEventListener('espEvent', (event) => {
        if (event.detail) {
          processWebSocketMessage(event.detail);
        }
      });
      
      // Listen for app initialization
      window.EventBus.subscribe('appInitialized', () => {
        console.log('App initialized, setting up ESP32 timeout check');
        setupESP32TimeoutCheck();
      });
    }
  }
  
  // Setup ESP32 timeout check
  function setupESP32TimeoutCheck() {
    // Check if timestamp already exists
    if (window.lastESP32ActivityTime === undefined) {
      window.lastESP32ActivityTime = Date.now();
    }
    
    // Check for ESP32 timeouts every 5 seconds
    const timeoutInterval = setInterval(() => {
      const now = Date.now();
      
      // Check each ESP for timeout
      for (const [espId, status] of Object.entries(espStatus)) {
        if (status.connected && (now - status.lastActive) > 15000) {
          console.log(`ESP32 [${espId}] timed out - no data for 15s`);
          
          // Mark as disconnected
          espStatus[espId].connected = false;
          espStatus[espId].valid = false;
          espStatus[espId].value = null;
          
          // Emit event about the timeout
          EventBus.emit('espDisconnected', {
            espId: espId,
            name: espIdToName(espId),
            timeout: true,
            status: { ...espStatus }
          });
        }
      }
      
      // If all ESPs are disconnected, check if we need to refresh the connection
      if (areAllESPsDisconnected() && (now - window.lastESP32ActivityTime > 15000)) {
        console.log('All ESP32 devices disconnected, checking connection...');
        
        // Try to reconnect the WebSocket
        if (window.StateManager && window.StateManager.reconnectWebSocket) {
          window.StateManager.reconnectWebSocket();
          
          // Reset the timer
          window.lastESP32ActivityTime = now;
        }
      }
    }, 5000);
  }
  
  // Convert ESP ID to name
  function espIdToName(espId) {
    switch (espId) {
      case 'esp1': return ESP32.ESP1.name;
      case 'esp2': return ESP32.ESP2.name;
      case 'esp3': return ESP32.ESP3.name;
      default: return `Unknown ESP (${espId})`;
    }
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.ESPManager = {
    getESPStatus: () => ({ ...espStatus }),
    isESPConnected: (espId) => espStatus[espId] ? espStatus[espId].connected : false,
    isESPValid: (espId) => espStatus[espId] ? (espStatus[espId].connected && espStatus[espId].valid) : false,
    getESPValue: (espId) => espStatus[espId] ? espStatus[espId].value : null,
    areAllESPsDisconnected: areAllESPsDisconnected,
    isReconnecting: () => reconnecting,
    resetReconnectionStatus: () => { reconnecting = false; }
  };
  
  console.log('ESP Manager initialized');
});
