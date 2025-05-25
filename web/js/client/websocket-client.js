// websocket-client.js
// STABLE DATA FLOW - Acts as a filter/processor

class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 2;
        this.reconnectDelay = 1000;
        this.clientId = null;
        
        // ✅ STABLE STATE SYSTEM - Only tracks clean states
        this.deviceStates = {
            soil: {
                connected: false,
                active: false,        // Clean on/off state
                lastRawData: null,
                lastStateChange: 0,   // When state last changed
                stateHistory: []      // Track recent states for stability
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
        
        // ✅ STABILITY SETTINGS
        this.stabilityRequiredReadings = 3;  // Need 3 consistent readings
        this.maxHistoryLength = 5;
        this.minStateChangeInterval = 2000;  // 2 seconds between state changes
        
        this.callbacks = [];
        this.init();
    }
    
    init() {
        console.log('🔌 Initializing STABLE WebSocket Client...');
        this.connect();
        window.creatune = this;
    }
    
    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌❌ WebSocket disconnected');
                this.isConnected = false;
                this.markAllDisconnected();
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('🚫 WebSocket error:', error);
                this.isConnected = false;
            };
            
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
            this.attemptReconnect();
        }
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.clientId = data.clientId;
                console.log(`🎉 Connected! Client ID: ${this.clientId}`);
                break;
                
            case 'sensor_data':
                this.processSensorData(data);
                break;
                
            case 'esp_disconnected':
                this.handleESPDisconnection(data);
                break;
        }
    }
    
    // ✅ CORE: Process sensor data and create stable states
    processSensorData(data) {
        const deviceType = this.identifyDeviceType(data);
        
        if (!deviceType || !this.deviceStates[deviceType]) {
            console.log(`❓ Unknown device type for data:`, data);
            return;
        }
        
        const device = this.deviceStates[deviceType];
        
        // ✅ STEP 1: Mark as connected (data = connection)
        if (!device.connected) {
            device.connected = true;
            console.log(`📡 ${deviceType.toUpperCase()} connected via data`);
            this.notifyCallbacks('connected', deviceType);
        }
        
        // ✅ STEP 2: Store raw data
        device.lastRawData = data;
        
        // ✅ STEP 3: Determine if this data should be "active"
        const shouldBeActive = this.shouldBeActive(deviceType, data);
        
        // ✅ STEP 4: Add to stability history
        device.stateHistory.push(shouldBeActive);
        if (device.stateHistory.length > this.maxHistoryLength) {
            device.stateHistory.shift();
        }
        
        // ✅ STEP 5: Check for stable state change
        const stableState = this.getStableState(device);
        
        if (stableState !== null && stableState !== device.active) {
            // ✅ STEP 6: Apply minimum time between changes
            const timeSinceLastChange = Date.now() - device.lastStateChange;
            
            if (timeSinceLastChange >= this.minStateChangeInterval) {
                console.log(`🔄 ${deviceType.toUpperCase()} STABLE STATE CHANGE: ${device.active} → ${stableState}`);
                
                device.active = stableState;
                device.lastStateChange = Date.now();
                
                // ✅ STEP 7: Send clean on/off event
                this.notifyCallbacks('stateChange', deviceType, {
                    active: stableState,
                    rawData: data,
                    previousState: !stableState
                });
            } else {
                console.log(`⏳ ${deviceType} state change blocked - too soon (${(timeSinceLastChange/1000).toFixed(1)}s ago)`);
            }
        }
        
        // ✅ Always send raw data event (for logging/debugging)
        this.notifyCallbacks('data', deviceType, data);
    }
    
    // ✅ DEVICE-SPECIFIC: Should this data trigger active state?
    shouldBeActive(deviceType, data) {
        switch (deviceType) {
            case 'soil':
                // For soil: humid or wet = active
                if (data.soil_condition) {
                    return data.soil_condition === 'humid' || data.soil_condition === 'wet';
                } else if (data.moisture_app_value !== undefined) {
                    return data.moisture_app_value > 0.4; // Above dry threshold
                }
                break;
                
            case 'light':
                // For light: bright conditions = active
                if (data.lightLevel !== undefined) {
                    return data.lightLevel > 500; // Example threshold
                }
                break;
                
            case 'temp':
                // For temp: warm conditions = active
                if (data.temperature !== undefined) {
                    return data.temperature > 25; // Example threshold
                }
                break;
        }
        
        return false; // Default to inactive
    }
    
    // ✅ STABILITY: Get stable state from history
    getStableState(device) {
        if (device.stateHistory.length < this.stabilityRequiredReadings) {
            console.log(`⏳ Need ${this.stabilityRequiredReadings - device.stateHistory.length} more readings for stability`);
            return null; // Not enough data
        }
        
        // Check if last N readings are consistent
        const recentReadings = device.stateHistory.slice(-this.stabilityRequiredReadings);
        const isConsistent = recentReadings.every(reading => reading === recentReadings[0]);
        
        if (isConsistent) {
            return recentReadings[0]; // Return the stable state
        } else {
            console.log(`📊 Inconsistent readings: [${recentReadings.join(', ')}]`);
            return null; // Still unstable
        }
    }
    
    identifyDeviceType(data) {
        const sensor = (data.sensor || '').toLowerCase();
        
        if (sensor.includes('soil') || sensor.includes('moisture') || 
            data.soilMoisture !== undefined || data.moisture !== undefined ||
            data.moisture_app_value !== undefined || data.soil_condition !== undefined) {
            return 'soil';
        }
        if (sensor.includes('light') || sensor.includes('lux') || 
            data.lightLevel !== undefined || data.lux !== undefined) {
            return 'light';
        }
        if (sensor.includes('temp') || sensor.includes('temperature') || 
            data.temperature !== undefined || data.temp !== undefined) {
            return 'temp';
        }
        
        return null;
    }
    
    handleESPDisconnection(data) {
        const deviceType = this.identifyDeviceTypeByName(data.name);
        if (deviceType && this.deviceStates[deviceType]) {
            const device = this.deviceStates[deviceType];
            
            console.log(`🔌❌ ${deviceType.toUpperCase()} disconnected`);
            
            // Reset device state
            device.connected = false;
            device.active = false;
            device.stateHistory = [];
            device.lastStateChange = Date.now();
            
            this.notifyCallbacks('disconnected', deviceType);
        }
    }
    
    identifyDeviceTypeByName(name) {
        const nameLower = (name || '').toLowerCase();
        if (nameLower.includes('soil')) return 'soil';
        if (nameLower.includes('light')) return 'light';
        if (nameLower.includes('temp')) return 'temp';
        return null;
    }
    
    markAllDisconnected() {
        Object.keys(this.deviceStates).forEach(deviceType => {
            const device = this.deviceStates[deviceType];
            if (device.connected) {
                device.connected = false;
                device.active = false;
                device.stateHistory = [];
                this.notifyCallbacks('disconnected', deviceType);
            }
        });
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
        
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
    }
    
    // ✅ PUBLIC API: Register for specific event types
    on(eventType, callback) {
        if (!this.callbacks[eventType]) {
            this.callbacks[eventType] = [];
        }
        this.callbacks[eventType].push(callback);
    }
    
    off(eventType, callback) {
        if (this.callbacks[eventType]) {
            const index = this.callbacks[eventType].indexOf(callback);
            if (index > -1) {
                this.callbacks[eventType].splice(index, 1);
            }
        }
    }
    
    notifyCallbacks(eventType, ...args) {
        if (this.callbacks[eventType]) {
            this.callbacks[eventType].forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`❌ Error in ${eventType} callback:`, error);
                }
            });
        }
    }
    
    // ✅ PUBLIC API: Get clean device states
    getDeviceState(deviceType) {
        const device = this.deviceStates[deviceType];
        return device ? {
            connected: device.connected,
            active: device.active,
            lastStateChange: device.lastStateChange,
            rawData: device.lastRawData
        } : null;
    }
    
    getConnectedDevices() {
        return Object.keys(this.deviceStates).filter(key => this.deviceStates[key].connected);
    }
    
    getActiveDevices() {
        return Object.keys(this.deviceStates).filter(key => this.deviceStates[key].active);
    }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting STABLE WebSocket Client...');
    window.creatune = new CreaTuneClient();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreaTuneClient;
}