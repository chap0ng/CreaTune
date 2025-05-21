// app.js - Main application script
document.addEventListener('DOMContentLoaded', () => {
  console.log('CreaTune Application Initializing...');
  
  // Set up global error handler for better debugging
  window.addEventListener('error', (event) => {
    console.error('Global error:', event);
    
    // Show error to user if UIManager is available
    if (window.UIManager) {
      // Check if error exists and has message property
      const errorMessage = event.error && event.error.message 
        ? event.error.message 
        : (event.message || 'Unknown error occurred');
      
      window.UIManager.showErrorMessage(`Error: ${errorMessage}`);
    }
  });
  
  // Initialize Tone.js safely
  function initializeToneJS() {
    if (typeof Tone === 'undefined') {
      console.error('Tone.js library not loaded!');
      if (window.UIManager) {
        window.UIManager.showInfoMessage('Tone.js library not loaded. Audio features may not work properly.');
      }
      return false;
    }
    
    try {
      // Set up Tone.js error handling
      Tone.context.onerror = function(e) {
        console.error('Tone.js AudioContext error:', e);
      };
      
      // Check if AudioContext is supported
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.error('AudioContext not supported in this browser');
        if (window.UIManager) {
          window.UIManager.showInfoMessage('Audio features not supported in this browser');
        }
        return false;
      }
      
      // Retry Tone.js initialization if there are issues with the context
      if (Tone.context.state === 'suspended' || Tone.context.state === 'interrupted') {
        console.log('Tone.js context is suspended, trying to resume...');
        // Try to resume on user interaction
        document.body.addEventListener('click', function resumeToneContext() {
          Tone.context.resume().then(() => {
            console.log('Tone.js context resumed successfully');
            document.body.removeEventListener('click', resumeToneContext);
          }).catch(err => {
            console.error('Failed to resume Tone.js context:', err);
          });
        }, { once: false });
      }
      
      console.log('Tone.js initialized successfully');
      return true;
    } catch (err) {
      console.error('Error initializing Tone.js:', err);
      if (window.UIManager) {
        window.UIManager.showInfoMessage(`Audio initialization error: ${err.message}`);
      }
      return false;
    }
  }
  
  // Initialize Tone.js
  initializeToneJS();
  
  // Show ready message when everything is initialized
  EventBus.subscribe('appInitialized', () => {
    console.log('CreaTune Application Initialized');
    
    // Show welcome message
    if (window.UIManager) {
      window.UIManager.showInfoMessage('CreaTune ready. Connect ESP32 devices.', 4000);
    }
  });
  
  // Add test sound button
  const testButton = document.createElement('button');
  testButton.innerText = "Test Sound";
  testButton.style.position = "fixed";
  testButton.style.bottom = "100px"; // Changed to 100px to avoid overlap with random state button
  testButton.style.right = "10px";
  testButton.style.zIndex = "1000";
  testButton.style.padding = "8px";
  testButton.style.background = "#4caf50";
  testButton.style.color = "white";
  testButton.style.border = "none";
  testButton.style.borderRadius = "4px";
  testButton.style.cursor = "pointer";
  
  testButton.onclick = async () => {
    try {
      // Start Tone.js context if needed
      if (Tone && Tone.context && Tone.context.state !== 'running') {
        try {
          await Tone.start();
          console.log('Tone.js context started successfully');
        } catch (err) {
          console.error('Error starting Tone.js context:', err);
          if (window.UIManager) {
            window.UIManager.showInfoMessage('Could not start audio. Try clicking again.');
          }
          return;
        }
      }
      
      // Initialize SynthEngine if needed
      if (window.SynthEngine && !window.SynthEngine.isInitialized()) {
        try {
          await window.SynthEngine.init();
          console.log('SynthEngine initialized successfully');
        } catch (err) {
          console.error('Error initializing SynthEngine:', err);
          if (window.UIManager) {
            window.UIManager.showInfoMessage('Could not initialize synth engine.');
          }
          return;
        }
      }
      
      // Play test sound
      if (window.SynthEngine && window.SynthEngine.triggerSynthFromValue) {
        try {
          window.SynthEngine.triggerSynthFromValue(0.6);
          console.log('Test sound triggered successfully');
        } catch (err) {
          console.error('Error triggering test sound:', err);
          if (window.UIManager) {
            window.UIManager.showInfoMessage('Error playing test sound.');
          }
        }
      } else {
        console.error("SynthEngine not available or missing triggerSynthFromValue method");
        if (window.UIManager) {
          window.UIManager.showInfoMessage('Sound engine not ready.');
        }
      }
    } catch (err) {
      console.error("Error playing test sound:", err);
      if (window.UIManager) {
        window.UIManager.showInfoMessage(`Sound error: ${err.message}`);
      }
    }
  };
  
  document.body.appendChild(testButton);
  
  // Ensure ESPManager is available
  function ensureESPManager() {
    if (!window.ESPManager) {
      console.log('ESPManager not found, creating a minimal version');
      
      // Create a minimal ESPManager if it's not available
      window.ESPManager = {
        espStatus: {
          esp1: { connected: false, valid: false, value: null, name: 'ESP32-1' },
          esp2: { connected: false, valid: false, value: null, name: 'ESP32-2' },
          esp3: { connected: false, valid: false, value: null, name: 'ESP32-3' }
        },
        
        getESPStatus: function() {
          return {...this.espStatus};
        },
        
        processESPEvent: function(data) {
          console.log('Processing ESP event:', data);
          
          // Find which ESP this event is for
          let espId = null;
          
          if (data.name === 'ESP32-1' || data.sensor === 'soil') {
            espId = 'esp1';
          } else if (data.name === 'ESP32-2' || data.sensor === 'light') {
            espId = 'esp2';
          } else if (data.name === 'ESP32-3' || data.sensor === 'temperature') {
            espId = 'esp3';
          }
          
          if (!espId) {
            console.warn('Unknown ESP device:', data.name, data.sensor);
            return;
          }
          
          // Process based on event type
          if (data.type === 'esp_connected') {
            // ESP connected
            this.espStatus[espId].connected = true;
            this.espStatus[espId].valid = false; // Wait for valid data
            console.log(`ESP ${espId} connected`);
          } 
          else if (data.type === 'esp_disconnected') {
            // ESP disconnected
            this.espStatus[espId].connected = false;
            this.espStatus[espId].valid = false;
            this.espStatus[espId].value = null;
            console.log(`ESP ${espId} disconnected`);
          } 
          else if (data.type === 'sensor_data') {
            // Sensor data received
            if (data.value !== undefined && data.value !== null) {
              this.espStatus[espId].connected = true;
              
              // Check if value is in valid range (0.4 to 0.8)
              const validRange = { min: 0.4, max: 0.8 };
              this.espStatus[espId].valid = data.value >= validRange.min && data.value <= validRange.max;
              this.espStatus[espId].value = data.value;
              
              console.log(`ESP ${espId} data: ${data.value.toFixed(2)} (${this.espStatus[espId].valid ? 'valid' : 'invalid'})`);
            } else {
              // Invalid data
              this.espStatus[espId].valid = false;
              this.espStatus[espId].value = null;
              
              console.log(`ESP ${espId} invalid data`);
            }
          }
          
          // Notify state change if StateManager exists
          if (window.StateManager && typeof window.StateManager.stateFromESPStatus === 'function') {
            window.StateManager.stateFromESPStatus(this.espStatus);
          }
          
          // Emit ESP status change event
          if (window.EventBus) {
            window.EventBus.emit('espStatusChanged', this.espStatus);
          }
          
          // Forward to WebSocket server if connected
          if (window.serverSocket && window.serverSocket.readyState === WebSocket.OPEN) {
            console.log('Forwarding ESP event to server:', data);
            window.serverSocket.send(JSON.stringify(data));
          }
        }
      };
      
      // Set up window.lastESP32ActivityTime
      window.lastESP32ActivityTime = Date.now();
      
      return true;
    }
    return false;
  }
  
  // Call to ensure ESPManager is available
  ensureESPManager();
  
  // Add simulator controls
  function setupSimulatorControls() {
    // Create Random State button if it doesn't exist
    if (!document.getElementById('randomStateButton')) {
      const randomStateButton = document.createElement('button');
      randomStateButton.id = 'randomStateButton';
      randomStateButton.textContent = '🔄';
      randomStateButton.title = 'Random State';
      randomStateButton.style.position = 'fixed';
      randomStateButton.style.bottom = '50px';
      randomStateButton.style.right = '10px';
      randomStateButton.style.width = '60px';
      randomStateButton.style.height = '60px';
      randomStateButton.style.borderRadius = '50%';
      randomStateButton.style.backgroundColor = '#4CAF50';
      randomStateButton.style.color = 'white';
      randomStateButton.style.fontSize = '24px';
      randomStateButton.style.border = 'none';
      randomStateButton.style.cursor = 'pointer';
      randomStateButton.style.zIndex = '1000';
      randomStateButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      
      randomStateButton.addEventListener('click', () => {
        // Use simulator to generate random state if available
        if (window.ESP32Simulator && window.ESP32Simulator.activateRandomState) {
          window.ESP32Simulator.activateRandomState();
        } else {
          console.warn('ESP32Simulator not available');
          
          // Fallback: generate random state through ESPManager
          if (window.ESPManager) {
            generateRandomState();
          }
        }
      });
      
      document.body.appendChild(randomStateButton);
    }
  }
  
  // Generate a random state using ESPManager
  function generateRandomState() {
    // Random selection of state (0-7)
    const stateOptions = [
      // Idle - no ESP connected
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-3', sensor: 'temperature' });
      },
      // Soil only
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-1', sensor: 'soil', value: 0.6 });
      },
      // Light only
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-2', sensor: 'light', value: 0.6 });
      },
      // Temperature only
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-3', sensor: 'temperature', value: 0.6 });
      },
      // Growth (soil + light)
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-1', sensor: 'soil', value: 0.6 });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-2', sensor: 'light', value: 0.6 });
      },
      // Mirrage (soil + temp)
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-1', sensor: 'soil', value: 0.6 });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-3', sensor: 'temperature', value: 0.6 });
      },
      // Flower (light + temp)
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_disconnected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-2', sensor: 'light', value: 0.6 });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-3', sensor: 'temperature', value: 0.6 });
      },
      // Total (all 3)
      () => {
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-1', sensor: 'soil' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-2', sensor: 'light' });
        window.ESPManager.processESPEvent({ type: 'esp_connected', name: 'ESP32-3', sensor: 'temperature' });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-1', sensor: 'soil', value: 0.6 });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-2', sensor: 'light', value: 0.6 });
        window.ESPManager.processESPEvent({ type: 'sensor_data', name: 'ESP32-3', sensor: 'temperature', value: 0.6 });
      }
    ];
    
    // Choose a random state
    const randomState = Math.floor(Math.random() * stateOptions.length);
    stateOptions[randomState]();
    
    // Show notification
    if (window.UIManager) {
      const stateNames = ['Idle', 'Soil', 'Light', 'Temperature', 'Growth', 'Mirrage', 'Flower', 'Total'];
      window.UIManager.showInfoMessage(`Random state: ${stateNames[randomState]}`);
    }
  }
  
  // Initialize simulator components
  function initializeSimulator() {
    // Set up simulator controls immediately
    setupSimulatorControls();
    
    // Try to load ESP32 simulator if not already available
    let checkCount = 0;
    const maxChecks = 10;
    
    function checkForSimulator() {
      if (window.ESP32Simulator) {
        console.log('ESP32 Simulator found, ready for testing');
        return true;
      } else if (checkCount < maxChecks) {
        checkCount++;
        console.log(`Waiting for ESP32 Simulator... (attempt ${checkCount}/${maxChecks})`);
        setTimeout(checkForSimulator, 500);
        return false;
      } else {
        console.warn('ESP32 Simulator not available after multiple attempts');
        // Create a fallback if the simulator isn't available
        createFallbackSimulator();
        return false;
      }
    }
    
    // Create a minimal fallback simulator if the real one isn't available
    function createFallbackSimulator() {
      if (!window.ESP32Simulator) {
        console.log('Creating fallback ESP32 Simulator');
        window.ESP32Simulator = {
          activateRandomState: function() {
            if (window.ESPManager && window.ESPManager.processESPEvent) {
              console.log('Using fallback simulator to generate random state');
              generateRandomState();
            } else {
              console.error('ESPManager not available for fallback simulator');
            }
          },
          generateRandomValues: function() {
            console.log('Fallback simulator generating random values');
            generateRandomState();
          }
        };
      }
    }
    
    // Start checking for simulator
    setTimeout(checkForSimulator, 500);
  }
  
  // Call simulator initialization
  initializeSimulator();
  
  // Emit initialization event
  EventBus.emit('appInitialized');
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    // Clean up Tone.js resources if possible
    if (window.Tone && window.Tone.context) {
      try {
        window.Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
      } catch (err) {
        console.error('Error during Tone cleanup:', err);
      }
    }
    
    console.log('Application cleanup complete');
  });
});