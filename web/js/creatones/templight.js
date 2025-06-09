class TempLightHandler {
    constructor() {
        this.debugMode = true;
        if (this.debugMode) console.log('🌡️💡 TempLight Handler: Constructor called.');

        // --- State for individual sensors ---
        this.tempConnected = false;
        this.tempActive = false;
        this.currentTempAppValue = 0.5;
        this.currentTempCondition = "mild"; // e.g., very_cold, cold, cool, mild, warm, hot

        this.lightConnected = false;
        this.lightActive = false;
        this.currentLightAppValue = 0.0;
        this.currentLightCondition = "dark"; // e.g., dark, dim, bright, very_bright, extremely_bright
        // --- End State for individual sensors ---

        this.dependencyCheckCounter = 0; // ADDED for rate-limiting "waiting" log

        // --- Combined State ---
        this.isCombinedActive = false; 
        this.showTempLightVisualContext = false; 
        // --- End Combined State ---

        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false; 
        this.isFadingOut = false;
        this.stopTimeoutId = null;

        // --- Tone.js components ---
        this.mainSynth = null; // Example: A synth that combines temp and light characteristics
        this.secondarySynth = null; // Example: An accent synth
        this.mainFilter = null;
        this.mainPanner = null;
        this.mainVolume = null;
        this.generativeLoop = null;
        this.accentLoop = null; 
        this.fadeDuration = 2.0; 
        this.baseVolume = 3; 
        this.rhythmicPlaybackVolume = 6;

        // --- Record Mode Properties ---
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null;
        this.rhythmFollower = null;
        this.rhythmicLoop = null;
        this.recordingDuration = 5000;
        this.rhythmThreshold = -29; 
        this.rhythmNoteCooldown = 160;
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;

        // --- Note Display ---
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        // --- Sprite Animation State ---
        this.tempLightCreatureCurrentFrame = 0;
        this.tempLightCreatureTotalFrames = 6; // Assuming 6 frames for a generic combined creature

        // --- DOM Elements ---
        this.tempLightCreatureVisual = document.querySelector('.templight-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        if (!this.tempLightCreatureVisual && this.debugMode) console.warn('🌡️💡 .templight-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌡️💡 .framebackground element not found for TempLightHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌡️💡 #stoprecordmode button not found for TempLightHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        this.dependencyCheckCounter = 0; // Reset counter each time initializeWhenReady is called
        const checkDependencies = () => {
            if (window.Tone && window.creatune && window.temperatureHandlerInstance && window.lightHandlerInstance) {
                this.setupListeners();
                // Get initial states
                const initialTempState = window.creatune.getDeviceState('temperature');
                const initialLightState = window.creatune.getDeviceState('light');
                if (this.debugMode) {
                    console.log('🌡️💡 TempLightHandler: Initial Temp State:', initialTempState);
                    console.log('🌡️💡 TempLightHandler: Initial Light State:', initialLightState);
                }
                this.updateInternalDeviceState('temperature', initialTempState);
                this.updateInternalDeviceState('light', initialLightState);
                this.updateCombinedState();

                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                this.dependencyCheckCounter++;
                if (this.debugMode && (this.dependencyCheckCounter === 1 || this.dependencyCheckCounter % 25 === 0)) { // Log 1st time, then every 5s (25 * 200ms)
                    console.log(`🌡️💡 TempLightHandler: Waiting for dependencies (Tone, creatune, tempHandler, lightHandler)... Attempt: ${this.dependencyCheckCounter}`);
                }
                setTimeout(checkDependencies, 200);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌡️💡 TempLightHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode) { // Removed isExternallyMutedByOtherCombined as it's not a property here
            if (this.debugMode) console.log('🌡️💡 TempLightHandler: AudioContext running, trying to initTone.');
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    // TempLightHandler does not have its own external mute, it's controlled by its combined state
    // and the muting of its constituent handlers.

    updateInternalDeviceState(deviceType, state) {
        if (!state) {
            if (this.debugMode) console.log(`🌡️💡 TempLightHandler.updateInternalDeviceState: No initial state for ${deviceType}`);
            return false;
        }
        let changed = false;
        if (deviceType === 'temperature') {
            if (this.tempConnected !== state.connected) { this.tempConnected = state.connected; changed = true; }
            if (this.tempActive !== state.active) { this.tempActive = state.active; changed = true; }
            if (state.lastRawData) {
                if (this.currentTempAppValue !== state.lastRawData.temp_app_value) { this.currentTempAppValue = state.lastRawData.temp_app_value; changed = true; }
                if (this.currentTempCondition !== state.lastRawData.temp_condition) { this.currentTempCondition = state.lastRawData.temp_condition; changed = true; }
            }
        } else if (deviceType === 'light') {
            if (this.lightConnected !== state.connected) { this.lightConnected = state.connected; changed = true; }
            if (this.lightActive !== state.active) { this.lightActive = state.active; changed = true; }
            if (state.lastRawData) {
                if (this.currentLightAppValue !== state.lastRawData.light_app_value) { this.currentLightAppValue = state.lastRawData.light_app_value; changed = true; }
                if (this.currentLightCondition !== state.lastRawData.light_condition) { this.currentLightCondition = state.lastRawData.light_condition; changed = true; }
            }
        }
        if (this.debugMode && changed) console.log(`🌡️💡 TempLightHandler.updateInternalDeviceState for ${deviceType} caused change. Temp: con=${this.tempConnected},act=${this.tempActive}. Light: con=${this.lightConnected},act=${this.lightActive}`);
        return changed;
    }

    updateInternalDeviceData(deviceType, data) {
        if (!data) return;
        let needsParamUpdate = false;
        if (deviceType === 'temperature') {
            if (data.temp_app_value !== undefined && this.currentTempAppValue !== data.temp_app_value) {
                this.currentTempAppValue = data.temp_app_value;
                needsParamUpdate = true;
            }
            if (data.temp_condition && this.currentTempCondition !== data.temp_condition) {
                this.currentTempCondition = data.temp_condition;
            }
        } else if (deviceType === 'light') {
            if (data.light_app_value !== undefined && this.currentLightAppValue !== data.light_app_value) {
                this.currentLightAppValue = data.light_app_value;
                needsParamUpdate = true;
            }
            if (data.light_condition && this.currentLightCondition !== data.light_condition) {
                this.currentLightCondition = data.light_condition;
            }
        }
        if (needsParamUpdate && this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
            this.updateSoundParameters();
        }
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('🌡️💡 TempLightHandler: window.creatune not available.');
            return;
        }
        if (this.debugMode) console.log('🌡️💡 TempLightHandler: Setting up WebSocket listeners...');

        const handleDeviceUpdate = (deviceType, data) => {
            if (this.debugMode) console.log(`🌡️💡 TempLightHandler.handleDeviceUpdate for ${deviceType}:`, data);
            let stateChanged = false;

            if (deviceType === 'temperature') {
                if (data.connected !== undefined && this.tempConnected !== data.connected) { this.tempConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.tempActive !== data.active) { this.tempActive = state.active; stateChanged = true; }
                if (data.rawData) {
                    this.currentTempAppValue = data.rawData.temp_app_value !== undefined ? data.rawData.temp_app_value : this.currentTempAppValue;
                    this.currentTempCondition = data.rawData.temp_condition || this.currentTempCondition;
                } else { // Fallback for simpler updates
                    if (data.temp_app_value !== undefined) this.currentTempAppValue = data.temp_app_value;
                    if (data.temp_condition) this.currentTempCondition = data.temp_condition;
                }
            } else if (deviceType === 'light') {
                if (data.connected !== undefined && this.lightConnected !== data.connected) { this.lightConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.lightActive !== data.active) { this.lightActive = state.active; stateChanged = true; }
                if (data.rawData) {
                    this.currentLightAppValue = data.rawData.light_app_value !== undefined ? data.rawData.light_app_value : this.currentLightAppValue;
                    this.currentLightCondition = data.rawData.light_condition || this.currentLightCondition;
                } else { // Fallback for simpler updates
                    if (data.light_app_value !== undefined) this.currentLightAppValue = data.light_app_value;
                    if (data.light_condition) this.currentLightCondition = data.light_condition;
                }
            }

            if (stateChanged) {
                this.updateCombinedState();
            } else if (this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
                this.updateSoundParameters(); 
                this.updateUI(); 
            } else {
                 this.updateUI(); 
            }
        };

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'temperature' || deviceType === 'light') {
                 if (this.debugMode) console.log(`🌡️💡 TempLightHandler: Received 'connected' for ${deviceType}`);
                 handleDeviceUpdate(deviceType, { connected: true, active: (deviceType === 'temperature' ? this.tempActive : this.lightActive) });
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'temperature' || deviceType === 'light') {
                if (this.debugMode) console.log(`🌡️💡 TempLightHandler: Received 'disconnected' for ${deviceType}`);
                handleDeviceUpdate(deviceType, { connected: false, active: false });
                if (this.isRecordMode) this.exitRecordMode(true);
            }
        });
        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'temperature' || deviceType === 'light') {
                if (this.debugMode) console.log(`🌡️💡 TempLightHandler: Received 'stateChange' for ${deviceType}`, state);
                handleDeviceUpdate(deviceType, { ...state });
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'temperature' || deviceType === 'light') {
                this.updateInternalDeviceData(deviceType, data);
                // Removed redundant call to updateSoundParameters, already in updateInternalDeviceData
                 this.updateUI();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("🌡️💡 TempLightHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("🌡️💡 TempLightHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                const tempRec = window.temperatureHandlerInstance?.isRecordMode;
                const lightRec = window.lightHandlerInstance?.isRecordMode; // Changed from soilRec
                const soilRec = window.soilHandlerInstance?.isRecordMode; // Keep for checking other combined
                const lightSoilRec = window.lightSoilHandlerInstance?.isRecordMode; 

                if (this.isCombinedActive &&
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !tempRec && !lightRec && !soilRec && !lightSoilRec && 
                    this.frameBackground.classList.contains('templight-active-bg') // Check for TempLight BG
                ) {
                    if (this.debugMode) console.log(`🌡️💡 TempLight frameBackground click: Conditions met. Entering record mode.`);
                    this.enterRecordMode();
                } else if (!this.isRecordMode && !tempRec && !lightRec && !soilRec && !lightSoilRec) {
                    if (this.isCombinedActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('templight-active-bg')) {
                        if (this.debugMode) console.log(`🌡️💡 TempLight frameBackground click: Could enter record, but TempLight BG not active.`);
                    } else if (this.debugMode) {
                        console.log(`🌡️💡 TempLight frameBackground click: Record mode NOT entered. CombinedActive=${this.isCombinedActive}, isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, tempRec=${tempRec}, lightRec=${lightRec}, soilRec=${soilRec}, lightSoilRec=${lightSoilRec}, hasBGClass=${this.frameBackground?.classList.contains('templight-active-bg')}`);
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
        const oldShowTempLightVisualContext = this.showTempLightVisualContext;

        this.isCombinedActive = this.tempConnected && this.tempActive && this.lightConnected && this.lightActive;
        this.showTempLightVisualContext = this.tempConnected && this.lightConnected;

        if (this.debugMode) {
            console.log(`%c🌡️💡 TempLightHandler.updateCombinedState:
    Temp: connected=${this.tempConnected}, active=${this.tempActive}
    Light: connected=${this.lightConnected}, active=${this.lightActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showTempLightVisualContext: ${this.showTempLightVisualContext} (was ${oldShowTempLightVisualContext})`, 'color: #8e44ad; font-weight: bold;');
        }

        // Manage Muting of Individual Handlers
        if (this.showTempLightVisualContext && !this.isRecordMode) {
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Muting TemperatureHandler.`);
                window.temperatureHandlerInstance.setExternallyMuted(true);
            }
            if (window.lightHandlerInstance?.setExternallyMuted) { // Changed from soilHandlerInstance
                if (this.debugMode && !window.lightHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Muting LightHandler.`);
                window.lightHandlerInstance.setExternallyMuted(true);
            }
        } else if (!this.isRecordMode) { // If TempLight context is NOT active, or TempLight is in record mode
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Un-muting TemperatureHandler.`);
                window.temperatureHandlerInstance.setExternallyMuted(false);
            }
            if (window.lightHandlerInstance?.setExternallyMuted) { // Changed from soilHandlerInstance
                if (this.debugMode && window.lightHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Un-muting LightHandler.`);
                window.lightHandlerInstance.setExternallyMuted(false);
            }
        }

        if (this.isCombinedActive !== oldCombinedActiveState || this.showTempLightVisualContext !== oldShowTempLightVisualContext) {
            if (this.debugMode) console.log(`%c🌡️💡 TempLightHandler: Combined state CHANGED.`, 'color: #d35400; font-weight: bold;');
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive) { // Combined state unchanged but active
            if (this.isPlaying && !this.isRecordMode) {
                if (this.debugMode) console.log(`🌡️💡 TempLightHandler: Combined state active & playing. Updating sound params.`);
                this.updateSoundParameters();
            } else if (!this.isRecordMode) { // Was not playing, but should be
                 if (this.debugMode) console.log(`🌡️💡 TempLightHandler: Combined state active, but not playing. Calling manageAudioAndVisuals.`);
                 this.manageAudioAndVisuals();
            }
        } else { // Combined state unchanged and not active
             if (this.debugMode && oldCombinedActiveState) { // Log if it just became inactive
                console.log(`🌡️💡 TempLightHandler: Combined state remains not active. Ensuring audio is stopped via MAV.`);
            }
            this.manageAudioAndVisuals(); // Ensure audio is stopped if it shouldn't be playing
        }
        this.updateUI(); // Always update UI
    }

    _displayNote(note) {
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) {
            if (this.noteDisplayTimeoutId) clearTimeout(this.noteDisplayTimeoutId);
            noteDisplayElement.textContent = note;
            this.lastDisplayedNote = note;
            this.noteDisplayTimeoutId = setTimeout(() => {
                if (noteDisplayElement.textContent === this.lastDisplayedNote) {
                    noteDisplayElement.textContent = '-';
                }
            }, 900); 
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) return;
        if (this.tempLightCreatureVisual && this.tempLightCreatureVisual.classList.contains('active')) {
            this.tempLightCreatureCurrentFrame = (this.tempLightCreatureCurrentFrame + 1) % this.tempLightCreatureTotalFrames;
            this.tempLightCreatureVisual.style.backgroundPositionX = (this.tempLightCreatureCurrentFrame * (100 / this.tempLightCreatureTotalFrames)) + '%';
        }
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) return;
        if (Tone.context.state !== 'running') return;

        if (this.debugMode) console.log('🌡️💡 TempLightHandler.initTone: Initializing Synths (Bell + FM)...');
        try {
            this.mainVolume = new Tone.Volume(this.baseVolume).toDestination();
            
            // Effects: Reverb for the bell, and a gentle chorus for the FM
            const bellReverb = new Tone.Reverb({
                decay: 2.5, // Shorter decay for bell clarity
                wet: 0.35
            }).connect(this.mainVolume);

            const fmChorus = new Tone.Chorus({
                frequency: 1.2,
                delayTime: 3.0,
                depth: 0.5,
                wet: 0.4
            }).connect(this.mainVolume);

            // Main Synth: Bell-like sound (using MetalSynth)
            this.mainSynth = new Tone.MetalSynth({
                frequency: 200, // Base frequency, can be modulated
                harmonicity: 6.1,
                modulationIndex: 22,
                octaves: 2.5,
                resonance: 3500, // Higher resonance for bell
                envelope: {
                    attack: 0.001,
                    decay: 0.6, // Longer decay for bell ring
                    sustain: 0, // No sustain for percussive bell
                    release: 0.3
                },
                volume: -8 // Adjust volume as needed
            }).connect(bellReverb); // Bell synth goes to reverb

            // Secondary Synth: Slight melodic FM synth
            this.secondarySynth = new Tone.FMSynth({
                harmonicity: 2.5, // Lower harmonicity for more melodic tone
                modulationIndex: 8, // Moderate modulation index
                oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.5 },
                modulation: { type: "triangle" }, // Smoother modulation
                modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0, release: 0.3 },
                volume: -15 // Quieter than the bell
            }).connect(fmChorus); // FM synth goes to chorus


            // Generative Loop for Bell Synth (mainSynth)
            // Using a pentatonic scale for bell-like melodies
            const bellNotes = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"]; 
            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.mainSynth || !this.isCombinedActive) return;
                const note = bellNotes[Math.floor(Math.random() * bellNotes.length)];
                // MetalSynth is monophonic, triggerAttack is fine. Duration is controlled by envelope.
                this.mainSynth.triggerAttack(note, time, Math.random() * 0.4 + 0.6); // Velocity affects initial strike
                this._displayNote(note); // MODIFIED: Removed emoji
                this.triggerCreatureAnimation();
            }, "0:1:2"); // Interval: dotted quarter note (3 8th notes) - can be adjusted

            this.generativeLoop.humanize = "16n";

            // Accent Loop for Melodic FM Synth (secondarySynth)
            const fmMelodyNotes = ["G3", "A#3", "C4", "D#4", "F4", "G4"];
            this.accentLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.secondarySynth || !this.isCombinedActive) return;
                const note = fmMelodyNotes[Math.floor(Math.random() * fmMelodyNotes.length)];
                this.secondarySynth.triggerAttackRelease(note, "2n", time, Math.random() * 0.3 + 0.2); // Longer notes
                this._displayNote(note); // MODIFIED: Removed emoji
            }, "1m"); 
            this.accentLoop.probability = 0.35; 
            this.accentLoop.humanize = "8n";


            this.toneInitialized = true;
            if (this.debugMode) console.log('🌡️💡 TempLightHandler.initTone: Bell + FM Synths initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ TempLightHandler.initTone (Bell+FM): Error:', error);
            this.toneInitialized = false;
            this.mainSynth?.dispose(); this.secondarySynth?.dispose(); 
            // Dispose effects if they were created
            // this.mainFilter?.dispose(); this.mainPanner?.dispose(); // Old effects
            // bellReverb?.dispose(); fmChorus?.dispose(); // Need to ensure these are accessible if init fails mid-way or handle disposal carefully
            this.mainVolume?.dispose(); this.generativeLoop?.dispose(); this.accentLoop?.dispose();
            this.mainSynth = this.secondarySynth = this.mainVolume = this.generativeLoop = this.accentLoop = null;
            // this.mainFilter = this.mainPanner = null; // Clear old effects
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.mainVolume) return;

        const combinedTempLightValue = (this.currentTempAppValue + this.currentLightAppValue) / 2; // 0 to 1

        // Volume (overall)
        const dynamicVolume = this.baseVolume - 4 + (combinedTempLightValue * 6); 
        this.mainVolume.volume.linearRampTo(this.isPlaying ? Math.min(this.baseVolume + 2, dynamicVolume) : -Infinity, 0.9);

        // Bell Synth (mainSynth) parameters
        if (this.mainSynth) {
            // Temperature affects bell's decay/ring time
            const bellDecay = 0.4 + (this.currentTempAppValue * 0.8); // Range: 0.4s to 1.2s
            this.mainSynth.envelope.decay = bellDecay;
            this.mainSynth.envelope.release = bellDecay * 0.4;

            // Light affects bell's harmonicity (brightness/complexity)
            this.mainSynth.harmonicity = 5.0 + (this.currentLightAppValue * 3.0); // Range: 5.0 to 8.0
            this.mainSynth.resonance = 3000 + (this.currentLightAppValue * 2000); // Light makes it more resonant
        }
        
        // FM Synth (secondarySynth) parameters
        if (this.secondarySynth) {
            // Light affects FM's modulation index (intensity of FM effect)
            this.secondarySynth.modulationIndex.linearRampTo(5 + (this.currentLightAppValue * 10), 0.5); // Range 5 to 15

            // Temperature affects FM's harmonicity (pitch relationship of modulator)
            this.secondarySynth.harmonicity.linearRampTo(1.5 + (this.currentTempAppValue * 2.5), 0.5); // Range 1.5 to 4.0
        }
        
        // Generative Loop (Bell) interval based on Temperature
        if (this.generativeLoop) {
            if (this.currentTempAppValue > 0.75) this.generativeLoop.interval = "0:1:0"; // Faster (quarter note) in hot
            else if (this.currentTempAppValue > 0.4) this.generativeLoop.interval = "0:1:2"; // Medium (dotted quarter)
            else this.generativeLoop.interval = "0:2:0"; // Slower (half note) in cold
        }
        
        // Accent Loop (FM) Probability (more likely in bright conditions)
        if (this.accentLoop) {
            this.accentLoop.probability = 0.2 + (this.currentLightAppValue * 0.5); // Range 0.2 to 0.7
        }

        if (this.debugMode && Math.random() < 0.05) {
            const mainSynthParams = this.mainSynth ? `BellDecay:${this.mainSynth.envelope.decay.toFixed(2)},BellHarm:${this.mainSynth.harmonicity.toFixed(2)}` : "N/A";
            const fmSynthParams = this.secondarySynth ? `FMMI:${this.secondarySynth.modulationIndex.value.toFixed(2)},FMHarm:${this.secondarySynth.harmonicity.value.toFixed(2)}` : "N/A";
            console.log(`🌡️💡 TL-USParams (Bell+FM): Vol=${dynamicVolume.toFixed(1)}, ${mainSynthParams}, ${fmSynthParams}, BellLoop=${this.generativeLoop?.interval}, FMLoopProb=${this.accentLoop?.probability.toFixed(2)}`);
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌡️💡 TL MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}`, 'color: #16a085');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (!this.audioEnabled) {
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI();
            return;
        }

        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Stop generative audio if in record mode
            this.updateUI();
            return;
        }

        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                this.initTone();
                if (!this.toneInitialized) { this.updateUI(); return; } // Return if init failed
            }
            if (!this.isPlaying && !this.isFadingOut) {
                this.startAudio();
            } else if (this.isPlaying) { // Already playing, just update params
                this.updateSoundParameters();
            }
        } else { // Not combined active
            if (this.isPlaying && !this.isFadingOut) {
                this.stopAudio();
            }
        }
        this.updateUI();
    }

    updateUI() {
        const oldShowCreature = this.tempLightCreatureVisual ? this.tempLightCreatureVisual.classList.contains('active') : false;
        const showCreature = this.isCombinedActive; 

        if (this.tempLightCreatureVisual) {
            this.tempLightCreatureVisual.classList.toggle('active', showCreature);

            const classPrefix = 'templight-';
            const classesToRemove = [];
            for (const cls of this.tempLightCreatureVisual.classList) {
                if (cls.startsWith(classPrefix) && cls !== 'templight-creature') { 
                    classesToRemove.push(cls);
                }
            }
            classesToRemove.forEach(cls => this.tempLightCreatureVisual.classList.remove(cls));

            if (showCreature) {
                const tempConditionClass = this.currentTempCondition.replace('_', '-');
                const lightConditionClass = this.currentLightCondition.replace('_', '-');
                this.tempLightCreatureVisual.classList.add(`${classPrefix}${tempConditionClass}-${lightConditionClass}`);
            } else if (oldShowCreature && !this.tempLightCreatureVisual.classList.contains('active')) {
                this.tempLightCreatureCurrentFrame = 0;
                this.tempLightCreatureVisual.style.backgroundPositionX = '0%';
            }
        }

        if (this.frameBackground) {
            const tempLightBgClass = 'templight-active-bg';
            const individualHandlersBgClasses = [
                'temp-active-bg', 'light-active-bg', // Changed from soil-active-bg
                'soil-active-bg', // Keep for clearing if other combined handlers are active
                'lightsoil-active-bg', 'tempsoil-active-bg', // Added tempsoil
                'idle-bg'
            ];
            // Clear specific condition BGs from other handlers
            const otherConditionBgs = [
                'temp-very-cold-bg', 'temp-cold-bg', 'temp-cool-bg', 'temp-mild-bg', 'temp-warm-bg', 'temp-hot-bg',
                'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg'
            ];
            otherConditionBgs.forEach(cls => this.frameBackground.classList.remove(cls));


            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(tempLightBgClass);
                individualHandlersBgClasses.forEach(cls => { if (cls !== tempLightBgClass) this.frameBackground.classList.remove(cls); });
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                if (this.showTempLightVisualContext) { // Both Temp and Light are connected
                    this.frameBackground.classList.add(tempLightBgClass);
                    individualHandlersBgClasses.forEach(cls => { if (cls !== tempLightBgClass) this.frameBackground.classList.remove(cls); });
                } else {
                    this.frameBackground.classList.remove(tempLightBgClass);
                    // Don't clear other BGs if this one isn't active, one of the individuals might be
                }
            }
        }

        if (this.stopRecordModeButton) {
            const tempInRec = window.temperatureHandlerInstance?.isRecordMode;
            const lightInRec = window.lightHandlerInstance?.isRecordMode; // Changed from soilInRec
            const soilInRec = window.soilHandlerInstance?.isRecordMode; // Keep for checking other combined
            const lightSoilInRec = window.lightSoilHandlerInstance?.isRecordMode;
            // const tempSoilInRec = window.tempSoilHandlerInstance?.isRecordMode; // Not needed for this file

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!tempInRec && !lightInRec && !soilInRec && !lightSoilInRec) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌡️💡 UI Update (TL): CreatureVis=${showCreature}, ShowTLVisualContext=${this.showTempLightVisualContext}, RecModeTL=${this.isRecordMode}, CreatureClasses: ${this.tempLightCreatureVisual?.classList.toString()}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌡️💡 TL startAudio: isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}`, 'color: #27ae60; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode || !this.mainSynth || !this.generativeLoop) {
            if (this.debugMode) console.warn("🌡️💡 TL startAudio: Conditions not met. Returning.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) { // Already playing, just update params
            this.updateSoundParameters(); this.updateUI(); return;
        }

        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); // Set initial volumes and params

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        const startTime = Tone.now() + 0.1; // Schedule slightly ahead
        if (this.generativeLoop?.state !== "started") this.generativeLoop.start(startTime);
        if (this.accentLoop?.state !== "started") this.accentLoop.start(startTime); 

        if (this.debugMode) console.log('🌡️💡 TL startAudio: Generative audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌡️💡 TL stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.mainVolume) {
            this.isPlaying = false; this.isFadingOut = false;
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { this.updateUI(); return; } // Not playing and not forced
        if (this.isFadingOut && !force) return; // Already fading and not forced

        this.isPlaying = false; // Set immediately
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        this.mainVolume.volume.cancelScheduledValues(Tone.now());
        this.mainVolume.volume.rampTo(-Infinity, fadeTime, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.generativeLoop?.state === "started") this.generativeLoop.stop(0);
            if (this.accentLoop?.state === "started") this.accentLoop.stop(0); 
            if (this.mainVolume) this.mainVolume.volume.value = -Infinity; // Ensure it's silent
            this.isFadingOut = false;
            if (this.debugMode) console.log('🌡️💡 TL stopAudio: Generative audio fully stopped.');
            this.updateUI(); // Update UI after full stop
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); // Ensure timeout is long enough for fade

        if (force) this.updateUI(); // Update UI immediately if forced
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if (this.debugMode) console.warn(`🌡️💡 TL enterRecordMode: Blocked. Conditions not met. isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }
        // Check if any other handler is in record mode
        if (window.temperatureHandlerInstance?.isRecordMode || 
            window.lightHandlerInstance?.isRecordMode || // Changed from soil
            window.soilHandlerInstance?.isRecordMode || // Keep for other combined
            window.lightSoilHandlerInstance?.isRecordMode) {
            if (this.debugMode) console.warn(`🌡️💡 TL enterRecordMode: Blocked. Another creature is in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            alert('Microphone access not available. Ensure HTTPS or localhost.');
            return;
        }

        this.isRecordMode = true;

        // Mute other handlers (Temp and Light are part of this combo, so they are managed by showTempLightVisualContext)
        // Mute Soil and LightSoil if they exist and are not this one
        if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(true);
        if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(true);
        // Individual Temp and Light handlers are already muted by updateCombinedState if showTempLightVisualContext is true.


        if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Force stop generative audio
        if (this.mainVolume) this.mainVolume.volume.value = -Infinity; // Ensure main volume is down
        // Loops should be stopped by stopAudio
        this.isPlaying = false; this.isFadingOut = false;

        this.updateUI(); // Reflect record mode state
        await new Promise(resolve => setTimeout(resolve, 150)); // Short delay for UI to update

        if (!this.isRecordMode) { // Check if exited during delay
            this.updateCombinedState(); return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();
            if (!this.isRecordMode) { // Check if exited while mic was opening
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                this.updateCombinedState(); return;
            }

            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log('🌡️💡 TL enterRecordMode: Recording started...');

            setTimeout(async () => {
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    this.recorder?.stop(); // Attempt to stop if it exists
                    if (this.isRecordMode) this.exitRecordMode(true); // Force exit if still in record mode
                    return;
                }
                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (this.debugMode) console.log('🌡️💡 TL enterRecordMode: Recording stopped. Blob size:', audioBlob?.size);
                if (!this.isRecordMode) { this.updateCombinedState(); return; } // Check again
                this._setupRhythmicPlayback(audioBlob);
            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ TL Could not start recording: ${err.message}.`);
            alert(`Could not start recording for TempLight: ${err.message}.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true); // Force exit on error
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.mainSynth || !this.secondarySynth || !this.mainVolume) {
            if(this.debugMode) console.warn(`🌡️💡 TL _setupRhythmicPlayback: Blocked. Missing synth/volume or not in correct state.`);
            this.exitRecordMode(true); 
            return;
        }
        if (this.debugMode) console.log('🌡️💡 TL _setupRhythmicPlayback: Starting with TempLight synths for rhythm...');

        this.mainVolume.volume.cancelScheduledValues(Tone.now());
        this.mainVolume.volume.value = this.rhythmicPlaybackVolume; // Set volume for playback

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl);
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0;

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode || !this.recordedBufferPlayer || !this.mainSynth || !this.secondarySynth) { 
                    if(this.debugMode) console.warn(`🌡️💡 TL _setupRhythmicPlayback (onload): Player/Synth not available or exited record mode.`);
                    this.recordedBufferPlayer?.dispose(); 
                    this.rhythmFollower?.dispose(); 
                    this.rhythmicLoop?.dispose();
                    if (this.mainVolume?.volume.value === this.rhythmicPlaybackVolume) {
                         this.mainVolume.volume.value = -Infinity;
                    }
                    // Do not call exitRecordMode here, it might have been called already.
                    // Let the flow continue to updateCombinedState if needed.
                    return;
                }
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination(); 
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌡️💡 TL _setupRhythmicPlayback (onload): Recorded buffer player started.');


                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || 
                        !this.mainSynth || !this.secondarySynth || 
                        this.recordedBufferPlayer?.state !== 'started') {
                        return;
                    }
                    
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const note = Tone.Midi(Math.floor(Math.random() * 24) + 48).toFrequency(); // C3 to B4 range
                        const velocity = Math.min(1.0, (Math.abs(level) / 30) * 0.7 + 0.3); // Velocity based on level
                        
                        if (Math.random() < 0.7) { // 70% chance for mainSynth
                            if (this.mainSynth) {
                                this.mainSynth.triggerAttackRelease(note, "8n", time, velocity);
                            }
                        } else { // 30% chance for secondarySynth
                            if (this.secondarySynth) {
                                this.secondarySynth.triggerAttackRelease(note, "16n", time, velocity * 0.8); 
                            }
                        }
                        
                        this.triggerCreatureAnimation();
                        this._displayNote(Tone.Frequency(note).toNote());
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0); // Start immediately relative to transport
                 if (this.debugMode) console.log('🌡️💡 TL _setupRhythmicPlayback (onload): Rhythmic loop initiated.');
            },
            onerror: (err) => { 
                console.error('❌ TL _setupRhythmicPlayback: Error loading player:', err); 
                this.exitRecordMode(true); 
            }
        });
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.debugMode) console.log('🌡️💡 TL _setupRhythmicPlayback: Setup initiated, player loading asynchronously.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`🌡️💡 TL exitRecordMode: Called when not in record mode and not forced. Returning.`);
            return;
        }
        if (this.debugMode) console.log(`%c🌡️💡 TL exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`, 'color: #c0392b');
        
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false; this.isCurrentlyRecording = false;

        this.mic?.close(); this.mic = null;
        // Ensure recorder.stop is async and awaited if it returns a promise, or handled safely
        if (this.recorder) {
            const recorderPromise = this.recorder.stop();
            if (recorderPromise && typeof recorderPromise.then === 'function') {
                recorderPromise.then(() => this.recorder.dispose()).catch(() => this.recorder.dispose());
            } else {
                this.recorder.dispose();
            }
            this.recorder = null;
        }

        this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
        this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
        if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        this.rhythmFollower?.dispose(); this.rhythmFollower = null;

        // Ensure generative audio components are reset/silenced
        if (this.mainVolume?.volume.value === this.rhythmicPlaybackVolume || this.mainVolume?.volume.value > -Infinity) {
            this.mainVolume.volume.cancelScheduledValues(Tone.now());
            this.mainVolume.volume.value = -Infinity;
        }
        if (this.generativeLoop?.state === "started") this.generativeLoop.stop(0);
        if (this.accentLoop?.state === "started") this.accentLoop.stop(0); 
        this.isPlaying = false; // Generative audio is stopped

        if (this.noteDisplayTimeoutId) clearTimeout(this.noteDisplayTimeoutId);
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) noteDisplayElement.textContent = '-';

        // Unmute other handlers that might have been muted by this handler's record mode
        if (window.soilHandlerInstance?.setExternallyMuted && window.soilHandlerInstance.isExternallyMuted) {
             window.soilHandlerInstance.setExternallyMuted(false);
        }
        if (window.lightSoilHandlerInstance?.setExternallyMuted && window.lightSoilHandlerInstance.isExternallyMuted) {
             window.lightSoilHandlerInstance.setExternallyMuted(false);
        }
        // Temp and Light individual handlers will be unmuted by updateCombinedState if showTempLightVisualContext becomes false.

        if (wasRecordMode || force) {
            this.updateCombinedState(); // This will call updateUI and manageAudioAndVisuals
        } else {
            this.updateUI(); // Still update UI if not forced but was in record mode
        }
        if (this.debugMode) console.log(`🌡️💡 TL exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let domContentLoadedDependencyCheckCounter = 0; // Counter for this specific listener
    const initTempLightHandler = () => {
        if (window.creatune && window.Tone && window.temperatureHandlerInstance && window.lightHandlerInstance) {
            if (!window.tempLightHandlerInstance) { 
                window.tempLightHandlerInstance = new TempLightHandler(); 
                // Access debugMode from the new instance to decide if this initial log is shown
                if (window.tempLightHandlerInstance.debugMode) console.log('🌡️💡 TempLight Handler instance created.');
            }
        } else {
            domContentLoadedDependencyCheckCounter++;
            // Log 1st time, then every 5s (20 * 250ms). 
            // Assuming debugMode would be true for the TempLightHandler if it were created.
            if (domContentLoadedDependencyCheckCounter === 1 || domContentLoadedDependencyCheckCounter % 20 === 0) {
                 console.log(`🌡️💡 Waiting for TempLightHandler dependencies (DOMContentLoaded)... Attempt: ${domContentLoadedDependencyCheckCounter}`);
            }
            setTimeout(initTempLightHandler, 250); 
        }
    };
    initTempLightHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TempLightHandler; // Changed from TempSoilHandler
}