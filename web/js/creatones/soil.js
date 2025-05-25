// soil.js
// PLAY BUTTON APPROACH - Simple and stable

class SoilHandler {
    constructor() {
        // Connection state
        this.isConnected = false;
        this.backgroundShown = false;
        
        // ✅ PLAY BUTTON STATE - Simple on/off
        this.isPlaying = false;          // Is the "play button" pressed?
        this.creatureShown = false;      // Visual state tracking
        this.audioPlaying = false;       // Audio state tracking
        
        // Data tracking
        this.lastCondition = null;       // Track last ESP32 condition
        this.lastDataTime = 0;       // Last time data was received
        this.dataTimeoutMs = 15000; // Timeout for data inactivity
        this.dataTimeout = null;         // Timeout reference

        
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
        console.log('🌱 Initializing PLAY BUTTON Soil Handler...');
        
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
        this.startTimeoutChecker();
        
        console.log('🌱✅ PLAY BUTTON Soil Handler ready');
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
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.handleSoilData(data);
            }
        });
        
        window.creatune.on('disconnect', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('🌱 Explicit soil disconnect received');
                this.handleSoilDisconnect();
            }
        });
        
        window.creatune.on('all_disconnected', () => {
            console.log('🌱 All devices disconnected');
            this.handleSoilDisconnect();
        });
    }
    
    handleSoilData(data) {
        console.log('🌱 Soil data received:', JSON.stringify(data));
        
        this.lastDataTime = Date.now();
        
        // ✅ CONNECTION - Show background once
        if (!this.isConnected) {
            this.isConnected = true;
            console.log('🌱 ✅ ESP32 CONNECTED - showing background');
            this.showBackgroundOnce();
        }
        
        // ✅ GET CURRENT CONDITION
        const currentCondition = this.getCurrentCondition(data);
        console.log(`🌱 Current condition: ${currentCondition}`);
        
        // ✅ PLAY BUTTON LOGIC - Only act on condition changes
        if (currentCondition !== this.lastCondition) {
            console.log(`🌱 ✅ CONDITION CHANGE: ${this.lastCondition} → ${currentCondition}`);
            
            const shouldPlay = (currentCondition === 'humid' || currentCondition === 'wet');
            
            if (shouldPlay && !this.isPlaying) {
                // ✅ "CLICK" PLAY BUTTON - Start everything
                console.log('🌱▶️ CLICKING PLAY BUTTON (humid/wet detected)');
                this.clickPlayButton();
            } else if (!shouldPlay && this.isPlaying) {
                // ✅ "CLICK" STOP BUTTON - Stop everything
                console.log('🌱⏹️ CLICKING STOP BUTTON (dry detected)');
                this.clickStopButton();
            } else {
                // ✅ No change needed
                console.log(`🌱➡️ No change needed (already ${this.isPlaying ? 'playing' : 'stopped'})`);
            }
            
            this.lastCondition = currentCondition;
        } else {
            // ✅ Same condition - do nothing (no spam)
            console.log(`🌱➡️ Same condition (${currentCondition}) - no action needed`);
        }
    }
    
    // ✅ SIMPLE: Get condition from ESP32 data
    getCurrentCondition(data) {
        if (data.soil_condition) {
            return data.soil_condition; // "dry", "humid", "wet"
        } else if (data.moisture_app_value !== undefined) {
            // Fallback
            const value = data.moisture_app_value;
            if (value <= 0.4) {
                return 'dry';
            } else if (value <= 0.7) {
                return 'humid';
            } else {
                return 'wet';
            }
        }
        return 'unknown';
    }
    
    // ✅ "CLICK" PLAY BUTTON - Start creature + synth
    clickPlayButton() {
        if (this.isPlaying) {
            console.log('🌱▶️ Already playing - ignoring click');
            return;
        }
        
        this.isPlaying = true;
        console.log('🌱▶️ ✅ PLAY BUTTON CLICKED - Starting everything');
        
        // Show creature
        this.showCreature();
        
        // Start synth
        this.startSynth();
    }
    
    // ✅ "CLICK" STOP BUTTON - Stop creature + synth
    clickStopButton() {
        if (!this.isPlaying) {
            console.log('🌱⏹️ Already stopped - ignoring click');
            return;
        }
        
        this.isPlaying = false;
        console.log('🌱⏹️ ✅ STOP BUTTON CLICKED - Stopping everything');
        
        // Hide creature
        this.hideCreature();
        
        // Stop synth
        this.stopSynth();
    }
    
    // ✅ SHOW CREATURE
    showCreature() {
        if (!this.soilCreature || this.creatureShown) return;
        
        this.soilCreature.classList.add('active');
        this.soilCreature.style.display = 'block';
        this.creatureShown = true;
        console.log('🌱🦎 ✅ Creature shown');
    }
    
    // ✅ HIDE CREATURE
    hideCreature() {
        if (!this.soilCreature || !this.creatureShown) return;
        
        this.soilCreature.classList.remove('active');
        this.soilCreature.style.display = 'none';
        this.creatureShown = false;
        console.log('🌱🦎 ❌ Creature hidden');
    }
    
    // ✅ SIMPLE: Start synth pattern
    async startSynth() {
        if (this.audioPlaying) return;
        
        if (!this.synth) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        this.audioPlaying = true;
        console.log('🌱🎵 ✅ Music started');
        
        // Start immediately and schedule next
        this.playRandomSound();
        this.scheduleNextSound();
    }
    
    // ✅ SIMPLE: Stop synth pattern
    stopSynth() {
        if (!this.audioPlaying) return;
        
        this.audioPlaying = false;
        console.log('🌱🎵 ❌ Music stopped');
        
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
    
    // ✅ SIMPLE: Just play random notes - no complex chords
    playRandomSound() {
        if (!this.audioPlaying || !this.synth) return;
        
        // Simple: just pick a random note and play it
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        
        console.log(`🌱🎵 Playing: ${note}`);
        this.synth.triggerAttackRelease(note, '4n');
    }
    
    // ✅ SIMPLE: Just schedule the next sound
    scheduleNextSound() {
        if (!this.audioPlaying) return;
        
        // Simple: 3 seconds between notes
        setTimeout(() => {
            if (this.audioPlaying) {
                this.playRandomSound();
                this.scheduleNextSound(); // Continue
            }
        }, 3000);
    }
    
    playRandomChord() {
        if (!this.synth || !this.audioPlaying) return;
        
        // ✅ FIXED: Ensure we always get the right number of notes
        const chordSize = Math.floor(Math.random() * 4) + 1; // 1, 2, 3, or 4 notes
        const chord = [];
        const availableNotes = [...this.melancholicScale]; // Copy the scale
        
        // ✅ Pick unique notes by removing them from available notes
        for (let i = 0; i < chordSize && availableNotes.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableNotes.length);
            const note = availableNotes[randomIndex];
            chord.push(note);
            availableNotes.splice(randomIndex, 1); // Remove so we don't pick it again
        }
        
        // ✅ Safety check - ensure we have at least one note
        if (chord.length === 0) {
            chord.push(this.melancholicScale[0]); // Fallback to first note
        }
        
        // ✅ Varied durations for chords
        const durations = ['16n', '8n', '4n'];
        const duration = durations[Math.floor(Math.random() * durations.length)];
        
        console.log(`🌱🎵 🎹 Playing ${chord.length}-note chord: ${chord.join(' + ')} (${duration})`);
        
        try {
            this.synth.triggerAttackRelease(chord, duration);
        } catch (error) {
            console.error('🌱🎵 ❌ Chord play error:', error);
            // Fallback to single note
            this.synth.triggerAttackRelease(chord[0], duration);
        }
    }
    
    playRandomNote() {
        if (!this.synth || !this.audioPlaying) return;
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        
        // ✅ More varied durations: 16n, 8n, or 4n for rhythmic variety
        const durations = ['16n', '8n', '4n'];
        const duration = durations[Math.floor(Math.random() * durations.length)];
        
        console.log(`🌱🎵 🎵 Playing note: ${note} (${duration})`);
        
        try {
            this.synth.triggerAttackRelease(note, duration);
        } catch (error) {
            console.error('🌱🎵 ❌ Note play error:', error);
        }
    }
    
    // ✅ BACKGROUND MANAGEMENT (unchanged)
    showBackgroundOnce() {
        if (this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil-background');
            this.backgroundShown = true;
            console.log('🌱 ✅ Background shown');
        }
    }
    
    hideBackgroundOnce() {
        if (!this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false;
            console.log('🌱 ❌ Background hidden');
        }
    }
    
    startTimeoutChecker() {
        setInterval(() => {
            if (this.isConnected && 
                this.lastDataTime > 0 && 
                Date.now() - this.lastDataTime > this.dataTimeoutMs) {
                
                console.log('🌱 ❌ CONNECTION LOST - data timeout');
                this.handleSoilDisconnect();
            }
        }, 3000);
    }
    
    handleSoilDisconnect() {
        if (!this.isConnected) return;
        
        console.log('🌱❌ ESP32 DISCONNECTED - cleaning up');
        
        // Reset states
        this.isConnected = false;
        this.lastDataTime = 0;
        this.lastCondition = null;
        
        // Stop everything
        this.hideBackgroundOnce();
        if (this.isPlaying) {
            this.clickStopButton();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Starting PLAY BUTTON Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}