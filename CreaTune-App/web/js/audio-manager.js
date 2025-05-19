// audio-manager.js
export default class AudioManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.isInitialized = false;
  }

  autoInitializeAudio() {
    if (this.isInitialized) return;
    
    const anyEspConnected = this.stateManager.espManager.getConnectedDevices().length > 0;
    
    if (anyEspConnected && window.synthEngine && !window.synthEngine.isInitialized()) {
      console.log('Auto-initializing audio due to ESP32 connection');
      
      window.synthEngine.init((status) => {
        if (status === 'Audio initialized') {
          this.isInitialized = true;
          this.showStatusMessage(status);
        } else {
          this.showStatusMessage(status);
        }
      });
    }
  }

  showStatusMessage(message) {
    let statusEl = document.getElementById('autoInitStatus');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'autoInitStatus';
      statusEl.style.position = 'fixed';
      statusEl.style.bottom = '20px';
      statusEl.style.left = '0';
      statusEl.style.width = '100%';
      statusEl.style.textAlign = 'center';
      statusEl.style.color = 'white';
      statusEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      statusEl.style.padding = '10px';
      statusEl.style.zIndex = '1000';
      statusEl.style.fontFamily = 'VT323, monospace';
      document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = message;
    
    if (message === 'Audio initialized') {
      setTimeout(() => {
        if (statusEl.parentNode) {
          statusEl.parentNode.removeChild(statusEl);
        }
      }, 2000);
    }
  }

  silenceSynths(shouldSilence) {
    if (window.synthEngine) {
      window.synthEngine.silenceSynths(shouldSilence);
    }
  }
}