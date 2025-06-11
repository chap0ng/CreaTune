/*
  CreaSense.ino
  ESP32 sensor data sender for CreaTune application
  Modified for DFRobot Moisture Sensor on ESP32 Firebeetle 2 C6
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "config.h"

WebSocketsClient webSocket;
unsigned long lastSendTime = 0;
unsigned long lastConnectionAttempt = 0;
const unsigned long connectionRetryInterval = 3000; // 3 seconds between connection attempts

// Heartbeat variables - NEW CODE
unsigned long lastHeartbeatTime = 0;
int heartbeatInterval = 2000; // Default, will be updated from server if needed
bool heartbeatEnabled = true;

// For smoothing sensor readings
const int NUM_READINGS = 5;
int moistureReadings[NUM_READINGS];
int readIndex = 0;
int totalMoisture = 0;
int averageMoisture = 0;

void setup() {
  // Initialize serial for debugging
  Serial.begin(9600);
  Serial.println("\nCreaSense Moisture Sensor - Starting up... (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");

  // Set up LED pin
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // Configure ADC
  analogReadResolution(12); // Set ADC resolution to 12 bits

  // Initialize moisture reading array
  for (int i = 0; i < NUM_READINGS; i++) {
    moistureReadings[i] = 0;
  }

  // Connect to WiFi with blinky lights (｀・ω・´)
  connectToWiFi();
  
  // Setup WebSocket connection
  Serial.print("WebSocket Server: ");
  Serial.print(WEBSOCKET_HOST);
  Serial.print(":");
  Serial.println(WEBSOCKET_PORT);
  
  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
  
  // Enable WebSocket ping/pong for faster disconnection detection - NEW CODE
  webSocket.enableHeartbeat(2000, 1500, 2); // ping interval, timeout, retries
  
  // Print sensor info
  Serial.print("Sensor Name: ");
  Serial.println(SENSOR_NAME);
  Serial.print("Sensor Pin: ");
  Serial.println(SENSOR_PIN);
  Serial.print("Reading Interval: ");
  Serial.print(READING_INTERVAL);
  Serial.println("ms");
  Serial.println("DFRobot Moisture Sensor connected to pin A1 ฅ(^•ﻌ•^)ฅ");
}

void loop() {
  // Auto-reconnect if WiFi drops (╯°□°）╯︵ ┻━┻
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastConnectionAttempt > connectionRetryInterval) {
      Serial.println("WiFi disconnected! Reconnecting... (´；ω；`)");
      connectToWiFi();
      lastConnectionAttempt = currentMillis;
    }
    digitalWrite(STATUS_LED, LOW); // LED off when disconnected
  } else {
    // Only process WebSocket if WiFi is connected
    webSocket.loop();
    
    unsigned long currentTime = millis();
    
    // Send sensor data at the specified interval
    if (currentTime - lastSendTime >= READING_INTERVAL) {
      sendSensorData();
      lastSendTime = currentTime;
      
      // Blink LED on data send
      digitalWrite(STATUS_LED, HIGH);
      delay(200);
      digitalWrite(STATUS_LED, LOW);
    }
    
    // NEW CODE: Send explicit heartbeat messages if needed
    if (heartbeatEnabled && currentTime - lastHeartbeatTime >= heartbeatInterval) {
      sendHeartbeat();
    }
  }
}

// NEW FUNCTION: Send heartbeat message to server
void sendHeartbeat() {
  if (!webSocket.isConnected() || !heartbeatEnabled) {
    return;
  }
  
  StaticJsonDocument<128> doc;
  doc["type"] = "heartbeat";
  doc["sensorName"] = SENSOR_NAME;
  doc["uptime"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
  
  lastHeartbeatTime = millis();
  // Uncomment for debugging heartbeats
  // Serial.println("💓 Heartbeat sent");
}

// Read the moisture sensor and smooth the values
float readSoilMoisture() {
  // Subtract the last reading
  totalMoisture = totalMoisture - moistureReadings[readIndex];
  
  // Read the sensor
  int rawValue = analogRead(SENSOR_PIN);
  moistureReadings[readIndex] = rawValue;
  
  // Add the reading to the total
  totalMoisture = totalMoisture + moistureReadings[readIndex];
  
  // Advance to the next position in the array
  readIndex = (readIndex + 1) % NUM_READINGS;
  
  // Calculate the average
  averageMoisture = totalMoisture / NUM_READINGS;
  
  // Sensor error detection
  if (rawValue < 0 || rawValue > 4095) { // Using 12-bit ADC max
    Serial.println("Soil sensor not found or error! (╥﹏╥) Check wiring to A1");
    return -1.0; // Error code
  }
  
  // Your custom ranges (◠‿◠)
  Serial.print("Soil Raw: ");
  Serial.print(rawValue);
  Serial.print(" | Smoothed Avg: "); // ADDED FOR CALIBRATION
  Serial.print(averageMoisture);     // ADDED FOR CALIBRATION
  Serial.print(" | Status: ");
  
  // Use averageMoisture for determining status for consistency with what's returned
  if (averageMoisture <= MOISTURE_DRY_MAX) {
    Serial.println("Dry soil ＞﹏＜");
  } 
  else if (averageMoisture <= MOISTURE_HUMID_MAX) {
    Serial.println("Humid soil (￣ω￣)");
  }
  // Anything above MOISTURE_HUMID_MAX is considered wet, including values that might exceed MOISTURE_WET_MAX
  else { 
    Serial.println("In water / Very Wet 〜(꒪꒳꒪)〜"); // Changed message to reflect it covers all "wet" states
  }
  
  return (float)averageMoisture;
}

// Map moisture reading to app-compatible range (0.0-1.0)
float moistureToAppValue(float moistureValue) {
  float appValue;
  
  // Clamp moistureValue to be within the overall calibrated range to prevent issues with map()
  // if MOISTURE_DRY is not 0 or MOISTURE_WET_MAX is not the absolute max.
  // This is particularly important if your MOISTURE_DRY is higher than 0.
  float clampedValue = constrain(moistureValue, MOISTURE_DRY, MOISTURE_WET_MAX);

  // Determine soil condition and map to appropriate range
  if (clampedValue <= MOISTURE_DRY_MAX) {
    // Dry soil maps to 0.0-0.4
    appValue = map(clampedValue, MOISTURE_DRY, MOISTURE_DRY_MAX, 0, 40) / 100.0;
  } 
  else if (clampedValue <= MOISTURE_HUMID_MAX) {
    // Humid soil maps to 0.41-0.8
    appValue = map(clampedValue, MOISTURE_HUMID_MIN, MOISTURE_HUMID_MAX, 41, 80) / 100.0;
  } 
  else { // Covers MOISTURE_WET_MIN to MOISTURE_WET_MAX
    // In water maps to 0.81-1.0
    appValue = map(clampedValue, MOISTURE_WET_MIN, MOISTURE_WET_MAX, 81, 100) / 100.0;
  }
  
  // Ensure appValue is strictly between 0.0 and 1.0
  return constrain(appValue, 0.0, 1.0);
}

void sendSensorData() {
  // Read moisture sensor
  float moistureValue = readSoilMoisture(); // This is the smoothed average
  
  // Check if valid reading (error code from readSoilMoisture is -1.0)
  if (moistureValue < 0.0) {
    Serial.println("Invalid sensor reading (error code), not sending data... (눈_눈)");
    return;
  }

  // Map to app-compatible value
  float appValue = moistureToAppValue(moistureValue);
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["sensor"] = SENSOR_NAME;
  doc["raw_value"] = (int)moistureValue; // Send the smoothed average as raw_value
  doc["moisture_app_value"] = appValue;
  doc["voltage"] = appValue; // Send as voltage to be compatible with app
  doc["timestamp"] = millis();
  doc["type"] = "sensor_data";
  
  // Add soil condition description
  if (moistureValue <= MOISTURE_DRY_MAX) {
    doc["soil_condition"] = "dry";
  } else if (moistureValue <= MOISTURE_HUMID_MAX) {
    doc["soil_condition"] = "humid";
  } else { // Anything above MOISTURE_HUMID_MAX is "wet"
    doc["soil_condition"] = "wet";
  }
  
  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Log the data
  Serial.print("Sending data: ");
  Serial.println(jsonString);
  Serial.println("ヾ(^▽^*)))");
  
  // Send through WebSocket
  webSocket.sendTXT(jsonString);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  // Define reusable variables outside switch
  String jsonString;
  
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected (；一_一)");
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");
      
      // NEW CODE: Send handshake to identify this device
      {
        StaticJsonDocument<200> handshake;
        handshake["type"] = "esp_handshake";
        handshake["sensorName"] = SENSOR_NAME;
        
        jsonString = "";
        serializeJson(handshake, jsonString);
        webSocket.sendTXT(jsonString);
        Serial.println("Handshake sent to server! (•̀ᴗ•́)و");
      }
      break;
      
    case WStype_TEXT:
      Serial.printf("Received text: %s\n", payload);
      
      // NEW CODE: Parse incoming JSON for heartbeat config and handshake ack
      {
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
          // If this is a handshake acknowledgment with heartbeat settings
          if (doc.containsKey("type") && strcmp(doc["type"], "handshake_ack") == 0) {
            Serial.println("✅ Handshake acknowledged!");
            
            // Update heartbeat settings if provided
            if (doc.containsKey("heartbeat_interval")) {
              heartbeatInterval = doc["heartbeat_interval"];
              Serial.printf("📢 Setting heartbeat interval to %d ms\n", heartbeatInterval);
            }
            
            if (doc.containsKey("heartbeat_enabled")) {
              heartbeatEnabled = doc["heartbeat_enabled"];
              Serial.printf("📢 Heartbeat %s\n", heartbeatEnabled ? "enabled" : "disabled");
            }
            
            // Send initial data after handshake is acknowledged
            sendSensorData();
            
            // And an immediate heartbeat
            sendHeartbeat();
          }
        } else {
          Serial.print("❌ JSON parsing failed: ");
          Serial.println(error.c_str());
        }
      }
      Serial.println("(^-^)v");
      break;
      
    case WStype_PING:
      // WebSocketsClient handles pong response automatically
      Serial.println("Ping received");
      break;
      
    case WStype_PONG:
      // Server sent a pong response
      Serial.println("Pong received");
      break;
      
    case WStype_ERROR:
      Serial.println("WebSocket Error! (╥﹏╥)");
      break;
  }
}

// WiFi connection with cute retries ฅ^•ﻌ•^ฅ
void connectToWiFi() {
  Serial.println("Connecting to WiFi... (｀・ω・´)");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 10) {
    digitalWrite(STATUS_LED, HIGH); delay(200);
    digitalWrite(STATUS_LED, LOW); delay(200);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi failed... (；一_一)");
  }
}