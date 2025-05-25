// soil.js
// ULTRA-STABLE soil handler - fixes all visual flickering issues

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.lastCondition = null;
        this.isConnected = false;
        this.backgroundVisible = false; // Track background state separately
        this.creatureVisible = false;   // Track creature state separately
        
        // Stability timers
        this.connectionTimer = null;
        this.backgroundTimer = null;
        this.creatureTimer = null;
        
        // Data tracking
        this.lastDataTime = 0;
        this.dataTimeoutMs = 12000; // 12 seconds
        this.consecutiveDataCount = 0;
        this.connectionConfirmationThreshold = 2; // Need 2 data packets to confirm connection
        
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
        console.log('🌱 Initializing ULTRA-STABLE Soil Handler...');
        
        // Wait for Tone.js and WebSocket client
        await this.waitForDependencies();
        
        // Setup audio
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
        
        // Listen to WebSocket client - ONLY data events for stability
        this.setupWebSocketListener();
        
        // Start timeout checker
        this.startTimeoutChecker();
        
        console.log('🌱✅ ULTRA-STABLE Soil Handler ready');
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
        
        console.log('🌱 Dependencies loaded');
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
        // ✅ ONLY listen to data events - ignore status events completely
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.handleSoilDataUltraStable(data);
            }
        });
        
        // ✅ Only listen to explicit disconnect events
        window.creatune.on('disconnect', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('🌱 Explicit soil disconnect received');
                this.handleSoilDisconnectUltraStable();
            }
        });
        
        // ✅ Listen to complete WebSocket disconnection
        window.creatune.on('all_disconnected', () => {
            console.log('🌱 All devices disconnected');
            this.handleSoilDisconnectUltraStable();
        });
        
        console.log('🌱 WebSocket listeners configured (data-only mode)');
    }
    
    // ✅ ULTRA-STABLE data handling
    handleSoilDataUltraStable(data) {
        console.log('🌱 Soil data received:', JSON.stringify(data));
        
        // Update data tracking
        this.lastDataTime = Date.now();
        this.consecutiveDataCount++;
        
        // ✅ Require multiple data packets before confirming connection (prevents flicker)
        if (!this.isConnected && this.consecutiveDataCount >= this.connectionConfirmationThreshold) {
            console.log('🌱 ✅ ULTRA-STABLE CONNECTION confirmed (multiple data packets)');
            this.isConnected = true;
            this.showSoilBackgroundStable();
        }
        
        // Only process moisture if we're confirmed connected
        if (this.isConnected) {
            this.processMoistureDataStable(data);
        }
    }
    
    // ✅ Process moisture data with stability
    processMoistureDataStable(data) {
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
        
        // Only log if condition changed
        if (condition !== this.lastCondition) {
            console.log(`🌱 Soil condition changed: ${this.lastCondition} → ${condition}`);
            this.lastCondition = condition;
        }
        
        // Handle humid or wet conditions with stability
        if (condition === 'humid' || condition === 'wet') {
            this.activateSoilResponseStable();
        } else {
            this.deactivateSoilResponseStable();
        }
    }
    
    // ✅ Timeout-based disconnection checker
    startTimeoutChecker() {
        setInterval(() => {
            if (this.isConnected && 
                this.lastDataTime > 0 && 
                Date.now() - this.lastDataTime > this.dataTimeoutMs) {
                
                console.log('🌱 ❌ ULTRA-STABLE DISCONNECTION - data timeout');
                this.handleSoilDisconnectUltraStable();
            }
        }, 3000); // Check every 3 seconds
    }
    
    handleSoilDisconnectUltraStable() {
        if (!this.isConnected) return; // Already disconnected
        
        console.log('🌱❌ ULTRA-STABLE disconnect - cleaning up');
        this.isConnected = false;
        this.lastDataTime = 0;
        this.consecutiveDataCount = 0;
        
        this.hideSoilBackgroundStable();
        this.deactivateSoilResponseStable();
    }
    
    // ✅ STABLE background management with debouncing
    showSoilBackgroundStable() {
        if (this.backgroundVisible) return; // Already visible
        
        // Clear any pending background timer
        if (this.backgroundTimer) {
            clearTimeout(this.backgroundTimer);
        }
        
        // Delay background show to ensure stability
        this.backgroundTimer = setTimeout(() => {
            if (this.frameBackground && !this.backgroundVisible) {
                this.frameBackground.classList.add('soil-background');
                this.backgroundVisible = true;
                console.log('🌱 ✅ ULTRA-STABLE - Background shown');
            }
        }, 500); // 500ms delay
    }
    
    hideSoilBackgroundStable() {
        if (!this.backgroundVisible) return; // Already hidden
        
        // Clear any pending background timer
        if (this.backgroundTimer) {
            clearTimeout(this.backgroundTimer);
        }
        
        if (this.frameBackground && this.backgroundVisible) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundVisible = false;
            console.log('🌱 ❌ ULTRA-STABLE - Background hidden');
        }
    }
    
    // ✅ STABLE creature management with debouncing
    activateSoilResponseStable() {
        if (this.isActive) return; // Already active
        
        // Clear any pending creature timer
        if (this.creatureTimer) {
            clearTimeout(this.creatureTimer);
        }
        
        this.creatureTimer = setTimeout(() => {
            if (!this.isActive && this.isConnected) { // Double-check connection
                this.isActive = true;
                console.log('🌱🎵 ULTRA-STABLE activation (humid/wet)');
                
                this.showSoilCreatureStable();
                this.startAmbientTones();
            }
        }, 300); // 300ms delay
    }
    
    deactivateSoilResponseStable() {
        if (!this.isActive) return; // Already inactive
        
        // Clear any pending creature timer
        if (this.creatureTimer) {
            clearTimeout(this.creatureTimer);
        }
        
        this.creatureTimer = setTimeout(() => {
            if (this.isActive) {
                this.isActive = false;
                console.log('🌱🔇 ULTRA-STABLE deactivation (dry)');
                
                this.hideSoilCreatureStable();
                this.stopAmbientTones();
            }
        }, 300); // 300ms delay
    }
    
    showSoilCreatureStable() {
        if (this.soilCreature && !this.creatureVisible) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block';
            this.creatureVisible = true;
            console.log('🌱🦎 ✅ ULTRA-STABLE - Creature shown');
        }
    }
    
    hideSoilCreatureStable() {
        if (this.soilCreature && this.creatureVisible) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            this.creatureVisible = false;
            console.log('🌱🦎 ❌ ULTRA-STABLE - Creature hidden');
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
    console.log('🌱 Starting ULTRA-STABLE Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}