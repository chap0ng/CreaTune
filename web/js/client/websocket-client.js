class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10; // Increased max attempts
        this.reconnectDelay = 1000;    // Initial delay
        this.clientId = null;

        // !!! IMPORTANT: SET YOUR PHONE'S ACTUAL WI-FI IP ADDRESS AND PORT HERE !!!
        // This is the IP address your Termux server is reachable on from your local network.
        // Example: '192.168.1.100:8080'
        this.serverHostOverride = '192.168.0.100:8080'; // <--- REPLACE THIS!

        this.deviceStates = {
            soil: {
                connected: false,
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            },
            // light: { connected: false, active: false, lastRawData: null, lastStateChange: 0, stateHistory: [] },
            // temp: { connected: false, active: false, lastRawData: null, lastStateChange: 0, stateHistory: [] },
        };

        this.stabilityRequiredReadings = 3;
        this.maxHistoryLength = 5;
        this.minStateChangeInterval = 1000; // ms

        this.callbacks = {};
        this.debug = true; // Enable/disable console logs easily
    }

    init() {
        if (this.debug) console.log('🔌 Initializing CreaTune WebSocket Client...');
        this.connect();
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let targetHost = window.location.host; // Default target

            // If the PWA is launched (its window.location.host is localhost)
            // AND a serverHostOverride is set, use the override.
            // This ensures the installed PWA targets the phone's network IP.
            if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverHostOverride && this.serverHostOverride !== 'YOUR_PHONE_WIFI_IP_ADDRESS:8080') {
                targetHost = this.serverHostOverride;
                if (this.debug) console.log(`🔗 Overriding WebSocket host to: ${targetHost} (PWA/localhost context)`);
            }
            
            const wsUrl = `${protocol}//${targetHost}`;
            
            if (this.debug) console.log(`🔗 Attempting WebSocket connection to: ${wsUrl}`);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                if (this.debug) console.log('✅ WebSocket connected successfully.');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000; // Reset delay on successful connection
                this.notifyCallbacks('websocketOpen');
                // Optionally request initial ESP status upon connection
                this.sendMessage({ type: 'get_esp_status' });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // if (this.debug) console.log('📥 Received message:', data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing message:', event.data, error);
                }
            };

            this.ws.onclose = (event) => {
                if (this.debug) console.log(`🔌❌ WebSocket disconnected (Code: ${event.code}, Reason: "${event.reason || 'N/A'}")`);
                this.isConnected = false;
                this.markAllDisconnected();
                this.notifyCallbacks('websocketClose');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('🚫 WebSocket error:', error.message || 'Unknown WebSocket error');
                // onclose will usually follow, triggering reconnect logic
                this.isConnected = false;
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

            case 'ping':
                this.sendMessage({ type: 'pong', timestamp: data.timestamp, response_time: Date.now() });
                break;

            case 'sensor_data':
                this.processSensorData(data);
                break;

            case 'esp_status_list':
                if (this.debug) console.log('📡 ESP Status List received:', data.devices);
                if (Array.isArray(data.devices)) {
                    data.devices.forEach(deviceStatus => {
                        const deviceType = this.identifyDeviceTypeByName(deviceStatus.name);
                        if (deviceType && this.deviceStates[deviceType]) {
                            const localDevice = this.deviceStates[deviceType];
                            const wasConnected = localDevice.connected;
                            localDevice.connected = deviceStatus.connected;

                            if (localDevice.connected && !wasConnected) {
                                this.notifyCallbacks('connected', deviceType);
                            } else if (!localDevice.connected && wasConnected) {
                                localDevice.active = false;
                                this.notifyCallbacks('disconnected', deviceType);
                            }
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
                    rawData: data,
                    previousState: previousActiveState
                });
            }
        }
        this.notifyCallbacks('data', deviceType, data);
    }

    shouldBeActive(deviceType, data) {
        switch (deviceType) {
            case 'soil':
                if (data.soil_condition) {
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                }
                if (data.moisture_app_value !== undefined) return data.moisture_app_value > 0.3;
                if (data.voltage !== undefined) return data.voltage > 0.4; // Adjust based on your sensor
                if (data.raw_value !== undefined) return data.raw_value < 700 && data.raw_value > 0; // Adjust
                if (this.debug) console.warn(`💧 Soil: No recognizable activity fields in data:`, data);
                return false;
            default:
                return false;
        }
    }

    getStableState(device) {
        if (device.stateHistory.length < this.stabilityRequiredReadings) {
            return null;
        }
        const recentReadings = device.stateHistory.slice(-this.stabilityRequiredReadings);
        const isConsistent = recentReadings.every(reading => reading === recentReadings[0]);
        return isConsistent ? recentReadings[0] : null;
    }

    identifyDeviceType(data) {
        if (data.device_type && this.deviceStates[data.device_type.toLowerCase()]) {
            return data.device_type.toLowerCase();
        }
        if (data.sensor) {
            const sensorLower = data.sensor.toLowerCase();
            if (sensorLower.includes('soil') || sensorLower.includes('moisture')) return 'soil';
            // if (sensorLower.includes('light')) return 'light';
            // if (sensorLower.includes('temp')) return 'temp';
        }
        if (data.soil_condition !== undefined || data.moisture_app_value !== undefined || data.voltage !== undefined || data.raw_value !== undefined) {
            return 'soil';
        }
        return null;
    }

    identifyDeviceTypeByName(name) {
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
            if (device.connected || device.active) {
                if (this.debug) console.log(`🔌❌ ${deviceType.toUpperCase()} reported disconnected by server (name: ${data.name}, reason: ${data.reason || 'N/A'}).`);
                device.connected = false;
                device.active = false;
                device.stateHistory = [];
                this.notifyCallbacks('disconnected', deviceType);
            }
        } else {
            if (this.debug) console.warn(`❓ Received ESP disconnection for unknown device name:`, data.name);
        }
    }

    markAllDisconnected() {
        if (this.debug) console.log('🔌❌ Client-side: Marking all devices as disconnected due to WebSocket closure.');
        Object.keys(this.deviceStates).forEach(deviceType => {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) {
                device.connected = false;
                device.active = false;
                device.stateHistory = [];
                this.notifyCallbacks('disconnected', deviceType);
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping.`);
            this.notifyCallbacks('reconnectFailed');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000); // Exponential backoff with max
        if (this.debug) console.log(`🔄 Attempting to reconnect in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => this.connect(), delay);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
            }
        } else {
            if (this.debug) console.warn('⚠️ Cannot send message, WebSocket not open.');
        }
    }

    on(eventType, callback) {
        if (!this.callbacks[eventType]) this.callbacks[eventType] = [];
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
        const device = this.deviceStates[deviceType.toLowerCase()];
        return device ? { ...device } : null;
    }
}

// Global instance
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: Initializing CreaTune System...');
    if (!window.creatune) {
        window.creatune = new CreaTuneClient();
        window.creatune.init(); // Call init to start connection attempts
    } else {
        console.log('ℹ️ CreaTuneClient already initialized.');
    }
});

// For potential Node.js environment (testing, etc.) - not typically used in browser context for this file
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreaTuneClient;
}