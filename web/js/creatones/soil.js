class SoilHandler {
    constructor() {
        this.synth = null;
        this.loop = null;
        this.melody = null;
        this.isActive = false;      // Sensor data indicates 'humid' or 'wet'
        this.isPlaying = false;     // Audio is currently playing
        this.isConnected = false;   // WebSocket connection to sensor is live
        this.audioEnabled = false;  // User has clicked the enable audio button
        this.debugMode = true;

        this.soilCreatureVisual = document.querySelector('.soil-creature');
        this.frameBackground = document.querySelector('.framebackground');
        this.audioEnableButton = null;

        // Optional UI elements
        this.soilButton = document.getElementById('soil-button');
        this.soilStatus = document.getElementById('soil-status');

        if (!this.soilCreatureVisual) console.warn('💧 .soil-creature element not found.');
        if (!this.frameBackground) console.warn('💧 .framebackground element not found.');

        this.initAudioEnableButton();
        this.initializeWhenReady();
    }

    initializeWhenReady() {
        const checkDependencies = () => {
            if (window.Tone && window.creatune) {
                console.log('🌱 SoilHandler: Dependencies (Tone, window.creatune) ready.');
                this.initTone();
                this.setupListeners();
                this.updateUI();
            } else {
                if (this.debugMode) console.log('🌱 SoilHandler: Waiting for dependencies...');
                setTimeout(checkDependencies, 100);
            }
        };
        checkDependencies();
    }

    initAudioEnableButton() {
        this.audioEnableButton = document.createElement('button');
        this.audioEnableButton.id = 'audio-enable-button';
        this.audioEnableButton.textContent = 'Click to Enable Audio';

        this.audioEnableButton.addEventListener('click', async () => {
            if (!this.audioEnabled) {
                try {
                    await Tone.start();
                    this.audioEnabled = true;
                    console.log('🎵 AudioContext started by user gesture.');
                    this.audioEnableButton.textContent = 'Audio Enabled';
                    this.audioEnableButton.classList.add('audio-button-confirm');
                    setTimeout(() => this.audioEnableButton.classList.add('audio-button-hidden'), 1000);

                    if (this.isActive && this.isConnected) this.startAudio();
                    this.updateUI();
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
            console.error('💧 Tone.js is not loaded.');
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
            { note: 'C4', dur: '8n', time: '0:0' }, { note: 'E4', dur: '8n', time: '0:0:2' },
            { note: 'G4', dur: '8n', time: '0:1:0' }, { note: 'C5', dur: '4n', time: '0:1:2' }
        ];
        console.log('💧 Tone.js components initialized for soil.');
    }

    setupListeners() {
        if (!window.creatune) {
            console.error('💧 window.creatune not available.');
            return;
        }
        console.log('💧 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('stateChange', (deviceType, state) => {
            if (deviceType === 'soil') {
                if (this.debugMode) console.log(`💧 Soil stateChange event: sensor active = ${state.active}`);
                // state.active is true if soil_condition is 'humid' or 'wet'
                this.isActive = state.active; // Update internal sensor active state
                this.manageAudioAndVisuals();
            }
        });

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported connected.');
                this.isConnected = true;
                this.manageAudioAndVisuals();
            }
        });

        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                console.log('💧 Soil sensor reported disconnected.');
                this.isConnected = false;
                this.isActive = false; // If disconnected, sensor cannot be considered active
                this.manageAudioAndVisuals();
            }
        });

        const initialState = window.creatune.getDeviceState('soil');
        if (initialState) {
            this.isConnected = initialState.connected;
            this.isActive = initialState.active;
            if (this.debugMode) console.log(`💧 SoilHandler: Initial state - Connected: ${this.isConnected}, SensorActive: ${this.isActive}`);
        }
        this.updateUI(); // Initial UI based on potentially stale state, will update on new events
        console.log('💧 SoilHandler: WebSocket listeners set up.');
    }
    
    manageAudioAndVisuals() {
        // Determine if audio should be playing based on all conditions
        const shouldPlayAudio = this.audioEnabled && this.isConnected && this.isActive;

        if (shouldPlayAudio && !this.isPlaying) {
            this.startAudio();
        } else if (!shouldPlayAudio && this.isPlaying) {
            this.stopAudio();
        }
        // Always update UI to reflect current states
        this.updateUI();
    }


    updateUI() {
        if (this.soilCreatureVisual) {
            this.soilCreatureVisual.classList.toggle('active', this.isPlaying);
        }
        if (this.frameBackground) {
            this.frameBackground.classList.toggle('soil-connected-bg', this.isConnected);
        }

        if (this.soilButton) {
            this.soilButton.classList.toggle('active', this.isActive && this.isConnected);
            this.soilButton.classList.toggle('connected', this.isConnected);
        }
        if (this.soilStatus) {
            if (!this.isConnected) this.soilStatus.textContent = 'Soil: Disconnected';
            else if (this.isActive) this.soilStatus.textContent = 'Soil: Active (Humid/Wet)';
            else this.soilStatus.textContent = 'Soil: Inactive (Dry)';
        }
        if (this.debugMode) console.log(`💧 UI Update: Connected=${this.isConnected}, SensorActive=${this.isActive}, AudioPlaying=${this.isPlaying}`);
    }

    startAudio() {
        // Pre-conditions already checked by manageAudioAndVisuals
        if (this.isPlaying || !this.audioEnabled || !this.isConnected || !this.isActive) {
             // If somehow called directly without meeting conditions, ensure UI is correct
            if (!this.isPlaying && (!this.audioEnabled || !this.isConnected || !this.isActive)) {
                // If it's not playing AND conditions are not met, ensure it stays stopped.
            } else if (this.isPlaying) {
                // If it is playing, but conditions are no longer met, it should be stopped by manageAudioAndVisuals
            }
            this.updateUI();
            return;
        }
        if (!this.synth) { this.initTone(); if (!this.synth) return; }

        console.log('💧 Attempting to start soil audio...');
        Tone.Transport.bpm.value = 100;
        if (this.loop) this.loop.dispose();
        this.loop = new Tone.Part((time, value) => {
            this.synth.triggerAttackRelease(value.note, value.dur, time);
        }, this.melody).start(0);
        this.loop.loop = true; this.loop.loopEnd = '1m';
        Tone.Transport.start();
        this.isPlaying = true;
        console.log('💧 Soil audio started.');
        this.updateUI();
    }

    stopAudio() {
        if (!this.isPlaying && !this.loop) { // Already stopped or never started
            this.isPlaying = false; // Ensure state is correct
            this.updateUI();
            return;
        }
        console.log('💧 Attempting to stop soil audio...');
        if (this.loop) {
            this.loop.stop(0); this.loop.dispose(); this.loop = null;
        }
        // Consider global Tone.Transport.stop() implications if other sounds exist
        // if (Tone.Transport.state === 'started') Tone.Transport.stop();
        this.isPlaying = false;
        console.log('💧 Soil audio stopped.');
        this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 DOMContentLoaded: Preparing Soil Handler...');
    const ensureCreatuneAndTone = () => {
        if (window.creatune && window.Tone) {
            console.log('🌱 Dependencies met. Initializing Soil Handler instance.');
            if (!window.soilHandlerInstance) window.soilHandlerInstance = new SoilHandler();
        } else {
            console.log('🌱 Waiting for window.creatune and Tone.js...');
            setTimeout(ensureCreatuneAndTone, 100);
        }
    };
    ensureCreatuneAndTone();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}