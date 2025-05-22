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
        
        this.connect();
    }
    
    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl;
            
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                wsUrl = `${protocol}//localhost:8080`;
            } else if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
                wsUrl = `${protocol}//${window.location.hostname}:${window.location.port}`;
            } else {
                wsUrl = `${protocol}//${window.location.host}`;
            }
            
            console.log('Connecting to:', wsUrl);
            this.ws = new WebSocket(wsUrl);
            
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
                    console.log('Received message:', data);
            }
            
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }
    
    handleSensorData(data) {
        console.log('📊 Sensor data received:', data);
        
        // Extract the sensor value for processing
        const value = data.moisture_app_value || data.voltage || data.value;
        
        // Process sensor data for MoistureSensor
        if (data.sensor === 'MoistureSensor' && value !== undefined) {
            this.processSensorValue(value, 'soil');
            
            // Dispatch soil-specific event
            document.dispatchEvent(new CustomEvent('soilSensorData', {
                detail: { ...data, processedValue: value }
            }));
        }
        
        // Generic sensor data event
        document.dispatchEvent(new CustomEvent('sensorData', {
            detail: { ...data, processedValue: value }
        }));
    }
    
    processSensorValue(value, sensorType) {
        // Check if value is in the desired range (0.4 to 0.8)
        const isActive = value >= 0.4 && value <= 0.8;
        
        console.log(`${sensorType} value: ${value.toFixed(2)} - ${isActive ? 'ACTIVE' : 'inactive'}`);
        
        // Simple display toggle - let CSS handle the styling
        this.setActiveState(isActive);
        
        if (isActive) {
            this.triggerAudio(sensorType, value);
        }
        
        // Dispatch processed value event for ESP32 status
        document.dispatchEvent(new CustomEvent('sensorValueProcessed', {
            detail: { sensorType, value, isInRange: isActive }
        }));
    }
    
    setActiveState(isActive) {
        const frameBackground = document.querySelector('.framebackground');
        const soilCreature = document.querySelector('.soil-creature');
        
        if (isActive) {
            frameBackground?.classList.add('active');
            soilCreature?.style.setProperty('display', 'block');
        } else {
            frameBackground?.classList.remove('active');
            soilCreature?.style.setProperty('display', 'none');
        }
    }
    
    triggerAudio(sensorType, value) {
        // Dispatch audio trigger event
        document.dispatchEvent(new CustomEvent(`${sensorType}AudioTrigger`, {
            detail: { value, sensorType }
        }));
    }
    
    handleESPStatus(data) {
        console.log('ESP32 Status update:', data);
    }
    
    handleESPDisconnection(data) {
        // Reset to inactive state
        this.setActiveState(false);
        
        document.dispatchEvent(new CustomEvent('espDisconnected', {
            detail: data
        }));
    }
    
    handleClose(event) {
        console.log('💔 WebSocket connection closed');
        this.isConnected = false;
        
        // Set to inactive state
        this.setActiveState(false);
        
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
}

// Initialize client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.creaTuneClient = new CreaTuneClient();
    
    // Make client available globally
    window.CreaTuneClient = {
        send: (data) => window.creaTuneClient.send(data),
        isConnected: () => window.creaTuneClient.isConnected
    };
    
    console.log('CreaTune WebSocket Client initialized');
});