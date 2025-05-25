// soil.js
// CLEAN HANDLER - Only reacts to stable state changes

class SoilHandler {
    constructor() {
        // Simple on/off states
        this.isConnected = false;
        this.isPlaying = false;
        
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
        
        // Musical scale
        this.melancholicScale = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Initializing CLEAN Soil Handler...');
        
        await this.waitForDependencies();
        this.setupAudio();
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        if (!this.frameBackground) {
            console.warn('⚠️  .framebackground element not found');
        }
        if (!this.soilCreature) {
            console.warn('⚠️  .soil-creature element not found');
        }
        
        this.setupWebSocketListener();
        
        console.log('🌱✅ CLEAN Soil Handler ready');
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
            this.synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 2.5,
                    decay: 1.0,
                    sustain: 0.4,
                    release: 4.0
                }
            });
            
            this.reverb = new Tone.Reverb({
                decay: 8.0,
                wet: 0.7
            });
            
            this.filter = new Tone.Filter({
                frequency: 800,
                type: "lowpass"
            });
            
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            
            console.log('🎵 Soil audio setup complete');
        } catch (error) {
            console.error('❌ Soil audio setup failed:', error);
        }
    }
    
    setupWebSocketListener() {
        // ✅ ONLY listen to clean state changes - no raw data processing!
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
            if (deviceType === 'soil') {
                this.handleSoilDisconnected();
            }
        });
        
        // ✅ Optional: Listen to raw data for logging only
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                console.log(`🌱 Raw data: ${data.soil_condition || data.moisture_app_value}`);
            }
        });
    }
    
    // ✅ CLEAN: Handle connection (show background once)
    handleSoilConnected() {
        if (this.isConnected) return; // Already connected
        
        this.isConnected = true;
        console.log('🌱 ✅ SOIL CONNECTED - showing background');
        this.showBackground();
    }
    
    // ✅ CLEAN: Handle state change (the main event!)
    handleSoilStateChange(stateData) {
        console.log(`🌱 🔄 SOIL STATE CHANGE: ${stateData.previousState} → ${stateData.active}`);
        console.log(`🌱 📊 Raw condition: ${stateData.rawData.soil_condition || stateData.rawData.moisture_app_value}`);
        
        if (stateData.active && !this.isPlaying) {
            // ✅ Turn ON - soil became active (humid/wet)
            console.log('🌱 ▶️  TURNING ON - soil is active');
            this.turnOn();
        } else if (!stateData.active && this.isPlaying) {
            // ✅ Turn OFF - soil became inactive (dry)
            console.log('🌱 ⏹️  TURNING OFF - soil is inactive');
            this.turnOff();
        } else {
            // ✅ No change needed
            console.log(`🌱 ➡️  No change needed (already ${this.isPlaying ? 'ON' : 'OFF'})`);
        }
    }
    
    // ✅ CLEAN: Handle disconnection (hide everything)
    handleSoilDisconnected() {
        if (!this.isConnected) return; // Already disconnected
        
        console.log('🌱 ❌ SOIL DISCONNECTED - cleaning up');
        
        this.isConnected = false;
        
        // Turn everything off
        this.hideBackground();
        if (this.isPlaying) {
            this.turnOff();
        }
    }
    
    // ✅ SIMPLE: Turn everything on
    turnOn() {
        if (this.isPlaying) return; // Already on
        
        this.isPlaying = true;
        console.log('🌱 ✅ TURNING ON - creature + music');
        
        this.showCreature();
        this.startMusic();
    }
    
    // ✅ SIMPLE: Turn everything off
    turnOff() {
        if (!this.isPlaying) return; // Already off
        
        this.isPlaying = false;
        console.log('🌱 ❌ TURNING OFF - creature + music');
        
        this.hideCreature();
        this.stopMusic();
    }
    
    // ✅ BACKGROUND MANAGEMENT
    showBackground() {
        if (this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil-background');
            this.backgroundShown = true;
            console.log('🌱 🎨 Background shown');
        }
    }
    
    hideBackground() {
        if (!this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false;
            console.log('🌱 🎨 Background hidden');
        }
    }
    
    // ✅ CREATURE MANAGEMENT
    showCreature() {
        if (this.creatureShown) return;
        
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block';
            this.creatureShown = true;
            console.log('🌱 🦎 Creature shown');
        }
    }
    
    hideCreature() {
        if (!this.creatureShown) return;
        
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            this.creatureShown = false;
            console.log('🌱 🦎 Creature hidden');
        }
    }
    
    // ✅ MUSIC MANAGEMENT
    async startMusic() {
        if (this.audioPlaying) return;
        
        if (!this.synth) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        this.audioPlaying = true;
        console.log('🌱 🎵 Music started');
        
        // Start the simple pattern
        this.playNote();
        this.scheduleNextNote();
    }
    
    stopMusic() {
        if (!this.audioPlaying) return;
        
        this.audioPlaying = false;
        console.log('🌱 🎵 Music stopped');
        
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
    
    playNote() {
        if (!this.audioPlaying || !this.synth) return;
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        console.log(`🌱 🎵 Playing: ${note}`);
        this.synth.triggerAttackRelease(note, '4n');
    }
    
    scheduleNextNote() {
        if (!this.audioPlaying) return;
        
        setTimeout(() => {
            if (this.audioPlaying) {
                this.playNote();
                this.scheduleNextNote();
            }
        }, 3000); // 3 seconds between notes
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Starting CLEAN Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}