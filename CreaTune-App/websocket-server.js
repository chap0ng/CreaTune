// Reduce timeout for faster state changes
const ESP32_TIMEOUT = 5000; // 5 seconds timeout instead of 15 seconds

// Change check interval to 1 second for faster state updates
setInterval(() => {
  const now = Date.now();
  let timeoutsOccurred = false;
  
  // Check each ESP32 device for timeout
  for (const [espName, lastActivity] of Object.entries(lastESP32Activities)) {
    if (now - lastActivity > ESP32_TIMEOUT) {
      console.log(`ESP32 ${espName} timed out - no data for ${ESP32_TIMEOUT}ms`);
      
      // Find and remove the ESP connection
      for (const [wsClient, espInfo] of espDevices.entries()) {
        if (espInfo.name === espName) {
          // Update application state
          let espId = null;
          if (espName === 'ESP32-1' || espInfo.lastData?.sensor === 'soil') {
            espId = 'esp1';
          } else if (espName === 'ESP32-2' || espInfo.lastData?.sensor === 'light') {
            espId = 'esp2';
          } else if (espName === 'ESP32-3' || espInfo.lastData?.sensor === 'temperature') {
            espId = 'esp3';
          }
          
          if (espId) {
            // Mark as disconnected
            appState[espId].connected = false;
            appState[espId].valid = false;
            appState[espId].value = null;
          }
          
          // Notify clients about disconnection
          broadcastToWebClients({
            type: 'esp_disconnected',
            espId: espInfo.id,
            name: espName
          });
          
          // Remove from tracking
          espDevices.delete(wsClient);
          delete lastESP32Activities[espName];
          timeoutsOccurred = true;
          break;
        }
      }
    }
  }
  
  // If any timeouts occurred, broadcast updated state
  if (timeoutsOccurred) {
    broadcastState();
  }
}, 1000); // Check every 1 second