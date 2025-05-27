// soil.js
// FIXED - Robust disconnect cleanup + better state management

class SoilHandler {
    constructor() {
        // Simple on/off states
        this.isConnected = false;
        this.isPlaying = false;
        this.audioContextReady = false;
        
        // Visual states
        this.backgroundShown = false;
        this.creatureShown = false;
        this.audioPlaying = false;
        
        // Audio components
        this.synth = null;
        this.reverb = null;
        this.filter = null;
        
        // DOM elements
        this.frameBackground = null;
        this.soilCreature = null;
        
        // ✅ Add cleanup tracking
        this.cleanupTimeout = null;
        this.lastActivityTime = 0;
        
        // Musical scale - Higher octave for toy piano brightness
        this.melancholicScale = [
            'C4', 'D4', 'E4', 'G4', 'A4',    
            'C5', 'D5', 'E5', 'G5', 'A5',    
            'F4', 'B4', 'F5', 'B5'           
        ];
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Initializing Clean Soil Handler...');
        
        await this.waitForDependencies();
        this.setupAudio();
        
        // Get DOM elements with better error handling
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        if (!this.frameBackground) {
            console.warn('⚠️  .framebackground element not found');
        }
        if (!this.soilCreature) {
            console.warn('⚠️  .soil-creature element not found');
        }
        
        this.setupWebSocketListener();
        this.createAudioEnableButton();
        
        console.log('🌱✅ Clean Soil Handler ready');
    }
    
    async waitForDependencies() {
        while (typeof Tone === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        while (!window.creatune) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    async setupAudio() {
        try {
            // ✅ TOY PIANO SOUND - Bright, metallic, bell-like
            this.synth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 8,      
                modulationIndex: 25, 
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 0.001,   
                    decay: 0.4,      
                    sustain: 0.1,    
                    release: 1.2     
                },
                modulation: {
                    type: "square"   
                },
                modulationEnvelope: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0,      
                    release: 0.2
                }
            });
            
            // ✅ LIGHTER REVERB - Toy pianos don't have much reverb
            this.reverb = new Tone.Reverb({
                decay: 2.0,      
                wet: 0.3         
            });
            
            // ✅ HIGH-PASS FILTER - Remove muddy low frequencies
            this.filter = new Tone.Filter({
                frequency: 200,  
                type: "highpass"
            });
            
            // Connect: synth -> filter -> reverb -> output
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            
            this.synth.volume.value = -8;
            
            console.log('🎵 Toy piano setup complete');
        } catch (error) {
            console.error('❌ Toy piano setup failed:', error);
        }
    }
    
    createAudioEnableButton() {
        const button = document.createElement('button');
        button.id = 'audio-enable-btn';
        button.innerHTML = '🎵';
        
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background-color: rgba(45, 49, 66, 0.1);
            color: var(--dark-slate);
            font-size: 16px;
            cursor: pointer;
            z-index: 1000;
            opacity: 0.7;
            transition: all 0.3s ease;
            font-family: 'VT323', monospace;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        button.onmouseenter = () => {
            button.style.opacity = '1';
            button.style.backgroundColor = 'rgba(45, 49, 66, 0.2)';
            button.style.transform = 'scale(1.1)';
        };
        
        button.onmouseleave = () => {
            if (!this.audioContextReady) {
                button.style.opacity = '0.7';
                button.style.backgroundColor = 'rgba(45, 49, 66, 0.1)';
                button.style.transform = 'scale(1)';
            }
        };
        
        button.onclick = async () => {
            try {
                console.log('🎵 Enabling audio context...');
                await Tone.start();
                
                this.audioContextReady = true;
                console.log('✅ Audio enabled - ESP32 can now control music');
                
                button.innerHTML = '✓';
                button.style.backgroundColor = 'rgba(142, 164, 125, 0.3)';
                button.style.color = 'var(--sage-green)';
                button.style.opacity = '1';
                button.style.cursor = 'default';
                
                setTimeout(() => {
                    button.style.opacity = '0';
                    button.style.pointerEvents = 'none';
                }, 2000);
                
            } catch (error) {
                console.error('❌ Failed to enable audio:', error);
                button.innerHTML = '❌';
                button.style.backgroundColor = 'rgba(230, 105, 90, 0.3)';
            }
        };
        
        document.body.appendChild(button);
        console.log('🎵 Audio enable button created (top-right corner)');
    }
    
    setupWebSocketListener() {
        // Ensure window.creatune is available
        if (!window.creatune) {
            console.error('🚨 CreaTune WebSocket client (window.creatune) not found! Cannot set up listeners.');
            return;
        }

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                this.handleSoilConnected();
            }
        });
        
        window.creatune.on('stateChange', (deviceType, stateData) => {
            if (deviceType === 'soil') {
                this.handleSoilStateChange(stateData);
            }
        });
        
        window.creatune.on('disconnected', (deviceType) => {
            // ✅ Log when the event is received from websocket-client
            console.log(`🌱 SoilHandler received 'disconnected' event for deviceType: ${deviceType}`);
            if (deviceType === 'soil') {
                this.handleSoilDisconnected();
            }
        });
        
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.lastActivityTime = Date.now();
                // console.log(`🌱 Raw data: ${data.soil_condition || data.moisture_app_value}`); // Reduced verbosity
            }
        });
    }
    
    handleSoilConnected() {
        console.log('🌱 ✅ SOIL CONNECTED - showing background');
        this.isConnected = true;
        this.lastActivityTime = Date.now();
        this.showBackground();
    }
    
    handleSoilStateChange(stateData) {
        console.log(`🌱 🔄 SOIL STATE CHANGE: ${stateData.previousState} → ${stateData.active}`);
        if (stateData.rawData) {
            console.log(`🌱 📊 Raw condition: ${stateData.rawData.soil_condition || stateData.rawData.moisture_app_value}`);
        }
        
        this.lastActivityTime = Date.now();
        
        if (stateData.active && !this.isPlaying) {
            console.log('🌱 ▶️  ESP32 ACTIVATION - soil is active');
            this.turnOn();
        } else if (!stateData.active && this.isPlaying) {
            console.log('🌱 ⏹️  ESP32 DEACTIVATION - soil is inactive');
            this.turnOff();
        } else {
            // console.log(`🌱 ➡️  No change needed (already ${this.isPlaying ? 'ON' : 'OFF'})`);
        }
    }
    
    handleSoilDisconnected() {
        console.log('🌱❌ SOIL DISCONNECTED event received by handler. Initiating cleanup...');
        
        // Clear any previous safety timeout to prevent redundant or late cleanups
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
            console.log('🌱🧹 Cleared previous safety cleanup timeout.');
        }

        // Perform immediate and primary cleanup
        this.forceCompleteCleanup(); 
        this.isConnected = false; // Update connection state immediately
        
        console.log('🌱🏁 Soil disconnect handling complete in handleSoilDisconnected.');
    }
    
    forceCompleteCleanup() {
        console.log('🌱🧹 Executing forceCompleteCleanup...');
        
        // Stop Music
        if (this.synth) {
            console.log('🌱🧹 Attempting to stop music...');
            try {
                this.synth.releaseAll(); // Stops all notes on the synth
                console.log('🎹 ✅ Music forcefully stopped via releaseAll()');
            } catch (error) {
                console.error('🎹 ❌ Error stopping music with releaseAll():', error);
            }
        } else {
            console.warn('🌱🧹 Synth not available (this.synth is null), cannot stop music.');
        }
        // Always update flags regardless of synth state
        this.audioPlaying = false;
        this.isPlaying = false; 
        console.log(`🌱🧹 Music flags set: audioPlaying=${this.audioPlaying}, isPlaying=${this.isPlaying}`);
        
        // Hide Creature
        if (this.soilCreature) {
            console.log('🌱🧹 Attempting to hide creature...');
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none'; // More direct way to ensure it's hidden
            this.creatureShown = false;
            console.log('🦎 ✅ Creature forcefully hidden. creatureShown set to false.');
        } else {
            console.warn('🌱🧹 Soil creature element (this.soilCreature) not found, cannot hide.');
            this.creatureShown = false; // Still set flag
        }
        
        // Hide Background
        if (this.frameBackground) {
            console.log('🌱🧹 Attempting to hide background...');
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false;
            console.log('🎨 ✅ Background class removed. backgroundShown set to false.');
        } else {
            console.warn('🌱🧹 Frame background element (this.frameBackground) not found, cannot hide.');
            this.backgroundShown = false; // Still set flag
        }
        
        // Clear any lingering playNote timeouts
        // This requires playNote to store its timeoutId if you implement it that way.
        // For now, relying on audioPlaying flag.

        console.log('🌱✅ forceCompleteCleanup finished.');
    }
    
    turnOn() {
        if (this.isPlaying) {
            // console.log('🌱 turnOn called but already playing.');
            return;
        }
        
        this.isPlaying = true;
        this.lastActivityTime = Date.now();
        console.log('🌱 ✅ ESP32 TURNING ON - creature + music');
        
        this.showCreature();
        this.startMusic();
    }
    
    turnOff() {
        if (!this.isPlaying) {
            // console.log('🌱 turnOff called but not playing.');
            return;
        }
        
        this.isPlaying = false;
        console.log('🌱 ❌ ESP32 TURNING OFF - creature + music');
        
        this.hideCreature();
        this.stopMusic(); // stopMusic already sets audioPlaying to false
    }
    
    showBackground() {
        if (this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil-background');
            this.backgroundShown = true;
            console.log('🌱 🎨 Background shown');
        } else {
            console.warn('🌱 🎨 Cannot show background, frameBackground element not found.');
        }
    }
    
    hideBackground() { // This might be called by forceCompleteCleanup
        // if (!this.backgroundShown) return; // Guard removed for forceCompleteCleanup
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false; // Ensure flag is set
            console.log('🌱 🎨 Background hidden');
        } else {
            console.warn('🌱 🎨 Cannot hide background, frameBackground element not found.');
            this.backgroundShown = false; // Ensure flag is set
        }
    }
    
    showCreature() {
        if (this.creatureShown) return;
        
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block'; // Ensure it's visible
            this.creatureShown = true;
            console.log('🌱 🦎 Creature shown');
        } else {
            console.warn('🌱 🦎 Cannot show creature, soilCreature element not found.');
        }
    }
    
    hideCreature() { // This might be called by forceCompleteCleanup
        // if (!this.creatureShown) return; // Guard removed for forceCompleteCleanup
        
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none'; // Ensure it's hidden
            this.creatureShown = false; // Ensure flag is set
            console.log('🌱 🦎 Creature hidden');
        } else {
            console.warn('🌱 🦎 Cannot hide creature, soilCreature element not found.');
            this.creatureShown = false; // Ensure flag is set
        }
    }
    
    async startMusic() {
        if (this.audioPlaying) {
            // console.log('🌱 startMusic called but audio already playing.');
            return;
        }
        
        if (!this.synth) {
            console.error('❌ No synth available for startMusic.');
            return;
        }
        
        if (!this.audioContextReady || (Tone.context && Tone.context.state !== 'running')) {
            console.warn('⚠️  Audio context not ready or not running. User needs to interact. Music not started.');
            // Optionally, try to start Tone.context again here if it's just suspended
            // try { await Tone.start(); this.audioContextReady = true; } catch(e) {}
            return;
        }
        
        this.audioPlaying = true;
        console.log('🌱 🎹 ESP32 activated music - starting toy piano');
        
        this.playNote(); // Start the musical pattern
    }
    
    stopMusic() { // This might be called by forceCompleteCleanup or turnOff
        // if (!this.audioPlaying) return; // Guard removed for forceCompleteCleanup

        console.log('🌱 🎹 ESP32 deactivated music - stopping toy piano (called by turnOff or direct)');
        this.audioPlaying = false; // Ensure flag is set
        
        if (this.synth) {
            try {
                this.synth.releaseAll();
                console.log('🎹 ✅ Music stopped in stopMusic()');
            } catch (error) {
                console.error('🎹 ❌ Error in stopMusic():', error);
            }
        } else {
            console.warn('🌱🎹 Synth not available in stopMusic()');
        }
    }
    
    playNote() {
        if (!this.audioPlaying || !this.synth) {
            // console.log('🎹 playNote check: audioPlaying or synth false, not playing note.');
            return;
        }
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        
        // console.log(`🎹 Playing: ${note}`); // Can be verbose
        this.synth.triggerAttackRelease(note, '4n');
        
        // Schedule next note
        // Ensure this timeout is cleared if music is stopped abruptly.
        // For now, the this.audioPlaying flag handles this.
        setTimeout(() => {
            if (this.audioPlaying) { // Check flag again before re-calling
                this.playNote();
            }
        }, 2000); // 2 seconds between notes
    }
    
    getDebugInfo() {
        return {
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            audioPlaying: this.audioPlaying,
            backgroundShown: this.backgroundShown,
            creatureShown: this.creatureShown,
            audioContextReady: this.audioContextReady,
            lastActivityTime: this.lastActivityTime,
            timeSinceActivity: this.lastActivityTime > 0 ? Date.now() - this.lastActivityTime : -1
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 DOMContentLoaded: Starting Clean Soil Handler...');
    // Ensure window.creatune is initialized before SoilHandler tries to use it.
    // This assumes websocket-client.js is loaded and has run its DOMContentLoaded.
    // If there's a race condition, SoilHandler's waitForDependencies will handle it.
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}