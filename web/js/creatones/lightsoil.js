class LightSoilHandler {
    constructor() {
        this.debugMode = true;
        if (this.debugMode) console.log('🌿💡 LightSoil Handler: Constructor called.');

        // --- State for individual sensors ---
        this.lightConnected = false;
        this.lightActive = false;
        this.currentLightAppValue = 0.0; // Normalized 0-1
        this.currentLightCondition = "dark";

        this.soilConnected = false;
        this.soilActive = false;
        this.currentSoilAppValue = 0.0; // Normalized 0-1
        this.currentSoilCondition = "dry";
        // --- End State for individual sensors ---

        this.isCombinedActive = false; // True when both light AND soil are active and connected
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.stopTimeoutId = null;

        // --- Tone.js components for "Very Bright Ambient Pad" ---
        this.ambientPadSynth = null;
        this.padChorus = null;
        this.padReverb = null;
        this.padLoop = null;
        this.fadeDuration = 2.0; // Longer fade for pads
        this.basePadVolume = -12; // dB, fairly loud for "bright"
        // --- End Tone.js components ---

        // --- DOM Elements ---
        this.lightSoilCreatureVisual = document.querySelector('.lightsoil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        // --- End DOM Elements ---

        if (!this.lightSoilCreatureVisual && this.debugMode) console.warn('🌿💡 .lightsoil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌿💡 .framebackground element not found for LightSoilHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler: Core Dependencies ready.');
                this.setupListeners();
                // Get initial states before first updateCombinedState
                const initialLightState = window.creatune.getDeviceState('light');
                const initialSoilState = window.creatune.getDeviceState('soil');
                this.updateInternalDeviceState('light', initialLightState);
                this.updateInternalDeviceState('soil', initialSoilState);

                this.updateCombinedState(); // Initial check based on potentially pre-existing states
                this.updateUI(); // Initial UI update
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌿💡 LightSoilHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && this.isCombinedActive) {
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    updateInternalDeviceState(deviceType, state) {
        if (!state) return false;
        let changed = false;
        if (deviceType === 'light') {
            if (this.lightConnected !== state.connected) { this.lightConnected = state.connected; changed = true; }
            if (this.lightActive !== state.active) { this.lightActive = state.active; changed = true; }
            if (state.lastRawData) {
                if (this.currentLightAppValue !== state.lastRawData.light_app_value) { this.currentLightAppValue = state.lastRawData.light_app_value || 0.0; }
                if (this.currentLightCondition !== state.lastRawData.light_condition) { this.currentLightCondition = state.lastRawData.light_condition || "dark"; }
            }
        } else if (deviceType === 'soil') {
            if (this.soilConnected !== state.connected) { this.soilConnected = state.connected; changed = true; }
            if (this.soilActive !== state.active) { this.soilActive = state.active; changed = true; }
            if (state.lastRawData) {
                if (this.currentSoilAppValue !== state.lastRawData.moisture_app_value) { this.currentSoilAppValue = state.lastRawData.moisture_app_value || 0.0; }
                if (this.currentSoilCondition !== state.lastRawData.soil_condition) { this.currentSoilCondition = state.lastRawData.soil_condition || "dry"; }
            }
        }
        return changed;
    }
    
    updateInternalDeviceData(deviceType, data) {
        if (!data) return;
        if (deviceType === 'light') {
            if (data.light_app_value !== undefined) this.currentLightAppValue = data.light_app_value;
            if (data.light_condition) this.currentLightCondition = data.light_condition;
        } else if (deviceType === 'soil') {
            if (data.moisture_app_value !== undefined) this.currentSoilAppValue = data.moisture_app_value;
            if (data.soil_condition) this.currentSoilCondition = data.soil_condition;
        }
    }


    setupListeners() {
        if (!window.creatune) {
            console.error('🌿💡 LightSoilHandler: window.creatune not available.');
            return;
        }
        if (this.debugMode) console.log('🌿💡 LightSoilHandler: Setting up WebSocket listeners...');

        const handleDeviceUpdate = (deviceType, data) => {
            let stateChanged = false;
            if (deviceType === 'light') {
                if (data.connected !== undefined && this.lightConnected !== data.connected) { this.lightConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.lightActive !== data.active) { this.lightActive = data.active; stateChanged = true; }
                if (data.rawData) { // From stateChange
                    this.currentLightAppValue = data.rawData.light_app_value !== undefined ? data.rawData.light_app_value : this.currentLightAppValue;
                    this.currentLightCondition = data.rawData.light_condition || this.currentLightCondition;
                } else { // From direct data event or connect/disconnect
                    if (data.light_app_value !== undefined) this.currentLightAppValue = data.light_app_value;
                    if (data.light_condition) this.currentLightCondition = data.light_condition;
                }
            } else if (deviceType === 'soil') {
                if (data.connected !== undefined && this.soilConnected !== data.connected) { this.soilConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.soilActive !== data.active) { this.soilActive = data.active; stateChanged = true; }
                 if (data.rawData) { // From stateChange
                    this.currentSoilAppValue = data.rawData.moisture_app_value !== undefined ? data.rawData.moisture_app_value : this.currentSoilAppValue;
                    this.currentSoilCondition = data.rawData.soil_condition || this.currentSoilCondition;
                } else { // From direct data event or connect/disconnect
                    if (data.moisture_app_value !== undefined) this.currentSoilAppValue = data.moisture_app_value;
                    if (data.soil_condition) this.currentSoilCondition = data.soil_condition;
                }
            }

            if (stateChanged) { // Only call updateCombinedState if a connection or active status changed
                this.updateCombinedState();
            } else if (this.isCombinedActive && this.isPlaying) { // If already combined and playing, just update sound params
                this.updateSoundParameters();
            }
            // Always update UI if not a combined state change, as individual params might affect visuals indirectly
            if(!stateChanged) this.updateUI();
        };

        window.creatune.on('connected', (deviceType) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'connected' for ${deviceType}`);
            handleDeviceUpdate(deviceType, { connected: true, active: deviceType === 'light' ? this.lightActive : this.soilActive });
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'disconnected' for ${deviceType}`);
            handleDeviceUpdate(deviceType, { connected: false, active: false });
        });
        window.creatune.on('stateChange', (deviceType, state) => { // state includes {active, rawData}
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'stateChange' for ${deviceType}`, state);
            handleDeviceUpdate(deviceType, { connected: true, active: state.active, rawData: state.rawData });
        });
        window.creatune.on('data', (deviceType, data) => { // For continuous data like appValue
            // if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'data' for ${deviceType}`, data);
            this.updateInternalDeviceData(deviceType, data);
            if (this.isCombinedActive && this.isPlaying) {
                this.updateSoundParameters();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            this.manageAudioAndVisuals();
        });
    }

    updateCombinedState() {
        const newCombinedActiveState = this.lightConnected && this.lightActive && this.soilConnected && this.soilActive;
        if (this.debugMode) {
            // console.log(`🌿💡 UpdateCombinedState: L.Conn=${this.lightConnected}, L.Act=${this.lightActive}, S.Conn=${this.soilConnected}, S.Act=${this.soilActive} => NewCombined=${newCombinedActiveState}, OldCombined=${this.isCombinedActive}`);
        }

        if (newCombinedActiveState !== this.isCombinedActive) {
            this.isCombinedActive = newCombinedActiveState;
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined active state changed to: ${this.isCombinedActive}`);

            if (window.lightHandlerInstance && typeof window.lightHandlerInstance.setExternallyMuted === 'function') {
                window.lightHandlerInstance.setExternallyMuted(this.isCombinedActive);
            }
            if (window.soilHandlerInstance && typeof window.soilHandlerInstance.setExternallyMuted === 'function') {
                window.soilHandlerInstance.setExternallyMuted(this.isCombinedActive);
            }
            this.manageAudioAndVisuals(); // This will also call updateUI
        } else if (this.isCombinedActive && this.isPlaying) {
            // If combined state didn't change, but data might have, update sound params if playing
            this.updateSoundParameters();
            this.updateUI(); // Update UI as parameters might affect visuals indirectly
        } else {
            this.updateUI(); // If not combined active, still update UI
        }
    }


    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`🌿💡 LightSoilHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('🌿💡 LightSoilHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('🌿💡 LightSoilHandler: Initializing Tone.js components for "Very Bright Ambient Pad"...');
        try {
            this.padReverb = new Tone.Reverb({
                decay: 4, // Long decay for ambient feel
                wet: 0.6
            }).toDestination();

            this.padChorus = new Tone.Chorus({
                frequency: 0.5, // Slow chorus
                delayTime: 3.5,
                depth: 0.7,
                wet: 0.5
            }).connect(this.padReverb);

            this.ambientPadSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: "fatsawtooth", // Bright and rich
                    count: 5,
                    spread: 40
                },
                envelope: {
                    attack: 1.5, // Slow attack for pad
                    decay: 0.5,
                    sustain: 0.8,
                    release: 3.0 // Long release
                },
                volume: -Infinity // Start silent
            }).connect(this.padChorus);

            // A simple loop playing a bright, major chord progression
            const padChords = [
                ["C4", "E4", "G4", "B4"], // Cmaj7
                ["F4", "A4", "C5", "E5"], // Fmaj7
                ["G4", "B4", "D5", "F#5"],// Gmaj7(#11) - very bright
                ["A3", "C#4", "E4", "G#4"] // Amaj7
            ];
            let chordIndex = 0;
            this.padLoop = new Tone.Loop(time => {
                const chord = padChords[chordIndex % padChords.length];
                // Velocity can be influenced by combined sensor values for more dynamics
                const velocity = (this.currentLightAppValue + this.currentSoilAppValue) / 2 * 0.3 + 0.4; // Range 0.4 to 0.7
                this.ambientPadSynth.triggerAttackRelease(chord, "4m", time, velocity); // Long chord duration
                chordIndex++;
            }, "4m").start(0); // Change chord every 4 measures
            this.padLoop.humanize = "16n";


            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler: "Very Bright Ambient Pad" Tone.js components initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ LightSoilHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if(this.ambientPadSynth) this.ambientPadSynth.dispose();
            if(this.padChorus) this.padChorus.dispose();
            if(this.padReverb) this.padReverb.dispose();
            if(this.padLoop) this.padLoop.dispose();
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive) return;
        // if (this.debugMode) console.log('🌿💡 LightSoilHandler: Updating sound parameters...');

        if (this.ambientPadSynth) {
            // Make volume brighter with more light, slightly affected by soil
            const lightFactor = this.currentLightAppValue * 8; // Max +8dB from light
            const soilFactor = this.currentSoilAppValue * 2;   // Max +2dB from soil
            const dynamicVolume = Math.min(0, this.basePadVolume + lightFactor + soilFactor); // Cap at 0dB

            this.ambientPadSynth.volume.linearRampTo(this.isPlaying ? dynamicVolume : -Infinity, 0.8);

            // Example: Filter cutoff for brightness
            // Assuming PolySynth's voices are Tone.Synth, they have a filter
            // This is a bit more complex as you'd need to access each voice's filter.
            // For simplicity, we might add a master filter if needed, or adjust oscillator params.
            // For "fatsawtooth", spread can make it sound brighter/fuller
            const spread = 30 + (this.currentLightAppValue * 30); // Spread 30 to 60
            this.ambientPadSynth.set({ oscillator: { spread: spread } });
        }
        if (this.padLoop) {
            // Loop interval could change based on combined activity
            // Example: faster chord changes if very active
            const combinedActivity = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
            if (combinedActivity > 0.7) {
                this.padLoop.interval = "2m";
            } else {
                this.padLoop.interval = "4m";
            }
        }
    }

    manageAudioAndVisuals() {
        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }

        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                this.initTone(); // Will call manageAudioAndVisuals again if successful
                if (!this.toneInitialized) { // If initTone failed
                     this.updateUI(); return;
                }
            }
            // If tone is initialized and we should be playing but aren't (or are fading out from a previous stop)
            if (this.toneInitialized && (!this.isPlaying || this.isFadingOut)) {
                this.startAudio();
            } else if (this.toneInitialized && this.isPlaying) {
                this.updateSoundParameters(); // Already playing, just update params
            }
        } else { // Not combined active
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        this.updateUI(); // Always update UI at the end of this flow
    }

    updateUI() {
        if (this.lightSoilCreatureVisual) {
            this.lightSoilCreatureVisual.classList.toggle('active', this.isCombinedActive);
        }
        if (this.frameBackground) {
            if (this.isCombinedActive) {
                this.frameBackground.classList.add('lightsoil-active-bg');
                // Ensure other specific backgrounds are removed
                this.frameBackground.classList.remove('light-active-bg', 'soil-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');
            } else {
                this.frameBackground.classList.remove('lightsoil-active-bg');
                // If LightSoil is NOT active, the individual handlers' updateUI (called via setExternallyMuted)
                // will manage their own backgrounds if they become active.
            }
        }
    }

    startAudio() {
        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if (this.debugMode) console.warn("🌿💡 LightSoilHandler: Attempted to startAudio, but conditions not met.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('🌿💡 LightSoilHandler: Cancelling fade-out to start audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler: startAudio called, but already playing. Updating params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }

        if (this.debugMode) console.log('🌿💡 LightSoilHandler: Starting "Very Bright Ambient Pad" audio...');
        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); // Set initial parameters

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.padLoop && this.padLoop.state !== "started") this.padLoop.start(0);

        if (this.debugMode) console.log('🌿💡 LightSoilHandler: "Very Bright Ambient Pad" audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿💡 LightSoilHandler: Attempted to stopAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler: stopAudio called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler: stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Stopping "Very Bright Ambient Pad" audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false;
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.ambientPadSynth) this.ambientPadSynth.volume.cancelScheduledValues(Tone.now());
        if (this.ambientPadSynth) this.ambientPadSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.padLoop && this.padLoop.state === "started") this.padLoop.stop(0);
            if (this.ambientPadSynth) this.ambientPadSynth.volume.value = -Infinity; // Ensure it's silent

            this.isFadingOut = false;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler: "Very Bright Ambient Pad" audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Add buffer for ramp
        
        if(force) this.updateUI(); // Update UI immediately if forced
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.lightSoilHandlerInstance) {
                window.lightSoilHandlerInstance = new LightSoilHandler();
                if (window.lightSoilHandlerInstance.debugMode) console.log('🌿💡 LightSoil Handler instance created.');
            }
        } else {
            // Use a temporary debug flag if the instance or its debugMode isn't set yet
            const tempDebugMode = (window.lightSoilHandlerInstance && window.lightSoilHandlerInstance.debugMode !== undefined) 
                                  ? window.lightSoilHandlerInstance.debugMode 
                                  : true; 
            if (tempDebugMode) console.log('🌿💡 Waiting for LightSoilHandler dependencies (DOMContentLoaded)...');
            setTimeout(initLightSoilHandler, 100);
        }
    };
    initLightSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightSoilHandler;
}