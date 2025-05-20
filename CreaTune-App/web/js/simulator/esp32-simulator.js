// esp32-simulator.js
// Enhanced ESP32 simulator for CreaTune state testing

document.addEventListener('DOMContentLoaded', () => {
  console.log('Enhanced ESP32 Simulator initializing...');

  // Define application states
  const APP_STATES = {
    IDLE: { name: 'Idle', description: 'No ESP32 connected' },
    SOIL: { name: 'Soil', description: 'ESP32-1 Soil Sensor' },
    LIGHT: { name: 'Light', description: 'ESP32-2 Light Sensor' },
    TEMP: { name: 'Temperature', description: 'ESP32-3 Temperature Sensor' },
    GROWTH: { name: 'Growth', description: 'Soil + Light Sensors' },
    MIRRAGE: { name: 'Mirrage', description: 'Soil + Temperature Sensors' },
    FLOWER: { name: 'Flower', description: 'Light + Temperature Sensors' },
    TOTAL: { name: 'Total', description: 'All Sensors Connected' }
  };

  // Create simulator UI
  function createSimulatorUI() {
    // Main container
    const simContainer = document.createElement('div');
    simContainer.id = 'esp32-simulator';
    simContainer.className = 'esp32-simulator';
    
    // Title
    const title = document.createElement('div');
    title.className = 'simulator-title';
    title.textContent = 'ESP32 Simulator';
    simContainer.appendChild(title);
    
    // States list
    const statesContainer = document.createElement('div');
    statesContainer.className = 'states-container';
    
    // Add each state as a button
    Object.entries(APP_STATES).forEach(([stateKey, state]) => {
      const stateButton = document.createElement('button');
      stateButton.className = 'state-button';
      stateButton.dataset.state = stateKey;
      stateButton.textContent = state.name;
      stateButton.title = state.description;
      stateButton.addEventListener('click', () => activateState(stateKey));
      statesContainer.appendChild(stateButton);
    });
    
    simContainer.appendChild(statesContainer);
    
    // Divider
    const divider = document.createElement('div');
    divider.className = 'simulator-divider';
    simContainer.appendChild(divider);
    
    // ESP32 devices
    const devices = [
      { id: 'esp1', name: 'ESP32-1', sensor: 'soil', color: '#8B735A' },
      { id: 'esp2', name: 'ESP32-2', sensor: 'light', color: '#DFBE5F' },
      { id: 'esp3', name: 'ESP32-3', sensor: 'temp', color: '#D67B54' }
    ];
    
    // Device controls
    const devicesContainer = document.createElement('div');
    devicesContainer.className = 'devices-container';
    
    // Create controls for each device
    devices.forEach(device => {
      const deviceControl = createDeviceControl(device);
      devicesContainer.appendChild(deviceControl);
    });
    
    simContainer.appendChild(devicesContainer);
    
    // Random values and random state buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    
    const randomValuesButton = document.createElement('button');
    randomValuesButton.className = 'simulator-button random-button';
    randomValuesButton.textContent = 'Random Values';
    randomValuesButton.addEventListener('click', generateRandomValues);
    buttonContainer.appendChild(randomValuesButton);
    
    const randomStateButton = document.createElement('button');
    randomStateButton.className = 'simulator-button random-state-button';
    randomStateButton.textContent = 'Random State';
    randomStateButton.addEventListener('click', activateRandomState);
    buttonContainer.appendChild(randomStateButton);
    
    simContainer.appendChild(buttonContainer);
    
    // Add toggle button (to expand/collapse the simulator)
    const toggleButton = document.createElement('button');
    toggleButton.id = 'simulator-toggle';
    toggleButton.className = 'simulator-toggle';
    toggleButton.innerHTML = '<span>ESP32</span>';
    toggleButton.addEventListener('click', toggleSimulator);
    
    // Add to the document
    document.body.appendChild(simContainer);
    document.body.appendChild(toggleButton);
    
    // Initially collapsed
    simContainer.classList.add('collapsed');
  }
  
  // Create control for a single ESP32 device
  function createDeviceControl(device) {
    const control = document.createElement('div');
    control.className = 'device-control';
    control.id = `${device.id}-control`;
    control.style.setProperty('--device-color', device.color);
    
    // Status indicator
    const status = document.createElement('div');
    status.className = 'device-status';
    status.id = `${device.id}-status`;
    
    // Status LED
    const statusLED = document.createElement('div');
    statusLED.className = 'status-led disconnected';
    statusLED.id = `${device.id}-led`;
    status.appendChild(statusLED);
    
    // Device name
    const name = document.createElement('div');
    name.className = 'device-name';
    name.textContent = `${device.name} (${device.sensor})`;
    status.appendChild(name);
    
    control.appendChild(status);
    
    // Control buttons
    const buttons = document.createElement('div');
    buttons.className = 'device-buttons';
    
    // Connect/Disconnect button
    const connectButton = document.createElement('button');
    connectButton.className = 'simulator-button connect-button';
    connectButton.textContent = 'Connect';
    connectButton.dataset.device = device.id;
    connectButton.id = `${device.id}-connect`;
    connectButton.addEventListener('click', toggleConnection);
    buttons.appendChild(connectButton);
    
    // Value slider (only shown when connected)
    const valueContainer = document.createElement('div');
    valueContainer.className = 'value-container';
    valueContainer.id = `${device.id}-value-container`;
    valueContainer.style.display = 'none';
    
    const valueSlider = document.createElement('input');
    valueSlider.type = 'range';
    valueSlider.min = '0';
    valueSlider.max = '100';
    valueSlider.value = '50';
    valueSlider.className = 'value-slider';
    valueSlider.id = `${device.id}-slider`;
    valueSlider.dataset.device = device.id;
    valueSlider.addEventListener('input', updateValue);
    
    const valueLabel = document.createElement('span');
    valueLabel.className = 'value-label';
    valueLabel.id = `${device.id}-value`;
    valueLabel.textContent = '50%';
    
    valueContainer.appendChild(valueSlider);
    valueContainer.appendChild(valueLabel);
    buttons.appendChild(valueContainer);
    
    // Valid/Invalid toggle
    const validToggle = document.createElement('button');
    validToggle.className = 'simulator-button valid-button active';
    validToggle.textContent = 'Valid';
    validToggle.dataset.device = device.id;
    validToggle.dataset.valid = 'true';
    validToggle.id = `${device.id}-valid`;
    validToggle.style.display = 'none';
    validToggle.addEventListener('click', toggleValidity);
    buttons.appendChild(validToggle);
    
    control.appendChild(buttons);
    
    return control;
  }
  
  // Toggle device connection
  function toggleConnection(e) {
    const deviceId = e.target.dataset.device;
    const button = e.target;
    const led = document.getElementById(`${deviceId}-led`);
    const valueContainer = document.getElementById(`${deviceId}-value-container`);
    const validButton = document.getElementById(`${deviceId}-valid`);
    
    if (button.textContent === 'Connect') {
      // Connect device
      button.textContent = 'Disconnect';
      button.classList.add('active');
      led.className = 'status-led valid';
      valueContainer.style.display = 'flex';
      validButton.style.display = 'block';
      
      // Send connect event
      sendESP32Event(deviceId, true);
    } else {
      // Disconnect device
      button.textContent = 'Connect';
      button.classList.remove('active');
      led.className = 'status-led disconnected';
      valueContainer.style.display = 'none';
      validButton.style.display = 'none';
      
      // Send disconnect event
      sendESP32Event(deviceId, false);
    }
    
    // Update state button highlights
    updateStateButtonHighlights();
  }
  
  // Toggle data validity
  function toggleValidity(e) {
    const deviceId = e.target.dataset.device;
    const button = e.target;
    const led = document.getElementById(`${deviceId}-led`);
    
    if (button.dataset.valid === 'true') {
      // Make invalid
      button.textContent = 'Invalid';
      button.dataset.valid = 'false';
      button.classList.remove('active');
      led.className = 'status-led invalid';
      
      // Send invalid data event
      sendESP32DataEvent(deviceId, null);
    } else {
      // Make valid
      button.textContent = 'Valid';
      button.dataset.valid = 'true';
      button.classList.add('active');
      led.className = 'status-led valid';
      
      // Send valid data event with current slider value
      const slider = document.getElementById(`${deviceId}-slider`);
      const value = parseInt(slider.value) / 100;
      sendESP32DataEvent(deviceId, value);
    }
    
    // Update state button highlights
    updateStateButtonHighlights();
  }
  
  // Update sensor value from slider
  function updateValue(e) {
    const deviceId = e.target.dataset.device;
    const value = parseInt(e.target.value);
    const valueLabel = document.getElementById(`${deviceId}-value`);
    valueLabel.textContent = `${value}%`;
    
    // Check if device is in valid state
    const validButton = document.getElementById(`${deviceId}-valid`);
    if (validButton && validButton.dataset.valid === 'true') {
      // Send valid data event
      sendESP32DataEvent(deviceId, value / 100);
    }
  }
  
  // Generate random values for all connected ESP32 devices
  function generateRandomValues() {
    const devices = ['esp1', 'esp2', 'esp3'];
    
    devices.forEach(deviceId => {
      const connectButton = document.getElementById(`${deviceId}-connect`);
      const validButton = document.getElementById(`${deviceId}-valid`);
      
      // Only update if device is connected
      if (connectButton && connectButton.textContent === 'Disconnect') {
        const slider = document.getElementById(`${deviceId}-slider`);
        const valueLabel = document.getElementById(`${deviceId}-value`);
        
        // Generate random value
        const randomValue = Math.floor(Math.random() * 101);
        slider.value = randomValue;
        valueLabel.textContent = `${randomValue}%`;
        
        // Check if device is in valid state
        if (validButton && validButton.dataset.valid === 'true') {
          // Send valid data event
          sendESP32DataEvent(deviceId, randomValue / 100);
        }
      }
    });
  }
  
  // Activate a specific predefined state
  function activateState(stateKey) {
    // Reset all devices first
    disconnectAllDevices();
    
    // Connect and validate devices based on the selected state
    switch(stateKey) {
      case 'IDLE':
        // No devices connected
        break;
        
      case 'SOIL':
        connectDevice('esp1', true);
        break;
        
      case 'LIGHT':
        connectDevice('esp2', true);
        break;
        
      case 'TEMP':
        connectDevice('esp3', true);
        break;
        
      case 'GROWTH':
        connectDevice('esp1', true);
        connectDevice('esp2', true);
        break;
        
      case 'MIRRAGE':
        connectDevice('esp1', true);
        connectDevice('esp3', true);
        break;
        
      case 'FLOWER':
        connectDevice('esp2', true);
        connectDevice('esp3', true);
        break;
        
      case 'TOTAL':
        connectDevice('esp1', true);
        connectDevice('esp2', true);
        connectDevice('esp3', true);
        break;
    }
    
    // Generate random values for connected devices
    generateRandomValues();
    
    // Update state button highlights
    updateStateButtonHighlights();
    
    // Show notification
    showNotification(`Activated state: ${APP_STATES[stateKey].name}`);
  }
  
  // Activate a random state
  function activateRandomState() {
    const states = Object.keys(APP_STATES);
    const randomIndex = Math.floor(Math.random() * states.length);
    const randomState = states[randomIndex];
    
    activateState(randomState);
  }
  
  // Connect a device with optional validation
  function connectDevice(deviceId, isValid = true) {
    const connectButton = document.getElementById(`${deviceId}-connect`);
    if (!connectButton) return;
    
    // Only if device is not already connected
    if (connectButton.textContent === 'Connect') {
      // Simulate clicking the connect button
      connectButton.click();
      
      // Set validity if needed
      if (!isValid) {
        const validButton = document.getElementById(`${deviceId}-valid`);
        if (validButton && validButton.dataset.valid === 'true') {
          validButton.click();
        }
      }
    } else {
      // Device already connected, just set validity
      const validButton = document.getElementById(`${deviceId}-valid`);
      if (validButton) {
        const isCurrentlyValid = validButton.dataset.valid === 'true';
        if (isCurrentlyValid !== isValid) {
          validButton.click();
        }
      }
    }
  }
  
  // Disconnect all devices
  function disconnectAllDevices() {
    ['esp1', 'esp2', 'esp3'].forEach(deviceId => {
      const connectButton = document.getElementById(`${deviceId}-connect`);
      if (connectButton && connectButton.textContent === 'Disconnect') {
        connectButton.click();
      }
    });
  }
  
  // Update state button highlights
  function updateStateButtonHighlights() {
    // Get current connection status
    const esp1Connected = isDeviceConnected('esp1');
    const esp2Connected = isDeviceConnected('esp2');
    const esp3Connected = isDeviceConnected('esp3');
    
    // Get validity status
    const esp1Valid = isDeviceValid('esp1');
    const esp2Valid = isDeviceValid('esp2');
    const esp3Valid = isDeviceValid('esp3');
    
    // Determine which state is active
    let activeState = 'IDLE';
    
    if (esp1Connected && esp2Connected && esp3Connected) {
      activeState = 'TOTAL';
    } else if (esp2Connected && esp3Connected) {
      activeState = 'FLOWER';
    } else if (esp1Connected && esp3Connected) {
      activeState = 'MIRRAGE';
    } else if (esp1Connected && esp2Connected) {
      activeState = 'GROWTH';
    } else if (esp3Connected) {
      activeState = 'TEMP';
    } else if (esp2Connected) {
      activeState = 'LIGHT';
    } else if (esp1Connected) {
      activeState = 'SOIL';
    }
    
    // Update button highlighting
    document.querySelectorAll('.state-button').forEach(button => {
      button.classList.remove('active');
      button.classList.remove('semi-active');
      
      if (button.dataset.state === activeState) {
        // Check if all relevant sensors are valid
        let allValid = true;
        
        switch(activeState) {
          case 'SOIL':
            allValid = esp1Valid;
            break;
          case 'LIGHT':
            allValid = esp2Valid;
            break;
          case 'TEMP':
            allValid = esp3Valid;
            break;
          case 'GROWTH':
            allValid = esp1Valid && esp2Valid;
            break;
          case 'MIRRAGE':
            allValid = esp1Valid && esp3Valid;
            break;
          case 'FLOWER':
            allValid = esp2Valid && esp3Valid;
            break;
          case 'TOTAL':
            allValid = esp1Valid && esp2Valid && esp3Valid;
            break;
        }
        
        if (allValid) {
          button.classList.add('active');
        } else {
          button.classList.add('semi-active');
        }
      }
    });
  }
  
  // Check if device is connected
  function isDeviceConnected(deviceId) {
    const connectButton = document.getElementById(`${deviceId}-connect`);
    return connectButton && connectButton.textContent === 'Disconnect';
  }
  
  // Check if device is valid
  function isDeviceValid(deviceId) {
    if (!isDeviceConnected(deviceId)) return false;
    
    const validButton = document.getElementById(`${deviceId}-valid`);
    return validButton && validButton.dataset.valid === 'true';
  }
  
  // Toggle simulator visibility
  function toggleSimulator() {
    const simulator = document.getElementById('esp32-simulator');
    simulator.classList.toggle('collapsed');
    
    // Update toggle button text
    const toggleButton = document.getElementById('simulator-toggle');
    if (simulator.classList.contains('collapsed')) {
      toggleButton.innerHTML = '<span>ESP32</span>';
    } else {
      toggleButton.innerHTML = '<span>×</span>';
    }
  }
  
  // Show notification
  function showNotification(message, duration = 2000) {
    let notification = document.getElementById('simulator-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'simulator-notification';
      notification.className = 'simulator-notification';
      document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.classList.add('active');
    
    // Remove after duration
    setTimeout(() => {
      notification.classList.remove('active');
    }, duration);
  }
  
  // Send connect/disconnect event for ESP32 device
  function sendESP32Event(deviceId, isConnected) {
    // Map ESP IDs to sensor types
    const sensorType = {
      'esp1': 'soil',
      'esp2': 'light',
      'esp3': 'temperature'
    }[deviceId];
    
    // Map ESP IDs to ESP names
    const espName = {
      'esp1': 'ESP32-1',
      'esp2': 'ESP32-2',
      'esp3': 'ESP32-3'
    }[deviceId];
    
    // Create and dispatch event
    const event = new CustomEvent('espEvent', {
      detail: {
        type: isConnected ? 'esp_connected' : 'esp_disconnected',
        name: espName,
        sensor: sensorType
      }
    });
    
    document.dispatchEvent(event);
    console.log(`ESP32 Simulator: ${isConnected ? 'Connected' : 'Disconnected'} ${espName}`);
  }
  
  // Send sensor data event for ESP32 device
  function sendESP32DataEvent(deviceId, value) {
    // Map ESP IDs to sensor types
    const sensorType = {
      'esp1': 'soil',
      'esp2': 'light',
      'esp3': 'temperature'
    }[deviceId];
    
    // Map ESP IDs to ESP names
    const espName = {
      'esp1': 'ESP32-1',
      'esp2': 'ESP32-2',
      'esp3': 'ESP32-3'
    }[deviceId];
    
    // Create and dispatch event
    const event = new CustomEvent('espEvent', {
      detail: {
        type: 'sensor_data',
        sensor: sensorType,
        name: espName,
        value: value
      }
    });
    
    document.dispatchEvent(event);
    console.log(`ESP32 Simulator: Sent ${sensorType} data: ${value !== null ? value.toFixed(2) : 'invalid'}`);
  }
  
  // Initialize simulator
  createSimulatorUI();
  
  // Expose API
  window.ESP32Simulator = {
    sendESP32Event,
    sendESP32DataEvent,
    generateRandomValues,
    activateState,
    activateRandomState
  };
});
