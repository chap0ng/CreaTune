// modified sprite-integration.js - Integrates the original sprite animation with CreaTune functionality

const SpriteIntegration = {
    // Initialize sprite integration
    init: function() {
        if (window.spriteAnimation) {
            this.setupSpriteAudioReactions();
            UIController.logToUI('Sprite animation integration initialized');
        }
    },
    
    // Setup sprite reactions to audio
    setupSpriteAudioReactions: function() {
        // Preserve original sprite animation functions
        const originalStartAnimation = window.spriteAnimation.start;
        const originalStopAnimation = window.spriteAnimation.stop;
        
        // Override start animation to add audio features
        window.spriteAnimation.start = function(speedFactor = 1) {
            // Call original start function
            originalStartAnimation.call(window.spriteAnimation);
            
            // If audio is active, trigger a sound
            if (AudioEngine.isAmbientPlaying || AudioEngine.isToyPianoPlaying) {
                // Get average of sensor values if available
                const activeSensors = Object.keys(SensorManager.connectedSensors).filter(
                    key => SensorManager.connectedSensors[key].connected
                );
                
                if (activeSensors.length > 0) {
                    const sensorId = activeSensors[Math.floor(Math.random() * activeSensors.length)];
                    const value = SensorManager.currentValues[sensorId];
                    AudioEngine.triggerSoundFromValue(sensorId, value);
                } else {
                    // Default value if no sensors
                    AudioEngine.triggerSoundFromValue('sensor1', 0.6);
                }
            }
        };
        
        // React to audio triggers
        const originalTriggerSound = AudioEngine.triggerSoundFromValue;
        
        AudioEngine.triggerSoundFromValue = function(sensorId, value) {
            // Call the original function
            originalTriggerSound.call(AudioEngine, sensorId, value);
            
            // Trigger animation based on sound
            SpriteIntegration.triggerSpriteReaction(value);
        };
        
        // Setup sprite animation callbacks
        window.spriteAnimation.onTabClosed = function() {
            // Callback for when tab is closed
            if (AudioEngine.isAmbientPlaying || AudioEngine.isToyPianoPlaying || 
                Tone.Transport.state === "started") {
                UIController.showCreature();
            }
        };
        
        window.spriteAnimation.onTabFullyOpen = function() {
            // Callback for when tab is fully open
            UIController.hideCreature();
        };
        
        window.spriteAnimation.onTabPartiallyOpen = function(percentage) {
            // Callback for when tab is partially open
            // Adjust volume based on how open the tab is
            if (AudioEngine.ambientSynth) {
                const baseVolume = -15;
                const volumeAdjust = percentage * -10; // More open = quieter
                AudioEngine.ambientSynth.volume.value = baseVolume + volumeAdjust;
            }
            
            if (AudioEngine.toyPianoSynth) {
                const baseVolume = -10;
                const volumeAdjust = percentage * -8; // More open = quieter
                AudioEngine.toyPianoSynth.volume.value = baseVolume + volumeAdjust;
            }
        };
    },
    
    // Trigger sprite reactions based on audio
    triggerSpriteReaction: function(value) {
        // Start animation if not already running and tab not open
        if (window.spriteAnimation && !window.spriteAnimation.isRunning() && 
            (!window.dragContainer || !window.dragContainer.isTabOpen())) {
            // Start animation with normal speed (preserve original behavior)
            window.spriteAnimation.start();
        }
        
        // Add reaction to creature if visible
        const creature = document.getElementById('creature');
        if (creature && !document.getElementById('creature-container').classList.contains('hidden')) {
            // Remove any existing animation class
            creature.classList.remove('creature-reacting');
            
            // Trigger browser reflow to restart animation
            void creature.offsetWidth;
            
            // Add animation class
            creature.classList.add('creature-reacting');
            
            // Reset after animation completes
            setTimeout(() => {
                creature.classList.remove('creature-reacting');
            }, 400);
        }
    }
};