// background-manager-fix.js
// Background management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  console.log('BackgroundManager initializing...');
  
  // Import configuration
  const { STATES, getStateBackgroundUrl } = window.CreaTuneConfig || {
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
    getStateBackgroundUrl: function(state) {
      return `images/${state}.png`;
    }
  };

  // DOM elements
  const sprite = document.getElementById('sprite');
  
  // Update background based on current state
  function updateBackground(currentState) {
    if (!sprite) {
      console.error('Sprite element not found!');
      return;
    }
    
    console.log(`Updating background for state: ${currentState}`);
    
    // Remove all state classes first
    Object.values(STATES).forEach(state => {
      sprite.classList.remove(`state-${state}`);
    });
    
    // Add current state class
    sprite.classList.add(`state-${currentState}`);
    sprite.classList.remove('no-image');
    
    // Check if image exists, otherwise add fallback class
    const imgUrl = getStateBackgroundUrl(currentState);
    console.log(`Using background image: ${imgUrl}`);
    
    checkImageExists(imgUrl, function(exists) {
      if (!exists) {
        console.log(`Image not found: ${imgUrl}, using fallback`);
        sprite.classList.add('no-image');
      }
    });
    
    // Only change the background position if the sprite animation is not running
    if (!window.spriteAnimation || !window.spriteAnimation.isRunning()) {
      updateBackgroundFrame(currentState);
    }
  }
  
  // Update background frame based on state
  function updateBackgroundFrame(state) {
    console.log(`Updating background frame for state: ${state}`);
    
    // Select the appropriate sprite frame
    let frameIndex = 0;
    
    switch (state) {
      case STATES.IDLE:    frameIndex = 0; break;
      case STATES.SOIL:    frameIndex = 1; break;
      case STATES.LIGHT:   frameIndex = 2; break;
      case STATES.TEMP:    frameIndex = 3; break;
      case STATES.GROWTH:  frameIndex = 4; break;
      case STATES.MIRRAGE: frameIndex = 5; break;
      case STATES.FLOWER:  frameIndex = 6; break;
      case STATES.TOTAL:   frameIndex = 7; break;
    }
    
    // Use sprite animation if available
    if (window.spriteAnimation && window.spriteAnimation.showFrame) {
      window.spriteAnimation.showFrame(frameIndex);
    } else {
      // Otherwise use our own implementation
      showFrame(frameIndex);
    }
  }
  
  // Show a specific frame
  function showFrame(frameIndex) {
    if (!sprite) {
      console.error('Sprite element not found!');
      return;
    }
    
    console.log(`Showing frame: ${frameIndex}`);
    
    const columns = 3; // Assuming 3 columns in sprite sheet
    const row = Math.floor(frameIndex / columns);
    const col = frameIndex % columns;
    
    // Apply the background position
    sprite.style.backgroundPosition = `${col * 50}% ${row * 33.33}%`;
    
    // Also set a background image if needed
    if (!sprite.style.backgroundImage) {
      const imgUrl = 'assets/frame-sprite.png';
      sprite.style.backgroundImage = `url('${imgUrl}')`;
    }
  }
  
  // Check if an image exists
  function checkImageExists(url, callback) {
    const img = new Image();
    img.onload = function() {
      callback(true);
    };
    img.onerror = function() {
      callback(false);
    };
    img.src = url;
  }
  
  // Set background image directly
  function setBackgroundImage(url) {
    if (!sprite) {
      console.error('Sprite element not found!');
      return;
    }
    
    console.log(`Setting background image: ${url}`);
    
    // Set the background image
    sprite.style.backgroundImage = `url('${url}')`;
    
    // Check if image exists
    checkImageExists(url, function(exists) {
      if (!exists) {
        console.log(`Image not found: ${url}, using fallback`);
        sprite.classList.add('no-image');
        sprite.style.backgroundImage = '';
      } else {
        sprite.classList.remove('no-image');
      }
    });
  }
  
  // Force update background for current state
  function forceUpdateBackground() {
    if (window.StateManager && window.StateManager.getState) {
      const currentState = window.StateManager.getState();
      updateBackground(currentState);
    } else {
      console.warn('StateManager not available for background update');
    }
  }
  
  // Initialize
  function initialize() {
    console.log('Initializing BackgroundManager...');
    
    // Listen for state changes
    if (window.EventBus) {
      window.EventBus.subscribe('stateChanged', (data) => {
        if (data && data.state) {
          updateBackground(data.state);
        }
      });
      
      // Listen for app initialization
      window.EventBus.subscribe('appInitialized', () => {
        console.log('App initialized, ensuring background is set');
        setTimeout(forceUpdateBackground, 500);
      });
    } else {
      console.error('EventBus not available for BackgroundManager');
    }
    
    // Set initial background
    if (window.StateManager && window.StateManager.getState) {
      const currentState = window.StateManager.getState();
      updateBackground(currentState);
    } else {
      // Default to idle state if no state manager
      updateBackground(STATES.IDLE);
    }
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.BackgroundManager = {
    updateBackground,
    updateBackgroundFrame,
    showFrame,
    checkImageExists,
    setBackgroundImage,
    forceUpdateBackground
  };
  
  console.log('BackgroundManager initialized and exported to window');
});
