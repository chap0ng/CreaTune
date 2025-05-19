// state-manager.js
// Core state management for CreaTune application

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { STATES, SUB_STATES } = window.CreaTuneConfig;

  // Current state
  let currentState = STATES.IDLE;
  let currentSubState = SUB_STATES.NORMAL;
  
  // DOM elements
  const container = document.getElementById('spriteContainer');
  const sprite = document.getElementById('sprite');

  // Initialize the state manager
  function initialize() {
    // Set initial state
    updateState();
    
    // Listen for ESP events from WebSocket
    document.addEventListener('espEvent', (e) => {
      // Delegate to ESP Manager
      if (window.ESPManager) {
        window.ESPManager.handleWebSocketMessage(e.detail);
      }
    });

    // Subscribe to ESP status changes
    EventBus.subscribe('espStatusChanged', () => {
      updateState();
    });
    
    console.log('State Manager initialized');
  }
  
  // Update the application state based on ESP32 connections
  function updateState() {
    if (!window.ESPManager) return;
    
    const espStatus = window.ESPManager.getESPStatus();
    
    // Determine state based on connected ESP32 devices
    if (espStatus.esp1.connected && espStatus.esp2.connected && espStatus.esp3.connected) {
      currentState = STATES.TOTAL;
    } else if (espStatus.esp2.connected && espStatus.esp3.connected) {
      currentState = STATES.FLOWER;
    } else if (espStatus.esp1.connected && espStatus.esp3.connected) {
      currentState = STATES.MIRRAGE;
    } else if (espStatus.esp1.connected && espStatus.esp2.connected) {
      currentState = STATES.GROWTH;
    } else if (espStatus.esp3.connected) {
      currentState = STATES.TEMP;
    } else if (espStatus.esp2.connected) {
      currentState = STATES.LIGHT;
    } else if (espStatus.esp1.connected) {
      currentState = STATES.SOIL;
    } else {
      currentState = STATES.IDLE;
    }
    
    // Update UI
    if (window.BackgroundManager) {
      window.BackgroundManager.updateBackground(currentState);
    }
    
    if (window.CreatureManager) {
      window.CreatureManager.updateCreatures(currentState, espStatus);
    }
    
    if (window.SynthEngine) {
      window.SynthEngine.updateSynths(currentState, espStatus);
    }
    
    if (window.UIManager) {
      window.UIManager.updateStatusIndicators(currentState, espStatus);
    }
    
    // Dispatch state change event
    EventBus.emit('stateChanged', { 
      state: currentState, 
      subState: currentSubState,
      espStatus: espStatus
    });
    
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
      currentSubState = SUB_STATES[subState];
      
      // Emit event
      EventBus.emit('subStateChanged', { 
        state: currentState, 
        subState: currentSubState
      });
      
      return true;
    }
    return false;
  }
  
  // Handle container clicks for recording
  function setupContainerInteractions() {
    // Don't set up if container doesn't exist or handlers already set
    if (!container || container._interactionsInitialized) return;
    
    container.addEventListener('click', (e) => {
      // Don't trigger recording if we're in BPM mode
      if (currentSubState === SUB_STATES.BPM) return;
      
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
        document.getElementById('randomSynthButton')
      ];
      
      if (controlElements.some(el => el && (el === e.target || el.contains(e.target)))) return;
      
      // Check if any ESP32 is connected and valid
      if (!window.ESPManager) return;
      const espStatus = window.ESPManager.getESPStatus();
      const anySynthActive = Object.values(espStatus).some(esp => esp.connected && esp.valid);
      
      if (!anySynthActive) return;
      
      // Toggle record state
      if (currentSubState === SUB_STATES.RECORD) {
        // Stop recording
        setSubState('NORMAL');
        if (window.RecordingManager) {
          window.RecordingManager.stopRecording();
        }
      } else {
        // Start recording
        setSubState('RECORD');
        if (window.RecordingManager) {
          window.RecordingManager.startRecording();
        }
      }
    });
    
    // Mark as initialized to prevent duplicate handlers
    container._interactionsInitialized = true;
  }
  
  // Start initialization
  initialize();
  setupContainerInteractions();
  
  // Add cleanup for page unload
  window.addEventListener('beforeunload', function() {
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
    updateState: updateState
  };
});
