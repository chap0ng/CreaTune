// soil.js
// TRULY STABLE - Only triggers actions when state actually changes

class SoilHandler {
    constructor() {
        // Connection state
        this.isConnected = false;
        this.backgroundShown = false;    // Track if background is currently shown
        
        // Audio/creature state  
        this.isActive = false;
        this.creatureShown = false;      // Track if creature is currently shown
        this.audioPlaying = false;       // Track if audio is currently playing
        
        // Data tracking
        this.lastCondition = null;
        this.lastDataTime = 0;
        this.dataTimeoutMs = 15000;
        
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
        console.log('🌱 Initializing TRULY STABLE Soil Handler...');
        
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
        
        console.log('🌱✅ TRULY STABLE Soil Handler ready');
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
        
        // ✅ CONNECTION STATE - Only change ONCE
        if (!this.isConnected) {
            this.isConnected = true;
            console.log('🌱 ✅ ESP32 CONNECTED - showing background');
            this.showBackgroundOnce();
        }
        
        // ✅ STABLE CONDITION CHECKING - prevent flickering
        const rawCondition = this.determineRawCondition(data);
        const stableCondition = this.getStableCondition(rawCondition);
        
        // Only process if the STABLE condition actually changed
        if (stableCondition !== null && stableCondition !== this.lastCondition) {
            console.log(`🌱 STABLE condition changed: ${this.lastCondition} → ${stableCondition}`);
            this.lastCondition = stableCondition;
            
            // ✅ RESPONSE STATE - Only change when stable condition changes
            if (stableCondition === 'humid' || stableCondition === 'wet') {
                if (!this.isActive) {
                    console.log('🌱🎵 ACTIVATING response (stable data in range)');
                    this.activateResponseOnce();
                }
            } else {
                if (this.isActive) {
                    console.log('🌱🔇 DEACTIVATING response (stable data out of range)');
                    this.deactivateResponseOnce();
                }
            }
        } else if (stableCondition === null) {
            // Still stabilizing - don't make any changes
            console.log(`🌱 Condition stabilizing... (${this.conditionHistory.length}/${this.conditionStabilityCount})`);
        }
        // ✅ If stable condition hasn't changed, do NOTHING (no retriggering)
    }
    
    // ✅ IMPROVED: Raw condition with hysteresis to prevent oscillation
    determineRawCondition(data) {
        let value = null;
        
        // Get the moisture value
        if (data.soil_condition) {
            // If ESP32 provides explicit condition, trust it
            return data.soil_condition;
        } else if (data.moisture_app_value !== undefined) {
            value = data.moisture_app_value;
        } else {
            return null;
        }
        
        // ✅ HYSTERESIS: Different thresholds based on current state to prevent flicker
        const currentCondition = this.lastCondition;
        
        if (currentCondition === 'dry') {
            // From dry, need higher threshold to become humid
            if (value >= this.thresholds.dryToHumid) {
                return value >= this.thresholds.humidToWet ? 'wet' : 'humid';
            } else {
                return 'dry';
            }
        } else if (currentCondition === 'humid') {
            // From humid, need lower threshold to become dry, higher to become wet
            if (value <= this.thresholds.humidToDry) {
                return 'dry';
            } else if (value >= this.thresholds.humidToWet) {
                return 'wet';
            } else {
                return 'humid';
            }
        } else if (currentCondition === 'wet') {
            // From wet, need lower threshold to become humid
            if (value <= this.thresholds.wetToHumid) {
                return value <= this.thresholds.humidToDry ? 'dry' : 'humid';
            } else {
                return 'wet';
            }
        } else {
            // First reading or null condition - use simple thresholds
            if (value <= 0.4) {
                return 'dry';
            } else if (value <= 0.7) {
                return 'humid';
            } else {
                return 'wet';
            }
        }
    }
    
    // ✅ NEW: Stable condition checking - requires multiple consistent readings
    getStableCondition(rawCondition) {
        if (rawCondition === null) return null;
        
        // Add to history
        this.conditionHistory.push(rawCondition);
        
        // Keep only recent history
        if (this.conditionHistory.length > this.maxConditionHistory) {
            this.conditionHistory.shift();
        }
        
        // Check if we have enough readings
        if (this.conditionHistory.length < this.conditionStabilityCount) {
            return null; // Not enough data yet
        }
        
        // Check if last N readings are consistent
        const recentReadings = this.conditionHistory.slice(-this.conditionStabilityCount);
        const isConsistent = recentReadings.every(reading => reading === recentReadings[0]);
        
        if (isConsistent) {
            console.log(`🌱 Condition STABLE: ${recentReadings[0]} (${this.conditionStabilityCount} consistent readings)`);
            return recentReadings[0];
        } else {
            console.log(`🌱 Condition unstable: [${recentReadings.join(', ')}] - waiting for consistency`);
            return null; // Still fluctuating
        }
    }
    
    // ✅ SHOW BACKGROUND ONLY ONCE
    showBackgroundOnce() {
        if (this.backgroundShown) return; // Already shown
        
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil-background');
            this.backgroundShown = true;
            console.log('🌱 ✅ Background shown (ONCE)');
        }
    }
    
    // ✅ HIDE BACKGROUND ONLY ONCE  
    hideBackgroundOnce() {
        if (!this.backgroundShown) return; // Already hidden
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false;
            console.log('🌱 ❌ Background hidden (ONCE)');
        }
    }
    
    // ✅ ACTIVATE RESPONSE ONLY ONCE
    activateResponseOnce() {
        if (this.isActive) return; // Already active
        
        this.isActive = true;
        
        // Show creature once
        this.showCreatureOnce();
        
        // Start audio once
        this.startAudioOnce();
    }
    
    // ✅ DEACTIVATE RESPONSE ONLY ONCE
    deactivateResponseOnce() {
        if (!this.isActive) return; // Already inactive
        
        this.isActive = false;
        
        // Hide creature once
        this.hideCreatureOnce();
        
        // Stop audio once
        this.stopAudioOnce();
    }
    
    // ✅ SHOW CREATURE ONLY ONCE
    showCreatureOnce() {
        if (this.creatureShown) return; // Already shown
        
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block';
            this.creatureShown = true;
            console.log('🌱🦎 ✅ Creature shown (ONCE)');
        }
    }
    
    // ✅ HIDE CREATURE ONLY ONCE
    hideCreatureOnce() {
        if (!this.creatureShown) return; // Already hidden
        
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            this.creatureShown = false;
            console.log('🌱🦎 ❌ Creature hidden (ONCE)');
        }
    }
    
    // ✅ START AUDIO ONLY ONCE - kicks off the pattern and lets it loop
    async startAudioOnce() {
        if (this.audioPlaying) {
            // ✅ Already playing - don't restart, just let it continue
            console.log('🌱🎵 Audio already playing - continuing pattern');
            return;
        }
        
        if (!this.synth) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        this.audioPlaying = true;
        console.log('🌱🎵 ✅ Audio pattern STARTED - will loop randomly');
        
        // ✅ Start the autonomous looping pattern
        this.startRandomPattern();
    }
    
    // ✅ STOP AUDIO ONLY ONCE
    stopAudioOnce() {
        if (!this.audioPlaying) return; // Already stopped
        
        this.audioPlaying = false;
        console.log('🌱🔇 ❌ Audio pattern STOPPED');
        
        // Stop all scheduled events
        Tone.Transport.cancel();
        
        // Release all notes
        if (this.synth) {
            this.synth.releaseAll();
        }
        
        // The audioPlaying flag will stop the recursive pattern
    }
    
    // ✅ NEW: Start autonomous random pattern that loops until stopped
    startRandomPattern() {
        if (!this.audioPlaying) return; // Safety check
        
        // Play initial sound immediately
        this.playRandomChord();
        
        // Start the self-sustaining loop
        this.scheduleNextRandomSound();
    }
    
    // ✅ IMPROVED: Self-sustaining random note scheduler
    scheduleNextRandomSound() {
        if (!this.audioPlaying) {
            // Pattern has been stopped, exit the loop
            console.log('🌱🎵 Pattern loop ended');
            return;
        }
        
        // Random delay between 3-8 seconds
        const nextSoundDelay = Math.random() * 5000 + 3000;
        
        setTimeout(() => {
            if (!this.audioPlaying) {
                // Double-check - pattern might have stopped during delay
                return;
            }
            
            // Play random sound (chord or single note)
            if (Math.random() > 0.6) {
                this.playRandomChord();
            } else {
                this.playRandomNote();
            }
            
            // Schedule the next sound (recursive loop)
            this.scheduleNextRandomSound();
            
        }, nextSoundDelay);
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
        if (!this.isConnected) return; // Already disconnected
        
        console.log('🌱❌ ESP32 DISCONNECTED - cleaning up');
        
        // Reset all states
        this.isConnected = false;
        this.lastDataTime = 0;
        this.lastCondition = null;
        
        // ✅ Reset condition history for clean slate
        this.conditionHistory = [];
        
        // Hide everything once
        this.hideBackgroundOnce();
        this.deactivateResponseOnce();
    }
    
    playRandomChord() {
        if (!this.synth || !this.audioPlaying) return;
        
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
    
    playRandomNote() {
        if (!this.synth || !this.audioPlaying) return;
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        const duration = Math.random() > 0.5 ? '2n' : '4n';
        
        console.log('🌱🎵 Playing note:', note);
        this.synth.triggerAttackRelease(note, duration);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Starting TRULY STABLE Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}