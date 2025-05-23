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

// light.js - ESP32 Light State Handler
// Handles light synth Tone.js, light-background & light-creature
// Template with proper disconnection handling

class LightHandler {
    constructor() {
        this.isActive = false;
        this.isConnected = false;
        this.currentValue = 0;
        this.lastDataTime = 0;
        
        // Tone.js components
        this.lightSynth = null;
        this.lightReverb = null;
        this.lightLoop = null;
        this.isPlaying = false;
        
        // DOM elements
        this.frameBackground = null;
        this.lightCreature = null;
        
        // Timeout for data monitoring
        this.dataTimeout = null;
        this.DATA_TIMEOUT_MS = 5000;
        
        this.init();
    }
    
    async init() {
        console.log('Light handler initializing...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.lightCreature = document.querySelector('.light-creature');
        
        // Initialize Tone.js
        await this.initializeLightSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('Light handler ready');
    }
    
    async initializeLightSynth() {
        try {
            // Create bright reverb for light sounds
            this.lightReverb = new Tone.Reverb({
                decay: 2.0,
                wet: 0.4,
                preDelay: 0.1
            }).toDestination();
            await this.lightReverb.generate();
            
            // Create bright synth for light
            this.lightSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: {
                    attack: 0.05,
                    decay: 0.3,
                    sustain: 0.4,
                    release: 1.0
                }
            }).connect(this.lightReverb);
            
            this.lightSynth.volume.value = -10;
            console.log('Light synth initialized');
            
        } catch (error) {
            console.error('Light synth initialization failed:', error);
        }
    }
    
    connectToWebSocket() {
        const connect = () => {
            if (window.creatoneWS) {
                // Listen for light sensor data
                window.creatoneWS.on('sensor_data', (data) => this.processSensorData(data));
                
                // Listen for light sensor disconnection
                window.creatoneWS.on('sensor_light_disconnected', (data) => this.handleDisconnection(data));
                
                // Listen for general disconnection
                window.creatoneWS.on('disconnected', () => this.handleGeneralDisconnection());
                
                console.log('Light handler connected to websocket data');
            } else {
                setTimeout(connect, 100);
            }
        };
        connect();
    }
    
    processSensorData(data) {
        // Only handle light sensors
        if (!this.isLightData(data)) return;
        
        this.isConnected = true;
        this.lastDataTime = Date.now();
        
        // Clear any existing timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
        }
        
        // Set new timeout to detect disconnection
        this.dataTimeout = setTimeout(() => {
            console.log('⚠️ Light sensor data timeout - assuming disconnected');
            this.handleDataTimeout();
        }, this.DATA_TIMEOUT_MS);
        
        const value = data.light || data.voltage || 0;
        console.log(`Light data: ${value.toFixed(3)}`);
        
        // Check if in active range (adjust as needed)
        if (value >= 0.3 && value <= 0.9) {
            this.activateLight(value);
        } else {
            this.deactivateLight();
        }
    }
    
    isLightData(data) {
        return data.sensor && (
            data.sensor.toLowerCase().includes('light') ||
            data.light !== undefined
        );
    }
    
    handleDisconnection(data) {
        console.log('🔌 Light ESP32 disconnected:', data.name);
        this.isConnected = false;
        
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        
        this.forceDeactivate();
    }
    
    handleGeneralDisconnection() {
        console.log('🔌 WebSocket disconnected - stopping light handler');
        this.isConnected = false;
        
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        
        this.forceDeactivate();
    }
    
    handleDataTimeout() {
        console.log('⏰ Light sensor data timeout');
        this.isConnected = false;
        this.forceDeactivate();
    }
    
    activateLight(value) {
        if (!this.isConnected) return;
        
        this.currentValue = value;
        
        if (!this.isActive) {
            this.isActive = true;
            console.log('💡 Light active');
            
            // Visual triggers
            if (this.frameBackground) {
                this.frameBackground.classList.add('light', 'active');
            }
            if (this.lightCreature) {
                this.lightCreature.classList.add('active');
            }
        }
        
        this.playLightSynth(value);
    }
    
    deactivateLight() {
        if (this.isActive) {
            this.isActive = false;
            console.log('💡 Light not active (value out of range)');
            
            if (this.frameBackground && this.isConnected) {
                this.frameBackground.classList.remove('active');
            }
            if (this.lightCreature) {
                this.lightCreature.classList.remove('active');
            }
            
            this.stopLightSynth();
        }
    }
    
    forceDeactivate() {
        console.log('🛑 Force deactivating light handler');
        
        this.isActive = false;
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('light', 'active');
        }
        if (this.lightCreature) {
            this.lightCreature.classList.remove('active');
        }
        
        this.stopLightSynth();
    }
    
    async playLightSynth(value) {
        if (!this.lightSynth || !this.isConnected) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        if (!this.isPlaying) {
            this.startLightLoop(value);
        } else {
            this.updateLightLoop(value);
        }
    }
    
    startLightLoop(value) {
        console.log('🎵 Light creature found - starting synth');
        
        // Bright scale for light sounds
        const lightScale = ["C4", "E4", "G4", "B4", "D5", "F5", "A5", "C6"];
        
        this.lightLoop = new Tone.Loop((time) => {
            if (!this.isConnected || !this.isActive) {
                return;
            }
            
            const noteIndex = Math.floor(this.currentValue * (lightScale.length - 1));
            const note = lightScale[noteIndex];
            
            this.lightSynth.triggerAttackRelease(note, "8n", time);
            
        }, this.getLightTiming(value));
        
        this.isPlaying = true;
        this.lightLoop.start(0);
        Tone.Transport.start();
        
        console.log('🎼 Playing light synth loop');
    }
    
    updateLightLoop(value) {
        if (!this.lightSynth || !this.lightLoop || !this.isConnected) return;
        
        this.lightSynth.set({
            volume: -15 + (value * 8)
        });
        
        this.lightLoop.interval = this.getLightTiming(value);
        
        if (this.lightReverb) {
            this.lightReverb.wet.value = 0.2 + (value * 0.3);
        }
    }
    
    getLightTiming(value) {
        // Brighter light = faster rhythm
        const baseInterval = 1.5;
        const speedIncrease = 1.0;
        return `${baseInterval - (value * speedIncrease)}s`;
    }
    
    stopLightSynth() {
        if (this.isPlaying) {
            this.isPlaying = false;
            console.log('🔇 Stopping light synth');
            
            if (this.lightLoop) {
                this.lightLoop.stop();
                this.lightLoop.dispose();
                this.lightLoop = null;
            }
            
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }
    }
    
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
    window.lightHandler = new LightHandler();
});