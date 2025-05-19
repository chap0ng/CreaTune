// app.js
// Main application initialization for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  console.log('CreaTune Application Initializing...');
  
  // Module loading order and dependencies
  const moduleLoadOrder = [
    // Core modules
    'js/core/config.js',
    'js/utils/event-bus.js',
    
    // Base modules
    'js/core/websocket-client.js',
    'js/state/esp-manager.js',
    'js/audio/sound-patterns.js',
    
    // UI and visual modules
    'js/ui/ui-manager.js',
    'js/visual/background-manager.js',
    'js/visual/creature-manager.js',
    
    // Audio modules
    'js/audio/synth-engine.js',
    
    // State management
    'js/state/bpm-manager.js',
    'js/state/recording-manager.js',
    'js/state/state-manager.js'
  ];
  
  // Track loaded modules
  const loadedModules = new Set();
  let modulesLoading = 0;
  
  // Load a script and return a promise
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Skip if already loaded
      if (loadedModules.has(src)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => {
        loadedModules.add(src);
        console.log(`Loaded: ${src}`);
        resolve();
      };
      
      script.onerror = (error) => {
        console.error(`Failed to load: ${src}`, error);
        reject(error);
      };
      
      document.head.appendChild(script);
    });
  }
  
  // Load modules in sequence
  async function loadModules() {
    try {
      // Load original scripts first to maintain backward compatibility
      await loadLegacyScripts();
      
      // Then load new modular scripts
      for (const modulePath of moduleLoadOrder) {
        modulesLoading++;
        await loadScript(modulePath);
        modulesLoading--;
      }
      
      initializeApp();
    } catch (error) {
      console.error('Error loading modules:', error);
      showErrorMessage('Failed to load CreaTune modules. Please refresh the page.');
    }
  }
  
  // Load legacy scripts if needed for backward compatibility
  async function loadLegacyScripts() {
    // Nothing to do here - legacy scripts are loaded directly in index.html
    // This function is a placeholder in case we need to load legacy scripts dynamically
    return Promise.resolve();
  }
  
  // Display error message
  function showErrorMessage(message) {
    const errorEl = document.createElement('div');
    errorEl.style.position = 'fixed';
    errorEl.style.top = '50%';
    errorEl.style.left = '50%';
    errorEl.style.transform = 'translate(-50%, -50%)';
    errorEl.style.padding = '20px';
    errorEl.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    errorEl.style.color = 'white';
    errorEl.style.fontFamily = 'VT323, monospace';
    errorEl.style.zIndex = '9999';
    errorEl.style.borderRadius = '10px';
    errorEl.style.textAlign = 'center';
    errorEl.textContent = message;
    
    document.body.appendChild(errorEl);
  }
  
  // Initialize the application when all modules are loaded
  function initializeApp() {
    if (modulesLoading > 0) {
      // Wait for modules to finish loading
      setTimeout(initializeApp, 100);
      return;
    }
    
    console.log('All modules loaded, initializing application...');
    
    // Make sure essential modules are available
    if (!window.EventBus) {
      console.error('EventBus module not loaded!');
      return;
    }
    
    // Send initialization event
    EventBus.emit('appInitialized');
    
    console.log('CreaTune Application Initialized');
    
    // Show welcome message when app is ready
    if (window.UIManager) {
      window.UIManager.showInfoMessage('CreaTune initialized. Connect ESP32 devices or use the Random State button to begin.', 4000);
    }
  }
  
  // Start loading modules
  loadModules();
});
