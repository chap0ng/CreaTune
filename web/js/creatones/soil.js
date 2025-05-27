// soil.js
// FIXED - Robust disconnect cleanup + better state management + Tone.js button debug + AudioContext resume + CSS class-based styling

class SoilHandler {
    constructor() {
        this.synth = null;
        this.loop = null;
        this.melody = null;
        this.lastActivityTime = 0;
        this.inactivityTimeout = 1500;
        this.isActive = false;      // Sensor data indicates activity
        this.isPlaying = false;     // Audio is currently playing
        this.isConnected = false;   // WebSocket connection to sensor is live
        this.audioEnabled = false;  // User has clicked the enable audio button
        this.debugMode = true;

        // DOM elements
        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.audioEnableButton = null;

        // Optional UI elements (ensure these IDs exist in your HTML if you use them)
        this.soilButton = document.getElementById('soil-button');
        this.soilStatus = document.getElementById('soil-status');


        if (!this.soilCreatureVisual) {
            console.warn('💧 .soil-creature element not found.');
        }
        if (!this.frameBackground) {
            console.warn('💧 .framebackground element not found.');
        }

        this.initAudioEnableButton();
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                console.log('🌱 SoilHandler: Dependencies (Tone, window.creatune) ready.');
                this.initTone();
                this.setupListeners();
                this.updateUI(); // Initial UI state
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button'; // Style via CSS
        this.audioEnableButton.textContent = 'Click to Enable Audio';
        // All styling will be done via CSS using its ID or classes

        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) {
                try {
                    await Tone.start();
                    this.audioEnabled = true;
                    console.log('🎵 AudioContext started by user gesture.');
                    this.audioEnableButton.textContent = 'Audio Enabled'; // Feedback
                    this.audioEnableButton.classList.add('audio-button-confirm'); // Class for "confirmed" style
                    
                    // Hide the button after a short delay
                    setTimeout(() => {
                        this.audioEnableButton.classList.add('audio-button-hidden');
                    }, 1000); // Hide after 1 second

                    // If soil is already active and connected, try starting audio now
                    if (this.isActive && this.isConnected) {
                        this.startAudio();
                    }
                    this.updateUI(); // Update UI in case state allows visuals now
                } catch (e) {
                    console.error('Error starting AudioContext:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.classList.add('audio-button-error');
                }
            }
        });
        document.body.appendChild(this.audioEnableButton);
    }

    initTone() {
        if (this.synth) return;
        if (!window.Tone) {
            console.error('💧 Tone.js is not loaded. Cannot initialize synth.');
            return;
        }
        console.log('💧 Initializing Tone.js components for soil...');
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.5 }
        }).toDestination();
        const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.3 }).toDestination();
        this.synth.connect(reverb);
        this.synth.volume.value = -12;
        this.melody = [
            { note: 'C4', dur: '8n', time: '0:0' },
            { note: 'E4', dur: '8n', time: '0:0:2' },
            { note: 'G4', dur: '8n', time: '0:1:0' },
            { note: 'C5', dur: '4n', time: '0:1:2' }
        ];
        console.log('💧 Tone.js components initialized for soil.');
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 window.creatune not available for setting up listeners.');
            return;
        }
        console.log('💧 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 Soil state change received: ${state.active ? 'ACTIVE' : 'INACTIVE'} (Raw: ${JSON.stringify(state.rawData)})`);
                this.toggleActivity(state.active); // This will update isActive and call updateUI
            }
        });

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported connected by client.');
                this.isConnected = true;
                // If audio was already enabled and sensor is now active, try starting audio
                if (this.audioEnabled && this.isActive) {
                    this.startAudio();
                }
                this.updateUI();
            }
        });

        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported disconnected by client.');
                this.isConnected = false;
                this.toggleActivity(false); // This will set isActive=false, call stopAudio(), and then updateUI()
            }
        });
        
        // Initial state check
        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active; // Sensor active state
            if (this.debugMode) console.log(`💧 SoilHandler: Initial state from client - Connected: ${this.isConnected}, SensorActive: ${this.isActive}`);
        }
        this.updateUI(); // Update UI with initial state
        console.log('💧 SoilHandler: WebSocket listeners set up.');
    }

    toggleActivity(sensorIsActive) {
        // sensorIsActive refers to the soil sensor's reported state
        if (this.isActive === sensorIsActive) {
            // If sensor state hasn't changed, but connection might have, ensure audio reflects this
            if (sensorIsActive && this.isConnected && !this.isPlaying) this.startAudio();
            else if ((!sensorIsActive || !this.isConnected) && this.isPlaying) this.stopAudio();
            this.updateUI();
            return;
        }

        this.isActive = sensorIsActive;
        if (this.debugMode) console.log(`💧 Soil sensor activity toggled to: ${this.isActive ? 'ACTIVE' : 'INACTIVE'}`);

        if (this.isActive && this.isConnected) {
            this.startAudio();
        } else {
            this.stopAudio(); // Stop audio if sensor not active or not connected
        }
        // startAudio/stopAudio will set this.isPlaying and then we update UI
        // this.updateUI() is called at the end of startAudio/stopAudio implicitly by their structure or explicitly
    }

    updateUI() {
        // Soil Creature Visuals: Visible if audio is playing AND sensor is connected
        if (this.soilCreatureVisual) {
            this.soilCreatureVisual.classList.toggle('active', this.isPlaying && this.isConnected);
        }

        // Frame Background: Apply 'soil-connected-bg' if sensor is connected
        if (this.frameBackground) {
            this.frameBackground.classList.toggle('soil-connected-bg', this.isConnected);
            // If you were using the .soil class for this:
            // this.frameBackground.classList.toggle('soil', this.isConnected);
        }

        // --- Optional: For soil-button and soil-status if they exist ---
        if (this.soilButton) {
            this.soilButton.classList.toggle('active', this.isActive && this.isConnected);
            this.soilButton.classList.toggle('connected', this.isConnected);
        }
        if (this.soilStatus) {
            if (!this.isConnected) {
                this.soilStatus.textContent = 'Soil: Disconnected';
                // this.soilStatus.className = 'status disconnected'; // Use classList.add/remove
            } else if (this.isActive) {
                this.soilStatus.textContent = 'Soil: Active';
                // this.soilStatus.className = 'status active';
            } else {
                this.soilStatus.textContent = 'Soil: Inactive';
                // this.soilStatus.className = 'status inactive';
            }
        }
        // --- End Optional ---

        if (this.debugMode) {
            console.log(`💧 UI Update: isConnected=${this.isConnected}, sensorIsActive=${this.isActive}, audioIsPlaying=${this.isPlaying}, creatureActive=${this.soilCreatureVisual ? this.soilCreatureVisual.classList.contains('active') : 'N/A'}, bgSoilConnected=${this.frameBackground ? this.frameBackground.classList.contains('soil-connected-bg') : 'N/A'}`);
        }
    }

    startAudio() {
        if (!this.audioEnabled) {
            if (this.debugMode) console.log('💧 Audio not enabled by user. Cannot start soil audio.');
            return;
        }
        if (!this.synth) {
            console.error('💧 Synth not initialized. Cannot start audio.');
            this.initTone();
            if (!this.synth) return;
        }
        if (this.isPlaying) {
            this.updateUI(); // Ensure UI is consistent if already playing
            return;
        }
        if (!this.isConnected || !this.isActive) { // Don't start if not connected or sensor not active
            if (this.debugMode) console.log('💧 Conditions not met to start audio (not connected or sensor not active).');
            this.stopAudio(); // Ensure it's stopped if somehow isPlaying was true
            return;
        }

        console.log('💧 Attempting to start soil audio...');
        Tone.Transport.bpm.value = 100;

        if (this.loop) {
            this.loop.dispose();
        }
        this.loop = new Tone.Part((time, value) => {
            this.synth.triggerAttackRelease(value.note, value.dur, time);
        }, this.melody).start(0);
        this.loop.loop = true;
        this.loop.loopEnd = '1m';

        Tone.Transport.start();
        this.isPlaying = true;
        console.log('💧 Soil audio started.');
        this.updateUI(); // Update UI after audio state changes
    }

    stopAudio() {
        if (!this.isPlaying && !this.loop) { // If already stopped or loop doesn't exist
             this.isPlaying = false; // Ensure state is correct
             this.updateUI();
             return;
        }
        console.log('💧 Attempting to stop soil audio...');
        if (this.loop) {
            this.loop.stop(0);
            this.loop.dispose();
            this.loop = null;
        }
        // Only stop transport if it's actually running and perhaps if no other parts are using it.
        // For now, assume this is the main controller for soil sound.
        if (Tone.Transport.state === 'started') {
            // Tone.Transport.stop(); // Consider if other sounds might be using the global transport
        }
        this.isPlaying = false;
        console.log('💧 Soil audio stopped.');
        this.updateUI(); // Update UI after audio state changes
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            console.log('🌱 Dependencies met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) {
                window.soilHandlerInstance = new SoilHandler();
            }
        } else {
            console.log('🌱 Waiting for window.creatune and Tone.js to be defined...');
            setTimeout(ensureCreatuneAndTone, 100);
        }
    };
    ensureCreatuneAndTone();
});

// Export for modules (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}