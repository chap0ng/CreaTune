class LightSoilHandler {
    constructor() {
        this.debugMode = true; // Ensure debugMode is on
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
        this.basePadVolume = 3; // dB, fairly loud for "bright"
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
                
                const initialLightState = window.creatune.getDeviceState('light');
                const initialSoilState = window.creatune.getDeviceState('soil');
                if(this.debugMode) console.log('🌿💡 LightSoilHandler Initializing with states:', {initialLightState, initialSoilState});
                
                this.updateInternalDeviceState('light', initialLightState);
                this.updateInternalDeviceState('soil', initialSoilState);

                this.updateCombinedState(); 
                this.updateUI(); 
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
            if (this.debugMode) console.log('🌿💡 LightSoilHandler: AudioContext running, combined active, trying to initTone.');
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    updateInternalDeviceState(deviceType, state) {
        if (!state) {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler.updateInternalDeviceState: No initial state for ${deviceType}`);
            return false;
        }
        let changed = false;
        if (deviceType === 'light') {
            if (this.lightConnected !== state.connected) { this.lightConnected = state.connected; changed = true; if (this.debugMode) console.log(`🌿💡 LS Handler: lightConnected changed to ${this.lightConnected}`);}
            if (this.lightActive !== state.active) { this.lightActive = state.active; changed = true; if (this.debugMode) console.log(`🌿💡 LS Handler: lightActive changed to ${this.lightActive}`);}
            if (state.lastRawData) {
                if (this.currentLightAppValue !== state.lastRawData.light_app_value) { this.currentLightAppValue = state.lastRawData.light_app_value || 0.0; }
                if (this.currentLightCondition !== state.lastRawData.light_condition) { this.currentLightCondition = state.lastRawData.light_condition || "dark"; }
            }
        } else if (deviceType === 'soil') {
            if (this.soilConnected !== state.connected) { this.soilConnected = state.connected; changed = true; if (this.debugMode) console.log(`🌿💡 LS Handler: soilConnected changed to ${this.soilConnected}`);}
            if (this.soilActive !== state.active) { this.soilActive = state.active; changed = true; if (this.debugMode) console.log(`🌿💡 LS Handler: soilActive changed to ${this.soilActive}`);}
            if (state.lastRawData) {
                if (this.currentSoilAppValue !== state.lastRawData.moisture_app_value) { this.currentSoilAppValue = state.lastRawData.moisture_app_value || 0.0; }
                if (this.currentSoilCondition !== state.lastRawData.soil_condition) { this.currentSoilCondition = state.lastRawData.soil_condition || "dry"; }
            }
        }
        if (this.debugMode && changed) console.log(`🌿💡 LightSoilHandler.updateInternalDeviceState for ${deviceType} caused change.`);
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
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler.handleDeviceUpdate for ${deviceType}:`, data);
            let stateChanged = false;
            let previousLightActive = this.lightActive;
            let previousSoilActive = this.soilActive;
            let previousLightConnected = this.lightConnected;
            let previousSoilConnected = this.soilConnected;

            if (deviceType === 'light') {
                if (data.connected !== undefined && this.lightConnected !== data.connected) { this.lightConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.lightActive !== data.active) { this.lightActive = data.active; stateChanged = true; }
                if (data.rawData) { 
                    this.currentLightAppValue = data.rawData.light_app_value !== undefined ? data.rawData.light_app_value : this.currentLightAppValue;
                    this.currentLightCondition = data.rawData.light_condition || this.currentLightCondition;
                } else { 
                    if (data.light_app_value !== undefined) this.currentLightAppValue = data.light_app_value;
                    if (data.light_condition) this.currentLightCondition = data.light_condition;
                }
            } else if (deviceType === 'soil') {
                if (data.connected !== undefined && this.soilConnected !== data.connected) { this.soilConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.soilActive !== data.active) { this.soilActive = data.active; stateChanged = true; }
                 if (data.rawData) { 
                    this.currentSoilAppValue = data.rawData.moisture_app_value !== undefined ? data.rawData.moisture_app_value : this.currentSoilAppValue;
                    this.currentSoilCondition = data.rawData.soil_condition || this.currentSoilCondition;
                } else { 
                    if (data.moisture_app_value !== undefined) this.currentSoilAppValue = data.moisture_app_value;
                    if (data.soil_condition) this.currentSoilCondition = data.soil_condition;
                }
            }

            if (this.debugMode && stateChanged) {
                console.log(`🌿💡 LS.handleDeviceUpdate: stateChanged for ${deviceType}. L: ${previousLightConnected}=>${this.lightConnected}, ${previousLightActive}=>${this.lightActive}. S: ${previousSoilConnected}=>${this.soilConnected}, ${previousSoilActive}=>${this.soilActive}`);
            }

            if (stateChanged) { 
                this.updateCombinedState();
            } else if (this.isCombinedActive && this.isPlaying) { 
                this.updateSoundParameters();
                this.updateUI(); // Update UI as sound params might affect it indirectly
            } else {
                 this.updateUI(); // If no major state change, still update UI for minor data changes
            }
        };

        window.creatune.on('connected', (deviceType) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'connected' for ${deviceType}`);
            handleDeviceUpdate(deviceType, { connected: true, active: (deviceType === 'light' ? this.lightActive : this.soilActive) }); // Keep current active state until stateChange
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'disconnected' for ${deviceType}`);
            handleDeviceUpdate(deviceType, { connected: false, active: false });
        });
        window.creatune.on('stateChange', (deviceType, state) => { 
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'stateChange' for ${deviceType}`, state);
            handleDeviceUpdate(deviceType, { connected: true, active: state.active, rawData: state.rawData });
        });
        window.creatune.on('data', (deviceType, data) => { 
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
        const oldCombinedActiveState = this.isCombinedActive;
        const newCombinedActiveState = this.lightConnected && this.lightActive && this.soilConnected && this.soilActive;

        if (this.debugMode) {
            console.log(`%c🌿💡 LightSoilHandler.updateCombinedState:
    Light: connected=${this.lightConnected}, active=${this.lightActive}, appValue=${typeof this.currentLightAppValue === 'number' ? this.currentLightAppValue.toFixed(2) : this.currentLightAppValue}
    Soil:  connected=${this.soilConnected}, active=${this.soilActive}, appValue=${typeof this.currentSoilAppValue === 'number' ? this.currentSoilAppValue.toFixed(2) : this.currentSoilAppValue}
    ==> newCombinedActiveState: ${newCombinedActiveState} (was ${oldCombinedActiveState})`, 'color: #3498db; font-weight: bold;');
        }

        if (newCombinedActiveState !== oldCombinedActiveState) {
            this.isCombinedActive = newCombinedActiveState;
            if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler: Combined active state CHANGED to: ${this.isCombinedActive}`, 'color: #e67e22; font-weight: bold;');

            if (window.lightHandlerInstance && typeof window.lightHandlerInstance.setExternallyMuted === 'function') {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Setting LightHandler externallyMuted to ${this.isCombinedActive}`);
                window.lightHandlerInstance.setExternallyMuted(this.isCombinedActive);
            }
            if (window.soilHandlerInstance && typeof window.soilHandlerInstance.setExternallyMuted === 'function') {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Setting SoilHandler externallyMuted to ${this.isCombinedActive}`);
                window.soilHandlerInstance.setExternallyMuted(this.isCombinedActive);
            }
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive) { // Combined state didn't change but IS active
            if (this.isPlaying) {
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state unchanged but active & playing. Updating sound params.`);
                 this.updateSoundParameters();
            } else {
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active, but not playing. Calling manageAudioAndVisuals.`);
                 this.manageAudioAndVisuals(); // Attempt to start audio if not already playing
            }
            this.updateUI(); // Always update UI if combined active
        } else { // Not combined active (newCombinedActiveState is false and oldCombinedActiveState was false)
            if (this.debugMode && oldCombinedActiveState) { 
                // This case is covered by the first 'if' when it transitions from true to false.
                // This 'else' means it's consistently not active.
                console.log(`🌿💡 LightSoilHandler: Combined state remains not active. Updating UI.`);
            }
            this.updateUI();
        }
    }


    initTone() {
        if (this.toneInitialized) {
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Already initialized.');
            return;
        }
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`🌿💡 LightSoilHandler.initTone: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('🌿💡 LightSoilHandler.initTone: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Initializing Tone.js components for "Very Bright Ambient Pad"...');
        try {
            this.padReverb = new Tone.Reverb({ decay: 4, wet: 0.6 }).toDestination();
            this.padChorus = new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.7, wet: 0.5 }).connect(this.padReverb);
            this.ambientPadSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fatsawtooth", count: 5, spread: 40 },
                envelope: { attack: 1.5, decay: 0.5, sustain: 0.8, release: 3.0 },
                volume: -Infinity
            }).connect(this.padChorus);

            const padChords = [ /* Cmaj7, Fmaj7, Gmaj7(#11), Amaj7 */
                ["C4", "E4", "G4", "B4"], ["F4", "A4", "C5", "E5"],
                ["G4", "B4", "D5", "F#5"],["A3", "C#4", "E4", "G#4"]
            ];
            let chordIndex = 0;
            this.padLoop = new Tone.Loop(time => {
                const chord = padChords[chordIndex % padChords.length];
                const velocity = (this.currentLightAppValue + this.currentSoilAppValue) / 2 * 0.3 + 0.4;
                this.ambientPadSynth.triggerAttackRelease(chord, "4m", time, velocity);
                chordIndex++;
            }, "4m").start(0);
            this.padLoop.humanize = "16n";

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: "Very Bright Ambient Pad" Tone.js components initialized.');
            this.manageAudioAndVisuals(); // Re-evaluate now that tone is ready

        } catch (error) {
            console.error('❌ LightSoilHandler.initTone: Error during Tone.js component initialization:', error);
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
            const lightFactor = this.currentLightAppValue * 8; 
            const soilFactor = this.currentSoilAppValue * 2;   
            const dynamicVolume = Math.min(0, this.basePadVolume + lightFactor + soilFactor); 
            this.ambientPadSynth.volume.linearRampTo(this.isPlaying ? dynamicVolume : -Infinity, 0.8);
            const spread = 30 + (this.currentLightAppValue * 30); 
            this.ambientPadSynth.set({ oscillator: { spread: spread } });
        }
        if (this.padLoop) {
            const combinedActivity = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
            this.padLoop.interval = combinedActivity > 0.7 ? "2m" : "4m";
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler.manageAudioAndVisuals:
    isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #2ecc71');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (!this.audioEnabled) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler.manageAudioAndVisuals: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }

        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler.manageAudioAndVisuals: Combined active, Tone not initialized. Attempting initTone.');
                this.initTone(); 
                if (!this.toneInitialized) { 
                     if (this.debugMode) console.log('🌿💡 LightSoilHandler.manageAudioAndVisuals: initTone failed or deferred. Returning.');
                     this.updateUI(); return;
                }
            }
            
            if (this.toneInitialized && (!this.isPlaying || this.isFadingOut)) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler.manageAudioAndVisuals: Combined active, Tone initialized, should play. Calling startAudio.');
                this.startAudio();
            } else if (this.toneInitialized && this.isPlaying) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler.manageAudioAndVisuals: Combined active, Tone initialized, already playing. Updating sound params.');
                this.updateSoundParameters(); 
            }
        } else { 
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler.manageAudioAndVisuals: NOT combined active, but was playing. Calling stopAudio.');
                this.stopAudio();
            }
        }
        this.updateUI(); 
    }

    updateUI() {
        // if (this.debugMode) console.log(`🌿💡 LightSoilHandler.updateUI: isCombinedActive=${this.isCombinedActive}`);
        if (this.lightSoilCreatureVisual) {
            this.lightSoilCreatureVisual.classList.toggle('active', this.isCombinedActive);
        }
        if (this.frameBackground) {
            if (this.isCombinedActive) {
                this.frameBackground.classList.add('lightsoil-active-bg');
                this.frameBackground.classList.remove('light-active-bg', 'soil-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');
            } else {
                this.frameBackground.classList.remove('lightsoil-active-bg');
            }
        }
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler.startAudio:
    audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #9b59b6; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if (this.debugMode) console.warn("🌿💡 LightSoilHandler.startAudio: Conditions not met. Returning.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.startAudio: Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler.startAudio: Called, but already playing. Updating params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }

        if (this.debugMode) console.log('🌿💡 LightSoilHandler.startAudio: Starting "Very Bright Ambient Pad" audio...');
        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); 

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.padLoop && this.padLoop.state !== "started") this.padLoop.start(0);

        if (this.debugMode) console.log('🌿💡 LightSoilHandler.startAudio: "Very Bright Ambient Pad" audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
         if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler.stopAudio:
    force=${force}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿💡 LightSoilHandler.stopAudio: Audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler.stopAudio: Called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler.stopAudio: Called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`🌿💡 LightSoilHandler.stopAudio: Stopping "Very Bright Ambient Pad" audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false;
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.ambientPadSynth) {
            this.ambientPadSynth.volume.cancelScheduledValues(Tone.now());
            this.ambientPadSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.padLoop && this.padLoop.state === "started") this.padLoop.stop(0);
            if (this.ambientPadSynth) this.ambientPadSynth.volume.value = -Infinity; 

            this.isFadingOut = false;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.stopAudio: "Very Bright Ambient Pad" audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); 
        
        if(force) this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.lightSoilHandlerInstance) {
                window.lightSoilHandlerInstance = new LightSoilHandler();
                // Ensure debugMode is accessible for the log below
                if (window.lightSoilHandlerInstance && window.lightSoilHandlerInstance.debugMode) console.log('🌿💡 LightSoil Handler instance created.');
                else if (!window.lightSoilHandlerInstance) console.error("Failed to create LightSoilHandler instance");
            }
        } else {
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