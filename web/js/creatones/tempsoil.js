class TempSoilHandler {
    constructor() {
        this.debugMode = true;
        if (this.debugMode) console.log('🌡️💧 TempSoil Handler: Constructor called.');

        // --- State for individual sensors ---
        this.tempConnected = false;
        this.tempActive = false;
        this.currentTempAppValue = 0.5;
        this.currentTempCondition = "mild";

        this.soilConnected = false;
        this.soilActive = false;
        this.currentSoilAppValue = 0.0;
        this.currentSoilCondition = "dry";
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

        // --- Tone.js components for Bubbly Synth ---
        this.bubblySynth = null;
        this.phaserEffect = null;
        this.autoPanner = null;
        this.mainVolume = null;
        this.generativeLoop = null;
        this.fadeDuration = 2.2;
        this.baseVolume = 6; // Adjusted for potentially complex sound
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
                if (data.active !== undefined && this.tempActive !== data.active) { this.tempActive = data.active; stateChanged = true; }
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
                handleDeviceUpdate(deviceType, { ...state });
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
                const lightRec = window.lightHandlerInstance?.isRecordMode; // Check light too
                const lightSoilRec = window.lightSoilHandlerInstance?.isRecordMode; // Check lightsoil

                if (this.isCombinedActive &&
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !tempRec && !soilRec && !lightRec && !lightSoilRec && // No other handler is recording
                    this.frameBackground.classList.contains('tempsoil-active-bg')
                ) {
                    if (this.debugMode) console.log(`🌡️💧 TempSoil frameBackground click: Conditions met. Entering record mode.`);
                    this.enterRecordMode();
                } else if (!this.isRecordMode && !tempRec && !soilRec && !lightRec && !lightSoilRec) {
                    if (this.isCombinedActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('tempsoil-active-bg')) {
                        if (this.debugMode) console.log(`🌡️💧 TempSoil frameBackground click: Could enter record, but TempSoil BG not active.`);
                    } else if (this.debugMode) {
                        console.log(`🌡️💧 TempSoil frameBackground click: Record mode NOT entered. CombinedActive=${this.isCombinedActive}, isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, tempRec=${tempRec}, soilRec=${soilRec}, lightRec=${lightRec}, lightSoilRec=${lightSoilRec}, hasBGClass=${this.frameBackground?.classList.contains('tempsoil-active-bg')}`);
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
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Muting TemperatureHandler.`);
                window.temperatureHandlerInstance.setExternallyMuted(true);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && !window.soilHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Muting SoilHandler.`);
                window.soilHandlerInstance.setExternallyMuted(true);
            }
        } else if (!this.isRecordMode) {
            if (window.temperatureHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.temperatureHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Un-muting TemperatureHandler.`);
                window.temperatureHandlerInstance.setExternallyMuted(false);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.soilHandlerInstance.isExternallyMuted) console.log(`🌡️💧 TempSoil: Un-muting SoilHandler.`);
                window.soilHandlerInstance.setExternallyMuted(false);
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
        if (this.isCurrentlyRecording) return;
        if (this.tempSoilCreatureVisual && this.tempSoilCreatureVisual.classList.contains('active')) {
            this.tempSoilCreatureCurrentFrame = (this.tempSoilCreatureCurrentFrame + 1) % this.tempSoilCreatureTotalFrames;
            this.tempSoilCreatureVisual.style.backgroundPositionX = (this.tempSoilCreatureCurrentFrame * (100 / this.tempSoilCreatureTotalFrames)) + '%';
        }
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) return;
        if (Tone.context.state !== 'running') return;

        if (this.debugMode) console.log('🌡️💧 TempSoilHandler.initTone: Initializing Bubbly Synth...');
        try {
            this.mainVolume = new Tone.Volume(this.baseVolume).toDestination();
            this.autoPanner = new Tone.AutoPanner({ frequency: "8n", depth: 0.8, wet: 0.7 }).connect(this.mainVolume);
            this.phaserEffect = new Tone.Phaser({
                frequency: 0.6,
                octaves: 2,
                stages: 8,
                Q: 5,
                baseFrequency: 400,
                wet: 0.6
            }).connect(this.autoPanner);

            this.bubblySynth = new Tone.FMSynth({
                harmonicity: 1.5,
                modulationIndex: 8,
                oscillator: { type: "sine" },
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.01, release: 0.2 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.1 },
                volume: -6 // Initial synth volume, overall controlled by this.mainVolume
            }).connect(this.phaserEffect);

            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.bubblySynth || !this.isCombinedActive) return;

                const freq = Tone.Midi(Math.floor(Math.random() * 24) + 48).toFrequency(); // Random notes C3-B4
                this.bubblySynth.triggerAttackRelease(freq, "32n", time);
                this._displayNote(`💧 ${Tone.Frequency(freq).toNote()}`);
                if (Math.random() < 0.5) this.triggerCreatureAnimation();
            }, "16n"); // Bubble rate
            this.generativeLoop.humanize = "64n";

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌡️💧 TempSoilHandler.initTone: Bubbly Synth initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ TempSoilHandler.initTone: Error:', error);
            this.toneInitialized = false;
            // Dispose components
            this.bubblySynth?.dispose(); this.phaserEffect?.dispose(); this.autoPanner?.dispose(); this.mainVolume?.dispose(); this.generativeLoop?.dispose();
            this.bubblySynth = this.phaserEffect = this.autoPanner = this.mainVolume = this.generativeLoop = null;
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.mainVolume) return;

        const combinedTempSoilValue = (this.currentTempAppValue + this.currentSoilAppValue) / 2; // 0 to 1

        // Volume
        const dynamicVolume = this.baseVolume - 10 + (combinedTempSoilValue * 15);
        this.mainVolume.volume.linearRampTo(this.isPlaying ? Math.min(0, dynamicVolume) : -Infinity, 0.8);

        // Bubble Rate (Loop interval)
        if (this.generativeLoop) {
            if (combinedTempSoilValue > 0.75) this.generativeLoop.interval = "32n"; // Faster
            else if (combinedTempSoilValue > 0.4) this.generativeLoop.interval = "16n";
            else this.generativeLoop.interval = "8n"; // Slower
        }

        // Phaser Frequency
        if (this.phaserEffect) {
            this.phaserEffect.frequency.value = 0.2 + (this.currentTempAppValue * 1.5); // Temp influences phaser speed
        }
        // Panner Speed
        if (this.autoPanner) {
            this.autoPanner.frequency.value = 0.1 + (this.currentSoilAppValue * 0.8); // Soil influences panner speed
        }
         if (this.bubblySynth) {
            this.bubblySynth.harmonicity.value = 1.0 + combinedTempSoilValue * 2.0; // More complex timbre with higher values
            this.bubblySynth.modulationIndex.value = 5 + combinedTempSoilValue * 10;
        }


        if (this.debugMode && Math.random() < 0.05) console.log(`🌡️💧 USParams: Vol=${dynamicVolume.toFixed(1)}, LoopInterval=${this.generativeLoop?.interval}, PhaserFreq=${this.phaserEffect?.frequency.value.toFixed(2)}, PannerFreq=${this.autoPanner?.frequency.value.toFixed(2)}`);
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
        const showCreature = this.isCombinedActive;

        if (this.tempSoilCreatureVisual) {
            this.tempSoilCreatureVisual.classList.toggle('active', showCreature);
            if (!showCreature && oldShowCreature) {
                this.tempSoilCreatureCurrentFrame = 0;
                this.tempSoilCreatureVisual.style.backgroundPositionX = '0%';
            }
        }

        if (this.frameBackground) {
            const tempSoilBgClass = 'tempsoil-active-bg';
            const individualHandlersBgClasses = [
                'temp-active-bg', 'soil-active-bg',
                'light-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'lightsoil-active-bg', 'idle-bg'
            ];

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(tempSoilBgClass);
                individualHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                if (this.showTempSoilVisualContext) {
                    this.frameBackground.classList.add(tempSoilBgClass);
                    individualHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                } else {
                    this.frameBackground.classList.remove(tempSoilBgClass);
                }
            }
        }

        if (this.stopRecordModeButton) {
            const tempInRec = window.temperatureHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const lightSoilInRec = window.lightSoilHandlerInstance?.isRecordMode;

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!tempInRec && !soilInRec && !lightInRec && !lightSoilInRec) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌡️💧 UI Update (TS): CreatureVis=${showCreature}, ShowTSVisualContext=${this.showTempSoilVisualContext}, RecModeTS=${this.isRecordMode}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
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
        if (this.generativeLoop.state !== "started") this.generativeLoop.start(0);

        if (this.debugMode) console.log('🌡️💧 TS startAudio: Bubbly audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌡️💧 TS stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.mainVolume) {
            this.isPlaying = false; this.isFadingOut = false;
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { this.updateUI(); return; }
        if (this.isFadingOut && !force) return;

        this.isPlaying = false;
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        this.mainVolume.volume.cancelScheduledValues(Tone.now());
        this.mainVolume.volume.rampTo(-Infinity, fadeTime, Tone.now());

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.generativeLoop?.state === "started") this.generativeLoop.stop(0);
            if (this.mainVolume) this.mainVolume.volume.value = -Infinity;
            this.isFadingOut = false;
            if (this.debugMode) console.log('🌡️💧 TS stopAudio: Bubbly audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100));

        if (force) this.updateUI();
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if (this.debugMode) console.warn(`🌡️💧 TS enterRecordMode: Blocked. Conditions not met.`);
            return;
        }
        if (window.temperatureHandlerInstance?.isRecordMode || window.soilHandlerInstance?.isRecordMode || window.lightHandlerInstance?.isRecordMode || window.lightSoilHandlerInstance?.isRecordMode) {
            if (this.debugMode) console.warn(`🌡️💧 TS enterRecordMode: Blocked. Another creature is in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            alert('Microphone access not available. Ensure HTTPS or localhost.');
            return;
        }

        this.isRecordMode = true;

        // Mute other handlers
        if (window.temperatureHandlerInstance?.setExternallyMuted) window.temperatureHandlerInstance.setExternallyMuted(true);
        if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(true);
        if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(true);
        if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(true);


        if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
        if (this.mainVolume) this.mainVolume.volume.value = -Infinity;
        if (this.generativeLoop?.state === "started") this.generativeLoop.stop(0);
        this.isPlaying = false; this.isFadingOut = false;

        this.updateUI();
        await new Promise(resolve => setTimeout(resolve, 150));

        if (!this.isRecordMode) {
            this.updateCombinedState(); return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();
            if (!this.isRecordMode) {
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                this.updateCombinedState(); return;
            }

            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();

            setTimeout(async () => {
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder?.state === "started") { try { await this.recorder.stop(); } catch (e) {} }
                    if (this.isRecordMode) this.exitRecordMode(true);
                    return;
                }
                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (!this.isRecordMode) { this.updateCombinedState(); return; }
                this._setupRhythmicPlayback(audioBlob);
            }, this.recordingDuration);

        } catch (err) {
            alert(`Could not start recording for TempSoil: ${err.message}.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true);
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.bubblySynth || !this.mainVolume) {
            this.exitRecordMode(true); return;
        }
        if (this.debugMode) console.log('🌡️💧 TS _setupRhythmicPlayback: Starting with BubblySynth...');

        this.mainVolume.volume.value = this.rhythmicPlaybackVolume;

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl);
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0;

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode || !this.recordedBufferPlayer) {
                    this.recordedBufferPlayer?.dispose(); this.rhythmFollower?.dispose(); this.rhythmicLoop?.dispose();
                    if (this.mainVolume?.volume.value === this.rhythmicPlaybackVolume) this.mainVolume.volume.value = -Infinity;
                    return;
                }
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination();
                this.recordedBufferPlayer.start();

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.bubblySynth || this.recordedBufferPlayer?.state !== 'started') return;
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;
                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const freq = Tone.Midi(Math.floor(Math.random() * 12) + 60).toFrequency(); // C4-B4 for rhythmic response
                        this.bubblySynth.triggerAttackRelease(freq, "32n", time);
                        this.triggerCreatureAnimation();
                        this._displayNote(`💧 ${Tone.Frequency(freq).toNote()}`);
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0);
            },
            onerror: (err) => { console.error('❌ TS _setupRhythmicPlayback: Error loading player:', err); this.exitRecordMode(true); }
        });
        if (Tone.Transport.state !== "started") Tone.Transport.start();
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) return;
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false; this.isCurrentlyRecording = false;

        this.mic?.close(); this.mic = null;
        this.recorder?.stop().then(() => this.recorder.dispose()); this.recorder = null;
        this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
        this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
        if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        this.rhythmFollower?.dispose(); this.rhythmFollower = null;

        if (this.mainVolume?.volume.value === this.rhythmicPlaybackVolume) this.mainVolume.volume.value = -Infinity;
        if (this.generativeLoop?.state === "started") this.generativeLoop.stop(0);
        this.isPlaying = false;

        if (this.noteDisplayTimeoutId) clearTimeout(this.noteDisplayTimeoutId);
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) noteDisplayElement.textContent = '-';

        if (wasRecordMode || force) this.updateCombinedState();
        else this.updateUI();
        if (this.debugMode) console.log(`🌡️💧 TS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
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