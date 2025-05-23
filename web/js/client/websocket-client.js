// websocket-client.js
// Clean WebSocket client for ESP32 sensor communication
// Handles connection and routes data to sensor handlers

class CreaTuneWebSocketClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.eventHandlers = new Map();
        
        this.connect();
    }
    
    connect() {
        try {
            // IMPORTANT: Replace 'localhost' with your server's IP address
            // To find your server IP:
            // Windows: Open Command Prompt, type: ipconfig
            // Mac/Linux: Open Terminal, type: ifconfig
            // Look for your WiFi adapter IP (usually 192.168.x.x)
            // Example: const wsUrl = 'ws://192.168.1.100:8080';
            const wsUrl = 'ws://localhost:8080'; // CHANGE THIS TO YOUR SERVER IP
            
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
    
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max WebSocket reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`WebSocket reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay * this.reconnectAttempts); // Exponential backoff
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
                    console.error(`WebSocket event handler error for ${event}:`, err);
                }
            });
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