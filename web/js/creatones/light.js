class LightHandler {
    constructor() {
        // Synths and Loops
        this.ambientSynth = null;
        this.sparkleSynth = null;
        this.mainLoop = null;
        this.sparkleLoop = null;

        // Audio Params
        this.fadeDuration = 1.0; // Example
        this.baseAmbientVolume = 9; // Example (dB)
        this.baseSparkleVolume = 6; // Example (dB)

        // State
        this.isActive = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false; // <<< NEW PROPERTY

        this.currentLightCondition = "dark"; // Default
        this.currentLightAppValue = 0.0;    // Default
        this.deviceStates = { // Local copy for convenience
            light: { connected: false }
        };

        // DOM Elements
        this.lightCreatureVisual = document.querySelector('.light-creature');
        this.frameBackground = document.querySelector('.framebackground');

        if (!this.lightCreatureVisual && this.debugMode) console.warn('💡 .light-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💡 .framebackground element not found for LightHandler.');

        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) { // <<< NEW METHOD
        if (this.debugMode) console.log(`💡 LightHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return; // No change

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`💡 LightHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted && (this.isPlaying || this.isFadingOut)) {
            if (this.debugMode) console.log('💡 LightHandler: Externally muted, forcing audio stop.');
            this.stopAudio(true); // Force stop audio if muted
        }
        this.manageAudioAndVisuals();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('💡 LightHandler: Core Dependencies ready.');
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
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💡 LightHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💡 LightHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💡 LightHandler: Initializing Tone.js components...');
        try {
            const reverb = new Tone.Reverb(1.5).toDestination();
            const delay = new Tone.FeedbackDelay("4n", 0.25).connect(reverb);

            this.ambientSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fatsawtooth", count: 3, spread: 30 },
                envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5 },
                volume: -Infinity
            }).connect(reverb);

            this.sparkleSynth = new Tone.MetalSynth({
                frequency: 200,
                envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
                harmonicity: 3.1,
                modulationIndex: 16,
                resonance: 4000,
                octaves: 1.5,
                volume: -Infinity
            }).connect(delay);

            this.createMainLoop();
            this.createSparkleLoop();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💡 LightHandler: Tone.js components initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ LightHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.ambientSynth) { this.ambientSynth.dispose(); this.ambientSynth = null; }
            if (this.sparkleSynth) { this.sparkleSynth.dispose(); this.sparkleSynth = null; }
            if (this.mainLoop) { this.mainLoop.dispose(); this.mainLoop = null; }
            if (this.sparkleLoop) { this.sparkleLoop.dispose(); this.sparkleLoop = null; }
        }
    }

    createMainLoop() {
        if (!this.ambientSynth) return;
        const notes = ["C3", "E3", "G3", "B3", "C4"];
        this.mainLoop = new Tone.Sequence((time, note) => {
            const velocity = this.currentLightAppValue * 0.5 + 0.1; // Modulate velocity
            this.ambientSynth.triggerAttackRelease(note, "2n", time, velocity);
        }, notes, "4n");
        this.mainLoop.humanize = true;
    }

    createSparkleLoop() {
        if (!this.sparkleSynth) return;
        this.sparkleLoop = new Tone.Loop(time => {
            const freq = Math.random() * 1000 + 500; // Random high frequencies
            this.sparkleSynth.triggerAttackRelease(freq, "32n", time, Math.random() * 0.3 + 0.05);
        }, "8t"); // Triplet feel for sparkles
        this.sparkleLoop.probability = 0; // Start with no probability
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💡 LightHandler: window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💡 LightHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler stateChange: active=${state.active}, condition=${state.rawData.light_condition}, appValue=${state.rawData.light_app_value}`);
                this.isActive = state.active;
                this.currentLightCondition = state.rawData.light_condition || "dark";
                this.currentLightAppValue = state.rawData.light_app_value || 0.0;
                this.deviceStates.light.connected = true;
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'light') {
                // if (this.debugMode) console.log(`💡 LightHandler data: condition=${data.light_condition}, appValue=${data.light_app_value}`);
                this.currentLightCondition = data.light_condition || this.currentLightCondition;
                this.currentLightAppValue = data.light_app_value !== undefined ? data.light_app_value : this.currentLightAppValue;
                this.deviceStates.light.connected = true;
                this.updateSoundParameters();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device connected.`);
                this.deviceStates.light.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device disconnected.`);
                this.deviceStates.light.connected = false;
                this.isActive = false;
                this.manageAudioAndVisuals();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💡 LightHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("💡 LightHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            this.manageAudioAndVisuals();
        });

        const wsClientInitialState = window.creatune.getDeviceState('light');
        if (wsClientInitialState) {
            this.deviceStates.light.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentLightCondition = wsClientInitialState.lastRawData.light_condition || "dark";
                this.currentLightAppValue = wsClientInitialState.lastRawData.light_app_value || 0.0;
            }
            if (this.debugMode) console.log(`💡 LightHandler initial state from wsClient: Connected=${this.deviceStates.light.connected}, Active=${this.isActive}, Condition=${this.currentLightCondition}`);
        }
        this.updateUI();
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted) return; // <<< MODIFIED

        if (this.ambientSynth) {
            const dynamicVolumePart = this.currentLightAppValue * 10; // Example scaling
            const targetVolume = this.isActive ? this.baseAmbientVolume + dynamicVolumePart : -Infinity;
            this.ambientSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.sparkleLoop && this.sparkleSynth) {
            let probability = 0;
            let sparkleVolMod = 0;
            // Example: More sparkles in brighter conditions
            if (this.currentLightCondition === 'bright' || this.currentLightCondition === 'very_bright' || this.currentLightCondition === 'extremely_bright') {
                probability = this.currentLightAppValue * 0.5 + 0.2; // Max 0.7
                sparkleVolMod = 0;
            } else if (this.currentLightCondition === 'dim') {
                probability = this.currentLightAppValue * 0.3 + 0.1; // Max 0.4
                sparkleVolMod = -6;
            } else { // dark
                probability = this.currentLightAppValue * 0.1; // Max 0.1
                sparkleVolMod = -12;
            }
            this.sparkleLoop.probability = this.isActive ? Math.min(0.8, probability) : 0; // Cap probability
            const targetSparkleVol = this.isActive ? this.baseSparkleVolume + sparkleVolMod : -Infinity;
            this.sparkleSynth.volume.linearRampTo(targetSparkleVol, 0.7);
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💡 LightHandler: manageAudioAndVisuals called. ExternallyMuted: ${this.isExternallyMuted}, IsActive: ${this.isActive}, Connected: ${this.deviceStates.light.connected}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (this.isExternallyMuted) { // <<< MODIFIED
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('💡 LightHandler: Externally muted, ensuring audio is stopped.');
                this.stopAudio(true);
            }
            this.updateUI();
            return;
        }

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            if (this.debugMode) console.log(`💡 LightHandler: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💡 LightHandler: Tone not initialized. Attempting initTone.`);
            this.initTone();
            if (!this.toneInitialized) {
                 if (this.debugMode) console.log(`💡 LightHandler: initTone failed or deferred. Cannot manage audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayAudio = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted; // <<< MODIFIED

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            } else {
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
        const showCreature = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted; // <<< MODIFIED

        if (this.lightCreatureVisual) {
            this.lightCreatureVisual.classList.toggle('active', showCreature);
            // Remove all light condition classes first
            this.lightCreatureVisual.classList.remove('light-dark', 'light-dim', 'light-bright', 'light-very-bright', 'light-extremely-bright');
            if (showCreature) { // Only add condition class if creature is shown
                this.lightCreatureVisual.classList.add(`light-${this.currentLightCondition.replace('_', '-')}`);
            }
        }
        if (this.frameBackground) {
            const frameActive = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted; // <<< MODIFIED
            
            if (frameActive) {
                this.frameBackground.classList.add('light-active-bg'); // Generic active class
                // Remove all specific light background classes first
                this.frameBackground.classList.remove('light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg');
                this.frameBackground.classList.add(`light-${this.currentLightCondition.replace('_', '-')}-bg`); // Add current
            } else {
                this.frameBackground.classList.remove('light-active-bg');
                this.frameBackground.classList.remove('light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg');
            }
        }
    }

    startAudio() {
        if (this.isExternallyMuted) { // <<< MODIFIED
            if (this.debugMode) console.log("💡 LightHandler: Attempted to startAudio, but is externally muted.");
            return;
        }
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💡 LightHandler: Attempted to startAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('💡 LightHandler: Cancelling fade-out to start/resume audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("💡 LightHandler: startAudio called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        
        if (!this.deviceStates.light.connected || !this.isActive) {
            if (this.debugMode) console.log(`💡 LightHandler: Start audio conditions not met (DeviceConnected:${this.deviceStates.light.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
            console.error("💡 LightHandler: Critical: Synths/Loops not available in startAudio. Attempting re-init.");
            this.initTone();
             if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
                console.error("💡 LightHandler: Critical: Re-init failed. Cannot start audio.");
                return;
             }
        }

        if (this.debugMode) console.log('💡 LightHandler: Starting audio...');
        this.isPlaying = true; this.isFadingOut = false;
        this.updateSoundParameters();
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.mainLoop.state !== "started") this.mainLoop.start(0);
        if (this.sparkleLoop.state !== "started") this.sparkleLoop.start(0);
        if (this.debugMode) console.log('💡 LightHandler: Audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💡 LightHandler: Attempted to stopAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log("💡 LightHandler: stopAudio called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log("💡 LightHandler: stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💡 LightHandler: Stopping audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; this.isFadingOut = true;
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
            if (this.ambientSynth) this.ambientSynth.volume.value = -Infinity;
            if (this.sparkleSynth) this.sparkleSynth.volume.value = -Infinity;
            this.isFadingOut = false;
            if (this.debugMode) console.log('💡 LightHandler: Audio fully stopped and loops cleared.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100));
        
        if (force) {
            this.updateUI();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.lightHandlerInstance) {
                window.lightHandlerInstance = new LightHandler();
                if (window.lightHandlerInstance.debugMode) console.log('💡 Light Handler instance created.');
            }
        } else {
            const tempDebugMode = (window.lightHandlerInstance && window.lightHandlerInstance.debugMode !== undefined) 
                                  ? window.lightHandlerInstance.debugMode 
                                  : true;
            if (tempDebugMode) console.log('💡 Waiting for LightHandler dependencies (DOMContentLoaded)...');
            setTimeout(initLightHandler, 100);
        }
    };
    initLightHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightHandler;
}