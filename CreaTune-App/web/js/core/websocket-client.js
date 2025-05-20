// websocket-client.js
// Client-side WebSocket handling for CreaTune
// Structure: Webapp is the server, ESP32 devices are clients

document.addEventListener('DOMContentLoaded', () => {
  let socket;
  let reconnectInterval;
  let isConnected = false;
  let connectionAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Initialize the WebSocket connection
  function initWebSocket() {
    // Determine WebSocket URL based on current location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname || 'localhost';
    const wsPort = window.location.port || (wsProtocol === 'wss:' ? '443' : '8080');
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
    
    console.log(`Connecting to WebSocket server at ${wsUrl}`);
    
    // Close any existing connection
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
    
    try {
      // Create new WebSocket connection
      socket = new WebSocket(wsUrl);
      
      // Connection opened
      socket.addEventListener('open', () => {
        console.log('Connected to WebSocket server');
        isConnected = true;
        connectionAttempts = 0;
        clearInterval(reconnectInterval);
        
        // Send identification message
        socket.send(JSON.stringify({
          type: 'hello',
          client: 'CreaTune Web Client'
        }));
        
        // Update connection status display
        updateConnectionStatus(true);
        
        // Notify other components
        EventBus.emit('websocketConnected', true);
      });
      
      // Listen for messages
      socket.addEventListener('message', (event) => {
        console.log('Message from server:', event.data);
        
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Connection closed
      socket.addEventListener('close', () => {
        console.log('Disconnected from WebSocket server');
        isConnected = false;
        
        // Update connection status display
        updateConnectionStatus(false);
        
        // Notify other components
        EventBus.emit('websocketConnected', false);
        
        // Attempt to reconnect with exponential backoff
        if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(5000 * (2 ** connectionAttempts), 30000);
          connectionAttempts++;
          
          console.log(`Reconnection attempt ${connectionAttempts} in ${delay}ms`);
          
          if (!reconnectInterval) {
            reconnectInterval = setTimeout(() => {
              reconnectInterval = null;
              if (!isConnected) {
                console.log('Attempting to reconnect...');
                initWebSocket();
              }
            }, delay);
          }
        } else {
          console.log('Max reconnection attempts reached. Please refresh the page.');
          if (window.UIManager) {
            window.UIManager.showErrorMessage('Connection to server lost. Please refresh the page.');
          }
        }
      });
      
      // Connection error
      socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
      });
      
      // Store socket reference
      window.wsSocket = socket;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      isConnected = false;
      updateConnectionStatus(false);
      
      // Try to reconnect after delay
      if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(5000 * (2 ** connectionAttempts), 30000);
        connectionAttempts++;
        
        setTimeout(() => {
          if (!isConnected) initWebSocket();
        }, delay);
      }
    }
  }
  
  // Update connection status through EventBus
  function updateConnectionStatus(connected) {
    // Use UIManager if available
    if (window.UIManager) {
      window.UIManager.updateConnectionStatus(connected);
    }
    
    // Also notify via EventBus
    EventBus.emit('websocketConnected', connected);
  }
  
  // Handle incoming WebSocket messages
  function handleMessage(data) {
    // Handle ESP32 related messages
    if (
      data.type === 'esp_connected' || 
      data.type === 'esp_disconnected' || 
      data.type === 'sensor_data' || 
      data.sensor
    ) {
      // Create a wrapper event for ESP Manager to handle
      const espEvent = new CustomEvent('espEvent', {
        detail: data
      });
      
      // Dispatch event
      document.dispatchEvent(espEvent);
      return;
    }
    
    // Handle welcome message
    if (data.type === 'welcome') {
      console.log('Received welcome message:', data.message);
      return;
    }
    
    // Handle ESP32 status
    if (data.type === 'esp_status') {
      console.log('Received ESP32 status:', data.devices);
      
      // Process each ESP32 device status
      data.devices.forEach(device => {
        // Create ESP event
        const espEvent = new CustomEvent('espEvent', {
          detail: {
            type: 'esp_connected',
            espId: device.id,
            name: device.name,
            lastData: device.lastData
          }
        });
        
        // Dispatch event
        document.dispatchEvent(espEvent);
        
        // If we have last data for this device, also send that
        if (device.lastData) {
          const sensorEvent = new CustomEvent('espEvent', {
            detail: device.lastData
          });
          document.dispatchEvent(sensorEvent);
        }
      });
      
      return;
    }
    
    // Handle animation frame updates
    if (data.type === 'frame_update' && data.frameIndex !== undefined) {
      console.log('Frame update:', data.frameIndex);
      
      // Update sprite frame if needed
      if (window.spriteAnimation && window.spriteAnimation.showFrame) {
        window.spriteAnimation.showFrame(data.frameIndex);
      }
      
      return;
    }
    
    // Handle animation speed updates
    if (data.type === 'animation_speed' && data.speed !== undefined) {
      console.log('Animation speed update:', data.speed);
      
      // Update animation speed if needed
      if (window.spriteAnimation && typeof window.spriteAnimation.setSpeed === 'function') {
        window.spriteAnimation.setSpeed(data.speed);
      }
      
      return;
    }
    
    // Handle other message types
    console.log('Unhandled message type:', data.type, data);
  }
  
  // Send data to the server
  function sendMessage(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
      return true;
    } else {
      console.error('WebSocket not connected. Cannot send message.');
      if (window.UIManager) {
        window.UIManager.showErrorMessage('Cannot send data: Connection lost');
      }
      return false;
    }
  }
  
  // Generate test ESP32 data for simulation
  function simulateESPData(espId) {
    const validValue = 0.4 + (Math.random() * 0.4); // Value between 0.4 and 0.8
    
    let sensorType;
    let espName;
    
    if (espId === 'esp1') {
      sensorType = 'soil';
      espName = 'ESP32-1';
    } else if (espId === 'esp2') {
      sensorType = 'light';
      espName = 'ESP32-2';
    } else if (espId === 'esp3') {
      sensorType = 'temperature';
      espName = 'ESP32-3';
    } else {
      return null; // Invalid ESP ID
    }
    
    return {
      type: 'sensor_data',
      sensor: sensorType,
      name: espName,
      value: validValue
    };
  }
  
  // Send simulated ESP data through the normal channel
  function sendSimulatedESPData(espId) {
    const data = simulateESPData(espId);
    if (data) {
      // Create a wrapper event for ESP Manager to handle
      const espEvent = new CustomEvent('espEvent', {
        detail: data
      });
      
      // Dispatch event directly
      document.dispatchEvent(espEvent);
      
      console.log(`Simulated data sent for ${espId}:`, data);
      return true;
    }
    return false;
  }
  
  // Initialize WebSocket
  initWebSocket();
  
  // Add cleanup on page unload
  window.addEventListener('beforeunload', function() {
    // Close WebSocket connection on page unload
    if (window.wsSocket && window.wsSocket.readyState === WebSocket.OPEN) {
      console.log('Closing WebSocket connection before page unload');
      window.wsSocket.close();
    }
  });
  
  // Expose the API
  window.wsClient = {
    isConnected: () => isConnected,
    sendMessage: sendMessage,
    reconnect: initWebSocket,
    simulateESP: sendSimulatedESPData
  };
});
