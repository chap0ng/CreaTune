class LightSoilHandler {
    constructor() {
        this.debugMode = true;
        if (this.debugMode) console.log('🌿💡 LightSoil Handler: Constructor called.');

        // --- State for individual sensors ---
        this.lightConnected = false;
        this.lightActive = false;
        this.currentLightAppValue = 0.0;
        this.currentLightCondition = "dark";

        this.soilConnected = false;
        this.soilActive = false;
        this.currentSoilAppValue = 0.0;
        this.currentSoilCondition = "dry";
        // --- End State for individual sensors ---

        // --- Combined State ---
        this.isCombinedActive = false; 
        this.showLightSoilVisualContext = false; 
        // --- End Combined State ---

        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false; 
        this.isFadingOut = false;
        this.stopTimeoutId = null;

        // --- Tone.js components ---
        this.mainSynth = null; 
        this.padChorus = null;
        this.padReverb = null;
        this.generativeLoop = null; 
        this.fadeDuration = 2.0;
        this.baseVolume = 0; 

        // --- Record Mode Properties ---
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null;
        this.rhythmFollower = null;
        this.rhythmicLoop = null;
        this.recordingDuration = 5000;
        this.rhythmThreshold = -30;
        this.rhythmNoteCooldown = 140;
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;
        this.rhythmicPlaybackVolume = 0; 

        // --- Note Display ---
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        // --- Sprite Animation State for LightSoil Creature ---
        this.lightSoilCreatureCurrentFrame = 0;
        this.lightSoilCreatureTotalFrames = 6; // For 0%, 20%, 40%, 60%, 80%, 100% (6 positions)

        // --- DOM Elements ---
        this.lightSoilCreatureVisual = document.querySelector('.lightsoil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        if (!this.lightSoilCreatureVisual && this.debugMode) console.warn('🌿💡 .lightsoil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌿💡 .framebackground element not found for LightSoilHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌿💡 #stoprecordmode button not found for LightSoilHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune && window.lightHandlerInstance && window.soilHandlerInstance) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler: All Dependencies ready.');
                this.setupListeners();

                const initialLightState = window.creatune.getDeviceState('light');
                const initialSoilState = window.creatune.getDeviceState('soil');
                if (this.debugMode) console.log('🌿💡 LightSoilHandler Initializing with states:', { initialLightState, initialSoilState });

                this.updateInternalDeviceState('light', initialLightState);
                this.updateInternalDeviceState('soil', initialSoilState);

                this.updateCombinedState(); // This will call manageAudioAndVisuals and updateUI
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Waiting for dependencies... Tone: ${!!window.Tone}, Creatune: ${!!window.creatune}, LightH: ${!!window.lightHandlerInstance}, SoilH: ${!!window.soilHandlerInstance}`);
                setTimeout(checkDependencies, 200);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌿💡 LightSoilHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode && !this.isExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LightSoilHandler: AudioContext running, trying to initTone.');
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    setExternallyMuted(isMuted) {
        if (this.debugMode) console.log(`🌿💡 LightSoilHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return;

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`🌿💡 LightSoilHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Externally muted, forcing exit from its own record mode.`);
                this.exitRecordMode(true);
            } else if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler: Externally muted, stopping its generative audio.');
                this.stopAudio(true);
            }
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
        if (this.debugMode && changed) console.log(`🌿💡 LightSoilHandler.updateInternalDeviceState for ${deviceType} caused change. Light: con=${this.lightConnected},act=${this.lightActive}. Soil: con=${this.soilConnected},act=${this.soilActive}`);
        return changed;
    }

    updateInternalDeviceData(deviceType, data) {
        if (!data) return;
        let needsParamUpdate = false;
        if (deviceType === 'light') {
            if (data.light_app_value !== undefined && this.currentLightAppValue !== data.light_app_value) {
                this.currentLightAppValue = data.light_app_value;
                needsParamUpdate = true;
            }
            if (data.light_condition && this.currentLightCondition !== data.light_condition) {
                this.currentLightCondition = data.light_condition;
                // Condition change might not directly affect sound params but good to note
            }
        } else if (deviceType === 'soil') {
            if (data.moisture_app_value !== undefined && this.currentSoilAppValue !== data.moisture_app_value) {
                this.currentSoilAppValue = data.moisture_app_value;
                needsParamUpdate = true;
            }
            if (data.soil_condition && this.currentSoilCondition !== data.soil_condition) {
                this.currentSoilCondition = data.soil_condition;
            }
        }
        if (needsParamUpdate && this.isCombinedActive && this.isPlaying && !this.isRecordMode && !this.isExternallyMuted) {
            this.updateSoundParameters();
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

            if (deviceType === 'light') {
                if (data.connected !== undefined && this.lightConnected !== data.connected) { this.lightConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.lightActive !== data.active) { this.lightActive = data.active; stateChanged = true; }
                if (data.rawData) { // Prefer rawData if available for initial full state
                    this.currentLightAppValue = data.rawData.light_app_value !== undefined ? data.rawData.light_app_value : this.currentLightAppValue;
                    this.currentLightCondition = data.rawData.light_condition || this.currentLightCondition;
                } else { // Fallback for simpler updates
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

            if (stateChanged) {
                this.updateCombinedState();
            } else if (this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
                this.updateSoundParameters(); // Only update sound if already playing and active
                this.updateUI(); // Still update UI for potential data changes
            } else {
                 this.updateUI(); // Update UI for data changes even if not active/playing
            }
        };

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'soil') {
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'connected' for ${deviceType}`);
                 handleDeviceUpdate(deviceType, { connected: true, active: (deviceType === 'light' ? this.lightActive : this.soilActive) });
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'soil') {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'disconnected' for ${deviceType}`);
                handleDeviceUpdate(deviceType, { connected: false, active: false }); // Also set active to false
                if (this.isRecordMode) { // If LightSoil itself is in record mode
                    this.exitRecordMode(true); // Force exit its own record mode
                }
                // updateCombinedState will be called by handleDeviceUpdate, which then calls manageAudioAndVisuals
            }
        });
        window.creatune.on('stateChange', (deviceType, state) => { // This usually carries full state including rawData
            if (deviceType === 'light' || deviceType === 'soil') {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'stateChange' for ${deviceType}`, state);
                handleDeviceUpdate(deviceType, { ...state }); // Pass full state object
            }
        });
        window.creatune.on('data', (deviceType, data) => { // This is for continuous data updates
            if (deviceType === 'light' || deviceType === 'soil') {
                this.updateInternalDeviceData(deviceType, data);
                if (this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
                    this.updateSoundParameters();
                }
                 this.updateUI(); // Update UI on any data change
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("🌿💡 LightSoilHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            this.manageAudioAndVisuals(); // This will stop audio and update UI
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                // Define lightRec and soilRec here
                const lightRec = window.lightHandlerInstance?.isRecordMode;
                const soilRec = window.soilHandlerInstance?.isRecordMode;
                const tempRec = window.temperatureHandlerInstance?.isRecordMode; // Added for completeness
                const tempSoilRec = window.tempSoilHandlerInstance?.isRecordMode; // Added for completeness
                const tempLightRec = window.tempLightHandlerInstance?.isRecordMode; // ADDED CHECK

                if (this.isCombinedActive && // Only allow record mode if LightSoil itself is fully active
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !lightRec && !soilRec && !tempRec && !tempSoilRec && !tempLightRec && // No other handler is recording // ADDED tempLightRec
                    this.frameBackground.classList.contains('lightsoil-active-bg') // CRUCIAL: Only if LS background is showing
                ) {
                    if (this.debugMode) console.log(`🌿💡 LightSoil frameBackground click: Conditions met, 'lightsoil-active-bg' is present. Entering record mode for LightSoil.`);
                    this.enterRecordMode();
                }
                // Log if LightSoil could have entered but its BG wasn't showing, or other general failure conditions
                else if (!this.isRecordMode && !lightRec && !soilRec && !tempRec && !tempSoilRec && !tempLightRec) { // Only log detailed failure if no one is recording // ADDED tempLightRec
                    if (this.isCombinedActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('lightsoil-active-bg')) {
                        if (this.debugMode) console.log(`🌿💡 LightSoil frameBackground click: LightSoil eligible (combinedActive, audio, toneInit), but 'lightsoil-active-bg' NOT present. Current BGs: ${Array.from(this.frameBackground.classList).join(', ')}. No action for LightSoil.`);
                    } else if (this.debugMode) {
                        console.log(`🌿💡 LightSoil frameBackground click: Record mode NOT entered for LightSoil. Conditions: isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRec=${lightRec}, soilRec=${soilRec}, tempRec=${tempRec}, tsRec=${tempSoilRec}, tlRec=${tempLightRec}, hasLSbg=${this.frameBackground.classList.contains('lightsoil-active-bg')}`); // ADDED tlRec
                    }
                }
            });
        }

        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (this.isRecordMode) {
                    this.exitRecordMode();
                }
            });
        }
    }

    updateCombinedState() {
        const oldCombinedActiveState = this.isCombinedActive;
        const oldShowLightSoilVisualContext = this.showLightSoilVisualContext;

        // For creature and generative sound: both sensors must be connected AND active
        this.isCombinedActive = this.lightConnected && this.lightActive && this.soilConnected && this.soilActive;
        // For background and muting others: both sensors just need to be connected
        this.showLightSoilVisualContext = this.lightConnected && this.soilConnected;

        if (this.debugMode) {
            console.log(`%c🌿💡 LightSoilHandler.updateCombinedState:
    Light: connected=${this.lightConnected}, active=${this.lightActive}
    Soil:  connected=${this.soilConnected}, active=${this.soilActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showLightSoilVisualContext: ${this.showLightSoilVisualContext} (was ${oldShowLightSoilVisualContext})`, 'color: #3498db; font-weight: bold;');
        }

        // --- Manage Muting of Individual Handlers ---
        if (this.showLightSoilVisualContext && !this.isRecordMode) { // If LightSoil context is active (both connected) and not in its own record mode
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.lightHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Muting LightHandler (LS context active).`);
                window.lightHandlerInstance.setExternallyMuted(true);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.soilHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Muting SoilHandler (LS context active).`);
                window.soilHandlerInstance.setExternallyMuted(true);
            }
        } else if (!this.isRecordMode) { // If LightSoil context is NOT active, or LightSoil is in record mode (letting others be)
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.lightHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting LightHandler (LS context not active or LS in rec mode).`);
                window.lightHandlerInstance.setExternallyMuted(false);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                // Before unmuting Soil, check if TempSoil wants it muted
                const tempSoilShowsContext = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
                if (!tempSoilShowsContext) { // Only unmute if TempSoil is NOT showing its context
                    if (this.debugMode && window.soilHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting SoilHandler (LS context not active, TS context not active).`);
                    window.soilHandlerInstance.setExternallyMuted(false);
                } else if (this.debugMode) {
                    console.log(`🌿💡 LightSoil: NOT un-muting SoilHandler because TempSoil context is active.`);
                }
            }
        }
        // --- End Muting Logic ---

        if (this.isCombinedActive !== oldCombinedActiveState || this.showLightSoilVisualContext !== oldShowLightSoilVisualContext) {
            if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler: Combined state CHANGED. isCombinedActive: ${this.isCombinedActive}, showLightSoilVisualContext: ${this.showLightSoilVisualContext}`, 'color: #e67e22; font-weight: bold;');
            this.manageAudioAndVisuals(); // This will handle starting/stopping audio based on this.isCombinedActive
        } else if (this.isCombinedActive) { // Combined state unchanged but active
            if (this.isPlaying && !this.isRecordMode) {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active & playing. Updating sound params.`);
                this.updateSoundParameters();
            } else if (!this.isRecordMode) { // Was not playing, but should be
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active, but not playing. Calling manageAudioAndVisuals.`);
                 this.manageAudioAndVisuals();
            }
        } else { // Combined state unchanged and not active
             if (this.debugMode && oldCombinedActiveState) {
                console.log(`🌿💡 LightSoilHandler: Combined state remains not active. Ensuring audio is stopped via MAV.`);
            }
            this.manageAudioAndVisuals(); // Ensure audio is stopped if it shouldn't be playing
        }
        this.updateUI(); // Always update UI
    }


    _displayNote(note) {
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) {
            if (this.noteDisplayTimeoutId) {
                clearTimeout(this.noteDisplayTimeoutId);
            }
            noteDisplayElement.textContent = note;
            this.lastDisplayedNote = note;
            this.noteDisplayTimeoutId = setTimeout(() => {
                if (noteDisplayElement.textContent === this.lastDisplayedNote) {
                    noteDisplayElement.textContent = '-';
                }
            }, 750);
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) return; // Don't animate during the recording phase itself
        if (this.lightSoilCreatureVisual && this.lightSoilCreatureVisual.classList.contains('active')) {
            this.lightSoilCreatureCurrentFrame = (this.lightSoilCreatureCurrentFrame + 1) % this.lightSoilCreatureTotalFrames;
            // Simplified to match soil.js logic, assuming 6 total frames (0-5) and 20% step
            this.lightSoilCreatureVisual.style.backgroundPositionX = (this.lightSoilCreatureCurrentFrame * 20) + '%';
            if (this.debugMode && Math.random() < 0.01) { // Log 1%
                console.log(`🌿💡 LS Creature Animation: Frame ${this.lightSoilCreatureCurrentFrame}`);
            }
        }
    }
    
    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`🌿💡 LightSoilHandler.initTone: Cannot initTone. Tone: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('🌿💡 LightSoilHandler.initTone: AudioContext not running.');
            return;
        }

        if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Initializing Tone.js components...');
        try {
            this.padReverb = new Tone.Reverb({ decay: 3, wet: 0.5 }).toDestination();
            this.padChorus = new Tone.Chorus({ frequency: 0.7, delayTime: 2.5, depth: 0.6, wet: 0.4 }).connect(this.padReverb);

            this.mainSynth = new Tone.PluckSynth({ // Already correctly uses mainSynth for initialization
                attackNoise: 0.8,
                dampening: 3000,
                resonance: 0.85,
                release: 0.6,
                volume: -Infinity
            }).connect(this.padChorus);
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: mainSynth (PluckSynth) created.');


            const generativeNotes = ["C3", "E3", "G3", "A3", "C4", "D4", "E4", "G4"];
            let generativeNoteIndex = 0;
            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.mainSynth || !this.isCombinedActive) return;

                const note = generativeNotes[Math.floor(Math.random() * generativeNotes.length)];
                const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
                const velocity = combinedAppValue * 0.5 + 0.2; 

                if (this.debugMode && Math.random() < 0.1) console.log(`🌿💡 GenLoop: Note=${note}, Vel=${velocity.toFixed(2)}, CombinedApp=${combinedAppValue.toFixed(2)}`);
                this.mainSynth.triggerAttackRelease(note, "2n", time, Math.min(0.9, Math.max(0.1,velocity)));
                this._displayNote(note);
                this.triggerCreatureAnimation(); // Call animation here
                generativeNoteIndex++;
            }, "2n"); 
            this.generativeLoop.humanize = "8n";
            if (this.generativeLoop.state === "started") this.generativeLoop.stop(0);

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Tone.js components initialized.');
            this.manageAudioAndVisuals(); 

        } catch (error) {
            console.error('❌ LightSoilHandler.initTone: Error:', error);
            this.toneInitialized = false;
            if (this.mainSynth) { this.mainSynth.dispose(); this.mainSynth = null; } // Corrected
            if (this.padChorus) { this.padChorus.dispose(); this.padChorus = null; }
            if (this.padReverb) { this.padReverb.dispose(); this.padReverb = null; }
            if (this.generativeLoop) { this.generativeLoop.dispose(); this.generativeLoop = null; }
        }
    }

    updateSoundParameters() {
        // Corrected: Use this.mainSynth and remove this.isExternallyMuted check
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.mainSynth) return;

        const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
        const dynamicVolume = this.baseVolume - 15 + (combinedAppValue * 20); 
        this.mainSynth.volume.linearRampTo(this.isPlaying ? Math.min(0, dynamicVolume) : -Infinity, 0.8);

        if (this.generativeLoop) {
            if (combinedAppValue > 0.7) this.generativeLoop.interval = "1n";
            else if (combinedAppValue > 0.4) this.generativeLoop.interval = "2n";
            else this.generativeLoop.interval = "4n";
        }
        if (this.debugMode && Math.random() < 0.05) console.log(`🌿💡 USParams: Vol=${dynamicVolume.toFixed(1)}, Interval=${this.generativeLoop?.interval}`);
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌿💡 LS MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}`, 'color: #2ecc71'); // Removed isExternallyMuted from log as it's not a property here

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true; 

        // Highest priority: audio disabled (LightSoil doesn't have its own external mute state)
        if (!this.audioEnabled) {
            if (this.debugMode) console.log(`🌿💡 LS MAV: Audio not enabled (${!this.audioEnabled}). Stopping all audio for LightSoil.`);
            if (this.isRecordMode) this.exitRecordMode(true); 
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
            this.updateUI();
            return;
        }

        if (this.isRecordMode) { // If in record mode, generative audio should be off
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: In Record Mode, stopping generative audio.');
                this.stopAudio(true);
            }
            this.updateUI(); // UI for record mode (e.g., pulsing background)
            return;
        }

        // Generative audio logic
        if (this.isCombinedActive) { // Both sensors connected AND active
            if (!this.toneInitialized) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, Tone not init. Attempting initTone.');
                this.initTone(); // Attempt to initialize Tone.js components
                // initTone will call MAV again if successful, so we can return here to avoid duplicate logic
                if (!this.toneInitialized && this.debugMode) console.log('🌿💡 LS MAV: initTone called, but still not initialized (likely deferred or failed).');
                this.updateUI(); // Update UI even if Tone init is pending/failed
                return;
            }
            // Tone is initialized, combined is active, not in record mode, not externally muted
            if (!this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, should play generative. Calling startAudio.');
                this.startAudio();
            } else if (this.isPlaying) { // Already playing, just update params
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, generative already playing. Updating sound params.');
                this.updateSoundParameters();
            }
        } else { // Not combined active (one or both sensors not active, or not connected)
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: NOT combined active, but generative was playing. Calling stopAudio.');
                this.stopAudio(); // Fade out
            }
        }
        this.updateUI();
    }

    updateUI() {
        const oldShowCreature = this.lightSoilCreatureVisual ? this.lightSoilCreatureVisual.classList.contains('active') : false;
        // Condition for creature visibility: combined sensors active.
        // Record mode no longer hides the creature.
        const showCreature = this.isCombinedActive;

        if (this.lightSoilCreatureVisual) {
            this.lightSoilCreatureVisual.classList.toggle('active', showCreature);
            if (!showCreature && oldShowCreature) { // Became inactive
                this.lightSoilCreatureCurrentFrame = 0;
                this.lightSoilCreatureVisual.style.backgroundPositionX = '0%';
            }
        }

        if (this.frameBackground) {
            const lightSoilBgClass = 'lightsoil-active-bg';
            // Backgrounds from individual handlers that LightSoil might override
            const individualHandlersBgClasses = [
                'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg', 'soil-connected-bg', // Added soil-connected-bg
                'idle-bg'
            ];
            // Backgrounds from other combined handlers
            const otherCombinedHandlersBgClasses = [
                'tempsoil-active-bg',
                'templight-active-bg' // ADDED templight
            ];

            if (this.isRecordMode) { // 1. LightSoilHandler is in its own record mode
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(lightSoilBgClass); // Show its own BG with pulsing
                // When LightSoil is in record mode, it's dominant. Clear other BGs.
                individualHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                otherCombinedHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls)); // Clear other combined BGs
            } else { // Not in LightSoilHandler's own record mode
                this.frameBackground.classList.remove('record-mode-pulsing');

                if (this.showLightSoilVisualContext) { // 2. LightSoil visual context is active (both sensors connected)
                    this.frameBackground.classList.add(lightSoilBgClass);
                    // LightSoil context is active, it's dominant. Clear other BGs.
                    individualHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                    otherCombinedHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls)); // Clear other combined BGs
                } else { // 3. LightSoil visual context is NOT active
                    this.frameBackground.classList.remove(lightSoilBgClass);
                    // Do not clear individualHandlersBgClasses or otherCombinedHandlersBgClasses here,
                    // as one of them might be active.
                }
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            const tempInRec = window.temperatureHandlerInstance?.isRecordMode;
            const tempSoilInRec = window.tempSoilHandlerInstance?.isRecordMode;
            const tempLightInRec = window.tempLightHandlerInstance?.isRecordMode; // ADDED

            if (this.isRecordMode) { // LightSoil is in record mode
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec && !tempInRec && !tempSoilInRec && !tempLightInRec) { // No creature is in record mode // ADDED tempLightInRec
                this.stopRecordModeButton.style.display = 'none';
            }
            // If other handlers are in record mode, their own handlers will show the button.
        }
        // Corrected debug log to use classList.toString()
        if (this.debugMode && Math.random() < 0.02) console.log(`🌿💡 UI Update (LS): CreatureVis=${showCreature}, ShowLSVisualContext=${this.showLightSoilVisualContext}, RecModeLS=${this.isRecordMode}, FrameBG Classes: ${this.frameBackground?.classList?.toString()}`);
    }

    _unmuteOtherHandlersForRecordModeExit() {
        if (this.debugMode) console.log('🌿💡 LS _unmuteOtherHandlersForRecordModeExit: Unmuting other handlers.');
        // LightSoil was in record mode, so it had muted Light and Soil.
        // Now, when exiting, it needs to decide if they should be unmuted.
        // This depends on whether TempLight or TempSoil now need them muted.

        // Unmute LightHandler if TempLightHandler doesn't need it muted
        if (window.lightHandlerInstance?.setExternallyMuted) {
            const tlWantsLightMuted = window.tempLightHandlerInstance?.showTempLightVisualContext;
            if (!tlWantsLightMuted) {
                window.lightHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`🌿💡 LS: NOT unmuting Light as TL wants mute: ${tlWantsLightMuted}`);
            }
        }
        // Unmute SoilHandler if TempSoilHandler doesn't need it muted
        if (window.soilHandlerInstance?.setExternallyMuted) {
            const tsWantsSoilMuted = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
            if (!tsWantsSoilMuted) {
                window.soilHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`🌿💡 LS: NOT unmuting Soil as TS wants mute: ${tsWantsSoilMuted}`);
            }
        }
        // LightSoil doesn't typically mute other combined handlers.
    }

    async exitRecordMode(force = false) { // Ensure this is the complete and robust version
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Called but not in record mode and not forced.`);
            return;
        }
        if (this.debugMode) console.log(`%c🌿💡 LS exitRecordMode: Exiting record mode. Force: ${force}`, 'color: orange; font-weight: bold;');
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;

        this.mic?.close(); this.mic = null;
        const recorder = this.recorder; this.recorder = null;
        recorder?.stop().then(() => recorder.dispose()).catch(e => recorder?.dispose());
        this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
        this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
        if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        this.rhythmFollower?.dispose(); this.rhythmFollower = null;

        if (this.mainSynth?.volume && this.mainSynth.volume.value === this.rhythmicPlaybackVolume) {
             if (this.debugMode) console.log('🌿💡 LS exitRecordMode: mainSynth volume was at rhythmic level.');
        }
        
        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        if (wasRecordMode || force) {
            this._unmuteOtherHandlersForRecordModeExit(); // Unmute individual handlers correctly
            this.updateCombinedState(); // This will call manageAudioAndVisuals to restart generative if needed
        } else {
            this.updateUI();
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
    // stopAudio and startAudio should be robust as per previous edits, ensuring all its specific loops/synths are handled.
    // (e.g., mainSynth, ambientSynth, mainLoop, ambientLoop)
}