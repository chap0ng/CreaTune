# CreaTune - Interactive Musical Experience

CreaTune is an interactive web application that combines sensor data from ESP32 microcontrollers with musical synthesis to create an engaging audiovisual experience. The application changes its state based on connected sensors and produces different visuals and sounds in response to sensor data.

## Features

- **Responsive State Machine**: Automatically switches between 8 different states based on sensor connections
- **Interactive Audio**: Generates music using Tone.js based on the current state and sensor values
- **Animated Creatures**: Visual creatures that respond to sensor data with animation and effects
- **Record & Repeat**: Capture and loop musical patterns by clicking on the frame
- **BPM Control**: Adjust the tempo by dragging the tab down
- **WebSocket Integration**: Real-time communication with ESP32 sensors
- **Responsive Design**: Works on various screen sizes and devices

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/creatune.git
   cd creatune
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

## Hardware Setup

### Required Hardware
- 3 ESP32 Firebeetle 2 C6 microcontrollers
- DFrobot Soil Moisture Sensor
- DFrobot Light Sensor
- Basic Temperature Sensor

### ESP32 Configuration
1. Flash each ESP32 with the provided firmware (See `/esp32` folder)
2. Connect sensors to the appropriate pins:
   - ESP32-1: Connect soil moisture sensor
   - ESP32-2: Connect light sensor
   - ESP32-3: Connect temperature sensor
3. Power on the ESP32s and ensure they connect to the same network as your server

## State Machine

The application changes its state based on connected ESP32 devices:

| State    | ESP32 Connections      | Background    | Creature  | Synth    |
|----------|------------------------|---------------|-----------|----------|
| Idle     | None                   | earth.png     | None      | None     |
| Soil     | ESP32-1 (Soil)         | soil.png      | Creature1 | Synth1   |
| Light    | ESP32-2 (Light)        | light.png     | Creature2 | Synth2   |
| Temp     | ESP32-3 (Temp)         | temp.png      | Creature3 | Synth3   |
| Growth   | ESP32-1 + ESP32-2      | growth.png    | Creature4 | Synth4   |
| Mirrage  | ESP32-1 + ESP32-3      | mirrage.png   | Creature5 | Synth5   |
| Flower   | ESP32-2 + ESP32-3      | flower.png    | Creature6 | Synth6   |
| Total    | All 3 ESP32s           | total.png     | Creature7 | Synth7   |

Notes:
- Sensors must provide valid data to fully activate a state
- Invalid sensor data will show the background but no creature or synth

## User Interactions

- **Click the frame**: When at least one synth is active and not in BPM mode, this starts recording for 5 seconds
- **Click again during recording**: Cancels the recording
- **Drag the tab down**: Opens the BPM control to adjust tempo
- **Random State button**: For testing, randomly changes the connected sensors and their data
- **Status panel**: Shows the current state and ESP32 connection status

## Project Structure

```
project/
├── index.html                # Main HTML file 
├── css/
│   ├── styles.css            # Original styles for the frame
│   ├── simplified-styles.css # Combined styles for synth and creatures
│   └── state-styles.css      # State-specific styles
├── js/
│   ├── frame-anim.js         # Original frame animation
│   ├── drag-container.js     # Original drag behavior
│   ├── websocket-client.js   # WebSocket communication
│   ├── state-manager.js      # State machine implementation
│   ├── enhanced-synth-logic.js # Enhanced Tone.js synth engine
│   └── enhanced-creatures.js # Enhanced creature management
├── images/
│   ├── creature1.png         # Creature sprite sheets (920×920 px, 3 frames)
│   ├── creature2.png
│   ...
│   ├── soil.png              # Background images for each state
│   ├── light.png
│   ...
├── assets/
│   ├── frame-sprite.png      # Original frame assets
│   ├── tab-top.png
│   └── top-bar-image.png
└── websocket-server.js       # Node.js server with WebSocket support
```

## Development

### Testing without ESP32 Devices
Use the "Random State" button in the bottom right corner to simulate different sensor connections and data.

### Adding New Creatures
1. Create a new sprite sheet (920×920 pixels, 3 frames horizontally)
2. Add the image to the `images/` folder
3. Update the CSS in `state-styles.css` for the new creature
4. Modify the state machine in `state-manager.js` to use the new creature

### Customizing Synths
Modify the `enhanced-synth-logic.js` file to change synth parameters, sequences, and patterns.

## License

MIT License - See LICENSE file for details.

## Credits

- Tone.js - https://tonejs.github.io/
- Node.js WebSocket - https://github.com/websockets/ws
- VT323 Font - Google Fonts