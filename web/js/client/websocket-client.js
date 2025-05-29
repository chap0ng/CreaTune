class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false; // General connection to the WebSocket server
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.clientId = null;

        this.serverHostOverride = '192.168.0.100:8080'; // Your server's IP

        this.deviceStates = {
            soil: {
                connected: false, // Specific connection status for this device type
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            },
            light: { // <<< FULLY ENABLED LIGHT SENSOR STATE
                connected: false,
                active: false,
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            }
            // temp: { connected: false, active: false, lastRawData: null, lastStateChange: 0, stateHistory: [] },
        };

        this.stabilityRequiredReadings = 3;
        this.maxHistoryLength = 5;
        this.minStateChangeInterval = 1000; // ms

        this.callbacks = {};
        this.debug = true;
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
                this.reconnectAttempts = 0;
                this.connect();
            }
        });
        window.addEventListener('offline', () => {
            if (this.debug) console.log('🔴 Network status: Offline');
        });
        document.addEventListener('visibilitychange', () => {
            if (this.debug) console.log(`💡 App visibility changed to: ${document.visibilityState}`);
            if (document.visibilityState === 'visible') {
                if (!this.isConnected && (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
                    if (this.debug) console.log('App became visible and WebSocket was closed. Attempting to reconnect.');
                    this.reconnectAttempts = 0;
                    this.connect();
                } else if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    if (this.debug) console.log('App became visible and WebSocket is open. Requesting fresh ESP status.');
                    this.sendMessage({ type: 'get_esp_status' });
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
            if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverHostOverride) {
                targetHost = this.serverHostOverride;
            }
            const wsUrl = `${protocol}//${targetHost}`;
            if (this.debug) console.log(`🔗 Attempting WebSocket connection to: ${wsUrl} (Attempt: ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = () => {
                if (this.debug) console.log('✅ WebSocket connected successfully.');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.notifyCallbacks('websocketOpen');
                this.sendMessage({ type: 'get_esp_status' });
            };
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing message:', event.data, error);
                }
            };
            this.ws.onclose = (event) => {
                if (this.debug) console.log(`🔌❌ WebSocket disconnected. Code: ${event.code}, Reason: "${event.reason || 'N/A'}", Clean: ${event.wasClean}.`);
                this.isConnected = false;
                this.markAllDisconnected();
                this.notifyCallbacks('websocketClose', { code: event.code, reason: event.reason, wasClean: event.wasClean });
                this.attemptReconnect();
            };
            this.ws.onerror = (errorEvent) => {
                if (this.debug) console.error('🚫 WebSocket error event occurred.', errorEvent);
            };
        } catch (error) {
            console.error('❌ Failed to create WebSocket connection object:', error);
            this.attemptReconnect();
        }
    }

    handleMessage(data) {
        if (this.debug && data.type !== 'ping' && data.type !== 'sensor_data') { // Avoid flooding console for frequent messages
             console.log('[CreaTuneClient] Received message:', data);
        }

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
            if (this.debug) console.warn(`❓ Unknown or unconfigured device type for sensor data:`, data, `Identified as: ${deviceType}`);
            return;
        }
        // if (this.debug) console.log(`[Client] Processing sensor data for ${deviceType}:`, data);

        const device = this.deviceStates[deviceType];

        if (!device.connected) { // If data arrives, mark as connected
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
        this.notifyCallbacks('data', deviceType, data); // Always notify for raw data
    }

    shouldBeActive(deviceType, data) {
        switch (deviceType) {
            case 'soil':
                if (data.soil_condition) {
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                }
                // Fallbacks for soil
                if (data.moisture_app_value !== undefined) return data.moisture_app_value > 0.3;
                if (data.voltage !== undefined) return data.voltage > 0.4;
                if (data.raw_value !== undefined) return data.raw_value < 700 && data.raw_value > 0;
                if (this.debug) console.warn(`💧 Soil: No recognizable activity fields in data:`, data);
                return false;
            case 'light': // <<< ADDED LIGHT CASE
                if (data.light_condition) {
                    return data.light_condition === 'dim' ||
                           data.light_condition === 'bright' ||
                           data.light_condition === 'very_bright' ||
                           data.light_condition === 'extremely_bright';
                }
                // Fallback for light
                if (data.light_app_value !== undefined) return data.light_app_value > 0.2; // Active if not very dark
                if (this.debug) console.warn(`💡 Light: No recognizable activity fields in data:`, data);
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
        // Prefer explicit device_type from server if available
        if (data.device_type && this.deviceStates[data.device_type.toLowerCase()]) {
            return data.device_type.toLowerCase();
        }
        // Then check sensor name
        if (data.sensor) {
            const sensorLower = data.sensor.toLowerCase();
            if (sensorLower.includes('soil') || sensorLower.includes('moisture')) return 'soil';
            if (sensorLower.includes('light')) return 'light'; // <<< UNCOMMENTED
        }
        // Fallback to specific data fields
        if (data.soil_condition !== undefined || data.moisture_app_value !== undefined) {
            return 'soil';
        }
        if (data.light_condition !== undefined || data.light_app_value !== undefined) { // <<< UNCOMMENTED
            return 'light';
        }
        return null; // Could not identify
    }

    identifyDeviceTypeByName(name) {
        if (!name) return null;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('soil') || nameLower.includes('moisture')) return 'soil';
        if (nameLower.includes('light')) return 'light'; // <<< UNCOMMENTED
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
        if (this.debug) console.log('🔌❌ Client-side: Marking all devices as disconnected due to WebSocket closure or explicit call.');
        Object.keys(this.deviceStates).forEach(deviceType => {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) {
                const wasConnected = device.connected;
                // const wasActive = device.active; // Not needed for this logic
                device.connected = false;
                device.active = false;
                device.stateHistory = [];
                if (wasConnected) { // Only notify if it was previously connected
                    this.notifyCallbacks('disconnected', deviceType);
                }
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            const targetForLog = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverHostOverride ? this.serverHostOverride : window.location.host;
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${targetForLog}. Stopping.`);
            this.notifyCallbacks('reconnectFailed');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(1.3, this.reconnectAttempts - 1), 30000);
        const targetForLog = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverHostOverride ? this.serverHostOverride : window.location.host;
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
        const type = deviceType.toLowerCase();
        const device = this.deviceStates[type];
        return device ? { ...device } : null; // Return a copy
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded: Initializing CreaTune System...');
    if (!window.creatune) {
        window.creatune = new CreaTuneClient();
        window.creatune.init();
    } else {
        console.log('ℹ️ CreaTuneClient already initialized.');
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreaTuneClient;
}