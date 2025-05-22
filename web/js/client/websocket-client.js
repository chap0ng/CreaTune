// websocket-client.js
// CreaTune WebSocket Client

class CreaTuneClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.clientId = null;
        
        // Event handlers
        this.onSensorData = null;
        this.onESPStatus = null;
        this.onMessage = null;
        
        this.connect();
    }
    
    connect() {
        try {
            // Use current host and port for WebSocket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            this.ws = new WebSocket(`${protocol}//${host}`);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.scheduleReconnect();
        }
    }
    
    handleOpen(event) {
        console.log('🎉 Connected to CreaTune server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Dispatch connection event
        document.dispatchEvent(new CustomEvent('websocketConnected'));
    }
    
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'welcome':
                    console.log('Welcome message:', data.message);
                    this.clientId = data.clientId;
                    break;
                    
                case 'sensor_data':
                    this.handleSensorData(data);
                    break;
                    
                case 'esp_status':
                    this.handleESPStatus(data);
                    break;
                    
                case 'esp_disconnected':
                    console.log(`ESP32 disconnected: ${data.name}`);
                    this.handleESPDisconnection(data);
                    break;
                    
                default:
                    if (this.onMessage) {
                        this.onMessage(data);
                    }
                    console.log('Received message:', data);
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    handleSensorData(data) {
        console.log('📊 Sensor data received:', data);
        
        // Identify sensor type and update ESP32 status
        if (data.sensor === 'MoistureSensor') {
            window.ESP32Status?.setConnection('esp1', true);
            
            // Dispatch sensor-specific event
            document.dispatchEvent(new CustomEvent('soilSensorData', {
                detail: data
            }));
        }
        
        // Generic sensor data event
        if (this.onSensorData) {
            this.onSensorData(data);
        }
        
        document.dispatchEvent(new CustomEvent('sensorData', {
            detail: data
        }));
    }
    
    handleESPStatus(data) {
        console.log('ESP32 Status update:', data);
        if (this.onESPStatus) {
            this.onESPStatus(data);
        }
    }
    
    handleESPDisconnection(data) {
        // Update connection status based on device name
        if (data.name === 'MoistureSensor') {
            window.ESP32Status?.setConnection('esp1', false);
        }
        
        document.dispatchEvent(new CustomEvent('espDisconnected', {
            detail: data
        }));
    }
    
    handleClose(event) {
        console.log('💔 WebSocket connection closed');
        this.isConnected = false;
        
        document.dispatchEvent(new CustomEvent('websocketDisconnected'));
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else {
            console.error('Max reconnection attempts reached');
        }
    }
    
    handleError(error) {
        console.error('WebSocket error:', error);
    }
    
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    send(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        } else {
            console.warn('Cannot send - WebSocket not connected');
            return false;
        }
    }
    
    // Public API
    onSensorDataReceived(callback) {
        this.onSensorData = callback;
    }
    
    onESPStatusUpdate(callback) {
        this.onESPStatus = callback;
    }
    
    onMessageReceived(callback) {
        this.onMessage = callback;
    }
}

// Initialize client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.creaTuneClient = new CreaTuneClient();
    
    // Make client available globally
    window.CreaTuneClient = {
        send: (data) => window.creaTuneClient.send(data),
        isConnected: () => window.creaTuneClient.isConnected,
        onSensorData: (callback) => window.creaTuneClient.onSensorDataReceived(callback),
        onESPStatus: (callback) => window.creaTuneClient.onESPStatusUpdate(callback),
        onMessage: (callback) => window.creaTuneClient.onMessageReceived(callback)
    };
    
    console.log('CreaTune WebSocket Client initialized');
});