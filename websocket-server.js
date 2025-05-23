// websocket-server.js
// Enhanced WebSocket server for CreaTune

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Web server configuration
const PORT = process.env.PORT || 8080;
const WEB_ROOT = path.join(__dirname, 'web'); // FIXED: Serve from web/ directory

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
            console.log(`404 - File not found: ${req.url}`);
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
      console.log(`404 - File not found: ${req.url}`);
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
      console.log(`✅ Served: ${path.relative(WEB_ROOT, filePath)}`);
    }
  });
}

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Client tracking
const clients = new Map();
let clientIdCounter = 0;

// Connected ESP32 devices
const espDevices = new Map();
let espIdCounter = 0;

// Identify ESP32 device type
function identifyESP32DeviceType(data) {
  const sensor = (data.sensor || '').toLowerCase();
  const message = (data.message || '').toLowerCase();
  
  if (sensor.includes('soil') || sensor.includes('moisture') || 
      data.soilMoisture !== undefined || data.moisture !== undefined) return 'soil';
  if (sensor.includes('light') || sensor.includes('lux') || 
      data.lightLevel !== undefined || data.lux !== undefined) return 'light';
  if (sensor.includes('temp') || sensor.includes('temperature') || 
      data.temperature !== undefined || data.temp !== undefined) return 'temp';
  
  return null;
}

// Handle new connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const clientId = clientIdCounter++;
  
  // Store client info
  clients.set(ws, {
    id: clientId,
    ip: ip,
    isESP32: false,
    deviceType: null,
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
      
      // Handle message types
      if (data.type === 'request_esp_status') {
        sendESP32Status(ws);
      } else if (data.sensor && data.type === 'sensor_data') {
        handleSensorData(ws, data, clientInfo);
      } else if (data.sensor || data.value !== undefined || data.temperature !== undefined || 
                 data.lightLevel !== undefined || data.soilMoisture !== undefined) {
        // Treat as sensor data even without explicit type
        data.type = 'sensor_data';
        handleSensorData(ws, data, clientInfo);
      } else {
        // Regular message from web client
        broadcastToWebClients(data, ws);
      }
    } catch (err) {
      // Not JSON, treat as plain text - could be from ESP32
      console.log(`Non-JSON message from [${clientInfo.id}]: ${message}`);
      
      const messageStr = message.toString();
      if (messageStr.includes('soil') || messageStr.includes('light') || messageStr.includes('temp')) {
        // Parse as sensor data
        const sensorData = {
          type: 'sensor_data',
          sensor: messageStr,
          value: parseFloat(messageStr.match(/\d+\.?\d*/)?.[0]) || 0,
          timestamp: Date.now(),
          raw: messageStr
        };
        handleSensorData(ws, sensorData, clientInfo);
      } else {
        // Broadcast text message
        broadcastToWebClients({
          type: 'text',
          message: messageStr,
          from: clientInfo.id
        }, ws);
      }
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    const clientInfo = clients.get(ws);
    console.log(`Client [${clientInfo.id}] disconnected`);
    
    // If it was an ESP32, notify web clients
    if (espDevices.has(ws)) {
      const espInfo = espDevices.get(ws);
      console.log(`🔌❌ ESP32 device [${espInfo.id}] DISCONNECTED: ${espInfo.name}`);
      espDevices.delete(ws);
      
      // Notify web clients
      broadcastToWebClients({
        type: 'esp_disconnected',
        espId: espInfo.id,
        name: espInfo.name,
        deviceType: espInfo.deviceType,
        timestamp: Date.now()
      });
    }
    
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client [${clients.get(ws).id}]:`, error);
  });
});

// Handle sensor data from ESP32
function handleSensorData(ws, data, clientInfo) {
  const deviceType = identifyESP32DeviceType(data);
  
  // Mark as ESP32
  clientInfo.isESP32 = true;
  clientInfo.deviceType = deviceType;
  
  // Add to ESP devices if new
  if (!espDevices.has(ws)) {
    const espId = espIdCounter++;
    const deviceName = deviceType || `ESP32-${espId}`;
    
    espDevices.set(ws, {
      id: espId,
      name: deviceName,
      deviceType: deviceType,
      lastData: data,
      connected: Date.now()
    });
    
    console.log(`🔌 ESP32 device [${espId}]: ${deviceName}`);
  } else {
    // Update existing device
    const espInfo = espDevices.get(ws);
    espInfo.lastData = data;
  }
  
  // Add device info to data
  const enhancedData = {
    ...data,
    type: 'sensor_data',
    espId: espDevices.get(ws).id,
    deviceType: deviceType,
    timestamp: data.timestamp || Date.now()
  };
  
  // Broadcast to web clients
  broadcastToWebClients(enhancedData);
}

// Broadcast message to all web clients (non-ESP32)
function broadcastToWebClients(data, exclude = null) {
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      const clientInfo = clients.get(client);
      if (!clientInfo || !clientInfo.isESP32) {
        client.send(JSON.stringify(data));
      }
    }
  });
}

// Send ESP32 status to a specific client
function sendESP32Status(ws) {
  const espStatus = [];
  
  for (const [espWs, espInfo] of espDevices.entries()) {
    espStatus.push({
      id: espInfo.id,
      name: espInfo.name,
      deviceType: espInfo.deviceType,
      lastData: espInfo.lastData,
      connected: espWs.readyState === WebSocket.OPEN
    });
  }
  
  ws.send(JSON.stringify({
    type: 'esp_status',
    devices: espStatus
  }));
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  
  // Check for inactive clients
  for (const [ws, info] of clients.entries()) {
    if (now - info.lastMessage > 30 * 1000) {
      console.log(`Closing inactive connection [${info.id}]`);
      ws.terminate();
    }
  }
  
  // Log status every 10 seconds
  if (now % 10000 < 1000) {
    const espCount = espDevices.size;
    const clientCount = clients.size - espCount;
    console.log(`Status: ${espCount} ESP32 devices, ${clientCount} web clients connected`);
  }
}, 1000);

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔════════════════════════════════════════════════╗
  ║  🎵 CreaTune WebSocket Server                  ║
  ║  Server running on port ${PORT.toString().padEnd(20, ' ')} ║
  ║  Serving files from ${WEB_ROOT.padEnd(25, ' ')} ║
  ╚════════════════════════════════════════════════╝
  `);
  console.log(`📱 Point your Nothing Phone to: http://YOUR_SERVER_IP:${PORT}`);
  console.log(`💻 Local access: http://localhost:${PORT}`);
});