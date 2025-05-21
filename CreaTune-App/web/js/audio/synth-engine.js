// synth-engine.js
// Synthesizer engine for CreaTune using Tone.js

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { AUDIO, STATES } = window.CreaTuneConfig || {
    AUDIO: { BASE_VOLUME: -8, DEFAULT_BPM: 85 },
    STATES: {
      IDLE: 'idle',
      SOIL: 'soil',
      LIGHT: 'light',
      TEMP: 'temp',
      GROWTH: 'growth',
      MIRRAGE: 'mirrage',
      FLOWER: 'flower',
      TOTAL: 'total'
    }
  };
  
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
    try {
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
      
      reverb.generate().then(() => {
        console.log('Reverb generated successfully');
      }).catch(err => {
        console.error('Error generating reverb:', err);
      });
      
      Object.values(synths).forEach(synth => {
        try {
          synth.connect(reverb);
        } catch (err) {
          console.error('Error connecting synth to reverb:', err);
        }
      });
      
      console.log('Synths created successfully');
      return true;
    } catch (err) {
      console.error('Error creating synths:', err);
      return false;
    }
  }
  
  // Set up sequences based on the current state
  function setupSequences() {
    try {
      // Get patterns from SoundPatterns
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
        
        return window.SoundPatterns && window.SoundPatterns.modifyPatternWithSensorValue ? 
          window.SoundPatterns.modifyPatternWithSensorValue(basePattern, sensorValue) :
          basePattern;
      }
      
      // Create continuous loop that will not stop
      if (synths.mainLoop) {
        try {
          synths.mainLoop.dispose();
        } catch (err) {
          console.error('Error disposing main loop:', err);
        }
      }
      
      // Main sequence loop - using Tone.Pattern instead of Tone.Loop for more stability
      try {
        synths.mainLoop = new Tone.Loop((time) => {
          try {
            const rhythmFactor = getRhythmValue();
            const noteDuration = rhythmFactor < 0.7 ? "8n" : "4n";
            
            // Get sensor values from ESPManager if available
            let sensorValues = {
              soil: null,
              light: null,
              temp: null
            };
            
            if (window.ESPManager) {
              try {
                const espStatus = window.ESPManager.getESPStatus();
                sensorValues.soil = espStatus.esp1.valid ? espStatus.esp1.value : null;
                sensorValues.light = espStatus.esp2.valid ? espStatus.esp2.value : null;
                sensorValues.temp = espStatus.esp3.valid ? espStatus.esp3.value : null;
              } catch (err) {
                console.error('Error getting ESP status:', err);
              }
            }
            
            // Play appropriate synth based on button state
            try {
              if (state.button1 && state.button2 && state.button3) {
                // Total state - use all sensors for complex sound
                const randomIndex = Math.floor(Math.random() * chords.length);
                const chord = chords[randomIndex];
                chord.forEach(note => {
                  try {
                    synths.synth7.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth7 with note ${note}:`, err);
                  }
                });
                pulseCreature(7);
              } 
              else if (state.button1 && state.button2) {
                // Growth state - soil + light
                const pattern = window.SoundPatterns && window.SoundPatterns.getGrowthPattern ?
                  window.SoundPatterns.getGrowthPattern(sensorValues.soil, sensorValues.light) :
                  soilPatterns[0];
                  
                const noteIndex = Math.floor(Math.random() * pattern.length);
                const note = pattern[noteIndex];
                
                if (note !== null) {
                  try {
                    synths.synth4.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth4 with note ${note}:`, err);
                  }
                  pulseCreature(4);
                }
              } 
              else if (state.button1 && state.button3) {
                // Mirrage state - soil + temp
                const pattern = window.SoundPatterns && window.SoundPatterns.getMirragePattern ?
                  window.SoundPatterns.getMirragePattern(sensorValues.soil, sensorValues.temp) : 
                  soilPatterns[0];
                  
                const randomIndex = Math.floor(Math.random() * pattern.length);
                const note = pattern[randomIndex];
                
                if (note !== null) {
                  try {
                    synths.synth5.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth5 with note ${note}:`, err);
                  }
                  pulseCreature(5);
                }
              } 
              else if (state.button2 && state.button3) {
                // Flower state - light + temp
                const pattern = window.SoundPatterns && window.SoundPatterns.getFlowerPattern ?
                  window.SoundPatterns.getFlowerPattern(sensorValues.light, sensorValues.temp) :
                  lightPatterns[0];
                  
                const noteIndex = Math.floor(Math.random() * pattern.length);
                const note = pattern[noteIndex];
                
                if (note !== null) {
                  try {
                    synths.synth6.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth6 with note ${note}:`, err);
                  }
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
                  try {
                    synths.synth1.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth1 with note ${note}:`, err);
                  }
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
                  try {
                    synths.synth2.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth2 with note ${note}:`, err);
                  }
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
                  try {
                    synths.synth3.triggerAttackRelease(note, noteDuration, time);
                  } catch (err) {
                    console.error(`Error triggering synth3 with note ${note}:`, err);
                  }
                  pulseCreature(3);
                }
              }
            } catch (err) {
              console.error('Error in main loop synth selection:', err);
            }
          } catch (err) {
            console.error('Error in main loop:', err);
          }
        }, "8n");
      } catch (err) {
        console.error('Error creating main loop:', err);
        return false;
      }
      
      // Ensure the loop is set to play indefinitely
      synths.mainLoop.iterations = Infinity;
      
      // Start the loop
      try {
        synths.mainLoop.start(0);
      } catch (err) {
        console.error('Error starting main loop:', err);
      }
      
      // Initial BPM
      try {
        Tone.Transport.bpm.value = AUDIO.DEFAULT_BPM;
      } catch (err) {
        console.error('Error setting initial BPM:', err);
      }
      
      return true;
    } catch (err) {
      console.error('Error setting up sequences:', err);
      return false;
    }
  }
  
  // Pulse a creature visual effect
  function pulseCreature(creatureNumber) {
    try {
      if (window.CreatureManager && window.CreatureManager.pulseCreature) {
        window.CreatureManager.pulseCreature(`creature${creatureNumber}`);
      }
    } catch (err) {
      console.error(`Error pulsing creature ${creatureNumber}:`, err);
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
  
  // Set up record and repeat functionality
  function setupRecordRepeat() {
    let recordedPattern = null;
    let playbackLoop = null;
    
    // Listen for recording state changes
    EventBus.subscribe('recordingStarted', () => {
      // Stop synths during recording
      silenceSynths(true);
    });
    
    EventBus.subscribe('recordingStopped', (data) => {
      // Resume synths after recording
      silenceSynths(false);
      
      // Get the recorded pattern from the recording manager
      if (window.RecordingManager && window.RecordingManager.hasRecordedPattern()) {
        playRecordedPattern();
      }
    });
    
    function playRecordedPattern() {
      try {
        if (!window.RecordingManager) return;
        
        // Notify SynthEngine to start playing recorded pattern
        console.log('SynthEngine: Playing recorded pattern');
      } catch (err) {
        console.error('Error playing recorded pattern:', err);
      }
    }
  }
  
  // Initialize audio engine
  async function init(statusCallback) {
    if (audioStarted) return true;
    
    try {
      if (statusCallback) statusCallback("Starting audio...");
      
      // Handle AudioContext errors
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.error('AudioContext not supported in this browser');
        if (statusCallback) statusCallback("Audio not supported in this browser");
        return false;
      }
      
      // Check if Tone.js is available
      if (typeof Tone === 'undefined') {
        console.error('Tone.js not loaded');
        if (statusCallback) statusCallback("Tone.js library not loaded");
        return false;
      }
      
      try {
        await Tone.start();
        console.log('Tone.js started successfully');
      } catch (err) {
        console.error('Error starting Tone.js:', err);
        if (statusCallback) statusCallback("Error starting audio engine. Please try again.");
        return false;
      }
      
      // Initialize components
      const synthsCreated = createSynths();
      if (!synthsCreated) {
        console.error('Failed to create synths');
        if (statusCallback) statusCallback("Error initializing synthesizers");
        return false;
      }
      
      const sequencesSetup = setupSequences();
      if (!sequencesSetup) {
        console.error('Failed to set up sequences');
        if (statusCallback) statusCallback("Error initializing sound patterns");
        return false;
      }
      
      setupRecordRepeat();
      
      // Start Tone.Transport and ensure it doesn't stop
      try {
        Tone.Transport.start();
        Tone.Transport.loop = true;
        Tone.Transport.loopStart = 0;
        Tone.Transport.loopEnd = '8m';  // 8 measures to give plenty of loop time
      } catch (err) {
        console.error('Error configuring Tone.Transport:', err);
        if (statusCallback) statusCallback("Error initializing audio transport");
        return false;
      }
      
      audioStarted = true;
      
      if (statusCallback) statusCallback("Audio initialized");
      setTimeout(() => {
        if (statusCallback) statusCallback(null);
      }, 2000);
      
      // Notify listeners that audio is ready
      EventBus.emit('audioInitialized');
      
      // Set up periodic check to ensure Transport is running
      setInterval(() => {
        try {
          if (Tone.Transport.state !== "started" && audioStarted) {
            console.log("Restarting Tone.Transport...");
            Tone.Transport.start();
          }
        } catch (err) {
          console.error('Error in Transport check:', err);
        }
      }, 5000);
      
      return true;
    } catch (error) {
      console.error("Error starting audio:", error);
      if (statusCallback) statusCallback(`Error starting audio: ${error.message}. Please try again.`);
      return false;
    }
  }
  
  // Update synths based on current state and ESP status
  function updateSynths(currentState, espStatus) {
    try {
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
        case STATES.SOIL:
          if (isValid.soil) {
            state.button1 = true;
          }
          break;
        case STATES.LIGHT:
          if (isValid.light) {
            state.button2 = true;
          }
          break;
        case STATES.TEMP:
          if (isValid.temp) {
            state.button3 = true;
          }
          break;
        case STATES.GROWTH:
          if (isValid.soil && isValid.light) {
            state.button1 = true;
            state.button2 = true;
          }
          break;
        case STATES.MIRRAGE:
          if (isValid.soil && isValid.temp) {
            state.button1 = true;
            state.button3 = true;
          }
          break;
        case STATES.FLOWER:
          if (isValid.light && isValid.temp) {
            state.button2 = true;
            state.button3 = true;
          }
          break;
        case STATES.TOTAL:
          if (isValid.soil && isValid.light && isValid.temp) {
            state.button1 = true;
            state.button2 = true;
            state.button3 = true;
          }
          break;
      }
      
      // Restart Tone.Transport if it's stopped
      try {
        if (Tone.Transport.state !== "started" && audioStarted) {
          console.log("Restarting Tone.Transport...");
          Tone.Transport.start();
        }
      } catch (err) {
        console.error('Error restarting transport:', err);
      }
    } catch (err) {
      console.error('Error updating synths:', err);
    }
  }
  
  // Silence all synths temporarily (e.g., during recording)
  function silenceSynths(silence) {
    try {
      if (silence) {
        // Stop all active synths immediately
        Object.values(synths).forEach(synth => {
          if (synth && typeof synth.releaseAll === 'function') {
            try {
              synth.releaseAll();
            } catch (err) {
              console.error('Error releasing synth:', err);
            }
          }
        });
        
        // Pause the main loop during recording
        if (synths.mainLoop) {
          try {
            synths.mainLoop.stop();
          } catch (err) {
            console.error('Error stopping main loop:', err);
          }
        }
        
        // Mute the master output for immediate silence
        try {
          Tone.getDestination().volume.value = -Infinity;
        } catch (err) {
          console.error('Error muting master volume:', err);
        }
        
        // Reset master volume after a very short delay
        setTimeout(() => {
          try {
            Tone.getDestination().volume.value = 0;
          } catch (err) {
            console.error('Error resetting master volume:', err);
          }
        }, 100);
      } else {
        // Resume the main loop after recording
        if (synths.mainLoop && Tone.Transport.state === "started") {
          try {
            synths.mainLoop.start();
          } catch (err) {
            console.error('Error starting main loop:', err);
          }
        }
        
        // Ensure Transport is running
        if (Tone.Transport.state !== "started") {
          try {
            Tone.Transport.start();
          } catch (err) {
            console.error('Error starting Tone.Transport:', err);
          }
        }
      }
    } catch (err) {
      console.error('General error in silenceSynths:', err);
    }
  }
  
  // Trigger a note based on recorded pattern intensity
  function triggerPatternNote(intensity) {
    try {
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
        try {
          synths.synth7.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth7 with note ${note}:`, err);
        }
        pulseCreature(7);
      } 
      else if (state.button1 && state.button2) {
        // Buttons 1+2 - use synth4
        try {
          synths.synth4.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth4 with note ${note}:`, err);
        }
        pulseCreature(4);
      } 
      else if (state.button1 && state.button3) {
        // Buttons 1+3 - use synth5
        try {
          synths.synth5.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth5 with note ${note}:`, err);
        }
        pulseCreature(5);
      } 
      else if (state.button2 && state.button3) {
        // Buttons 2+3 - use synth6
        try {
          synths.synth6.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth6 with note ${note}:`, err);
        }
        pulseCreature(6);
      } 
      else if (state.button1) {
        // Button 1 - use synth1
        try {
          synths.synth1.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth1 with note ${note}:`, err);
        }
        pulseCreature(1);
      } 
      else if (state.button2) {
        // Button 2 - use synth2
        try {
          synths.synth2.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth2 with note ${note}:`, err);
        }
        pulseCreature(2);
      } 
      else if (state.button3) {
        // Button 3 - use synth3
        try {
          synths.synth3.triggerAttackRelease(note, noteDuration);
        } catch (err) {
          console.error(`Error triggering synth3 with note ${note}:`, err);
        }
        pulseCreature(3);
      }
    } catch (err) {
      console.error(`Error in triggerPatternNote:`, err);
    }
  }
  
  // Set BPM
  function setBPM(bpm) {
    try {
      if (Tone && Tone.Transport) {
        Tone.Transport.bpm.value = bpm;
        return true;
      }
    } catch (err) {
      console.error(`Error setting BPM to ${bpm}:`, err);
    }
    return false;
  }
  
  // Get current BPM
  function getBPM() {
    try {
      if (Tone && Tone.Transport) {
        return Tone.Transport.bpm.value;
      }
    } catch (err) {
      console.error('Error getting BPM:', err);
    }
    return AUDIO.DEFAULT_BPM;
  }
  
  // Helper function for triggerSynthFromValue
  function getCMajorNote(value) {
    try {
      // C major scale notes
      const notes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
      
      // Map value (0.4-0.8) to note index (0-7)
      const normalizedValue = (value - 0.4) / 0.4; // 0.0-1.0
      const noteIndex = Math.floor(normalizedValue * notes.length);
      
      // Ensure index is within bounds
      const safeIndex = Math.max(0, Math.min(notes.length - 1, noteIndex));
      return notes[safeIndex];
    } catch (err) {
      console.error('Error in getCMajorNote:', err);
      return "C4"; // Default to C4 in case of error
    }
  }
  
  // Add cleanup for page unload
  window.addEventListener('beforeunload', function() {
    // Release all synths and clean up
    if (audioStarted && synths) {
      console.log('Cleaning up synths before page unload');
      
      try {
        // Stop all loops - with improved error handling
        if (synths.mainLoop) {
          try {
            synths.mainLoop.stop();
          } catch (err) {
            console.error('Error stopping main loop:', err);
          }
        }
        
        // Release all synths with improved error handling
        Object.values(synths).forEach(synth => {
          if (synth && typeof synth.releaseAll === 'function') {
            try {
              synth.releaseAll();
            } catch (err) {
              console.error('Error releasing synth:', err);
            }
          }
        });
        
        // Close Tone.js context if possible
        if (Tone && Tone.context) {
          try {
            Tone.context.close().catch(err => console.error('Error closing Tone context:', err));
          } catch (err) {
            console.error('Error with Tone context:', err);
          }
        }
      } catch (err) {
        console.error('Error in synth cleanup:', err);
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
    getBPM,
    
    triggerSynthFromValue: function(value) {
      try {
        // Select appropriate synth based on current state
        const currentState = window.StateManager ? window.StateManager.getState() : 'idle';
        
        // Get current state to determine which synth to trigger
        switch(currentState) {
          case 'soil':
            try {
              synths.synth1.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering soil synth:', err);
            }
            pulseCreature(1);
            break;
          case 'light':
            try {
              synths.synth2.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering light synth:', err);
            }
            pulseCreature(2);
            break;
          case 'temp':
            try {
              synths.synth3.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering temp synth:', err);
            }
            pulseCreature(3);
            break;
          case 'growth':
            try {
              synths.synth4.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering growth synth:', err);
            }
            pulseCreature(4);
            break;
          case 'mirrage':
            try {
              synths.synth5.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering mirrage synth:', err);
            }
            pulseCreature(5);
            break;
          case 'flower':
            try {
              synths.synth6.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering flower synth:', err);
            }
            pulseCreature(6);
            break;
          case 'total':
            try {
              synths.synth7.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering total synth:', err);
            }
            pulseCreature(7);
            break;
          default:
            // Default to synth1 if state not recognized
            try {
              synths.synth1.triggerAttackRelease(getCMajorNote(value), "8n");
            } catch (err) {
              console.error('Error triggering default synth:', err);
            }
            pulseCreature(1);
        }
      } catch (err) {
        console.error('Error in triggerSynthFromValue:', err);
      }
    }
  };
});