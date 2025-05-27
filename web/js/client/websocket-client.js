// websocket-client.js
// Enhanced WebSocket client with stable state management and robust connection handling

class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5; // Increased for more resilience
        this.reconnectDelay = 1000;
        this.clientId = null;

        // Device state tracking
        this.deviceStates = {
            soil: {
                connected: false,
                active: false,        // Clean on/off state based on stability
                lastRawData: null,
                lastStateChange: 0,   // Timestamp of the last stable state change
                stateHistory: []      // History of raw 'shouldBeActive' states
            },
            light: {
                connected: false,
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            },
            temp: {
                connected: false,
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            }
        };

        // Stability settings
        this.stabilityRequiredReadings = 3;  // How many consistent readings to confirm a state
        this.maxHistoryLength = 5;           // Max readings to keep for stability check
        this.minStateChangeInterval = 2000;  // Minimum ms between active/inactive state changes

        this.callbacks = {}; // Changed from array to object for named event types
        // No auto-init here, will be called by DOMContentLoaded
    }

    init() {
        console.log('🔌 Initializing CreaTune WebSocket Client...');
        this.connect();
        // window.creatune = this; // This will be set in the DOMContentLoaded listener
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl;

            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                wsUrl = `${protocol}//localhost:${window.location.port || '8080'}`;
                console.log(`🔗 Attempting WebSocket connection (localhost): ${wsUrl}`);
            } else {
                wsUrl = `${protocol}//${window.location.host}`;
                console.log(`🔗 Attempting WebSocket connection (remote): ${wsUrl}`);
            }

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected successfully.');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000; // Reset delay on successful connection
                // Server should send a 'welcome' message with clientId
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Debug all received messages (uncomment when needed)
                    // console.log('📥 Received message:', data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing message:', event.data, error);
                }
            };

            this.ws.onclose = (event) => {
                console.log(`🔌❌ WebSocket disconnected (Code: ${event.code}, Reason: "${event.reason}")`);
                this.isConnected = false;
                this.markAllDisconnected(); // Ensure all devices are marked as disconnected
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('🚫 WebSocket error:', error);
                // onclose will usually follow an error, so reconnection is handled there
                this.isConnected = false;
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.attemptReconnect(); // Try to reconnect if initial connection fails
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.clientId = data.clientId;
                console.log(`🎉 Welcome! Client ID: ${this.clientId}. Requesting ESP status...`);
                // Optionally, request current ESP status from server upon connection
                // if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                //    this.ws.send(JSON.stringify({ type: 'get_esp_status' }));
                // }
                break;

            case 'ping':
                // Respond to server heartbeat with pong
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: data.timestamp,
                        response_time: Date.now()
                    }));
                }
                break;

            case 'sensor_data':
                this.processSensorData(data);
                break;

            case 'esp_status': // If server sends a list of currently connected ESPs
                console.log('📡 ESP Status received:', data.devices);
                break;

            case 'esp_status_list': // Updated status list format
                console.log('📡 ESP Status List received:', data.devices);
                if (Array.isArray(data.devices)) {
                    data.devices.forEach(device => {
                        const deviceType = this.identifyDeviceTypeByName(device.name);
                        if (deviceType && this.deviceStates[deviceType]) {
                            // Update connection state based on server's knowledge
                            if (device.connected && !this.deviceStates[deviceType].connected) {
                                console.log(`📡 ${deviceType.toUpperCase()} marked as connected from server status.`);
                                this.deviceStates[deviceType].connected = true;
                                this.notifyCallbacks('connected', deviceType);
                            } else if (!device.connected && this.deviceStates[deviceType].connected) {
                                console.log(`🔌❌ ${deviceType.toUpperCase()} marked as disconnected from server status.`);
                                this.deviceStates[deviceType].connected = false;
                                this.deviceStates[deviceType].active = false;
                                this.notifyCallbacks('disconnected', deviceType);
                            }
                        }
                    });
                }
                break;

            case 'esp_connected': // Message when a new ESP connects
                const connectedDeviceType = this.identifyDeviceTypeByName(data.name);
                if (connectedDeviceType && this.deviceStates[connectedDeviceType]) {
                    console.log(`🔌✅ ${connectedDeviceType.toUpperCase()} connected to server.`);
                    // We'll wait for actual data from the device before marking it active
                    this.deviceStates[connectedDeviceType].connected = true;
                    this.notifyCallbacks('connected', connectedDeviceType);
                }
                break;

            case 'esp_disconnected': // Message from server indicating an ESP has disconnected
                this.handleESPDisconnection(data);
                break;

            default:
                console.log('📦 Received unhandled message type:', data.type, data);
        }
    }

    processSensorData(data) {
        const deviceType = this.identifyDeviceType(data);

        if (!deviceType || !this.deviceStates[deviceType]) {
            console.warn(`❓ Unknown or unconfigured device type for data:`, data);
            return;
        }

        const device = this.deviceStates[deviceType];

        // Mark as connected if not already (first data implies connection)
        if (!device.connected) {
            device.connected = true;
            console.log(`📡 ${deviceType.toUpperCase()} now considered connected (received data).`);
            this.notifyCallbacks('connected', deviceType);
        }

        device.lastRawData = data;
        const shouldBeActive = this.shouldBeActive(deviceType, data);

        // Update state history
        device.stateHistory.push(shouldBeActive);
        if (device.stateHistory.length > this.maxHistoryLength) {
            device.stateHistory.shift();
        }

        const stableState = this.getStableState(device);

        if (stableState !== null && stableState !== device.active) {
            const timeSinceLastChange = Date.now() - device.lastStateChange;

            if (timeSinceLastChange >= this.minStateChangeInterval) {
                const previousActiveState = device.active; // Capture current active state before changing it
                device.active = stableState;
                device.lastStateChange = Date.now();
                console.log(`🔄 ${deviceType.toUpperCase()} STABLE STATE CHANGE: ${previousActiveState} → ${device.active}`);
                this.notifyCallbacks('stateChange', deviceType, {
                    active: device.active,
                    rawData: data,
                    previousState: previousActiveState // Send the actual previous state
                });
            } else {
                // console.log(`⏳ ${deviceType} state change blocked - too soon.`);
            }
        }
        
        // Always notify about raw data, even if state didn't change
        this.notifyCallbacks('data', deviceType, data);
    }

    shouldBeActive(deviceType, data) {
        // Define activation logic per device
        switch (deviceType) {
            case 'soil':
                // Handle all possible soil data formats
                if (data.soil_condition) { 
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                } else if (data.moisture_app_value !== undefined) { 
                    return data.moisture_app_value > 0.4; 
                } else if (data.voltage !== undefined) {
                    // ESP32 soil data often sends voltage
                    return data.voltage > 0.4;
                } else if (data.raw_value !== undefined) {
                    // ESP32 sometimes sends raw sensor value
                    return data.raw_value < 700; // Assuming lower values are wetter soil
                }
                return false;
                
            case 'light':
                if (data.lightLevel !== undefined) {
                    return data.lightLevel > 500;
                }
                return false;
                
            case 'temp':
                if (data.temperature !== undefined) {
                    return data.temperature > 25;
                }
                return false;
                
            default:
                return false;
        }
    }

    getStableState(device) {
        if (device.stateHistory.length < this.stabilityRequiredReadings) {
            return null; // Not enough data for a stable assessment
        }
        const recentReadings = device.stateHistory.slice(-this.stabilityRequiredReadings);
        const isConsistent = recentReadings.every(reading => reading === recentReadings[0]);
        return isConsistent ? recentReadings[0] : null;
    }

    identifyDeviceType(data) {
        // FIXED: Better detection for ESP32 soil moisture data
        
        // Check for explicit device_type field
        if (data.device_type && this.deviceStates[data.device_type.toLowerCase()]) {
            return data.device_type.toLowerCase();
        }
        
        // Check sensor name
        if (data.sensor) {
            const sensorLower = data.sensor.toLowerCase();
            if (sensorLower.includes('soil') || sensorLower.includes('moisture')) return 'soil';
            if (sensorLower.includes('light') || sensorLower.includes('lux')) return 'light';
            if (sensorLower.includes('temp')) return 'temp';
        }
        
        // Fallback to checking specific fields from ESP32
        if (data.soil_condition !== undefined || 
            data.moisture_app_value !== undefined || 
            data.moisture !== undefined ||
            data.raw_value !== undefined || 
            data.voltage !== undefined) {
            return 'soil';
        }
        
        if (data.lightLevel !== undefined || data.lux !== undefined) return 'light';
        if (data.temperature !== undefined || data.temp !== undefined) return 'temp';
        
        return null;
    }
    
    identifyDeviceTypeByName(name) { // Used by esp_disconnected if name is provided
        if (!name) return null;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('soil')) return 'soil';
        if (nameLower.includes('light')) return 'light';
        if (nameLower.includes('temp')) return 'temp';
        return null;
    }

    handleESPDisconnection(data) { // data typically { type: 'esp_disconnected', name: 'ESP_SOIL' }
        const deviceType = this.identifyDeviceTypeByName(data.name); // Server should send a name/identifier
        if (deviceType && this.deviceStates[deviceType]) {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) { // Only act if it was considered connected or active
                console.log(`🔌❌ ${deviceType.toUpperCase()} reported disconnected by server.`);
                device.connected = false;
                device.active = false; // Ensure it's marked inactive
                device.stateHistory = []; // Clear history
                // device.lastStateChange = Date.now(); // Optional: mark time of this "change"
                
                // Notify listeners about the disconnection.
                // Using a small timeout can help prevent issues if listeners try to immediately update UI
                // that might be in the process of other changes.
                setTimeout(() => {
                    this.notifyCallbacks('disconnected', deviceType);
                }, 50); 
            }
        } else {
            console.warn(`❓ Received ESP disconnection for unknown or unconfigured device:`, data.name);
        }
    }

    markAllDisconnected() {
        console.log('🔌❌ WebSocket connection lost. Marking all devices as disconnected.');
        Object.keys(this.deviceStates).forEach(deviceType => {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) { // Only act if it was considered connected or active
                device.connected = false;
                device.active = false; // Ensure it's marked inactive
                device.stateHistory = [];
                // device.lastStateChange = Date.now(); // Optional

                // Notify for each device that was connected
                setTimeout(() => {
                     this.notifyCallbacks('disconnected', deviceType);
                }, 50);
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Please check server or refresh.`);
            this.notifyCallbacks('reconnectFailed'); // Notify UI about permanent failure
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts -1), 30000); // Exponential backoff
        
        console.log(`🔄 Attempting to reconnect in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }

    // --- Public API for event subscription ---
    on(eventType, callback) {
        if (!this.callbacks[eventType]) {
            this.callbacks[eventType] = [];
        }
        this.callbacks[eventType].push(callback);
    }

    off(eventType, callback) {
        if (this.callbacks[eventType]) {
            this.callbacks[eventType] = this.callbacks[eventType].filter(cb => cb !== callback);
        }
    }

    notifyCallbacks(eventType, ...args) {
        if (this.callbacks[eventType]) {
            // console.log(`🔔 Notifying ${this.callbacks[eventType].length} callbacks for '${eventType}' with args:`, ...args);
            this.callbacks[eventType].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`❌ Error in callback for event '${eventType}':`, error);
                }
            });
        }
    }

    // --- Public API for getting state ---
    getDeviceState(deviceType) {
        const device = this.deviceStates[deviceType];
        return device ? {
            connected: device.connected,
            active: device.active,
            lastStateChange: device.lastStateChange,
            lastRawData: device.lastRawData
        } : null;
    }

    getConnectedDevices() {
        return Object.keys(this.deviceStates).filter(key => this.deviceStates[key].connected);
    }

    getActiveDevices() {
        return Object.keys(this.deviceStates).filter(key => this.deviceStates[key].active);
    }
    
    // --- Debug ---
    getDebugInfo() {
        return {
            wsConnected: this.isConnected,
            clientId: this.clientId,
            reconnectAttempts: this.reconnectAttempts,
            deviceStates: JSON.parse(JSON.stringify(this.deviceStates)), // Deep copy for safety
            connectedDeviceTypes: this.getConnectedDevices(),
            activeDeviceTypes: this.getActiveDevices()
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: Initializing CreaTune System...');
    if (!window.creatune) { // Ensure it's only initialized once
        window.creatune = new CreaTuneClient();
        window.creatune.init(); // Start the connection process
    } else {
        console.log('ℹ️ CreaTuneClient already initialized.');
    }
});

// Export for potential module usage (though primarily designed for global window.creatune)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreaTuneClient;
}