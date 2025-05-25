// soil.js
// Handles soil sensor data and audio/visual feedback with stability improvements

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.lastCondition = null;
        this.isConnected = false;
        this.visuallyConnected = false; // Separate visual state from connection state
        
        // Stability features
        this.connectionDebounceTimer = null;
        this.connectionStabilityDelay = 2000; // 2 seconds
        this.lastDataTime = 0;
        this.dataTimeout = 10000; // 10 seconds without data = disconnect
        this.connectionStateHistory = []; // Track connection state history
        this.maxHistoryLength = 5;
        
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
        
        // Start data timeout checker
        this.startDataTimeoutChecker();
        
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
            this.handleStatusChangeStable(devices.soil);
        });
        
        // Listen for disconnections
        window.creatune.on('disconnect', (deviceType) => {
            if (deviceType === 'soil') {
                this.handleSoilDisconnectStable();
            }
        });
    }
    
    // Stable connection state handling with debouncing
    handleStatusChangeStable(soilDevice) {
        const newConnectionState = soilDevice && soilDevice.connected;
        
        // Add to connection history
        this.connectionStateHistory.push({
            connected: newConnectionState,
            timestamp: Date.now()
        });
        
        // Keep only recent history
        if (this.connectionStateHistory.length > this.maxHistoryLength) {
            this.connectionStateHistory.shift();
        }
        
        // Clear any existing debounce timer
        if (this.connectionDebounceTimer) {
            clearTimeout(this.connectionDebounceTimer);
        }
        
        // Set new debounce timer
        this.connectionDebounceTimer = setTimeout(() => {
            this.processStableConnectionState(newConnectionState);
        }, this.connectionStabilityDelay);
        
        console.log(`🌱 Connection state queued: ${newConnectionState} (debounced ${this.connectionStabilityDelay}ms)`);
    }
    
    processStableConnectionState(newConnectionState) {
        // Check if connection state has been stable
        const recentStates = this.connectionStateHistory.slice(-3); // Last 3 states
        const isStable = recentStates.length >= 2 && 
                        recentStates.every(state => state.connected === newConnectionState);
        
        if (!isStable) {
            console.log('🌱 Connection state unstable, waiting for stability...');
            return;
        }
        
        // Only update visual state if there's an actual change
        if (newConnectionState !== this.visuallyConnected) {
            this.visuallyConnected = newConnectionState;
            this.isConnected = newConnectionState;
            
            if (this.visuallyConnected) {
                console.log('🌱 Soil device STABLE connection established');
                this.showSoilBackground();
            } else {
                console.log('🌱 Soil device STABLE disconnection confirmed');
                this.handleSoilDisconnect();
            }
        }
    }
    
    handleSoilDisconnectStable() {
        console.log('🌱 Soil disconnect event received');
        
        // Clear debounce timer
        if (this.connectionDebounceTimer) {
            clearTimeout(this.connectionDebounceTimer);
        }
        
        // Set disconnect with delay to avoid flicker
        this.connectionDebounceTimer = setTimeout(() => {
            this.processStableConnectionState(false);
        }, 1000); // Shorter delay for disconnects
    }
    
    // Data timeout checker
    startDataTimeoutChecker() {
        setInterval(() => {
            if (this.lastDataTime > 0 && 
                Date.now() - this.lastDataTime > this.dataTimeout &&
                this.visuallyConnected) {
                
                console.log('🌱⏰ Data timeout - marking as disconnected');
                this.visuallyConnected = false;
                this.isConnected = false;
                this.handleSoilDisconnect();
            }
        }, 5000); // Check every 5 seconds
    }
    
    handleSoilData(data) {
        console.log('🌱 Soil data received:', data);
        
        // Update last data time
        this.lastDataTime = Date.now();
        
        // If we receive data, we must be connected (trust the data over status)
        if (!this.isConnected) {
            console.log('🌱 Data received - confirming connection');
            this.isConnected = true;
            this.visuallyConnected = true;
            this.showSoilBackground();
        }
        
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
        
        // Handle humid or wet conditions (with stability check)
        if (condition === 'humid' || condition === 'wet') {
            this.activateSoilResponseStable();
        } else {
            this.deactivateSoilResponseStable();
        }
        
        this.lastCondition = condition;
    }
    
    // Stable response activation with additional checks
    activateSoilResponseStable() {
        if (this.isActive) return; // Already active
        
        // Only activate if visually connected
        if (!this.visuallyConnected) {
            console.log('🌱 Skipping activation - not visually connected');
            return;
        }
        
        this.isActive = true;
        console.log('🌱🎵 STABLE activation - soil response (humid/wet)');
        
        // Show soil creature
        this.showSoilCreature();
        
        // Start playing ambient tones
        this.startAmbientTones();
    }
    
    deactivateSoilResponseStable() {
        if (!this.isActive) return; // Already inactive
        
        this.isActive = false;
        console.log('🌱🔇 STABLE deactivation - soil response (dry)');
        
        // Hide soil creature
        this.hideSoilCreature();
        
        // Stop ambient tones
        this.stopAmbientTones();
    }
    
    handleSoilDisconnect() {
        console.log('🌱❌ Soil disconnected - cleaning up');
        this.isConnected = false;
        this.visuallyConnected = false;
        this.lastDataTime = 0;
        this.hideSoilBackground();
        this.deactivateSoilResponseStable();
    }
    
    showSoilBackground() {
        if (this.frameBackground && !this.frameBackground.classList.contains('soil-background')) {
            this.frameBackground.classList.add('soil-background');
            console.log('🌱 ✅ STABLE - Showing soil background');
        }
    }
    
    hideSoilBackground() {
        if (this.frameBackground && this.frameBackground.classList.contains('soil-background')) {
            this.frameBackground.classList.remove('soil-background');
            console.log('🌱 ❌ STABLE - Hiding soil background');
        }
    }
    
    showSoilCreature() {
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block';
            console.log('🌱🦎 ✅ STABLE - Showing soil creature');
        }
    }
    
    hideSoilCreature() {
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            console.log('🌱🦎 ❌ STABLE - Hiding soil creature');
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
    console.log('🌱 Starting Stable Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}