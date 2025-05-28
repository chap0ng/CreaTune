const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os'); // For network interface listing

const PORT = 8080;
const WEB_ROOT = path.join(__dirname, 'web'); // Serve files from the 'web' subdirectory

// --- Configuration ---
const HEARTBEAT_INTERVAL = 30000; // Interval for server-to-client ping (ws library's built-in)
const CLIENT_TIMEOUT = HEARTBEAT_INTERVAL * 2 + 5000; // Time to wait for pong before considering client dead

const ESP_PING_INTERVAL = 15000; // Interval for application-level ping to ESP32 clients (ms)
const ESP_RESPONSE_TIMEOUT = 10000; // Time to wait for ESP32 pong before considering it unresponsive (ms)

const DEBUG = true; // Toggle detailed logging

// --- Data Structures ---
const clients = new Map(); // Stores all connected WebSocket clients (web and ESP)
const espDevices = new Map(); // Stores known ESP device configurations/metadata
                              // Key: deviceName (e.g., "ESP32-Soil-XYZ"), Value: { ws, name, type, lastPong, pingTimeoutId, ... }

// Define your ESP device types and how to identify them from their names
const deviceTypeMapping = [
    { nameIncludes: 'soil', type: 'soil' },
    { nameIncludes: 'moisture', type: 'soil' },
    // { nameIncludes: 'light', type: 'light' },
    // { nameIncludes: 'temp', type: 'temp' },
    // Add more mappings as needed
];

// --- HTTP Server for Static Files ---
const server = http.createServer((req, res) => {
    let filePath = path.join(WEB_ROOT, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                // Try serving index.html for SPA-like routing (if a directory or non-file is requested)
                fs.readFile(path.join(WEB_ROOT, 'index.html'), (err, idxContent) => {
                    if (err) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1><p>The requested resource was not found.</p>', 'utf-8');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(idxContent, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// --- WebSocket Server ---
const wss = new WebSocket.Server({ server }); // Mounts WSS on the HTTP server

function generateClientId() {
    return Math.random().toString(36).substring(2, 15);
}

function identifyEspDeviceType(deviceName) {
    if (!deviceName) return 'unknown_esp';
    const lowerDeviceName = deviceName.toLowerCase();
    for (const mapping of deviceTypeMapping) {
        if (lowerDeviceName.includes(mapping.nameIncludes)) {
            return mapping.type;
        }
    }
    return 'unknown_esp'; // Default if no mapping matches
}

function broadcastToWebClients(message, excludeClientId = null) {
    const stringifiedMessage = JSON.stringify(message);
    if (DEBUG && message.type !== 'sensor_data') { // Avoid flooding logs with sensor data
        console.log(`🌐 Broadcasting to web clients (excluding ${excludeClientId || 'none'}):`, stringifiedMessage.substring(0, 100) + (stringifiedMessage.length > 100 ? '...' : ''));
    }
    clients.forEach((clientData, clientId) => {
        if (clientData.type === 'web' && clientId !== excludeClientId && clientData.ws.readyState === WebSocket.OPEN) {
            try {
                clientData.ws.send(stringifiedMessage);
            } catch (e) {
                console.error(`Error sending message to web client ${clientId}:`, e);
            }
        }
    });
}

function sendToClient(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(message));
        } catch (e) {
            console.error(`Error sending message:`, e);
        }
    }
}

function handleEspConnection(ws, deviceName) {
    const deviceType = identifyEspDeviceType(deviceName);
    const existingDevice = espDevices.get(deviceName);

    if (existingDevice && existingDevice.ws && existingDevice.ws.readyState === WebSocket.OPEN) {
        console.warn(`🔌⚠️ ESP device "${deviceName}" tried to connect again while already connected. Terminating old session.`);
        existingDevice.ws.terminate(); // Terminate the old connection
    }
    
    clearTimeout(existingDevice?.pingTimeoutId); // Clear any old timeout

    const espClient = {
        ws: ws,
        name: deviceName,
        type: deviceType,
        isAlive: true,
        lastPong: Date.now(),
        pingTimeoutId: null
    };
    espDevices.set(deviceName, espClient);
    ws.isAlive = true; // For ws library's heartbeat

    console.log(`🔌✅ ESP device connected: ${deviceName} (Type: ${deviceType})`);
    broadcastToWebClients({ type: 'esp_connected', name: deviceName, deviceType: deviceType });

    // Start application-level ping for this ESP
    function scheduleEspPing() {
        clearTimeout(espClient.pingTimeoutId); // Clear previous timeout
        espClient.pingTimeoutId = setTimeout(() => {
            if (Date.now() - espClient.lastPong > ESP_RESPONSE_TIMEOUT + ESP_PING_INTERVAL) { // Check if pong is too old
                console.log(`🔌❌ ESP device "${deviceName}" timed out (no pong). Terminating.`);
                ws.terminate(); // This will trigger 'close' event for this ESP
                return;
            }
            if (ws.readyState === WebSocket.OPEN) {
                if (DEBUG) console.log(`💓 Sending app-level ping to ESP: ${deviceName}`);
                sendToClient(ws, { type: 'ping', timestamp: Date.now() });
                scheduleEspPing(); // Schedule next ping
            }
        }, ESP_PING_INTERVAL);
    }
    scheduleEspPing(); // Start the ping cycle
}

function handleEspDisconnection(deviceName, reason = "Unknown") {
    const device = espDevices.get(deviceName);
    if (device) {
        clearTimeout(device.pingTimeoutId); // Stop pinging this device
        espDevices.delete(deviceName);
        console.log(`🔌❌ ESP device disconnected: ${deviceName}. Reason: ${reason}`);
        broadcastToWebClients({ type: 'esp_disconnected', name: deviceName, reason: reason });
    } else {
        if (DEBUG) console.log(`🔌❓ Attempted to handle disconnect for unknown/already removed ESP: ${deviceName}`);
    }
}

wss.on('connection', (ws, req) => {
    const clientId = generateClientId();
    ws.isAlive = true; // For ws library's heartbeat

    // Default to web client, can be overridden by ESP registration
    const clientData = { ws: ws, type: 'web', isAlive: true };
    clients.set(clientId, clientData);

    console.log(`🔗 Client connected: ${clientId} from ${req.socket.remoteAddress}`);
    sendToClient(ws, { type: 'welcome', clientId: clientId, message: 'Welcome to CreaTune Server!' });

    ws.on('pong', () => { // ws library's heartbeat pong
        ws.isAlive = true;
        const client = clients.get(clientId); // Get the client data using the clientId from the outer scope
        if (client && client.type === 'esp32') { // If it's an ESP, update its specific lastPong
            const espDevice = espDevices.get(client.espDeviceName);
            if (espDevice) {
                espDevice.lastPong = Date.now(); // Update lastPong for the application-level ping logic
                 if (DEBUG) console.log(`💓 Received ws-pong from ESP: ${client.espDeviceName}`);
            }
        } else if (client && client.type === 'web') {
            if (DEBUG) console.log(`💓 Received ws-pong from Web Client: ${clientId}`);
        }
    });

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
            // Use clientData from the outer scope, which is correctly associated with this ws connection
            if (DEBUG && data.type !== 'sensor_data' && data.type !== 'pong') {
                console.log(`📬 Received from ${clientData.type} client ${clientData.espDeviceName || clientId}:`, data);
            }
        } catch (e) {
            console.error(`❌ Invalid JSON from client ${clientData.espDeviceName || clientId}:`, message, e);
            return;
        }

        switch (data.type) {
            case 'register_esp': // ESP identifies itself
                if (data.name) {
                    // Update the existing clientData for this connection
                    clientData.type = 'esp32';
                    clientData.espDeviceName = data.name;
                    handleEspConnection(ws, data.name); // Pass the current ws object
                } else {
                    console.warn(`⚠️ ESP registration attempt without a name from client ${clientId}.`);
                }
                break;

            case 'sensor_data': // ESP sends sensor data
                if (clientData.type === 'esp32' && clientData.espDeviceName) {
                    const enrichedData = { ...data, deviceName: clientData.espDeviceName };
                    broadcastToWebClients(enrichedData);
                } else {
                    console.warn(`⚠️ Sensor data from non-ESP or unidentified client ${clientId}:`, data);
                }
                break;
            
            case 'pong': // Application-level pong from ESP
                if (clientData.type === 'esp32' && clientData.espDeviceName) {
                    const espDevice = espDevices.get(clientData.espDeviceName);
                    if (espDevice) {
                        espDevice.lastPong = Date.now();
                        if (DEBUG) console.log(`💓 Received app-pong from ESP: ${clientData.espDeviceName} (RTT: ${Date.now() - data.timestamp}ms)`);
                    }
                } else if (clientData.type === 'web') {
                     // This is the "unhandled heartbeat" message you were seeing.
                     // Web clients don't need to send app-level pongs, only ws-level pongs.
                     if (DEBUG) console.log(`❓ Received app-level pong from Web Client ${clientId}. This is unexpected but harmless.`);
                }
                break;

            case 'get_esp_status': // Web client requests current ESP statuses
                const statusList = Array.from(espDevices.values()).map(dev => ({
                    name: dev.name,
                    type: dev.type,
                    connected: dev.ws.readyState === WebSocket.OPEN
                }));
                sendToClient(ws, { type: 'esp_status_list', devices: statusList });
                break;

            default:
                console.log(`❓ Unhandled message type "${data.type}" from client ${clientData.espDeviceName || clientId}.`);
        }
    });

    ws.on('close', (code, reason) => {
        // Use the clientData captured in the 'connection' event's scope
        clients.delete(clientId); // Remove from the main clients Map

        if (clientData && clientData.type === 'esp32' && clientData.espDeviceName) {
            handleEspDisconnection(clientData.espDeviceName, `Connection closed (Code: ${code}, Reason: ${reason || 'N/A'})`);
        } else {
            console.log(`🔗 Web client disconnected: ${clientId}. Code: ${code}, Reason: ${reason || 'N/A'}`);
        }
    });

    ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientData.espDeviceName || clientId}:`, error);
    });
});

// --- Heartbeat for ws Library ---
const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        // Find the clientData associated with this ws instance
        let associatedClientId = null;
        let associatedClientData = null;
        for (const [id, cData] of clients.entries()) {
            if (cData.ws === ws) {
                associatedClientId = id;
                associatedClientData = cData;
                break;
            }
        }
        const clientIdOrName = associatedClientData ? (associatedClientData.espDeviceName || associatedClientId || 'Unknown') : 'Unknown WS instance';

        if (ws.isAlive === false) { // isAlive is managed by the ws library's ping/pong
            if (DEBUG) console.log(`💔 Heartbeat: Client ${clientIdOrName} did not respond to ws-ping. Terminating.`);
            return ws.terminate();
        }
        ws.isAlive = false;
        try {
            ws.ping(() => {}); // Send ws library ping
        } catch (e) {
            console.error(`Error sending ws ping to ${clientIdOrName}:`, e);
            ws.terminate(); // Terminate if ping itself fails
        }
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
    clearInterval(interval);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ ERROR: Port ${PORT} is already in use!`);
    console.error('Please close the other application using this port or choose a different port.');
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
        console.log(`    ➡️  http://${iface.address}:${PORT} (${ifaceName})`);
      }
    });
  });
  console.log('Waiting for connections...');
});