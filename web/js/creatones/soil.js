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
        
        // Musical scale - Higher octave for toy piano brightness
        this.melancholicScale = [
            'C4', 'D4', 'E4', 'G4', 'A4',    // Pentatonic base
            'C5', 'D5', 'E5', 'G5', 'A5',    // Higher octave for sparkle
            'F4', 'B4', 'F5', 'B5'           // Extra notes for variation
        ];
        
        // ✅ RHYTHM VARIATIONS - Different note lengths and patterns
        this.rhythmPatterns = [
            { notes: 1, durations: ['4n'], delay: 3000 },           // Single quarter note, 3s gap
            { notes: 2, durations: ['8n', '8n'], delay: 2000 },     // Two eighth notes, 2s gap  
            { notes: 1, durations: ['2n'], delay: 4000 },           // Long half note, 4s gap
            { notes: 3, durations: ['16n', '8n', '16n'], delay: 2500 }, // Quick-slow-quick pattern
            { notes: 0, durations: [], delay: 2000 }                // ✅ SILENCE - no notes, just pause
        ];
        
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
            // ✅ TOY PIANO SOUND - Bright, metallic, bell-like
            this.synth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 8,      // High harmonicity for metallic toy piano sound
                modulationIndex: 25, // High modulation for bright, bell-like tone
                oscillator: {
                    type: "sawtooth" // Sawtooth wave for brightness
                },
                envelope: {
                    attack: 0.001,   // Very fast attack for percussive toy piano
                    decay: 0.4,      // Quick decay like toy piano keys
                    sustain: 0.1,    // Low sustain for authentic toy piano
                    release: 1.2     // Medium release
                },
                modulation: {
                    type: "square"   // Square wave modulation for toy-like character
                },
                modulationEnvelope: {
                    attack: 0.01,
                    decay: 0.5,
                    sustain: 0,      // No sustain on modulation
                    release: 0.2
                }
            });
            
            // ✅ LIGHTER REVERB - Toy pianos don't have much reverb
            this.reverb = new Tone.Reverb({
                decay: 2.0,      // Shorter decay
                wet: 0.3         // Less reverb for cleaner toy piano sound
            });
            
            // ✅ HIGH-PASS FILTER - Remove muddy low frequencies
            this.filter = new Tone.Filter({
                frequency: 200,  // Cut low frequencies for brighter sound
                type: "highpass"
            });
            
            // Connect: synth -> filter -> reverb -> output
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            
            // ✅ Adjust volume for toy piano brightness
            this.synth.volume.value = -8; // Slightly quieter but clear
            
            console.log('🎵 Toy piano audio setup complete');
        } catch (error) {
            console.error('❌ Toy piano audio setup failed:', error);
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
    
    // ✅ MUSIC MANAGEMENT - More interesting patterns
    async startMusic() {
        if (this.audioPlaying) return;
        
        if (!this.synth) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        this.audioPlaying = true;
        console.log('🌱 🎹 Toy piano music started');
        
        // Start the varied pattern
        this.playPattern();
    }
    
    stopMusic() {
        if (!this.audioPlaying) return;
        
        this.audioPlaying = false;
        console.log('🌱 🎹 Toy piano music stopped');
        
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
    
    // ✅ PLAY VARIED PATTERNS - Much more interesting!
    playPattern() {
        if (!this.audioPlaying || !this.synth) return;
        
        // ✅ Pick a random rhythm pattern
        const pattern = this.rhythmPatterns[Math.floor(Math.random() * this.rhythmPatterns.length)];
        
        if (pattern.notes === 0) {
            // ✅ SILENCE PATTERN - Just pause
            console.log('🌱 🔇 Playing silence...');
        } else {
            // ✅ PLAY NOTES PATTERN
            console.log(`🌱 🎹 Playing ${pattern.notes}-note pattern: ${pattern.durations.join(' ')}`);
            this.playNotesSequence(pattern);
        }
        
        // ✅ Schedule next pattern with pattern-specific delay
        setTimeout(() => {
            if (this.audioPlaying) {
                this.playPattern(); // Recursive - keeps going
            }
        }, pattern.delay);
    }
    
    // ✅ PLAY SEQUENCE OF NOTES - For complex patterns
    playNotesSequence(pattern) {
        let totalDelay = 0;
        
        for (let i = 0; i < pattern.notes; i++) {
            const note = this.getRandomNote();
            const duration = pattern.durations[i] || '4n';
            
            // Schedule each note in the sequence
            setTimeout(() => {
                if (this.audioPlaying && this.synth) {
                    console.log(`🌱 🎵 Playing: ${note} (${duration})`);
                    this.synth.triggerAttackRelease(note, duration);
                }
            }, totalDelay);
            
            // Calculate delay for next note based on duration
            const durationMs = this.durationToMs(duration);
            totalDelay += durationMs * 0.6; // Overlap notes slightly for musical flow
        }
    }
    
    // ✅ GET RANDOM NOTE - With weighted selection for better melodies
    getRandomNote() {
        // ✅ Favor middle register notes (more musical)
        const weights = [
            1, 1, 2, 2, 2,    // C4-A4 (lower) - normal weight
            3, 3, 4, 4, 3,    // C5-A5 (higher) - higher weight for brightness
            1, 2, 1, 2        // F4, B4, F5, B5 - occasional accents
        ];
        
        // Weighted random selection
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < this.melancholicScale.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return this.melancholicScale[i];
            }
        }
        
        // Fallback
        return this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
    }
    
    // ✅ CONVERT TONE.JS DURATIONS TO MILLISECONDS
    durationToMs(duration) {
        const bpm = 120; // Assume 120 BPM
        const beatMs = 60000 / bpm; // ~500ms per beat
        
        switch (duration) {
            case '16n': return beatMs / 4;  // ~125ms
            case '8n': return beatMs / 2;   // ~250ms  
            case '4n': return beatMs;       // ~500ms
            case '2n': return beatMs * 2;   // ~1000ms
            default: return beatMs;
        }
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