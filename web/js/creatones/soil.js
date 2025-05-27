// soil.js
// FIXED - Robust disconnect cleanup + better state management + Tone.js button debug + AudioContext resume

class SoilHandler {
    constructor() {
        this.synth = null;
        this.loop = null;
        this.melody = null; // Example melody
        this.lastActivityTime = 0;
        this.inactivityTimeout = 1500; // ms before stopping audio after soil becomes inactive
        this.isActive = false; // Current soil activity state
        this.isPlaying = false; // Whether sound is playing
        this.isConnected = false; // Whether sensor is connected
        this.audioEnabled = false; // Has the user clicked to enable audio?
        this.debugMode = true; // Enable for console debugging

        // DOM elements
        this.soilButton = document.getElementById('soil-button'); // For visual feedback
        this.soilStatus = document.getElementById('soil-status');
        this.soilVisuals = document.getElementById('soil-visuals');
        this.audioEnableButton = null; // Will be created

        if (!this.soilButton || !this.soilStatus || !this.soilVisuals) {
            console.warn('💧 Some soil UI elements not found.');
            // Allow to continue for core logic, UI updates will just fail gracefully
        }

        this.initAudioEnableButton(); // Create the button to enable audio
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                console.log('🌱 SoilHandler: Dependencies (Tone, window.creatune) ready.');
                this.initTone(); // Initialize Tone.js objects, but don't start audio context yet
                this.setupListeners();
                this.updateUI(this.isActive, this.isConnected); // Initial UI state
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for dependencies...');
                setTimeout(checkDependencies, 100); // Check again shortly
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button';
        this.audioEnableButton.textContent = 'Click to Enable Audio';
        this.audioEnableButton.style.position = 'fixed';
        this.audioEnableButton.style.top = '10px';
        this.audioEnableButton.style.right = '10px';
        this.audioEnableButton.style.zIndex = '10000';
        this.audioEnableButton.style.padding = '10px';
        this.audioEnableButton.style.backgroundColor = '#ffc107';
        this.audioEnableButton.style.border = 'none';
        this.audioEnableButton.style.cursor = 'pointer';

        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) {
                try {
                    await Tone.start(); // IMPORTANT: This starts/resumes the AudioContext
                    this.audioEnabled = true;
                    console.log('🎵 AudioContext started by user gesture.');
                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.style.backgroundColor = '#28a745';
                    // If soil is already active, try starting audio now
                    if (this.isActive && this.isConnected) {
                        this.startAudio();
                    }
                } catch (e) {
                    console.error('Error starting AudioContext:', e);
                    this.audioEnableButton.textContent = 'Error Enabling Audio';
                    this.audioEnableButton.style.backgroundColor = '#dc3545';
                }
            }
        });
        document.body.appendChild(this.audioEnableButton);
    }


    initTone() {
        if (this.synth) return; // Already initialized

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
                this.toggleActivity(state.active);
            }
        });

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported connected by client.');
                this.isConnected = true;
                this.updateUI(this.isActive, true);
            }
        });

        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported disconnected by client.');
                this.isConnected = false;
                this.toggleActivity(false); // Force inactive and stop audio
                this.updateUI(false, false);
            }
        });

        // Optional: Listen to raw data for debugging or more granular control
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                this.lastActivityTime = Date.now(); // Keep track of last data
                if (this.debugMode) {
                    // console.log('💧 Raw soil data packet:', data);
                }
                 // If it's the first data and we are connected, update UI
                if (this.isConnected && !this.deviceStatesUpdatedFromData) {
                    const isActiveNow = window.creatune.shouldBeActive('soil', data);
                    this.toggleActivity(isActiveNow);
                    this.deviceStatesUpdatedFromData = true; // Avoid rapid toggling from initial data
                }
            }
        });
        
        // Check initial state from client if available
        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            this.updateUI(this.isActive, this.isConnected);
            if (this.debugMode) console.log(`💧 SoilHandler: Initial state from client - Connected: ${this.isConnected}, Active: ${this.isActive}`);
        }

        console.log('💧 SoilHandler: WebSocket listeners set up.');
    }

    toggleActivity(active) {
        if (this.isActive === active && this.isPlaying === active) return; // No change needed

        this.isActive = active;
        if (this.debugMode) console.log(`💧 Soil activity toggled to: ${active ? 'ACTIVE ▶️' : 'INACTIVE ⏹️'}`);

        if (active && this.isConnected) {
            this.startAudio();
        } else {
            this.stopAudio(); // Stop audio if not active or not connected
        }
        this.updateUI(active, this.isConnected);
    }

    updateUI(active, connected) {
        if (this.soilButton) {
            this.soilButton.classList.toggle('active', active && connected);
            this.soilButton.classList.toggle('connected', connected);
        }
        if (this.soilStatus) {
            if (!connected) {
                this.soilStatus.textContent = 'Soil: Disconnected';
                this.soilStatus.className = 'status disconnected';
            } else if (active) {
                this.soilStatus.textContent = 'Soil: Active';
                this.soilStatus.className = 'status active';
            } else {
                this.soilStatus.textContent = 'Soil: Inactive';
                this.soilStatus.className = 'status inactive';
            }
        }
        if (this.soilVisuals) {
            this.soilVisuals.classList.toggle('active', active && connected);
            this.soilVisuals.classList.toggle('connected', connected);
            if (this.debugMode) console.log(`💧 SoilHandler UI Update: Visuals active: ${active && connected}, connected: ${connected}`);
        }
    }

    startAudio() {
        if (!this.audioEnabled) {
            if (this.debugMode) console.log('💧 Audio not enabled by user. Cannot start soil audio.');
            return;
        }
        if (!this.synth) {
            console.error('💧 Synth not initialized. Cannot start audio.');
            this.initTone(); // Try to init again
            if (!this.synth) return;
        }
        if (this.isPlaying) return; // Already playing

        console.log('💧 Attempting to start soil audio...');
        Tone.Transport.bpm.value = 100; // Slower tempo

        if (this.loop) {
            this.loop.dispose(); // Dispose of old loop if any
        }

        this.loop = new Tone.Part((time, value) => {
            this.synth.triggerAttackRelease(value.note, value.dur, time);
        }, this.melody).start(0);
        this.loop.loop = true; // Ensure the part loops
        this.loop.loopEnd = '1m'; // Loop the whole measure

        Tone.Transport.start();
        this.isPlaying = true;
        console.log('💧 Soil audio started.');
    }

    stopAudio() {
        if (!this.isPlaying) return;
        console.log('💧 Attempting to stop soil audio...');
        if (this.loop) {
            this.loop.stop(0); // Stop the part
            this.loop.dispose();
            this.loop = null;
        }
        // Tone.Transport.stop(); // Stop transport only if nothing else uses it.
        // For individual sounds, just stopping the part/loop is often enough.
        // If you want to ensure all sounds stop, then Tone.Transport.stop() is okay.
        // Let's be safe and stop it if this is the only sound source.
        if (Tone.Transport.state === 'started') {
             Tone.Transport.stop();
        }

        this.isPlaying = false;
        console.log('💧 Soil audio stopped.');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    // Ensure window.creatune is available or wait for it
    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            console.log('🌱 Dependencies met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) { // Prevent multiple initializations
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