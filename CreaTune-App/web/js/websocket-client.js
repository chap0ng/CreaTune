// websocket-client.js
export default class WebSocketClient {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.socket = null;
    this.reconnectInterval = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    
    this.initWebSocket();
    this.setupEventListeners();
  }

  initWebSocket() {
    // Clear any existing connection
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }

    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    console.log(`Connecting to WebSocket server at ${wsUrl}`);
    
    this.socket = new WebSocket(wsUrl);

    // Connection opened
    this.socket.addEventListener('open', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.connectionAttempts = 0;
      clearInterval(this.reconnectInterval);
      
      // Send identification
      this.sendMessage({
        type: 'hello',
        client: 'CreaTune Web Client'
      });
      
      // Notify state manager
      this.stateManager.handleWebSocketStatus(true);
    });

    // Message handler
    this.socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    // Connection closed
    this.socket.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.stateManager.handleWebSocketStatus(false);
      this.attemptReconnect();
    });

    // Connection error
    this.socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.isConnected = false;
      this.stateManager.handleWebSocketStatus(false);
    });

    window.wsSocket = this.socket;
  }

  attemptReconnect() {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.log('Max reconnection attempts reached. Running in standalone mode.');
      this.stateManager.setOfflineMode(true);
      return;
    }

    if (!this.reconnectInterval) {
      this.connectionAttempts++;
      const delay = Math.min(5000, 1000 * this.connectionAttempts); // Exponential backoff
      
      console.log(`Attempting to reconnect in ${delay}ms...`);
      
      this.reconnectInterval = setTimeout(() => {
        this.reconnectInterval = null;
        this.initWebSocket();
      }, delay);
    }
  }

  handleMessage(data) {
    // Convert WebSocket messages to state manager events
    const eventMap = {
      'welcome': 'wsWelcome',
      'esp_status': 'espStatus',
      'esp_connected': 'espConnected',
      'esp_disconnected': 'espDisconnected',
      'sensor_data': 'sensorData',
      'frame_update': 'frameUpdate',
      'animation_speed': 'animationSpeed',
      'animation_intensity': 'animationIntensity',
      'animation_color': 'animationColor',
      'status_update': 'statusUpdate'
    };

    const eventType = eventMap[data.type] || 'wsMessage';
    
    // Dispatch normalized event to state manager
    const event = new CustomEvent(eventType, { detail: data });
    document.dispatchEvent(event);
    
    // Special case: ESP32 status needs additional processing
    if (data.type === 'esp_status') {
      data.devices?.forEach(device => {
        if (device.lastData) {
          document.dispatchEvent(new CustomEvent('sensorData', { 
            detail: device.lastData 
          }));
        }
      });
    }
  }

  sendMessage(data) {
    if (this.isConnected && this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket not connected. Message not sent:', data);
      return false;
    }
  }

  setupEventListeners() {
    window.addEventListener('beforeunload', () => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
    });
  }

  // Public API
  reconnect() {
    this.connectionAttempts = 0;
    this.initWebSocket();
  }
}