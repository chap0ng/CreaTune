// websocket-server.js
// Enhanced WebSocket server with proper ESP32 device tracking

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
      //fs.createReadStream("index.html").pipe(res);
      res.end(content, 'utf-8');
    }
  });
}

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Client tracking
const clients = new Map();
let clientIdCounter = 0;

// ✅ FIXED: ESP32 device tracking by sensor name (not WebSocket object)
const espDevices = new Map(); // Key: sensor name, Value: device info
const espConnections = new Map(); // Key: sensor name, Value: current WebSocket
let espIdCounter = 0;

// Handle new connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const clientId = clientIdCounter++;
  
  // Store client info
  clients.set(ws, {
    id: clientId,
    ip: ip,
    isESP32: false,
    espSensorName: null, // Track which sensor this connection represents
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
    clientInfo.lastMessage = Date.now();
    
    console.log(`Message from [${clientInfo.id}]: ${message}`);
    
    try {
      // Try to parse as JSON
      const data = JSON.parse(message);
      
      // Check if it's from ESP32 sensor
      if (data.sensor && data.type === 'sensor_data') {
        handleESP32Data(ws, data, clientInfo);
      } else {
        // Regular message from a web client
        // Broadcast to all other web clients
        broadcastToWebClients(data, ws);
      }
    } catch (err) {
      // Not JSON, treat as plain text
      console.log(`Non-JSON message from [${clientInfo.id}]: ${message}`);
      
      // Broadcast text message to all web clients except sender
      broadcastToWebClients({
        type: 'text',
        message: message.toString(),
        from: clientInfo.id
      }, ws);
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    const clientInfo = clients.get(ws);
    console.log(`Client [${clientInfo.id}] disconnected`);
    
    // Handle ESP32 disconnection
    if (clientInfo.isESP32 && clientInfo.espSensorName) {
      handleESP32Disconnect(clientInfo.espSensorName, ws);
    }
    
    // Remove from clients map
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client [${clients.get(ws).id}]:`, error);
  });
});

// ✅ FIXED: Handle ESP32 data with proper device tracking
function handleESP32Data(ws, data, clientInfo) {
  const sensorName = data.sensor;
  
  // Mark this client as an ESP32
  clientInfo.isESP32 = true;
  clientInfo.espSensorName = sensorName;
  
  // Check if this is a new ESP32 device (by sensor name)
  if (!espDevices.has(sensorName)) {
    // New device - create entry
    const espId = espIdCounter++;
    espDevices.set(sensorName, {
      id: espId,
      name: sensorName,
      firstSeen: Date.now(),
      connectionCount: 1
    });
    
    console.log(`✅ NEW ESP32 device registered: [${espId}] ${sensorName}`);
  } else {
    // Existing device - check if it's a reconnection
    const existingDevice = espDevices.get(sensorName);
    const currentConnection = espConnections.get(sensorName);
    
    if (!currentConnection || currentConnection.readyState !== WebSocket.OPEN) {
      // Device reconnected
      existingDevice.connectionCount++;
      console.log(`🔄 ESP32 device reconnected: [${existingDevice.id}] ${sensorName} (connection #${existingDevice.connectionCount})`);
    }
  }
  
  // Update device info
  const deviceInfo = espDevices.get(sensorName);
  deviceInfo.lastData = data;
  deviceInfo.lastSeen = Date.now();
  
  // Update current connection mapping
  espConnections.set(sensorName, ws);
  
  // Broadcast sensor data to all web clients
  broadcastToWebClients(data);
  
  console.log(`📊 Data from ${sensorName}:`, JSON.stringify(data, null, 2));
}

// ✅ FIXED: Handle ESP32 disconnection properly
function handleESP32Disconnect(sensorName, ws) {
  const deviceInfo = espDevices.get(sensorName);
  if (!deviceInfo) return;
  
  console.log(`🔌❌ ESP32 device disconnected: [${deviceInfo.id}] ${sensorName}`);
  
  // Remove connection mapping
  const currentConnection = espConnections.get(sensorName);
  if (currentConnection === ws) {
    espConnections.delete(sensorName);
  }
  
  // Keep device info but mark as disconnected
  deviceInfo.lastDisconnected = Date.now();
  
  // Notify web clients about ESP32 disconnection
  broadcastToWebClients({
    type: 'esp_disconnected',
    espId: deviceInfo.id,
    name: sensorName
  });
}

// Broadcast message to all web clients (non-ESP32)
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

// ✅ FIXED: Send ESP32 status based on sensor names
function sendESP32Status(ws) {
  const espStatus = [];
  
  // Collect status from all ESP32 devices
  for (const [sensorName, deviceInfo] of espDevices.entries()) {
    const connection = espConnections.get(sensorName);
    const isConnected = connection && connection.readyState === WebSocket.OPEN;
    
    espStatus.push({
      id: deviceInfo.id,
      name: sensorName,
      lastData: deviceInfo.lastData,
      connected: isConnected,
      connectionCount: deviceInfo.connectionCount,
      firstSeen: deviceInfo.firstSeen,
      lastSeen: deviceInfo.lastSeen
    });
  }
  
  // Send status
  ws.send(JSON.stringify({
    type: 'esp_status',
    devices: espStatus
  }));
}

// Enhanced cleanup and status updates
setInterval(() => {
  const now = Date.now();
  
  // Check for inactive clients (no message in 5 minutes)
  for (const [ws, info] of clients.entries()) {
    if (now - info.lastMessage > 5 * 60 * 1000) {
      console.log(`Closing inactive connection [${info.id}]`);
      ws.terminate();
    }
  }
  
  // Clean up stale ESP32 connections
  for (const [sensorName, ws] of espConnections.entries()) {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log(`🧹 Cleaning up stale connection for ${sensorName}`);
      espConnections.delete(sensorName);
    }
  }
  
  // Status report
  const activeESPCount = espConnections.size;
  const totalESPDevices = espDevices.size;
  const webClientCount = clients.size - espConnections.size;
  
  console.log(`📊 Status: ${activeESPCount}/${totalESPDevices} ESP32 devices active, ${webClientCount} web clients`);
  
  // Log device details every 30 seconds
  if (now % 30000 < 1000) {
    console.log('\n📱 ESP32 Device Status:');
    for (const [sensorName, deviceInfo] of espDevices.entries()) {
      const connection = espConnections.get(sensorName);
      const isConnected = connection && connection.readyState === WebSocket.OPEN;
      console.log(`  [${deviceInfo.id}] ${sensorName}: ${isConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'} (connections: ${deviceInfo.connectionCount})`);
    }
    console.log('');
  }
}, 1000);

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔════════════════════════════════════════════════╗
  ║  CreaTune WebSocket Server (FIXED)             ║
  ║  Server running on port ${PORT.toString().padEnd(20, ' ')} ║
  ║  Web files serving from ${WEB_ROOT.padEnd(20, ' ')} ║
  ╚════════════════════════════════════════════════╝
  `);
  console.log(`Point your browser to http://localhost:${PORT}`);
});