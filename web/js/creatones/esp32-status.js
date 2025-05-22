// esp32-status.js
// Multi-sensor mode management for CreaTune

class ESP32Status {
    constructor() {
        this.connections = {
            esp1: false, // soil
            esp2: false, // light  
            esp3: false  // temp
        };
        this.currentMode = 'idle';
        this.lastUpdate = {
            esp1: null,
            esp2: null,
            esp3: null
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Listen for processed sensor values from websocket client
        document.addEventListener('sensorValueProcessed', (e) => {
            const { sensorType, isInRange } = e.detail;
            const espId = { soil: 'esp1', light: 'esp2', temp: 'esp3' }[sensorType];
            
            if (espId) {
                this.setConnection(espId, isInRange);
                if (isInRange) this.lastUpdate[espId] = Date.now();
            }
        });
        
        // Reset on websocket disconnect
        document.addEventListener('websocketDisconnected', () => {
            this.resetAllConnections();
        });
        
        // Reset specific sensor on ESP disconnect
        document.addEventListener('espDisconnected', (e) => {
            const deviceMap = {
                'MoistureSensor': 'esp1',
                'LightSensor': 'esp2', 
                'TempSensor': 'esp3'
            };
            const espId = deviceMap[e.detail.name];
            if (espId) this.setConnection(espId, false);
        });
    }
    
    setConnection(espId, isConnected) {
        if (this.connections[espId] !== isConnected) {
            this.connections[espId] = isConnected;
            if (!isConnected) this.lastUpdate[espId] = null;
            this.updateMode();
        }
    }
    
    updateMode() {
        const { esp1, esp2, esp3 } = this.connections;
        const previousMode = this.currentMode;
        
        // Multi-sensor combinations
        if (esp1 && esp2 && esp3) this.currentMode = 'total';
        else if (esp1 && esp2) this.currentMode = 'growth';
        else if (esp1 && esp3) this.currentMode = 'mirrage';
        else if (esp2 && esp3) this.currentMode = 'flower';
        else if (esp1) this.currentMode = 'soil';
        else if (esp2) this.currentMode = 'light';
        else if (esp3) this.currentMode = 'temp';
        else this.currentMode = 'idle';
        
        if (previousMode !== this.currentMode) {
            console.log(`Mode: ${previousMode} → ${this.currentMode}`);
            this.dispatchModeEvents(previousMode, this.currentMode);
        }
    }
    
    dispatchModeEvents(oldMode, newMode) {
        if (oldMode !== 'idle') {
            document.dispatchEvent(new CustomEvent(`modeExit_${oldMode}`, {
                detail: { oldMode, newMode, connections: this.connections }
            }));
        }
        
        if (newMode !== 'idle') {
            document.dispatchEvent(new CustomEvent(`modeEnter_${newMode}`, {
                detail: { oldMode, newMode, connections: this.connections }
            }));
        }
    }
    
    resetAllConnections() {
        Object.keys(this.connections).forEach(espId => {
            this.connections[espId] = false;
            this.lastUpdate[espId] = null;
        });
        this.updateMode();
    }
    
    // Health monitoring - mark stale connections as disconnected
    startHealthMonitoring() {
        setInterval(() => {
            const now = Date.now();
            Object.keys(this.connections).forEach(espId => {
                if (this.connections[espId] && this.lastUpdate[espId]) {
                    if (now - this.lastUpdate[espId] > 45000) {
                        this.setConnection(espId, false);
                    }
                }
            });
        }, 5000);
    }
    
    getStatus() {
        return {
            mode: this.currentMode,
            connections: { ...this.connections },
            connectedCount: Object.values(this.connections).filter(Boolean).length
        };
    }
}

// Initialize
window.esp32Status = new ESP32Status();

document.addEventListener('DOMContentLoaded', () => {
    window.esp32Status.startHealthMonitoring();
});

// Global API
window.ESP32Status = {
    getStatus: () => window.esp32Status.getStatus(),
    onModeEnter: (mode, callback) => {
        document.addEventListener(`modeEnter_${mode}`, (e) => callback(e.detail));
    },
    onModeExit: (mode, callback) => {
        document.addEventListener(`modeExit_${mode}`, (e) => callback(e.detail));
    }
};