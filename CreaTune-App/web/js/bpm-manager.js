// bpm-manager.js
export default class BpmManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.setupBpmControls();
  }

  setupBpmControls() {
    if (window.dragContainer) {
      const originalIsTabOpen = window.dragContainer.isTabOpen;
      
      window.dragContainer.isTabOpen = function() {
        const tabOpen = originalIsTabOpen.call(window.dragContainer);
        
        if (tabOpen && this.stateManager.currentSubState !== SUB_STATES.BPM) {
          this.stateManager.currentSubState = SUB_STATES.BPM;
          this.createBpmDisplay();
        } else if (!tabOpen && this.stateManager.currentSubState === SUB_STATES.BPM) {
          this.stateManager.currentSubState = SUB_STATES.NORMAL;
          const sliderContainer = document.getElementById('bpmSliderContainer');
          if (sliderContainer) sliderContainer.style.display = 'none';
        }
        
        return tabOpen;
      }.bind(this);
      
      const originalGetPercentage = window.dragContainer.getTabOpenPercentage;
      
      window.dragContainer.getTabOpenPercentage = function() {
        const percentage = originalGetPercentage.call(window.dragContainer);
        
        if (this.stateManager.currentSubState === SUB_STATES.BPM) {
          this.updateBPM(percentage);
        }
        
        return percentage;
      }.bind(this);
      
      if (!window.spriteAnimation.onTabClosed) {
        window.spriteAnimation.onTabClosed = function() {
          this.stateManager.currentSubState = SUB_STATES.NORMAL;
          const sliderContainer = document.getElementById('bpmSliderContainer');
          if (sliderContainer) sliderContainer.style.display = 'none';
        }.bind(this);
      }
      
      if (!window.spriteAnimation.onTabFullyOpen) {
        window.spriteAnimation.onTabFullyOpen = function() {
          this.stateManager.currentSubState = SUB_STATES.BPM;
          this.createBpmDisplay();
        }.bind(this);
      }
      
      if (!window.spriteAnimation.onTabPartiallyOpen) {
        window.spriteAnimation.onTabPartiallyOpen = function(percentage) {
          this.stateManager.currentSubState = SUB_STATES.BPM;
          this.createBpmDisplay();
          this.updateBPM(percentage);
        }.bind(this);
      }
    }
  }

  createBpmDisplay() {
    const existingDisplay = document.getElementById('bpmSliderContainer');
    if (existingDisplay) {
      existingDisplay.style.display = 'block';
      return;
    }
    
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'bpmSliderContainer';
    sliderContainer.className = 'bpm-slider-container';
    sliderContainer.style.position = 'absolute';
    sliderContainer.style.bottom = '20px';
    sliderContainer.style.left = '50%';
    sliderContainer.style.transform = 'translateX(-50%)';
    sliderContainer.style.width = '80%';
    sliderContainer.style.zIndex = '1000';
    
    const bpmValue = document.createElement('div');
    bpmValue.id = 'bpmValue';
    bpmValue.className = 'bpm-value';
    bpmValue.textContent = 'BPM: 85';
    bpmValue.style.color = 'white';
    bpmValue.style.fontFamily = 'VT323, monospace';
    bpmValue.style.textAlign = 'center';
    bpmValue.style.marginBottom = '10px';
    
    const slider = document.createElement('input');
    slider.id = 'bpmSlider';
    slider.className = 'bpm-slider';
    slider.type = 'range';
    slider.min = '60';
    slider.max = '180';
    slider.value = '85';
    slider.style.width = '100%';
    
    slider.addEventListener('input', function() {
      const bpm = parseInt(this.value);
      bpmValue.textContent = `BPM: ${bpm}`;
      this.setBPM(bpm);
    }.bind(this));
    
    sliderContainer.appendChild(bpmValue);
    sliderContainer.appendChild(slider);
    this.stateManager.uiManager.container.appendChild(sliderContainer);
    
    const percentage = window.dragContainer ? window.dragContainer.getTabOpenPercentage() : 0.5;
    this.updateBPM(percentage);
  }

  updateBPM(percentage) {
    const minBPM = 60;
    const maxBPM = 180;
    const bpm = Math.round(minBPM + (percentage * (maxBPM - minBPM)));
    
    const slider = document.getElementById('bpmSlider');
    const bpmValue = document.getElementById('bpmValue');
    
    if (slider) slider.value = bpm;
    if (bpmValue) bpmValue.textContent = `BPM: ${bpm}`;
    
    this.setBPM(bpm);
  }

  setBPM(bpm) {
    if (window.synthEngine?.setBPM) {
      window.synthEngine.setBPM(bpm);
    } else if (window.Tone?.Transport) {
      window.Tone.Transport.bpm.value = bpm;
    }
  }
}