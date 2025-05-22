// websocket-client.js
class CreaTuneWebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.maxReconnectAttempts = -1;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.lastDataReceived = 0;
    this.dataTimeout = 10000;
    
    this.currentSensorData = null;
    this.isAppActive = false;
    
    this.init();
  }

  init() {
    console.log('🌱 CreaTune WebSocket Client initialized');
    this.connect();
    this.startDataTimeoutChecker();
  }

  connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = 8080;
      const wsUrl = `${protocol}//${host}:${port}/`;
      
      console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = (event) => {
        console.log('✅ WebSocket connected!');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        document.dispatchEvent(new CustomEvent('websocket-connected'));
      };
      
      this.ws.onmessage = (event) => this.handleMessage(event.data);
      this.ws.onclose = (event) => this.handleDisconnection();
      this.ws.onerror = (error) => this.handleError(error);
      
    } catch (error) {
      console.error('🚨 Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  handleMessage(data) {
    try {
      const sensorData = JSON.parse(data);
      this.lastDataReceived = Date.now();
      this.currentSensorData = sensorData;
      
      if (sensorData.type === 'sensor_data') {
        this.processSensorData(sensorData);
        document.dispatchEvent(new CustomEvent('sensor-data', { detail: sensorData }));
      }
    } catch (error) {
      console.error('🚨 Error parsing sensor data:', error);
    }
  }

  processSensorData(data) {
    if (data.sensor !== 'MoistureSensor') return;
    
    const wasActive = this.isAppActive;
    this.isAppActive = data.app_active;
    
    if (this.isAppActive !== wasActive) {
      document.dispatchEvent(new CustomEvent('app-state-change', { 
        detail: { isActive: this.isAppActive } 
      }));
    }
  }

  handleDisconnection() {
    console.log('❌ WebSocket disconnected');
    this.isConnected = false;
    this.isAppActive = false;
    document.dispatchEvent(new CustomEvent('websocket-disconnected'));
    this.scheduleReconnect();
  }

  handleError(error) {
    console.error('🚨 WebSocket error:', error);
    this.isConnected = false;
    document.dispatchEvent(new CustomEvent('websocket-error', { detail: error }));
  }

  scheduleReconnect() {
    if (this.maxReconnectAttempts === -1 || this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting in ${this.reconnectInterval/1000}s (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectInterval);
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
          this.handleDisconnection();
        }
      }
    }, 2000);
  }

  sendMessage(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ Cannot send message - WebSocket not connected');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.CreaTuneWS = new CreaTuneWebSocketClient();
});