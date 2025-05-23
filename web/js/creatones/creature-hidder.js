// creature-hidder.js
// Improved creature visibility management with smooth transitions
// Works with opacity/scale instead of display none/block

document.addEventListener('DOMContentLoaded', function() {
    const idleCreature = document.querySelector('.idle-creature');
    const soilCreature = document.querySelector('.soil-creature');
    const lightCreature = document.querySelector('.light-creature');
    
    // Track active sensors and states
    let activeSensors = new Set();
    let lastFrameOpen = false;
    
    function updateCreatureVisibility() {
        const isFrameOpen = window.frameSliderState?.isOpen || false;
        const frameBackground = document.querySelector('.framebackground');
        
        // Detect active sensors from active creatures (not just background)
        const newActiveSensors = new Set();
        
        // Check for soil - creature active only if data in range
        if (soilCreature?.classList.contains('active')) {
            newActiveSensors.add('soil');
        }
        
        // Check for light - creature active only if data in range  
        if (lightCreature?.classList.contains('active')) {
            newActiveSensors.add('light');
        }
        
        // Update active sensors
        const sensorsChanged = !setsEqual(activeSensors, newActiveSensors);
        activeSensors = newActiveSensors;
        
        // Handle frame open/close
        if (isFrameOpen) {
            // Hide all creatures when frame is open (but smoothly)
            hideAllCreatures();
        } else {
            // Show appropriate creature(s) when frame is closed
            if (sensorsChanged || lastFrameOpen !== isFrameOpen) {
                showAppropriateCreatures();
            }
        }
        
        lastFrameOpen = isFrameOpen;
    }
    
    function setsEqual(set1, set2) {
        return set1.size === set2.size && [...set1].every(x => set2.has(x));
    }
    
    function hideAllCreatures() {
        // Smooth hiding with opacity/scale transitions
        if (idleCreature) idleCreature.classList.remove('active');
        if (soilCreature) soilCreature.classList.remove('temp-active');
        if (lightCreature) lightCreature.classList.remove('temp-active');
    }
    
    function showAppropriateCreatures() {
        // Hide all first
        if (idleCreature) idleCreature.classList.remove('active');
        
        if (activeSensors.size === 0) {
            // No active sensors - show idle creature
            if (idleCreature) {
                idleCreature.classList.add('active');
                console.log('👻 Idle creature appearing');
            }
            
            // Clear multiple positioning
            clearMultiplePositioning();
            
        } else if (activeSensors.size === 1) {
            // Single active sensor - position normally
            clearMultiplePositioning();
            logActiveCreatures();
            
        } else {
            // Multiple active sensors - special positioning
            applyMultiplePositioning();
            logActiveCreatures();
        }
    }
    
    function clearMultiplePositioning() {
        // Reset to center positioning
        const container = document.querySelector('.frameidle');
        if (container) {
            container.classList.remove('multiple-creatures');
        }
        
        if (soilCreature) soilCreature.style.left = '';
        if (lightCreature) lightCreature.style.left = '';
    }
    
    function applyMultiplePositioning() {
        // Apply multiple creature positioning
        const container = document.querySelector('.frameidle');
        if (container) {
            container.classList.add('multiple-creatures');
        }
        
        console.log(`🎭 Multiple creatures active: ${Array.from(activeSensors).join(', ')}`);
    }
    
    function logActiveCreatures() {
        activeSensors.forEach(sensor => {
            switch (sensor) {
                case 'soil':
                    console.log('🌱 Soil creature visible');
                    break;
                case 'light':
                    console.log('💡 Light creature visible');
                    break;
            }
        });
    }
    
    // Listen for custom disconnection events
    function handleSensorDisconnection(event) {
        console.log('🔌 Sensor disconnected, updating creatures');
        
        // Force immediate update
        setTimeout(() => {
            updateCreatureVisibility();
        }, 50); // Small delay for DOM updates
    }
    
    // Listen for WebSocket events and custom events
    function connectToEvents() {
        // WebSocket events
        if (window.creatoneWS) {
            window.creatoneWS.on('disconnected', () => {
                console.log('🔌 WebSocket lost - hiding all creatures');
                hideAllCreatures();
                if (idleCreature) {
                    setTimeout(() => idleCreature.classList.add('active'), 100);
                }
            });
            
            window.creatoneWS.on('connected', () => {
                console.log('🔌 WebSocket reconnected - updating creatures');
                updateCreatureVisibility();
            });
        } else {
            setTimeout(connectToEvents, 50);
        }
        
        // Custom disconnection events
        window.addEventListener('soilDisconnected', handleSensorDisconnection);
        window.addEventListener('lightDisconnected', handleSensorDisconnection);
    }
    
    // Initialize
    connectToEvents();
    
    // Fast polling for smooth transitions
    setInterval(updateCreatureVisibility, 50); // Every 50ms for smooth transitions
    updateCreatureVisibility();
    
    // Debug functions
    window.creatureDebug = {
        getActiveSensors: () => Array.from(activeSensors),
        showIdle: () => {
            hideAllCreatures();
            if (idleCreature) idleCreature.classList.add('active');
        },
        hideAll: () => hideAllCreatures(),
        getStatus: () => ({
            activeSensors: Array.from(activeSensors),
            frameOpen: window.frameSliderState?.isOpen || false,
            soilActive: soilCreature?.classList.contains('active') || false,
            lightActive: lightCreature?.classList.contains('active') || false,
            idleActive: idleCreature?.classList.contains('active') || false
        })
    };
    
    console.log('👾 Creature manager ready - try: window.creatureDebug.getStatus()');
});