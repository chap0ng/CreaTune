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
    '.webmanifest': 'application/manifest+json'
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
  pingInterval: 2000, // ws library's built-in ping
  pingTimeout: 5000   // ws library's built-in timeout for pong
});

// Client tracking
const clients = new Map();
let clientIdCounter = 0;

// ESP32 device tracking
const espDevices = new Map(); // Key: sensorName, Value: { id, ws, lastSeen, connectionCount, ip }
const espConnections = new Map(); // Key: sensorName, Value: WebSocket object (current active ws)
let espIdCounter = 0;

// Timeout and Ping settings for our custom logic
const PING_INTERVAL_MS = 2000;  // How often server sends its application-level pings
const ESP_TIMEOUT_MS = 5000;    // Consider ESP disconnected if no message/pong for this duration
                                // Should be > PING_INTERVAL_MS + typical network latency

// Enhanced heartbeat function to track connection health (used by ws 'pong' event)
function wsHeartbeat() {
  this.isAlive = true; // ws library uses this for its ping/pong
  this.lastPong = Date.now(); // Our custom tracking
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  const uniqueClientId = `client-${clientIdCounter++}`;

  ws.isAlive = true; // For ws library's ping/pong
  ws.lastPong = Date.now(); // For our custom tracking
  ws.on('pong', wsHeartbeat); // ws library's pong event

  clients.set(uniqueClientId, { ws, type: 'unknown', ip, id: uniqueClientId });
  console.log(`➕ New connection (ID: ${uniqueClientId}) from ${ip}. Awaiting identification...`);

  ws.on('message', (message) => {
    ws.lastPong = Date.now(); // Any message from client updates lastPong
    ws.isAlive = true; // Also for ws library

    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error(`🚨 Received non-JSON message from Client ID ${uniqueClientId}:`, message.toString().substring(0,100));
      return;
    }

    const clientInfo = clients.get(uniqueClientId);

    if (clientInfo.type === 'unknown') {
      if (data.type === 'esp_handshake' && data.sensorName) {
        clientInfo.type = 'esp';
        clientInfo.sensorName = data.sensorName;
        ws.deviceType = 'esp'; // Mark ws object directly for easier access in heartbeat
        ws.sensorName = data.sensorName;
        handleESPHandshake(ws, data.sensorName, clientInfo.id, ip);
      } else {
        clientInfo.type = 'web';
        ws.deviceType = 'web';
        console.log(`💻 Client ID ${clientInfo.id} identified as WEB CLIENT.`);
        ws.send(JSON.stringify({ type: 'welcome', clientId: clientInfo.id, message: 'Connected to CreaTune Web Server' }));
        sendESP32StatusToSingleClient(ws);
      }
    }

    if (clientInfo.type === 'esp') {
      handleESP32Data(ws, data, clientInfo.sensorName);
    } else if (clientInfo.type === 'web') {
      if (data.type === 'get_esp_status') {
        sendESP32StatusToSingleClient(ws);
      } else if (data.type === 'pong') { // Our application-level pong
        // lastPong already updated at start of message handler
      } else {
        console.log(`🌐 Received from Web Client ID ${clientInfo.id}:`, JSON.stringify(data).substring(0,100));
      }
    }
  });

  ws.on('close', (code, reason) => {
    const clientInfo = clients.get(uniqueClientId);
    if (clientInfo) {
      if (clientInfo.type === 'esp' && clientInfo.sensorName) {
        // Pass the reason for more informative logging
        handleESP32Disconnect(clientInfo.sensorName, ws, `WebSocket closed (Code: ${code}, Reason: ${reason || 'N/A'})`);
      } else if (clientInfo.type === 'web') {
        console.log(`➖ Web Client ID ${clientInfo.id} disconnected.`);
      } else {
        console.log(`➖ Unknown Client ID ${clientInfo.id} disconnected before identification.`);
      }
      clients.delete(uniqueClientId);
    }
  });

  ws.on('error', (error) => {
    const clientInfo = clients.get(uniqueClientId);
    const idForLog = clientInfo ? (clientInfo.sensorName || `Client ID ${clientInfo.id}`) : `Unknown Client (ID ${uniqueClientId})`;
    console.error(`🚫 WebSocket error for ${idForLog}:`, error.message);
  });
});

function handleESPHandshake(ws, sensorName, clientId, ip) {
  console.log(`🤝 ESP32 Handshake: ${sensorName} (Client ID: ${clientId}) from ${ip}`);

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

  ws.send(JSON.stringify({
    type: 'handshake_ack',
    message: `ESP32 ${sensorName} connected`,
    espId: deviceInfo.id,
    heartbeat_interval: PING_INTERVAL_MS, // Inform ESP about server's app-level ping
    heartbeat_enabled: true
  }));

  broadcastToWebClients({ type: 'esp_connected', name: sensorName, id: deviceInfo.id, ip: deviceInfo.ip });
  broadcastESPStatusUpdate();
}

function handleESP32Data(ws, data, sensorName) {
  const deviceInfo = espDevices.get(sensorName);
  if (deviceInfo) {
    deviceInfo.lastSeen = Date.now(); // Update lastSeen on any data

    if (data.type === 'heartbeat' || data.type === 'pong') { // ESP's own heartbeat or pong to server's app ping
      // console.log(`💓 Heartbeat/Pong from ${sensorName}`);
      return; // Don't broadcast these to web clients as sensor_data
    }

    // Ensure device_type is set for web client
    if (!data.device_type) {
      const lowerSensorName = sensorName.toLowerCase();
      if (lowerSensorName.includes('soil') || lowerSensorName.includes('moisture')) {
        data.device_type = 'soil';
      } else if (lowerSensorName.includes('light')) {
        data.device_type = 'light';
      } else if (lowerSensorName.includes('temp')) {
        data.device_type = 'temp';
      } else {
        data.device_type = lowerSensorName;
      }
    }
    // Log actual data being sent, including the critical soil_condition
    console.log(`📡 From ${sensorName} (type: ${data.device_type}): ${JSON.stringify(data).substring(0, 150)}`);

    broadcastToWebClients({
      type: 'sensor_data',
      ...data,
      sensor: sensorName, // Ensure sensorName is present
      espId: deviceInfo.id
    });
  } else {
    console.warn(`⚠️ Received data from unknown or disconnected ESP: ${sensorName}. Requesting handshake.`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'request_handshake', message: 'Identify yourself' }));
    }
  }
}

function handleESP32Disconnect(sensorName, wsInstance, reason = "Unknown reason") {
  const currentConnection = espConnections.get(sensorName);
  if (currentConnection === wsInstance) { // Only process if it's the currently tracked active connection
    console.log(`🔌❌ ESP32 '${sensorName}' disconnected. Reason: ${reason}`);
    espConnections.delete(sensorName);

    // We don't delete from espDevices immediately, just mark as disconnected via status update
    // This allows the client to know it *was* there.
    // A separate cleanup mechanism could remove very old entries from espDevices if needed.

    broadcastToWebClients({ type: 'esp_disconnected', name: sensorName, reason: reason });
    broadcastESPStatusUpdate();
  } else {
    // console.log(`🔌 ESP32 '${sensorName}' (older/stale instance) disconnected. Reason: ${reason}`);
  }
}

function broadcastToWebClients(data, excludeWs = null) {
  clients.forEach((client) => {
    if (client.type === 'web' && client.ws.readyState === WebSocket.OPEN) {
      if (client.ws !== excludeWs) {
        try {
          client.ws.send(JSON.stringify(data));
        } catch (e) {
          console.error(`Error sending to web client ${client.id}:`, e.message);
        }
      }
    }
  });
}

function sendESP32StatusToSingleClient(ws) {
  const status = [];
  espDevices.forEach((deviceInfo, sensorName) => {
    status.push({
      name: sensorName,
      id: deviceInfo.id,
      connected: espConnections.has(sensorName) && espConnections.get(sensorName).readyState === WebSocket.OPEN,
      lastSeen: deviceInfo.lastSeen,
      ip: deviceInfo.ip
    });
  });
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'esp_status_list', devices: status }));
  }
}

function broadcastESPStatusUpdate() {
  const status = [];
  espDevices.forEach((deviceInfo, sensorName) => {
    status.push({
      name: sensorName,
      id: deviceInfo.id,
      connected: espConnections.has(sensorName) && espConnections.get(sensorName).readyState === WebSocket.OPEN,
      lastSeen: deviceInfo.lastSeen,
      ip: deviceInfo.ip
    });
  });
  broadcastToWebClients({ type: 'esp_status_list', devices: status });
}

// Custom application-level heartbeat interval
const applicationHeartbeatInterval = setInterval(() => {
  const now = Date.now();
  wss.clients.forEach((ws) => {
    if (ws.deviceType === 'esp' && ws.sensorName) {
      // Check our custom lastPong against ESP_TIMEOUT_MS
      if (now - ws.lastPong > ESP_TIMEOUT_MS) {
        console.warn(`⌛ ESP32 '${ws.sensorName}' application heartbeat timeout (${((now - ws.lastPong)/1000).toFixed(1)}s). Terminating.`);
        handleESP32Disconnect(ws.sensorName, ws, `Application heartbeat timeout`);
        ws.terminate();
        return; // Terminated, no further action needed for this client in this iteration
      }
    } else if (ws.deviceType === 'web') {
        // Optional: Timeout for web clients if needed, using CLIENT_TIMEOUT_MS
        // if (now - ws.lastPong > CLIENT_TIMEOUT_MS) { ... terminate ... }
    }

    // Send application-level ping to all clients
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      } catch (e) {
        console.error('Failed to send application ping:', e.message);
        // ws.terminate(); // Consider terminating if send fails
      }
    }
  });
}, PING_INTERVAL_MS);


// ws library's built-in heartbeat check (supplements our custom one)
// This checks if the client responded to ws.ping() with a ws.pong()
const wsLibraryHeartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      const deviceId = ws.sensorName || (clients.get(Array.from(clients).find(c => c[1].ws === ws)?.[0])?.id || 'Unknown');
      console.warn(`💔 Client '${deviceId}' failed ws library heartbeat check. Terminating.`);
      if (ws.deviceType === 'esp' && ws.sensorName) {
        handleESP32Disconnect(ws.sensorName, ws, "ws library heartbeat failed");
      }
      return ws.terminate();
    }
    ws.isAlive = false; // Expect a pong before next check
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping(); // ws library ping
      }
    } catch (e) {
        console.error(`Error sending ws library ping to ${deviceId}:`, e.message);
    }
  });
}, 10000); // Check ws library heartbeats less frequently, e.g., every 10s


// Clean up intervals on server close
wss.on('close', () => {
  clearInterval(applicationHeartbeatInterval);
  clearInterval(wsLibraryHeartbeatInterval);
  // clearInterval(statusLogInterval); // if you add one
});

// Optional: Status logging interval
/*
const statusLogInterval = setInterval(() => {
  const totalESPInDeviceMap = espDevices.size;
  const connectedESPCount = espConnections.size;
  let webClientCount = 0;
  clients.forEach(client => {
    if (client.type === 'web') webClientCount++;
  });
  console.log(`📊 Status: ${connectedESPCount}/${totalESPInDeviceMap} ESP32 devices connected, ${webClientCount} web clients.`);
}, 30000);
*/

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: Port ${PORT} is already in use!`);
  } else {
    console.error(`❌ Server error: ${error.message}`);
  }
  process.exit(1);
});

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
