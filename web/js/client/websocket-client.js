// making sure app receives messages from the server
// receiving messages from 1: esp32soil, 2: esp32light, 3: esp32temp

//comunicating with esp32 for websocket status

//handle esp32 combinaison for activating corresponding javescript 
// 4: soil+light, 5: light+temp, 6: soil+temp, 7: soil+light+temp
// naming them soil, light, temp, growth, mirrage, flower, total

// websocket-client.js
// WebSocket client for CreaTune - Handles ESP32 sensor data

// ---------------------------------------------------------------------

class CreaTuneWebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000; // 5 seconds
    this.maxReconnectAttempts = -1; // Infinite retries
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.lastDataReceived = 0;
    this.dataTimeout = 10000; // 10 seconds without data = inactive
    
    // Sensor state
    this.currentSensorData = null;
    this.isAppActive = false;
    
    // UI elements
    this.frameBackground = null;
    this.soilCreature = null;
    this.idleCreature = null;
    
    this.init();
  }

  init() {
    // Get UI elements
    this.frameBackground = document.querySelector('.framebackground');
    this.soilCreature = document.querySelector('.soil-creature');
    this.idleCreature = document.querySelector('.idle-creature');
    
    // Create soil creature if it doesn't exist
    if (!this.soilCreature) {
      this.soilCreature = document.createElement('div');
      this.soilCreature.className = 'soil-creature';
      document.querySelector('.frameidle').appendChild(this.soilCreature);
    }
    
    console.log('🌱 CreaTune WebSocket Client initialized');
    this.connect();
    
    // Start data timeout checker
    this.startDataTimeoutChecker();
  }

  connect() {
    try {
      // Use current page's host for WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = 8080; // Match ESP32 config
      
      const wsUrl = `${protocol}//${host}:${port}/`;
      
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = (event) => {
        console.log('✅ WebSocket connected!');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Update ESP32 status if available
        if (window.ESP32Status) {
          window.ESP32Status.updateConnectionStatus(true);
        }
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onclose = (event) => {
        console.log('❌ WebSocket disconnected');
        this.isConnected = false;
        this.handleDisconnection();
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('🚨 WebSocket error:', error);
        this.isConnected = false;
        
        // Update ESP32 status if available
        if (window.ESP32Status) {
          window.ESP32Status.updateConnectionStatus(false);
        }
      };
      
    } catch (error) {
      console.error('🚨 Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  handleMessage(data) {
    try {
      const sensorData = JSON.parse(data);
      
      console.log('📊 Received sensor data:', sensorData);
      
      // Update last data received timestamp
      this.lastDataReceived = Date.now();
      
      // Store current sensor data
      this.currentSensorData = sensorData;
      
      // Process the sensor data
      this.processSensorData(sensorData);
      
      // Update ESP32 status if available
      if (window.ESP32Status) {
        window.ESP32Status.updateSensorData(sensorData);
      }
      
    } catch (error) {
      console.error('🚨 Error parsing sensor data:', error);
    }
  }

  processSensorData(data) {
    // Check if this is valid sensor data
    if (data.type !== 'sensor_data' || data.sensor !== 'MoistureSensor') {
      return;
    }
    
    const { 
      raw_value, 
      moisture_percent, 
      moisture_app_value, 
      soil_condition, 
      app_active 
    } = data;
    
    // Update app active state
    const wasActive = this.isAppActive;
    this.isAppActive = app_active;
    
    console.log(`🌱 Moisture: ${moisture_percent.toFixed(1)}% | App Value: ${moisture_app_value.toFixed(2)} | Condition: ${soil_condition} | Active: ${app_active}`);
    
    // Handle app state change
    if (app_active !== wasActive) {
      this.handleAppStateChange(app_active);
    }
    
    // Update background and creature based on moisture level
    this.updateVisuals(data);
    
    // Trigger soil-specific handler if available
    if (window.SoilHandler) {
      window.SoilHandler.handleSensorData(data);
    }
    
    // Trigger frame animations if available
    if (window.FrameSlider) {
      window.FrameSlider.updateFromSensor(moisture_app_value);
    }
  }

  handleAppStateChange(isActive) {
    console.log(`🎮 App state changed: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
    
    if (isActive) {
      // App became active - show soil environment
      this.activateSoilMode();
    } else {
      // App became inactive - return to idle
      this.deactivateSoilMode();
    }
  }

  activateSoilMode() {
    console.log('🌱 Activating soil mode');
    
    // Add active class to background for soil animation
    if (this.frameBackground) {
      this.frameBackground.classList.add('active');
    }
    
    // Show soil creature, hide idle creature
    if (this.soilCreature) {
      this.soilCreature.style.display = 'block';
      this.soilCreature.style.animation = 'soilcreature 2s steps(4) infinite';
    }
    
    if (this.idleCreature) {
      this.idleCreature.style.display = 'none';
    }
    
    // Trigger creature manager if available
    if (window.CreatureHider) {
      window.CreatureHider.showSoilCreature();
    }
    
    // Start background manager if available
    if (window.BackgroundManager) {
      window.BackgroundManager.activateSoilBackground();
    }
  }

  deactivateSoilMode() {
    console.log('💤 Deactivating soil mode');
    
    // Remove active class from background
    if (this.frameBackground) {
      this.frameBackground.classList.remove('active');
    }
    
    // Hide soil creature, show idle creature
    if (this.soilCreature) {
      this.soilCreature.style.display = 'none';
      this.soilCreature.style.animation = '';
    }
    
    if (this.idleCreature) {
      this.idleCreature.style.display = 'block';
    }
    
    // Trigger creature manager if available
    if (window.CreatureHider) {
      window.CreatureHider.hideSoilCreature();
    }
    
    // Stop background manager if available
    if (window.BackgroundManager) {
      window.BackgroundManager.deactivateSoilBackground();
    }
  }

  updateVisuals(data) {
    const { moisture_app_value, soil_condition } = data;
    
    // Add reaction animation on significant moisture changes
    if (this.soilCreature && this.isAppActive) {
      // Trigger reaction animation
      this.soilCreature.classList.add('creature-reacting');
      
      setTimeout(() => {
        this.soilCreature.classList.remove('creature-reacting');
      }, 400);
    }
    
    // Update any visual elements based on moisture level
    this.updateMoistureVisualization(moisture_app_value, soil_condition);
  }

  updateMoistureVisualization(appValue, condition) {
    // This can be extended to update colors, animations, etc.
    // For now, just log the values
    const intensity = Math.floor(appValue * 100);
    console.log(`🎨 Visual update: ${intensity}% intensity, condition: ${condition}`);
  }

  handleDisconnection() {
    console.log('🔌 Handling disconnection...');
    
    // Set app to inactive state
    this.isAppActive = false;
    this.deactivateSoilMode();
    
    // Update ESP32 status if available
    if (window.ESP32Status) {
      window.ESP32Status.updateConnectionStatus(false);
    }
  }

  scheduleReconnect() {
    if (this.maxReconnectAttempts === -1 || this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      console.log(`🔄 Reconnecting in ${this.reconnectInterval/1000}s (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.log('❌ Max reconnection attempts reached');
    }
  }

  startDataTimeoutChecker() {
    setInterval(() => {
      if (this.isConnected && this.lastDataReceived > 0) {
        const timeSinceLastData = Date.now() - this.lastDataReceived;
        
        if (timeSinceLastData > this.dataTimeout) {
          console.log('⏰ Data timeout - no sensor data received');
          
          // Deactivate if no data for too long
          if (this.isAppActive) {
            this.isAppActive = false;
            this.deactivateSoilMode();
          }
        }
      }
    }, 2000); // Check every 2 seconds
  }

  // Public methods for external access
  getCurrentSensorData() {
    return this.currentSensorData;
  }

  isActive() {
    return this.isAppActive;
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  // Method to send data to ESP32 (if needed)
  sendMessage(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ Cannot send message - WebSocket not connected');
    }
  }
}

// Initialize the WebSocket client when page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Starting CreaTune WebSocket Client...');
  window.CreaTuneWS = new CreaTuneWebSocketClient();
});

// Export for use in other modules
window.CreaTuneWebSocketClient = CreaTuneWebSocketClient;