// websocket-client.js
// Simple WebSocket client for ESP32 data and status tracking

class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.clientId = null;
        
        // ESP32 device tracking - just data, no UI
        this.espDevices = {
            soil: { connected: false, lastData: null, id: null },
            light: { connected: false, lastData: null, id: null },
            temp: { connected: false, lastData: null, id: null }
        };
        
        this.combinedName = 'idle';
        this.callbacks = [];
        
        this.init();
    }
    
    init() {
        console.log('🔌 Initializing CreaTune WebSocket Client...');
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
                this.handleSensorData(data);
                break;
                
            case 'esp_status':
                this.handleESPStatus(data);
                break;
                
            case 'esp_disconnected':
                this.handleESPDisconnection(data);
                break;
        }
    }
    
    handleSensorData(data) {
        const deviceType = this.identifyDeviceType(data);
        
        if (deviceType && this.espDevices[deviceType]) {
            this.espDevices[deviceType].connected = true;
            this.espDevices[deviceType].lastData = data;
            
            if (data.espId !== undefined) {
                this.espDevices[deviceType].id = data.espId;
            }
            
            this.updateCombinedName();
            this.notifyCallbacks('data', deviceType, data);
            
            console.log(`📊 ${deviceType.toUpperCase()} data:`, data);
        }
    }
    
    handleESPStatus(data) {
        if (data.devices && Array.isArray(data.devices)) {
            // Reset all to disconnected
            Object.keys(this.espDevices).forEach(key => {
                this.espDevices[key].connected = false;
            });
            
            // Update with current status
            data.devices.forEach(device => {
                const deviceType = this.identifyDeviceTypeByName(device.name);
                if (deviceType && this.espDevices[deviceType]) {
                    this.espDevices[deviceType].connected = device.connected;
                    this.espDevices[deviceType].lastData = device.lastData;
                    this.espDevices[deviceType].id = device.id;
                }
            });
            
            this.updateCombinedName();
            this.notifyCallbacks('status', this.espDevices, this.combinedName);
        }
    }
    
    handleESPDisconnection(data) {
        const deviceType = this.identifyDeviceTypeByName(data.name);
        if (deviceType && this.espDevices[deviceType]) {
            this.espDevices[deviceType].connected = false;
            this.espDevices[deviceType].lastData = null;
            
            this.updateCombinedName();
            this.notifyCallbacks('disconnect', deviceType, data);
            
            console.log(`🔌❌ ${deviceType.toUpperCase()} disconnected`);
        }
    }
    
    identifyDeviceType(data) {
        const sensor = (data.sensor || '').toLowerCase();
        const message = (data.message || '').toLowerCase();
        
        if (sensor.includes('soil') || sensor.includes('moisture') || 
            data.soilMoisture !== undefined || data.moisture !== undefined) return 'soil';
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
        
        this.combinedName = connected.length > 0 ? connected.join('-') : 'idle';
        console.log(`🏷️ Combined name: ${this.combinedName}`);
    }
    
    markAllDisconnected() {
        Object.keys(this.espDevices).forEach(key => {
            this.espDevices[key].connected = false;
            this.espDevices[key].lastData = null;
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
    console.log('🚀 Starting WebSocket Client...');
    window.creatune = new CreaTuneClient();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreaTuneClient;
}