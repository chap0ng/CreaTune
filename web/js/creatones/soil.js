class SoilHandler {
    constructor() {
        // Synths and Loops
        this.toyPianoSynth = null;
        this.insectSynth = null;
        this.toyPianoLoop = null;
        this.insectLoop = null;
        this.insectLFO = null; // For insect sound modulation

        // Audio Params
        this.melody = null; // Kept for potential future use, but new patterns are primary
        this.fadeDuration = 0.7; // seconds for fade in/out
        this.toyPianoTargetVolume = -15; // dB
        this.insectTargetVolume = -25; // dB

        // State
        this.isActive = false;      // Sensor data indicates 'humid' or 'wet'
        this.isPlaying = false;     // Audio is considered "on" and playing/fading in
        this.isFadingOut = false;   // True if audio is currently in the process of fading out
        this.isConnected = false;   // WebSocket connection to sensor is live
        this.audioEnabled = false;  // User has clicked the enable audio button
        this.debugMode = true;
        this.stopTimeoutId = null; // To manage the timeout for stopping audio after fade

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.audioEnableButton = null;
        this.soilButton = document.getElementById('soil-button'); // Optional
        this.soilStatus = document.getElementById('soil-status'); // Optional

        if (!this.soilCreatureVisual) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground) console.warn('💧 .framebackground element not found.');

        this.initAudioEnableButton();
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                console.log('🌱 SoilHandler: Dependencies (Tone, window.creatune) ready.');
                this.initTone();
                this.setupListeners();
                this.updateUI();
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for dependencies...');
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
                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.classList.add('audio-button-confirm');
                    setTimeout(() => this.audioEnableButton.classList.add('audio-button-hidden'), 1000);

                    // If conditions met, manageAudioAndVisuals will handle starting
                    this.manageAudioAndVisuals();
                } catch (e) {
                    console.error('Error starting AudioContext:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.classList.add('audio-button-error');
                }
            }
        });
        document.body.appendChild(this.audioEnableButton);
    }

    initTone() {
        if (this.toyPianoSynth) return; // Already initialized
        if (!window.Tone) {
            console.error('💧 Tone.js is not loaded.');
            return;
        }
        console.log('💧 Initializing Tone.js components for soil...');

        // Toy Piano Synth
        this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, { // Create synth WITHOUT .toDestination()
            oscillator: { type: 'triangle' }, 
            envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.2 },
            volume: -Infinity 
        });

        const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
        
        // Now, chain the synth through the reverb to the destination
        this.toyPianoSynth.chain(reverb, Tone.Destination);


        // Insect Synth - FMSynth for more complex, potentially metallic/buzzy sounds
        this.insectSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 2.5,
            modulationIndex: 8,
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.05, sustain: 0.01, release: 0.1 },
            modulation: { type: "square" },
            modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
            volume: -Infinity 
        }).toDestination(); // This one is fine as it's not being chained further in the audio path

        // LFO for insect sound modulation (e.g., pitch or filter, here modulationIndex)
        this.insectLFO = new Tone.LFO({
            frequency: "6Hz", 
            min: 5,
            max: 15,
            type: "sine"
        }).start().connect(this.insectSynth.modulationIndex); // Connecting LFO to a synth parameter is fine


        this.createToyPianoPattern();
        this.createInsectPattern();

        console.log('💧 Tone.js components initialized for soil.');
    }

    createToyPianoPattern() {
        const notes = ["C4", "E4", "G4", "A4", "C5", "D4", "F4"]; // A mix for gentle ambiance
        this.toyPianoLoop = new Tone.Loop(time => {
            const note = notes[Math.floor(Math.random() * notes.length)];
            const velocity = Math.random() * 0.4 + 0.2; // Softer velocities
            const duration = Tone.Time("4n").toSeconds() * (Math.random() * 0.5 + 0.75);
            this.toyPianoSynth.triggerAttackRelease(note, duration, time, velocity);
        }, "2n"); // Average interval, can be randomized further if desired
        this.toyPianoLoop.humanize = "16n"; // Add slight timing variations
    }

    createInsectPattern() {
        this.insectLoop = new Tone.Loop(time => {
            const duration = Tone.Time("32n").toSeconds() * (Math.random() * 0.8 + 0.4);
            const velocity = Math.random() * 0.15 + 0.05; // Very subtle
            const pitch = ["A5", "C#6", "E6", "G#5"][Math.floor(Math.random() * 4)];
            this.insectSynth.triggerAttackRelease(pitch, duration, time, velocity);
        }, "3n"); // Irregular, faster rhythm
        this.insectLoop.probability = 0.65; // Doesn't always trigger
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
        this.updateUI();
        console.log('💧 SoilHandler: WebSocket listeners set up.');
    }
    
    manageAudioAndVisuals() {
        const shouldPlayAudio = this.audioEnabled && this.isConnected && this.isActive;

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        if (!this.isPlaying && !this.isFadingOut) {
             this.updateUI();
        }
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
        if (this.isPlaying && !this.isFadingOut) return; 

        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            console.log('💧 Cancelled fade out, starting fade in.');
        }

        if (!this.audioEnabled || !this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💧 Start audio called, but pre-conditions not met (Enabled:${this.audioEnabled}, Connected:${this.isConnected}, SensorActive:${this.isActive})`);
            if (this.isPlaying || this.isFadingOut) this.stopAudio(); 
            else this.updateUI(); 
            return;
        }

        if (!this.toyPianoSynth) { this.initTone(); if (!this.toyPianoSynth) return; }

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
        if (!this.isPlaying && !this.isFadingOut) {
            this.updateUI(); 
            return;
        }
        if (this.isFadingOut) return;

        console.log('💧 Attempting to stop soil audio with fade-out...');
        this.isFadingOut = true;
        this.isPlaying = false; 

        this.toyPianoSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());
        this.insectSynth.volume.rampTo(-Infinity, this.fadeDuration, Tone.now());

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