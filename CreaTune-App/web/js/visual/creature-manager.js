// creature-manager.js
// Creature animation and management for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const container = document.getElementById('spriteContainer');
  
  // Configuration
  const config = {
    spriteWidth: 920,
    spriteHeight: 920,
    columns: 3,
    totalFrames: 3,
    animationSpeed: 200
  };
  
  // Track animations
  const animations = {
    creatures: {}
  };
  
  // Create UI elements
  function createUI() {
    // Don't recreate if already exists
    if (document.getElementById('visualizer')) return;
    
    // Status display
    const statusEl = document.createElement('div');
    statusEl.id = 'synthStatus';
    statusEl.className = 'synth-status';
    
    // Visualizer container
    const visualizer = document.createElement('div');
    visualizer.id = 'visualizer';
    visualizer.className = 'visualizer';
    
    // Create creatures
    createCreatures(visualizer);
    
    // Add elements to DOM
    if (container) {
      container.appendChild(visualizer);
      container.appendChild(statusEl);
    }
    
    return { visualizer, statusEl };
  }
  
  // Create creatures
  function createCreatures(visualizer) {
    for (let i = 1; i <= 7; i++) {
      const creature = document.createElement('div');
      creature.id = `creature${i}`;
      creature.className = `creature creature${i}`;
      
      // Try to load image or use fallback
      const img = new Image();
      img.src = `images/creature${i}.png`;
      img.onerror = () => {
        console.log(`Failed to load creature image: creature${i}.png - using fallback`);
        creature.classList.add('fallback');
        creature.textContent = String.fromCharCode(64 + i); // A-G
      };
      
      // Add to visualizer
      visualizer.appendChild(creature);
      
      // Track animation state
      animations.creatures[`creature${i}`] = {
        frame: 0,
        interval: null,
        visible: false
      };
    }
  }
  
  // Update sprite frame
  function updateSpriteFrame(element, frameIndex) {
    const column = frameIndex % config.columns;
    element.style.backgroundPosition = `-${column * config.spriteWidth}px 0px`;
  }
  
  // Animate creature
  function animateCreature(id) {
    const creature = document.getElementById(id);
    if (!creature) return;
    
    // Stop existing animation
    stopAnimation(id);
    
    // Check if image exists or if we're already using fallback
    if (creature.classList.contains('fallback')) {
      // Just show the fallback
      creature.style.opacity = "1";
      animations.creatures[id].visible = true;
      return;
    }
    
    // Check if the image source exists
    const imgUrl = `images/${id}.png`;
    checkImageExists(imgUrl, function(exists) {
      if (!exists) {
        console.log(`Creature image not found: ${imgUrl}, using fallback`);
        creature.classList.add('fallback');
        creature.textContent = id.replace('creature', ''); // Just use the number
        creature.style.opacity = "1";
        animations.creatures[id].visible = true;
      } else {
        // Start animation with valid image
        let frame = 0;
        updateSpriteFrame(creature, frame);
        
        // Animation loop
        animations.creatures[id].interval = setInterval(() => {
          frame = (frame + 1) % config.totalFrames;
          updateSpriteFrame(creature, frame);
        }, config.animationSpeed);
        
        // Show creature
        animations.creatures[id].visible = true;
        creature.style.opacity = "1";
        
        // Apply animation based on sensor data if available
        applySensorEffects(id);
      }
    });
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
  
  // Apply visual effects based on sensor data
  function applySensorEffects(id) {
    if (!window.ESPManager) return;
    
    const creature = document.getElementById(id);
    if (!creature) return;
    
    const espStatus = window.ESPManager.getESPStatus();
    const currentState = window.StateManager ? window.StateManager.getState() : 'idle';
    
    // Apply effects based on current state and sensor values
    switch (id) {
      case 'creature1': // Soil creature
        if (espStatus.esp1.valid) {
          // Scale size based on soil moisture
          const scale = 0.8 + (espStatus.esp1.value * 0.4);
          creature.style.transform = `scale(${scale})`;
        }
        break;
        
      case 'creature2': // Light creature
        if (espStatus.esp2.valid) {
          // Brightness based on light level
          const brightness = 70 + (espStatus.esp2.value * 50);
          creature.style.filter = `brightness(${brightness}%)`;
        }
        break;
        
      case 'creature3': // Temperature creature
        if (espStatus.esp3.valid) {
          // Color tint based on temperature
          const hue = Math.floor(180 + (espStatus.esp3.value * 120)); // blue to red
          creature.style.filter = `hue-rotate(${hue}deg)`;
        }
        break;
        
      case 'creature4': // Growth (soil + light)
        if (espStatus.esp1.valid && espStatus.esp2.valid) {
          // Combine scale and brightness
          const scale = 0.8 + (espStatus.esp1.value * 0.4);
          const brightness = 70 + (espStatus.esp2.value * 50);
          creature.style.transform = `scale(${scale})`;
          creature.style.filter = `brightness(${brightness}%)`;
        }
        break;
        
      case 'creature5': // Mirrage (soil + temp)
        if (espStatus.esp1.valid && espStatus.esp3.valid) {
          // Combine scale and color
          const scale = 0.8 + (espStatus.esp1.value * 0.4);
          const hue = Math.floor(180 + (espStatus.esp3.value * 120));
          creature.style.transform = `scale(${scale})`;
          creature.style.filter = `hue-rotate(${hue}deg)`;
        }
        break;
        
      case 'creature6': // Flower (light + temp)
        if (espStatus.esp2.valid && espStatus.esp3.valid) {
          // Combine brightness and color
          const brightness = 70 + (espStatus.esp2.value * 50);
          const hue = Math.floor(180 + (espStatus.esp3.value * 120));
          creature.style.filter = `brightness(${brightness}%) hue-rotate(${hue}deg)`;
        }
        break;
        
      case 'creature7': // Total (all sensors)
        if (espStatus.esp1.valid && espStatus.esp2.valid && espStatus.esp3.valid) {
          // Apply all effects
          const scale = 0.8 + (espStatus.esp1.value * 0.4);
          const brightness = 70 + (espStatus.esp2.value * 50);
          const hue = Math.floor(180 + (espStatus.esp3.value * 120));
          creature.style.transform = `scale(${scale})`;
          creature.style.filter = `brightness(${brightness}%) hue-rotate(${hue}deg)`;
        }
        break;
    }
  }
  
  // Stop animation
  function stopAnimation(id) {
    if (animations.creatures[id]) {
      clearInterval(animations.creatures[id].interval);
      animations.creatures[id].visible = false;
      
      const creature = document.getElementById(id);
      if (creature) {
        creature.style.opacity = "0";
        // Reset any applied effects
        creature.style.transform = '';
        creature.style.filter = '';
      }
    }
  }
  
  // Make creature pulse
  function pulseCreature(id) {
    const creature = document.getElementById(id);
    if (!creature || !animations.creatures[id].visible) return;
    
    creature.classList.add('pulse');
    setTimeout(() => {
      creature.classList.remove('pulse');
    }, 150);
  }
  
  // Update creatures based on current state and valid sensors
  function updateCreatures(currentState, espStatus) {
    // Check if required sensors are valid
    const isValid = {
      soil: espStatus.esp1.connected && espStatus.esp1.valid,
      light: espStatus.esp2.connected && espStatus.esp2.valid,
      temp: espStatus.esp3.connected && espStatus.esp3.valid
    };
    
    // Hide all creatures first
    for (let i = 1; i <= 7; i++) {
      stopAnimation(`creature${i}`);
    }
    
    // Show appropriate creature based on state and valid data
    switch (currentState) {
      case 'soil':
        if (isValid.soil) {
          animateCreature('creature1');
        }
        break;
      case 'light':
        if (isValid.light) {
          animateCreature('creature2');
        }
        break;
      case 'temp':
        if (isValid.temp) {
          animateCreature('creature3');
        }
        break;
      case 'growth':
        if (isValid.soil && isValid.light) {
          animateCreature('creature4');
        }
        break;
      case 'mirrage':
        if (isValid.soil && isValid.temp) {
          animateCreature('creature5');
        }
        break;
      case 'flower':
        if (isValid.light && isValid.temp) {
          animateCreature('creature6');
        }
        break;
      case 'total':
        if (isValid.soil && isValid.light && isValid.temp) {
          animateCreature('creature7');
        }
        break;
    }
  }
  
  // Handle tab visibility
  function setupTabVisibility() {
    if (window.dragContainer) {
      const originalIsTabOpen = window.dragContainer.isTabOpen;
      
      // If the original method is not already modified, do it here
      if (typeof window.dragContainer._creatureModified === 'undefined') {
        window.dragContainer.isTabOpen = function() {
          const tabOpen = originalIsTabOpen.call(window.dragContainer);
          
          // Hide/show visualizer based on tab state
          const visualizer = document.getElementById('visualizer');
          if (visualizer) {
            if (tabOpen) {
              visualizer.classList.add('hidden');
            } else {
              visualizer.classList.remove('hidden');
            }
          }
          
          return tabOpen;
        };
        
        // Mark as modified so we don't double-modify it
        window.dragContainer._creatureModified = true;
      }
    }
  }
  
  // Initialize the creature manager
  function initialize() {
    // Create UI elements
    createUI();
    
    // Setup tab visibility
    setupTabVisibility();
    
    // Listen for state changes
    EventBus.subscribe('stateChanged', (data) => {
      updateCreatures(data.state, data.espStatus);
    });
    
    // Listen for tab changes
    EventBus.subscribe('tabStateChanged', (isOpen) => {
      const visualizer = document.getElementById('visualizer');
      if (visualizer) {
        if (isOpen) {
          visualizer.classList.add('hidden');
        } else {
          visualizer.classList.remove('hidden');
        }
      }
    });
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API for synth-logic.js and other modules
  window.CreatureManager = {
    animate: animateCreature,
    stopAnimation: stopAnimation,
    updateCreatures: updateCreatures,
    pulseCreature: pulseCreature
  };
});
