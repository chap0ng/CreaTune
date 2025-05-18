// websocket-manager.js - Handles WebSocket communication with ESP32 devices

const WebSocketManager = {
    // WebSocket
    socket: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 5000,
    
    // Initialize WebSocket manager
    init: function() {
        this.connectWebSocket();
        UIController.logToUI('WebSocket manager initialized');
    },
    
    // Connect to WebSocket server
    connectWebSocket: function() {
        try {
            // Try to get the current hostname, or use localhost as fallback
            const host = window.location.hostname || 'localhost';
            const port = 8080;
            
            UIController.logToUI(`Connecting to WS: ${host}:${port}`);
            
            // Create WebSocket connection
            this.socket = new WebSocket(`ws://${host}:${port}`);
            
            // Setup event handlers
            this.socket.onopen = this.handleOpen.bind(this);
            this.socket.onmessage = this.handleMessage.bind(this);
            this.socket.onclose = this.handleClose.bind(this);
            this.socket.onerror = this.handleError.bind(this);
            
            // Set a connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
                    UIController.logToUI('WebSocket connection timed out');
                    this.socket.close();
                }
            }, 10000); // 10 second timeout
            
        } catch (error) {
            UIController.logToUI(`WebSocket error: ${error.message}`);
            this.scheduleReconnect();
        }
    },
    
    // Handle WebSocket open event
    handleOpen: function(event) {
        UIController.logToUI('WebSocket connected');
        clearTimeout(this.connectionTimeout);
        this.reconnectAttempts = 0; // Reset reconnect counter on success
        
        // Show success notification to user
        if (window.UIController && UIController.showNotification) {
            UIController.showNotification('ESP32 server connected', 'success');
        }
    },
    
    // Handle WebSocket message event
    handleMessage: function(event) {
        try {
            // Try to parse as JSON
            const data = JSON.parse(event.data);
            
            // Handle different message types
            if (data.type === "welcome") {
                UIController.logToUI(`Server: ${data.message}`);
            }
            else if (data.type === "sensor_data") {
                // Mark ESP32 as connected
                if (window.SensorManager) {
                    SensorManager.isESP32Connected = true;
                    SensorManager.updateESPStatus(true);
                    
                    // Extract the sensor value - try different properties
                    const value = data.moisture_app_value || data.voltage || data.value || 0.5;
                    
                    // Process the value if in valid range
                    if (value >= 0.4 && value <= 0.8) {
                        SensorManager.processESPData(value);
                    } else {
                        UIController.logToUI(`ESP32 value out of range: ${value}`);
                    }
                } else {
                    // If SensorManager isn't available, log the data and process directly
                    UIController.logToUI(`ESP32 data received: ${JSON.stringify(data)}`);
                    
                    // Extract value with fallbacks
                    const value = data.moisture_app_value || data.voltage || data.value || 0.5;
                    
                    // Directly use AudioEngine if available
                    if (window.AudioEngine && value >= 0.4 && value <= 0.8) {
                        AudioEngine.triggerSoundFromValue(value);
                    }
                }
            }
        } catch (error) {
            // Not valid JSON or other error
            console.log("WebSocket message error:", error, event.data);
            UIController.logToUI(`Invalid message format`);
        }
    },
    
    // Handle WebSocket close event
    handleClose: function(event) {
        clearTimeout(this.connectionTimeout);
        UIController.logToUI('WebSocket disconnected');
        
        // Update ESP32 status if Sensor Manager available
        if (window.SensorManager) {
            // Only update status if simulation is not active
            if (!SensorManager.isSimulationActive) {
                SensorManager.updateESPStatus(false);
                SensorManager.isESP32Connected = false;
            } else {
                UIController.logToUI('ESP32 simulation still active');
            }
        }
        
        // Schedule reconnect
        this.scheduleReconnect();
    },
    
    // Handle WebSocket error event
    handleError: function(error) {
        UIController.logToUI('WebSocket error');
        console.error("WebSocket error:", error);
        // No need to do anything else, the close event will fire next
    },
    
    // Schedule a reconnect attempt
    scheduleReconnect: function() {
        // Only attempt reconnect if under max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            const delay = this.reconnectDelay * this.reconnectAttempts;
            UIController.logToUI(`Reconnecting in ${delay/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        } else {
            UIController.logToUI('Max reconnect attempts reached. Use simulation instead.');
            
            // Suggest using simulation mode
            if (window.UIController && UIController.showNotification) {
                UIController.showNotification('Could not connect to ESP32. Try simulation mode.', 'info');
            }
        }
    },
    
    // Send data to server
    sendData: function(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                const jsonString = JSON.stringify(data);
                this.socket.send(jsonString);
                return true;
            } catch (error) {
                UIController.logToUI(`Send error: ${error.message}`);
                return false;
            }
        }
        return false;
    }
};