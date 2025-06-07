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
        // isCombinedActive: True when BOTH light AND soil are connected AND active (for creature & generative sound)
        this.isCombinedActive = false; 
        // showLightSoilVisualContext: True when BOTH light AND soil are connected (for background and muting others)
        this.showLightSoilVisualContext = false; 
        // --- End Combined State ---

        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false; // For LightSoil's generative audio
        this.isFadingOut = false;
        this.stopTimeoutId = null;
        // LightSoilHandler does not have isExternallyMuted for itself. It controls others.

        // --- Tone.js components ---
        this.mainSynth = null; // Renamed from ambientPadSynth for clarity
        this.padChorus = null;
        this.padReverb = null;
        this.generativeLoop = null; // Renamed from padLoop
        this.fadeDuration = 2.0;
        this.baseVolume = 0; // Adjusted dynamically, PluckSynth is sensitive

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
        this.rhythmNoteCooldown = 150;
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;
        this.rhythmicPlaybackVolume = 0; // PluckSynth is sensitive, adjust based on its output

        // --- Note Display ---
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

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
                if (this.isRecordMode) this.exitRecordMode(true); // Force exit if a sensor disconnects
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
                if (this.isCombinedActive && // Only allow record mode if LightSoil itself is fully active
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !lightRec && !soilRec && // No other handler is recording
                    this.frameBackground.classList.contains('lightsoil-active-bg') // CRUCIAL: Only if LS background is showing
                ) {
                    if (this.debugMode) console.log(`🌿💡 LightSoil frameBackground click: Conditions met, 'lightsoil-active-bg' is present. Entering record mode for LightSoil.`);
                    this.enterRecordMode();
                }
                // Log if LightSoil could have entered but its BG wasn't showing, or other general failure conditions
                else if (!this.isRecordMode && !lightRec && !soilRec) { // Only log detailed failure if no one is recording (to avoid noise)
                    if (this.isCombinedActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('lightsoil-active-bg')) {
                        if (this.debugMode) console.log(`🌿💡 LightSoil frameBackground click: LightSoil eligible (combinedActive, audio, toneInit), but 'lightsoil-active-bg' NOT present. Current BGs: ${Array.from(this.frameBackground.classList).join(', ')}. No action for LightSoil.`);
                    } else if (this.debugMode) {
                        console.log(`🌿💡 LightSoil frameBackground click: Record mode NOT entered for LightSoil. Conditions: isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRec=${lightRec}, soilRec=${soilRec}, hasLSbg=${this.frameBackground.classList.contains('lightsoil-active-bg')}`);
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
                if (this.debugMode && window.soilHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting SoilHandler (LS context not active or LS in rec mode).`);
                window.soilHandlerInstance.setExternallyMuted(false);
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
        // LightSoil creature animation can be simpler or different if needed
        if (this.isCurrentlyRecording) return;
        if (this.lightSoilCreatureVisual && this.lightSoilCreatureVisual.classList.contains('active')) {
            // Placeholder for LightSoil specific animation if different from simple frame advance
            if (this.debugMode) {
                // console.log('🌿💡 LightSoil: Triggering creature animation (placeholder).');
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
                // Corrected: Use this.mainSynth and remove this.isExternallyMuted check for LightSoilHandler itself
                if (!this.isPlaying || this.isRecordMode || !this.mainSynth || !this.isCombinedActive) return;

                const note = generativeNotes[Math.floor(Math.random() * generativeNotes.length)];
                const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
                const velocity = combinedAppValue * 0.5 + 0.2; 

                if (this.debugMode && Math.random() < 0.1) console.log(`🌿💡 GenLoop: Note=${note}, Vel=${velocity.toFixed(2)}, CombinedApp=${combinedAppValue.toFixed(2)}`);
                this.mainSynth.triggerAttackRelease(note, "2n", time, Math.min(0.9, Math.max(0.1,velocity)));
                this._displayNote(note);
                this.triggerCreatureAnimation();
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
        // Creature active when both sensors connected & active, not in LS record mode
        const showCreature = this.isCombinedActive && !this.isRecordMode;

        if (this.lightSoilCreatureVisual) {
            this.lightSoilCreatureVisual.classList.toggle('active', showCreature);
        }

        if (this.frameBackground) {
            const lightSoilBgClass = 'lightsoil-active-bg';
            // Backgrounds from individual handlers that LightSoil might override
            const individualHandlersBgClasses = [
                'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg', 'soil-connected-bg', // Added soil-connected-bg
                'idle-bg'
            ];

            if (this.isRecordMode) { // 1. LightSoilHandler is in its own record mode
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(lightSoilBgClass); // Show its own BG with pulsing
                // When LightSoil is in record mode, it's dominant. Clear other BGs.
                individualHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else { // Not in LightSoilHandler's own record mode
                this.frameBackground.classList.remove('record-mode-pulsing');

                if (this.showLightSoilVisualContext) { // 2. LightSoil visual context is active (both sensors connected)
                    this.frameBackground.classList.add(lightSoilBgClass);
                    // LightSoil context is active, it's dominant. Clear other BGs.
                    individualHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                } else { // 3. LightSoil visual context is NOT active
                    this.frameBackground.classList.remove(lightSoilBgClass);
                    // Do not clear individualHandlersBgClasses here, as one of them might be active
                    // if its respective sensor is connected.
                }
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            if (this.isRecordMode) { // LightSoil is in record mode
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec) { // No creature is in record mode
                this.stopRecordModeButton.style.display = 'none';
            }
            // If light or soil is in record mode, their own handlers will show the button.
        }
        // Corrected debug log to use classList.toString()
        if (this.debugMode && Math.random() < 0.02) console.log(`🌿💡 UI Update (LS): CreatureVis=${showCreature}, ShowLSVisualContext=${this.showLightSoilVisualContext}, RecModeLS=${this.isRecordMode}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌿💡 LS startAudio: isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}`, 'color: #9b59b6; font-weight: bold;'); // Removed isExternallyMuted

        // Corrected: Use this.mainSynth and remove this.isExternallyMuted check
        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode || !this.mainSynth || !this.generativeLoop) {
            if (this.debugMode) console.warn("🌿💡 LS startAudio: Conditions not met. Returning.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('🌿💡 LS startAudio: Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("🌿💡 LS startAudio: Called, but already playing. Updating params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }

        if (this.debugMode) console.log('🌿💡 LS startAudio: Starting generative audio...');
        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); // Set initial volume and loop params

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.generativeLoop.state !== "started") this.generativeLoop.start(0);

        if (this.debugMode) console.log('🌿💡 LS startAudio: Generative audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌿💡 LS stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}`, 'color: #c0392b; font-weight: bold;');

        // Corrected: Use this.mainSynth
        if (!this.audioEnabled || !this.toneInitialized || !this.mainSynth) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿💡 LS stopAudio: Audio system not ready or synth not initialized.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log("🌿💡 LS stopAudio: Called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log("🌿💡 LS stopAudio: Called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`🌿💡 LS stopAudio: Stopping generative audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; // Set immediately
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        this.mainSynth.volume.cancelScheduledValues(Tone.now());
        this.mainSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.generativeLoop && this.generativeLoop.state === "started") this.generativeLoop.stop(0);
            if (this.mainSynth) this.mainSynth.volume.value = -Infinity; // Corrected

            this.isFadingOut = false; 
            if (this.debugMode) console.log('🌿💡 LS stopAudio: Generative audio fully stopped.');
            this.updateUI(); // Update UI after audio is fully stopped
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Ensure timeout is longer than fade

        if (force) this.updateUI(); // Immediate UI update for forced stop
    }

    async enterRecordMode() {
        // Removed this.isExternallyMuted check
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if (this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, combinedAct=${this.isCombinedActive}`);
            return;
        }
        if ((window.lightHandlerInstance?.isRecordMode) || (window.soilHandlerInstance?.isRecordMode)) {
            if (this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. Another creature is in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ LS enterRecordMode: getUserMedia API not available.');
            alert('Microphone access not available. Ensure HTTPS or localhost.');
            return;
        }

        if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Starting...');
        this.isRecordMode = true; // Set early to prevent re-entry and for UI updates

        // Mute other handlers
        if (window.lightHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Muting LightHandler.');
            window.lightHandlerInstance.setExternallyMuted(true);
        }
        if (window.soilHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Muting SoilHandler.');
            window.soilHandlerInstance.setExternallyMuted(true);
        }

        if (this.isPlaying) { // Stop LightSoil's own generative audio
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Stopping its own generative audio forcefully.');
            this.stopAudio(true);
        }
        // When LightSoil enters record mode, individual handlers should remain muted by LightSoil's general context
        // (showLightSoilVisualContext will be true, which handles their muting in updateCombinedState)
        // No need to explicitly mute them again here unless that logic changes.

        this.updateUI(); // Show record mode pulsing


        this.updateUI(); // Show record mode UI (e.g., pulsing background, stop button)

        // Brief delay to allow UI to update and ensure audio has stopped
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.isRecordMode) { // Check if exited during the brief delay
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited during pre-recording wait. Restoring other handlers via updateCombinedState.');
            this.updateCombinedState(); // This will handle unmuting others if appropriate
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();

            if (!this.isRecordMode) { // Check if exited during mic permission
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited after mic permission. Closing mic.');
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                this.updateCombinedState();
                return;
            }

            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log(`🌿💡 LS enterRecordMode: Recording started for ${this.recordingDuration / 1000}s...`);

            setTimeout(async () => {
                this.isCurrentlyRecording = false; // Recording phase finished
                if (!this.recorder || !this.isRecordMode) { // Check if still in record mode / recorder exists
                    if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): No longer in active recording or record mode. Cleaning up.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder?.state === "started") { try { await this.recorder.stop(); } catch (e) { /*ignore*/ } }
                    if (this.isRecordMode) this.exitRecordMode(true); // Force exit if still in record mode
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null; // Close mic after stopping recorder
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { // Check again if exited during recording/stop
                    if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    this.updateCombinedState();
                    return;
                }
                this._setupRhythmicPlayback(audioBlob);

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ LS enterRecordMode: Error: ${err.message}`, err);
            alert(`Could not start recording for LightSoil: ${err.message}. Ensure microphone permission is granted.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true); // This will call updateCombinedState
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        // Corrected: Use this.mainSynth and remove this.isExternallyMuted check
        if (!this.isRecordMode || !this.toneInitialized || !this.mainSynth) {
            if (this.debugMode) console.warn(`🌿💡 LS _setupRhythmicPlayback: Blocked. isRec=${this.isRecordMode}, toneInit=${this.toneInitialized}, synth=${!!this.mainSynth}. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Starting using mainSynth (PluckSynth)...');

        if (this.mainSynth.volume) {
            this.mainSynth.volume.value = this.rhythmicPlaybackVolume; // Set to a reasonable level for PluckSynth
            if (this.debugMode) console.log(`🌿💡 LS _setupRhythmicPlayback: mainSynth volume set to ${this.rhythmicPlaybackVolume}.`);
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl);
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0;
        const rhythmicNotes = ["C3", "D3", "E3", "G3", "A3", "C4"]; // Notes for PluckSynth

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                // Removed this.isExternallyMuted check
                if (!this.isRecordMode || !this.recordedBufferPlayer) { 
                    if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Record mode exited or player became null. Aborting playback setup.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    // Corrected: Check mainSynth's volume
                    if (this.mainSynth?.volume?.value === this.rhythmicPlaybackVolume) {
                        this.mainSynth.volume.value = -Infinity;
                    }
                    return;
                }

                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination(); // Play the recorded audio alongside synth
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    // Corrected: Use this.mainSynth and remove this.isExternallyMuted check
                    if (!this.isRecordMode || !this.rhythmFollower || !this.mainSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                        return;
                    }
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                        const velocity = 0.3 + (Math.min(15, Math.max(0, level - this.rhythmThreshold)) * 0.035); // Adjusted velocity for PluckSynth

                        if (this.debugMode) {
                            const currentSynthVolume = this.mainSynth.volume.value;
                            console.log(`🌿💡 LS Rhythmic trigger: Lvl: ${level.toFixed(2)}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}, Vol: ${currentSynthVolume.toFixed(1)}`);
                        }
                        this.mainSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.min(0.9, velocity));
                        this.triggerCreatureAnimation();
                        this._displayNote(noteToPlay);
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0);
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Rhythmic loop (for mainSynth) initiated.');
            },
            onerror: (err) => {
                console.error('❌ LS _setupRhythmicPlayback: Error loading recorded audio player:', err);
                this.exitRecordMode(true);
            }
        });
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Setup initiated, player loading asynchronously via onload callback.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) { // If not in record mode and not forced, do nothing
            if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Called but not in record mode and not forced. Current isRecordMode: ${this.isRecordMode}`);
            return;
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`);

        const wasRecordMode = this.isRecordMode; // Capture state before changing
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;

        if (this.mic?.state === "started") this.mic.close(); this.mic = null;
        if (this.recorder) {
            if (this.recorder.state === "started") try { this.recorder.stop(); } catch (e) { /* ignore error if already stopped */ }
            this.recorder.dispose(); this.recorder = null;
        }
        if (this.rhythmicLoop) {
            if (this.rhythmicLoop.state === "started") this.rhythmicLoop.stop(0);
            this.rhythmicLoop.dispose(); this.rhythmicLoop = null;
        }
        if (this.recordedBufferPlayer) {
            if (this.recordedBufferPlayer.state === "started") this.recordedBufferPlayer.stop(0);
            this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null;
            if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        }
        if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }

        if (this.mainSynth?.volume) { // Ensure mainSynth is silenced
            this.mainSynth.volume.value = -Infinity;
        }

        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }
        
        // Crucially, after exiting record mode, re-evaluate combined state which will handle unmuting others if appropriate
        if (wasRecordMode || force) {
            this.updateCombinedState(); // This will call updateUI and manageAudioAndVisuals
        } else {
            this.updateUI(); // Still update UI if not forced but was in record mode
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        // Ensure other handlers are potentially loaded if LightSoilHandler depends on them at init
        if (window.creatune && window.Tone && window.lightHandlerInstance && window.soilHandlerInstance) {
            if (!window.lightSoilHandlerInstance) {
                window.lightSoilHandlerInstance = new LightSoilHandler();
                if (window.lightSoilHandlerInstance.debugMode) console.log('🌿💡 LightSoil Handler instance created.');
            }
        } else {
            const tempDebugMode = true; // Simplified debug check for this phase
            if (tempDebugMode) console.log('🌿💡 Waiting for LightSoilHandler dependencies (DOMContentLoaded)...');
            setTimeout(initLightSoilHandler, 200); // Increased timeout slightly
        }
    };
    initLightSoilHandler();
});

// For potential testing or extension, though not typically used in browser-only scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightSoilHandler;
}