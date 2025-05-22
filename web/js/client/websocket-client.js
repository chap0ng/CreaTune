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
            // WebSocket URL configuration - handles both development and production
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl;
            
            // Check if we're in development (localhost) or production
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Development: use localhost with port 8080
                wsUrl = `${protocol}//localhost:8080`;
            } else if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
                // Custom port specified
                wsUrl = `${protocol}//${window.location.hostname}:${window.location.port}`;
            } else {
                // Production: use same host as web server
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
        
        // Extract the sensor value for processing
        const value = data.moisture_app_value || data.voltage || data.value;
        
        // Identify sensor type and update ESP32 status
        if (data.sensor === 'MoistureSensor' || data.type === 'sensor_data') {
            window.ESP32Status?.setConnection('esp1', true);
            
            // Process the sensor value if it exists and is in valid range
            if (value !== undefined) {
                this.processSensorValue(value, 'soil');
            }
            
            // Dispatch soil-specific event
            document.dispatchEvent(new CustomEvent('soilSensorData', {
                detail: {
                    ...data,
                    processedValue: value
                }
            }));
        }
        
        // Handle other sensor types
        if (data.sensor === 'LightSensor') {
            window.ESP32Status?.setConnection('esp2', true);
            if (value !== undefined) {
                this.processSensorValue(value, 'light');
            }
        }
        
        if (data.sensor === 'TempSensor') {
            window.ESP32Status?.setConnection('esp3', true);
            if (value !== undefined) {
                this.processSensorValue(value, 'temp');
            }
        }
        
        // Generic sensor data event
        if (this.onSensorData) {
            this.onSensorData(data);
        }
        
        document.dispatchEvent(new CustomEvent('sensorData', {
            detail: {
                ...data,
                processedValue: value
            }
        }));
    }
    
    processSensorValue(value, sensorType) {
        // Check if value is in the desired range (0.4 to 0.8)
        const isInRange = value >= 0.4 && value <= 0.8;
        
        console.log(`Processing ${sensorType} value: ${value.toFixed(2)} (${isInRange ? 'in range' : 'out of range'})`);
        
        // Update background based on sensor type and connection
        this.updateBackground(sensorType, isInRange);
        
        // Trigger creature and audio if value is in range
        if (isInRange) {
            this.triggerCreature(sensorType, value);
            this.triggerAudio(sensorType, value);
        } else {
            this.hideCreature(sensorType);
        }
        
        // Dispatch processed value event
        document.dispatchEvent(new CustomEvent('sensorValueProcessed', {
            detail: {
                sensorType,
                value,
                isInRange
            }
        }));
    }
    
    updateBackground(sensorType, isActive) {
        const frameBackground = document.querySelector('.framebackground');
        if (!frameBackground) return;
        
        // Remove all background classes
        frameBackground.classList.remove('soil-background', 'light-background', 'temp-background');
        
        // Add appropriate background class if active
        if (isActive) {
            frameBackground.classList.add(`${sensorType}-background`);
            frameBackground.classList.add(sensorType); // For creature visibility logic
        } else {
            frameBackground.classList.remove(sensorType);
        }
    }
    
    triggerCreature(sensorType, value) {
        // Show appropriate creature
        const creatures = document.querySelectorAll('[class*="-creature"]');
        creatures.forEach(creature => creature.classList.remove('active'));
        
        const targetCreature = document.querySelector(`.${sensorType}-creature`);
        if (targetCreature) {
            targetCreature.classList.add('active');
            
            // Add reaction animation
            targetCreature.classList.add('creature-reacting');
            setTimeout(() => {
                targetCreature.classList.remove('creature-reacting');
            }, 400);
        }
    }
    
    hideCreature(sensorType) {
        const targetCreature = document.querySelector(`.${sensorType}-creature`);
        if (targetCreature) {
            targetCreature.classList.remove('active');
        }
    }
    
    triggerAudio(sensorType, value) {
        // Dispatch audio trigger event for specific sensor handlers
        document.dispatchEvent(new CustomEvent(`${sensorType}AudioTrigger`, {
            detail: {
                value,
                sensorType
            }
        }));
        
        // Generic audio trigger
        document.dispatchEvent(new CustomEvent('audioTrigger', {
            detail: {
                value,
                sensorType
            }
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
        const deviceMap = {
            'MoistureSensor': 'esp1',
            'LightSensor': 'esp2',
            'TempSensor': 'esp3'
        };
        
        const espId = deviceMap[data.name];
        if (espId) {
            window.ESP32Status?.setConnection(espId, false);
            
            // Remove background and hide creatures for this sensor type
            const sensorType = {
                'esp1': 'soil',
                'esp2': 'light',
                'esp3': 'temp'
            }[espId];
            
            if (sensorType) {
                this.updateBackground(sensorType, false);
                this.hideCreature(sensorType);
            }
        }
        
        document.dispatchEvent(new CustomEvent('espDisconnected', {
            detail: data
        }));
    }
    
    handleClose(event) {
        console.log('💔 WebSocket connection closed');
        this.isConnected = false;
        
        // Reset all backgrounds and creatures
        const frameBackground = document.querySelector('.framebackground');
        if (frameBackground) {
            frameBackground.classList.remove('soil-background', 'light-background', 'temp-background');
            frameBackground.classList.remove('soil', 'light', 'temp');
        }
        
        const creatures = document.querySelectorAll('[class*="-creature"]');
        creatures.forEach(creature => creature.classList.remove('active'));
        
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