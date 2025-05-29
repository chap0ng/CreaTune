class SoilHandler {
    constructor() {
        // Synths and Loops
        this.baseSynth = null; // For the main soil tone
        this.rumbleSynth = null; // For a deeper rumble effect
        this.mainLoop = null;
        this.rumbleLoop = null;

        // Audio Params
        this.fadeDuration = 1.0; // Slightly longer fade for soil
        this.baseSynthTargetVolume = -16; // Base volume for AMSynth
        this.baseRumbleTargetVolume = -20; // Base volume for NoiseSynth/Oscillator

        // Master Adjustment Factors (can be added if desired, similar to LightHandler)
        // this.masterVolumeAdjustment = 0;
        // this.masterAMHarmonicityFactor = 1.0;

        // State
        this.isActive = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;

        this.currentSoilCondition = "dry"; // Default
        this.currentSoilAppValue = 0.0;    // Default
        this.deviceStates = { // Local copy for convenience
            soil: { connected: false }
        };

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature'); // Specific to soil
        this.frameBackground = document.querySelector('.framebackground'); // Shared, but class changes
        this.audioEnableButton = document.getElementById('audio-enable-button');

        if (!this.soilCreatureVisual && this.debugMode) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💧 .framebackground element not found for SoilHandler.');
        if (!this.audioEnableButton && this.debugMode) console.warn('💧 #audio-enable-button not found for SoilHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune && this.audioEnableButton) {
                if (this.debugMode) console.log('💧 SoilHandler: Core Dependencies ready.');
                this.setupListeners();
                this.updateUI();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('💧 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('💧 SoilHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized) {
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💧 SoilHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💧 SoilHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💧 SoilHandler: Initializing Tone.js components (Earthy/Rumble style)...');
        try {
            const sharedReverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).toDestination();
            const sharedLowPass = new Tone.Filter(800, "lowpass").connect(sharedReverb); // Low pass for earthy tones

            // Base Soil Synth - AMSynth for a slightly textured tone
            this.baseSynth = new Tone.PolySynth(Tone.AMSynth, {
                harmonicity: 1.5, // Can be adjusted
                oscillator: { type: 'sine' },
                modulation: { type: 'square' },
                envelope: { attack: 0.1, decay: 0.8, sustain: 0.4, release: 1.5 },
                modulationEnvelope: { attack: 0.2, decay: 0.5, sustain: 0.1, release: 1.0 },
                volume: -Infinity
            }).connect(sharedLowPass);

            // Rumble Synth - A low-frequency oscillator or filtered noise
            this.rumbleSynth = new Tone.NoiseSynth({
                noise: { type: 'brown' }, // Brown noise is good for rumbles
                envelope: { attack: 0.5, decay: 1.0, sustain: 0.8, release: 2.0 },
                volume: -Infinity
            }).connect(sharedLowPass);
            // Or, for a pitched rumble:
            // this.rumbleSynth = new Tone.Oscillator({
            //     type: "sine",
            //     frequency: "C1", // Very low
            //     volume: -Infinity
            // }).connect(sharedLowPass);
            // if (this.rumbleSynth instanceof Tone.Oscillator) this.rumbleSynth.start();


            this.createBasePattern();
            this.createRumblePattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💧 SoilHandler: Tone.js components initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ SoilHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.baseSynth) { this.baseSynth.dispose(); this.baseSynth = null; }
            if (this.rumbleSynth) { this.rumbleSynth.dispose(); this.rumbleSynth = null; }
            if (this.mainLoop) { this.mainLoop.dispose(); this.mainLoop = null; }
            if (this.rumbleLoop) { this.rumbleLoop.dispose(); this.rumbleLoop = null; }
        }
    }

    createBasePattern() {
        if (!this.baseSynth) return;
        const soilNotes = ["C2", "D2", "E2", "G2", "A2"]; // Lower, more grounded notes
        this.mainLoop = new Tone.Pattern((time, note) => {
            const velocity = Math.max(0.2, this.currentSoilAppValue * 0.6 + 0.1); // Soil app value influences velocity
            this.baseSynth.triggerAttackRelease(note, "2n", time, velocity); // Longer notes
        }, soilNotes, "random");
        this.mainLoop.interval = "1m"; // Slower base interval
        this.mainLoop.humanize = "4n";
    }

    createRumblePattern() {
        if (!this.rumbleSynth) return;
        this.rumbleLoop = new Tone.Loop(time => {
            if (this.rumbleSynth instanceof Tone.NoiseSynth) {
                const intensity = Math.max(0.1, this.currentSoilAppValue * 0.4); // More rumble with more moisture
                this.rumbleSynth.triggerAttackRelease("8n", time, intensity);
            } else if (this.rumbleSynth instanceof Tone.Oscillator) {
                // For oscillator, we might just control its volume if it's already started
            }
        }, "1m"); // Rumble occurs less frequently
        this.rumbleLoop.probability = 0.0; // Controlled by app value
        this.rumbleLoop.humanize = "2n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 SoilHandler: window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') { // <<< CRITICAL: Filter for 'soil'
                if (this.debugMode) console.log(`💧 SoilHandler stateChange: active=${state.active}, condition=${state.rawData.soil_condition}, appValue=${state.rawData.moisture_app_value}`);
                this.isActive = state.active;
                this.currentSoilCondition = state.rawData.soil_condition || "dry";
                this.currentSoilAppValue = state.rawData.moisture_app_value || 0.0;
                this.deviceStates.soil.connected = true;
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') { // <<< CRITICAL: Filter for 'soil'
                if (this.debugMode) console.log(`💧 SoilHandler data: condition=${data.soil_condition}, appValue=${data.moisture_app_value}`);
                this.currentSoilCondition = data.soil_condition || this.currentSoilCondition;
                this.currentSoilAppValue = data.moisture_app_value !== undefined ? data.moisture_app_value : this.currentSoilAppValue;
                this.deviceStates.soil.connected = true;
                this.updateSoundParameters();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') { // <<< CRITICAL: Filter for 'soil'
                if (this.debugMode) console.log(`💧 SoilHandler: Soil device connected.`);
                this.deviceStates.soil.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') { // <<< CRITICAL: Filter for 'soil'
                if (this.debugMode) console.log(`💧 SoilHandler: Soil device disconnected.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false;
                this.manageAudioAndVisuals();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            this.manageAudioAndVisuals();
        });

        const wsClientInitialState = window.creatune.getDeviceState('soil');
        if (wsClientInitialState) {
            this.deviceStates.soil.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentSoilCondition = wsClientInitialState.lastRawData.soil_condition || "dry";
                this.currentSoilAppValue = wsClientInitialState.lastRawData.moisture_app_value || 0.0;
            }
            if (this.debugMode) console.log(`💧 SoilHandler initial state from wsClient: Connected=${this.deviceStates.soil.connected}, Active=${this.isActive}, Condition=${this.currentSoilCondition}`);
        }
        this.updateUI();
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled) return;

        if (this.baseSynth) {
            const dynamicVolumePart = this.currentSoilAppValue * 12; // Soil app value has a strong effect
            const targetVolume = this.isActive ? this.baseSynthTargetVolume + dynamicVolumePart /* + this.masterVolumeAdjustment */ : -Infinity;
            this.baseSynth.volume.linearRampTo(targetVolume, 0.7);
        }

        if (this.rumbleLoop && this.rumbleSynth) {
            let probability = 0;
            let rumbleVolMod = 0;
            if (this.currentSoilCondition === 'wet') {
                probability = 0.6; rumbleVolMod = 0;
            } else if (this.currentSoilCondition === 'humid') {
                probability = 0.3; rumbleVolMod = -6;
            } else { // dry
                probability = 0.05; rumbleVolMod = -12;
            }
            this.rumbleLoop.probability = this.isActive ? probability : 0;
            const targetRumbleVol = this.isActive ? this.baseRumbleTargetVolume + rumbleVolMod /* + this.masterVolumeAdjustment */ : -Infinity;
            this.rumbleSynth.volume.linearRampTo(targetRumbleVol, 1.0);
        }

        if (this.mainLoop) {
            if (this.currentSoilAppValue < 0.2) this.mainLoop.interval = "1m";      // Very slow if dry
            else if (this.currentSoilAppValue < 0.5) this.mainLoop.interval = "2n"; // Medium
            else this.mainLoop.interval = "4n";                                     // Faster if wet
        }
    }

    manageAudioAndVisuals() {
        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            if (this.debugMode) console.log(`💧 SoilHandler: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💧 SoilHandler: Tone not initialized. Attempting initTone.`);
            this.initTone();
            if (!this.toneInitialized) {
                 if (this.debugMode) console.log(`💧 SoilHandler: initTone failed or deferred. Cannot manage audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayAudio = this.deviceStates.soil.connected && this.isActive;

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) this.startAudio();
            else this.updateSoundParameters();
        } else {
            if (this.isPlaying && !this.isFadingOut) this.stopAudio();
        }
        this.updateUI();
    }

    updateUI() {
        if (this.soilCreatureVisual) {
            const showCreature = this.deviceStates.soil.connected && this.isActive;
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            // Remove all soil condition classes first
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (this.deviceStates.soil.connected) { // Only add if connected
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}`);
            }
        }
        if (this.frameBackground) {
            // Only modify frame if this handler is the 'active' one for the frame
            // This logic might need to be centralized if multiple handlers can affect the frame
            const frameActive = this.deviceStates.soil.connected && this.isActive;
            this.frameBackground.classList.toggle('soil-active-bg', frameActive); // Use a soil-specific active class

            // Remove all soil background condition classes first
            this.frameBackground.classList.remove('soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');
            if (this.deviceStates.soil.connected) { // Only add if connected
                 this.frameBackground.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}-bg`);
            }
        }
    }

    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 SoilHandler: Attempted to startAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('💧 SoilHandler: Cancelling fade-out to start/resume audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("💧 SoilHandler: startAudio called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        
        if (!this.deviceStates.soil.connected || !this.isActive) {
            if (this.debugMode) console.log(`💧 SoilHandler: Start audio conditions not met (DeviceConnected:${this.deviceStates.soil.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.baseSynth || !this.rumbleSynth || !this.mainLoop || !this.rumbleLoop) {
            console.error("💧 SoilHandler: Critical: Synths/Loops not available in startAudio. Attempting re-init.");
            this.initTone();
             if (!this.baseSynth || !this.rumbleSynth || !this.mainLoop || !this.rumbleLoop) {
                console.error("💧 SoilHandler: Critical: Re-init failed. Cannot start audio.");
                return;
             }
        }

        if (this.debugMode) console.log('💧 SoilHandler: Starting audio...');
        this.isPlaying = true; this.isFadingOut = false;
        this.updateSoundParameters();
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.mainLoop.state !== "started") this.mainLoop.start(0);
        if (this.rumbleLoop.state !== "started") this.rumbleLoop.start(0);
        if (this.debugMode) console.log('💧 SoilHandler: Audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💧 SoilHandler: Attempted to stopAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log("💧 SoilHandler: stopAudio called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log("💧 SoilHandler: stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💧 SoilHandler: Stopping audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.baseSynth) {
            this.baseSynth.volume.cancelScheduledValues(Tone.now());
            this.baseSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.rumbleSynth) {
            this.rumbleSynth.volume.cancelScheduledValues(Tone.now());
            this.rumbleSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.mainLoop && this.mainLoop.state === "started") this.mainLoop.stop(0);
            if (this.rumbleLoop && this.rumbleLoop.state === "started") this.rumbleLoop.stop(0);
            if (this.baseSynth) this.baseSynth.volume.value = -Infinity;
            if (this.rumbleSynth) this.rumbleSynth.volume.value = -Infinity;
            this.isFadingOut = false;
            if (this.debugMode) console.log('💧 SoilHandler: Audio fully stopped and loops cleared.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100));
        this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initSoilHandler = () => {
        if (window.creatune && window.Tone && document.getElementById('audio-enable-button')) {
            if (!window.soilHandlerInstance) { // Create instance only once
                window.soilHandlerInstance = new SoilHandler();
                if (window.soilHandlerInstance.debugMode) console.log('💧 Soil Handler instance created.');
            }
        } else {
            const tempDebugMode = (window.soilHandlerInstance && window.soilHandlerInstance.debugMode !== undefined) ? window.soilHandlerInstance.debugMode : true;
            if (tempDebugMode) console.log('💧 Waiting for SoilHandler dependencies (DOMContentLoaded)...');
            setTimeout(initSoilHandler, 100);
        }
    };
    initSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}