// enhanced-synth-logic.js
// Enhanced version of synth-logic.js to work with state machine

document.addEventListener('DOMContentLoaded', () => {
  let audioStarted = false;
  const state = {
    button1: false,
    button2: false,
    button3: false
  };
  
  const synths = {};
  
  // Create synths and effects
  function createSynths() {
    const baseVolume = -8;
    
    // Base synths for each button
    synths.synth1 = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 1.5 },
      volume: baseVolume
    }).toDestination();
    
    synths.synth2 = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.3, decay: 0.1, sustain: 0.6, release: 1.2 },
      volume: baseVolume
    }).toDestination();
    
    synths.synth3 = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.4, decay: 0.2, sustain: 0.5, release: 1.0 },
      volume: baseVolume
    }).toDestination();
    
    // Combination synths
    synths.synth4 = new Tone.AMSynth({
      harmonicity: 1.5,
      envelope: { attack: 0.3, decay: 0.2, sustain: 0.7, release: 1.5 },
      volume: baseVolume
    }).toDestination();
    
    synths.synth5 = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 10,
      envelope: { attack: 0.4, decay: 0.2, sustain: 0.7, release: 1.5 },
      volume: baseVolume
    }).toDestination();
    
    synths.synth6 = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.2, decay: 0.3, sustain: 0.6, release: 1.2 },
      filterEnvelope: {
        attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.0,
        baseFrequency: 300, octaves: 2
      },
      volume: baseVolume + 3
    }).toDestination();
    
    synths.synth7 = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.1, decay: 0.3, release: 0.8 },
      harmonicity: 3.1,
      modulationIndex: 16,
      resonance: 3000,
      octaves: 1.5,
      volume: baseVolume
    }).toDestination();
    
    // Add reverb effect to all synths
    const reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.5
    }).toDestination();
    
    Object.values(synths).forEach(synth => {
      synth.connect(reverb);
    });
  }
  
  // Set up sequences based on the current state
  function setupSequences() {
    // C major scale notes
    const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    const cMajorChords = [
      ["C3", "E3", "G3"], 
      ["E3", "G3", "C4"], 
      ["G3", "C4", "E4"]
    ];
    
    // Define patterns for different sensors
    // Soil sensor (ESP32-1) - earthy, grounded patterns
    const soilPatterns = [
      [cMajorNotes[0], cMajorNotes[2], cMajorNotes[0], cMajorNotes[4]],
      [cMajorNotes[0], null, cMajorNotes[2], null, cMajorNotes[0], null]
    ];
    
    // Light sensor (ESP32-2) - bright, high patterns
    const lightPatterns = [
      [cMajorNotes[5], cMajorNotes[3], cMajorNotes[5], cMajorNotes[4]],
      [cMajorNotes[5], null, cMajorNotes[4], null, cMajorNotes[3], null]
    ];
    
    // Temperature sensor (ESP32-3) - varied, dynamic patterns
    const tempPatterns = [
      [cMajorNotes[3], cMajorNotes[1], cMajorNotes[3], cMajorNotes[2]],
      [cMajorNotes[3], null, cMajorNotes[1], null, cMajorNotes[2], null]
    ];
    
    // Rhythm variation
    let rhythmPhase = 0;
    const rhythmSpeed = 0.05;
    
    function getRhythmValue() {
      const sineValue = Math.sin(rhythmPhase);
      rhythmPhase += rhythmSpeed;
      return 0.8 + (sineValue * 0.3);
    }
    
    // Modify patterns based on sensor values if available
    function getModifiedPattern(basePattern, sensorValue) {
      if (sensorValue === undefined || sensorValue === null) {
        return basePattern;
      }
      
      // Simple modification: skip some notes based on sensor value
      return basePattern.map(note => {
        if (note !== null && Math.random() < sensorValue * 0.3) {
          return null; // Skip note with probability proportional to sensor value
        }
        return note;
      });
    }
    
    // Main sequence loop
    synths.mainLoop = new Tone.Loop((time) => {
      const rhythmFactor = getRhythmValue();
      const noteDuration = rhythmFactor < 0.7 ? "8n" : "4n";
      
      // Get sensor values from state manager if available
      let sensorValues = {
        soil: null,
        light: null,
        temp: null
      };
      
      if (window.stateManager) {
        const espStatus = window.stateManager.getEspStatus();
        sensorValues.soil = espStatus.esp1.valid ? espStatus.esp1.value : null;
        sensorValues.light = espStatus.esp2.valid ? espStatus.esp2.value : null;
        sensorValues.temp = espStatus.esp3.valid ? espStatus.esp3.value : null;
      }
      
      // Get the active state
      const currentState = window.stateManager ? window.stateManager.getState() : null;
      
      // Play appropriate synth based on button state and current mode
      if (state.button1 && state.button2 && state.button3) {
        // Total state - use all sensors for complex sound
        const randomIndex = Math.floor(Math.random() * cMajorChords.length);
        const chord = cMajorChords[randomIndex];
        chord.forEach(note => {
          synths.synth7.triggerAttackRelease(note, noteDuration, time);
        });
        window.synthUI.pulseShape('shape7');
      } 
      else if (state.button1 && state.button2) {
        // Growth state - soil + light
        const patternIndex = Math.floor(Math.random() * soilPatterns.length);
        const soilPattern = getModifiedPattern(soilPatterns[patternIndex], sensorValues.soil);
        const noteIndex = Math.floor(Math.random() * soilPattern.length);
        const note = soilPattern[noteIndex];
        
        if (note !== null) {
          synths.synth4.triggerAttackRelease(note, noteDuration, time);
          window.synthUI.pulseShape('shape4');
        }
      } 
      else if (state.button1 && state.button3) {
        // Mirrage state - soil + temp
        const patternIndex = Math.floor(Math.random() * tempPatterns.length);
        const tempPattern = getModifiedPattern(tempPatterns[patternIndex], sensorValues.temp);
        const randomIndex = Math.floor(Math.random() * cMajorChords.length);
        const chord = cMajorChords[randomIndex];
        
        chord.forEach(note => {
          synths.synth5.triggerAttackRelease(note, noteDuration, time);
        });
        window.synthUI.pulseShape('shape5');
      } 
      else if (state.button2 && state.button3) {
        // Flower state - light + temp
        const patternIndex = Math.floor(Math.random() * lightPatterns.length);
        const lightPattern = getModifiedPattern(lightPatterns[patternIndex], sensorValues.light);
        const noteIndex = Math.floor(Math.random() * lightPattern.length);
        const note = lightPattern[noteIndex];
        
        if (note !== null) {
          synths.synth6.triggerAttackRelease(note, noteDuration, time);
          window.synthUI.pulseShape('shape6');
        }
      } 
      else if (state.button1) {
        // Soil state
        const patternIndex = Math.floor(Math.random() * soilPatterns.length);
        const soilPattern = getModifiedPattern(soilPatterns[patternIndex], sensorValues.soil);
        const noteIndex = Math.floor(Math.random() * soilPattern.length);
        const note = soilPattern[noteIndex];
        
        if (note !== null) {
          synths.synth1.triggerAttackRelease(note, noteDuration, time);
          window.synthUI.pulseShape('shape1');
        }
      } 
      else if (state.button2) {
        // Light state
        const patternIndex = Math.floor(Math.random() * lightPatterns.length);
        const lightPattern = getModifiedPattern(lightPatterns[patternIndex], sensorValues.light);
        const noteIndex = Math.floor(Math.random() * lightPattern.length);
        const note = lightPattern[noteIndex];
        
        if (note !== null) {
          synths.synth2.triggerAttackRelease(note, noteDuration, time);
          window.synthUI.pulseShape('shape2');
        }
      } 
      else if (state.button3) {
        // Temperature state
        const patternIndex = Math.floor(Math.random() * tempPatterns.length);
        const tempPattern = getModifiedPattern(tempPatterns[patternIndex], sensorValues.temp);
        const noteIndex = Math.floor(Math.random() * tempPattern.length);
        const note = tempPattern[noteIndex];
        
        if (note !== null) {
          synths.synth3.triggerAttackRelease(note, noteDuration, time);
          window.synthUI.pulseShape('shape3');
        }
      }
    }, "8n").start(0);
    
    // Initial BPM
    Tone.Transport.bpm.value = 85;
  }
  
  // Create simple record and repeat functionality
  function setupRecordRepeat() {
    let isRecording = false;
    let recordedNotes = [];
    let recordStartTime = 0;
    let playbackLoop = null;
    
    // Listen for state changes
    document.addEventListener('stateChange', (e) => {
      if (e.detail.subState === 'record' && !isRecording) {
        startRecording();
      } else if (e.detail.subState !== 'record' && isRecording) {
        stopRecording();
      }
    });
    
    function startRecording() {
      console.log('Starting to record notes');
      isRecording = true;
      recordedNotes = [];
      recordStartTime = Tone.now();
      
      // After 5 seconds, automatically stop recording
      setTimeout(() => {
        if (isRecording) {
          stopRecording();
        }
      }, 5000);
    }
    
    function stopRecording() {
      if (!isRecording) return;
      
      console.log('Stopping recording, notes:', recordedNotes);
      isRecording = false;
      
      // If we recorded some notes, set up playback
      if (recordedNotes.length > 0) {
        setupPlayback();
      }
    }
    
    function setupPlayback() {
      // Calculate total duration of the recording
      const lastNote = recordedNotes[recordedNotes.length - 1];
      const recordingDuration = lastNote.time + lastNote.duration - recordStartTime;
      
      // Clear any existing playback
      if (playbackLoop) {
        playbackLoop.dispose();
      }
      
      // Create a new loop to play back the recorded notes
      playbackLoop = new Tone.Loop((time) => {
        // Adjust all note times relative to the current loop start time
        recordedNotes.forEach((note) => {
          const adjustedTime = time + (note.time - recordStartTime);
          const synthToUse = synths[note.synth];
          
          if (synthToUse) {
            synthToUse.triggerAttackRelease(
              note.note, 
              note.duration, 
              adjustedTime
            );
            
            // Also schedule the visual pulse
            if (window.synthUI && note.shape) {
              Tone.Transport.schedule(() => {
                window.synthUI.pulseShape(note.shape);
              }, adjustedTime);
            }
          }
        });
      }, recordingDuration).start(0);
    }
    
    // Hook into the synth trigger functions to record notes
    const originalSynth1Trigger = synths.synth1.triggerAttackRelease;
    synths.synth1.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth1',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape1'
        });
      }
      return originalSynth1Trigger.apply(this, arguments);
    };
    
    const originalSynth2Trigger = synths.synth2.triggerAttackRelease;
    synths.synth2.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth2',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape2'
        });
      }
      return originalSynth2Trigger.apply(this, arguments);
    };
    
    const originalSynth3Trigger = synths.synth3.triggerAttackRelease;
    synths.synth3.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth3',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape3'
        });
      }
      return originalSynth3Trigger.apply(this, arguments);
    };
    
    const originalSynth4Trigger = synths.synth4.triggerAttackRelease;
    synths.synth4.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth4',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape4'
        });
      }
      return originalSynth4Trigger.apply(this, arguments);
    };
    
    const originalSynth5Trigger = synths.synth5.triggerAttackRelease;
    synths.synth5.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth5',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape5'
        });
      }
      return originalSynth5Trigger.apply(this, arguments);
    };
    
    const originalSynth6Trigger = synths.synth6.triggerAttackRelease;
    synths.synth6.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth6',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape6'
        });
      }
      return originalSynth6Trigger.apply(this, arguments);
    };
    
    const originalSynth7Trigger = synths.synth7.triggerAttackRelease;
    synths.synth7.triggerAttackRelease = function(note, duration, time) {
      if (isRecording) {
        recordedNotes.push({
          synth: 'synth7',
          note: note,
          duration: duration,
          time: time || Tone.now(),
          shape: 'shape7'
        });
      }
      return originalSynth7Trigger.apply(this, arguments);
    };
  }
  
  // Test audio with a simple sound
  function testAudio() {
    const testSynth = new Tone.Synth().toDestination();
    testSynth.triggerAttackRelease("C4", "8n");
  }
  
  // Add cleanup event listener for page unload
  window.addEventListener('beforeunload', function() {
    // Release all synths and clean up
    if (audioStarted && synths) {
      console.log('Cleaning up synths before page unload');
      
      // Stop all loops
      if (synths.mainLoop) {
        synths.mainLoop.stop();
      }
      
      // Release all synths
      Object.values(synths).forEach(synth => {
        if (synth && typeof synth.releaseAll === 'function') {
          synth.releaseAll();
        }
      });
      
      // Close Tone.js context if possible
      if (Tone && Tone.context) {
        Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
      }
    }
  });
  
  // Export the API for the synth system
  window.synthEngine = {
    init: async function(statusCallback) {
      if (audioStarted) return true;
      
      try {
        if (statusCallback) statusCallback("Starting audio...");
        await Tone.start();
        
        testAudio();
        createSynths();
        setupSequences();
        setupRecordRepeat();
        
        Tone.Transport.start();
        audioStarted = true;
        
        if (statusCallback) statusCallback("Audio initialized");
        setTimeout(() => {
          if (statusCallback) statusCallback(null);
        }, 2000);
        
        return true;
      } catch (error) {
        console.error("Error starting audio:", error);
        if (statusCallback) statusCallback("Error starting audio. Please try again.");
        return false;
      }
    },
    
    setButtonState: function(btnNum, isActive) {
      if (btnNum >= 1 && btnNum <= 3) {
        state[`button${btnNum}`] = isActive;
      }
    },
    
    getState: function() {
      return {...state};
    },
    
    isInitialized: function() {
      return audioStarted;
    },
    
    setBPM: function(bpm) {
      if (Tone.Transport) {
        Tone.Transport.bpm.value = bpm;
      }
    },
    
    // Silence all synths during recording
    silenceSynths: function(silence) {
      if (silence) {
        // Stop all active synths immediately
        Object.values(synths).forEach(synth => {
          // Check if it's a Tone.js instrument with releaseAll method
          if (synth && typeof synth.releaseAll === 'function') {
            synth.releaseAll();
          }
        });
        
        // Pause the main loop during recording
        if (synths.mainLoop) {
          synths.mainLoop.stop();
        }
        
        // Mute the master output for immediate silence
        Tone.getDestination().volume.value = -Infinity;
        
        // Reset master volume after a very short delay
        setTimeout(() => {
          Tone.getDestination().volume.value = 0;
        }, 100);
      } else {
        // Resume the main loop after recording
        if (synths.mainLoop) {
          synths.mainLoop.start();
        }
      }
    },
    
    // Trigger a note based on recorded pattern
    triggerPatternNote: function(intensity) {
      // Use intensity to determine volume and note choice
      const normalizedIntensity = Math.min(1, Math.max(0, intensity));
      const noteDuration = normalizedIntensity < 0.5 ? "8n" : "4n";
      
      // Get current state for synth selection
      const activeState = this.getState();
      
      // Select notes based on intensity
      const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
      const noteIndex = Math.floor(normalizedIntensity * cMajorNotes.length);
      const note = cMajorNotes[noteIndex];
      
      // Determine which synth to trigger based on active buttons
      if (activeState.button1 && activeState.button2 && activeState.button3) {
        // All buttons - use synth7
        synths.synth7.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape7');
      } 
      else if (activeState.button1 && activeState.button2) {
        // Buttons 1+2 - use synth4
        synths.synth4.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape4');
      } 
      else if (activeState.button1 && activeState.button3) {
        // Buttons 1+3 - use synth5
        synths.synth5.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape5');
      } 
      else if (activeState.button2 && activeState.button3) {
        // Buttons 2+3 - use synth6
        synths.synth6.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape6');
      } 
      else if (activeState.button1) {
        // Button 1 - use synth1
        synths.synth1.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape1');
      } 
      else if (activeState.button2) {
        // Button 2 - use synth2
        synths.synth2.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape2');
      } 
      else if (activeState.button3) {
        // Button 3 - use synth3
        synths.synth3.triggerAttackRelease(note, noteDuration);
        window.synthUI?.pulseShape('shape3');
      }
    }
  };
});