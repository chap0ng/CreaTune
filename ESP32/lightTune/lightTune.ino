#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <Wire.h>                 // For I2C communication
#include "DFRobot_B_LUX_V30B.h" // Make sure this library is installed
#include "config.h"             // Your configuration file

WebSocketsClient webSocket;
DFRobot_B_LUX_V30B bLux(SENSOR_ENABLE_PIN); // Initialize with the enable pin from config.h

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

  Serial.println("LightSensor Booting Up...");

  // Initialize I2C for the sensor
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN); // Using pins from config.h

  if (bLux.begin() != 0) { // DFRobot libraries often return 0 on success
    Serial.println("Failed to initialize B-LUX-V30B sensor! Check wiring, I2C address, and ensure SENSOR_ENABLE_PIN in config.h is correct.");
    // Consider a visual indicator like rapid LED blinking
    while (1) {
      digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
      delay(100);
    }
  } else {
    Serial.println("B-LUX-V30B sensor initialized.");
    // Optional: Set sensor parameters if needed, e.g., integration time or gain
    // Refer to DFRobot_B_LUX_V30B library examples for manual configuration if defaults aren't optimal.
    // Example: bLux.setIntegTime(bLux.eIntegTime100ms);
    // Example: bLux.setGain(bLux.eGain1x);
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
      // digitalWrite(STATUS_LED, LOW); // Handled in loop()
      break;
    case WStype_CONNECTED:
      Serial.print("[WSc] Connected to server: ");
      Serial.println((char *)payload); // Server might send a welcome message
      serverConnected = true;
      // digitalWrite(STATUS_LED, HIGH); // Handled in loop()
      sendHandshake(); // Send handshake upon connection
      break;
    case WStype_TEXT:
      Serial.print("[WSc] Received text: ");
      Serial.println((char *)payload);
      // Handle any messages from server if needed (e.g., commands, acknowledgments)
      break;
    case WStype_BIN:
      Serial.println("[WSc] Received binary data.");
      // Handle binary data if needed
      break;
    case WStype_ERROR:
      Serial.println("[WSc] Error.");
      break;
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      // These are part of fragmented messages, usually handled by the library.
      // Serial.printf("[WSc] Fragment Event: %d\n", type);
      break;
    default:
      Serial.printf("[WSc] Unknown Event: %d\n", type);
      break;
  }
}

void sendHandshake() {
  if (!serverConnected) return;
  StaticJsonDocument<200> doc; // Adjust size if more fields are added
  doc["type"] = "esp_handshake";
  doc["sensorName"] = SENSOR_NAME;
  doc["device_type"] = "light"; // Explicitly state device type

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
  currentLux = bLux.getAmbientLight(); // Corrected method name

  // Check for error reading (DFRobot library might return negative on error)
  if (currentLux < 0) {
    Serial.println("Error reading lux value or sensor not ready. Using last valid or 0.");
    // Optionally, you could decide not to update currentLux here,
    // or set it to a specific error indicator if your downstream logic handles it.
    // For now, we'll keep the previous value or default to 0 if it was the first read.
    // If it's the very first read and it fails, currentLux will remain 0.0 as initialized.
  }
  currentLightCondition = getLightCondition(currentLux);
  currentLightAppValue = calculateLightAppValue(currentLux);

  Serial.printf("Lux: %.2f, Condition: %s, AppValue: %.2f\n", currentLux, currentLightCondition.c_str(), currentLightAppValue);
}

String getLightCondition(float lux) {
  if (lux <= LUX_EXTREMELY_DARK_MAX) return "extremely_dark";
  if (lux <= LUX_DARK_MAX) return "dark";
  if (lux <= LUX_DIM_MAX) return "dim";
  if (lux <= LUX_BRIGHT_MAX) return "bright";
  if (lux <= LUX_VERY_BRIGHT_MAX) return "very_bright";
  return "extremely_bright";
}

float calculateLightAppValue(float lux) {
  // Ensure lux is positive before taking log for normalization
  float effectiveLux = max(lux, MIN_RELEVANT_LUX); // Use MIN_RELEVANT_LUX to avoid log(0) or log(negative)
  
  float logLux = log10(effectiveLux);
  float logMin = log10(MIN_RELEVANT_LUX);
  float logMax = log10(MAX_RELEVANT_LUX);

  // Avoid division by zero if logMin equals logMax (e.g., if MIN_RELEVANT_LUX == MAX_RELEVANT_LUX)
  if (logMax - logMin == 0) {
    return (logLux >= logMin) ? 1.0f : 0.0f; // Or handle as an error/default
  }

  float normalized = (logLux - logMin) / (logMax - logMin);
  
  // Clamp the value between 0.0 and 1.0
  return max(0.0f, min(1.0f, normalized));
}

void sendSensorData() {
  if (!serverConnected) return;

  StaticJsonDocument<256> doc; // Sufficient size for the data
  doc["type"] = "sensor_data";
  doc["sensor"] = SENSOR_NAME;      // From config.h
  doc["device_type"] = "light";     // Explicitly state device type
  doc["lux"] = currentLux;
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
    // Serial.print("Sent Heartbeat: "); Serial.println(output); // Can be noisy, uncomment if needed for debugging
  } else {
    Serial.println("Error sending heartbeat.");
  }
}