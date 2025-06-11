class TemperatureHandler {
    constructor() {
        // Synths and Loops - Temperature Style
        this.liquidSynth = null;
        this.punchySynth = null;
        this.mainTempLoop = null;
        this.accentLoop = null;
        this.cyclicLoop = null; // Added for Gamelan patterns
        this.liquidSynthWrapper = null; 

        // Audio Params - Temperature Style
        this.fadeDuration = 1.8;
        this.baseLiquidVolume = 2; // INCREASED: For more prominent liquidSynth in general and for record mode
        this.basePunchyVolume = 4; // DECREASED: As punchySynth is now only for generative accents
        // Rhythmic playback volume will be handled by baseLiquidVolume directly

        // State
        this.isActive = false;
        this.isPlaying = false; 
        this.isFadingOut = false;
        this.audioEnabled = false;
        this.toneInitialized = false;
        this.debugMode = true;
        this.stopTimeoutId = null;
        this.isExternallyMuted = false;

        this.currentTempCondition = "mild"; 
        this.currentTempAppValue = 0.5;     
        this.currentHumidity = 50;          
        this.deviceStates = {
            temperature: { connected: false } 
        };

        // Sprite Animation State
        this.tempCreatureCurrentFrame = 0;
        this.tempCreatureTotalFrames = 6; 

        // DOM Elements
        this.tempCreatureVisual = document.querySelector('.temp-creature'); 
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
        // Adjusted to match light.js for sensitivity
        this.rhythmThreshold = -30; 
        this.rhythmNoteCooldown = 150; // Was 180, matched light.js
        this.lastRhythmNoteTime = 0; // Used by _setupRhythmicPlayback
        this.recordedAudioBlobUrl = null;

        // Note Display
        this.noteDisplayTimeoutId = null;
        this.lastDisplayedNote = null;

        // REMOVED live rhythm properties:
        // this.liveRhythmFollower = null;
        // this.liveRhythmicLoop = null;
        // this.lastRhythmNoteTimeLive = 0; 

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

        if (this.debugMode) console.log('🌡️ TemperatureHandler: Initializing Tone.js components (Enhanced Gamelan)...');
        try {
            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
                if (this.debugMode) console.log('🌡️ TemperatureHandler: Tone.Transport started in initTone.');
            }

            // Create a more complex effects chain for authentic Gamelan timbre
            const masterCompressor = new Tone.Compressor({
                threshold: -24,
                ratio: 3,
                attack: 0.05,
                release: 0.1
            }).toDestination();
            
            // Longer, sparser reverb for bronze resonance feel
            const masterReverb = new Tone.Reverb({
                decay: 2.8,
                preDelay: 0.02,
                wet: 0.45
            }).connect(masterCompressor);
            
            // Very subtle chorus for slight detuning (like multiple same-note instruments in ensemble)
            const masterChorus = new Tone.Chorus({
                frequency: 0.6,
                delayTime: 2.5,
                depth: 0.15,
                feedback: 0.1,
                type: "sine", // smoother waveform
                wet: 0.25
            }).connect(masterReverb);

            // A little ping-pong delay for spatial movement
            const pingPong = new Tone.PingPongDelay({
                delayTime: "8n.",
                feedback: 0.25,
                wet: 0.2
            }).connect(masterChorus);
            
            // MetalSynth for more authentic metallophone/gong sound
            this.liquidSynth = new Tone.MetalSynth({
                frequency: 200,
                envelope: {
                    attack: 0.015,
                    decay: 0.8,
                    release: 2.5 
                },
                harmonicity: 2.1,
                modulationIndex: 12,
                resonance: 500,
                octaves: 1.5,
                volume: -Infinity
            });
            
            // Additional membrane synth mixed with metal for fuller sound
            const membraneComp = new Tone.MembraneSynth({
                pitchDecay: 0.08,
                octaves: 3,
                oscillator: {type: "sine"},
                envelope: {
                    attack: 0.006,
                    decay: 0.5,
                    sustain: 0.1,
                    release: 1.4
                },
                volume: -12 // Quieter to blend
            }).connect(pingPong);

            // Combine MetalSynth with low membrane for fuller sound
            const metalGain = new Tone.Gain(0.7).connect(pingPong);
            this.liquidSynth.connect(metalGain);

            // Create a wrapper object that triggers both synths
            this.liquidSynthWrapper = {
                triggerAttackRelease: (note, duration, time, velocity) => {
                    this.liquidSynth.triggerAttackRelease(note, duration, time, velocity);
                    // Trigger membrane an octave down for low "gong" foundation, but only on certain notes
                    if (Math.random() < 0.4) {
                        const lowerNote = Tone.Frequency(note).transpose(-12).toNote();
                        membraneComp.triggerAttackRelease(lowerNote, duration, time, velocity * 0.6);
                    }
                },
                volume: this.liquidSynth.volume
            };

            // Bonang/kenong type sound
            this.punchySynth = new Tone.FMSynth({
                harmonicity: 1.5, 
                modulationIndex: 7,
                detune: 0,
                oscillator: {
                    type: "triangle8"
                },
                envelope: {
                    attack: 0.002,
                    decay: 0.3, // SLIGHTLY INCREASED from 0.25
                    sustain: 0.0, 
                    release: 0.15  // SLIGHTLY INCREASED from 0.1
                },
                modulation: {
                    type: "square" 
                },
                modulationEnvelope: {
                    attack: 0.001,
                    decay: 0.1,
                    sustain: 0.0,
                    release: 0.05
                },
                volume: 0 // MODIFIED: Explicitly set synth's internal base volume to 0dB
            }).connect(pingPong);

            this.createMainTempLoop();
            this.createAccentLoop();
            this.createCyclicLoop(); // New method added below

            this.toneInitialized = true;
            if (this.debugMode) console.log('🌡️ TemperatureHandler: Enhanced Gamelan components initialized.');
            this.manageAudioAndVisuals();

        } catch (error) {
            console.error('❌ TemperatureHandler: Error during Tone.js component initialization:', error);
            this.toneInitialized = false;
            if (this.liquidSynth) { this.liquidSynth.dispose(); this.liquidSynth = null; }
            if (this.punchySynth) { this.punchySynth.dispose(); this.punchySynth = null; }
            if (this.mainTempLoop) { this.mainTempLoop.dispose(); this.mainTempLoop = null; }
            if (this.accentLoop) { this.accentLoop.dispose(); this.accentLoop = null; }
            if (this.cyclicLoop) { this.cyclicLoop.dispose(); this.cyclicLoop = null; }
        }
    }

    triggerCreatureAnimation() {
        if (this.isCurrentlyRecording) {
            return;
        }
        if (this.tempCreatureVisual && this.tempCreatureVisual.classList.contains('active')) {
            this.tempCreatureCurrentFrame = (this.tempCreatureCurrentFrame + 1) % this.tempCreatureTotalFrames;
            this.tempCreatureVisual.style.backgroundPositionX = (this.tempCreatureCurrentFrame * 20) + '%';
            // Reduced log spam
            if (this.debugMode && Math.random() < 0.01) {
                 console.log(`🌡️ Temp Creature Animation: Frame ${this.tempCreatureCurrentFrame}`);
            }
        }
    }

    _displayNote(note) {
        const noteDisplayElement = document.querySelector('#notes-display p');
        if (noteDisplayElement) {
            if (this.noteDisplayTimeoutId) {
                clearTimeout(this.noteDisplayTimeoutId);
            }
            noteDisplayElement.textContent = note; // Removed emoji prefix
            this.lastDisplayedNote = note;
            this.noteDisplayTimeoutId = setTimeout(() => {
                if (noteDisplayElement.textContent === this.lastDisplayedNote) { // Removed emoji prefix from comparison
                    noteDisplayElement.textContent = '-';
                }
            }, 1200); 
        }
    }

    createMainTempLoop() {
        if (!this.liquidSynthWrapper) return; 
        // Gamelan Slendro-ish scale C, D, F, G, A# (using common Western equivalents)
        const tempNotes = ["C3", "D3", "F3", "G3", "A#3", "C4", "D4", "F4", "G4", "A#4"]; 
        
        this.mainTempLoop = new Tone.Pattern((time, note) => {
            if (!this.isPlaying || !this.liquidSynthWrapper || this.liquidSynthWrapper.volume.value === -Infinity) return;
            const velocity = Math.max(0.25, this.currentTempAppValue * 0.5 + 0.2); 
            
            let finalNote = note;
            if (Math.random() < 0.15) { 
                const octaveShift = Math.random() < 0.5 ? 12 : -12;
                try {
                    const shifted = Tone.Frequency(note).transpose(octaveShift).toNote();
                    // Ensure the shifted note is within a reasonable range if desired
                    if (tempNotes.includes(shifted.slice(0,-1) + "3") || tempNotes.includes(shifted.slice(0,-1) + "4")) { // Basic check
                        finalNote = shifted;
                    }
                } catch (e) { /* Use original */ }
            }
            
            const lookAhead = Tone.context.lookAhead > 0 ? Tone.context.lookAhead : 0.01;
            this.liquidSynthWrapper.triggerAttackRelease(finalNote, "0:2", time + lookAhead, velocity); 
            this.triggerCreatureAnimation();
            this._displayNote(finalNote);
        }, tempNotes, "randomWalk"); // CHANGED to randomWalk for more melodic movement
        this.mainTempLoop.interval = "0:2"; // SLOWED DOWN from "0:3" (now half note)
        this.mainTempLoop.humanize = "8n";
    }

    createAccentLoop() {
        if (!this.punchySynth) return;
        const accentNotes = ["F1", "G1", "A1", "A#1", "C2", "D2", "D#1"];
        
        this.accentLoop = new Tone.Loop(time => {
            if (!this.isPlaying || !this.punchySynth || this.punchySynth.volume.value === -Infinity) return;
            const velocity = Math.max(0.35, (1 - this.currentTempAppValue) * 0.45 + 0.25); 
            const noteToPlay = accentNotes[Math.floor(Math.random() * accentNotes.length)]; 

            const lookAhead = Tone.context.lookAhead > 0 ? Tone.context.lookAhead : 0.01; // ADDED lookAhead
            this.punchySynth.triggerAttackRelease(noteToPlay, "8n", time + lookAhead, velocity); 
        }, "2m"); // SLOWED DOWN from "1m" (now every 2 measures)
        this.accentLoop.probability = 0.20; // Slightly increased base probability
        this.accentLoop.humanize = "8n";
    }

    createCyclicLoop() {
        if (!this.liquidSynthWrapper) return;
        // Using a more structured melodic phrase
        const cyclicNotes = [ "C3", "D3", "F3", "D3", "C3", null, "G2", "A#2", "C3", null ]; // Added nulls for rests
        
        this.cyclicLoop = new Tone.Sequence((time, note) => {
            if (!this.isPlaying || !this.liquidSynthWrapper || this.liquidSynthWrapper.volume.value === -Infinity || note === null) return;
            
            const velocity = Math.max(0.2, this.currentTempAppValue * 0.4 + 0.15);
            const duration = "0:1.5"; // Consistent duration for this melodic line
            
            const lookAhead = Tone.context.lookAhead > 0 ? Tone.context.lookAhead : 0.01;
            this.liquidSynthWrapper.triggerAttackRelease(note, duration, time + lookAhead, velocity);
            if (Math.random() < 0.3) {
                this.triggerCreatureAnimation();
            }
            this._displayNote(note); 
        }, cyclicNotes, "4n"); 
        
        this.cyclicLoop.probability = 0.8;
        this.cyclicLoop.humanize = true;
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
                if (this.isRecordMode) {
                    this.exitRecordMode(true); // Force exit
                } else {
                    this.manageAudioAndVisuals(); // This will stop audio if needed
                }
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
                    (!window.lightSoilHandlerInstance || !window.lightSoilHandlerInstance.isRecordMode) &&
                    (!window.tempSoilHandlerInstance || !window.tempSoilHandlerInstance.isRecordMode) && // ADDED tempSoil check
                    (!window.tempLightHandlerInstance || !window.tempLightHandlerInstance.isRecordMode)    // ADDED tempLight check
                ) {
                    this.enterRecordMode();
                } else if (this.debugMode && !this.isRecordMode) {
                    console.log(`🌡️ Record mode NOT entered for Temperature. Conditions: temp.connected=${this.deviceStates.temperature.connected}, isRecordMode=${this.isRecordMode}, isActive=${this.isActive}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, lightRec=${window.lightHandlerInstance?.isRecordMode}, soilRec=${window.soilHandlerInstance?.isRecordMode}, lsRec=${window.lightSoilHandlerInstance?.isRecordMode}, tsRec=${window.tempSoilHandlerInstance?.isRecordMode}, tlRec=${window.tempLightHandlerInstance?.isRecordMode}`); // ADDED tsRec, tlRec
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
            if (this.debugMode) console.log(`🌡️ updateSoundParameters: Bailed. Conditions: toneInitialized=${this.toneInitialized}, audioEnabled=${this.audioEnabled}, isExternallyMuted=${this.isExternallyMuted}, isRecordMode=${this.isRecordMode}, isPlaying=${this.isPlaying}`);
            return;
        }

        const isSensorActive = this.isActive && this.deviceStates.temperature.connected;
        if (this.debugMode) console.log(`🌡️ updateSoundParameters: Called. isSensorActive=${isSensorActive} (isActive=${this.isActive}, temp.connected=${this.deviceStates.temperature.connected})`);

        const RAMP_TOLERANCE = 0.01; // If diff is less than this, don't ramp

        // Liquid Synth Parameters (Gamelan-inspired)
        if (this.liquidSynthWrapper && this.liquidSynthWrapper.volume) { 
            const dynamicVolumePart = this.currentTempAppValue * 10; 
            const targetVolume = isSensorActive ? (this.baseLiquidVolume - 3 + dynamicVolumePart) : -Infinity;
            
            if (Math.abs(this.liquidSynthWrapper.volume.value - targetVolume) > RAMP_TOLERANCE || targetVolume === -Infinity && this.liquidSynthWrapper.volume.value > -80) {
                this.liquidSynthWrapper.volume.linearRampTo(targetVolume, 0.7);
            }

            if (this.liquidSynth) {
                let harmonicityTarget = 2.1; 
                let modIndexTarget = 12;     
                let resonanceTarget = 500;   

                if (this.currentTempCondition === "very_cold") { harmonicityTarget = 1.8; modIndexTarget = 10; resonanceTarget = 400; }
                else if (this.currentTempCondition === "cold") { harmonicityTarget = 2.0; modIndexTarget = 11; resonanceTarget = 450; }
                else if (this.currentTempCondition === "cool") { harmonicityTarget = 2.1; modIndexTarget = 12; resonanceTarget = 500; }
                else if (this.currentTempCondition === "mild") { harmonicityTarget = 2.2; modIndexTarget = 13; resonanceTarget = 550; }
                else if (this.currentTempCondition === "warm") { harmonicityTarget = 2.3; modIndexTarget = 14; resonanceTarget = 600; }
                else if (this.currentTempCondition === "hot") { harmonicityTarget = 2.4; modIndexTarget = 15; resonanceTarget = 650; }

                if (this.liquidSynth.harmonicity !== undefined) this.liquidSynth.harmonicity = harmonicityTarget;
                if (this.liquidSynth.modulationIndex !== undefined) this.liquidSynth.modulationIndex = modIndexTarget;
                if (this.liquidSynth.resonance !== undefined) this.liquidSynth.resonance = resonanceTarget;
            }
        }

        // Main Temp Loop Interval (Liquid Synth)
        if (this.mainTempLoop) {
            if (this.currentTempAppValue < 0.2) this.mainTempLoop.interval = "0:4"; 
            else if (this.currentTempAppValue < 0.4) this.mainTempLoop.interval = "0:3"; 
            else if (this.currentTempAppValue < 0.6) this.mainTempLoop.interval = "0:2";   
            else if (this.currentTempAppValue < 0.8) this.mainTempLoop.interval = "1m";   
            else this.mainTempLoop.interval = "1:2"; 
        }

        // Punchy Synth Parameters & Accent Loop (Gamelan-inspired)
        if (this.punchySynth && this.punchySynth.volume && this.accentLoop) {
            const calculatedGenerativePunchyVol = this.basePunchyVolume - 2 + (this.currentTempAppValue * 4);
            const targetPunchyVol = isSensorActive ? calculatedGenerativePunchyVol : -Infinity;

            if (this.debugMode) {
                // Log the raw targetPunchyVol to see the float precision
                console.log(`%c🌡️ updateSoundParameters (PunchySynth): isSensorActive=${isSensorActive}. Calculated Generative Vol (if active): ${calculatedGenerativePunchyVol.toFixed(2)}. TargetPunchyVol (raw): ${targetPunchyVol}. Current PunchySynth Vol before ramp: ${this.punchySynth.volume.value.toFixed(2)}`, "color: #3498db");
            }

            // Only ramp if the difference is significant or if ramping to -Infinity from a non-silent state
            if (Math.abs(this.punchySynth.volume.value - targetPunchyVol) > RAMP_TOLERANCE || (targetPunchyVol === -Infinity && this.punchySynth.volume.value > -80) ) {
                this.punchySynth.volume.linearRampTo(targetPunchyVol, 0.6);
            }


            let accentProb = 0.15; 
            if (this.currentTempCondition === "very_cold") accentProb = 0.08;
            else if (this.currentTempCondition === "cold") accentProb = 0.12;
            else if (this.currentTempCondition === "hot") accentProb = 0.25;
            else if (this.currentTempCondition === "warm") accentProb = 0.20;
            this.accentLoop.probability = isSensorActive ? accentProb : 0;
        }

        // Adjust the cyclic pattern based on temperature:
        if (this.cyclicLoop) {
            let cycleProb = 0.8; 
            if (this.currentTempCondition === "very_cold") cycleProb = 0.5;
            else if (this.currentTempCondition === "cold") cycleProb = 0.65;
            else if (this.currentTempCondition === "hot") cycleProb = 0.95;
            
            this.cyclicLoop.probability = this.isActive && this.deviceStates.temperature.connected ? cycleProb : 0;
            
            // Adjust overall speed of the sequence based on temperature
            if (this.currentTempAppValue < 0.3) {
                this.cyclicLoop.playbackRate = 0.75; // Slower for cold
            } else if (this.currentTempAppValue < 0.7) {
                this.cyclicLoop.playbackRate = 1.0;  // Normal for mild
            } else {
                this.cyclicLoop.playbackRate = 1.25; // Faster for hot
            }
        }
        
        if (this.debugMode && Math.random() < 0.03) console.log(`🌡️ USParams (Gamelan): LiquidVol=${this.liquidSynthWrapper?.volume.value.toFixed(1)}, PunchyVol=${this.punchySynth?.volume.value.toFixed(1)}, MainLoopInterval=${this.mainTempLoop?.interval}, AccentProb=${this.accentLoop?.probability.toFixed(2)}, CycleProb=${this.cyclicLoop?.probability.toFixed(2)}, CycleRate=${this.cyclicLoop?.playbackRate.toFixed(2)}`);
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
                'tempsoil-active-bg', // ADDED tempsoil
                'templight-active-bg', // ADDED templight
                'idle-bg' 
            ];
            const allOldTempConditionBgs = ['temp-very-cold-bg', 'temp-cold-bg', 'temp-cool-bg', 'temp-mild-bg', 'temp-warm-bg', 'temp-hot-bg'];
            allOldTempConditionBgs.forEach(cls => this.frameBackground.classList.remove(cls));

            if (this.isRecordMode) {
                this.frameBackground.classList.add('record-mode-pulsing');
                this.frameBackground.classList.add(tempBgClass);
                otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
            } else {
                this.frameBackground.classList.remove('record-mode-pulsing');

                // MODIFIED: Rely only on 'connected' and 'not externally muted' for showing temp-active-bg
                const shouldShowTempBackground = this.deviceStates.temperature.connected && !this.isExternallyMuted;

                if (shouldShowTempBackground) {
                    this.frameBackground.classList.add(tempBgClass);
                    otherHandlersBgClasses.forEach(cls => this.frameBackground.classList.remove(cls));
                } else {
                    this.frameBackground.classList.remove(tempBgClass);
                }
            }
        }

        if (this.stopRecordModeButton) {
            const lightInRec = window.lightHandlerInstance?.isRecordMode;
            const soilInRec = window.soilHandlerInstance?.isRecordMode;
            const lightSoilInRec = window.lightSoilHandlerInstance?.isRecordMode;
            const tempSoilInRec = window.tempSoilHandlerInstance?.isRecordMode; // ADDED
            const tempLightInRec = window.tempLightHandlerInstance?.isRecordMode; // ADDED

            if (this.isRecordMode) {
                this.stopRecordModeButton.style.display = 'block';
            } else if (!lightInRec && !soilInRec && !lightSoilInRec && !tempSoilInRec && !tempLightInRec) { // ADDED tempSoilInRec, tempLightInRec
                // Hide button only if NO handler is in record mode
                this.stopRecordModeButton.style.display = 'none';
            }
        }
        if (this.debugMode && Math.random() < 0.05) console.log(`🌡️ UI Update (Temp): CreatureActive=${showCreature}, DeviceConnected=${this.deviceStates.temperature.connected}, RecModeTemp=${this.isRecordMode}, ExtMuteTemp=${this.isExternallyMuted}, TempCond=${this.currentTempCondition}, FrameBG Classes: ${this.frameBackground?.classList.toString()}`);
    }
    async enterRecordMode() {
        if (this.isRecordMode || !this.audioEnabled || !this.toneInitialized || !this.isActive) { // Added isActive check
            if (this.debugMode) console.warn(`🌡️ enterRecordMode: Blocked. isRecordMode=${this.isRecordMode}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}, isActive=${this.isActive}`);
            return;
        }
        // Check other handlers
        if (window.lightHandlerInstance?.isRecordMode || 
            window.soilHandlerInstance?.isRecordMode || 
            window.lightSoilHandlerInstance?.isRecordMode ||
            window.tempSoilHandlerInstance?.isRecordMode || // ADDED
            window.tempLightHandlerInstance?.isRecordMode    // ADDED
            ) {
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
        if (window.tempSoilHandlerInstance?.setExternallyMuted) window.tempSoilHandlerInstance.setExternallyMuted(true); // ADDED
        if (window.tempLightHandlerInstance?.setExternallyMuted) window.tempLightHandlerInstance.setExternallyMuted(true); // ADDED

        this.updateUI();
        await new Promise(resolve => setTimeout(resolve, 200)); // Short delay

        if (!this.isRecordMode) { 
            if (this.debugMode) console.log('🌡️ enterRecordMode: Exited during pre-recording wait. Restoring other handlers.');
            if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
            if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(false);
            if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
            if (window.tempSoilHandlerInstance?.setExternallyMuted) window.tempSoilHandlerInstance.setExternallyMuted(false); // ADDED
            if (window.tempLightHandlerInstance?.setExternallyMuted) window.tempLightHandlerInstance.setExternallyMuted(false); // ADDED
            return;
        }

        try {
            this.mic = new Tone.UserMedia();
            await this.mic.open();

            if (!this.isRecordMode) { 
                if (this.debugMode) console.log('🌡️ enterRecordMode: Exited during mic permission prompt.');
                if (this.mic.state === "started") this.mic.close(); this.mic = null;
                if (window.lightHandlerInstance?.setExternallyMuted) window.lightHandlerInstance.setExternallyMuted(false);
                if (window.soilHandlerInstance?.setExternallyMuted) window.soilHandlerInstance.setExternallyMuted(false);
                if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false);
                if (window.tempSoilHandlerInstance?.setExternallyMuted) window.tempSoilHandlerInstance.setExternallyMuted(false); // ADDED
                if (window.tempLightHandlerInstance?.setExternallyMuted) window.tempLightHandlerInstance.setExternallyMuted(false); // ADDED
                return;
            }

            if (this.debugMode) console.log('🌡️ enterRecordMode: Mic opened.');
            
            // REMOVED Live rhythmic response setup. Recording will be silent.

            this.isCurrentlyRecording = true;
            this.recorder = new Tone.Recorder();
            this.mic.connect(this.recorder); 
            this.recorder.start();
            if (this.debugMode) console.log(`🌡️ enterRecordMode: Recording started for ${this.recordingDuration / 1000} seconds...`);

            setTimeout(async () => { // Ensure this is an arrow function
                // REMOVED Live rhythmic response teardown.

                this.isCurrentlyRecording = false;
                if (!this.recorder || !this.isRecordMode) {
                    if (this.debugMode) console.log('🌡️ enterRecordMode (timeout): No longer in active recording state or record mode.');
                    if (this.mic?.state === "started") this.mic.close(); this.mic = null;
                    if (this.recorder?.state === "started") { try { await this.recorder.stop(); } catch (e) { /*ignore*/ } }
                    if (this.isRecordMode) this.exitRecordMode(true); 
                    return;
                }

                const audioBlob = await this.recorder.stop();
                if (this.mic?.state === "started") this.mic.close(); this.mic = null; 
                if (this.debugMode) console.log('🌡️ enterRecordMode (timeout): Recording stopped. Blob size:', audioBlob.size);

                if (!this.isRecordMode) {
                    if (this.debugMode) console.log('🌡️ enterRecordMode (timeout): Exited during recording. Not setting up playback.');
                    return;
                }
                // This is the call around line 761
                if (typeof this._setupRhythmicPlayback === 'function') {
                    this._setupRhythmicPlayback(audioBlob); 
                } else {
                    console.error('❌ FATAL: this._setupRhythmicPlayback is NOT a function in setTimeout callback!', this);
                    alert('Error: Playback setup failed. Check console.');
                    this.exitRecordMode(true);
                }
            }, this.recordingDuration);

        } catch (err) {
            console.error(`❌ enterRecordMode: Error during mic setup: ${err.message}`, err);
            alert(`Could not start recording for Temperature: ${err.message}. Check console and browser permissions.`);
            this.isCurrentlyRecording = false;
            // REMOVED Cleanup of live components as they are no longer used.
            this.exitRecordMode(true); 
        }
    }

    async _setupRhythmicPlayback(audioBlob) {
        if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback: Starting with blob size:', audioBlob.size);

        if (!this.isRecordMode || !this.toneInitialized || !this.liquidSynthWrapper || !this.liquidSynth) { // Check for liquidSynthWrapper
            if (this.debugMode) console.warn(`🌡️ _setupRhythmicPlayback: Conditions not met. isRecordMode=${this.isRecordMode}, toneInitialized=${this.toneInitialized}, liquidSynthWrapper=${!!this.liquidSynthWrapper}. Forcing exit.`);
            this.exitRecordMode(true); // Force exit if conditions are bad
            return;
        }

        try {
            // Ensure liquidSynthWrapper (and its underlying liquidSynth) is ready for rhythmic playback
            if (this.liquidSynth && this.liquidSynth.volume) {
                this.liquidSynth.volume.cancelScheduledValues(Tone.now()); // Cancel any ramps
                this.liquidSynth.volume.value = this.baseLiquidVolume; 
                if (this.debugMode) console.log(`🌡️ _setupRhythmicPlayback: liquidSynth (for wrapper) volume set to ${this.baseLiquidVolume} dB for rhythmic notes.`);
            } else {
                console.error("❌ _setupRhythmicPlayback: liquidSynth not available for rhythmic playback.");
                this.exitRecordMode(true);
                return;
            }

            // Ensure punchySynth (generative accent) is silent during record mode playback
            if (this.punchySynth?.volume) {
                 this.punchySynth.volume.cancelScheduledValues(Tone.now());
                 this.punchySynth.volume.value = -Infinity;
                 if (this.debugMode) console.log(`🌡️ _setupRhythmicPlayback: punchySynth volume set to -Infinity.`);
            }


            if (this.recordedAudioBlobUrl) {
                URL.revokeObjectURL(this.recordedAudioBlobUrl);
            }
            this.recordedAudioBlobUrl = URL.createObjectURL(audioBlob);

            this.rhythmFollower = new Tone.Meter({ smoothing: 0.2 });
            this.lastRhythmNoteTime = 0;

            // Notes more suitable for the liquidSynthWrapper's character
            const rhythmicNotes = ["C2", "D2", "F2", "G2", "A#2", "C3", "D3"]; 

            this.recordedBufferPlayer = new Tone.Player({
                url: this.recordedAudioBlobUrl,
                loop: true,
                onload: () => {
                    if (!this.isRecordMode || !this.recordedBufferPlayer) {
                        if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Record mode exited or player disposed during load. Aborting playback setup.');
                        this.recordedBufferPlayer?.dispose(); this.recordedBufferPlayer = null;
                        this.rhythmFollower?.dispose(); this.rhythmFollower = null;
                        this.rhythmicLoop?.dispose(); this.rhythmicLoop = null;
                        if (this.liquidSynth?.volume.value === this.baseLiquidVolume) { // Check against baseLiquidVolume
                            this.liquidSynth.volume.value = -Infinity; // Ensure it's silenced if we abort
                        }
                        this.manageAudioAndVisuals(); 
                        return;
                    }

                    if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Recorded buffer player loaded.');
                    this.recordedBufferPlayer.connect(this.rhythmFollower);
                    this.recordedBufferPlayer.toDestination(); // User hears their recording
                    this.recordedBufferPlayer.start();
                    if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Recorded buffer player started.');

                    this.rhythmicLoop = new Tone.Loop(time => {
                        if (!this.isRecordMode || !this.rhythmFollower || !this.liquidSynthWrapper || !this.recordedBufferPlayer || this.recordedBufferPlayer.state !== 'started') {
                            return; 
                        }

                        const level = this.rhythmFollower.getValue();
                        const currentTime = Tone.now() * 1000;

                        if (level > this.rhythmThreshold && (currentTime - this.lastRhythmNoteTime > this.rhythmNoteCooldown)) {
                            const noteToPlay = rhythmicNotes[Math.floor(Math.random() * rhythmicNotes.length)];
                            const velocity = 1.0; 
                            const duration = "8n."; // Slightly longer duration for liquidSynthWrapper

                            if (this.debugMode) {
                                console.log(`%c🌡️ Rhythmic trigger (Temp LiquidSynthWrapper)! Level: ${typeof level === 'number' ? level.toFixed(2) : level}, Note: ${noteToPlay}, Velocity: ${velocity.toFixed(2)}, Duration: "${duration}"`, "color: #2ecc71");
                            }
                            
                            this.liquidSynthWrapper.triggerAttackRelease(noteToPlay, duration, time, velocity);
                            this.triggerCreatureAnimation();
                            this._displayNote(noteToPlay);
                            this.lastRhythmNoteTime = currentTime;
                        }
                    }, "16n").start(); 
                    if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback (onload): Rhythmic loop with liquidSynthWrapper initiated.');
                },
                onerror: (err) => {
                    console.error('❌ _setupRhythmicPlayback: Error loading recorded buffer player for Temperature:', err);
                    this.exitRecordMode(true); 
                }
            });

            if (Tone.Transport.state !== "started") {
                Tone.Transport.start();
            }
            if (this.debugMode) console.log('🌡️ _setupRhythmicPlayback: Setup initiated, player loading asynchronously.');

        } catch (error) {
            console.error('❌ _setupRhythmicPlayback: Error setting up playback in TemperatureHandler:', error);
            this.exitRecordMode(true); // Force exit on general error
        }
    }

    startAudio() {
        if (this.isRecordMode) {
            if (this.debugMode) console.log("🌡️ startAudio (generative): Blocked, in record mode.");
            this.updateUI();
            return;
        }

        const sensorEffectivelyActive = this.isActive && this.deviceStates.temperature.connected;

        if (this.isExternallyMuted ||
            !this.audioEnabled ||
            !this.toneInitialized ||
            !sensorEffectivelyActive ||
            !this.punchySynth || // punchySynth is used by accentLoop
            !this.liquidSynthWrapper || // liquidSynthWrapper is used by mainTempLoop and cyclicLoop
            !this.mainTempLoop ||
            !this.accentLoop ||
            !this.cyclicLoop) {

            if (this.debugMode) {
                console.warn(`🌡️ startAudio (generative): Blocked. Details:
                    ExtMuted=${this.isExternallyMuted},
                    AudioEnabled=${this.audioEnabled},
                    ToneInit=${this.toneInitialized},
                    SensorEffectivelyActive=${sensorEffectivelyActive} (isActive=${this.isActive}, temp.connected=${this.deviceStates.temperature.connected}),
                    PunchySynthExists=${!!this.punchySynth},
                    LiquidSynthWrapperExists=${!!this.liquidSynthWrapper},
                    MainTempLoopExists=${!!this.mainTempLoop},
                    AccentLoopExists=${!!this.accentLoop},
                    CyclicLoopExists=${!!this.cyclicLoop}`);
            }
            this.updateUI();
            return;
        }

        if (this.isFadingOut) {
            if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
            this.isFadingOut = false;
            if (this.liquidSynthWrapper?.volume) this.liquidSynthWrapper.volume.cancelScheduledValues(Tone.now());
            if (this.punchySynth?.volume) this.punchySynth.volume.cancelScheduledValues(Tone.now());
        }

        if (this.isPlaying) {
            this.updateSoundParameters(); // Already playing, just update params
            this.updateUI();
            return;
        }

        this.isPlaying = true;
        this.isFadingOut = false;
        this.updateSoundParameters(); // Sets initial volume and synth params

        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
            if (this.debugMode) console.log('🌡️ startAudio: Tone.Transport started.');
        }

        // Start loops if they are not already started.
        // Their probability/volume/interval will be handled by updateSoundParameters.
        if (this.mainTempLoop && this.mainTempLoop.state !== "started") {
            this.mainTempLoop.start(0); // Start at the next transport tick or measure
            if (this.debugMode) console.log('🌡️ startAudio: mainTempLoop started.');
        }
        if (this.accentLoop && this.accentLoop.state !== "started") {
            this.accentLoop.start(0);
            if (this.debugMode) console.log('🌡️ startAudio: accentLoop started.');
        }
        if (this.cyclicLoop && this.cyclicLoop.state !== "started") {
            this.cyclicLoop.start(0);
            if (this.debugMode) console.log('🌡️ startAudio: cyclicLoop started.');
        }

        if (this.debugMode) console.log('🌡️ TempHandler: Audio started (mainTempLoop, accentLoop, cyclicLoop).');
        this.updateUI();
    }

    stopAudio(force = false) {
        if (this.debugMode) console.log(`🌡️ stopAudio: Called. force=${force}, isPlaying=${this.isPlaying}, isFadingOut=${this.isFadingOut}, audioEnabled=${this.audioEnabled}, toneInitialized=${this.toneInitialized}`);

        if (!this.audioEnabled || !this.toneInitialized) {
            if (this.debugMode) console.log('🌡️ stopAudio: Bailed. Audio not enabled or Tone not initialized.');
            this.isPlaying = false;
            this.isFadingOut = false;
            this.updateUI();
            return;
        }

        if (!this.isPlaying && !this.isFadingOut && !force) {
            if (this.debugMode) console.log('🌡️ stopAudio: Bailed. Not playing, not fading, and not forced.');
            this.updateUI();
            return;
        }
        if (this.isFadingOut && !force) {
            if (this.debugMode) console.log('🌡️ stopAudio: Bailed. Already fading out and not forced.');
            return;
        }

        this.isPlaying = false;
        this.isFadingOut = true;
        const fadeTime = force ? 0.01 : this.fadeDuration;

        if (this.debugMode) console.log(`🌡️ stopAudio: Stopping generative audio (with fade-out: ${fadeTime}s)...`);

        // Stop all generative loops immediately
        if (this.mainTempLoop && this.mainTempLoop.state === "started") {
            this.mainTempLoop.stop(0);
            if (this.debugMode) console.log('🌡️ stopAudio: mainTempLoop stopped.');
        }
        if (this.accentLoop && this.accentLoop.state === "started") {
            this.accentLoop.stop(0);
            if (this.debugMode) console.log('🌡️ stopAudio: accentLoop stopped.');
        }
        if (this.cyclicLoop && this.cyclicLoop.state === "started") {
            this.cyclicLoop.stop(0);
            if (this.debugMode) console.log('🌡️ stopAudio: cyclicLoop stopped.');
        }

        // Ramp volumes to -Infinity
        if (this.liquidSynthWrapper?.volume) {
            this.liquidSynthWrapper.volume.cancelScheduledValues(Tone.now());
            this.liquidSynthWrapper.volume.rampTo(-Infinity, fadeTime, Tone.now());
        } else if (this.liquidSynth?.volume) { // Fallback if wrapper not fully there but synth is
            this.liquidSynth.volume.cancelScheduledValues(Tone.now());
            this.liquidSynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.punchySynth?.volume) {
            this.punchySynth.volume.cancelScheduledValues(Tone.now());
            this.punchySynth.volume.rampTo(-Infinity, fadeTime, Tone.now());
        }

        if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
        this.stopTimeoutId = setTimeout(() => {
            this.isFadingOut = false;
            // Ensure volumes are definitely -Infinity after fade
            if (this.liquidSynthWrapper?.volume) this.liquidSynthWrapper.volume.value = -Infinity;
            else if (this.liquidSynth?.volume) this.liquidSynth.volume.value = -Infinity;
            if (this.punchySynth?.volume) this.punchySynth.volume.value = -Infinity;

            if (this.debugMode) console.log('🌡️ stopAudio: Generative audio fully stopped.');
            this.updateUI();
        }, force ? 10 : (fadeTime * 1000 + 100)); // Ensure timeout is slightly longer than fade

        if (force) this.updateUI(); // Update UI immediately if forced, otherwise timeout will handle it
    }

    exitRecordMode(force = false) {
        if (!this.isRecordMode && !force) {
            if (this.debugMode) console.log(`🌡️ exitRecordMode: Called but not in record mode and not forced.`);
            return;
        }
        if (this.debugMode) console.log(`%c🌡️ exitRecordMode: Exiting record mode. Force: ${force}`, 'color: orange; font-weight: bold;');
        const wasRecordMode = this.isRecordMode;
        this.isRecordMode = false;
        this.isCurrentlyRecording = false;

        this.mic?.close(); this.mic = null;
        
        const recorder = this.recorder; this.recorder = null; // Nullify before async
        recorder?.stop().then(() => recorder.dispose()).catch(e => recorder?.dispose());
        
        this.rhythmicLoop?.stop(0).dispose(); this.rhythmicLoop = null;
        this.recordedBufferPlayer?.stop(0).dispose(); this.recordedBufferPlayer = null;
        if (this.recordedAudioBlobUrl) { URL.revokeObjectURL(this.recordedAudioBlobUrl); this.recordedAudioBlobUrl = null; }
        this.rhythmFollower?.dispose(); this.rhythmFollower = null;

        // Reset liquidSynthWrapper volume if it was used for rhythmic playback
        if (this.liquidSynthWrapper?.volume && this.liquidSynthWrapper.volume.value === this.rhythmicPlaybackVolume) {
             if (this.debugMode) console.log('🌡️ exitRecordMode: liquidSynthWrapper volume was at rhythmic level.');
            // Let updateSoundParameters handle the correct generative volume
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
        if (this.debugMode) console.log(`🌡️ exitRecordMode: Finished. isRecordMode is now ${this.isRecordMode}.`);
    }

    _unmuteOtherHandlersForRecordModeExit() {
        if (this.debugMode) console.log('🌡️ _unmuteOtherHandlersForRecordModeExit: Unmuting other handlers.');
        // Unmute LightHandler if TempLightHandler doesn't need it muted
        if (window.lightHandlerInstance?.setExternallyMuted) {
            const tlWantsLightMuted = window.tempLightHandlerInstance?.showTempLightVisualContext;
            if (!tlWantsLightMuted) {
                window.lightHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`🌡️ TempHandler: NOT unmuting Light as TL wants mute: ${tlWantsLightMuted}`);
            }
        }
        // Unmute SoilHandler if TempSoilHandler doesn't need it muted
        if (window.soilHandlerInstance?.setExternallyMuted) {
            const tsWantsSoilMuted = window.tempSoilHandlerInstance?.showTempSoilVisualContext;
            if (!tsWantsSoilMuted) {
                window.soilHandlerInstance.setExternallyMuted(false, null);
            } else if (this.debugMode) {
                console.log(`🌡️ TempHandler: NOT unmuting Soil as TS wants mute: ${tsWantsSoilMuted}`);
            }
        }
        // Unmute combined handlers (TempHandler doesn't usually mute them, but for completeness)
        // if (window.lightSoilHandlerInstance?.setExternallyMuted) window.lightSoilHandlerInstance.setExternallyMuted(false, null);
        // if (window.tempSoilHandlerInstance?.setExternallyMuted) window.tempSoilHandlerInstance.setExternallyMuted(false, null);
        // if (window.tempLightHandlerInstance?.setExternallyMuted) window.tempLightHandlerInstance.setExternallyMuted(false, null);
    }


}

// CommonJS export for potential testing, not strictly necessary for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemperatureHandler;
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