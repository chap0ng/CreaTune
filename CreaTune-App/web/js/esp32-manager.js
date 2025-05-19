// esp32-manager.js
import { STATES, ESP_DEVICES } from './constants.js';

export default class Esp32Manager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.devices = {
      esp1: { ...ESP_DEVICES.ESP1, connected: false, valid: false, value: null },
      esp2: { ...ESP_DEVICES.ESP2, connected: false, valid: false, value: null },
      esp3: { ...ESP_DEVICES.ESP3, connected: false, valid: false, value: null }
    };
  }

  handleDeviceMessage(data) {
    if (data.sensor) {
      this.handleSensorData(data);
    } else if (data.type === 'esp_connected') {
      this.handleDeviceConnection(data, true);
    } else if (data.type === 'esp_disconnected') {
      this.handleDeviceConnection(data, false);
    }
  }

  handleSensorData(data) {
    const espId = this.getDeviceId(data.sensor || data.name);
    if (!espId) return;

    this.devices[espId].connected = true;
    this.devices[espId].value = data.value;
    this.devices[espId].valid = data.value !== undefined && data.value !== null;
    
    if (this.devices[espId].valid) {
      this.stateManager.audioManager.autoInitializeAudio();
    }
  }

  handleDeviceConnection(data, isConnected) {
    const espId = this.getDeviceId(data.name);
    if (!espId) return;

    this.devices[espId].connected = isConnected;
    if (isConnected) {
      this.devices[espId].name = data.name;
      this.stateManager.audioManager.autoInitializeAudio();
    } else {
      this.devices[espId].valid = false;
      this.devices[espId].value = null;
    }
  }

  getDeviceId(name) {
    if (!name) return null;
    name = name.toLowerCase();
    
    if (name.includes('soil') || name.includes('esp32-1')) return 'esp1';
    if (name.includes('light') || name.includes('esp32-2')) return 'esp2';
    if (name.includes('temp') || name.includes('esp32-3')) return 'esp3';
    return null;
  }

  determineState() {
    const { esp1, esp2, esp3 } = this.devices;
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

  getStatus() {
    return { ...this.devices };
  }

  getConnectedDevices() {
    return Object.values(this.devices).filter(device => device.connected);
  }
}