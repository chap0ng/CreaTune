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
        this.lightSoilSynth = null; // Renamed from mainSynth
        this.padChorus = null;
        this.padReverb = null;
        this.generativeLoop = null;
        this.fadeDuration = 2.5;
        this.baseVolume = 8; // For FMSynth (lightSoilSynth) keep this db

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
        this.rhythmicPlaybackVolume = -10; // Volume for lightSoilSynth during rhythmic playback

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

                this.updateCombinedState();
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
            console.error('💡 LightHandler: window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💡 LightHandler: Setting up WebSocket and DOM listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'light') {
                const oldActive = this.isActive;
                const oldConnected = this.deviceStates.light.connected;
                this.isActive = state.active;
                this.currentLightCondition = state.rawData.light_condition || "dark";
                this.currentLightAppValue = state.rawData.light_app_value || 0.0;
                this.deviceStates.light.connected = true; // Assuming stateChange implies connected
                if (this.debugMode) console.log(`💡 LightHandler stateChange: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.light.connected} (was ${oldConnected}), condition=${this.currentLightCondition}, appValue=${this.currentLightAppValue}`);
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'light') {
                this.currentLightCondition = data.light_condition || this.currentLightCondition;
                this.currentLightAppValue = data.light_app_value !== undefined ? data.light_app_value : this.currentLightAppValue;
                this.deviceStates.light.connected = true; // Assuming data implies connected
                if (!this.isRecordMode && this.isPlaying) this.updateSoundParameters();
                // Call updateUI if visual representation depends directly on new data, even if not playing
                this.updateUI(); 
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device connected.`);
                this.deviceStates.light.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals(); // Will call updateUI
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device disconnected.`);
                this.deviceStates.light.connected = false;
                this.isActive = false;
                if (this.isRecordMode) this.exitRecordMode(true);
                else this.manageAudioAndVisuals(); // Will call updateUI
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💡 LightHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("💡 LightHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            else this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                // Check if Light can enter record mode
                if (this.deviceStates.light.connected && 
                    !this.isRecordMode &&              
                    this.isActive &&                    
                    this.audioEnabled &&                
                    this.toneInitialized &&
                    (!window.soilHandlerInstance?.isRecordMode) && // Check Soil
                    (!window.lightSoilHandlerInstance?.isRecordMode) && // Check LightSoil
                    this.frameBackground.classList.contains('light-active-bg') // Check if Light's BG is active
                    ) {             
                    if (this.debugMode) console.log(`💡 Light frameBackground click: Conditions met, 'light-active-bg' is present. Entering record mode for Light.`);
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode && (!window.soilHandlerInstance?.isRecordMode && !window.lightSoilHandlerInstance?.isRecordMode)) { // Only log detailed failure if no one is recording
                    if (this.deviceStates.light.connected && this.isActive && this.audioEnabled && this.toneInitialized && !this.frameBackground.classList.contains('light-active-bg')) {
                         if (this.debugMode) console.log(`💡 Light frameBackground click: Light eligible, but 'light-active-bg' NOT present. Current BGs: ${Array.from(this.frameBackground.classList).join(', ')}.`);
                    } else {
                        console.log(`💡 Record mode NOT entered for Light. Conditions: light.connected=${this.deviceStates.light.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, soilRec=${window.soilHandlerInstance?.isRecordMode}, lightSoilRec=${window.lightSoilHandlerInstance?.isRecordMode}, hasLightBG=${this.frameBackground.classList.contains('light-active-bg')}`);
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

        const wsClientInitialState = window.creatune.getDeviceState('light');
        if (wsClientInitialState) {
            this.deviceStates.light.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentLightCondition = wsClientInitialState.lastRawData.light_condition || "dark";
                this.currentLightAppValue = wsClientInitialState.lastRawData.light_app_value || 0.0;
            }
        }
        this.updateUI(); // Initial UI update
    }


    updateCombinedState() {
        const oldCombinedActiveState = this.isCombinedActive;
        const oldShowLightSoilVisualContext = this.showLightSoilVisualContext;

        this.isCombinedActive = this.lightConnected && this.lightActive && this.soilConnected && this.soilActive;
        this.showLightSoilVisualContext = this.lightConnected && this.soilConnected;

        if (this.debugMode) {
            console.log(`%c🌿💡 LightSoilHandler.updateCombinedState:
    Light: connected=${this.lightConnected}, active=${this.lightActive}
    Soil:  connected=${this.soilConnected}, active=${this.soilActive}
    ==> isCombinedActive: ${this.isCombinedActive} (was ${oldCombinedActiveState})
    ==> showLightSoilVisualContext: ${this.showLightSoilVisualContext} (was ${oldShowLightSoilVisualContext})`, 'color: #3498db; font-weight: bold;');
        }

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
        else if ((!this.showLightSoilVisualContext || this.isRecordMode) && !this.isExternallyMuted) {
            if (window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.lightHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting LightHandler (LightSoil context not active or in record mode).`);
                window.lightHandlerInstance.setExternallyMuted(false);
            }
            if (window.soilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode && window.soilHandlerInstance.isExternallyMuted) console.log(`🌿💡 LightSoil: Un-muting SoilHandler (LightSoil context not active or in record mode).`);
                window.soilHandlerInstance.setExternallyMuted(false);
            }
        }

        if (this.isCombinedActive !== oldCombinedActiveState || this.showLightSoilVisualContext !== oldShowLightSoilVisualContext) {
            if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler: Combined state or visual context CHANGED. Calling MAV.`, 'color: #e67e22; font-weight: bold;');
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive && !this.isRecordMode && !this.isExternallyMuted) {
            if (this.isPlaying) {
                if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active & playing. Updating sound params.`);
                this.updateSoundParameters();
            } else {
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active, but not playing. Calling MAV to potentially start audio.`);
                 this.manageAudioAndVisuals();
            }
        } else {
             if (this.debugMode && (oldCombinedActiveState || oldShowLightSoilVisualContext)) {
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
                if (noteDisplayElement.textContent === this.lastDisplayedNote) {
                    noteDisplayElement.textContent = '-';
                }
            }, 750);
        }
    }

    _updateSpriteAnimation() {
        if (!this.lightSoilCreatureVisual) return;
        if (!this.isCombinedActive || this.isRecordMode || this.isExternallyMuted || !this.lightSoilCreatureVisual.classList.contains('active')) {
            return;
        }
        this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        this.lightSoilCreatureVisual.style.backgroundPositionX = (this.currentFrame * (100 / this.frameCount)) + '%';
        if (this.debugMode && Math.random() < 0.05) {
            console.log(`🌿💡 LS Anim Step: Frame ${this.currentFrame}, PosX ${this.lightSoilCreatureVisual.style.backgroundPositionX}`);
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording || !this.isCombinedActive || this.isRecordMode) {
            return;
        }
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

        if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Initializing Tone.js components (FMSynth)...');
        try {
            this.padReverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).toDestination();
            this.padChorus = new Tone.Chorus({ frequency: 0.5, delayTime: 3.0, depth: 0.7, wet: 0.3 }).connect(this.padReverb);

            this.lightSoilSynth = new Tone.FMSynth({ // Renamed
                harmonicity: 2.5,
                modulationIndex: 4,
                detune: 0,
                oscillator: { type: "sine" },
                envelope: {
                    attack: 0.02,
                    decay: 0.2,
                    sustain: 0.3,
                    release: 0.8,
                },
                modulation: { type: "sawtooth" },
                modulationEnvelope: {
                    attack: 0.05,
                    decay: 0.1,
                    sustain: 0.5,
                    release: 0.6,
                },
                volume: -Infinity
            }).connect(this.padChorus);
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: lightSoilSynth (FMSynth) created.');

            const generativeNotes = ["C3", "D#3", "G3", "A#3", "C4", "D#4", "F4", "G#4"];
            this.generativeLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.lightSoilSynth || !this.isCombinedActive) return; // Check lightSoilSynth

                const note = generativeNotes[Math.floor(Math.random() * generativeNotes.length)];
                const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
                const velocity = combinedAppValue * 0.4 + 0.1;

                if (this.debugMode && Math.random() < 0.1) console.log(`🌿💡 GenLoop (FM): Note=${note}, Vel=${velocity.toFixed(2)}, CombinedApp=${combinedAppValue.toFixed(2)}`);
                this.lightSoilSynth.triggerAttackRelease(note, "1n", time, Math.min(0.7, Math.max(0.05,velocity))); // Use lightSoilSynth
                this._displayNote(note);
                this.triggerCreatureAnimation();
            }, "3n");
            this.generativeLoop.humanize = "4n";

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: Tone.js components initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ LightSoilHandler.initTone: Error:', error);
            this.toneInitialized = false;
            if (this.lightSoilSynth) { this.lightSoilSynth.dispose(); this.lightSoilSynth = null; } // Dispose lightSoilSynth
            if (this.padChorus) { this.padChorus.dispose(); this.padChorus = null; }
            if (this.padReverb) { this.padReverb.dispose(); this.padReverb = null; }
            if (this.generativeLoop) { this.generativeLoop.dispose(); this.generativeLoop = null; }
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying || !this.lightSoilSynth) return; // Check lightSoilSynth

        const combinedAppValue = (this.currentLightAppValue + this.currentSoilAppValue) / 2;
        const dynamicVolume = this.baseVolume + (combinedAppValue * 15);
        this.lightSoilSynth.volume.linearRampTo(this.isPlaying ? Math.min(-3, dynamicVolume) : -Infinity, 0.8); // Use lightSoilSynth

        if (this.lightSoilSynth.harmonicity) { // Check lightSoilSynth
            this.lightSoilSynth.harmonicity.linearRampTo(1.5 + (combinedAppValue * 2), 1.0);
            this.lightSoilSynth.modulationIndex.linearRampTo(5 + (combinedAppValue * 10), 1.0);
        }

        if (this.generativeLoop) {
            if (combinedAppValue > 0.75) this.generativeLoop.interval = "2n";
            else if (combinedAppValue > 0.5) this.generativeLoop.interval = "3n";
            else this.generativeLoop.interval = "8n"; // Was 4n, changed to 8n as per previous version
        }
        if (this.debugMode && Math.random() < 0.05) console.log(`🌿💡 USParams (FM): Vol=${dynamicVolume.toFixed(1)}, Harm=${this.lightSoilSynth?.harmonicity?.value.toFixed(1)}, ModIdx=${this.lightSoilSynth?.modulationIndex?.value.toFixed(1)}, Interval=${this.generativeLoop?.interval}`);
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`%c🌿💡 LS MAV: isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isPlaying=${this.isPlaying}, isRecordMode=${this.isRecordMode}, isExtMuted=${this.isExternallyMuted}`, 'color: #2ecc71');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`🌿💡 LS MAV: Externally muted (${this.isExternallyMuted}) or audio not enabled (${!this.audioEnabled}). Stopping all audio for LightSoil.`);
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI();
            return;
        }

        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: In Record Mode, stopping generative audio.');
                this.stopAudio(true);
            }
            this.updateUI();
            return;
        }

        if (this.isCombinedActive) {
            if (!this.toneInitialized) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, Tone not init. Attempting initTone.');
                this.initTone();
                if (!this.toneInitialized && this.debugMode) console.log('🌿💡 LS MAV: initTone called, but still not initialized.');
                this.updateUI();
                return;
            }
            if (!this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, should play generative. Calling startAudio.');
                this.startAudio();
            } else if (this.isPlaying) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, generative already playing. Updating sound params.');
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log('🌿💡 LS MAV: NOT combined active, but generative was playing. Calling stopAudio.');
                this.stopAudio();
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
                this.currentFrame = 0;
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

            const lightSoilBgClass = 'lightsoil-active-bg';
            const otherContextBgClasses = [
                'light-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg', 'light-error-bg',
                'soil-active-bg', 'soil-connected-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg', 'soil-pattern-bg',
                'idle-bg'
            ];

            if (lightSoilRec) { // LightSoil is IN RECORD MODE
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.remove('lightsoil-active-bg');
            } else if (showLightSoilBg) { // Use showLightSoilBg which considers external mute and record mode
                this.frameBackground.classList.remove('record-mode-pulsing');
                this.frameBackground.classList.add('lightsoil-active-bg');
                 // When LightSoil BG is active, remove others
                otherContextBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                this.frameBackground.classList.remove('lightsoil-active-bg');
                // If LightSoil BG is not shown, other handlers' updateUI will determine the BG.
                // Or, if no handler is dominant, an idle-bg might be set.
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`🌿💡 UI Update (LS): CreatureVis=${showCreature}, LightSoilBGVis=${showLightSoilBg}, RecModeLS=${this.isRecordMode}, ExtMuteLS=${this.isExternallyMuted}, FrameBG Classes: ${this.frameBackground?.classList?.toString()}`);
    }

    startAudio() {
        if (this.debugMode) console.log(`%c🌿💡 LS startAudio: isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}`, 'color: #9b59b6; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode || !this.lightSoilSynth || !this.generativeLoop) { // Check lightSoilSynth
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

        if (this.debugMode) console.log('🌿💡 LS startAudio: Starting generative audio (FMSynth)...');
        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters();

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.generativeLoop.state !== "started") this.generativeLoop.start(0);

        if (this.debugMode) console.log('🌿💡 LS startAudio: Generative audio started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c🌿💡 LS stopAudio: force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.lightSoilSynth) { // Check lightSoilSynth
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿💡 LS stopAudio: Audio system not ready.");
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
        this.isPlaying = false;
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        this.lightSoilSynth.volume.cancelScheduledValues(Tone.now()); // Use lightSoilSynth
        this.lightSoilSynth.volume.rampTo(-Infinity, fadeTime, Tone.now()); // Use lightSoilSynth
        if (this.lightSoilSynth.triggerRelease && typeof this.lightSoilSynth.triggerRelease === 'function') { // Use lightSoilSynth
             this.lightSoilSynth.triggerRelease(Tone.now() + fadeTime * 0.8); // Use lightSoilSynth
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.generativeLoop && this.generativeLoop.state === "started") this.generativeLoop.stop(0);
            if (this.lightSoilSynth) this.lightSoilSynth.volume.value = -Infinity; // Use lightSoilSynth

            this.isFadingOut = false;
            if (this.debugMode) console.log('🌿💡 LS stopAudio: Generative audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100));

        if (force) this.updateUI();
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
        this.isRecordMode = true;

        // Mute other handlers
        if (window.lightHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Muting LightHandler.');
            window.lightHandlerInstance.setExternallyMuted(true);
        }
        if (window.soilHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Muting SoilHandler.');
            window.soilHandlerInstance.setExternallyMuted(true);
        }

        if (this.isPlaying) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Stopping generative audio forcefully.');
            this.stopAudio(true);
        }
        if (this.lightSoilSynth) this.lightSoilSynth.volume.value = -Infinity; // Use lightSoilSynth


        this.updateUI();

        await new Promise(resolve => setTimeout(resolve, 200));

        if (!this.isRecordMode) {
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited during pre-recording wait. Restoring other handlers if needed.');
            // Unmuting will be handled by exitRecordMode -> updateCombinedState if it was called
            // Or if not, updateCombinedState should be called to restore.
            // For safety, if we bailed early, ensure updateCombinedState runs.
            this.updateCombinedState();
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();

            if (!this.isRecordMode) {
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited after mic permission.');
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                this.updateCombinedState(); // Ensure correct mute states for others
                return;
            }

            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log(`🌿💡 LS enterRecordMode: Recording started for ${this.recordingDuration / 1000}s...`);

            setTimeout(async () => {
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): No longer in active recording or record mode. Cleaning up.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder?.state === "started") { try { await this.recorder.stop(); } catch (e) { /*ignore*/ } }
                    if (this.isRecordMode) this.exitRecordMode(true); // This will call updateCombinedState
                    else this.updateCombinedState(); // Ensure correct mute states if already exited
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) {
                    if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    this.updateCombinedState(); // Ensure correct mute states
                    return;
                }
                this._setupRhythmicPlayback(audioBlob);

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ LS enterRecordMode: Error: ${err.message}`, err);
            alert(`Could not start recording for LightSoil: ${err.message}. Ensure microphone permission is granted.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true);
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.lightSoilSynth) { // Check lightSoilSynth
            if (this.debugMode) console.warn(`🌿💡 LS _setupRhythmicPlayback: Blocked. isRec=${this.isRecordMode}, toneInit=${this.toneInitialized}, lightSoilSynth=${!!this.lightSoilSynth}. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Starting using lightSoilSynth (FMSynth)...');

        if (this.lightSoilSynth.volume) { // Use lightSoilSynth
            this.lightSoilSynth.volume.value = this.rhythmicPlaybackVolume;
            if (this.debugMode) console.log(`🌿💡 LS _setupRhythmicPlayback: lightSoilSynth (FMSynth) volume set to ${this.rhythmicPlaybackVolume}.`);
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl);
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0;
        const rhythmicNotes = ["C2", "D#2", "G2", "A#2", "C3"];

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode || !this.recordedBufferPlayer || this.isExternallyMuted) {
                    if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Record mode exited, player became null, or externally muted. Aborting playback setup.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    if (this.lightSoilSynth?.volume?.value === this.rhythmicPlaybackVolume) { // Check lightSoilSynth
                        this.lightSoilSynth.volume.value = -Infinity; // Silence lightSoilSynth
                    }
                    return;
                }

                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination();
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Recorded audio Player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.lightSoilSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') { // Check lightSoilSynth
                        return;
                    }
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                        const velocity = 0.2 + (Math.min(20, Math.max(0, level - this.rhythmThreshold)) * 0.025);

                        if (this.debugMode) {
                            const currentSynthVolume = this.lightSoilSynth.volume.value; // lightSoilSynth volume
                            console.log(`🌿💡 LS Rhythmic trigger (FM): Lvl: ${level.toFixed(2)}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}, Vol: ${currentSynthVolume.toFixed(1)}`);
                        }
                        this.lightSoilSynth.triggerAttackRelease(noteToPlay, "8n", time, Math.min(0.8, velocity)); // Play lightSoilSynth
                        this.triggerCreatureAnimation();
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
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Called but not in record mode and not forced. Current isRecordMode: ${this.isRecordMode}`);
            return;
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`);

        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;

        if (this.mic?.state === "started") this.mic.close(); this.mic = null;
        if (this.recorder) {
            if (this.recorder.state === "started") try { this.recorder.stop(); } catch (e) { /* ignore */ }
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

        if (this.lightSoilSynth?.volume) { // Use lightSoilSynth
            this.lightSoilSynth.volume.value = -Infinity;
        }

        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        if (wasRecordMode || force) {
            this.updateCombinedState();
        } else {
            this.updateUI();
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        if (window.creatune && window.Tone && typeof window.lightHandlerInstance !== 'undefined' && typeof window.soilHandlerInstance !== 'undefined') {
            if (!window.lightSoilHandlerInstance) {
                window.lightSoilHandlerInstance = new LightSoilHandler();
                if (window.lightSoilHandlerInstance.debugMode) console.log('🌿💡 LightSoil Handler instance created.');
            }
        } else {
            const tempDebugMode = true;
            if (tempDebugMode) console.log(`🌿💡 Waiting for LightSoilHandler dependencies (DOMContentLoaded)... Creatune: ${!!window.creatune}, Tone: ${!!window.Tone}, LightH: ${typeof window.lightHandlerInstance}, SoilH: ${typeof window.soilHandlerInstance}`);
            setTimeout(initLightSoilHandler, 200);
        }
    };
    initLightSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightSoilHandler;
}