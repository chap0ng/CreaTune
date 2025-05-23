// websocket-client.js
// Clean WebSocket client for ESP32 sensor communication
// Handles connection and routes data to sensor handlers

class CreaTuneWebSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 7000;
        this.eventHandlers = new Map();
        
        this.connect();
    }
    
    connect() {
        try {
            // WebSocket connection options:
            // 1. Testing on same computer: use localhost
            // 2. Testing on phone/other device: use your server's IP
            
            // For same computer testing:
            const wsUrl = 'ws://localhost:8080';
            
            // For phone/other devices, replace with your server IP:
            // const wsUrl = 'ws://192.168.1.100:8080'; // example IP
            
            console.log(`Connecting to WebSocket: ${wsUrl}`);
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = (event) => {
                console.log('WebSocket connected to CreaTune server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.emit('connected', { timestamp: Date.now() });
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.routeMessage(data);
                } catch (err) {
                    console.log('Non-JSON WebSocket message:', event.data);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                this.emit('disconnected', { timestamp: Date.now() });
                this.attemptReconnect();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', { error, timestamp: Date.now() });
            };
            
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.attemptReconnect();
        }
    }
    
    routeMessage(data) {
        // Route ESP32 sensor data to handlers
        if (data.type === 'sensor_data' && data.sensor) {
            
            // Log received sensor data
            const value = data.voltage || data.moisture_app_value || data.raw_value;
            console.log(`ESP32 ${data.sensor}: ${value !== undefined ? value.toFixed(3) : 'no value'}`);
            
            // Emit generic sensor data event
            this.emit('sensor_data', data);
            
            // Route to specific sensor type handlers
            const sensorType = this.detectSensorType(data);
            this.emit(`sensor_${sensorType}`, data);
            
        } else if (data.type === 'esp_disconnected') {
            // Handle ESP32 disconnection
            console.log(`🔌 ESP32 disconnected: ${data.name}`);
            
            // Detect sensor type from disconnected device name
            const sensorType = this.detectSensorTypeFromName(data.name);
            
            // Emit disconnection events
            this.emit('esp_disconnected', data);
            this.emit(`sensor_${sensorType}_disconnected`, data);
            
        } else if (data.type === 'welcome') {
            console.log('Server welcome:', data.message);
        } else {
            // Handle other message types if needed
            this.emit('message', data);
        }
    }
    
    detectSensorType(data) {
        // Detect sensor type from data
        const sensorName = data.sensor.toLowerCase();
        
        if (sensorName.includes('moisture') || sensorName.includes('soil') || data.soil_condition) {
            return 'soil';
        }
        if (sensorName.includes('temp') || data.temperature !== undefined) {
            return 'temperature';
        }
        if (sensorName.includes('light') || data.light !== undefined) {
            return 'light';
        }
        
        // Default fallback
        return 'unknown';
    }
    
    detectSensorTypeFromName(deviceName) {
        // Detect sensor type from device name (for disconnections)
        const name = deviceName.toLowerCase();
        
        if (name.includes('moisture') || name.includes('soil')) {
            return 'soil';
        }
        if (name.includes('temp')) {
            return 'temperature';
        }
        if (name.includes('light')) {
            return 'light';
        }
        
        // Default fallback
        return 'unknown';
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max WebSocket reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000); // Max 30s delay
        console.log(`🔄 WebSocket reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay/1000}s`);
        
        setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    // Event system for sensor handlers
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error(`❌ WebSocket event handler error for ${event}:`, err);
                }
            });
        }
        
        // Force immediate UI update for critical events
        if (event.includes('disconnected')) {
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('websocketDisconnection', {
                    detail: { event, data, timestamp: Date.now() }
                }));
            }, 10);
        }
    }
    
    send(data) {
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            return true;
        } else {
            console.warn('Cannot send data: WebSocket not connected');
            return false;
        }
    }
    
    // Utility methods
    getStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            readyState: this.socket ? this.socket.readyState : null
        };
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Initialize WebSocket client globally
window.creatoneWS = new CreaTuneWebSocketClient();

// Log connection status
window.creatoneWS.on('connected', () => console.log('✅ ESP32 WebSocket ready'));
window.creatoneWS.on('disconnected', () => console.log('❌ ESP32 WebSocket disconnected'));