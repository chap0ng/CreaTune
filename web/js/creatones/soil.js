// soil.js - Soil sensor audio and visual handler

class SoilHandler {
    constructor() {
        this.isActive = false;
        this.soilSynth = null;
        this.soilLoop = null;
        this.currentValue = 0.5;
        
        this.initializeTone();
        this.initializeEventListeners();
    }
    
    async initializeTone() {
        // Create soil-specific synth with woody/earthy tones
        this.soilSynth = new Tone.PolySynth(Tone.FMSynth, {
            harmonicity: 2.5,
            modulationIndex: 20,
            oscillator: { type: "triangle" },
            envelope: {
                attack: 0.05,
                decay: 0.6,
                sustain: 0.2,
                release: 1.2
            },
            modulation: { type: "square" },
            modulationEnvelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.1,
                release: 0.6
            }
        });
        
        // Create reverb for soil synth
        const soilReverb = new Tone.Reverb({
            decay: 2.5,
            wet: 0.3,
            preDelay: 0.2
        }).toDestination();
        
        await soilReverb.generate();
        this.soilSynth.connect(soilReverb);
        this.soilSynth.volume.value = -8;
        
        console.log('Soil synth initialized');
    }
    
    initializeEventListeners() {
        // Listen for soil sensor activation
        document.addEventListener('soilAudioTrigger', (e) => {
            if (this.isActive) {
                this.triggerSoilSound(e.detail.value);
            }
        });
        
        // Listen for mode changes
        document.addEventListener('modeEnter_soil', () => {
            this.activateSoilMode();
        });
        
        document.addEventListener('modeExit_soil', () => {
            this.deactivateSoilMode();
        });
        
        // Listen for multi-sensor modes that include soil
        document.addEventListener('modeEnter_growth', () => {
            this.activateSoilMode();
        });
        
        document.addEventListener('modeEnter_mirrage', () => {
            this.activateSoilMode();
        });
        
        document.addEventListener('modeEnter_total', () => {
            this.activateSoilMode();
        });
        
        // Deactivate on websocket disconnect
        document.addEventListener('websocketDisconnected', () => {
            this.deactivateSoilMode();
        });
    }
    
    async activateSoilMode() {
        if (this.isActive) return;
        
        await Tone.start();
        this.isActive = true;
        
        // Start ambient soil loop
        this.startSoilLoop();
        
        console.log('Soil mode activated');
    }
    
    deactivateSoilMode() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.stopSoilLoop();
        
        console.log('Soil mode deactivated');
    }
    
    startSoilLoop() {
        if (this.soilLoop) return;
        
        // Create ambient soil rhythm pattern using Part instead of Loop
        const soilNotes = ["C3", "Eb3", "G3", "Bb3", "D4", "F4"];
        let noteIndex = 0;
        
        // Create timed events for soil pattern
        const soilPattern = [];
        for (let i = 0; i < 8; i++) {
            soilPattern.push([i * 0.5, soilNotes[i % soilNotes.length]]);
        }
        
        this.soilLoop = new Tone.Part((time, note) => {
            if (this.isActive) {
                this.soilSynth.triggerAttackRelease(note, "4n", time);
            }
        }, soilPattern);
        
        this.soilLoop.loop = true;
        this.soilLoop.loopEnd = "4m"; // 4 measures
        this.soilLoop.start(0);
        
        // Set tempo based on current value
        Tone.Transport.bpm.value = 40 + (this.currentValue * 30); // 40-70 BPM
        
        // Start transport only if not already running
        if (Tone.Transport.state !== "started") {
            Tone.Transport.start();
        }
    }
    
    stopSoilLoop() {
        if (this.soilLoop) {
            this.soilLoop.stop();
            this.soilLoop.dispose();
            this.soilLoop = null;
        }
        
        // Only stop transport if no other modes are active
        const status = window.ESP32Status?.getStatus();
        if (status?.connectedCount <= 1) {
            Tone.Transport.stop();
        }
    }
    
    triggerSoilSound(value) {
        this.currentValue = value;
        
        // Update synth parameters based on moisture level
        this.soilSynth.set({
            harmonicity: 1.5 + (value * 2),
            modulationIndex: 10 + (value * 15),
            volume: -12 + (value * 4)
        });
        
        // Update tempo
        Tone.Transport.bpm.value = 40 + (value * 30);
        
        // Trigger reactive note based on value range
        let note;
        if (value < 0.5) note = "C3";
        else if (value < 0.6) note = "Eb3";
        else if (value < 0.7) note = "G3";
        else note = "Bb3";
        
        this.soilSynth.triggerAttackRelease(note, "8n");
        
        // Enhanced creature animation
        this.animateCreature();
    }
    
    animateCreature() {
        const soilCreature = document.querySelector('.soil-creature');
        if (!soilCreature) return;
        
        // Add reaction class
        soilCreature.classList.add('creature-reacting');
        
        // Add moisture-based glow effect
        const intensity = Math.min(1, this.currentValue * 1.5);
        soilCreature.style.filter = `brightness(${1 + intensity * 0.3}) saturate(${1 + intensity * 0.5})`;
        
        setTimeout(() => {
            soilCreature.classList.remove('creature-reacting');
            soilCreature.style.filter = '';
        }, 600);
    }
}

// Initialize soil handler
document.addEventListener('DOMContentLoaded', () => {
    window.soilHandler = new SoilHandler();
});

// Global API
window.SoilHandler = {
    isActive: () => window.soilHandler?.isActive || false,
    getCurrentValue: () => window.soilHandler?.currentValue || 0,
    activate: () => window.soilHandler?.activateSoilMode(),
    deactivate: () => window.soilHandler?.deactivateSoilMode()
};