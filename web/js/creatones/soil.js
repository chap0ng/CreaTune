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
        this.originalCondition = null;   // ✅ Store actual ESP32 condition for logging
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
        
        // ✅ STORE ORIGINAL + GET NORMALIZED CONDITIONS
        this.storeOriginalCondition(data);
        const normalizedCondition = this.determineRawCondition(data);
        const stableCondition = this.getStableCondition(normalizedCondition, data.moisture_app_value);
        
        // Only process if we have a stable condition and it changed
        if (stableCondition !== null && stableCondition !== this.lastCondition) {
            console.log(`🌱 ✅ STABLE CHANGE: ${this.lastCondition} → ${stableCondition} (ESP32: ${this.originalCondition})`);
            this.lastCondition = stableCondition;
            
            // ✅ SIMPLE LOGIC: active = show creature/synth
            const shouldBeActive = this.isActiveCondition(stableCondition);
            
            if (shouldBeActive && !this.isActive) {
                console.log(`🌱🎵 ✅ ACTIVATING - soil is ${this.originalCondition}`);
                this.activateResponseOnce();
            } else if (!shouldBeActive && this.isActive) {
                console.log(`🌱🔇 ❌ DEACTIVATING - soil is ${this.originalCondition}`);
                this.deactivateResponseOnce();
            }
        } else if (stableCondition === null) {
            // Show what we're waiting for with original conditions
            const recentOriginal = this.conditionHistory.slice(-2).map(normalized => 
                normalized === 'active' ? `${this.originalCondition}(→active)` : normalized
            );
            console.log(`🌱 ⏳ Stabilizing: [${recentOriginal.join(' → ')}] (need ${this.conditionStabilityCount} consistent)`);
        }
        // ✅ If stable condition hasn't changed, do NOTHING
    }
    
    // ✅ NORMALIZE CONDITIONS: Group humid/wet together for stability
    determineRawCondition(data) {
        // ✅ Get the raw condition from ESP32
        let rawCondition = null;
        
        if (data.soil_condition) {
            rawCondition = data.soil_condition;
            console.log(`🌱 ESP32 says: ${rawCondition}`);
        } else if (data.moisture_app_value !== undefined) {
            // Fallback to app value
            const value = data.moisture_app_value;
            console.log(`🌱 Using app value: ${value}`);
            
            if (value <= 0.4) {
                rawCondition = 'dry';
            } else if (value <= 0.7) {
                rawCondition = 'humid';
            } else {
                rawCondition = 'wet';
            }
        }
        
        // ✅ NORMALIZE for stability: humid/wet both become "active"
        if (rawCondition === 'humid' || rawCondition === 'wet') {
            return 'active';  // Same state for stability checking
        } else if (rawCondition === 'dry') {
            return 'inactive';
        }
        
        return null;
    }
    
    // ✅ KEEP ORIGINAL: Store the actual ESP32 condition for logging
    storeOriginalCondition(data) {
        if (data.soil_condition) {
            this.originalCondition = data.soil_condition;
        } else if (data.moisture_app_value !== undefined) {
            const value = data.moisture_app_value;
            if (value <= 0.4) {
                this.originalCondition = 'dry';
            } else if (value <= 0.7) {
                this.originalCondition = 'humid';
            } else {
                this.originalCondition = 'wet';
            }
        }
    }
    
    // ✅ SIMPLE: Check if condition should activate creature/synth
    isActiveCondition(condition) {
        return condition === 'active';  // Now only checking normalized state
    }
    
    // ✅ IMPROVED: Stable condition checking with better logging
    getStableCondition(normalizedCondition, moistureValue = null) {
        if (normalizedCondition === null) return null;
        
        // Add to history
        this.conditionHistory.push(normalizedCondition);
        
        // Keep only recent history
        if (this.conditionHistory.length > this.maxConditionHistory) {
            this.conditionHistory.shift();
        }
        
        // Check if we have enough readings
        if (this.conditionHistory.length < this.conditionStabilityCount) {
            console.log(`🌱 ⏳ Stability: ${this.conditionHistory.length}/${this.conditionStabilityCount} (${this.originalCondition} → ${normalizedCondition})`);
            return null;
        }
        
        // Check if last N readings are consistent
        const recentReadings = this.conditionHistory.slice(-this.conditionStabilityCount);
        const isConsistent = recentReadings.every(reading => reading === recentReadings[0]);
        
        if (isConsistent) {
            const valueStr = moistureValue !== null ? moistureValue.toFixed(3) : 'N/A';
            const activeName = recentReadings[0] === 'active' ? 'ACTIVE' : 'INACTIVE';
            console.log(`🌱 ✅ STABLE: ${recentReadings[0]} (ESP32: ${this.originalCondition}, value: ${valueStr}) → ${activeName}`);
            return recentReadings[0];
        } else {
            console.log(`🌱 ⏳ Stabilizing: [${recentReadings.join(' → ')}] (ESP32: ${this.originalCondition})`);
            return null;
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
        if (!this.audioPlaying) {
            console.log('🌱🎵 ❌ Cannot start pattern - audio not active');
            return;
        }
        
        console.log('🌱🎵 🎹 Starting autonomous music pattern');
        
        // Play initial sound immediately
        this.playRandomChord();
        
        // Start the self-sustaining loop
        this.scheduleNextRandomSound();
    }
    
    // ✅ FIXED: Self-sustaining random note scheduler with better debugging
    scheduleNextRandomSound() {
        if (!this.audioPlaying) {
            console.log('🌱🎵 ⏹️ Pattern stopped - audio inactive');
            return;
        }
        
        // Random delay between 2-6 seconds (made shorter for testing)
        const nextSoundDelay = Math.random() * 4000 + 2000;
        
        console.log(`🌱🎵 ⏰ Next sound in ${(nextSoundDelay/1000).toFixed(1)}s`);
        
        setTimeout(() => {
            if (!this.audioPlaying) {
                console.log('🌱🎵 ⏹️ Pattern stopped during delay');
                return;
            }
            
            // Play random sound (chord or single note)
            if (Math.random() > 0.6) {
                console.log('🌱🎵 🎹 Playing random chord...');
                this.playRandomChord();
            } else {
                console.log('🌱🎵 🎵 Playing random note...');
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
        this.originalCondition = null;  // ✅ Reset original condition too
        
        // ✅ Reset condition history for clean slate
        this.conditionHistory = [];
        
        // Hide everything once
        this.hideBackgroundOnce();
        this.deactivateResponseOnce();
    }
    
    playRandomChord() {
        if (!this.synth) {
            console.log('🌱🎵 ❌ No synth available');
            return;
        }
        if (!this.audioPlaying) {
            console.log('🌱🎵 ❌ Audio not playing, skipping chord');
            return;
        }
        
        const chordSize = Math.random() > 0.5 ? 2 : 3;
        const chord = [];
        
        for (let i = 0; i < chordSize; i++) {
            const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
            if (!chord.includes(note)) {
                chord.push(note);
            }
        }
        
        console.log('🌱🎵 🎹 Playing chord:', chord.join(' + '));
        this.synth.triggerAttackRelease(chord, '4n');
    }
    
    playRandomNote() {
        if (!this.synth) {
            console.log('🌱🎵 ❌ No synth available');
            return;
        }
        if (!this.audioPlaying) {
            console.log('🌱🎵 ❌ Audio not playing, skipping note');
            return;
        }
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        const duration = Math.random() > 0.5 ? '2n' : '4n';
        
        console.log(`🌱🎵 🎵 Playing note: ${note} (${duration})`);
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