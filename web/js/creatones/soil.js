class SoilHandler {
    constructor() {
        // Synths and Loops
        this.toyPianoSynth = null;
        this.insectSynth = null;
        this.toyPianoLoop = null;
        this.insectLoop = null;
        this.insectLFO = null;

        // Audio Params
        this.fadeDuration = 0.4; // Duration for fade in/out
        this.toyPianoTargetVolume = -1; // Louder
        this.insectTargetVolume = -4;   // Louder

        // State
        this.isActive = false;      // Sensor is active (e.g., soil is wet)
        this.isPlaying = false;     // Audio is currently playing or fading in
        this.isFadingOut = false;   // Audio is currently fading out
        this.isConnected = false;   // ESP32 device is connected to the server
        this.audioEnabled = false;  // User has interacted to enable audio
        this.toneInitialized = false; // Tone.js components for this handler are initialized
        this.debugMode = true;      // Enable console logs for debugging
        this.stopTimeoutId = null;  // Timeout ID for stopping audio after fade

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground'); // Assuming this is for general frame background
        this.audioEnableButton = null; // Will be created
        this.soilButton = document.getElementById('soil-button'); // For UI indication
        this.soilStatus = document.getElementById('soil-status'); // For UI text status

        if (!this.soilCreatureVisual) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground) console.warn('💧 .framebackground element not found.');
        // if (!this.soilButton) console.warn('💧 #soil-button element not found.'); // Uncomment if needed
        // if (!this.soilStatus) console.warn('💧 #soil-status element not found.'); // Uncomment if needed

        this.initAudioEnableButton();
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('🌱 SoilHandler: Core Dependencies (Tone, window.creatune) ready.');
                this.setupListeners(); // Setup WebSocket listeners
                this.updateUI();       // Initial UI update based on current state
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button'; // For styling
        this.audioEnableButton.textContent = 'Click to Enable Audio';
        // Basic styling, can be overridden by CSS
        Object.assign(this.audioEnableButton.style, {
            position: 'fixed', top: '10px', right: '10px', zIndex: '10000',
            padding: '10px', backgroundColor: 'lightgray', border: '1px solid black',
            cursor: 'pointer'
        });

        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) {
                try {
                    await Tone.start(); // Start AudioContext
                    this.audioEnabled = true;
                    if (this.debugMode) console.log('🎵 AudioContext started by user gesture.');

                    // Initialize Tone components now that AudioContext is running
                    if (!this.toneInitialized) {
                        this.initTone(); // This will initialize synths, LFO, patterns
                    }

                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components after AudioContext start.");
                        this.audioEnableButton.textContent = 'Audio Init Error';
                        this.audioEnableButton.style.backgroundColor = 'red';
                        return;
                    }

                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.style.backgroundColor = 'lightgreen';
                    setTimeout(() => { this.audioEnableButton.style.display = 'none'; }, 2000);

                    // After enabling audio and initializing Tone, manage audio based on current state
                    this.manageAudioAndVisuals();

                } catch (e) {
                    console.error('Error starting AudioContext or initializing Tone:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.style.backgroundColor = 'red';
                    this.audioEnabled = false;
                    this.toneInitialized = false; // Reset as init might have failed
                }
            } else {
                // If audio is already enabled, but Tone wasn't initialized (e.g. page reload after permission)
                if (!this.toneInitialized) {
                    this.initTone();
                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components on subsequent attempt.");
                        return;
                    }
                }
                // If button is clicked again and all is well, just ensure audio plays if it should
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
        // Ensure AudioContext is started before trying to create nodes that depend on it.
        if (Tone.context.state !== 'running') {
            console.warn('💧 AudioContext not running. Deferring Tone component initialization. User interaction needed.');
            return;
        }

        if (this.debugMode) console.log('💧 Initializing Tone.js components for soil...');
        try {
            // Toy Piano Synth
            this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.2 },
                volume: -Infinity // Start silent
            });
            const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
            this.toyPianoSynth.chain(reverb, Tone.Destination);

            // Insect Synth - Single FMSynth
            this.insectSynth = new Tone.FMSynth({
                harmonicity: 2.5,
                modulationIndex: 8,
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.05, sustain: 0.01, release: 0.1 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
                volume: -Infinity // Start silent
            }).toDestination();

            if (this.insectSynth && this.insectSynth.modulationIndex) {
                this.insectLFO = new Tone.LFO({
                    frequency: "6Hz", min: 5, max: 15, type: "sine"
                }).start().connect(this.insectSynth.modulationIndex);
            } else {
                console.error("💧 Insect synth (FMSynth) or modulationIndex not available for LFO connection.");
                // Not throwing error here to allow rest of init if LFO is non-critical
            }

            this.createToyPianoPattern();
            this.createInsectPattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💧 Tone.js components initialized successfully for soil.');

        } catch (error) {
            console.error('❌ Error during Tone.js component initialization for soil:', error);
            this.toneInitialized = false;
            // Clean up any partially created Tone objects
            if (this.toyPianoSynth) { this.toyPianoSynth.dispose(); this.toyPianoSynth = null; }
            if (this.insectSynth) { this.insectSynth.dispose(); this.insectSynth = null; }
            if (this.insectLFO) { this.insectLFO.dispose(); this.insectLFO = null; }
            // Loops are created later, but if error happens after their creation in a different flow:
            if (this.toyPianoLoop) { this.toyPianoLoop.dispose(); this.toyPianoLoop = null; }
            if (this.insectLoop) { this.insectLoop.dispose(); this.insectLoop = null; }
        }
    }

    createToyPianoPattern() {
        if (!this.toyPianoSynth) {
            console.error("💧 Cannot create toyPianoLoop, synth not initialized.");
            return;
        }
        // Dispose existing loop if any, to prevent duplicates if called multiple times
        if (this.toyPianoLoop && !this.toyPianoLoop.disposed) {
            this.toyPianoLoop.dispose();
        }
        const notes = ["C4", "E4", "G4", "A4", "C5", "D4", "F4"];
        this.toyPianoLoop = new Tone.Loop(time => {
            const note = notes[Math.floor(Math.random() * notes.length)];
            const velocity = Math.random() * 0.4 + 0.2;
            const duration = Tone.Time("4n").toSeconds() * (Math.random() * 0.5 + 0.75);
            this.toyPianoSynth.triggerAttackRelease(note, duration, time, velocity);
        }, "2n");
        this.toyPianoLoop.humanize = "16n";
        if (this.debugMode) console.log('💧 Toy Piano Pattern created.');
    }

    createInsectPattern() {
        if (!this.insectSynth) {
            console.error("💧 Cannot create insectLoop, synth not initialized.");
            return;
        }
        if (this.insectLoop && !this.insectLoop.disposed) {
            this.insectLoop.dispose();
        }
        this.insectLoop = new Tone.Loop(time => {
            const duration = Tone.Time("32n").toSeconds() * (Math.random() * 0.8 + 0.4);
            const velocity = Math.random() * 0.15 + 0.05;
            const pitch = ["A5", "C#6", "E6", "G#5"][Math.floor(Math.random() * 4)];
            this.insectSynth.triggerAttackRelease(pitch, duration, time, velocity);
        }, "3n");
        this.insectLoop.probability = 0.65;
        this.insectLoop.humanize = "32n";
        if (this.debugMode) console.log('💧 Insect Pattern created.');
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 window.creatune (WebSocket client) not available for SoilHandler.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                this.isActive = state.active;
                if (this.debugMode) console.log(`💧 Soil stateChange event: Active = ${this.isActive}`);
                this.manageAudioAndVisuals();
            }
        });

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                this.isConnected = true;
                if (this.debugMode) console.log(`💧 Soil connected event.`);
                this.manageAudioAndVisuals();
            }
        });

        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                this.isConnected = false;
                this.isActive = false; // Assume sensor is inactive if device disconnects
                if (this.debugMode) console.log(`💧 Soil disconnected event.`);
                this.manageAudioAndVisuals();
            }
        });

        // Get initial state if already available from CreaTuneClient
        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            if (this.debugMode) console.log(`💧 Soil initial state: Connected=${this.isConnected}, Active=${this.isActive}`);
        }
        if (this.debugMode) console.log('💧 SoilHandler: WebSocket listeners set up.');
        this.updateUI(); // Update UI with initial state
    }

    manageAudioAndVisuals() {
        if (!this.audioEnabled) {
            if (this.debugMode) console.log(`💧 Soil: Audio not enabled by user. Cannot manage audio/visuals yet.`);
            this.updateUI(); // Still update UI based on connection/active state
            return;
        }
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💧 Soil: Tone components not initialized. Attempting init.`);
            this.initTone(); // Try to initialize if not already
            if (!this.toneInitialized) {
                if (this.debugMode) console.log(`💧 Soil: Tone components still not initialized after attempt. Cannot manage audio.`);
                this.updateUI();
                return;
            }
        }

        const shouldPlayAudio = this.isConnected && this.isActive;

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) { // If not playing, or was fading out, start it
                this.startAudio();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) { // If playing and not already fading out, stop it
                this.stopAudio();
            }
        }
        // If it's not supposed to play, and it's not playing, and not fading out, ensure UI is correct.
        if (!shouldPlayAudio && !this.isPlaying && !this.isFadingOut) {
            this.updateUI();
        }
    }

    updateUI() {
        if (this.soilCreatureVisual) {
            // Creature is active if audio is playing (which implies connected and sensor active)
            this.soilCreatureVisual.classList.toggle('active', this.isPlaying);
        }
        if (this.frameBackground) {
            // Background changes if the device is connected, regardless of sensor activity
            this.frameBackground.classList.toggle('soil-connected-bg', this.isConnected);
        }
        if (this.soilButton) {
            this.soilButton.classList.toggle('active', this.isActive && this.isConnected);
            this.soilButton.classList.toggle('connected', this.isConnected);
        }
        if (this.soilStatus) {
            if (!this.isConnected) this.soilStatus.textContent = 'Soil: Disconnected';
            else if (this.isActive) this.soilStatus.textContent = 'Soil: Active (Humid/Wet)';
            else this.soilStatus.textContent = 'Soil: Inactive (Dry)';
        }
        if (this.debugMode) {
            // console.log(`💧 Soil UI Update: Connected=${this.isConnected}, SensorActive=${this.isActive}, AudioPlaying=${this.isPlaying}, FadingOut=${this.isFadingOut}`);
        }
    }

    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            console.warn("💧 Attempted to startAudio (soil), but audio system not ready.");
            return;
        }
        if (this.isPlaying && !this.isFadingOut) { // Already playing and not fading out
            if (this.debugMode) console.log('💧 Soil audio already playing and not fading out.');
            return;
        }

        if (this.isFadingOut) { // If it was fading out, cancel the fade out
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            if (this.debugMode) console.log('💧 Cancelled soil fade out, starting fade in.');
        }

        if (!this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💧 Start soil audio called, but sensor conditions not met (Connected:${this.isConnected}, SensorActive:${this.isActive})`);
            // If it was playing or fading, ensure it stops fully. Otherwise, just update UI.
            if (this.isPlaying || this.isFadingOut) this.stopAudio(); else this.updateUI();
            return;
        }

        if (!this.toyPianoSynth || !this.insectSynth) {
            console.error("💧 Critical: Soil synths not available in startAudio. Re-initializing Tone components.");
            this.toneInitialized = false; // Force re-init
            this.initTone();
            if (!this.toneInitialized || !this.toyPianoSynth || !this.insectSynth) {
                console.error("💧 Critical: Failed to re-initialize soil synths. Cannot start audio.");
                return;
            }
        }
        
        if (this.debugMode) console.log('💧 Attempting to start soil audio with fade-in...');
        this.toyPianoSynth.volume.rampTo(this.toyPianoTargetVolume, this.fadeDuration, Tone.now());
        this.insectSynth.volume.rampTo(this.insectTargetVolume, this.fadeDuration, Tone.now());

        // Always start Tone.Transport fresh for these sounds
        if (Tone.Transport.state === "started") {
            Tone.Transport.stop();
            Tone.Transport.cancel(0); // Clear any previously scheduled events
            if (this.debugMode) console.log('💧 Soil: Tone.Transport was running, stopped and cleared for fresh start.');
        }
        Tone.Transport.start("+0.1"); // Start transport slightly in the future
        if (this.debugMode) console.log('💧 Soil: Tone.Transport started.');

        // Ensure loops are (re)created if they were disposed or never created
        if (!this.toyPianoLoop || this.toyPianoLoop.disposed) this.createToyPianoPattern();
        if (!this.insectLoop || this.insectLoop.disposed) this.createInsectPattern();

        // Start loops relative to the now (or very soon)
        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") {
            this.toyPianoLoop.start(0); // Start at the beginning of the (newly started) transport timeline
            if (this.debugMode) console.log('💧 Soil: Toy Piano Loop started.');
        }
        if (this.insectLoop && this.insectLoop.state !== "started") {
            this.insectLoop.start(0); // Start at the beginning of the (newly started) transport timeline
            if (this.debugMode) console.log('💧 Soil: Insect Loop started.');
        }

        this.isPlaying = true;
        this.isFadingOut = false; // Ensure this is reset
        if (this.debugMode) console.log('💧 Soil audio started/fading in.');
        this.updateUI();
    }

    stopAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 Attempted to stopAudio (soil), but audio system not ready.");
            this.isPlaying = false;
            this.isFadingOut = false;
            this.updateUI();
            return;
        }

        // If it's not playing and not already in the process of fading out, nothing to do but update UI.
        if (!this.isPlaying && !this.isFadingOut) {
            if (this.debugMode) console.log('💧 Soil stopAudio: Already stopped and not fading.');
            this.updateUI();
            return;
        }
        
        if (this.isFadingOut) { // Already fading out
            if (this.debugMode) console.log('💧 Soil stopAudio: Already fading out.');
            return;
        }

        if (this.debugMode) console.log('💧 Attempting to stop soil audio with fade-out...');
        this.isFadingOut = true;
        this.isPlaying = false; // Mark as not playing immediately for UI and logic

        if (this.toyPianoSynth) this.toyPianoSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());
        if (this.insectSynth) this.insectSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        this.stopTimeoutId = setTimeout(() => {
            if (this.toyPianoLoop && this.toyPianoLoop.state === "started") {
                this.toyPianoLoop.stop(0);
                // Optionally dispose to ensure clean state, then recreate in startAudio
                // this.toyPianoLoop.dispose(); 
                // this.toyPianoLoop = null;
                if (this.debugMode) console.log('💧 Soil: Toy Piano Loop stopped.');
            }
            if (this.insectLoop && this.insectLoop.state === "started") {
                this.insectLoop.stop(0);
                // this.insectLoop.dispose();
                // this.insectLoop = null;
                if (this.debugMode) console.log('💧 Soil: Insect Loop stopped.');
            }

            // Stop and clear Tone.Transport if these are the only sounds it's managing
            // This is crucial for reliable restarts
            if (Tone.Transport.state === "started") {
                Tone.Transport.stop();
                Tone.Transport.cancel(0); // Clear all scheduled events
                if (this.debugMode) console.log('💧 Soil: Tone.Transport stopped and events cleared.');
            }

            if (this.debugMode) console.log('💧 Soil audio fully stopped after fade.');
            this.isFadingOut = false; // Reset fade flag
            this.updateUI(); // Final UI update
        }, this.fadeDuration * 1000 + 100); // Ensure timeout is longer than fade

        this.updateUI(); // Update UI to reflect intermediate "fading out" state
    }
}

// Ensure this runs after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.debugMode) console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    // Ensure CreaTuneClient is ready before initializing SoilHandler
    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            if (window.debugMode) console.log('🌱 Dependencies met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) { // Prevent multiple initializations
                window.soilHandlerInstance = new SoilHandler();
            }
        } else {
            if (window.debugMode) console.log('🌱 Waiting for window.creatune and Tone.js for SoilHandler...');
            setTimeout(ensureCreatuneAndTone, 100);
        }
    };
    ensureCreatuneAndTone();
});

// For potential Node.js environment (testing, etc.) - not typically used in browser context for this file
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}