// soil.js
// DIAGNOSTIC VERSION - Debug Tone.js and synth issues

class SoilHandler {
    constructor() {
        // Simple on/off states
        this.isConnected = false;
        this.isPlaying = false;
        
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
        
        // Musical scale
        this.melancholicScale = [
            'C4', 'D4', 'E4', 'G4', 'A4',    
            'C5', 'D5', 'E5', 'G5', 'A5',    
            'F4', 'B4', 'F5', 'B5'           
        ];
        
        this.init();
    }
    
    async init() {
        console.log('🌱 Initializing DIAGNOSTIC Soil Handler...');
        
        // ✅ DIAGNOSTIC: Check Tone.js loading
        await this.waitForDependencies();
        
        // ✅ DIAGNOSTIC: Verify Tone.js
        this.verifyToneJS();
        
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
        
        console.log('🌱✅ DIAGNOSTIC Soil Handler ready');
        
        // ✅ DIAGNOSTIC: Add test button for manual testing
        this.addDiagnosticControls();
    }
    
    async waitForDependencies() {
        console.log('🔍 Waiting for Tone.js...');
        
        let attempts = 0;
        while (typeof Tone === 'undefined' && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            if (attempts % 10 === 0) {
                console.log(`🔍 Still waiting for Tone.js... (${attempts}/50)`);
            }
        }
        
        if (typeof Tone === 'undefined') {
            console.error('❌ CRITICAL: Tone.js failed to load after 5 seconds!');
            console.error('❌ Check if Tone.js script is included in HTML');
            return;
        }
        
        console.log('✅ Tone.js loaded successfully');
        
        while (!window.creatune) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('✅ WebSocket client loaded');
    }
    
    // ✅ DIAGNOSTIC: Verify Tone.js components
    verifyToneJS() {
        console.log('🔍 Verifying Tone.js components...');
        
        const requiredComponents = [
            'Tone.PolySynth',
            'Tone.FMSynth', 
            'Tone.Synth',
            'Tone.Reverb',
            'Tone.Filter',
            'Tone.start',
            'Tone.context'
        ];
        
        const missing = [];
        
        requiredComponents.forEach(component => {
            const parts = component.split('.');
            let obj = window;
            
            for (let part of parts) {
                if (obj && typeof obj[part] !== 'undefined') {
                    obj = obj[part];
                } else {
                    missing.push(component);
                    obj = null;
                    break;
                }
            }
        });
        
        if (missing.length > 0) {
            console.error('❌ Missing Tone.js components:', missing);
            console.error('❌ This will cause synth setup to fail');
        } else {
            console.log('✅ All required Tone.js components found');
        }
        
        // Check Tone.js version
        if (Tone.version) {
            console.log(`✅ Tone.js version: ${Tone.version}`);
        }
    }
    
    async setupAudio() {
        console.log('🎵 Setting up audio...');
        
        try {
            // ✅ DIAGNOSTIC: Try simple synth first
            console.log('🔍 Trying simple synth first...');
            
            const testSynth = new Tone.Synth();
            testSynth.dispose(); // Clean up test
            console.log('✅ Simple Tone.Synth works');
            
            // ✅ DIAGNOSTIC: Try PolySynth
            console.log('🔍 Trying PolySynth...');
            const testPolySynth = new Tone.PolySynth();
            testPolySynth.dispose();
            console.log('✅ Tone.PolySynth works');
            
            // ✅ DIAGNOSTIC: Try FMSynth
            console.log('🔍 Trying FMSynth...');
            const testFMSynth = new Tone.FMSynth();
            testFMSynth.dispose();
            console.log('✅ Tone.FMSynth works');
            
            // ✅ Now create the actual synth
            console.log('🎹 Creating toy piano synth...');
            
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
            
            console.log('✅ Toy piano synth created');
            
            // ✅ Create effects
            this.reverb = new Tone.Reverb({
                decay: 2.0,
                wet: 0.3
            });
            
            this.filter = new Tone.Filter({
                frequency: 200,
                type: "highpass"
            });
            
            console.log('✅ Effects created');
            
            // ✅ Connect chain
            this.synth.connect(this.filter);
            this.filter.connect(this.reverb);
            this.reverb.toDestination();
            
            this.synth.volume.value = -8;
            
            console.log('✅ Audio chain connected');
            console.log('🎵 Toy piano setup complete!');
            
        } catch (error) {
            console.error('❌ AUDIO SETUP FAILED:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Error stack:', error.stack);
            
            // ✅ FALLBACK: Create simple synth
            console.log('🔄 Attempting fallback simple synth...');
            try {
                this.synth = new Tone.Synth();
                this.synth.toDestination();
                console.log('✅ Fallback synth created');
            } catch (fallbackError) {
                console.error('❌ Even fallback synth failed:', fallbackError);
            }
        }
    }
    
    setupWebSocketListener() {
        // Same as before
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
    
    // ✅ DIAGNOSTIC: Add manual test controls
    addDiagnosticControls() {
        // Create diagnostic buttons
        const controls = document.createElement('div');
        controls.style.cssText = `
            position: fixed; 
            top: 10px; 
            left: 10px; 
            z-index: 9999; 
            background: rgba(0,0,0,0.8); 
            color: white; 
            padding: 10px; 
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
        `;
        
        controls.innerHTML = `
            <div>🔧 DIAGNOSTIC CONTROLS</div>
            <button id="testNote" style="margin: 2px;">Test Note</button>
            <button id="testToyPiano" style="margin: 2px;">Test Toy Piano</button>
            <button id="testAudioContext" style="margin: 2px;">Test Audio Context</button>
            <button id="testPattern" style="margin: 2px;">Test Pattern</button>
            <div id="diagnosticOutput" style="margin-top: 5px; max-width: 300px;"></div>
        `;
        
        document.body.appendChild(controls);
        
        // Add event listeners
        document.getElementById('testNote').onclick = () => this.diagnosticTestNote();
        document.getElementById('testToyPiano').onclick = () => this.diagnosticTestToyPiano();
        document.getElementById('testAudioContext').onclick = () => this.diagnosticTestAudioContext();
        document.getElementById('testPattern').onclick = () => this.diagnosticTestPattern();
        
        console.log('🔧 Diagnostic controls added to page');
    }
    
    // ✅ DIAGNOSTIC TESTS
    async diagnosticTestNote() {
        const output = document.getElementById('diagnosticOutput');
        output.innerHTML = '🔍 Testing single note...';
        
        try {
            if (!this.synth) {
                throw new Error('No synth available');
            }
            
            if (Tone.context.state !== 'running') {
                await Tone.start();
                output.innerHTML += '<br>✅ Started audio context';
            }
            
            console.log('🎵 Testing note: C4');
            this.synth.triggerAttackRelease('C4', '4n');
            output.innerHTML += '<br>✅ Played C4';
            
        } catch (error) {
            console.error('❌ Test note failed:', error);
            output.innerHTML += `<br>❌ Failed: ${error.message}`;
        }
    }
    
    async diagnosticTestToyPiano() {
        const output = document.getElementById('diagnosticOutput');
        output.innerHTML = '🔍 Testing toy piano sequence...';
        
        try {
            if (!this.synth) {
                throw new Error('No synth available');
            }
            
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            
            const testNotes = ['C4', 'E4', 'G4', 'C5'];
            
            for (let i = 0; i < testNotes.length; i++) {
                setTimeout(() => {
                    console.log(`🎹 Playing: ${testNotes[i]}`);
                    this.synth.triggerAttackRelease(testNotes[i], '8n');
                    output.innerHTML += `<br>🎹 ${testNotes[i]}`;
                }, i * 500);
            }
            
        } catch (error) {
            console.error('❌ Test toy piano failed:', error);
            output.innerHTML += `<br>❌ Failed: ${error.message}`;
        }
    }
    
    diagnosticTestAudioContext() {
        const output = document.getElementById('diagnosticOutput');
        
        output.innerHTML = `
            🔍 Audio Context Info:<br>
            State: ${Tone.context.state}<br>
            Sample Rate: ${Tone.context.sampleRate}<br>
            Current Time: ${Tone.context.currentTime.toFixed(2)}s<br>
            Destination: ${Tone.context.destination ? 'OK' : 'Missing'}
        `;
        
        console.log('🔍 Tone.context:', Tone.context);
    }
    
    async diagnosticTestPattern() {
        const output = document.getElementById('diagnosticOutput');
        output.innerHTML = '🔍 Testing full pattern system...';
        
        if (!this.audioPlaying) {
            await this.startMusic();
            output.innerHTML += '<br>✅ Started music pattern';
        } else {
            this.stopMusic();
            output.innerHTML += '<br>⏹️ Stopped music pattern';
        }
    }
    
    // Keep all the other methods from before...
    handleSoilConnected() {
        if (this.isConnected) return;
        
        this.isConnected = true;
        console.log('🌱 ✅ SOIL CONNECTED - showing background');
        this.showBackground();
    }
    
    handleSoilStateChange(stateData) {
        console.log(`🌱 🔄 SOIL STATE CHANGE: ${stateData.previousState} → ${stateData.active}`);
        
        if (stateData.active && !this.isPlaying) {
            console.log('🌱 ▶️  TURNING ON - soil is active');
            this.turnOn();
        } else if (!stateData.active && this.isPlaying) {
            console.log('🌱 ⏹️  TURNING OFF - soil is inactive');
            this.turnOff();
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
        console.log('🌱 ✅ TURNING ON - creature + music');
        
        this.showCreature();
        this.startMusic();
    }
    
    turnOff() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        console.log('🌱 ❌ TURNING OFF - creature + music');
        
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
            console.error('❌ Cannot start music - no synth available');
            return;
        }
        
        console.log('🎹 Starting toy piano music...');
        
        if (Tone.context.state !== 'running') {
            console.log('🔄 Starting Tone.js audio context...');
            await Tone.start();
            console.log(`✅ Audio context started: ${Tone.context.state}`);
        }
        
        this.audioPlaying = true;
        console.log('🌱 🎹 Toy piano music started');
        
        // Start with a simple test
        this.playSimpleNote();
    }
    
    stopMusic() {
        if (!this.audioPlaying) return;
        
        this.audioPlaying = false;
        console.log('🌱 🎹 Toy piano music stopped');
        
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
    
    // ✅ SIMPLIFIED: Start with simple notes to test
    playSimpleNote() {
        if (!this.audioPlaying || !this.synth) return;
        
        const note = this.melancholicScale[Math.floor(Math.random() * this.melancholicScale.length)];
        
        console.log(`🎹 Playing simple note: ${note}`);
        
        try {
            this.synth.triggerAttackRelease(note, '4n');
        } catch (error) {
            console.error('❌ Failed to play note:', error);
        }
        
        // Schedule next note
        setTimeout(() => {
            if (this.audioPlaying) {
                this.playSimpleNote();
            }
        }, 2000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Starting DIAGNOSTIC Soil Handler...');
    window.soilHandler = new SoilHandler();
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilHandler;
}