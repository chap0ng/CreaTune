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

        this.isCombinedActive = false; 
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.isPlaying = false; // For generative audio
        this.isFadingOut = false;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false; 

        // --- Tone.js components for "Very Bright Ambient Pad" ---
        this.ambientPadSynth = null;
        this.padChorus = null;
        this.padReverb = null;
        this.padLoop = null;
        this.fadeDuration = 2.0; 
        this.basePadVolume = 6; 
        // --- End Tone.js components ---

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
        this.rhythmicPlaybackVolume = 9; 

        // --- Note Display ---
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;
        // --- End Note Display ---

        // --- DOM Elements ---
        this.lightSoilCreatureVisual = document.querySelector('.lightsoil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode'); 
        // --- End DOM Elements ---

        if (!this.lightSoilCreatureVisual && this.debugMode) console.warn('🌿💡 .lightsoil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌿💡 .framebackground element not found for LightSoilHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌿💡 #stoprecordmode button not found for LightSoilHandler.');


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
        if (!this.toneInitialized && this.isCombinedActive && !this.isRecordMode) { // Don't init if in record mode
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
            } else if (this.isCombinedActive && this.isPlaying && !this.isRecordMode) { 
                this.updateSoundParameters();
                this.updateUI(); 
            } else {
                 this.updateUI(); 
            }
        };

        window.creatune.on('connected', (deviceType) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'connected' for ${deviceType}`);
            handleDeviceUpdate(deviceType, { connected: true, active: (deviceType === 'light' ? this.lightActive : this.soilActive) }); 
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'disconnected' for ${deviceType}`);
            handleDeviceUpdate(deviceType, { connected: false, active: false });
            if (this.isRecordMode) this.exitRecordMode(true); 
        });
        window.creatune.on('stateChange', (deviceType, state) => { 
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Received 'stateChange' for ${deviceType}`, state);
            handleDeviceUpdate(deviceType, { connected: true, active: state.active, rawData: state.rawData });
        });
        window.creatune.on('data', (deviceType, data) => { 
            this.updateInternalDeviceData(deviceType, data);
            if (this.isCombinedActive && this.isPlaying && !this.isRecordMode) {
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
            if (this.isRecordMode) this.exitRecordMode(true); 
            else this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                if (this.isCombinedActive && 
                    !this.isRecordMode &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    (!window.lightHandlerInstance || !window.lightHandlerInstance.isRecordMode) &&
                    (!window.soilHandlerInstance || !window.soilHandlerInstance.isRecordMode)
                ) {
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`🌿💡 Record mode NOT entered for LightSoil. Conditions: isCombinedActive=${this.isCombinedActive}, isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRec=${window.lightHandlerInstance?.isRecordMode}, soilRec=${window.soilHandlerInstance?.isRecordMode}`);
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

            if (!this.isRecordMode) { // Only mute/unmute if LightSoil is NOT in record mode
                if (window.lightHandlerInstance && typeof window.lightHandlerInstance.setExternallyMuted === 'function') {
                    if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Setting LightHandler externallyMuted to ${this.isCombinedActive}`);
                    window.lightHandlerInstance.setExternallyMuted(this.isCombinedActive);
                }
                if (window.soilHandlerInstance && typeof window.soilHandlerInstance.setExternallyMuted === 'function') {
                    if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Setting SoilHandler externallyMuted to ${this.isCombinedActive}`);
                    window.soilHandlerInstance.setExternallyMuted(this.isCombinedActive);
                }
            }
            this.manageAudioAndVisuals();
        } else if (this.isCombinedActive) { 
            if (this.isPlaying && !this.isRecordMode) { 
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state unchanged but active & playing. Updating sound params.`);
                 this.updateSoundParameters();
            } else if (!this.isRecordMode) { 
                 if (this.debugMode) console.log(`🌿💡 LightSoilHandler: Combined state active, but not playing. Calling manageAudioAndVisuals.`);
                 this.manageAudioAndVisuals(); 
            }
            this.updateUI(); 
        } else { 
            if (this.debugMode && oldCombinedActiveState) { 
                console.log(`🌿💡 LightSoilHandler: Combined state remains not active. Updating UI.`);
            }
            if (oldCombinedActiveState && !newCombinedActiveState && !this.isRecordMode) { 
                if (window.lightHandlerInstance && typeof window.lightHandlerInstance.setExternallyMuted === 'function') {
                    window.lightHandlerInstance.setExternallyMuted(false);
                }
                if (window.soilHandlerInstance && typeof window.soilHandlerInstance.setExternallyMuted === 'function') {
                    window.soilHandlerInstance.setExternallyMuted(false);
                }
            }
            this.updateUI();
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

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) {
            return;
        }
        if (this.lightSoilCreatureVisual && this.lightSoilCreatureVisual.classList.contains('active')) {
            if (this.debugMode) console.log('🌿💡 LightSoil: Triggering creature animation (placeholder).');
        }
    }

    initTone() {
        if (this.toneInitialized) {
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
                oscillator: { type: "sine", count: 3, spread: 40 },
                envelope: { attack: 0.05, decay: 0.5, sustain: 0.8, release: 1.0 }, 
                volume: -Infinity
            }).connect(this.padChorus);

            const padChords = [
                ["C4", "E4", "G4", "B4"], ["F4", "A4", "C5", "E5"],
                ["G4", "B4", "D5", "F#5"],["A3", "C#4", "E4", "G#4"]
            ];
            let chordIndex = 0;
            this.padLoop = new Tone.Loop(time => {
                if (!this.isPlaying || this.isRecordMode || !this.ambientPadSynth) return; 
                const chord = padChords[chordIndex % padChords.length];
                const velocity = (this.currentLightAppValue + this.currentSoilAppValue) / 2 * 0.3 + 0.4;
                this.ambientPadSynth.triggerAttackRelease(chord, "4m", time, velocity);
                chordIndex++;
            }, "4m"); 
            this.padLoop.humanize = "16n";
            if (this.padLoop.state === "started") this.padLoop.stop(0); 

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.initTone: "Very Bright Ambient Pad" Tone.js components initialized.');
            this.manageAudioAndVisuals(); 

        } catch (error) {
            console.error('❌ LightSoilHandler.initTone: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if(this.ambientPadSynth) { this.ambientPadSynth.dispose(); this.ambientPadSynth = null; }
            if(this.padChorus) { this.padChorus.dispose(); this.padChorus = null; }
            if(this.padReverb) { this.padReverb.dispose(); this.padReverb = null; }
            if(this.padLoop) { this.padLoop.dispose(); this.padLoop = null; }
        }
    }

    updateSoundParameters() { 
        if (!this.toneInitialized || !this.audioEnabled || !this.isCombinedActive || this.isRecordMode || !this.isPlaying) return;
        
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
    isCombinedActive=${this.isCombinedActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isPlayingGen=${this.isPlaying}, isFadingOut=${this.isFadingOut}, isRecordMode=${this.isRecordMode}`, 'color: #2ecc71');

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true; 

        if (!this.audioEnabled) {
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
            if (this.debugMode) console.log(`🌿💡 LightSoilHandler.manageAudioAndVisuals: AudioContext not running or audio disabled. Audio remains off.`);
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
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, Tone not initialized. Attempting initTone.');
                this.initTone(); 
                if (!this.toneInitialized) { 
                     if (this.debugMode) console.log('🌿💡 LS MAV: initTone failed or deferred. Returning.');
                     this.updateUI(); return;
                }
            }
            
            if (this.toneInitialized && (!this.isPlaying || this.isFadingOut)) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, Tone initialized, should play generative. Calling startAudio.');
                this.startAudio(); 
            } else if (this.toneInitialized && this.isPlaying) {
                if (this.debugMode) console.log('🌿💡 LS MAV: Combined active, Tone initialized, generative already playing. Updating sound params.');
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
        if (this.lightSoilCreatureVisual) {
            this.lightSoilCreatureVisual.classList.toggle('active', this.isCombinedActive && !this.isRecordMode); 
        }
        if (this.frameBackground) {
            if (this.isCombinedActive && !this.isRecordMode) { 
                this.frameBackground.classList.add('lightsoil-active-bg');
                this.frameBackground.classList.remove('light-active-bg', 'soil-active-bg', 'record-mode-pulsing');
                this.frameBackground.classList.remove('light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');

            } else if (!this.isRecordMode) { 
                this.frameBackground.classList.remove('lightsoil-active-bg');
            }

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.remove('lightsoil-active-bg'); 
            } else if (!window.lightHandlerInstance?.isRecordMode && !window.soilHandlerInstance?.isRecordMode) {
                this.frameBackground.classList.remove('record-mode-pulsing');
            }
        }
        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance && window.lightHandlerInstance.isRecordMode;
            const soilInRec = window.soilHandlerInstance && window.soilHandlerInstance.isRecordMode;
            if (this.isRecordMode) { 
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec) { 
                this.stopRecordModeButton.style.display = 'none';
            }
        }
    }

    startAudio() { 
        if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler.startAudio (Generative):
    audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, isRecordMode=${this.isRecordMode}`, 'color: #9b59b6; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.isCombinedActive || this.isRecordMode) { 
            if (this.debugMode) console.warn("🌿💡 LightSoilHandler.startAudio (Generative): Conditions not met. Returning.");
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
         if (this.debugMode) console.log(`%c🌿💡 LightSoilHandler.stopAudio (Generative):
    force=${force}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿💡 LightSoilHandler.stopAudio (Generative): Audio system not ready.");
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

        if (this.ambientPadSynth && this.ambientPadSynth.volume) { 
            this.ambientPadSynth.volume.cancelScheduledValues(Tone.now());
            this.ambientPadSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            if (this.padLoop && this.padLoop.state === "started") this.padLoop.stop(0);
            if (this.ambientPadSynth && this.ambientPadSynth.volume) this.ambientPadSynth.volume.value = -Infinity; 

            this.isFadingOut = false;
            if (this.debugMode) console.log('🌿💡 LightSoilHandler.stopAudio: "Very Bright Ambient Pad" audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (this.fadeDuration * 1000 + 100)); 
        
        if(force) this.updateUI();
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isCombinedActive) {
            if(this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isCombinedActive=${this.isCombinedActive}`);
            return;
        }
        if ((window.lightHandlerInstance && window.lightHandlerInstance.isRecordMode) || (window.soilHandlerInstance && window.soilHandlerInstance.isRecordMode)) {
            if(this.debugMode) console.warn(`🌿💡 LS enterRecordMode: Blocked. Another creature is already in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ LS enterRecordMode: getUserMedia API not available.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Starting...');
        this.isRecordMode = true;
        
        if (this.isPlaying) { 
            if (this.debugMode) console.log('🌿💡 LS enterRecordMode: Stopping generative audio forcefully.');
            this.stopAudio(true); 
        }
        if (window.lightHandlerInstance) window.lightHandlerInstance.setExternallyMuted(false);
        if (window.soilHandlerInstance) window.soilHandlerInstance.setExternallyMuted(false);

        this.updateUI(); 

        await new Promise(resolve => setTimeout(resolve, 200)); 

        if (!this.isRecordMode) { 
            if(this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited during pre-recording wait. Not proceeding.');
            return; 
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open(); 
            
            if (!this.isRecordMode) { 
                if(this.debugMode) console.log('🌿💡 LS enterRecordMode: Exited after mic permission.');
                if (this.mic.state === "started") this.mic.close(); 
                this.mic = null;
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
                    if(this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): No longer in active recording or record mode.');
                    if (this.mic && this.mic.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder && this.recorder.state === "started") { try { await this.recorder.stop(); } catch(e) {/*ignore*/} }
                    if (this.isRecordMode) this.exitRecordMode(true); 
                    return;
                }
                
                const audioBlob = await this.recorder.stop();
                if (this.mic && this.mic.state === "started") this.mic.close(); this.mic = null; 
                if (this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { 
                     if(this.debugMode) console.log('🌿💡 LS enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                     return; 
                }
                this._setupRhythmicPlayback(audioBlob); 

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ LS enterRecordMode: Error: ${err.message}`, err);
            alert(`Could not start recording for LightSoil: ${err.message}.`);
            this.isCurrentlyRecording = false; 
            this.exitRecordMode(true); 
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.ambientPadSynth) { 
            if(this.debugMode) console.warn(`🌿💡 LS _setupRhythmicPlayback: Blocked. isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, ambientPadSynth=${!!this.ambientPadSynth}. Forcing exit.`);
            this.exitRecordMode(true); 
            return;
        }
        if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback: Starting using ambientPadSynth...');
        
        if (this.ambientPadSynth && this.ambientPadSynth.volume) {
            this.ambientPadSynth.releaseAll(); 
            this.ambientPadSynth.volume.value = this.rhythmicPlaybackVolume; 
            if (this.debugMode) console.log(`🌿💡 LS _setupRhythmicPlayback: ambientPadSynth volume set to ${this.rhythmicPlaybackVolume}.`);
        } else if (this.debugMode) {
            console.warn(`🌿💡 LS _setupRhythmicPlayback: ambientPadSynth or volume not available.`);
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); 
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
        
        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 }); 
        this.lastRhythmNoteTime = 0; 
        const rhythmicNotes = ["C3", "D3", "E3", "G3", "A3", "C4"]; 

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode) { 
                    if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Record mode exited. Aborting.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    if(this.ambientPadSynth && this.ambientPadSynth.volume && this.ambientPadSynth.volume.value === this.rhythmicPlaybackVolume) {
                        this.ambientPadSynth.volume.value = -Infinity; 
                    }
                    return;
                }
                if (!this.recordedBufferPlayer) { 
                     if (this.debugMode) console.warn('🌿💡 LS _setupRhythmicPlayback (onload): player became null. Aborting.'); return;
                }

                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower); 
                this.recordedBufferPlayer.toDestination(); 
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.ambientPadSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                        return;
                    }
                    const level = this.rhythmFollower.getValue(); 
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                        const velocity = 0.4 + (Math.min(15, Math.max(0, level - this.rhythmThreshold)) * 0.03); 
                        
                        if (this.debugMode) {
                            const currentSynthVolume = this.ambientPadSynth.volume.value;
                            console.log(`🌿💡 LS Rhythmic trigger: Lvl: ${level.toFixed(2)}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}, Vol: ${currentSynthVolume.toFixed(1)}`);
                        }
                        this.ambientPadSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.min(0.9, velocity)); 
                        this.triggerCreatureAnimation(); 
                        this._displayNote(noteToPlay); 
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0); 
                if (this.debugMode) console.log('🌿💡 LS _setupRhythmicPlayback (onload): Rhythmic loop initiated.');
            },
            onerror: (err) => {
                console.error('❌ LS _setupRhythmicPlayback: Error loading player:', err);
                this.exitRecordMode(true); 
            }
        });
        if (Tone.Transport.state !== "started") Tone.Transport.start();
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) return;
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Starting. Forced: ${force}. Was: ${this.isRecordMode}`);
        
        const wasRecordMode = this.isRecordMode; 
        this.isRecordMode = false;
        this.isCurrentlyRecording = false; 

        if (this.mic && this.mic.state === "started") this.mic.close(); this.mic = null;
        if (this.recorder) {
            if (this.recorder.state === "started") try { this.recorder.stop(); } catch(e) { /* ignore */ }
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
        
        if (this.ambientPadSynth && this.ambientPadSynth.volume) {
            this.ambientPadSynth.volume.value = -Infinity;
        }
        
        if (this.noteDisplayTimeoutId) { 
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }
        
        this.updateUI(); 
        
        if (wasRecordMode || force) {
            this.updateCombinedState(); 
        }
        if (this.debugMode) console.log(`🌿💡 LS exitRecordMode: Finished. isRecordMode=${this.isRecordMode}`);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.lightSoilHandlerInstance) {
                window.lightSoilHandlerInstance = new LightSoilHandler();
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