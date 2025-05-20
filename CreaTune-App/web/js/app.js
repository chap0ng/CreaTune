// app.js - Main frontend script
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
  if (window.UIManager) {
    window.UIManager.showInfoMessage('CreaTune ready. Connect ESP32 devices.', 4000);
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    // Clean up Tone.js resources if possible
    if (window.Tone && window.Tone.context) {
      window.Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
    }
    
    console.log('Application cleanup complete');
  });
});