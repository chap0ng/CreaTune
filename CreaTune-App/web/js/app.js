// Add this to app.js to provide a debug console:

// Add debug button for state inspection
function setupDebugButton() {
  const debugButton = document.createElement('button');
  debugButton.id = 'debugButton';
  debugButton.textContent = '🔍';
  debugButton.title = 'Debug State';
  debugButton.style.position = 'fixed';
  debugButton.style.bottom = '150px';
  debugButton.style.right = '10px';
  debugButton.style.width = '40px';
  debugButton.style.height = '40px';
  debugButton.style.borderRadius = '50%';
  debugButton.style.backgroundColor = '#666';
  debugButton.style.color = 'white';
  debugButton.style.fontSize = '20px';
  debugButton.style.border = 'none';
  debugButton.style.cursor = 'pointer';
  debugButton.style.zIndex = '1000';
  debugButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
  debugButton.style.webkitTapHighlightColor = 'transparent';
  
  debugButton.addEventListener('click', () => {
    showDebugConsole();
  });
  
  document.body.appendChild(debugButton);
}

// Show debug console with current state info
function showDebugConsole() {
  // Create or get debug console
  let debugConsole = document.getElementById('debugConsole');
  
  if (!debugConsole) {
    debugConsole = document.createElement('div');
    debugConsole.id = 'debugConsole';
    debugConsole.style.position = 'fixed';
    debugConsole.style.top = '50%';
    debugConsole.style.left = '50%';
    debugConsole.style.transform = 'translate(-50%, -50%)';
    debugConsole.style.width = '80%';
    debugConsole.style.maxWidth = '600px';
    debugConsole.style.maxHeight = '80%';
    debugConsole.style.overflowY = 'auto';
    debugConsole.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    debugConsole.style.color = '#0f0';
    debugConsole.style.padding = '20px';
    debugConsole.style.borderRadius = '10px';
    debugConsole.style.fontFamily = 'monospace';
    debugConsole.style.fontSize = '14px';
    debugConsole.style.zIndex = '2000';
    debugConsole.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'white';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0';
    closeButton.style.lineHeight = '1';
    closeButton.style.webkitTapHighlightColor = 'transparent';
    closeButton.addEventListener('click', () => {
      document.body.removeChild(debugConsole);
    });
    
    debugConsole.appendChild(closeButton);
    
    // Add content container
    const content = document.createElement('pre');
    content.id = 'debugContent';
    content.style.margin = '0';
    content.style.whiteSpace = 'pre-wrap';
    debugConsole.appendChild(content);
    
    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.textContent = 'Refresh';
    refreshButton.style.marginTop = '20px';
    refreshButton.style.padding = '5px 10px';
    refreshButton.style.backgroundColor = '#333';
    refreshButton.style.color = 'white';
    refreshButton.style.border = 'none';
    refreshButton.style.borderRadius = '4px';
    refreshButton.style.cursor = 'pointer';
    refreshButton.style.webkitTapHighlightColor = 'transparent';
    refreshButton.addEventListener('click', () => {
      updateDebugContent();
    });
    
    debugConsole.appendChild(refreshButton);
    
    // Add send test data button
    const testDataButton = document.createElement('button');
    testDataButton.textContent = 'Send Test Data';
    testDataButton.style.marginTop = '20px';
    testDataButton.style.marginLeft = '10px';
    testDataButton.style.padding = '5px 10px';
    testDataButton.style.backgroundColor = '#336699';
    testDataButton.style.color = 'white';
    testDataButton.style.border = 'none';
    testDataButton.style.borderRadius = '4px';
    testDataButton.style.cursor = 'pointer';
    testDataButton.style.webkitTapHighlightColor = 'transparent';
    testDataButton.addEventListener('click', () => {
      sendTestData();
    });
    
    debugConsole.appendChild(testDataButton);
    
    document.body.appendChild(debugConsole);
  }
  
  updateDebugContent();
}

// Update debug console content
function updateDebugContent() {
  const content = document.getElementById('debugContent');
  if (!content) return;
  
  let debugInfo = '';
  
  // Get state information
  if (window.StateManager) {
    if (window.StateManager.getStateDisplay) {
      debugInfo += window.StateManager.getStateDisplay();
    } else {
      debugInfo += `Current State: ${window.StateManager.getState()}\n`;
      debugInfo += `Sub-State: ${window.StateManager.getSubState()}\n\n`;
    }
  } else {
    debugInfo += 'StateManager not available\n\n';
  }
  
  // ESP Manager info
  if (window.ESPManager) {
    debugInfo += 'ESP Manager Status:\n';
    const espStatus = window.ESPManager.getESPStatus();
    debugInfo += JSON.stringify(espStatus, null, 2) + '\n\n';
  } else {
    debugInfo += 'ESPManager not available\n\n';
  }
  
  // Audio info
  if (window.SynthEngine) {
    debugInfo += 'Synth Engine Status:\n';
    debugInfo += `Initialized: ${window.SynthEngine.isInitialized()}\n`;
    debugInfo += `Active State: ${JSON.stringify(window.SynthEngine.getState())}\n`;
    debugInfo += `BPM: ${window.SynthEngine.getBPM()}\n\n`;
  } else {
    debugInfo += 'SynthEngine not available\n\n';
  }
  
  // WebSocket status
  if (window.serverSocket) {
    debugInfo += 'WebSocket Status:\n';
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    debugInfo += `State: ${states[window.serverSocket.readyState]}\n\n`;
  } else {
    debugInfo += 'WebSocket not available\n\n';
  }
  
  // Audio context status
  if (window.Tone && window.Tone.context) {
    debugInfo += 'Audio Context Status:\n';
    debugInfo += `State: ${window.Tone.context.state}\n`;
    debugInfo += `Sample Rate: ${window.Tone.context.sampleRate}\n`;
  } else {
    debugInfo += 'Tone.js not available\n\n';
  }
  
  // Last activity time
  if (window.lastESP32ActivityTime) {
    const timeSince = Date.now() - window.lastESP32ActivityTime;
    debugInfo += `\nLast ESP32 Activity: ${timeSince}ms ago\n`;
  }
  
  if (window.lastESPActivityTimes) {
    debugInfo += 'Individual ESP Activity Times:\n';
    for (const [espId, time] of Object.entries(window.lastESPActivityTimes)) {
      if (time) {
        const timeSince = Date.now() - time;
        debugInfo += `${espId}: ${timeSince}ms ago\n`;
      }
    }
  }
  
  content.textContent = debugInfo;
}

// Send test data to all ESPs
function sendTestData() {
  if (window.ESPManager && window.ESPManager.processESPEvent) {
    // Send valid data for all ESPs
    window.ESPManager.processESPEvent({ 
      type: 'sensor_data', 
      name: 'ESP32-1', 
      sensor: 'soil', 
      value: 0.6 
    });
    
    window.ESPManager.processESPEvent({ 
      type: 'sensor_data', 
      name: 'ESP32-2', 
      sensor: 'light', 
      value: 0.6 
    });
    
    window.ESPManager.processESPEvent({ 
      type: 'sensor_data', 
      name: 'ESP32-3', 
      sensor: 'temperature', 
      value: 0.6 
    });
    
    // Update debug view
    updateDebugContent();
    
    // Show notification
    if (window.UIManager) {
      window.UIManager.showInfoMessage('Test data sent to all ESPs');
    }
  } else {
    console.error('ESPManager not available to send test data');
  }
}

// Call this in your app.js initialization
setupDebugButton();