// synth-logic.js with modifications for recording integration
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
  
  // Set up sequences in C major scale
  function setupSequences() {
    const cMajorNotes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    const cMajorChords = [
      ["C3", "E3", "G3"], 
      ["E3", "G3", "C4"], 
      ["G3", "C4", "E4"]
    ];
    
    // Simple patterns for each synth
    const pattern1 = [cMajorNotes[0], cMajorNotes[2], cMajorNotes[4], cMajorNotes[1]];
    const pattern2 = [cMajorNotes[5], cMajorNotes[3], cMajorNotes[1], cMajorNotes[2]];
    const pattern3 = [cMajorNotes[3], null, cMajorNotes[2], null, cMajorNotes[0], null];
    
    // Rhythm variation
    let rhythmPhase = 0;
    const rhythmSpeed = 0.05;
    
    function getRhythmValue() {
      const sineValue = Math.sin(rhythmPhase);
      rhythmPhase += rhythmSpeed;
      return 0.8 + (sineValue * 0.3);
    }
    
    // Main sequence loop
    synths.mainLoop = new Tone.Loop((time) => {
      // Don't play if recordingSystem has a loop playing
      if (window.recordingSystem && window.recordingSystem.hasLoop()) {
        return;
      }
    
      const rhythmFactor = getRhythmValue();
      const noteDuration = rhythmFactor < 0.7 ? "4n" : "2n";
      
      // Play appropriate synth based on button state
      if (state.button1 && state.button2 && state.button3) {
        const randomIndex = Math.floor(Math.random() * cMajorChords.length);
        const chord = cMajorChords[randomIndex];
        chord.forEach(note => {
          synths.synth7.triggerAttackRelease(note, noteDuration, time);
        });
        window.synthUI && window.synthUI.pulseShape('shape7');
      } 
      else if (state.button1 && state.button2) {
        const note = cMajorNotes[Math.floor(Math.random() * cMajorNotes.length)];
        synths.synth4.triggerAttackRelease(note, noteDuration, time);
        window.synthUI && window.synthUI.pulseShape('shape4');
      } 
      else if (state.button1 && state.button3) {
        const randomIndex = Math.floor(Math.random() * cMajorChords.length);
        const chord = cMajorChords[randomIndex];
        chord.forEach(note => {
          synths.synth5.triggerAttackRelease(note, noteDuration, time);
        });
        window.synthUI && window.synthUI.pulseShape('shape5');
      } 
      else if (state.button2 && state.button3) {
        const note = cMajorNotes[Math.floor(Math.random() * cMajorNotes.length)];
        synths.synth6.triggerAttackRelease(note, noteDuration, time);
        window.synthUI && window.synthUI.pulseShape('shape6');
      } 
      else if (state.button1) {
        const note = pattern1[Math.floor(Math.random() * pattern1.length)];
        if (note !== null) {
          synths.synth1.triggerAttackRelease(note, noteDuration, time);
          window.synthUI && window.synthUI.pulseShape('shape1');
        }
      } 
      else if (state.button2) {
        const note = pattern2[Math.floor(Math.random() * pattern2.length)];
        if (note !== null) {
          synths.synth2.triggerAttackRelease(note, noteDuration, time);
          window.synthUI && window.synthUI.pulseShape('shape2');
        }
      } 
      else if (state.button3) {
        const note = pattern3[Math.floor(Math.random() * pattern3.length)];
        if (note !== null) {
          synths.synth3.triggerAttackRelease(note, noteDuration, time);
          window.synthUI && window.synthUI.pulseShape('shape3');
        }
      }
    }, "8n").start(0);
    
    Tone.Transport.bpm.value = 85;
  }
  
  // Test audio with a simple sound
  function testAudio() {
    const testSynth = new Tone.Synth().toDestination();
    testSynth.triggerAttackRelease("C4", "8n");
  }
  
  // Export the API for the synth system
  window.synthEngine = {
    init: async function(statusCallback) {
      if (audioStarted) return;
      
      try {
        if (statusCallback) statusCallback("Starting audio...");
        await Tone.start();
        
        testAudio();
        createSynths();
        setupSequences();
        
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
    
    // Add this new function to expose synths
    getSynths: function() {
      return synths;
    },
    
    // Add a function to trigger a synth directly based on current state
    triggerNote: function(note = "C4", duration = "8n") {
      // Determine which synth to use based on button state
      let selectedSynth;
      
      if (state.button1 && state.button2 && state.button3) {
        selectedSynth = synths.synth7;
        window.synthUI && window.synthUI.pulseShape('shape7');
      } 
      else if (state.button1 && state.button2) {
        selectedSynth = synths.synth4;
        window.synthUI && window.synthUI.pulseShape('shape4');
      } 
      else if (state.button1 && state.button3) {
        selectedSynth = synths.synth5;
        window.synthUI && window.synthUI.pulseShape('shape5');
      } 
      else if (state.button2 && state.button3) {
        selectedSynth = synths.synth6;
        window.synthUI && window.synthUI.pulseShape('shape6');
      } 
      else if (state.button1) {
        selectedSynth = synths.synth1;
        window.synthUI && window.synthUI.pulseShape('shape1');
      } 
      else if (state.button2) {
        selectedSynth = synths.synth2;
        window.synthUI && window.synthUI.pulseShape('shape2');
      } 
      else if (state.button3) {
        selectedSynth = synths.synth3;
        window.synthUI && window.synthUI.pulseShape('shape3');
      } 
      else {
        // Default if no buttons are active
        selectedSynth = synths.synth1;
        window.synthUI && window.synthUI.pulseShape('shape1');
      }
      
      // Play the note
      selectedSynth.triggerAttackRelease(note, duration);
    }
  };
});