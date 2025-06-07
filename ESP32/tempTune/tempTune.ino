#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <DHT.h>
#include "config_temp.h" // Your configuration file

// Global objects and variables
WebSocketsClient webSocket;
DHT dht(DHT_PIN, DHT_TYPE); // Initialize DHT sensor using pins from config_temp.h

unsigned long lastSendTime = 0;
float currentTemperature = 0;
float currentHumidity = 0;
String currentTempCondition = "unknown";
float currentTempAppValue = 0.0;
bool serverConnected = false;
unsigned long lastHeartbeatTime = 0;

// Function declarations (forward declarations)
void connectWiFi();
void connectWebSocket();
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length);
void sendSensorData();
void sendHandshake();
void sendHeartbeat();
void readTempSensor();
String getTempCondition(float tempC);
float calculateTempAppValue(float tempC);

void setup() {
    Serial.begin(115200);
    while (!Serial) {
        delay(10); // Wait for serial port
    }

    pinMode(STATUS_LED, OUTPUT);
    digitalWrite(STATUS_LED, LOW); // LED off initially

    Serial.println("Temperature Sensor Initializing (single .ino file)...");
    Serial.print("Sensor Name (from config.h): ");
    Serial.println(SENSOR_NAME);

    dht.begin(); // Initialize the DHT sensor
    delay(2000); // Wait for sensor to settle

    float initialTemp = dht.readTemperature();
    if (isnan(initialTemp)) {
        Serial.println("FATAL: Failed to read from DHT sensor on startup!");
        Serial.println("Check wiring, DHT_PIN, and DHT_TYPE in config_temp.h.");
        while (1) { // Halt execution
            digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
            delay(100);
        }
    } else {
        Serial.print("DHT sensor initialized. Initial Temperature: ");
        Serial.print(initialTemp);
        Serial.println(" *C");
    }

    connectWiFi();
    connectWebSocket();
}

void loop() {
    webSocket.loop();

    if (serverConnected && (millis() - lastSendTime > READING_INTERVAL)) {
        readTempSensor();
        sendSensorData(); // lastSendTime will be updated in sendSensorData on success
    }

    if (serverConnected && (millis() - lastHeartbeatTime > 30000)) { // Send heartbeat every 30s
        sendHeartbeat();
        lastHeartbeatTime = millis();
    }
    digitalWrite(STATUS_LED, serverConnected ? HIGH : LOW); // LED ON if connected
}

void connectWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) { // Try for 15 seconds
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
    Serial.print("Path: ");
    Serial.println(WEBSOCKET_PATH);

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
            Serial.println((char *)payload); // Server URL
            serverConnected = true;
            sendHandshake();
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
            Serial.print("[WSc] Unknown event type: ");
            Serial.println(type);
            break;
    }
}

void sendHandshake() {
    if (!serverConnected) return;
    StaticJsonDocument<200> doc;
    doc["type"] = "esp_handshake";
    doc["sensorName"] = SENSOR_NAME;
    doc["device_type"] = "temperature";

    String output;
    serializeJson(doc, output);
    if (webSocket.sendTXT(output)) {
        Serial.print("Sent Handshake: ");
        Serial.println(output);
    } else {
        Serial.println("Error sending handshake.");
    }
}

void readTempSensor() {
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) {
        Serial.println("Warning: Failed to read from DHT sensor during loop.");
        return;
    }

    currentTemperature = temp;
    currentHumidity = hum;
    currentTempCondition = getTempCondition(currentTemperature);
    currentTempAppValue = calculateTempAppValue(currentTemperature);

    Serial.printf("Temp: %.1f C, Hum: %.1f %%, Cond: %s, AppVal: %.2f\n",
                  currentTemperature, currentHumidity, currentTempCondition.c_str(), currentTempAppValue);
}

String getTempCondition(float tempC) {
    if (tempC <= TEMP_VERY_COLD_MAX) return "very_cold";
    if (tempC <= TEMP_COLD_MAX) return "cold";
    if (tempC <= TEMP_COOL_MAX) return "cool";
    if (tempC <= TEMP_MILD_MAX) return "mild";
    if (tempC <= TEMP_WARM_MAX) return "warm";
    return "hot";
}

float calculateTempAppValue(float tempC) {
    float effectiveTemp = max(tempC, MIN_RELEVANT_TEMP);
    effectiveTemp = min(effectiveTemp, MAX_RELEVANT_TEMP);

    if (MAX_RELEVANT_TEMP - MIN_RELEVANT_TEMP == 0) {
        return (effectiveTemp >= MIN_RELEVANT_TEMP) ? 1.0f : 0.0f;
    }

    float normalized = (effectiveTemp - MIN_RELEVANT_TEMP) / (MAX_RELEVANT_TEMP - MIN_RELEVANT_TEMP);
    return max(0.0f, min(1.0f, normalized));
}

void sendSensorData() {
    if (!serverConnected) return;

    StaticJsonDocument<256> doc;
    doc["type"] = "sensor_data";
    doc["sensor"] = SENSOR_NAME;
    doc["device_type"] = "temperature";
    doc["temperature_c"] = round(currentTemperature * 10.0) / 10.0;
    doc["humidity_percent"] = round(currentHumidity * 10.0) / 10.0;
    doc["temp_condition"] = currentTempCondition;
    doc["temp_app_value"] = round(currentTempAppValue * 100.0) / 100.0;

    String output;
    serializeJson(doc, output);
    if (webSocket.sendTXT(output)) {
        Serial.print("Sent Data: ");
        Serial.println(output);
        lastSendTime = millis();
    } else {
        Serial.println("Error sending data via WebSocket.");
    }
}

void sendHeartbeat() {
    if (!serverConnected) return;
    StaticJsonDocument<128> doc;
    doc["type"] = "heartbeat";
    doc["sensorName"] = SENSOR_NAME;
    doc["device_type"] = "temperature";

    String output;
    serializeJson(doc, output);
    if (webSocket.sendTXT(output)) {
        // Serial.print("Sent Heartbeat: "); Serial.println(output); // Usually too verbose
    } else {
        Serial.println("Error sending heartbeat.");
    }
}