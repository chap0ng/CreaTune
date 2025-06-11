// config.h
// Configuration for CreaSense ESP32

// WiFi configuration
#define WIFI_SSID "CreaTone"
#define WIFI_PASSWORD "03511572"

// WebSocket configuration
//#define WEBSOCKET_HOST "192.168.113.105"
#define WEBSOCKET_HOST "192.168.0.100"
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

// Moisture ranges - BASED ON EXAMPLE: Dry (0-300), Humid (300-700), Wet (700-950)
// ADJUST BASED ON YOUR ACTUAL SENSOR CALIBRATION!
#define MOISTURE_DRY 0            // Lowest expected "dry" reading
#define MOISTURE_DRY_MAX 300      // Upper limit for "dry"
#define MOISTURE_HUMID_MIN 301    // Start of "humid"
#define MOISTURE_HUMID_MAX 700    // Upper limit for "humid"
#define MOISTURE_WET_MIN 701      // Start of "wet"
#define MOISTURE_WET_MAX 950      // Upper limit for "wet" / "in water"