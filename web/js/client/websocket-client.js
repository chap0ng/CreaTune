class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10; // Max attempts before stopping
        this.reconnectDelay = 1000;    // Initial delay in ms
        this.clientId = null;

        // !!! CRUCIAL: SET YOUR PHONE'S ACTUAL WI-FI IP ADDRESS AND PORT HERE !!!
        // This is the IP address your Termux server is reachable on from your local network.
        // Example: '192.168.0.100:8080'
        this.serverHostOverride = '192.168.0.100:8080'; // <--- REPLACE THIS WITH YOUR ACTUAL PHONE IP!

        this.deviceStates = {
            soil: {
                connected: false,
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: [] // To store recent true/false activity states
            },
            // Add other devices here if needed, e.g.:
            // light: { connected: false, active: false, lastRawData: null, lastStateChange: 0, stateHistory: [] },
            // temp: { connected: false, active: false, lastRawData: null, lastStateChange: 0, stateHistory: [] },
        };

        // Parameters for stabilizing sensor readings
        this.stabilityRequiredReadings = 3; // Number of consistent readings to confirm state change
        this.maxHistoryLength = 5;          // Max number of readings to keep for stability check
        this.minStateChangeInterval = 1000; // Minimum time (ms) between state change notifications

        this.callbacks = {}; // For event listeners like on('data', callback)
        this.debug = true;  // Enable/disable console logs easily
    }

    init() {
        if (this.debug) console.log('🔌 Initializing CreaTune WebSocket Client...');
        this.connect();
        this.setupBrowserEventListeners();
    }

    setupBrowserEventListeners() {
        if (this.debug) console.log('🔗 Setting up browser event listeners for network and visibility.');

        window.addEventListener('online', () => {
            if (this.debug) console.log('🟢 Network status: Online');
            if (!this.isConnected && (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
                if (this.debug) console.log('Network came online, WebSocket was closed. Attempting to reconnect.');
                this.reconnectAttempts = 0; // Reset attempts for a fresh start
                this.connect();
            } else if (!this.isConnected) {
                 if (this.debug) console.log('Network came online, but WebSocket state unknown or already connecting. Triggering connect.');
                 this.reconnectAttempts = 0;
                 this.connect();
            }
        });

        window.addEventListener('offline', () => {
            if (this.debug) console.log('🔴 Network status: Offline');
            // WebSocket onclose should handle actual disconnection.
        });

        document.addEventListener('visibilitychange', () => {
            if (this.debug) console.log(`💡 App visibility changed to: ${document.visibilityState}`);
            if (document.visibilityState === 'visible') {
                if (!this.isConnected && (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
                    if (this.debug) console.log('App became visible and WebSocket was closed. Attempting to reconnect.');
                    this.reconnectAttempts = 0; // Reset attempts
                    this.connect();
                } else if (!this.isConnected) {
                    if (this.debug) console.log('App became visible, WebSocket not connected. Triggering connect.');
                    this.reconnectAttempts = 0;
                    this.connect();
                } else if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    if (this.debug) console.log('App became visible and WebSocket is open. Requesting fresh ESP status.');
                    this.sendMessage({ type: 'get_esp_status' }); // Refresh ESP status
                }
            }
        });
    }

    connect() {
        try {
            if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                if (this.debug) console.log('🔗 WebSocket connection attempt already in progress. Skipping.');
                return;
            }

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let targetHost = window.location.host;

            // Override for PWA context (installed app where window.location.host is localhost)
            if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
                this.serverHostOverride && this.serverHostOverride.toLowerCase() !== 'your_phone_wifi_ip_address:8080') { // Check against placeholder
                targetHost = this.serverHostOverride;
                if (this.debug && (this.reconnectAttempts === 0 || !this.isConnected)) console.log(`🔗 Using serverHostOverride for WebSocket: ${targetHost} (PWA/localhost context)`);
            }
            
            const wsUrl = `${protocol}//${targetHost}`;
            
            if (this.debug) console.log(`🔗 Attempting WebSocket connection to: ${wsUrl} (Attempt: ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                if (this.debug) console.log('✅ WebSocket connected successfully.');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000; // Reset delay on successful connection
                this.notifyCallbacks('websocketOpen');
                this.sendMessage({ type: 'get_esp_status' }); // Request initial ESP status
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // if (this.debug) console.log('📥 Received message:', data); // Can be too verbose
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing message:', event.data, error);
                }
            };

            this.ws.onclose = (event) => {
                if (this.debug) console.log(`🔌❌ WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason || 'N/A'}", Clean: ${event.wasClean}.`);
                this.isConnected = false;
                this.markAllDisconnected(); // This will notify SoilHandler etc.
                this.notifyCallbacks('websocketClose', { code: event.code, reason: event.reason, wasClean: event.wasClean });
                this.attemptReconnect();
            };

            this.ws.onerror = (errorEvent) => {
                // The error event itself doesn't give much info, onclose usually follows with details.
                if (this.debug) console.error('🚫 WebSocket error event occurred. See following close event for details.', errorEvent);
                // this.isConnected = false; // onclose will handle this and trigger reconnect
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket connection object:', error);
            this.attemptReconnect(); // Attempt to reconnect if WebSocket constructor fails
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.clientId = data.clientId;
                if (this.debug) console.log(`🎉 Welcome! Client ID: ${this.clientId}.`);
                break;

            case 'ping': // Server initiated ping
                this.sendMessage({ type: 'pong', timestamp: data.timestamp, response_time: Date.now() });
                break;

            case 'sensor_data':
                this.processSensorData(data);
                break;

            case 'esp_status_list':
                if (this.debug) console.log('📡 ESP Status List received:', data.devices);
                if (Array.isArray(data.devices)) {
                    const serverReportedDeviceTypes = new Set();

                    data.devices.forEach(deviceStatusFromServer => {
                        const deviceType = this.identifyDeviceTypeByName(deviceStatusFromServer.name);
                        if (deviceType && this.deviceStates[deviceType]) {
                            serverReportedDeviceTypes.add(deviceType);
                            const localDeviceState = this.deviceStates[deviceType];
                            const wasConnectedLocally = localDeviceState.connected;
                            const isConnectedOnServer = deviceStatusFromServer.connected;

                            localDeviceState.connected = isConnectedOnServer;

                            if (isConnectedOnServer && !wasConnectedLocally) {
                                if (this.debug) console.log(`📡 ${deviceType.toUpperCase()} now marked connected via status list.`);
                                this.notifyCallbacks('connected', deviceType);
                            } else if (!isConnectedOnServer && wasConnectedLocally) {
                                if (this.debug) console.log(`📡 ${deviceType.toUpperCase()} now marked disconnected via status list.`);
                                localDeviceState.active = false;
                                this.notifyCallbacks('disconnected', deviceType);
                            }
                        }
                    });

                    Object.keys(this.deviceStates).forEach(localDeviceType => {
                        const localDeviceState = this.deviceStates[localDeviceType];
                        if (localDeviceState.connected && !serverReportedDeviceTypes.has(localDeviceType)) {
                            if (this.debug) console.log(`📡 ${localDeviceType.toUpperCase()} was connected locally but NOT in server's status list. Marking disconnected.`);
                            localDeviceState.connected = false;
                            localDeviceState.active = false;
                            this.notifyCallbacks('disconnected', localDeviceType);
                        }
                    });
                }
                break;

            case 'esp_connected':
                const connectedDeviceType = this.identifyDeviceTypeByName(data.name);
                if (connectedDeviceType && this.deviceStates[connectedDeviceType]) {
                    if (this.debug) console.log(`🔌✅ ${connectedDeviceType.toUpperCase()} connected to server (name: ${data.name}).`);
                    this.deviceStates[connectedDeviceType].connected = true;
                    this.notifyCallbacks('connected', connectedDeviceType);
                }
                break;

            case 'esp_disconnected':
                this.handleESPDisconnection(data);
                break;

            default:
                if (this.debug) console.log('📦 Received unhandled message type:', data.type, data);
        }
    }

    processSensorData(data) {
        const deviceType = this.identifyDeviceType(data);

        if (!deviceType || !this.deviceStates[deviceType]) {
            if (this.debug) console.warn(`❓ Unknown or unconfigured device type for sensor data:`, data);
            return;
        }

        const device = this.deviceStates[deviceType];

        // If we receive data, and the device wasn't marked as connected, mark it now.
        if (!device.connected) {
            device.connected = true; // Assume connected if we get data
            if (this.debug) console.log(`📡 ${deviceType.toUpperCase()} now considered connected (received data).`);
            this.notifyCallbacks('connected', deviceType);
        }

        device.lastRawData = data; // Store the latest raw data
        const shouldBeActiveNow = this.shouldBeActive(deviceType, data);

        // Update state history for stability check
        device.stateHistory.push(shouldBeActiveNow);
        if (device.stateHistory.length > this.maxHistoryLength) {
            device.stateHistory.shift();
        }

        const stableState = this.getStableState(device);

        // Check if stable state is different from current active state and if min interval passed
        if (stableState !== null && stableState !== device.active) {
            const timeSinceLastChange = Date.now() - device.lastStateChange;
            if (timeSinceLastChange >= this.minStateChangeInterval) {
                const previousActiveState = device.active;
                device.active = stableState;
                device.lastStateChange = Date.now();
                if (this.debug) console.log(`🔄 ${deviceType.toUpperCase()} STABLE STATE CHANGE: ${previousActiveState} → ${device.active}`);
                this.notifyCallbacks('stateChange', deviceType, {
                    active: device.active,
                    rawData: data,
                    previousState: previousActiveState
                });
            }
        }
        // Always notify raw data if there are listeners for it
        this.notifyCallbacks('data', deviceType, data);
    }

    shouldBeActive(deviceType, data) {
        // Define activation logic based on sensor data
        switch (deviceType) {
            case 'soil':
                // Prioritize explicit soil_condition if available
                if (data.soil_condition) {
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                }
                // Fallback to other potential fields
                if (data.moisture_app_value !== undefined) return data.moisture_app_value > 0.3; // Example threshold
                if (data.voltage !== undefined) return data.voltage > 0.4; // Example threshold
                if (data.raw_value !== undefined) return data.raw_value < 700 && data.raw_value > 0; // Example for some sensors
                if (this.debug) console.warn(`💧 Soil: No recognizable activity fields in data:`, data);
                return false; // Default to inactive if no criteria met
            // Add cases for 'light', 'temp' etc. if needed
            // case 'light':
            //     if (data.lux !== undefined) return data.lux < 100; // Example: active if dark
            //     return false;
            default:
                return false;
        }
    }

    getStableState(device) {
        if (device.stateHistory.length < this.stabilityRequiredReadings) {
            return null; // Not enough data for a stable state
        }
        const recentReadings = device.stateHistory.slice(-this.stabilityRequiredReadings);
        const isConsistent = recentReadings.every(reading => reading === recentReadings[0]);
        return isConsistent ? recentReadings[0] : null;
    }

    identifyDeviceType(data) {
        // Try to identify device type from data payload
        if (data.device_type && this.deviceStates[data.device_type.toLowerCase()]) {
            return data.device_type.toLowerCase();
        }
        if (data.sensor) { // Common field from ESPs
            const sensorLower = data.sensor.toLowerCase();
            if (sensorLower.includes('soil') || sensorLower.includes('moisture')) return 'soil';
            // if (sensorLower.includes('light') || sensorLower.includes('lux')) return 'light';
            // if (sensorLower.includes('temp') || sensorLower.includes('dht')) return 'temp';
        }
        // Fallback checks based on unique data fields
        if (data.soil_condition !== undefined || data.moisture_app_value !== undefined || data.voltage !== undefined || data.raw_value !== undefined) {
            return 'soil';
        }
        // if (data.lux !== undefined) return 'light';
        // if (data.temperature !== undefined && data.humidity !== undefined) return 'temp';
        return null; // Cannot identify
    }

    identifyDeviceTypeByName(name) {
        // Identify device type from its registered name (e.g., "ESP32-Soil")
        if (!name) return null;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('soil') || nameLower.includes('moisture')) return 'soil';
        // if (nameLower.includes('light')) return 'light';
        // if (nameLower.includes('temp')) return 'temp';
        return null;
    }

    handleESPDisconnection(data) {
        const deviceType = this.identifyDeviceTypeByName(data.name);
        if (deviceType && this.deviceStates[deviceType]) {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) { // Only update if there was a change
                if (this.debug) console.log(`🔌❌ ${deviceType.toUpperCase()} reported disconnected by server (name: ${data.name}, reason: ${data.reason || 'N/A'}).`);
                device.connected = false;
                device.active = false; // If disconnected, it cannot be active
                device.stateHistory = []; // Clear history
                this.notifyCallbacks('disconnected', deviceType);
            }
        } else {
            if (this.debug) console.warn(`❓ Received ESP disconnection for unknown device name:`, data.name);
        }
    }

    markAllDisconnected() {
        if (this.debug) console.log('🔌❌ Client-side: Marking all devices as disconnected due to WebSocket closure or explicit call.');
        Object.keys(this.deviceStates).forEach(deviceType => {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) {
                const wasConnected = device.connected;
                const wasActive = device.active;
                device.connected = false;
                device.active = false;
                device.stateHistory = [];
                if (wasConnected || wasActive) { // Only notify if there was a change
                    this.notifyCallbacks('disconnected', deviceType);
                }
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            const targetForLog = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverHostOverride && this.serverHostOverride.toLowerCase() !== 'your_phone_wifi_ip_address:8080'
                ? this.serverHostOverride
                : window.location.host;
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${targetForLog}. Stopping.`);
            this.notifyCallbacks('reconnectFailed');
            return;
        }
        this.reconnectAttempts++;
        // Exponential backoff, but ensure it doesn't grow too quickly initially
        const delay = Math.min(this.reconnectDelay * Math.pow(1.3, this.reconnectAttempts - 1), 30000); // Slower backoff, max 30s
        
        const targetForLog = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverHostOverride && this.serverHostOverride.toLowerCase() !== 'your_phone_wifi_ip_address:8080'
            ? this.serverHostOverride
            : window.location.host;

        if (this.debug) console.log(`🔄 Attempting to reconnect to ${targetForLog} in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                if (this.debug) console.log('🔄 Reconnect timer fired, but WebSocket is already open. Aborting this reconnect attempt.');
                this.reconnectAttempts = 0;
                return;
            }
            this.connect();
        }, delay);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
            }
        } else {
            if (this.debug) console.warn('⚠️ Cannot send message, WebSocket not open or connecting.');
        }
    }

    // Event listener methods
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
            this.callbacks[eventType].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`❌ Error in callback for event '${eventType}':`, error);
                }
            });
        }
    }

    getDeviceState(deviceType) {
        const type = deviceType.toLowerCase();
        const device = this.deviceStates[type];
        return device ? { ...device } : null; // Return a copy to prevent direct modification
    }
}

// Global instance initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: Initializing CreaTune System...');
    if (!window.creatune) {
        window.creatune = new CreaTuneClient();
        window.creatune.init(); // This now also calls setupBrowserEventListeners
    } else {
        console.log('ℹ️ CreaTuneClient already initialized.');
    }
});

// For potential Node.js environment (testing, etc.) - not typically used in browser context for this file
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreaTuneClient;
}