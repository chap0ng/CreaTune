// ui-manager.js
// UI management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { STATES } = window.CreaTuneConfig;

  // Create status indicators for ESP32 devices
  function createStatusIndicators() {
    // Check if status panel already exists
    if (document.getElementById('espStatusPanel')) return;
    
    const espStatus = window.ESPManager ? window.ESPManager.getESPStatus() : {};
    const currentState = window.StateManager ? window.StateManager.getState() : STATES.IDLE;
    
    const statusPanel = document.createElement('div');
    statusPanel.id = 'espStatusPanel';
    statusPanel.style.position = 'fixed';
    statusPanel.style.top = '10px';
    statusPanel.style.left = '10px';
    statusPanel.style.zIndex = '1000';
    statusPanel.style.padding = '10px';
    statusPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    statusPanel.style.color = 'white';
    statusPanel.style.borderRadius = '5px';
    statusPanel.style.fontFamily = 'VT323, monospace';
    
    const stateDisplay = document.createElement('div');
    stateDisplay.id = 'stateDisplay';
    stateDisplay.textContent = `State: ${currentState.toUpperCase()}`;
    stateDisplay.style.marginBottom = '10px';
    statusPanel.appendChild(stateDisplay);
    
    // Add indicator for each ESP32
    Object.keys(espStatus).forEach(esp => {
      const indicator = document.createElement('div');
      indicator.id = `${esp}Indicator`;
      indicator.className = 'esp-indicator';
      indicator.innerHTML = `
        <span class="esp-name">${espStatus[esp].name}:</span>
        <span class="esp-status">Disconnected</span>
      `;
      indicator.style.margin = '5px 0';
      indicator.style.display = 'flex';
      indicator.style.justifyContent = 'space-between';
      
      const statusDot = document.createElement('span');
      statusDot.id = `${esp}StatusDot`;
      statusDot.className = 'status-dot';
      statusDot.style.display = 'inline-block';
      statusDot.style.width = '10px';
      statusDot.style.height = '10px';
      statusDot.style.borderRadius = '50%';
      statusDot.style.backgroundColor = 'red';
      statusDot.style.marginLeft = '5px';
      
      indicator.querySelector('.esp-status').appendChild(statusDot);
      statusPanel.appendChild(indicator);
    });
    
    document.body.appendChild(statusPanel);
    
    // Update status immediately
    updateStatusIndicators(currentState, espStatus);
  }
  
  // Update ESP status indicators
  function updateStatusIndicators(currentState, espStatus) {
    // Update state display
    const stateDisplay = document.getElementById('stateDisplay');
    if (stateDisplay) {
      stateDisplay.textContent = `State: ${currentState.toUpperCase()}`;
    }
    
    // Update each ESP indicator
    Object.keys(espStatus).forEach(esp => {
      const indicator = document.getElementById(`${esp}Indicator`);
      const statusDot = document.getElementById(`${esp}StatusDot`);
      const statusText = indicator?.querySelector('.esp-status');
      
      if (indicator && statusDot && statusText) {
        if (espStatus[esp].connected) {
          if (espStatus[esp].valid) {
            statusDot.style.backgroundColor = 'lime';
            const value = espStatus[esp].value !== null ? 
              ` (${Math.round(espStatus[esp].value * 100)}%)` : '';
            statusText.textContent = `Valid${value} `;
          } else {
            statusDot.style.backgroundColor = 'orange';
            statusText.textContent = 'Invalid ';
          }
        } else {
          statusDot.style.backgroundColor = 'red';
          statusText.textContent = 'Disconnected ';
        }
        statusText.appendChild(statusDot);
      }
    });
  }
  
  // Create connection status indicator
  function createConnectionStatus(connected = false) {
    let statusDisplay = document.getElementById('connectionStatus');
    
    if (!statusDisplay) {
      statusDisplay = document.createElement('div');
      statusDisplay.id = 'connectionStatus';
      statusDisplay.style.position = 'fixed';
      statusDisplay.style.bottom = '10px';
      statusDisplay.style.left = '10px';
      statusDisplay.style.padding = '5px 10px';
      statusDisplay.style.borderRadius = '5px';
      statusDisplay.style.fontSize = '14px';
      statusDisplay.style.fontFamily = 'VT323, monospace';
      statusDisplay.style.zIndex = '1000';
      document.body.appendChild(statusDisplay);
    }
    
    updateConnectionStatus(connected);
  }
  
  // Update connection status display
  function updateConnectionStatus(connected) {
    const statusDisplay = document.getElementById('connectionStatus');
    if (!statusDisplay) return;
    
    if (connected) {
      statusDisplay.textContent = '● Connected';
      statusDisplay.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
      statusDisplay.style.color = 'white';
    } else {
      statusDisplay.textContent = '● Disconnected';
      statusDisplay.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      statusDisplay.style.color = 'white';
    }
  }
  
  // Create error message display
  function showErrorMessage(message, duration = 3000) {
    // Create error message element if needed
    let errorEl = document.getElementById('statusMessage');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'statusMessage';
      errorEl.style.position = 'fixed';
      errorEl.style.bottom = '50px';
      errorEl.style.left = '0';
      errorEl.style.width = '100%';
      errorEl.style.textAlign = 'center';
      errorEl.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      errorEl.style.color = 'white';
      errorEl.style.padding = '10px';
      errorEl.style.fontFamily = 'VT323, monospace';
      errorEl.style.zIndex = '1000';
      document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    
    // Hide after specified duration
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, duration);
  }
  
  // Create info message display
  function showInfoMessage(message, duration = 2000) {
    // Create info message element if needed
    let infoEl = document.getElementById('statusMessage');
    if (!infoEl) {
      infoEl = document.createElement('div');
      infoEl.id = 'statusMessage';
      infoEl.style.position = 'fixed';
      infoEl.style.bottom = '50px';
      infoEl.style.left = '0';
      infoEl.style.width = '100%';
      infoEl.style.textAlign = 'center';
      infoEl.style.backgroundColor = 'rgba(0, 128, 255, 0.7)';
      infoEl.style.color = 'white';
      infoEl.style.padding = '10px';
      infoEl.style.fontFamily = 'VT323, monospace';
      infoEl.style.zIndex = '1000';
      document.body.appendChild(infoEl);
    }
    
    infoEl.textContent = message;
    infoEl.style.display = 'block';
    infoEl.style.backgroundColor = 'rgba(0, 128, 255, 0.7)';
    
    // Hide after specified duration
    setTimeout(() => {
      infoEl.style.display = 'none';
    }, duration);
  }
  
  // Create volume meter for recording
  function createVolumeMeter() {
    // Check if volume meter already exists
    if (document.getElementById('volumeMeter')) {
      document.getElementById('volumeMeter').style.display = 'block';
      document.getElementById('meterFill').style.width = '0%';
      return;
    }
    
    const container = document.getElementById('spriteContainer');
    if (!container) return;
    
    const volumeMeter = document.createElement('div');
    volumeMeter.id = 'volumeMeter';
    volumeMeter.style.position = 'absolute';
    volumeMeter.style.bottom = '100px';
    volumeMeter.style.left = '50%';
    volumeMeter.style.transform = 'translateX(-50%)';
    volumeMeter.style.width = '80%';
    volumeMeter.style.height = '10px';
    volumeMeter.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    volumeMeter.style.borderRadius = '5px';
    volumeMeter.style.zIndex = '100';
    volumeMeter.style.overflow = 'hidden';
    
    const meterFill = document.createElement('div');
    meterFill.id = 'meterFill';
    meterFill.style.height = '100%';
    meterFill.style.width = '0%';
    meterFill.style.backgroundColor = 'green';
    meterFill.style.transition = 'width 0.05s';
    
    volumeMeter.appendChild(meterFill);
    container.appendChild(volumeMeter);
  }
  
  // Update volume meter level
  function updateVolumeMeter(level, max = 100) {
    const meterFill = document.getElementById('meterFill');
    if (!meterFill) return;
    
    // Normalize level to percentage
    const percentage = Math.min(100, Math.max(0, (level / max) * 100));
    meterFill.style.width = percentage + '%';
    
    // Change color based on level
    if (percentage > 70) {
      meterFill.style.backgroundColor = 'red';
    } else if (percentage > 40) {
      meterFill.style.backgroundColor = 'orange';
    } else {
      meterFill.style.backgroundColor = 'green';
    }
  }
  
  // Hide volume meter
  function hideVolumeMeter() {
    const volumeMeter = document.getElementById('volumeMeter');
    if (volumeMeter) {
      volumeMeter.style.display = 'none';
    }
  }
  
  // Create BPM Display Overlay
  function createBPMOverlay(visible = false) {
    // Check if overlay already exists
    if (document.getElementById('bpmOverlay')) {
      document.getElementById('bpmOverlay').style.display = visible ? 'flex' : 'none';
      return;
    }
    
    const container = document.getElementById('spriteContainer');
    if (!container) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'bpmOverlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = visible ? 'flex' : 'none';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.color = 'white';
    overlay.style.fontFamily = 'VT323, monospace';
    overlay.style.fontSize = '48px';
    overlay.style.zIndex = '200';
    
    const bpmLabel = document.createElement('div');
    bpmLabel.id = 'bpmLabel';
    bpmLabel.textContent = 'BPM';
    bpmLabel.style.marginBottom = '20px';
    
    const bpmValue = document.createElement('div');
    bpmValue.id = 'bpmDisplayValue';
    bpmValue.textContent = '85';
    bpmValue.style.fontSize = '72px';
    
    const instructions = document.createElement('div');
    instructions.textContent = 'Drag left/right to adjust';
    instructions.style.fontSize = '24px';
    instructions.style.marginTop = '20px';
    
    overlay.appendChild(bpmLabel);
    overlay.appendChild(bpmValue);
    overlay.appendChild(instructions);
    container.appendChild(overlay);
    
    // Add drag handler for BPM adjustment
    let startX = 0;
    let currentBPM = 85;
    
    overlay.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      currentBPM = window.SynthEngine?.getBPM() || 85;
      
      // Add move and up handlers
      document.addEventListener('mousemove', handleBPMDrag);
      document.addEventListener('mouseup', stopBPMDrag);
    });
    
    overlay.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      currentBPM = window.SynthEngine?.getBPM() || 85;
      
      // Add move and end handlers
      document.addEventListener('touchmove', handleBPMTouchDrag);
      document.addEventListener('touchend', stopBPMTouchDrag);
    });
    
    function handleBPMDrag(e) {
      const diffX = e.clientX - startX;
      const newBPM = Math.max(60, Math.min(180, currentBPM + Math.floor(diffX / 2)));
      updateBPMDisplay(newBPM);
    }
    
    function handleBPMTouchDrag(e) {
      const diffX = e.touches[0].clientX - startX;
      const newBPM = Math.max(60, Math.min(180, currentBPM + Math.floor(diffX / 2)));
      updateBPMDisplay(newBPM);
    }
    
    function stopBPMDrag() {
      document.removeEventListener('mousemove', handleBPMDrag);
      document.removeEventListener('mouseup', stopBPMDrag);
    }
    
    function stopBPMTouchDrag() {
      document.removeEventListener('touchmove', handleBPMTouchDrag);
      document.removeEventListener('touchend', stopBPMTouchDrag);
    }
  }
  
  // Update BPM display
  function updateBPMDisplay(bpm) {
    const bpmValue = document.getElementById('bpmDisplayValue');
    if (bpmValue) {
      bpmValue.textContent = bpm;
    }
    
    // Update actual BPM in SynthEngine
    if (window.SynthEngine && window.SynthEngine.setBPM) {
      window.SynthEngine.setBPM(bpm);
    }
  }
  
  // Show/hide BPM overlay
  function toggleBPMOverlay(visible) {
    createBPMOverlay(visible);
  }
  
  // Initialize UI elements
  function initialize() {
    // Create status indicators
    createStatusIndicators();
    
    // Create connection status
    createConnectionStatus(false);
    
    // Listen for WebSocket connection status changes
    EventBus.subscribe('websocketConnected', (connected) => {
      updateConnectionStatus(connected);
    });
    
    // Listen for state changes to update UI
    EventBus.subscribe('stateChanged', ({ state, espStatus }) => {
      updateStatusIndicators(state, espStatus);
    });
    
    // Listen for recording state changes
    EventBus.subscribe('recordingStarted', () => {
      createVolumeMeter();
    });
    
    EventBus.subscribe('recordingStopped', () => {
      hideVolumeMeter();
    });
    
    // Listen for volume update events
    EventBus.subscribe('volumeLevel', (data) => {
      updateVolumeMeter(data.average, data.max);
    });
    
    // Listen for BPM state changes
    EventBus.subscribe('subStateChanged', (data) => {
      if (data.subState === 'BPM') {
        toggleBPMOverlay(true);
      } else {
        toggleBPMOverlay(false);
      }
    });
    
    // Listen for BPM updates
    EventBus.subscribe('bpmChanged', (bpm) => {
      updateBPMDisplay(bpm);
    });
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.UIManager = {
    createStatusIndicators,
    updateStatusIndicators,
    createVolumeMeter,
    updateVolumeMeter,
    hideVolumeMeter,
    showErrorMessage,
    showInfoMessage,
    updateConnectionStatus,
    toggleBPMOverlay,
    updateBPMDisplay
  };
});
