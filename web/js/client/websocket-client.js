class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Initial delay
        this.clientId = null;

        this.deviceStates = {
            soil: {
                connected: false,
                active: false, // Based on 'humid' or 'wet'
                lastRawData: null,
                lastStateChange: 0,
                stateHistory: []
            },
            // Add other devices here if needed (e.g., light, temp)
        };

        this.stabilityRequiredReadings = 3;
        this.maxHistoryLength = 5;
        this.minStateChangeInterval = 1000; // ms

        this.callbacks = {};
        // init() will be called by DOMContentLoaded
    }

    init() {
        console.log('🔌 Initializing CreaTune WebSocket Client...');
        this.connect();
    }

    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`; // Assumes server is on same host/port
            console.log(`🔗 Attempting WebSocket connection: ${wsUrl}`);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected successfully.');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.notifyCallbacks('websocketOpen');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // console.log('📥 Received message:', data); // Uncomment for deep debug
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing message:', event.data, error);
                }
            };

            this.ws.onclose = (event) => {
                console.log(`🔌❌ WebSocket disconnected (Code: ${event.code}, Reason: "${event.reason || 'N/A'}")`);
                this.isConnected = false;
                this.markAllDisconnected(); // Mark internal states and notify listeners
                this.notifyCallbacks('websocketClose');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('🚫 WebSocket error:', error.message || 'Unknown error');
                this.isConnected = false; // onclose will usually follow
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.attemptReconnect();
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.clientId = data.clientId;
                console.log(`🎉 Welcome! Client ID: ${this.clientId}.`);
                // Optionally request initial ESP status
                // this.sendMessage({ type: 'get_esp_status' });
                break;

            case 'ping': // Server's application-level ping
                this.sendMessage({ type: 'pong', timestamp: data.timestamp, response_time: Date.now() });
                break;

            case 'sensor_data':
                this.processSensorData(data);
                break;

            case 'esp_status_list':
                console.log('📡 ESP Status List received:', data.devices);
                if (Array.isArray(data.devices)) {
                    data.devices.forEach(deviceStatus => {
                        const deviceType = this.identifyDeviceTypeByName(deviceStatus.name);
                        if (deviceType && this.deviceStates[deviceType]) {
                            const localDevice = this.deviceStates[deviceType];
                            if (deviceStatus.connected && !localDevice.connected) {
                                localDevice.connected = true;
                                this.notifyCallbacks('connected', deviceType);
                            } else if (!deviceStatus.connected && localDevice.connected) {
                                localDevice.connected = false;
                                localDevice.active = false; // If disconnected, it can't be active
                                this.notifyCallbacks('disconnected', deviceType);
                            }
                        }
                    });
                }
                break;

            case 'esp_connected':
                const connectedDeviceType = this.identifyDeviceTypeByName(data.name);
                if (connectedDeviceType && this.deviceStates[connectedDeviceType]) {
                    console.log(`🔌✅ ${connectedDeviceType.toUpperCase()} connected to server (name: ${data.name}).`);
                    this.deviceStates[connectedDeviceType].connected = true;
                    this.notifyCallbacks('connected', connectedDeviceType);
                }
                break;

            case 'esp_disconnected':
                this.handleESPDisconnection(data);
                break;

            default:
                console.log('📦 Received unhandled message type:', data.type, data);
        }
    }

    processSensorData(data) {
        const deviceType = this.identifyDeviceType(data);

        if (!deviceType || !this.deviceStates[deviceType]) {
            console.warn(`❓ Unknown or unconfigured device type for sensor data:`, data);
            return;
        }

        const device = this.deviceStates[deviceType];

        if (!device.connected) { // First data implies connection if not already marked
            device.connected = true;
            console.log(`📡 ${deviceType.toUpperCase()} now considered connected (received data).`);
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
                console.log(`🔄 ${deviceType.toUpperCase()} STABLE STATE CHANGE: ${previousActiveState} → ${device.active}`);
                this.notifyCallbacks('stateChange', deviceType, {
                    active: device.active,
                    rawData: data,
                    previousState: previousActiveState
                });
            }
        }
        this.notifyCallbacks('data', deviceType, data); // Notify raw data regardless of state change
    }

    shouldBeActive(deviceType, data) {
        switch (deviceType) {
            case 'soil':
                if (data.soil_condition) {
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                }
                // Fallbacks (less ideal if soil_condition is always sent)
                else if (data.moisture_app_value !== undefined) return data.moisture_app_value > 0.3;
                else if (data.voltage !== undefined) return data.voltage > 0.4;
                else if (data.raw_value !== undefined) return data.raw_value < 700 && data.raw_value > 0;
                console.warn(`💧 Soil: No recognizable activity fields in data:`, data);
                return false;
            // Add other device types if needed
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

    identifyDeviceType(data) { // From sensor_data message
        if (data.device_type && this.deviceStates[data.device_type.toLowerCase()]) {
            return data.device_type.toLowerCase();
        }
        if (data.sensor) { // ESP32 sends 'sensor' field with SENSOR_NAME
            const sensorLower = data.sensor.toLowerCase();
            if (sensorLower.includes('soil') || sensorLower.includes('moisture')) return 'soil';
            if (sensorLower.includes('light')) return 'light';
            if (sensorLower.includes('temp')) return 'temp';
        }
        // Fallback for soil if specific fields are present
        if (data.soil_condition !== undefined || data.moisture_app_value !== undefined || data.voltage !== undefined || data.raw_value !== undefined) {
            return 'soil';
        }
        return null;
    }

    identifyDeviceTypeByName(name) { // From esp_connected/disconnected messages
        if (!name) return null;
        const nameLower = name.toLowerCase();
        if (nameLower.includes('soil') || nameLower.includes('moisture')) return 'soil';
        if (nameLower.includes('light')) return 'light';
        if (nameLower.includes('temp')) return 'temp';
        return null;
    }

    handleESPDisconnection(data) {
        const deviceType = this.identifyDeviceTypeByName(data.name);
        if (deviceType && this.deviceStates[deviceType]) {
            const device = this.deviceStates[deviceType];
            if (device.connected || device.active) {
                console.log(`🔌❌ ${deviceType.toUpperCase()} reported disconnected by server (name: ${data.name}, reason: ${data.reason || 'N/A'}).`);
                device.connected = false;
                device.active = false;
                device.stateHistory = [];
                this.notifyCallbacks('disconnected', deviceType);
            }
        } else {
            console.warn(`❓ Received ESP disconnection for unknown device name:`, data.name);
        }
    }

    markAllDisconnected() {
        console.log('🔌❌ Client-side: Marking all devices as disconnected due to WebSocket closure.');
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
            console.error(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached.`);
            this.notifyCallbacks('reconnectFailed');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
        console.log(`🔄 Attempting to reconnect in ${(delay / 1000).toFixed(1)}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        setTimeout(() => this.connect(), delay);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message, WebSocket not open.');
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
        const device = this.deviceStates[deviceType];
        return device ? { ...device } : null; // Return a copy
    }

    getConnectedDevices() {
        return Object.keys(this.deviceStates).filter(key => this.deviceStates[key].connected);
    }

    getActiveDevices() {
        return Object.keys(this.deviceStates).filter(key => this.deviceStates[key].active);
    }

    getDebugInfo() {
        return {
            wsConnected: this.isConnected,
            clientId: this.clientId,
            reconnectAttempts: this.reconnectAttempts,
            deviceStates: JSON.parse(JSON.stringify(this.deviceStates)),
            connectedDeviceTypes: this.getConnectedDevices(),
            activeDeviceTypes: this.getActiveDevices()
        };
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