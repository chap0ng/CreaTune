class SoilHandler {
    constructor() {
        // Synths and Loops
        this.toyPianoSynth = null;
        this.insectSynth = null; // Will be a single FMSynth
        this.toyPianoLoop = null;
        this.insectLoop = null;
        this.insectLFO = null;

        // Audio Params
        this.fadeDuration = 2; // Duration for fade in/out (seconds)
        this.toyPianoTargetVolume = 6; // Target volume in dB
        this.insectTargetVolume = 3;   // Target volume in dB

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


        this.initAudioEnableButton();
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('🌱 SoilHandler: Core Dependencies (Tone, window.creatune) ready.');
                this.setupListeners(); // Setup listeners first to get initial state
                this.updateUI();       // Then update UI with potentially new initial state
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100); // Poll for dependencies
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button';
        this.audioEnableButton.textContent = 'Click to Enable Audio';
        // Add some basic styling or use CSS classes
        this.audioEnableButton.style.position = 'fixed';
        this.audioEnableButton.style.bottom = '20px';
        this.audioEnableButton.style.left = '50%';
        this.audioEnableButton.style.transform = 'translateX(-50%)';
        this.audioEnableButton.style.padding = '10px 20px';
        this.audioEnableButton.style.zIndex = '1000';
        this.audioEnableButton.style.cursor = 'pointer';


        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) {
                try {
                    await Tone.start();
                    this.audioEnabled = true;
                    if (this.debugMode) console.log('🎵 AudioContext started by user gesture.');

                    // Attempt to initialize Tone components now that AudioContext is running
                    if (!this.toneInitialized) {
                        this.initTone();
                    }

                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components after AudioContext start.");
                        this.audioEnableButton.textContent = 'Audio Init Error';
                        this.audioEnableButton.classList.add('audio-button-error');
                        // Do not hide the button if there's an error
                        return;
                    }

                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.classList.remove('audio-button-error');
                    this.audioEnableButton.classList.add('audio-button-confirm');
                    // Hide the button after a short delay
                    setTimeout(() => {
                        this.audioEnableButton.classList.add('audio-button-hidden');
                        // Optionally, remove from DOM or set display: none
                        // this.audioEnableButton.style.display = 'none';
                    }, 1500);
                    this.manageAudioAndVisuals(); // Attempt to play if conditions are met
                } catch (e) {
                    console.error('Error starting AudioContext or initializing Tone:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.classList.add('audio-button-error');
                    this.audioEnabled = false; // Reset audioEnabled state
                    this.toneInitialized = false; // Reset toneInitialized state
                }
            } else {
                // Audio already enabled, ensure Tone components are initialized if they weren't
                if (!this.toneInitialized) {
                    this.initTone();
                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components on subsequent attempt.");
                        // Potentially show an error on the button again if it's still visible
                        return;
                    }
                }
                this.manageAudioAndVisuals(); // Attempt to play if conditions are met
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
            if (this.debugMode) console.warn('💧 AudioContext not running. Deferring Tone component initialization. User interaction might be needed.');
            return; // Don't try to init if context isn't running
        }

        if (this.debugMode) console.log('💧 Initializing Tone.js components for soil...');
        try {
            // Toy Piano Synth
            this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.4 },
                volume: -Infinity // Start silent
            });
            const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.15 });
            this.toyPianoSynth.chain(reverb, Tone.Destination);

            // Insect Synth - Single Tone.FMSynth for direct LFO connection
            this.insectSynth = new Tone.FMSynth({
                harmonicity: 2.5,
                modulationIndex: 8, // Initial value, LFO will modulate this Param
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.05, sustain: 0.01, release: 0.1 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
                volume: -Infinity // Start silent
            }).toDestination();

            // Connect LFO to FMSynth's modulationIndex (which is a Param)
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
            // Clean up any partially created Tone objects to prevent memory leaks or issues
            if (this.toyPianoSynth) { this.toyPianoSynth.dispose(); this.toyPianoSynth = null; }
            if (this.insectSynth) { this.insectSynth.dispose(); this.insectSynth = null; }
            if (this.insectLFO) { this.insectLFO.dispose(); this.insectLFO = null; }
            if (this.toyPianoLoop) { this.toyPianoLoop.dispose(); this.toyPianoLoop = null; } // Loops might not be created yet if error is early
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
            const velocity = Math.random() * 0.4 + 0.2; // Softer velocities
            const duration = Tone.Time("4n").toSeconds() * (Math.random() * 0.5 + 0.75); // Vary duration
            this.toyPianoSynth.triggerAttackRelease(note, duration, time, velocity);
        }, "2n"); // Loop interval
        this.toyPianoLoop.humanize = "16n"; // Add slight timing variations
    }

    createInsectPattern() {
        if (!this.insectSynth) {
            console.error("💧 Cannot create insectLoop, synth not initialized.");
            return;
        }
        this.insectLoop = new Tone.Loop(time => {
            const duration = Tone.Time("32n").toSeconds() * (Math.random() * 0.8 + 0.4); // Short, varied chirps
            const velocity = Math.random() * 0.15 + 0.05; // Very soft
            const pitch = ["A5", "C#6", "E6", "G#5"][Math.floor(Math.random() * 4)]; // Higher pitches
            this.insectSynth.triggerAttackRelease(pitch, duration, time, velocity);
        }, "3n"); // Loop interval
        this.insectLoop.probability = 0.65; // Not every loop iteration triggers
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
                this.isActive = false; // If disconnected, sensor cannot be active
                this.manageAudioAndVisuals();
            }
        });

        // Get initial state from the WebSocket client
        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            if (this.debugMode) console.log(`💧 Soil initial state: Connected=${this.isConnected}, Active=${this.isActive}`);
        } else {
            if (this.debugMode) console.log('💧 Soil initial state not available from creatune client.');
        }
        // this.updateUI(); // Initial UI update is now handled in initializeWhenReady after listeners are set
    }

    manageAudioAndVisuals() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.log(`💧 Audio system not ready (AudioEnabled: ${this.audioEnabled}, ToneInitialized: ${this.toneInitialized}). Cannot manage audio/visuals yet.`);
            this.updateUI(); // Ensure UI reflects the non-audio state
            return;
        }

        const shouldPlayAudio = this.isConnected && this.isActive;

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) { // If not playing, or was told to stop but now should play
                this.startAudio();
            }
        } else { // Should not play audio
            if (this.isPlaying && !this.isFadingOut) { // If currently playing and not already stopping
                this.stopAudio();
            }
        }
        // Update UI regardless, to reflect current states accurately,
        // especially if no audio action was taken but states might have changed.
        this.updateUI();
    }

    updateUI() {
        if (this.soilCreatureVisual) {
            this.soilCreatureVisual.classList.toggle('active', this.isPlaying && !this.isFadingOut);
        }
        if (this.frameBackground) {
            this.frameBackground.classList.toggle('soil-connected-bg', this.isConnected);
            // Potentially add other classes based on isActive, etc.
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
        if (this.debugMode) {
            // console.log(`💧 UI Update: Connected=${this.isConnected}, SensorActive=${this.isActive}, AudioPlaying=${this.isPlaying}, FadingOut=${this.isFadingOut}`);
        }
    }

    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 Attempted to startAudio, but audio system not ready.");
            return;
        }
        if (this.isPlaying && !this.isFadingOut) { // Already playing and not in the process of stopping
            if (this.debugMode) console.log("💧 startAudio called, but already playing.");
            return;
        }

        // If it was fading out, cancel the fade out process
        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false; // No longer fading out
            if (this.debugMode) console.log('💧 Cancelled fade out, starting fade in for soil audio.');
        }

        // Double-check conditions before actually starting audio hardware
        if (!this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💧 Start audio called, but sensor conditions not met (Connected:${this.isConnected}, SensorActive:${this.isActive}). Ensuring audio is stopped.`);
            if (this.isPlaying || this.isFadingOut) this.stopAudio(); // Ensure it stops if it was somehow playing/fading
            else this.updateUI(); // Just update UI if it was already fully stopped
            return;
        }

        if (!this.toyPianoSynth || !this.insectSynth) {
            console.error("💧 Critical: Synths not available in startAudio. Cannot start audio.");
            return;
        }

        if (this.debugMode) console.log('💧 Attempting to start soil audio with fade-in...');
        this.toyPianoSynth.volume.rampTo(this.toyPianoTargetVolume, this.fadeDuration, Tone.now());
        this.insectSynth.volume.rampTo(this.insectTargetVolume, this.fadeDuration, Tone.now());

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") {
            this.toyPianoLoop.start(0); // Start at the beginning of the transport's timeline
        }
        if (this.insectLoop && this.insectLoop.state !== "started") {
            this.insectLoop.start(0);
        }

        this.isPlaying = true; // Now it's officially playing
        this.isFadingOut = false; // Ensure this is false
        if (this.debugMode) console.log('💧 Soil audio started/fading in.');
        this.updateUI(); // Reflect the new playing state in the UI
    }

    stopAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            // If audio system isn't ready, ensure states reflect that audio is not playing
            this.isPlaying = false;
            this.isFadingOut = false;
            this.updateUI();
            return;
        }
        if (!this.isPlaying && !this.isFadingOut) { // Already stopped and not in the process of stopping
            if (this.debugMode) console.log("💧 stopAudio called, but already stopped.");
            this.updateUI(); // Ensure UI is consistent
            return;
        }
        if (this.isFadingOut) { // Already in the process of fading out
            if (this.debugMode) console.log("💧 stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log('💧 Attempting to stop soil audio with fade-out...');
        this.isFadingOut = true; // Now it's officially fading out
        this.isPlaying = false;  // No longer considered "playing" in the sense of being active

        if (this.toyPianoSynth) this.toyPianoSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());
        if (this.insectSynth) this.insectSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId); // Clear any existing timeout

        this.stopTimeoutId = setTimeout(() => {
            if (this.toyPianoLoop && this.toyPianoLoop.state === "started") {
                this.toyPianoLoop.stop(0); // Stop at the transport's current position or next 0
            }
            if (this.insectLoop && this.insectLoop.state === "started") {
                this.insectLoop.stop(0);
            }
            // After loops are stopped and fade is complete
            if (this.debugMode) console.log('💧 Soil audio fully stopped after fade.');
            this.isFadingOut = false; // Reset fading state
            // this.isPlaying remains false
            this.updateUI(); // Update UI to reflect fully stopped state

            // Consider stopping transport if nothing else is playing, though this might be managed globally
            // if (Tone.Transport.state === "started" && /* check if other loops are running */) {
            //     Tone.Transport.stop();
            // }
        }, this.fadeDuration * 1000 + 100); // Wait for fade duration + a small buffer

        this.updateUI(); // Update UI immediately to reflect that it's stopping/fading
    }
}

// Initialize SoilHandler when DOM is ready and dependencies are met
document.addEventListener('DOMContentLoaded', () => {
    if (window.soilHandlerInstance && window.soilHandlerInstance.debugMode) { // Use debugMode from potential existing instance
        console.log('🌱 DOMContentLoaded: Soil Handler instance might already exist.');
    } else if (new SoilHandler().debugMode) { // Temporarily create to check debugMode if no instance
         console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    }


    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            if (new SoilHandler().debugMode) console.log('🌱 Dependencies (creatune, Tone) met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
            } else {
                 if (new SoilHandler().debugMode) console.log('🌱 Soil Handler instance already exists.');
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