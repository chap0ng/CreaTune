// soil.js - ESP32 Soil State Handler
// Handles soilsynth Tone.js, soil-background & soil-creature
// Pure synth and visual logic - receives data from websocket-client

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.currentValue = 0;
        
        // Tone.js components
        this.soilSynth = null;
        this.soilReverb = null;
        this.soilLoop = null;
        this.isPlaying = false;
        
        // DOM elements
        this.frameBackground = null;
        this.soilCreature = null;
        
        this.init();
    }
    
    async init() {
        console.log('Soil handler initializing...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        // Initialize Tone.js
        await this.initializeSoilSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('Soil handler ready');
    }
    
    async initializeSoilSynth() {
        try {
            // Create reverb for soil sounds
            this.soilReverb = new Tone.Reverb({
                decay: 4.0,
                wet: 0.6,
                preDelay: 0.2
            }).toDestination();
            await this.soilReverb.generate();
            
            // Create organic FM synth for soil
            this.soilSynth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 2.5,
                modulationIndex: 10,
                oscillator: { type: "sawtooth" },
                envelope: {
                    attack: 0.1,
                    decay: 0.8,
                    sustain: 0.2,
                    release: 2.0
                },
                modulation: { type: "triangle" },
                modulationEnvelope: {
                    attack: 0.05,
                    decay: 0.5,
                    sustain: 0.1,
                    release: 1.5
                }
            }).connect(this.soilReverb);
            
            this.soilSynth.volume.value = -8;
            console.log('Soil synth initialized');
            
        } catch (error) {
            console.error('Soil synth initialization failed:', error);
        }
    }
    
    connectToWebSocket() {
        // Wait for websocket client and connect to soil data
        const connect = () => {
            if (window.creatoneWS) {
                window.creatoneWS.on('sensor_data', (data) => this.processSensorData(data));
                console.log('Soil handler connected to websocket data');
            } else {
                setTimeout(connect, 100);
            }
        };
        connect();
    }
    
    processSensorData(data) {
        // Only handle soil/moisture sensors
        if (!this.isSoilData(data)) return;
        
        const value = data.voltage || data.moisture_app_value || 0;
        console.log(`Soil data: ${value.toFixed(3)}`);
        
        // Check if in active range (0.4-0.8)
        if (value >= 0.4 && value <= 0.8) {
            this.activateSoil(value);
        } else {
            this.deactivateSoil();
        }
    }
    
    isSoilData(data) {
        return data.sensor && (
            data.sensor.toLowerCase().includes('moisture') ||
            data.sensor.toLowerCase().includes('soil') ||
            data.soil_condition
        );
    }
    
    activateSoil(value) {
        this.currentValue = value;
        
        if (!this.isActive) {
            this.isActive = true;
            console.log('Soil active');
            
            // Visual triggers - add CSS classes
            if (this.frameBackground) {
                this.frameBackground.classList.add('soil', 'active');
            }
            if (this.soilCreature) {
                this.soilCreature.classList.add('active');
            }
        }
        
        // Play/update soil synth
        this.playSoilSynth(value);
    }
    
    deactivateSoil() {
        if (this.isActive) {
            this.isActive = false;
            console.log('Soil not active');
            
            // Visual triggers - remove CSS classes
            if (this.frameBackground) {
                this.frameBackground.classList.remove('soil', 'active');
            }
            if (this.soilCreature) {
                this.soilCreature.classList.remove('active');
            }
            
            // Stop synth
            this.stopSoilSynth();
        }
    }
    
    async playSoilSynth(value) {
        if (!this.soilSynth) return;
        
        // Start Tone.js context if needed
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        if (!this.isPlaying) {
            this.startSoilLoop(value);
        } else {
            this.updateSoilLoop(value);
        }
    }
    
    startSoilLoop(value) {
        console.log('Soil creature found');
        
        // Soil scale for natural sounds
        const soilScale = ["C3", "D3", "F3", "G3", "A3", "C4", "D4", "F4"];
        
        // Create random scale loop
        this.soilLoop = new Tone.Loop((time) => {
            const noteIndex = Math.floor(value * (soilScale.length - 1));
            const note = soilScale[noteIndex];
            
            this.soilSynth.triggerAttackRelease(note, "4n", time);
            
            // Random harmonies
            if (Math.random() < 0.3) {
                const harmonyIndex = Math.min(noteIndex + 2, soilScale.length - 1);
                const harmonyNote = soilScale[harmonyIndex];
                this.soilSynth.triggerAttackRelease(harmonyNote, "8n", time + 0.1);
            }
            
        }, this.getSoilTiming(value));
        
        this.isPlaying = true;
        this.soilLoop.start(0);
        Tone.Transport.start();
        
        console.log('Playing random scale loop soilsynth');
    }
    
    updateSoilLoop(value) {
        if (!this.soilSynth || !this.soilLoop) return;
        
        // Update synth parameters based on soil value
        this.soilSynth.set({
            harmonicity: 1.5 + (value * 2),
            modulationIndex: 5 + (value * 15),
            volume: -12 + (value * 4)
        });
        
        // Update loop timing
        this.soilLoop.interval = this.getSoilTiming(value);
        
        // Update reverb wetness
        if (this.soilReverb) {
            this.soilReverb.wet.value = 0.3 + (value * 0.4);
        }
    }
    
    getSoilTiming(value) {
        // Higher moisture = faster rhythm
        const baseInterval = 2.0;
        const speedIncrease = 1.5;
        return `${baseInterval - (value * speedIncrease)}s`;
    }
    
    stopSoilSynth() {
        if (this.isPlaying) {
            this.isPlaying = false;
            
            if (this.soilLoop) {
                this.soilLoop.stop();
                this.soilLoop.dispose();
                this.soilLoop = null;
            }
            
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.soilHandler = new SoilHandler();
});