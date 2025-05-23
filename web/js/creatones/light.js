// light.js - ESP32 Light State Handler
// STABLE CONNECTION: Debounced, permissive, smooth transitions  
// Perfect balance between responsiveness and stability

class LightHandler {
    constructor() {
        this.isActive = false;
        this.isConnected = false;
        this.currentValue = 0;
        this.lastDataTime = 0;
        
        // CONNECTION STABILITY SYSTEM (same as soil)
        this.connectionBuffer = [];
        this.valueBuffer = [];
        this.BUFFER_SIZE = 5;
        this.CONNECTION_DEBOUNCE_MS = 3000;
        this.DATA_TIMEOUT_MS = 8000; // More permissive!
        
        // HYSTERESIS THRESHOLDS for light sensor
        this.ACTIVATE_THRESHOLD_LOW = 0.25;   // Easier to activate
        this.ACTIVATE_THRESHOLD_HIGH = 0.95;  // Easier to activate  
        this.DEACTIVATE_THRESHOLD_LOW = 0.15; // Harder to deactivate
        this.DEACTIVATE_THRESHOLD_HIGH = 1.05; // Harder to deactivate
        
        // Tone.js components
        this.lightSynth = null;
        this.lightReverb = null;
        this.lightLoop = null;
        this.isPlaying = false;
        
        // DOM elements
        this.frameBackground = null;
        this.lightCreature = null;
        
        // Timeouts
        this.dataTimeout = null;
        this.connectionDebounceTimeout = null;
        
        this.init();
    }
    
    async init() {
        console.log('💡 Light handler initializing with stable connection system...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.lightCreature = document.querySelector('.light-creature');
        
        // Initialize Tone.js
        await this.initializeLightSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('✅ Light handler ready - stable & smooth!');
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
            console.log('🎵 Light synth initialized');
            
        } catch (error) {
            console.error('❌ Light synth initialization failed:', error);
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
                
                // Listen for reconnection
                window.creatoneWS.on('connected', () => this.handleReconnection());
                
                console.log('🔌 Light handler connected with stability system');
            } else {
                setTimeout(connect, 100);
            }
        };
        connect();
    }
    
    processSensorData(data) {
        // Only handle light sensors
        if (!this.isLightData(data)) return;
        
        const value = data.light || data.voltage || 0;
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
                console.log('⚠️ Light sensor timeout (8s) - assuming disconnected');
                this.handleDataTimeout();
            }, this.DATA_TIMEOUT_MS);
            
            // Get smoothed value and check creature activation
            const smoothedValue = this.getSmoothedValue();
            console.log(`💡 Light: ${value.toFixed(3)} (avg: ${smoothedValue.toFixed(3)})`);
            
            // Use hysteresis for creature activation/deactivation
            this.updateCreatureState(smoothedValue);
        }
    }
    
    checkStableConnection() {
        // Same stability logic as soil handler
        const now = Date.now();
        const recentReadings = this.connectionBuffer.filter(
            reading => (now - reading.timestamp) < this.CONNECTION_DEBOUNCE_MS
        );
        
        if (recentReadings.length >= this.BUFFER_SIZE) {
            const values = recentReadings.map(r => r.value);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
            
            // Stable if average variance is low and in reasonable range
            return variance < 0.01 && avg >= 0.0 && avg <= 1.2;
        }
        
        return false;
    }
    
    getSmoothedValue() {
        if (this.valueBuffer.length === 0) return 0;
        return this.valueBuffer.reduce((a, b) => a + b, 0) / this.valueBuffer.length;
    }
    
    handleStableConnection() {
        console.log('🔌✅ Light ESP32 STABLE connection established');
        this.isConnected = true;
        
        // Show background immediately when stable connection
        if (this.frameBackground) {
            this.frameBackground.classList.add('light');
            console.log('🖼️ Light background activated (stable)');
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
        console.log('👾 Light creature appearing (stable)');
        
        // Show creature with smooth transition
        if (this.lightCreature) {
            this.lightCreature.classList.add('active');
        }
        
        // Play synth
        this.playLightSynth(value);
    }
    
    updateCreature(value) {
        this.currentValue = value;
        // Update synth parameters smoothly
        this.updateLightSynth(value);
    }
    
    hideCreature() {
        if (this.isActive) {
            this.isActive = false;
            console.log('👻 Light creature hiding (out of stable range)');
            
            // Hide creature but keep background (ESP32 still connected)
            if (this.lightCreature) {
                this.lightCreature.classList.remove('active');
            }
            
            // Stop synth
            this.stopLightSynth();
        }
    }
    
    isLightData(data) {
        return data.sensor && (
            data.sensor.toLowerCase().includes('light') ||
            data.light !== undefined
        );
    }
    
    handleDisconnection(data) {
        console.log('🔌❌ Light ESP32 disconnected:', data?.name || 'Unknown');
        this.forceDisconnect();
    }
    
    handleGeneralDisconnection() {
        console.log('🔌❌ WebSocket lost - light handler stopping');
        this.forceDisconnect();
    }
    
    handleReconnection() {
        console.log('🔌🔄 WebSocket reconnected - light handler ready');
        // Clear buffers for fresh start
        this.connectionBuffer = [];
        this.valueBuffer = [];
    }
    
    handleDataTimeout() {
        console.log('⏰ Light data timeout (8s) - assuming disconnected');
        this.forceDisconnect();
    }
    
    forceDisconnect() {
        console.log('🛑 Force disconnecting light handler');
        
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
            this.frameBackground.classList.remove('light', 'active');
        }
        if (this.lightCreature) {
            this.lightCreature.classList.remove('active');
        }
        
        // Stop synth immediately
        this.stopLightSynth();
        
        console.log('🏁 Light handler fully disconnected (stable)');
        
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
        window.dispatchEvent(new CustomEvent('lightDisconnected', {
            detail: { timestamp: Date.now() }
        }));
    }
    
    async playLightSynth(value) {
        if (!this.lightSynth || !this.isConnected) return;
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        if (!this.isPlaying) {
            this.startLightLoop(value);
        } else {
            this.updateLightSynth(value);
        }
    }
    
    startLightLoop(value) {
        console.log('🎼 Starting light synth loop (stable)');
        
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
    }
    
    updateLightSynth(value) {
        if (!this.lightSynth || !this.lightLoop || !this.isConnected) return;
        
        // Smooth parameter updates
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
            console.log('🔇 Stopping light synth (stable)');
            
            if (this.lightLoop) {
                this.lightLoop.stop();
                this.lightLoop.dispose();
                this.lightLoop = null;
            }
            
            if (Tone.Transport.state === 'started') {
                Tone.Transport.stop();
                Tone.Transport.cancel();
            }
        }
    }
    
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
    window.lightHandler = new LightHandler();
    
    // Debug in console
    console.log('🧪 Debug: window.lightHandler.getStatus() - Enhanced stable connection');
});