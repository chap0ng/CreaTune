// websocket-client.js
// WebSocket client for CreaTune
// Creates a persistent connection that auto-reconnects

document.addEventListener('DOMContentLoaded', () => {
  console.log('WebSocket Client initializing...');
  
  let socket = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_INTERVAL = 2000; // Start with 2 seconds
  
  // Connect to WebSocket server
  function connect() {
    // Clear any existing reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // Don't create a new connection if one exists and is open/connecting
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }
    
    // Close existing socket if any
    if (socket) {
      try {
        socket.close();
      } catch (err) {
        console.error('Error closing existing socket:', err);
      }
    }
    
    // Create new WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    console.log(`Connecting to WebSocket server: ${wsUrl}`);
    socket = new WebSocket(wsUrl);
    
    // Setup event handlers
    
    // Connection opened
    socket.onopen = (event) => {
      console.log('WebSocket connection established');
      reconnectAttempts = 0;
      
      // Update UI if UIManager exists
      if (window.UIManager) {
        window.UIManager.updateConnectionStatus(true);
      }
      
      // Notify other components about connection
      if (window.EventBus) {
        window.EventBus.emit('websocketConnected', true);
      }
      
      // Identify as web client
      send({
        type: 'hello',
        client: 'WebUI'
      });
    };
    
    // Message received
    socket.onmessage = (event) => {
      console.log('WebSocket message received:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        
        // Notify other components about the message
        if (window.EventBus) {
          window.EventBus.emit('webSocketMessage', data);
        }
        
        // Special handling for ESP32 data
        if (data.type === 'sensor_data' && window.lastESP32ActivityTime !== undefined) {
          window.lastESP32ActivityTime = Date.now();
        }
        
        // Special handling for ESP connection
        if (data.type === 'esp_connected' && window.lastESP32ActivityTime !== undefined) {
          window.lastESP32ActivityTime = Date.now();
          
          // Ensure audio is started
          if (window.SynthEngine && window.SynthEngine.ensureAudioStarted) {
            window.SynthEngine.ensureAudioStarted();
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    // Connection closed
    socket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      
      // Update UI if UIManager exists
      if (window.UIManager) {
        window.UIManager.updateConnectionStatus(false);
      }
      
      // Notify other components about disconnection
      if (window.EventBus) {
        window.EventBus.emit('websocketConnected', false);
      }
      
      // Attempt to reconnect after a delay
      scheduleReconnect();
    };
    
    // Connection error
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      
      // Update UI if UIManager exists
      if (window.UIManager) {
        window.UIManager.updateConnectionStatus(false);
      }
      
      // Force close and reconnect
      try {
        socket.close();
      } catch (err) {
        // Ignore errors on close
      }
      
      // Schedule reconnect
      scheduleReconnect();
    };
  }
  
  // Send data through WebSocket
  function send(data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message, WebSocket not connected');
      return false;
    }
    
    try {
      // Convert to JSON if needed
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socket.send(message);
      return true;
    } catch (err) {
      console.error('Error sending WebSocket message:', err);
      return false;
    }
  }
  
  // Schedule reconnection attempt
  function scheduleReconnect() {
    // Don't schedule if already scheduled
    if (reconnectTimer) {
      return;
    }
    
    // Calculate backoff time (2s, 4s, 8s, 16s, etc.)
    const backoff = Math.min(30000, RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts));
    
    console.log(`Scheduling WebSocket reconnect in ${backoff}ms (attempt ${reconnectAttempts + 1})`);
    
    reconnectAttempts++;
    
    // Schedule reconnect
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      
      // Try to reconnect
      connect();
      
      // If max attempts reached and still not connected, show error
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && 
          (!socket || socket.readyState !== WebSocket.OPEN)) {
        console.error('Max WebSocket reconnect attempts reached');
        
        // Show error message
        if (window.UIManager) {
          window.UIManager.showErrorMessage('Could not connect to server. Please reload the page.', 0);
        }
      }
    }, backoff);
  }
  
  // Force reconnection
  function forceReconnect() {
    console.log('Forcing WebSocket reconnection');
    
    // Reset reconnect attempts
    reconnectAttempts = 0;
    
    // Close socket and connect again
    if (socket) {
      try {
        socket.close();
      } catch (err) {
        // Ignore errors on close
      }
    }
    
    // Connect immediately
    connect();
  }
  
  // Check connection and reconnect if needed
  function checkConnection() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log('WebSocket not connected, attempting to reconnect');
      connect();
      return false;
    }
    return true;
  }
  
  // Initialize WebSocket
  connect();
  
  // Set up periodic connection check
  setInterval(checkConnection, 30000);
  
  // Expose API
  window.WebSocketClient = {
    send,
    isConnected: () => socket && socket.readyState === WebSocket.OPEN,
    reconnect: forceReconnect,
    checkConnection
  };
  
  console.log('WebSocket Client initialized');
});
