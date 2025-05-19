// bpm-manager.js
// BPM management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { AUDIO, SUB_STATES, UI } = window.CreaTuneConfig;
  
  // Element references
  let sliderContainer = null;
  let bpmValue = null;
  let slider = null;
  
  // Setup BPM state
  function setupBpmState() {
    // Listen for tab changes from drag-container.js
    if (window.dragContainer) {
      hookIntoDragContainer();
    } else {
      // If dragContainer isn't available yet, wait for it
      const checkInterval = setInterval(() => {
        if (window.dragContainer) {
          hookIntoDragContainer();
          clearInterval(checkInterval);
        }
      }, 200);
    }
  }
  
  // Hook into drag container for BPM control
  function hookIntoDragContainer() {
    const originalIsTabOpen = window.dragContainer.isTabOpen;
    
    window.dragContainer.isTabOpen = function() {
      const tabOpen = originalIsTabOpen.call(window.dragContainer);
      
      // Only update state if we need to change it
      if (tabOpen && window.StateManager && window.StateManager.getSubState() !== SUB_STATES.BPM) {
        window.StateManager.setSubState('BPM');
        createBpmDisplay();
      } else if (!tabOpen && window.StateManager && window.StateManager.getSubState() === SUB_STATES.BPM) {
        window.StateManager.setSubState('NORMAL');
        hideBpmDisplay();
      }
      
      return tabOpen;
    };
    
    // Also hook into the percentage function to update BPM
    const originalGetPercentage = window.dragContainer.getTabOpenPercentage;
    
    window.dragContainer.getTabOpenPercentage = function() {
      const percentage = originalGetPercentage.call(window.dragContainer);
      
      if (window.StateManager && window.StateManager.getSubState() === SUB_STATES.BPM) {
        updateBPM(percentage);
      }
      
      return percentage;
    };
    
    // Hook into the tab notification methods from sprite animation
    if (window.spriteAnimation) {
      if (!window.spriteAnimation.onTabClosed) {
        window.spriteAnimation.onTabClosed = function() {
          if (window.StateManager) {
            window.StateManager.setSubState('NORMAL');
          }
          hideBpmDisplay();
        };
      }
      
      if (!window.spriteAnimation.onTabFullyOpen) {
        window.spriteAnimation.onTabFullyOpen = function() {
          if (window.StateManager) {
            window.StateManager.setSubState('BPM');
          }
          createBpmDisplay();
        };
      }
      
      if (!window.spriteAnimation.onTabPartiallyOpen) {
        window.spriteAnimation.onTabPartiallyOpen = function(percentage) {
          if (window.StateManager) {
            window.StateManager.setSubState('BPM');
          }
          createBpmDisplay();
          updateBPM(percentage);
        };
      }
    }
  }
  
  // Create BPM display
  function createBpmDisplay() {
    // Remove existing BPM display if it exists
    const existingDisplay = document.getElementById('bpmSliderContainer');
    if (existingDisplay) {
      existingDisplay.style.display = 'block';
      return;
    }
    
    const container = document.getElementById('spriteContainer');
    if (!container) return;
    
    // Create slider container
    sliderContainer = document.createElement('div');
    sliderContainer.id = 'bpmSliderContainer';
    sliderContainer.className = 'bpm-slider-container';
    
    // Create BPM value display
    bpmValue = document.createElement('div');
    bpmValue.id = 'bpmValue';
    bpmValue.className = 'bpm-value';
    bpmValue.textContent = `BPM: ${AUDIO.DEFAULT_BPM}`;
    
    // Create slider input
    slider = document.createElement('input');
    slider.id = 'bpmSlider';
    slider.className = 'bpm-slider';
    slider.type = 'range';
    slider.min = AUDIO.MIN_BPM.toString();
    slider.max = AUDIO.MAX_BPM.toString();
    slider.value = AUDIO.DEFAULT_BPM.toString();
    
    // Add input event listener
    slider.addEventListener('input', function() {
      const bpm = parseInt(this.value);
      bpmValue.textContent = `BPM: ${bpm}`;
      
      // Update Tone.js
      updateToneBPM(bpm);
    });
    
    // Add elements to container
    sliderContainer.appendChild(bpmValue);
    sliderContainer.appendChild(slider);
    
    // Add container to DOM
    container.appendChild(sliderContainer);
    
    // Update initial value based on current position
    const percentage = window.dragContainer ? window.dragContainer.getTabOpenPercentage() : 0.5;
    updateBPM(percentage);
  }
  
  // Hide BPM display
  function hideBpmDisplay() {
    const sliderContainer = document.getElementById('bpmSliderContainer');
    if (sliderContainer) {
      sliderContainer.style.display = 'none';
    }
  }
  
  // Update BPM based on tab position
  function updateBPM(percentage) {
    // Calculate BPM between min-max based on percentage
    const bpm = Math.round(AUDIO.MIN_BPM + (percentage * (AUDIO.MAX_BPM - AUDIO.MIN_BPM)));
    
    // Update slider and display
    const slider = document.getElementById('bpmSlider');
    const bpmValue = document.getElementById('bpmValue');
    
    if (slider) {
      slider.value = bpm;
    }
    
    if (bpmValue) {
      bpmValue.textContent = `BPM: ${bpm}`;
    }
    
    // Update Tone.js
    updateToneBPM(bpm);
  }
  
  // Update Tone.js BPM
  function updateToneBPM(bpm) {
    // Update through SynthEngine API if available
    if (window.SynthEngine && window.SynthEngine.setBPM) {
      window.SynthEngine.setBPM(bpm);
      return true;
    }
    // Otherwise try direct method if available
    else if (window.Tone && window.Tone.Transport) {
      window.Tone.Transport.bpm.value = bpm;
      return true;
    }
    return false;
  }
  
  // Get current BPM
  function getCurrentBPM() {
    if (window.Tone && window.Tone.Transport) {
      return window.Tone.Transport.bpm.value;
    }
    return AUDIO.DEFAULT_BPM;
  }
  
  // Initialize BPM Manager
  function initialize() {
    setupBpmState();
    
    // Listen for state changes
    EventBus.subscribe('subStateChanged', (data) => {
      if (data.subState === SUB_STATES.BPM) {
        createBpmDisplay();
      } else {
        hideBpmDisplay();
      }
    });
  }
  
  // Initialize BPM manager
  initialize();
  
  // Expose API
  window.BPMManager = {
    getCurrentBPM,
    updateBPM,
    createBpmDisplay,
    hideBpmDisplay
  };
});
