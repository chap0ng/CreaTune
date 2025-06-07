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
        this.baseVolume = 9; // Target dB for FMSynth, actual application might vary
        this.rhythmicPlaybackVolume = 9; // Volume for lightSoilSynth during rhythmic playback

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
                this.updateCombinedState(); // This will call MAV and updateUI
            } else if (this.isCombinedActive && this.isPlaying && !this.isRecordMode && !this.isExternallyMuted) {
                // If only data changed but not connection/active state, update sound params
                this.updateSoundParameters();
                this.updateUI(); // Ensure UI reflects any subtle changes
            } else {
                 this.updateUI(); // Always update UI for any potential visual feedback
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
                this.updateInternalDeviceData(deviceType, data); // Updates appValue/condition
                 // updateInternalDeviceData now calls updateSoundParameters if needed
                 this.updateUI(); // Update UI for visual feedback based on new data
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
                const lightRec = window.lightHandlerInstance?.isRecordMode;
                const soilRec = window.soilHandlerInstance?.isRecordMode;

                // Try to enter LightSoil record mode
                if (this.isCombinedActive &&
                    !this.isRecordMode && // LightSoil itself is not already recording
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

        this.isCombinedActive = this.lightConnected && this.lightActive && this.soilConnected && this.soilActive;
        this.showLightSoilVisualContext = this.lightConnected && this.soilConnected; // Context is shown if both are connected

        if (this.debugMode) {
            console.log(`%c🌿💡 LightSoilHandler.updateCombinedState:
    Light: connected=${this.lightConnected}, active=${this.lightActive}
    Soil:  connected=${this.soilConnected}, active=${this.soilActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showLightSoilVisualContext: ${this.showLightSoilVisualContext} (was ${oldShowLightSoilVisualContext})`, 'color: #3498db; font-weight: bold;');
        }

        // Muting logic: If LightSoil context is dominant, mute others.
        if (this.showLightSoilVisualContext && !this.isRecordMode && !this.isExternallyMuted) {
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.lightHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Muting LightHandler (LS context active).`);
                window.lightHandlerInstance.setExternallyMuted(true);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.soilHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Muting SoilHandler (LS context active).`);
                window.soilHandlerInstance.setExternallyMuted(true);
            }
        }
        // Unmuting logic: If LightSoil context is NOT dominant (and LS itself is not externally muted), it releases its mute on others.
        else if ((!this.showLightSoilVisualContext || this.isRecordMode) && !this.isExternallyMuted) {
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.lightHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting LightHandler (LS context not active or LS in rec mode).`);
                window.lightHandlerInstance.setExternallyMuted(false);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.soilHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting SoilHandler (LS context not active or LS in rec mode).`);
                window.soilHandlerInstance.setExternallyMuted(false);
            }
        }

        if (this.isCombinedActive !== oldCombinedActiveState || this.showLightSoilVisualContext !== oldShowLightSoilVisualContext) {
            if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler: Combined state or visual context CHANGED. Calling MAV.`, 'color: #e67e22; font-weight: bold;');
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive && !this.isRecordMode && !this.isExternallyMuted) { // If state is the same but still active
            if (this.isPlaying) {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active & playing. Updating sound params.`);
                this.updateSoundParameters(); // Ensure params are fresh
            } else { // Is combined active, but not playing (e.g. after exiting record mode)
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active, but not playing. Calling MAV to potentially start audio.`);
                 this.manageAudioAndVisuals();
            }
        } else { // Not combined active, or in record mode, or externally muted
             if (this.debugMode && (oldCombinedActiveState || oldShowLightSoilVisualContext)) { // If it just became inactive
                console.log(`🌿💡 LightSoilHandler: Combined state no longer active or visual context hidden. Ensuring audio is stopped via MAV.`);
            }
            this.manageAudioAndVisuals(); // Ensure audio is stopped if necessary
        }
        // updateUI is called at the end of manageAudioAndVisuals
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

    _updateSpriteAnimation() {
        if (!this.lightSoilCreatureVisual) return;
        // Animate only if the creature should be visible and active
        if (!this.isCombinedActive || this.isRecordMode || this.isExternallyMuted || !this.lightSoilCreatureVisual.classList.contains('active')) {
            return;
        }
        this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        this.lightSoilCreatureVisual.style.backgroundPositionX = (this.currentFrame * (100 / this.frameCount)) + '%'; // Dynamic based on frameCount
        if (this.debugMode && Math.random() < 0.05) {
            console.log(`🌿💡 LS Anim Step: Frame ${this.currentFrame}, PosX ${this.lightSoilCreatureVisual.style.backgroundPositionX}`);
        }
    }

    triggerCreatureAnimation() { // Called by generative loop or rhythmic loop
        if (this.isCurrentlyRecording) return; // Don't animate during the mic recording phase
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
                volume: -Infinity
            }).connect(this.padChorus);
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: lightSoilSynth (PolySynth(FMSynth)) created.');

            const generativeNotes = ["C3", "D#3", "G3", "A#3", "C4", "D#4", "F4", "G#4"];
            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.lightSoilSynth || !this.isCombinedActive || this.isExternallyMuted) return;

                const note = generativeNotes[Math.floor(Math.random() * generativeNotes.length)];
                const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
                const velocity = combinedAppValue * 0.4 + 0.1;

                if (this.debugMode && Math.random() < 0.1) console.log(`🌿💡 GenLoop (FM): Note=${note}, Vel=${velocity.toFixed(2)}, CombinedApp=${combinedAppValue.toFixed(2)}`);
                this.lightSoilSynth.triggerAttackRelease(note, "1n", time, Math.min(0.7, Math.max(0.05,velocity)));
                this._displayNote(note);
                this.triggerCreatureAnimation();
            }, "3n"); // Initial interval
            this.generativeLoop.humanize = "4n";
            // Don't start the loop here, startAudio will handle it.

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Tone.js components initialized.');
            this.manageAudioAndVisuals(); // Re-evaluate audio state now that Tone is ready

        } catch (error) {
            console.error('❌ LightSoilHandler.initTone: Error:', error);
            this.toneInitialized = false;
            if (this.lightSoilSynth) { this.lightSoilSynth.dispose(); this.lightSoilSynth = null; }
            if (this.padChorus) { this.padChorus.dispose(); this.padChorus = null; }
            if (this.padReverb) { this.padReverb.dispose(); this.padReverb = null; }
            if (this.generativeLoop) { this.generativeLoop.dispose(); this.generativeLoop = null; }
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.lightSoilSynth || this.isExternallyMuted) return;

        const combinedAppValue = Math.max(0, Math.min(1, (this.currentLightAppValue + this.currentSoilAppValue) / 2)); // Ensure 0-1 range
        
        // Map combinedAppValue (0-1) to a dB range, e.g., -24dB to -6dB for FMSynth
        // baseVolume is now more like a target max, not a direct addition.
        const minVolDb = -24;
        const maxVolDb = this.baseVolume; // e.g., -6 or -3 for FMSynth
        const dynamicVolume = minVolDb + (combinedAppValue * (maxVolDb - minVolDb));
        
        this.lightSoilSynth.volume.linearRampTo(this.isPlaying ? dynamicVolume : -Infinity, 0.8);

        // Adjust FMSynth parameters per voice
        const targetHarmonicity = 1.0 + (combinedAppValue * 2.5); // e.g., 1.0 to 3.5
        const targetModIndex = 2 + (combinedAppValue * 18);   // e.g., 2 to 20

        this.lightSoilSynth.voices.forEach(voice => {
            if (voice.harmonicity) voice.harmonicity.linearRampTo(targetHarmonicity, 0.5);
            if (voice.modulationIndex) voice.modulationIndex.linearRampTo(targetModIndex, 0.5);
        });

        if (this.generativeLoop) {
            if (combinedAppValue > 0.8) this.generativeLoop.interval = "2n";
            else if (combinedAppValue > 0.6) this.generativeLoop.interval = "3n";
            else if (combinedAppValue > 0.3) this.generativeLoop.interval = "4n";
            else this.generativeLoop.interval = "8n";
        }

        if (this.debugMode && Math.random() < 0.05) {
            const firstVoice = this.lightSoilSynth.voices[0];
            console.log(`🌿💡 USParams (FM): Vol=${dynamicVolume.toFixed(1)}, TargetHarm=${targetHarmonicity.toFixed(1)}, TargetModIdx=${targetModIndex.toFixed(1)}, CurHarmV0=${firstVoice?.harmonicity?.value.toFixed(1)}, CurModIdxV0=${firstVoice?.modulationIndex?.value.toFixed(1)}, Interval=${this.generativeLoop?.interval}`);
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌿💡 LS MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}, isExtMuted=${this.isExternallyMuted}`, 'color: #2ecc71');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true; // Keep audioEnabled in sync

        // Highest priority: external mute or audio disabled
        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`🌿💡 LS MAV: Externally muted (${this.isExternallyMuted}) or audio not enabled (${!this.audioEnabled}). Stopping all audio for LightSoil.`);
            if (this.isRecordMode) this.exitRecordMode(true); // Exit its own record mode
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Stop its generative audio
            this.updateUI();
            return;
        }

        // Next priority: LightSoil's own record mode
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) { // Generative audio should not play during its own record mode
                if (this.debugMode) console.log('🌿💡 LS MAV: In LightSoil Record Mode, ensuring its generative audio is stopped.');
                this.stopAudio(true);
            }
            this.updateUI(); // UI for record mode (e.g., pulsing background)
            return;
        }

        // If not externally muted and not in its own record mode:
        if (this.isCombinedActive) { // Both sensors connected and active
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
        } else { // Not combined active (e.g., one sensor disconnected or inactive)
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: NOT combined active, but generative was playing. Calling stopAudio.');
                this.stopAudio(); // Fade out
            }
        }
        this.updateUI();
    }

    updateUI() {
        const showCreature = this.isCombinedActive && !this.isRecordMode && !this.isExternallyMuted;
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
            const lightSoilRec = this.isRecordMode;
            const anyRec = lightRec || soilRec || lightSoilRec;

            const otherHandlerSpecificBgs = [
                'light-active-bg', 'soil-active-bg', 'soil-connected-bg',
                'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg', 'soil-pattern-bg'
            ];

            if (anyRec) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.remove('lightsoil-active-bg');
                if (!lightSoilRec) { // If LS is not the one in record mode, remove its BG
                     otherHandlerSpecificBgs.forEach(cls => this.frameBackground.classList.remove(cls));
                }
            } else { // NO creature is in record mode
                this.frameBackground.classList.remove('record-mode-pulsing');
                if (showLightSoilBg) {
                    this.frameBackground.classList.add('lightsoil-active-bg');
                    otherHandlerSpecificBgs.forEach(cls => this.frameBackground.classList.remove(cls));
                } else {
                    this.frameBackground.classList.remove('lightsoil-active-bg');
                    // If LS bg is not shown, other handlers' updateUI should manage their BGs.
                    // No need for LS to actively set other BGs here.
                }
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            if (this.isRecordMode) { // If LightSoil is in record mode
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec) { // Only hide if NO creature (Light or Soil) is recording
                this.stopRecordModeButton.style.display = 'none';
            }
            // If Light or Soil is recording, their own UI update should show the button.
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌿💡 UI Update (LS): CreatureVis=${showCreature}, LightSoilBGVis=${showLightSoilBg}, RecModeLS=${this.isRecordMode}, ExtMuteLS=${this.isExternallyMuted}, FrameBG Classes: ${this.frameBackground?.classList}`);
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌿💡 LS startAudio: isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}, isExtMuted=${this.isExternallyMuted}`, 'color: #9b59b6; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode || !this.lightSoilSynth || !this.generativeLoop || this.isExternallyMuted) {
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

        if (this.debugMode) console.log('🌿💡 LS startAudio: Starting generative audio (PolySynth(FMSynth))...');
        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); // Set initial parameters based on current sensor values

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.generativeLoop.state !== "started") this.generativeLoop.start(0);

        if (this.debugMode) console.log('🌿💡 LS startAudio: Generative audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌿💡 LS stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.lightSoilSynth) {
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

        this.lightSoilSynth.volume.cancelScheduledValues(Tone.now());
        this.lightSoilSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        
        // For PolySynth, trigger release on all voices
        this.lightSoilSynth.releaseAll(Tone.now() + fadeTime * 0.8);


        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.generativeLoop && this.generativeLoop.state === "started") this.generativeLoop.stop(0);
            // Volume is already ramped to -Infinity, ensure it stays there if synth still exists
            if (this.lightSoilSynth) this.lightSoilSynth.volume.value = -Infinity;

            this.isFadingOut = false; // Reset after fade
            if (this.debugMode) console.log('🌿💡 LS stopAudio: Generative audio fully stopped.');
            this.updateUI(); // Update UI after audio is fully stopped
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Ensure timeout is longer than fade

        if (force) this.updateUI(); // Immediate UI update for forced stop
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isExternallyMuted) {
            if (this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, combinedAct=${this.isCombinedActive}, extMuted=${this.isExternallyMuted}`);
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
        // Ensure synth is silent before mic recording starts
        if (this.lightSoilSynth) this.lightSoilSynth.volume.value = -Infinity;


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
                    if (this.isRecordMode) this.exitRecordMode(true); // This will call updateCombinedState
                    else this.updateCombinedState(); // Ensure correct mute states if already exited
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
        if (!this.isRecordMode || !this.toneInitialized || !this.lightSoilSynth || this.isExternallyMuted) {
            if (this.debugMode) console.warn(`🌿💡 LS _setupRhythmicPlayback: Blocked. isRec=${this.isRecordMode}, toneInit=${this.toneInitialized}, synth=${!!this.lightSoilSynth}, extMuted=${this.isExternallyMuted}. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Starting using lightSoilSynth (PolySynth(FMSynth))...');

        // Set volume for rhythmic playback
        if (this.lightSoilSynth.volume) {
            this.lightSoilSynth.volume.value = this.rhythmicPlaybackVolume;
            if (this.debugMode) console.log(`🌿💡 LS _setupRhythmicPlayback: lightSoilSynth volume set to ${this.rhythmicPlaybackVolume}dB for rhythmic notes.`);
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl);
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0;
        const rhythmicNotes = ["C2", "D#2", "G2", "A#2", "C3"]; // Lower notes for FMSynth might be interesting

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode || !this.recordedBufferPlayer || this.isExternallyMuted) { // Check external mute here too
                    if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Record mode exited, player became null, or externally muted. Aborting playback setup.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    if (this.lightSoilSynth?.volume?.value === this.rhythmicPlaybackVolume) {
                        this.lightSoilSynth.volume.value = -Infinity;
                    }
                    return;
                }

                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination(); // Play the recorded audio out loud
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.lightSoilSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started' || this.isExternallyMuted) {
                        return;
                    }
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                        const velocity = 0.2 + (Math.min(20, Math.max(0, level - this.rhythmThreshold)) * 0.025); // Scale velocity

                        if (this.debugMode) {
                            const currentSynthVolume = this.lightSoilSynth.volume.value;
                            console.log(`🌿💡 LS Rhythmic trigger (FM): Lvl: ${level.toFixed(2)}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}, SynthVol: ${currentSynthVolume.toFixed(1)}`);
                        }
                        this.lightSoilSynth.triggerAttackRelease(noteToPlay, "8n", time, Math.min(0.8, velocity));
                        this.triggerCreatureAnimation(); // Animate LightSoil creature
                        this._displayNote(noteToPlay);
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0);
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Rhythmic loop (for lightSoilSynth) initiated.');
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

        // Ensure the synth used for rhythmic playback is silenced
        if (this.lightSoilSynth?.volume) {
            this.lightSoilSynth.volume.value = -Infinity;
        }

        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        // Crucially, call updateCombinedState. This will:
        // 1. Re-evaluate isCombinedActive and showLightSoilVisualContext.
        // 2. Unmute other handlers if LightSoil is no longer the dominant context.
        // 3. Call manageAudioAndVisuals, which will:
        //    - Potentially restart generative audio if conditions are met.
        //    - Call updateUI to reflect the new state (e.g., remove record mode pulsing, show correct BG).
        if (wasRecordMode || force) { // Only call if it was actually in record mode or forced
             if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Calling updateCombinedState because wasRecordMode=${wasRecordMode} or force=${force}.`);
            this.updateCombinedState();
        } else {
            // If somehow called without being in record mode and not forced, just ensure UI is up-to-date.
            this.updateUI();
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        // Ensure other handlers are potentially initialized or at least their placeholders exist
        if (window.creatune && window.Tone && typeof window.lightHandlerInstance !== 'undefined' && typeof window.soilHandlerInstance !== 'undefined') {
            if (!window.lightSoilHandlerInstance) {
                window.lightSoilHandlerInstance = new LightSoilHandler();
                if (window.lightSoilHandlerInstance.debugMode) console.log('🌿💡 LightSoil Handler instance created.');
            }
        } else {
            const tempDebugMode = true; // Use a local const for this specific log
            if (tempDebugMode) console.log(`🌿💡 Waiting for LightSoilHandler dependencies (DOMContentLoaded)... Creatune: ${!!window.creatune}, Tone: ${!!window.Tone}, LightH: ${typeof window.lightHandlerInstance}, SoilH: ${typeof window.soilHandlerInstance}`);
            setTimeout(initLightSoilHandler, 200);
        }
    };
    initLightSoilHandler();
});

// For potential testing or extension, though not typically used in browser-only scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightSoilHandler;
}