// websocket-client.js
// STABLE WebSocket client - fixes data/status spam issues

class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 2;
        this.reconnectDelay = 1000;
        this.clientId = null;
        
        // ESP32 device tracking with stable state management
        this.espDevices = {
            soil: { connected: false, lastData: null, id: null, lastStatusChange: 0 },
            light: { connected: false, lastData: null, id: null, lastStatusChange: 0 },
            temp: { connected: false, lastData: null, id: null, lastStatusChange: 0 }
        };
        
        this.combinedName = 'idle';
        this.callbacks = [];
        
        // Stability settings
        this.statusChangeDelay = 1000; // 1 second delay before status changes
        this.statusTimers = new Map(); // Track status change timers
        
        this.init();
    }
    
    init() {
        console.log('🔌 Initializing STABLE CreaTune WebSocket Client...');
        this.connect();
        
        // Make available globally for other scripts
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
                this.requestESP32Status();
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
                this.markAllDisconnectedStable();
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
                this.handleSensorDataStable(data);
                break;
                
            case 'esp_status':
                this.handleESPStatusStable(data);
                break;
                
            case 'esp_disconnected':
                this.handleESPDisconnectionStable(data);
                break;
        }
    }
    
    // ✅ STABLE: Data handling with connection confirmation
    handleSensorDataStable(data) {
        const deviceType = this.identifyDeviceType(data);
        
        if (deviceType && this.espDevices[deviceType]) {
            const device = this.espDevices[deviceType];
            const wasConnected = device.connected;
            
            // Update device data
            device.lastData = data;
            
            if (data.espId !== undefined) {
                device.id = data.espId;
            }
            
            // ✅ Data arrival = connection confirmation (most reliable)
            if (!wasConnected) {
                console.log(`📊 ${deviceType.toUpperCase()} STABLE CONNECTION via data`);
                this.setDeviceConnectionStable(deviceType, true);
            }
            
            // Always send data events (but not status events for every data packet)
            this.notifyCallbacks('data', deviceType, data);
            
            console.log(`📊 ${deviceType.toUpperCase()} data:`, data);
        }
    }
    
    // ✅ STABLE: Status handling with debouncing
    handleESPStatusStable(data) {
        if (!data.devices || !Array.isArray(data.devices)) return;
        
        console.log('📊 ESP Status update received - processing...');
        
        // Process each device status individually (no bulk reset)
        data.devices.forEach(device => {
            const deviceType = this.identifyDeviceTypeByName(device.name);
            if (deviceType && this.espDevices[deviceType]) {
                const currentStatus = this.espDevices[deviceType].connected;
                const newStatus = device.connected;
                
                // Only process if status actually changed
                if (currentStatus !== newStatus) {
                    console.log(`📊 ${deviceType} status change: ${currentStatus} → ${newStatus}`);
                    this.setDeviceConnectionStable(deviceType, newStatus);
                }
                
                // Update other info without triggering events
                if (device.lastData) {
                    this.espDevices[deviceType].lastData = device.lastData;
                }
                if (device.id !== undefined) {
                    this.espDevices[deviceType].id = device.id;
                }
            }
        });
    }
    
    // ✅ STABLE: Set device connection with debouncing
    setDeviceConnectionStable(deviceType, connected) {
        const device = this.espDevices[deviceType];
        
        // Clear any existing timer for this device
        if (this.statusTimers.has(deviceType)) {
            clearTimeout(this.statusTimers.get(deviceType));
        }
        
        // Set timer for status change
        const timer = setTimeout(() => {
            // Double-check the connection should still change
            const shouldChange = (connected && !device.connected) || (!connected && device.connected);
            
            if (shouldChange) {
                device.connected = connected;
                device.lastStatusChange = Date.now();
                
                this.updateCombinedName();
                this.notifyCallbacks('status', this.espDevices, this.combinedName);
                
                console.log(`✅ ${deviceType.toUpperCase()} STABLE status: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
            }
            
            this.statusTimers.delete(deviceType);
        }, this.statusChangeDelay);
        
        this.statusTimers.set(deviceType, timer);
    }
    
    handleESPDisconnectionStable(data) {
        const deviceType = this.identifyDeviceTypeByName(data.name);
        if (deviceType && this.espDevices[deviceType]) {
            console.log(`🔌❌ ${deviceType.toUpperCase()} explicit disconnect`);
            this.setDeviceConnectionStable(deviceType, false);
            this.notifyCallbacks('disconnect', deviceType, data);
        }
    }
    
    identifyDeviceType(data) {
        const sensor = (data.sensor || '').toLowerCase();
        const message = (data.message || '').toLowerCase();
        
        if (sensor.includes('soil') || sensor.includes('moisture') || 
            data.soilMoisture !== undefined || data.moisture !== undefined ||
            data.moisture_app_value !== undefined || data.soil_condition !== undefined) return 'soil';
        if (sensor.includes('light') || sensor.includes('lux') || 
            data.lightLevel !== undefined || data.lux !== undefined) return 'light';
        if (sensor.includes('temp') || sensor.includes('temperature') || 
            data.temperature !== undefined || data.temp !== undefined) return 'temp';
        
        return null;
    }
    
    identifyDeviceTypeByName(name) {
        const nameLower = (name || '').toLowerCase();
        if (nameLower.includes('soil')) return 'soil';
        if (nameLower.includes('light')) return 'light';
        if (nameLower.includes('temp')) return 'temp';
        return null;
    }
    
    updateCombinedName() {
        const connected = Object.keys(this.espDevices)
            .filter(key => this.espDevices[key].connected)
            .sort();
        
        const newCombinedName = connected.length > 0 ? connected.join('-') : 'idle';
        
        // Only log if it actually changed
        if (newCombinedName !== this.combinedName) {
            this.combinedName = newCombinedName;
            console.log(`🏷️ Combined name changed: ${this.combinedName}`);
        }
    }
    
    markAllDisconnectedStable() {
        console.log('🔌❌ WebSocket disconnected - marking all devices as disconnected');
        
        Object.keys(this.espDevices).forEach(key => {
            if (this.espDevices[key].connected) {
                this.setDeviceConnectionStable(key, false);
            }
        });
        
        this.updateCombinedName();
        this.notifyCallbacks('all_disconnected', this.espDevices);
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
    
    requestESP32Status() {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'request_esp_status',
                clientId: this.clientId,
                timestamp: Date.now()
            }));
        }
    }
    
    // Public API for other scripts
    
    // Register callback for events: 'data', 'status', 'disconnect', 'all_disconnected'
    on(eventType, callback) {
        if (!this.callbacks[eventType]) {
            this.callbacks[eventType] = [];
        }
        this.callbacks[eventType].push(callback);
    }
    
    // Remove callback
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
    
    // Getters for other scripts to access data
    getDevices() {
        return { ...this.espDevices };
    }
    
    getDevice(type) {
        return this.espDevices[type] ? { ...this.espDevices[type] } : null;
    }
    
    getCombinedName() {
        return this.combinedName;
    }
    
    getConnectedDevices() {
        return Object.keys(this.espDevices).filter(key => this.espDevices[key].connected);
    }
    
    isConnected() {
        return this.isConnected;
    }
    
    getConnectionCount() {
        return Object.values(this.espDevices).filter(d => d.connected).length;
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