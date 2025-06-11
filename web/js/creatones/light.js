class LightHandler {
    constructor() {
        // Synths and Loops - Generative
        this.ambientSynth = null;
        this.sparkleSynth = null;
        this.woodenPluckSynth = null; // ADDED: For wooden sound
        this.mainLoop = null;
        this.sparkleLoop = null;
        this.woodenPluckLoop = null; // ADDED: Loop for wooden sound
        this.mainSynth = null;
        this.sparkleSynth = null;
        this.woodenPluckSynth = null; // Ensure this is here
        this.mainVolume = null; // Add if not present, for overall control

        // Audio Params
        this.fadeDuration = 1.5;
        this.baseMainVolume = 6; // Example
        this.baseSparkleVolume = 9; // Example
        this.baseWoodenPluckVolume = 3; // Example
        this.rhythmicPlaybackVolume = 9; // Volume for recorded playback

        // State
        this.isActive = false;
        this.isPlaying = false; // True when GENERATIVE audio is playing
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true; // Keep this for conditional logging
        this.stopTimeoutId = null;
        this.isExternallyMuted = false;

        this.currentLightCondition = "dark"; 
        this.currentLightAppValue = 0.0;    
        this.deviceStates = { 
            light: { connected: false }
        };

        // Sprite Animation State
        this.lightCreatureCurrentFrame = 0;
        this.lightCreatureTotalFrames = 6; 

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

        // Note Display
        this.noteDisplayTimeoutId = null; 
        this.lastDisplayedNote = null;    

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
        if (this.toneInitialized) {
            if (this.debugMode) console.log('💡 LightHandler initTone: Already initialized.');
            return;
        }
        if (this.debugMode) console.log('💡 LightHandler initTone: Initializing Tone.js components...');

        // Dispose existing components if any (robust re-initialization)
        this.mainVolume?.dispose();
        this.mainSynth?.dispose();
        this.sparkleSynth?.dispose();
        this.woodenPluckSynth?.dispose();
        this.mainLoop?.dispose();
        this.sparkleLoop?.dispose();
        this.woodenPluckLoop?.dispose();

        this.mainVolume = new Tone.Volume(this.baseMainVolume).toDestination();

        this.mainSynth = new Tone.FMSynth({
            harmonicity: 1.5,
            modulationIndex: 5,
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.8 },
            modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 }
        }).connect(this.mainVolume);

        this.sparkleSynth = new Tone.MetalSynth({
            frequency: 300,
            envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
            harmonicity: 3.1,
            modulationIndex: 16,
            resonance: 3000,
            octaves: 1.5
        }).connect(this.mainVolume);
        this.sparkleSynth.volume.value = this.baseSparkleVolume;


        this.woodenPluckSynth = new Tone.PluckSynth({ // ADDED
            attackNoise: 0.5,
            dampening: 6000,
            resonance: 0.85
        }).connect(this.mainVolume);
        this.woodenPluckSynth.volume.value = this.baseWoodenPluckVolume;


        this.createMainLoop();
        this.createSparkleLoop();
        this.createWoodenPluckLoop(); // ADDED

        this.toneInitialized = true;
        if (this.debugMode) console.log('💡 LightHandler initTone: Tone.js components initialized.');
        this.manageAudioAndVisuals(); // Re-evaluate audio state
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) {
            return;
        }
        if (this.lightCreatureVisual && this.lightCreatureVisual.classList.contains('active')) {
            this.lightCreatureCurrentFrame = (this.lightCreatureCurrentFrame + 1) % this.lightCreatureTotalFrames;
            this.lightCreatureVisual.style.backgroundPositionX = (this.lightCreatureCurrentFrame * 20) + '%';
            // Reduced log spam for animation
            if (this.debugMode && Math.random() < 0.01) { // Log only 1% of the time
                 console.log(`💡 Light Creature Animation: Frame ${this.lightCreatureCurrentFrame}`);
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
                if (noteDisplayElement.textContent === this.lastDisplayedNote) {
                    noteDisplayElement.textContent = '-';
                }
            }, 750); 
        }
    }

    createMainLoop() {
        if (this.mainLoop) { this.mainLoop.dispose(); this.mainLoop = null; } // Ensure clean slate
        const notes = ["C4", "E4", "G4", "A4", "C5"];
        this.mainLoop = new Tone.Loop(time => {
            if (!this.isPlaying || this.isRecordMode || !this.mainSynth || this.isExternallyMuted) return;
            const note = notes[Math.floor(Math.random() * notes.length)];
            this.mainSynth.triggerAttackRelease(note, "8n", time, Math.random() * 0.3 + 0.2);
            this._displayNote(note);
            this.triggerCreatureAnimation();
        }, "0:1").set({ probability: 0.7, humanize: "16n" });
    }

    createSparkleLoop() {
        if (this.sparkleLoop) { this.sparkleLoop.dispose(); this.sparkleLoop = null; } // Ensure clean slate
        this.sparkleLoop = new Tone.Loop(time => {
            if (!this.isPlaying || this.isRecordMode || !this.sparkleSynth || this.isExternallyMuted) return;
            this.sparkleSynth.triggerAttackRelease("16n", time, Math.random() * 0.2 + 0.05);
            // No _displayNote for sparkles to avoid spam
            this.triggerCreatureAnimation();
        }, "0:0:2").set({ probability: 0.3, humanize: true }); // Faster, more sparse
    }

    createWoodenPluckLoop() { // ADDED
        if (this.woodenPluckLoop) { this.woodenPluckLoop.dispose(); this.woodenPluckLoop = null; }
        const pluckNotes = ["G3", "C4", "D4", "F4"];
        this.woodenPluckLoop = new Tone.Loop(time => {
            if (!this.isPlaying || this.isRecordMode || !this.woodenPluckSynth || this.isExternallyMuted) return;
            const note = pluckNotes[Math.floor(Math.random() * pluckNotes.length)];
            this.woodenPluckSynth.triggerAttackRelease(note, "4n", time, Math.random() * 0.4 + 0.3);
            this._displayNote(note);
            this.triggerCreatureAnimation();
        }, "0:2").set({ probability: 0.5, humanize: "8n" });
    }


    setupListeners() {
        if (!window.creatune) {
            console.error('💡 LightHandler: window.creatune not available.');
            return;
        }
        if (this.debugMode) console.log('💡 LightHandler: Setting up listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'light') {
                const oldActive = this.isActive;
                const oldConnected = this.deviceStates.light.connected;
                this.isActive = state.active;
                this.currentLightCondition = state.rawData.light_condition || "dim";
                this.currentLightAppValue = state.rawData.light_app_value !== undefined ? state.rawData.light_app_value : 0.0;
                this.deviceStates.light.connected = true; // stateChange implies connection

                if (this.debugMode) console.log(`💡 LightHandler stateChange: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.light.connected} (was ${oldConnected}), condition=${this.currentLightCondition}, appValue=${this.currentLightAppValue.toFixed(2)}`);
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'light') {
                // Only update if values actually change to reduce processing
                let changed = false;
                if (data.light_condition && this.currentLightCondition !== data.light_condition) {
                    this.currentLightCondition = data.light_condition;
                    changed = true;
                }
                if (data.light_app_value !== undefined && this.currentLightAppValue !== data.light_app_value) {
                    this.currentLightAppValue = data.light_app_value;
                    changed = true;
                }
                this.deviceStates.light.connected = true; // data implies connection

                if (changed && !this.isRecordMode && this.isPlaying) {
                     this.updateSoundParameters();
                }
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device connected event.`);
                this.deviceStates.light.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals(); // If context not running, MAV will handle it
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'light') {
                if (this.debugMode) console.log(`💡 LightHandler: Light device disconnected event.`);
                this.deviceStates.light.connected = false;
                this.isActive = false; // Sensor disconnected means it's not active
                if (this.isRecordMode) {
                    this.exitRecordMode(true); // Force exit record mode
                } else {
                    this.manageAudioAndVisuals(); // This will call stopAudio if needed
                }
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
            else this.manageAudioAndVisuals(); // This will call stopAudio(true)
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                if (this.deviceStates.light.connected &&
                    !this.isRecordMode &&
                    this.isActive &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    // Check other handlers are NOT in record mode
                    (!window.soilHandlerInstance || !window.soilHandlerInstance.isRecordMode) &&
                    (!window.temperatureHandlerInstance || !window.temperatureHandlerInstance.isRecordMode) &&
                    (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode) &&
                    (!window.tempSoilHandlerInstance || !window.tempSoilHandlerInstance.isRecordMode) &&
                    (!window.tempLightHandlerInstance || !window.tempLightHandlerInstance.isRecordMode)
                ) {
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    // Log removed to reduce spam, conditions are clear enough
                }
            });
        }

        if (this.stopRecordModeButton) {
            this.stopRecordModeButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent click from bubbling to frameBackground
                if (this.isRecordMode) {
                    if (this.debugMode) console.log('💡 Stop Record Mode button clicked for LightHandler.');
                    this.exitRecordMode();
                }
            });
        }
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            // if (this.debugMode) console.log(`💡 updateSoundParameters: Bailed. Conditions not met.`); // Reduced spam
            return;
        }

        const RAMP_TOLERANCE = 0.01;
        const isSensorActive = this.isActive && this.deviceStates.light.connected;

        // Main Synth Volume (controlled by mainVolume node)
        if (this.mainVolume) {
            const targetMainVol = isSensorActive ? (this.baseMainVolume + this.currentLightAppValue * 10 - 5) : -Infinity;
            if (Math.abs(this.mainVolume.volume.value - targetMainVol) > RAMP_TOLERANCE || (targetMainVol === -Infinity && this.mainVolume.volume.value > -80)) {
                this.mainVolume.volume.linearRampTo(targetMainVol, 0.5);
            }
        }
        
        // Sparkle Synth Volume (direct volume control)
        if (this.sparkleSynth && this.sparkleSynth.volume) {
            const targetSparkleVol = isSensorActive ? (this.baseSparkleVolume + this.currentLightAppValue * 8 - 4) : -Infinity;
             if (Math.abs(this.sparkleSynth.volume.value - targetSparkleVol) > RAMP_TOLERANCE || (targetSparkleVol === -Infinity && this.sparkleSynth.volume.value > -80)) {
                this.sparkleSynth.volume.linearRampTo(targetSparkleVol, 0.6);
            }
        }

        // Wooden Pluck Synth Volume (direct volume control)
        if (this.woodenPluckSynth && this.woodenPluckSynth.volume) {
            const targetPluckVol = isSensorActive ? (this.baseWoodenPluckVolume + this.currentLightAppValue * 7 - 3.5) : -Infinity;
            if (Math.abs(this.woodenPluckSynth.volume.value - targetPluckVol) > RAMP_TOLERANCE || (targetPluckVol === -Infinity && this.woodenPluckSynth.volume.value > -80)) {
                this.woodenPluckSynth.volume.linearRampTo(targetPluckVol, 0.55);
            }
        }


        // Loop Probabilities
        if (this.mainLoop) this.mainLoop.probability = isSensorActive ? (0.3 + this.currentLightAppValue * 0.6) : 0;
        if (this.sparkleLoop) this.sparkleLoop.probability = isSensorActive ? (0.1 + this.currentLightAppValue * 0.5) : 0;
        if (this.woodenPluckLoop) this.woodenPluckLoop.probability = isSensorActive ? (0.2 + this.currentLightAppValue * 0.4) : 0;

        // Synth parameters based on light condition
        if (this.mainSynth && isSensorActive) {
            if (this.currentLightCondition === "dark") { this.mainSynth.harmonicity.value = 1.2; this.mainSynth.modulationIndex.value = 3; }
            else if (this.currentLightCondition === "dim") { this.mainSynth.harmonicity.value = 1.5; this.mainSynth.modulationIndex.value = 5; }
            else if (this.currentLightCondition === "bright") { this.mainSynth.harmonicity.value = 1.8; this.mainSynth.modulationIndex.value = 7; }
            else if (this.currentLightCondition === "very_bright") { this.mainSynth.harmonicity.value = 2.0; this.mainSynth.modulationIndex.value = 9; }
            else { this.mainSynth.harmonicity.value = 2.2; this.mainSynth.modulationIndex.value = 10; } // extremely_bright
        }
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`💡 MAV Start: RecordMode=${this.isRecordMode}, IsPlayingGen=${this.isPlaying}, ExtMuted=${this.isExternallyMuted}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.light.connected}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;
        // else this.audioEnabled = true; // This is handled by creaTuneAudioEnabled event

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`💡 MAV: Externally muted or audio not enabled. Stopping all audio.`);
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true); // Force stop generative
            this.updateUI();
            return;
        }

        if (this.isRecordMode) {
            // If in record mode, generative audio should be stopped.
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`💡 MAV: In record mode, stopping generative audio.`);
                this.stopAudio(true); // Force stop generative
            }
            this.updateUI(); // Update UI for record mode
            return;
        }

        // Conditions for playing generative audio
        const shouldPlayGenerativeAudio = this.isActive && this.deviceStates.light.connected && !this.isExternallyMuted && this.audioEnabled && this.toneInitialized;

        if (shouldPlayGenerativeAudio) {
            if (!this.toneInitialized) { // Double check, though MAV start has it
                this.initTone(); // Initialize if not already
                if (!this.toneInitialized && this.debugMode) console.log('💡 MAV: initTone called, but still not initialized.');
                this.updateUI(); return; // Exit and wait for init
            }
            if (!this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log(`💡 MAV: Conditions met, calling startAudio (generative).`);
                this.startAudio();
            } else if (this.isPlaying) {
                // Already playing, ensure parameters are up-to-date
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log(`💡 MAV: Conditions NOT met for generative audio, calling stopAudio.`);
                this.stopAudio(); // Graceful stop
            }
        }
        this.updateUI();
        if (this.debugMode) console.log(`💡 MAV End. IsPlayingGen=${this.isPlaying}`);
    }

    updateUI() {
        const showActiveSystem = this.deviceStates.light.connected && this.isActive && !this.isExternallyMuted;

        if (this.lightCreatureVisual) {
            const wasCreatureActive = this.lightCreatureVisual.classList.contains('active');
            this.lightCreatureVisual.classList.toggle('active', showActiveSystem);
            this.lightCreatureVisual.classList.remove('light-dark', 'light-dim', 'light-bright', 'light-very-bright', 'light-extremely-bright');
            if (showActiveSystem) {
                this.lightCreatureVisual.classList.add(`light-${this.currentLightCondition.replace('_', '-')}`);
            } else if (wasCreatureActive && !this.lightCreatureVisual.classList.contains('active')) {
                this.lightCreatureCurrentFrame = 0;
                this.lightCreatureVisual.style.backgroundPositionX = '0%';
            }
        }

        if (this.frameBackground) {
            const isConnected = this.deviceStates.light.connected;
            const lightActiveBgClass = 'light-active-bg';
            const otherHandlersBgClasses = ['soil-active-bg', 'temp-active-bg', 'lightsoil-active-bg', 'tempsoil-active-bg', 'templight-active-bg', 'idle-bg'];
            const lightConditionBgClass = isConnected ? `light-${this.currentLightCondition.replace('_', '-')}-bg` : '';
            const allLightConditionBgs = ['light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg'];


            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                if (lightConditionBgClass) this.frameBackground.classList.add(lightConditionBgClass); else this.frameBackground.classList.add(lightActiveBgClass);
                // In its own record mode, LightHandler does not clear other handlers' BGs.
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');
                allLightConditionBgs.forEach(cls => this.frameBackground.classList.remove(cls)); // Clear old condition BGs
                this.frameBackground.classList.remove(lightActiveBgClass); // Clear generic active BG

                if (isConnected) {
                    if (lightConditionBgClass) this.frameBackground.classList.add(lightConditionBgClass);
                    else this.frameBackground.classList.add(lightActiveBgClass);

                    if (!this.isExternallyMuted) {
                        otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                    }
                }
            }
        }

        if (this.stopRecordModeButton) {
            const soilInRecMode = window.soilHandlerInstance?.isRecordMode;
            const tempInRecMode = window.temperatureHandlerInstance?.isRecordMode;
            const lightSoilInRecMode = window.lightSoilHandlerInstance?.isRecordMode;
            const tempSoilInRecMode = window.tempSoilHandlerInstance?.isRecordMode;
            const tempLightInRecMode = window.tempLightHandlerInstance?.isRecordMode;

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!soilInRecMode && !tempInRecMode && !lightSoilInRecMode && !tempSoilInRecMode && !tempLightInRecMode) {
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        // Reduced log spam for UI updates
        if (this.debugMode && Math.random() < 0.02) console.log(`💡 UI Update (Light): CreatureActive=${showActiveSystem}, DeviceConnected=${this.deviceStates.light.connected}, RecModeLight=${this.isRecordMode}, ExtMuteLight=${this.isExternallyMuted}, FrameBG Classes: ${this.frameBackground?.classList?.toString()}`);
    }


    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isActive) {
            if(this.debugMode) console.warn(`💡 enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}, isActive=${this.isActive}`);
            return;
        }
        if (window.soilHandlerInstance?.isRecordMode || window.temperatureHandlerInstance?.isRecordMode || window.lightSoilHandlerInstance?.isRecordMode || window.tempSoilHandlerInstance?.isRecordMode || window.tempLightHandlerInstance?.isRecordMode) {
            if(this.debugMode) console.warn(`💡 enterRecordMode: Blocked. Another creature is already in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ enterRecordMode: getUserMedia API not available.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('💡 enterRecordMode: Starting...');
        this.isRecordMode = true;

        // Mute other handlers
        if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(true, 'LightHandler-Record');
        if (window.temperatureHandlerInstance?.setExternallyMuted) window.temperatureHandlerInstance.setExternallyMuted(true, 'LightHandler-Record');
        if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(true, 'LightHandler-Record');
        if (window.tempSoilHandlerInstance?.setExternallyMuted) window.tempSoilHandlerInstance.setExternallyMuted(true, 'LightHandler-Record');
        if (window.tempLightHandlerInstance?.setExternallyMuted) window.tempLightHandlerInstance.setExternallyMuted(true, 'LightHandler-Record');


        if (this.isPlaying || this.isFadingOut) {
            if (this.debugMode) console.log('💡 enterRecordMode: Stopping generative audio forcefully.');
            this.stopAudio(true); // Force stop generative audio
        }
        // Ensure main generative path is silent
        if (this.mainVolume) this.mainVolume.volume.value = -Infinity;


        this.updateUI(); // Reflect record mode state

        await new Promise(resolve => setTimeout(resolve, 250)); // Short delay

        if (!this.isRecordMode) { // Check if exited during this brief wait
            if(this.debugMode) console.log('💡 enterRecordMode: Exited during pre-recording wait. Restoring other handlers.');
            this._unmuteOtherHandlersForRecordModeExit();
            this.manageAudioAndVisuals(); // Re-evaluate audio state
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();

            if (!this.isRecordMode) { // Check if exited during mic permission
                if (this.debugMode) console.log('💡 enterRecordMode: Exited after mic permission. Closing mic.');
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                this._unmuteOtherHandlersForRecordModeExit();
                this.manageAudioAndVisuals();
                return;
            }

            if (this.debugMode) console.log('💡 enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log('💡 enterRecordMode: Recording started.');
            this.updateUI();

            setTimeout(async () => {
                if (this.debugMode) console.log('💡 enterRecordMode (timeout): Recording duration elapsed.');
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.debugMode) console.log('💡 enterRecordMode (timeout): Recorder gone or no longer in record mode. Cleaning up.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    await this.recorder?.stop().catch(e => console.warn("Light Recorder stop error on early exit:", e));
                    this.recorder?.dispose(); this.recorder = null;
                    if (this.isRecordMode) this.exitRecordMode(true); // Ensure full cleanup if still in record mode
                    else { this._unmuteOtherHandlersForRecordModeExit(); this.manageAudioAndVisuals(); }
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (this.debugMode) console.log('💡 enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) {
                    if (this.debugMode) console.log('💡 enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    this._unmuteOtherHandlersForRecordModeExit();
                    this.manageAudioAndVisuals();
                    return;
                }
                this._setupRhythmicPlayback(audioBlob);
                this.updateUI();

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ enterRecordMode: Error during mic/recording setup: ${err.message}`, err);
            alert(`Could not start Light recording: ${err.message}.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true); // Force exit and cleanup
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        if (this.debugMode) console.log('💡 _setupRhythmicPlayback: Starting with blob size:', audioBlob.size);
        if (!this.isRecordMode || !this.toneInitialized || !this.mainSynth) { // Check mainSynth for rhythmic response
            if (this.debugMode) console.warn(`💡 _setupRhythmicPlayback: Conditions not met. isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, mainSynth=${!!this.mainSynth}. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }

        try {
            // Clean up any previous rhythmic playback components
            this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
            this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
            if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
            this.rhythmFollower?.dispose(); this.rhythmFollower = null;

            // Use mainSynth for rhythmic playback, set its volume
            if (this.mainSynth.volume.value !== this.rhythmicPlaybackVolume) {
                 this.mainSynth.volume.cancelScheduledValues(Tone.now());
                 this.mainSynth.volume.rampTo(this.rhythmicPlaybackVolume, 0.1);
            }


            this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);
            this.recordedBufferPlayer = new Tone.Player({
                url: this.recordedAudioBlobUrl,
                loop: false,
                onload: () => {
                    if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Player loaded.');
                    if (!this.isRecordMode || !this.recordedBufferPlayer) {
                        if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Record mode exited or player disposed during load. Aborting.');
                        this.recordedBufferPlayer?.dispose(); this.recordedBufferPlayer = null;
                        this.rhythmFollower?.dispose(); this.rhythmFollower = null;
                        this.rhythmicLoop?.dispose(); this.rhythmicLoop = null;
                        this.manageAudioAndVisuals(); // Re-evaluate state
                        return;
                    }

                    this.rhythmFollower = new Tone.Meter({ smoothing: 0.6 });
                    this.recordedBufferPlayer.connect(this.rhythmFollower);
                    this.recordedBufferPlayer.toDestination(); // Play back the recorded audio
                    this.recordedBufferPlayer.start();
                    if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Recorded buffer player started.');

                    this.rhythmicLoop = new Tone.Loop(time => {
                        if (!this.isRecordMode || !this.rhythmFollower || !this.mainSynth ||
                            !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                            return;
                        }
                        const level = this.rhythmFollower.getValue();
                        const currentTime = Tone.now() * 1000;

                        if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                            const noteToPlay = ["C5", "E5", "G5", "A5"][Math.floor(Math.random() * 4)];
                            this.mainSynth.triggerAttackRelease(noteToPlay, "16n", time, Math.random() * 0.4 + 0.3);
                            this.lastRhythmNoteTime = currentTime;
                            this._displayNote(noteToPlay);
                            this.triggerCreatureAnimation(); // Animate on rhythmic response
                        }
                    }, "16n").start(0);
                    if (this.debugMode) console.log('💡 _setupRhythmicPlayback (onload): Rhythmic loop initiated.');
                },
                onerror: (err) => {
                    console.error('❌ _setupRhythmicPlayback: Error loading recorded buffer player:', err);
                    this.exitRecordMode(true);
                }
            });
            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
            }
        } catch (error) {
            console.error('❌ _setupRhythmicPlayback: General error:', error);
            this.exitRecordMode(true);
        }
    }

    _unmuteOtherHandlersForRecordModeExit() {
        if (this.debugMode) console.log('💡 _unmuteOtherHandlersForRecordModeExit: Unmuting other handlers.');
        // Only unmute if no OTHER combined handler needs them muted.
        // This requires checking the state of combined handlers.
        // Example for SoilHandler:
        if (window.soilHandlerInstance?.setExternallyMuted) {
            const lsWantsSoilMuted = window.lightSoilHandlerInstance?.showLightSoilVisualContext;
            const tsWantsSoilMuted = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
            if (!lsWantsSoilMuted && !tsWantsSoilMuted) {
                window.soilHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`💡 LightHandler: NOT unmuting Soil as LS wants mute: ${lsWantsSoilMuted}, TS wants mute: ${tsWantsSoilMuted}`);
            }
        }
        // Example for TemperatureHandler:
        if (window.temperatureHandlerInstance?.setExternallyMuted) {
            const tlWantsTempMuted = window.tempLightHandlerInstance?.showTempLightVisualContext;
            const tsWantsTempMuted = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
            if (!tlWantsTempMuted && !tsWantsTempMuted) {
                window.temperatureHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`💡 LightHandler: NOT unmuting Temp as TL wants mute: ${tlWantsTempMuted}, TS wants mute: ${tsWantsTempMuted}`);
            }
        }

        // Unmute combined handlers that this handler might have muted.
        // This handler (Light) doesn't directly mute combined handlers, but if it did, logic would go here.
        // For instance, if LightHandler muted LightSoilHandler:
        // if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false, null);
        // This part is more relevant for combined handlers exiting record mode.
    }


    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`💡 exitRecordMode: Called but not in record mode and not forced. Current isRecordMode: ${this.isRecordMode}`);
            return;
        }
        if (this.debugMode) console.log(`%c💡 exitRecordMode: Exiting record mode. Force: ${force}`, 'color: orange; font-weight: bold;');
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;

        if (this.mic) {
            if (this.mic.state === "started") this.mic.close();
            this.mic = null;
            if (this.debugMode) console.log('💡 exitRecordMode: Mic closed and cleared.');
        }

        if (this.recorder) {
            const recorderInstance = this.recorder;
            this.recorder = null;
            recorderInstance.stop()
                .then(() => {
                    recorderInstance.dispose();
                    if (this.debugMode) console.log('💡 exitRecordMode: Recorder stopped and disposed.');
                })
                .catch(e => {
                    if (this.debugMode) console.warn('💡 exitRecordMode: Error stopping/disposing recorder:', e);
                    recorderInstance.dispose(); // Attempt dispose anyway
                });
        }

        if (this.rhythmicLoop) {
            if (this.rhythmicLoop.state === "started") this.rhythmicLoop.stop(0);
            this.rhythmicLoop.dispose();
            this.rhythmicLoop = null;
            if (this.debugMode) console.log('💡 exitRecordMode: RhythmicLoop stopped and disposed.');
        }

        if (this.recordedBufferPlayer) {
            if (this.recordedBufferPlayer.state === "started") this.recordedBufferPlayer.stop(0);
            this.recordedBufferPlayer.dispose();
            this.recordedBufferPlayer = null;
            if (this.debugMode) console.log('💡 exitRecordMode: RecordedBufferPlayer stopped and disposed.');
        }
        if (this.recordedAudioBlobUrl) {
            URL.revokeObjectURL(this.recordedAudioBlobUrl);
            this.recordedAudioBlobUrl = null;
            if (this.debugMode) console.log('💡 exitRecordMode: RecordedAudioBlobUrl revoked.');
        }

        if (this.rhythmFollower) {
            this.rhythmFollower.dispose();
            this.rhythmFollower = null;
            if (this.debugMode) console.log('💡 exitRecordMode: RhythmFollower disposed.');
        }

        // Reset mainSynth volume if it was used for rhythmic playback
        if (this.mainSynth?.volume && this.mainSynth.volume.value === this.rhythmicPlaybackVolume) {
            // Instead of setting to -Infinity, let updateSoundParameters handle the correct generative volume
            if (this.debugMode) console.log('💡 exitRecordMode: mainSynth volume was at rhythmic level. Will be reset by updateSoundParameters.');
        }
        
        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }

        if (wasRecordMode || force) {
            this._unmuteOtherHandlersForRecordModeExit();
            this.manageAudioAndVisuals(); // Re-evaluate audio and visual state
        } else {
            this.updateUI();
        }
        if (this.debugMode) console.log(`💡 exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }


    startAudio() {
        if (this.debugMode) console.log(`💡 startAudio (generative): Called. isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}`);
        if (this.isRecordMode) {
            if (this.debugMode) console.log("💡 startAudio (generative): Blocked, in record mode.");
            this.updateUI(); return;
        }
        const sensorEffectivelyActive = this.isActive && this.deviceStates.light.connected;
        if (this.isExternallyMuted || !this.audioEnabled || !this.toneInitialized || !sensorEffectivelyActive ||
            !this.mainVolume || !this.mainSynth || !this.sparkleSynth || !this.woodenPluckSynth ||
            !this.mainLoop || !this.sparkleLoop || !this.woodenPluckLoop) {
            if (this.debugMode) {
                console.warn(`💡 startAudio (generative): Blocked. Details:
                    ExtMuted=${this.isExternallyMuted}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized},
                    SensorEffectivelyActive=${sensorEffectivelyActive}, MainVol=${!!this.mainVolume}, MainSynth=${!!this.mainSynth},
                    SparkleSynth=${!!this.sparkleSynth}, WoodenPluckSynth=${!!this.woodenPluckSynth},
                    MainLoop=${!!this.mainLoop}, SparkleLoop=${!!this.sparkleLoop}, WoodenPluckLoop=${!!this.woodenPluckLoop}`);
            }
            this.updateUI(); return;
        }

        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            if (this.mainVolume) this.mainVolume.volume.cancelScheduledValues(Tone.now());
            // Individual synth volumes are managed by updateSoundParameters
        }

        if (this.isPlaying) {
            this.updateSoundParameters();
            this.updateUI(); return;
        }

        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); // Sets initial volumes and loop probabilities

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('💡 startAudio: Tone.Transport started.');
        }

        if (this.mainLoop.state !== "started") this.mainLoop.start(0);
        if (this.sparkleLoop.state !== "started") this.sparkleLoop.start(0);
        if (this.woodenPluckLoop.state !== "started") this.woodenPluckLoop.start(0); // ADDED

        if (this.debugMode) console.log('💡 startAudio (generative): Loops started. isPlaying is true.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`%c💡 stopAudio (generative): force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInit=${this.toneInitialized}`, 'color: #c0392b; font-weight: bold;');

        if (!this.audioEnabled || !this.toneInitialized || !this.mainVolume) {
            if (this.debugMode) console.log('💡 stopAudio: Bailed. Audio not enabled, Tone not initialized, or mainVolume missing.');
            this.isPlaying = false; this.isFadingOut = false;
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log('💡 stopAudio: Bailed. Not playing, not fading, and not forced.');
            this.updateUI(); return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log('💡 stopAudio: Bailed. Already fading out and not forced.');
            return;
        }

        this.isPlaying = false;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.mainLoop && this.mainLoop.state === "started") this.mainLoop.stop(0);
        if (this.sparkleLoop && this.sparkleLoop.state === "started") this.sparkleLoop.stop(0);
        if (this.woodenPluckLoop && this.woodenPluckLoop.state === "started") this.woodenPluckLoop.stop(0); // ADDED

        if (this.mainVolume && this.mainVolume.volume) {
            this.mainVolume.volume.cancelScheduledValues(Tone.now());
            this.mainVolume.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        // Individual synth volumes like sparkleSynth and woodenPluckSynth are part of mainVolume chain,
        // or should be ramped if they have independent volume controls not chained to mainVolume.
        // Assuming they are connected to mainVolume, mainVolume ramp is sufficient.
        // If sparkleSynth.volume or woodenPluckSynth.volume were set independently AND NOT connected via mainVolume,
        // they would need their own rampTo(-Infinity) here.
        // For now, assuming they are part of the mainVolume signal chain.

        this.isFadingOut = true;

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            this.isFadingOut = false;
            if (this.mainVolume && this.mainVolume.volume) this.mainVolume.volume.value = -Infinity;
            // Ensure other synth volumes are also silent if they had independent controls
            // if (this.sparkleSynth) this.sparkleSynth.volume.value = -Infinity;
            // if (this.woodenPluckSynth) this.woodenPluckSynth.volume.value = -Infinity;
            if (this.debugMode) console.log('💡 stopAudio (generative): Fully stopped and loops cleared.');
            this.updateUI();
        }, force ? 10 : (fadeTime * 1000 + 100));

        if (force) this.updateUI();
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