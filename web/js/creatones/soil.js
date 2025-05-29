class SoilHandler {
    constructor() {
        // Synths and Loops - Toypiano Style
        this.toyPianoSynth = null;
        this.bellSynth = null;
        this.toyPianoLoop = null;
        this.bellLoop = null;

        // Audio Params - Toypiano Style
        this.fadeDuration = 1.5; // Was 0.8, user changed to 1.5 in provided code
        this.baseToyPianoVolume = 9; 
        this.baseBellVolume = 6;     

        // State
        this.isActive = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false; // <<< NEW PROPERTY

        this.currentSoilCondition = "dry"; // Default
        this.currentSoilAppValue = 0.0;    // Default
        this.deviceStates = { // Local copy for convenience
            soil: { connected: false }
        };

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');

        if (!this.soilCreatureVisual && this.debugMode) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💧 .framebackground element not found for SoilHandler.');

        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) { // <<< NEW METHOD
        if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return; // No change

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted && (this.isPlaying || this.isFadingOut)) {
            if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Externally muted, forcing audio stop.');
            this.stopAudio(true); // Force stop audio if muted
        }
        // Always re-evaluate audio and visuals based on the new muted state
        this.manageAudioAndVisuals();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Core Dependencies ready.');
                this.setupListeners();
                this.updateUI();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('💧 SoilHandler (Toypiano): AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized) {
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💧 SoilHandler (Toypiano): Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💧 SoilHandler (Toypiano): AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💧 SoilHandler: Initializing Tone.js components (Bright Toypiano style)...');
        try {
            const sharedReverb = new Tone.Reverb({ decay: 1.5, wet: 0.35 }).toDestination();
            const sharedDelay = new Tone.FeedbackDelay("8n.", 0.3).connect(sharedReverb);

            this.toyPianoSynth = new Tone.PluckSynth({
                attackNoise: 1,
                dampening: 4000,
                resonance: 0.9,
                release: 0.5,
                volume: -Infinity // Start silent
            }).connect(sharedDelay);

            this.bellSynth = new Tone.Synth({
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.01,
                    decay: 0.3,
                    sustain: 0.1,
                    release: 0.5
                },
                volume: -Infinity // Start silent
            }).connect(sharedReverb);

            this.createToyPianoPattern();
            this.createBellPattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💧 SoilHandler: Tone.js components (Toypiano) initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ SoilHandler (Toypiano): Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.toyPianoSynth) { this.toyPianoSynth.dispose(); this.toyPianoSynth = null; }
            if (this.bellSynth) { this.bellSynth.dispose(); this.bellSynth = null; }
            if (this.toyPianoLoop) { this.toyPianoLoop.dispose(); this.toyPianoLoop = null; }
            if (this.bellLoop) { this.bellLoop.dispose(); this.bellLoop = null; }
        }
    }

    createToyPianoPattern() {
        if (!this.toyPianoSynth) return;
        const toyPianoNotes = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
        this.toyPianoLoop = new Tone.Pattern((time, note) => {
            const velocity = Math.max(0.3, this.currentSoilAppValue * 0.7 + 0.2);
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, velocity);
        }, toyPianoNotes, "randomWalk");
        this.toyPianoLoop.interval = "4n";
        this.toyPianoLoop.humanize = "16n";
    }

    createBellPattern() {
        if (!this.bellSynth) return;
        const bellPitches = ["C6", "E6", "G6", "A6", "C7"];
        this.bellLoop = new Tone.Loop(time => {
            const pitch = bellPitches[Math.floor(Math.random() * bellPitches.length)];
            const velocity = Math.random() * 0.3 + 0.3;
            this.bellSynth.triggerAttackRelease(pitch, "16n", time, velocity);
        }, "2n");
        this.bellLoop.probability = 0.0;
        this.bellLoop.humanize = "32n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 SoilHandler (Toypiano): window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano) stateChange: active=${state.active}, condition=${state.rawData.soil_condition}, appValue=${state.rawData.moisture_app_value}`);
                this.isActive = state.active;
                this.currentSoilCondition = state.rawData.soil_condition || "dry";
                this.currentSoilAppValue = state.rawData.moisture_app_value || 0.0;
                this.deviceStates.soil.connected = true; // Assuming stateChange implies connected
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                // if (this.debugMode) console.log(`💧 SoilHandler (Toypiano) data: condition=${data.soil_condition}, appValue=${data.moisture_app_value}`);
                this.currentSoilCondition = data.soil_condition || this.currentSoilCondition;
                this.currentSoilAppValue = data.moisture_app_value !== undefined ? data.moisture_app_value : this.currentSoilAppValue;
                this.deviceStates.soil.connected = true; // Assuming data implies connected
                this.updateSoundParameters(); // Only update sound params, manageAudioAndVisuals handles start/stop
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Soil device connected.`);
                this.deviceStates.soil.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning(); // Try to init Tone if context is ready
                else this.manageAudioAndVisuals(); // Otherwise, just update based on new connection state
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Soil device disconnected.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false; // Device disconnected means it cannot be active
                this.manageAudioAndVisuals();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano) detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano) detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            this.manageAudioAndVisuals(); // This will likely stop audio
        });

        const wsClientInitialState = window.creatune.getDeviceState('soil');
        if (wsClientInitialState) {
            this.deviceStates.soil.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentSoilCondition = wsClientInitialState.lastRawData.soil_condition || "dry";
                this.currentSoilAppValue = wsClientInitialState.lastRawData.moisture_app_value || 0.0;
            }
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano) initial state from wsClient: Connected=${this.deviceStates.soil.connected}, Active=${this.isActive}, Condition=${this.currentSoilCondition}`);
        }
        this.updateUI(); // Initial UI update
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted) return; // <<< MODIFIED

        if (this.toyPianoSynth) {
            const dynamicVolumePart = this.currentSoilAppValue * 10; // Example scaling
            // Ensure baseToyPianoVolume is negative for dB
            const targetVolume = this.isActive ? (this.baseToyPianoVolume < 0 ? this.baseToyPianoVolume : -18) + dynamicVolumePart : -Infinity;
            this.toyPianoSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.bellLoop && this.bellSynth) {
            let probability = 0;
            let bellVolMod = 0;
            if (this.currentSoilCondition === 'wet') {
                probability = 0.5; bellVolMod = 0;
            } else if (this.currentSoilCondition === 'humid') {
                probability = 0.25; bellVolMod = -4;
            } else { // dry
                probability = 0.1; bellVolMod = -8;
            }
            this.bellLoop.probability = this.isActive ? probability : 0;
            // Ensure baseBellVolume is negative for dB
            const targetBellVol = this.isActive ? (this.baseBellVolume < 0 ? this.baseBellVolume : -24) + bellVolMod : -Infinity;
            this.bellSynth.volume.linearRampTo(targetBellVol, 0.7);
        }

        if (this.toyPianoLoop) {
            if (this.currentSoilAppValue < 0.2) this.toyPianoLoop.interval = "2n";
            else if (this.currentSoilAppValue < 0.6) this.toyPianoLoop.interval = "4n";
            else this.toyPianoLoop.interval = "8n";
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): manageAudioAndVisuals called. ExternallyMuted: ${this.isExternallyMuted}, IsActive: ${this.isActive}, Connected: ${this.deviceStates.soil.connected}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (this.isExternallyMuted) { // <<< MODIFIED: If externally muted, ensure audio is off and UI reflects it.
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Externally muted, ensuring audio is stopped.');
                this.stopAudio(true); // Force stop
            }
            this.updateUI(); // Update UI to reflect muted state (e.g., hide creature)
            return;
        }

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Force stop if audio context dies
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Tone not initialized. Attempting initTone.`);
            this.initTone(); // This will call manageAudioAndVisuals again if successful
            if (!this.toneInitialized) { // If still not initialized (e.g. audio context issue)
                 if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): initTone failed or deferred. Cannot manage audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayAudio = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; // <<< MODIFIED

        if (shouldPlayAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            } else { // Already playing, just update parameters
                this.updateSoundParameters();
            }
        } else { // Should not be playing
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        this.updateUI();
    }

    updateUI() {
        const showCreature = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; // <<< MODIFIED

        if (this.soilCreatureVisual) {
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (showCreature) { // Only add condition class if creature is shown
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}`);
            }
        }
        if (this.frameBackground) {
            const frameActive = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; // <<< MODIFIED
            
            // Only manage soil-specific background if this handler is supposed to be active
            if (frameActive) {
                this.frameBackground.classList.add('soil-active-bg'); // Generic active class
                this.frameBackground.classList.remove('soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg'); // Clear old
                this.frameBackground.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}-bg`); // Add current
            } else {
                // If not active (or externally muted), remove its specific background classes
                // This allows LightSoilHandler or default background to take over.
                this.frameBackground.classList.remove('soil-active-bg');
                this.frameBackground.classList.remove('soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');
            }
        }
    }

    startAudio() {
        if (this.isExternallyMuted) { // <<< MODIFIED
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): Attempted to startAudio, but is externally muted.");
            return;
        }
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 SoilHandler (Toypiano): Attempted to startAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Cancelling fade-out to start/resume audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): startAudio called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        
        if (!this.deviceStates.soil.connected || !this.isActive) { // Already checked isExternallyMuted
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Start audio conditions not met (DeviceConnected:${this.deviceStates.soil.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
            console.error("💧 SoilHandler (Toypiano): Critical: Synths/Loops not available in startAudio. Attempting re-init.");
            this.initTone(); // This will call manageAudioAndVisuals
             if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
                console.error("💧 SoilHandler (Toypiano): Critical: Re-init failed. Cannot start audio.");
                return;
             }
        }

        if (this.debugMode) console.log('💧 SoilHandler: Starting audio (Toypiano)...');
        this.isPlaying = true; this.isFadingOut = false;
        this.updateSoundParameters(); // Set initial volumes based on current state
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.bellLoop.state !== "started") this.bellLoop.start(0);
        if (this.debugMode) console.log('💧 SoilHandler: Audio (Toypiano) started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        // No direct check for isExternallyMuted here, as this method might be called BY setExternallyMuted.
        // The isPlaying/isFadingOut checks handle most cases.
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💧 SoilHandler (Toypiano): Attempted to stopAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { // If already stopped and not forced
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): stopAudio called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) { // If already fading and not forced
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💧 SoilHandler: Stopping audio (Toypiano) ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.toyPianoSynth) {
            this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
            this.toyPianoSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.bellSynth) {
            this.bellSynth.volume.cancelScheduledValues(Tone.now());
            this.bellSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.toyPianoLoop && this.toyPianoLoop.state === "started") this.toyPianoLoop.stop(0);
            if (this.bellLoop && this.bellLoop.state === "started") this.bellLoop.stop(0);
            if (this.toyPianoSynth) this.toyPianoSynth.volume.value = -Infinity;
            if (this.bellSynth) this.bellSynth.volume.value = -Infinity;
            this.isFadingOut = false;
            if (this.debugMode) console.log('💧 SoilHandler: Audio (Toypiano) fully stopped and loops cleared.');
            this.updateUI(); // Update UI after audio is fully stopped
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Add a small buffer for ramp
        
        if (force) { // If forced, update UI immediately as well
            this.updateUI();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
                if (window.soilHandlerInstance.debugMode) console.log('💧 Soil Handler (Toypiano) instance created.');
            }
        } else {
            const tempDebugMode = (window.soilHandlerInstance && window.soilHandlerInstance.debugMode !== undefined) 
                                  ? window.soilHandlerInstance.debugMode 
                                  : true; 
            if (tempDebugMode) console.log('💧 Waiting for SoilHandler (Toypiano) dependencies (DOMContentLoaded)...');
            setTimeout(initSoilHandler, 100);
        }
    };
    initSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}