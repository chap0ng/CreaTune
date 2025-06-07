#ifndef CONFIG_H
#define CONFIG_H

// WiFi configuration
#define WIFI_SSID "CreaTone"
#define WIFI_PASSWORD "03511572"

// WebSocket configuration
#define WEBSOCKET_HOST "192.168.0.100" // !!! IMPORTANT: Your WebSocket server's IP address !!!
#define WEBSOCKET_PORT 8080
#define WEBSOCKET_PATH "/"

// Sensor configuration
#define SENSOR_NAME "LightSensor"       // Unique name for this sensor
#define READING_INTERVAL 1000           // Send data every 1500ms (1.5 seconds)

// I2C Pins for DFRobot B-LUX-V30B
#define I2C_SDA_PIN 19  // Your SDA wiring
#define I2C_SCL_PIN 20  // Your SCL wiring

// Sensor Enable Pin for DFRobot B-LUX_V30B
// Since your sensor's EN pin is tied to 3.3V, it's always enabled.
// The library constructor still needs a pin. We'll use a general purpose GPIO.
// Ensure this pin (e.g., GPIO 4) is not used for other critical functions on your board.
#define SENSOR_ENABLE_PIN 4 // Example: GPIO 4. Change if this pin is in use.

// LED pin for status indication
#define STATUS_LED 15   // Your LED wiring

// Light level thresholds (LUX VALUES - CALIBRATE THESE for your environment and sensor)
#define LUX_EXTREMELY_DARK_MAX 0.5
#define LUX_DARK_MAX 10.0
#define LUX_DIM_MAX 100.0
#define LUX_BRIGHT_MAX 1000.0
#define LUX_VERY_BRIGHT_MAX 5000.0
// Anything above VERY_BRIGHT_MAX will be "extremely_bright"

// For light_app_value normalization (0.0 to 1.0)
#define MIN_RELEVANT_LUX 0.1f
#define MAX_RELEVANT_LUX 10000.0f


#endif // CONFIG_H