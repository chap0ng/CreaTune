// Enhanced WebSocket server with more responsive ESP32 disconnection detection

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Web server configuration
const PORT = process.env.PORT || 8080;
const WEB_ROOT = path.join(__dirname, 'web');

// Create HTTP server
const server = http.createServer((req, res) => {
  // ... existing HTTP server code ...
});

function getContentType(extname) {
  // ... existing getContentType function ...
}

function serveFile(filePath, res, contentType) {
  // ... existing serveFile function ...
}

// Create WebSocket server with improved heartbeat
const wss = new WebSocket.Server({ 
  server,
  // Add ping/pong settings directly in server creation 
  pingInterval: 2000, // Send ping every 2 seconds
  pingTimeout: 3000   // Consider connection dead if no pong in 3 seconds
});

// Client tracking
const clients = new Map();
let clientIdCounter = 0;

// ESP32 device tracking with heartbeats
const espDevices = new Map();
const espConnections = new Map();
let espIdCounter = 0;

// Timeout and Ping settings
const HEARTBEAT_INTERVAL_MS = 2000;  // Much faster heartbeat interval - 2 seconds
const HEARTBEAT_TIMEOUT_MS = 3000;   // Shorter timeout - 3 seconds
const ESP_TIMEOUT_MS = 5000;         // Fallback timeout
const CLIENT_TIMEOUT_MS = 30000;     // For web clients

// Enhanced heartbeat mechanism - more aggressive checking for ESP32
function heartbeat() {
  this.isAlive = true;
  this.lastPong = Date.now();
}

// Handle new connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const uniqueClientId = clientIdCounter++;
  
  // Initialize connection health tracking
  ws.isAlive = true;
  ws.lastPong = Date.now();
  ws.on('pong', heartbeat);
  
  // Initially, we don't know if it's an ESP or a web client
  clients.set(uniqueClientId, { ws, type: 'unknown', ip });
  console.log(`➕ New connection (ID: ${uniqueClientId}) from ${ip}. Awaiting identification...`);

  ws.on('message', (message) => {
    // Mark active on any message
    ws.isAlive = true;
    ws.lastPong = Date.now();
    
    // ... existing message handling code ...
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error(`🚨 Received non-JSON message from Client ID ${uniqueClientId}:`, message.toString());
      return;
    }

    const clientInfo = clients.get(uniqueClientId);

    if (clientInfo.type === 'unknown') {
      if (data.type === 'esp_handshake' && data.sensorName) {
        clientInfo.type = 'esp';
        clientInfo.sensorName = data.sensorName;
        handleESPHandshake(ws, data.sensorName, uniqueClientId, ip);
        
        // Enhanced - Set up specific ESP32 heartbeat tracking
        ws.deviceType = 'esp';
        ws.sensorName = data.sensorName;
        
        // Send immediate ping to establish connection health
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (err) {
            console.error(`Failed initial ping to ESP32 ${data.sensorName}:`, err.message);
          }
        }
      } else {
        clientInfo.type = 'web';
        ws.deviceType = 'web';
        console.log(`💻 Client ID ${uniqueClientId} identified as WEB CLIENT.`);
        ws.send(JSON.stringify({ type: 'welcome', clientId: uniqueClientId, message: 'Connected to CreaTune Web Server' }));
        sendESP32StatusToSingleClient(ws);
      }
    }

    // Process message based on identified type
    if (clientInfo.type === 'esp') {
      handleESP32Data(ws, data, clientInfo.sensorName);
    } else if (clientInfo.type === 'web') {
      if (data.type === 'get_esp_status') {
        sendESP32StatusToSingleClient(ws);
      } else {
        console.log(`🌐 Received from Web Client ID ${uniqueClientId}:`, data);
      }
    }
  });

  ws.on('close', () => {
    const clientInfo = clients.get(uniqueClientId);
    if (clientInfo) {
      if (clientInfo.type === 'esp' && clientInfo.sensorName) {
        handleESP32Disconnect(clientInfo.sensorName, ws, "WebSocket closed");
      } else if (clientInfo.type === 'web') {
        console.log(`➖ Web Client ID ${uniqueClientId} disconnected.`);
      } else {
        console.log(`➖ Unknown Client ID ${uniqueClientId} disconnected before identification.`);
      }
      clients.delete(uniqueClientId);
    }
  });

  ws.on('error', (error) => {
    const clientInfo = clients.get(uniqueClientId);
    const idForLog = clientInfo ? (clientInfo.sensorName || `Client ID ${uniqueClientId}`) : `Unknown Client (ID ${uniqueClientId})`;
    console.error(`🚫 WebSocket error for ${idForLog}:`, error.message);
  });
});

// Add enhanced ESP handshake - request and confirm immediate heartbeat
function handleESPHandshake(ws, sensorName, uniqueClientId, ip) {
  console.log(`🤝 ESP32 Handshake: ${sensorName} (Client ID: ${uniqueClientId}) from ${ip}`);
  
  // If another ESP with the same name is already connected, close the old one
  if (espConnections.has(sensorName)) {
    const oldWs = espConnections.get(sensorName);
    if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
      console.warn(`⚠️  Duplicate ESP32 name '${sensorName}'. Closing older connection.`);
      oldWs.send(JSON.stringify({ type: 'error', message: 'Replaced by new connection' }));
      oldWs.terminate();
    }
  }

  let deviceInfo = espDevices.get(sensorName);
  if (!deviceInfo) {
    deviceInfo = { 
      id: `ESP-${espIdCounter++}`, 
      lastSeen: Date.now(), 
      connectionCount: 0,
      ip: ip 
    };
    espDevices.set(sensorName, deviceInfo);
    console.log(`✨ New ESP32 device registered: ${sensorName} (ID: ${deviceInfo.id})`);
  }
  
  deviceInfo.ws = ws;
  deviceInfo.lastSeen = Date.now();
  deviceInfo.connectionCount++;
  deviceInfo.ip = ip;
  espConnections.set(sensorName, ws);

  // Send handshake acknowledgment with request for heartbeat response
  ws.send(JSON.stringify({ 
    type: 'handshake_ack', 
    message: `ESP32 ${sensorName} connected`, 
    espId: deviceInfo.id,
    heartbeat_interval: HEARTBEAT_INTERVAL_MS,  // Inform ESP32 about heartbeat timing
    heartbeat_enabled: true                     // Tell ESP32 that heartbeats are required
  }));
  
  broadcastToWebClients({ type: 'esp_connected', name: sensorName, id: deviceInfo.id, ip: deviceInfo.ip });
  broadcastESPStatusUpdate();
}

// Existing ESP data handler
function handleESP32Data(ws, data, sensorName) {
  const deviceInfo = espDevices.get(sensorName);
  if (deviceInfo) {
    deviceInfo.lastSeen = Date.now();
    if (!data.device_type) {
        data.device_type = sensorName.toLowerCase();
    }
    
    // Handle explicit heartbeat/ping responses from ESP32
    if (data.type === 'heartbeat' || data.type === 'pong' || data.type === 'ping') {
      // Just update the lastSeen timestamp, don't broadcast to clients
      // console.log(`💓 Heartbeat from ${sensorName}`);
      return;
    }
    
    broadcastToWebClients({ type: 'sensor_data', ...data, sensor: sensorName, espId: deviceInfo.id });
  } else {
    console.warn(`⚠️ Received data from unknown or disconnected ESP: ${sensorName}. Requesting handshake.`);
    ws.send(JSON.stringify({ type: 'request_handshake', message: 'Identify yourself' }));
  }
}

// Rest of existing functions...
function handleESP32Disconnect(sensorName, wsInstance, reason = "Unknown reason") {
  const currentConnection = espConnections.get(sensorName);
  if (currentConnection === wsInstance) {
    console.log(`🔌❌ ESP32 '${sensorName}' disconnected. Reason: ${reason}`);
    espConnections.delete(sensorName);
    
    broadcastToWebClients({ type: 'esp_disconnected', name: sensorName });
    broadcastESPStatusUpdate();
  }
}

function broadcastToWebClients(data, excludeWs = null) {
  clients.forEach((client, clientId) => {
    if (client.type === 'web' && client.ws.readyState === WebSocket.OPEN) {
      if (client.ws !== excludeWs) {
        client.ws.send(JSON.stringify(data));
      }
    }
  });
}

function sendESP32StatusToSingleClient(ws) {
  // ... existing function ...
}

function broadcastESPStatusUpdate() {
  // ... existing function ...
}

// CRITICAL ENHANCEMENT: Much more aggressive heartbeat checking
// Send pings to all clients and check if they've responded
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  
  // For each client, check heartbeat status and send pings
  wss.clients.forEach((ws) => {
    // If it hasn't responded to the last ping
    if (ws.isAlive === false) {
      // ESP32 specific handling for faster detection
      if (ws.deviceType === 'esp' && ws.sensorName) {
        console.warn(`💔 ESP32 '${ws.sensorName}' failed heartbeat check. Terminating connection.`);
        
        // Fast path - immediately trigger ESP32 disconnect handling
        handleESP32Disconnect(ws.sensorName, ws, "Failed heartbeat");
      }
      
      // Terminate the connection
      ws.terminate();
      return;
    }
    
    // For ESP32s, check if we've waited too long since last pong
    if (ws.deviceType === 'esp' && ws.sensorName) {
      if (now - ws.lastPong > HEARTBEAT_TIMEOUT_MS) {
        console.warn(`⌛ ESP32 '${ws.sensorName}' heartbeat timeout (${(now - ws.lastPong)/1000}s). Terminating.`);
        handleESP32Disconnect(ws.sensorName, ws, "Heartbeat timeout");
        ws.terminate();
        return;
      }
    }
    
    // Mark as not alive until we get a pong response
    ws.isAlive = false;
    
    try {
      // Send ping (this should trigger a pong response)
      ws.ping('', false, (err) => {
        if (err) console.error(`Ping error for client:`, err);
      });
    } catch (e) {
      console.error('Failed to send ping:', e);
      // If we can't even send a ping, terminate the connection
      ws.terminate();
    }
  });
}, HEARTBEAT_INTERVAL_MS);

// Clean up on server close
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Standard ESP checking interval as a backup
// This is now secondary to the faster heartbeat detection
setInterval(() => {
  const now = Date.now();
  espDevices.forEach((deviceInfo, sensorName) => {
    const activeWs = espConnections.get(sensorName);
    if (activeWs) {
      if (now - deviceInfo.lastSeen > ESP_TIMEOUT_MS) {
        console.warn(`⌛ ESP32 '${sensorName}' (ID: ${deviceInfo.id}) timed out. Closing connection.`);
        activeWs.terminate();
      }
    }
  });
}, ESP_TIMEOUT_MS / 2);

// Status logging interval
// ... existing logging code ...

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  // ... existing server start code ...
});