// soil.js - ESP32 Soil State Handler
// Handles soilsynth Tone.js, soil-background & soil-creature
// Pure synth and visual logic - receives data from websocket-client
// IMPROVED: Now handles ESP32 disconnections properly

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.isConnected = false; // Track connection status
        this.currentValue = 0;
        this.lastDataTime = 0;
        
        // Tone.js components
        this.soilSynth = null;
        this.soilReverb = null;
        this.soilLoop = null;
        this.isPlaying = false;
        
        // DOM elements
        this.frameBackground = null;
        this.soilCreature = null;
        
        // Timeout for data monitoring
        this.dataTimeout = null;
        this.DATA_TIMEOUT_MS = 5000; // 5 seconds without data = disconnected
        
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
                // Listen for soil sensor data
                window.creatoneWS.on('sensor_data', (data) => this.processSensorData(data));
                
                // Listen for soil sensor disconnection
                window.creatoneWS.on('sensor_soil_disconnected', (data) => this.handleDisconnection(data));
                
                // Listen for general disconnection
                window.creatoneWS.on('disconnected', () => this.handleGeneralDisconnection());
                
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
        
        // Mark as connected and update last data time
        this.isConnected = true;
        this.lastDataTime = Date.now();
        
        // Clear any existing timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
        }
        
        // Set new timeout to detect disconnection
        this.dataTimeout = setTimeout(() => {
            console.log('⚠️ Soil sensor data timeout - assuming disconnected');
            this.handleDataTimeout();
        }, this.DATA_TIMEOUT_MS);
        
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
    
    handleDisconnection(data) {
        console.log('🔌 Soil ESP32 disconnected:', data.name);
        this.isConnected = false;
        
        // Clear timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        
        // Force deactivate everything
        this.forceDeactivate();
    }
    
    handleGeneralDisconnection() {
        console.log('🔌 WebSocket disconnected - stopping soil handler');
        this.isConnected = false;
        
        // Clear timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        
        // Force deactivate everything
        this.forceDeactivate();
    }
    
    handleDataTimeout() {
        console.log('⏰ Soil sensor data timeout');
        this.isConnected = false;
        
        // Force deactivate everything
        this.forceDeactivate();
    }
    
    activateSoil(value) {
        // Only activate if connected
        if (!this.isConnected) return;
        
        this.currentValue = value;
        
        if (!this.isActive) {
            this.isActive = true;
            console.log('🌱 Soil active');
            
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
            console.log('🌱 Soil not active (value out of range)');
            
            // Visual triggers - remove active class but keep soil if connected
            if (this.frameBackground && this.isConnected) {
                this.frameBackground.classList.remove('active');
                // Keep 'soil' class if still connected
            }
            if (this.soilCreature) {
                this.soilCreature.classList.remove('active');
            }
            
            // Stop synth
            this.stopSoilSynth();
        }
    }
    
    forceDeactivate() {
        console.log('🛑 Force deactivating soil handler');
        
        this.isActive = false;
        
        // Visual triggers - remove ALL classes
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil', 'active');
        }
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
        }
        
        // Stop synth immediately
        this.stopSoilSynth();
    }
    
    async playSoilSynth(value) {
        if (!this.soilSynth || !this.isConnected) return;
        
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
        console.log('🎵 Soil creature found - starting synth');
        
        // Soil scale for natural sounds
        const soilScale = ["C3", "D3", "F3", "G3", "A3", "C4", "D4", "F4"];
        
        // Create random scale loop
        this.soilLoop = new Tone.Loop((time) => {
            // Check if still connected before playing
            if (!this.isConnected || !this.isActive) {
                return;
            }
            
            const noteIndex = Math.floor(this.currentValue * (soilScale.length - 1));
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
        
        console.log('🎼 Playing random scale loop soilsynth');
    }
    
    updateSoilLoop(value) {
        if (!this.soilSynth || !this.soilLoop || !this.isConnected) return;
        
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
            console.log('🔇 Stopping soil synth');
            
            if (this.soilLoop) {
                this.soilLoop.stop();
                this.soilLoop.dispose();
                this.soilLoop = null;
            }
            
            // Only stop transport if no other synths are playing
            // (You might want to manage this globally later)
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
    }
    
    // Public methods for debugging
    getStatus() {
        return {
            isActive: this.isActive,
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            currentValue: this.currentValue,
            lastDataTime: this.lastDataTime
        };
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.soilHandler = new SoilHandler();
});