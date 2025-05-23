// soil.js
// Handles soil sensor data and audio/visual feedback

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.lastCondition = null;
        this.isConnected = false; // Track connection state
        this.synth = null;
        this.reverb = null;
        this.filter = null;
        this.frameBackground = null;
        this.soilCreature = null;
        
        // Ambient melancholic scale (Am pentatonic + some blue notes)
        this.melancholicScale = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Initializing Soil Handler...');
        
        // Wait for Tone.js and WebSocket client
        await this.waitForDependencies();
        
        // Setup audio
        this.setupAudio();
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        // Listen to WebSocket client
        this.setupWebSocketListener();
        
        console.log('🌱✅ Soil Handler ready');
    }
    
    async waitForDependencies() {
        // Wait for Tone.js
        while (typeof Tone === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Wait for WebSocket client
        while (!window.creatune) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    async setupAudio() {
        try {
            // Create ambient synth with melancholic characteristics
            this.synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 2.5,    // Slow attack for ambient feel
                    decay: 1.0,
                    sustain: 0.4,   // Lower sustain for melancholy
                    release: 4.0    // Long release for ambient tail
                }
            });
            
            // Add reverb for ambient space
            this.reverb = new Tone.Reverb({
                decay: 8.0,     // Long decay for ambient
                wet: 0.7        // Lots of reverb
            });
            
            // Low-pass filter for warmth
            this.filter = new Tone.Filter({
                frequency: 800,  // Cut high frequencies
                type: "lowpass"
            });
            
            // Connect the chain: synth -> filter -> reverb -> output
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            
            console.log('🎵 Soil audio setup complete');
        } catch (error) {
            console.error('❌ Soil audio setup failed:', error);
        }
    }
    
    setupWebSocketListener() {
        // Listen for soil device data
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.handleSoilData(data);
            }
        });
        
        // Listen for device status changes
        window.creatune.on('status', (devices, combinedName) => {
            this.handleStatusChange(devices.soil);
        });
        
        // Listen for disconnections
        window.creatune.on('disconnect', (deviceType) => {
            if (deviceType === 'soil') {
                this.handleSoilDisconnect();
            }
        });
    }
    
    handleSoilData(data) {
        console.log('🌱 Soil data received:', data);
        
        // Only show background if we're actually connected
        // (this prevents spam when receiving data)
        if (this.isConnected) {
            // Check soil condition from Arduino data
            let condition = null;
            if (data.soil_condition) {
                condition = data.soil_condition;
            } else if (data.moisture_app_value !== undefined) {
                // Fallback: determine condition from app value
                if (data.moisture_app_value <= 0.4) {
                    condition = 'dry';
                } else if (data.moisture_app_value <= 0.7) {
                    condition = 'humid';
                } else {
                    condition = 'wet';
                }
            }
            
            console.log(`🌱 Soil condition: ${condition}`);
            
            // Handle humid or wet conditions
            if (condition === 'humid' || condition === 'wet') {
                this.activateSoilResponse();
            } else {
                this.deactivateSoilResponse();
            }
            
            this.lastCondition = condition;
        }
    }
    
    handleStatusChange(soilDevice) {
        const newConnectionState = soilDevice && soilDevice.connected;
        
        // Only act on actual state transitions
        if (newConnectionState !== this.isConnected) {
            this.isConnected = newConnectionState;
            
            if (this.isConnected) {
                console.log('🌱 Soil device connected (state change)');
                this.showSoilBackground();
            } else {
                console.log('🌱 Soil device disconnected (state change)');
                this.handleSoilDisconnect();
            }
        }
        // If state hasn't changed, don't do anything (prevents spam)
    }
    
    handleSoilDisconnect() {
        console.log('🌱❌ Soil disconnected');
        this.isConnected = false; // Ensure state is updated
        this.hideSoilBackground();
        this.deactivateSoilResponse();
    }
    
    showSoilBackground() {
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil-background');
            console.log('🌱 Showing soil background');
        }
    }
    
    hideSoilBackground() {
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            console.log('🌱 Hiding soil background');
        }
    }
    
    activateSoilResponse() {
        if (this.isActive) return; // Already active
        
        this.isActive = true;
        console.log('🌱🎵 Activating soil response (humid/wet)');
        
        // Show soil creature
        this.showSoilCreature();
        
        // Start playing ambient tones
        this.startAmbientTones();
    }
    
    deactivateSoilResponse() {
        if (!this.isActive) return; // Already inactive
        
        this.isActive = false;
        console.log('🌱🔇 Deactivating soil response (dry)');
        
        // Hide soil creature
        this.hideSoilCreature();
        
        // Stop ambient tones
        this.stopAmbientTones();
    }
    
    showSoilCreature() {
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block';
            console.log('🌱🦎 Showing soil creature');
        }
    }
    
    hideSoilCreature() {
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            console.log('🌱🦎 Hiding soil creature');
        }
    }
    
    async startAmbientTones() {
        if (!this.synth) return;
        
        // Ensure audio context is started
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        console.log('🌱🎵 Starting melancholic ambient tones');
        
        // Play initial chord
        this.playRandomChord();
        
        // Schedule random notes
        this.scheduleRandomNotes();
    }
    
    stopAmbientTones() {
        console.log('🌱🔇 Stopping ambient tones');
        
        // Stop all scheduled events
        Tone.Transport.cancel();
        
        // Release all notes
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
    
    playRandomChord() {
        if (!this.synth || !this.isActive) return;
        
        // Play 2-3 notes from the melancholic scale
        const chordSize = Math.random() > 0.5 ? 2 : 3;
        const chord = [];
        
        for (let i = 0; i < chordSize; i++) {
            const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
            if (!chord.includes(note)) {
                chord.push(note);
            }
        }
        
        console.log('🌱🎵 Playing chord:', chord);
        this.synth.triggerAttackRelease(chord, '4n');
    }
    
    scheduleRandomNotes() {
        if (!this.isActive) return;
        
        // Schedule next note in 3-8 seconds
        const nextNoteTime = Math.random() * 5000 + 3000;
        
        setTimeout(() => {
            if (this.isActive) {
                // Randomly choose between single note or chord
                if (Math.random() > 0.6) {
                    this.playRandomChord();
                } else {
                    this.playRandomNote();
                }
                
                // Schedule next note
                this.scheduleRandomNotes();
            }
        }, nextNoteTime);
    }
    
    playRandomNote() {
        if (!this.synth || !this.isActive) return;
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        const duration = Math.random() > 0.5 ? '2n' : '4n'; // Half or quarter note
        
        console.log('🌱🎵 Playing note:', note);
        this.synth.triggerAttackRelease(note, duration);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Starting Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}