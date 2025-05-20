// app.js - Main application script
document.addEventListener('DOMContentLoaded', () => {
  console.log('CreaTune Application Initializing...');
  
  // Set up global error handler for better debugging
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    // Show error to user if UIManager is available
    if (window.UIManager) {
      window.UIManager.showErrorMessage(`Error: ${event.error.message}`);
    }
  });
  
  // Show ready message when everything is initialized
  EventBus.subscribe('appInitialized', () => {
    console.log('CreaTune Application Initialized');
    
    // Show welcome message
    if (window.UIManager) {
      window.UIManager.showInfoMessage('CreaTune ready. Connect ESP32 devices.', 4000);
    }
  });
  
  // Add test sound button
  const testButton = document.createElement('button');
  testButton.innerText = "Test Sound";
  testButton.style.position = "fixed";
  testButton.style.bottom = "50px";
  testButton.style.right = "10px";
  testButton.style.zIndex = "1000";
  testButton.style.padding = "8px";
  testButton.style.background = "#4caf50";
  testButton.style.color = "white";
  testButton.style.border = "none";
  testButton.style.borderRadius = "4px";
  testButton.style.cursor = "pointer";
  
  testButton.onclick = async () => {
    try {
      // Start Tone.js context if needed
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      
      // Initialize SynthEngine if needed
      if (window.SynthEngine && !window.SynthEngine.isInitialized()) {
        await window.SynthEngine.init();
      }
      
      // Play test sound
      if (window.SynthEngine && window.SynthEngine.triggerSynthFromValue) {
        window.SynthEngine.triggerSynthFromValue(0.6);
      } else {
        console.error("SynthEngine not available or missing triggerSynthFromValue method");
      }
    } catch (err) {
      console.error("Error playing test sound:", err);
    }
  };
  
  document.body.appendChild(testButton);
  
  // Emit initialization event
  EventBus.emit('appInitialized');
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    // Clean up Tone.js resources if possible
    if (window.Tone && window.Tone.context) {
      window.Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
    }
    
    console.log('Application cleanup complete');
  });
});