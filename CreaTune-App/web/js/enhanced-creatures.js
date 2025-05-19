// enhanced-creatures.js
// Enhanced version of integrated-creatures.js to work with state machine

document.addEventListener('DOMContentLoaded', () => {
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
    
    // Create buttons - these will be hidden but still functional
    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'synthButtons';
    buttonsContainer.className = 'synth-buttons';
    
    for (let i = 1; i <= 3; i++) {
      const button = document.createElement('button');
      button.id = `button${i}`;
      button.className = 'synth-button';
      button.setAttribute('data-id', i);
      
      // Click handler
      button.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent frame click
        
        // Initialize audio if needed
        if (!window.synthEngine.isInitialized()) {
          await window.synthEngine.init((status) => {
            if (status) {
              statusEl.textContent = status;
              statusEl.style.opacity = "1";
            } else {
              statusEl.style.opacity = "0";
            }
          });
        }
        
        // Toggle button state
        const state = window.synthEngine.getState();
        const newState = !state[`button${i}`];
        window.synthEngine.setButtonState(i, newState);
        
        // Update appearance
        if (newState) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
        
        // Update visualizer
        updateVisuals();
      });
      
      buttonsContainer.appendChild(button);
    }
    
    // Add elements to DOM
    container.appendChild(visualizer);
    container.appendChild(buttonsContainer);
    container.appendChild(statusEl);
    
    return { visualizer, buttonsContainer, statusEl };
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
    
    // For letter fallbacks, just show without animation
    if (creature.classList.contains('fallback')) {
      creature.style.opacity = "1";
      animations.creatures[id].visible = true;
      return;
    }
    
    // Start animation
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
  
  // Apply visual effects based on sensor data
  function applySensorEffects(id) {
    if (!window.stateManager) return;
    
    const creature = document.getElementById(id);
    if (!creature) return;
    
    const espStatus = window.stateManager.getEspStatus();
    const currentState = window.stateManager.getState();
    
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
  
  // Update visuals based on button state
  function updateVisuals() {
    if (!window.synthEngine) return;
    
    const state = window.synthEngine.getState();
    
    // If we have a state manager, let it handle the visualization
    if (window.stateManager) {
      return;
    }
    
    // Otherwise, fall back to the original behavior
    // Hide all creatures
    for (let i = 1; i <= 7; i++) {
      stopAnimation(`creature${i}`);
    }
    
    // Show creature based on button combination
    if (state.button1 && state.button2 && state.button3) {
      animateCreature('creature7');
    } else if (state.button1 && state.button2) {
      animateCreature('creature4');
    } else if (state.button1 && state.button3) {
      animateCreature('creature5');
    } else if (state.button2 && state.button3) {
      animateCreature('creature6');
    } else if (state.button1) {
      animateCreature('creature1');
    } else if (state.button2) {
      animateCreature('creature2');
    } else if (state.button3) {
      animateCreature('creature3');
    }
  }
  
  // Handle state changes
  function handleStateChange(e) {
    if (e.detail && e.detail.state) {
      const state = e.detail.state;
      const espStatus = e.detail.espStatus;
      
      // For active creatures, update their sensor effects
      Object.keys(animations.creatures).forEach(id => {
        if (animations.creatures[id].visible) {
          applySensorEffects(id);
        }
      });
    }
  }
  
  // Create UI components
  const ui = createUI();
  
  // Handle tab visibility
  if (window.dragContainer) {
    const originalIsTabOpen = window.dragContainer.isTabOpen;
    
    window.dragContainer.isTabOpen = function() {
      const tabOpen = originalIsTabOpen.call(window.dragContainer);
      
      if (tabOpen) {
        document.getElementById('synthButtons')?.classList.add('hidden');
        document.getElementById('visualizer')?.classList.add('hidden');
      } else {
        document.getElementById('synthButtons')?.classList.remove('hidden');
        document.getElementById('visualizer')?.classList.remove('hidden');
      }
      
      // Trigger custom event for tab state change
      document.dispatchEvent(new CustomEvent('tabStateChange', {
        detail: { isOpen: tabOpen }
      }));
      
      return tabOpen;
    };
  }
  
  // Listen for state changes
  document.addEventListener('stateChange', handleStateChange);
  
  // Expose API to synth-logic.js
  window.synthUI = {
    updateVisuals: updateVisuals,
    pulseShape: function(shapeId) {
      const creatureId = shapeId.replace('shape', 'creature');
      pulseCreature(creatureId);
    }
  };
  
  // Expose creatures API
  window.creatureManager = {
    animate: animateCreature,
    stopAnimation: stopAnimation,
    updateVisibility: updateVisuals,
    applySensorEffects: applySensorEffects
  };
});