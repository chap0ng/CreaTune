// synth-engine.js
// Tone.js integration for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  console.log('SynthEngine initializing...');
  
  // Import configuration
  const { STATES, AUDIO } = window.CreaTuneConfig || {
    STATES: {
      IDLE: 'idle',
      SOIL: 'soil',
      LIGHT: 'light',
      TEMP: 'temp',
      GROWTH: 'growth',
      MIRRAGE: 'mirrage',
      FLOWER: 'flower',
      TOTAL: 'total'
    },
    AUDIO: {
      BASE_VOLUME: -8,
      MIN_BPM: 60,
      MAX_BPM: 180,
      DEFAULT_BPM: 85
    }
  };
  
  // Synth state management
  const state = {
    button1: false, // Soil
    button2: false, // Light
    button3: false, // Temperature
    initialized: false,
    bpm: AUDIO.DEFAULT_BPM
  };
  
  // Track if audio context has been started
  let audioStarted = false;
  
  // Synthesizer instances for each state
  let synths = {
    soil: null,     // Lower register, earthy sounds
    light: null,    // Higher register, bright sounds
    temp: null,     // Mid-range, varied sounds
    growth: null,   // Soil + Light combination
    mirrage: null,  // Soil + Temp combination
    flower: null,   // Light + Temp combination
    total: null     // All sounds together
  };
  
  // Effects chain
  let effects = {
    reverb: null,
    delay: null,
    distortion: null,
    master: null
  };
  
  // Initialize Tone.js and create synths
  function init() {
    try {
      console.log('Initializing Tone.js audio engine...');
      
      // If already initialized, don't reinitialize
      if (state.initialized) {
        console.log('SynthEngine already initialized');
        return Promise.resolve(true);
      }
      
      // Use async/await to handle Tone.start() promise
      return startAudioContext()
        .then(() => {
          // Set up effects first
          setupEffects();
          
          // Create synths
          createSynths();
          
          // Set initial BPM
          Tone.Transport.bpm.value = state.bpm;
          
          // Start transport
          if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
          }
          
          // Mark as initialized
          state.initialized = true;
          
          console.log('SynthEngine initialized successfully');
          return true;
        })
        .catch(err => {
          console.error('Error initializing SynthEngine:', err);
          return false;
        });
    } catch (err) {
      console.error('Error in init():', err);
      return Promise.resolve(false);
    }
  }
  
  // Start the audio context
  function startAudioContext() {
    try {
      if (Tone.context.state !== 'running') {
        console.log('Starting Tone.js audio context...');
        
        // Start the audio context
        return Tone.start()
          .then(() => {
            console.log('Audio context started successfully');
            audioStarted = true;
            return true;
          })
          .catch(err => {
            console.error('Error starting audio context:', err);
            return false;
          });
      } else {
        console.log('Audio context already running');
        audioStarted = true;
        return Promise.resolve(true);
      }
    } catch (err) {
      console.error('Error in startAudioContext():', err);
      return Promise.resolve(false);
    }
  }
  
  // Set up audio effects chain
  function setupEffects() {
    try {
      console.log('Setting up audio effects...');
      
      // Create reverb effect
      effects.reverb = new Tone.Reverb({
        decay: 3.0,
        wet: 0.3
      }).toDestination();
      
      // Create delay effect
      effects.delay = new Tone.FeedbackDelay({
        delayTime: "8n",
        feedback: 0.2,
        wet: 0.2
      }).connect(effects.reverb);
      
      // Create distortion effect (subtle)
      effects.distortion = new Tone.Distortion({
        distortion: 0.1,
        wet: 0.05
      }).connect(effects.delay);
      
      // Create master volume control
      effects.master = new Tone.Volume(AUDIO.BASE_VOLUME)
        .connect(effects.distortion);
      
      console.log('Effects chain created successfully');
    } catch (err) {
      console.error('Error setting up effects chain:', err);
    }
  }
  
  // Create all synth instruments
  function createSynths() {
    try {
      console.log('Creating synthesizers...');
      
      // Soil Synth - warm, earthy bass sound
      synths.soil = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: "sine8",
          partials: [1, 0.2, 0.01]
        },
        envelope: {
          attack: 0.1,
          decay: 0.3,
          sustain: 0.4,
          release: 1.2
        },
        volume: -2
      }).connect(effects.master);
      
      // Light Synth - bright, high sound
      synths.light = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: "triangle8"
        },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 0.8
        },
        volume: -4
      }).connect(effects.master);
      
      // Temperature Synth - mid-range, versatile
      synths.temp = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: "square8"
        },
        envelope: {
          attack: 0.05,
          decay: 0.2,
          sustain: 0.2,
          release: 0.5
        },
        volume: -5
      }).connect(effects.master);
      
      // Growth Synth (soil + light) - evolving sound
      synths.growth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        oscillator: {
          type: "fatsawtooth"
        },
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.3,
          release: 1.5
        },
        modulation: {
          type: "sine"
        },
        modulationEnvelope: {
          attack: 0.5,
          decay: 0.1,
          sustain: 0.2,
          release: 0.5
        },
        volume: -8
      }).connect(effects.master);
      
      // Mirrage Synth (soil + temp) - abstract sound
      synths.mirrage = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.5,
        modulationIndex: 10,
        oscillator: {
          type: "sine"
        },
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.3,
          release: 1.2
        },
        modulation: {
          type: "triangle"
        },
        modulationEnvelope: {
          attack: 0.2,
          decay: 0.01,
          sustain: 0.1,
          release: 0.5
        },
        volume: -10
      }).connect(effects.master);
      
      // Flower Synth (light + temp) - delicate sound
      synths.flower = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 3,
        oscillator: {
          type: "sine"
        },
        envelope: {
          attack: 0.03,
          decay: 0.1,
          sustain: 0.2,
          release: 0.8
        },
        modulation: {
          type: "square"
        },
        modulationEnvelope: {
          attack: 0.1,
          decay: 0.1,
          sustain: 0.1,
          release: 0.3
        },
        volume: -6
      }).connect(effects.master);
      
      // Total Synth (soil + light + temp) - rich, complex sound
      synths.total = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 5,
        oscillator: {
          type: "fatcustom",
          partials: [0.8, 0.2, 0.1, 0.05]
        },
        envelope: {
          attack: 0.05,
          decay: 0.3,
          sustain: 0.5,
          release: 1.5
        },
        modulation: {
          type: "sine"
        },
        modulationEnvelope: {
          attack: 0.5,
          decay: 0.5,
          sustain: 0.2,
          release: 0.5
        },
        volume: -12
      }).connect(effects.master);
      
      console.log('Synthesizers created successfully');
    } catch (err) {
      console.error('Error creating synths:', err);
    }
  }
  
  // Set master volume
  function setMasterVolume(level) {
    try {
      if (effects.master) {
        effects.master.volume.value = level;
        return true;
      }
    } catch (err) {
      console.error('Error setting master volume:', err);
    }
    return false;
  }
  
  // Set BPM
  function setBPM(bpm) {
    try {
      // Validate BPM range
      const newBPM = Math.max(AUDIO.MIN_BPM, Math.min(AUDIO.MAX_BPM, bpm));
      
      // Update state
      state.bpm = newBPM;
      
      // Update Tone Transport BPM
      if (Tone.Transport) {
        Tone.Transport.bpm.value = newBPM;
        console.log(`BPM set to ${newBPM}`);
        
        // Notify listeners
        if (window.EventBus) {
          window.EventBus.emit('bpmChanged', newBPM);
        }
        
        return true;
      }
    } catch (err) {
      console.error('Error setting BPM:', err);
    }
    return false;
  }
  
  // Get current BPM
  function getBPM() {
    return state.bpm;
  }
  
  // Helper to get appropriate synth for current state
  function getSynthForState(currentState) {
    switch (currentState) {
      case STATES.SOIL:
        return synths.soil;
      case STATES.LIGHT:
        return synths.light;
      case STATES.TEMP:
        return synths.temp;
      case STATES.GROWTH:
        return synths.growth;
      case STATES.MIRRAGE:
        return synths.mirrage;
      case STATES.FLOWER:
        return synths.flower;
      case STATES.TOTAL:
        return synths.total;
      default:
        return null;
    }
  }
  
  // Trigger a synth based on sensor value
  function triggerSynthFromValue(value) {
    try {
      // Ensure audio context is started
      if (!audioStarted) {
        startAudioContext();
      }
      
      // Get current state from state manager
      const currentState = window.StateManager ? window.StateManager.getState() : STATES.IDLE;
      
      // Skip if in idle state
      if (currentState === STATES.IDLE) {
        return false;
      }
      
      // Get appropriate synth for current state
      const synth = getSynthForState(currentState);
      if (!synth) {
        console.warn(`No synth available for state: ${currentState}`);
        return false;
      }
      
      // Normalize value (should already be 0.4-0.8 from ESP32)
      const normalizedValue = Math.min(1, Math.max(0, value));
      
      // Get pattern from SoundPatterns
      let pattern = [];
      
      if (window.SoundPatterns) {
        // Get appropriate pattern based on state
        switch (currentState) {
          case STATES.SOIL:
            pattern = window.SoundPatterns.getRandomSoilPattern();
            break;
          case STATES.LIGHT:
            pattern = window.SoundPatterns.getRandomLightPattern();
            break;
          case STATES.TEMP:
            pattern = window.SoundPatterns.getRandomTempPattern();
            break;
          case STATES.GROWTH:
            // Get soil and light values if available
            const soilValue = window.ESPManager ? window.ESPManager.getESPValue('esp1') : null;
            const lightValue = window.ESPManager ? window.ESPManager.getESPValue('esp2') : null;
            pattern = window.SoundPatterns.getGrowthPattern(soilValue, lightValue);
            break;
          case STATES.MIRRAGE:
            // Get soil and temp values if available
            const soilValue2 = window.ESPManager ? window.ESPManager.getESPValue('esp1') : null;
            const tempValue = window.ESPManager ? window.ESPManager.getESPValue('esp3') : null;
            pattern = window.SoundPatterns.getMirragePattern(soilValue2, tempValue);
            break;
          case STATES.FLOWER:
            // Get light and temp values if available
            const lightValue2 = window.ESPManager ? window.ESPManager.getESPValue('esp2') : null;
            const tempValue2 = window.ESPManager ? window.ESPManager.getESPValue('esp3') : null;
            pattern = window.SoundPatterns.getFlowerPattern(lightValue2, tempValue2);
            break;
          case STATES.TOTAL:
            // Get all values if available
            const soilValue3 = window.ESPManager ? window.ESPManager.getESPValue('esp1') : null;
            const lightValue3 = window.ESPManager ? window.ESPManager.getESPValue('esp2') : null;
            const tempValue3 = window.ESPManager ? window.ESPManager.getESPValue('esp3') : null;
            pattern = window.SoundPatterns.getTotalPattern(soilValue3, lightValue3, tempValue3);
            break;
          default:
            pattern = [];
            break;
        }
        
        // Modify pattern based on sensor value if available
        if (pattern.length > 0) {
          pattern = window.SoundPatterns.modifyPatternWithSensorValue(pattern, normalizedValue);
        }
      } else {
        // Fallback if SoundPatterns not available
        // Use value to determine pitch
        const note = Tone.Frequency(60 + (normalizedValue * 36), "midi").toNote();
        pattern = [note];
      }
      
      // Skip if no pattern
      if (!pattern || pattern.length === 0) {
        return false;
      }
      
      // Map value to velocity (0.4-0.8 range to 0.3-0.9 range)
      const velocity = 0.3 + (normalizedValue * 0.6);
      
      // Trigger synth
      if (Array.isArray(pattern[0])) {
        // Assume it's a chord if first element is an array
        synth.triggerAttackRelease(pattern, "8n", undefined, velocity);
      } else {
        // Choose a random note from the pattern
        const randomIdx = Math.floor(Math.random() * pattern.length);
        const note = pattern[randomIdx];
        
        // Skip if null (rest)
        if (note === null) {
          return false;
        }
        
        // Play note
        synth.triggerAttackRelease(note, "8n", undefined, velocity);
      }
      
      return true;
    } catch (err) {
      console.error('Error triggering synth:', err);
      return false;
    }
  }
  
  // Trigger synth from pattern (for recorded patterns)
  function triggerPatternNote(intensity) {
    try {
      // Ensure audio initialized
      if (!state.initialized) {
        init();
      }
      
      // Get current state from state manager
      const currentState = window.StateManager ? window.StateManager.getState() : STATES.IDLE;
      
      // Skip if in idle state
      if (currentState === STATES.IDLE) {
        return false;
      }
      
      // Get appropriate synth for current state
      const synth = getSynthForState(currentState);
      if (!synth) {
        console.warn(`No synth available for state: ${currentState}`);
        return false;
      }
      
      // Normalize intensity
      const normalizedIntensity = Math.min(1, Math.max(0, intensity));
      
      // Map intensity to note (more intense = higher note)
      // Use C major scale in appropriate octave
      const noteOptions = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
      const noteIdx = Math.floor(normalizedIntensity * (noteOptions.length - 1));
      const note = noteOptions[noteIdx];
      
      // Map intensity to velocity
      const velocity = 0.5 + (normalizedIntensity * 0.4);
      
      // Play note
      synth.triggerAttackRelease(note, "8n", undefined, velocity);
      
      return true;
    } catch (err) {
      console.error('Error triggering pattern note:', err);
      return false;
    }
  }
  
  // Silence all synths (for recording)
  function silenceSynths(silence) {
    try {
      const allSynths = Object.values(synths);
      
      // Silence or restore synths
      if (silence) {
        // Store original volumes and silence
        if (!state.originalVolumes) {
          state.originalVolumes = {};
          
          for (const [name, synth] of Object.entries(synths)) {
            if (synth && synth.volume && synth.volume.value !== undefined) {
              state.originalVolumes[name] = synth.volume.value;
              synth.volume.value = -Infinity;
            }
          }
        }
      } else {
        // Restore original volumes
        if (state.originalVolumes) {
          for (const [name, synth] of Object.entries(synths)) {
            if (synth && synth.volume && state.originalVolumes[name] !== undefined) {
              synth.volume.value = state.originalVolumes[name];
            }
          }
          
          // Clear stored volumes
          state.originalVolumes = null;
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error silencing synths:', err);
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
      
      console.log(`SynthEngine updating for state: ${currentState}`);
      console.log(`Valid sensors - Soil: ${isValid.soil}, Light: ${isValid.light}, Temp: ${isValid.temp}`);
      
      // For debugging
      let activeButtons = [];
      
      // Set button state based on current state and valid data
      switch (currentState) {
        case STATES.SOIL:
          if (isValid.soil) {
            state.button1 = true;
            activeButtons.push('soil');
          }
          break;
        case STATES.LIGHT:
          if (isValid.light) {
            state.button2 = true;
            activeButtons.push('light');
          }
          break;
        case STATES.TEMP:
          if (isValid.temp) {
            state.button3 = true;
            activeButtons.push('temp');
          }
          break;
        case STATES.GROWTH:
          if (isValid.soil) {
            state.button1 = true;
            activeButtons.push('soil');
          }
          if (isValid.light) {
            state.button2 = true;
            activeButtons.push('light');
          }
          break;
        case STATES.MIRRAGE:
          if (isValid.soil) {
            state.button1 = true;
            activeButtons.push('soil');
          }
          if (isValid.temp) {
            state.button3 = true;
            activeButtons.push('temp');
          }
          break;
        case STATES.FLOWER:
          if (isValid.light) {
            state.button2 = true;
            activeButtons.push('light');
          }
          if (isValid.temp) {
            state.button3 = true;
            activeButtons.push('temp');
          }
          break;
        case STATES.TOTAL:
          if (isValid.soil) {
            state.button1 = true;
            activeButtons.push('soil');
          }
          if (isValid.light) {
            state.button2 = true;
            activeButtons.push('light');
          }
          if (isValid.temp) {
            state.button3 = true;
            activeButtons.push('temp');
          }
          break;
      }
      
      console.log(`Active buttons: ${activeButtons.join(', ') || 'none'}`);
      
      // Restart Tone.Transport if it's stopped
      try {
        if (Tone.Transport && Tone.Transport.state !== "started" && audioStarted) {
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
  
  // Ensure audio is started (called by esp-manager.js)
  function ensureAudioStarted() {
    if (!audioStarted) {
      return startAudioContext();
    }
    return Promise.resolve(audioStarted);
  }
  
  // Clean up resources on page unload
  window.addEventListener('beforeunload', function() {
    // Dispose synths
    for (const synthName in synths) {
      if (synths[synthName]) {
        try {
          synths[synthName].dispose();
        } catch (err) {
          console.error(`Error disposing synth ${synthName}:`, err);
        }
      }
    }
    
    // Dispose effects
    for (const effectName in effects) {
      if (effects[effectName]) {
        try {
          effects[effectName].dispose();
        } catch (err) {
          console.error(`Error disposing effect ${effectName}:`, err);
        }
      }
    }
  });
  
  // Initialize when EventBus and app are ready
  function initializeWithApp() {
    // Listen for app initialization
    if (window.EventBus) {
      window.EventBus.subscribe('appInitialized', () => {
        console.log('App initialized, initializing SynthEngine');
        init();
      });
    }
    
    // Listen for state changes
    if (window.EventBus) {
      window.EventBus.subscribe('stateChanged', (data) => {
        if (data.state && data.espStatus) {
          updateSynths(data.state, data.espStatus);
        }
      });
    }
  }
  
  // Initialize on load
  initializeWithApp();
  
  // Expose API
  window.SynthEngine = {
    init,
    isInitialized: () => state.initialized,
    startAudioContext,
    triggerSynthFromValue,
    triggerPatternNote,
    silenceSynths,
    updateSynths,
    getBPM,
    setBPM,
    setMasterVolume,
    getState: () => ({...state}),
    ensureAudioStarted
  };
  
  console.log('SynthEngine API exposed to window');
});
