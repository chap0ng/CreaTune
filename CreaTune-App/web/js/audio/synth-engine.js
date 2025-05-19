// synth-engine.js
// Synthesizer engine for CreaTune using Tone.js

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { AUDIO } = window.CreaTuneConfig;
  
  // Audio engine state
  let audioStarted = false;
  const state = {
    button1: false,
    button2: false,
    button3: false
  };
  
  // Synth objects
  const synths = {};
  
  // Create synths and effects
  function createSynths() {
    const baseVolume = AUDIO.BASE_VOLUME;
    
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
    // Get predefined patterns from SoundPatterns if available
    const soilPatterns = window.SoundPatterns ? window.SoundPatterns.getSoilPatterns() : getDefaultSoilPatterns();
    const lightPatterns = window.SoundPatterns ? window.SoundPatterns.getLightPatterns() : getDefaultLightPatterns();
    const tempPatterns = window.SoundPatterns ? window.SoundPatterns.getTempPatterns() : getDefaultTempPatterns();
    const chords = window.SoundPatterns ? window.SoundPatterns.getChords() : getDefaultChords();
    
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
      
      // Get sensor values from ESPManager if available
      let sensorValues = {
        soil: null,
        light: null,
        temp: null
      };
      
      if (window.ESPManager) {
        const espStatus = window.ESPManager.getESPStatus();
        sensorValues.soil = espStatus.esp1.valid ? espStatus.esp1.value : null;
        sensorValues.light = espStatus.esp2.valid ? espStatus.esp2.value : null;
        sensorValues.temp = espStatus.esp3.valid ? espStatus.esp3.value : null;
      }
      
      // Play appropriate synth based on button state
      if (state.button1 && state.button2 && state.button3) {
        // Total state - use all sensors for complex sound
        const randomIndex = Math.floor(Math.random() * chords.length);
        const chord = chords[randomIndex];
        chord.forEach(note => {
          synths.synth7.triggerAttackRelease(note, noteDuration, time);
        });
        pulseCreature(7);
      } 
      else if (state.button1 && state.button2) {
        // Growth state - soil + light
        const patternIndex = Math.floor(Math.random() * soilPatterns.length);
        const soilPattern = getModifiedPattern(soilPatterns[patternIndex], sensorValues.soil);
        const noteIndex = Math.floor(Math.random() * soilPattern.length);
        const note = soilPattern[noteIndex];
        
        if (note !== null) {
          synths.synth4.triggerAttackRelease(note, noteDuration, time);
          pulseCreature(4);
        }
      } 
      else if (state.button1 && state.button3) {
        // Mirrage state - soil + temp
        const patternIndex = Math.floor(Math.random() * tempPatterns.length);
        const tempPattern = getModifiedPattern(tempPatterns[patternIndex], sensorValues.temp);
        const randomIndex = Math.floor(Math.random() * chords.length);
        const chord = chords[randomIndex];
        
        chord.forEach(note => {
          synths.synth5.triggerAttackRelease(note, noteDuration, time);
        });
        pulseCreature(5);
      } 
      else if (state.button2 && state.button3) {
        // Flower state - light + temp
        const patternIndex = Math.floor(Math.random() * lightPatterns.length);
        const lightPattern = getModifiedPattern(lightPatterns[patternIndex], sensorValues.light);
        const noteIndex = Math.floor(Math.random() * lightPattern.length);
        const note = lightPattern[noteIndex];
        
        if (note !== null) {
          synths.synth6.triggerAttackRelease(note, noteDuration, time);
          pulseCreature(6);
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
          pulseCreature(1);
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
          pulseCreature(2);
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
          pulseCreature(3);
        }
      }
    }, "8n").start(0);
    
    // Initial BPM
    Tone.Transport.bpm.value = AUDIO.DEFAULT_BPM;
  }
  
  // Pulse a creature visual effect
  function pulseCreature(creatureNumber) {
    // Try both old and new APIs
    if (window.CreatureManager && window.CreatureManager.pulseCreature) {
      window.CreatureManager.pulseCreature(`creature${creatureNumber}`);
    } else if (window.synthUI && window.synthUI.pulseShape) {
      window.synthUI.pulseShape(`shape${creatureNumber}`);
    }
  }
  
  // Get default sound patterns if SoundPatterns module not available
  function getDefaultSoilPatterns() {
    const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    return [
      [cMajorNotes[0], cMajorNotes[2], cMajorNotes[0], cMajorNotes[4]],
      [cMajorNotes[0], null, cMajorNotes[2], null, cMajorNotes[0], null]
    ];
  }
  
  function getDefaultLightPatterns() {
    const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    return [
      [cMajorNotes[5], cMajorNotes[3], cMajorNotes[5], cMajorNotes[4]],
      [cMajorNotes[5], null, cMajorNotes[4], null, cMajorNotes[3], null]
    ];
  }
  
  function getDefaultTempPatterns() {
    const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    return [
      [cMajorNotes[3], cMajorNotes[1], cMajorNotes[3], cMajorNotes[2]],
      [cMajorNotes[3], null, cMajorNotes[1], null, cMajorNotes[2], null]
    ];
  }
  
  function getDefaultChords() {
    return [
      ["C3", "E3", "G3"],
      ["E3", "G3", "C4"],
      ["G3", "C4", "E4"]
    ];
  }
  
  // Create simple record and repeat functionality
  function setupRecordRepeat() {
    let isRecording = false;
    let recordedNotes = [];
    let recordStartTime = 0;
    let playbackLoop = null;
    
    // Listen for recording state changes
    EventBus.subscribe('recordingStarted', () => {
      startRecording();
    });
    
    EventBus.subscribe('recordingStopped', () => {
      stopRecording();
    });
    
    function startRecording() {
      console.log('SynthEngine: Starting to record notes');
      isRecording = true;
      recordedNotes = [];
      recordStartTime = Tone.now();
    }
    
    function stopRecording() {
      if (!isRecording) return;
      
      console.log('SynthEngine: Stopping recording, notes:', recordedNotes);
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
            if (note.creature) {
              Tone.Transport.schedule(() => {
                pulseCreature(parseInt(note.creature.replace('creature', '')));
              }, adjustedTime);
            }
          }
        });
      }, recordingDuration).start(0);
    }
    
    // Hook into the synth trigger functions to record notes
    function setupSynthRecordHooks() {
      for (let i = 1; i <= 7; i++) {
        const synthKey = `synth${i}`;
        if (synths[synthKey]) {
          const originalTrigger = synths[synthKey].triggerAttackRelease;
          
          synths[synthKey].triggerAttackRelease = function(note, duration, time) {
            if (isRecording) {
              recordedNotes.push({
                synth: synthKey,
                note: note,
                duration: duration,
                time: time || Tone.now(),
                creature: `creature${i}`
              });
            }
            return originalTrigger.apply(this, arguments);
          };
        }
      }
    }
    
    // Set up hooks after synths are created
    setupSynthRecordHooks();
  }
  
  // Test audio with a simple sound
  function testAudio() {
    const testSynth = new Tone.Synth().toDestination();
    testSynth.triggerAttackRelease("C4", "8n");
  }
  
  // Initialize audio engine
  async function init(statusCallback) {
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
      
      // Notify listeners that audio is ready
      EventBus.emit('audioInitialized');
      
      return true;
    } catch (error) {
      console.error("Error starting audio:", error);
      if (statusCallback) statusCallback("Error starting audio. Please try again.");
      return false;
    }
  }
  
  // Update synths based on current state and ESP status
  function updateSynths(currentState, espStatus) {
    // Reset all button states
    state.button1 = false;
    state.button2 = false;
    state.button3 = false;
    
    // Check if required sensors are valid
    const isValid = {
      soil: espStatus.esp1.connected && espStatus.esp1.valid,
      light: espStatus.esp2.connected && espStatus.esp2.valid,
      temp: espStatus.esp3.connected && espStatus.esp3.valid
    };
    
    // Set button state based on current state and valid data
    switch (currentState) {
      case 'soil':
        if (isValid.soil) {
          state.button1 = true;
        }
        break;
      case 'light':
        if (isValid.light) {
          state.button2 = true;
        }
        break;
      case 'temp':
        if (isValid.temp) {
          state.button3 = true;
        }
        break;
      case 'growth':
        if (isValid.soil && isValid.light) {
          state.button1 = true;
          state.button2 = true;
        }
        break;
      case 'mirrage':
        if (isValid.soil && isValid.temp) {
          state.button1 = true;
          state.button3 = true;
        }
        break;
      case 'flower':
        if (isValid.light && isValid.temp) {
          state.button2 = true;
          state.button3 = true;
        }
        break;
      case 'total':
        if (isValid.soil && isValid.light && isValid.temp) {
          state.button1 = true;
          state.button2 = true;
          state.button3 = true;
        }
        break;
    }
  }
  
  // Silence all synths temporarily (e.g., during recording)
  function silenceSynths(silence) {
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
  }
  
  // Trigger a note based on recorded pattern intensity
  function triggerPatternNote(intensity) {
    // Use intensity to determine volume and note choice
    const normalizedIntensity = Math.min(1, Math.max(0, intensity));
    const noteDuration = normalizedIntensity < 0.5 ? "8n" : "4n";
    
    // Select notes based on intensity
    const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    const noteIndex = Math.floor(normalizedIntensity * cMajorNotes.length);
    const note = cMajorNotes[noteIndex];
    
    // Determine which synth to trigger based on active buttons
    if (state.button1 && state.button2 && state.button3) {
      // All buttons - use synth7
      synths.synth7.triggerAttackRelease(note, noteDuration);
      pulseCreature(7);
    } 
    else if (state.button1 && state.button2) {
      // Buttons 1+2 - use synth4
      synths.synth4.triggerAttackRelease(note, noteDuration);
      pulseCreature(4);
    } 
    else if (state.button1 && state.button3) {
      // Buttons 1+3 - use synth5
      synths.synth5.triggerAttackRelease(note, noteDuration);
      pulseCreature(5);
    } 
    else if (state.button2 && state.button3) {
      // Buttons 2+3 - use synth6
      synths.synth6.triggerAttackRelease(note, noteDuration);
      pulseCreature(6);
    } 
    else if (state.button1) {
      // Button 1 - use synth1
      synths.synth1.triggerAttackRelease(note, noteDuration);
      pulseCreature(1);
    } 
    else if (state.button2) {
      // Button 2 - use synth2
      synths.synth2.triggerAttackRelease(note, noteDuration);
      pulseCreature(2);
    } 
    else if (state.button3) {
      // Button 3 - use synth3
      synths.synth3.triggerAttackRelease(note, noteDuration);
      pulseCreature(3);
    }
  }
  
  // Set BPM
  function setBPM(bpm) {
    if (Tone && Tone.Transport) {
      Tone.Transport.bpm.value = bpm;
      return true;
    }
    return false;
  }
  
  // Get current BPM
  function getBPM() {
    if (Tone && Tone.Transport) {
      return Tone.Transport.bpm.value;
    }
    return AUDIO.DEFAULT_BPM;
  }
  
  // Add cleanup for page unload
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
  
  // Expose API
  window.SynthEngine = {
    init,
    isInitialized: () => audioStarted,
    setButtonState: (btnNum, isActive) => {
      if (btnNum >= 1 && btnNum <= 3) {
        state[`button${btnNum}`] = isActive;
      }
    },
    getState: () => ({...state}),
    updateSynths,
    triggerPatternNote,
    silenceSynths,
    setBPM,
    getBPM
  };
});
