class TempLightHandler {
    constructor() {
        this.debugMode = true; // Set to true for console logs, false for production
        if (this.debugMode) console.log('🌡️💡 TempLight Handler: Constructor called.');

        // --- State for individual sensors ---
        this.tempConnected = false;
        this.tempActive = false;
        this.currentTempAppValue = 0.0; // Normalized temperature value (0-1)
        this.currentTempCondition = "mild"; // e.g., very_cold, cold, cool, mild, warm, hot

        this.lightConnected = false;
        this.lightActive = false;
        this.currentLightAppValue = 0.0; // Normalized light value (0-1)
        this.currentLightCondition = "dim"; // e.g., dark, dim, bright, very_bright, extremely_bright
        // --- End State for individual sensors ---

        // --- Combined State ---
        this.isCombinedActive = false; // True if both sensors are connected AND active
        this.showTempLightVisualContext = false; // True if both sensors are connected (for background/muting)
        // --- End Combined State ---

        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.stopTimeoutId = null;
        this.dependencyCheckCounter = 0;

        // --- Tone.js components ---
        this.mainSynth = null;      // Bell Synth
        this.secondarySynth = null; // Gentle FM Synth
        this.mainVolume = null;
        this.bellReverb = null;
        this.fmChorus = null;
        this.generativeLoop = null; // For Bell
        this.accentLoop = null;     // For FM
        this.fadeDuration = 1.5;
        this.baseVolume = 6; // Base volume for the mainVolume node

        // --- Record Mode Properties ---
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null;
        this.rhythmFollower = null;
        this.rhythmicLoop = null; // Loop that triggers synth based on recorded audio rhythm
        this.recordingDuration = 5000; // ms
        this.rhythmThreshold = -28; // dB, sensitivity for rhythm detection
        this.rhythmNoteCooldown = 130; // ms, min time between rhythm-triggered notes
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;
        this.rhythmicPlaybackVolume = -3; // Volume for synth during rhythmic playback

        // --- Note Display ---
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        // --- Sprite Animation State ---
        this.creatureVisual = null; // Assigned in constructor
        this.creatureCurrentFrame = 0;
        this.creatureTotalFrames = 6; // Example: 6 frames for animation

        // --- DOM Elements ---
        this.creatureVisual = document.querySelector('.templight-creature'); // Use its own class
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        if (!this.creatureVisual && this.debugMode) console.warn('🌡️💡 .templight-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌡️💡 .framebackground element not found for TempLightHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌡️💡 #stoprecordmode button not found for TempLightHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        this.dependencyCheckCounter = 0;
        const checkDependencies = () => {
            const missingDeps = [];
            if (!window.Tone) missingDeps.push("Tone");
            if (!window.creatune) missingDeps.push("creatune");
            if (!window.temperatureHandlerInstance) missingDeps.push("temperatureHandlerInstance");
            if (!window.lightHandlerInstance) missingDeps.push("lightHandlerInstance");

            if (missingDeps.length === 0) {
                if (this.debugMode) console.log('🌡️💡 TempLightHandler: All Dependencies ready.');
                this.setupListeners();

                const initialTempState = window.creatune.getDeviceState('temperature');
                const initialLightState = window.creatune.getDeviceState('light');
                if (this.debugMode) console.log('🌡️💡 TempLightHandler Initializing with states:', { initialTempState, initialLightState });

                this.updateInternalDeviceState('temperature', initialTempState);
                this.updateInternalDeviceState('light', initialLightState);

                this.updateCombinedState();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                this.dependencyCheckCounter++;
                if (this.debugMode && (this.dependencyCheckCounter === 1 || this.dependencyCheckCounter % 25 === 0)) {
                    console.warn(`🌡️💡 TempLightHandler: Waiting for dependencies: [${missingDeps.join(', ')}]. Attempt: ${this.dependencyCheckCounter}`);
                }
                setTimeout(checkDependencies, 200);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌡️💡 TempLightHandler: AudioContext is running.');
        this.audioEnabled = true;
        // No isExternallyMuted check for combined handlers when initializing their own tone
        if (!this.toneInitialized && !this.isRecordMode) {
            if (this.debugMode) console.log('🌡️💡 TempLightHandler: AudioContext running, trying to initTone.');
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    // TempLightHandler itself is not externally muted, but it mutes others.
    // So, no setExternallyMuted method is typically needed for its own state.

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
                if (this.currentTempAppValue !== state.lastRawData.temperature_app_value) { this.currentTempAppValue = state.lastRawData.temperature_app_value || 0.0; }
                if (this.currentTempCondition !== state.lastRawData.temp_condition) { this.currentTempCondition = state.lastRawData.temp_condition || "mild"; }
            }
        } else if (deviceType === 'light') {
            if (this.lightConnected !== state.connected) { this.lightConnected = state.connected; changed = true; }
            if (this.lightActive !== state.active) { this.lightActive = state.active; changed = true; }
            if (state.lastRawData) {
                if (this.currentLightAppValue !== state.lastRawData.light_app_value) { this.currentLightAppValue = state.lastRawData.light_app_value || 0.0; }
                if (this.currentLightCondition !== state.lastRawData.light_condition) { this.currentLightCondition = state.lastRawData.light_condition || "dim"; }
            }
        }
        if (this.debugMode && changed) console.log(`🌡️💡 TempLightHandler.updateInternalDeviceState for ${deviceType} caused change. Temp: con=${this.tempConnected},act=${this.tempActive}. Light: con=${this.lightConnected},act=${this.lightActive}`);
        return changed;
    }

    updateInternalDeviceData(deviceType, data) {
        if (!data) return;
        let needsParamUpdate = false;
        if (deviceType === 'temperature') {
            if (data.temperature_app_value !== undefined && this.currentTempAppValue !== data.temperature_app_value) {
                this.currentTempAppValue = data.temperature_app_value;
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
        // For combined handlers, sound parameters are updated if combined state is active
        if (needsParamUpdate && this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
            this.updateSoundParameters();
        }
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('🌡️💡 TempLightHandler: window.creatune not available.');
            return;
        }
        if (this.debugMode) console.log('🌡️💡 TempLightHandler: Setting up listeners...');

        const handleDeviceUpdate = (deviceType, data) => {
            if (this.debugMode) console.log(`🌡️💡 TempLightHandler.handleDeviceUpdate for ${deviceType}:`, data);
            let stateChanged = false;

            if (deviceType === 'temperature') {
                if (data.connected !== undefined && this.tempConnected !== data.connected) { this.tempConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.tempActive !== data.active) { this.tempActive = data.active; stateChanged = true; }
                if (data.rawData) {
                    this.currentTempAppValue = data.rawData.temperature_app_value !== undefined ? data.rawData.temperature_app_value : this.currentTempAppValue;
                    this.currentTempCondition = data.rawData.temp_condition || this.currentTempCondition;
                } else {
                    if (data.temperature_app_value !== undefined) this.currentTempAppValue = data.temperature_app_value;
                    if (data.temp_condition) this.currentTempCondition = data.temp_condition;
                }
            } else if (deviceType === 'light') {
                if (data.connected !== undefined && this.lightConnected !== data.connected) { this.lightConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.lightActive !== data.active) { this.lightActive = data.active; stateChanged = true; }
                if (data.rawData) {
                    this.currentLightAppValue = data.rawData.light_app_value !== undefined ? data.rawData.light_app_value : this.currentLightAppValue;
                    this.currentLightCondition = data.rawData.light_condition || this.currentLightCondition;
                } else {
                    if (data.light_app_value !== undefined) this.currentLightAppValue = data.light_app_value;
                    if (data.light_condition) this.currentLightCondition = data.light_condition;
                }
            }

            if (stateChanged) {
                this.updateCombinedState(); // This will call MAV and updateUI
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
                if (this.isRecordMode) { // If TempLight itself is in record mode
                    this.exitRecordMode(true); // Force exit its own record mode
                }
                // updateCombinedState will be called by handleDeviceUpdate
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
                 this.updateUI(); // Update UI on any data change
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
                const lightRec = window.lightHandlerInstance?.isRecordMode;
                const lightSoilRec = window.lightSoilHandlerInstance?.isRecordMode;
                const tempSoilRec = window.tempSoilHandlerInstance?.isRecordMode;

                if (this.isCombinedActive &&
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !tempRec && !lightRec && !lightSoilRec && !tempSoilRec &&
                    this.frameBackground.classList.contains('templight-active-bg')
                ) {
                    if (this.debugMode) console.log(`🌡️💡 TempLight frameBackground click: Conditions met. Entering record mode.`);
                    this.enterRecordMode();
                } else if (!this.isRecordMode && !tempRec && !lightRec && !lightSoilRec && !tempSoilRec) {
                     if (this.debugMode) {
                        console.log(`🌡️💡 TempLight frameBackground click: Record mode NOT entered. Conditions: isCombinedActive=${this.isCombinedActive}, isRecMode=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, otherRecs=${tempRec || lightRec || lightSoilRec || tempSoilRec}, hasBG=${this.frameBackground.classList.contains('templight-active-bg')}`);
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
        const oldShowVisualContext = this.showTempLightVisualContext;

        this.isCombinedActive = this.tempConnected && this.tempActive && this.lightConnected && this.lightActive;
        this.showTempLightVisualContext = this.tempConnected && this.lightConnected;

        if (this.debugMode) {
            console.log(`%c🌡️💡 TempLightHandler.updateCombinedState:
    Temp:  connected=${this.tempConnected}, active=${this.tempActive}
    Light: connected=${this.lightConnected}, active=${this.lightActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showTempLightVisualContext: ${this.showTempLightVisualContext} (was ${oldShowVisualContext})`, 'color: #8e44ad; font-weight: bold;');
        }

        // Manage Muting of Individual Handlers
        if (this.showTempLightVisualContext && !this.isRecordMode) {
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Muting TemperatureHandler.`);
                window.temperatureHandlerInstance.setExternallyMuted(true);
            }
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.lightHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Muting LightHandler.`);
                window.lightHandlerInstance.setExternallyMuted(true);
            }
        } else if (!this.isRecordMode) { // Not showing visual context OR in record mode (let others be)
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Un-muting TemperatureHandler.`);
                window.temperatureHandlerInstance.setExternallyMuted(false);
            }
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.lightHandlerInstance.isExternallyMuted) console.log(`🌡️💡 TempLight: Un-muting LightHandler.`);
                window.lightHandlerInstance.setExternallyMuted(false);
            }
        }

        if (this.isCombinedActive !== oldCombinedActiveState || this.showTempLightVisualContext !== oldShowVisualContext) {
            if (this.debugMode) console.log(`%c🌡️💡 TempLightHandler: Combined state CHANGED.`, 'color: #d35400; font-weight: bold;');
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive) {
            if (this.isPlaying && !this.isRecordMode) this.updateSoundParameters();
            else if (!this.isRecordMode) this.manageAudioAndVisuals();
        } else {
            if (this.debugMode && oldCombinedActiveState) console.log(`🌡️💡 TempLightHandler: Combined state remains not active. Ensuring audio stopped.`);
            this.manageAudioAndVisuals();
        }
        this.updateUI();
    }

    _displayNote(note) {
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) {
            if (this.noteDisplayTimeoutId) clearTimeout(this.noteDisplayTimeoutId);
            noteDisplayElement.textContent = String(note); // Ensure it's a string
            this.lastDisplayedNote = String(note);
            this.noteDisplayTimeoutId = setTimeout(() => {
                if (noteDisplayElement.textContent === this.lastDisplayedNote) {
                    noteDisplayElement.textContent = '-';
                }
            }, 850); // Adjusted timeout
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) return;
        if (this.creatureVisual && this.creatureVisual.classList.contains('active')) {
            this.creatureCurrentFrame = (this.creatureCurrentFrame + 1) % this.creatureTotalFrames;
            this.creatureVisual.style.backgroundPositionX = (this.creatureCurrentFrame * 20) + '%';
            if (this.debugMode && Math.random() < 0.01) { // Log 1%
                 console.log(`🌡️💡 TL Creature Animation: Frame ${this.creatureCurrentFrame}`);
            }
        }
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled || Tone.context.state !== 'running') {
            if (this.debugMode) console.warn(`🌡️💡 TempLightHandler.initTone: Cannot init. Tone: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}, Context: ${Tone.context.state}`);
            return;
        }

        if (this.debugMode) console.log('🌡️💡 TempLightHandler.initTone: Initializing Bell + FM Synths...');
        try {
            this.mainVolume = new Tone.Volume(this.baseVolume).toDestination();
            
            this.bellReverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 }).connect(this.mainVolume);
            this.fmChorus = new Tone.Chorus({ frequency: 1.2, delayTime: 3.0, depth: 0.5, wet: 0.4 }).connect(this.mainVolume);

            this.mainSynth = new Tone.MetalSynth({ // Bell Synth
                frequency: 200, harmonicity: 6.1, modulationIndex: 22, octaves: 2.5, resonance: 3500,
                envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.3 },
                volume: -8 
            }).connect(this.bellReverb);

            this.secondarySynth = new Tone.FMSynth({ // Melodic FM
                harmonicity: 2.5, modulationIndex: 8, oscillator: { type: "sine" },
                envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.5 },
                modulation: { type: "triangle" },
                modulationEnvelope: { attack: 0.02, decay: 0.2, sustain: 0, release: 0.3 },
                volume: -15
            }).connect(this.fmChorus);

            const bellNotes = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.mainSynth || !this.isCombinedActive) return;
                const note = bellNotes[Math.floor(Math.random() * bellNotes.length)];
                this.mainSynth.triggerAttack(note, time, Math.random() * 0.4 + 0.6);
                this._displayNote(note); 
                this.triggerCreatureAnimation();
            }, "0:1:2").set({ humanize: "16n" });

            const fmMelodyNotes = ["G3", "A#3", "C4", "D#4", "F4", "G4"];
            this.accentLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.secondarySynth || !this.isCombinedActive) return;
                const note = fmMelodyNotes[Math.floor(Math.random() * fmMelodyNotes.length)];
                this.secondarySynth.triggerAttackRelease(note, "2n", time, Math.random() * 0.3 + 0.2);
                this._displayNote(note);
            }, "1m").set({ probability: 0.35, humanize: "8n" });

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌡️💡 TempLightHandler.initTone: Bell + FM Synths initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ TempLightHandler.initTone (Bell+FM): Error:', error);
            this.toneInitialized = false;
            this.mainSynth?.dispose(); this.secondarySynth?.dispose();
            this.bellReverb?.dispose(); this.fmChorus?.dispose();
            this.mainVolume?.dispose(); this.generativeLoop?.dispose(); this.accentLoop?.dispose();
            this.mainSynth = this.secondarySynth = this.mainVolume = this.bellReverb = this.fmChorus = this.generativeLoop = this.accentLoop = null;
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.mainVolume) return;

        const combinedTempLightValue = (this.currentTempAppValue + this.currentLightAppValue) / 2;
        const dynamicVolume = this.baseVolume - 4 + (combinedTempLightValue * 6); 
        this.mainVolume.volume.linearRampTo(this.isPlaying ? Math.min(this.baseVolume + 2, dynamicVolume) : -Infinity, 0.9);

        if (this.mainSynth) { // Bell (MetalSynth)
            this.mainSynth.envelope.decay = 0.4 + (this.currentTempAppValue * 0.8);
            this.mainSynth.envelope.release = this.mainSynth.envelope.decay * 0.4;
            
            // Directly set harmonicity and resonance for MetalSynth as they are numbers
            const newHarmonicity = 5.0 + (this.currentLightAppValue * 3.0);
            this.mainSynth.harmonicity = newHarmonicity;

            const newResonance = 3000 + (this.currentLightAppValue * 2000);
            this.mainSynth.resonance = newResonance;

            if (this.debugMode && Math.random() < 0.02) { // Reduced logging frequency
                console.log(`🌡️💡 TL-MetalSynth Params: Harm=${this.mainSynth.harmonicity.toFixed(2)}, Reso=${this.mainSynth.resonance.toFixed(2)}`);
            }
        }
        if (this.secondarySynth) { // FM
            this.secondarySynth.modulationIndex.linearRampTo(5 + (this.currentLightAppValue * 10), 0.5);
            this.secondarySynth.harmonicity.linearRampTo(1.5 + (this.currentTempAppValue * 2.5), 0.5);
        }
        if (this.generativeLoop) { // Bell Loop
            if (this.currentTempAppValue > 0.75) this.generativeLoop.interval = "0:1:0";
            else if (this.currentTempAppValue > 0.4) this.generativeLoop.interval = "0:1:2";
            else this.generativeLoop.interval = "0:2:0";
        }
        if (this.accentLoop) { // FM Loop
            this.accentLoop.probability = 0.2 + (this.currentLightAppValue * 0.5);
        }

        if (this.debugMode && Math.random() < 0.05) {
            console.log(`🌡️💡 TL-USParams: Vol=${dynamicVolume.toFixed(1)}, BellDecay:${this.mainSynth?.envelope.decay.toFixed(2)}, FMMI:${this.secondarySynth?.modulationIndex.value.toFixed(2)}`);
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌡️💡 TL MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}`, 'color: #16a085');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (!this.audioEnabled) {
            if (this.debugMode) console.log(`🌡️💡 TL MAV: Audio not enabled. Stopping audio.`);
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI(); return;
        }
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI(); return;
        }

        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                this.initTone();
                if (!this.toneInitialized && this.debugMode) console.log('🌡️💡 TL MAV: initTone called, but still not initialized.');
                this.updateUI(); return;
            }
            if (!this.isPlaying && !this.isFadingOut) this.startAudio();
            else if (this.isPlaying) this.updateSoundParameters();
        } else {
            if (this.isPlaying && !this.isFadingOut) this.stopAudio();
        }
        this.updateUI();
    }

    updateUI() {
        const showCreature = this.isCombinedActive; // Creature visible if combined sensors are active
        if (this.creatureVisual) {
            const wasActive = this.creatureVisual.classList.contains('active');
            this.creatureVisual.classList.toggle('active', showCreature);
            if (!showCreature && wasActive) {
                this.creatureCurrentFrame = 0;
                this.creatureVisual.style.backgroundPositionX = '0%';
            }
            // Add condition-specific classes if needed, e.g., for different appearances
            // ['templight-hot-bright', 'templight-cold-dark'].forEach(cls => this.creatureVisual.classList.remove(cls));
            // if (showCreature) this.creatureVisual.classList.add(`templight-${this.currentTempCondition}-${this.currentLightCondition}`);
        }

        if (this.frameBackground) {
            const tlBgClass = 'templight-active-bg';
            const otherHandlersBgClasses = [
                'light-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', /* ...all light conditions */
                'soil-active-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg',
                'temp-active-bg', 'temp-very-cold-bg', 'temp-cold-bg', /* ...all temp conditions */
                'lightsoil-active-bg',
                'tempsoil-active-bg',
                'idle-bg'
            ];

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(tlBgClass);
                otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                if (this.showTempLightVisualContext) { // Both sensors connected
                    this.frameBackground.classList.add(tlBgClass);
                    otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                } else {
                    this.frameBackground.classList.remove(tlBgClass);
                }
            }
        }

        if (this.stopRecordModeButton) {
            const tempInRec = window.temperatureHandlerInstance?.isRecordMode;
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const lightSoilInRec = window.lightSoilHandlerInstance?.isRecordMode;
            const tempSoilInRec = window.tempSoilHandlerInstance?.isRecordMode;

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!tempInRec && !lightInRec && !lightSoilInRec && !tempSoilInRec) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌡️💡 UI Update (TL): CreatureVis=${showCreature}, ShowTLVisualContext=${this.showTempLightVisualContext}, RecModeTL=${this.isRecordMode}, FrameBG Classes: ${this.frameBackground?.classList?.toString()}`);
    }

    _unmuteOtherHandlersForRecordModeExit() {
        if (this.debugMode) console.log('🌡️💡 TL _unmuteOtherHandlersForRecordModeExit: Unmuting other handlers.');
        // TempLight was in record mode, so it had muted Temp and Light.
        // Unmute TemperatureHandler if TempSoilHandler doesn't need it muted
        if (window.temperatureHandlerInstance?.setExternallyMuted) {
            const tsWantsTempMuted = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
            if (!tsWantsTempMuted) {
                window.temperatureHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`🌡️💡 TL: NOT unmuting Temp as TS wants mute: ${tsWantsTempMuted}`);
            }
        }
        // Unmute LightHandler if LightSoilHandler doesn't need it muted
        if (window.lightHandlerInstance?.setExternallyMuted) {
            const lsWantsLightMuted = window.lightSoilHandlerInstance?.showLightSoilVisualContext;
            if (!lsWantsLightMuted) {
                window.lightHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`🌡️💡 TL: NOT unmuting Light as LS wants mute: ${lsWantsLightMuted}`);
            }
        }
    }

    async exitRecordMode(force = false) { // Ensure this is the complete and robust version
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`🌡️💡 TL exitRecordMode: Called but not in record mode and not forced.`);
            return;
        }
        if (this.debugMode) console.log(`%c🌡️💡 TL exitRecordMode: Exiting record mode. Force: ${force}`, 'color: orange; font-weight: bold;');
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
             if (this.debugMode) console.log('🌡️💡 TL exitRecordMode: mainSynth volume was at rhythmic level.');
        }
        
        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        if (wasRecordMode || force) {
            this._unmuteOtherHandlersForRecordModeExit();
            this.updateCombinedState(); // This will call manageAudioAndVisuals
        } else {
            this.updateUI();
        }
        if (this.debugMode) console.log(`🌡️💡 TL exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let domContentLoadedDependencyCheckCounter = 0;
    const initTempLightHandler = () => {
        const missingDeps = [];
        if (!window.Tone) missingDeps.push("Tone");
        if (!window.creatune) missingDeps.push("creatune");
        if (!window.temperatureHandlerInstance) missingDeps.push("temperatureHandlerInstance");
        if (!window.lightHandlerInstance) missingDeps.push("lightHandlerInstance");

        if (missingDeps.length === 0) {
            if (!window.tempLightHandlerInstance) {
                window.tempLightHandlerInstance = new TempLightHandler();
                if (window.tempLightHandlerInstance.debugMode) console.log('🌡️💡 TempLight Handler instance created.');
            }
        } else {
            domContentLoadedDependencyCheckCounter++;
            if (domContentLoadedDependencyCheckCounter === 1 || domContentLoadedDependencyCheckCounter % 20 === 0) {
                 console.warn(`🌡️💡 TempLightHandler (DOMContentLoaded): Waiting for dependencies to create instance: [${missingDeps.join(', ')}]. Attempt: ${domContentLoadedDependencyCheckCounter}`);
            }
            setTimeout(initTempLightHandler, 250);
        }
    };
    initTempLightHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TempLightHandler;
}