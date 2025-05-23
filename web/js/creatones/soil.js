// soil.js - ESP32 Soil State Handler  
// STABLE CONNECTION: Debounced, permissive, smooth transitions
// Perfect balance between responsiveness and stability

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.isConnected = false;
        this.currentValue = 0;
        this.lastDataTime = 0;
        
        // CONNECTION STABILITY SYSTEM
        this.connectionBuffer = []; // Store recent connection attempts
        this.valueBuffer = []; // Store recent sensor values for averaging
        this.BUFFER_SIZE = 2; // Require 5 consecutive readings
        this.CONNECTION_DEBOUNCE_MS = 1000; // 1 seconds before considering stable
        this.DATA_TIMEOUT_MS = 10000; // 10 seconds - more permissive!
        
        // HYSTERESIS THRESHOLDS (prevent flickering)
        this.ACTIVATE_THRESHOLD_LOW = 0.35;  // Easier to activate
        this.ACTIVATE_THRESHOLD_HIGH = 0.85; // Easier to activate
        this.DEACTIVATE_THRESHOLD_LOW = 0.25; // Harder to deactivate  
        this.DEACTIVATE_THRESHOLD_HIGH = 0.95; // Harder to deactivate
        
        // Tone.js components
        this.soilSynth = null;
        this.soilReverb = null;
        this.soilLoop = null;
        this.isPlaying = false;
        
        // DOM elements
        this.frameBackground = null;
        this.soilCreature = null;
        
        // Timeouts
        this.dataTimeout = null;
        this.connectionDebounceTimeout = null;
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Soil handler initializing with stable connection system...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        // Initialize Tone.js
        await this.initializeSoilSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('✅ Soil handler ready - stable & smooth!');
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
            console.log('🎵 Soil synth initialized');
            
        } catch (error) {
            console.error('❌ Soil synth initialization failed:', error);
        }
    }
    
    connectToWebSocket() {
        const connect = () => {
            if (window.creatoneWS) {
                // Listen for soil sensor data
                window.creatoneWS.on('sensor_data', (data) => this.processSensorData(data));
                
                // Listen for soil sensor disconnection
                window.creatoneWS.on('sensor_soil_disconnected', (data) => this.handleDisconnection(data));
                
                // Listen for general disconnection
                window.creatoneWS.on('disconnected', () => this.handleGeneralDisconnection());
                
                // Listen for reconnection
                window.creatoneWS.on('connected', () => this.handleReconnection());
                
                console.log('🔌 Soil handler connected with stability system');
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
        const timestamp = Date.now();
        
        // Add to connection buffer for stability checking
        this.connectionBuffer.push({ value, timestamp });
        if (this.connectionBuffer.length > this.BUFFER_SIZE) {
            this.connectionBuffer.shift();
        }
        
        // Add to value buffer for averaging
        this.valueBuffer.push(value);
        if (this.valueBuffer.length > this.BUFFER_SIZE) {
            this.valueBuffer.shift();
        }
        
        // Check if we have enough stable readings for connection
        if (!this.isConnected && this.connectionBuffer.length >= this.BUFFER_SIZE) {
            const isStableConnection = this.checkStableConnection();
            if (isStableConnection) {
                this.handleStableConnection();
            }
        }
        
        // Update connection state and reset timeout
        if (this.isConnected) {
            this.lastDataTime = timestamp;
            
            // Clear any existing timeout
            if (this.dataTimeout) {
                clearTimeout(this.dataTimeout);
            }
            
            // Set longer timeout for more stability
            this.dataTimeout = setTimeout(() => {
                console.log('⚠️ Soil sensor timeout (8s) - assuming disconnected');
                this.handleDataTimeout();
            }, this.DATA_TIMEOUT_MS);
            
            // Get smoothed value and check creature activation
            const smoothedValue = this.getSmoothedValue();
            console.log(`🌱 Soil: ${value.toFixed(3)} (avg: ${smoothedValue.toFixed(3)})`);
            
            // Use hysteresis for creature activation/deactivation
            this.updateCreatureState(smoothedValue);
        }
    }
    
    checkStableConnection() {
        // Check if last 5 readings are consistent and recent
        const now = Date.now();
        const recentReadings = this.connectionBuffer.filter(
            reading => (now - reading.timestamp) < this.CONNECTION_DEBOUNCE_MS
        );
        
        if (recentReadings.length >= this.BUFFER_SIZE) {
            // Check if values are in reasonable sensor range
            const values = recentReadings.map(r => r.value);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
            
            // Stable if average variance is low (consistent readings)
            return variance < 0.01 && avg > 0.1 && avg < 1.0;
        }
        
        return false;
    }
    
    getSmoothedValue() {
        // Return average of recent values for stability
        if (this.valueBuffer.length === 0) return 0;
        return this.valueBuffer.reduce((a, b) => a + b, 0) / this.valueBuffer.length;
    }
    
    handleStableConnection() {
        console.log('🔌✅ Soil ESP32 STABLE connection established');
        this.isConnected = true;
        
        // Show background immediately when stable connection
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil');
            console.log('🖼️ Soil background activated (stable)');
        }
    }
    
    updateCreatureState(smoothedValue) {
        // HYSTERESIS: Different thresholds for activation vs deactivation
        if (!this.isActive) {
            // ACTIVATE: Use more permissive thresholds
            if (smoothedValue >= this.ACTIVATE_THRESHOLD_LOW && 
                smoothedValue <= this.ACTIVATE_THRESHOLD_HIGH) {
                this.showCreature(smoothedValue);
            }
        } else {
            // DEACTIVATE: Use stricter thresholds (harder to deactivate)
            if (smoothedValue < this.DEACTIVATE_THRESHOLD_LOW || 
                smoothedValue > this.DEACTIVATE_THRESHOLD_HIGH) {
                this.hideCreature();
            } else {
                // Update existing creature
                this.updateCreature(smoothedValue);
            }
        }
    }
    
    showCreature(value) {
        this.currentValue = value;
        this.isActive = true;
        console.log('👾 Soil creature appearing (stable)');
        
        // Show creature with smooth transition
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
        }
        
        // Play synth
        this.playSoilSynth(value);
    }
    
    updateCreature(value) {
        this.currentValue = value;
        // Update synth parameters smoothly
        this.updateSoilSynth(value);
    }
    
    hideCreature() {
        if (this.isActive) {
            this.isActive = false;
            console.log('👻 Soil creature hiding (out of stable range)');
            
            // Hide creature but keep background (ESP32 still connected)
            if (this.soilCreature) {
                this.soilCreature.classList.remove('active');
            }
            
            // Stop synth
            this.stopSoilSynth();
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
        console.log('🔌❌ Soil ESP32 disconnected:', data?.name || 'Unknown');
        this.forceDisconnect();
    }
    
    handleGeneralDisconnection() {
        console.log('🔌❌ WebSocket lost - soil handler stopping');
        this.forceDisconnect();
    }
    
    handleReconnection() {
        console.log('🔌🔄 WebSocket reconnected - soil handler ready');
        // Clear buffers for fresh start
        this.connectionBuffer = [];
        this.valueBuffer = [];
    }
    
    handleDataTimeout() {
        console.log('⏰ Soil data timeout (8s) - assuming disconnected');
        this.forceDisconnect();
    }
    
    forceDisconnect() {
        console.log('🛑 Force disconnecting soil handler');
        
        this.isConnected = false;
        this.isActive = false;
        
        // Clear all timeouts and buffers
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        if (this.connectionDebounceTimeout) {
            clearTimeout(this.connectionDebounceTimeout);
            this.connectionDebounceTimeout = null;
        }
        
        this.connectionBuffer = [];
        this.valueBuffer = [];
        
        // Remove ALL visual elements immediately
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil', 'active');
        }
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
        }
        
        // Stop synth immediately
        this.stopSoilSynth();
        
        console.log('🏁 Soil handler fully disconnected (stable)');
        
        // Force UI update
        this.forceUIUpdate();
    }
    
    forceUIUpdate() {
        // Trigger immediate DOM update
        if (this.frameBackground) {
            this.frameBackground.style.transform = 'translateZ(0)';
            setTimeout(() => {
                this.frameBackground.style.transform = '';
            }, 10);
        }
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('soilDisconnected', {
            detail: { timestamp: Date.now() }
        }));
    }
    
    async playSoilSynth(value) {
        if (!this.soilSynth || !this.isConnected) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        if (!this.isPlaying) {
            this.startSoilLoop(value);
        } else {
            this.updateSoilSynth(value);
        }
    }
    
    startSoilLoop(value) {
        console.log('🎼 Starting soil synth loop (stable)');
        
        const soilScale = ["C3", "D3", "F3", "G3", "A3", "C4", "D4", "F4"];
        
        this.soilLoop = new Tone.Loop((time) => {
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
    }
    
    updateSoilSynth(value) {
        if (!this.soilSynth || !this.soilLoop || !this.isConnected) return;
        
        // Smooth parameter updates
        this.soilSynth.set({
            harmonicity: 1.5 + (value * 2),
            modulationIndex: 5 + (value * 15),
            volume: -12 + (value * 4)
        });
        
        this.soilLoop.interval = this.getSoilTiming(value);
        
        if (this.soilReverb) {
            this.soilReverb.wet.value = 0.3 + (value * 0.4);
        }
    }
    
    getSoilTiming(value) {
        const baseInterval = 2.0;
        const speedIncrease = 1.5;
        return `${baseInterval - (value * speedIncrease)}s`;
    }
    
    stopSoilSynth() {
        if (this.isPlaying) {
            this.isPlaying = false;
            console.log('🔇 Stopping soil synth (stable)');
            
            if (this.soilLoop) {
                this.soilLoop.stop();
                this.soilLoop.dispose();
                this.soilLoop = null;
            }
            
            if (Tone.Transport.state === 'started') {
                Tone.Transport.stop();
                Tone.Transport.cancel();
            }
        }
    }
    
    // Debug methods
    getStatus() {
        return {
            isActive: this.isActive,
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            currentValue: this.currentValue,
            smoothedValue: this.getSmoothedValue(),
            bufferSize: this.valueBuffer.length,
            connectionBuffer: this.connectionBuffer.length,
            lastDataTime: this.lastDataTime,
            timeSinceLastData: Date.now() - this.lastDataTime
        };
    }
    
    forceDisconnectDebug() {
        this.forceDisconnect();
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.soilHandler = new SoilHandler();
    
    // Debug in console
    console.log('🧪 Debug: window.soilHandler.getStatus() - Enhanced stable connection');
});