/* soil.js - ESP32 soil sensor synth and creature controller */

class SoilSynth {
    constructor() {
        this.isActive = false;
        this.synth = null;
        this.sequence = null;
        this.currentSoilData = null;
        this.backgroundElement = null;
        this.creatureElement = null;
        
        // Musical scales based on moisture levels
        this.scales = {
            dry: ['C4', 'D4', 'E4', 'G4', 'A4'], // Pentatonic - sparse, dry
            humid: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'], // Major scale - balanced
            wet: ['C4', 'Eb4', 'F4', 'G4', 'Bb4', 'C5'] // Blues scale - rich, flowing
        };
        
        this.initializeToneJS();
        this.initializeEventListeners();
        this.findDOMElements();
    }
    
    async initializeToneJS() {
        try {
            // Create soil-specific synth with organic sound
            this.synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: "sawtooth"
                },
                envelope: {
                    attack: 0.1,
                    decay: 0.3,
                    sustain: 0.4,
                    release: 0.8
                },
                filter: {
                    frequency: 1000,
                    rolloff: -12
                }
            }).toDestination();
            
            // Add some reverb for organic feel
            const reverb = new Tone.Reverb(2).toDestination();
            this.synth.connect(reverb);
            
            console.log("🎵 Soil synth initialized");
            
        } catch (error) {
            console.error("Failed to initialize Tone.js:", error);
        }
    }
    
    initializeEventListeners() {
        // Listen for ESP32 status changes
        document.addEventListener('esp32StatusChange', (e) => {
            this.handleStatusChange(e.detail);
        });
        
        // Listen for soil sensor data
        document.addEventListener('soilDataProcessed', (e) => {
            this.handleSoilData(e.detail);
        });
        
        // Listen for mode changes specifically to soil mode
        document.addEventListener('modeChange_soil', (e) => {
            console.log("🌱 Soil mode activated");
            this.activateSoilMode();
        });
        
        // Listen for mode changes away from soil
        document.addEventListener('esp32StatusChange', (e) => {
            if (e.detail.mode !== 'soil' && this.isActive) {
                console.log("🌱 Soil mode deactivated");
                this.deactivateSoilMode();
            }
        });
    }
    
    findDOMElements() {
        this.backgroundElement = document.querySelector('.framebackground');
        
        // Create soil creature element if it doesn't exist
        this.creatureElement = document.querySelector('.soil-creature');
        if (!this.creatureElement) {
            this.creatureElement = document.createElement('div');
            this.creatureElement.className = 'soil-creature';
            document.querySelector('.frameidle').appendChild(this.creatureElement);
        }
    }
    
    handleStatusChange(status) {
        if (status.mode === 'soil' && status.connections.esp1) {
            this.activateSoilMode();
        } else if (status.mode !== 'soil') {
            this.deactivateSoilMode();
        }
    }
    
    handleSoilData(data) {
        this.currentSoilData = data;
        console.log("🌱 Soil data received:", data);
        
        if (this.isActive) {
            this.updateSynthParameters(data);
            this.updateCreatureState(data);
        }
    }
    
    activateSoilMode() {
        if (this.isActive) return;
        
        console.log("🌱 Soil active");
        this.isActive = true;
        
        // Activate soil background
        if (this.backgroundElement) {
            this.backgroundElement.classList.add('soil-background');
        }
        
        // Start audio context if needed
        if (Tone.context.state !== 'running') {
            document.addEventListener('click', this.startAudioContext.bind(this), { once: true });
            document.addEventListener('touchstart', this.startAudioContext.bind(this), { once: true });
        } else {
            this.startSoilSynth();
        }
    }
    
    async startAudioContext() {
        try {
            await Tone.start();
            console.log("🎵 Audio context started");
            this.startSoilSynth();
        } catch (error) {
            console.error("Failed to start audio context:", error);
        }
    }
    
    startSoilSynth() {
        if (!this.synth || this.sequence) return;
        
        console.log("🎵 Starting soil synth");
        
        // Create sequence that plays based on soil data
        this.sequence = new Tone.Sequence((time, note) => {
            if (this.currentSoilData) {
                this.playNote(time, note);
            }
        }, this.getCurrentScale(), "8n").start(0);
        
        // Start transport
        Tone.Transport.start();
        
        // Update sequence every few seconds
        this.updateInterval = setInterval(() => {
            this.updateSequence();
        }, 3000);
    }
    
    updateSequence() {
        if (!this.sequence || !this.currentSoilData) return;
        
        const scale = this.getCurrentScale();
        const pattern = this.generatePattern(this.currentSoilData);
        
        this.sequence.events = pattern;
    }
    
    getCurrentScale() {
        if (!this.currentSoilData) return this.scales.dry;
        
        const condition = this.currentSoilData.soil_condition;
        return this.scales[condition] || this.scales.dry;
    }
    
    generatePattern(data) {
        const scale = this.getCurrentScale();
        const moisture = data.moisture_percent || 0;
        
        // Generate pattern based on moisture level
        const patternLength = Math.max(3, Math.floor(moisture / 20) + 2);
        const pattern = [];
        
        for (let i = 0; i < patternLength; i++) {
            const noteIndex = Math.floor((moisture + i * 10) % scale.length);
            pattern.push(scale[noteIndex]);
        }
        
        return pattern;
    }
    
    playNote(time, note) {
        if (!this.synth || !this.currentSoilData) return;
        
        // Modulate volume based on moisture
        const moisture = this.currentSoilData.moisture_percent || 0;
        const volume = -20 + (moisture / 100) * 15; // -20dB to -5dB
        
        this.synth.volume.value = volume;
        
        // Play note with slight randomization
        const duration = Math.random() * 0.3 + 0.2; // 0.2-0.5 seconds
        this.synth.triggerAttackRelease(note, duration, time);
    }
    
    updateSynthParameters(data) {
        if (!this.synth) return;
        
        const moisture = data.moisture_percent || 0;
        
        // Update filter frequency based on moisture
        const filterFreq = 300 + (moisture / 100) * 1700; // 300Hz to 2000Hz
        this.synth.filter.frequency.value = filterFreq;
        
        // Update tempo based on soil condition
        const bpm = this.getBPMForCondition(data.soil_condition);
        Tone.Transport.bpm.value = bpm;
    }
    
    getBPMForCondition(condition) {
        switch (condition) {
            case 'dry': return 60; // Slow, struggling
            case 'humid': return 90; // Moderate, healthy
            case 'wet': return 120; // Fast, flowing
            default: return 75;
        }
    }
    
    updateCreatureState(data) {
        if (!this.creatureElement) return;
        
        const moisture = data.moisture_percent || 0;
        
        // Show creature when moisture is in good range
        if (moisture > 20 && moisture < 80) {
            console.log("🌱 Soil creature found");
            this.creatureElement.classList.add('active');
        } else {
            this.creatureElement.classList.remove('active');
        }
        
        // Adjust animation speed based on moisture
        const animationDuration = Math.max(1, 3 - (moisture / 50)); // 1-3 seconds
        this.creatureElement.style.animationDuration = `${animationDuration}s`;
    }
    
    deactivateSoilMode() {
        if (!this.isActive) return;
        
        console.log("🌱 Soil not active");
        this.isActive = false;
        
        // Remove soil background
        if (this.backgroundElement) {
            this.backgroundElement.classList.remove('soil-background');
        }
        
        // Hide creature
        if (this.creatureElement) {
            this.creatureElement.classList.remove('active');
        }
        
        // Stop synth
        this.stopSoilSynth();
    }
    
    stopSoilSynth() {
        if (this.sequence) {
            this.sequence.stop();
            this.sequence.dispose();
            this.sequence = null;
        }
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // Stop transport if no other sequences are running
        Tone.Transport.stop();
        
        console.log("🎵 Soil synth stopped");
    }
    
    // Public methods for testing
    test() {
        console.log("🧪 Testing soil synth");
        
        // Simulate soil data
        const testData = {
            moisture_percent: 45,
            soil_condition: 'humid',
            raw_value: 500,
            moisture_app_value: 0.45
        };
        
        this.handleSoilData(testData);
        this.activateSoilMode();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load Tone.js if not already loaded
    if (typeof Tone === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
        script.onload = () => {
            window.soilSynth = new SoilSynth();
            console.log("🌱 Soil synth ready");
        };
        document.head.appendChild(script);
    } else {
        window.soilSynth = new SoilSynth();
        console.log("🌱 Soil synth ready");
    }
    
    // Make test function available globally
    window.testSoil = () => window.soilSynth?.test();
});