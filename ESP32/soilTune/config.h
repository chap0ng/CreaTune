// config.h
// Configuration for CreaSense ESP32

// WiFi configuration
#define WIFI_SSID "CreaTone"
#define WIFI_PASSWORD "CreaToToToTone"

// WebSocket configuration
//#define WEBSOCKET_HOST "192.168.113.105"
#define WEBSOCKET_HOST "172.23.75.115"
#define WEBSOCKET_PORT 8080
#define WEBSOCKET_PATH "/"

// Sensor configuration
#define SENSOR_NAME "MoistureSensor"
#define SENSOR_PIN A1                   // Connect moisture sensor to A1 pin
#define READING_INTERVAL 1000           // Send data every 1000ms (1 seconds)

// LED pin
#define STATUS_LED 15                   // Built-in LED pin

// ADC configuration
#define ADC_RESOLUTION 4095.0           // 12-bit ADC (2^12 - 1)
#define VOLTAGE_REFERENCE 3.3           // ESP32 reference voltage (3.3V)

// Moisture ranges
#define MOISTURE_DRY 0                  // Dry soil minimum
#define MOISTURE_DRY_MAX 300            // Dry soil maximum
#define MOISTURE_HUMID_MIN 300          // Humid soil minimum
#define MOISTURE_HUMID_MAX 700          // Humid soil maximum
#define MOISTURE_WET_MIN 700            // In water minimum
#define MOISTURE_WET_MAX 950            // In water maximum