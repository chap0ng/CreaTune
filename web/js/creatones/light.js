// light.js - ESP32 Light State Handler
// ULTRA PERMISSIVE: Very slow to disconnect, very fast to connect
// Same ultra-forgiving approach as soil handler

class LightHandler {
    constructor() {
        this.isActive = false;
        this.isConnected = false;
        this.currentValue = 0;
        this.lastDataTime = 0;
        
        // ULTRA PERMISSIVE CONNECTION SYSTEM (same as soil)
        this.connectionBuffer = [];
        this.valueBuffer = [];
        this.BUFFER_SIZE = 2; // Only need 2 readings!
        this.CONNECTION_DEBOUNCE_MS = 1000; // Only 1 second
        this.DATA_TIMEOUT_MS = 10000; // 10 SECONDS before disconnect
        
        // VERY PERMISSIVE HYSTERESIS for light sensor
        this.ACTIVATE_THRESHOLD_LOW = 0.1;   // Very easy to activate
        this.ACTIVATE_THRESHOLD_HIGH = 0.95; // Very easy to activate  
        this.DEACTIVATE_THRESHOLD_LOW = 0.05; // Very hard to deactivate
        this.DEACTIVATE_THRESHOLD_HIGH = 1.0; // Very hard to deactivate
        
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
        console.log('💡 Light handler initializing - ULTRA PERMISSIVE mode...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.lightCreature = document.querySelector('.light-creature');
        
        // Initialize Tone.js
        await this.initializeLightSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('✅ Light handler ready - very patient with ESP32!');
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
                
                console.log('🔌 Light handler connected - ultra permissive mode');
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
        
        console.log(`💡 ESP32 Light data received: ${value.toFixed(3)} (${new Date().toLocaleTimeString()})`);
        
        // IMMEDIATE CONNECTION - no waiting for buffers
        if (!this.isConnected) {
            console.log('🔌✅ Light ESP32 connecting IMMEDIATELY (ultra permissive)');
            this.isConnected = true;
            
            // Show background immediately
            if (this.frameBackground) {
                this.frameBackground.classList.add('light');
                console.log('🖼️ Light background activated immediately');
            }
        }
        
        // Add to buffers for smoothing (but don't require them)
        this.connectionBuffer.push({ value, timestamp });
        if (this.connectionBuffer.length > this.BUFFER_SIZE) {
            this.connectionBuffer.shift();
        }
        
        this.valueBuffer.push(value);
        if (this.valueBuffer.length > this.BUFFER_SIZE) {
            this.valueBuffer.shift();
        }
        
        // Update connection state and reset timeout
        this.lastDataTime = timestamp;
        
        // Clear any existing timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
        }
        
        // Set VERY LONG timeout - 30 seconds!
        this.dataTimeout = setTimeout(() => {
            console.log('⚠️ Light sensor timeout (30s) - disconnecting reluctantly');
            this.handleDataTimeout();
        }, this.DATA_TIMEOUT_MS);
        
        // Get smoothed value (or use raw if not enough data)
        const smoothedValue = this.getSmoothedValue() || value;
        
        // Use VERY permissive thresholds
        this.updateCreatureState(smoothedValue);
    }
    
    getSmoothedValue() {
        if (this.valueBuffer.length === 0) return null;
        return this.valueBuffer.reduce((a, b) => a + b, 0) / this.valueBuffer.length;
    }
    
    updateCreatureState(smoothedValue) {
        // ULTRA PERMISSIVE: Almost always show creature if ESP32 connected
        if (!this.isActive) {
            // ACTIVATE: Very easy thresholds
            if (smoothedValue >= this.ACTIVATE_THRESHOLD_LOW && 
                smoothedValue <= this.ACTIVATE_THRESHOLD_HIGH) {
                this.showCreature(smoothedValue);
            }
        } else {
            // DEACTIVATE: Almost never deactivate 
            if (smoothedValue < this.DEACTIVATE_THRESHOLD_LOW || 
                smoothedValue > this.DEACTIVATE_THRESHOLD_HIGH) {
                console.log(`🤔 Light value ${smoothedValue.toFixed(3)} outside range but being very permissive...`);
                // Still keep creature active unless value is REALLY bad
                if (smoothedValue < 0.01 || smoothedValue > 1.1) {
                    this.hideCreature();
                } else {
                    // Keep creature but log warning
                    console.log('💡 Keeping light creature active (permissive mode)');
                    this.updateCreature(smoothedValue);
                }
            } else {
                // Update existing creature
                this.updateCreature(smoothedValue);
            }
        }
    }
    
    showCreature(value) {
        this.currentValue = value;
        this.isActive = true;
        console.log('👾 Light creature appearing (ultra permissive)');
        
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
            console.log('👻 Light creature hiding (finally out of range)');
            
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
        console.log('🔌❌ Light ESP32 explicitly disconnected:', data?.name || 'Unknown');
        this.forceDisconnect();
    }
    
    handleGeneralDisconnection() {
        console.log('🔌❌ WebSocket lost - light handler stopping');
        this.forceDisconnect();
    }
    
    handleReconnection() {
        console.log('🔌🔄 WebSocket reconnected - light handler ready');
        // Clear buffers but stay permissive
        this.connectionBuffer = [];
        this.valueBuffer = [];
    }
    
    handleDataTimeout() {
        const timeSinceLastData = Date.now() - this.lastDataTime;
        console.log(`⏰ Light data timeout after ${Math.round(timeSinceLastData/1000)}s - disconnecting`);
        this.forceDisconnect();
    }
    
    forceDisconnect() {
        console.log('🛑 Force disconnecting light handler (after being very patient)');
        
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
        
        console.log('🏁 Light handler fully disconnected (ultra permissive mode)');
        
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
        console.log('🎼 Starting light synth loop (ultra permissive)');
        
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
            console.log('🔇 Stopping light synth (ultra permissive)');
            
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
    
    // Enhanced debug methods
    getStatus() {
        const timeSinceLastData = this.lastDataTime ? Date.now() - this.lastDataTime : 0;
        return {
            isActive: this.isActive,
            isConnected: this.isConnected,
            isPlaying: this.isPlaying,
            currentValue: this.currentValue,
            smoothedValue: this.getSmoothedValue(),
            bufferSize: this.valueBuffer.length,
            connectionBuffer: this.connectionBuffer.length,
            lastDataTime: new Date(this.lastDataTime).toLocaleTimeString(),
            timeSinceLastData: `${Math.round(timeSinceLastData/1000)}s`,
            timeoutRemaining: `${Math.round((this.DATA_TIMEOUT_MS - timeSinceLastData)/1000)}s`,
            thresholds: {
                activate: `${this.ACTIVATE_THRESHOLD_LOW} - ${this.ACTIVATE_THRESHOLD_HIGH}`,
                deactivate: `${this.DEACTIVATE_THRESHOLD_LOW} - ${this.DEACTIVATE_THRESHOLD_HIGH}`
            }
        };
    }
    
    // Show detailed connection info
    getConnectionInfo() {
        console.log('🔍 Light Handler Connection Info:');
        console.log(`📊 Status: ${this.isConnected ? '🟢 Connected' : '🔴 Disconnected'}`);
        console.log(`🎵 Audio: ${this.isPlaying ? '🟢 Playing' : '🔴 Silent'}`);
        console.log(`👾 Creature: ${this.isActive ? '🟢 Active' : '🔴 Hidden'}`);
        console.log(`📈 Current Value: ${this.currentValue.toFixed(3)}`);
        console.log(`📊 Smoothed Value: ${this.getSmoothedValue()?.toFixed(3) || 'N/A'}`);
        console.log(`⏰ Last Data: ${this.lastDataTime ? new Date(this.lastDataTime).toLocaleTimeString() : 'Never'}`);
        console.log(`⌛ Timeout: 30 seconds (ultra permissive)`);
        console.log(`🎯 Thresholds: Very permissive (0.1-0.95 activate, 0.05-1.0 stay active)`);
    }
    
    forceDisconnectDebug() {
        this.forceDisconnect();
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.lightHandler = new LightHandler();
    
    // Enhanced debug commands
    console.log('🧪 Enhanced Light Debug Commands:');
    console.log('• window.lightHandler.getStatus() - Basic status');
    console.log('• window.lightHandler.getConnectionInfo() - Detailed info');
    console.log('• window.lightHandler.forceDisconnectDebug() - Test disconnection');
});