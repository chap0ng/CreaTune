class SoilHandler {
    constructor() {
        // Synths and Loops - Toypiano Style
        this.toyPianoSynth = null;
        this.bellSynth = null;
        this.toyPianoLoop = null; // For generative audio
        this.bellLoop = null;     // For generative audio

        // Audio Params - Toypiano Style
        this.fadeDuration = 1.5;
        this.baseToyPianoVolume = 9; // User's original/intended dB value
        this.baseBellVolume = 6;     // User's original/intended dB value
        this.rhythmicPlaybackVolume = 9; // Consistent with other rhythmic volumes

        // State
        this.isActive = false;
        this.isPlaying = false; // True when GENERATIVE audio is playing
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
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
        this.showSoilVisualContext = false; // Added for clarity in background logic

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
        this.rhythmicLoop = null;
        this.recordingDuration = 5000;
        this.rhythmThreshold = -30;
        this.rhythmNoteCooldown = 150;
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;

        // Note Display
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;


        if (!this.soilCreatureVisual && this.debugMode) console.warn('🌿 .soil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌿 .framebackground element not found for SoilHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌿 #stoprecordmode button not found for SoilHandler.');


        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) {
        if (this.debugMode) console.log(`🌿 SoilHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return;

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`🌿 SoilHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) {
                if (this.debugMode) console.log(`🌿 SoilHandler: Externally muted, forcing exit from record mode.`);
                this.exitRecordMode(true);
            } else if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('🌿 SoilHandler: Externally muted, stopping generative audio.');
                this.stopAudio(true);
            }
        }
        this.manageAudioAndVisuals();
    }


    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('🌿 SoilHandler: Core Dependencies ready.');
                this.setupListeners();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                } else {
                    this.manageAudioAndVisuals();
                }
            } else {
                if (this.debugMode) console.log('🌿 SoilHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌿 SoilHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode && !this.isExternallyMuted) {
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`🌿 SoilHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('🌿 SoilHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('🌿 SoilHandler: Initializing Tone.js components (ToyPiano style)...');
        try {
            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
            }

            const reverb = new Tone.Reverb(0.4).toDestination(); // Slightly more reverb for "earthy" feel
            const delay = new Tone.FeedbackDelay("8n", 0.2).connect(reverb);

            this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle8" }, // Brighter, slightly complex
                envelope: {
                    attack: 0.005,
                    decay: 0.3,
                    sustain: 0.05,
                    release: 0.2
                },
                volume: -Infinity
            }).connect(delay);

            this.bellSynth = new Tone.MetalSynth({ // For occasional "crystal" like sounds in soil
                frequency: 300,
                envelope: { attack: 0.001, decay: 0.4, release: 0.1 },
                harmonicity: 4.1,
                modulationIndex: 22,
                resonance: 3000,
                octaves: 1.2,
                volume: -Infinity
            }).connect(reverb);


            this.createToyPianoPattern();
            this.createBellPattern();

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌿 SoilHandler: Tone.js components initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ SoilHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.toyPianoSynth) { this.toyPianoSynth.dispose(); this.toyPianoSynth = null; }
            if (this.bellSynth) { this.bellSynth.dispose(); this.bellSynth = null; }
            if (this.toyPianoLoop) { this.toyPianoLoop.dispose(); this.toyPianoLoop = null; }
            if (this.bellLoop) { this.bellLoop.dispose(); this.bellLoop = null; }
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording || this.isExternallyMuted) {
            return;
        }
        if (this.soilCreatureVisual && this.soilCreatureVisual.classList.contains('active')) {
            this.soilCreatureCurrentFrame = (this.soilCreatureCurrentFrame + 1) % this.soilCreatureTotalFrames;
            this.soilCreatureVisual.style.backgroundPositionX = (this.soilCreatureCurrentFrame * 20) + '%';
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

    createToyPianoPattern() {
        if (!this.toyPianoSynth) return;
        const toyPianoNotes = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
        this.toyPianoLoop = new Tone.Pattern((time, note) => {
            // CRITICAL FIX: Check if externally muted before playing
            if (!this.isPlaying || this.isExternallyMuted || !this.toyPianoSynth || this.toyPianoSynth.volume.value === -Infinity) return;
            const velocity = Math.max(0.3, this.currentSoilAppValue * 0.7 + 0.2);
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, velocity);
            this.triggerCreatureAnimation();
            this._displayNote(note);
        }, toyPianoNotes, "randomWalk");
        this.toyPianoLoop.interval = "4n";
        this.toyPianoLoop.humanize = "16n";
    }

    createBellPattern() {
        if (!this.bellSynth) return;
        const bellPitches = ["C6", "E6", "G6", "A6", "C7"];
        this.bellLoop = new Tone.Loop(time => {
            // CRITICAL FIX: Check if externally muted before playing
            if (!this.isPlaying || this.isExternallyMuted || !this.bellSynth || this.bellSynth.volume.value === -Infinity) return;
            const pitch = bellPitches[Math.floor(Math.random() * bellPitches.length)];
            const velocity = Math.random() * 0.3 + 0.3;
            this.bellSynth.triggerAttackRelease(pitch, "16n", time, velocity);
        }, "2n");
        this.bellLoop.probability = 0.0;
        this.bellLoop.humanize = "32n";
    }


    setupListeners() {
        if (!window.creatune) {
            console.error('🌿 SoilHandler: window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('🌿 SoilHandler: Setting up WebSocket and DOM listeners...');

        const handleStateOrDataUpdate = (isInitialState = false, stateOrData) => {
            const oldActive = this.isActive;
            const oldConnected = this.deviceStates.soil.connected;
            let dataToProcess = stateOrData;

            if (isInitialState && stateOrData) {
                this.deviceStates.soil.connected = stateOrData.connected;
                this.isActive = stateOrData.active;
                dataToProcess = stateOrData.lastRawData || stateOrData.rawData || stateOrData;
            } else if (stateOrData) {
                this.deviceStates.soil.connected = true;
                if (stateOrData.active !== undefined) this.isActive = stateOrData.active;
                dataToProcess = stateOrData.rawData || stateOrData;
            }

            if (dataToProcess) {
                this.currentSoilCondition = dataToProcess.soil_condition || this.currentSoilCondition || "dry";
                this.currentSoilAppValue = dataToProcess.moisture_app_value !== undefined ? dataToProcess.moisture_app_value : this.currentSoilAppValue;
            }

            if (this.debugMode && (this.isActive !== oldActive || this.deviceStates.soil.connected !== oldConnected)) {
                console.log(`🌿 SoilHandler state/data: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.soil.connected} (was ${oldConnected}), condition=${this.currentSoilCondition}, appValue=${this.currentSoilAppValue}`);
            }
            this.manageAudioAndVisuals();
        };

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                handleStateOrDataUpdate(false, state);
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                handleStateOrDataUpdate(false, data);
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`🌿 SoilHandler: Soil device connected event.`);
                this.deviceStates.soil.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`🌿 SoilHandler: Soil device disconnected event.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false;
                if (this.isRecordMode) this.exitRecordMode(true);
                this.manageAudioAndVisuals();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("🌿 SoilHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("🌿 SoilHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            this.manageAudioAndVisuals();
        });


        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                const canEnterRecordMode = this.deviceStates.soil.connected &&
                    !this.isRecordMode &&
                    this.isActive &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    !this.isExternallyMuted &&
                    (!window.lightHandlerInstance || !window.lightHandlerInstance.isRecordMode) &&
                    (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode);

                if (canEnterRecordMode) {
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`🌿 Record mode NOT entered for Soil. Conditions: connected=${this.deviceStates.soil.connected}, isRec=${this.isRecordMode}, isActive=${this.isActive}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, extMute=${this.isExternallyMuted}, lightRec=${window.lightHandlerInstance?.isRecordMode}, lsRec=${window.lightSoilHandlerInstance?.isRecordMode}`);
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

        const wsClientInitialState = window.creatune.getDeviceState('soil');
        handleStateOrDataUpdate(true, wsClientInitialState);
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            return;
        }

        if (this.toyPianoSynth && this.toyPianoSynth.volume) {
            const dynamicVolumePart = this.currentSoilAppValue * 10;
            const targetVolume = (this.isActive && this.deviceStates.soil.connected) ? this.baseToyPianoVolume + dynamicVolumePart : -Infinity;
            this.toyPianoSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.bellLoop && this.bellSynth && this.bellSynth.volume) {
            let probability = 0;
            let bellVolMod = 0;
            if (this.currentSoilCondition === 'wet') {
                probability = 0.5; bellVolMod = 0;
            } else if (this.currentSoilCondition === 'humid') {
                probability = 0.25; bellVolMod = -6;
            } else { // dry
                probability = 0.1; bellVolMod = -12;
            }
            this.bellLoop.probability = (this.isActive && this.deviceStates.soil.connected && this.isPlaying) ? probability : 0;
            const targetBellVol = (this.isActive && this.deviceStates.soil.connected) ? this.baseBellVolume + bellVolMod : -Infinity;
            this.bellSynth.volume.linearRampTo(targetBellVol, 0.7);
        }

        if (this.toyPianoLoop) {
            if (this.currentSoilAppValue > 0.7) this.toyPianoLoop.interval = "8n";
            else if (this.currentSoilAppValue > 0.4) this.toyPianoLoop.interval = "4n";
            else this.toyPianoLoop.interval = "2n";
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`🌿 MAV Start: RecMode=${this.isRecordMode}, IsPlayingGen=${this.isPlaying}, ExtMuted=${this.isExternallyMuted}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.soil.connected}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode && (this.isExternallyMuted || !this.audioEnabled)) console.log(`🌿 MAV: Externally muted or audio not enabled. Stopping all audio for Soil.`);
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI();
            return;
        }

        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`🌿 MAV: In Soil RecordMode, ensuring its generative audio (isPlaying=${this.isPlaying}) is stopped.`);
                this.stopAudio(true);
            }
            this.updateUI();
            return;
        }

        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`🌿 MAV: Tone not initialized for generative. Attempting initTone.`);
            this.initTone();
            if (!this.toneInitialized) {
                 if (this.debugMode) console.log(`🌿 MAV: initTone failed or deferred. Cannot manage generative audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayGenerativeAudio = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted;
        if (this.debugMode) console.log(`🌿 MAV: ShouldPlayGenerativeAudio (Soil) = ${shouldPlayGenerativeAudio}`);

        if (shouldPlayGenerativeAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`🌿 MAV: Conditions met for Soil, calling startAudio (generative).`);
                this.startAudio();
            } else {
                if (this.debugMode) console.log(`🌿 MAV: Soil generative audio already playing, calling updateSoundParameters.`);
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log(`🌿 MAV: Conditions NOT met for Soil generative audio, calling stopAudio.`);
                this.stopAudio();
            }
        }
        this.updateUI();
        if (this.debugMode) console.log(`🌿 MAV End for Soil. IsPlayingGen=${this.isPlaying}`);
    }

    updateUI() {
        this.showSoilVisualContext = this.deviceStates.soil.connected && !this.isExternallyMuted && !this.isRecordMode;
        const showCreature = this.showSoilVisualContext && this.isActive;


        if (this.soilCreatureVisual) {
            const wasCreatureActive = this.soilCreatureVisual.classList.contains('active');
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            if (showCreature && !wasCreatureActive) {
                this.soilCreatureCurrentFrame = 0;
                this.soilCreatureVisual.style.backgroundPositionX = '0%';
            } else if (!showCreature && wasCreatureActive) {
                this.soilCreatureCurrentFrame = 0;
                this.soilCreatureVisual.style.backgroundPositionX = '0%';
            }
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (showCreature) {
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition}`);
            }
        }

        if (this.frameBackground) {
            const isSoilSystemActiveForBG = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted && !this.isRecordMode;

            if (isSoilSystemActiveForBG && !window.lightHandlerInstance?.isActive && !window.lightSoilHandlerInstance?.isCombinedActive) {
                 this.frameBackground.classList.add('soil-active-bg');
                 this.frameBackground.classList.remove('soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');
                 this.frameBackground.classList.add(`soil-${this.currentSoilCondition}-bg`);
            } else if (!this.isRecordMode) {
                this.frameBackground.classList.remove('soil-active-bg');
                this.frameBackground.classList.remove('soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg');
            }


            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.remove('light-active-bg', 'soil-active-bg', 'lightsoil-active-bg');
            } else if (
                (!window.lightHandlerInstance || !window.lightHandlerInstance.isRecordMode) &&
                (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode)
            ) {
                this.frameBackground.classList.remove('record-mode-pulsing');
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRecMode = window.lightHandlerInstance && window.lightHandlerInstance.isRecordMode;
            const lsInRecMode = window.lightSoilHandlerInstance && window.lightSoilHandlerInstance.isRecordMode;
            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRecMode && !lsInRecMode) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || this.isExternallyMuted) {
            if(this.debugMode) console.warn(`🌿 enterRecordMode: Blocked. isRec=${this.isRecordMode}, audioEn=${this.audioEnabled}, toneInit=${this.toneInitialized}, extMute=${this.isExternallyMuted}`);
            return;
        }
        if ((window.lightHandlerInstance?.isRecordMode) || (window.lightSoilHandlerInstance?.isRecordMode)) {
            if(this.debugMode) console.warn(`🌿 enterRecordMode: Blocked. Another creature is already in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ enterRecordMode: getUserMedia API not available. Ensure HTTPS or localhost.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('🌿 enterRecordMode: Starting for Soil...');
        this.isRecordMode = true;

        if (this.debugMode) console.log('🌿 enterRecordMode: Stopping Soil generative audio forcefully.');
        this.stopAudio(true);

        if (window.lightHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿 enterRecordMode (Soil): Muting LightHandler.');
            window.lightHandlerInstance.setExternallyMuted(true);
        }
        if (window.lightSoilHandlerInstance?.setExternallyMuted) {
            if (this.debugMode) console.log('🌿 enterRecordMode (Soil): Muting LightSoilHandler.');
            window.lightSoilHandlerInstance.setExternallyMuted(true);
        }

        this.updateUI();
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!this.isRecordMode) {
            if(this.debugMode) console.log('🌿 enterRecordMode: Exited during pre-recording wait. Not proceeding with mic.');
            if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
            if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
            this.manageAudioAndVisuals();
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();

            if (!this.isRecordMode) {
                if(this.debugMode) console.log('🌿 enterRecordMode: Exited after mic permission prompt.');
                if (this.mic.state === "started") this.mic.close();
                this.mic = null;
                if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
                if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
                this.manageAudioAndVisuals();
                return;
            }

            if (this.debugMode) console.log('🌿 enterRecordMode: Mic opened for Soil.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log(`🌿 enterRecordMode: Soil recording started for ${this.recordingDuration / 1000} seconds...`);

            setTimeout(async () => {
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if(this.debugMode) console.log('🌿 enterRecordMode (timeout): Soil no longer in active recording state or record mode. Aborting rhythmic setup.');
                    if (this.mic && this.mic.state === "started") this.mic.close();
                    this.mic = null;
                    if (this.recorder && this.recorder.state === "started") {
                        try { await this.recorder.stop(); } catch(e) {/*ignore*/}
                    }
                    if (this.isRecordMode) this.exitRecordMode(true);
                    else {
                        if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
                        if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
                        this.manageAudioAndVisuals();
                    }
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic && this.mic.state === "started") this.mic.close();
                this.mic = null;
                if (this.debugMode) console.log('🌿 enterRecordMode (timeout): Soil recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) {
                     if(this.debugMode) console.log('🌿 enterRecordMode (timeout): Soil exited during recording phase. Not setting up rhythmic playback.');
                     return;
                }
                this._setupRhythmicPlayback(audioBlob);

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ enterRecordMode (Soil): Error during mic setup: ${err.message}`, err);
            alert(`Could not start recording for Soil: ${err.message}. Check console and browser permissions.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true);
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.toyPianoSynth) { // Using toyPianoSynth for rhythmic playback
            if(this.debugMode) console.warn(`🌿 _setupRhythmicPlayback (Soil): Blocked. isRec=${this.isRecordMode}, toneInit=${this.toneInitialized}, toyPianoSynth=${!!this.toyPianoSynth}. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }
        if (this.debugMode) console.log('🌿 _setupRhythmicPlayback (Soil): Starting using toyPianoSynth...');

        if (this.toyPianoSynth) {
            this.toyPianoSynth.releaseAll();
            if (this.toyPianoSynth.volume) {
                this.toyPianoSynth.volume.value = this.rhythmicPlaybackVolume;
                if (this.debugMode) console.log(`🌿 _setupRhythmicPlayback (Soil): toyPianoSynth volume explicitly set to ${this.toyPianoSynth.volume.value} (target: ${this.rhythmicPlaybackVolume}).`);
            }
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl);
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
        this.lastRhythmNoteTime = 0;
        const rhythmicNotes = ["C3", "E3", "G3", "A3", "C4"]; // Lower notes for soil

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode || !this.recordedBufferPlayer) {
                    if (this.debugMode) console.log('🌿 _setupRhythmicPlayback (Soil onload): Record mode exited or player null. Aborting.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    if(this.toyPianoSynth?.volume?.value === this.rhythmicPlaybackVolume) {
                        this.toyPianoSynth.volume.value = -Infinity;
                    }
                    return;
                }

                if (this.debugMode) console.log('🌿 _setupRhythmicPlayback (Soil onload): Recorded buffer player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination();
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌿 _setupRhythmicPlayback (Soil onload): Recorded buffer player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.toyPianoSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                        return;
                    }
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                        const velocity = 0.4 + (Math.min(15, Math.max(0, level - this.rhythmThreshold)) * 0.035); // Slightly different velocity scaling

                        if (this.debugMode) {
                            const currentSynthVolume = this.toyPianoSynth?.volume?.value ?? 'N/A';
                            console.log(`🌿 Rhythmic trigger (Soil ToyPiano): Lvl: ${typeof level === 'number' ? level.toFixed(2) : level}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}, SynthVol: ${currentSynthVolume}`);
                        }
                        if (this.toyPianoSynth && this.toyPianoSynth.volume.value !== -Infinity) {
                           this.toyPianoSynth.triggerAttackRelease(noteToPlay, "8n", time, Math.min(0.9, velocity));
                        }
                        this.triggerCreatureAnimation();
                        this._displayNote(noteToPlay);
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0);
                if (this.debugMode) console.log('🌿 _setupRhythmicPlayback (Soil onload): Rhythmic loop with toyPianoSynth initiated.');
            },
            onerror: (err) => {
                console.error('❌ _setupRhythmicPlayback (Soil): Error loading recorded buffer player:', err);
                this.exitRecordMode(true);
            }
        });

        if (Tone.Transport.state !== "started") Tone.Transport.start();
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) return;
        if (this.debugMode) console.log(`🌿 exitRecordMode (Soil): Starting. Forced: ${force}. Was inRecMode: ${this.isRecordMode}`);

        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;

        if (this.mic?.state === "started") this.mic.close(); this.mic = null;
        if (this.recorder) { if (this.recorder.state === "started") try { this.recorder.stop(); } catch(e) {} this.recorder.dispose(); this.recorder = null; }
        if (this.rhythmicLoop) { if (this.rhythmicLoop.state === "started") this.rhythmicLoop.stop(0); this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
        if (this.recordedBufferPlayer) { if (this.recordedBufferPlayer.state === "started") this.recordedBufferPlayer.stop(0); this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }

        if (this.toyPianoSynth?.volume) this.toyPianoSynth.volume.value = -Infinity;
        if (this.bellSynth?.volume) this.bellSynth.volume.value = -Infinity;
        if (this.toyPianoSynth) this.toyPianoSynth.releaseAll();


        this.isPlaying = false;
        this.isFadingOut = false;
        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        if (wasRecordMode) {
            if (window.lightHandlerInstance?.isExternallyMuted && window.lightHandlerInstance?.setExternallyMuted) {
                if (this.debugMode) console.log('🌿 exitRecordMode (Soil): Un-muting LightHandler.');
                window.lightHandlerInstance.setExternallyMuted(false);
            }
            if (window.lightSoilHandlerInstance?.isExternallyMuted && window.lightSoilHandlerInstance?.setExternallyMuted) {
                if (this.debugMode) console.log('🌿 exitRecordMode (Soil): Un-muting LightSoilHandler.');
                window.lightSoilHandlerInstance.setExternallyMuted(false);
            }
        }

        this.updateUI();
        if (wasRecordMode || force) {
            this.manageAudioAndVisuals();
        }
        if (this.debugMode) console.log(`🌿 exitRecordMode (Soil): Finished. isRecMode=${this.isRecordMode}, isPlayingGen=${this.isPlaying}`);
    }


    startAudio() {
        if (this.isRecordMode || this.isExternallyMuted) {
            if (this.debugMode) console.log(`🌿 startAudio (Soil generative): Blocked, RecMode=${this.isRecordMode}, ExtMuted=${this.isExternallyMuted}.`);
            return;
        }
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn(`🌿 startAudio (Soil generative): Blocked. AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('🌿 startAudio (Soil generative): Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("🌿 startAudio (Soil generative): Called, but already playing. Ensuring params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        if (!this.deviceStates.soil.connected || !this.isActive) {
            if (this.debugMode) console.log(`🌿 startAudio (Soil generative): Conditions not met (DeviceConnected:${this.deviceStates.soil.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
            console.error("❌ startAudio (Soil generative): Critical: Synths/Loops not available. Attempting re-init.");
            this.initTone();
             if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
                console.error("❌ startAudio (Soil generative): Critical: Re-init failed. Cannot start.");
                return;
             }
             if (this.isPlaying) return;
        }

        if (this.debugMode) console.log('🌿 startAudio (Soil generative): Starting...');
        this.isPlaying = true;
        this.isFadingOut = false;

        if (Tone.Transport.state !== "started") Tone.Transport.start();

        this.updateSoundParameters();

        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.bellLoop && this.bellLoop.state !== "started") this.bellLoop.start(0);


        if (this.debugMode) console.log('🌿 startAudio (Soil generative): Loops started. isPlayingGen is true.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌿 stopAudio (Soil generative): Audio system not ready. Forcing isPlaying=false.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            return;
        }
        const wasPlayingOnEntry = this.isPlaying;

        if (this.isFadingOut && !force) {
            return;
        }

        if (this.debugMode) console.log(`🌿 stopAudio (Soil generative): Stopping. Forced: ${force}, WasPlaying: ${wasPlayingOnEntry}, WasFading: ${this.isFadingOut}`);

        this.isPlaying = false;

        if (!force && wasPlayingOnEntry) {
            this.isFadingOut = true;
        } else {
            this.isFadingOut = false;
        }

        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.toyPianoSynth?.volume) {
            this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
            this.toyPianoSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.bellSynth?.volume) {
            this.bellSynth.volume.cancelScheduledValues(Tone.now());
            this.bellSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }


        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        const completeStop = () => {
            if (this.toyPianoLoop?.state === "started") this.toyPianoLoop.stop(0);
            if (this.bellLoop?.state === "started") this.bellLoop.stop(0);


            if (this.toyPianoSynth) {
                this.toyPianoSynth.releaseAll();
                if (this.toyPianoSynth.volume) this.toyPianoSynth.volume.value = -Infinity;
            }
            if (this.bellSynth?.volume) this.bellSynth.volume.value = -Infinity;


            this.isFadingOut = false;
            if (this.debugMode) console.log('🌿 stopAudio (Soil generative): Fully stopped and loops cleared.');
            this.updateUI();
        };

        if (force || !wasPlayingOnEntry) {
            if (force && this.toyPianoSynth) this.toyPianoSynth.releaseAll();
            completeStop();
        } else {
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150));
        }

        if (force || !wasPlayingOnEntry) {
             this.updateUI();
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const initSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
                if (window.soilHandlerInstance.debugMode) console.log('🌿 Soil Handler instance created.');
            }
        } else {
            const tempDebugMode = true;
            if (tempDebugMode) console.log('🌿 Waiting for SoilHandler dependencies (DOMContentLoaded)...');
            setTimeout(initSoilHandler, 100);
        }
    };
    initSoilHandler();
});


if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}