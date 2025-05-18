// websocket-manager.js - Handles WebSocket connections and communication

const WebSocketManager = {
    socket: null,
    
    // Initialize WebSocket connection
    init: function() {
        this.connectWebSocket();
    },
    
    // Connect to WebSocket server
    connectWebSocket: function() {
        try {
            // Use your server IP address here instead of localhost
            this.socket = new WebSocket('ws://localhost:8080');
            // Example with IP address: 
            // this.socket = new WebSocket('ws://192.168.1.100:8080');
            
            this.socket.onopen = (event) => {
                UIController.logToUI('WebSocket connection established');
                // Don't set ESP32 connected here - wait for actual data
            };
            
            this.socket.onmessage = (event) => {
                try {
                    // Try to parse the data as JSON
                    const data = JSON.parse(event.data);
                    
                    // If it's a welcome message
                    if (data.type === "welcome") {
                        UIController.logToUI(`Connected to server: ${data.message}`);
                    }
                    
                    // If it's a sensor data message
                    else if (data.type === "sensor_data") {
                        // Now we know it's an ESP32
                        SensorManager.isESP32Connected = true;
                        SensorManager.updateESPStatus(true);
                        
                        // Determine sensor ID based on sensor name
                        let sensorId = 'sensor1';  // Default
                        
                        if (data.sensor) {
                            // Extract number if present
                            const sensorMatch = data.sensor.match(/\d+/);
                            if (sensorMatch) {
                                const sensorNum = parseInt(sensorMatch[0]);
                                if (sensorNum >= 1 && sensorNum <= 3) {
                                    sensorId = `sensor${sensorNum}`;
                                }
                            }
                        }
                        
                        // Get the value - either voltage, moisture_app_value, or normalized value
                        const value = data.moisture_app_value || data.voltage || data.normalized_value;
                        
                        if (value !== undefined) {
                            // Process the value
                            SensorManager.processESPData(sensorId, value);
                        }
                        
                        // Reset the last active time
                        SensorManager.lastESP32ActivityTime = Date.now();
                    }
                } catch (err) {
                    // Not JSON or doesn't have the expected format
                    UIController.logToUI(`Unrecognized data format: ${err.message}`);
                }
            };
            
            this.socket.onerror = (error) => {
                SensorManager.updateESPStatus(false);
                SensorManager.isESP32Connected = false;
                UIController.logToUI('WebSocket error');
            };
            
            this.socket.onclose = (event) => {
                SensorManager.updateESPStatus(false);
                SensorManager.isESP32Connected = false;
                UIController.logToUI('WebSocket connection closed');
                
                // Try to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (error) {
            SensorManager.updateESPStatus(false);
            SensorManager.isESP32Connected = false;
            UIController.logToUI('Error creating WebSocket: ' + error.message);
        }
    },
    
    // Send data to all connected clients
    sendData: function(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                const jsonString = JSON.stringify(data);
                this.socket.send(jsonString);
                return true;
            } catch (error) {
                UIController.logToUI('Error sending data: ' + error.message);
                return false;
            }
        }
        return false;
    }
};