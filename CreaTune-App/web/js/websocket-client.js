// websocket-client.js
// Client-side WebSocket handling for CreaTune
// Structure: Webapp is the server, ESP32 devices are clients

document.addEventListener('DOMContentLoaded', () => {
  let socket;
  let reconnectInterval;
  let isConnected = false;

  // Initialize the WebSocket connection
  function initWebSocket() {
    // Determine WebSocket URL based on current location
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port || (wsProtocol === 'wss:' ? '443' : '80');
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`;
    
    console.log(`Connecting to WebSocket server at ${wsUrl}`);
    
    // Close any existing connection
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
    
    // Create new WebSocket connection
    socket = new WebSocket(wsUrl);
    
    // Connection opened
    socket.addEventListener('open', () => {
      console.log('Connected to WebSocket server');
      isConnected = true;
      clearInterval(reconnectInterval);
      
      // Send identification message
      socket.send(JSON.stringify({
        type: 'hello',
        client: 'CreaTune Web Client'
      }));
      
      // Update connection status display
      updateConnectionStatus(true);
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
      
      // Attempt to reconnect
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          if (!isConnected) {
            console.log('Attempting to reconnect...');
            initWebSocket();
          } else {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
          }
        }, 5000);
      }
    });
    
    // Connection error
    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus(false);
    });
    
    // Store socket reference
    window.wsSocket = socket;
  }
  
  // Create or update connection status display
  function updateConnectionStatus(connected) {
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
  
  // Handle incoming WebSocket messages
  function handleMessage(data) {
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
    
    // Handle ESP32 connections
    if (data.type === 'esp_connected') {
      console.log('ESP32 connected:', data);
      
      // Create and dispatch event
      const espEvent = new CustomEvent('espEvent', {
        detail: data
      });
      
      document.dispatchEvent(espEvent);
      return;
    }
    
    // Handle ESP32 disconnections
    if (data.type === 'esp_disconnected') {
      console.log('ESP32 disconnected:', data);
      
      // Create and dispatch event
      const espEvent = new CustomEvent('espEvent', {
        detail: data
      });
      
      document.dispatchEvent(espEvent);
      return;
    }
    
    // Handle sensor data
    if (data.type === 'sensor_data' || data.sensor) {
      console.log('Sensor data received:', data);
      
      // Create and dispatch event
      const sensorEvent = new CustomEvent('espEvent', {
        detail: data
      });
      
      document.dispatchEvent(sensorEvent);
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
    
    // Handle animation intensity and color updates
    if (data.type === 'animation_intensity' || data.type === 'animation_color') {
      console.log(`${data.type} update:`, data);
      // Handle updates if needed
      return;
    }
    
    // Handle status updates
    if (data.type === 'status_update') {
      console.log('Status update:', data);
      // Handle status update if needed
      return;
    }
    
    // Handle other message types
    console.log('Unhandled message type:', data.type, data);
  }
  
  // Send data to the server
  function sendMessage(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    } else {
      console.error('WebSocket not connected. Cannot send message.');
    }
  }
  
  // Initialize WebSocket
  initWebSocket();
  
  // Expose the API
  window.wsClient = {
    isConnected: () => isConnected,
    sendMessage: sendMessage,
    reconnect: initWebSocket
  };
});