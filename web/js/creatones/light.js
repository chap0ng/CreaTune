class LightHandler {
    constructor() {
        // Synths and Loops - Generative
        this.ambientSynth = null;
        this.sparkleSynth = null;
        this.mainLoop = null;
        this.sparkleLoop = null;

        // Synth for Record Mode Rhythmic Playback
        this.rhythmicLightSynth = null; 

        // Audio Params
        this.fadeDuration = 1.0;
        this.baseAmbientVolume = 9; 
        this.baseSparkleVolume = 6; 
        this.rhythmicPlaybackVolume = 8; // Volume for synth in record mode

        // State
        this.isActive = false;
        this.isPlaying = false; // True when GENERATIVE audio is playing
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false;

        this.currentLightCondition = "dark"; 
        this.currentLightAppValue = 0.0;    
        this.deviceStates = { 
            light: { connected: false }
        };

        // Sprite Animation State
        this.lightCreatureCurrentFrame = 0;
        this.lightCreatureTotalFrames = 6; // Assuming 6 frames for light-creature-sprites.png

        // DOM Elements
        this.lightCreatureVisual = document.querySelector('.light-creature');
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

        if (!this.lightCreatureVisual && this.debugMode) console.warn('💡 .light-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('💡 .framebackground element not found for LightHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('💡 #stoprecordmode button not found for LightHandler.');

        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) {
        if (this.debugMode) console.log(`💡 LightHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return; 

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`💡 LightHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) {
                if (this.debugMode) console.log(`💡 LightHandler: Externally muted, forcing exit from record mode.`);
                this.exitRecordMode(true); 
            } else if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log('💡 LightHandler: Externally muted, stopping generative audio.');
                this.stopAudio(true); 
            }
        }
        this.manageAudioAndVisuals();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('💡 LightHandler: Core Dependencies ready.');
                this.setupListeners();
                this.updateUI();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('💡 LightHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('💡 LightHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode) {
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) return;
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`💡 LightHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('💡 LightHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('💡 LightHandler: Initializing Tone.js components...');
        try {
            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
            }

            const reverb = new Tone.Reverb(1.5).toDestination();
            const delay = new Tone.FeedbackDelay("4n", 0.25).connect(reverb);

            this.ambientSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fatsawtooth", count: 3, spread: 30 },
                envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5 },
                volume: -Infinity
            }).connect(reverb);

            this.sparkleSynth = new Tone.MetalSynth({
                frequency: 200,
                envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
                harmonicity: 3.1,
                modulationIndex: 16,
                resonance: 4000,
                octaves: 1.5,
                volume: -Infinity
            }).connect(delay);
            
            this.rhythmicLightSynth = new Tone.Synth({ 
                oscillator: { type: 'triangle8' }, // A slightly different timbre
                envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.4 },
                volume: -Infinity
            }).toDestination(); 

            this.createMainLoop();
            this.createSparkleLoop();

            this.toneInitialized = true;
            if (this.debugMode) console.log('💡 LightHandler: Tone.js components initialized successfully.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ LightHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.ambientSynth) { this.ambientSynth.dispose(); this.ambientSynth = null; }
            if (this.sparkleSynth) { this.sparkleSynth.dispose(); this.sparkleSynth = null; }
            if (this.rhythmicLightSynth) { this.rhythmicLightSynth.dispose(); this.rhythmicLightSynth = null; }
            if (this.mainLoop) { this.mainLoop.dispose(); this.mainLoop = null; }
            if (this.sparkleLoop) { this.sparkleLoop.dispose(); this.sparkleLoop = null; }
        }
    }
    
    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) { 
            return; 
        }
        if (this.lightCreatureVisual && this.lightCreatureVisual.classList.contains('active')) {
            this.lightCreatureCurrentFrame = (this.lightCreatureCurrentFrame + 1) % this.lightCreatureTotalFrames;
            // Assumes background-size: 600% 100% for 6 frames (0-5)
            this.lightCreatureVisual.style.backgroundPositionX = (this.lightCreatureCurrentFrame * (100 / this.lightCreatureTotalFrames)) + '%';
        }
    }

    createMainLoop() {
        if (!this.ambientSynth) return;
        const notes = ["C3", "E3", "G3", "B3", "C4", "D4", "A3"]; 
        this.mainLoop = new Tone.Sequence((time, note) => {
            if (!this.isPlaying || !this.ambientSynth || this.ambientSynth.volume.value === -Infinity) return;
            const velocity = this.currentLightAppValue * 0.5 + 0.1; 
            this.ambientSynth.triggerAttackRelease(note, "2n", time, velocity);
            this.triggerCreatureAnimation();
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = note;
        }, notes, "4n");
        this.mainLoop.humanize = true;
    }

    createSparkleLoop() {
        if (!this.sparkleSynth) return;
        this.sparkleLoop = new Tone.Loop(time => {
            if (!this.isPlaying || !this.sparkleSynth || this.sparkleSynth.volume.value === -Infinity) return;
            const freq = Math.random() * 1000 + 500; 
            this.sparkleSynth.triggerAttackRelease(freq, "32n", time, Math.random() * 0.3 + 0.05);
            // Sparkles usually don't have a "note" to display, so we skip note display here.
        }, "8t"); 
        this.sparkleLoop.probability = 0; 
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
                this.deviceStates.light.connected = true;
                if (this.debugMode) console.log(`💡 LightHandler stateChange: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.light.connected} (was ${oldConnected}), condition=${this.currentLightCondition}, appValue=${this.currentLightAppValue}`);
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'light') {
                this.currentLightCondition = data.light_condition || this.currentLightCondition;
                this.currentLightAppValue = data.light_app_value !== undefined ? data.light_app_value : this.currentLightAppValue;
                this.deviceStates.light.connected = true;
                if (!this.isRecordMode && this.isPlaying) this.updateSoundParameters();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device connected.`);
                this.deviceStates.light.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device disconnected.`);
                this.deviceStates.light.connected = false;
                this.isActive = false;
                if (this.isRecordMode) this.exitRecordMode(true);
                else this.manageAudioAndVisuals();
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
                // Check if this creature is the one that should enter record mode
                // This simple check assumes only one creature can be "dominant" for record mode at a time.
                // You might need a more sophisticated global state manager if multiple creatures can be active.
                if (this.deviceStates.light.connected && 
                    !this.isRecordMode &&              
                    this.isActive &&                    
                    this.audioEnabled &&                
                    this.toneInitialized &&
                    !window.soilHandlerInstance?.isRecordMode) { // Prevent if soil is already in record mode             
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`💡 Record mode NOT entered for Light. Conditions: light.connected=${this.deviceStates.light.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, soilRecordMode=${window.soilHandlerInstance?.isRecordMode}`);
                }
            });
        }

        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.addEventListener('click', (event) => {
                event.stopPropagation(); 
                if (this.isRecordMode) { // Only if THIS handler is in record mode
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
        this.updateUI();
    }

    updateSoundParameters() { 
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            return;
        }

        if (this.ambientSynth && this.ambientSynth.volume) {
            const dynamicVolumePart = this.currentLightAppValue * 10; 
            const targetVolume = (this.isActive && this.deviceStates.light.connected) ? this.baseAmbientVolume + dynamicVolumePart : -Infinity;
            this.ambientSynth.volume.linearRampTo(targetVolume, 0.5);
        }

        if (this.sparkleLoop && this.sparkleSynth && this.sparkleSynth.volume) {
            let probability = 0;
            let sparkleVolMod = 0;
            if (this.currentLightCondition === 'bright' || this.currentLightCondition === 'very_bright' || this.currentLightCondition === 'extremely_bright') {
                probability = this.currentLightAppValue * 0.5 + 0.2; 
                sparkleVolMod = 0;
            } else if (this.currentLightCondition === 'dim') {
                probability = this.currentLightAppValue * 0.3 + 0.1; 
                sparkleVolMod = -6;
            } else { 
                probability = this.currentLightAppValue * 0.1; 
                sparkleVolMod = -12;
            }
            this.sparkleLoop.probability = (this.isActive && this.deviceStates.light.connected && this.isPlaying) ? Math.min(0.8, probability) : 0;
            const targetSparkleVol = (this.isActive && this.deviceStates.light.connected) ? this.baseSparkleVolume + sparkleVolMod : -Infinity;
            this.sparkleSynth.volume.linearRampTo(targetSparkleVol, 0.7);
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💡 MAV Start: RecordMode=${this.isRecordMode}, IsPlayingGen=${this.isPlaying}, ExtMuted=${this.isExternallyMuted}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.light.connected}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`💡 MAV: Externally muted or audio not enabled. Stopping all audio.`);
            if (this.isRecordMode) this.exitRecordMode(true); 
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); 
            this.updateUI(); 
            return;
        }
        
        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) { 
                if (this.debugMode) console.log(`💡 MAV: In RecordMode, ensuring generative audio (isPlaying=${this.isPlaying}) is stopped.`);
                this.stopAudio(true); 
            }
            this.updateUI(); 
            return;
        }

        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`💡 MAV: Tone not initialized for generative. Attempting initTone.`);
            this.initTone(); 
            if (!this.toneInitialized) { 
                 if (this.debugMode) console.log(`💡 MAV: initTone failed or deferred. Cannot manage generative audio yet.`);
                 this.updateUI();
                 return;
            }
        }

        const shouldPlayGenerativeAudio = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted; 
        if (this.debugMode) console.log(`💡 MAV: ShouldPlayGenerativeAudio = ${shouldPlayGenerativeAudio}`);

        if (shouldPlayGenerativeAudio) {
            if (!this.isPlaying || this.isFadingOut) { 
                if (this.debugMode) console.log(`💡 MAV: Conditions met, calling startAudio (generative).`);
                this.startAudio(); 
            } else { 
                if (this.debugMode) console.log(`💡 MAV: Generative audio already playing, calling updateSoundParameters.`);
                this.updateSoundParameters(); 
            }
        } else { 
            if (this.isPlaying && !this.isFadingOut) { 
                if (this.debugMode) console.log(`💡 MAV: Conditions NOT met for generative audio, calling stopAudio.`);
                this.stopAudio(); 
            }
        }
        this.updateUI(); 
        if (this.debugMode) console.log(`💡 MAV End. IsPlayingGen=${this.isPlaying}`);
    }

    updateUI() {
        const showCreature = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted; 
        
        if (this.lightCreatureVisual) {
            const wasCreatureActive = this.lightCreatureVisual.classList.contains('active');
            this.lightCreatureVisual.classList.toggle('active', showCreature);
            if (wasCreatureActive && !showCreature) { 
                this.lightCreatureCurrentFrame = 0; 
                this.lightCreatureVisual.style.backgroundPositionX = '0%';
            }
            this.lightCreatureVisual.classList.remove('light-dark', 'light-dim', 'light-bright', 'light-very-bright', 'light-extremely-bright');
            if (showCreature) { 
                this.lightCreatureVisual.classList.add(`light-${this.currentLightCondition.replace('_', '-')}`);
            }
        }

        if (this.frameBackground) {
            const frameActive = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted;
            this.frameBackground.classList.toggle('light-active-bg', frameActive); // Generic active class
            this.frameBackground.classList.remove('light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg');
            if(frameActive) {
                this.frameBackground.classList.add(`light-${this.currentLightCondition.replace('_', '-')}-bg`);
            }
            // Handle record mode pulsing, ensuring it doesn't conflict with soil's
            // This assumes only one can be in record mode. If both, the last one to set it wins.
            this.frameBackground.classList.toggle('record-mode-pulsing', this.isRecordMode);
        }

        if (this.stopRecordModeButton) {
            // Show button if this handler is in record mode.
            // If another handler (e.g. soil) is in record mode, its updateUI will handle the button.
            // This could be problematic if both try to control it simultaneously.
            // A better approach might be a global manager for the button if multiple handlers can be in record mode.
            // For now, this will make the button visible if *this* instance is in record mode.
            this.stopRecordModeButton.style.display = this.isRecordMode ? 'block' : 'none';
        }
    }

    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized) {
            if(this.debugMode) console.warn(`💡 enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }
        if (window.soilHandlerInstance && window.soilHandlerInstance.isRecordMode) {
            if(this.debugMode) console.warn(`💡 enterRecordMode: Blocked. Soil creature is already in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ enterRecordMode: getUserMedia API not available. Ensure HTTPS or localhost.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('💡 enterRecordMode: Starting...');
        this.isRecordMode = true; 
        
        if (this.debugMode) console.log('💡 enterRecordMode: Stopping generative audio forcefully.');
        this.stopAudio(true); 

        this.updateUI(); 

        await new Promise(resolve => setTimeout(resolve, 200)); 

        if (!this.isRecordMode) { 
            if(this.debugMode) console.log('💡 enterRecordMode: Exited during pre-recording wait. Not proceeding with mic.');
            return; 
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open(); 
            
            if (!this.isRecordMode) { 
                if(this.debugMode) console.log('💡 enterRecordMode: Exited after mic permission prompt.');
                if (this.mic.state === "started") this.mic.close(); 
                this.mic = null;
                return; 
            }

            if (this.debugMode) console.log('💡 enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true; 
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log(`💡 enterRecordMode: Recording started for ${this.recordingDuration / 1000} seconds...`);

            setTimeout(async () => {
                this.isCurrentlyRecording = false; 
                if (!this.recorder || !this.isRecordMode) { 
                    if(this.debugMode) console.log('💡 enterRecordMode (timeout): No longer in active recording state or record mode. Aborting rhythmic setup.');
                    if (this.mic && this.mic.state === "started") this.mic.close();
                    this.mic = null;
                    if (this.recorder && this.recorder.state === "started") {
                        try { await this.recorder.stop(); } catch(e) {/*ignore*/}
                    }
                    if (this.isRecordMode) this.exitRecordMode(true); // Force exit if state is inconsistent
                    return;
                }
                
                const audioBlob = await this.recorder.stop();
                if (this.mic && this.mic.state === "started") this.mic.close();
                this.mic = null; 
                if (this.debugMode) console.log('💡 enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) { 
                     if(this.debugMode) console.log('💡 enterRecordMode (timeout): Exited during recording phase proper. Not setting up rhythmic playback.');
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
        if (!this.isRecordMode || !this.toneInitialized || !this.rhythmicLightSynth) {
            if(this.debugMode) console.warn(`💡 _setupRhythmicPlayback: Blocked. isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, rhythmicLightSynth=${!!this.rhythmicLightSynth}. Forcing exit.`);
            this.exitRecordMode(true); 
            return;
        }
        if (this.debugMode) console.log('💡 _setupRhythmicPlayback: Starting...');
        
        if (this.rhythmicLightSynth && this.rhythmicLightSynth.volume) {
            this.rhythmicLightSynth.volume.value = this.rhythmicPlaybackVolume; 
            if (this.debugMode) console.log(`💡 _setupRhythmicPlayback: rhythmicLightSynth volume set to ${this.rhythmicPlaybackVolume} dB.`);
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
                    if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Record mode exited while buffer was loading. Aborting start.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    return;
                }
                if (!this.recordedBufferPlayer) { // Safety check
                     if (this.debugMode) console.warn('💡 _setupRhythmicPlayback (onload): recordedBufferPlayer became null before operations. Aborting.'); return;
                }

                if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Recorded buffer player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower); 
                // this.recordedBufferPlayer.toDestination(); // Uncomment if you want to hear the recording
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Recorded buffer player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.rhythmicLightSynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                        return;
                    }

                    const level = this.rhythmFollower.getValue(); 
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        const notes = ["C5", "D5", "E5", "G5", "A5"]; // Higher notes for light
                        const noteToPlay = notes[Math.floor(Math.random() * notes.length)];
                        const velocity = 0.3 + (Math.min(15, Math.max(0, level - this.rhythmThreshold)) * 0.03); // Adjusted scaling
                        
                        if (this.debugMode && Math.random() < 0.3) console.log(`💡 Rhythmic trigger! Level: ${typeof level === 'number' ? level.toFixed(2) : level}, Note: ${noteToPlay}, Velocity: ${velocity.toFixed(2)}`);
                        
                        this.rhythmicLightSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.min(0.8, velocity));
                        this.triggerCreatureAnimation(); 
                        const noteDisplayElement = document.querySelector('#notes-display p');
                        if (noteDisplayElement) noteDisplayElement.textContent = noteToPlay;
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0); 
                if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Rhythmic loop initiated.');
            },
            onerror: (err) => {
                console.error('❌ _setupRhythmicPlayback: Error loading recorded buffer player for Light:', err);
                this.exitRecordMode(true); 
            }
        });

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
        if (this.debugMode) console.log('💡 _setupRhythmicPlayback: Setup initiated, player loading asynchronously.');
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) { 
            return;
        }
        if (this.debugMode) console.log(`💡 exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`);
        
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

        if (this.rhythmicLightSynth && this.rhythmicLightSynth.volume) {
             this.rhythmicLightSynth.volume.value = -Infinity; // Silence the record mode synth
        }
        // Reset generative synth volumes too, as they might have been muted
        if (this.ambientSynth && this.ambientSynth.volume) this.ambientSynth.volume.value = -Infinity;
        if (this.sparkleSynth && this.sparkleSynth.volume) this.sparkleSynth.volume.value = -Infinity;
        
        this.isPlaying = false; 
        this.isFadingOut = false;
        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        if (this.debugMode) console.log(`💡 exitRecordMode: Cleanup complete.`);
        
        this.updateUI(); // Update UI first to hide record mode elements
        
        if (wasRecordMode || force) { // If it was in record mode, or forced, reassess generative audio
            this.manageAudioAndVisuals(); 
        }
        if (this.debugMode) console.log(`💡 exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}, isPlayingGen is ${this.isPlaying}`);
    }

    startAudio() { // For GENERATIVE audio
        if (this.isRecordMode) { 
            if (this.debugMode) console.log("💡 startAudio (generative): Blocked, in record mode.");
            return;
        }
        if (this.isExternallyMuted || !this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn(`💡 startAudio (generative): Blocked. ExtMuted=${this.isExternallyMuted}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);
            this.updateUI(); return;
        }
        if (this.isFadingOut) { 
            if (this.debugMode) console.log('💡 startAudio (generative): Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) { 
            if (this.debugMode) console.log("💡 startAudio (generative): Called, but already playing. Ensuring params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        if (!this.deviceStates.light.connected || !this.isActive) { 
            if (this.debugMode) console.log(`💡 startAudio (generative): Conditions not met (DeviceConnected:${this.deviceStates.light.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
            console.error("❌ startAudio (generative) Light: Critical: Synths/Loops not available. Attempting re-init.");
            this.initTone(); 
             if (!this.ambientSynth || !this.sparkleSynth || !this.mainLoop || !this.sparkleLoop) {
                console.error("❌ startAudio (generative) Light: Critical: Re-init failed. Cannot start.");
                return;
             }
             if (this.isPlaying) return; // Re-check after init
        }

        if (this.debugMode) console.log('💡 startAudio (generative): Starting...');
        this.isPlaying = true; 
        this.isFadingOut = false;
        
        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
        
        this.updateSoundParameters(); 

        if (this.mainLoop && this.mainLoop.state !== "started") this.mainLoop.start(0);
        if (this.sparkleLoop && this.sparkleLoop.state !== "started") this.sparkleLoop.start(0);
        
        if (this.debugMode) console.log('💡 startAudio (generative): Loops started. isPlayingGen is true.');
        this.updateUI();
    }

    stopAudio(force = false) { // For GENERATIVE audio
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("💡 stopAudio (generative): Audio system not ready. Forcing isPlaying=false.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) { 
            return;
        }
        if (this.isFadingOut && !force) { 
            return;
        }

        if (this.debugMode) console.log(`💡 stopAudio (generative): Stopping. Forced: ${force}, WasPlaying: ${this.isPlaying}, WasFading: ${this.isFadingOut}`);
        
        const wasPlaying = this.isPlaying;
        this.isPlaying = false; 
        
        if (!force && wasPlaying) { 
            this.isFadingOut = true;
        } else {
            this.isFadingOut = false; 
        }

        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.ambientSynth && this.ambientSynth.volume) {
            this.ambientSynth.volume.cancelScheduledValues(Tone.now());
            this.ambientSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.sparkleSynth && this.sparkleSynth.volume) {
            this.sparkleSynth.volume.cancelScheduledValues(Tone.now());
            this.sparkleSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        
        const completeStop = () => {
            if (this.mainLoop && this.mainLoop.state === "started") this.mainLoop.stop(0);
            if (this.sparkleLoop && this.sparkleLoop.state === "started") this.sparkleLoop.stop(0);
            
            if (this.ambientSynth && this.ambientSynth.volume) this.ambientSynth.volume.value = -Infinity;
            if (this.sparkleSynth && this.sparkleSynth.volume) this.sparkleSynth.volume.value = -Infinity;
            
            this.isFadingOut = false; 
            if (this.debugMode) console.log('💡 stopAudio (generative): Fully stopped and loops cleared.');
            this.updateUI(); 
        };

        if (force || !wasPlaying) { 
            completeStop();
        } else { 
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150)); 
        }
        
        if (!force || !wasPlaying) { // Update UI immediately if not fading or forced
             this.updateUI();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initLightHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.lightHandlerInstance) {
                window.lightHandlerInstance = new LightHandler();
                if (window.lightHandlerInstance.debugMode) console.log('💡 Light Handler instance created.');
            }
        } else {
            const tempDebugMode = (window.lightHandlerInstance && typeof window.lightHandlerInstance.debugMode !== 'undefined') 
                                  ? window.lightHandlerInstance.debugMode : true; 
            if (tempDebugMode) console.log('💡 Waiting for LightHandler dependencies (DOMContentLoaded)...');
            setTimeout(initLightHandler, 100);
        }
    };
    initLightHandler();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LightHandler;
}