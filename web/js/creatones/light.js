// light.js - ESP32 Light State Handler
// Handles light synth Tone.js, light-background & light-creature
// IMPROVED: Faster transitions, proper background/creature logic, no-refresh disconnection

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
        
        // Faster timeout for disconnection detection
        this.dataTimeout = null;
        this.DATA_TIMEOUT_MS = 2000; // 2 seconds instead of 5
        
        this.init();
    }
    
    async init() {
        console.log('💡 Light handler initializing...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.lightCreature = document.querySelector('.light-creature');
        
        // Initialize Tone.js
        await this.initializeLightSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('✅ Light handler ready');
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
                
                console.log('🔌 Light handler connected to websocket');
            } else {
                setTimeout(connect, 50); // Faster retry
            }
        };
        connect();
    }
    
    processSensorData(data) {
        // Only handle light sensors
        if (!this.isLightData(data)) return;
        
        // ESP32 connected - show background immediately
        if (!this.isConnected) {
            this.handleConnection();
        }
        
        this.isConnected = true;
        this.lastDataTime = Date.now();
        
        // Clear any existing timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
        }
        
        // Set faster timeout for disconnection detection
        this.dataTimeout = setTimeout(() => {
            console.log('⚠️ Light sensor timeout - disconnecting');
            this.handleDataTimeout();
        }, this.DATA_TIMEOUT_MS);
        
        const value = data.light || data.voltage || 0;
        console.log(`💡 Light: ${value.toFixed(3)}`);
        
        // NEW LOGIC: Creature appears only if data in range (not too dark/bright)
        if (value >= 0.3 && value <= 0.9) {
            this.showCreature(value);
        } else {
            this.hideCreature(); // Hide creature but keep background
        }
    }
    
    isLightData(data) {
        return data.sensor && (
            data.sensor.toLowerCase().includes('light') ||
            data.light !== undefined
        );
    }
    
    handleConnection() {
        console.log('🔌✅ Light ESP32 connected');
        this.isConnected = true;
        
        // Show background immediately when ESP32 connects
        if (this.frameBackground) {
            this.frameBackground.classList.add('light');
            console.log('🖼️ Light background activated');
        }
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
        // Don't auto-activate, wait for ESP32 data
    }
    
    handleDataTimeout() {
        console.log('⏰ Light data timeout - assuming disconnected');
        this.forceDisconnect();
    }
    
    showCreature(value) {
        this.currentValue = value;
        
        if (!this.isActive) {
            this.isActive = true;
            console.log('👾 Light creature appearing');
            
            // Show creature with smooth transition
            if (this.lightCreature) {
                this.lightCreature.classList.add('active');
            }
        }
        
        this.playLightSynth(value);
    }
    
    hideCreature() {
        if (this.isActive) {
            this.isActive = false;
            console.log('👻 Light creature hiding (out of range)');
            
            // Hide creature but keep background (ESP32 still connected)
            if (this.lightCreature) {
                this.lightCreature.classList.remove('active');
            }
            
            this.stopLightSynth();
        }
    }
    
    forceDisconnect() {
        console.log('🛑 Force disconnecting light handler');
        
        this.isConnected = false;
        this.isActive = false;
        
        // Clear timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        
        // Remove ALL visual elements immediately
        if (this.frameBackground) {
            this.frameBackground.classList.remove('light', 'active');
        }
        if (this.lightCreature) {
            this.lightCreature.classList.remove('active');
        }
        
        // Stop synth immediately
        this.stopLightSynth();
        
        console.log('🏁 Light handler fully disconnected');
        
        // Force UI update without refresh
        this.forceUIUpdate();
    }
    
    forceUIUpdate() {
        // Trigger immediate DOM update to avoid refresh requirement
        if (this.frameBackground) {
            this.frameBackground.style.transform = 'translateZ(0)';
            setTimeout(() => {
                this.frameBackground.style.transform = '';
            }, 10);
        }
        
        // Dispatch custom event for other components
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
            this.updateLightLoop(value);
        }
    }
    
    startLightLoop(value) {
        console.log('🎼 Starting light synth loop');
        
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
    console.log('🧪 Debug: window.lightHandler.getStatus() to check status');
    console.log('🧪 Debug: window.lightHandler.forceDisconnectDebug() to test disconnection');
});