class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10; // Max attempts
        this.reconnectDelay = 1000;    // Initial delay
        this.clientId = null;

        // !!! IMPORTANT: SET YOUR PHONE'S ACTUAL WI-FI IP ADDRESS AND PORT HERE !!!
        // This will be overridden if the server provides an IP via query param or if running on localhost.
        this.serverHostOverride = '192.168.0.100:8080'; // Example: '192.168.1.100:8080'

        this.deviceStates = {
            soil: {
                connected: false,
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            },
            light: { // ADDED LIGHT DEVICE STATE
                connected: false,
                active: false, // "Active" could mean "not dark" or a specific brightness
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            },
            // temp: { connected: false, active: false, lastRawData: null, lastStateChange: 0, stateHistory: [] },
        };

        this.stabilityRequiredReadings = 3; // Number of consistent readings to confirm state change
        this.maxHistoryLength = 5;          // Max readings to keep for stability check
        this.minStateChangeInterval = 1000; // Minimum ms between state changes (debouncing)

        this.callbacks = {
            'connected': [],
            'disconnected': [],
            'error': [],
            'data': [],
            'stateChange': [],
            'espHandshake': [],
            'espDisconnected': []
        };
        this.debug = true; // Enable/disable console logs
    }

    getServerAddress() {
        const urlParams = new URLSearchParams(window.location.search);
        const serverIpFromUrl = urlParams.get('server_ip');

        if (serverIpFromUrl) {
            if (this.debug) console.log(`🌐 Using server IP from URL parameter: ${serverIpFromUrl}`);
            return serverIpFromUrl;
        }
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (this.debug) console.log(`🌐 Running on localhost, attempting to connect to ws://localhost:8080`);
            return 'localhost:8080';
        }
        if (this.serverHostOverride) {
            if (this.debug) console.log(`🌐 Using serverHostOverride: ${this.serverHostOverride}`);
            return this.serverHostOverride;
        }
        // Fallback if no other IP is found (should ideally not happen if server provides it)
        const fallbackIp = 'YOUR_PHONE_IP_HERE:8080'; // Replace with actual fallback if needed
        if (this.debug) console.warn(`🌐 No server IP found, using fallback: ${fallbackIp}. Ensure your server provides its IP or set serverHostOverride.`);
        return fallbackIp;
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            if (this.debug) console.log('📡 WebSocket already open or connecting.');
            return;
        }

        const serverAddress = this.getServerAddress();
        const wsUrl = `ws://${serverAddress}`;

        if (this.debug) console.log(`📡 Attempting to connect to WebSocket: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0; // Reset on successful connection
            this.reconnectDelay = 1000; // Reset delay
            if (this.debug) console.log('✅ WebSocket connected!');
            this.notifyCallbacks('connected', 'server'); // General server connection
            // Request client ID after connection
            this.sendMessage({ type: 'request_client_id' });
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (this.debug && message.type !== 'heartbeat_ack') { // Avoid flooding console with heartbeat acks
                    console.log('📥 Received message:', message);
                }
                this.handleMessage(message);
            } catch (e) {
                console.error('❌ Error parsing message:', e, event.data);
                this.notifyCallbacks('error', 'Failed to parse message');
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.isConnected = false;
            this.notifyCallbacks('error', error);
            // No automatic reconnect here, onclose will handle it
        };

        this.ws.onclose = (event) => {
            if (this.debug) console.log(`🔌 WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason}", Clean: ${event.wasClean}`);
            this.isConnected = false;
            this.notifyCallbacks('disconnected', 'server'); // General server disconnection

            // Notify disconnection for all known device types
            Object.keys(this.deviceStates).forEach(deviceType => {
                if (this.deviceStates[deviceType].connected) {
                    this.deviceStates[deviceType].connected = false;
                    this.deviceStates[deviceType].active = false; // Assume inactive on disconnect
                    this.notifyCallbacks('disconnected', deviceType);
                }
            });


            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts -1), 30000); // Exponential backoff up to 30s
                if (this.debug) console.log(`⏳ Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay / 1000}s...`);
                setTimeout(() => this.connect(), delay);
                this.reconnectDelay = delay;
            } else {
                if (this.debug) console.error(`🚫 Max reconnect attempts reached. Please check server and network.`);
            }
        };
    }

    handleMessage(message) {
        switch (message.type) {
            case 'client_id_assigned':
                this.clientId = message.clientId;
                if (this.debug) console.log(`🆔 Client ID assigned: ${this.clientId}`);
                break;
            case 'sensor_data':
                this.processSensorData(message);
                break;
            case 'esp_handshake': // ESP device connected to server
                if (this.debug) console.log(`🤝 ESP Handshake from: ${message.sensorName}`);
                const deviceTypeForHandshake = this.identifyDeviceTypeByName(message.sensorName);
                if (deviceTypeForHandshake && this.deviceStates[deviceTypeForHandshake]) {
                    this.deviceStates[deviceTypeForHandshake].connected = true;
                    this.notifyCallbacks('espHandshake', deviceTypeForHandshake, message);
                    this.notifyCallbacks('connected', deviceTypeForHandshake); // Also notify generic connected
                } else {
                    if (this.debug) console.warn(`❓ ESP Handshake from unknown device type: ${message.sensorName}`);
                }
                break;
            case 'esp_disconnected': // ESP device disconnected from server
                if (this.debug) console.log(`🔌 ESP Disconnected: ${message.sensorName}`);
                const deviceTypeForDisconnect = this.identifyDeviceTypeByName(message.sensorName);
                if (deviceTypeForDisconnect && this.deviceStates[deviceTypeForDisconnect]) {
                    this.deviceStates[deviceTypeForDisconnect].connected = false;
                    this.deviceStates[deviceTypeForDisconnect].active = false;
                    this.notifyCallbacks('espDisconnected', deviceTypeForDisconnect, message);
                    this.notifyCallbacks('disconnected', deviceTypeForDisconnect); // Also notify generic disconnected
                }
                break;
            case 'heartbeat_ack':
                // if (this.debug) console.log('💓 Heartbeat acknowledged by server.');
                break;
            case 'error':
                console.error('❌ Server error message:', message.message);
                this.notifyCallbacks('error', message.message);
                break;
            default:
                if (this.debug) console.log('❔ Unknown message type:', message.type);
        }
    }

    processSensorData(data) {
        const deviceType = this.identifyDeviceType(data);

        if (!deviceType || !this.deviceStates[deviceType]) {
            if (this.debug) console.warn(`❓ Unknown or unconfigured device type for sensor data:`, data);
            return;
        }

        const device = this.deviceStates[deviceType];

        if (!device.connected) {
            device.connected = true;
            if (this.debug) console.log(`📡 ${deviceType.toUpperCase()} now considered connected (received data).`);
            this.notifyCallbacks('connected', deviceType);
        }

        device.lastRawData = data;
        const shouldBeActiveNow = this.shouldBeActive(deviceType, data);

        device.stateHistory.push(shouldBeActiveNow);
        if (device.stateHistory.length > this.maxHistoryLength) {
            device.stateHistory.shift();
        }

        const stableState = this.getStableState(device);

        if (stableState !== null && stableState !== device.active) {
            const timeSinceLastChange = Date.now() - device.lastStateChange;
            if (timeSinceLastChange >= this.minStateChangeInterval) {
                const previousActiveState = device.active;
                device.active = stableState;
                device.lastStateChange = Date.now();
                if (this.debug) console.log(`🔄 ${deviceType.toUpperCase()} STABLE STATE CHANGE: ${previousActiveState} → ${device.active}`);
                this.notifyCallbacks('stateChange', deviceType, {
                    active: device.active,
                    rawData: data, // Pass full raw data for context
                    previousState: previousActiveState
                });
            }
        }
        this.notifyCallbacks('data', deviceType, data); // Always notify raw data
    }

    shouldBeActive(deviceType, data) {
        switch (deviceType) {
            case 'soil':
                if (data.soil_condition) {
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                }
                // Fallbacks if soil_condition is not present
                if (data.moisture_app_value !== undefined) return data.moisture_app_value > 0.3; // Example threshold
                if (data.voltage !== undefined) return data.voltage > 0.4; // Example threshold, adjust based on your sensor
                if (data.raw_value !== undefined) return data.raw_value < 700 && data.raw_value > 0; // Example for analog, lower is wetter
                if (this.debug) console.warn(`💧 Soil: No recognizable activity fields in data:`, data);
                return false;
            case 'light': // ADDED LIGHT LOGIC
                // "Active" means the light condition is not "dark".
                if (data.light_condition) {
                    const isActive = data.light_condition !== 'dark';
                    if (this.debug && isActive) console.log(`🌟 Light is active (condition: ${data.light_condition})`);
                    if (this.debug && !isActive) console.log(`🕶️ Light is not active (condition: ${data.light_condition})`);
                    return isActive;
                }
                // Fallback if only app_value is present
                if (data.light_app_value !== undefined) {
                    const isActive = data.light_app_value > 0.20; // Corresponds to not being in "dark" range
                    if (this.debug && isActive) console.log(`🌟 Light is active (app_value: ${data.light_app_value})`);
                    if (this.debug && !isActive) console.log(`🕶️ Light is not active (app_value: ${data.light_app_value})`);
                    return isActive;
                }
                if (this.debug) console.warn(`💡 Light: No recognizable activity fields (light_condition, light_app_value) in data:`, data);
                return false;
            default:
                return false;
        }
    }

    getStableState(device) {
        if (device.stateHistory.length < this.stabilityRequiredReadings) {
            return null; // Not enough data for a stable state
        }
        // Check if the last 'stabilityRequiredReadings' are all the same
        const recentHistory = device.stateHistory.slice(-this.stabilityRequiredReadings);
        const firstState = recentHistory[0];
        const isStable = recentHistory.every(state => state === firstState);
        return isStable ? firstState : null;
    }

    identifyDeviceType(data) {
        // Prioritize explicit device_type from sensor if sent
        if (data.device_type && this.deviceStates[data.device_type.toLowerCase()]) {
            return data.device_type.toLowerCase();
        }
        // Then try to identify by sensor name
        if (data.sensor) {
            const sensorLower = data.sensor.toLowerCase();
            if (sensorLower.includes('soil') || sensorLower.includes('moisture')) return 'soil';
            if (sensorLower.includes('light')) return 'light'; // ADDED
        }
        // Fallback: check for specific fields unique to a sensor type
        if (data.soil_condition !== undefined || data.moisture_app_value !== undefined) {
            return 'soil';
        }
        if (data.light_condition !== undefined || data.light_app_value !== undefined) { // ADDED
            return 'light';
        }
        // If only voltage or raw_value is present, it's ambiguous without sensor name context.
        // This part might need refinement if you have multiple generic analog sensors.
        // if (data.voltage !== undefined || data.raw_value !== undefined) {
        //     console.warn("❓ Ambiguous sensor data (voltage/raw_value only), cannot determine type reliably without sensor name. Data:", data);
        // }
        return null; // Cannot determine
    }

    identifyDeviceTypeByName(name) {
        if (!name) return null;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('soil') || nameLower.includes('moisture')) return 'soil';
        if (nameLower.includes('light')) return 'light'; // ADDED
        // Add more rules if you have other sensor types
        return null;
    }


    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('❌ WebSocket not connected. Cannot send message:', message);
        }
    }

    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        } else {
            console.warn(`❔ Attempted to subscribe to unknown event: ${event}`);
        }
    }

    notifyCallbacks(event, deviceTypeOrError, data = null) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(deviceTypeOrError, data);
                } catch (e) {
                    console.error(`❌ Error in callback for event ${event}:`, e);
                }
            });
        }
    }

    getDeviceState(deviceType) {
        return this.deviceStates[deviceType] ? { ...this.deviceStates[deviceType] } : null;
    }

    // Method to allow ESPs to send their IP to the client via the server (for dev/local networks)
    // This is usually handled by the server broadcasting its own IP or the client knowing it.
    // This method is more for a scenario where the server relays an ESP's IP, which is less common.
    setEspIp(deviceType, ip) {
        if (this.deviceStates[deviceType]) {
            this.deviceStates[deviceType].ip = ip;
            if (this.debug) console.log(`IP for ${deviceType} set to ${ip}`);
        }
    }
}

// Initialize and expose the client
document.addEventListener('DOMContentLoaded', () => {
    window.creatune = new CreaTuneClient();
    window.creatune.connect(); // Auto-connect on load
});