// recording-manager.js
export default class RecordingManager {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.recordedPattern = null;
    this.isPlaying = false;
    this.recordingAudioContext = null;
    this.recordingMediaStream = null;
    this.recordingAnalyser = null;
    this.dataArray = null;
    this.playbackInterval = null;
    
    this.setupRecording();
  }

  setupRecording() {
    this.stateManager.uiManager.container.addEventListener('click', (e) => {
      if (this.stateManager.currentSubState === SUB_STATES.BPM) return;
      if (!this.stateManager.espManager.getConnectedDevices().length) return;
      
      // Check if clicking on a control element
      const controlElements = [
        document.getElementById('dragHandle'),
        document.getElementById('handleOverlay'),
        document.getElementById('topTab'),
        document.getElementById('frameCoverLeft'),
        document.getElementById('frameCoverRight'),
        document.getElementById('frameCoverTop'),
        document.getElementById('debugStateButton'),
        document.getElementById('espStatusPanel'),
        document.getElementById('randomSynthButton')
      ].filter(el => el);
      
      if (controlElements.some(el => el === e.target || el.contains(e.target))) return;
      
      if (this.stateManager.currentSubState === SUB_STATES.RECORD) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });
  }

  startRecording() {
    if (this.stateManager.currentSubState === SUB_STATES.RECORD) return;
    
    console.log('Start recording');
    this.stateManager.currentSubState = SUB_STATES.RECORD;
    this.stateManager.uiManager.container.classList.add('recording');
    
    if (window.spriteAnimation && !window.spriteAnimation.isRunning()) {
      window.spriteAnimation.start();
    }
    
    if (this.isPlaying) {
      this.stopPlayingRecordedPattern();
    }
    
    if (window.synthEngine) {
      window.synthEngine.silenceSynths(true);
    }
    
    setTimeout(() => this.startAudioRecording(), 200);
    setTimeout(() => {
      if (this.stateManager.currentSubState === SUB_STATES.RECORD) {
        this.stopRecording();
      }
    }, 5000);
  }

  stopRecording() {
    if (this.stateManager.currentSubState !== SUB_STATES.RECORD) return;
    
    console.log('Stop recording');
    this.stateManager.currentSubState = SUB_STATES.NORMAL;
    this.stateManager.uiManager.container.classList.remove('recording');
    
    if (window.spriteAnimation) {
      window.spriteAnimation.stop();
    }
    
    const volumeMeter = document.getElementById('volumeMeter');
    if (volumeMeter) {
      volumeMeter.style.display = 'none';
    }
    
    this.stopAudioRecording();
    
    setTimeout(() => this.startPlayingRecordedPattern(), 100);
  }

  startAudioRecording() {
    try {
      this.recordedPattern = [];
      
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.recordingAudioContext = new AudioContext();
        
        navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false
          }, 
          video: false 
        })
          .then(stream => {
            this.recordingMediaStream = stream;
            this.recordingAnalyser = this.recordingAudioContext.createAnalyser();
            this.recordingAnalyser.fftSize = 1024;
            this.recordingAnalyser.smoothingTimeConstant = 0.2;
            
            const source = this.recordingAudioContext.createMediaStreamSource(stream);
            source.connect(this.recordingAnalyser);
            
            const bufferLength = this.recordingAnalyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.createVolumeMeter();
            
            let lastPeakTime = 0;
            const peakDelay = 300;
            
            const analyzeInterval = setInterval(() => {
              if (this.stateManager.currentSubState !== SUB_STATES.RECORD) {
                clearInterval(analyzeInterval);
                document.getElementById('volumeMeter').style.display = 'none';
                return;
              }
              
              this.recordingAnalyser.getByteFrequencyData(this.dataArray);
              const average = this.calculateAverageVolume();
              this.updateVolumeMeter(average);
              
              const threshold = 40;
              const now = Date.now();
              
              if (average > threshold && (now - lastPeakTime) > peakDelay) {
                this.recordedPattern.push({
                  time: now,
                  intensity: Math.min(1, average / 150)
                });
                
                lastPeakTime = now;
                this.stateManager.uiManager.container.classList.add('pulse');
                setTimeout(() => {
                  this.stateManager.uiManager.container.classList.remove('pulse');
                }, 100);
              }
            }, 30);
          })
          .catch(err => {
            console.error('Error accessing microphone:', err);
            this.showErrorMessage('Could not access microphone. Recording disabled.');
            this.handleRecordingError();
          });
      } else {
        console.error('Web Audio API not supported');
        this.showErrorMessage('Your browser does not support audio recording');
        this.handleRecordingError();
      }
    } catch (error) {
      console.error('Error starting audio recording:', error);
      this.handleRecordingError();
    }
  }

  calculateAverageVolume() {
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / this.dataArray.length;
  }

  createVolumeMeter() {
    let volumeMeter = document.getElementById('volumeMeter');
    if (!volumeMeter) {
      volumeMeter = document.createElement('div');
      volumeMeter.id = 'volumeMeter';
      volumeMeter.style.position = 'absolute';
      volumeMeter.style.bottom = '100px';
      volumeMeter.style.left = '50%';
      volumeMeter.style.transform = 'translateX(-50%)';
      volumeMeter.style.width = '80%';
      volumeMeter.style.height = '10px';
      volumeMeter.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      volumeMeter.style.borderRadius = '5px';
      volumeMeter.style.zIndex = '100';
      volumeMeter.style.overflow = 'hidden';
      
      const meterFill = document.createElement('div');
      meterFill.id = 'meterFill';
      meterFill.style.height = '100%';
      meterFill.style.width = '0%';
      meterFill.style.backgroundColor = 'green';
      meterFill.style.transition = 'width 0.05s';
      
      volumeMeter.appendChild(meterFill);
      this.stateManager.uiManager.container.appendChild(volumeMeter);
    } else {
      volumeMeter.style.display = 'block';
      document.getElementById('meterFill').style.width = '0%';
    }
  }

  updateVolumeMeter(average) {
    const meterFill = document.getElementById('meterFill');
    if (meterFill) {
      const percentage = Math.min(100, average * 0.6);
      meterFill.style.width = percentage + '%';
      
      if (percentage > 70) {
        meterFill.style.backgroundColor = 'red';
      } else if (percentage > 40) {
        meterFill.style.backgroundColor = 'orange';
      } else {
        meterFill.style.backgroundColor = 'green';
      }
    }
  }

  handleRecordingError() {
    this.stateManager.currentSubState = SUB_STATES.NORMAL;
    this.stateManager.uiManager.container.classList.remove('recording');
    
    if (window.synthEngine) {
      window.synthEngine.silenceSynths(false);
    }
  }

  stopAudioRecording() {
    if (this.recordingMediaStream) {
      this.recordingMediaStream.getTracks().forEach(track => track.stop());
      this.recordingMediaStream = null;
    }
    
    if (this.recordingAudioContext && this.recordingAudioContext.state !== 'closed') {
      this.recordingAudioContext.close().catch(err => console.error('Error closing audio context:', err));
    }
    
    this.recordingAudioContext = null;
    this.recordingAnalyser = null;
    
    if (this.recordedPattern?.length > 0) {
      const startTime = this.recordedPattern[0].time;
      this.recordedPattern = this.recordedPattern.map(pulse => ({
        time: pulse.time - startTime,
        intensity: pulse.intensity
      }));
    } else {
      this.recordedPattern = null;
    }
  }

  startPlayingRecordedPattern() {
    if (!this.recordedPattern?.length) {
      if (window.synthEngine) {
        window.synthEngine.silenceSynths(false);
      }
      return;
    }
    
    if (window.synthEngine) {
      window.synthEngine.silenceSynths(false);
    }
    
    this.isPlaying = true;
    const patternDuration = this.recordedPattern[this.recordedPattern.length - 1].time;
    let patternStartTime = Date.now();
    
    this.playbackInterval = setInterval(() => {
      const currentTime = Date.now() - patternStartTime;
      
      if (currentTime > patternDuration) {
        patternStartTime = Date.now();
        return;
      }
      
      this.recordedPattern.forEach(pulse => {
        if (Math.abs(currentTime - pulse.time) < 30) {
          this.triggerSynthFromPattern(pulse.intensity);
          this.stateManager.uiManager.container.classList.add('pulse');
          setTimeout(() => {
            this.stateManager.uiManager.container.classList.remove('pulse');
          }, 100);
        }
      });
    }, 20);
  }

  stopPlayingRecordedPattern() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    
    this.isPlaying = false;
  }

  triggerSynthFromPattern(intensity) {
    if (window.synthEngine) {
      window.synthEngine.triggerPatternNote(intensity);
    }
  }

  showErrorMessage(message) {
    let errorEl = document.getElementById('recordingError');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'recordingError';
      errorEl.style.position = 'fixed';
      errorEl.style.bottom = '50px';
      errorEl.style.left = '0';
      errorEl.style.width = '100%';
      errorEl.style.textAlign = 'center';
      errorEl.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      errorEl.style.color = 'white';
      errorEl.style.padding = '10px';
      errorEl.style.fontFamily = 'VT323, monospace';
      errorEl.style.zIndex = '1000';
      document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    setTimeout(() => errorEl.style.display = 'none', 3000);
  }
}