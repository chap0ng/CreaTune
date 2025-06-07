#ifndef CONFIG_TEMP_H
#define CONFIG_TEMP_H

// WiFi configuration (can be the same as lightTune)
#define WIFI_SSID "CreaTone"
#define WIFI_PASSWORD "03511572"

// WebSocket configuration (can be the same as lightTune)
#define WEBSOCKET_HOST "192.168.0.100" // !!! IMPORTANT: Your WebSocket server's IP address !!!
#define WEBSOCKET_PORT 8080
#define WEBSOCKET_PATH "/"

// Sensor configuration
#define SENSOR_NAME "TempHumSensor"     // Unique name for this sensor
#define READING_INTERVAL 2500           // Send data every 2500ms (2.5 seconds) - DHT11 is slow

// DHT Sensor Pin and Type
#define DHT_PIN 8      // GPIO pin the DHT11 data pin is connected to (e.g., D4 on ESP32)
#define DHT_TYPE DHT11  // Define the type of DHT sensor

// LED pin for status indication
#define STATUS_LED 15   // Your LED wiring (can be the same as lightTune if on a different ESP32)

// Temperature thresholds (Celsius - CALIBRATE THESE for your desired ranges)
#define TEMP_VERY_COLD_MAX 5.0
#define TEMP_COLD_MAX 12.0
#define TEMP_COOL_MAX 18.0
#define TEMP_MILD_MAX 24.0
#define TEMP_WARM_MAX 29.0
// Anything above WARM_MAX will be "hot"

// For temp_app_value normalization (0.0 to 1.0) - Celsius
#define MIN_RELEVANT_TEMP 0.0f    // Min temperature for 0.0 app_value
#define MAX_RELEVANT_TEMP 35.0f   // Max temperature for 1.0 app_value

#endif // CONFIG_TEMP_H