// esp32-status.js
class ESP32Status {
    constructor() {
        this.connections = {
            esp1: false, // soil
            esp2: false, // light
            esp3: false  // temp
        };
        this.currentMode = 'idle';
    }
    
    // Update connection status
    setConnection(espId, isConnected) {
        this.connections[espId] = isConnected;
        this.updateMode();
        this.notifyChange();
    }
    
    // Determine current mode based on connections
    updateMode() {
        const { esp1, esp2, esp3 } = this.connections;
        
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
    }
    
    // Get current status
    getStatus() {
        return {
            connections: { ...this.connections },
            mode: this.currentMode,
            connectedCount: Object.values(this.connections).filter(Boolean).length
        };
    }
    
    // Notify other scripts of changes
    notifyChange() {
        const event = new CustomEvent('esp32StatusChange', {
            detail: this.getStatus()
        });
        document.dispatchEvent(event);
    }
    
    // Simulate connection changes (for testing)
    toggleESP(espNumber) {
        const espId = `esp${espNumber}`;
        this.setConnection(espId, !this.connections[espId]);
    }
}

// Create global instance
window.esp32Status = new ESP32Status();

// Export for other scripts
window.ESP32Status = {
    getStatus: () => window.esp32Status.getStatus(),
    setConnection: (espId, connected) => window.esp32Status.setConnection(espId, connected),
    toggle: (espNumber) => window.esp32Status.toggleESP(espNumber),
    
    // Listen for changes
    onChange: (callback) => {
        document.addEventListener('esp32StatusChange', (e) => callback(e.detail));
    }
};