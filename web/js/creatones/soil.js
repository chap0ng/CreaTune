class SoilHandler {
    constructor() {
        // Synths and Loops
        this.toyPianoSynth = null;
        this.insectSynth = null; // Will be a single FMSynth
        this.toyPianoLoop = null;
        this.insectLoop = null;
        this.insectLFO = null;

        // Audio Params
        this.fadeDuration = 0.4; // Duration for fade in/out
        this.toyPianoTargetVolume = -3; 
        this.insectTargetVolume = -6;   

        // State
        this.isActive = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.isConnected = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
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
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                console.log('🌱 SoilHandler: Core Dependencies (Tone, window.creatune) ready.');
                this.setupListeners();
                this.updateUI();
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
            if (!this.audioEnabled) {
                try {
                    await Tone.start();
                    this.audioEnabled = true;
                    console.log('🎵 AudioContext started by user gesture.');

                    if (!this.toneInitialized) {
                        this.initTone();
                    }

                    if (!this.toneInitialized) {
                        console.error("💧 Critical: Failed to initialize Tone components after AudioContext start.");
                        this.audioEnableButton.textContent = 'Audio Init Error';
                        this.audioEnableButton.classList.add('audio-button-error');
                        return;
                    }

                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.classList.add('audio-button-confirm');
                    setTimeout(() => this.audioEnableButton.classList.add('audio-button-hidden'), 1000);
                    this.manageAudioAndVisuals();
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
            console.warn('💧 AudioContext not running. Deferring Tone component initialization.');
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

            // Insect Synth - Changed to a single Tone.FMSynth for direct LFO connection
            this.insectSynth = new Tone.FMSynth({ // No longer PolySynth
                harmonicity: 2.5,
                modulationIndex: 8, // Initial value, LFO will modulate this Param
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 0.05, sustain: 0.01, release: 0.1 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
                volume: -Infinity // This is fine for initial silence
            }).toDestination();

            // Now this.insectSynth is an FMSynth, and this.insectSynth.modulationIndex is a valid Param
            if (this.insectSynth && this.insectSynth.modulationIndex) {
                this.insectLFO = new Tone.LFO({
                    frequency: "6Hz", min: 5, max: 15, type: "sine"
                }).start().connect(this.insectSynth.modulationIndex);
            } else {
                console.error("💧 Insect synth (FMSynth) or modulationIndex not available for LFO connection.");
                throw new Error("Insect synth (FMSynth) or modulationIndex not available for LFO connection.");
            }

            this.createToyPianoPattern();
            this.createInsectPattern();

            this.toneInitialized = true;
            console.log('💧 Tone.js components initialized successfully.');

        } catch (error) {
            console.error('❌ Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            // Clean up any partially created Tone objects
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
            console.error('💧 window.creatune not available.');
            return;
        }
        console.log('💧 SoilHandler: Setting up WebSocket listeners...');
        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                this.isActive = state.active;
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                this.isConnected = true;
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                this.isConnected = false;
                this.isActive = false;
                this.manageAudioAndVisuals();
            }
        });
        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
        }
        console.log('💧 SoilHandler: WebSocket listeners set up.');
    }

    manageAudioAndVisuals() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.log(`💧 Audio system not ready (AudioEnabled: ${this.audioEnabled}, ToneInitialized: ${this.toneInitialized}). Cannot manage audio/visuals yet.`);
            this.updateUI();
            return;
        }
        const shouldPlayAudio = this.isConnected && this.isActive;
        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) this.startAudio();
        } else {
            if (this.isPlaying && !this.isFadingOut) this.stopAudio();
        }
        if (!this.isPlaying && !this.isFadingOut) this.updateUI();
    }

    updateUI() {
        if (this.soilCreatureVisual) {
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
        if (!this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💧 Start audio called, but sensor conditions not met (Connected:${this.isConnected}, SensorActive:${this.isActive})`);
            if (this.isPlaying || this.isFadingOut) this.stopAudio();
            else this.updateUI();
            return;
        }
        if (!this.toyPianoSynth || !this.insectSynth) {
            console.error("💧 Critical: Synths not available in startAudio.");
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