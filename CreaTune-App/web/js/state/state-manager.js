// state-manager-fix.js
// Core state management for CreaTune application

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

  // Initialize the state manager
  function initialize() {
    console.log('Initializing state manager...');
    
    // Set initial state
    updateState();
    
    // Listen for ESP events from WebSocket
    document.addEventListener('espEvent', (e) => {
      console.log('Received ESP event:', e.detail);
      // Delegate to ESP Manager
      if (window.ESPManager) {
        window.ESPManager.handleWebSocketMessage(e.detail);
      }
    });

    // Subscribe to ESP status changes
    if (window.EventBus) {
      window.EventBus.subscribe('espStatusChanged', (status) => {
        console.log('ESP status changed:', status);
        updateState();
      });
      
      // Listen for app initialization
      window.EventBus.subscribe('appInitialized', () => {
        console.log('App initialized, updating state');
        setTimeout(updateState, 300);
      });
    } else {
      console.error('EventBus not available for StateManager');
    }
    
    console.log('State Manager initialized');
  }
  
  // Update the application state based on ESP32 connections
  function updateState() {
    if (!window.ESPManager) {
      console.warn('ESPManager not available, cannot update state');
      return;
    }
    
    const espStatus = window.ESPManager.getESPStatus();
    console.log('Current ESP status:', espStatus);
    
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
    if (newState !== currentState) {
      console.log(`State changing from ${currentState} to ${newState}`);
      currentState = newState;
      
      // Update UI elements based on the new state
      updateUIForState(currentState, espStatus);
    } else {
      // Update UI elements anyway in case ESP validities changed
      updateUIForState(currentState, espStatus);
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
    
    // Also keep the legacy custom event for backward compatibility
    const event = new CustomEvent('stateChange', { 
      detail: { 
        state: currentState, 
        subState: currentSubState,
        espStatus: espStatus
      } 
    });
    document.dispatchEvent(event);
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
      
      // Check if any ESP32 is connected and valid
      if (!window.ESPManager) {
        console.warn('ESPManager not available, cannot check ESP status');
        return;
      }
      
      const espStatus = window.ESPManager.getESPStatus();
      const anySynthActive = Object.values(espStatus).some(esp => esp.connected && esp.valid);
      
      if (!anySynthActive) {
        console.log('No valid ESP32 devices connected, ignoring click');
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
  
  // Manually trigger state update
  function forceStateUpdate() {
    console.log('Forcing state update');
    if (window.ESPManager) {
      const espStatus = window.ESPManager.getESPStatus();
      updateUIForState(currentState, espStatus);
    }
  }
  
  // Start initialization
  initialize();
  setupContainerInteractions();
  
  // Add cleanup for page unload
  window.addEventListener('beforeunload', function() {
    console.log('Cleaning up state manager');
    
    // Clean up event listeners if possible
    const espEventListeners = document.listeners?.filter(l => l.type === 'espEvent');
    if (espEventListeners) {
      espEventListeners.forEach(listener => {
        document.removeEventListener('espEvent', listener.callback);
      });
    }
    
    // Clear event bus
    if (window.EventBus) {
      window.EventBus.clear();
    }
    
    console.log('State manager cleanup completed');
  });
  
  // Expose API
  window.StateManager = {
    getState: () => currentState,
    getSubState: () => currentSubState,
    setSubState: setSubState,
    updateState: updateState,
    forceStateUpdate: forceStateUpdate
  };
  
  console.log('StateManager API exposed to window');
});
