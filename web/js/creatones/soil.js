class SoilHandler {
    constructor() {
        // Synths and Loops - Toypiano Style
        this.toyPianoSynth = null;
        this.bellSynth = null;
        this.toyPianoLoop = null; // For generative audio
        this.bellLoop = null;     // For generative audio

        // Audio Params - Toypiano Style
        this.fadeDuration = 1.5; 
        this.baseToyPianoVolume = 9; // keep these values
        this.baseBellVolume = 6;     // keep these values
        this.rhythmicPlaybackVolume = 9; // keep these values

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
        this.rhythmThreshold = -30; // dB threshold for rhythm detection    
        this.rhythmNoteCooldown = 150;  
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null; 

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
        // Manage audio and visuals will re-evaluate based on the new muted state
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
            if (this.debugMode) console.log('💧 SoilHandler: initTone called, but already initialized.');
            return;
        }
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💧 SoilHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💧 SoilHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💧 SoilHandler: Initializing Tone.js components...');
        try {
            // Ensure Transport is started before creating loops that might depend on it.
            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
                if (this.debugMode) console.log('💧 SoilHandler: Tone.Transport started in initTone.');
            }

            const sharedReverb = new Tone.Reverb({ decay: 1.5, wet: 0.35 }).toDestination();
            const sharedDelay = new Tone.FeedbackDelay("8n.", 0.3).connect(sharedReverb);

            this.toyPianoSynth = new Tone.PluckSynth({
                attackNoise: 1,
                dampening: 4000,
                resonance: 0.9,
                release: 0.5,
                volume: -Infinity 
            }).connect(sharedDelay);

            this.bellSynth = new Tone.Synth({
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.01,
                    decay: 0.3,
                    sustain: 0.1,
                    release: 0.5
                },
                volume: -Infinity 
            }).connect(sharedReverb);

            this.createToyPianoPattern(); 
            this.createBellPattern();     

            this.toneInitialized = true;
            if (this.debugMode) console.log('💧 SoilHandler: Tone.js components initialized successfully.');
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
        if (this.isCurrentlyRecording) {
            return; 
        }
        if (this.soilCreatureVisual && this.soilCreatureVisual.classList.contains('active')) {
            this.soilCreatureCurrentFrame = (this.soilCreatureCurrentFrame + 1) % this.soilCreatureTotalFrames;
            this.soilCreatureVisual.style.backgroundPositionX = (this.soilCreatureCurrentFrame * 20) + '%';
        }
    }

    createToyPianoPattern() { 
        if (!this.toyPianoSynth) return;
        const toyPianoNotes = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
        this.toyPianoLoop = new Tone.Pattern((time, note) => {
            // Check this.isPlaying (for generative) and also ensure synth volume is not -Infinity
            if (!this.isPlaying || !this.toyPianoSynth || this.toyPianoSynth.volume.value === -Infinity) return; 
            const velocity = Math.max(0.3, this.currentSoilAppValue * 0.7 + 0.2);
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, velocity);
            this.triggerCreatureAnimation(); 
            if (typeof window.updateNotesDisplay === 'function') window.updateNotesDisplay(note);
        }, toyPianoNotes, "randomWalk");
        this.toyPianoLoop.interval = "4n";
        this.toyPianoLoop.humanize = "16n";
    }

    createBellPattern() { 
        if (!this.bellSynth) return;
        const bellPitches = ["C6", "E6", "G6", "A6", "C7"];
        this.bellLoop = new Tone.Loop(time => {
            if (!this.isPlaying || !this.bellSynth || this.bellSynth.volume.value === -Infinity) return; 
            const pitch = bellPitches[Math.floor(Math.random() * bellPitches.length)];
            const velocity = Math.random() * 0.3 + 0.3;
            this.bellSynth.triggerAttackRelease(pitch, "16n", time, velocity);
        }, "2n");
        this.bellLoop.probability = 0.0; 
        this.bellLoop.humanize = "32n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 SoilHandler: window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up WebSocket and DOM listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                const oldActive = this.isActive;
                const oldConnected = this.deviceStates.soil.connected;
                this.isActive = state.active; 
                this.currentSoilCondition = state.rawData.soil_condition || "dry";
                this.currentSoilAppValue = state.rawData.moisture_app_value || 0.0;
                this.deviceStates.soil.connected = true; 
                if (this.debugMode) console.log(`💧 SoilHandler stateChange: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.soil.connected} (was ${oldConnected}), condition=${this.currentSoilCondition}, appValue=${this.currentSoilAppValue}`);
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.currentSoilCondition = data.soil_condition || this.currentSoilCondition;
                this.currentSoilAppValue = data.moisture_app_value !== undefined ? data.moisture_app_value : this.currentSoilAppValue;
                this.deviceStates.soil.connected = true; 
                if (!this.isRecordMode && this.isPlaying) this.updateSoundParameters(); 
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler: Soil device connected event.`);
                this.deviceStates.soil.connected = true;
                // Don't assume active yet, wait for stateChange
                if (Tone.context.state === 'running') this.handleAudioContextRunning(); 
                else this.manageAudioAndVisuals(); 
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler: Soil device disconnected event.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false; 
                if (this.isRecordMode) this.exitRecordMode(true); 
                else this.manageAudioAndVisuals(); 
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
                    !this.isRecordMode &&              
                    this.isActive &&                    
                    this.audioEnabled &&                
                    this.toneInitialized) {             
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`💧 Record mode NOT entered. Conditions: soil.connected=${this.deviceStates.soil.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
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
        if (wsClientInitialState) {
            this.deviceStates.soil.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentSoilCondition = wsClientInitialState.lastRawData.soil_condition || "dry";
                this.currentSoilAppValue = wsClientInitialState.lastRawData.moisture_app_value || 0.0;
            }
            if (this.debugMode) console.log(`💧 SoilHandler initial state from wsClient: Connected=${this.deviceStates.soil.connected}, Active=${this.isActive}`);
        }
        this.updateUI(); 
    }

    updateSoundParameters() { 
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            return;
        }

        if (this.toyPianoSynth) {
            const dynamicVolumePart = this.currentSoilAppValue * 10; 
            const baseVol = this.baseToyPianoVolume; 
            const targetVolume = (this.isActive && this.deviceStates.soil.connected) ? Math.min(0, baseVol + dynamicVolumePart) : -Infinity; // Cap at 0dB
            this.toyPianoSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.bellLoop && this.bellSynth) {
            let probability = 0;
            let bellVolMod = 0; 
            if (this.currentSoilCondition === 'wet') {
                probability = 0.5; bellVolMod = 0;
            } else if (this.currentSoilCondition === 'humid') {
                probability = 0.25; bellVolMod = -6;
            } else { 
                probability = 0.1; bellVolMod = -12;
            }
            this.bellLoop.probability = (this.isActive && this.deviceStates.soil.connected && this.isPlaying) ? probability : 0;
            const baseBellVol = this.baseBellVolume;
            const targetBellVol = (this.isActive && this.deviceStates.soil.connected) ? Math.min(0, baseBellVol + bellVolMod) : -Infinity; // Cap at 0dB
            this.bellSynth.volume.linearRampTo(targetBellVol, 0.7);
        }

        if (this.toyPianoLoop) {
            if (this.currentSoilAppValue < 0.2) this.toyPianoLoop.interval = "2n";
            else if (this.currentSoilAppValue < 0.6) this.toyPianoLoop.interval = "4n";
            else this.toyPianoLoop.interval = "8n";
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💧 MAV Start: RecordMode=${this.isRecordMode}, IsPlayingGen=${this.isPlaying}, ExtMuted=${this.isExternallyMuted}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.soil.connected}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`💧 MAV: Externally muted or audio not enabled. Stopping all audio.`);
            if (this.isRecordMode) this.exitRecordMode(true); 
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
            this.updateUI(); 
            return;
        }
        
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) { 
                if (this.debugMode) console.log(`💧 MAV: In RecordMode, ensuring generative audio (isPlaying=${this.isPlaying}) is stopped.`);
                this.stopAudio(true); 
            }
            this.updateUI(); 
            return;
        }

        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💧 MAV: Tone not initialized for generative. Attempting initTone.`);
            this.initTone(); 
            if (!this.toneInitialized) { 
                 if (this.debugMode) console.log(`💧 MAV: initTone failed or deferred. Cannot manage generative audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayGenerativeAudio = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; 
        if (this.debugMode) console.log(`💧 MAV: ShouldPlayGenerativeAudio = ${shouldPlayGenerativeAudio}`);

        if (shouldPlayGenerativeAudio) {
            if (!this.isPlaying || this.isFadingOut) { 
                if (this.debugMode) console.log(`💧 MAV: Conditions met, calling startAudio (generative).`);
                this.startAudio(); 
            } else { 
                if (this.debugMode) console.log(`💧 MAV: Generative audio already playing, calling updateSoundParameters.`);
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
            if (wasCreatureActive && !showCreature) { 
                this.soilCreatureCurrentFrame = 0; 
                this.soilCreatureVisual.style.backgroundPositionX = '0%';
            }
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (showCreature) { 
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}`);
            }
        }

        if (this.frameBackground) {
            this.frameBackground.classList.toggle('soil-connected-bg', this.deviceStates.soil.connected);
            this.frameBackground.classList.toggle('record-mode-pulsing', this.isRecordMode); 
        }

        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.style.display = this.isRecordMode ? 'block' : 'none';
        }
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized) {
            if(this.debugMode) console.warn(`💧 enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ enterRecordMode: getUserMedia API not available. Ensure HTTPS or localhost.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('💧 enterRecordMode: Starting...');
        this.isRecordMode = true; 
        
        if (this.debugMode) console.log('💧 enterRecordMode: Stopping generative audio forcefully.');
        this.stopAudio(true); // Force stop generative audio, sets this.isPlaying = false

        this.updateUI(); 

        await new Promise(resolve => setTimeout(resolve, 200)); 

        if (!this.isRecordMode) { 
            if(this.debugMode) console.log('💧 enterRecordMode: Exited during pre-recording wait. Not proceeding with mic.');
            // manageAudioAndVisuals() will be called if exitRecordMode was triggered by something else.
            return; 
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open(); 
            
            if (!this.isRecordMode) { 
                if(this.debugMode) console.log('💧 enterRecordMode: Exited after mic permission prompt.');
                if (this.mic.state === "started") this.mic.close(); 
                this.mic = null;
                return; 
            }

            if (this.debugMode) console.log('💧 enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true; 
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log('💧 enterRecordMode: Recording started for 5 seconds...');

            setTimeout(async () => {
                this.isCurrentlyRecording = false; 
                if (!this.recorder || !this.isRecordMode) { 
                    if(this.debugMode) console.log('💧 enterRecordMode (timeout): No longer in active recording state or record mode. Aborting rhythmic setup.');
                    if (this.mic && this.mic.state === "started") this.mic.close();
                    this.mic = null;
                    if (this.recorder && this.recorder.state === "started") {
                        try { await this.recorder.stop(); } catch(e) {/*ignore if already stopped or error*/}
                    }
                    // If not in record mode, exitRecordMode should handle full cleanup.
                    // If still in record mode but recorder is gone, something is wrong, exit.
                    if (this.isRecordMode) this.exitRecordMode(true);
                    return;
                }
                
                const audioBlob = await this.recorder.stop();
                if (this.mic && this.mic.state === "started") this.mic.close();
                this.mic = null; 
                if (this.debugMode) console.log('💧 enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { 
                     if(this.debugMode) console.log('💧 enterRecordMode (timeout): Exited during recording phase proper. Not setting up rhythmic playback.');
                     return; // exitRecordMode should have handled cleanup
                }
                this._setupRhythmicPlayback(audioBlob); 

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ enterRecordMode: Error during mic setup: ${err.message}`, err);
            alert(`Could not start recording: ${err.message}. Check console and browser permissions.`);
            this.isCurrentlyRecording = false; 
            this.exitRecordMode(true); // Force cleanup and exit record mode
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.toyPianoSynth) {
            if(this.debugMode) console.warn(`💧 _setupRhythmicPlayback: Blocked. isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, toyPianoSynth=${!!this.toyPianoSynth}. Forcing exit.`);
            this.exitRecordMode(true); 
            return;
        }
        if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Starting...');
        
        this.toyPianoSynth.volume.value = this.rhythmicPlaybackVolume;
        if (this.debugMode) console.log(`💧 _setupRhythmicPlayback: toyPianoSynth volume set to ${this.rhythmicPlaybackVolume} dB for rhythmic notes.`);

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); 
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
        
        this.recordedBufferPlayer = new Tone.Player(this.recordedAudioBlobUrl).toDestination(); // Connect player to destination to hear it (optional)
        // If you don't want to hear the recording directly, remove .toDestination()
        // this.recordedBufferPlayer = new Tone.Player(this.recordedAudioBlobUrl); 


        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 }); 
        this.recordedBufferPlayer.connect(this.rhythmFollower); 
        this.recordedBufferPlayer.loop = true;
        this.lastRhythmNoteTime = 0; 

        this.rhythmicLoop = new Tone.Loop(time => {
            if (!this.isRecordMode || !this.rhythmFollower || !this.toyPianoSynth) return; 

            const level = this.rhythmFollower.getValue(); 
            const currentTime = Tone.now() * 1000;

            if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                const notes = ["C4", "E4", "G4", "A4", "C5"]; 
                const noteToPlay = notes[Math.floor(Math.random() * notes.length)];
                // Ensure velocity is positive and reasonable
                const calculatedVelocity = 0.4 + (Math.min(20, Math.max(0, level - this.rhythmThreshold)) * 0.025);
                const velocity = Math.min(0.9, Math.max(0.1, calculatedVelocity)); 
                
                if (this.debugMode && Math.random() < 0.25) console.log(`💧 Rhythmic trigger! Level: ${typeof level === 'number' ? level.toFixed(2) : level}, Note: ${noteToPlay}, Velocity: ${velocity.toFixed(2)}`);
                
                this.toyPianoSynth.triggerAttackRelease(noteToPlay, "16n", time, velocity);
                this.triggerCreatureAnimation(); 
                if (typeof window.updateNotesDisplay === 'function') window.updateNotesDisplay(noteToPlay);
                this.lastRhythmNoteTime = currentTime;
            }
        }, "16n").start(0); 

        this.recordedBufferPlayer.start().then(() => {
            if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Recorded buffer player started.');
        }).catch(err => {
            console.error('❌ _setupRhythmicPlayback: Error starting recorded buffer player:', err);
            this.exitRecordMode(true); 
        });

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Tone.Transport started.');
        }
        if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Rhythmic loop and player initiated.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) { // If not in record mode and not forced, do nothing
            // if (this.debugMode) console.log(`💧 exitRecordMode: Called when not in record mode and not forced. Doing nothing.`);
            return;
        }
        if (this.debugMode) console.log(`💧 exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`);
        
        const wasRecordMode = this.isRecordMode; 
        this.isRecordMode = false;
        this.isCurrentlyRecording = false; 

        if (this.mic && this.mic.state === "started") this.mic.close();
        this.mic = null;
        if (this.recorder) {
            if (this.recorder.state === "started") try { this.recorder.stop(); } catch(e) { /* ignore */ }
            this.recorder.dispose(); 
            this.recorder = null;
        }
        if (this.rhythmicLoop) {
            this.rhythmicLoop.stop(0).dispose();
            this.rhythmicLoop = null;
        }
        if (this.recordedBufferPlayer) {
            this.recordedBufferPlayer.stop(0).dispose();
            this.recordedBufferPlayer = null;
            if (this.recordedAudioBlobUrl) {
                URL.revokeObjectURL(this.recordedAudioBlobUrl);
                this.recordedAudioBlobUrl = null;
            }
        }
        if (this.rhythmFollower) {
            this.rhythmFollower.dispose();
            this.rhythmFollower = null;
        }

        // Ensure generative synths are silent before MAV decides their new volume
        if (this.toyPianoSynth && this.toyPianoSynth.volume) {
             this.toyPianoSynth.volume.value = -Infinity;
        }
        if (this.bellSynth && this.bellSynth.volume) {
            this.bellSynth.volume.value = -Infinity;
        }
        
        // Reset generative playback state flags
        this.isPlaying = false; // Generative is not playing
        this.isFadingOut = false;
        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        if (this.debugMode) {
            console.log(`💧 exitRecordMode: Cleanup complete. Pre-MAV state: isRecordMode=${this.isRecordMode}, isPlayingGen=${this.isPlaying}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.soil.connected}, ExtMuted=${this.isExternallyMuted}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);
        }
        
        this.updateUI(); 
        
        if (wasRecordMode || force) { // Only call MAV if we were actually in record mode or forced
            this.manageAudioAndVisuals(); 
        }
        if (this.debugMode) console.log(`💧 exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}, isPlayingGen is ${this.isPlaying}`);
    }

    startAudio() { // For GENERATIVE audio
        if (this.isRecordMode) { 
            if (this.debugMode) console.log("💧 startAudio (generative): Blocked, in record mode.");
            return;
        }
        if (this.isExternallyMuted || !this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn(`💧 startAudio (generative): Blocked. ExtMuted=${this.isExternallyMuted}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);
            this.updateUI(); return;
        }
        if (this.isFadingOut) { 
            if (this.debugMode) console.log('💧 startAudio (generative): Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) { 
            if (this.debugMode) console.log("💧 startAudio (generative): Called, but already playing. Ensuring params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        if (!this.deviceStates.soil.connected || !this.isActive) { 
            if (this.debugMode) console.log(`💧 startAudio (generative): Conditions not met (DeviceConnected:${this.deviceStates.soil.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
            console.error("❌ startAudio (generative): Critical: Synths/Loops not available. Attempting re-init.");
            this.initTone(); // This will call manageAudioAndVisuals again if successful
             if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
                console.error("❌ startAudio (generative): Critical: Re-init failed. Cannot start.");
                return;
             }
             // If initTone was called, it might have already started audio via MAV, so re-check
             if (this.isPlaying) return;
        }

        if (this.debugMode) console.log('💧 startAudio (generative): Starting...');
        this.isPlaying = true; // Generative is NOW playing
        this.isFadingOut = false;
        
        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('💧 startAudio (generative): Tone.Transport started.');
        }
        
        this.updateSoundParameters(); // Set initial volumes for generative

        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.bellLoop && this.bellLoop.state !== "started") this.bellLoop.start(0);
        
        if (this.debugMode) console.log('💧 startAudio (generative): Loops started. isPlayingGen is true.');
        this.updateUI();
    }

    stopAudio(force = false) { // For GENERATIVE audio
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💧 stopAudio (generative): Audio system not ready. Forcing isPlaying=false.");
            this.updateUI(); return;
        }
        // If not playing and not fading out, and not forced, nothing to do for generative audio
        if (!this.isPlaying && !this.isFadingOut && !force) { 
            return;
        }
        // If already fading out and not forced, let it continue
        if (this.isFadingOut && !force) { 
            return;
        }

        if (this.debugMode) console.log(`💧 stopAudio (generative): Stopping. Forced: ${force}, WasPlaying: ${this.isPlaying}, WasFading: ${this.isFadingOut}`);
        
        const wasPlaying = this.isPlaying;
        this.isPlaying = false; // Generative is stopping/stopped
        
        if (!force && wasPlaying) { // Only set fadingOut if it was playing and not a forced stop
            this.isFadingOut = true;
        } else {
            this.isFadingOut = false; // If forced, or wasn't playing, not fading.
        }

        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.toyPianoSynth && this.toyPianoSynth.volume) {
            this.toyPianoSynth.volume.cancelScheduledValues(Tone.now());
            this.toyPianoSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.bellSynth && this.bellSynth.volume) {
            this.bellSynth.volume.cancelScheduledValues(Tone.now());
            this.bellSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        
        const completeStop = () => {
            if (this.toyPianoLoop && this.toyPianoLoop.state === "started") this.toyPianoLoop.stop(0);
            if (this.bellLoop && this.bellLoop.state === "started") this.bellLoop.stop(0);
            
            // Ensure volumes are truly -Infinity after loops are stopped
            if (this.toyPianoSynth && this.toyPianoSynth.volume) this.toyPianoSynth.volume.value = -Infinity;
            if (this.bellSynth && this.bellSynth.volume) this.bellSynth.volume.value = -Infinity;
            
            this.isFadingOut = false; 
            // this.isPlaying is already false
            if (this.debugMode) console.log('💧 stopAudio (generative): Fully stopped and loops cleared.');
            this.updateUI(); 
        };

        if (force || !wasPlaying) { // If forced, or if it wasn't actually playing (e.g. only fading), complete immediately
            completeStop();
        } else { // Was playing and not forced, so use timeout for fade
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150)); 
        }
        
        // Update UI immediately if not a forced stop (forced stop updates UI in completeStop)
        // or if it wasn't playing (UI might need update if fading was cancelled by a new state)
        if (!force || !wasPlaying) {
             this.updateUI();
        }
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