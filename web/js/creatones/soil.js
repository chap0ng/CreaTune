class SoilHandler {
    constructor() {
        // Synths and Loops - Toypiano Style
        this.toyPianoSynth = null;
        this.bellSynth = null;
        this.toyPianoLoop = null;
        this.bellLoop = null;

        // Audio Params - Toypiano Style
        this.fadeDuration = 1.5; 
        this.baseToyPianoVolume = 9; 
        this.baseBellVolume = 6;     

        // State
        this.isActive = false; // Is the sensor providing active data (e.g., not idle)
        this.isPlaying = false; // Is generative audio currently playing
        this.isFadingOut = false;
        this.audioEnabled = false; // Is Tone.js audio context running
        this.toneInitialized = false; // Have Tone.js components been set up
        this.debugMode = true;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false; 

        this.currentSoilCondition = "dry"; 
        this.currentSoilAppValue = 0.0;    
        this.deviceStates = { 
            soil: { connected: false } // Is the ESP32 soil sensor connected
        };

        // Sprite Animation State
        this.soilCreatureCurrentFrame = 0;
        this.soilCreatureTotalFrames = 6;

        // DOM Elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        // Record Mode Properties
        this.isRecordMode = false; // True for the entire duration of record mode (mic input + rhythmic playback)
        this.isCurrentlyRecording = false; // True ONLY during the 5s mic input phase
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null; 
        this.rhythmFollower = null;     
        this.rhythmicLoop = null;       
        this.recordingDuration = 5000;  // 5 seconds for recording
        this.rhythmThreshold = -30;     // dB threshold for triggering notes (NEEDS TUNING)
        this.rhythmNoteCooldown = 150;  // ms cooldown between rhythmically triggered notes
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null; 

        if (!this.soilCreatureVisual && this.debugMode) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💧 .framebackground element not found for SoilHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('💧 #stoprecordmode button not found.');

        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) { 
        if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return; 

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) this.exitRecordMode(true); 
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
        }
        this.manageAudioAndVisuals();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Core Dependencies ready.');
                this.setupListeners();
                this.updateUI(); 
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('💧 SoilHandler (Toypiano): AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode) { 
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💧 SoilHandler (Toypiano): Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💧 SoilHandler (Toypiano): AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💧 SoilHandler: Initializing Tone.js components (Bright Toypiano style)...');
        try {
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
            if (this.debugMode) console.log('💧 SoilHandler: Tone.js components (Toypiano) initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ SoilHandler (Toypiano): Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.toyPianoSynth) { this.toyPianoSynth.dispose(); this.toyPianoSynth = null; }
            if (this.bellSynth) { this.bellSynth.dispose(); this.bellSynth = null; }
            if (this.toyPianoLoop) { this.toyPianoLoop.dispose(); this.toyPianoLoop = null; }
            if (this.bellLoop) { this.bellLoop.dispose(); this.bellLoop = null; }
        }
    }

    triggerCreatureAnimation() {
        // Pause creature's frame animation ONLY during the 5s mic recording phase.
        // It should animate during generative playback and rhythmic playback.
        if (this.isCurrentlyRecording) {
            // if (this.debugMode) console.log('💧 Creature animation PAUSED during mic recording.');
            return;
        }

        // Animate if creature is supposed to be visible and active
        if (this.soilCreatureVisual && this.soilCreatureVisual.classList.contains('active')) {
            this.soilCreatureCurrentFrame++; 
            if (this.soilCreatureCurrentFrame >= this.soilCreatureTotalFrames) {
                this.soilCreatureCurrentFrame = 0; 
            }
            const newPositionX = (this.soilCreatureCurrentFrame * 20) + '%';
            this.soilCreatureVisual.style.backgroundPositionX = newPositionX;

            if (this.debugMode && Math.random() < 0.05) { // Reduced logging frequency
                 // console.log(`💧 Soil Creature frame: ${this.soilCreatureCurrentFrame}, posX: ${newPositionX}. RecordMode: ${this.isRecordMode}, CurrentlyRecording: ${this.isCurrentlyRecording}`);
            }
        }
    }

    createToyPianoPattern() { // For generative audio
        if (!this.toyPianoSynth) return;
        const toyPianoNotes = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
        this.toyPianoLoop = new Tone.Pattern((time, note) => {
            const velocity = Math.max(0.3, this.currentSoilAppValue * 0.7 + 0.2);
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, velocity);
            this.triggerCreatureAnimation(); 
            if (typeof window.updateNotesDisplay === 'function') { 
                window.updateNotesDisplay(note);
            }
        }, toyPianoNotes, "randomWalk");
        this.toyPianoLoop.interval = "4n";
        this.toyPianoLoop.humanize = "16n";
    }

    createBellPattern() { // For generative audio
        if (!this.bellSynth) return;
        const bellPitches = ["C6", "E6", "G6", "A6", "C7"];
        this.bellLoop = new Tone.Loop(time => {
            const pitch = bellPitches[Math.floor(Math.random() * bellPitches.length)];
            const velocity = Math.random() * 0.3 + 0.3;
            this.bellSynth.triggerAttackRelease(pitch, "16n", time, velocity);
            // Bell sounds don't trigger creature animation by default, only main notes
        }, "2n");
        this.bellLoop.probability = 0.0; // Initially off, controlled by soil condition
        this.bellLoop.humanize = "32n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 SoilHandler (Toypiano): window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Setting up WebSocket and DOM listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano) stateChange: active=${state.active}, condition=${state.rawData.soil_condition}, appValue=${state.rawData.moisture_app_value}`);
                this.isActive = state.active; // Sensor is actively sending data vs. being idle/just connected
                this.currentSoilCondition = state.rawData.soil_condition || "dry";
                this.currentSoilAppValue = state.rawData.moisture_app_value || 0.0;
                this.deviceStates.soil.connected = true; // Implied by stateChange
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.currentSoilCondition = data.soil_condition || this.currentSoilCondition;
                this.currentSoilAppValue = data.moisture_app_value !== undefined ? data.moisture_app_value : this.currentSoilAppValue;
                this.deviceStates.soil.connected = true; // Implied by data
                if (!this.isRecordMode) this.updateSoundParameters(); // Only update generative params if not in record mode
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Soil device connected.`);
                this.deviceStates.soil.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning(); 
                else this.manageAudioAndVisuals(); // Will call updateUI
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Soil device disconnected.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false; // If disconnected, it's not active
                if (this.isRecordMode) this.exitRecordMode(true); // Force exit record mode
                else this.manageAudioAndVisuals(); // Will stop audio and update UI
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano) detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano) detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true); 
            else this.manageAudioAndVisuals(); 
        });
        
        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                if (this.deviceStates.soil.connected && // ESP32 must be connected
                    !this.isRecordMode &&              // Not already in record mode
                    this.isActive &&                    // Sensor must be actively sending data
                    this.audioEnabled &&                // Tone.js audio context must be running
                    this.toneInitialized) {             // SoilHandler's Tone components must be ready
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`💧 Record mode not entered. Conditions: soil.connected=${this.deviceStates.soil.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
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
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano) initial state from wsClient: Connected=${this.deviceStates.soil.connected}, Active=${this.isActive}, Condition=${this.currentSoilCondition}`);
        }
        this.updateUI(); 
    }

    updateSoundParameters() { // For generative audio
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode) return; 

        if (this.toyPianoSynth) {
            const dynamicVolumePart = this.currentSoilAppValue * 10; 
            const targetVolume = this.isActive ? (this.baseToyPianoVolume < 0 ? this.baseToyPianoVolume : -18) + dynamicVolumePart : -Infinity;
            this.toyPianoSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.bellLoop && this.bellSynth) {
            let probability = 0;
            let bellVolMod = 0;
            if (this.currentSoilCondition === 'wet') {
                probability = 0.5; bellVolMod = 0;
            } else if (this.currentSoilCondition === 'humid') {
                probability = 0.25; bellVolMod = -4;
            } else { // dry
                probability = 0.1; bellVolMod = -8;
            }
            this.bellLoop.probability = (this.isActive && this.deviceStates.soil.connected) ? probability : 0;
            const targetBellVol = (this.isActive && this.deviceStates.soil.connected) ? (this.baseBellVolume < 0 ? this.baseBellVolume : -24) + bellVolMod : -Infinity;
            this.bellSynth.volume.linearRampTo(targetBellVol, 0.7);
        }

        if (this.toyPianoLoop) {
            if (this.currentSoilAppValue < 0.2) this.toyPianoLoop.interval = "2n";
            else if (this.currentSoilAppValue < 0.6) this.toyPianoLoop.interval = "4n";
            else this.toyPianoLoop.interval = "8n";
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💧 SoilHandler: manageAudioAndVisuals. RecordMode: ${this.isRecordMode}, ExternallyMuted: ${this.isExternallyMuted}, IsActive: ${this.isActive}, Connected: ${this.deviceStates.soil.connected}, AudioEnabled: ${this.audioEnabled}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        // else this.audioEnabled = true; // Already set by handleAudioContextRunning or event

        if (this.isExternallyMuted) { 
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Stop generative
            this.updateUI(); 
            return;
        }

        if (!this.audioEnabled) {
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Stop generative
            if (this.debugMode) console.log(`💧 SoilHandler: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        // If in any phase of record mode (mic input or rhythmic playback), its own logic handles audio.
        // Generative audio should be stopped. UI is updated by enter/exitRecordMode and rhythmicLoop.
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Ensure generative is stopped
            this.updateUI(); // Update UI for record mode (e.g., stop button)
            return;
        }

        // --- Generative audio logic (only if NOT in record mode) ---
        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💧 SoilHandler: Tone not initialized for generative. Attempting initTone.`);
            this.initTone(); 
            if (!this.toneInitialized) { 
                 if (this.debugMode) console.log(`💧 SoilHandler: initTone failed or deferred. Cannot manage generative audio yet.`);
                 this.updateUI(); // Update UI based on current non-audio state
                 return;
            }
        }

        const shouldPlayGenerativeAudio = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; 

        if (shouldPlayGenerativeAudio) {
            if (!this.isPlaying || this.isFadingOut) { // If not playing or was fading out
                this.startAudio(); // Start generative audio
            } else { // Already playing generative
                this.updateSoundParameters(); // Just update its parameters
            }
        } else { // Should NOT play generative audio
            if (this.isPlaying && !this.isFadingOut) { // If it is playing and not already stopping
                this.stopAudio(); // Stop generative audio
            }
        }
        this.updateUI(); // General UI update
    }

    updateUI() {
        // Creature is visible if sensor is connected & active & not externally muted.
        // This applies whether in record mode or generative mode.
        // The actual animation (frame changes) is paused by `triggerCreatureAnimation` if `isCurrentlyRecording` is true.
        const showCreature = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; 
        
        if (this.soilCreatureVisual) {
            const wasCreatureActive = this.soilCreatureVisual.classList.contains('active');
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            
            if (wasCreatureActive && !showCreature) { // If creature is being hidden
                this.soilCreatureCurrentFrame = 0; // Reset frame
                this.soilCreatureVisual.style.backgroundPositionX = '0%';
            }
            // Update creature's appearance based on soil condition if it's shown
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (showCreature) { 
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}`);
            }
        }

        if (this.frameBackground) {
            // Set the main soil background if ESP32 is connected
            this.frameBackground.classList.toggle('soil-connected-bg', this.deviceStates.soil.connected);
            
            // If soil is connected, it might take precedence over other general backgrounds
            if (this.deviceStates.soil.connected) {
                // Example: this.frameBackground.classList.remove('idle-bg', 'light-bg', 'lightsoil-bg');
                // This part needs careful coordination if multiple handlers control frameBackground
            }
            
            // Toggle pulsing effect if in record mode
            this.frameBackground.classList.toggle('record-mode-pulsing', this.isRecordMode); 
        }

        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.style.display = this.isRecordMode ? 'block' : 'none';
        }
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized) {
            if(this.debugMode) console.warn(`💧 Record mode entry blocked. Conditions not met. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }

        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ SoilHandler: navigator.mediaDevices.getUserMedia API is not available. Cannot record. Ensure page is served over HTTPS or on localhost.');
            alert('Microphone access is not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('💧 SoilHandler: Entering Record Mode...');
        this.isRecordMode = true; 
        // isCurrentlyRecording will be true only during the 5s mic input

        this.stopAudio(true); // Force stop generative audio immediately

        this.updateUI(); // Show stop button, pulse, creature remains visible (animation pauses soon)

        // Short delay before starting mic, allows UI to update and user to prepare
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 1000ms

        if (!this.isRecordMode) { // Check if exited during the brief wait
            if(this.debugMode) console.log('💧 Record mode exited during pre-recording wait.');
            return; 
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open(); // Browser permission prompt
            
            if (!this.isRecordMode) { // User might have closed/navigated away during prompt
                if(this.debugMode) console.log('💧 Record mode exited after mic permission prompt.');
                if (this.mic.state === "started") this.mic.close(); 
                this.mic = null;
                return; 
            }

            if (this.debugMode) console.log('💧 SoilHandler: Mic opened.');
            this.isCurrentlyRecording = true; // <<< Mic input phase starts, creature animation pauses
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log('💧 SoilHandler: Recording started for 5 seconds...');

            // Stop recording after duration
            setTimeout(async () => {
                this.isCurrentlyRecording = false; // <<< Mic input phase ends, creature animation can resume with rhythmic notes
                
                if (!this.recorder || !this.isRecordMode) { 
                    if(this.debugMode) console.log('💧 Recording timeout: No longer in active recording state or record mode.');
                    if (this.mic && this.mic.state === "started") this.mic.close();
                    this.mic = null;
                    if (this.recorder && this.recorder.state === "started") {
                        try { await this.recorder.stop(); } catch(e) {/*ignore*/}
                    }
                    // If not in record mode anymore, exitRecordMode should have handled cleanup or will soon.
                    return;
                }
                
                const audioBlob = await this.recorder.stop();
                if (this.mic && this.mic.state === "started") this.mic.close();
                this.mic = null; 
                if (this.debugMode) console.log('💧 SoilHandler: Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { // Check if exited during the recording itself
                     if(this.debugMode) console.log('💧 Record mode exited during recording phase proper.');
                     // exitRecordMode should handle cleanup.
                     return;
                }
                this._setupRhythmicPlayback(audioBlob); // Start rhythmic part

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ SoilHandler: Error during mic recording setup: ${err.message}`, err);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                alert("Microphone permission was denied. Please allow microphone access in your browser settings to use this feature.");
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                alert("No microphone was found. Please ensure a microphone is connected and enabled.");
            } else {
                alert("Could not start recording. See console for details: " + err.message);
            }
            this.isCurrentlyRecording = false; // Ensure this is reset on error
            this.exitRecordMode(true); // Force cleanup and exit record mode
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized) {
            if(this.debugMode) console.warn('💧 Cannot setup rhythmic playback, not in record mode or Tone not ready.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up rhythmic playback. Creature animation will resume with notes.');
        // isCurrentlyRecording is already false here.

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); 
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
        
        this.recordedBufferPlayer = new Tone.Player(this.recordedAudioBlobUrl);
        
        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 }); 
        this.recordedBufferPlayer.connect(this.rhythmFollower); 

        this.recordedBufferPlayer.loop = true;
        this.lastRhythmNoteTime = 0; 

        this.rhythmicLoop = new Tone.Loop(time => {
            if (!this.isRecordMode || !this.rhythmFollower || !this.toyPianoSynth) return; // Check if still in record mode

            const level = this.rhythmFollower.getValue(); 
            const currentTime = Tone.now() * 1000;

            if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                if (this.debugMode && Math.random() < 0.15) console.log(`💧 Rhythm trigger! Level: ${typeof level === 'number' ? level.toFixed(2) : level}`);
                
                const notes = ["C4", "E4", "G4", "A4", "C5"]; 
                const noteToPlay = notes[Math.floor(Math.random() * notes.length)];
                const velocity = 0.6 + (Math.abs(level) - Math.abs(this.rhythmThreshold)) * 0.02; 
                
                this.toyPianoSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.min(0.9, Math.max(0.2, velocity)));
                this.triggerCreatureAnimation(); // Animate creature with rhythmic notes
                if (typeof window.updateNotesDisplay === 'function') {
                    window.updateNotesDisplay(noteToPlay);
                }
                this.lastRhythmNoteTime = currentTime;
            }
        }, "16n").start(0); // Start the loop immediately relative to Transport

        this.recordedBufferPlayer.start().then(() => {
            if (this.debugMode) console.log('💧 Recorded buffer player started for rhythm detection.');
        }).catch(err => {
            console.error('❌ Error starting recorded buffer player:', err);
            this.exitRecordMode(true); // If player fails, exit record mode
        });

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.debugMode) console.log('💧 SoilHandler: Rhythmic playback loop and player started.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) return; // Only exit if actually in record mode (or forced)
        if (this.debugMode) console.log('💧 SoilHandler: Exiting Record Mode...');
        
        this.isRecordMode = false;
        this.isCurrentlyRecording = false; // Ensure this is always reset on exit

        // Stop and dispose mic/recorder first
        if (this.mic && this.mic.state === "started") {
            this.mic.close();
        }
        this.mic = null;

        if (this.recorder) {
            if (this.recorder.state === "started") {
                try { this.recorder.stop(); } catch(e) { /* ignore if already stopped or error */ }
            }
            this.recorder.dispose(); 
            this.recorder = null;
        }

        // Then stop and dispose rhythmic playback components
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

        this.updateUI(); // Update UI (hide stop button, remove pulse)

        if (this.debugMode) console.log('💧 SoilHandler: Record mode exited. Attempting to restore generative audio if conditions met.');
        // manageAudioAndVisuals will check conditions and restart generative audio if appropriate.
        // This will also re-enable creature animation via the generative toyPianoLoop.
        this.manageAudioAndVisuals(); 
    }

    startAudio() { // For generative audio
        if (this.isRecordMode) { 
            if (this.debugMode) console.log("💧 SoilHandler: In record mode, generative audio start (startAudio) prevented.");
            return;
        }
        if (this.isExternallyMuted) { 
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): Attempted to startAudio (generative), but is externally muted.");
            return;
        }
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 SoilHandler (Toypiano): Attempted to startAudio (generative), but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) { // If it was fading out, cancel that
            if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Cancelling fade-out to start/resume generative audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) { // Already playing generative
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): startAudio (generative) called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        
        // Check conditions for generative audio
        if (!this.deviceStates.soil.connected || !this.isActive) { 
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Start generative audio conditions not met (DeviceConnected:${this.deviceStates.soil.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
            console.error("💧 SoilHandler (Toypiano): Critical: Generative Synths/Loops not available in startAudio. Attempting re-init.");
            this.initTone(); 
             if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
                console.error("💧 SoilHandler (Toypiano): Critical: Re-init failed. Cannot start generative audio.");
                return;
             }
        }

        if (this.debugMode) console.log('💧 SoilHandler: Starting generative audio (Toypiano)...');
        this.isPlaying = true; // Generative is playing
        this.isFadingOut = false;
        this.updateSoundParameters(); 
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.bellLoop && this.bellLoop.state !== "started") this.bellLoop.start(0);
        if (this.debugMode) console.log('💧 SoilHandler: Generative audio (Toypiano) started.');
        this.updateUI();
    }

    stopAudio(force = false) { // For generative audio
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💧 SoilHandler (Toypiano): Attempted to stopAudio (generative), but audio system not ready.");
            this.updateUI(); return;
        }
        
        if (!this.isPlaying && !this.isFadingOut && !force) { 
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): stopAudio (generative) called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) { 
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): stopAudio (generative) called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💧 SoilHandler: Stopping generative audio (Toypiano) ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; // Generative is stopping/stopped
        
        if (!force) this.isFadingOut = true;
        else this.isFadingOut = false;

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
            
            // Ensure volumes are set to -Infinity after stopping loops
            if (this.toyPianoSynth && this.toyPianoSynth.volume) this.toyPianoSynth.volume.value = -Infinity;
            if (this.bellSynth && this.bellSynth.volume) this.bellSynth.volume.value = -Infinity;
            
            this.isFadingOut = false; 
            // isPlaying is already false
            if (this.debugMode) console.log('💧 SoilHandler: Generative audio (Toypiano) fully stopped and loops cleared.');
            this.updateUI(); 
        };

        if (force) {
            completeStop();
        } else {
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150)); 
        }
        
        if (!force) { // If not forced, UI update happens now to reflect fading (e.g. creature might hide if isActive becomes false)
            this.updateUI();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initSoilHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
                if (window.soilHandlerInstance.debugMode) console.log('💧 Soil Handler (Toypiano) instance created.');
            }
        } else {
            // Use a default for debugMode if instance isn't created yet for this check
            const tempDebugMode = (window.soilHandlerInstance && typeof window.soilHandlerInstance.debugMode !== 'undefined') 
                                  ? window.soilHandlerInstance.debugMode 
                                  : true; 
            if (tempDebugMode) console.log('💧 Waiting for SoilHandler (Toypiano) dependencies (DOMContentLoaded)...');
            setTimeout(initSoilHandler, 100);
        }
    };
    initSoilHandler();
});

// For potential Node.js/CommonJS environments if you ever use parts of this server-side (unlikely for this file)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}