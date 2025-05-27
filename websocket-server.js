// websocket-server.js
// Enhanced WebSocket server with proper ESP32 device tracking and faster disconnection detection

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os'); // For network interface logging

// Web server configuration
const PORT = process.env.PORT || 8080;
const WEB_ROOT = path.join(__dirname, 'web');

// Create HTTP server
const server = http.createServer((req, res) => {
  let filePath = path.join(WEB_ROOT, req.url === '/' ? 'index.html' : req.url);
  const extname = path.extname(filePath);

  // Security: Prevent directory traversal
  if (!filePath.startsWith(WEB_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    console.warn(`Forbidden access attempt: ${req.url}`);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // If file not found, try serving index.html for SPA-like behavior (optional)
        // For PWAs, usually specific asset paths are expected.
        // For now, just 404.
        console.warn(`File not found: ${filePath}, URL: ${req.url}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        console.error(`Error stating file: ${filePath}`, err);
      }
    } else {
      if (stats.isDirectory()) {
        // If it's a directory, try serving index.html from that directory
        filePath = path.join(filePath, 'index.html');
        fs.stat(filePath, (dirIndexErr, dirIndexStats) => {
          if (dirIndexErr || !dirIndexStats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found (Directory index not found)');
            console.warn(`Directory index not found: ${filePath}`);
          } else {
            serveFile(filePath, res, 'text/html');
          }
        });
      } else {
        serveFile(filePath, res, getContentType(extname));
      }
    }
  });
});

function getContentType(extname) {
  return {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.webmanifest': 'application/manifest+json' // For manifest.json if named .webmanifest
  }[extname.toLowerCase()] || 'application/octet-stream';
}

function serveFile(filePath, res, contentType) {
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
const wss = new WebSocket.Server({ 
  server,
  // Enhanced ping settings for faster disconnection detection
  pingInterval: 2000, // Send ping every 2 seconds
  pingTimeout: 3000   // Consider connection dead if no pong in 3 seconds
});

// Client tracking
const clients = new Map(); // Key: clientId, Value: { ws, type: 'web' | 'esp', sensorName (if esp) }
let clientIdCounter = 0;

// ESP32 device tracking
const espDevices = new Map(); // Key: sensorName, Value: { id (espIdCounter), ws, lastSeen, connectionCount }
const espConnections = new Map(); // Key: sensorName, Value: WebSocket object (current active ws for that sensor)
let espIdCounter = 0;

// Timeout and Ping settings
const PING_INTERVAL_MS = 2000;  // 2 seconds (much more aggressive)
const ESP_TIMEOUT_MS = 3000;    // 3 seconds timeout for ESPs
const CLIENT_TIMEOUT_MS = 30000;// For web clients (longer timeout)

// Enhanced heartbeat function to track connection health
function heartbeat() {
  this.isAlive = true;
  this.lastPong = Date.now();
}

// Handle new connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const uniqueClientId = clientIdCounter++; // This is for all connections (web or ESP)
  
  // Set up connection health tracking
  ws.isAlive = true;
  ws.lastPong = Date.now();
  ws.on('pong', heartbeat);
  
  // Initially, we don't know if it's an ESP or a web client.
  // We'll determine type based on the first message.
  clients.set(uniqueClientId, { ws, type: 'unknown', ip });
  console.log(`➕ New connection (ID: ${uniqueClientId}) from ${ip}. Awaiting identification...`);

  ws.on('message', (message) => {
    // Mark as alive on any message
    ws.isAlive = true;
    ws.lastPong = Date.now();
    
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
        ws.deviceType = 'esp';
        ws.sensorName = data.sensorName;
        handleESPHandshake(ws, data.sensorName, uniqueClientId, ip);
        
        // Send immediate ping to establish connection health
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (err) {
            console.error(`Failed initial ping to ESP32 ${data.sensorName}:`, err.message);
          }
        }
      } else {
        // Assume it's a web client if not an ESP handshake
        clientInfo.type = 'web';
        ws.deviceType = 'web';
        console.log(`💻 Client ID ${uniqueClientId} identified as WEB CLIENT.`);
        ws.send(JSON.stringify({ type: 'welcome', clientId: uniqueClientId, message: 'Connected to CreaTune Web Server' }));
        // Send current status of ESP devices to this new web client
        sendESP32StatusToSingleClient(ws);
      }
    }

    // Process message based on identified type
    if (clientInfo.type === 'esp') {
      handleESP32Data(ws, data, clientInfo.sensorName);
    } else if (clientInfo.type === 'web') {
      // Handle messages from web clients if any (e.g., requests for status)
      if (data.type === 'get_esp_status') {
        sendESP32StatusToSingleClient(ws);
      } else if (data.type === 'pong') {
        // Client responded to our ping with an application-level pong
        ws.lastPong = Date.now();
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
    // 'close' event will usually follow, handling cleanup.
  });
});

function handleESPHandshake(ws, sensorName, uniqueClientId, ip) {
  console.log(`🤝 ESP32 Handshake: ${sensorName} (Client ID: ${uniqueClientId}) from ${ip}`);
  
  // If another ESP with the same name is already connected, close the old one.
  if (espConnections.has(sensorName)) {
    const oldWs = espConnections.get(sensorName);
    if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
      console.warn(`⚠️  Duplicate ESP32 name '${sensorName}'. Closing older connection.`);
      oldWs.send(JSON.stringify({ type: 'error', message: 'Replaced by new connection' }));
      oldWs.terminate(); // Force close the old connection
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
  
  deviceInfo.ws = ws; // Store the WebSocket object with the device info
  deviceInfo.lastSeen = Date.now();
  deviceInfo.connectionCount++;
  deviceInfo.ip = ip; // Update IP on new handshake
  espConnections.set(sensorName, ws); // Track current active WebSocket for this sensor name

  // Send handshake acknowledgment with heartbeat settings
  ws.send(JSON.stringify({ 
    type: 'handshake_ack', 
    message: `ESP32 ${sensorName} connected`, 
    espId: deviceInfo.id,
    heartbeat_interval: PING_INTERVAL_MS,   // Tell ESP32 how often to send heartbeats
    heartbeat_enabled: true                 // Enable heartbeats on ESP32
  }));
  
  broadcastToWebClients({ type: 'esp_connected', name: sensorName, id: deviceInfo.id, ip: deviceInfo.ip });
  broadcastESPStatusUpdate();
}

function handleESP32Data(ws, data, sensorName) {
  const deviceInfo = espDevices.get(sensorName);
  if (deviceInfo) {
    deviceInfo.lastSeen = Date.now();
    
    // Handle explicit heartbeat messages
    if (data.type === 'heartbeat' || data.type === 'pong') {
      // Just update lastSeen, don't broadcast heartbeats to clients
      return;
    }
    
    // Add device_type to data before broadcasting if not present, using sensorName
    if (!data.device_type) {
        data.device_type = sensorName.toLowerCase(); // e.g., "soil", "light"
    }
    
    // console.log(`📡 From ${sensorName} (ID: ${deviceInfo.id}):`, data); // Can be verbose
    broadcastToWebClients({ type: 'sensor_data', ...data, sensor: sensorName, espId: deviceInfo.id });
  } else {
    console.warn(`⚠️ Received data from unknown or disconnected ESP: ${sensorName}. Requesting handshake.`);
    ws.send(JSON.stringify({ type: 'request_handshake', message: 'Identify yourself' }));
  }
}

function handleESP32Disconnect(sensorName, wsInstance, reason = "Unknown reason") {
  const currentConnection = espConnections.get(sensorName);
  // Only process disconnect if it's the currently tracked active connection for this sensorName
  if (currentConnection === wsInstance) {
    console.log(`🔌❌ ESP32 '${sensorName}' disconnected. Reason: ${reason}`);
    espConnections.delete(sensorName); // Remove from active connections
    
    // Don't delete from espDevices, just mark as disconnected for status updates
    // The checkESPConnections interval will handle actual timeout and removal from espDevices if needed
    
    broadcastToWebClients({ type: 'esp_disconnected', name: sensorName });
    broadcastESPStatusUpdate();
  } else {
    // This means an older, already replaced WebSocket instance for this sensorName is closing.
    // console.log(`🔌 ESP32 '${sensorName}' (older instance) disconnected.`);
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
  const status = [];
  espDevices.forEach((deviceInfo, sensorName) => {
    const isActiveConnection = espConnections.has(sensorName) && espConnections.get(sensorName).readyState === WebSocket.OPEN;
    status.push({
      name: sensorName,
      id: deviceInfo.id,
      connected: isActiveConnection,
      lastSeen: deviceInfo.lastSeen,
      ip: deviceInfo.ip
    });
  });
  ws.send(JSON.stringify({ type: 'esp_status_list', devices: status }));
}

function broadcastESPStatusUpdate() {
  const status = [];
  espDevices.forEach((deviceInfo, sensorName) => {
    const isActiveConnection = espConnections.has(sensorName) && espConnections.get(sensorName).readyState === WebSocket.OPEN;
    status.push({
      name: sensorName,
      id: deviceInfo.id,
      connected: isActiveConnection,
      lastSeen: deviceInfo.lastSeen,
      ip: deviceInfo.ip
    });
  });
  broadcastToWebClients({ type: 'esp_status_list', devices: status });
}

// Send regular pings to all clients to keep connections alive
// and detect disconnections quickly
const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  
  wss.clients.forEach((ws) => {
    // If connection hasn't responded to pings, terminate it
    if (ws.isAlive === false) {
      // For ESP32, trigger clean disconnect handling
      if (ws.deviceType === 'esp' && ws.sensorName) {
        console.warn(`💔 ESP32 '${ws.sensorName}' failed heartbeat check. Terminating connection.`);
        handleESP32Disconnect(ws.sensorName, ws, "Failed heartbeat");
      }
      
      ws.terminate();
      return;
    }
    
    // For ESP32s, check time since last pong/activity
    if (ws.deviceType === 'esp' && ws.sensorName) {
      if (now - ws.lastPong > ESP_TIMEOUT_MS) {
        console.warn(`⌛ ESP32 '${ws.sensorName}' heartbeat timeout (${(now - ws.lastPong)/1000}s). Terminating.`);
        handleESP32Disconnect(ws.sensorName, ws, "Heartbeat timeout");
        ws.terminate();
        return;
      }
    }
    
    // Mark as not alive until we get a pong response
    ws.isAlive = false;
    
    // Send both a WebSocket ping and an application-level ping
    try {
      // WebSocket protocol ping (triggers ws 'pong' event)
      ws.ping();
      
      // Application-level ping (for clients that might not support WebSocket ping/pong)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    } catch (e) {
      console.error('Failed to send ping:', e);
      ws.terminate();
    }
  });
}, PING_INTERVAL_MS);

// Clean up interval on server close
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Interval to check for unresponsive ESP32 connections
// This is a backup to the more aggressive heartbeat mechanism
setInterval(() => {
  const now = Date.now();
  espDevices.forEach((deviceInfo, sensorName) => {
    const activeWs = espConnections.get(sensorName);
    if (activeWs) { // If there's an active connection tracked
      if (now - deviceInfo.lastSeen > ESP_TIMEOUT_MS * 2) {
        console.warn(`⌛ ESP32 '${sensorName}' (ID: ${deviceInfo.id}) timed out. Closing connection.`);
        activeWs.terminate(); // This will trigger the 'close' event for this ws
      }
    }
  });
}, ESP_TIMEOUT_MS); // Check regularly

// Status logging interval
let activeESPCountForLog = 0; // To be updated by actual logic if needed for this log
setInterval(() => {
  const now = Date.now();
  const totalESPInDeviceMap = espDevices.size;
  const connectedESPCount = espConnections.size; // Number of currently active ESP connections

  let webClientCount = 0;
  clients.forEach(client => {
    if (client.type === 'web') webClientCount++;
  });
  
  console.log(`📊 Status: ${connectedESPCount}/${totalESPInDeviceMap} ESP32 devices connected, ${webClientCount} web clients. Total clients in map: ${clients.size}`);
  
  // Log device details every 30 seconds
  if (Math.floor(now / 1000) % 30 === 0) { // Simpler way to log every 30s
    console.log('\n📱 ESP32 Device Status Details:');
    if (espDevices.size === 0) {
        console.log('  No ESP32 devices registered yet.');
    } else {
        espDevices.forEach((deviceInfo, sensorName) => {
            const connection = espConnections.get(sensorName);
            const isConnected = connection && connection.readyState === WebSocket.OPEN;
            const timeSinceLastSeen = connection ? ((now - deviceInfo.lastSeen) / 1000).toFixed(1) + 's ago' : 'N/A';
            console.log(`  [${deviceInfo.id}] ${sensorName} (IP: ${deviceInfo.ip || 'N/A'}): ${isConnected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}. Last seen: ${timeSinceLastSeen}. Connections: ${deviceInfo.connectionCount}`);
        });
    }
    console.log('');
  }
}, 5000); // Log status more frequently for debugging, e.g., every 5 seconds

// Listen for server errors 
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: Port ${PORT} is already in use!`);
    console.error(`   Another application is already using port ${PORT}.`);
    console.error(`   Try stopping other servers or change the PORT value to something else.`);
  } else {
    console.error(`❌ Server error: ${error.message}`);
  }
  process.exit(1);
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔═════════════════════════════════════════════════════════════╗
  ║  CreaTune WebSocket Server                                  ║
  ║  Server running on port ${PORT.toString().padEnd(35, ' ')} ║
  ║  Web files serving from ${WEB_ROOT.padEnd(30, ' ')} ║
  ╚═════════════════════════════════════════════════════════════╝
  `);
  console.log(`Point your browser to http://localhost:${PORT}`);

  const networkInterfaces = os.networkInterfaces();
  console.log('  Accessible on your local network at:');
  Object.keys(networkInterfaces).forEach((ifaceName) => {
    networkInterfaces[ifaceName].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`    - http://${iface.address}:${PORT} (${ifaceName})`);
      }
    });
  });
  console.log('');
});