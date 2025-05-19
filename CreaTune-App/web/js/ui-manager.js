// ui-manager.js
import { STATES } from './constants.js';

export default class UiManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.container = document.getElementById('spriteContainer');
    this.sprite = document.getElementById('sprite');
    this.setupStyles();
  }

  setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .container.recording {
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.7);
        animation: recordingPulse 1s infinite;
      }
      
      @keyframes recordingPulse {
        0% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.7); }
        50% { box-shadow: 0 0 20px rgba(255, 0, 0, 0.9); }
        100% { box-shadow: 0 0 10px rgba(255, 0, 0, 0.7); }
      }
      
      .esp-indicator {
        margin: 5px 0;
        display: flex;
        justify-content: space-between;
      }
      
      .status-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-left: 5px;
      }
      
      #espStatusPanel {
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 1000;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        border-radius: 5px;
        font-family: 'VT323', monospace;
      }
      
      #debugStateButton {
        position: fixed;
        bottom: 10px;
        right: 10px;
        z-index: 1000;
        padding: 8px;
        border-radius: 4px;
        background-color: #333;
        color: white;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';
    document.head.appendChild(fontLink);
  }

  createDebugUI() {
    const button = document.createElement('button');
    button.id = 'debugStateButton';
    button.textContent = 'Random State';
    
    button.addEventListener('click', () => {
      const devices = this.stateManager.espManager.devices;
      Object.values(devices).forEach(device => {
        device.connected = Math.random() > 0.5;
        if (device.connected) {
          device.valid = Math.random() > 0.3;
          device.value = Math.random();
        }
      });
      
      this.stateManager.audioManager.autoInitializeAudio();
      this.stateManager.updateState();
    });
    
    document.body.appendChild(button);
  }

  createStatusIndicators() {
    const statusPanel = document.createElement('div');
    statusPanel.id = 'espStatusPanel';
    
    const stateDisplay = document.createElement('div');
    stateDisplay.id = 'stateDisplay';
    stateDisplay.textContent = `State: ${this.stateManager.currentState.toUpperCase()}`;
    stateDisplay.style.marginBottom = '10px';
    statusPanel.appendChild(stateDisplay);
    
    Object.values(this.stateManager.espManager.devices).forEach(device => {
      const indicator = document.createElement('div');
      indicator.id = `${device.id}Indicator`;
      indicator.className = 'esp-indicator';
      indicator.innerHTML = `
        <span class="esp-name">${device.name}:</span>
        <span class="esp-status">Disconnected</span>
      `;
      
      const statusDot = document.createElement('span');
      statusDot.id = `${device.id}StatusDot`;
      statusDot.className = 'status-dot';
      statusDot.style.backgroundColor = 'red';
      
      indicator.querySelector('.esp-status').appendChild(statusDot);
      statusPanel.appendChild(indicator);
    });
    
    document.body.appendChild(statusPanel);
  }

  updateStatusIndicators() {
    const stateDisplay = document.getElementById('stateDisplay');
    if (stateDisplay) {
      stateDisplay.textContent = `State: ${this.stateManager.currentState.toUpperCase()}`;
    }
    
    Object.values(this.stateManager.espManager.devices).forEach(device => {
      const indicator = document.getElementById(`${device.id}Indicator`);
      const statusDot = document.getElementById(`${device.id}StatusDot`);
      const statusText = indicator?.querySelector('.esp-status');
      
      if (indicator && statusDot && statusText) {
        if (device.connected) {
          if (device.valid) {
            statusDot.style.backgroundColor = 'lime';
            statusText.textContent = 'Valid ';
          } else {
            statusDot.style.backgroundColor = 'orange';
            statusText.textContent = 'Invalid ';
          }
        } else {
          statusDot.style.backgroundColor = 'red';
          statusText.textContent = 'Disconnected ';
        }
        statusText.appendChild(statusDot);
      }
    });
  }

  updateBackground() {
    Object.values(STATES).forEach(state => {
      this.sprite.classList.remove(`state-${state}`);
    });
    
    this.sprite.classList.add(`state-${this.stateManager.currentState}`);
    
    if (!window.spriteAnimation?.isRunning()) {
      const frameIndex = this.getFrameIndexForState();
      this.showSpriteFrame(frameIndex);
    }
  }

  getFrameIndexForState() {
    switch (this.stateManager.currentState) {
      case STATES.IDLE:    return 0;
      case STATES.SOIL:    return 1;
      case STATES.LIGHT:   return 2;
      case STATES.TEMP:    return 3;
      case STATES.GROWTH:  return 4;
      case STATES.MIRRAGE: return 5;
      case STATES.FLOWER:  return 6;
      case STATES.TOTAL:   return 7;
      default:             return 0;
    }
  }

  showSpriteFrame(frameIndex) {
    if (window.spriteAnimation?.showFrame) {
      window.spriteAnimation.showFrame(frameIndex);
    } else {
      const row = Math.floor(frameIndex / 3);
      const col = frameIndex % 3;
      this.sprite.style.backgroundPosition = `${col * 50}% ${row * 33.33}%`;
    }
  }

  updateCreatures() {
    const isValid = (espId) => {
      const device = this.stateManager.espManager.devices[espId];
      return device.connected && device.valid;
    };
    
    // Hide all creatures first
    if (window.creatureManager) {
      for (let i = 1; i <= 7; i++) {
        window.creatureManager.stopAnimation(`creature${i}`);
      }
    }
    
    // Show appropriate creature
    if (window.creatureManager) {
      switch (this.stateManager.currentState) {
        case STATES.SOIL:
          if (isValid('esp1')) window.creatureManager.animate('creature1');
          break;
        case STATES.LIGHT:
          if (isValid('esp2')) window.creatureManager.animate('creature2');
          break;
        case STATES.TEMP:
          if (isValid('esp3')) window.creatureManager.animate('creature3');
          break;
        case STATES.GROWTH:
          if (isValid('esp1') && isValid('esp2')) window.creatureManager.animate('creature4');
          break;
        case STATES.MIRRAGE:
          if (isValid('esp1') && isValid('esp3')) window.creatureManager.animate('creature5');
          break;
        case STATES.FLOWER:
          if (isValid('esp2') && isValid('esp3')) window.creatureManager.animate('creature6');
          break;
        case STATES.TOTAL:
          if (isValid('esp1') && isValid('esp2') && isValid('esp3')) window.creatureManager.animate('creature7');
          break;
      }
    }
  }

  updateSynths() {
    const isValid = (espId) => {
      const device = this.stateManager.espManager.devices[espId];
      return device.connected && device.valid;
    };
    
    if (window.synthEngine) {
      // Reset all synths
      window.synthEngine.setButtonState(1, false);
      window.synthEngine.setButtonState(2, false);
      window.synthEngine.setButtonState(3, false);
      
      // Activate based on state
      switch (this.stateManager.currentState) {
        case STATES.SOIL:
          if (isValid('esp1')) window.synthEngine.setButtonState(1, true);
          break;
        case STATES.LIGHT:
          if (isValid('esp2')) window.synthEngine.setButtonState(2, true);
          break;
        case STATES.TEMP:
          if (isValid('esp3')) window.synthEngine.setButtonState(3, true);
          break;
        case STATES.GROWTH:
          if (isValid('esp1') && isValid('esp2')) {
            window.synthEngine.setButtonState(1, true);
            window.synthEngine.setButtonState(2, true);
          }
          break;
        case STATES.MIRRAGE:
          if (isValid('esp1') && isValid('esp3')) {
            window.synthEngine.setButtonState(1, true);
            window.synthEngine.setButtonState(3, true);
          }
          break;
        case STATES.FLOWER:
          if (isValid('esp2') && isValid('esp3')) {
            window.synthEngine.setButtonState(2, true);
            window.synthEngine.setButtonState(3, true);
          }
          break;
        case STATES.TOTAL:
          if (isValid('esp1') && isValid('esp2') && isValid('esp3')) {
            window.synthEngine.setButtonState(1, true);
            window.synthEngine.setButtonState(2, true);
            window.synthEngine.setButtonState(3, true);
          }
          break;
      }
      
      if (window.synthUI) {
        window.synthUI.updateVisuals();
      }
    }
  }
}