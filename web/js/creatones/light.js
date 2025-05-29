class LightHandler {
    constructor() {
        // Synths and Loops
        this.ambientSynth = null;
        this.sparkleSynth = null;
        this.mainLoop = null;
        this.sparkleLoop = null;

        // Audio Params
        this.fadeDuration = 0.8;
        this.ambientTargetVolume = -12;
        this.sparkleTargetVolume = -18;

        // State
        this.isActive = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.isConnected = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;

        this.currentLightCondition = "dark";
        this.currentLightAppValue = 0.0;

        // DOM Elements
        this.lightCreatureVisual = document.querySelector('.light-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.audioEnableButton = document.getElementById('audio-enable-button');

        if (!this.lightCreatureVisual && this.debugMode) console.warn('💡 .light-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💡 .framebackground element not found for LightHandler.');
        if (!this.audioEnableButton && this.debugMode) console.warn('💡 #audio-enable-button not found for LightHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune && this.audioEnableButton) {
                if (this.debugMode) console.log('💡 LightHandler: Core Dependencies (Tone, window.creatune, AudioButton) ready.');
                this.setupListeners();
                this.updateUI();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('💡 LightHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }
    
    handleAudioContextRunning() {
        if (this.debugMode) console.log('💡 LightHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized) {
            this.initTone();
        }
        this.manageAudioAndVisuals(); // Re-evaluate based on current state
    }


    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💡 Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💡 AudioContext not running for LightHandler. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💡 Initializing Tone.js components for light...');
        try {
            const sharedReverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).toDestination();
            const sharedDelay = new Tone.FeedbackDelay("8n", 0.3).connect(sharedReverb);

            this.ambientSynth = new Tone.PolySynth(Tone.AMSynth, {
                harmonicity: 1.2,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.8, decay: 1.2, sustain: 0.7, release: 2.5 },
                modulation: { type: 'triangle' },
                modulationEnvelope: { attack: 1.2, decay: 0.8, sustain: 0.8, release: 2.0 },
                volume: -Infinity
            }).connect(sharedDelay);

            this.sparkleSynth = new Tone.PluckSynth({
                attackNoise: 0.6,
                dampening: 5000,
                resonance: 0.75,
                release: 0.6,
                volume: -Infinity
            }).connect(sharedReverb); // Sparkles also go to reverb for space

            this.createAmbientPattern();
            this.createSparklePattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💡 Tone.js components for light initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ Error during LightHandler Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.ambientSynth) { this.ambientSynth.dispose(); this.ambientSynth = null; }
            if (this.sparkleSynth) { this.sparkleSynth.dispose(); this.sparkleSynth = null; }
            if (this.mainLoop) { this.mainLoop.dispose(); this.mainLoop = null; }
            if (this.sparkleLoop) { this.sparkleLoop.dispose(); this.sparkleLoop = null; }
        }
    }

    createAmbientPattern() {
        if (!this.ambientSynth) return;
        this.mainLoop = new Tone.Pattern( (time, note) => {
            // Adjust velocity based on lightAppValue, ensuring it's not too quiet
            const velocity = Math.max(0.1, this.currentLightAppValue * 0.4 + 0.1);
            this.ambientSynth.triggerAttackRelease(note, "2m", time, velocity);
        }, ["C3", "G3", "E4", "A3", "D4"], "randomWalk");
        this.mainLoop.interval = "1m";
        this.mainLoop.humanize = "4n";
    }

    createSparklePattern() {
        if (!this.sparkleSynth) return;
        this.sparkleLoop = new Tone.Loop(time => {
            const pitch = ["C5", "E5", "G5", "A5", "C6", "D6"][Math.floor(Math.random() * 6)];
            // Velocity also slightly influenced by light, but more random
            const velocity = Math.random() * 0.2 + (this.currentLightAppValue * 0.1);
            this.sparkleSynth.triggerAttackRelease(pitch, "16n", time, Math.max(0.05, velocity));
        }, "4n"); // Base interval, probability will control actual occurrence
        this.sparkleLoop.probability = 0.0; // Start with no probability, will be set by updateSoundParameters
        this.sparkleLoop.humanize = "32n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💡 window.creatune (WebSocket client) not available for LightHandler.');
            return;
        }
        if (this.debugMode) console.log('💡 LightHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 Light stateChange: active=${state.active}, condition=${state.rawData.light_condition}, appValue=${state.rawData.light_app_value}`);
                this.isActive = state.active;
                this.currentLightCondition = state.rawData.light_condition || "dark";
                this.currentLightAppValue = state.rawData.light_app_value || 0.0;
                this.updateSoundParameters();
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'light') {
                this.currentLightCondition = data.light_condition || this.currentLightCondition;
                this.currentLightAppValue = data.light_app_value || this.currentLightAppValue;
                this.updateSoundParameters();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'server') { // Also react to general server connection
                if (this.debugMode) console.log(`💡 Light sensor or server connected (deviceType: ${deviceType}).`);
                this.isConnected = window.creatune.isConnected; // Check general server connection
                if (deviceType === 'light') this.deviceStates.light.connected = true;

                // If audio context is running, try to init Tone and manage audio
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'server') {
                if (this.debugMode) console.log(`💡 Light sensor or server disconnected (deviceType: ${deviceType}).`);
                this.isConnected = window.creatune.isConnected;
                 if (deviceType === 'light') this.deviceStates.light.connected = false;
                this.isActive = false;
                this.manageAudioAndVisuals();
            }
        });
        
        // Listen for a global audio enabled event if you implement one
        // document.addEventListener('creaTuneAudioEnabled', () => {
        //    this.handleAudioContextRunning();
        // });

        // Initial state check
        const initialState = window.creatune.getDeviceState('light');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            if (initialState.lastRawData) {
                this.currentLightCondition = initialState.lastRawData.light_condition || "dark";
                this.currentLightAppValue = initialState.lastRawData.light_app_value || 0.0;
            }
            if (this.debugMode) console.log(`💡 Light initial state: Connected=${this.isConnected}, Active=${this.isActive}, Condition=${this.currentLightCondition}`);
        }
        this.updateUI();
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled) return;

        if (this.ambientSynth) {
            const targetVolume = this.isActive ? this.ambientTargetVolume + (this.currentLightAppValue * 12) - 6 : -Infinity; // More dynamic range
            this.ambientSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.sparkleLoop && this.sparkleSynth) {
            let probability = 0;
            let sparkleVol = -Infinity;
            switch (this.currentLightCondition) {
                case 'dim': probability = 0.05; sparkleVol = this.sparkleTargetVolume - 8; break;
                case 'bright': probability = 0.15; sparkleVol = this.sparkleTargetVolume - 3; break;
                case 'very_bright': probability = 0.3; sparkleVol = this.sparkleTargetVolume; break;
                case 'extremely_bright': probability = 0.5; sparkleVol = this.sparkleTargetVolume + 2; break;
                default: probability = 0; // dark
            }
            this.sparkleLoop.probability = probability;
            this.sparkleSynth.volume.linearRampTo(sparkleVol, 0.5);
        }

        if (this.mainLoop) {
            if (this.currentLightAppValue < 0.25) this.mainLoop.interval = "1m";
            else if (this.currentLightAppValue < 0.6) this.mainLoop.interval = "2n"; // Corrected from "2m" to "2n" for faster
            else this.mainLoop.interval = "4n";
        }
    }

    manageAudioAndVisuals() {
        if (Tone.context.state !== 'running') {
            this.audioEnabled = false;
        } else {
            this.audioEnabled = true;
        }

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Force stop if audio becomes disabled
            if (this.debugMode) console.log(`💡 LightHandler: AudioContext not running. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💡 LightHandler: Tone not initialized. Attempting initTone.`);
            this.initTone();
            if (!this.toneInitialized) {
                 if (this.debugMode) console.log(`💡 LightHandler: initTone failed. Cannot manage audio.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayAudio = this.isConnected && this.isActive;

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            } else { // Already playing, just update params
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        this.updateUI();
    }

    updateUI() {
        if (this.lightCreatureVisual) {
            const showCreature = this.isConnected && this.isActive && this.isPlaying && !this.isFadingOut;
            this.lightCreatureVisual.classList.toggle('active', showCreature);
            this.lightCreatureVisual.classList.remove('light-dark', 'light-dim', 'light-bright', 'light-very-bright', 'light-extremely-bright');
            if (this.isConnected) { // Show condition class even if not "active" for visual feedback
                this.lightCreatureVisual.classList.add(`light-${this.currentLightCondition.replace('_', '-')}`);
            }
        }
        if (this.frameBackground) {
            this.frameBackground.classList.toggle('light-active-bg', this.isConnected && this.isActive);
            // Remove previous condition classes
            this.frameBackground.classList.remove('light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg', 'light-dark-bg');
            if (this.isConnected) {
                 this.frameBackground.classList.add(`light-${this.currentLightCondition.replace('_', '-')}-bg`);
            }
        }
    }

    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💡 Attempted to startAudio (Light), but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('💡 Cancelling fade-out (Light) to start audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("💡 startAudio (Light) called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        if (!this.isConnected || !this.isActive) {
            if (this.debugMode) console.log(`💡 Start audio (Light) conditions not met (Connected:${this.isConnected}, SensorActive:${this.isActive}).`);
            this.stopAudio(); return;
        }
        if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
            console.error("💡 Critical: Synths/Loops not available in startAudio (Light).");
            return;
        }

        if (this.debugMode) console.log('💡 Starting light audio...');
        this.isPlaying = true;
        this.isFadingOut = false;

        this.updateSoundParameters();

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.mainLoop.state !== "started") this.mainLoop.start(0);
        if (this.sparkleLoop.state !== "started") this.sparkleLoop.start(0);

        if (this.debugMode) console.log('💡 Light audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💡 Attempted to stopAudio (Light), but audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log("💡 stopAudio (Light) called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log("💡 stopAudio (Light) called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💡 Stopping light audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; // Set immediately, visual will update
        this.isFadingOut = true;

        if (this.ambientSynth) {
            this.ambientSynth.volume.cancelScheduledValues(Tone.now());
            this.ambientSynth.volume.rampTo(-Infinity, force ? 0.01 : this.fadeDuration, Tone.now());
        }
        if (this.sparkleSynth) {
            this.sparkleSynth.volume.cancelScheduledValues(Tone.now());
            this.sparkleSynth.volume.rampTo(-Infinity, force ? 0.01 : this.fadeDuration, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.mainLoop && this.mainLoop.state === "started") this.mainLoop.stop(0);
            if (this.sparkleLoop && this.sparkleLoop.state === "started") this.sparkleLoop.stop(0);
            this.isFadingOut = false;
            if (this.debugMode) console.log('💡 Light audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100));
        this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightHandler = () => {
        if (window.creatune && window.Tone && document.getElementById('audio-enable-button')) {
            if (!window.lightHandlerInstance) {
                window.lightHandlerInstance = new LightHandler();
                if (window.lightHandlerInstance.debugMode) console.log('💡 Light Handler instance created.');
            }
        } else {
            if (new LightHandler().debugMode) console.log('💡 Waiting for LightHandler dependencies (DOMContentLoaded)...');
            setTimeout(initLightHandler, 100);
        }
    };
    initLightHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightHandler;
}