class TemperatureHandler {
    constructor() {
        // Synths and Loops - Temperature Style
        this.liquidSynth = null;    // For sustained, evolving sounds
        this.punchySynth = null;   // For percussive accents
        this.mainTempLoop = null;  // For generative audio with liquidSynth
        this.accentLoop = null;    // For punchySynth accents

        // Audio Params - Temperature Style
        this.fadeDuration = 1.8;
        this.baseLiquidVolume = 6; // Quieter base for more dynamic range
        this.basePunchyVolume = 9;
        this.rhythmicPlaybackVolume = 6; // For recorded audio playback

        // State
        this.isActive = false;
        this.isPlaying = false; // True when GENERATIVE audio is playing
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false;

        this.currentTempCondition = "mild"; // Default
        this.currentTempAppValue = 0.5;     // Default (0.0 to 1.0)
        this.currentHumidity = 50;          // Default
        this.deviceStates = {
            temperature: { connected: false } // Changed from soil
        };

        // Sprite Animation State
        this.tempCreatureCurrentFrame = 0;
        this.tempCreatureTotalFrames = 6; // Assuming 6 frames for temp-creature.png

        // DOM Elements
        this.tempCreatureVisual = document.querySelector('.temp-creature'); // Changed
        this.frameBackground = document.querySelector('.framebackground');
        this.stopRecordModeButton = document.getElementById('stoprecordmode');

        // Record Mode Properties (can remain similar, but synth used might change)
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;
        this.mic = null;
        this.recorder = null;
        this.recordedBufferPlayer = null;
        this.rhythmFollower = null;
        this.rhythmicLoop = null;
        this.recordingDuration = 5000;
        this.rhythmThreshold = -28; // Adjusted slightly
        this.rhythmNoteCooldown = 180; // Adjusted slightly
        this.lastRhythmNoteTime = 0;
        this.recordedAudioBlobUrl = null;

        // Note Display
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        if (!this.tempCreatureVisual && this.debugMode) console.warn('🌡️ .temp-creature element not found.');
        if (!this.frameBackground && this.debugMode) console.warn('🌡️ .framebackground element not found for TemperatureHandler.');
        if (!this.stopRecordModeButton && this.debugMode) console.warn('🌡️ #stoprecordmode button not found.');

        this.initializeWhenReady();
    }

    setExternallyMuted(isMuted) {
        if (this.debugMode) console.log(`🌡️ TemperatureHandler: setExternallyMuted called with: ${isMuted}. Current state: ${this.isExternallyMuted}`);
        if (this.isExternallyMuted === isMuted) return;

        this.isExternallyMuted = isMuted;
        if (this.debugMode) console.log(`🌡️ TemperatureHandler: isExternallyMuted set to ${this.isExternallyMuted}`);

        if (this.isExternallyMuted) {
            if (this.isRecordMode) {
                if (this.debugMode) console.log(`🌡️ TemperatureHandler: Externally muted, forcing exit from record mode.`);
                this.exitRecordMode(true);
            } else if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`🌡️ TemperatureHandler: Externally muted, stopping generative audio.`);
                this.stopAudio(true);
            }
        }
        this.manageAudioAndVisuals();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                if (this.debugMode) console.log('🌡️ TemperatureHandler: Core Dependencies ready.');
                this.setupListeners();
                this.updateUI();
                if (Tone.context.state === 'running') {
                    this.handleAudioContextRunning();
                }
            } else {
                if (this.debugMode) console.log('🌡️ TemperatureHandler: Waiting for core dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    handleAudioContextRunning() {
        if (this.debugMode) console.log('🌡️ TemperatureHandler: AudioContext is running.');
        this.audioEnabled = true;
        if (!this.toneInitialized && !this.isRecordMode) {
            this.initTone();
        }
        this.manageAudioAndVisuals();
    }

    initTone() {
        if (this.toneInitialized) {
            if (this.debugMode) console.log('🌡️ TemperatureHandler: initTone called, but already initialized.');
            return;
        }
        if (!window.Tone || !this.audioEnabled) {
            if (this.debugMode) console.warn(`🌡️ TemperatureHandler: Cannot initTone. Tone loaded: ${!!window.Tone}, AudioEnabled: ${this.audioEnabled}`);
            return;
        }
        if (Tone.context.state !== 'running') {
            if (this.debugMode) console.warn('🌡️ TemperatureHandler: AudioContext not running. Deferring Tone component initialization.');
            return;
        }

        if (this.debugMode) console.log('🌡️ TemperatureHandler: Initializing Tone.js components (Gamelan-inspired)...');
        try {
            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
                if (this.debugMode) console.log('🌡️ TemperatureHandler: Tone.Transport started in initTone.');
            }

            // Effects: Reverb is good for Gamelan-like space. Delay can add rhythmic complexity. Chorus made more subtle.
            const masterReverb = new Tone.Reverb(1.5).toDestination(); // Longer reverb for spacious feel
            masterReverb.wet.value = 0.3; // Adjust wetness of reverb
            const masterDelay = new Tone.FeedbackDelay("8n.", 0.3).connect(masterReverb); // Dotted 8th note delay
            const masterChorus = new Tone.Chorus(0.5, 3.5, 0.2).connect(masterDelay); // Subtle chorus: freq, delayTime, depth

            // Liquid Synth: Aiming for a resonant, metallic, gong-like or metallophone sound (mid-deep)
            this.liquidSynth = new Tone.FMSynth({
                harmonicity: 1.414, // Inharmonic ratio (sqrt(2)) for metallic timbre
                modulationIndex: 12,
                carrier: {
                    oscillator: { type: "sine" }, // Sine for roundness
                    envelope: { attack: 0.02, decay: 0.6, sustain: 0.2, release: 1.8 } // Clear attack, resonant release
                },
                modulator: {
                    oscillator: { type: "sine" }, // Sine modulator for smoother metallic tone
                    envelope: { attack: 0.03, decay: 0.4, sustain: 0.1, release: 1.0 }
                },
                volume: -Infinity
            }).connect(masterChorus);

            // Punchy Synth: Aiming for a bonang or kenong-like percussive hit (mid-deep)
            this.punchySynth = new Tone.MembraneSynth({
                pitchDecay: 0.04, // Slightly more decay for a 'bonk'
                octaves: 4,       // Mid-range focus
                oscillator: { type: "sine" }, // Round fundamental
                envelope: { attack: 0.002, decay: 0.4, sustain: 0.0, release: 0.3 }, // Sharp attack, quick decay
                volume: -Infinity
            }).connect(masterReverb); // Directly to reverb for a sense of space

            this.createMainTempLoop();
            this.createAccentLoop();

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌡️ TemperatureHandler: Tone.js components initialized successfully (Gamelan-inspired).');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ TemperatureHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.liquidSynth) { this.liquidSynth.dispose(); this.liquidSynth = null; }
            if (this.punchySynth) { this.punchySynth.dispose(); this.punchySynth = null; }
            if (this.mainTempLoop) { this.mainTempLoop.dispose(); this.mainTempLoop = null; }
            if (this.accentLoop) { this.accentLoop.dispose(); this.accentLoop = null; }
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) {
            return;
        }
        if (this.tempCreatureVisual && this.tempCreatureVisual.classList.contains('active')) {
            this.tempCreatureCurrentFrame = (this.tempCreatureCurrentFrame + 1) % this.tempCreatureTotalFrames;
            // Changed to match the sprite reading method in soil.js
            this.tempCreatureVisual.style.backgroundPositionX = (this.tempCreatureCurrentFrame * 20) + '%'; 
        }
    }

    _displayNote(note) {
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) {
            if (this.noteDisplayTimeoutId) {
                clearTimeout(this.noteDisplayTimeoutId);
            }
            noteDisplayElement.textContent = `🌡️ ${note}`; // Temp prefix
            this.lastDisplayedNote = note;
            this.noteDisplayTimeoutId = setTimeout(() => {
                if (noteDisplayElement.textContent === `🌡️ ${this.lastDisplayedNote}`) {
                    noteDisplayElement.textContent = '-';
                }
            }, 1200); // Increased display time slightly for slower Gamelan feel
        }
    }

    createMainTempLoop() {
        if (!this.liquidSynth) return;
        // Adjusted notes to be lower for mid/deep Gamelan feel
        const tempNotes = ["C2", "D#2", "G2", "A#2", "C3", "D3", "F3"]; 
        this.mainTempLoop = new Tone.Pattern((time, note) => {
            if (!this.isPlaying || !this.liquidSynth || this.liquidSynth.volume.value === -Infinity) return;
            const velocity = Math.max(0.25, this.currentTempAppValue * 0.5 + 0.2); 
            this.liquidSynth.triggerAttackRelease(note, "0:2", time, velocity); // Longer duration, like "half note"
            this.triggerCreatureAnimation();
            this._displayNote(note);
        }, tempNotes, "randomWalk");
        this.mainTempLoop.interval = "0:3"; // Slower base interval (e.g., 3 beats)
        this.mainTempLoop.humanize = "8n";
    }

    createAccentLoop() {
        if (!this.punchySynth) return;
        this.accentLoop = new Tone.Loop(time => {
            if (!this.isPlaying || !this.punchySynth || this.punchySynth.volume.value === -Infinity) return;
            const velocity = Math.max(0.35, (1 - this.currentTempAppValue) * 0.45 + 0.25); 
            // Lower, deeper note for punchy Gamelan accent
            this.punchySynth.triggerAttackRelease("G1", "8n", time, velocity); 
            // this._displayNote("🔔"); // Gamelan-like indicator
        }, "1m"); // Slower interval for accents, like a larger gong
        this.accentLoop.probability = 0.15; 
        this.accentLoop.humanize = "8n";
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('🌡️ TemperatureHandler: window.creatune (WebSocket client) not available.');
            return;
        }
        if (this.debugMode) console.log('🌡️ TemperatureHandler: Setting up WebSocket and DOM listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'temperature') {
                const oldActive = this.isActive;
                const oldConnected = this.deviceStates.temperature.connected;
                this.isActive = state.active;
                this.currentTempCondition = state.rawData.temp_condition || "mild";
                this.currentTempAppValue = state.rawData.temp_app_value !== undefined ? state.rawData.temp_app_value : 0.5;
                this.currentHumidity = state.rawData.humidity_percent !== undefined ? state.rawData.humidity_percent : 50;
                this.deviceStates.temperature.connected = true;
                if (this.debugMode) console.log(`🌡️ TemperatureHandler stateChange: active=${this.isActive} (was ${oldActive}), connected=${this.deviceStates.temperature.connected} (was ${oldConnected}), condition=${this.currentTempCondition}, tempAppValue=${this.currentTempAppValue.toFixed(2)}, humidity=${this.currentHumidity}%`);
                this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'temperature') {
                this.currentTempCondition = data.temp_condition || this.currentTempCondition;
                this.currentTempAppValue = data.temp_app_value !== undefined ? data.temp_app_value : this.currentTempAppValue;
                this.currentHumidity = data.humidity_percent !== undefined ? data.humidity_percent : this.currentHumidity;
                this.deviceStates.temperature.connected = true;
                if (!this.isRecordMode && this.isPlaying) this.updateSoundParameters();
            }
        });
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'temperature') {
                if (this.debugMode) console.log(`🌡️ TemperatureHandler: Temperature device connected event.`);
                this.deviceStates.temperature.connected = true;
                if (Tone.context.state === 'running') this.handleAudioContextRunning();
                else this.manageAudioAndVisuals();
            }
        });
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'temperature') {
                if (this.debugMode) console.log(`🌡️ TemperatureHandler: Temperature device disconnected event.`);
                this.deviceStates.temperature.connected = false;
                this.isActive = false;
                if (this.isRecordMode) this.exitRecordMode(true);
                else this.manageAudioAndVisuals();
            }
        });

        document.addEventListener('creaTuneAudioEnabled', () => {
            if (this.debugMode) console.log("🌡️ TemperatureHandler detected creaTuneAudioEnabled event.");
            this.handleAudioContextRunning();
        });
        document.addEventListener('creaTuneAudioDisabled', () => {
            if (this.debugMode) console.log("🌡️ TemperatureHandler detected creaTuneAudioDisabled event.");
            this.audioEnabled = false;
            if (this.isRecordMode) this.exitRecordMode(true);
            else this.manageAudioAndVisuals();
        });

        if (this.frameBackground) {
            this.frameBackground.addEventListener('click', () => {
                if (this.deviceStates.temperature.connected &&
                    !this.isRecordMode &&
                    this.isActive &&
                    this.audioEnabled &&
                    this.toneInitialized &&
                    (!window.lightHandlerInstance || !window.lightHandlerInstance.isRecordMode) &&
                    (!window.soilHandlerInstance || !window.soilHandlerInstance.isRecordMode) &&
                    (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode)
                ) {
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`🌡️ Record mode NOT entered for Temperature. Conditions: temp.connected=${this.deviceStates.temperature.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRec=${window.lightHandlerInstance?.isRecordMode}, soilRec=${window.soilHandlerInstance?.isRecordMode}, lsRec=${window.lightSoilHandlerInstance?.isRecordMode}`);
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

        const wsClientInitialState = window.creatune.getDeviceState('temperature');
        if (wsClientInitialState) {
            this.deviceStates.temperature.connected = wsClientInitialState.connected;
            this.isActive = wsClientInitialState.active;
            if (wsClientInitialState.lastRawData) {
                this.currentTempCondition = wsClientInitialState.lastRawData.temp_condition || "mild";
                this.currentTempAppValue = wsClientInitialState.lastRawData.temp_app_value !== undefined ? wsClientInitialState.lastRawData.temp_app_value : 0.5;
                this.currentHumidity = wsClientInitialState.lastRawData.humidity_percent !== undefined ? wsClientInitialState.lastRawData.humidity_percent : 50;
            }
        }
        this.updateUI();
    }

    updateSoundParameters() {
        if (!this.toneInitialized || !this.audioEnabled || this.isExternallyMuted || this.isRecordMode || !this.isPlaying) {
            return;
        }

        const isSensorActive = this.isActive && this.deviceStates.temperature.connected;

        // Liquid Synth Parameters (Gamelan-inspired)
        if (this.liquidSynth && this.liquidSynth.volume) {
            const dynamicVolumePart = this.currentTempAppValue * 10; 
            const targetVolume = isSensorActive ? (this.baseLiquidVolume - 3 + dynamicVolumePart) : -Infinity; // Adjusted base for new timbre
            this.liquidSynth.volume.linearRampTo(targetVolume, 0.7);

            // Modulate FM synth parameters based on temperature for timbral variation
            let harmonicityTarget = 1.414; // Base inharmonic
            let modIndexTarget = 12;     // Base complexity
            if (this.currentTempCondition === "very_cold") { harmonicityTarget = 1.2; modIndexTarget = 8; }
            else if (this.currentTempCondition === "cold") { harmonicityTarget = 1.3; modIndexTarget = 10; }
            else if (this.currentTempCondition === "cool") { harmonicityTarget = 1.414; modIndexTarget = 12; }
            else if (this.currentTempCondition === "mild") { harmonicityTarget = 1.5; modIndexTarget = 14; }
            else if (this.currentTempCondition === "warm") { harmonicityTarget = 1.6; modIndexTarget = 16; }
            else if (this.currentTempCondition === "hot") { harmonicityTarget = 1.7; modIndexTarget = 18; }

            if (this.liquidSynth.harmonicity) this.liquidSynth.harmonicity.linearRampTo(harmonicityTarget, 0.8);
            if (this.liquidSynth.modulationIndex) this.liquidSynth.modulationIndex.linearRampTo(modIndexTarget, 0.8);
        }

        // Main Temp Loop Interval (Liquid Synth) - Slower for Gamelan feel
        if (this.mainTempLoop) {
            if (this.currentTempAppValue < 0.2) this.mainTempLoop.interval = "0:4"; // 4 beats
            else if (this.currentTempAppValue < 0.4) this.mainTempLoop.interval = "0:3"; // 3 beats
            else if (this.currentTempAppValue < 0.6) this.mainTempLoop.interval = "0:2";   // 2 beats
            else if (this.currentTempAppValue < 0.8) this.mainTempLoop.interval = "1m";   // 1 measure (can be long)
            else this.mainTempLoop.interval = "1:2"; // 1 measure + 2 beats (even longer)
        }

        // Punchy Synth Parameters & Accent Loop (Gamelan-inspired)
        if (this.punchySynth && this.punchySynth.volume && this.accentLoop) {
            const targetPunchyVol = isSensorActive ? (this.basePunchyVolume - 2 + (this.currentTempAppValue * 4)) : -Infinity; // Adjusted base
            this.punchySynth.volume.linearRampTo(targetPunchyVol, 0.6);

            let accentProb = 0.15; // Base probability
            if (this.currentTempCondition === "very_cold") accentProb = 0.08;
            else if (this.currentTempCondition === "cold") accentProb = 0.12;
            else if (this.currentTempCondition === "hot") accentProb = 0.25;
            else if (this.currentTempCondition === "warm") accentProb = 0.20;
            this.accentLoop.probability = isSensorActive ? accentProb : 0;
        }
         if (this.debugMode && Math.random() < 0.03) console.log(`🌡️ USParams (Gamelan): LiquidVol=${this.liquidSynth?.volume.value.toFixed(1)}, PunchyVol=${this.punchySynth?.volume.value.toFixed(1)}, MainLoopInterval=${this.mainTempLoop?.interval}, AccentProb=${this.accentLoop?.probability.toFixed(2)}`);
    }

    manageAudioAndVisuals() {
        if (this.debugMode) console.log(`🌡️ MAV Start: RecordMode=${this.isRecordMode}, IsPlaying=${this.isPlaying}, ExtMuted=${this.isExternallyMuted}, SensorActive=${this.isActive}, SensorConnected=${this.deviceStates.temperature.connected}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);

        if (Tone.context.state !== 'running') this.audioEnabled = false;

        if (this.isExternallyMuted || !this.audioEnabled) {
            if (this.debugMode) console.log(`🌡️ MAV: Externally muted or audio not enabled. Stopping all audio.`);
            if (this.isRecordMode) this.exitRecordMode(true);
            else if (this.isPlaying || this.isFadingOut) this.stopAudio(true);
            this.updateUI();
            return;
        }

        if (this.isRecordMode) {
            if (this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`🌡️ MAV: In RecordMode, ensuring generative audio (isPlaying=${this.isPlaying}) is stopped.`);
                this.stopAudio(true);
            }
            this.updateUI();
            return;
        }

        if (!this.toneInitialized) {
            if (this.debugMode) console.log(`🌡️ MAV: Tone not initialized for generative. Attempting initTone.`);
            this.initTone();
            if (!this.toneInitialized) {
                if (this.debugMode) console.log(`🌡️ MAV: initTone failed or deferred. Cannot manage generative audio yet.`);
                this.updateUI();
                return;
            }
        }

        const shouldPlayGenerativeAudio = this.deviceStates.temperature.connected && this.isActive && !this.isExternallyMuted;
        if (this.debugMode) console.log(`🌡️ MAV: ShouldPlayGenerativeAudio = ${shouldPlayGenerativeAudio}`);

        if (shouldPlayGenerativeAudio) {
            if (!this.isPlaying || this.isFadingOut) {
                if (this.debugMode) console.log(`🌡️ MAV: Conditions met, calling startAudio (generative).`);
                this.startAudio();
            } else {
                if (this.debugMode) console.log(`🌡️ MAV: Generative audio already playing, calling updateSoundParameters.`);
                this.updateSoundParameters();
            }
        } else {
            if (this.isPlaying && !this.isFadingOut) {
                if (this.debugMode) console.log(`🌡️ MAV: Conditions NOT met for generative audio, calling stopAudio.`);
                this.stopAudio();
            }
        }
        this.updateUI();
        if (this.debugMode) console.log(`🌡️ MAV End. IsPlaying=${this.isPlaying}`);
    }

    updateUI() {
        const showCreature = this.deviceStates.temperature.connected && this.isActive && !this.isExternallyMuted;

        if (this.tempCreatureVisual) {
            const wasCreatureActive = this.tempCreatureVisual.classList.contains('active');
            this.tempCreatureVisual.classList.toggle('active', showCreature);
            
            if (this.debugMode) {
                console.log(`🌡️ updateUI: showCreature is ${showCreature}. Creature classList after toggle: ${this.tempCreatureVisual.classList}`);
            }

            // Creature visual still uses condition-specific classes for its appearance
            ['temp-very-cold', 'temp-cold', 'temp-cool', 'temp-mild', 'temp-warm', 'temp-hot'].forEach(cls => this.tempCreatureVisual.classList.remove(cls));
            if (showCreature) {
                this.tempCreatureVisual.classList.add(`temp-${this.currentTempCondition.replace('_', '-')}`);
            } else if (wasCreatureActive && !this.tempCreatureVisual.classList.contains('active')) {
                this.tempCreatureCurrentFrame = 0;
                this.tempCreatureVisual.style.backgroundPositionX = '0%';
            }
        }

        if (this.frameBackground) {
            const tempBgClass = 'temp-active-bg';
            const otherHandlersBgClasses = [
                'soil-active-bg', 'soil-dry-bg', 'soil-humid-bg', 'soil-wet-bg',
                'light-active-bg', 'light-dark-bg', 'light-dim-bg', 'light-bright-bg', 'light-very-bright-bg', 'light-extremely-bright-bg',
                'lightsoil-active-bg',
                'idle-bg' 
            ];
            // Ensure any old specific temperature condition background classes are removed from the frameBackground
            const allOldTempConditionBgs = ['temp-very-cold-bg', 'temp-cold-bg', 'temp-cool-bg', 'temp-mild-bg', 'temp-warm-bg', 'temp-hot-bg'];
            allOldTempConditionBgs.forEach(cls => this.frameBackground.classList.remove(cls));

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(tempBgClass);
                // When temp is in record mode, it takes precedence and clears other backgrounds.
                otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');

                const shouldShowTempBackground = this.deviceStates.temperature.connected && this.isActive && !this.isExternallyMuted;

                if (shouldShowTempBackground) {
                    this.frameBackground.classList.add(tempBgClass);
                    // This handler is active, clear other handlers' backgrounds.
                    otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                } else {
                    // This handler is not responsible for the background. Remove its class.
                    // It won't clear other handler's classes here, as another handler might be active.
                    this.frameBackground.classList.remove(tempBgClass);
                }
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            const lightSoilInRec = window.lightSoilHandlerInstance?.isRecordMode;

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec && !lightSoilInRec) {
                // Hide button only if NO handler is in record mode
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.05) console.log(`🌡️ UI Update (Temp): CreatureActive=${showCreature}, DeviceConnected=${this.deviceStates.temperature.connected}, RecModeTemp=${this.isRecordMode}, ExtMuteTemp=${this.isExternallyMuted}, TempCond=${this.currentTempCondition}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
    }
    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn(`🌡️ enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);
            return;
        }
        // Check other handlers
        if (window.lightHandlerInstance?.isRecordMode || window.soilHandlerInstance?.isRecordMode || window.lightSoilHandlerInstance?.isRecordMode) {
            if (this.debugMode) console.warn(`🌡️ enterRecordMode: Blocked. Another creature is already in record mode.`);
            return;
        }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            console.error('❌ enterRecordMode: getUserMedia API not available. Ensure HTTPS or localhost.');
            alert('Microphone access not available. Please ensure the page is served over HTTPS or on localhost.');
            return;
        }

        if (this.debugMode) console.log('🌡️ enterRecordMode: Starting...');
        this.isRecordMode = true;

        if (this.debugMode) console.log('🌡️ enterRecordMode: Stopping generative audio forcefully.');
        this.stopAudio(true); // Ensure generative audio is off

        // Mute other handlers
        if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(true);
        if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(true);
        if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(true);


        this.updateUI();
        await new Promise(resolve => setTimeout(resolve, 200));

        if (!this.isRecordMode) {
            if (this.debugMode) console.log('🌡️ enterRecordMode: Exited during pre-recording wait. Restoring other handlers.');
            if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
            if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(false);
            if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();

            if (!this.isRecordMode) {
                if (this.debugMode) console.log('🌡️ enterRecordMode: Exited after mic permission prompt.');
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
                if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(false);
                if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
                return;
            }

            if (this.debugMode) console.log('🌡️ enterRecordMode: Mic opened.');
            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder);
            this.recorder.start();
            if (this.debugMode) console.log(`🌡️ enterRecordMode: Recording started for ${this.recordingDuration / 1000} seconds...`);

            setTimeout(async () => {
                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.debugMode) console.log('🌡️ enterRecordMode (timeout): No longer in active recording state or record mode.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder?.state === "started") { try { await this.recorder.stop(); } catch (e) { /*ignore*/ } }
                    if (this.isRecordMode) this.exitRecordMode(true); // Force exit
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                if (this.debugMode) console.log('🌡️ enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) {
                    if (this.debugMode) console.log('🌡️ enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    // Unmute handled by exitRecordMode if it was called
                    return;
                }
                this._setupRhythmicPlayback(audioBlob);

            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ enterRecordMode: Error during mic setup: ${err.message}`, err);
            alert(`Could not start recording for Temperature: ${err.message}. Check console and browser permissions.`);
            this.isCurrentlyRecording = false;
            this.exitRecordMode(true); // This will also handle unmuting others
        }
    }

    _setupRhythmicPlayback(audioBlob) {
        // Use punchySynth for rhythmic playback, ensure it sounds Gamelan-like
        if (!this.isRecordMode || !this.toneInitialized || !this.punchySynth) {
            if (this.debugMode) console.warn(`🌡️ _setupRhythmicPlayback: Blocked. isRecMode=${this.isRecordMode}, toneInit=${this.toneInitialized}, punchySynth=${!!this.punchySynth}. Forcing exit.`);
            this.exitRecordMode(true);
            return;
        }
        if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback: Starting with punchySynth (Gamelan-style)...');

        if (this.punchySynth && this.punchySynth.volume) {
            // Use a slightly different volume for playback to distinguish from generative accents
            this.punchySynth.volume.value = this.rhythmicPlaybackVolume - 2; 
            if (this.debugMode) console.log(`🌡️ _setupRhythmicPlayback: punchySynth volume set to ${this.punchySynth.volume.value} dB for recording playback.`);
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
                    if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Record mode exited while buffer loading. Aborting.');
                    if (this.recordedBufferPlayer) { this.recordedBufferPlayer.dispose(); this.recordedBufferPlayer = null; }
                    if (this.rhythmFollower) { this.rhythmFollower.dispose(); this.rhythmFollower = null; }
                    if (this.rhythmicLoop) { this.rhythmicLoop.dispose(); this.rhythmicLoop = null; }
                    // Reset punchySynth volume if it was set for playback
                    if (this.punchySynth && this.punchySynth.volume.value === (this.rhythmicPlaybackVolume -2)) {
                         this.punchySynth.volume.value = -Infinity; // Or to its generative base if applicable
                    }
                    return;
                }
                if (!this.recordedBufferPlayer) { /* Safety check */ return; }

                if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Recorded buffer player loaded.');
                this.recordedBufferPlayer.connect(this.rhythmFollower);
                this.recordedBufferPlayer.toDestination(); 
                this.recordedBufferPlayer.start();
                if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Recorded buffer player started.');

                this.rhythmicLoop = new Tone.Loop(time => {
                    if (!this.isRecordMode || !this.rhythmFollower || !this.punchySynth || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                        return;
                    }
                    const level = this.rhythmFollower.getValue();
                    const currentTime = Tone.now() * 1000;

                    if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                        // Deeper notes for Gamelan-like rhythmic response
                        const notes = ["C1", "D#1", "G1", "A#1"]; 
                        const noteToPlay = notes[Math.floor(Math.random() * notes.length)];
                        const velocity = 0.4 + (Math.min(15, Math.max(0, level - this.rhythmThreshold)) * 0.035);

                        if (this.debugMode && Math.random() < 0.25) console.log(`🌡️ Rhythmic trigger (Gamelan)! Level: ${typeof level === 'number' ? level.toFixed(2) : level}, Note: ${noteToPlay}, Vel: ${velocity.toFixed(2)}`);
                        this.punchySynth.triggerAttackRelease(noteToPlay, "16n", time, Math.min(1.0, Math.max(0.15, velocity))); 
                        this.triggerCreatureAnimation();
                        this._displayNote(`🎤 ${noteToPlay}`);
                        this.lastRhythmNoteTime = currentTime;
                    }
                }, "16n").start(0);
                if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Rhythmic loop initiated (Gamelan-style).');
            },
            onerror: (err) => {
                console.error('❌ _setupRhythmicPlayback: Error loading recorded buffer player:', err);
                this.exitRecordMode(true);
            }
        });
        if (Tone.Transport.state !== "started") Tone.Transport.start();
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) {
            return;
        }
        if (this.debugMode) console.log(`🌡️ exitRecordMode: Starting. Forced: ${force}. Was inRecordMode: ${this.isRecordMode}`);

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

        // Ensure generative synths are silenced
        if (this.liquidSynth?.volume) this.liquidSynth.volume.value = -Infinity;
        if (this.punchySynth?.volume) this.punchySynth.volume.value = -Infinity; // Also silence punchy synth used for recording

        this.isPlaying = false;
        this.isFadingOut = false;
        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        if (this.noteDisplayTimeoutId) {
            clearTimeout(this.noteDisplayTimeoutId);
            const noteDisplayElement = document.querySelector('#notes-display p');
            if (noteDisplayElement) noteDisplayElement.textContent = '-';
        }
        
        // Unmute other handlers ONLY if this handler was the one in record mode
        if (wasRecordMode) {
            if (this.debugMode) console.log('🌡️ exitRecordMode: Unmuting other handlers as Temp was in record mode.');
            if (window.lightHandlerInstance?.setExternallyMuted && window.lightHandlerInstance.isExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
            if (window.soilHandlerInstance?.setExternallyMuted && window.soilHandlerInstance.isExternallyMuted) window.soilHandlerInstance.setExternallyMuted(false);
            if (window.lightSoilHandlerInstance?.setExternallyMuted && window.lightSoilHandlerInstance.isExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
        }


        this.updateUI();
        if (wasRecordMode || force) { // If it was in record mode, or forced, try to restart generative audio if conditions allow
            this.manageAudioAndVisuals();
        }
        if (this.debugMode) console.log(`🌡️ exitRecordMode: Finished. isRecordMode=${this.isRecordMode}, isPlaying=${this.isPlaying}`);
    }

    startAudio() {
        if (this.isRecordMode) {
            if (this.debugMode) console.log("🌡️ startAudio (generative): Blocked, in record mode.");
            return;
        }
        if (this.isExternallyMuted || !this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.warn(`🌡️ startAudio (generative): Blocked. ExtMuted=${this.isExternallyMuted}, AudioEnabled=${this.audioEnabled}, ToneInit=${this.toneInitialized}`);
            this.updateUI(); return;
        }
        if (this.isFadingOut) {
            if (this.debugMode) console.log('🌡️ startAudio (generative): Cancelling fade-out.');
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
        }
        if (this.isPlaying) {
            if (this.debugMode) console.log("🌡️ startAudio (generative): Called, but already playing. Ensuring params.");
            this.updateSoundParameters(); this.updateUI(); return;
        }
        if (!this.deviceStates.temperature.connected || !this.isActive) {
            if (this.debugMode) console.log(`🌡️ startAudio (generative): Conditions not met (DeviceConnected:${this.deviceStates.temperature.connected}, SensorActive:${this.isActive}).`);
            this.updateUI(); return;
        }
        if (!this.liquidSynth || !this.punchySynth || !this.mainTempLoop || !this.accentLoop) {
            console.error("❌ startAudio (generative) Temp: Critical: Synths/Loops not available. Attempting re-init.");
            this.initTone();
            if (!this.liquidSynth || !this.punchySynth || !this.mainTempLoop || !this.accentLoop) {
                console.error("❌ startAudio (generative) Temp: Critical: Re-init failed. Cannot start.");
                return;
            }
            if (this.isPlaying) return; // Re-check after init
        }

        if (this.debugMode) console.log('🌡️ startAudio (generative): Starting...');
        this.isPlaying = true;
        this.isFadingOut = false;

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('🌡️ startAudio (generative): Tone.Transport started.');
        }

        this.updateSoundParameters(); // Set initial volumes and params

        if (this.mainTempLoop && this.mainTempLoop.state !== "started") this.mainTempLoop.start(0);
        if (this.accentLoop && this.accentLoop.state !== "started") this.accentLoop.start(0);

        if (this.debugMode) console.log('🌡️ startAudio (generative): Loops started. isPlaying is true.');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (!this.audioEnabled || !this.toneInitialized) {
            this.isPlaying = false; this.isFadingOut = false;
            if (this.debugMode && !force) console.warn("🌡️ stopAudio (generative): Audio system not ready. Forcing isPlaying=false.");
            this.updateUI(); return;
        }
        if (!this.isPlaying && !this.isFadingOut && !force) {
            return;
        }
        if (this.isFadingOut && !force) {
            return;
        }

        if (this.debugMode) console.log(`🌡️ stopAudio (generative): Stopping. Forced: ${force}, WasPlaying: ${this.isPlaying}, WasFading: ${this.isFadingOut}`);

        const wasPlaying = this.isPlaying;
        this.isPlaying = false;

        if (!force && wasPlaying) {
            this.isFadingOut = true;
        } else {
            this.isFadingOut = false;
        }

        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.liquidSynth?.volume) {
            this.liquidSynth.volume.cancelScheduledValues(Tone.now());
            this.liquidSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }
        if (this.punchySynth?.volume) {
            this.punchySynth.volume.cancelScheduledValues(Tone.now());
            this.punchySynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);

        const completeStop = () => {
            if (this.mainTempLoop?.state === "started") this.mainTempLoop.stop(0);
            if (this.accentLoop?.state === "started") this.accentLoop.stop(0);

            if (this.liquidSynth?.volume) this.liquidSynth.volume.value = -Infinity;
            if (this.punchySynth?.volume) this.punchySynth.volume.value = -Infinity;

            this.isFadingOut = false;
            if (this.debugMode) console.log('🌡️ stopAudio (generative): Fully stopped and loops cleared.');
            this.updateUI();
        };

        if (force || !wasPlaying) {
            completeStop();
        } else {
            this.stopTimeoutId = setTimeout(completeStop, (this.fadeDuration * 1000 + 150));
        }

        if (!force || !wasPlaying) { // Update UI immediately if not forced full stop or wasn't playing
             this.updateUI();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const initTemperatureHandler = () => {
        if (window.creatune && window.Tone) {
            if (!window.temperatureHandlerInstance) { // Changed instance name
                window.temperatureHandlerInstance = new TemperatureHandler();
                if (window.temperatureHandlerInstance.debugMode) console.log('🌡️ Temperature Handler instance created.');
            }
        } else {
            // Attempt to access debugMode safely if instance might exist but dependencies don't
            const tempDebugMode = (window.temperatureHandlerInstance && typeof window.temperatureHandlerInstance.debugMode !== 'undefined')
                                  ? window.temperatureHandlerInstance.debugMode : true; // Default to true for logging if unsure
            if (tempDebugMode) console.log('🌡️ Waiting for TemperatureHandler dependencies (DOMContentLoaded)...');
            setTimeout(initTemperatureHandler, 100);
        }
    };
    initTemperatureHandler();
});

// CommonJS export for potential testing, not strictly necessary for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemperatureHandler;
}