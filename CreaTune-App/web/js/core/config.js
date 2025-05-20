// config.js
// Central configuration file for CreaTune application

const CreaTuneConfig = {
  // Application states
  STATES: {
    IDLE: 'idle',
    SOIL: 'soil',
    LIGHT: 'light',
    TEMP: 'temp',
    GROWTH: 'growth',
    MIRRAGE: 'mirrage',
    FLOWER: 'flower',
    TOTAL: 'total'
  },

  // Sub-states
  SUB_STATES: {
    NORMAL: 'normal',
    RECORD: 'record',
    BPM: 'bpm'
  },

// ESP32 device configuration
ESP32: {
  ESP1: {
    name: 'ESP32-1',
    sensor: 'soil',
    description: 'DFrobot Soil Moisture Sensor',
    validRange: { min: 0.4, max: 0.8 }
  },
  ESP2: {
    name: 'ESP32-2',
    sensor: 'light',
    description: 'DFrobot Light Sensor',
    validRange: { min: 0.4, max: 0.8 }
  },
  ESP3: {
    name: 'ESP32-3',
    sensor: 'temperature',
    description: 'Basic Temperature Sensor',
    validRange: { min: 0.4, max: 0.8 }
  }
},

  // WebSocket configuration
  WEBSOCKET: {
    RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 5000,
    TIMEOUT: 10000
  },

  // Audio parameters
  AUDIO: {
    BASE_VOLUME: -8,
    MIN_BPM: 60,
    MAX_BPM: 180,
    DEFAULT_BPM: 85
  },

  // Recording parameters
  RECORDING: {
    DURATION: 5000, // 5 seconds
    THRESHOLD: 40, // Sound detection threshold
    PEAK_DELAY: 300, // Minimum ms between peaks
  },

  // UI configuration
  UI: {
    TAB_HEIGHT: 500,
    HANDLE_HEIGHT: 30,
    SNAP_THRESHOLD: 30,
    ANIMATION_DURATION: 5000,
    SPRITE_COLUMNS: 3,
    SPRITE_ROWS: 4,
    FRAME_RATE: 12 // Frames per second
  },

  // Get state background URL - using direct state references to avoid 'this' binding issues
  getStateBackgroundUrl: function(state) {
    // Use direct references to STATES instead of this.STATES
    const STATES = CreaTuneConfig.STATES;
    
    switch(state) {
      case STATES.IDLE:
        return 'assets/frame-sprite.png'; // Default background
      case STATES.SOIL:
        return 'images/soil.png';
      case STATES.LIGHT:
        return 'images/light.png';
      case STATES.TEMP:
        return 'images/temp.png';
      case STATES.GROWTH:
        return 'images/growth.png';
      case STATES.MIRRAGE:
        return 'images/mirrage.png';
      case STATES.FLOWER:
        return 'images/flower.png';
      case STATES.TOTAL:
        return 'images/total.png';
      default:
        return 'assets/frame-sprite.png';
    }
  }
};

// Make config immutable to prevent accidental changes
Object.freeze(CreaTuneConfig);

// Export for use in modules
window.CreaTuneConfig = CreaTuneConfig;

// Log configuration loaded
console.log('CreaTune configuration loaded');
