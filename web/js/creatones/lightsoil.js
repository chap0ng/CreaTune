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
        this.showLightSoilVisualContext = false; // True if both sensors are connected
        this.isExternallyMuted = false;
        // --- End Combined State ---

        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false; // For LightSoil's generative audio
        this.isFadingOut = false;
        this.stopTimeoutId = null;

        // --- Tone.js components ---
        this.lightSoilSynth = null;
        this.padChorus = null;
        this.padReverb = null;
        this.generativeLoop = null;
        this.fadeDuration = 2.5;
        this.baseVolume = 6; // Target max dB for FMSynth 
        this.rhythmicPlaybackVolume = 6; // Volume for lightSoilSynth during rhythmic playback 

        // --- Record Mode Properties ---
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null;
        this.rhythmFollower = null;
        this.rhythmicLoop = null;
        this.recordingDuration = 5000;
        this.rhythmThreshold = -30; // dB
        this.rhythmNoteCooldown = 150; // ms
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;

        // --- Note Display ---
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        // --- Sprite Animation ---
        this.frameCount = 6;
        this.currentFrame = 0;

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
            if (window.Tone && window.creatune && typeof window.lightHandlerInstance !== 'undefined' && typeof window.soilHandlerInstance !== 'undefined') {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler: All Dependencies ready.');
                this.setupListeners();

                const initialLightState = window.creatune.getDeviceState('light');
                const initialSoilState = window.creatune.getDeviceState('soil');
                if (this.debugMode) console.log('🌿💡 LightSoilHandler Initializing with states:', { initialLightState, initialSoilState });

                this.updateInternalDeviceState('light', initialLightState);
                this.updateInternalDeviceState('soil', initialSoilState);

                this.updateCombinedState(); // This will also call manageAudioAndVisuals -> updateUI
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning(); // This will also call manageAudioAndVisuals
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
            this.initTone(); // initTone will call manageAudioAndVisuals if successful
        }
        this.manageAudioAndVisuals(); // Ensure state is consistent
    }

    setExternallyMuted(isMuted) {
        if (this.debugMode) console.log(`🌿💡 LightSoilHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return;

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`🌿💡 LightSoilHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Externally muted, forcing exit from its own record mode.`);
                this.exitRecordMode(true); // Force exit if externally muted
            } else if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LightSoilHandler: Externally muted, stopping its generative audio.');
                this.stopAudio(true); // Force stop generative audio
            }
        }
        // If unmuted, manageAudioAndVisuals will decide if audio should restart
        this.manageAudioAndVisuals();
    }

    updateInternalDeviceState(deviceType, state) {
        if (!state) {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler.updateInternalDeviceState: No state provided for ${deviceType}`);
            return false; // Indicate no change or invalid state
        }
        let changed = false;
        if (deviceType === 'light') {
            if (this.lightConnected !== state.connected) { this.lightConnected = state.connected; changed = true; }
            if (this.lightActive !== state.active) { this.lightActive = state.active; changed = true; }
            if (state.lastRawData) { // Prefer lastRawData if available from initial state
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
        return changed; // Return whether a connection/active state changed
    }

    updateInternalDeviceData(deviceType, data) {
        // This method is for 'data' events, which usually carry sensor values, not connection/active state.
        if (!data) return;
        let needsParamUpdate = false;
        if (deviceType === 'light') {
            if (data.light_app_value !== undefined && this.currentLightAppValue !== data.light_app_value) {
                this.currentLightAppValue = data.light_app_value;
                needsParamUpdate = true;
            }
            if (data.light_condition && this.currentLightCondition !== data.light_condition) {
                this.currentLightCondition = data.light_condition;
                // Condition change might not always need param update if app_value is the driver
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

        const handleDeviceUpdate = (deviceType, dataFromEvent) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler.handleDeviceUpdate for ${deviceType}:`, dataFromEvent);
            let stateChanged = false; // Tracks changes in connection or active status

            if (deviceType === 'light') {
                if (dataFromEvent.connected !== undefined && this.lightConnected !== dataFromEvent.connected) { this.lightConnected = dataFromEvent.connected; stateChanged = true; }
                if (dataFromEvent.active !== undefined && this.lightActive !== dataFromEvent.active) { this.lightActive = dataFromEvent.active; stateChanged = true; }
                // Update data values if present in the event (e.g., from stateChange)
                const sourceData = dataFromEvent.rawData || dataFromEvent;
                if (sourceData.light_app_value !== undefined) this.currentLightAppValue = sourceData.light_app_value;
                if (sourceData.light_condition) this.currentLightCondition = sourceData.light_condition;

            } else if (deviceType === 'soil') {
                if (dataFromEvent.connected !== undefined && this.soilConnected !== dataFromEvent.connected) { this.soilConnected = dataFromEvent.connected; stateChanged = true; }
                if (dataFromEvent.active !== undefined && this.soilActive !== dataFromEvent.active) { this.soilActive = dataFromEvent.active; stateChanged = true; }
                const sourceData = dataFromEvent.rawData || dataFromEvent;
                if (sourceData.moisture_app_value !== undefined) this.currentSoilAppValue = sourceData.moisture_app_value;
                if (sourceData.soil_condition) this.currentSoilCondition = sourceData.soil_condition;
            }

            if (stateChanged) {
                this.updateCombinedState(); // This will trigger MAV -> updateUI
            } else if (this.isCombinedActive && this.isPlaying && !this.isRecordMode && !this.isExternallyMuted) {
                // If only data values changed (not connection/active state) and we are playing, update params
                this.updateSoundParameters();
                this.updateUI(); // Ensure UI reflects any subtle changes
            } else {
                 this.updateUI(); // Always update UI if not covered by above logic
            }
        };

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'soil') {
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'connected' for ${deviceType}`);
                 const deviceState = window.creatune.getDeviceState(deviceType); // Get full current state
                 if (deviceState) {
                    handleDeviceUpdate(deviceType, { ...deviceState, connected: true }); // Ensure connected is true
                 } else {
                    handleDeviceUpdate(deviceType, { connected: true, active: (deviceType === 'light' ? this.lightActive : this.soilActive) }); // Fallback
                 }
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light' || deviceType === 'soil') {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'disconnected' for ${deviceType}`);
                handleDeviceUpdate(deviceType, { connected: false, active: false });
                if (this.isRecordMode && (!this.lightConnected || !this.soilConnected)) { // If a dependency for LS record mode disconnects
                    if (this.debugMode) console.log(`🌿💡 LightSoilHandler: A sensor disconnected during LS record mode. Exiting record mode.`);
                    this.exitRecordMode(true);
                }
            }
        });
        window.creatune.on('stateChange', (deviceType, state) => { // stateChange usually has full info
            if (deviceType === 'light' || deviceType === 'soil') {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'stateChange' for ${deviceType}`, state);
                handleDeviceUpdate(deviceType, { ...state }); // Pass the full state object
            }
        });
        window.creatune.on('data', (deviceType, data) => { // data event is for sensor value updates
            if (deviceType === 'light' || deviceType === 'soil') {
                this.updateInternalDeviceData(deviceType, data); // Updates app_value, condition
                this.updateUI(); // Update UI based on new data values
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
            this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                const lightRec = window.lightHandlerInstance?.isRecordMode;
                const soilRec = window.soilHandlerInstance?.isRecordMode;

                if (this.isCombinedActive &&
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !lightRec && !soilRec &&
                    this.frameBackground.classList.contains('lightsoil-active-bg')
                ) {
                    if (this.debugMode) console.log(`🌿💡 LightSoil frameBackground click: Conditions met, 'lightsoil-active-bg' is present. Entering record mode for LightSoil.`);
                    this.enterRecordMode();
                }
                else if (!this.isRecordMode && !lightRec && !soilRec) { // Log only if no one is recording
                    if (this.isCombinedActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('lightsoil-active-bg')) {
                        if (this.debugMode) console.log(`🌿💡 LightSoil frameBackground click: LightSoil eligible, but 'lightsoil-active-bg' NOT present. Current BGs: ${Array.from(this.frameBackground.classList).join(', ')}.`);
                    } else if (this.debugMode) {
                        console.log(`🌿💡 LightSoil frameBackground click: Record mode NOT entered. Conditions: isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRec=${lightRec}, soilRec=${soilRec}, hasLSbg=${this.frameBackground.classList.contains('lightsoil-active-bg')}`);
                    }
                }
            });
        }

        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (this.isRecordMode) { // Only exit if LightSoil itself is in record mode
                    this.exitRecordMode();
                }
            });
        }
    }

    updateCombinedState() {
        const oldCombinedActiveState = this.isCombinedActive;
        const oldShowLightSoilVisualContext = this.showLightSoilVisualContext;

        this.isCombinedActive = this.lightConnected && this.lightActive && this.soilConnected && this.soilActive;
        this.showLightSoilVisualContext = this.lightConnected && this.soilConnected; // Visual context depends only on connection

        if (this.debugMode) {
            console.log(`%c🌿💡 LightSoilHandler.updateCombinedState:
    Light: connected=${this.lightConnected}, active=${this.lightActive}
    Soil:  connected=${this.soilConnected}, active=${this.soilActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showLightSoilVisualContext: ${this.showLightSoilVisualContext} (was ${oldShowLightSoilVisualContext})`, 'color: #3498db; font-weight: bold;');
        }

        // Mute/unmute other handlers based on LightSoil's visual context and record mode
        if (this.showLightSoilVisualContext && !this.isRecordMode && !this.isExternallyMuted) {
            // LightSoil context is dominant, mute others
            if (window.lightHandlerInstance?.setExternallyMuted && !window.lightHandlerInstance.isExternallyMuted) {
                if (this.debugMode) console.log(`🌿💡 LightSoil: Muting LightHandler (LS context active).`);
                window.lightHandlerInstance.setExternallyMuted(true);
            }
            if (window.soilHandlerInstance?.setExternallyMuted && !window.soilHandlerInstance.isExternallyMuted) {
                if (this.debugMode) console.log(`🌿💡 LightSoil: Muting SoilHandler (LS context active).`);
                window.soilHandlerInstance.setExternallyMuted(true);
            }
        }
        // Unmute others if LS context is NOT dominant (i.e., LS not showing its visual context, OR LS is in record mode itself, OR LS is externally muted)
        // The `!this.isExternallyMuted` ensures LS doesn't try to unmute others if LS itself is being told to be quiet.
        else if ((!this.showLightSoilVisualContext || this.isRecordMode) && !this.isExternallyMuted) {
            if (window.lightHandlerInstance?.setExternallyMuted && window.lightHandlerInstance.isExternallyMuted) {
                if (this.debugMode) console.log(`🌿💡 LightSoil: Un-muting LightHandler (LS context not active or LS in rec mode).`);
                window.lightHandlerInstance.setExternallyMuted(false);
            }
            if (window.soilHandlerInstance?.setExternallyMuted && window.soilHandlerInstance.isExternallyMuted) {
                if (this.debugMode) console.log(`🌿💡 LightSoil: Un-muting SoilHandler (LS context not active or LS in rec mode).`);
                window.soilHandlerInstance.setExternallyMuted(false);
            }
        }

        // If the core states that drive audio/visuals changed, trigger MAV
        if (this.isCombinedActive !== oldCombinedActiveState || this.showLightSoilVisualContext !== oldShowLightSoilVisualContext) {
            if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler: Combined state or visual context CHANGED. Calling MAV.`, 'color: #e67e22; font-weight: bold;');
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive && !this.isRecordMode && !this.isExternallyMuted) {
            // If state is stable but active, ensure params are current or audio starts if it wasn't playing
            if (this.isPlaying) {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active & playing. Updating sound params.`);
                this.updateSoundParameters();
            } else {
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active, but not playing. Calling MAV to potentially start audio.`);
                 this.manageAudioAndVisuals(); // MAV will decide to start audio
            }
        } else {
            // If not combined active, or in record mode, or externally muted, MAV will ensure audio is stopped.
             if (this.debugMode && (oldCombinedActiveState || oldShowLightSoilVisualContext)) { // Log if it *was* active
                console.log(`🌿💡 LightSoilHandler: Combined state no longer active or visual context hidden. Ensuring audio is stopped via MAV.`);
            }
            this.manageAudioAndVisuals();
        }
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
                if (noteDisplayElement.textContent === this.lastDisplayedNote) { // Avoid clearing if a new note was displayed quickly
                    noteDisplayElement.textContent = '-';
                }
            }, 750);
        }
    }

    _updateSpriteAnimation() {
        if (!this.lightSoilCreatureVisual) return;
        // Animate only if the creature is supposed to be visible and active
        if (!this.isCombinedActive || this.isRecordMode || this.isExternallyMuted || !this.lightSoilCreatureVisual.classList.contains('active')) {
            return;
        }
        this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        this.lightSoilCreatureVisual.style.backgroundPositionX = (this.currentFrame * (100 / this.frameCount)) + '%';
        if (this.debugMode && Math.random() < 0.05) { // Reduce log frequency
            console.log(`🌿💡 LS Anim Step: Frame ${this.currentFrame}, PosX ${this.lightSoilCreatureVisual.style.backgroundPositionX}`);
        }
    }

    triggerCreatureAnimation() {
        // Called by generative loop or rhythmic playback to sync animation with sound events
        if (this.isCurrentlyRecording) return; // Don't animate during the recording phase itself
        this._updateSpriteAnimation();
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

        if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Initializing Tone.js components (PolySynth(FMSynth))...');
        try {
            this.padReverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).toDestination();
            this.padChorus = new Tone.Chorus({ frequency: 0.8, delayTime: 2.0, depth: 0.7, wet: 0.3 }).connect(this.padReverb);
            
            this.lightSoilSynth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 1.5,
                modulationIndex: 5,
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.8 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 },
                volume: -Infinity // Start muted
            }).connect(this.padChorus);
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: lightSoilSynth (PolySynth(FMSynth)) created.');

            const generativeNotes = ["C3", "D#3", "G3", "A#3", "C4", "D#4", "F4", "G#4"];
            this.generativeLoop = new Tone.Loop(time => {
                // Check conditions inside the loop callback as well
                if (!this.isPlaying || this.isRecordMode || !this.lightSoilSynth || !this.isCombinedActive || this.isExternallyMuted) return;

                const note = generativeNotes[Math.floor(Math.random() * generativeNotes.length)];
                const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2; // Average of 0-1 values
                const velocity = combinedAppValue * 0.4 + 0.1; // Scale velocity (0.1 to 0.5)

                if (this.debugMode && Math.random() < 0.1) console.log(`🌿💡 GenLoop (FM): Note=${note}, Vel=${velocity.toFixed(2)}, CombinedApp=${combinedAppValue.toFixed(2)}`);
                this.lightSoilSynth.triggerAttackRelease(note, "1n", time, Math.min(0.7, Math.max(0.05,velocity))); // Ensure velocity is within reasonable bounds
                this._displayNote(note);
                this.triggerCreatureAnimation();
            }, "3n"); // Initial interval
            this.generativeLoop.humanize = "4n"; // Add some humanization

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Tone.js components initialized.');
            this.manageAudioAndVisuals(); // Re-evaluate audio state now that Tone is ready

        } catch (error) {
            console.error('❌ LightSoilHandler.initTone: Error:', error);
            this.toneInitialized = false;
            // Dispose of any partially created components
            if (this.lightSoilSynth) { this.lightSoilSynth.dispose(); this.lightSoilSynth = null; }
            if (this.padChorus) { this.padChorus.dispose(); this.padChorus = null; }
            if (this.padReverb) { this.padReverb.dispose(); this.padReverb = null; }
            if (this.generativeLoop) { this.generativeLoop.dispose(); this.generativeLoop = null; }
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || 
            !this.lightSoilSynth || // Check if synth object exists
            this.isExternallyMuted) {
            if (this.debugMode) {
                // console.warn(`🌿💡 USParams: Aborted by initial guards. Conditions: toneInit=${this.toneInitialized}, audioEn=${this.audioEnabled}, combinedAct=${this.isCombinedActive}, isRec=${this.isRecordMode}, isPlaying=${this.isPlaying}, synth=${!!this.lightSoilSynth}, extMute=${this.isExternallyMuted}`);
            }
            return;
        }

        // CRITICAL CHECK: Ensure lightSoilSynth.voices is an array before trying to use .forEach
        if (!this.lightSoilSynth.voices || !Array.isArray(this.lightSoilSynth.voices)) {
            if (this.debugMode) {
                console.error(`🌿💡 USParams Error: lightSoilSynth.voices is not a valid array. Synth object:`, this.lightSoilSynth);
                if(this.lightSoilSynth) console.warn(`🌿💡 USParams: typeof voices: ${typeof this.lightSoilSynth.voices}, isArray: ${Array.isArray(this.lightSoilSynth.voices)}`);
            }
            return; // Abort this function call to prevent the TypeError
        }

        const combinedAppValue = Math.max(0, Math.min(1, (this.currentLightAppValue + this.currentSoilAppValue) / 2)); // Ensure 0-1 range
        
        const minVolDb = -24; // Softer minimum
        const maxVolDb = this.baseVolume; // e.g., -6dB
        const dynamicVolume = minVolDb + (combinedAppValue * (maxVolDb - minVolDb));
        
        // Ramp volume only if playing, otherwise it should be -Infinity
        this.lightSoilSynth.volume.linearRampTo(this.isPlaying ? dynamicVolume : -Infinity, 0.8);

        // FM Synth specific parameters
        const targetHarmonicity = 1.0 + (combinedAppValue * 2.5); // Range: 1.0 to 3.5
        const targetModIndex = 2 + (combinedAppValue * 18);   // Range: 2 to 20

        this.lightSoilSynth.voices.forEach(voice => {
            if (voice.harmonicity) voice.harmonicity.linearRampTo(targetHarmonicity, 0.5);
            if (voice.modulationIndex) voice.modulationIndex.linearRampTo(targetModIndex, 0.5);
        });

        // Adjust generative loop interval based on combined value
        if (this.generativeLoop) {
            if (combinedAppValue > 0.8) this.generativeLoop.interval = "2n";
            else if (combinedAppValue > 0.6) this.generativeLoop.interval = "3n";
            else if (combinedAppValue > 0.3) this.generativeLoop.interval = "4n";
            else this.generativeLoop.interval = "8n"; // Slower for low values
        }

        if (this.debugMode && Math.random() < 0.05) { // Reduce log frequency
            const firstVoice = this.lightSoilSynth.voices[0]; // Safe now due to the guard above
            console.log(`🌿💡 USParams (FM): Vol=${dynamicVolume.toFixed(1)}, TargetHarm=${targetHarmonicity.toFixed(1)}, TargetModIdx=${targetModIndex.toFixed(1)}, CurHarmV0=${firstVoice?.harmonicity?.value.toFixed(1)}, CurModIdxV0=${firstVoice?.modulationIndex?.value.toFixed(1)}, Interval=${this.generativeLoop?.interval}`);
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌿💡 LS MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}, isExtMuted=${this.isExternallyMuted}`, 'color: #2ecc71');

        // Ensure audioEnabled reflects current Tone.context state
        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        // Highest priority: external mute or audio disabled globally
        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`🌿💡 LS MAV: Externally muted (${this.isExternallyMuted}) or audio not enabled (${!this.audioEnabled}). Stopping all audio for LightSoil.`);
            if (this.isRecordMode) this.exitRecordMode(true); // Force exit record mode
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Force stop generative
            this.updateUI();
            return;
        }

        // Next priority: LightSoil's own record mode
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) { // If generative was somehow playing
                if (this.debugMode) console.log('🌿💡 LS MAV: In LightSoil Record Mode, ensuring its generative audio is stopped.');
                this.stopAudio(true); // Force stop generative
            }
            // UI for record mode is handled by updateUI called at the end
            this.updateUI();
            return;
        }

        // If combined sensors are active (and not in record mode, not externally muted)
        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, Tone not init. Attempting initTone.');
                this.initTone(); // This will call MAV again if successful
                // If initTone fails, toneInitialized remains false, and audio won't start.
                // updateUI will be called at the end.
                if (!this.toneInitialized && this.debugMode) console.log('🌿💡 LS MAV: initTone called, but still not initialized.');
                this.updateUI();
                return; // Return here as initTone might call MAV again
            }
            // Tone is initialized, combined is active, not recording, not muted
            if (!this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, should play generative. Calling startAudio.');
                this.startAudio();
            } else if (this.isPlaying) {
                // Already playing, just ensure parameters are up-to-date
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, generative already playing. Updating sound params.');
                this.updateSoundParameters();
            }
        } else { // Not combinedActive (or in record mode / externally muted, handled above)
            if (this.isPlaying && !this.isFadingOut) { // If generative was playing but shouldn't be
                if (this.debugMode) console.log('🌿💡 LS MAV: NOT combined active, but generative was playing. Calling stopAudio.');
                this.stopAudio(); // Graceful stop
            }
        }
        this.updateUI(); // Always update UI at the end of MAV
    }

    updateUI() {
        // Determine visibility of creature and its specific background
        const showCreature = this.isCombinedActive && !this.isRecordMode && !this.isExternallyMuted;
        // LightSoil background is shown if its visual context is active (both sensors connected),
        // and it's not in record mode itself, and not externally muted.
        const showLightSoilBg = this.showLightSoilVisualContext && !this.isRecordMode && !this.isExternallyMuted;


        if (this.lightSoilCreatureVisual) {
            const isActiveCurrently = this.lightSoilCreatureVisual.classList.contains('active');
            if (showCreature && !isActiveCurrently) {
                this.lightSoilCreatureVisual.classList.add('active');
                this.currentFrame = 0; // Reset animation frame
                this.lightSoilCreatureVisual.style.backgroundPositionX = '0%';
            } else if (!showCreature && isActiveCurrently) {
                this.lightSoilCreatureVisual.classList.remove('active');
            }
        }

        if (this.frameBackground) {
            const lightRec = window.lightHandlerInstance?.isRecordMode;
            const soilRec = window.soilHandlerInstance?.isRecordMode;
            const lightSoilRec = this.isRecordMode; // LS's own record mode
            const anyRec = lightRec || soilRec || lightSoilRec; // Is any creature recording?

            const lightSoilBgClass = 'lightsoil-active-bg';
            // Define background classes for other handlers/states that LightSoil might need to remove
            const otherContextBgClasses = [
                'light-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg', 'light-error-bg',
                'soil-active-bg', 'soil-connected-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg', 'soil-pattern-bg',
                'idle-bg' // Assuming an idle background class
            ];

            if (lightSoilRec) { // LightSoil is IN RECORD MODE
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(lightSoilBgClass); // Assert LightSoil's own BG
                // Remove BGs of other contexts
                otherContextBgClasses.forEach(cls => {
                    if (cls !== lightSoilBgClass) this.frameBackground.classList.remove(cls);
                });
            } else if (anyRec) { // ANOTHER creature is in record mode (LightSoil is NOT)
                this.frameBackground.classList.add('record-mode-pulsing'); // Ensure pulsing is on
                this.frameBackground.classList.remove(lightSoilBgClass); // Remove LightSoil's BG as it's not the one recording
                // The actively recording handler (Light or Soil) is responsible for setting its own BG
                // and clearing others. LightSoilHandler should not clear BGs set by an active Light/Soil recorder.
            } else { // NO ONE is in record mode
                this.frameBackground.classList.remove('record-mode-pulsing');
                
                if (showLightSoilBg) { // LightSoil context is active (and not recording, not externally muted)
                    this.frameBackground.classList.add(lightSoilBgClass);
                    // Remove BGs of other contexts as LightSoil is dominant
                    otherContextBgClasses.forEach(cls => {
                        if (cls !== lightSoilBgClass) this.frameBackground.classList.remove(cls);
                    });
                } else { // LightSoil context is NOT active (or is externally muted, or not connected enough)
                    this.frameBackground.classList.remove(lightSoilBgClass);
                    // If LS context is not active, other handlers (Light, Soil) or idle logic
                    // will determine the background. Their updateUI methods should handle this.
                }
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            // Show button if LightSoil is recording
            if (this.isRecordMode) { 
                this.stopRecordModeButton.style.display = 'block';
            } 
            // Hide button ONLY if NO creature is recording (Light, Soil, or LightSoil)
            // This allows the button to remain visible if Light or Soil started recording.
            else if (!lightInRec && !soilInRec && !this.isRecordMode) { 
                this.stopRecordModeButton.style.display = 'none';
            }
            // If Light or Soil is recording, their updateUI should manage the button if needed.
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌿💡 UI Update (LS): CreatureVis=${showCreature}, LightSoilBGVis=${showLightSoilBg}, RecModeLS=${this.isRecordMode}, ExtMuteLS=${this.isExternallyMuted}, FrameBG Classes: ${this.frameBackground?.classList?.toString()}`);
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌿💡 LS startAudio: isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}, isExtMuted=${this.isExternallyMuted}`, 'color: #9b59b6; font-weight: bold;');

        // Strict conditions for starting generative audio
        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode || !this.lightSoilSynth || !this.generativeLoop || this.isExternallyMuted) {
            if (this.debugMode) console.warn("🌿💡 LS startAudio: Conditions not met. Returning.");
            this.updateUI(); return; // Update UI to reflect non-playing state if needed
        }
        if (this.isFadingOut) { // If it was fading out, cancel the fade and start immediately
            if (this.debugMode) console.log('🌿💡 LS startAudio: Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            // Volume will be set by updateSoundParameters
        }
        if (this.isPlaying) { // Already playing
            if (this.debugMode) console.log("🌿💡 LS startAudio: Called, but already playing. Updating params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }

        if (this.debugMode) console.log('🌿💡 LS startAudio: Starting generative audio (PolySynth(FMSynth))...');
        this.isPlaying = true;
        this.isFadingOut = false; // Ensure this is false
        this.updateSoundParameters(); // Set initial volume and synth params

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.generativeLoop.state !== "started") this.generativeLoop.start(0); // Start loop at the beginning

        if (this.debugMode) console.log('🌿💡 LS startAudio: Generative audio started.');
        this.updateUI(); // Reflect playing state
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌿💡 LS stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.lightSoilSynth) {
            // If essential components aren't ready, just ensure state is stopped
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿💡 LS stopAudio: Audio system not ready or synth not initialized. Marking as stopped.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { // Already stopped and not forced
            if (this.debugMode) console.log("🌿💡 LS stopAudio: Called, but already stopped and not forced.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) { // Already fading out and not forced
            if (this.debugMode) console.log("🌿💡 LS stopAudio: Called, but already fading out and not forced.");
            return; // Don't interrupt an ongoing graceful fade unless forced
        }

        if (this.debugMode) console.log(`🌿💡 LS stopAudio: Stopping generative audio ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; // Mark as not playing immediately
        this.isFadingOut = true; // Mark as fading out
        const fadeTime = force ? 0.01 : this.fadeDuration; // Very short fade if forced

        this.lightSoilSynth.volume.cancelScheduledValues(Tone.now()); // Cancel any pending volume changes
        this.lightSoilSynth.volume.rampTo(-Infinity, fadeTime, Tone.now()); // Ramp to silence
        
        // Release any held notes, allowing them to decay naturally within the synth's release envelope
        // Schedule this slightly into the fade to avoid abrupt cuts if possible, but ensure it happens
        this.lightSoilSynth.releaseAll(Tone.now() + fadeTime * 0.8);


        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId); // Clear any previous stop timeout
        this.stopTimeoutId = setTimeout(() => {
            if (this.generativeLoop && this.generativeLoop.state === "started") this.generativeLoop.stop(0); // Stop the Tone.Loop
            if (this.lightSoilSynth) this.lightSoilSynth.volume.value = -Infinity; // Ensure volume is silent

            this.isFadingOut = false; // Mark as fully stopped after fade
            if (this.debugMode) console.log('🌿💡 LS stopAudio: Generative audio fully stopped.');
            this.updateUI(); // Update UI to reflect stopped state
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Timeout for cleanup

        if (force) this.updateUI(); // Update UI immediately if forced
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isExternallyMuted) {
            if (this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, combinedAct=${this.isCombinedActive}, extMuted=${this.isExternallyMuted}`);
            return;
        }
        if ((window.lightHandlerInstance?.isRecordMode) || (window.soilHandlerInstance?.isRecordMode)) {
            if (this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. Another creature (Light or Soil) is in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ LS enterRecordMode: getUserMedia API not available.');
            alert('Microphone access not available. Ensure HTTPS or localhost.');
            return;
        }

        if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Starting...');
        this.isRecordMode = true;

        // Mute other handlers as LightSoil is taking over for recording
        if (window.lightHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Muting LightHandler.');
            window.lightHandlerInstance.setExternallyMuted(true);
        }
        if (window.soilHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Muting SoilHandler.');
            window.soilHandlerInstance.setExternallyMuted(true);
        }

        // Stop LightSoil's own generative audio if it was playing
        if (this.isPlaying || this.isFadingOut) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Stopping its own generative audio forcefully.');
            this.stopAudio(true); // Force stop
        }
        // Ensure synth is silent before recording starts
        if (this.lightSoilSynth) this.lightSoilSynth.volume.value = -Infinity;


        this.updateUI(); // Reflect record mode state in UI

        // Short delay to allow UI updates and ensure other handlers are muted
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!this.isRecordMode) { // Check if exited during the short delay (e.g., by external mute)
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited during pre-recording wait. Restoring other handlers via updateCombinedState.');
            this.updateCombinedState(); // Re-evaluate who should be active/muted
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open(); // Request microphone permission

            if (!this.isRecordMode) { // Check again if exited while waiting for mic permission
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited after mic permission. Closing mic.');
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                this.updateCombinedState();
                return;
            }

            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true; // Flag that actual recording is happening
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log(`🌿💡 LS enterRecordMode: Recording started for ${this.recordingDuration / 1000}s...`);

            // Stop recording after duration
            setTimeout(async () => {
                this.isCurrentlyRecording = false; // Recording phase finished
                if (!this.recorder || !this.isRecordMode) { // Check if exited during recording
                    if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): No longer in active recording or record mode. Cleaning up.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder?.state === "started") { try { await this.recorder.stop(); } catch (e) { /*ignore errors on stop if already disposed*/ } }
                    if (this.isRecordMode) this.exitRecordMode(true); // If still in record mode conceptually, force cleanup
                    else this.updateCombinedState(); // If not, just update states
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null; // Close mic after recording
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { // Check if exited just before playback setup
                    if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    this.updateCombinedState();
                    return;
                }
                this._setupRhythmicPlayback(audioBlob); // Proceed to playback setup

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ LS enterRecordMode: Error: ${err.message}`, err);
            alert(`Could not start recording for LightSoil: ${err.message}. Ensure microphone permission is granted.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true); // Force exit on error
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        // Conditions for rhythmic playback
        if (!this.isRecordMode || !this.toneInitialized || !this.lightSoilSynth || this.isExternallyMuted) {
            if (this.debugMode) console.warn(`🌿💡 LS _setupRhythmicPlayback: Blocked. isRec=${this.isRecordMode}, toneInit=${this.toneInitialized}, synth=${!!this.lightSoilSynth}, extMuted=${this.isExternallyMuted}. Forcing exit from record mode.`);
            this.exitRecordMode(true); // If conditions aren't met, exit record mode fully
            return;
        }
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Starting using lightSoilSynth (PolySynth(FMSynth))...');

        // Set the synth volume for rhythmic notes
        if (this.lightSoilSynth.volume) {
            this.lightSoilSynth.volume.value = this.rhythmicPlaybackVolume; // e.g., -3dB
            if (this.debugMode) console.log(`🌿💡 LS _setupRhythmicPlayback: lightSoilSynth volume set to ${this.rhythmicPlaybackVolume}dB for rhythmic notes.`);
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); // Clean up old blob URL
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0; // Reset cooldown timer
        const rhythmicNotes = ["C2", "D#2", "G2", "A#2", "C3"]; // Low, percussive notes

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                // Check conditions again inside onload, as state might have changed
                if (!this.isRecordMode || !this.recordedBufferPlayer || this.isExternallyMuted) {
                    if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Record mode exited, player became null, or externally muted during load. Aborting playback setup.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    // If synth volume was set for rhythmic playback, reset it if playback doesn't start
                    if (this.lightSoilSynth?.volume?.value === this.rhythmicPlaybackVolume) {
                        this.lightSoilSynth.volume.value = -Infinity;
                    }
                    // If record mode was exited, updateCombinedState would have been called.
                    // If still in record mode but playback aborted, ensure UI is consistent.
                    if(this.isRecordMode) this.updateUI();
                    return;
                }

                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower); // Player output to Meter
                this.recordedBufferPlayer.toDestination(); // Also play the recorded audio aloud
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.lightSoilSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started' || this.isExternallyMuted) {
                        return; // Abort if conditions change mid-loop
                    }
                    const level = this.rhythmFollower.getValue(); // Get dB level from Meter
                    const currentTime = Tone.now() * 1000; // Current time in ms for cooldown

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                        // Velocity can be somewhat proportional to how much over threshold, but capped
                        const velocity = 0.2 + (Math.min(20, Math.max(0, level - this.rhythmThreshold)) * 0.025); // e.g. 0.2 to 0.7

                        if (this.debugMode) {
                            const currentSynthVolume = this.lightSoilSynth.volume.value;
                            console.log(`🌿💡 LS Rhythmic trigger (FM): Lvl: ${level.toFixed(2)}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}, SynthVol: ${currentSynthVolume.toFixed(1)}`);
                        }
                        this.lightSoilSynth.triggerAttackRelease(noteToPlay, "8n", time, Math.min(0.8, velocity));
                        this.triggerCreatureAnimation(); // Animate on rhythmic hit
                        this._displayNote(noteToPlay);
                        this.lastRhythmNoteTime = currentTime; // Update last note time for cooldown
                    }
                }, "16n").start(0); // Check frequently for rhythmic triggers
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Rhythmic loop (for lightSoilSynth) initiated.');
            },
            onerror: (err) => {
                console.error('❌ LS _setupRhythmicPlayback: Error loading recorded audio player:', err);
                this.exitRecordMode(true); // Force exit on player load error
            }
        });
        if (Tone.Transport.state !== "started") Tone.Transport.start(); // Ensure transport is running for Player and Loop
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Setup initiated, player loading asynchronously via onload callback.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) { // If not in record mode and not forced, do nothing
            if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Called but not in record mode and not forced. Current isRecordMode: ${this.isRecordMode}`);
            return;
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`);

        const wasRecordMode = this.isRecordMode; // Store if we were actually in record mode
        this.isRecordMode = false; // Set record mode to false immediately
        this.isCurrentlyRecording = false; // Ensure recording flag is also false

        // Cleanup microphone and recorder
        if (this.mic?.state === "started") this.mic.close(); this.mic = null;
        if (this.recorder) {
            if (this.recorder.state === "started") try { this.recorder.stop(); } catch (e) { /* ignore errors if already disposed */ }
            this.recorder.dispose(); this.recorder = null;
        }
        // Cleanup rhythmic playback components
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

        // Ensure LightSoil's synth is silent after record mode
        if (this.lightSoilSynth?.volume) {
            this.lightSoilSynth.volume.value = -Infinity;
        }

        // Clear any lingering note display from record mode
        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        // If LightSoil was actually in record mode or forced, it needs to re-evaluate the overall state
        // This will handle unmuting other handlers if appropriate.
        if (wasRecordMode || force) {
             if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Calling updateCombinedState because wasRecordMode=${wasRecordMode} or force=${force}.`);
            this.updateCombinedState(); // This will call MAV -> updateUI
        } else {
            // If not forced and wasn't in record mode (e.g. cleanup call), just update UI
            this.updateUI();
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        // Check for all dependencies including other handlers
        if (window.creatune && window.Tone && typeof window.lightHandlerInstance !== 'undefined' && typeof window.soilHandlerInstance !== 'undefined') {
            if (!window.lightSoilHandlerInstance) { // Ensure singleton
                window.lightSoilHandlerInstance = new LightSoilHandler();
                if (window.lightSoilHandlerInstance.debugMode) console.log('🌿💡 LightSoil Handler instance created and assigned to window.lightSoilHandlerInstance.');
            }
        } else {
            const tempDebugMode = true; // Temporary debug for this specific check
            if (tempDebugMode) console.log(`🌿💡 Waiting for LightSoilHandler dependencies (DOMContentLoaded)... Creatune: ${!!window.creatune}, Tone: ${!!window.Tone}, LightH: ${!!window.lightHandlerInstance}, SoilH: ${!!window.soilHandlerInstance}`);
            setTimeout(initLightSoilHandler, 200); // Retry after a short delay
        }
    };
    initLightSoilHandler();
});

// For potential Node.js/CommonJS environments (e.g., testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightSoilHandler;
}