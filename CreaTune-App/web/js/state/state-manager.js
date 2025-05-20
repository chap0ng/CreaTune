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
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle state update
        if (data.type === 'state_update') {
          console.log('Received state update:', data.state);
          updateStateFromServer(data.state);
        }
        
        // Handle ESP32 connection status
        if (data.type === 'esp_connected') {
          console.log(`ESP32 connected: ${data.name}`);
        }
        
        // Handle ESP32 disconnection
        if (data.type === 'esp_disconnected') {
          console.log(`ESP32 disconnected: ${data.name}`);
        }
        
        // Handle sensor data - crucial for synth triggering
        if (data.type === 'sensor_data') {
          console.log(`Sensor data from ${data.name}: ${data.value}`);
          
          // Start Tone.js context if not already started
          if (Tone && Tone.context.state !== 'running') {
            Tone.start();
          }
          
          // Directly update synth parameters based on sensor data
          if (window.SynthEngine && data.value >= 0.4 && data.value <= 0.8) {
            // Ensure audio is initialized
            if (!window.SynthEngine.isInitialized()) {
              window.SynthEngine.init();
            }
            
            // Determine which synth to trigger based on sensor
            window.SynthEngine.triggerSynthFromValue(data.value);
            
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
              window.CreatureManager.pulseCreature(`creature${creatureNum}`);
            }
          }
        }
      } catch (err) {
        console.error('Error processing websocket message:', err);
      }
    };
    
    socket.onclose = () => {
      console.log('Disconnected from server');
      
      // Retry connection after 2 seconds
      setTimeout(setupWebsocketEvents, 2000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
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
  
  // Update UI elements based on current state
  function updateUIForState(state, espStatus) {
    // Update background if manager exists
    if (window.BackgroundManager) {
      console.log('Updating background for state:', state);
      window.BackgroundManager.updateBackground(state);
    }
    
    // Update creatures if manager exists
    if (window.CreatureManager) {
      console.log('Updating creatures for state:', state);
      window.CreatureManager.updateCreatures(state, espStatus);
    }
    
    // Update synths if engine exists
    if (window.SynthEngine) {
      console.log('Updating synths for state:', state);
      window.SynthEngine.updateSynths(state, espStatus);
    }
    
    // Update status indicators if UI manager exists
    if (window.UIManager) {
      console.log('Updating UI for state:', state);
      window.UIManager.updateStatusIndicators(state, espStatus);
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
        document.getElementById('espStatusPanel'),
        document.getElementById('randomSynthButton'),
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
    console.log('State manager initialized');
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.StateManager = {
    getState: () => currentState,
    getSubState: () => currentSubState,
    setSubState: setSubState
  };
});