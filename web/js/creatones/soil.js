// soil.js
// FIXED - Robust disconnect cleanup + better state management + Tone.js button debug

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
        
        this.cleanupTimeout = null;
        this.lastActivityTime = 0;
        
        this.melancholicScale = [
            'C4', 'D4', 'E4', 'G4', 'A4',    
            'C5', 'D5', 'E5', 'G5', 'A5',    
            'F4', 'B4', 'F5', 'B5'           
        ];
        
        // No init() call in constructor, will be called by DOMContentLoaded
    }
    
    async init() {
        console.log('🌱 Initializing Clean Soil Handler...');
        
        await this.waitForDependencies();

        if (typeof Tone !== 'undefined') {
            console.log('🎵 Tone.js object is loaded and available for SoilHandler.');
        } else {
            console.error('🚨 Tone.js object is NOT available for SoilHandler. Audio features will fail.');
            // Depending on how critical Tone is, you might want to stop further initialization
        }
        
        this.setupAudio();
        
        this.frameBackground = document.querySelector('.framebackground');
        this.soilCreature = document.querySelector('.soil-creature');
        
        if (!this.frameBackground) {
            console.warn('⚠️  .framebackground element not found in SoilHandler init');
        }
        if (!this.soilCreature) {
            console.warn('⚠️  .soil-creature element not found in SoilHandler init');
        }
        
        this.setupWebSocketListener();
        this.createAudioEnableButton(); // Create the button
        
        console.log('🌱✅ Clean Soil Handler ready');
    }
    
    async waitForDependencies() {
        console.log('🌱 Waiting for dependencies (Tone, window.creatune)...');
        let toneWaitCount = 0;
        while (typeof Tone === 'undefined') {
            if (toneWaitCount % 50 === 0) console.log('🌱 ...waiting for Tone.js...');
            await new Promise(resolve => setTimeout(resolve, 100));
            toneWaitCount++;
        }
        console.log('🌱 Tone.js found.');

        let creatuneWaitCount = 0;
        while (!window.creatune) {
            if (creatuneWaitCount % 50 === 0) console.log('🌱 ...waiting for window.creatune (WebSocket client)...');
            await new Promise(resolve => setTimeout(resolve, 100));
            creatuneWaitCount++;
        }
        console.log('🌱 window.creatune found.');
    }
    
    async setupAudio() {
        if (typeof Tone === 'undefined') {
            console.error('❌ Cannot setup audio, Tone is not defined.');
            return;
        }
        try {
            this.synth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 8,      
                modulationIndex: 25, 
                oscillator: { type: "sine" },
                envelope: { attack: 0.001, decay: 0.4, sustain: 0.1, release: 1.2 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
            });
            
            this.reverb = new Tone.Reverb({ decay: 2.0, wet: 0.3 });
            this.filter = new Tone.Filter({ frequency: 200, type: "highpass" });
            
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            this.synth.volume.value = -8;
            
            console.log('🎵 SoilHandler: Toy piano audio setup complete');
        } catch (error) {
            console.error('❌ SoilHandler: Toy piano audio setup failed:', error);
        }
    }
    
    createAudioEnableButton() {
        if (document.getElementById('audio-enable-btn')) {
            console.warn('🎵 Audio enable button already exists. Skipping creation.');
            return;
        }
        console.log('🎵 Creating audio enable button...');

        const button = document.createElement('button');
        button.id = 'audio-enable-btn';
        button.innerHTML = '🎵';
        
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid red; /* Debug: prominent border */
            background-color: yellow; /* Debug: prominent background */
            color: black;
            font-size: 24px;
            cursor: pointer;
            z-index: 20000; /* Very high z-index */
            opacity: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'VT323', monospace;
            box-shadow: 0 0 10px rgba(0,0,0,0.5); /* Debug: shadow */
        `;
        
        button.onmouseenter = () => { button.style.backgroundColor = 'orange'; };
        button.onmouseleave = () => { button.style.backgroundColor = 'yellow'; };
        
        button.onclick = async () => {
            console.log('🎵 Audio enable button clicked.');
            try {
                if (typeof Tone !== 'undefined' && typeof Tone.start === 'function') {
                    await Tone.start();
                    this.audioContextReady = true;
                    console.log('✅ Audio context enabled via button. ESP32 can now control music.');
                    
                    button.innerHTML = '✓';
                    button.style.backgroundColor = 'lightgreen';
                    button.style.color = 'black';
                    button.style.cursor = 'default';
                    
                    setTimeout(() => {
                        if (button.parentElement) { // Check if still in DOM
                           button.remove(); 
                           console.log('🎵 Audio enable button removed after success.');
                        }
                    }, 2000);
                } else {
                    console.error('❌ Tone.start is not available or Tone is undefined. Cannot enable audio.');
                    button.innerHTML = '⚠️';
                    button.style.backgroundColor = 'pink';
                }
            } catch (error) {
                console.error('❌ Failed to enable audio via button:', error);
                button.innerHTML = '❌';
                button.style.backgroundColor = 'red';
            }
        };
        
        document.body.appendChild(button);
        console.log('🎵 Audio enable button appended to body (top-right corner).');
    }
    
    setupWebSocketListener() {
        if (!window.creatune) {
            console.error('🚨 CreaTune WebSocket client (window.creatune) not found in SoilHandler! Cannot set up listeners.');
            return;
        }
        console.log('🌱 SoilHandler: Setting up WebSocket listeners...');

        window.creatune.on('connected', (deviceType) => {
            if (deviceType === 'soil') this.handleSoilConnected();
        });
        
        window.creatune.on('stateChange', (deviceType, stateData) => {
            if (deviceType === 'soil') this.handleSoilStateChange(stateData);
        });
        
        window.creatune.on('disconnected', (deviceType) => {
            console.log(`🌱 SoilHandler received 'disconnected' event for deviceType: ${deviceType}`);
            if (deviceType === 'soil') this.handleSoilDisconnected();
        });
        
        window.creatune.on('data', (deviceType, data) => {
            if (deviceType === 'soil') this.lastActivityTime = Date.now();
        });
        console.log('🌱 SoilHandler: WebSocket listeners set up.');
    }
    
    handleSoilConnected() {
        console.log('🌱 ✅ SOIL CONNECTED - showing background');
        this.isConnected = true;
        this.lastActivityTime = Date.now();
        this.showBackground();
    }
    
    handleSoilStateChange(stateData) {
        console.log(`🌱 🔄 SOIL STATE CHANGE: ${stateData.previousState} → ${stateData.active}`);
        if (stateData.rawData) {
            // console.log(`🌱 📊 Raw data:`, stateData.rawData);
        }
        this.lastActivityTime = Date.now();
        if (stateData.active && !this.isPlaying) this.turnOn();
        else if (!stateData.active && this.isPlaying) this.turnOff();
    }
    
    handleSoilDisconnected() {
        console.log('🌱❌ SOIL DISCONNECTED event received by SoilHandler. Initiating cleanup...');
        if (this.cleanupTimeout) {
            clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = null;
        }
        this.forceCompleteCleanup(); 
        this.isConnected = false;
        console.log('🌱🏁 Soil disconnect handling complete in SoilHandler.');
    }
    
    forceCompleteCleanup() {
        console.log('🌱🧹 SoilHandler: Executing forceCompleteCleanup...');
        if (this.synth) {
            try {
                this.synth.releaseAll();
                console.log('🎹 ✅ Music forcefully stopped via releaseAll() in SoilHandler.');
            } catch (error) {
                console.error('🎹 ❌ Error stopping music with releaseAll() in SoilHandler:', error);
            }
        } else console.warn('🌱🧹 Synth not available in SoilHandler for cleanup.');
        
        this.audioPlaying = false;
        this.isPlaying = false; 
        console.log(`🌱🧹 Music flags set in SoilHandler: audioPlaying=${this.audioPlaying}, isPlaying=${this.isPlaying}`);
        
        if (this.soilCreature) {
            this.soilCreature.classList.remove('active');
            this.soilCreature.style.display = 'none';
            this.creatureShown = false;
            console.log('🦎 ✅ Creature forcefully hidden in SoilHandler.');
        } else console.warn('🌱🧹 Soil creature element not found in SoilHandler for cleanup.');
        
        if (this.frameBackground) {
            this.frameBackground.classList.remove('soil-background');
            this.backgroundShown = false;
            console.log('🎨 ✅ Background class removed in SoilHandler.');
        } else console.warn('🌱🧹 Frame background element not found in SoilHandler for cleanup.');
        
        console.log('🌱✅ SoilHandler: forceCompleteCleanup finished.');
    }
    
    turnOn() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.lastActivityTime = Date.now();
        console.log('🌱 ✅ SoilHandler: TURNING ON - creature + music');
        this.showCreature();
        this.startMusic();
    }
    
    turnOff() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        console.log('🌱 ❌ SoilHandler: TURNING OFF - creature + music');
        this.hideCreature();
        this.stopMusic();
    }
    
    showBackground() {
        if (this.backgroundShown || !this.frameBackground) return;
        this.frameBackground.classList.add('soil-background');
        this.backgroundShown = true;
        console.log('🌱 🎨 SoilHandler: Background shown');
    }
    
    hideBackground() {
        if (!this.frameBackground) return; // No need to check backgroundShown for forced cleanup
        this.frameBackground.classList.remove('soil-background');
        this.backgroundShown = false;
        console.log('🌱 🎨 SoilHandler: Background hidden');
    }
    
    showCreature() {
        if (this.creatureShown || !this.soilCreature) return;
        this.soilCreature.classList.add('active');
        this.soilCreature.style.display = 'block';
        this.creatureShown = true;
        console.log('🌱 🦎 SoilHandler: Creature shown');
    }
    
    hideCreature() {
        if (!this.soilCreature) return; // No need to check creatureShown for forced cleanup
        this.soilCreature.classList.remove('active');
        this.soilCreature.style.display = 'none';
        this.creatureShown = false;
        console.log('🌱 🦎 SoilHandler: Creature hidden');
    }
    
    async startMusic() {
        if (this.audioPlaying) return;
        if (!this.synth) { console.error('❌ No synth for startMusic in SoilHandler.'); return; }
        if (!this.audioContextReady || (Tone.context && Tone.context.state !== 'running')) {
            console.warn('⚠️  Audio context not ready/running in SoilHandler. Music not started.');
            return;
        }
        this.audioPlaying = true;
        console.log('🌱 🎹 SoilHandler: Music activated - starting toy piano');
        this.playNote();
    }
    
    stopMusic() {
        this.audioPlaying = false; // Set flag immediately
        if (this.synth) {
            try {
                this.synth.releaseAll();
                console.log('🎹 ✅ Music stopped in SoilHandler stopMusic()');
            } catch (error) {
                console.error('🎹 ❌ Error in SoilHandler stopMusic():', error);
            }
        } else console.warn('🌱🎹 Synth not available in SoilHandler stopMusic()');
    }
    
    playNote() {
        if (!this.audioPlaying || !this.synth) return;
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        this.synth.triggerAttackRelease(note, '4n');
        setTimeout(() => { if (this.audioPlaying) this.playNote(); }, 2000);
    }
    
    getDebugInfo() {
        return {
            isConnected: this.isConnected, isPlaying: this.isPlaying, audioPlaying: this.audioPlaying,
            backgroundShown: this.backgroundShown, creatureShown: this.creatureShown,
            audioContextReady: this.audioContextReady, lastActivityTime: this.lastActivityTime,
            timeSinceActivity: this.lastActivityTime > 0 ? Date.now() - this.lastActivityTime : -1
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 DOMContentLoaded: Preparing to start Soil Handler...');
    // Ensure window.creatune is initialized before SoilHandler tries to use it.
    // SoilHandler's waitForDependencies will also check.
    if (!window.soilHandlerInstance) { // Prevent multiple initializations
        window.soilHandlerInstance = new SoilHandler();
        window.soilHandlerInstance.init(); // Call init explicitly
    } else {
        console.log('🌱 SoilHandler instance already exists.');
    }
});

// Export for modules (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}