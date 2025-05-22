// esp32-status.js
// Enhanced ESP32 status management with WebSocket integration

class ESP32Status {
    constructor() {
        this.connections = {
            esp1: false, // soil (MoistureSensor)
            esp2: false, // light
            esp3: false  // temp
        };
        this.currentMode = 'idle';
        this.sensorData = {
            esp1: null,
            esp2: null,
            esp3: null
        };
        this.lastUpdate = {
            esp1: null,
            esp2: null,
            esp3: null
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Listen for WebSocket connection events
        document.addEventListener('websocketConnected', () => {
            console.log('ESP32Status: WebSocket connected');
        });
        
        document.addEventListener('websocketDisconnected', () => {
            console.log('ESP32Status: WebSocket disconnected - resetting all connections');
            this.resetAllConnections();
        });
        
        // Listen for specific sensor data
        document.addEventListener('soilSensorData', (e) => {
            this.handleSoilSensorData(e.detail);
        });
        
        // Listen for ESP disconnection events
        document.addEventListener('espDisconnected', (e) => {
            this.handleESPDisconnection(e.detail);
        });
    }
    
    handleSoilSensorData(data) {
        console.log('ESP32Status: Soil sensor data received', data);
        
        this.sensorData.esp1 = data;
        this.lastUpdate.esp1 = Date.now();
        this.setConnection('esp1', true);
        
        // Dispatch detailed soil data event
        document.dispatchEvent(new CustomEvent('soilDataProcessed', {
            detail: {
                raw_value: data.raw_value,
                moisture_percent: data.moisture_percent,
                moisture_app_value: data.moisture_app_value,
                soil_condition: data.soil_condition,
                voltage: data.voltage,
                timestamp: data.timestamp
            }
        }));
    }
    
    handleESPDisconnection(data) {
        console.log('ESP32Status: ESP disconnected', data);
        
        // Map device names to ESP IDs
        const deviceMap = {
            'MoistureSensor': 'esp1',
            'LightSensor': 'esp2',
            'TempSensor': 'esp3'
        };
        
        const espId = deviceMap[data.name];
        if (espId) {
            this.setConnection(espId, false);
            this.sensorData[espId] = null;
            this.lastUpdate[espId] = null;
        }
    }
    
    resetAllConnections() {
        Object.keys(this.connections).forEach(espId => {
            this.connections[espId] = false;
            this.sensorData[espId] = null;
            this.lastUpdate[espId] = null;
        });
        this.updateMode();
        this.notifyChange();
    }
    
    // Update connection status
    setConnection(espId, isConnected) {
        if (this.connections[espId] !== isConnected) {
            this.connections[espId] = isConnected;
            console.log(`ESP32Status: ${espId} connection: ${isConnected}`);
            
            if (!isConnected) {
                this.sensorData[espId] = null;
                this.lastUpdate[espId] = null;
            }
            
            this.updateMode();
            this.notifyChange();
        }
    }
    
    // Determine current mode based on connections
    updateMode() {
        const { esp1, esp2, esp3 } = this.connections;
        const previousMode = this.currentMode;
        
        if (esp1 && esp2 && esp3) {
            this.currentMode = 'total';
        } else if (esp1 && esp2) {
            this.currentMode = 'growth';
        } else if (esp1 && esp3) {
            this.currentMode = 'mirrage';
        } else if (esp2 && esp3) {
            this.currentMode = 'flower';
        } else if (esp1) {
            this.currentMode = 'soil';
        } else if (esp2) {
            this.currentMode = 'light';
        } else if (esp3) {
            this.currentMode = 'temp';
        } else {
            this.currentMode = 'idle';
        }
        
        if (previousMode !== this.currentMode) {
            console.log(`ESP32Status: Mode changed from ${previousMode} to ${this.currentMode}`);
        }
    }
    
    // Get current status
    getStatus() {
        return {
            connections: { ...this.connections },
            mode: this.currentMode,
            connectedCount: Object.values(this.connections).filter(Boolean).length,
            sensorData: { ...this.sensorData },
            lastUpdate: { ...this.lastUpdate }
        };
    }
    
    // Get specific sensor data
    getSensorData(espId) {
        return this.sensorData[espId];
    }
    
    // Check if sensor data is fresh (within last 30 seconds)
    isSensorDataFresh(espId, maxAge = 30000) {
        const lastUpdate = this.lastUpdate[espId];
        return lastUpdate && (Date.now() - lastUpdate) < maxAge;
    }
    
    // Notify other scripts of changes
    notifyChange() {
        const status = this.getStatus();
        
        const event = new CustomEvent('esp32StatusChange', {
            detail: status
        });
        document.dispatchEvent(event);
        
        // Dispatch mode-specific events
        const modeEvent = new CustomEvent(`modeChange_${this.currentMode}`, {
            detail: status
        });
        document.dispatchEvent(modeEvent);
    }
    
    // Connection health monitoring
    startHealthMonitoring() {
        setInterval(() => {
            const now = Date.now();
            let hasChanges = false;
            
            // Check for stale connections (no data for 60 seconds)
            Object.keys(this.connections).forEach(espId => {
                if (this.connections[espId] && this.lastUpdate[espId]) {
                    const timeSinceUpdate = now - this.lastUpdate[espId];
                    if (timeSinceUpdate > 60000) {
                        console.warn(`ESP32Status: ${espId} appears stale, marking as disconnected`);
                        this.setConnection(espId, false);
                        hasChanges = true;
                    }
                }
            });
            
            if (hasChanges) {
                this.updateMode();
                this.notifyChange();
            }
        }, 5000); // Check every 5 seconds
    }
    
    // Simulate connection changes (for testing)
    toggleESP(espNumber) {
        const espId = `esp${espNumber}`;
        this.setConnection(espId, !this.connections[espId]);
    }
}

// Create global instance
window.esp32Status = new ESP32Status();

// Start health monitoring
document.addEventListener('DOMContentLoaded', () => {
    window.esp32Status.startHealthMonitoring();
});

// Export for other scripts
window.ESP32Status = {
    getStatus: () => window.esp32Status.getStatus(),
    setConnection: (espId, connected) => window.esp32Status.setConnection(espId, connected),
    getSensorData: (espId) => window.esp32Status.getSensorData(espId),
    isFresh: (espId, maxAge) => window.esp32Status.isSensorDataFresh(espId, maxAge),
    toggle: (espNumber) => window.esp32Status.toggleESP(espNumber),
    
    // Listen for changes
    onChange: (callback) => {
        document.addEventListener('esp32StatusChange', (e) => callback(e.detail));
    },
    
    // Listen for specific mode changes
    onModeChange: (mode, callback) => {
        document.addEventListener(`modeChange_${mode}`, (e) => callback(e.detail));
    }
};