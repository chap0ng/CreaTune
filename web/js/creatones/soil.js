// soil.js
// CLEAN HANDLER - Simple audio enable button

class SoilHandler {
    constructor() {
        // Simple on/off states
        this.isConnected = false;
        this.isPlaying = false;
        this.audioContextReady = false;
        
        // Visual states
        this.backgroundShown = false;
        this.creatureShown = false;
        this.audioPlaying = false;
        
        // Audio components
        this.synth = null;
        this.reverb = null;
        this.filter = null;
        
        // DOM elements
        this.frameBackground = null;
        this.soilCreature = null;
        
        // Musical scale - Higher octave for toy piano brightness
        this.melancholicScale = [
            'C4', 'D4', 'E4', 'G4', 'A4',    
            'C5', 'D5', 'E5', 'G5', 'A5',    
            'F4', 'B4', 'F5', 'B5'           
        ];
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Initializing Clean Soil Handler...');
        
        await this.waitForDependencies();
        this.setupAudio();
        
        // Get DOM elements
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        if (!this.frameBackground) {
            console.warn('⚠️  .framebackground element not found');
        }
        if (!this.soilCreature) {
            console.warn('⚠️  .soil-creature element not found');
        }
        
        this.setupWebSocketListener();
        
        // ✅ Create simple audio enable button
        this.createAudioEnableButton();
        
        console.log('🌱✅ Clean Soil Handler ready');
    }
    
    async waitForDependencies() {
        while (typeof Tone === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        while (!window.creatune) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    async setupAudio() {
        try {
            // ✅ TOY PIANO SOUND - Bright, metallic, bell-like
            this.synth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 8,      
                modulationIndex: 25, 
                oscillator: {
                    type: "sine"
                },
                envelope: {
                    attack: 0.001,   
                    decay: 0.4,      
                    sustain: 0.1,    
                    release: 1.2     
                },
                modulation: {
                    type: "square"   
                },
                modulationEnvelope: {
                    attack: 0.01,
                    decay: 0.2,
                    sustain: 0,      
                    release: 0.2
                }
            });
            
            // ✅ LIGHTER REVERB - Toy pianos don't have much reverb
            this.reverb = new Tone.Reverb({
                decay: 2.0,      
                wet: 0.3         
            });
            
            // ✅ HIGH-PASS FILTER - Remove muddy low frequencies
            this.filter = new Tone.Filter({
                frequency: 200,  
                type: "highpass"
            });
            
            // Connect: synth -> filter -> reverb -> output
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            
            this.synth.volume.value = -8;
            
            console.log('🎵 Toy piano setup complete');
        } catch (error) {
            console.error('❌ Toy piano setup failed:', error);
        }
    }
    
    // ✅ CREATE SIMPLE AUDIO ENABLE BUTTON
    createAudioEnableButton() {
        const button = document.createElement('button');
        button.id = 'audio-enable-btn';
        button.innerHTML = '🎵';
        
        // ✅ Subtle styling - slightly darker than background
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background-color: rgba(45, 49, 66, 0.1);
            color: var(--dark-slate);
            font-size: 16px;
            cursor: pointer;
            z-index: 1000;
            opacity: 0.7;
            transition: all 0.3s ease;
            font-family: 'VT323', monospace;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // ✅ Hover effect
        button.onmouseenter = () => {
            button.style.opacity = '1';
            button.style.backgroundColor = 'rgba(45, 49, 66, 0.2)';
            button.style.transform = 'scale(1.1)';
        };
        
        button.onmouseleave = () => {
            if (!this.audioContextReady) {
                button.style.opacity = '0.7';
                button.style.backgroundColor = 'rgba(45, 49, 66, 0.1)';
                button.style.transform = 'scale(1)';
            }
        };
        
        // ✅ Click to enable audio
        button.onclick = async () => {
            try {
                console.log('🎵 Enabling audio context...');
                await Tone.start();
                
                this.audioContextReady = true;
                console.log('✅ Audio enabled - ESP32 can now control music');
                
                // ✅ Update button to show audio is ready
                button.innerHTML = '✓';
                button.style.backgroundColor = 'rgba(142, 164, 125, 0.3)';
                button.style.color = 'var(--sage-green)';
                button.style.opacity = '1';
                button.style.cursor = 'default';
                
                // ✅ Fade out button after 2 seconds
                setTimeout(() => {
                    button.style.opacity = '0';
                    button.style.pointerEvents = 'none';
                }, 2000);
                
            } catch (error) {
                console.error('❌ Failed to enable audio:', error);
                button.innerHTML = '❌';
                button.style.backgroundColor = 'rgba(230, 105, 90, 0.3)';
            }
        };
        
        document.body.appendChild(button);
        console.log('🎵 Audio enable button created (top-right corner)');
    }
    
    setupWebSocketListener() {
        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') {
                this.handleSoilConnected();
            }
        });
        
        window.creatune.on('stateChange', (deviceType, stateData) => {
            if (deviceType === 'soil') {
                this.handleSoilStateChange(stateData);
            }
        });
        
        window.creatune.on('disconnected', (deviceType) => {
            if (deviceType === 'soil') {
                this.handleSoilDisconnected();
            }
        });
        
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') {
                console.log(`🌱 Raw data: ${data.soil_condition || data.moisture_app_value}`);
            }
        });
    }
    
    handleSoilConnected() {
        if (this.isConnected) return;
        
        this.isConnected = true;
        console.log('🌱 ✅ SOIL CONNECTED - showing background');
        this.showBackground();
    }
    
    handleSoilStateChange(stateData) {
        console.log(`🌱 🔄 SOIL STATE CHANGE: ${stateData.previousState} → ${stateData.active}`);
        console.log(`🌱 📊 Raw condition: ${stateData.rawData.soil_condition || stateData.rawData.moisture_app_value}`);
        
        if (stateData.active && !this.isPlaying) {
            console.log('🌱 ▶️  ESP32 ACTIVATION - soil is active (humid/wet)');
            this.turnOn();
        } else if (!stateData.active && this.isPlaying) {
            console.log('🌱 ⏹️  ESP32 DEACTIVATION - soil is inactive (dry)');
            this.turnOff();
        } else {
            console.log(`🌱 ➡️  No change needed (already ${this.isPlaying ? 'ON' : 'OFF'})`);
        }
    }
    
    handleSoilDisconnected() {
        if (!this.isConnected) return;
        
        console.log('🌱 ❌ SOIL DISCONNECTED - cleaning up');
        
        this.isConnected = false;
        this.hideBackground();
        if (this.isPlaying) {
            this.turnOff();
        }
    }
    
    turnOn() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        console.log('🌱 ✅ ESP32 TURNING ON - creature + music');
        
        this.showCreature();
        this.startMusic();
    }
    
    turnOff() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        console.log('🌱 ❌ ESP32 TURNING OFF - creature + music');
        
        this.hideCreature();
        this.stopMusic();
    }
    
    showBackground() {
        if (this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.add('soil-background');
            this.backgroundShown = true;
            console.log('🌱 🎨 Background shown');
        }
    }
    
    hideBackground() {
        if (!this.backgroundShown) return;
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false;
            console.log('🌱 🎨 Background hidden');
        }
    }
    
    showCreature() {
        if (this.creatureShown) return;
        
        if (this.soilCreature) {
            this.soilCreature.classList.add('active');
            this.soilCreature.style.display = 'block';
            this.creatureShown = true;
            console.log('🌱 🦎 Creature shown');
        }
    }
    
    hideCreature() {
        if (!this.creatureShown) return;
        
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            this.creatureShown = false;
            console.log('🌱 🦎 Creature hidden');
        }
    }
    
    async startMusic() {
        if (this.audioPlaying) return;
        
        if (!this.synth) {
            console.error('❌ No synth available');
            return;
        }
        
        // ✅ Check if audio context is ready
        if (!this.audioContextReady || Tone.context.state !== 'running') {
            console.warn('⚠️  Audio context not ready - user needs to click audio button first');
            return;
        }
        
        this.audioPlaying = true;
        console.log('🌱 🎹 ESP32 activated music - starting toy piano');
        
        this.playNote();
    }
    
    stopMusic() {
        if (!this.audioPlaying) return;
        
        this.audioPlaying = false;
        console.log('🌱 🎹 ESP32 deactivated music - stopping toy piano');
        
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
    
    // ✅ SIMPLE MUSIC PATTERN
    playNote() {
        if (!this.audioPlaying || !this.synth) return;
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        
        console.log(`🎹 Playing: ${note}`);
        this.synth.triggerAttackRelease(note, '4n');
        
        // Schedule next note
        setTimeout(() => {
            if (this.audioPlaying) {
                this.playNote();
            }
        }, 2000); // 2 seconds between notes
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Starting Clean Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}