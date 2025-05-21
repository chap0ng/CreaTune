// state-manager.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('StateManager initializing...');
  
  // Import configuration
  const { STATES, SUB_STATES } = window.CreaTuneConfig || {
    STATES: {
      IDLE: 'idle',
      SOIL: 'soil',
      LIGHT: 'light',
      TEMP: 'temp',
      GROWTH: 'growth',
      MIRRAGE: 'mirrage',
      FLOWER: 'flower',
      TOTAL: 'total'
    },
    SUB_STATES: {
      NORMAL: 'normal',
      RECORD: 'record',
      BPM: 'bpm'
    }
  };

  // Current state
  let currentState = STATES.IDLE;
  let currentSubState = SUB_STATES.NORMAL;
  
  // DOM elements
  const container = document.getElementById('spriteContainer');
  const sprite = document.getElementById('sprite');

  // Handle socket events from the server
  function setupWebsocketEvents() {
    const socket = new WebSocket(`ws://${window.location.host}`);
    
    socket.onopen = () => {
      console.log('Connected to server');
      
      // Identify as web client
      socket.send(JSON.stringify({
        type: 'hello',
        client: 'WebUI'
      }));
      
      // Update connection status UI if available
      if (window.UIManager && window.UIManager.updateConnectionStatus) {
        window.UIManager.updateConnectionStatus(true);
      }
      
      // Notify listeners
      if (window.EventBus) {
        window.EventBus.emit('websocketConnected', true);
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle state update
        if (data.type === 'state_update') {
          console.log('Received state update:', data.state);
          
          // Emit event for ESPManager to process
          if (window.EventBus) {
            window.EventBus.emit('serverStateUpdate', { state: data.state });
          }
          
          // Update state based on server data
          updateStateFromServer(data.state);
        }
        
        // Handle ESP32 connection status
        if (data.type === 'esp_connected') {
          console.log(`ESP32 connected: ${data.name}`);
          // No need to do anything here, the state update will handle this
        }
        
        // Handle ESP32 disconnection
        if (data.type === 'esp_disconnected') {
          console.log(`ESP32 disconnected: ${data.name}`);
          // No need to do anything here, the state update will handle this
        }
        
        // Handle sensor data - crucial for synth triggering
        if (data.type === 'sensor_data') {
          console.log(`Sensor data from ${data.name}: ${data.value}`);
          
          // Update last activity time
          if (window.lastESP32ActivityTime) {
            window.lastESP32ActivityTime = Date.now();
          }
          
          // Update individual ESP activity time
          if (window.lastESPActivityTimes) {
            let espId = null;
            if (data.name === 'ESP32-1' || data.sensor === 'soil') {
              espId = 'esp1';
            } else if (data.name === 'ESP32-2' || data.sensor === 'light') {
              espId = 'esp2';
            } else if (data.name === 'ESP32-3' || data.sensor === 'temperature') {
              espId = 'esp3';
            }
            
            if (espId) {
              window.lastESPActivityTimes[espId] = Date.now();
            }
          }
          
          // Start Tone.js context if not already started
          if (Tone && Tone.context && Tone.context.state !== 'running') {
            try {
              Tone.start();
            } catch (err) {
              console.error('Error starting Tone.js context:', err);
            }
          }
          
          // Only trigger synth if data is valid
          if (window.SynthEngine && data.value >= 0.4 && data.value <= 0.8) {
            // Ensure audio is initialized
            if (!window.SynthEngine.isInitialized()) {
              try {
                window.SynthEngine.init();
              } catch (err) {
                console.error('Error initializing SynthEngine:', err);
              }
            }
            
            // Determine which synth to trigger based on sensor
            try {
              window.SynthEngine.triggerSynthFromValue(data.value);
            } catch (err) {
              console.error('Error triggering synth:', err);
            }
            
            // Pulse the creature for visual feedback
            let creatureNum = 0;
            if (data.name === 'ESP32-1' || data.sensor === 'soil') {
              creatureNum = 1;
            } else if (data.name === 'ESP32-2' || data.sensor === 'light') {
              creatureNum = 2;
            } else if (data.name === 'ESP32-3' || data.sensor === 'temperature') {
              creatureNum = 3;
            }
            
            if (creatureNum > 0 && window.CreatureManager) {
              try {
                window.CreatureManager.pulseCreature(`creature${creatureNum}`);
              } catch (err) {
                console.error('Error pulsing creature:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error processing websocket message:', err);
      }
    };
    
    socket.onclose = () => {
      console.log('Disconnected from server');
      
      // Update connection status UI if available
      if (window.UIManager && window.UIManager.updateConnectionStatus) {
        window.UIManager.updateConnectionStatus(false);
      }
      
      // Notify listeners
      if (window.EventBus) {
        window.EventBus.emit('websocketConnected', false);
      }
      
      // Retry connection after 2 seconds
      setTimeout(setupWebsocketEvents, 2000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      
      // Update connection status UI if available
      if (window.UIManager && window.UIManager.updateConnectionStatus) {
        window.UIManager.updateConnectionStatus(false);
      }
      
      // Notify listeners
      if (window.EventBus) {
        window.EventBus.emit('websocketConnected', false);
      }
    };
    
    // Store socket for other components
    window.serverSocket = socket;
  }
  
  // Update state based on server data
  function updateStateFromServer(serverState) {
    // Determine state based on connected ESP32 devices
    let newState;
    
    if (serverState.esp1.connected && serverState.esp2.connected && serverState.esp3.connected) {
      newState = STATES.TOTAL;
    } else if (serverState.esp2.connected && serverState.esp3.connected) {
      newState = STATES.FLOWER;
    } else if (serverState.esp1.connected && serverState.esp3.connected) {
      newState = STATES.MIRRAGE;
    } else if (serverState.esp1.connected && serverState.esp2.connected) {
      newState = STATES.GROWTH;
    } else if (serverState.esp3.connected) {
      newState = STATES.TEMP;
    } else if (serverState.esp2.connected) {
      newState = STATES.LIGHT;
    } else if (serverState.esp1.connected) {
      newState = STATES.SOIL;
    } else {
      newState = STATES.IDLE;
    }
    
    // Only update if state has changed
    if (newState !== currentState) {
      console.log(`State changing from ${currentState} to ${newState}`);
      currentState = newState;
      
      // Update UI elements based on the new state
      updateUIForState(currentState, serverState);
    } else {
      // Update UI elements anyway in case validities changed
      updateUIForState(currentState, serverState);
    }
  }
  
  // Determine state based on ESP status
  function stateFromESPStatus(espStatus) {
    // Store previous state for comparison
    const previousState = currentState;
    
    // Determine state based on connected ESP32 devices
    let newState;
    
    if (espStatus.esp1.connected && espStatus.esp2.connected && espStatus.esp3.connected) {
      newState = STATES.TOTAL;
    } else if (espStatus.esp2.connected && espStatus.esp3.connected) {
      newState = STATES.FLOWER;
    } else if (espStatus.esp1.connected && espStatus.esp3.connected) {
      newState = STATES.MIRRAGE;
    } else if (espStatus.esp1.connected && espStatus.esp2.connected) {
      newState = STATES.GROWTH;
    } else if (espStatus.esp3.connected) {
      newState = STATES.TEMP;
    } else if (espStatus.esp2.connected) {
      newState = STATES.LIGHT;
    } else if (espStatus.esp1.connected) {
      newState = STATES.SOIL;
    } else {
      newState = STATES.IDLE;
    }
    
    // Only update if state has changed
    if (newState !== previousState) {
      console.log(`State changing from ${previousState} to ${newState}`);
      currentState = newState;
      
      // Update UI elements based on the new state
      updateUIForState(currentState, espStatus);
    } else if (previousState !== STATES.IDLE) {
      // Update UI elements even if the state hasn't changed
      // but only if we're not in IDLE state, to ensure all visual updates happen
      updateUIForState(currentState, espStatus);
    }
  }
  
  // Update UI elements based on current state
  function updateUIForState(state, espStatus) {
    // Update background if manager exists
    if (window.BackgroundManager) {
      console.log('Updating background for state:', state);
      try {
        window.BackgroundManager.updateBackground(state);
      } catch (err) {
        console.error('Error updating background:', err);
      }
    }
    
    // Update creatures if manager exists
    if (window.CreatureManager) {
      console.log('Updating creatures for state:', state);
      try {
        window.CreatureManager.updateCreatures(state, espStatus);
      } catch (err) {
        console.error('Error updating creatures:', err);
      }
    }
    
    // Update synths if engine exists
    if (window.SynthEngine) {
      console.log('Updating synths for state:', state);
      try {
        window.SynthEngine.updateSynths(state, espStatus);
      } catch (err) {
        console.error('Error updating synths:', err);
      }
    }
    
    // Update status indicators if UI manager exists
    if (window.UIManager) {
      console.log('Updating UI for state:', state);
      try {
        window.UIManager.updateStatusIndicators(state, espStatus);
      } catch (err) {
        console.error('Error updating UI:', err);
      }
    }
    
    // Dispatch state change event
    if (window.EventBus) {
      console.log('Emitting stateChanged event');
      window.EventBus.emit('stateChanged', { 
        state: currentState, 
        subState: currentSubState,
        espStatus: espStatus
      });
    }
  }
  
  // Change the current sub-state
  function setSubState(subState) {
    if (SUB_STATES[subState]) {
      console.log(`Changing sub-state from ${currentSubState} to ${SUB_STATES[subState]}`);
      currentSubState = SUB_STATES[subState];
      
      // Emit event if EventBus exists
      if (window.EventBus) {
        window.EventBus.emit('subStateChanged', { 
          state: currentState, 
          subState: currentSubState
        });
      }
      
      return true;
    }
    return false;
  }
  
  // Get state display for debugging
  function getStateDisplay() {
    let result = `Current State: ${currentState.toUpperCase()}\n`;
    result += `Sub-State: ${currentSubState}\n\n`;
    
    // Add ESP status if available
    if (window.ESPManager) {
      const espStatus = window.ESPManager.getESPStatus();
      
      result += 'ESP Status:\n';
      
      for (const [espId, status] of Object.entries(espStatus)) {
        const connected = status.connected ? '✓' : '✗';
        const valid = status.valid ? '✓' : '✗';
        const value = status.value !== null ? status.value.toFixed(2) : 'null';
        
        result += `${espId}: Connected: ${connected}, Valid: ${valid}, Value: ${value}\n`;
      }
    }
    
    return result;
  }
  
  // Handle container clicks for recording
  function setupContainerInteractions() {
    // Don't set up if container doesn't exist or handlers already set
    if (!container || container._interactionsInitialized) {
      console.warn('Container not available or already initialized');
      return;
    }
    
    console.log('Setting up container interactions');
    
    container.addEventListener('click', (e) => {
      // Don't trigger recording if we're in BPM mode
      if (currentSubState === SUB_STATES.BPM) {
        console.log('In BPM mode, ignoring click for recording');
        return;
      }
      
      // Don't trigger if clicking on a control element
      const controlElements = [
        document.getElementById('dragHandle'),
        document.getElementById('handleOverlay'),
        document.getElementById('topTab'),
        document.getElementById('frameCoverLeft'),
        document.getElementById('frameCoverRight'),
        document.getElementById('frameCoverTop'),
        document.getElementById('debugStateButton'),
        document.getElementById('debugButton'),
        document.getElementById('espStatusPanel'),
        document.getElementById('randomSynthButton'),
        document.getElementById('randomStateButton'),
        document.getElementById('bpmSliderContainer')
      ];
      
      if (controlElements.some(el => el && (el === e.target || el.contains(e.target)))) {
        console.log('Clicked on control element, ignoring for recording');
        return;
      }
      
      // Toggle record state
      if (currentSubState === SUB_STATES.RECORD) {
        // Stop recording
        console.log('Stopping recording');
        setSubState('NORMAL');
        if (window.RecordingManager) {
          window.RecordingManager.stopRecording();
        }
      } else {
        // Start recording
        console.log('Starting recording');
        setSubState('RECORD');
        if (window.RecordingManager) {
          window.RecordingManager.startRecording();
        }
      }
    });
    
    // Mark as initialized to prevent duplicate handlers
    container._interactionsInitialized = true;
    console.log('Container interactions setup complete');
  }
  
  // Initialize
  function initialize() {
    setupWebsocketEvents();
    setupContainerInteractions();
    
    // Add an event listener for ESP status changes
    if (window.EventBus) {
      window.EventBus.subscribe('espStatusChanged', (status) => {
        stateFromESPStatus(status);
      });
    }
    
    console.log('State manager initialized');
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.StateManager = {
    getState: () => currentState,
    getSubState: () => currentSubState,
    setSubState: setSubState,
    updateUIForState: updateUIForState,
    stateFromESPStatus: stateFromESPStatus,
    getStateDisplay: getStateDisplay // Add the new function
  };
});