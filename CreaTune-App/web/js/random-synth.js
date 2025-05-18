// random-synth.js - Simple random synth button
document.addEventListener('DOMContentLoaded', () => {
  // Get button element
  const randomButton = document.getElementById('randomSynthButton');
  if (!randomButton) return;
  
  // Notes in C major scale
  const cMajorNotes = ["C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4", "C5"];
  
  // Random synth configurations
  const synthConfigs = [
    {
      type: "sine",
      attack: 0.2,
      decay: 0.3,
      sustain: 0.4,
      release: 1.0
    },
    {
      type: "triangle",
      attack: 0.05,
      decay: 0.1,
      sustain: 0.3,
      release: 0.8
    },
    {
      type: "square",
      attack: 0.01,
      decay: 0.1,
      sustain: 0.2,
      release: 0.6
    },
    {
      type: "sawtooth",
      attack: 0.1,
      decay: 0.2,
      sustain: 0.3,
      release: 1.2
    }
  ];
  
  // Create a random synth
  let randomSynth = null;
  let isActive = false;
  let randomInterval = null;
  
  // Initialize synth
  function initSynth() {
    // Create reverb effect
    const reverb = new Tone.Reverb({
      decay: 2.5,
      wet: 0.5
    }).toDestination();
    
    // Create random synth
    randomSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.1,
        decay: 0.2,
        sustain: 0.4,
        release: 1.0
      }
    }).connect(reverb);
    
    // Set volume
    randomSynth.volume.value = -10;
  }
  
  // Play random notes
  function playRandomNotes() {
    // Don't play if synth not initialized
    if (!randomSynth) return;
    
    // Get a random config
    const config = synthConfigs[Math.floor(Math.random() * synthConfigs.length)];
    
    // Apply config to synth
    randomSynth.set({
      oscillator: {
        type: config.type
      },
      envelope: {
        attack: config.attack,
        decay: config.decay,
        sustain: config.sustain,
        release: config.release
      }
    });
    
    // Play 1-3 random notes
    const notesToPlay = 1 + Math.floor(Math.random() * 2);
    const velocity = 0.5 + (Math.random() * 0.4); // 0.5 - 0.9
    
    // Play notes
    for (let i = 0; i < notesToPlay; i++) {
      const randomNote = cMajorNotes[Math.floor(Math.random() * cMajorNotes.length)];
      const randomDuration = ["16n", "8n", "4n"][Math.floor(Math.random() * 3)];
      
      // If playing multiple notes, stagger them slightly
      const timeOffset = i * 0.05;
      randomSynth.triggerAttackRelease(randomNote, randomDuration, Tone.now() + timeOffset, velocity);
    }
    
    // Animate a sprite frame if possible
    if (window.spriteAnimation && !window.dragContainer.isTabOpen() && 
        (!window.recordingSystem || !window.recordingSystem.hasLoop())) {
      const sprite = document.getElementById('sprite');
      
      // Get current frame
      let currentFrame = 0;
      const backgroundPosition = sprite.style.backgroundPosition;
      
      if (backgroundPosition) {
        // Extract the frame number
        const match = backgroundPosition.match(/(\d+)/);
        if (match) {
          currentFrame = parseInt(match[0], 10);
        }
      }
      
      // Advance to next frame (assuming 12 frames total in a 4x3 grid)
      const nextFrame = (currentFrame + 1) % 12;
      
      // Update frame
      window.spriteAnimation.showFrame(nextFrame);
    }
    
    // Randomly trigger creature animation
    if (window.creatureManager) {
      const creatureId = Math.floor(Math.random() * 7) + 1;
      window.creatureManager.animate(`creature${creatureId}`);
      
      // Pulse shape if UI available
      if (window.synthUI) {
        window.synthUI.pulseShape(`shape${creatureId}`);
      }
    }
  }
  
  // Toggle random synth
  function toggleRandomSynth() {
    // Initialize Tone.js if not already started
    Tone.start().then(() => {
      if (!randomSynth) {
        initSynth();
      }
      
      if (isActive) {
        // Stop the interval
        clearInterval(randomInterval);
        randomInterval = null;
        randomButton.classList.remove('active');
        isActive = false;
      } else {
        // Play immediately
        playRandomNotes();
        
        // Set up interval for continuous playing
        const randomDelay = 1000 + Math.floor(Math.random() * 2000); // 1-3 seconds
        randomInterval = setInterval(() => {
          playRandomNotes();
        }, randomDelay);
        
        randomButton.classList.add('active');
        isActive = true;
      }
    }).catch(err => {
      console.error('Could not start Tone.js', err);
    });
  }
  
  // Tab open/close handler
  function handleTabStateChange() {
    const originalIsTabOpen = window.dragContainer.isTabOpen;
    
    window.dragContainer.isTabOpen = function() {
      const tabOpen = originalIsTabOpen.call(window.dragContainer);
      
      // If tab is open and random synth is active, pause it
      if (tabOpen && isActive && randomInterval) {
        clearInterval(randomInterval);
        randomInterval = null;
      } else if (!tabOpen && isActive && !randomInterval) {
        // If tab is closed and random synth should be active, resume it
        const randomDelay = 1000 + Math.floor(Math.random() * 2000);
        randomInterval = setInterval(() => {
          playRandomNotes();
        }, randomDelay);
      }
      
      return tabOpen;
    };
  }
  
  // Hide button when tab is open
  function handleButtonVisibility() {
    const checkVisibility = () => {
      if (window.dragContainer && window.dragContainer.isTabOpen()) {
        randomButton.style.display = 'none';
      } else {
        randomButton.style.display = 'flex';
      }
    };
    
    // Check immediately
    checkVisibility();
    
    // Set up periodic check
    setInterval(checkVisibility, 500);
  }
  
  // Add click event listener to button
  randomButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent container click
    toggleRandomSynth();
  });
  
  // Set up tab state change handler
  if (window.dragContainer) {
    handleTabStateChange();
    handleButtonVisibility();
  }
  
  // Expose API
  window.randomSynth = {
    play: playRandomNotes,
    toggle: toggleRandomSynth,
    isActive: () => isActive
  };
});