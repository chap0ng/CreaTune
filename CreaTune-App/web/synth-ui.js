// UI elements for the synth system
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('spriteContainer');
  const statusEl = document.createElement('div');
  statusEl.id = 'synthStatus';
  statusEl.className = 'synth-status';
  
  // Create visualization container
  const visualizer = document.createElement('div');
  visualizer.id = 'visualizer';
  visualizer.className = 'visualizer';
  
  // Create shapes for visualization
  const shapes = {};
  const shapeClasses = [
    'shape1', 'shape2', 'shape3', 
    'shape4', 'shape5', 'shape6', 'shape7'
  ];
  
  shapeClasses.forEach(className => {
    const shape = document.createElement('div');
    shape.className = `shape ${className}`;
    visualizer.appendChild(shape);
    shapes[className] = shape;
  });
  
  // Create buttons container and ensure it's inside the frame
  const buttonsContainer = document.createElement('div');
  buttonsContainer.id = 'synthButtons';
  buttonsContainer.className = 'synth-buttons';
  
  // Create buttons
  const buttons = {};
  for (let i = 1; i <= 3; i++) {
    const button = document.createElement('button');
    button.id = `button${i}`;
    button.className = 'synth-button';
    buttonsContainer.appendChild(button);
    buttons[`button${i}`] = button;
  }
  
  // Add elements to container
  container.appendChild(visualizer);
  container.appendChild(buttonsContainer);
  container.appendChild(statusEl);
  
  // Animation function for shapes
  function pulseShape(shapeId) {
    const shape = shapes[shapeId];
    if (!shape) return;
    
    const currentOpacity = window.getComputedStyle(shape).opacity;
    if (currentOpacity !== "0") {
      shape.style.transform = "scale(1.1)";
      setTimeout(() => {
        shape.style.transform = "scale(1)";
      }, 150);
    }
  }
  
  // Update visuals based on active synths
  function updateVisuals() {
    // Hide all shapes first
    Object.values(shapes).forEach(shape => {
      shape.style.opacity = "0";
    });
    
    // Get current button states
    const state = window.synthEngine.getState();
    
    // Show appropriate shape based on button combination
    if (state.button1 && state.button2 && state.button3) {
      shapes.shape7.style.opacity = "1";
    } else if (state.button1 && state.button2) {
      shapes.shape4.style.opacity = "1";
    } else if (state.button1 && state.button3) {
      shapes.shape5.style.opacity = "1";
    } else if (state.button2 && state.button3) {
      shapes.shape6.style.opacity = "1";
    } else if (state.button1) {
      shapes.shape1.style.opacity = "1";
    } else if (state.button2) {
      shapes.shape2.style.opacity = "1";
    } else if (state.button3) {
      shapes.shape3.style.opacity = "1";
    }
  }
  
  // Set up event listeners for buttons
  for (let i = 1; i <= 3; i++) {
    const button = buttons[`button${i}`];
    
    button.addEventListener('click', async function() {
      // Initialize audio on first click
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
      
      // Update button appearance
      if (newState) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
      
      // Update visuals
      updateVisuals();
    });
  }
  
  // Export UI functionality
  window.synthUI = {
    pulseShape: pulseShape,
    updateVisuals: updateVisuals
  };
});