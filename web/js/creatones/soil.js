// soil.js - ESP32 Soil State Handler
// Handles soilsynth Tone.js, soil-background & soil-creature
// IMPROVED: Faster transitions, proper background/creature logic, no-refresh disconnection

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.isConnected = false;
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
        
        // Faster timeout for disconnection detection
        this.dataTimeout = null;
        this.DATA_TIMEOUT_MS = 2000; // 2 seconds instead of 5
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Soil handler initializing...');
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        // Initialize Tone.js
        await this.initializeSoilSynth();
        
        // Connect to websocket data
        this.connectToWebSocket();
        
        console.log('✅ Soil handler ready');
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
        // Multiple connection attempts with faster retry
        const connect = () => {
            if (window.creatoneWS) {
                // Listen for soil sensor data
                window.creatoneWS.on('sensor_data', (data) => this.processSensorData(data));
                
                // Listen for soil sensor disconnection
                window.creatoneWS.on('sensor_soil_disconnected', (data) => this.handleDisconnection(data));
                
                // Listen for general disconnection
                window.creatoneWS.on('disconnected', () => this.handleGeneralDisconnection());
                
                // Listen for reconnection to reset state
                window.creatoneWS.on('connected', () => this.handleReconnection());
                
                console.log('🔌 Soil handler connected to websocket');
            } else {
                setTimeout(connect, 50); // Faster retry
            }
        };
        connect();
    }
    
    processSensorData(data) {
        // Only handle soil/moisture sensors
        if (!this.isSoilData(data)) return;
        
        // ESP32 connected - show background immediately
        if (!this.isConnected) {
            this.handleConnection();
        }
        
        // Update connection state and reset timeout
        this.isConnected = true;
        this.lastDataTime = Date.now();
        
        // Clear any existing timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
        }
        
        // Set faster timeout for disconnection detection
        this.dataTimeout = setTimeout(() => {
            console.log('⚠️ Soil sensor timeout - disconnecting');
            this.handleDataTimeout();
        }, this.DATA_TIMEOUT_MS);
        
        const value = data.voltage || data.moisture_app_value || 0;
        console.log(`🌱 Soil: ${value.toFixed(3)}`);
        
        // NEW LOGIC: Creature appears only if data in range (not dry)
        if (value >= 0.4 && value <= 0.8) {
            this.showCreature(value);
        } else {
            this.hideCreature(); // Hide creature but keep background
        }
    }
    
    isSoilData(data) {
        return data.sensor && (
            data.sensor.toLowerCase().includes('moisture') ||
            data.sensor.toLowerCase().includes('soil') ||
            data.soil_condition
        );
    }
    
    handleConnection() {
        console.log('🔌✅ Soil ESP32 connected');
        this.isConnected = true;
        
        // Show background immediately when ESP32 connects
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil');
            console.log('🖼️ Soil background activated');
        }
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
        // Don't auto-activate, wait for ESP32 data
    }
    
    handleDataTimeout() {
        console.log('⏰ Soil data timeout - assuming disconnected');
        this.forceDisconnect();
    }
    
    showCreature(value) {
        this.currentValue = value;
        
        if (!this.isActive) {
            this.isActive = true;
            console.log('👾 Soil creature appearing');
            
            // Show creature with smooth transition
            if (this.soilCreature) {
                this.soilCreature.classList.add('active');
            }
        }
        
        // Play/update soil synth
        this.playSoilSynth(value);
    }
    
    hideCreature() {
        if (this.isActive) {
            this.isActive = false;
            console.log('👻 Soil creature hiding (dry soil)');
            
            // Hide creature but keep background (ESP32 still connected)
            if (this.soilCreature) {
                this.soilCreature.classList.remove('active');
            }
            
            // Stop synth
            this.stopSoilSynth();
        }
    }
    
    forceDisconnect() {
        console.log('🛑 Force disconnecting soil handler');
        
        this.isConnected = false;
        this.isActive = false;
        
        // Clear timeout
        if (this.dataTimeout) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
        
        // Remove ALL visual elements immediately
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil', 'active');
        }
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
        }
        
        // Stop synth immediately
        this.stopSoilSynth();
        
        console.log('🏁 Soil handler fully disconnected');
        
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
        window.dispatchEvent(new CustomEvent('soilDisconnected', {
            detail: { timestamp: Date.now() }
        }));
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
        console.log('🎼 Starting soil synth loop');
        
        // Soil scale for natural sounds
        const soilScale = ["C3", "D3", "F3", "G3", "A3", "C4", "D4", "F4"];
        
        // Create random scale loop
        this.soilLoop = new Tone.Loop((time) => {
            // Check if still connected and active
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
            
            // Stop transport safely
            if (Tone.Transport.state === 'started') {
                Tone.Transport.stop();
                Tone.Transport.cancel();
            }
        }
    }
    
    // Public debug methods
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
    window.soilHandler = new SoilHandler();
    
    // Debug in console
    console.log('🧪 Debug: window.soilHandler.getStatus() to check status');
    console.log('🧪 Debug: window.soilHandler.forceDisconnectDebug() to test disconnection');
});