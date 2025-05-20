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
unsigned long lastWebSocketCheck = 0;
const unsigned long connectionRetryInterval = 5000; // 5 seconds between connection attempts
const unsigned long webSocketCheckInterval = 3000;  // Check WebSocket every 3 seconds
bool webSocketConnected = false;

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
  setupWebSocket();
}

void setupWebSocket() {
  Serial.print("WebSocket Server: ");
  Serial.print(WEBSOCKET_HOST);
  Serial.print(":");
  Serial.println(WEBSOCKET_PORT);
  
  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000); // Faster reconnect (3 seconds)
  webSocketConnected = false;
  
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
  unsigned long currentMillis = millis();
  
  // Check WiFi connection and reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    if (currentMillis - lastConnectionAttempt > connectionRetryInterval) {
      Serial.println("WiFi disconnected! Reconnecting... (´；ω；`)");
      connectToWiFi();
      lastConnectionAttempt = currentMillis;
      
      // Force reconnect WebSocket after WiFi reconnects
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("WiFi reconnected, restarting WebSocket...");
        setupWebSocket();
      }
    }
    digitalWrite(STATUS_LED, LOW); // LED off when disconnected
  } else {
    // WiFi is connected, process WebSocket
    webSocket.loop();
    
    // Periodically check if WebSocket is still connected
    if (currentMillis - lastWebSocketCheck > webSocketCheckInterval) {
      lastWebSocketCheck = currentMillis;
      
      // If we think we're disconnected but it's been a while, try reconnecting
      if (!webSocketConnected) {
        Serial.println("WebSocket appears disconnected, reconnecting...");
        webSocket.disconnect();
        delay(500);
        setupWebSocket();
      }
    }
    
    // Send sensor data at the specified interval
    if (currentMillis - lastSendTime >= READING_INTERVAL) {
      // Only send data if WebSocket is connected
      if (webSocketConnected) {
        sendSensorData();
        lastSendTime = currentMillis;
        
        // Blink LED on data send
        digitalWrite(STATUS_LED, HIGH);
        delay(100);
        digitalWrite(STATUS_LED, LOW);
      } else {
        Serial.println("Cannot send data, WebSocket not connected");
        digitalWrite(STATUS_LED, HIGH);
        delay(50);
        digitalWrite(STATUS_LED, LOW);
        delay(50);
        digitalWrite(STATUS_LED, HIGH);
        delay(50);
        digitalWrite(STATUS_LED, LOW);
      }
    }
  }
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
  if (rawValue < 0 || rawValue > 4095) {
    Serial.println("Soil sensor not found! (╥﹏╥) Check wiring to A1");
    return -1.0; // Error code
  }
  
  // Your custom ranges (◠‿◠)
  Serial.print("Soil Raw: ");
  Serial.print(rawValue);
  Serial.print(" | Status: ");
  
  if (rawValue <= MOISTURE_DRY_MAX) {
    Serial.println("Dry soil ＞﹏＜");
  } 
  else if (rawValue <= MOISTURE_HUMID_MAX) {
    Serial.println("Humid soil (￣ω￣)");
  }
  else if (rawValue <= MOISTURE_WET_MAX) {
    Serial.println("In water 〜(꒪꒳꒪)〜");
  }
  else {
    Serial.println("Sensor out of range! (⊙_⊙)？");
  }
  
  return (float)averageMoisture;
}

// Map moisture reading to app-compatible range (0.4-0.8)
float moistureToAppValue(float moistureValue) {
  float appValue;
  
  // Determine soil condition and map to appropriate range
  if (moistureValue <= MOISTURE_DRY_MAX) {
    // Dry soil (0-400) maps to 0.0-0.4
    appValue = map(moistureValue, MOISTURE_DRY, MOISTURE_DRY_MAX, 0, 50) / 100.0;
  } 
  else if (moistureValue <= MOISTURE_HUMID_MAX) {
    // Humid soil (401-700) maps to 0.4-0.7
    appValue = map(moistureValue, MOISTURE_HUMID_MIN, MOISTURE_HUMID_MAX, 40, 70) / 100.0;
  } 
  else {
    // In water (701-950) maps to 0.7-1.0
    appValue = map(moistureValue, MOISTURE_WET_MIN, MOISTURE_WET_MAX, 70, 100) / 100.0;
  }
  
  return appValue;
}

void sendSensorData() {
  // Read moisture sensor
  float moistureValue = readSoilMoisture();
  
  // Check if valid reading
  if (moistureValue > 950) {
    Serial.println("Invalid sensor reading, not sending data... (눈_눈)");
    return;
  }
  
  // Map to app-compatible value (0.4-0.8)
  float appValue = moistureToAppValue(moistureValue);
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  doc["sensor"] = SENSOR_NAME;
  doc["name"] = SENSOR_NAME;  // Add name field for better identification
  doc["raw_value"] = (int)moistureValue;
  doc["moisture_app_value"] = appValue;
  doc["voltage"] = appValue; // Send as voltage to be compatible with app
  doc["value"] = appValue;   // Also include standard value field
  doc["timestamp"] = millis();
  doc["type"] = "sensor_data";
  
  // Add soil condition description
  if (moistureValue <= MOISTURE_DRY_MAX) {
    doc["soil_condition"] = "dry";
  } else if (moistureValue <= MOISTURE_HUMID_MAX) {
    doc["soil_condition"] = "humid";
  } else {
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
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected (；一_一)");
      webSocketConnected = false;
      
      // Flash LED rapidly to indicate disconnection
      for (int i = 0; i < 5; i++) {
        digitalWrite(STATUS_LED, HIGH);
        delay(50);
        digitalWrite(STATUS_LED, LOW);
        delay(50);
      }
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");
      webSocketConnected = true;
      
      // Solid LED to indicate connected state
      digitalWrite(STATUS_LED, HIGH);
      delay(500);
      digitalWrite(STATUS_LED, LOW);
      
      // Send hello message
      StaticJsonDocument<100> doc;
      doc["type"] = "hello";
      doc["client"] = SENSOR_NAME;
      
      String helloMsg;
      serializeJson(doc, helloMsg);
      webSocket.sendTXT(helloMsg);
      
      // Send initial data immediately after connection
      sendSensorData();
      break;
      
    case WStype_TEXT:
      Serial.printf("Received text: %s\n", payload);
      Serial.println("(^-^)v");
      break;
      
    case WStype_ERROR:
      Serial.println("WebSocket Error! (╥﹏╥)");
      webSocketConnected = false;
      break;
  }
}

// WiFi connection with cute retries ฅ^•ﻌ•^ฅ
void connectToWiFi() {
  Serial.println("Connecting to WiFi... (｀・ω・´)");
  WiFi.disconnect();
  delay(500);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 15) {
    digitalWrite(STATUS_LED, HIGH); delay(100);
    digitalWrite(STATUS_LED, LOW); delay(100);
    Serial.print(".");
    retries++;
    delay(500);
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi failed... (；一_一)");
  }
}