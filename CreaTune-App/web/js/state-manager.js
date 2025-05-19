// state-manager.js
import { STATES, SUB_STATES, ESP_DEVICES } from './constants.js';
import UiManager from './ui-manager.js';
import RecordingManager from './recording-manager.js';
import BpmManager from './bpm-manager.js';
import AudioManager from './audio-manager.js';
import WebSocketClient from './websocket-client.js';

export default class StateManager {
  constructor(readyCallback) {
    this.currentState = STATES.IDLE;
    this.currentSubState = SUB_STATES.NORMAL;
    this.offlineMode = false;
    this.readyCallback = readyCallback;
    
    // Initialize subsystems
    this.uiManager = new UiManager(this);
    this.recordingManager = new RecordingManager(this);
    this.bpmManager = new BpmManager(this);
    this.audioManager = new AudioManager(this);
    this.wsClient = new WebSocketClient(this);
    
    // Initialize state
    this.initialize();
  }

  initialize() {
    // Setup initial UI
    this.uiManager.createDebugUI();
    this.uiManager.createStatusIndicators();
    this.setupEventListeners();
    
    // Initial state update
    this.updateState();
    
    console.log('State Manager initialized');
    
    // Signal readiness (with slight delay to allow UI to render)
    setTimeout(() => {
      if (this.readyCallback) this.readyCallback();
    }, 100);
  }

  setupEventListeners() {
    // WebSocket events
    document.addEventListener('wsWelcome', (e) => {
      console.log('WebSocket welcome:', e.detail.message);
    });
    
    document.addEventListener('espStatus', (e) => {
      this.handleDeviceStatusUpdate(e.detail.devices);
    });
    
    document.addEventListener('espConnected', (e) => {
      this.handleDeviceConnection(e.detail, true);
    });
    
    document.addEventListener('espDisconnected', (e) => {
      this.handleDeviceConnection(e.detail, false);
    });
    
    document.addEventListener('sensorData', (e) => {
      this.handleSensorData(e.detail);
    });
    
    // Window events
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  handleWebSocketStatus(connected) {
    if (connected) {
      this.offlineMode = false;
      console.log('WebSocket connection established');
      this.uiManager.showConnectionStatus(true);
      
      // Request current ESP32 status
      this.wsClient.sendMessage({ type: 'get_esp_status' });
    } else {
      console.log('WebSocket disconnected');
      this.uiManager.showConnectionStatus(false);
      this.updateState();
    }
  }

  setOfflineMode(active) {
    this.offlineMode = active;
    console.log(`Offline mode ${active ? 'activated' : 'deactivated'}`);
    this.uiManager.showOfflineWarning(active);
    this.updateState();
  }

  handleDeviceStatusUpdate(devices) {
    devices.forEach(device => {
      this.handleDeviceConnection({
        espId: device.id,
        name: device.name,
        connected: device.connected
      }, device.connected);
      
      if (device.lastData) {
        this.handleSensorData(device.lastData);
      }
    });
  }

  handleDeviceConnection(data, isConnected) {
    const espId = this.getDeviceId(data.name || data.sensor);
    if (!espId) return;

    const device = ESP_DEVICES[espId];
    device.connected = isConnected;
    
    if (!isConnected) {
      device.valid = false;
      device.value = null;
    }
    
    console.log(`ESP32 ${isConnected ? 'connected' : 'disconnected'}:`, device.name);
    this.updateState();
    
    // Auto-initialize audio when first device connects
    if (isConnected) {
      this.audioManager.autoInitializeAudio();
    }
  }

  handleSensorData(data) {
    const espId = this.getDeviceId(data.sensor);
    if (!espId) return;

    const device = ESP_DEVICES[espId];
    device.value = data.value;
    device.valid = data.value !== undefined && data.value !== null;
    
    // Process for animations
    if (window.spriteAnimation && data.frameIndex !== undefined) {
      window.spriteAnimation.showFrame(data.frameIndex);
    }
    
    this.updateState();
  }

  getDeviceId(name) {
    if (!name) return null;
    name = name.toLowerCase();
    
    for (const [id, device] of Object.entries(ESP_DEVICES)) {
      if (name.includes(device.sensorType) || name.includes(id)) {
        return id;
      }
    }
    return null;
  }

  updateState() {
    // Determine new state based on connected devices
    this.currentState = this.calculateCurrentState();
    
    // Update all visual components
    this.uiManager.updateBackground();
    this.uiManager.updateCreatures();
    this.uiManager.updateSynths();
    this.uiManager.updateStatusIndicators();
    
    // Dispatch state change event
    this.dispatchStateChange();
  }

  calculateCurrentState() {
    const { esp1, esp2, esp3 } = ESP_DEVICES;
    const isValid = (esp) => esp.connected && esp.valid;
    
    if (isValid(esp1) && isValid(esp2) && isValid(esp3)) return STATES.TOTAL;
    if (isValid(esp2) && isValid(esp3)) return STATES.FLOWER;
    if (isValid(esp1) && isValid(esp3)) return STATES.MIRRAGE;
    if (isValid(esp1) && isValid(esp2)) return STATES.GROWTH;
    if (isValid(esp3)) return STATES.TEMP;
    if (isValid(esp2)) return STATES.LIGHT;
    if (isValid(esp1)) return STATES.SOIL;
    return STATES.IDLE;
  }

  dispatchStateChange() {
    const event = new CustomEvent('stateChange', { 
      detail: { 
        state: this.currentState,
        subState: this.currentSubState,
        offlineMode: this.offlineMode,
        espStatus: { ...ESP_DEVICES }
      }
    });
    document.dispatchEvent(event);
  }

  cleanup() {
    // Cleanup recording if active
    if (this.currentSubState === SUB_STATES.RECORD) {
      this.recordingManager.stopRecording();
    }
    
    // Close WebSocket connection
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
    
    console.log('State manager cleanup completed');
  }

  // Public API
  getState() {
    return this.currentState;
  }

  getSubState() {
    return this.currentSubState;
  }

  getEspStatus() {
    return { ...ESP_DEVICES };
  }

  isOffline() {
    return this.offlineMode;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.stateManager = new StateManager(() => {
    document.getElementById('loadingIndicator').style.display = 'none';
  });
});