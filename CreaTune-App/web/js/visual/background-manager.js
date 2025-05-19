// background-manager.js
// Background management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { STATES, getStateBackgroundUrl } = window.CreaTuneConfig;

  // DOM elements
  const sprite = document.getElementById('sprite');
  
  // Update background based on current state
  function updateBackground(currentState) {
    if (!sprite) return;
    
    // Remove all state classes first
    Object.values(STATES).forEach(state => {
      sprite.classList.remove(`state-${state}`);
    });
    
    // Add current state class
    sprite.classList.add(`state-${currentState}`);
    sprite.classList.remove('no-image');
    
    // Check if image exists, otherwise add fallback class
    const imgUrl = getStateBackgroundUrl(currentState);
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
    if (!sprite) return;
    
    const columns = 3; // Assuming 3 columns in sprite sheet
    const row = Math.floor(frameIndex / columns);
    const col = frameIndex % columns;
    sprite.style.backgroundPosition = `${col * 50}% ${row * 33.33}%`;
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
  
  // Initialize
  function initialize() {
    // Listen for state changes
    EventBus.subscribe('stateChanged', (data) => {
      updateBackground(data.state);
    });
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.BackgroundManager = {
    updateBackground,
    updateBackgroundFrame,
    showFrame,
    checkImageExists
  };
});
