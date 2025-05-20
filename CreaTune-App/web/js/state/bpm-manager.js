// bpm-manager.js
// BPM management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  console.log('BPM Manager initializing...');
  
  // Import configuration
  const { AUDIO, SUB_STATES, UI } = window.CreaTuneConfig || {
    AUDIO: { MIN_BPM: 60, MAX_BPM: 180, DEFAULT_BPM: 85 },
    SUB_STATES: { NORMAL: 'normal', BPM: 'bpm', RECORD: 'record' },
    UI: { TAB_HEIGHT: 500 }
  };
  
  // Element references
  let sliderContainer = null;
  let bpmValue = null;
  let slider = null;
  
  // Setup BPM state
  function setupBpmState() {
    console.log('Setting up BPM state...');
    
    // Listen for tab changes from drag-container.js
    if (window.dragContainer) {
      hookIntoDragContainer();
    } else {
      // If dragContainer isn't available yet, wait for it
      console.log('Waiting for dragContainer...');
      const checkInterval = setInterval(() => {
        if (window.dragContainer) {
          console.log('dragContainer found, hooking in');
          hookIntoDragContainer();
          clearInterval(checkInterval);
        }
      }, 200);
    }
  }
  
  // Hook into drag container for BPM control
  function hookIntoDragContainer() {
    console.log('Hooking into dragContainer...');
    
    // Store original methods
    const originalIsTabOpen = window.dragContainer.isTabOpen;
    const originalGetPercentage = window.dragContainer.getTabOpenPercentage;
    
    // Override isTabOpen method
    window.dragContainer.isTabOpen = function() {
      const tabOpen = typeof originalIsTabOpen === 'function' 
        ? originalIsTabOpen.call(window.dragContainer)
        : false;
      
      // Only update state if we need to change it
      if (tabOpen && window.StateManager && window.StateManager.getSubState) {
        const currentSubState = window.StateManager.getSubState();
        if (currentSubState !== SUB_STATES.BPM) {
          console.log('Tab opened, setting BPM state');
          window.StateManager.setSubState('BPM');
          createBpmDisplay();
        }
      } else if (!tabOpen && window.StateManager && window.StateManager.getSubState) {
        const currentSubState = window.StateManager.getSubState();
        if (currentSubState === SUB_STATES.BPM) {
          console.log('Tab closed, resetting to NORMAL state');
          window.StateManager.setSubState('NORMAL');
          hideBpmDisplay();
        }
      }
      
      return tabOpen;
    };
    
    // Override getPercentage method
    window.dragContainer.getTabOpenPercentage = function() {
      const percentage = typeof originalGetPercentage === 'function'
        ? originalGetPercentage.call(window.dragContainer)
        : 0.5;
      
      // Update BPM based on percentage if in BPM state
      if (window.StateManager && window.StateManager.getSubState && 
          window.StateManager.getSubState() === SUB_STATES.BPM) {
        updateBPM(percentage);
      }
      
      return percentage;
    };
    
    // Hook into the tab notification methods from sprite animation
    if (window.spriteAnimation) {
      if (!window.spriteAnimation.onTabClosed) {
        window.spriteAnimation.onTabClosed = function() {
          console.log('Tab closed event from spriteAnimation');
          if (window.StateManager && window.StateManager.setSubState) {
            window.StateManager.setSubState('NORMAL');
          }
          hideBpmDisplay();
        };
      }
      
      if (!window.spriteAnimation.onTabFullyOpen) {
        window.spriteAnimation.onTabFullyOpen = function() {
          console.log('Tab fully open event from spriteAnimation');
          if (window.StateManager && window.StateManager.setSubState) {
            window.StateManager.setSubState('BPM');
          }
          createBpmDisplay();
        };
      }
      
      if (!window.spriteAnimation.onTabPartiallyOpen) {
        window.spriteAnimation.onTabPartiallyOpen = function(percentage) {
          console.log('Tab partially open event from spriteAnimation');
          if (window.StateManager && window.StateManager.setSubState) {
            window.StateManager.setSubState('BPM');
          }
          createBpmDisplay();
          updateBPM(percentage);
        };
      }
    }
    
    console.log('BPM hooks installed successfully');
  }
  
  // Create BPM display
  function createBpmDisplay() {
    console.log('Creating BPM display...');
    
    // Remove existing BPM display if it exists
    const existingDisplay = document.getElementById('bpmSliderContainer');
    if (existingDisplay) {
      existingDisplay.style.display = 'block';
      return;
    }
    
    const container = document.getElementById('spriteContainer');
    if (!container) {
      console.error('Container element not found!');
      return;
    }
    
    // Create slider container
    sliderContainer = document.createElement('div');
    sliderContainer.id = 'bpmSliderContainer';
    sliderContainer.className = 'bpm-slider-container';
    
    // Add styles directly to ensure visibility
    sliderContainer.style.position = 'absolute';
    sliderContainer.style.top = '50%';
    sliderContainer.style.left = '50%';
    sliderContainer.style.transform = 'translate(-50%, -50%)';
    sliderContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    sliderContainer.style.padding = '20px';
    sliderContainer.style.borderRadius = '10px';
    sliderContainer.style.zIndex = '1000';
    sliderContainer.style.display = 'flex';
    sliderContainer.style.flexDirection = 'column';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.width = '80%';
    sliderContainer.style.maxWidth = '300px';
    
    // Create BPM value display
    bpmValue = document.createElement('div');
    bpmValue.id = 'bpmValue';
    bpmValue.className = 'bpm-value';
    bpmValue.textContent = `BPM: ${AUDIO.DEFAULT_BPM}`;
    bpmValue.style.fontSize = '24px';
    bpmValue.style.fontFamily = 'VT323, monospace';
    bpmValue.style.color = 'white';
    bpmValue.style.marginBottom = '10px';
    
    // Create slider input
    slider = document.createElement('input');
    slider.id = 'bpmSlider';
    slider.className = 'bpm-slider';
    slider.type = 'range';
    slider.min = AUDIO.MIN_BPM.toString();
    slider.max = AUDIO.MAX_BPM.toString();
    slider.value = AUDIO.DEFAULT_BPM.toString();
    slider.style.width = '100%';
    slider.style.height = '20px';
    
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
    
    console.log('BPM display created successfully');
  }
  
  // Hide BPM display
  function hideBpmDisplay() {
    console.log('Hiding BPM display...');
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
      console.log(`Setting BPM to ${bpm} via SynthEngine`);
      return window.SynthEngine.setBPM(bpm);
    }
    // Otherwise try direct method if available
    else if (window.Tone && window.Tone.Transport) {
      console.log(`Setting BPM to ${bpm} via Tone.Transport`);
      window.Tone.Transport.bpm.value = bpm;
      return true;
    }
    console.warn('Could not update BPM - no Tone.js or SynthEngine available');
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
    console.log('Initializing BPM Manager...');
    setupBpmState();
    
    // Listen for state changes
    if (window.EventBus) {
      window.EventBus.subscribe('subStateChanged', (data) => {
        console.log('SubState changed:', data);
        if (data.subState === SUB_STATES.BPM) {
          createBpmDisplay();
        } else {
          hideBpmDisplay();
        }
      });
      
      // Listen for app initialization
      window.EventBus.subscribe('appInitialized', () => {
        console.log('App initialized, ensuring BPM Manager is ready');
        setTimeout(() => {
          // Create the BPM display if tab is open
          if (window.dragContainer && window.dragContainer.isTabOpen()) {
            createBpmDisplay();
          }
        }, 500);
      });
    } else {
      console.error('EventBus not available for BPM Manager initialization');
    }
  }
  
  // Initialize BPM manager
  initialize();
  
  // Expose API
  window.BPMManager = {
    getCurrentBPM,
    updateBPM,
    createBpmDisplay,
    hideBpmDisplay,
    // Debug method to force create display
    forceCreateDisplay: () => {
      console.log('Forcing BPM display creation');
      createBpmDisplay();
    }
  };
  
  console.log('BPM Manager initialized');
});
