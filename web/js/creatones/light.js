class LightHandler {
    constructor() {
        // Synths and Loops
        this.ambientSynth = null;
        this.sparkleSynth = null;
        this.mainLoop = null;
        this.sparkleLoop = null;

        // Audio Params
        this.fadeDuration = 0.8;
        // Base target volumes before appValue modulation and master adjustment
        this.baseAmbientTargetVolume = 3; // Initial base for FMSynth (adjust by ear)
        this.baseSparkleTargetVolume = 6; // Initial base for PluckSynth (adjust by ear)

        // --- Conceptual Master Adjustment Factors ---
        // You can change these values to quickly affect the overall sound
        this.masterVolumeAdjustment = 0;    // Additive dB adjustment (e.g., +3 for louder, -3 for softer)
        this.masterFMBrightnessFactor = 1.0; // Multiplicative factor for FM modulationIndex & harmonicity (e.g., 1.2 for brighter, 0.8 for duller)
        this.masterDelayFeedbackFactor = 1.0; // Multiplicative factor for delay feedback (e.g., 1.1 for more feedback)
        // --------------------------------------------

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
        this.deviceStates = { // To store device-specific connection status
            light: { connected: false }
        };


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
                this.updateUI(); // Initial UI update
                // Check if audio context is already running (e.g., from another handler)
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
        this.manageAudioAndVisuals();
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

        if (this.debugMode) console.log('💡 Initializing Tone.js components for light (Gamelan/Piano style)...');
        try {
            const sharedReverb = new Tone.Reverb({ decay: 4, wet: 0.25 }).toDestination();
            const sharedDelay = new Tone.FeedbackDelay("4n.", Math.min(0.9, 0.45 * this.masterDelayFeedbackFactor)).connect(sharedReverb);


            this.ambientSynth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: Math.max(0.5, 2.0 * this.masterFMBrightnessFactor),
                modulationIndex: Math.max(1, 5 * this.masterFMBrightnessFactor),
                oscillator: { type: 'sine' },
                modulation: { type: 'triangle' },
                envelope: { attack: 0.02, decay: 0.5, sustain: 0.3, release: 2.5 },
                modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 1.5 },
                volume: -Infinity
            }).connect(sharedDelay);

            this.sparkleSynth = new Tone.PluckSynth({
                attackNoise: 0.8,
                dampening: 3500,
                resonance: 0.85,
                release: 0.8,
                volume: -Infinity
            }).connect(sharedReverb);

            this.createAmbientPattern();
            this.createSparklePattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💡 Tone.js components for light (Gamelan/Piano style) initialized successfully.');
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
        const gamelanNotes = ["C3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4"];
        this.mainLoop = new Tone.Pattern( (time, note) => {
            const velocity = Math.max(0.15, this.currentLightAppValue * 0.5 + 0.1);
            this.ambientSynth.triggerAttackRelease(note, "1m", time, velocity);
        }, gamelanNotes, "randomWalk");
        this.mainLoop.interval = "1m";
        this.mainLoop.humanize = "8n";
    }

    createSparklePattern() {
        if (!this.sparkleSynth) return;
        const sparklePitches = ["C5", "E5", "G5", "A5", "C6", "D6", "E6", "G6"];
        this.sparkleLoop = new Tone.Loop(time => {
            const pitch = sparklePitches[Math.floor(Math.random() * sparklePitches.length)];
            const velocity = Math.random() * 0.25 + (this.currentLightAppValue * 0.15);
            this.sparkleSynth.triggerAttackRelease(pitch, "32n", time, Math.max(0.08, velocity));
        }, "8n");
        this.sparkleLoop.probability = 0.0;
        this.sparkleLoop.humanize = "64n";
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
                // this.updateSoundParameters(); // Called by manageAudioAndVisuals
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'light') {
                // Only update if data is fresh and different enough, or simply update
                this.currentLightCondition = data.light_condition || this.currentLightCondition;
                this.currentLightAppValue = data.light_app_value !== undefined ? data.light_app_value : this.currentLightAppValue;
                this.updateSoundParameters(); // Update sound params on new data
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'server') {
                this.isConnected = window.creatune.isConnected; // General server connection
                if (deviceType === 'light') this.deviceStates.light.connected = true;
                if (this.debugMode) console.log(`💡 LightHandler: ${deviceType} connected. Server connected: ${this.isConnected}, Light device connected: ${this.deviceStates.light.connected}`);

                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning(); // Ensures Tone is init if context is running
                } else {
                     this.manageAudioAndVisuals(); // Update UI even if context not running
                }
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'server') {
                this.isConnected = window.creatune.isConnected;
                if (deviceType === 'light') this.deviceStates.light.connected = false;
                if (this.debugMode) console.log(`💡 LightHandler: ${deviceType} disconnected. Server connected: ${this.isConnected}, Light device connected: ${this.deviceStates.light.connected}`);
                
                this.isActive = false; // Assume sensor is inactive if its connection drops or server drops
                this.manageAudioAndVisuals();
            }
        });
        
        // Global audio enabled listener
        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💡 LightHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => { // Optional: handle explicit disable
            if (this.debugMode) console.log("💡 LightHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            this.manageAudioAndVisuals();
        });


        // Initial state check from websocket-client
        const wsClientInitialState = window.creatune.getDeviceState('light');
        if (wsClientInitialState) {
            this.deviceStates.light.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentLightCondition = wsClientInitialState.lastRawData.light_condition || "dark";
                this.currentLightAppValue = wsClientInitialState.lastRawData.light_app_value || 0.0;
            }
            if (this.debugMode) console.log(`💡 Light initial state from wsClient: Connected=${this.deviceStates.light.connected}, Active=${this.isActive}, Condition=${this.currentLightCondition}`);
        }
        this.isConnected = window.creatune.isConnected; // General server connection status
        this.updateUI();
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled) return;

        if (this.ambientSynth) {
            const dynamicVolumePart = this.currentLightAppValue * 10; // How much appValue affects volume
            const targetVolume = this.isActive ? this.baseAmbientTargetVolume + dynamicVolumePart + this.masterVolumeAdjustment : -Infinity;
            this.ambientSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.sparkleLoop && this.sparkleSynth) {
            let probability = 0;
            let sparkleVolMod = 0; // Modifier based on condition

            switch (this.currentLightCondition) {
                case 'dim': probability = 0.1; sparkleVolMod = -6; break;
                case 'bright': probability = 0.25; sparkleVolMod = -2; break;
                case 'very_bright': probability = 0.45; sparkleVolMod = 0; break;
                case 'extremely_bright': probability = 0.65; sparkleVolMod = +3; break;
                default: probability = 0.05; sparkleVolMod = -10; // For 'dark' or 'extremely_dark'
            }
            this.sparkleLoop.probability = this.isActive ? probability : 0;
            const targetSparkleVol = this.isActive ? this.baseSparkleTargetVolume + sparkleVolMod + this.masterVolumeAdjustment : -Infinity;
            this.sparkleSynth.volume.linearRampTo(targetSparkleVol, 0.5);
        }

        if (this.mainLoop) {
            if (this.currentLightAppValue < 0.15) this.mainLoop.interval = "1m";
            else if (this.currentLightAppValue < 0.4) this.mainLoop.interval = "2n";
            else if (this.currentLightAppValue < 0.7) this.mainLoop.interval = "4n";
            else this.mainLoop.interval = "8n";
        }
    }

    manageAudioAndVisuals() {
        // Ensure audioEnabled reflects the current Tone.context.state
        if (Tone.context.state !== 'running') {
            this.audioEnabled = false;
        } else {
            this.audioEnabled = true; // This might have been set by creaTuneAudioEnabled
        }

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Force stop
            if (this.debugMode) console.log(`💡 LightHandler: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💡 LightHandler: Tone not initialized. Attempting initTone.`);
            this.initTone(); // This will only run if audioEnabled is true and context is running
            if (!this.toneInitialized) { // Check again after attempt
                 if (this.debugMode) console.log(`💡 LightHandler: initTone failed or deferred. Cannot manage audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        // Determine if audio should be playing based on sensor and connection state
        const shouldPlayAudio = this.deviceStates.light.connected && this.isActive;


        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) { // If not playing OR if it was fading out
                this.startAudio();
            } else { // Already playing, just ensure parameters are up-to-date
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) { // If playing and NOT already fading out
                this.stopAudio();
            }
        }
        this.updateUI();
    }

    updateUI() {
        if (this.lightCreatureVisual) {
            // Creature is 'active' visually if its device is connected and sensor is active,
            // and audio is playing (or supposed to be playing if enabled)
            const showCreature = this.deviceStates.light.connected && this.isActive;
            this.lightCreatureVisual.classList.toggle('active', showCreature);
            
            // Update condition class regardless of 'active' state for visual feedback
            this.lightCreatureVisual.classList.remove('light-dark', 'light-dim', 'light-bright', 'light-very-bright', 'light-extremely-bright');
            if (this.deviceStates.light.connected) { // Only add condition class if device is connected
                this.lightCreatureVisual.classList.add(`light-${this.currentLightCondition.replace('_', '-')}`);
            }
        }
        if (this.frameBackground) {
            const frameActive = this.deviceStates.light.connected && this.isActive;
            this.frameBackground.classList.toggle('light-active-bg', frameActive);
            
            this.frameBackground.classList.remove('light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg');
            if (this.deviceStates.light.connected) { // Only add condition class if device is connected
                 this.frameBackground.classList.add(`light-${this.currentLightCondition.replace('_', '-')}-bg`);
            }
        }
    }

    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💡 Attempted to startAudio (Light), but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) { // If it was fading out, cancel the fade and resume
            if (this.debugMode) console.log('💡 Cancelling fade-out (Light) to start/resume audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            // Volumes will be set by updateSoundParameters
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("💡 startAudio (Light) called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); // Ensure params are current
            this.updateUI(); return;
        }
        
        // Conditions for starting fresh
        if (!this.deviceStates.light.connected || !this.isActive) {
            if (this.debugMode) console.log(`💡 Start audio (Light) conditions not met (DeviceConnected:${this.deviceStates.light.connected}, SensorActive:${this.isActive}).`);
            // this.stopAudio(); // No need to call stop if not playing
            this.updateUI(); return;
        }
        if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
            console.error("💡 Critical: Synths/Loops not available in startAudio (Light). Attempting re-init.");
            this.initTone(); // Try to re-initialize
             if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
                console.error("💡 Critical: Re-init failed. Cannot start audio.");
                return;
             }
        }

        if (this.debugMode) console.log('💡 Starting light audio...');
        this.isPlaying = true;
        this.isFadingOut = false;

        this.updateSoundParameters(); // Set initial volumes and params

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
        if (!this.isPlaying && !this.isFadingOut && !force) { // Already fully stopped
            if (this.debugMode) console.log("💡 stopAudio (Light) called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) { // Already in the process of fading out
            if (this.debugMode) console.log("💡 stopAudio (Light) called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💡 Stopping light audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; // Visuals should reflect that it's stopping
        this.isFadingOut = true;

        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.ambientSynth) {
            this.ambientSynth.volume.cancelScheduledValues(Tone.now());
            this.ambientSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.sparkleSynth) {
            this.sparkleSynth.volume.cancelScheduledValues(Tone.now());
            this.sparkleSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.mainLoop && this.mainLoop.state === "started") this.mainLoop.stop(0);
            if (this.sparkleLoop && this.sparkleLoop.state === "started") this.sparkleLoop.stop(0);
            
            // Reset volumes to -Infinity in case rampTo didn't complete or for next start
            if (this.ambientSynth) this.ambientSynth.volume.value = -Infinity;
            if (this.sparkleSynth) this.sparkleSynth.volume.value = -Infinity;

            this.isFadingOut = false;
            // isPlaying is already false
            if (this.debugMode) console.log('💡 Light audio fully stopped and loops cleared.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Ensure loops stop after fade
        
        this.updateUI(); // Update UI immediately to reflect stopping state
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightHandler = () => {
        // Ensure global dependencies are available
        if (window.creatune && window.Tone && document.getElementById('audio-enable-button')) {
            if (!window.lightHandlerInstance) { // Create instance only once
                window.lightHandlerInstance = new LightHandler();
                if (window.lightHandlerInstance.debugMode) console.log('💡 Light Handler instance created.');
            }
        } else {
            // Use a temporary instance for debugMode check if main instance not yet created
            const tempDebugMode = (window.lightHandlerInstance && window.lightHandlerInstance.debugMode !== undefined) ? window.lightHandlerInstance.debugMode : new LightHandler().debugMode;
            if (tempDebugMode) console.log('💡 Waiting for LightHandler dependencies (DOMContentLoaded)...');
            setTimeout(initLightHandler, 100);
        }
    };
    initLightHandler();
});

// For potential Node.js/module usage (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightHandler;
}