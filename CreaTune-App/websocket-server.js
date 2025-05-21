// websocket-server.js
// WebSocket server for CreaTune - Optimized version
// Structure: Webapp is the server, ESP32 devices are clients

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Web server configuration
const PORT = process.env.PORT || 8080;
const WEB_ROOT = path.join(__dirname, 'web');

// ESP32 configuration
const ESP32_TIMEOUT = 10000; // 10 seconds timeout for more stable connections
const ESP32_GRACE_PERIOD = 3000; // Grace period before fully disconnecting

// Create HTTP server
const server = http.createServer((req, res) => {
  // Map the URL to a file path
  let filePath = path.join(WEB_ROOT, req.url === '/' ? 'index.html' : req.url);
  
  // Check if the path exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If the file doesn't exist, try adding .html extension
      if (path.extname(filePath) === '') {
        filePath += '.html';
        
        // Check if this file exists
        fs.stat(filePath, (err, stats) => {
          if (err || !stats.isFile()) {
            // Still doesn't exist, return 404
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
          }
          
          // File exists with .html extension, serve it
          serveFile(filePath, res);
        });
        return;
      }
      
      // File doesn't exist, return 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    
    // File exists, serve it
    serveFile(filePath, res);
  });
});

// Function to serve a file
function serveFile(filePath, res) {
  const extname = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf'
  }[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      console.error(`Error reading file: ${filePath}`, err);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Connected clients and ESP32 devices
const clients = new Map();
const espDevices = new Map();
const lastESP32Activities = {}; // Track activity by ESP ID

// Track disconnection timers to avoid duplicate disconnect messages
const espDisconnectionTimers = new Map();

let clientIdCounter = 0;
let espIdCounter = 0;

// Application state
const appState = {
  esp1: { connected: false, valid: false, value: null },
  esp2: { connected: false, valid: false, value: null },
  esp3: { connected: false, valid: false, value: null }
};

// Map ESP name to app state key
function getEspIdForSensor(sensorName, sensorType) {
  // Try to determine ESP ID from name or sensor type
  if (sensorName === 'ESP32-1' || sensorType === 'soil') {
    return 'esp1';
  } else if (sensorName === 'ESP32-2' || sensorType === 'light') {
    return 'esp2';
  } else if (sensorName === 'ESP32-3' || sensorType === 'temperature') {
    return 'esp3';
  }
  return null;
}

// Handle new WebSocket connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const clientId = clientIdCounter++;
  
  // Store client info
  clients.set(ws, {
    id: clientId,
    ip: ip,
    isESP32: false,
    lastMessage: Date.now()
  });
  
  console.log(`New connection [${clientId}] from ${ip}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to CreaTune WebSocket Server',
    clientId: clientId
  }));
  
  // Handle messages from clients
  ws.on('message', (message) => {
    const clientInfo = clients.get(ws);
    if (!clientInfo) return; // Client not registered
    
    clientInfo.lastMessage = Date.now();
    
    // Log less frequently for better performance
    if (clientInfo.id % 10 === 0) {
      console.log(`Message from [${clientInfo.id}]: ${message}`);
    }
    
    try {
      // Parse as JSON
      const data = JSON.parse(message);
      
      // Check if it's from ESP32 sensor
      if (data.sensor && data.type === 'sensor_data') {
        // Mark this client as an ESP32
        clientInfo.isESP32 = true;
        
        // Get the sensor name
        const sensorName = data.name || `ESP32-${espIdCounter}`;
        
        // Update last activity time for this ESP32
        lastESP32Activities[sensorName] = Date.now();
        
        // Determine which ESP this is
        const espId = getEspIdForSensor(sensorName, data.sensor);
        
        // Clear any pending disconnection timer for this ESP
        if (espId && espDisconnectionTimers.has(espId)) {
          clearTimeout(espDisconnectionTimers.get(espId));
          espDisconnectionTimers.delete(espId);
          console.log(`Cancelled disconnection timer for ${sensorName}`);
        }
        
        if (espId) {
          // Update ESP status
          const wasConnected = appState[espId].connected;
          appState[espId].connected = true;
          appState[espId].value = data.value;
          
          // Validate data range (0.4 to 0.8)
          appState[espId].valid = data.value !== undefined && 
                                  data.value !== null && 
                                  data.value >= 0.4 && 
                                  data.value <= 0.8;
          
          // If this is a reconnection, notify clients
          if (!wasConnected) {
            console.log(`ESP32 ${sensorName} reconnected`);
            
            // Don't broadcast immediately on every reconnect to reduce state thrashing
            setTimeout(() => {
              // Only broadcast if still connected after a short delay
              if (appState[espId].connected) {
                broadcastState();
              }
            }, 200);
          }
        }
        
        // If not already in espDevices, add it
        if (!espDevices.has(ws)) {
          const espId = espIdCounter++;
          espDevices.set(ws, {
            id: espId,
            name: sensorName,
            lastData: data,
            sensorType: data.sensor
          });
          
          console.log(`Identified ESP32 device [${espId}]: ${sensorName}`);
          
          // Notify web clients about ESP32 connection
          broadcastToWebClients({
            type: 'esp_connected',
            espId: espId,
            name: sensorName
          });
        } else {
          // Update last data
          const espInfo = espDevices.get(ws);
          espInfo.lastData = data;
        }
        
        // Map data to animation frame without reassigning to 'data'
        const mappedData = mapSensorDataToAnimation({...data});
        
        // Broadcast sensor data to web clients
        broadcastToWebClients(mappedData);
        
        // Only broadcast state updates when significant changes occur
        // or every 5th message to reduce network traffic
        if (!wasConnected || clientInfo.id % 5 === 0) {
          broadcastState();
        }
      } 
      else if (data.type === 'heartbeat') {
        // Handle heartbeat from ESP32
        const sensorName = data.client || `Unknown`;
        lastESP32Activities[sensorName] = Date.now();
        
        // No need to respond or broadcast
      }
      else if (data.type === 'hello') {
        // Client identifying itself
        console.log(`Client [${clientInfo.id}] identified as: ${data.client || 'Web Client'}`);
        
        // If it's an ESP32 client, update tracking
        if (data.client && data.client.startsWith('ESP32')) {
          clientInfo.isESP32 = true;
          lastESP32Activities[data.client] = Date.now();
          
          // Update the connection state after a slight delay
          // This ensures we don't broadcast too early before receiving sensor data
          setTimeout(() => {
            // Send current ESP32 status to this client
            sendESP32Status(ws);
            
            // Broadcast updated state to all web clients
            broadcastState();
          }, 300);
        } else {
          // For web clients, send current status immediately
          sendESP32Status(ws);
          
          // Send current application state
          ws.send(JSON.stringify({
            type: 'state_update',
            state: appState
          }));
        }
      }
    } catch (err) {
      console.error(`Error processing message: ${err.message}`);
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    const clientInfo = clients.get(ws);
    if (!clientInfo) return;
    
    console.log(`Client [${clientInfo.id}] disconnected`);
    
    // Remove from ESP32 list if it was an ESP32
    if (espDevices.has(ws)) {
      const espInfo = espDevices.get(ws);
      console.log(`ESP32 device [${espInfo.id}] disconnected: ${espInfo.name}`);
      
      // Determine which ESP ID this corresponds to
      const espStateId = getEspIdForSensor(espInfo.name, espInfo.sensorType || espInfo.lastData?.sensor);
      
      if (espStateId) {
        // Don't immediately mark as disconnected - start a grace period
        // This prevents state thrashing if the ESP32 reconnects quickly
        if (!espDisconnectionTimers.has(espStateId)) {
          console.log(`Starting grace period for ${espInfo.name}`);
          
          const disconnectTimer = setTimeout(() => {
            // Only proceed if we still don't have activity
            const lastActivity = lastESP32Activities[espInfo.name] || 0;
            const elapsed = Date.now() - lastActivity;
            
            if (elapsed >= ESP32_GRACE_PERIOD) {
              console.log(`Grace period ended: ${espInfo.name} officially disconnected`);
              
              // Mark as disconnected
              appState[espStateId].connected = false;
              appState[espStateId].valid = false;
              appState[espStateId].value = null;
              
              // Notify other clients
              broadcastToWebClients({
                type: 'esp_disconnected',
                espId: espInfo.id,
                name: espInfo.name
              });
              
              // Broadcast updated state
              broadcastState();
              
              // Remove from tracking fully
              delete lastESP32Activities[espInfo.name];
            }
            
            // Clean up timer
            espDisconnectionTimers.delete(espStateId);
          }, ESP32_GRACE_PERIOD);
          
          // Store the timer
          espDisconnectionTimers.set(espStateId, disconnectTimer);
        }
      }
      
      // Remove from espDevices map
      espDevices.delete(ws);
    }
    
    // Remove from clients map
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      console.error(`WebSocket error for client [${clientInfo.id}]:`, error);
    } else {
      console.error(`WebSocket error for unknown client:`, error);
    }
  });
});

// Broadcast message to all non-ESP32 clients
function broadcastToWebClients(data, exclude = null) {
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      // Only send to clients that are not ESP32 devices
      const clientInfo = clients.get(client);
      if (!clientInfo || !clientInfo.isESP32) {
        client.send(JSON.stringify(data));
      }
    }
  });
}

// Broadcast current application state
function broadcastState() {
  broadcastToWebClients({
    type: 'state_update',
    state: appState
  });
}

// Send ESP32 status to a specific client
function sendESP32Status(ws) {
  const espStatus = [];
  
  // Collect status from all ESP32 devices
  for (const [espWs, espInfo] of espDevices.entries()) {
    // Find corresponding state ID
    const stateId = getEspIdForSensor(espInfo.name, espInfo.sensorType || espInfo.lastData?.sensor);
    const isValid = stateId ? appState[stateId].valid : false;
    
    espStatus.push({
      id: espInfo.id,
      name: espInfo.name,
      lastData: espInfo.lastData,
      connected: espWs.readyState === WebSocket.OPEN,
      valid: isValid
    });
  }
  
  // Send status
  ws.send(JSON.stringify({
    type: 'esp_status',
    devices: espStatus
  }));
}

// Map sensor data to animation frames
function mapSensorDataToAnimation(data) {
  // Create a copy to avoid modifying the original
  const result = {...data};
  
  if (result.type === 'sensor_data' && result.value !== undefined) {
    // Normalize value between 0 and 1
    const normalizedValue = Math.min(1, Math.max(0, result.value));
    
    // Map to frame index (1-11)
    const frameIndex = Math.ceil(normalizedValue * 11);
    
    // Add frame index to data
    result.frameIndex = frameIndex;
    
    // Log less frequently for better performance
    if (Math.random() < 0.05) {
      console.log(`Mapped sensor value ${result.value} to frame ${frameIndex}`);
    }
  }
  
  return result;
}

// Consolidated ESP32 activity check (less frequent)
setInterval(() => {
  const now = Date.now();
  
  // Check each ESP32 device for timeout, only if not already in grace period
  for (const [espName, lastActivity] of Object.entries(lastESP32Activities)) {
    const elapsed = now - lastActivity;
    
    if (elapsed > ESP32_TIMEOUT) {
      // Determine which ESP this is
      let espStateId = null;
      let espInstance = null;
      
      // Find the matching ESP device
      for (const [wsClient, espInfo] of espDevices.entries()) {
        if (espInfo.name === espName) {
          espStateId = getEspIdForSensor(espName, espInfo.sensorType || espInfo.lastData?.sensor);
          espInstance = espInfo;
          
          // Check if we're already in a grace period
          if (espStateId && !espDisconnectionTimers.has(espStateId)) {
            console.log(`ESP32 ${espName} timed out - no data for ${elapsed}ms`);
            
            // Start grace period timer
            const disconnectTimer = setTimeout(() => {
              // Double-check time since last activity
              const currentLastActivity = lastESP32Activities[espName] || 0;
              const currentElapsed = Date.now() - currentLastActivity;
              
              if (currentElapsed >= ESP32_TIMEOUT) {
                console.log(`ESP32 ${espName} officially disconnected after timeout`);
                
                // Mark as disconnected
                if (espStateId) {
                  appState[espStateId].connected = false;
                  appState[espStateId].valid = false;
                  appState[espStateId].value = null;
                }
                
                // Notify clients (only once)
                broadcastToWebClients({
                  type: 'esp_disconnected',
                  espId: espInstance.id,
                  name: espName
                });
                
                // Broadcast updated state
                broadcastState();
                
                // Remove from tracking if webSocket is closed
                if (wsClient.readyState !== WebSocket.OPEN) {
                  espDevices.delete(wsClient);
                  delete lastESP32Activities[espName];
                }
              }
              
              // Clean up timer
              espDisconnectionTimers.delete(espStateId);
            }, ESP32_GRACE_PERIOD);
            
            // Store timer
            espDisconnectionTimers.set(espStateId, disconnectTimer);
          }
          
          break;
        }
      }
    }
  }
}, 2000); // Check every 2 seconds - less frequent for stability

// Cleanup inactive clients periodically (less frequent)
setInterval(() => {
  const now = Date.now();
  
  // Check for inactive clients (no message in 5 minutes)
  for (const [ws, info] of clients.entries()) {
    if (now - info.lastMessage > 5 * 60 * 1000) {
      console.log(`Closing inactive connection [${info.id}]`);
      ws.terminate();
    }
  }
  
  // Log status
  const espCount = espDevices.size;
  const clientCount = clients.size - espCount;
  
  console.log(`Status: ${espCount} ESP32 devices, ${clientCount} web clients connected`);
}, 60000); // Once per minute - less frequent

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔════════════════════════════════════════════════╗
  ║  CreaTune WebSocket Server                     ║
  ║  Server running on port ${PORT.toString().padEnd(20, ' ')} ║
  ║  Web files serving from ${WEB_ROOT.padEnd(20, ' ')} ║
  ╚════════════════════════════════════════════════╝
  `);
  console.log(`Point your browser to http://localhost:${PORT}`);
});