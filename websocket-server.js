// websocket-server.js
// Enhanced WebSocket server for CreaTune

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

// Client tracking
const clients = new Map();
let clientIdCounter = 0;

// Connected ESP32 devices
const espDevices = new Map();
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
        // Mark this client as an ESP32
        clientInfo.isESP32 = true;
        
        // If not already in espDevices, add it
        if (!espDevices.has(ws)) {
          const espId = espIdCounter++;
          espDevices.set(ws, {
            id: espId,
            name: data.sensor || `ESP32-${espId}`,
            lastData: data
          });
          
          console.log(`Identified ESP32 device [${espId}]: ${data.sensor}`);
        }
        
        // Update last data
        const espInfo = espDevices.get(ws);
        espInfo.lastData = data;
        
        // Broadcast sensor data to all web clients
        broadcastToWebClients(data);
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
    
    // Remove from ESP32 list if it was an ESP32
    if (espDevices.has(ws)) {
      const espInfo = espDevices.get(ws);
      console.log(`ESP32 device [${espInfo.id}] disconnected: ${espInfo.name}`);
      espDevices.delete(ws);
      
      // Notify web clients about ESP32 disconnection
      broadcastToWebClients({
        type: 'esp_disconnected',
        espId: espInfo.id,
        name: espInfo.name
      });
    }
    
    // Remove from clients map
    clients.delete(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client [${clients.get(ws).id}]:`, error);
  });
});

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

// Periodic cleanup and status updates
setInterval(() => {
  const now = Date.now();
  
  // Check for inactive clients (no message in 5 minutes)
  for (const [ws, info] of clients.entries()) {
    if (now - info.lastMessage > 5 * 60 * 1000) {
      console.log(`Closing inactive connection [${info.id}]`);
      ws.terminate();
    }
  }
  
  // Broadcast ESP32 status every 10 seconds
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
  ║  CreaTune WebSocket Server                     ║
  ║  Server running on port ${PORT.toString().padEnd(20, ' ')} ║
  ║  Web files serving from ${WEB_ROOT.padEnd(20, ' ')} ║
  ╚════════════════════════════════════════════════╝
  `);
  console.log(`Point your browser to http://localhost:${PORT}`);
});
