class SoilHandler {
    constructor() {
        // Synths and Loops
        this.toyPianoSynth = null;
        this.insectSynth = null; // Will be a single FMSynth
        this.toyPianoLoop = null;
        this.insectLoop = null;
        this.insectLFO = null;

        // Audio Params
        this.fadeDuration = 0.4; // Duration for fade in/out (seconds) - Adjusted from previous
        this.toyPianoTargetVolume = -3; // Target volume in dB - Adjusted
        this.insectTargetVolume = -6;   // Target volume in dB - Adjusted

        // State
        this.isActive = false;      // Sensor state (e.g., soil is wet)
        this.isPlaying = false;     // Audio is currently playing (not fading out)
        this.isFadingOut = false;   // Audio is currently in the process of fading out
        this.isConnected = false;   // WebSocket connection status for this device type
        this.audioEnabled = false;  // User has interacted to enable AudioContext
        this.toneInitialized = false; // Tone.js components have been successfully initialized
        this.debugMode = true;      // Enables detailed console logging
        this.stopTimeoutId = null;  // Timeout ID for stopping loops after fade-out

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.audioEnableButton = null; // Will be created dynamically
        this.soilButton = document.getElementById('soil-button');
        this.soilStatus = document.getElementById('soil-status');

        if (!this.soilCreatureVisual && this.debugMode) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💧 .framebackground element not found.');
        if (!this.soilButton && this.debugMode) console.warn('💧 #soil-button element not found.');
        if (!this.soilStatus && this.debugMode) console.warn('💧 #soil-status element not found.');

        this.initAudioEnableButton(); // Call to create the button
        this.initializeWhenReady(); // Call to setup listeners and initial UI
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('🌱 SoilHandler: Core Dependencies (Tone, window.creatune) ready.');
                this.setupListeners();
                this.updateUI(); // Initial UI update after listeners and state are set
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        // Remove inline styles for the button as they are now in CSS
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button';
        this.audioEnableButton.textContent = 'Click to Enable Audio';
        // CSS will handle the styling (position, padding, z-index, cursor, etc.)

        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) {
                try {
                    await Tone.start();
                    this.audioEnabled = true;
                    if (this.debugMode) console.log('🎵 AudioContext started by user gesture.');

                    if (!this.toneInitialized) {
                        this.initTone(); // Initialize Tone components
                    }

                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components after AudioContext start.");
                        this.audioEnableButton.textContent = 'Audio Init Error';
                        this.audioEnableButton.classList.add('audio-button-error');
                        return;
                    }

                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.classList.remove('audio-button-error');
                    this.audioEnableButton.classList.add('audio-button-confirm');
                    
                    setTimeout(() => {
                        this.audioEnableButton.classList.add('audio-button-hidden');
                    }, 1500);
                    this.manageAudioAndVisuals(); // Attempt to play if conditions are met
                } catch (e) {
                    console.error('Error starting AudioContext or initializing Tone:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.classList.add('audio-button-error');
                    this.audioEnabled = false;
                    this.toneInitialized = false;
                }
            } else {
                if (!this.toneInitialized) {
                    this.initTone();
                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components on subsequent attempt.");
                        return;
                    }
                }
                this.manageAudioAndVisuals();
            }
        });
        document.body.appendChild(this.audioEnableButton);
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone) {
            console.error('💧 Tone.js is not loaded. Cannot initialize Tone components.');
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💧 AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💧 Initializing Tone.js components for soil...');
        try {
            this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.1, decay: 0.3, sustain: 0.05, release: 0.4 },
                volume: -Infinity
            });
            const reverb = new Tone.Reverb({ decay: 3, wet: 0.3 });
            this.toyPianoSynth.chain(reverb, Tone.Destination);

            this.insectSynth = new Tone.FMSynth({
                harmonicity: 4,  // Adjusted for more insect-like timbre
                modulationIndex: 8, 
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.05, sustain: 0.2, release: 0.1 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 1. },
                volume: -Infinity
            }).toDestination();

            if (this.insectSynth && this.insectSynth.modulationIndex) {
                this.insectLFO = new Tone.LFO({
                    frequency: "6Hz", min: 5, max: 15, type: "sine"
                }).start().connect(this.insectSynth.modulationIndex);
            } else {
                console.error("💧 Insect synth (FMSynth) or its modulationIndex Param not available for LFO connection.");
                throw new Error("Insect synth (FMSynth) or modulationIndex not available for LFO connection.");
            }

            this.createToyPianoPattern();
            this.createInsectPattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💧 Tone.js components initialized successfully.');

        } catch (error) {
            console.error('❌ Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.toyPianoSynth) { this.toyPianoSynth.dispose(); this.toyPianoSynth = null; }
            if (this.insectSynth) { this.insectSynth.dispose(); this.insectSynth = null; }
            if (this.insectLFO) { this.insectLFO.dispose(); this.insectLFO = null; }
            if (this.toyPianoLoop) { this.toyPianoLoop.dispose(); this.toyPianoLoop = null; }
            if (this.insectLoop) { this.insectLoop.dispose(); this.insectLoop = null; }
        }
    }

    createToyPianoPattern() {
        if (!this.toyPianoSynth) {
            console.error("💧 Cannot create toyPianoLoop, synth not initialized.");
            return;
        }
        const notes = ["C4", "E4", "G4", "A4", "C5", "D4", "F4"];
        this.toyPianoLoop = new Tone.Loop(time => {
            const note = notes[Math.floor(Math.random() * notes.length)];
            const velocity = Math.random() * 0.4 + 0.2;
            const duration = Tone.Time("4n").toSeconds() * (Math.random() * 0.5 + 0.75);
            this.toyPianoSynth.triggerAttackRelease(note, duration, time, velocity);
        }, "2n");
        this.toyPianoLoop.humanize = "16n";
    }

    createInsectPattern() {
        if (!this.insectSynth) {
            console.error("💧 Cannot create insectLoop, synth not initialized.");
            return;
        }
        this.insectLoop = new Tone.Loop(time => {
            const duration = Tone.Time("32n").toSeconds() * (Math.random() * 0.8 + 0.4);
            const velocity = Math.random() * 0.15 + 0.05;
            const pitch = ["A5", "C#6", "E6", "G#5"][Math.floor(Math.random() * 4)];
            this.insectSynth.triggerAttackRelease(pitch, duration, time, velocity);
        }, "3n");
        this.insectLoop.probability = 0.65;
        this.insectLoop.humanize = "32n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 window.creatune (WebSocket client) not available for SoilHandler.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 Soil stateChange event: active=${state.active}`);
                this.isActive = state.active;
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log('💧 Soil connected event.');
                this.isConnected = true;
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log('💧 Soil disconnected event.');
                this.isConnected = false;
                this.isActive = false;
                this.manageAudioAndVisuals();
            }
        });

        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            if (this.debugMode) console.log(`💧 Soil initial state: Connected=${this.isConnected}, Active=${this.isActive}`);
        } else {
            if (this.debugMode) console.log('💧 Soil initial state not available from creatune client.');
        }
    }

    manageAudioAndVisuals() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.log(`💧 Audio system not ready (AudioEnabled: ${this.audioEnabled}, ToneInitialized: ${this.toneInitialized}). Cannot manage audio/visuals yet.`);
            this.updateUI();
            return;
        }

        const shouldPlayAudio = this.isConnected && this.isActive;

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        this.updateUI();
    }

    updateUI() {
        if (this.soilCreatureVisual) {
            // Creature is active if audio is playing AND not currently fading out
            this.soilCreatureVisual.classList.toggle('active', this.isPlaying && !this.isFadingOut);
        }
        if (this.frameBackground) {
            this.frameBackground.classList.toggle('soil-connected-bg', this.isConnected);
        }
        if (this.soilButton) {
            this.soilButton.classList.toggle('active', this.isActive && this.isConnected);
            this.soilButton.classList.toggle('connected', this.isConnected);
        }
        if (this.soilStatus) {
            if (!this.isConnected) {
                this.soilStatus.textContent = 'Soil: Disconnected';
            } else if (this.isActive) {
                this.soilStatus.textContent = 'Soil: Active (Humid/Wet)';
            } else {
                this.soilStatus.textContent = 'Soil: Inactive (Dry)';
            }
        }
        // Optional detailed log for UI state
        // if (this.debugMode) {
        //     console.log(`💧 UI Update: Connected=${this.isConnected}, SensorActive=${this.isActive}, AudioPlaying=${this.isPlaying}, FadingOut=${this.isFadingOut}`);
        // }
    }

    // --- START OF NEW/REVISED startAudio METHOD ---
    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 Attempted to startAudio, but audio system not ready.");
            this.updateUI(); // Ensure UI reflects non-audio state
            return;
        }

        // If it was fading out, clear the stop timeout and reset fading state
        if (this.isFadingOut) {
            if (this.debugMode) console.log('💧 Cancelling an ongoing fade-out process to start audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            // Volumes might be partway down, rampTo should handle this after cancellation.
        }

        // If already playing and not in the process of stopping (e.g. fade out was cancelled above)
        if (this.isPlaying) {
            if (this.debugMode) console.log("💧 startAudio called, but already considered playing and not fading out. Ensuring volumes are correct.");
            // Re-apply target volumes, cancelling any prior ramps.
            if (this.toyPianoSynth) {
                this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
                this.toyPianoSynth.volume.rampTo(this.toyPianoTargetVolume, this.fadeDuration, Tone.now());
            }
            if (this.insectSynth) {
                this.insectSynth.volume.cancelScheduledValues(Tone.now());
                this.insectSynth.volume.rampTo(this.insectTargetVolume, this.fadeDuration, Tone.now());
            }
            this.updateUI();
            return;
        }

        // Conditions to play: connected and sensor active
        if (!this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💧 Start audio called, but sensor conditions not met (Connected:${this.isConnected}, SensorActive:${this.isActive}). Ensuring audio is stopped.`);
            this.stopAudio(); // Ensure it's properly stopped if conditions aren't met.
            return;
        }

        if (!this.toyPianoSynth || !this.insectSynth) {
            console.error("💧 Critical: Synths not available in startAudio. Cannot start audio.");
            return;
        }

        if (this.debugMode) console.log('💧 Attempting to start soil audio with fade-in...');
        
        this.isPlaying = true;      // Set state: now it's officially playing
        this.isFadingOut = false;   // Ensure this is false

        // Cancel any previous ramps before starting new ones.
        this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
        this.toyPianoSynth.volume.rampTo(this.toyPianoTargetVolume, this.fadeDuration, Tone.now());
        
        this.insectSynth.volume.cancelScheduledValues(Tone.now());
        this.insectSynth.volume.rampTo(this.insectTargetVolume, this.fadeDuration, Tone.now());

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") {
            this.toyPianoLoop.start(0);
        }
        if (this.insectLoop && this.insectLoop.state !== "started") {
            this.insectLoop.start(0);
        }

        if (this.debugMode) console.log('💧 Soil audio started/fading in.');
        this.updateUI();
    }
    // --- END OF NEW/REVISED startAudio METHOD ---

    // --- START OF NEW/REVISED stopAudio METHOD ---
    stopAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false;
            this.isFadingOut = false;
            if (this.debugMode) console.warn("💧 Attempted to stopAudio, but audio system not ready. States reset.");
            this.updateUI();
            return;
        }

        // If already stopped (not playing AND not fading out)
        if (!this.isPlaying && !this.isFadingOut) {
            if (this.debugMode) console.log("💧 stopAudio called, but already stopped and not fading.");
            this.updateUI(); // Ensure UI is consistent
            return;
        }

        // If currently in the process of fading out, don't restart the process.
        if (this.isFadingOut) {
            if (this.debugMode) console.log("💧 stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log('💧 Attempting to stop soil audio with fade-out...');
        
        this.isPlaying = false;     // No longer considered "actively playing"
        this.isFadingOut = true;    // Now it's officially fading out

        // Cancel any scheduled ramps before starting the fade-out ramp.
        if (this.toyPianoSynth) {
            this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
            this.toyPianoSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());
        }
        if (this.insectSynth) {
            this.insectSynth.volume.cancelScheduledValues(Tone.now());
            this.insectSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        this.stopTimeoutId = setTimeout(() => {
            // Only stop loops if we are still in a fadingOut state.
            // This check is crucial: if startAudio was called during the fade, isFadingOut would be false.
            if (this.isFadingOut) { 
                if (this.toyPianoLoop && this.toyPianoLoop.state === "started") {
                    this.toyPianoLoop.stop(0);
                }
                if (this.insectLoop && this.insectLoop.state === "started") {
                    this.insectLoop.stop(0);
                }
                if (this.debugMode) console.log('💧 Soil audio loops stopped after fade.');
                this.isFadingOut = false; // Fade out complete
            } else {
                if (this.debugMode) console.log('💧 Soil audio stop timeout fired, but no longer fading out (likely restarted). Loops not stopped by this timeout.');
            }
            // this.isPlaying is already false.
            this.updateUI();
        }, this.fadeDuration * 1000 + 100); // Wait for fade duration + a small buffer

        this.updateUI(); // Update UI immediately to reflect that it's stopping/fading
    }
    // --- END OF NEW/REVISED stopAudio METHOD ---
}

// Initialize SoilHandler when DOM is ready and dependencies are met
document.addEventListener('DOMContentLoaded', () => {
    // Simplified initial logging
    if (new SoilHandler().debugMode) { // Temporarily create to check debugMode
         console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    }

    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            if (new SoilHandler().debugMode) console.log('🌱 Dependencies (creatune, Tone) met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
            } else {
                 if (new SoilHandler().debugMode) console.log('🌱 Soil Handler instance already exists. Re-initialization skipped.');
            }
        } else {
            if (new SoilHandler().debugMode) console.log('🌱 Waiting for window.creatune and Tone.js...');
            setTimeout(ensureCreatuneAndTone, 100);
        }
    };
    ensureCreatuneAndTone();
});

// For potential Node.js environment (testing, etc.)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}