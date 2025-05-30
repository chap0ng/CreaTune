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
        this.isActive = false;
        this.isPlaying = false;
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
        this.stopRecordModeButton = document.getElementById('stoprecordmode'); // Using your existing ID

        // Record Mode Properties
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null; // Will play the recorded audio (muted) for rhythm detection
        this.rhythmFollower = null;     // Meter to detect rhythm
        this.rhythmicLoop = null;       // Tone.Loop to trigger notes based on rhythm
        this.recordingDuration = 5000;  // 5 seconds for recording
        this.rhythmThreshold = -30;     // dB threshold for triggering notes (NEEDS TUNING)
        this.rhythmNoteCooldown = 150;  // ms cooldown between rhythmically triggered notes
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null; // To store and revoke blob URL

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
            if (this.isRecordMode) this.exitRecordMode(true); // Force exit record mode
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
        if (!this.toneInitialized && !this.isRecordMode) { // Don't auto-init if about to enter record mode
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
        // Optionally, disable creature animation during mic recording phase
        // if (this.isCurrentlyRecording) return; 

        if (this.soilCreatureVisual && this.soilCreatureVisual.classList.contains('active')) {
            this.soilCreatureCurrentFrame++; 
            if (this.soilCreatureCurrentFrame >= this.soilCreatureTotalFrames) {
                this.soilCreatureCurrentFrame = 0; 
            }
            const newPositionX = (this.soilCreatureCurrentFrame * 20) + '%';
            this.soilCreatureVisual.style.backgroundPositionX = newPositionX;

            if (this.debugMode && Math.random() < 0.2) {
                 console.log(`💧 Soil Creature frame index: ${this.soilCreatureCurrentFrame}, backgroundPositionX set to: ${newPositionX}`);
            }
        }
    }

    createToyPianoPattern() {
        if (!this.toyPianoSynth) return;
        const toyPianoNotes = ["C4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
        this.toyPianoLoop = new Tone.Pattern((time, note) => {
            const velocity = Math.max(0.3, this.currentSoilAppValue * 0.7 + 0.2);
            this.toyPianoSynth.triggerAttackRelease(note, "8n", time, velocity);
            this.triggerCreatureAnimation(); 
            if (typeof window.updateNotesDisplay === 'function') { // Update notes display
                window.updateNotesDisplay(note);
            }
        }, toyPianoNotes, "randomWalk");
        this.toyPianoLoop.interval = "4n";
        this.toyPianoLoop.humanize = "16n";
    }

    createBellPattern() {
        if (!this.bellSynth) return;
        const bellPitches = ["C6", "E6", "G6", "A6", "C7"];
        this.bellLoop = new Tone.Loop(time => {
            const pitch = bellPitches[Math.floor(Math.random() * bellPitches.length)];
            const velocity = Math.random() * 0.3 + 0.3;
            this.bellSynth.triggerAttackRelease(pitch, "16n", time, velocity);
        }, "2n");
        this.bellLoop.probability = 0.0;
        this.bellLoop.humanize = "32n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 SoilHandler (Toypiano): window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Setting up WebSocket and DOM listeners...');

        // WebSocket Listeners
        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano) stateChange: active=${state.active}, condition=${state.rawData.soil_condition}, appValue=${state.rawData.moisture_app_value}`);
                this.isActive = state.active;
                this.currentSoilCondition = state.rawData.soil_condition || "dry";
                this.currentSoilAppValue = state.rawData.moisture_app_value || 0.0;
                this.deviceStates.soil.connected = true; 
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.currentSoilCondition = data.soil_condition || this.currentSoilCondition;
                this.currentSoilAppValue = data.moisture_app_value !== undefined ? data.moisture_app_value : this.currentSoilAppValue;
                this.deviceStates.soil.connected = true; 
                if (!this.isRecordMode) this.updateSoundParameters(); 
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Soil device connected.`);
                this.deviceStates.soil.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning(); 
                else this.manageAudioAndVisuals(); 
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Soil device disconnected.`);
                this.deviceStates.soil.connected = false;
                this.isActive = false; 
                if (this.isRecordMode) this.exitRecordMode(true); 
                else this.manageAudioAndVisuals();
            }
        });

        // Audio Enabler Events
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
        
        // Record Mode Listeners
        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                // Check if soil is connected (which would apply 'soil-connected-bg')
                // AND not already in record mode
                // AND sensor is active
                // AND audio system is ready
                if (this.deviceStates.soil.connected && 
                    !this.isRecordMode && 
                    this.isActive && 
                    this.audioEnabled && 
                    this.toneInitialized) {
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

        // Initial state from WebSocket client
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

    updateSoundParameters() {
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
            } else { 
                probability = 0.1; bellVolMod = -8;
            }
            this.bellLoop.probability = this.isActive ? probability : 0;
            const targetBellVol = this.isActive ? (this.baseBellVolume < 0 ? this.baseBellVolume : -24) + bellVolMod : -Infinity;
            this.bellSynth.volume.linearRampTo(targetBellVol, 0.7);
        }

        if (this.toyPianoLoop) {
            if (this.currentSoilAppValue < 0.2) this.toyPianoLoop.interval = "2n";
            else if (this.currentSoilAppValue < 0.6) this.toyPianoLoop.interval = "4n";
            else this.toyPianoLoop.interval = "8n";
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💧 SoilHandler: manageAudioAndVisuals. RecordMode: ${this.isRecordMode}, ExternallyMuted: ${this.isExternallyMuted}, IsActive: ${this.isActive}, Connected: ${this.deviceStates.soil.connected}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        else this.audioEnabled = true;

        if (this.isExternallyMuted) { 
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
            this.updateUI(); 
            return;
        }

        if (!this.audioEnabled) {
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
            if (this.debugMode) console.log(`💧 SoilHandler: AudioContext not running or audio disabled. Audio remains off.`);
            this.updateUI();
            return;
        }
        
        if (this.isRecordMode) {
            this.updateUI(); 
            return;
        }

        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💧 SoilHandler: Tone not initialized. Attempting initTone.`);
            this.initTone(); 
            if (!this.toneInitialized) { 
                 if (this.debugMode) console.log(`💧 SoilHandler: initTone failed or deferred. Cannot manage audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayGenerativeAudio = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted; 

        if (shouldPlayGenerativeAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                this.startAudio();
            } else { 
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
        // --- Soil Creature Visuals (remains the same) ---
        const showCreature = this.deviceStates.soil.connected && this.isActive && !this.isExternallyMuted && !this.isRecordMode; 
        if (this.soilCreatureVisual) {
            const wasActive = this.soilCreatureVisual.classList.contains('active');
            this.soilCreatureVisual.classList.toggle('active', showCreature);
            
            if (wasActive && !showCreature) {
                this.soilCreatureCurrentFrame = 0;
                this.soilCreatureVisual.style.backgroundPositionX = '0%';
            }
            // The soil-creature itself can still have its condition-specific classes
            this.soilCreatureVisual.classList.remove('soil-dry', 'soil-humid', 'soil-wet');
            if (showCreature) { 
                this.soilCreatureVisual.classList.add(`soil-${this.currentSoilCondition.replace('_', '-')}`);
            }
        }

        // --- Frame Background Visuals (Simplified for Soil) ---
        if (this.frameBackground) {
            // 1. Set the primary soil background if the device is connected.
            // This assumes other handlers (idle, light, etc.) will remove 'soil-connected-bg'
            // and add their own (e.g., 'idle-bg') when they become active.
            // If soil is connected, we ensure its background is set.
            // If soil is NOT connected, we remove its specific background class.
            this.frameBackground.classList.toggle('soil-connected-bg', this.deviceStates.soil.connected);

            // 2. Remove other potential background classes if soil is becoming active.
            // This is a simple approach. A more robust system might involve a central UI manager
            // to prevent conflicting background classes.
            if (this.deviceStates.soil.connected) {
                this.frameBackground.classList.remove('idle-bg', 'light-bg', 'lightsoil-bg'); // Example classes
            }
            
            // 3. Handle record mode pulsing. This is applied on top of any current background.
            this.frameBackground.classList.toggle('record-mode-pulsing', this.isRecordMode);
        }

        // --- Stop Record Mode Button ---
        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.style.display = this.isRecordMode ? 'block' : 'none';
        }
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized) {
            if(this.debugMode) console.warn(`💧 Record mode entry blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Entering Record Mode...');
        this.isRecordMode = true;

        this.stopAudio(true); 

        this.updateUI(); 

        await new Promise(resolve => setTimeout(resolve, 1000)); 

        if (!this.isRecordMode) { 
            if(this.debugMode) console.log('💧 Record mode exited during pre-recording wait.');
            return; 
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();
            
            if (!this.isRecordMode) { 
                if(this.debugMode) console.log('💧 Record mode exited after mic permission prompt.');
                this.mic.close(); 
                this.mic = null;
                return; 
            }

            if (this.debugMode) console.log('💧 SoilHandler: Mic opened.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log('💧 SoilHandler: Recording started...');

            setTimeout(async () => {
                if (!this.isCurrentlyRecording || !this.recorder || !this.isRecordMode) {
                    if(this.debugMode) console.log('💧 Recording timeout fired, but no longer recording or in record mode.');
                    if (this.mic && this.mic.state === "started") this.mic.close();
                    this.isCurrentlyRecording = false;
                    return;
                }
                
                const audioBlob = await this.recorder.stop();
                this.isCurrentlyRecording = false;
                if (this.mic && this.mic.state === "started") this.mic.close();
                this.mic = null; 
                if (this.debugMode) console.log('💧 SoilHandler: Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { 
                     if(this.debugMode) console.log('💧 Record mode exited during recording phase.');
                     return;
                }
                this._setupRhythmicPlayback(audioBlob);

            }, this.recordingDuration);

        } catch (err) {
            console.error('❌ SoilHandler: Error during mic recording setup:', err);
            this.exitRecordMode(true); 
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (!this.isRecordMode || !this.toneInitialized) {
            if(this.debugMode) console.warn('💧 Cannot setup rhythmic playback, not in record mode or Tone not ready.');
            return;
        }
        if (this.debugMode) console.log('💧 SoilHandler: Setting up rhythmic playback.');

        if (this.recordedAudioBlobUrl) URL.revokeObjectURL(this.recordedAudioBlobUrl); 
        this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
        
        this.recordedBufferPlayer = new Tone.Player(this.recordedAudioBlobUrl);
        
        this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 }); 
        this.recordedBufferPlayer.connect(this.rhythmFollower); 

        this.recordedBufferPlayer.loop = true;
        this.lastRhythmNoteTime = 0; 

        this.rhythmicLoop = new Tone.Loop(time => {
            if (!this.isRecordMode || !this.rhythmFollower || !this.toyPianoSynth) return;

            const level = this.rhythmFollower.getValue(); 
            const currentTime = Tone.now() * 1000;

            if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                if (this.debugMode && Math.random() < 0.15) console.log(`💧 Rhythm trigger! Level: ${typeof level === 'number' ? level.toFixed(2) : level}`);
                
                const notes = ["C4", "E4", "G4", "A4", "C5"]; 
                const noteToPlay = notes[Math.floor(Math.random() * notes.length)];
                const velocity = 0.6 + (Math.abs(level) - Math.abs(this.rhythmThreshold)) * 0.02; 
                
                this.toyPianoSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.min(0.9, Math.max(0.2, velocity)));
                this.triggerCreatureAnimation(); 
                if (typeof window.updateNotesDisplay === 'function') {
                    window.updateNotesDisplay(noteToPlay);
                }
                this.lastRhythmNoteTime = currentTime;
            }
        }, "16n").start(0);

        this.recordedBufferPlayer.start().then(() => {
            if (this.debugMode) console.log('💧 Recorded buffer player started for rhythm detection.');
        }).catch(err => {
            console.error('❌ Error starting recorded buffer player:', err);
            this.exitRecordMode(true);
        });

        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.debugMode) console.log('💧 SoilHandler: Rhythmic playback loop and player started.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) return;
        if (this.debugMode) console.log('💧 SoilHandler: Exiting Record Mode...');
        
        this.isRecordMode = false;
        this.isCurrentlyRecording = false; 

        if (this.mic && this.mic.state === "started") {
            this.mic.close();
        }
        this.mic = null;

        if (this.recorder) {
            if (this.recorder.state === "started") {
                this.recorder.stop(); 
            }
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

        this.updateUI(); 

        if (this.debugMode) console.log('💧 SoilHandler: Record mode exited. Attempting to restore generative audio.');
        this.manageAudioAndVisuals(); 
    }

    startAudio() {
        if (this.isRecordMode) { 
            if (this.debugMode) console.log("💧 SoilHandler: In record mode, generative audio start prevented.");
            return;
        }
        if (this.isExternallyMuted) { 
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): Attempted to startAudio, but is externally muted.");
            return;
        }
        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn("💧 SoilHandler (Toypiano): Attempted to startAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('💧 SoilHandler (Toypiano): Cancelling fade-out to start/resume audio.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): startAudio called, but already playing. Ensuring volumes.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        
        if (!this.deviceStates.soil.connected || !this.isActive) { 
            if (this.debugMode) console.log(`💧 SoilHandler (Toypiano): Start audio conditions not met (DeviceConnected:${this.deviceStates.soil.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
            console.error("💧 SoilHandler (Toypiano): Critical: Synths/Loops not available in startAudio. Attempting re-init.");
            this.initTone(); 
             if (!this.toyPianoSynth || !this.bellSynth || !this.toyPianoLoop || !this.bellLoop) {
                console.error("💧 SoilHandler (Toypiano): Critical: Re-init failed. Cannot start audio.");
                return;
             }
        }

        if (this.debugMode) console.log('💧 SoilHandler: Starting audio (Toypiano)...');
        this.isPlaying = true; this.isFadingOut = false;
        this.updateSoundParameters(); 
        if (Tone.Transport.state !== "started") Tone.Transport.start();
        if (this.toyPianoLoop && this.toyPianoLoop.state !== "started") this.toyPianoLoop.start(0);
        if (this.bellLoop && this.bellLoop.state !== "started") this.bellLoop.start(0);
        if (this.debugMode) console.log('💧 SoilHandler: Audio (Toypiano) started.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💧 SoilHandler (Toypiano): Attempted to stopAudio, but audio system not ready.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { 
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): stopAudio called, but already stopped.");
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) { 
            if (this.debugMode) console.log("💧 SoilHandler (Toypiano): stopAudio called, but already fading out.");
            return;
        }

        if (this.debugMode) console.log(`💧 SoilHandler: Stopping audio (Toypiano) ${force ? '(forced)' : '(with fade-out)'}...`);
        this.isPlaying = false; 
        
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
            
            if (this.toyPianoSynth && this.toyPianoSynth.volume) this.toyPianoSynth.volume.value = -Infinity;
            if (this.bellSynth && this.bellSynth.volume) this.bellSynth.volume.value = -Infinity;
            
            this.isFadingOut = false; 
            this.isPlaying = false; 
            if (this.debugMode) console.log('💧 SoilHandler: Audio (Toypiano) fully stopped and loops cleared.');
            this.updateUI(); 
        };

        if (force) {
            completeStop();
        } else {
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150)); 
        }
        
        if (!force) { 
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
            const tempDebugMode = (window.soilHandlerInstance && window.soilHandlerInstance.debugMode !== undefined) 
                                  ? window.soilHandlerInstance.debugMode 
                                  : true; 
            if (tempDebugMode) console.log('💧 Waiting for SoilHandler (Toypiano) dependencies (DOMContentLoaded)...');
            setTimeout(initSoilHandler, 100);
        }
    };
    initSoilHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}