// config_light.h
// Configuration for CreaSense ESP32 I2C Light Sensor (e.g., BH1750)

// WiFi configuration
#define WIFI_SSID "CreaTone"
#define WIFI_PASSWORD "03511572"

// WebSocket configuration
#define WEBSOCKET_HOST "192.168.0.100" // Your WebSocket server IP
#define WEBSOCKET_PORT 8080
#define WEBSOCKET_PATH "/"

// Sensor configuration
#define SENSOR_NAME "LightSensor_I2C"   // Unique name for this sensor
#define READING_INTERVAL 1000           // Send data every 1000ms (1 second)

// I2C Pins for ESP32 FireBeetle 2 C6 (Default I2C0)
#define I2C_SDA_PIN 8
#define I2C_SCL_PIN 9

// LED pin
#define STATUS_LED 15                   // Built-in LED pin

// Light level thresholds (LUX VALUES - Calibrate these based on your sensor readings)
// Reference: Evening: 0.001-0.02lx; Moonlit: 0.02-0.3lx; Cloudy Indoor: 5-50lx;
// Cloudy Outdoor: 50-500lx; Sunny Indoor: 100-1000lx; Reading: 50-60lx.
#define LUX_DARK_MAX 0.5                // Example: Up to 0.5 lx is "dark"
#define LUX_DIM_MIN 0.51                // Example: From 0.51 lx
#define LUX_DIM_MAX 50.0                // Example: Up to 50 lx is "dim" (covers cloudy indoor, reading)
#define LUX_BRIGHT_MIN 50.01            // Example: From 50.01 lx
#define LUX_BRIGHT_MAX 500.0            // Example: Up to 500 lx is "bright" (covers cloudy outdoor)
#define LUX_VERYBRIGHT_MIN 500.01       // Example: From 500.01 lx
#define LUX_VERYBRIGHT_MAX 2000.0       // Example: Up to 2000 lx is "very_bright" (covers sunny indoor, home video)
// Anything above VERYBRIGHT_MAX will be "extremely_bright"