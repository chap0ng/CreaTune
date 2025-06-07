class SoilHandler {
    constructor() {
        // Synths and Loops - Toypiano Style
        this.toyPianoSynth = null;
        this.bellSynth = null;
        this.toyPianoLoop = null; // For generative audio
        this.bellLoop = null;     // For generative audio

        // Audio Params - Toypiano Style
        this.fadeDuration = 1.5; 
        this.baseToyPianoVolume = 7; 
        this.baseBellVolume = 5;     
        this.rhythmicPlaybackVolume = 7; 

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
        this.rhythmThreshold = -30; 
        this.rhythmNoteCooldown = 150;  
        this.lastRhythmNoteTime = 0;
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
            // Ensure this matches your working version for soil creature
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
                if (noteDisplayElement.textContent === this.lastDisplayedNote) { // Only clear if it's still the same note
                    noteDisplayElement.textContent = '-';
                }
            }, 750); // Display note for 750ms
        }
    }

    createToyPianoPattern() { 
        if (!this.toyPianoSynth) return;
        const toyPianoNotes = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
        this.toyPianoLoop = new Tone.Pattern((time, note) => {
            if (!this.isPlaying || !this.toyPianoSynth || this.toyPianoSynth.volume.value === -Infinity) return; 
            const velocity = Math.max(0.3, this.currentSoilAppValue * 0.7 + 0.2);
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, velocity);
            this.triggerCreatureAnimation(); 
            this._displayNote(note);
        }, toyPianoNotes, "randomWalk");
        this.toyPianoLoop.interval = "4n"; // Adjust for speed, e.g., "2n" is slower
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
            // Optionally display bells: this._displayNote("🔔");
        }, "2n"); // Adjust for speed, e.g., "1m" is slower
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
                    this.toneInitialized &&
                    (!window.lightHandlerInstance || !window.lightHandlerInstance.isRecordMode) // Check other handlers
                    /* && (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode) */ // If you add more
                    ) {             
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`💧 Record mode NOT entered for Soil. Conditions: soil.connected=${this.deviceStates.soil.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRecordMode=${window.lightHandlerInstance?.isRecordMode}`);
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
        }
        this.updateUI(); 
    }

    updateSoundParameters() { 
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            return;
        }

        if (this.toyPianoSynth && this.toyPianoSynth.volume) {
            const dynamicVolumePart = this.currentSoilAppValue * 10; 
            const baseVol = this.baseToyPianoVolume; 
            const targetVolume = (this.isActive && this.deviceStates.soil.connected) ? (baseVol + dynamicVolumePart) : -Infinity; 
            this.toyPianoSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.bellLoop && this.bellSynth && this.bellSynth.volume) {
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
            const targetBellVol = (this.isActive && this.deviceStates.soil.connected) ? (baseBellVol + bellVolMod) : -Infinity;
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
        // Condition for creature visibility
        const showCreature = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted && !this.isRecordMode;
        
        if (this.soilCreatureVisual) {
            const wasCreatureActive = this.soilCreatureVisual.classList.contains('active');
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            
            // Creature condition class (can remain if you want visual variants for the creature itself)
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
            const soilActiveBgClass = 'soil-active-bg'; // Simplified to one class

            // Background classes from other potentially conflicting handlers
            const otherHandlersBgClasses = [
                'light-active-bg', // Updated
                'lightsoil-active-bg',
                'idle-bg'
            ];

            if (this.isRecordMode) { // 1. SoilHandler is in its own record mode
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(soilActiveBgClass); // Show its active BG with pulsing
                // In its own record mode, SoilHandler does not clear other handlers' BGs.
            } else { // Not in SoilHandler's own record mode
                this.frameBackground.classList.remove('record-mode-pulsing');

                if (isConnected) { // 2. Soil sensor is connected
                    this.frameBackground.classList.add(soilActiveBgClass);

                    if (!this.isExternallyMuted) {
                        // Not externally muted: SoilHandler asserts visual dominance by clearing other BGs
                        otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                    }
                    // If externally muted, it shows its own BG type, but does NOT clear otherHandlersBgClasses.
                } else { // 3. Soil sensor is NOT connected
                    this.frameBackground.classList.remove(soilActiveBgClass);
                }
            }
        }

        // Stop Record Mode Button Visibility
        if (this.stopRecordModeButton) {
            const lightInRecMode = window.lightHandlerInstance?.isRecordMode;
            const lightSoilInRecMode = window.lightSoilHandlerInstance?.isRecordMode;

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRecMode && !lightSoilInRecMode) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.05) console.log(`💧 UI Update (Soil): CreatureActive=${showCreature}, DeviceConnected=${this.deviceStates.soil.connected}, RecModeSoil=${this.isRecordMode}, ExtMuteSoil=${this.isExternallyMuted}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
    }
    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized) {
            if(this.debugMode) console.warn(`💧 enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }
        if (window.lightHandlerInstance && window.lightHandlerInstance.isRecordMode) {
            if(this.debugMode) console.warn(`💧 enterRecordMode: Blocked. Light creature is already in record mode.`);
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
        this.stopAudio(true); 

        this.updateUI(); 

        await new Promise(resolve => setTimeout(resolve, 200)); 

        if (!this.isRecordMode) { 
            if(this.debugMode) console.log('💧 enterRecordMode: Exited during pre-recording wait. Not proceeding with mic.');
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
                    if (this.isRecordMode) this.exitRecordMode(true);
                    return;
                }
                
                const audioBlob = await this.recorder.stop();
                if (this.mic && this.mic.state === "started") this.mic.close();
                this.mic = null; 
                if (this.debugMode) console.log('💧 enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { 
                     if(this.debugMode) console.log('💧 enterRecordMode (timeout): Exited during recording phase proper. Not setting up rhythmic playback.');
                     return; 
                }
                this._setupRhythmicPlayback(audioBlob); 

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ enterRecordMode: Error during mic setup: ${err.message}`, err);
            alert(`Could not start recording: ${err.message}. Check console and browser permissions.`);
            this.isCurrentlyRecording = false; 
            this.exitRecordMode(true); 
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized || !this.toyPianoSynth) {
            if(this.debugMode) console.warn(`💧 _setupRhythmicPlayback: Blocked (initial checks). isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, toyPianoSynth=${!!this.toyPianoSynth}. Forcing exit.`);
            this.exitRecordMode(true); 
            return;
        }
        if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Starting...');
        
        if (this.toyPianoSynth && this.toyPianoSynth.volume) {
            this.toyPianoSynth.volume.value = this.rhythmicPlaybackVolume; 
            if (this.debugMode) console.log(`💧 _setupRhythmicPlayback: toyPianoSynth volume set to ${this.rhythmicPlaybackVolume} dB for rhythmic notes.`);
        } else if (this.debugMode) {
            console.warn(`💧 _setupRhythmicPlayback: toyPianoSynth or its volume property not available for setting rhythmic volume.`);
        }

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); 
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
        
        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 }); 
        this.lastRhythmNoteTime = 0; 

        this.recordedBufferPlayer = new Tone.Player({
            url: this.recordedAudioBlobUrl,
            loop: true,
            onload: () => {
                if (!this.isRecordMode) { 
                    if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Record mode exited while buffer was loading. Aborting start.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    if(this.toyPianoSynth && this.toyPianoSynth.volume.value === this.rhythmicPlaybackVolume) {
                        this.toyPianoSynth.volume.value = -Infinity;
                    }
                    return;
                }

                if (!this.recordedBufferPlayer) {
                    if (this.debugMode) console.warn('💧 _setupRhythmicPlayback (onload): recordedBufferPlayer became null before operations. Aborting.');
                    return;
                }

                if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Recorded buffer player loaded.');
                
                this.recordedBufferPlayer.connect(this.rhythmFollower); 
                this.recordedBufferPlayer.toDestination(); 
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Recorded buffer player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.toyPianoSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                        return;
                    }

                    const level = this.rhythmFollower.getValue(); 
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const notes = ["C4", "E4", "G4", "A4", "C5"]; 
                        const noteToPlay = notes[Math.floor(Math.random() * notes.length)];
                        const calculatedVelocity = 0.4 + (Math.min(20, Math.max(0, level - this.rhythmThreshold)) * 0.025);
                        const velocity = Math.min(0.9, Math.max(0.1, calculatedVelocity)); 
                        
                        if (this.debugMode && Math.random() < 0.25) console.log(`💧 Rhythmic trigger! Level: ${typeof level === 'number' ? level.toFixed(2) : level}, Note: ${noteToPlay}, Velocity: ${velocity.toFixed(2)}`);
                        
                        this.toyPianoSynth.triggerAttackRelease(noteToPlay, "16n", time, velocity);
                        this.triggerCreatureAnimation(); 
                        this._displayNote(noteToPlay);
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0); 
                if (this.debugMode) console.log('💧 _setupRhythmicPlayback (onload): Rhythmic loop initiated.');

            },
            onerror: (err) => {
                console.error('❌ _setupRhythmicPlayback: Error loading recorded buffer player:', err);
                this.exitRecordMode(true); 
            }
        });

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Tone.Transport started (outside onload).');
        }
        if (this.debugMode) console.log('💧 _setupRhythmicPlayback: Setup initiated, player loading asynchronously via onload callback.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) { 
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
            if (this.rhythmicLoop.state === "started") this.rhythmicLoop.stop(0);
            this.rhythmicLoop.dispose(); this.rhythmicLoop = null;
        }
        if (this.recordedBufferPlayer) {
            if (this.recordedBufferPlayer.state && this.recordedBufferPlayer.state === "started") this.recordedBufferPlayer.stop(0);
            this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null;
            if (this.recordedAudioBlobUrl) {
                URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null;
            }
        }
        if (this.rhythmFollower) {
            this.rhythmFollower.dispose(); this.rhythmFollower = null;
        }

        // Ensure generative synths are silenced after record mode
        if (this.toyPianoSynth && this.toyPianoSynth.volume) this.toyPianoSynth.volume.value = -Infinity;
        if (this.bellSynth && this.bellSynth.volume) this.bellSynth.volume.value = -Infinity;
        
        this.isPlaying = false; 
        this.isFadingOut = false;
        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }
        
        this.updateUI(); 
        
        if (wasRecordMode || force) { 
            this.manageAudioAndVisuals(); 
        }
        if (this.debugMode) console.log(`💧 exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}, isPlayingGen is ${this.isPlaying}`);
    }

    startAudio() { 
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
            this.initTone(); 
             if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
                console.error("❌ startAudio (generative): Critical: Re-init failed. Cannot start.");
                return;
             }
             if (this.isPlaying) return;
        }

        if (this.debugMode) console.log('💧 startAudio (generative): Starting...');
        this.isPlaying = true; 
        this.isFadingOut = false;
        
        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('💧 startAudio (generative): Tone.Transport started.');
        }
        
        this.updateSoundParameters(); 

        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.bellLoop && this.bellLoop.state !== "started") this.bellLoop.start(0);
        
        if (this.debugMode) console.log('💧 startAudio (generative): Loops started. isPlayingGen is true.');
        this.updateUI();
    }

    stopAudio(force = false) { 
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💧 stopAudio (generative): Audio system not ready. Forcing isPlaying=false.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { 
            return;
        }
        if (this.isFadingOut && !force) { 
            return;
        }

        if (this.debugMode) console.log(`💧 stopAudio (generative): Stopping. Forced: ${force}, WasPlaying: ${this.isPlaying}, WasFading: ${this.isFadingOut}`);
        
        const wasPlaying = this.isPlaying;
        this.isPlaying = false; 
        
        if (!force && wasPlaying) { 
            this.isFadingOut = true;
        } else {
            this.isFadingOut = false; 
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
            
            if (this.toyPianoSynth && this.toyPianoSynth.volume) this.toyPianoSynth.volume.value = -Infinity;
            if (this.bellSynth && this.bellSynth.volume) this.bellSynth.volume.value = -Infinity;
            
            this.isFadingOut = false; 
            if (this.debugMode) console.log('💧 stopAudio (generative): Fully stopped and loops cleared.');
            this.updateUI(); 
        };

        if (force || !wasPlaying) { 
            completeStop();
        } else { 
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150)); 
        }
        
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