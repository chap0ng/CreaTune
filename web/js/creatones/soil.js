// soil.js
// FIXED - Robust disconnect cleanup + better state management + Tone.js button debug

class SoilHandler {
    constructor() {
        this.synth = null;
        this.loop = null;
        this.melody = null;
        this.lastActivityTime = 0;
        this.inactivityTimeout = 500; // ms before stopping audio after soil becomes inactive
        this.isActive = false; // Current soil activity state
        this.isPlaying = false; // Whether sound is playing
        this.isConnected = false; // Whether sensor is connected 
        this.debugMode = false; // Enable for console debugging

        // DOM elements
        this.soilButton = document.getElementById('soil-button');
        this.soilStatus = document.getElementById('soil-status');
        this.soilVisuals = document.getElementById('soil-visuals');
        
        if (!this.soilButton || !this.soilStatus || !this.soilVisuals) {
            console.warn('💧 Some soil UI elements not found.');
            return;
        }
        
        // Initialize UI
        this.updateUI(false, false);
        
        // Set up event listeners when creatune is ready
        if (window.creatune) {
            this.setupListeners();
        } else {
            window.addEventListener('creatune:ready', () => this.setupListeners());
        }
        
        // Optional manual toggle for testing
        this.soilButton.addEventListener('click', () => {
            if (!this.isConnected) {
                console.log('💧 Soil sensor not connected, cannot toggle.');
                return;
            }
            
            // Only manual toggle for testing
            console.log('💧 Soil button clicked (debug only)');
            // this.toggleActivity(!this.isActive);
        });
        
        // Initialize Tone.js when user interacts with the page
        document.addEventListener('click', () => {
            if (!this.synth) {
                this.initTone();
            }
        }, { once: true });
    }
    
    setupListeners() {
        console.log('💧 Setting up soil listeners...');
        
        // Listen for soil state changes
        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                console.log(`💧 Soil state change: ${state.active ? 'ACTIVE' : 'INACTIVE'}`);
                this.toggleActivity(state.active);
                
                // Debug info
                if (this.debugMode && state.rawData) {
                    console.log('💧 Raw soil data:', state.rawData);
                }
            }
        });
        
        // Track connection status
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor connected!');
                this.isConnected = true;
                this.updateUI(this.isActive, true);
            }
        });
        
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor disconnected.');
                this.isConnected = false;
                this.toggleActivity(false); // Force inactive state
                this.updateUI(false, false);
            }
        });
        
        // Debug: Log all incoming soil data
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.lastActivityTime = Date.now();
                
                // Debug logging to help identify data format issues
                console.log('💧 Soil data received:', data);
                
                // This helps see exactly what fields are available in the ESP32 data
                if (this.debugMode) {
                    console.log('💧 Available fields:', Object.keys(data));
                    console.log('💧 Moisture value:', 
                        data.moisture_app_value || 
                        data.moisture || 
                        data.voltage || 
                        'Not found');
                    console.log('💧 Soil condition:', 
                        data.soil_condition || 
                        'Not specified');
                }
            }
        });
        
        // Initial state check
        const currentState = window.creatune.getDeviceState('soil');
        if (currentState) {
            this.isConnected = currentState.connected;
            this.toggleActivity(currentState.active);
            this.updateUI(currentState.active, currentState.connected);
        }
    }
    
    toggleActivity(active) {
        if (this.isActive === active) return; // No change
        
        this.isActive = active;
        console.log(`💧 Soil activity: ${active ? 'ACTIVE ▶️' : 'INACTIVE ⏹️'}`);
        
        if (active) {
            this.startAudio();
        } else {
            // Give a small delay before stopping to avoid rapid on/off
            setTimeout(() => {
                // Check if we're still inactive after the timeout
                if (!this.isActive && this.isPlaying) {
                    this.stopAudio();
                }
            }, this.inactivityTimeout);
        }
        
        this.updateUI(active, this.isConnected);
    }
    
    updateUI(active, connected) {
        if (!this.soilButton || !this.soilStatus) return;
        
        // Update button state
        this.soilButton.classList.toggle('active', active);
        this.soilButton.classList.toggle('connected', connected);
        
        // Update status text
        if (!connected) {
            this.soilStatus.textContent = 'Disconnected';
            this.soilStatus.className = 'status disconnected';
        } else if (active) {
            this.soilStatus.textContent = 'Active';
            this.soilStatus.className = 'status active';
        } else {
            this.soilStatus.textContent = 'Inactive';
            this.soilStatus.className = 'status inactive';
        }
        
        // Update visuals
        if (this.soilVisuals) {
            this.soilVisuals.classList.toggle('active', active);
            this.soilVisuals.classList.toggle('connected', connected);
        }
    }
    
    initTone() {
        // Don't reinitialize if already set up
        if (this.synth) return;
        
        if (!window.Tone) {
            console.error('💧 Tone.js is not loaded');
            return;
        }
        
        // Create synthesizer
        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
        
        // Add soft reverb
        const reverb = new Tone.Reverb({
            decay: 2.5,
            wet: 0.4
        }).toDestination();
        this.synth.connect(reverb);
        
        // Set volume
        this.synth.volume.value = -10; // dB
        
        // Create melody pattern for soil
        this.melody = [
            { note: 'C4', dur: '8n' },
            { note: 'E4', dur: '8n' },
            { note: 'G4', dur: '8n' },
            { note: 'B4', dur: '8n' },
            { note: 'C5', dur: '4n' },
        ];
        
        console.log('💧 Tone.js initialized for soil');
    }
    
    startAudio() {
        if (!this.synth || this.isPlaying) return;
        
        // Start Tone.js context if needed
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        
        let noteIndex = 0;
        
        // Create repeating pattern (if not already created)
        this.loop = new Tone.Loop((time) => {
            const melodyNote = this.melody[noteIndex % this.melody.length];
            this.synth.triggerAttackRelease(melodyNote.note, melodyNote.dur, time);
            noteIndex++;
        }, '0.5s').start(0);
        
        Tone.Transport.start();
        this.isPlaying = true;
        console.log('💧 Soil audio started');
    }
    
    stopAudio() {
        if (!this.isPlaying) return;
        
        if (this.loop) {
            this.loop.stop();
            this.loop.dispose();
            this.loop = null;
        }
        
        Tone.Transport.stop();
        this.isPlaying = false;
        console.log('💧 Soil audio stopped');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Initializing Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}