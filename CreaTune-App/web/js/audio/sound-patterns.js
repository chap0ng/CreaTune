// sound-patterns.js
// Sound pattern definitions for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // C major scale notes for patterns
  const cMajorNotes = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];
  
  // ===== SOIL PATTERNS =====
  // Earth-like, grounded, deep, lower register patterns
  const soilPatterns = [
    // Pattern 1 - Simple earthy rhythm
    [cMajorNotes[0], cMajorNotes[2], cMajorNotes[0], cMajorNotes[4]],
    
    // Pattern 2 - Earthy with rests
    [cMajorNotes[0], null, cMajorNotes[2], null, cMajorNotes[0], null],
    
    // Pattern 3 - Steady bassline-like pattern
    [cMajorNotes[0], cMajorNotes[0], cMajorNotes[2], cMajorNotes[0]],
    
    // Pattern 4 - Rising earth
    [cMajorNotes[0], cMajorNotes[2], cMajorNotes[4], cMajorNotes[2]]
  ];
  
  // ===== LIGHT PATTERNS =====
  // Bright, high, delicate patterns, higher register
  const lightPatterns = [
    // Pattern 1 - Bright high pattern
    [cMajorNotes[5], cMajorNotes[7], cMajorNotes[5], cMajorNotes[4]],
    
    // Pattern 2 - Airy with rests
    [cMajorNotes[7], null, cMajorNotes[5], null, cMajorNotes[4], null],
    
    // Pattern 3 - Sparkling high notes
    [cMajorNotes[7], cMajorNotes[5], cMajorNotes[7], cMajorNotes[4]],
    
    // Pattern 4 - Dancing light
    [cMajorNotes[5], cMajorNotes[7], null, cMajorNotes[5]]
  ];
  
  // ===== TEMPERATURE PATTERNS =====
  // Varied, dynamic, mid-range patterns
  const tempPatterns = [
    // Pattern 1 - Warm pulse
    [cMajorNotes[3], cMajorNotes[1], cMajorNotes[3], cMajorNotes[2]],
    
    // Pattern 2 - Heat wave
    [cMajorNotes[3], null, cMajorNotes[1], null, cMajorNotes[2], null],
    
    // Pattern 3 - Temperature fluctuation
    [cMajorNotes[1], cMajorNotes[3], cMajorNotes[2], cMajorNotes[4]],
    
    // Pattern 4 - Thermal energy
    [null, cMajorNotes[3], cMajorNotes[1], cMajorNotes[3]]
  ];
  
  // ===== CHORD PROGRESSIONS =====
  // For more complex synths and combinations
  const chords = [
    // C major triad
    ["C3", "E3", "G3"],
    
    // E minor triad
    ["E3", "G3", "B3"],
    
    // F major triad
    ["F3", "A3", "C4"],
    
    // G major triad
    ["G3", "B3", "D4"],
    
    // Am triad
    ["A3", "C4", "E4"],
    
    // C major 7th
    ["C3", "E3", "G3", "B3"],
    
    // G dominant 7th
    ["G3", "B3", "D4", "F4"]
  ];
  
  // Apply sensor values to modify patterns
  function modifyPatternWithSensorValue(pattern, sensorValue) {
    if (!sensorValue || typeof sensorValue !== 'number') {
      return pattern;
    }
    
    // Normalize value between 0 and 1
    const normalizedValue = Math.min(1, Math.max(0, sensorValue));
    
    // Apply different modifications based on value ranges
    if (normalizedValue < 0.3) {
      // Low range - sparse pattern with more nulls
      return pattern.map(note => (Math.random() < 0.4) ? null : note);
    } 
    else if (normalizedValue < 0.7) {
      // Mid range - mostly unchanged
      return pattern;
    }
    else {
      // High range - more intense, add octave variations
      return pattern.map(note => {
        if (note === null) return note;
        
        // Occasionally transpose notes up an octave
        if (Math.random() < 0.3) {
          const noteName = note.slice(0, -1);
          const octave = parseInt(note.slice(-1)) + 1;
          return noteName + octave;
        }
        
        return note;
      });
    }
  }
  
  // Generate patterns for combined states
  function generateCombinedPattern(pattern1, pattern2, blendFactor = 0.5) {
    const result = [];
    const maxLength = Math.max(pattern1.length, pattern2.length);
    
    for (let i = 0; i < maxLength; i++) {
      // Use modulo to handle patterns of different lengths
      const note1 = pattern1[i % pattern1.length];
      const note2 = pattern2[i % pattern2.length];
      
      // Random selection based on blend factor
      if (Math.random() < blendFactor) {
        result.push(note1);
      } else {
        result.push(note2);
      }
    }
    
    return result;
  }
  
  // Get growth pattern (soil + light)
  function getGrowthPattern(soilValue, lightValue) {
    const soilPattern = soilPatterns[Math.floor(Math.random() * soilPatterns.length)];
    const lightPattern = lightPatterns[Math.floor(Math.random() * lightPatterns.length)];
    
    // Calculate blend factor based on sensor values
    let blendFactor = 0.5;
    if (soilValue !== null && lightValue !== null) {
      blendFactor = soilValue / (soilValue + lightValue);
    }
    
    return generateCombinedPattern(soilPattern, lightPattern, blendFactor);
  }
  
  // Get mirrage pattern (soil + temp)
  function getMirragePattern(soilValue, tempValue) {
    const soilPattern = soilPatterns[Math.floor(Math.random() * soilPatterns.length)];
    const tempPattern = tempPatterns[Math.floor(Math.random() * tempPatterns.length)];
    
    // Calculate blend factor based on sensor values
    let blendFactor = 0.5;
    if (soilValue !== null && tempValue !== null) {
      blendFactor = soilValue / (soilValue + tempValue);
    }
    
    return generateCombinedPattern(soilPattern, tempPattern, blendFactor);
  }
  
  // Get flower pattern (light + temp)
  function getFlowerPattern(lightValue, tempValue) {
    const lightPattern = lightPatterns[Math.floor(Math.random() * lightPatterns.length)];
    const tempPattern = tempPatterns[Math.floor(Math.random() * tempPatterns.length)];
    
    // Calculate blend factor based on sensor values
    let blendFactor = 0.5;
    if (lightValue !== null && tempValue !== null) {
      blendFactor = lightValue / (lightValue + tempValue);
    }
    
    return generateCombinedPattern(lightPattern, tempPattern, blendFactor);
  }
  
  // Get total pattern (all sensors)
  function getTotalPattern(soilValue, lightValue, tempValue) {
    // For total, we'll generate more complex patterns
    // We'll use chords instead of single notes for a richer sound
    
    // Get a random chord
    const randomChord = chords[Math.floor(Math.random() * chords.length)];
    
    // Modify chord based on sensor values
    if (soilValue !== null && soilValue > 0.7) {
      // High soil - add a lower octave bass note
      const bassNote = randomChord[0].replace(/\d/, match => parseInt(match) - 1);
      randomChord.unshift(bassNote);
    }
    
    if (lightValue !== null && lightValue > 0.7) {
      // High light - add a higher octave note
      const highNote = randomChord[randomChord.length - 1].replace(/\d/, match => parseInt(match) + 1);
      randomChord.push(highNote);
    }
    
    if (tempValue !== null && tempValue > 0.7) {
      // High temperature - add tension to the chord (add a 7th)
      const seventhNote = randomChord[0].slice(0, -1) + "7";
      if (!randomChord.includes(seventhNote)) {
        randomChord.push(seventhNote);
      }
    }
    
    return randomChord;
  }
  
  // Get random soil pattern
  function getRandomSoilPattern() {
    return soilPatterns[Math.floor(Math.random() * soilPatterns.length)];
  }
  
  // Get random light pattern
  function getRandomLightPattern() {
    return lightPatterns[Math.floor(Math.random() * lightPatterns.length)];
  }
  
  // Get random temperature pattern
  function getRandomTempPattern() {
    return tempPatterns[Math.floor(Math.random() * tempPatterns.length)];
  }
  
  // Get random chord
  function getRandomChord() {
    return chords[Math.floor(Math.random() * chords.length)];
  }
  
  // Initialize and set up event listeners
  function initialize() {
    // Listen for state changes to prepare appropriate patterns
    EventBus.subscribe('stateChanged', (data) => {
      // We could pre-compute patterns here based on state,
      // but for simplicity we'll generate them on demand when requested
    });
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.SoundPatterns = {
    // Get basic patterns
    getSoilPatterns: () => soilPatterns,
    getLightPatterns: () => lightPatterns,
    getTempPatterns: () => tempPatterns,
    getChords: () => chords,
    
    // Get random patterns
    getRandomSoilPattern,
    getRandomLightPattern,
    getRandomTempPattern,
    getRandomChord,
    
    // Get combined patterns
    getGrowthPattern,
    getMirragePattern,
    getFlowerPattern,
    getTotalPattern,
    
    // Modify patterns with sensor values
    modifyPatternWithSensorValue
  };
});
