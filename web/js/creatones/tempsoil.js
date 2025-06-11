class TempSoilHandler {
    constructor() {
        this.debugMode = true;
        if (this.debugMode) console.log('🌡️💧 TempSoil Handler: Constructor called.');

        // --- State for individual sensors ---
        this.tempConnected = false;
        this.tempActive = false;
        this.currentTempAppValue = 0.5;
        this.currentTempCondition = "mild"; // e.g., very_cold, cold, cool, mild, warm, hot

        this.soilConnected = false;
        this.soilActive = false;
        this.currentSoilAppValue = 0.0;
        this.currentSoilCondition = "dry"; // e.g., dry, humid, wet
        // --- End State for individual sensors ---

        // --- Combined State ---
        this.isCombinedActive = false;
        this.showTempSoilVisualContext = false;
        // --- End Combined State ---

        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false;
        this.isFadingOut = false;
        this.stopTimeoutId = null;

        // --- Tone.js components ---
        this.bubblySynth = null;
        this.phaserEffect = null;
        this.autoPanner = null;
        this.harmonicaSynth = null;
        this.harmonicaReverb = null;
        this.mainVolume = null;
        this.generativeLoop = null;
        this.harmonicaLoop = null; // Loop for harmonica
        this.fadeDuration = 2.5; // Slightly longer for more complex sound
        this.baseVolume = 6; // Adjusted base volume for main output
        this.rhythmicPlaybackVolume = 6; // Volume during record playback

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
        this.tempSoilCreatureCurrentFrame = 0;
        this.tempSoilCreatureTotalFrames = 6; // Assuming 6 frames

        // --- DOM Elements ---
        this.tempSoilCreatureVisual = document.querySelector('.tempsoil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        if (!this.tempSoilCreatureVisual && this.debugMode) console.warn('🌡️💧 .tempsoil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌡️💧 .framebackground element not found for TempSoilHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌡️💧 #stoprecordmode button not found for TempSoilHandler.');

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune && window.temperatureHandlerInstance && window.soilHandlerInstance) {
                this.setupListeners();
                // Get initial states
                const initialTempState = window.creatune.getDeviceState('temperature');
                const initialSoilState = window.creatune.getDeviceState('soil');
                if (this.debugMode) {
                    console.log('🌡️💧 TempSoilHandler: Initial Temp State:', initialTempState);
                    console.log('🌡️💧 TempSoilHandler: Initial Soil State:', initialSoilState);
                }
                this.updateInternalDeviceState('temperature', initialTempState);
                this.updateInternalDeviceState('soil', initialSoilState);
                this.updateCombinedState();

                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('🌡️💧 TempSoilHandler: Waiting for dependencies (Tone, creatune, tempHandler, soilHandler)...');
                setTimeout(checkDependencies, 200);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌡️💧 TempSoilHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode && !this.isExternallyMutedByOtherCombined) {
            if (this.debugMode) console.log('🌡️💧 TempSoilHandler: AudioContext running, trying to initTone.');
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    // TempSoilHandler does not have its own external mute, it's controlled by its combined state
    // and the muting of its constituent handlers.

    updateInternalDeviceState(deviceType, state) {
        if (!state) {
            if (this.debugMode) console.log(`🌡️💧 TempSoilHandler.updateInternalDeviceState: No initial state for ${deviceType}`);
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
        } else if (deviceType === 'soil') {
            if (this.soilConnected !== state.connected) { this.soilConnected = state.connected; changed = true; }
            if (this.soilActive !== state.active) { this.soilActive = state.active; changed = true; }
            if (state.lastRawData) {
                if (this.currentSoilAppValue !== state.lastRawData.moisture_app_value) { this.currentSoilAppValue = state.lastRawData.moisture_app_value; changed = true; }
                if (this.currentSoilCondition !== state.lastRawData.soil_condition) { this.currentSoilCondition = state.lastRawData.soil_condition; changed = true; }
            }
        }
        if (this.debugMode && changed) console.log(`🌡️💧 TempSoilHandler.updateInternalDeviceState for ${deviceType} caused change. Temp: con=${this.tempConnected},act=${this.tempActive}. Soil: con=${this.soilConnected},act=${this.soilActive}`);
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
        } else if (deviceType === 'soil') {
            if (data.moisture_app_value !== undefined && this.currentSoilAppValue !== data.moisture_app_value) {
                this.currentSoilAppValue = data.moisture_app_value;
                needsParamUpdate = true;
            }
            if (data.soil_condition && this.currentSoilCondition !== data.soil_condition) {
                this.currentSoilCondition = data.soil_condition;
            }
        }
        if (needsParamUpdate && this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
            this.updateSoundParameters();
        }
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('🌡️💧 TempSoilHandler: window.creatune not available.');
            return;
        }
        if (this.debugMode) console.log('🌡️💧 TempSoilHandler: Setting up WebSocket listeners...');

        const handleDeviceUpdate = (deviceType, data) => {
            if (this.debugMode) console.log(`🌡️💧 TempSoilHandler.handleDeviceUpdate for ${deviceType}:`, data);
            let stateChanged = false;

            if (deviceType === 'temperature') {
                if (data.connected !== undefined && this.tempConnected !== data.connected) { this.tempConnected = data.connected; stateChanged = true; }
                if (data.active !== undefined && this.tempActive !== data.active) { this.tempActive = state.active; stateChanged = true; }
                if (data.rawData) {
                    this.currentTempAppValue = data.rawData.temp_app_value !== undefined ? data.rawData.temp_app_value : this.currentTempAppValue;
                    this.currentTempCondition = data.rawData.temp_condition || this.currentTempCondition;
                } else {
                    if (data.temp_app_value !== undefined) this.currentTempAppValue = data.temp_app_value;
                    if (data.temp_condition) this.currentTempCondition = data.temp_condition;
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

            // CRITICAL: Ensure this line (around 188) uses 'stateChanged' and not 'state'.
            // If your file has 'if (state)' here, change it to 'if (stateChanged)'.
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
            if (deviceType === 'temperature' || deviceType === 'soil') {
                 if (this.debugMode) console.log(`🌡️💧 TempSoilHandler: Received 'connected' for ${deviceType}`);
                 handleDeviceUpdate(deviceType, { connected: true, active: (deviceType === 'temperature' ? this.tempActive : this.soilActive) });
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'temperature' || deviceType === 'soil') {
                if (this.debugMode) console.log(`🌡️💧 TempSoilHandler: Received 'disconnected' for ${deviceType}`);
                handleDeviceUpdate(deviceType, { connected: false, active: false });
                if (this.isRecordMode) this.exitRecordMode(true);
            }
        });
        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'temperature' || deviceType === 'soil') {
                if (this.debugMode) console.log(`🌡️💧 TempSoilHandler: Received 'stateChange' for ${deviceType}`, state);
                // Ensure 'state' is an object before spreading to prevent issues if it's null or undefined.
                // This helps avoid TypeErrors if data.rawData is accessed later, but the original error is a ReferenceError.
                const eventData = (typeof state === 'object' && state !== null) ? { ...state } : {};
                handleDeviceUpdate(deviceType, eventData);
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'temperature' || deviceType === 'soil') {
                this.updateInternalDeviceData(deviceType, data);
                if (this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
                    this.updateSoundParameters();
                }
                 this.updateUI();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("🌡️💧 TempSoilHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("🌡️💧 TempSoilHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                const tempRec = window.temperatureHandlerInstance?.isRecordMode;
                const soilRec = window.soilHandlerInstance?.isRecordMode;
                const lightRec = window.lightHandlerInstance?.isRecordMode;
                const lightSoilRec = window.lightSoilHandlerInstance?.isRecordMode;
                const tempLightRec = window.tempLightHandlerInstance?.isRecordMode; // ADDED CHECK

                if (this.isCombinedActive &&
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !tempRec && !soilRec && !lightRec && !lightSoilRec && !tempLightRec && // ADDED tempLightRec
                    this.frameBackground.classList.contains('tempsoil-active-bg')
                ) {
                    if (this.debugMode) console.log(`🌡️💧 TempSoil frameBackground click: Conditions met. Entering record mode.`);
                    this.enterRecordMode();
                } else if (!this.isRecordMode && !tempRec && !soilRec && !lightRec && !lightSoilRec && !tempLightRec) { // ADDED tempLightRec
                    if (this.isCombinedActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('tempsoil-active-bg')) {
                        if (this.debugMode) console.log(`🌡️💧 TempSoil frameBackground click: Could enter record, but TempSoil BG not active.`);
                    } else if (this.debugMode) {
                        console.log(`🌡️💧 TempSoil frameBackground click: Record mode NOT entered. CombinedActive=${this.isCombinedActive}, isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, tempRec=${tempRec}, soilRec=${soilRec}, lightRec=${lightRec}, lightSoilRec=${lightSoilRec}, tempLightRec=${tempLightRec}, hasBGClass=${this.frameBackground?.classList.contains('tempsoil-active-bg')}`); // ADDED tempLightRec
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
        const oldShowTempSoilVisualContext = this.showTempSoilVisualContext;

        this.isCombinedActive = this.tempConnected && this.tempActive && this.soilConnected && this.soilActive;
        this.showTempSoilVisualContext = this.tempConnected && this.soilConnected;

        if (this.debugMode) {
            console.log(`%c🌡️💧 TempSoilHandler.updateCombinedState:
    Temp: connected=${this.tempConnected}, active=${this.tempActive}
    Soil: connected=${this.soilConnected}, active=${this.soilActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showTempSoilVisualContext: ${this.showTempSoilVisualContext} (was ${oldShowTempSoilVisualContext})`, 'color: #8e44ad; font-weight: bold;');
        }

        if (this.showTempSoilVisualContext && !this.isRecordMode) {
            // TempSoil context IS active (and not in record mode).
            // Mute individual handlers that TempSoil is responsible for.
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Muting TemperatureHandler (TS context active).`);
                window.temperatureHandlerInstance.setExternallyMuted(true, 'TempSoilHandler');
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.soilHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Muting SoilHandler (TS context active).`);
                window.soilHandlerInstance.setExternallyMuted(true, 'TempSoilHandler');
            }
        } else if (!this.isRecordMode) {
            // TempSoil context IS NOT active (or we are in record mode, which has its own mute logic via enter/exitRecordMode).
            // Try to unmute individual handlers, but ONLY if no OTHER combined handler needs them muted.

            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                const tempLightShowsContext = window.tempLightHandlerInstance?.showTempLightVisualContext;
                if (!tempLightShowsContext) { // Only unmute if TempLight is NOT showing its context
                    if (this.debugMode && window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Un-muting TemperatureHandler (TS context NOT active, TL context NOT active).`);
                    window.temperatureHandlerInstance.setExternallyMuted(false, null);
                } else if (this.debugMode) {
                    console.log(`🌡️💧 TempSoil: NOT un-muting TemperatureHandler (TS context NOT active) because TempLight context IS active.`);
                }
            }

            if (window.soilHandlerInstance?.setExternallyMuted) {
                const lightSoilShowsContext = window.lightSoilHandlerInstance?.showLightSoilVisualContext;
                if (!lightSoilShowsContext) { // Only unmute if LightSoil is NOT showing its context
                    if (this.debugMode && window.soilHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Un-muting SoilHandler (TS context NOT active, LS context NOT active).`);
                    window.soilHandlerInstance.setExternallyMuted(false, null);
                } else if (this.debugMode) {
                    console.log(`🌡️💧 TempSoil: NOT un-muting SoilHandler (TS context NOT active) because LightSoil context IS active.`);
                }
            }
        }

        if (this.isCombinedActive !== oldCombinedActiveState || this.showTempSoilVisualContext !== oldShowTempSoilVisualContext) {
            if (this.debugMode) console.log(`%c🌡️💧 TempSoilHandler: Combined state CHANGED.`, 'color: #d35400; font-weight: bold;');
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive) {
            if (this.isPlaying && !this.isRecordMode) {
                this.updateSoundParameters();
            } else if (!this.isRecordMode) {
                 this.manageAudioAndVisuals();
            }
        } else {
            this.manageAudioAndVisuals();
        }
        this.updateUI();
    }

    _displayNote(note) {
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) {
            if (this.noteDisplayTimeoutId) clearTimeout(this.noteDisplayTimeoutId);
            noteDisplayElement.textContent = note; // Emoji removed
            this.lastDisplayedNote = note;
            this.noteDisplayTimeoutId = setTimeout(() => {
                if (noteDisplayElement.textContent === this.lastDisplayedNote) {
                    noteDisplayElement.textContent = '-';
                }
            }, 900); // Slightly longer display for slower pace
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) return;
        if (this.tempSoilCreatureVisual && this.tempSoilCreatureVisual.classList.contains('active')) {
            this.tempSoilCreatureCurrentFrame = (this.tempSoilCreatureCurrentFrame + 1) % this.tempSoilCreatureTotalFrames;
            // Changed to use the fixed * 20 logic, similar to the soil.js snippet provided
            this.tempSoilCreatureVisual.style.backgroundPositionX = (this.tempSoilCreatureCurrentFrame * 20) + '%';
        }
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) return;
        if (Tone.context.state !== 'running') return;

        if (this.debugMode) console.log('🌡️💧 TempSoilHandler.initTone: Initializing Bubbly & Harmonica Synths...');
        try {
            this.mainVolume = new Tone.Volume(this.baseVolume).toDestination();
            
            // Effects for Bubbly Synth
            this.autoPanner = new Tone.AutoPanner({ frequency: "16n", depth: 0.7, wet: 0.6 }).connect(this.mainVolume);
            this.phaserEffect = new Tone.Phaser({
                frequency: 0.5,
                octaves: 2.5,
                stages: 7,
                Q: 4,
                baseFrequency: 350,
                wet: 0.5
            }).connect(this.autoPanner);

            this.bubblySynth = new Tone.FMSynth({
                harmonicity: 1.2,
                modulationIndex: 7,
                oscillator: { type: "sine" },
                envelope: { attack: 0.008, decay: 0.15, sustain: 0.02, release: 0.25 },
                modulation: { type: "triangle" },
                modulationEnvelope: { attack: 0.008, decay: 0.08, sustain: 0, release: 0.15 },
                volume: -9 // Initial synth volume, overall controlled by this.mainVolume
            }).connect(this.phaserEffect);

            // Harmonica Synth and its Reverb
            this.harmonicaReverb = new Tone.Reverb({
                decay: 3.5, // Longer decay for harmonica
                wet: 0.6
            }).connect(this.mainVolume); // Connect reverb to main volume

            this.harmonicaSynth = new Tone.Synth({ // Simple synth for harmonica-like tone
                oscillator: { type: "sawtooth6" }, // A slightly brighter waveform
                envelope: {
                    attack: 0.05, // Slower attack
                    decay: 0.4,
                    sustain: 0.2,
                    release: 0.3
                },
                volume: -10 // Quieter than bubbly synth
            }).connect(this.harmonicaReverb);


            const bubblyNotes = ["C3", "D#3", "F3", "G3", "A#3", "C4", "D#4", "F4", "G4"];
            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.bubblySynth || !this.isCombinedActive) return;

                const note = bubblyNotes[Math.floor(Math.random() * bubblyNotes.length)];
                this.bubblySynth.triggerAttackRelease(note, "8n", time); // Slower notes
                this._displayNote(note); // No emoji
                this.triggerCreatureAnimation(); // Ensure animation triggers for every bubbly note
            }, "4n"); // Slower bubble rate
            this.generativeLoop.humanize = "16n";

            const harmonicaPitches = ["G4", "A#4", "C5", "D5", "D#5", "F5"];
            this.harmonicaLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.harmonicaSynth || !this.isCombinedActive) return;
                
                const note = harmonicaPitches[Math.floor(Math.random() * harmonicaPitches.length)];
                this.harmonicaSynth.triggerAttackRelease(note, "2n", time); // Longer, sustained note
                this._displayNote(note); // No emoji
                this.triggerCreatureAnimation(); // Ensure animation triggers for every harmonica note
            }, "2m"); // Plays infrequently (every 2 measures)
            this.harmonicaLoop.probability = 0.35; // Not every time the loop comes around
            this.harmonicaLoop.humanize = "4n";


            this.toneInitialized = true;
            if (this.debugMode) console.log('🌡️💧 TempSoilHandler.initTone: Synths initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ TempSoilHandler.initTone: Error:', error);
            this.toneInitialized = false;
            // Dispose components
            this.bubblySynth?.dispose(); this.phaserEffect?.dispose(); this.autoPanner?.dispose();
            this.harmonicaSynth?.dispose(); this.harmonicaReverb?.dispose();
            this.mainVolume?.dispose(); this.generativeLoop?.dispose(); this.harmonicaLoop?.dispose();
            this.bubblySynth = this.phaserEffect = this.autoPanner = this.mainVolume = this.generativeLoop = null;
            this.harmonicaSynth = this.harmonicaReverb = this.harmonicaLoop = null;
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.mainVolume) return;

        const combinedTempSoilValue = (this.currentTempAppValue + this.currentSoilAppValue) / 2; // 0 to 1

        // Volume
        const dynamicVolume = this.baseVolume - 8 + (combinedTempSoilValue * 12); // Adjusted range
        this.mainVolume.volume.linearRampTo(this.isPlaying ? Math.min(-2, dynamicVolume) : -Infinity, 0.9);

        // Bubbly Synth Loop interval
        if (this.generativeLoop) {
            if (combinedTempSoilValue > 0.8) this.generativeLoop.interval = "8n"; 
            else if (combinedTempSoilValue > 0.5) this.generativeLoop.interval = "4n";
            else this.generativeLoop.interval = "2n"; // Slower for lower combined values
        }

        // Phaser Frequency (influenced by Temperature)
        if (this.phaserEffect) {
            this.phaserEffect.frequency.value = 0.15 + (this.currentTempAppValue * 1.2); 
        }
        // Panner Speed (influenced by Soil)
        if (this.autoPanner) {
            this.autoPanner.frequency.value = "16n" + (this.currentSoilAppValue * 0.6); // Slower base, more noticeable change
        }
         if (this.bubblySynth) {
            this.bubblySynth.harmonicity.value = 1.0 + combinedTempSoilValue * 1.5; 
            this.bubblySynth.modulationIndex.value = 4 + combinedTempSoilValue * 8;
        }
        
        // Harmonica Loop Probability (more likely in certain conditions)
        if (this.harmonicaLoop) {
            // Example: More harmonica if temp is mild/warm and soil is humid
            if ((this.currentTempCondition === "mild" || this.currentTempCondition === "warm") && this.currentSoilCondition === "humid") {
                this.harmonicaLoop.probability = 0.5;
            } else if (this.currentTempCondition === "hot" || this.currentSoilCondition === "wet") {
                this.harmonicaLoop.probability = 0.25;
            } else {
                this.harmonicaLoop.probability = 0.15;
            }
        }
        if (this.harmonicaSynth && this.harmonicaSynth.volume) {
             // Make harmonica slightly louder if temp is high
            const harmonicaVolOffset = (this.currentTempAppValue > 0.7) ? 3 : 0; // dB offset
            this.harmonicaSynth.volume.linearRampTo(this.baseVolume -12 + harmonicaVolOffset, 0.5);
        }


        if (this.debugMode && Math.random() < 0.05) console.log(`🌡️💧 USParams: Vol=${dynamicVolume.toFixed(1)}, LoopInterval=${this.generativeLoop?.interval}, HarmonicaProb=${this.harmonicaLoop?.probability.toFixed(2)}`);
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌡️💧 TS MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}`, 'color: #16a085');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (!this.audioEnabled) {
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI();
            return;
        }

        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI();
            return;
        }

        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                this.initTone();
                if (!this.toneInitialized) { this.updateUI(); return; }
            }
            if (!this.isPlaying && !this.isFadingOut) {
                this.startAudio();
            } else if (this.isPlaying) {
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
        const oldShowCreature = this.tempSoilCreatureVisual ? this.tempSoilCreatureVisual.classList.contains('active') : false;
        const showCreature = this.isCombinedActive; // Creature visible if TempSoil is the active combined state

        if (this.tempSoilCreatureVisual) {
            this.tempSoilCreatureVisual.classList.toggle('active', showCreature);

            // Remove previous condition-specific classes
            // This ensures only the current combined state class is present, plus base classes.
            const classPrefix = 'tempsoil-';
            const classesToRemove = [];
            for (const cls of this.tempSoilCreatureVisual.classList) {
                if (cls.startsWith(classPrefix) && cls !== 'tempsoil-creature') { // Keep the base 'tempsoil-creature' class
                    classesToRemove.push(cls);
                }
            }
            classesToRemove.forEach(cls => this.tempSoilCreatureVisual.classList.remove(cls));

            if (showCreature) {
                // Add current condition-specific class
                const tempConditionClass = this.currentTempCondition.replace('_', '-');
                const soilConditionClass = this.currentSoilCondition.replace('_', '-');
                this.tempSoilCreatureVisual.classList.add(`${classPrefix}${tempConditionClass}-${soilConditionClass}`);
            } else if (oldShowCreature && !this.tempSoilCreatureVisual.classList.contains('active')) {
                // Reset animation frame if creature becomes inactive
                this.tempSoilCreatureCurrentFrame = 0;
                this.tempSoilCreatureVisual.style.backgroundPositionX = '0%';
            }
        }

        if (this.frameBackground) {
            const tempSoilBgClass = 'tempsoil-active-bg';
            const otherHandlersBgClasses = [ // Combined list of individual and other combined handlers' BGs
                'temp-active-bg', 'temp-very-cold-bg', 'temp-cold-bg', 'temp-cool-bg', 'temp-mild-bg', 'temp-warm-bg', 'temp-hot-bg',
                'soil-active-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg',
                'light-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'lightsoil-active-bg',
                'templight-active-bg', // ADDED templight
                'idle-bg'
            ];

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(tempSoilBgClass);
                otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                if (this.showTempSoilVisualContext) {
                    this.frameBackground.classList.add(tempSoilBgClass);
                    otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                } else {
                    this.frameBackground.classList.remove(tempSoilBgClass);
                    // Do not clear other backgrounds if TempSoil is not showing its context,
                    // as another handler might be active.
                }
            }
        }

        if (this.stopRecordModeButton) {
            const tempInRec = window.temperatureHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const lightSoilInRec = window.lightSoilHandlerInstance?.isRecordMode;
            const tempLightInRec = window.tempLightHandlerInstance?.isRecordMode; // ADDED

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!tempInRec && !soilInRec && !lightInRec && !lightSoilInRec && !tempLightInRec) { // ADDED tempLightInRec
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌡️💧 UI Update (TS): CreatureVis=${showCreature}, ShowTSVisualContext=${this.showTempSoilVisualContext}, RecModeTS=${this.isRecordMode}, CreatureClasses: ${this.tempSoilCreatureVisual?.classList.toString()}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌡️💧 TS startAudio: isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}`, 'color: #27ae60; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode || !this.bubblySynth || !this.generativeLoop) {
            if (this.debugMode) console.warn("🌡️💧 TS startAudio: Conditions not met. Returning.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            this.updateSoundParameters(); this.updateUI(); return;
        }

        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters();

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.generativeLoop?.state !== "started") this.generativeLoop.start(0);
        if (this.harmonicaLoop?.state !== "started") this.harmonicaLoop.start(0); // Start harmonica loop

        if (this.debugMode) console.log('🌡️💧 TS startAudio: Bubbly & Harmonica audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌡️💧 TS stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.mainVolume) {
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: Bailed. Audio not enabled, Tone not initialized, or mainVolume missing.');
            this.isPlaying = false; this.isFadingOut = false;
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: Bailed. Not playing, not fading, and not forced.');
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: Bailed. Already fading out and not forced.');
            return;
        }

        this.isPlaying = false; // Mark as not playing immediately
        const fadeTime = force ? 0.01 : this.fadeDuration;

        // Stop loops immediately if forced, or at the start of the fade process
        if (this.generativeLoop && this.generativeLoop.state === "started") {
            this.generativeLoop.stop(0);
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: GenerativeLoop stopped.');
        }
        if (this.harmonicaLoop && this.harmonicaLoop.state === "started") {
            this.harmonicaLoop.stop(0);
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: HarmonicaLoop stopped.');
        }

        if (this.mainVolume && this.mainVolume.volume) {
            this.mainVolume.volume.cancelScheduledValues(Tone.now());
            this.mainVolume.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        this.isFadingOut = true; // Set fadingOut after initiating ramp and stopping loops

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            // Loops are already stopped.
            if (this.mainVolume && this.mainVolume.volume) {
                this.mainVolume.volume.value = -Infinity; // Ensure it's silent
            }
            this.isFadingOut = false;
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: Audio fully stopped after fade.');
            this.updateUI();
        }, force ? 10 : (fadeTime * 1000 + 100)); // Ensure timeout is slightly longer than fade

        if (force) { // If forced, update UI immediately as the timeout might be very short
            this.updateUI();
        }
    }

    async enterRecordMode() {
        // ... (ensure pre-checks are solid as in #attachment:light.js_line522)
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if(this.debugMode) console.warn(`🌡️💧 TS enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}`);
            return;
        }
        // Check if any other handler is in record mode (example from #attachment:light.js_line522)
        if (window.lightHandlerInstance?.isRecordMode || 
            window.temperatureHandlerInstance?.isRecordMode || 
            window.soilHandlerInstance?.isRecordMode || 
            window.lightSoilHandlerInstance?.isRecordMode ||
            window.tempLightHandlerInstance?.isRecordMode) {
            if(this.debugMode) console.warn(`🌡️💧 TS enterRecordMode: Blocked. Another creature is already in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ TS enterRecordMode: getUserMedia API not available.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('🌡️💧 TS enterRecordMode: Starting...');
        this.isRecordMode = true;

        // Mute other handlers (as in #attachment:tempsoil.js_line702)
        if (window.temperatureHandlerInstance?.setExternallyMuted) window.temperatureHandlerInstance.setExternallyMuted(true, 'TempSoilHandler-Record');
        if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(true, 'TempSoilHandler-Record');
        // ... (mute other potentially conflicting handlers)

        if (this.isPlaying || this.isFadingOut) {
            if (this.debugMode) console.log('🌡️💧 TS enterRecordMode: Stopping generative audio forcefully.');
            this.stopAudio(true); // Force stop generative audio
        }
        if (this.mainVolume) this.mainVolume.volume.value = -Infinity; // Ensure generative path is silent

        this.updateUI(); // Reflect record mode state

        // Short delay before mic access to allow UI to update and audio to stop
        await new Promise(resolve => setTimeout(resolve, 250)); 

        if (!this.isRecordMode) { // Check if exited during this brief wait
            if(this.debugMode) console.log('🌡️💧 TS enterRecordMode: Exited during pre-recording wait. Restoring other handlers.');
            this.updateCombinedState(); // This will handle unmuting if appropriate
            return; 
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();
            
            if (!this.isRecordMode) { // Check if exited during mic permission
                if (this.debugMode) console.log('🌡️💧 TS enterRecordMode: Exited after mic permission. Closing mic.');
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                this.updateCombinedState(); // Unmute relevant handlers
                return;
            }

            if (this.debugMode) console.log('🌡️💧 TS enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log('🌡️💧 TS enterRecordMode: Recording started.');
            this.updateUI(); // Update UI to show recording active

            setTimeout(async () => {
                if (this.debugMode) console.log('🌡️💧 TS enterRecordMode (timeout): Recording duration elapsed.');
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.debugMode) console.log('🌡️💧 TS enterRecordMode (timeout): Recorder gone or no longer in record mode. Cleaning up.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    await this.recorder?.stop().catch(e => console.warn("TS Recorder stop error on early exit:", e));
                    this.recorder?.dispose(); this.recorder = null;
                    if (this.isRecordMode) this.exitRecordMode(true); // Ensure full cleanup if still in record mode
                    else this.updateCombinedState();
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (this.debugMode) console.log('🌡️💧 TS enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) {
                    if (this.debugMode) console.log('🌡️💧 TS enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    this.updateCombinedState();
                    return;
                }
                this._setupRhythmicPlayback(audioBlob);
                this.updateUI(); // Reflect that recording is done, playback might start

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ TS enterRecordMode: Error during mic/recording setup: ${err.message}`, err);
            alert(`Could not start TempSoil recording: ${err.message}.`);
            this.isCurrentlyRecording = false; 
            this.exitRecordMode(true); // Force exit and cleanup
        }
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`🌡️💧 TS exitRecordMode: Called but not in record mode and not forced. Current isRecordMode: ${this.isRecordMode}`);
            return;
        }
        if (this.debugMode) console.log(`%c🌡️💧 TS exitRecordMode: Exiting record mode. Force: ${force}`, 'color: orange; font-weight: bold;');
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false;
        this.isCurrentlyRecording = false; // Ensure this is also reset

        // Stop and dispose of mic
        if (this.mic) {
            if (this.mic.state === "started") this.mic.close();
            this.mic = null;
            if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: Mic closed and cleared.');
        }

        // Stop and dispose of recorder
        if (this.recorder) {
            const recorderInstance = this.recorder; // Capture instance for async
            this.recorder = null; // Nullify immediately
            recorderInstance.stop()
                .then(() => {
                    recorderInstance.dispose();
                    if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: Recorder stopped and disposed.');
                })
                .catch(e => {
                    if (this.debugMode) console.warn('🌡️💧 TS exitRecordMode: Error stopping/disposing recorder (might be already stopped/disposed):', e);
                    recorderInstance.dispose(); // Attempt dispose anyway
                });
        }
        
        // Stop and dispose of rhythmic loop
        if (this.rhythmicLoop) {
            if (this.rhythmicLoop.state === "started") this.rhythmicLoop.stop(0);
            this.rhythmicLoop.dispose();
            this.rhythmicLoop = null;
            if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: RhythmicLoop stopped and disposed.');
        }

        // Stop and dispose of recorded buffer player
        if (this.recordedBufferPlayer) {
            if (this.recordedBufferPlayer.state === "started") this.recordedBufferPlayer.stop(0);
            this.recordedBufferPlayer.dispose();
            this.recordedBufferPlayer = null;
            if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: RecordedBufferPlayer stopped and disposed.');
        }
        if (this.recordedAudioBlobUrl) {
            URL.revokeObjectURL(this.recordedAudioBlobUrl);
            this.recordedAudioBlobUrl = null;
            if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: RecordedAudioBlobUrl revoked.');
        }

        // Dispose of rhythm follower
        if (this.rhythmFollower) {
            this.rhythmFollower.dispose();
            this.rhythmFollower = null;
            if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: RhythmFollower disposed.');
        }

        // Ensure main generative volume is reset if it was used for rhythmic playback (though TempSoil uses mainVolume for combined)
        // This might be more relevant for individual handlers that repurpose their main synth.
        // For TempSoil, its mainVolume should be controlled by its generative state.

        // Crucially, after exiting record mode, re-evaluate combined state
        // This will handle unmuting individual handlers if TempSoil is no longer dominant,
        // and restart TempSoil's own generative audio if its conditions are met.
        if (wasRecordMode || force) { // Ensure this runs if we were in record mode or forced
            if (this.debugMode) console.log('🌡️💧 TS exitRecordMode: Calling updateCombinedState to reassess audio/mute states.');
            this.updateCombinedState();
        } else {
            this.updateUI(); // Still update UI if not forced but was in record mode
        }
        if (this.debugMode) console.log(`🌡️💧 TS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }

    _setupRhythmicPlayback(audioBlob) {
        if (this.debugMode) console.log('🌡️💧 TS _setupRhythmicPlayback: Starting with blob size:', audioBlob.size);

        if (!this.isRecordMode || !this.toneInitialized || !this.mainVolume || !this.bubblySynth || !this.harmonicaSynth) {
            if (this.debugMode) console.warn(`🌡️💧 TS _setupRhythmicPlayback: Conditions not met. isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, mainVolume=${!!this.mainVolume}, synths exist. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }

        try {
            // Clean up any previous rhythmic playback components, just in case
            this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
            this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
            if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
            this.rhythmFollower?.dispose(); this.rhythmFollower = null;

            if (this.mainVolume.volume.value !== this.rhythmicPlaybackVolume) {
                 this.mainVolume.volume.cancelScheduledValues(Tone.now());
                 this.mainVolume.volume.rampTo(this.rhythmicPlaybackVolume, 0.1); // Use dedicated rhythmic volume
            }

            this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
            this.recordedBufferPlayer = new Tone.Player({
                url: this.recordedAudioBlobUrl,
                loop: false, // Typically, the recording is played once
                onload: () => {
                    if (this.debugMode) console.log('🌡️💧 TS _setupRhythmicPlayback (onload): Player loaded.');
                    if (!this.isRecordMode || !this.recordedBufferPlayer) {
                        if (this.debugMode) console.log('🌡️💧 TS _setupRhythmicPlayback (onload): Record mode exited or player disposed during load. Aborting.');
                        this.recordedBufferPlayer?.dispose(); this.recordedBufferPlayer = null;
                        this.rhythmFollower?.dispose(); this.rhythmFollower = null;
                        this.rhythmicLoop?.dispose(); this.rhythmicLoop = null;
                        // Re-evaluate state as we are aborting rhythmic playback
                        this.manageAudioAndVisuals(); 
                        return;
                    }

                    this.rhythmFollower = new Tone.Meter({ smoothing: 0.6 });
                    this.recordedBufferPlayer.connect(this.rhythmFollower);
                    this.recordedBufferPlayer.toDestination(); // Play back the recorded audio
                    this.recordedBufferPlayer.start();
                    if (this.debugMode) console.log('🌡️💧 TS _setupRhythmicPlayback (onload): Recorded buffer player started.');

                    this.rhythmicLoop = new Tone.Loop(time => {
                        if (!this.isRecordMode || !this.rhythmFollower || !this.bubblySynth || !this.harmonicaSynth ||
                            !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                            return;
                        }
                        // ... (rest of your rhythmic loop logic from #attachment:tempsoil.js_line787)
                        const level = this.rhythmFollower.getValue();
                        const currentTime = Tone.now() * 1000; // Milliseconds

                        if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                            const noteToPlay = this.tempSoilRhythmicNotes[Math.floor(Math.random() * this.tempSoilRhythmicNotes.length)];
                            const velocity = 0.3 + Math.random() * 0.4; // Random velocity

                            if (Math.random() < 0.6) { // 60% chance for bubbly synth
                                this.bubblySynth.triggerAttackRelease(noteToPlay, "16n", time, velocity);
                            } else { // 40% chance for harmonica
                                this.harmonicaSynth.triggerAttackRelease(noteToPlay, "8n", time, velocity * 0.8); // Harmonica might be softer
                            }
                            this.lastRhythmNoteTime = currentTime;
                            this._displayNote(noteToPlay);
                        }
                    }, "16n").start(0);
                    if (this.debugMode) console.log('🌡️💧 TS _setupRhythmicPlayback (onload): Rhythmic loop initiated.');
                },
                onerror: (err) => {
                    console.error('❌ TS _setupRhythmicPlayback: Error loading recorded buffer player:', err);
                    this.exitRecordMode(true);
                }
            });

            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
            }
        } catch (error) {
            console.error('❌ TS _setupRhythmicPlayback: General error:', error);
            this.exitRecordMode(true);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initTempSoilHandler = () => {
        if (window.creatune && window.Tone && window.temperatureHandlerInstance && window.soilHandlerInstance) {
            if (!window.tempSoilHandlerInstance) {
                window.tempSoilHandlerInstance = new TempSoilHandler();
                if (window.tempSoilHandlerInstance.debugMode) console.log('🌡️💧 TempSoil Handler instance created.');
            }
        } else {
            if (window.tempSoilHandlerInstance?.debugMode || !window.tempSoilHandlerInstance) console.log('🌡️💧 Waiting for TempSoilHandler dependencies (DOMContentLoaded)...');
            setTimeout(initTempSoilHandler, 250); // Slightly longer timeout due to more dependencies
        }
    };
    initTempSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TempSoilHandler;
}