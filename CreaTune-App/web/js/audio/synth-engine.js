// Find and replace the updateSynths function in synth-engine.js with this version

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