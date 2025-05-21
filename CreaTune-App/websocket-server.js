// websocket-server.js
// Simplified WebSocket server for CreaTune
// Structure: Webapp is the server, ESP32 devices are clients

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Web server configuration
const PORT = process.env.PORT || 8080;
const WEB_ROOT = path.join(__dirname, 'web');

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

let clientIdCounter = 0;
let espIdCounter = 0;

// Application state
const appState = {
  esp1: { connected: false, valid: false, value: null },
  esp2: { connected: false, valid: false, value: null },
  esp3: { connected: false, valid: false, value: null }
};

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
    if (!clientInfo) return;
    
    clientInfo.lastMessage = Date.now();
    
    try {
      // Parse as JSON
      const data = JSON.parse(message);
      
      // Check if it's from ESP32 sensor
      if (data.sensor && data.type === 'sensor_data') {
        // Mark this client as an ESP32
        clientInfo.isESP32 = true;
        
        // Get the sensor name
        const sensorName = data.name || `ESP32-${espIdCounter}`;
        
        // Determine which ESP this is
        let espId = null;
        if (data.sensor === 'soil' || sensorName === 'ESP32-1' || sensorName === 'MoistureSensor') {
          espId = 'esp1';
        } else if (data.sensor === 'light' || sensorName === 'ESP32-2') {
          espId = 'esp2';
        } else if (data.sensor === 'temperature' || sensorName === 'ESP32-3') {
          espId = 'esp3';
        }
        
        if (espId) {
          // Update ESP status
          appState[espId].connected = true;
          appState[espId].value = data.value;
          
          // Validate data range (0.4 to 0.8)
          appState[espId].valid = data.value !== undefined && 
                                  data.value !== null && 
                                  data.value >= 0.4 && 
                                  data.value <= 0.8;
        }
        
        // If not already in espDevices, add it
        if (!espDevices.has(ws)) {
          const espLocalId = espIdCounter++;
          espDevices.set(ws, {
            id: espLocalId,
            name: sensorName,
            lastData: data,
            espStateId: espId
          });
          
          console.log(`Identified ESP32 device [${espLocalId}]: ${sensorName}`);
          
          // Notify other clients about ESP32 connection
          broadcastToWebClients({
            type: 'esp_connected',
            espId: espLocalId,
            name: sensorName
          });
        } else {
          // Update last data
          const espInfo = espDevices.get(ws);
          espInfo.lastData = data;
        }
        
        // Map data to animation frame
        const mappedData = mapSensorDataToAnimation({...data});
        
        // Broadcast sensor data to web clients
        broadcastToWebClients(mappedData);
        
        // Broadcast updated state periodically (not on every message)
        if (clientInfo.id % 3 === 0) {
          broadcastState();
        }
      } 
      else if (data.type === 'heartbeat') {
        // Handle heartbeat from ESP32 - just acknowledge receipt
        if (data.client) {
          console.log(`Heartbeat from ${data.client}`);
        }
      }
      else if (data.type === 'hello') {
        // Client identifying itself
        console.log(`Client [${clientInfo.id}] identified as: ${data.client || 'Web Client'}`);
        
        // If this is an ESP32, mark it as such
        if (data.client && data.client.indexOf('ESP32') >= 0) {
          clientInfo.isESP32 = true;
        }
        
        // Send current ESP32 status
        sendESP32Status(ws);
        
        // Send current application state
        ws.send(JSON.stringify({
          type: 'state_update',
          state: appState
        }));
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
      
      // Update application state
      if (espInfo.espStateId) {
        appState[espInfo.espStateId].connected = false;
        appState[espInfo.espStateId].valid = false;
        appState[espInfo.espStateId].value = null;
      }
      
      // Remove from tracking
      espDevices.delete(ws);
      
      // Notify other clients
      broadcastToWebClients({
        type: 'esp_disconnected',
        espId: espInfo.id,
        name: espInfo.name
      });
      
      // Broadcast updated state
      broadcastState();
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
    espStatus.push({
      id: espInfo.id,
      name: espInfo.name,
      lastData: espInfo.lastData,
      connected: espWs.readyState === WebSocket.OPEN
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
  }
  
  return result;
}

// Cleanup inactive clients periodically
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
}, 30000);

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