/*
  CreaTune Soil Sensor
  ESP32 client for CreaTune application
  For DFRobot Moisture Sensor on ESP32 Firebeetle 2 C6
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi configuration - Change to your network
#define WIFI_SSID "CreaTone"
#define WIFI_PASSWORD "CreaToToToTone"

// WebSocket configuration - Set to your app server IP
#define WEBSOCKET_HOST "192.168.160.55" //IP 
#define WEBSOCKET_PORT 8080
#define WEBSOCKET_PATH "/"

// Sensor configuration
#define SENSOR_TYPE "soil"              // IMPORTANT: Must be "soil" for app to recognize
#define SENSOR_NAME "ESP32-1"           // Device name for app
#define SENSOR_PIN A1                   // Connect moisture sensor to A1 pin
#define READING_INTERVAL 500            // Send data every 500ms

// LED pin
#define STATUS_LED 15                   // Built-in LED pin

// Moisture ranges (for DFRobot sensor)
#define MOISTURE_DRY 0                  // Dry soil minimum
#define MOISTURE_DRY_MAX 300            // Dry soil maximum
#define MOISTURE_HUMID_MIN 301          // Humid soil minimum
#define MOISTURE_HUMID_MAX 700          // Humid soil maximum
#define MOISTURE_WET_MIN 701            // In water minimum
#define MOISTURE_WET_MAX 950            // In water maximum

WebSocketsClient webSocket;
unsigned long lastSendTime = 0;
unsigned long lastConnectionAttempt = 0;
unsigned long lastPingTime = 0;
const unsigned long connectionRetryInterval = 5000;

// For smoothing sensor readings
const int NUM_READINGS = 5;
int moistureReadings[NUM_READINGS];
int readIndex = 0;
int totalMoisture = 0;
int averageMoisture = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\nCreaTune Soil Sensor Starting Up");

  Serial.print("Connecting to: ");
  Serial.print(WEBSOCKET_HOST);
  Serial.print(":");
  Serial.println(WEBSOCKET_PORT);

  // Set up LED pin
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  // Configure ADC
  analogReadResolution(12);

  // Initialize readings array
  for (int i = 0; i < NUM_READINGS; i++) {
    moistureReadings[i] = 0;
  }

  // Connect to WiFi
  connectToWiFi();
  
  // Setup WebSocket connection
  Serial.print("WebSocket Server: ");
  Serial.print(WEBSOCKET_HOST);
  Serial.print(":");
  Serial.println(WEBSOCKET_PORT);
  
  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 3000, 2);
}

void loop() {
  // Auto-reconnect if WiFi drops
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastConnectionAttempt > connectionRetryInterval) {
      Serial.println("WiFi disconnected! Reconnecting...");
      connectToWiFi();
      lastConnectionAttempt = currentMillis;
    }
    digitalWrite(STATUS_LED, LOW); // LED off when disconnected
  } else {
    // Only process WebSocket if WiFi is connected
    webSocket.loop();
    
    // Current time for all timing operations
    unsigned long currentTime = millis();
    
    // Send sensor data at the specified interval
    if (currentTime - lastSendTime >= READING_INTERVAL) {
      sendSensorData();
      lastSendTime = currentTime;
      
      // Non-blocking LED blink
      static unsigned long ledTimer = 0;
      if (currentTime - ledTimer < 50) {
        digitalWrite(STATUS_LED, HIGH);
      } else {
        digitalWrite(STATUS_LED, LOW);
      }
      if (currentTime - ledTimer > 100) {
        ledTimer = currentTime;
      }
    }
    
    // Send a ping every 5 seconds to keep connection alive
    if (currentTime - lastPingTime >= 5000) {
      webSocket.sendPing();
      lastPingTime = currentTime;
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
  
  // Log current reading
  Serial.print("Soil Raw: ");
  Serial.print(rawValue);
  Serial.print(" | Avg: ");
  Serial.print(averageMoisture);
  Serial.print(" | Status: ");
  
  if (averageMoisture <= MOISTURE_DRY_MAX) {
    Serial.println("Dry soil");
  } 
  else if (averageMoisture <= MOISTURE_HUMID_MAX) {
    Serial.println("Humid soil");
  }
  else if (averageMoisture <= MOISTURE_WET_MAX) {
    Serial.println("In water");
  }
  else {
    Serial.println("Sensor out of range!");
  }
  
  return (float)averageMoisture;
}

// Map moisture reading to app-compatible range (0.4-0.8)
// CreaTune app expects values in this range to activate synths
float moistureToAppValue(float moistureValue) {
  float appValue;
  
  // Determine soil condition and map to appropriate range
  if (moistureValue <= MOISTURE_DRY_MAX) {
    // Dry soil (0-300) maps to 0.1-0.4 (invalid to barely valid)
    appValue = map(moistureValue, MOISTURE_DRY, MOISTURE_DRY_MAX, 10, 40) / 100.0;
  } 
  else if (moistureValue <= MOISTURE_HUMID_MAX) {
    // Humid soil (301-700) maps to 0.4-0.7 (valid range)
    appValue = map(moistureValue, MOISTURE_HUMID_MIN, MOISTURE_HUMID_MAX, 40, 70) / 100.0;
  } 
  else {
    // In water (701-950) maps to 0.7-0.8 (valid range)
    appValue = map(moistureValue, MOISTURE_WET_MIN, MOISTURE_WET_MAX, 70, 80) / 100.0;
  }
  
  // Ensure within bounds
  if (appValue < 0.0) appValue = 0.0;
  if (appValue > 1.0) appValue = 1.0;
  
  return appValue;
}

void sendSensorData() {
  // Read moisture sensor
  float moistureValue = readSoilMoisture();
  
  // Map to app-compatible value (focused on 0.4-0.8 valid range)
  float appValue = moistureToAppValue(moistureValue);
  
  // Create JSON document
  StaticJsonDocument<200> doc;
  
  // IMPORTANT: These fields must match exactly what the app expects
  doc["type"] = "sensor_data";
  doc["sensor"] = SENSOR_TYPE;       // Must be "soil" for app to recognize
  doc["name"] = SENSOR_NAME;         // "ESP32-1" matches app configuration
  doc["value"] = appValue;           // This field is required by the app
  
  // Additional info for debugging (not required by app)
  doc["raw_value"] = (int)moistureValue;
  doc["timestamp"] = millis();
  
  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Log the data
  Serial.print("Sending data: ");
  Serial.println(jsonString);
  
  // Send through WebSocket
  webSocket.sendTXT(jsonString);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected");
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected!");
      // Send immediate data on connection
      sendSensorData();
      break;
      
    case WStype_TEXT:
      Serial.printf("Received text: %s\n", payload);
      break;
      
    case WStype_ERROR:
      Serial.print("WebSocket Error connecting to: ");
      Serial.print(WEBSOCKET_HOST);
      Serial.print(":");
      Serial.println(WEBSOCKET_PORT);
      break;
  }
}

void connectToWiFi() {
  Serial.println("Connecting to WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); // Blink LED
    delay(250);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    // Signal connection with LED
    for (int i = 0; i < 5; i++) {
      digitalWrite(STATUS_LED, HIGH);
      delay(100);
      digitalWrite(STATUS_LED, LOW);
      delay(100);
    }
  } else {
    Serial.println("\nWiFi connection failed");
  }
}