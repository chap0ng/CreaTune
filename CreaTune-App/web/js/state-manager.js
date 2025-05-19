// state-manager.js
// Main state machine for CreaTune application

document.addEventListener('DOMContentLoaded', () => {
  // State machine constants
  const STATES = {
    IDLE: 'idle',
    SOIL: 'soil',
    LIGHT: 'light',
    TEMP: 'temp',
    GROWTH: 'growth',
    MIRRAGE: 'mirrage',
    FLOWER: 'flower',
    TOTAL: 'total'
  };

  const SUB_STATES = {
    NORMAL: 'normal',
    RECORD: 'record',
    BPM: 'bpm'
  };

  // ESP32 device status
  const espStatus = {
    esp1: { connected: false, valid: false, value: null, name: 'ESP32-1' }, // Soil sensor
    esp2: { connected: false, valid: false, value: null, name: 'ESP32-2' }, // Light sensor
    esp3: { connected: false, valid: false, value: null, name: 'ESP32-3' }  // Temperature sensor
  };

  // Current state
  let currentState = STATES.IDLE;
  let currentSubState = SUB_STATES.NORMAL;
  
  // DOM elements
  const container = document.getElementById('spriteContainer');
  const sprite = document.getElementById('sprite');

  // Debug state button (for testing)
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
      
      // Set random valid data
      if (espStatus.esp1.connected) {
        espStatus.esp1.valid = Math.random() > 0.3;
        espStatus.esp1.value = Math.random();
      }
      if (espStatus.esp2.connected) {
        espStatus.esp2.valid = Math.random() > 0.3;
        espStatus.esp2.value = Math.random();
      }
      if (espStatus.esp3.connected) {
        espStatus.esp3.valid = Math.random() > 0.3;
        espStatus.esp3.value = Math.random();
      }
      
      // Auto-initialize audio if any ESP is connected
      autoInitializeAudio();
      
      updateState();
      console.log('Random state:', currentState, espStatus);
    });
    
    document.body.appendChild(button);
  }
  
  // Create status indicators for ESP32 devices
  function createStatusIndicators() {
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
  }
  
  // Update ESP status indicators
  function updateStatusIndicators() {
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
            statusText.textContent = 'Valid ';
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
  
  // Update the application state based on ESP32 connections
  function updateState() {
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
    updateBackground();
    updateCreatures();
    updateSynths();
    updateStatusIndicators();
    
    // Dispatch state change event
    const event = new CustomEvent('stateChange', { 
      detail: { 
        state: currentState, 
        subState: currentSubState,
        espStatus: { ...espStatus }
      } 
    });
    document.dispatchEvent(event);
  }
  
  // Update background based on current state
  function updateBackground() {
    // Remove all state classes first
    Object.values(STATES).forEach(state => {
      sprite.classList.remove(`state-${state}`);
      sprite.classList.remove('no-image');
    });
    
    // Add current state class
    sprite.classList.add(`state-${currentState}`);
    
    // Check if image exists, otherwise add fallback class
    const imgUrl = getStateBackgroundUrl(currentState);
    checkImageExists(imgUrl, function(exists) {
      if (!exists) {
        console.log(`Image not found: ${imgUrl}, using fallback`);
        sprite.classList.add('no-image');
      }
    });
    
    // Only change the background if the sprite animation is not running
    if (!window.spriteAnimation || !window.spriteAnimation.isRunning()) {
      // Select the appropriate sprite frame
      let frameIndex = 0;
      
      switch (currentState) {
        case STATES.IDLE:    frameIndex = 0; break;
        case STATES.SOIL:    frameIndex = 1; break;
        case STATES.LIGHT:   frameIndex = 2; break;
        case STATES.TEMP:    frameIndex = 3; break;
        case STATES.GROWTH:  frameIndex = 4; break;
        case STATES.MIRRAGE: frameIndex = 5; break;
        case STATES.FLOWER:  frameIndex = 6; break;
        case STATES.TOTAL:   frameIndex = 7; break;
      }
      
      // If we have the original showFrame function, use it
      if (window.spriteAnimation && window.spriteAnimation.showFrame) {
        window.spriteAnimation.showFrame(frameIndex);
      } else {
        // Otherwise use our own implementation
        const row = Math.floor(frameIndex / 3);
        const col = frameIndex % 3;
        sprite.style.backgroundPosition = `${col * 50}% ${row * 33.33}%`;
      }
    }
  }
  
  // Get background image URL for the current state
  function getStateBackgroundUrl(state) {
    switch(state) {
      case STATES.IDLE:
        return 'assets/frame-sprite.png'; // Default background
      case STATES.SOIL:
        return 'images/soil.png';
      case STATES.LIGHT:
        return 'images/light.png';
      case STATES.TEMP:
        return 'images/temp.png';
      case STATES.GROWTH:
        return 'images/growth.png';
      case STATES.MIRRAGE:
        return 'images/mirrage.png';
      case STATES.FLOWER:
        return 'images/flower.png';
      case STATES.TOTAL:
        return 'images/total.png';
      default:
        return 'assets/frame-sprite.png';
    }
  }
  
  // Check if an image exists
  function checkImageExists(url, callback) {
    const img = new Image();
    img.onload = function() {
      callback(true);
    };
    img.onerror = function() {
      callback(false);
    };
    img.src = url;
  }
  
  // Update creatures based on current state and valid sensors
  function updateCreatures() {
    // Check if required sensors are valid
    const isValid = {
      soil: espStatus.esp1.connected && espStatus.esp1.valid,
      light: espStatus.esp2.connected && espStatus.esp2.valid,
      temp: espStatus.esp3.connected && espStatus.esp3.valid
    };
    
    // Hide all creatures first
    if (window.creatureManager) {
      for (let i = 1; i <= 7; i++) {
        window.creatureManager.stopAnimation(`creature${i}`);
      }
    }
    
    // Show appropriate creature based on state and valid data
    if (window.creatureManager) {
      switch (currentState) {
        case STATES.SOIL:
          if (isValid.soil) {
            window.creatureManager.animate('creature1');
          }
          break;
        case STATES.LIGHT:
          if (isValid.light) {
            window.creatureManager.animate('creature2');
          }
          break;
        case STATES.TEMP:
          if (isValid.temp) {
            window.creatureManager.animate('creature3');
          }
          break;
        case STATES.GROWTH:
          if (isValid.soil && isValid.light) {
            window.creatureManager.animate('creature4');
          }
          break;
        case STATES.MIRRAGE:
          if (isValid.soil && isValid.temp) {
            window.creatureManager.animate('creature5');
          }
          break;
        case STATES.FLOWER:
          if (isValid.light && isValid.temp) {
            window.creatureManager.animate('creature6');
          }
          break;
        case STATES.TOTAL:
          if (isValid.soil && isValid.light && isValid.temp) {
            window.creatureManager.animate('creature7');
          }
          break;
      }
    }
  }
  
  // Update synths based on current state and valid sensors
  function updateSynths() {
    // Deactivate all synths first
    if (window.synthEngine) {
      window.synthEngine.setButtonState(1, false);
      window.synthEngine.setButtonState(2, false);
      window.synthEngine.setButtonState(3, false);
    }
    
    // Check if required sensors are valid
    const isValid = {
      soil: espStatus.esp1.connected && espStatus.esp1.valid,
      light: espStatus.esp2.connected && espStatus.esp2.valid,
      temp: espStatus.esp3.connected && espStatus.esp3.valid
    };
    
    // Activate appropriate synths based on state and valid data
    if (window.synthEngine) {
      switch (currentState) {
        case STATES.SOIL:
          if (isValid.soil) {
            window.synthEngine.setButtonState(1, true);
          }
          break;
        case STATES.LIGHT:
          if (isValid.light) {
            window.synthEngine.setButtonState(2, true);
          }
          break;
        case STATES.TEMP:
          if (isValid.temp) {
            window.synthEngine.setButtonState(3, true);
          }
          break;
        case STATES.GROWTH:
          if (isValid.soil && isValid.light) {
            window.synthEngine.setButtonState(1, true);
            window.synthEngine.setButtonState(2, true);
          }
          break;
        case STATES.MIRRAGE:
          if (isValid.soil && isValid.temp) {
            window.synthEngine.setButtonState(1, true);
            window.synthEngine.setButtonState(3, true);
          }
          break;
        case STATES.FLOWER:
          if (isValid.light && isValid.temp) {
            window.synthEngine.setButtonState(2, true);
            window.synthEngine.setButtonState(3, true);
          }
          break;
        case STATES.TOTAL:
          if (isValid.soil && isValid.light && isValid.temp) {
            window.synthEngine.setButtonState(1, true);
            window.synthEngine.setButtonState(2, true);
            window.synthEngine.setButtonState(3, true);
          }
          break;
      }
      
      // Update the UI
      if (window.synthUI) {
        window.synthUI.updateVisuals();
      }
    }
  }
  
  // Handle WebSocket messages for ESP32 data
  function handleWebSocketMessage(data) {
    // Process ESP32 sensor data
    if (data.sensor) {
      let espId = null;
      
      // Determine which ESP32 sent the data
      if (data.sensor.includes('soil') || data.sensor === 'ESP32-1') {
        espId = 'esp1';
      } else if (data.sensor.includes('light') || data.sensor === 'ESP32-2') {
        espId = 'esp2';
      } else if (data.sensor.includes('temp') || data.sensor === 'ESP32-3') {
        espId = 'esp3';
      }
      
      if (espId) {
        // Update ESP status
        espStatus[espId].connected = true;
        espStatus[espId].value = data.value;
        
        // Validate data
        espStatus[espId].valid = data.value !== undefined && data.value !== null;
        
        // Initialize audio if not already initialized
        autoInitializeAudio();
        
        // Update application state
        updateState();
      }
    }
    
    // Process ESP32 connection status
    if (data.type === 'esp_connected') {
      let espId = null;
      if (data.name === 'ESP32-1' || data.name.includes('soil')) {
        espId = 'esp1';
      } else if (data.name === 'ESP32-2' || data.name.includes('light')) {
        espId = 'esp2';
      } else if (data.name === 'ESP32-3' || data.name.includes('temp')) {
        espId = 'esp3';
      }
      
      if (espId) {
        espStatus[espId].connected = true;
        espStatus[espId].name = data.name;
        
        // Initialize audio if not already initialized
        autoInitializeAudio();
        
        updateState();
      }
    }
    
    // Process ESP32 disconnection
    if (data.type === 'esp_disconnected') {
      let espId = null;
      if (data.name === 'ESP32-1' || data.name.includes('soil')) {
        espId = 'esp1';
      } else if (data.name === 'ESP32-2' || data.name.includes('light')) {
        espId = 'esp2';
      } else if (data.name === 'ESP32-3' || data.name.includes('temp')) {
        espId = 'esp3';
      }
      
      if (espId) {
        espStatus[espId].connected = false;
        espStatus[espId].valid = false;
        espStatus[espId].value = null;
        updateState();
      }
    }
  }
  
  // Auto-initialize audio when ESP32 connects
  function autoInitializeAudio() {
    // Check if any ESP32 is connected
    const anyEspConnected = Object.values(espStatus).some(esp => esp.connected);
    
    // If we have an ESP32 connected and audio isn't initialized, start it
    if (anyEspConnected && window.synthEngine && !window.synthEngine.isInitialized()) {
      console.log('Auto-initializing audio due to ESP32 connection');
      
      // Initialize with status callback
      window.synthEngine.init((status) => {
        if (status) {
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
      });
    }
  }
  
  // Setup WebSocket connection
  function setupWebSocket() {
    // Create WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      
      // Send hello message to identify as web client
      socket.send(JSON.stringify({
        type: 'hello',
        client: 'CreaTune Web Client'
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after delay
      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        setupWebSocket();
      }, 5000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // Store socket in window for global access
    window.wsSocket = socket;
  }
  
  // Set up Record & Repeat state
  function setupRecordRepeat() {
    let recordedPattern = null;
    let isPlayingRecordedPattern = false;
    let recordingAudioContext = null;
    let recordingMediaStream = null;
    let recordingAnalyser = null;
    let dataArray = null;
    let playbackInterval = null;
    
    container.addEventListener('click', (e) => {
      // Don't trigger recording if we're in BPM mode
      if (currentSubState === SUB_STATES.BPM) return;
      
      // Check if any synth is active
      const anySynthActive = Object.values(espStatus).some(esp => esp.connected && esp.valid);
      if (!anySynthActive) return;
      
      // Don't trigger if clicking on a control element
      const controlElements = [
        document.getElementById('dragHandle'),
        document.getElementById('handleOverlay'),
        document.getElementById('topTab'),
        document.getElementById('frameCoverLeft'),
        document.getElementById('frameCoverRight'),
        document.getElementById('frameCoverTop'),
        document.getElementById('debugStateButton'),
        document.getElementById('espStatusPanel')
      ];
      
      if (controlElements.some(el => el && (el === e.target || el.contains(e.target)))) return;
      
      // Toggle record state
      if (currentSubState === SUB_STATES.RECORD) {
        stopRecording();
      } else {
        startRecording();
      }
    });
    
    // Start recording
    function startRecording() {
      if (currentSubState === SUB_STATES.RECORD) return;
      
      console.log('Start recording');
      currentSubState = SUB_STATES.RECORD;
      container.classList.add('recording');
      
      // Start sprite animation
      if (window.spriteAnimation) {
        window.spriteAnimation.start();
      }
      
      // If we're already playing a recorded pattern, stop it
      if (isPlayingRecordedPattern) {
        stopPlayingRecordedPattern();
      }
      
      // Silence active synths immediately before recording
      if (window.synthEngine) {
        window.synthEngine.silenceSynths(true);
      }
      
      // Add a small delay before starting the recording to ensure silence
      setTimeout(() => {
        // Start recording audio
        startAudioRecording();
      }, 200);
      
      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (currentSubState === SUB_STATES.RECORD) {
          stopRecording();
        }
      }, 5000);
    }
    
    // Stop recording
    function stopRecording() {
      if (currentSubState !== SUB_STATES.RECORD) return;
      
      console.log('Stop recording');
      currentSubState = SUB_STATES.NORMAL;
      container.classList.remove('recording');
      
      // Stop sprite animation
      if (window.spriteAnimation) {
        window.spriteAnimation.stop();
      }
      
      // Hide volume meter if it exists
      const volumeMeter = document.getElementById('volumeMeter');
      if (volumeMeter) {
        volumeMeter.style.display = 'none';
      }
      
      // Stop audio recording and process the data
      stopAudioRecording();
      
      // Add a small delay before starting pattern playback
      // to ensure clean transition
      setTimeout(() => {
        // Start playing the recorded pattern
        startPlayingRecordedPattern();
      }, 100);
    }
    
    // Start audio recording
    function startAudioRecording() {
      try {
        // Reset previous recording
        recordedPattern = [];
        
        // Set up audio recording if Web Audio API is available
        if (window.AudioContext || window.webkitAudioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          recordingAudioContext = new AudioContext();
          
          // Get user microphone with specific constraints
          navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false  // Disable automatic gain to better detect peaks
            }, 
            video: false 
          })
            .then(stream => {
              recordingMediaStream = stream;
              
              // Create analyser node
              recordingAnalyser = recordingAudioContext.createAnalyser();
              recordingAnalyser.fftSize = 1024; // More detailed FFT for better detection
              recordingAnalyser.smoothingTimeConstant = 0.2; // Less smoothing for quicker response
              
              // Connect microphone to analyser
              const source = recordingAudioContext.createMediaStreamSource(stream);
              source.connect(recordingAnalyser);
              
              // Create buffer for frequency data
              const bufferLength = recordingAnalyser.frequencyBinCount;
              dataArray = new Uint8Array(bufferLength);
              
              // Create visual feedback element
              let volumeMeter = document.getElementById('volumeMeter');
              if (!volumeMeter) {
                volumeMeter = document.createElement('div');
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
              } else {
                volumeMeter.style.display = 'block';
                document.getElementById('meterFill').style.width = '0%';
              }
              
              // Previous peak detection variables
              let lastPeakTime = 0;
              const peakDelay = 300; // Minimum ms between peaks
              
              // Start analyzing audio at regular intervals (30ms for more responsiveness)
              const analyzeInterval = setInterval(() => {
                if (currentSubState !== SUB_STATES.RECORD) {
                  clearInterval(analyzeInterval);
                  volumeMeter.style.display = 'none';
                  return;
                }
                
                recordingAnalyser.getByteFrequencyData(dataArray);
                
                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                // Update volume meter
                const meterFill = document.getElementById('meterFill');
                if (meterFill) {
                  const percentage = Math.min(100, average * 0.6); // Scale appropriately
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
                
                // Detect peaks - adjust threshold based on testing
                const threshold = 40; // Lower threshold for better sensitivity
                const now = Date.now();
                
                if (average > threshold && (now - lastPeakTime) > peakDelay) {
                  // Record the timestamp of this pulse
                  recordedPattern.push({
                    time: now,
                    intensity: Math.min(1, average / 150) // Normalize to 0-1, capped at 1
                  });
                  
                  lastPeakTime = now;
                  
                  // Visual feedback
                  container.classList.add('pulse');
                  setTimeout(() => {
                    container.classList.remove('pulse');
                  }, 100);
                }
              }, 30); // Check every 30ms for more responsiveness
            })
            .catch(err => {
              console.error('Error accessing microphone:', err);
              showErrorMessage('Could not access microphone. Recording functionality disabled.');
              
              // Fallback to rhythm mode without microphone
              currentSubState = SUB_STATES.NORMAL;
              container.classList.remove('recording');
              
              // Restore synths
              if (window.synthEngine) {
                window.synthEngine.silenceSynths(false);
              }
            });
        } else {
          console.error('Web Audio API not supported');
          showErrorMessage('Your browser does not support audio recording');
          
          // Fallback
          currentSubState = SUB_STATES.NORMAL;
          container.classList.remove('recording');
          
          // Restore synths
          if (window.synthEngine) {
            window.synthEngine.silenceSynths(false);
          }
        }
      } catch (error) {
        console.error('Error starting audio recording:', error);
        
        // Fallback
        currentSubState = SUB_STATES.NORMAL;
        container.classList.remove('recording');
        
        // Restore synths
        if (window.synthEngine) {
          window.synthEngine.silenceSynths(false);
        }
      }
    }
    
    // Stop audio recording
    function stopAudioRecording() {
      // Stop media stream tracks
      if (recordingMediaStream) {
        recordingMediaStream.getTracks().forEach(track => track.stop());
        recordingMediaStream = null;
      }
      
      // Clean up audio context
      if (recordingAudioContext && recordingAudioContext.state !== 'closed') {
        recordingAudioContext.close().catch(err => console.error('Error closing audio context:', err));
      }
      
      recordingAudioContext = null;
      recordingAnalyser = null;
      
      // Process recorded pattern
      if (recordedPattern && recordedPattern.length > 0) {
        // Convert absolute timestamps to relative intervals
        const startTime = recordedPattern[0].time;
        recordedPattern = recordedPattern.map((pulse, index) => ({
          time: pulse.time - startTime,
          intensity: pulse.intensity
        }));
        
        console.log('Recorded pattern:', recordedPattern);
      } else {
        // No pattern recorded, or empty pattern
        recordedPattern = null;
      }
    }
    
    // Start playing recorded pattern as a trigger for synths
    function startPlayingRecordedPattern() {
      if (!recordedPattern || recordedPattern.length === 0) {
        // No pattern to play, restore synths to normal
        if (window.synthEngine) {
          window.synthEngine.silenceSynths(false);
        }
        return;
      }
      
      // Enable synths but use pattern for triggering
      if (window.synthEngine) {
        window.synthEngine.silenceSynths(false);
      }
      
      isPlayingRecordedPattern = true;
      
      // Calculate total pattern duration
      const patternDuration = recordedPattern[recordedPattern.length - 1].time;
      
      // Create a loop that triggers synth based on recorded pattern
      let patternStartTime = Date.now();
      
      playbackInterval = setInterval(() => {
        const currentTime = Date.now() - patternStartTime;
        
        // Check if we need to restart the pattern
        if (currentTime > patternDuration) {
          patternStartTime = Date.now();
          return;
        }
        
        // Find pulses that should trigger now
        recordedPattern.forEach(pulse => {
          // Check if this pulse is happening now (within 30ms window)
          if (Math.abs(currentTime - pulse.time) < 30) {
            // Trigger synth note based on current state
            triggerSynthFromPattern(pulse.intensity);
            
            // Visual feedback
            container.classList.add('pulse');
            setTimeout(() => {
              container.classList.remove('pulse');
            }, 100);
          }
        });
      }, 20); // Check every 20ms for accurate timing
    }
    
    // Stop playing recorded pattern
    function stopPlayingRecordedPattern() {
      if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
      }
      
      isPlayingRecordedPattern = false;
    }
    
    // Trigger synth based on pattern pulse
    function triggerSynthFromPattern(intensity) {
      if (!window.synthEngine) return;
      
      // Determine which synths to trigger based on active state
      // This will use the intensity from the recorded pulse
      window.synthEngine.triggerPatternNote(intensity);
    }
    
    // Display error message
    function showErrorMessage(message) {
      // Create error message element if needed
      let errorEl = document.getElementById('recordingError');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'recordingError';
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
      
      // Hide after 3 seconds
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 3000);
    }
  }
  
  // Set up BPM state
  function setupBpmState() {
    // Listen for tab changes from drag-container.js
    // We'll hook into the original dragContainer API
    
    if (window.dragContainer) {
      const originalIsTabOpen = window.dragContainer.isTabOpen;
      
      window.dragContainer.isTabOpen = function() {
        const tabOpen = originalIsTabOpen.call(window.dragContainer);
        
        if (tabOpen && currentSubState !== SUB_STATES.BPM) {
          currentSubState = SUB_STATES.BPM;
          createBpmDisplay();
        } else if (!tabOpen && currentSubState === SUB_STATES.BPM) {
          currentSubState = SUB_STATES.NORMAL;
          const sliderContainer = document.getElementById('bpmSliderContainer');
          if (sliderContainer) {
            sliderContainer.style.display = 'none';
          }
        }
        
        return tabOpen;
      };
      
      // Also hook into the percentage function to update BPM
      const originalGetPercentage = window.dragContainer.getTabOpenPercentage;
      
      window.dragContainer.getTabOpenPercentage = function() {
        const percentage = originalGetPercentage.call(window.dragContainer);
        
        if (currentSubState === SUB_STATES.BPM) {
          updateBPM(percentage);
        }
        
        return percentage;
      };
      
      // Hook into the tab notification methods from drag-container.js
      if (!window.spriteAnimation.onTabClosed) {
        window.spriteAnimation.onTabClosed = function() {
          currentSubState = SUB_STATES.NORMAL;
          const sliderContainer = document.getElementById('bpmSliderContainer');
          if (sliderContainer) {
            sliderContainer.style.display = 'none';
          }
        };
      }
      
      if (!window.spriteAnimation.onTabFullyOpen) {
        window.spriteAnimation.onTabFullyOpen = function() {
          currentSubState = SUB_STATES.BPM;
          createBpmDisplay();
        };
      }
      
      if (!window.spriteAnimation.onTabPartiallyOpen) {
        window.spriteAnimation.onTabPartiallyOpen = function(percentage) {
          currentSubState = SUB_STATES.BPM;
          createBpmDisplay();
          updateBPM(percentage);
        };
      }
    }
  }
  
  // Create BPM display
  function createBpmDisplay() {
    // Remove existing BPM display if it exists
    const existingDisplay = document.getElementById('bpmSliderContainer');
    if (existingDisplay) {
      existingDisplay.style.display = 'block';
      return;
    }
    
    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'bpmSliderContainer';
    sliderContainer.className = 'bpm-slider-container';
    
    // Create BPM value display
    const bpmValue = document.createElement('div');
    bpmValue.id = 'bpmValue';
    bpmValue.className = 'bpm-value';
    bpmValue.textContent = 'BPM: 85';
    
    // Create slider input
    const slider = document.createElement('input');
    slider.id = 'bpmSlider';
    slider.className = 'bpm-slider';
    slider.type = 'range';
    slider.min = '60';
    slider.max = '180';
    slider.value = '85';
    
    // Add input event listener
    slider.addEventListener('input', function() {
      const bpm = parseInt(this.value);
      bpmValue.textContent = `BPM: ${bpm}`;
      
      // Update Tone.js
      if (window.synthEngine && window.synthEngine.setBPM) {
        window.synthEngine.setBPM(bpm);
      } else if (window.Tone && window.Tone.Transport) {
        window.Tone.Transport.bpm.value = bpm;
      }
    });
    
    // Add elements to container
    sliderContainer.appendChild(bpmValue);
    sliderContainer.appendChild(slider);
    
    // Add container to DOM
    container.appendChild(sliderContainer);
    
    // Update initial value based on current position
    const percentage = window.dragContainer ? window.dragContainer.getTabOpenPercentage() : 0.5;
    updateBPM(percentage);
  }
  
  // Update BPM based on tab position
  function updateBPM(percentage) {
    // Calculate BPM between 60-180 based on percentage
    const minBPM = 60;
    const maxBPM = 180;
    const bpm = Math.round(minBPM + (percentage * (maxBPM - minBPM)));
    
    // Update slider and display
    const slider = document.getElementById('bpmSlider');
    const bpmValue = document.getElementById('bpmValue');
    
    if (slider) {
      slider.value = bpm;
    }
    
    if (bpmValue) {
      bpmValue.textContent = `BPM: ${bpm}`;
    }
    
    // Update Tone.js via our enhanced synth engine
    if (window.synthEngine && window.synthEngine.setBPM) {
      window.synthEngine.setBPM(bpm);
    }
    // Also try the direct method if available
    else if (window.Tone && window.Tone.Transport) {
      window.Tone.Transport.bpm.value = bpm;
    }
  }
  
  // Initialize the state manager
  function initialize() {
    // Create debug UI
    createDebugButton();
    createStatusIndicators();
    
    // Set up WebSocket
    setupWebSocket();
    
    // Set up states
    setupRecordRepeat();
    setupBpmState();
    
    // Add CSS for recording state
    const style = document.createElement('style');
    style.textContent = `
      .container.recording {
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.7);
        animation: recordingPulse 1s infinite;
      }
      
      @keyframes recordingPulse {
        0% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.7); }
        50% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.9); }
        100% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.7); }
      }
      
      /* State backgrounds */
      .sprite.state-idle { background-image: url('../assets/frame-sprite.png'); }
      .sprite.state-soil { background-image: url('../images/soil.png'); }
      .sprite.state-light { background-image: url('../images/light.png'); }
      .sprite.state-temp { background-image: url('../images/temp.png'); }
      .sprite.state-growth { background-image: url('../images/growth.png'); }
      .sprite.state-mirrage { background-image: url('../images/mirrage.png'); }
      .sprite.state-flower { background-image: url('../images/flower.png'); }
      .sprite.state-total { background-image: url('../images/total.png'); }
    `;
    document.head.appendChild(style);
    
    // Load VT323 font
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';
    document.head.appendChild(fontLink);
    
    // Set initial state
    updateState();
    
    // Listen for custom events from the WebSocket
    document.addEventListener('espEvent', (e) => {
      handleWebSocketMessage(e.detail);
    });
    
    console.log('State Manager initialized');
  }
  
  // Start initialization when DOM is ready
  initialize();
  
  // Add cleanup for page unload
  window.addEventListener('beforeunload', function() {
    // Clean up any resources
    
    // Stop any recording in progress
    if (currentSubState === SUB_STATES.RECORD) {
      stopRecording();
    }
    
    // Remove event listeners if possible
    const espEventListeners = document.listeners?.filter(l => l.type === 'espEvent');
    if (espEventListeners) {
      espEventListeners.forEach(listener => {
        document.removeEventListener('espEvent', listener.callback);
      });
    }
    
    console.log('State manager cleanup completed');
  });
  
  // Expose API
  window.stateManager = {
    getState: () => currentState,
    getSubState: () => currentSubState,
    getEspStatus: () => ({ ...espStatus }),
    updateState: updateState
  };
});