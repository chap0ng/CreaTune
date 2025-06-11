class SoilHandler {
    constructor() {
        // Synths and Loops - Toypiano Style
        this.toyPianoSynth = null;
        this.bellSynth = null;
        this.toyPianoPattern = null;
        this.bellPattern = null;
        this.mainVolume = null; // Add for overall control

        // Audio Params
        this.fadeDuration = 1.7;
        this.baseToyPianoVolume = 6; // Example
        this.baseBellVolume = 3; // Example
        this.rhythmicPlaybackVolume = 4; // Volume for recorded playback

        // State
        this.isActive = false; 
        this.isPlaying = false; // True when GENERATIVE audio is playing
        this.isFadingOut = false;
        this.audioEnabled = false; 
        this.toneInitialized = false; 
        this.debugMode = true; // Keep this
        this.stopTimeoutId = null;
        this.isExternallyMuted = false; 

        this.currentSoilCondition = "dry"; 
        this.currentSoilAppValue = 0.0;    
        this.deviceStates = { 
            soil: { connected: false } 
        };

        // Sprite Animation State
        this.soilCreatureCurrentFrame = 0;
        this.soilCreatureTotalFrames = 6;

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        // Record Mode Properties
        this.isRecordMode = false; 
        this.isCurrentlyRecording = false; 
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null; 
        this.rhythmFollower = null;     
        this.rhythmicLoop = null; // For rhythmic playback from recording      
        this.recordingDuration = 5000;  
        this.rhythmThreshold = -33; // dB, for record mode
        this.rhythmNoteCooldown = 160; // ms, for record mode
        this.lastRhythmNoteTime = 0; // For record mode rhythmic response
        this.recordedAudioBlobUrl = null; 

        // Note Display
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        if (!this.soilCreatureVisual && this.debugMode) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💧 .framebackground element not found for SoilHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('💧 #stoprecordmode button not found.');

        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) { 
        if (this.debugMode) console.log(`💧 SoilHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return; 

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`💧 SoilHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) {
                if (this.debugMode) console.log(`💧 SoilHandler: Externally muted, forcing exit from record mode.`);
                this.exitRecordMode(true); 
            } else if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`💧 SoilHandler: Externally muted, stopping generative audio.`);
                this.stopAudio(true); 
            }
        }
        this.manageAudioAndVisuals();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('💧 SoilHandler: Core Dependencies ready.');
                this.setupListeners();
                this.updateUI(); 
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('💧 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('💧 SoilHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode) { 
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) {
            if (this.debugMode) console.log('💧 SoilHandler initTone: Already initialized.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler initTone: Initializing Tone.js components...');

        this.mainVolume?.dispose();
        this.toyPianoSynth?.dispose();
        this.bellSynth?.dispose();
        this.toyPianoPattern?.dispose();
        this.bellPattern?.dispose();

        this.mainVolume = new Tone.Volume(this.baseToyPianoVolume).toDestination(); // ToyPiano is main sound

        this.toyPianoSynth = new Tone.Synth({
            oscillator: { type: 'square' },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.5 },
            portamento: 0.01
        }).connect(this.mainVolume);

        this.bellSynth = new Tone.MetalSynth({
            frequency: 400,
            envelope: { attack: 0.001, decay: 0.4, release: 0.2 },
            harmonicity: 4.1,
            modulationIndex: 20,
            resonance: 4000,
            octaves: 1.2
        }).connect(this.mainVolume);
        this.bellSynth.volume.value = this.baseBellVolume;


        this.createToyPianoPattern();
        this.createBellPattern();

        this.toneInitialized = true;
        if (this.debugMode) console.log('💧 SoilHandler initTone: Tone.js components initialized.');
        this.manageAudioAndVisuals();
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) return;
        if (this.soilCreatureVisual && this.soilCreatureVisual.classList.contains('active')) {
            this.soilCreatureCurrentFrame = (this.soilCreatureCurrentFrame + 1) % this.soilCreatureTotalFrames;
            this.soilCreatureVisual.style.backgroundPositionX = (this.soilCreatureCurrentFrame * 20) + '%';
            if (this.debugMode && Math.random() < 0.01) { // Log only 1%
                console.log(`💧 Soil Creature Animation: Frame ${this.soilCreatureCurrentFrame}`);
            }
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
                if (noteDisplayElement.textContent === this.lastDisplayedNote) { // Only clear if it's still the same note
                    noteDisplayElement.textContent = '-';
                }
            }, 750); // Display note for 750ms
        }
    }

    createToyPianoPattern() {
        if (this.toyPianoPattern) { this.toyPianoPattern.dispose(); this.toyPianoPattern = null; }
        const notes = ["C4", "D4", "E4", "G4", "A4"];
        this.toyPianoPattern = new Tone.Pattern( (time, note) => {
            if (!this.isPlaying || this.isRecordMode || !this.toyPianoSynth || this.isExternallyMuted) return;
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, Math.random() * 0.2 + 0.1);
            this._displayNote(note);
            this.triggerCreatureAnimation();
        }, notes, "randomWalk").set({ interval: "4n", probability: 0.75 });
    }

    createBellPattern() {
        if (this.bellPattern) { this.bellPattern.dispose(); this.bellPattern = null; }
        this.bellPattern = new Tone.Loop(time => {
            if (!this.isPlaying || this.isRecordMode || !this.bellSynth || this.isExternallyMuted) return;
            this.bellSynth.triggerAttackRelease("16n", time, Math.random() * 0.15 + 0.05);
            // No _displayNote for bells to avoid spam
            this.triggerCreatureAnimation();
        }, "0:1:2").set({ probability: 0.4, humanize: true });
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 SoilHandler: window.creatune not available.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                const oldActive = this.isActive;
                const oldConnected = this.deviceStates.soil.connected;
                this.isActive = state.active;
                this.currentSoilCondition = state.rawData.soil_condition || "dry";
                this.currentSoilAppValue = state.rawData.moisture_app_value !== undefined ? state.rawData.moisture_app_value : 0.0;
                this.deviceStates.soil.connected = true;

                if (this.debugMode) console.log(`💧 SoilHandler stateChange: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.soil.connected} (was ${oldConnected}), condition=${this.currentSoilCondition}, appValue=${this.currentSoilAppValue.toFixed(2)}`);
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                let changed = false;
                if (data.soil_condition && this.currentSoilCondition !== data.soil_condition) {
                    this.currentSoilCondition = data.soil_condition;
                    changed = true;
                }
                if (data.moisture_app_value !== undefined && this.currentSoilAppValue !== data.moisture_app_value) {
                    this.currentSoilAppValue = data.moisture_app_value;
                    changed = true;
                }
                this.deviceStates.soil.connected = true;

                if (changed && !this.isRecordMode && this.isPlaying) {
                    this.updateSoundParameters();
                }
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler: Soil device connected event.`);
                this.deviceStates.soil.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler: Soil device disconnected event.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false;
                if (this.isRecordMode) {
                    this.exitRecordMode(true);
                } else {
                    this.manageAudioAndVisuals();
                }
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            else this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                if (this.deviceStates.soil.connected &&
                    !this.isRecordMode && this.isActive && this.audioEnabled && this.toneInitialized &&
                    (!window.lightHandlerInstance || !window.lightHandlerInstance.isRecordMode) &&
                    (!window.temperatureHandlerInstance || !window.temperatureHandlerInstance.isRecordMode) &&
                    (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode) &&
                    (!window.tempSoilHandlerInstance || !window.tempSoilHandlerInstance.isRecordMode) &&
                    (!window.tempLightHandlerInstance || !window.tempLightHandlerInstance.isRecordMode)
                ) {
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    // Reduced log spam
                }
            });
        }
         if (this.stopRecordModeButton) {
            this.stopRecordModeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                if (this.isRecordMode) {
                    if (this.debugMode) console.log('💧 Stop Record Mode button clicked for SoilHandler.');
                    this.exitRecordMode();
                }
            });
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            // if (this.debugMode) console.log(`💧 updateSoundParameters: Bailed.`); // Reduced spam
            return;
        }
        const RAMP_TOLERANCE = 0.01;
        const isSensorActive = this.isActive && this.deviceStates.soil.connected;

        if (this.mainVolume) {
            const targetMainVol = isSensorActive ? (this.baseToyPianoVolume + this.currentSoilAppValue * 8 - 4) : -Infinity;
            if (Math.abs(this.mainVolume.volume.value - targetMainVol) > RAMP_TOLERANCE || (targetMainVol === -Infinity && this.mainVolume.volume.value > -80)) {
                this.mainVolume.volume.linearRampTo(targetMainVol, 0.5);
            }
        }

        if (this.bellSynth && this.bellSynth.volume) {
            const targetBellVol = isSensorActive ? (this.baseBellVolume + this.currentSoilAppValue * 6 - 3) : -Infinity;
            if (Math.abs(this.bellSynth.volume.value - targetBellVol) > RAMP_TOLERANCE || (targetBellVol === -Infinity && this.bellSynth.volume.value > -80)) {
                this.bellSynth.volume.linearRampTo(targetBellVol, 0.6);
            }
        }

        if (this.toyPianoPattern) this.toyPianoPattern.probability = isSensorActive ? (0.4 + this.currentSoilAppValue * 0.5) : 0;
        if (this.bellPattern) this.bellPattern.probability = isSensorActive ? (0.2 + this.currentSoilAppValue * 0.4) : 0;

        if (this.toyPianoSynth && isSensorActive) {
            if (this.currentSoilCondition === "dry") { this.toyPianoSynth.portamento = 0.05; this.toyPianoSynth.envelope.release = 0.3; }
            else if (this.currentSoilCondition === "humid") { this.toyPianoSynth.portamento = 0.02; this.toyPianoSynth.envelope.release = 0.5; }
            else { this.toyPianoSynth.portamento = 0.01; this.toyPianoSynth.envelope.release = 0.7; } // wet
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💧 MAV Start: RecordMode=${this.isRecordMode}, IsPlayingGen=${this.isPlaying}, ExtMuted=${this.isExternallyMuted}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.soil.connected}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);
        if (Tone.context.state !== 'running') this.audioEnabled = false;

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`💧 MAV: Externally muted or audio not enabled. Stopping all audio.`);
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI(); return;
        }
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`💧 MAV: In record mode, stopping generative audio.`);
                this.stopAudio(true);
            }
            this.updateUI(); return;
        }

        const shouldPlayGenerativeAudio = this.isActive && this.deviceStates.soil.connected && !this.isExternallyMuted && this.audioEnabled && this.toneInitialized;
        if (shouldPlayGenerativeAudio) {
            if (!this.toneInitialized) {
                this.initTone();
                if (!this.toneInitialized && this.debugMode) console.log('💧 MAV: initTone called, but still not initialized.');
                this.updateUI(); return;
            }
            if (!this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log(`💧 MAV: Conditions met, calling startAudio (generative).`);
                this.startAudio();
            } else if (this.isPlaying) {
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log(`💧 MAV: Conditions NOT met for generative audio, calling stopAudio.`);
                this.stopAudio();
            }
        }
        this.updateUI();
        if (this.debugMode) console.log(`💧 MAV End. IsPlayingGen=${this.isPlaying}`);
    }

    updateUI() {
        const showCreature = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted;
        if (this.soilCreatureVisual) {
            const wasCreatureActive = this.soilCreatureVisual.classList.contains('active');
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (showCreature) {
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}`);
            } else if (wasCreatureActive && !this.soilCreatureVisual.classList.contains('active')) {
                this.soilCreatureCurrentFrame = 0;
                this.soilCreatureVisual.style.backgroundPositionX = '0%';
            }
        }
        if (this.frameBackground) {
            const isConnected = this.deviceStates.soil.connected;
            const soilActiveBgClass = 'soil-active-bg';
            const otherHandlersBgClasses = ['light-active-bg', 'temp-active-bg', 'lightsoil-active-bg', 'tempsoil-active-bg', 'templight-active-bg', 'idle-bg'];
            const soilConditionBgClass = isConnected ? `soil-${this.currentSoilCondition.replace('_', '-')}-bg` : '';
            const allSoilConditionBgs = ['soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg'];

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                if (soilConditionBgClass) this.frameBackground.classList.add(soilConditionBgClass); else this.frameBackground.classList.add(soilActiveBgClass);
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                allSoilConditionBgs.forEach(cls => this.frameBackground.classList.remove(cls));
                this.frameBackground.classList.remove(soilActiveBgClass);
                if (isConnected) {
                    if (soilConditionBgClass) this.frameBackground.classList.add(soilConditionBgClass);
                    else this.frameBackground.classList.add(soilActiveBgClass);
                    if (!this.isExternallyMuted) {
                        otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                    }
                }
            }
        }
        if (this.stopRecordModeButton) {
            const lightInRecMode = window.lightHandlerInstance?.isRecordMode;
            const tempInRecMode = window.temperatureHandlerInstance?.isRecordMode;
            const lightSoilInRecMode = window.lightSoilHandlerInstance?.isRecordMode;
            const tempSoilInRecMode = window.tempSoilHandlerInstance?.isRecordMode;
            const tempLightInRecMode = window.tempLightHandlerInstance?.isRecordMode;
            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRecMode && !tempInRecMode && !lightSoilInRecMode && !tempSoilInRecMode && !tempLightInRecMode) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.02) console.log(`💧 UI Update (Soil): CreatureActive=${showCreature}, DeviceConnected=${this.deviceStates.soil.connected}, RecModeSoil=${this.isRecordMode}, ExtMuteSoil=${this.isExternallyMuted}, FrameBG Classes: ${this.frameBackground?.classList?.toString()}`);
    }

    async enterRecordMode() {
        // ... (similar checks as LightHandler.enterRecordMode)
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isActive) {
            if(this.debugMode) console.warn(`💧 enterRecordMode: Blocked. Conditions not met.`); return;
        }
        if (window.lightHandlerInstance?.isRecordMode || window.temperatureHandlerInstance?.isRecordMode || window.lightSoilHandlerInstance?.isRecordMode || window.tempSoilHandlerInstance?.isRecordMode || window.tempLightHandlerInstance?.isRecordMode) {
            if(this.debugMode) console.warn(`💧 enterRecordMode: Blocked. Another creature is recording.`); return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ enterRecordMode: getUserMedia not available.'); alert('Mic access not available.'); return;
        }

        if (this.debugMode) console.log('💧 enterRecordMode: Starting...');
        this.isRecordMode = true;

        if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(true, 'SoilHandler-Record');
        if (window.temperatureHandlerInstance?.setExternallyMuted) window.temperatureHandlerInstance.setExternallyMuted(true, 'SoilHandler-Record');
        if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(true, 'SoilHandler-Record');
        if (window.tempSoilHandlerInstance?.setExternallyMuted) window.tempSoilHandlerInstance.setExternallyMuted(true, 'SoilHandler-Record');
        if (window.tempLightHandlerInstance?.setExternallyMuted) window.tempLightHandlerInstance.setExternallyMuted(true, 'SoilHandler-Record');

        if (this.isPlaying || this.isFadingOut) {
            if (this.debugMode) console.log('💧 enterRecordMode: Stopping generative audio forcefully.');
            this.stopAudio(true);
        }
        if (this.mainVolume) this.mainVolume.volume.value = -Infinity;

        this.updateUI();
        await new Promise(resolve => setTimeout(resolve, 250));

        if (!this.isRecordMode) {
            if(this.debugMode) console.log('💧 enterRecordMode: Exited during pre-recording wait.');
            this._unmuteOtherHandlersForRecordModeExit();
            this.manageAudioAndVisuals(); return;
        }

        try {
            this.mic = new Tone.UserMedia(); await this.mic.open();
            if (!this.isRecordMode) {
                if (this.debugMode) console.log('💧 enterRecordMode: Exited after mic permission.');
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                this._unmuteOtherHandlersForRecordModeExit(); this.manageAudioAndVisuals(); return;
            }
            if (this.debugMode) console.log('💧 enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true; this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder); this.recorder.start();
            if (this.debugMode) console.log('💧 enterRecordMode: Recording started.'); this.updateUI();

            setTimeout(async () => {
                if (this.debugMode) console.log('💧 enterRecordMode (timeout): Recording duration elapsed.');
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.debugMode) console.log('💧 enterRecordMode (timeout): Recorder gone or no longer in record mode.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    await this.recorder?.stop().catch(e => console.warn("Soil Recorder stop error:", e));
                    this.recorder?.dispose(); this.recorder = null;
                    if (this.isRecordMode) this.exitRecordMode(true);
                    else { this._unmuteOtherHandlersForRecordModeExit(); this.manageAudioAndVisuals(); }
                    return;
                }
                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (this.debugMode) console.log('💧 enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);
                if (!this.isRecordMode) {
                    if (this.debugMode) console.log('💧 enterRecordMode (timeout): Exited during recording.');
                    this._unmuteOtherHandlersForRecordModeExit(); this.manageAudioAndVisuals(); return;
                }
                this._setupRhythmicPlayback(audioBlob); this.updateUI();
            }, this.recordingDuration);
        } catch (err) {
            console.error(`❌ enterRecordMode: Error: ${err.message}`, err);
            alert(`Could not start Soil recording: ${err.message}.`);
            this.isCurrentlyRecording = false; this.exitRecordMode(true);
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Starting with blob size:', audioBlob.size);
        if (!this.isRecordMode || !this.toneInitialized || !this.toyPianoSynth) { // Use toyPianoSynth for response
            if (this.debugMode) console.warn(`💧 _setupRhythmicPlayback: Conditions not met. Forcing exit.`);
            this.exitRecordMode(true); return;
        }
        try {
            this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
            this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
            if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
            this.rhythmFollower?.dispose(); this.rhythmFollower = null;

            if (this.toyPianoSynth.volume.value !== this.rhythmicPlaybackVolume) { // Assuming toyPianoSynth has its own volume node
                 // If toyPianoSynth is connected to mainVolume, adjust mainVolume instead or give toyPianoSynth a dedicated volume node.
                 // For simplicity, let's assume toyPianoSynth has a direct volume property or is the primary sound.
                 // If using mainVolume for this:
                 // if (this.mainVolume.volume.value !== this.rhythmicPlaybackVolume) {
                 //    this.mainVolume.volume.cancelScheduledValues(Tone.now());
                 //    this.mainVolume.volume.rampTo(this.rhythmicPlaybackVolume, 0.1);
                 // }
                 // For now, directly setting toyPianoSynth volume if it's not part of mainVolume for this.
                 this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
                 this.toyPianoSynth.volume.rampTo(this.rhythmicPlaybackVolume, 0.1);
            }

            this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
            this.recordedBufferPlayer = new Tone.Player({
                url: this.recordedAudioBlobUrl, loop: false,
                onload: () => {
                    if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Player loaded.');
                    if (!this.isRecordMode || !this.recordedBufferPlayer) {
                        if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Aborting.');
                        this.recordedBufferPlayer?.dispose(); this.recordedBufferPlayer = null;
                        this.rhythmFollower?.dispose(); this.rhythmFollower = null;
                        this.rhythmicLoop?.dispose(); this.rhythmicLoop = null;
                        this.manageAudioAndVisuals(); return;
                    }
                    this.rhythmFollower = new Tone.Meter({ smoothing: 0.6 });
                    this.recordedBufferPlayer.connect(this.rhythmFollower);
                    this.recordedBufferPlayer.toDestination(); this.recordedBufferPlayer.start();
                    if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Player started.');
                    this.rhythmicLoop = new Tone.Loop(time => {
                        if (!this.isRecordMode || !this.rhythmFollower || !this.toyPianoSynth ||
                            !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') return;
                        const level = this.rhythmFollower.getValue();
                        const currentTime = Tone.now() * 1000;
                        if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                            const noteToPlay = ["C4", "E4", "G4"][Math.floor(Math.random() * 3)];
                            this.toyPianoSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.random() * 0.3 + 0.2);
                            this.lastRhythmNoteTime = currentTime; this._displayNote(noteToPlay);
                            this.triggerCreatureAnimation();
                        }
                    }, "16n").start(0);
                    if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Rhythmic loop initiated.');
                },
                onerror: (err) => { console.error('❌ _setupRhythmicPlayback: Error loading player:', err); this.exitRecordMode(true); }
            });
            if (Tone.Transport.state !== "started") Tone.Transport.start();
        } catch (error) { console.error('❌ _setupRhythmicPlayback: General error:', error); this.exitRecordMode(true); }
    }

    _unmuteOtherHandlersForRecordModeExit() { // Similar to LightHandler
        if (this.debugMode) console.log('💧 _unmuteOtherHandlersForRecordModeExit: Unmuting other handlers.');
        if (window.lightHandlerInstance?.setExternallyMuted) {
            const lsWantsLightMuted = window.lightSoilHandlerInstance?.showLightSoilVisualContext;
            const tlWantsLightMuted = window.tempLightHandlerInstance?.showTempLightVisualContext;
            if (!lsWantsLightMuted && !tlWantsLightMuted) {
                window.lightHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                 console.log(`💧 SoilHandler: NOT unmuting Light as LS wants mute: ${lsWantsLightMuted}, TL wants mute: ${tlWantsLightMuted}`);
            }
        }
        if (window.temperatureHandlerInstance?.setExternallyMuted) {
            const tlWantsTempMuted = window.tempLightHandlerInstance?.showTempLightVisualContext;
            const tsWantsTempMuted = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
            if (!tlWantsTempMuted && !tsWantsTempMuted) {
                window.temperatureHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`💧 SoilHandler: NOT unmuting Temp as TL wants mute: ${tlWantsTempMuted}, TS wants mute: ${tsWantsTempMuted}`);
            }
        }
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`💧 exitRecordMode: Called but not in record mode and not forced.`); return;
        }
        if (this.debugMode) console.log(`%c💧 exitRecordMode: Exiting record mode. Force: ${force}`, 'color: orange; font-weight: bold;');
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false; this.isCurrentlyRecording = false;

        this.mic?.close(); this.mic = null;
        const recorder = this.recorder; this.recorder = null;
        recorder?.stop().then(() => recorder.dispose()).catch(e => recorder?.dispose());
        this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
        this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
        if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        this.rhythmFollower?.dispose(); this.rhythmFollower = null;

        if (this.toyPianoSynth?.volume && this.toyPianoSynth.volume.value === this.rhythmicPlaybackVolume) {
            // Let updateSoundParameters handle generative volume
             if (this.debugMode) console.log('💧 exitRecordMode: toyPianoSynth volume was at rhythmic level.');
        }
        
        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        if (wasRecordMode || force) {
            this._unmuteOtherHandlersForRecordModeExit();
            this.manageAudioAndVisuals();
        } else {
            this.updateUI();
        }
        if (this.debugMode) console.log(`💧 exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }

    startAudio() {
        if (this.debugMode) console.log(`💧 startAudio (generative): Called. isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`);
        if (this.isRecordMode) {
            if (this.debugMode) console.log("💧 startAudio: Blocked, in record mode."); this.updateUI(); return;
        }
        const sensorEffectivelyActive = this.isActive && this.deviceStates.soil.connected;
        if (this.isExternallyMuted || !this.audioEnabled || !this.toneInitialized || !sensorEffectivelyActive ||
            !this.mainVolume || !this.toyPianoSynth || !this.bellSynth || !this.toyPianoPattern || !this.bellPattern) {
            if (this.debugMode) console.warn(`💧 startAudio: Blocked. Conditions not met.`); this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId); this.isFadingOut = false;
            if (this.mainVolume) this.mainVolume.volume.cancelScheduledValues(Tone.now());
        }
        if (this.isPlaying) { this.updateSoundParameters(); this.updateUI(); return; }
        this.isPlaying = true; this.isFadingOut = false;
        this.updateSoundParameters();
        if (Tone.Transport.state !== "started") { Tone.Transport.start(); if (this.debugMode) console.log('💧 startAudio: Tone.Transport started.'); }
        if (this.toyPianoPattern.state !== "started") this.toyPianoPattern.start(0);
        if (this.bellPattern.state !== "started") this.bellPattern.start(0);
        if (this.debugMode) console.log('💧 startAudio (generative): Loops started. isPlaying is true.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c💧 stopAudio (generative): force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`, 'color: #c0392b; font-weight: bold;');
        if (!this.audioEnabled || !this.toneInitialized || !this.mainVolume) {
            if (this.debugMode) console.log('💧 stopAudio: Bailed. Conditions not met.');
            this.isPlaying = false; this.isFadingOut = false; this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { if (this.debugMode) console.log('💧 stopAudio: Bailed. Not playing/fading.'); this.updateUI(); return; }
        if (this.isFadingOut && !force) { if (this.debugMode) console.log('💧 stopAudio: Bailed. Already fading.'); return; }

        this.isPlaying = false;
        const fadeTime = force ? 0.01 : this.fadeDuration;
        if (this.toyPianoPattern && this.toyPianoPattern.state === "started") this.toyPianoPattern.stop(0);
        if (this.bellPattern && this.bellPattern.state === "started") this.bellPattern.stop(0);
        if (this.mainVolume && this.mainVolume.volume) {
            this.mainVolume.volume.cancelScheduledValues(Tone.now());
            this.mainVolume.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        this.isFadingOut = true;
        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            this.isFadingOut = false;
            if (this.mainVolume && this.mainVolume.volume) this.mainVolume.volume.value = -Infinity;
            if (this.debugMode) console.log('💧 stopAudio (generative): Fully stopped.'); this.updateUI();
        }, force ? 10 : (fadeTime * 1000 + 100));
        if (force) this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
                if (window.soilHandlerInstance.debugMode) console.log('💧 Soil Handler instance created.');
            }
        } else {
            const tempDebugMode = (window.soilHandlerInstance && typeof window.soilHandlerInstance.debugMode !== 'undefined') 
                                  ? window.soilHandlerInstance.debugMode : true; 
            if (tempDebugMode) console.log('💧 Waiting for SoilHandler dependencies (DOMContentLoaded)...');
            setTimeout(initSoilHandler, 100);
        }
    };
    initSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}