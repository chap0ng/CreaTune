// esp32-status.js
// ESP32 status management for CreaTune

class ESP32Status {
    constructor() {
        this.connections = {
            esp1: false // soil (MoistureSensor)
        };
        this.currentMode = 'idle';
        this.lastUpdate = {
            esp1: null
        };
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Listen for processed sensor values from websocket client
        document.addEventListener('sensorValueProcessed', (e) => {
            const { sensorType, isInRange } = e.detail;
            
            if (sensorType === 'soil') {
                this.setConnection('esp1', isInRange);
                if (isInRange) this.lastUpdate.esp1 = Date.now();
            }
        });
        
        // Reset on websocket disconnect
        document.addEventListener('websocketDisconnected', () => {
            this.resetAllConnections();
        });
        
        // Reset on ESP disconnect
        document.addEventListener('espDisconnected', (e) => {
            if (e.detail.name === 'MoistureSensor') {
                this.setConnection('esp1', false);
            }
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
        const previousMode = this.currentMode;
        
        // Simple mode logic
        if (this.connections.esp1) {
            this.currentMode = 'soil';
        } else {
            this.currentMode = 'idle';
        }
        
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
        this.connections.esp1 = false;
        this.lastUpdate.esp1 = null;
        this.updateMode();
    }
    
    // Health monitoring
    startHealthMonitoring() {
        setInterval(() => {
            const now = Date.now();
            if (this.connections.esp1 && this.lastUpdate.esp1) {
                if (now - this.lastUpdate.esp1 > 15000) { // 15 seconds timeout
                    this.setConnection('esp1', false);
                }
            }
        }, 5000);
    }
    
    getStatus() {
        return {
            mode: this.currentMode,
            connections: { ...this.connections },
            connectedCount: this.connections.esp1 ? 1 : 0
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