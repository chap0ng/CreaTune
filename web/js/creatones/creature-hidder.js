// creature-hidder.js
// Improved creature visibility management with multiple sensor support
// Handles idle, soil, light, and combined states

document.addEventListener('DOMContentLoaded', function() {
    const idleCreature = document.querySelector('.idle-creature');
    const soilCreature = document.querySelector('.soil-creature');
    const lightCreature = document.querySelector('.light-creature');
    
    // Track active sensors
    let activeSensors = new Set();
    
    function updateCreatureVisibility() {
        const isFrameOpen = window.frameSliderState?.isOpen || false;
        const frameBackground = document.querySelector('.framebackground');
        
        // Detect active sensors from CSS classes
        const newActiveSensors = new Set();
        if (frameBackground?.classList.contains('soil') && frameBackground?.classList.contains('active')) {
            newActiveSensors.add('soil');
        }
        if (frameBackground?.classList.contains('light') && frameBackground?.classList.contains('active')) {
            newActiveSensors.add('light');
        }
        // Add temperature when implemented
        // if (frameBackground?.classList.contains('temp') && frameBackground?.classList.contains('active')) {
        //     newActiveSensors.add('temp');
        // }
        
        // Update active sensors
        activeSensors = newActiveSensors;
        
        if (isFrameOpen) {
            // Hide all creatures when frame is open
            hideAllCreatures();
        } else {
            // Show appropriate creature(s) when frame is closed
            showAppropriateCreatures();
        }
    }
    
    function hideAllCreatures() {
        if (idleCreature) idleCreature.style.display = 'none';
        if (soilCreature) soilCreature.style.display = 'none';
        if (lightCreature) lightCreature.style.display = 'none';
    }
    
    function showAppropriateCreatures() {
        // Hide all first
        hideAllCreatures();
        
        if (activeSensors.size === 0) {
            // No active sensors - show idle creature
            if (idleCreature) {
                idleCreature.style.display = 'block';
                idleCreature.classList.add('active');
            }
            console.log('👻 Showing idle creature');
            
        } else if (activeSensors.size === 1) {
            // Single active sensor
            const sensorType = Array.from(activeSensors)[0];
            showSingleSensorCreature(sensorType);
            
        } else {
            // Multiple active sensors - show combined or prioritized creature
            showMultipleSensorCreatures();
        }
    }
    
    function showSingleSensorCreature(sensorType) {
        switch (sensorType) {
            case 'soil':
                if (soilCreature) {
                    soilCreature.style.display = 'block';
                    soilCreature.classList.add('active');
                    console.log('🌱 Showing soil creature');
                }
                break;
                
            case 'light':
                if (lightCreature) {
                    lightCreature.style.display = 'block';
                    lightCreature.classList.add('active');
                    console.log('💡 Showing light creature');
                }
                break;
                
            // Add more sensor types as needed
            default:
                console.log(`Unknown sensor type: ${sensorType}`);
        }
    }
    
    function showMultipleSensorCreatures() {
        // For multiple sensors, you can implement different strategies:
        // 1. Show all active creatures (overlapping)
        // 2. Show the most recently activated creature
        // 3. Show a special combined creature
        // 4. Prioritize certain sensors over others
        
        // Strategy 1: Show all active creatures (you might need to position them differently)
        if (activeSensors.has('soil') && soilCreature) {
            soilCreature.style.display = 'block';
            soilCreature.classList.add('active');
            // Position slightly to the left for multiple creatures
            soilCreature.style.left = 'calc(50% - 15px)';
        }
        
        if (activeSensors.has('light') && lightCreature) {
            lightCreature.style.display = 'block';
            lightCreature.classList.add('active');
            // Position slightly to the right for multiple creatures
            lightCreature.style.left = 'calc(50% + 15px)';
        }
        
        // Reset positions when only one creature is active
        if (activeSensors.size === 1) {
            if (soilCreature) soilCreature.style.left = 'calc(50% + 0px)';
            if (lightCreature) lightCreature.style.left = 'calc(50% + 0px)';
        }
        
        console.log(`🎭 Showing multiple creatures: ${Array.from(activeSensors).join(', ')}`);
    }
    
    // Listen for WebSocket disconnection events to reset creatures
    function handleDisconnection() {
        console.log('🔌 WebSocket disconnected - resetting to idle');
        activeSensors.clear();
        updateCreatureVisibility();
    }
    
    // Connect to WebSocket events when available
    function connectToWebSocket() {
        if (window.creatoneWS) {
            window.creatoneWS.on('disconnected', handleDisconnection);
            console.log('Creature hidder connected to websocket events');
        } else {
            setTimeout(connectToWebSocket, 100);
        }
    }
    
    // Initialize WebSocket connection
    connectToWebSocket();
    
    // Check visibility every 100ms
    setInterval(updateCreatureVisibility, 100);
    updateCreatureVisibility();
    
    // Debug function for testing
    window.creatureDebug = {
        getActiveSensors: () => Array.from(activeSensors),
        forceShowCreature: (type) => {
            hideAllCreatures();
            showSingleSensorCreature(type);
        },
        showIdle: () => {
            activeSensors.clear();
            updateCreatureVisibility();
        }
    };
});