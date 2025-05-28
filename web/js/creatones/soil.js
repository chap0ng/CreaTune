class SoilHandler {
    constructor() {
        // Synths and Loops
        this.toyPianoSynth = null;
        this.insectSynth = null;
        this.toyPianoLoop = null;
        this.insectLoop = null;
        this.insectLFO = null;

        // Audio Params
        this.fadeDuration = 0.7;
        this.toyPianoTargetVolume = -15;
        this.insectTargetVolume = -25;

        // State
        this.isActive = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.isConnected = false;
        this.audioEnabled = false; // Tracks if Tone.start() has been successfully called
        this.toneInitialized = false; // Tracks if initTone() has been successfully called
        this.debugMode = true;
        this.stopTimeoutId = null;

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.audioEnableButton = null;
        this.soilButton = document.getElementById('soil-button');
        this.soilStatus = document.getElementById('soil-status');

        if (!this.soilCreatureVisual) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground) console.warn('💧 .framebackground element not found.');

        this.initAudioEnableButton();
        this.initializeWhenReady(); // Sets up non-audio parts initially
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                console.log('🌱 SoilHandler: Core Dependencies (Tone, window.creatune) ready.');
                // DO NOT CALL this.initTone() here. It will be called after Tone.start().
                this.setupListeners(); // Listeners can be set up.
                this.updateUI();       // Initial UI update.
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button';
        this.audioEnableButton.textContent = 'Click to Enable Audio';

        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) { // If AudioContext hasn't been started by user yet
                try {
                    await Tone.start(); // Start the AudioContext
                    this.audioEnabled = true; // Mark that Tone.start() was successful
                    console.log('🎵 AudioContext started by user gesture.');

                    // Now that AudioContext is running, initialize Tone components
                    if (!this.toneInitialized) {
                        this.initTone(); // This method now also sets this.toneInitialized
                    }

                    if (!this.toneInitialized) { // Check if initTone failed
                        console.error("💧 Critical: Failed to initialize Tone components after AudioContext start.");
                        this.audioEnableButton.textContent = 'Audio Init Error';
                        this.audioEnableButton.classList.add('audio-button-error');
                        return;
                    }

                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.classList.add('audio-button-confirm');
                    setTimeout(() => this.audioEnableButton.classList.add('audio-button-hidden'), 1000);

                    this.manageAudioAndVisuals(); // Attempt to play if conditions are met

                } catch (e) {
                    console.error('Error starting AudioContext or initializing Tone:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.classList.add('audio-button-error');
                    this.audioEnabled = false; // Reset if Tone.start() failed
                    this.toneInitialized = false; // Reset if initTone failed
                }
            } else {
                // Audio already enabled (Tone.start() called), ensure Tone components are initialized
                if (!this.toneInitialized) {
                    this.initTone();
                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components on subsequent attempt.");
                        // Optionally update button to show error
                        return;
                    }
                }
                this.manageAudioAndVisuals(); // Proceed to manage audio
            }
        });
        document.body.appendChild(this.audioEnableButton);
    }

    initTone() {
        if (this.toneInitialized) return; // Already successfully initialized
        if (!window.Tone) {
            console.error('💧 Tone.js is not loaded. Cannot initialize Tone components.');
            return;
        }
        // Ensure AudioContext is started before trying to create nodes that depend on it.
        // This check is more of a safeguard; primary call to initTone is after Tone.start().
        if (Tone.context.state !== 'running') {
            console.warn('💧 AudioContext not running. Deferring Tone component initialization.');
            // It's unlikely to hit this if called correctly after Tone.start(), but good to be aware.
            return;
        }

        console.log('💧 Initializing Tone.js components for soil...');
        try {
            // Toy Piano Synth
            this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.2 },
                volume: -Infinity
            });
            const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
            this.toyPianoSynth.chain(reverb, Tone.Destination);

            // Insect Synth
            this.insectSynth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2.5,
                modulationIndex: 8,
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.05, sustain: 0.01, release: 0.1 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
                volume: -Infinity
            }).toDestination();

            this.insectLFO = new Tone.LFO({
                frequency: "6Hz", min: 5, max: 15, type: "sine"
            }).start().connect(this.insectSynth.modulationIndex);

            this.createToyPianoPattern();
            this.createInsectPattern();

            this.toneInitialized = true; // Mark as successfully initialized
            console.log('💧 Tone.js components initialized successfully.');

        } catch (error) {
            console.error('❌ Error during Tone.js component initialization:', error);
            this.toneInitialized = false; // Mark as failed
            // Clean up any partially created Tone objects if necessary (advanced)
            if (this.toyPianoSynth) this.toyPianoSynth.dispose();
            if (this.insectSynth) this.insectSynth.dispose();
            if (this.insectLFO) this.insectLFO.dispose();
            if (this.toyPianoLoop) this.toyPianoLoop.dispose();
            if (this.insectLoop) this.insectLoop.dispose();
            this.toyPianoSynth = null;
            this.insectSynth = null;
            // etc.
        }
    }

    createToyPianoPattern() {
        // Ensure synth exists before creating loop
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
            console.error('💧 window.creatune not available.');
            return;
        }
        console.log('💧 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 Soil stateChange event: sensor active = ${state.active}`);
                this.isActive = state.active;
                this.manageAudioAndVisuals();
            }
        });

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported connected.');
                this.isConnected = true;
                this.manageAudioAndVisuals();
            }
        });

        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported disconnected.');
                this.isConnected = false;
                this.isActive = false;
                this.manageAudioAndVisuals();
            }
        });

        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            if (this.debugMode) console.log(`💧 SoilHandler: Initial state - Connected: ${this.isConnected}, SensorActive: ${this.isActive}`);
        }
        // this.updateUI(); // UI update will happen as part of manageAudioAndVisuals or initial setup
        console.log('💧 SoilHandler: WebSocket listeners set up.');
    }

    manageAudioAndVisuals() {
        // Ensure audio system is ready before trying to play
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.log(`💧 Audio system not ready (AudioEnabled: ${this.audioEnabled}, ToneInitialized: ${this.toneInitialized}). Cannot manage audio/visuals yet.`);
            this.updateUI(); // Still update UI based on connection/sensor state
            return;
        }

        const shouldPlayAudio = this.isConnected && this.isActive; // audioEnabled and toneInitialized are prerequisites

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        // If not playing and not fading out, ensure UI is current
        if (!this.isPlaying && !this.isFadingOut) {
             this.updateUI();
        }
    }

    updateUI() {
        if (this.soilCreatureVisual) {
            // Creature active class depends on whether audio is playing or intended to play (fading in)
            this.soilCreatureVisual.classList.toggle('active', this.isPlaying);
        }
        if (this.frameBackground) {
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
        if (this.debugMode) console.log(`💧 UI Update: Connected=${this.isConnected}, SensorActive=${this.isActive}, AudioPlaying=${this.isPlaying}, FadingOut=${this.isFadingOut}`);
    }

    startAudio() {
        // Pre-conditions: audioEnabled and toneInitialized must be true.
        // isConnected and isActive determine if it *should* play.
        if (!this.audioEnabled || !this.toneInitialized) {
            console.warn("💧 Attempted to startAudio, but audio system not ready.");
            return;
        }
        if (this.isPlaying && !this.isFadingOut) return;

        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            console.log('💧 Cancelled fade out, starting fade in.');
        }

        // This check is now more about sensor state, as audio system readiness is checked above
        if (!this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💧 Start audio called, but sensor conditions not met (Connected:${this.isConnected}, SensorActive:${this.isActive})`);
            if (this.isPlaying || this.isFadingOut) this.stopAudio();
            else this.updateUI();
            return;
        }

        // Synths should have been initialized by initTone by now.
        if (!this.toyPianoSynth || !this.insectSynth) {
            console.error("💧 Critical: Synths not available in startAudio. This shouldn't happen if toneInitialized is true.");
            return;
        }

        console.log('💧 Attempting to start soil audio with fade-in...');
        this.toyPianoSynth.volume.rampTo(this.toyPianoTargetVolume, this.fadeDuration, Tone.now());
        this.insectSynth.volume.rampTo(this.insectTargetVolume, this.fadeDuration, Tone.now());

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.insectLoop && this.insectLoop.state !== "started") this.insectLoop.start(0);

        this.isPlaying = true;
        this.isFadingOut = false;
        console.log('💧 Soil audio started/fading in.');
        this.updateUI();
    }

    stopAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            // If audio system isn't even ready, there's nothing to stop in terms of Tone.js
            this.isPlaying = false;
            this.isFadingOut = false;
            this.updateUI();
            return;
        }
        if (!this.isPlaying && !this.isFadingOut) {
            this.updateUI();
            return;
        }
        if (this.isFadingOut) return;

        console.log('💧 Attempting to stop soil audio with fade-out...');
        this.isFadingOut = true;
        this.isPlaying = false;

        // Ensure synths exist before trying to ramp their volume
        if (this.toyPianoSynth) this.toyPianoSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());
        if (this.insectSynth) this.insectSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        this.stopTimeoutId = setTimeout(() => {
            if (this.toyPianoLoop && this.toyPianoLoop.state === "started") this.toyPianoLoop.stop(0);
            if (this.insectLoop && this.insectLoop.state === "started") this.insectLoop.stop(0);

            console.log('💧 Soil audio fully stopped after fade.');
            this.isFadingOut = false;
            this.updateUI();
        }, this.fadeDuration * 1000 + 50);

        this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            console.log('🌱 Dependencies met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) window.soilHandlerInstance = new SoilHandler();
        } else {
            console.log('🌱 Waiting for window.creatune and Tone.js...');
            setTimeout(ensureCreatuneAndTone, 100);
        }
    };
    ensureCreatuneAndTone();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}