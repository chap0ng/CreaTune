// soil.js
class SoilHandler {
  constructor() {
    this.isActive = false;
    this.currentMoistureValue = 0;
    this.esp32Connected = false;
    
    // Audio components
    this.soilSynth = null;
    this.soilFilter = null;
    this.soilReverb = null;
    this.soilGain = null;
    
    // UI elements
    this.frameBackground = document.querySelector('.framebackground');
    this.soilCreature = document.querySelector('.soil-creature');
    
    this.init();
  }

  async init() {
    console.log('🌱 Soil Handler initializing...');
    this.initializeToneJS();
    this.setupEventListeners();
    console.log('🌱 Soil Handler ready');
  }

  setupEventListeners() {
    document.addEventListener('click', this.startAudioContext.bind(this), { once: true });
    document.addEventListener('websocket-connected', () => {
      this.esp32Connected = true;
      console.log('🌱 ESP32 connected');
    });
    document.addEventListener('websocket-disconnected', () => {
      this.esp32Connected = false;
      if (this.isActive) this.deactivateSoilState();
    });
    document.addEventListener('app-state-change', (e) => {
      if (e.detail.isActive) this.activateSoilState();
      else this.deactivateSoilState();
    });
    document.addEventListener('sensor-data', (e) => {
      this.handleSensorData(e.detail);
    });
  }

  handleSensorData(data) {
    if (data.sensor !== 'MoistureSensor') return;
    
    this.currentMoistureValue = data.moisture_app_value;
    
    if (this.isActive) {
      this.updateSoilAudio(data.moisture_app_value, data.soil_condition);
    }
  }

  // ... (keep all the existing audio and UI methods from your original soil.js)
}

document.addEventListener('DOMContentLoaded', () => {
  window.SoilHandler = new SoilHandler();
});