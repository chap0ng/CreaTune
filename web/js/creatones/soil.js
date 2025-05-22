// esp32 soil state: soilsynth Tone.js, soil-background & soil-creature //
/* -------------------------------------------------------------------- */

/* get current esp32-status */

/* if current esp32-status is soil activate soil-background*/
/* log : "soil active" */

/* displaying soil-background */


/* -------------------------------------------------------------------- */
/* if current esp32 is soil & soilvalues are in range -> activate soil-creature & tone.js synths*/
/* log : soil creature found */

/* playing random scale loop soilsynth using tone.js */

/* displaying soil-creature in css if frame close*/

/*hiding soil-creature in css if frame close*/

/* if current esp32 not soil - deactivate soil state */
/* log : "soil not active" */

/* -------------------------------------*/

/* soil.js - ESP32 Soil State Handler */
/* Handles soilsynth Tone.js, soil-background & soil-creature */

class SoilHandler {
  constructor() {
    this.isActive = false;
    this.currentMoistureValue = 0;
    this.esp32Connected = false;
    
    // Tone.js synth components
    this.soilSynth = null;
    this.soilFilter = null;
    this.soilReverb = null;
    this.soilGain = null;
    
    // Scale and timing
    this.soilScale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
    this.isPlaying = false;
    this.playInterval = null;
    
    // UI elements
    this.frameBackground = null;
    this.soilCreature = null;
    
    this.init();
  }

  init() {
    console.log('🌱 Soil Handler initializing...');
    
    // Get UI elements
    this.frameBackground = document.querySelector('.framebackground');
    this.soilCreature = document.querySelector('.soil-creature');
    
    // Initialize Tone.js components
    this.initializeToneJS();
    
    // Set up event listeners for ESP32 status changes
    this.setupEventListeners();
    
    console.log('🌱 Soil Handler ready');
  }

  async initializeToneJS() {
    try {
      // Create soil synth with organic, earthy sound
      this.soilSynth = new Tone.PolySynth({
        voice: Tone.Synth,
        options: {
          oscillator: {
            type: 'sawtooth'
          },
          envelope: {
            attack: 0.8,
            decay: 0.4,
            sustain: 0.3,
            release: 1.2
          }
        }
      });

      // Create filter for earthy tone
      this.soilFilter = new Tone.Filter({
        frequency: 800,
        type: 'lowpass',
        rolloff: -24
      });

      // Create reverb for organic spaciousness
      this.soilReverb = new Tone.Reverb({
        decay: 2.5,
        wet: 0.3
      });

      // Gain control
      this.soilGain = new Tone.Gain(0.4);

      // Connect the audio chain
      this.soilSynth
        .connect(this.soilFilter)
        .connect(this.soilReverb)
        .connect(this.soilGain)
        .toDestination();

      console.log('🎵 Soil synth initialized');
    } catch (error) {
      console.error('🚨 Error initializing Tone.js:', error);
    }
  }

  setupEventListeners() {
    // Listen for user interaction to start audio context
    document.addEventListener('click', this.startAudioContext.bind(this), { once: true });
    document.addEventListener('touchstart', this.startAudioContext.bind(this), { once: true });
  }

  async startAudioContext() {
    try {
      await Tone.start();
      console.log('🎵 Audio context started');
    } catch (error) {
      console.error('🚨 Error starting audio context:', error);
    }
  }

  // Main handler called by WebSocket client
  handleSensorData(sensorData) {
    // Check if this is soil sensor data
    if (sensorData.sensor !== 'MoistureSensor') {
      return;
    }

    const { app_active, moisture_app_value, soil_condition } = sensorData;
    
    this.esp32Connected = true;
    this.currentMoistureValue = moisture_app_value;

    // Handle soil activation/deactivation
    if (app_active && !this.isActive) {
      this.activateSoilState();
    } else if (!app_active && this.isActive) {
      this.deactivateSoilState();
    }

    // Update audio parameters based on moisture
    if (this.isActive) {
      this.updateSoilAudio(moisture_app_value, soil_condition);
    }
  }

  activateSoilState() {
    console.log('🌱 soil active');
    this.isActive = true;

    // Activate soil background
    this.displaySoilBackground();

    // Activate soil creature and start synth
    this.activateSoilCreature();
    this.startSoilSynth();
  }

  deactivateSoilState() {
    console.log('💤 soil not active');
    this.isActive = false;

    // Deactivate visuals and audio
    this.hideSoilBackground();
    this.hideSoilCreature();
    this.stopSoilSynth();
  }

  displaySoilBackground() {
    if (this.frameBackground) {
      this.frameBackground.classList.add('active');
      console.log('🖼️ Soil background displayed');
    }
  }

  hideSoilBackground() {
    if (this.frameBackground) {
      this.frameBackground.classList.remove('active');
      console.log('🖼️ Soil background hidden');
    }
  }

  activateSoilCreature() {
    console.log('🐛 soil creature found');
    
    if (this.soilCreature) {
      this.soilCreature.style.display = 'block';
      this.soilCreature.style.animation = 'soilcreature 2s steps(4) infinite';
      console.log('🐛 Soil creature displayed in CSS');
    }
  }

  hideSoilCreature() {
    if (this.soilCreature) {
      this.soilCreature.style.display = 'none';
      this.soilCreature.style.animation = '';
      console.log('🐛 Soil creature hidden');
    }
  }

  startSoilSynth() {
    if (this.isPlaying) return;

    console.log('🎵 Starting random scale loop soilsynth');
    this.isPlaying = true;

    this.playInterval = setInterval(() => {
      this.playRandomNote();
    }, this.getPlaybackInterval());
  }

  stopSoilSynth() {
    if (!this.isPlaying) return;

    console.log('🎵 Stopping soil synth');
    this.isPlaying = false;

    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }

    // Stop all notes
    if (this.soilSynth) {
      this.soilSynth.releaseAll();
    }
  }

  playRandomNote() {
    if (!this.soilSynth || !this.isActive) return;

    // Select random note from soil scale
    const note = this.soilScale[Math.floor(Math.random() * this.soilScale.length)];
    
    // Random note duration based on moisture
    const duration = this.getNoteDuration();
    
    // Play the note
    this.soilSynth.triggerAttackRelease(note, duration);
    
    console.log(`🎵 Playing: ${note} for ${duration}`);
  }

  updateSoilAudio(moistureValue, condition) {
    // Update filter frequency based on moisture (more water = higher frequency)
    if (this.soilFilter) {
      const filterFreq = 400 + (moistureValue * 800); // 400-1200 Hz range
      this.soilFilter.frequency.rampTo(filterFreq, 0.5);
    }

    // Update reverb wetness based on moisture
    if (this.soilReverb) {
      const wetness = 0.2 + (moistureValue * 0.4); // 0.2-0.6 range
      this.soilReverb.wet.rampTo(wetness, 0.5);
    }

    // Update gain based on condition
    if (this.soilGain) {
      let gainLevel = 0.3;
      switch (condition) {
        case 'dry':
          gainLevel = 0.2;
          break;
        case 'humid':
          gainLevel = 0.4;
          break;
        case 'wet':
          gainLevel = 0.5;
          break;
      }
      this.soilGain.gain.rampTo(gainLevel, 0.5);
    }

    // Update playback timing
    if (this.playInterval && this.isPlaying) {
      clearInterval(this.playInterval);
      this.playInterval = setInterval(() => {
        this.playRandomNote();
      }, this.getPlaybackInterval());
    }
  }

  getPlaybackInterval() {
    // Faster playback with higher moisture
    const baseInterval = 2000; // 2 seconds
    const speedMultiplier = 1 - (this.currentMoistureValue * 0.5); // 0.5x to 1x speed
    return Math.max(500, baseInterval * speedMultiplier); // Min 500ms interval
  }

  getNoteDuration() {
    // Longer notes with higher moisture
    const baseDuration = 0.3;
    const moistureBonus = this.currentMoistureValue * 0.4;
    return baseDuration + moistureBonus; // 0.3 to 0.7 seconds
  }

  // Public methods for external access
  getCurrentState() {
    return {
      isActive: this.isActive,
      moistureValue: this.currentMoistureValue,
      esp32Connected: this.esp32Connected,
      isPlaying: this.isPlaying
    };
  }

  // Force activate/deactivate (for testing)
  forceActivate() {
    this.activateSoilState();
  }

  forceDeactivate() {
    this.deactivateSoilState();
  }

  // Update ESP32 connection status
  updateConnectionStatus(connected) {
    this.esp32Connected = connected;
    
    if (!connected && this.isActive) {
      console.log('🔌 ESP32 disconnected - deactivating soil state');
      this.deactivateSoilState();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Soil Handler...');
  window.SoilHandler = new SoilHandler();
});

// Export for use in other modules
window.SoilHandler = SoilHandler;