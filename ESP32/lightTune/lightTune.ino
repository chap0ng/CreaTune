#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <Wire.h>                 // For I2C communication
#include <DFRobot_B_LUX_V30B.h> // Using DFRobot B-LUX-V30B library
#include "config.h"             // Your configuration file

WebSocketsClient webSocket;
// Initialize DFRobot_B_LUX_V30B with the enable pin from config.h
// The library uses default I2C pins unless Wire.begin() is called with specific pins before bLux.begin()
DFRobot_B_LUX_V30B bLux(SENSOR_ENABLE_PIN); 

unsigned long lastSendTime = 0;
float currentLux = 0;
String currentLightCondition = "unknown";
float currentLightAppValue = 0.0;
bool serverConnected = false;

// Function declarations
void connectWiFi();
void connectWebSocket();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void sendSensorData();
void sendHandshake();
void sendHeartbeat();
void readLightSensor();
String getLightCondition(float lux);
float calculateLightAppValue(float lux);

void setup() {
  Serial.begin(9600); // Or 115200 if you prefer
  while (!Serial);    // Wait for serial connection

  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW); // LED off initially

  Serial.println("LightSensor with DFRobot B-LUX-V30B Booting Up...");

  // Initialize I2C for the sensor using pins from config.h
  // This needs to be done before bLux.begin() if not using default I2C pins
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN); 

  bLux.begin(); // Initialize the sensor. Example doesn't check return, implies void or not critical.

  // Attempt an initial read to check sensor communication
  // DFRobot libraries often return a negative value on error for read functions
  float initialLux = bLux.lightStrengthLux(); 
  if (initialLux < 0) { 
    Serial.println("Failed to initialize B-LUX-V30B sensor or error on first read! Check wiring, I2C address, and SENSOR_ENABLE_PIN.");
    Serial.print("Initial read attempt returned: ");
    Serial.println(initialLux);
    // Consider a visual indicator like rapid LED blinking
    while (1) {
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
      delay(100);
    }
  } else {
    Serial.print("B-LUX-V30B sensor initialized. Initial Lux: ");
    Serial.println(initialLux);
    // Optional: Set sensor mode if needed, e.g.,
    // if(!bLux.setMode(bLux.eManual, bLux.eCDR_0, bLux.eTime100ms)){
    //   Serial.println("Failed to set sensor mode!");
    // } else {
    //   Serial.print("Sensor mode set. Current mode: ");
    //   Serial.println(bLux.readMode());
    // }
    // Default is usually automatic mode.
  }

  connectWiFi();
  connectWebSocket();
}

void loop() {
  webSocket.loop();

  if (serverConnected && millis() - lastSendTime > READING_INTERVAL) {
    readLightSensor();
    sendSensorData();
    lastSendTime = millis();
  }

  // Simple heartbeat mechanism
  static unsigned long lastHeartbeatTime = 0;
  if (serverConnected && millis() - lastHeartbeatTime > 30000) { // Send heartbeat every 30s
    sendHeartbeat();
    lastHeartbeatTime = millis();
  }
  digitalWrite(STATUS_LED, serverConnected ? HIGH : LOW); // LED ON if connected to WebSocket
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) { // Try for ~15 seconds
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi. Restarting in 10 seconds...");
    delay(10000);
    ESP.restart();
  }
}

void connectWebSocket() {
  Serial.print("Connecting to WebSocket server: ");
  Serial.print(WEBSOCKET_HOST);
  Serial.print(":");
  Serial.println(WEBSOCKET_PORT);

  webSocket.begin(WEBSOCKET_HOST, WEBSOCKET_PORT, WEBSOCKET_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000); // Try to reconnect every 5 seconds
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WSc] Disconnected from server.");
      serverConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.print("[WSc] Connected to server: ");
      Serial.println((char *)payload); // Server might send a welcome message
      serverConnected = true;
      sendHandshake(); // Send handshake upon connection
      break;
    case WStype_TEXT:
      Serial.print("[WSc] Received text: ");
      Serial.println((char *)payload);
      break;
    case WStype_BIN:
      Serial.println("[WSc] Received binary data.");
      break;
    case WStype_ERROR:
      Serial.println("[WSc] Error.");
      break;
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      break;
    default:
      Serial.printf("[WSc] Unknown Event: %d\n", type);
      break;
  }
}

void sendHandshake() {
  if (!serverConnected) return;
  StaticJsonDocument<200> doc;
  doc["type"] = "esp_handshake";
  doc["sensorName"] = SENSOR_NAME;
  doc["device_type"] = "light"; 

  String output;
  serializeJson(doc, output);
  if (webSocket.sendTXT(output)) {
    Serial.print("Sent Handshake: ");
    Serial.println(output);
  } else {
    Serial.println("Error sending handshake.");
  }
}

void readLightSensor() {
  currentLux = bLux.lightStrengthLux(); // Use lightStrengthLux() as per DFRobot example

  // Check for error reading (DFRobot library might return negative on error)
  if (currentLux < 0) {
    Serial.print("Error reading lux value (got: ");
    Serial.print(currentLux);
    Serial.println("). Using last valid or 0.");
    // Keep the previous valid currentLux or let it be the negative error value
    // depending on how you want to handle downstream.
    // For now, if it's an error, it will propagate.
  }
  currentLightCondition = getLightCondition(currentLux);
  currentLightAppValue = calculateLightAppValue(currentLux);

  Serial.printf("Lux: %.2f, Condition: %s, AppValue: %.2f\n", currentLux, currentLightCondition.c_str(), currentLightAppValue);
}

String getLightCondition(float lux) {
  if (lux < 0) return "error"; // Handle error case from sensor reading
  if (lux <= LUX_EXTREMELY_DARK_MAX) return "extremely_dark";
  if (lux <= LUX_DARK_MAX) return "dark";
  if (lux <= LUX_DIM_MAX) return "dim";
  if (lux <= LUX_BRIGHT_MAX) return "bright";
  if (lux <= LUX_VERY_BRIGHT_MAX) return "very_bright";
  return "extremely_bright";
}

float calculateLightAppValue(float lux) {
  if (lux < 0) return 0.0f; // Handle error case from sensor reading
  
  float effectiveLux = max(lux, MIN_RELEVANT_LUX); 
  
  float logLux = log10(effectiveLux);
  float logMin = log10(MIN_RELEVANT_LUX);
  float logMax = log10(MAX_RELEVANT_LUX);

  if (logMax - logMin == 0) {
    return (logLux >= logMin) ? 1.0f : 0.0f;
  }

  float normalized = (logLux - logMin) / (logMax - logMin);
  return max(0.0f, min(1.0f, normalized));
}

void sendSensorData() {
  if (!serverConnected) return;

  StaticJsonDocument<256> doc; 
  doc["type"] = "sensor_data";
  doc["sensor"] = SENSOR_NAME;      
  doc["device_type"] = "light";     
  doc["lux"] = currentLux; // Send the potentially negative value if there was an error, or the actual lux
  doc["light_condition"] = currentLightCondition;
  doc["light_app_value"] = currentLightAppValue;

  String output;
  serializeJson(doc, output);
  if (webSocket.sendTXT(output)) {
    Serial.print("Sent Data: ");
    Serial.println(output);
  } else {
    Serial.println("Error sending data via WebSocket.");
  }
}

void sendHeartbeat() {
  if (!serverConnected) return;
  StaticJsonDocument<128> doc;
  doc["type"] = "heartbeat";
  doc["sensorName"] = SENSOR_NAME;
  doc["device_type"] = "light";

  String output;
  serializeJson(doc, output);
  if (webSocket.sendTXT(output)) {
    // Serial.print("Sent Heartbeat: "); Serial.println(output); 
  } else {
    Serial.println("Error sending heartbeat.");
  }
}