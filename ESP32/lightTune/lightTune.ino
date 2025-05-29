/*
  lightTune.ino
  ESP32 I2C light sensor data sender for CreaTune application
  For DFRobot B-LUX-V30B I2C Light Sensor
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>                   // For I2C communication
#include <DFRobot_B_LUX_V30B.h>     // DFRobot B-LUX-V30B library
#include "config.h"           // Use the config file

// Create a DFRobot_B_LUX_V30B_I2C object using the default I2C address 0x4A
DFRobot_B_LUX_V30B_I2C bLux(&Wire); 

WebSocketsClient webSocket;
unsigned long lastSendTime = 0;
unsigned long lastConnectionAttempt = 0;
const unsigned long connectionRetryInterval = 3000;

unsigned long lastHeartbeatTime = 0;
int heartbeatInterval = 2000;
bool heartbeatEnabled = true;

const int NUM_READINGS = 3; 
float lightReadings[NUM_READINGS];
int readIndex = 0;
float totalLight = 0;
float averageLight = 0;
bool sensorInitialized = false;

void connectToWiFi();
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length);
void sendSensorData();
void sendHeartbeat();
float readLightLevel(); 
float lightToAppValue(float luxValue, String &condition);


void setup() {
  Serial.begin(9600); // Changed to 9600 for consistency, can be 115200
  Serial.println("\nCreaSense DFRobot B-LUX-V30B Sensor - Starting up... (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");

  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.println("I2C interface initialized.");

  // Initialize the B-LUX-V30B sensor
  // The begin() function returns 0 on success.
  if (bLux.begin() == 0) {
    Serial.println("DFRobot B-LUX-V30B Sensor Initialized Successfully!");
    // Set the integration time (e.g., 100ms for a good balance)
    // Options: eTIME_50MS, eTIME_100MS, eTIME_200MS, eTIME_400MS, eTIME_800MS
    bLux.setIntegTime(bLux.eTIME_100MS); 
    Serial.print("Integration time set to: ");
    Serial.print(bLux.getIntegTime());
    Serial.println(" ms");
    sensorInitialized = true;
  } else {
    Serial.println("Error initializing DFRobot B-LUX-V30B Sensor! Check wiring. (╥﹏╥)");
    // Halt or enter an error state
    while(1) { digitalWrite(STATUS_LED, !digitalRead(STATUS_LED)); delay(100); } 
  }

  for (int i = 0; i < NUM_READINGS; i++) {
    lightReadings[i] = 0.0;
  }

  connectToWiFi();
  
  Serial.print("WebSocket Server: "); Serial.print(WEBSOCKET_HOST); Serial.print(":"); Serial.println(WEBSOCKET_PORT);
  
  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
  webSocket.enableHeartbeat(2000, 1500, 2); 
  
  Serial.print("Sensor Name: "); Serial.println(SENSOR_NAME);
  Serial.print("Reading Interval: "); Serial.print(READING_INTERVAL); Serial.println("ms");
  Serial.println("DFRobot B-LUX-V30B I2C Ambient Light Sensor connected. ฅ(^•ﻌ•^)ฅ");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastConnectionAttempt > connectionRetryInterval) {
      Serial.println("WiFi disconnected! Reconnecting... (´；ω；`)");
      connectToWiFi();
      lastConnectionAttempt = currentMillis;
    }
    digitalWrite(STATUS_LED, LOW);
  } else {
    webSocket.loop();
    unsigned long currentTime = millis();
    
    if (sensorInitialized && (currentTime - lastSendTime >= READING_INTERVAL)) {
      sendSensorData();
      lastSendTime = currentTime;
      digitalWrite(STATUS_LED, HIGH); delay(100); digitalWrite(STATUS_LED, LOW);
    }
    
    if (heartbeatEnabled && currentTime - lastHeartbeatTime >= heartbeatInterval) {
      sendHeartbeat();
    }
  }
}

float readLightLevel() {
  if (!sensorInitialized) {
    Serial.println("B-LUX-V30B sensor not initialized. Cannot read.");
    return -1.0; // Indicate error
  }

  float lux = bLux.getLux(); // Read lux value from B-LUX-V30B

  // The library doesn't explicitly state error return values for getLux() other than what begin() checks.
  // We assume a valid positive float or zero is returned on success.
  // Add any specific error checks if the library documentation provides them for getLux().
  // For now, we'll rely on begin() for major errors.

  // Smoothing
  totalLight = totalLight - lightReadings[readIndex];
  lightReadings[readIndex] = lux;
  totalLight = totalLight + lightReadings[readIndex];
  readIndex = (readIndex + 1) % NUM_READINGS;
  averageLight = totalLight / NUM_READINGS;

  Serial.print("Light Lux: "); Serial.print(lux, 2); 
  Serial.print(" | Avg Lux: "); Serial.print(averageLight, 2);
  
  return averageLight; 
}

// Maps lux value to an app-compatible range (0.0-1.0) and determines condition
float lightToAppValue(float luxValue, String &condition) {
  float appValue;

  if (luxValue <= LUX_DARK_MAX) {
    condition = "dark";
    appValue = map(luxValue * 100, 0, LUX_DARK_MAX * 100, 0, 20) / 100.0; 
  } else if (luxValue <= LUX_DIM_MAX) {
    condition = "dim";
    appValue = map(luxValue * 100, LUX_DIM_MIN * 100, LUX_DIM_MAX * 100, 21, 40) / 100.0; 
  } else if (luxValue <= LUX_BRIGHT_MAX) {
    condition = "bright";
    appValue = map(luxValue * 100, LUX_BRIGHT_MIN * 100, LUX_BRIGHT_MAX * 100, 41, 60) / 100.0; 
  } else if (luxValue <= LUX_VERYBRIGHT_MAX) {
    condition = "very_bright";
    appValue = map(luxValue * 100, LUX_VERYBRIGHT_MIN * 100, LUX_VERYBRIGHT_MAX * 100, 61, 80) / 100.0; 
  } else { 
    condition = "extremely_bright";
    appValue = constrain(map(luxValue * 100, (LUX_VERYBRIGHT_MAX + 0.01) * 100, (LUX_VERYBRIGHT_MAX + 1000) * 100, 81, 100) / 100.0, 0.81, 1.0); 
  }
  
  appValue = constrain(appValue, 0.0, 1.0);

  Serial.print(" | Condition: "); Serial.print(condition);
  Serial.print(" | AppVal: "); Serial.println(appValue, 2);
  return appValue;
}

void sendSensorData() {
  float currentLux = readLightLevel();
  if (currentLux < 0.0 && sensorInitialized) { // Check for negative if readLightLevel indicates error
      Serial.println("Error reading light level, not sending data.");
      return;
  }


  String lightCondition = "unknown";
  float appValue = lightToAppValue(currentLux, lightCondition);

  StaticJsonDocument<256> doc;
  doc["sensor"] = SENSOR_NAME;
  doc["raw_value"] = currentLux; 
  doc["light_app_value"] = appValue;
  doc["voltage"] = appValue; 
  doc["light_condition"] = lightCondition;
  doc["timestamp"] = millis();
  doc["type"] = "sensor_data";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Sending data: "); Serial.println(jsonString);
  webSocket.sendTXT(jsonString);
}

void sendHeartbeat() {
  if (!webSocket.isConnected() || !heartbeatEnabled) return;
  
  StaticJsonDocument<128> doc;
  doc["type"] = "heartbeat";
  doc["sensorName"] = SENSOR_NAME;
  doc["uptime"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  webSocket.sendTXT(jsonString);
  lastHeartbeatTime = millis();
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  String jsonString;
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected (；一_一)");
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");
      {
        StaticJsonDocument<200> handshake;
        handshake["type"] = "esp_handshake";
        handshake["sensorName"] = SENSOR_NAME;
        serializeJson(handshake, jsonString);
        webSocket.sendTXT(jsonString);
        Serial.println("Light Handshake sent! (•̀ᴗ•́)و");
      }
      break;
    case WStype_TEXT:
      Serial.printf("Received text: %s\n", payload);
      {
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);
        if (!error) {
          if (doc.containsKey("type") && strcmp(doc["type"], "handshake_ack") == 0) {
            Serial.println("✅ Light Handshake acknowledged!");
            if (doc.containsKey("heartbeat_interval")) {
              heartbeatInterval = doc["heartbeat_interval"];
              Serial.printf("📢 Setting light heartbeat interval to %d ms\n", heartbeatInterval);
            }
            if (doc.containsKey("heartbeat_enabled")) {
              heartbeatEnabled = doc["heartbeat_enabled"];
              Serial.printf("📢 Light Heartbeat %s\n", heartbeatEnabled ? "enabled" : "disabled");
            }
            if (sensorInitialized) sendSensorData(); 
            sendHeartbeat();  
          }
        } else {
          Serial.print("❌ JSON parsing failed: "); Serial.println(error.c_str());
        }
      }
      break;
    case WStype_PING: Serial.println("Ping received"); break;
    case WStype_PONG: Serial.println("Pong received"); break;
    case WStype_ERROR: Serial.println("WebSocket Error! (╥﹏╥)"); break;
  }
}

void connectToWiFi() {
  Serial.println("Connecting to WiFi... (｀・ω・´)");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    digitalWrite(STATUS_LED, HIGH); delay(150);
    digitalWrite(STATUS_LED, LOW); delay(150);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi failed... (；一_一)");
  }
}