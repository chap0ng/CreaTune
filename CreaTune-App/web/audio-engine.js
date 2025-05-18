// audio-engine.js - Handles Tone.js and all audio functionality

const AudioEngine = {
    // Audio state
    isAmbientPlaying: false,
    isToyPianoPlaying: false,
    isRecording: false,
    micStream: null,
    analysisInterval: null,
    rhythmLoop: null,
    tempoMultiplier: 1.0, // Normal tempo by default
    
    // Tone.js elements
    ambientSynth: null,
    toyPianoSynth: null,
    melodySynth: null,
    reverb: null,
    
    // Initialize the audio engine
    init: function() {
        this.initializeTone();
        this.setupUIListeners();
    },
    
    // Initialize Tone.js
    initializeTone: function() {
        // Create reverb effect
        this.reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.4,
            preDelay: 0.2
        }).toDestination();
        this.reverb.generate();
        
        // Create ambient synth (wooden gamelan-like)
        this.ambientSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 3.01,
            modulationIndex: 25,
            oscillator: {
              type: "triangle"
            },
            envelope: {
              attack: 0.02,
              decay: 0.8,
              sustain: 0.1,
              release: 1.5
            },
            modulation: {
              type: "square"
            },
            modulationEnvelope: {
              attack: 0.005,
              decay: 0.3,
              sustain: 0.1,
              release: 0.8
            }
        }).connect(this.reverb);
        this.ambientSynth.volume.value = -5;
        
        // Create toy piano synth
        this.toyPianoSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: "triangle"
            },
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 1
            }
        }).connect(this.reverb);
        this.toyPianoSynth.volume.value = -5;
        
        // Add melody synth
        this.melodySynth = new Tone.PolySynth(Tone.AMSynth, {
            oscillator: {
                type: "sine"
            },
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.2,
                release: 0.8
            },
            modulation: {
                type: "square"
            },
            modulationEnvelope: {
                attack: 0.5,
                decay: 0,
                sustain: 1,
                release: 0.5
            }
        }).connect(this.reverb);
        this.melodySynth.volume.value = -10;
        
        UIController.logToUI('Tone.js synthesizers initialized');
    },
    
    // Setup audio-related UI listeners
    setupUIListeners: function() {
        // Mic button
        document.getElementById('mic-button').addEventListener('click', this.toggleMicRecording.bind(this));
        
        // Ambient button
        document.getElementById('ambient-button').addEventListener('click', this.toggleAmbientSynth.bind(this));
        
        // Toy Piano button
        document.getElementById('toy-piano-button').addEventListener('click', this.toggleToyPianoSynth.bind(this));
        
        // Tempo button
        document.getElementById('tempo-button').addEventListener('click', this.cycleTempo.bind(this));
        
        // Mic icon 
        document.getElementById('mic-icon').addEventListener('click', this.toggleMicRecording.bind(this));
    },
    
    // Toggle microphone recording
    toggleMicRecording: async function() {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        if (this.isRecording) {
            this.stopRecording();
        } else {
            // Stop any current playback before recording
            this.stopAllSynths();
            
            // Stop any rhythm loop
            if (this.rhythmLoop) {
                this.rhythmLoop.stop();
            }
            
            // Stop the transport
            Tone.Transport.stop();
            
            this.startRecording();
        }
    },
    
    // Start recording from microphone
    startRecording: async function() {
        try {
            // Request microphone access and start Tone.js
            await Tone.start();
            
            // Set up recorder with meter
            if (!this.micStream) {
                // Set up UserMedia for mic input
                const mic = new Tone.UserMedia();
                const meter = new Tone.Meter({ channels: 1 });
                await mic.open();
                mic.connect(meter);
                
                this.micStream = { mic, meter };
            }
            
            // Set recording state
            this.isRecording = true;
            const micButton = document.getElementById('mic-button');
            micButton.classList.add('active', 'recording');
            micButton.innerHTML = `<span>⏺ Recording</span>`;
            UIController.logToUI('Microphone recording started');
            
            // Detect rhythm for 5 seconds
            const rhythmTimes = [];
            let lastPulse = 0;
            const startTime = performance.now();
            const threshold = -50; // dB threshold for detecting sounds
            
            // Start analysis interval
            this.analysisInterval = setInterval(() => {
                const now = performance.now();
                const db = this.micStream.meter.getValue();
                
                // If sound above threshold and not too soon after last pulse
                if (db > threshold && now - lastPulse > 150) {
                    lastPulse = now;
                    const relativeTime = (now - startTime) / 1000;
                    rhythmTimes.push(relativeTime);
                    
                    // Visual feedback only - no sound during recording
                    UIController.logToUI(`Pulse detected at ${relativeTime.toFixed(2)}s`);
                }
                
                // End recording after 5 seconds
                if (now - startTime > 5000) {
                    clearInterval(this.analysisInterval);
                    this.analysisInterval = null;
                    
                    // Create repeating pattern from the recorded rhythm
                    if (rhythmTimes.length > 0) {
                        this.setupRhythmLoop(rhythmTimes);
                        UIController.logToUI(`Detected ${rhythmTimes.length} pulses. Loop created.`);
                    } else {
                        UIController.logToUI('No sound detected. Try again.');
                    }
                    
                    // Reset UI
                    micButton.innerHTML = `<img src="./images/mic-icon.png" id="mic-icon" alt="Microphone"><span>Loop</span>`;
                    this.isRecording = false;
                    micButton.classList.remove('recording');
                    micButton.classList.add('active');
                }
                
            }, 40); // Check every 40ms (25 times per second)
            
        } catch (err) {
            UIController.logToUI('Microphone access error: ' + err.message);
            this.isRecording = false;
            const micButton = document.getElementById('mic-button');
            micButton.classList.remove('active', 'recording');
            micButton.innerHTML = `<img src="./images/mic-icon.png" id="mic-icon" alt="Microphone"><span>Record</span>`;
        }
    },
    
    // Stop microphone recording
    stopRecording: function() {
        // Stop the analysis interval
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        
        // Close the microphone stream if exists
        if (this.micStream && this.micStream.mic) {
            this.micStream.mic.close();
            this.micStream = null;
        }
        
        this.isRecording = false;
        const micButton = document.getElementById('mic-button');
        micButton.classList.remove('active', 'recording');
        micButton.innerHTML = `<img src="./images/mic-icon.png" id="mic-icon" alt="Microphone"><span>Record</span>`;
        UIController.logToUI('Microphone recording stopped');
    },
    
    // Setup rhythm loop from recorded pulses
    setupRhythmLoop: function(times) {
        // Stop previous loop if any
        Tone.Transport.cancel();
        
        // If there's an existing rhythm loop, dispose it
        if (this.rhythmLoop) {
            this.rhythmLoop.dispose();
        }
        
        // Create a new Part with the recorded times
        this.rhythmLoop = new Tone.Part((time) => {
            // Determine which sensors to use based on connectivity
            const activeSensors = Object.keys(SensorManager.connectedSensors).filter(
                key => SensorManager.connectedSensors[key].connected
            );
            
            if (activeSensors.length > 0) {
                // Use all active sensors for rich polyphonic sound
                activeSensors.forEach(sensorId => {
                    this.triggerSoundFromValue(sensorId, SensorManager.connectedSensors[sensorId].lastValue);
                });
            } else {
                // If no sensors, use ambient or toy piano sound
                if (this.isAmbientPlaying) {
                    this.ambientSynth.triggerAttackRelease("C4", "8n", time);
                } else if (this.isToyPianoPlaying) {
                    this.toyPianoSynth.triggerAttackRelease("C5", "8n", time);
                } else {
                    // Default if no synth is active - use ambient synth
                    this.ambientSynth.triggerAttackRelease("C4", "8n", time);
                }
            }
        }, times.map(t => [t, null]));
        
        // Configure the loop
        this.rhythmLoop.loop = true;
        this.rhythmLoop.loopEnd = times[times.length - 1] + 0.5; // Add a small gap at the end
        this.rhythmLoop.start(0);
        
        // Start the transport and update tempo
        this.updateTempoBasedOnSensors();
        Tone.Transport.start();
        
        UIController.showCreature();
    },
    
    // Toggle ambient synth
    toggleAmbientSynth: function() {
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        
        if (this.isAmbientPlaying) {
            this.stopAmbientSynth();
        } else {
            this.startAmbientSynth();
        }
    },
    
    // Start ambient synth
    startAmbientSynth: function() {
        // Stop any other playing modes
        this.stopRecording();
        this.stopToyPianoSynth();
        
        this.isAmbientPlaying = true;
        document.getElementById('ambient-button').classList.add('active');
        UIController.logToUI('Ambient mode activated');
        
        // Use available sensor values or defaults
        this.updateSynthParameters();
        
        // Start a pattern of ambient notes based on available sensor values
        const gamelanScale = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4"];
        
        if (this.rhythmLoop) {
            // If we have a rhythm loop, use it
            if (Tone.Transport.state !== "started") {
                this.updateTempoBasedOnSensors();
                Tone.Transport.start();
            }
        } else {
            // Otherwise create a new pattern
            const pattern = new Tone.Pattern((time, note) => {
                this.ambientSynth.triggerAttackRelease(note, "4n", time);
            }, gamelanScale);
            
            pattern.interval = "8n";
            this.updateTempoBasedOnSensors();
            pattern.start(0);
            Tone.Transport.start();
        }
        
        UIController.showCreature();
    },
    
    // Stop ambient synth
    stopAmbientSynth: function() {
        this.isAmbientPlaying = false;
        document.getElementById('ambient-button').classList.remove('active');
        UIController.logToUI('Ambient mode deactivated');
        
        // Only stop transport if toy piano isn't playing
        if (!this.isToyPianoPlaying && !this.rhythmLoop) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
    },
    
    // Toggle toy piano synth
    toggleToyPianoSynth: function() {
        if (Tone.context.state !== 'running') {
            Tone.start();
        }
        
        if (this.isToyPianoPlaying) {
            this.stopToyPianoSynth();
        } else {
            this.startToyPianoSynth();
        }
    },
    
    // Start toy piano synth
    startToyPianoSynth: function() {
        // Stop any other playing modes
        this.stopRecording();
        this.stopAmbientSynth();
        
        this.isToyPianoPlaying = true;
        document.getElementById('toy-piano-button').classList.add('active');
        UIController.logToUI('Toy Piano mode activated');
        
        // Use available sensor values
        this.updateSynthParameters();
        
        // Define a pentatonic scale for toy piano
        const pentatonicScale = ["C5", "D5", "E5", "G5", "A5", "C6"];
        
        if (this.rhythmLoop) {
            // If we have a rhythm loop, use it
            if (Tone.Transport.state !== "started") {
                this.updateTempoBasedOnSensors();
                Tone.Transport.start();
            }
        } else {
            // Otherwise create a new sequence
            const sequence = new Tone.Sequence((time, note) => {
                this.toyPianoSynth.triggerAttackRelease(note, "8n", time);
            }, pentatonicScale, "4n");
            
            this.updateTempoBasedOnSensors();
            sequence.start(0);
            Tone.Transport.start();
        }
        
        UIController.showCreature();
    },
    
    // Stop toy piano synth
    stopToyPianoSynth: function() {
        this.isToyPianoPlaying = false;
        document.getElementById('toy-piano-button').classList.remove('active');
        UIController.logToUI('Toy Piano mode deactivated');
        
        // Only stop transport if ambient isn't playing
        if (!this.isAmbientPlaying && !this.rhythmLoop) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
    },
    
    // Stop all synths
    stopAllSynths: function() {
        this.stopAmbientSynth();
        this.stopToyPianoSynth();
        
        // Reset buttons
        document.getElementById('ambient-button').classList.remove('active');
        document.getElementById('toy-piano-button').classList.remove('active');
        
        // Stop any active loop but don't dispose it yet
        if (this.rhythmLoop && Tone.Transport.state === "started") {
            Tone.Transport.pause();
        }
    },
    
    // Stop all audio and transport
    stopAllAudio: function() {
        // Stop any recording in progress
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop any playing synths
        this.stopAllSynths();
        
        // Stop any rhythm loop
        if (this.rhythmLoop) {
            this.rhythmLoop.stop();
            this.rhythmLoop.dispose();
            this.rhythmLoop = null;
        }
        
        // Stop the transport
        Tone.Transport.stop();
        Tone.Transport.cancel();
        
        // Reset all buttons
        document.getElementById('mic-button').classList.remove('active', 'recording');
        document.getElementById('ambient-button').classList.remove('active');
        document.getElementById('toy-piano-button').classList.remove('active');
        
        UIController.logToUI('All audio stopped');
    },
    
    // Cycle through tempo options (slow, normal, fast)
    cycleTempo: function() {
        const tempoButton = document.getElementById('tempo-button');
        
        if (this.tempoMultiplier === 1.0) {
            this.tempoMultiplier = 1.5; // Fast
            tempoButton.textContent = "Tempo: Fast";
        } else if (this.tempoMultiplier === 1.5) {
            this.tempoMultiplier = 0.75; // Slow
            tempoButton.textContent = "Tempo: Slow";
        } else {
            this.tempoMultiplier = 1.0; // Normal
            tempoButton.textContent = "Tempo: Normal";
        }
        
        // Update transport tempo if running
        if (Tone.Transport.state === "started") {
            this.updateTempoBasedOnSensors();
        }
        
        UIController.logToUI(`Tempo set to ${tempoButton.textContent.split(': ')[1]}`);
    },
    
    // Update tempo based on sensor values
    updateTempoBasedOnSensors: function() {
        // Get average of available sensor values
        const availableSensors = Object.keys(SensorManager.currentValues).filter(key => 
            SensorManager.connectedSensors[key] && SensorManager.connectedSensors[key].connected
        );
        
        if (availableSensors.length === 0) return;
        
        const avgValue = availableSensors.reduce((sum, key) => 
            sum + SensorManager.currentValues[key], 0) / availableSensors.length;
        
        // Base tempo: 80-120 BPM depending on sensor average
        const baseTempo = 80 + (avgValue * 40); 
        
        // Apply multiplier
        Tone.Transport.bpm.value = baseTempo * this.tempoMultiplier;
    },
    
    // Update synth parameters based on current values from all sensors
    updateSynthParameters: function() {
        // Calculate average value from all connected sensors
        const connectedSensorIds = Object.keys(SensorManager.connectedSensors).filter(
            key => SensorManager.connectedSensors[key].connected
        );
        
        if (connectedSensorIds.length === 0) return;
        
        // Each sensor affects different parameters
        if (SensorManager.connectedSensors.sensor1.connected) {
            const value1 = SensorManager.currentValues.sensor1;
            
            // Sensor 1 affects harmonicity and modulation
            if (this.isAmbientPlaying) {
                this.ambientSynth.set({
                    harmonicity: 1 + (value1 * 3),
                    modulationIndex: 5 + (value1 * 20)
                });
            }
            
            // Also affects reverb
            this.reverb.wet.value = 0.2 + (value1 * 0.6);
        }
        
        if (SensorManager.connectedSensors.sensor2.connected) {
            const value2 = SensorManager.currentValues.sensor2;
            
            // Sensor 2 affects volume and envelope
            if (this.isAmbientPlaying) {
                this.ambientSynth.set({
                    volume: -15 + (value2 * 10),
                    envelope: {
                        attack: 0.02 + (value2 * 0.1),
                        decay: 0.8 - (value2 * 0.3),
                        release: 1.5 - (value2 * 0.5)
                    }
                });
            }
            
            if (this.isToyPianoPlaying) {
                this.toyPianoSynth.set({
                    volume: -12 + (value2 * 8),
                    envelope: {
                        attack: 0.01 + (value2 * 0.05),
                        release: 1 - (value2 * 0.5)
                    }
                });
            }
        }
        
        if (SensorManager.connectedSensors.sensor3.connected) {
            const value3 = SensorManager.currentValues.sensor3;
            
            // Sensor 3 affects tempo and melodySynth
            this.updateTempoBasedOnSensors();
            
            // Affect melody synth parameters
            this.melodySynth.set({
                volume: -15 + (value3 * 10),
                modulation: {
                    type: value3 > 0.6 ? "square" : "sine"
                }
            });
        }
    },
    
    // Trigger sound from value
    triggerSoundFromValue: function(sensorId, value) {
        // Update synth parameters based on all sensor values
        this.updateSynthParameters();
        
        // Show visual feedback
        UIController.showCreature();
        
        // Add reaction animation to creature
        const creature = document.getElementById('creature');
        creature.classList.add('creature-reacting');
        
        // Remove animation class after animation completes
        setTimeout(() => {
            creature.classList.remove('creature-reacting');
        }, 400);
        
        // Map sensor range (0.4-0.8) to note selection
        const normalizedValue = (value - 0.4) / 0.4;  // 0-1 range
        
        // Different note patterns for different sensors
        if (this.isAmbientPlaying) {
            const gamelanScale = ["C3", "D3", "E3", "G3", "A3", "C4"];
            const noteIndex = Math.floor(normalizedValue * gamelanScale.length);
            const note = gamelanScale[noteIndex];
            
            // Add a secondary note for richer sound
            const secondNote = gamelanScale[(noteIndex + 2) % gamelanScale.length];
            
            this.ambientSynth.triggerAttackRelease([note, secondNote], "2n");
        } else if (this.isToyPianoPlaying) {
            const toyScale = ["C5", "D5", "E5", "G5", "A5", "C6"];
            const noteIndex = Math.floor(normalizedValue * toyScale.length);
            const note = toyScale[noteIndex];
            
            this.toyPianoSynth.triggerAttackRelease(note, "8n");
            
            // Add a subtle melody note from the third synth
            if (Math.random() > 0.7) {
                const melodyScale = ["E4", "G4", "A4", "C5", "D5"];
                const melodyNote = melodyScale[Math.floor(Math.random() * melodyScale.length)];
                this.melodySynth.triggerAttackRelease(melodyNote, "16n", "+0.1");
            }
        } else {
            // Default sound if no synth is explicitly active
            const defaultScale = ["C4", "E4", "G4", "B4"];
            const noteIndex = Math.floor(normalizedValue * defaultScale.length);
            this.ambientSynth.triggerAttackRelease(defaultScale[noteIndex], "8n");
        }
        
        // Trigger sprite animation if available
        if (window.spriteAnimation && !window.spriteAnimation.isRunning() && 
            (!window.dragContainer || !window.dragContainer.isTabOpen())) {
            window.spriteAnimation.start();
        }
    }
};