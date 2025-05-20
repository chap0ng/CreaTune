// recording-manager.js
// Recording functionality for CreaTune

document.addEventListener('DOMContentLoaded', () => {
  // Import configuration
  const { RECORDING, SUB_STATES } = window.CreaTuneConfig;
  
  // Recording state
  let isRecording = false;
  let recordedPattern = null;
  let isPlayingRecordedPattern = false;
  
  // Recording resources
  let recordingAudioContext = null;
  let recordingMediaStream = null;
  let recordingAnalyser = null;
  let dataArray = null;
  let playbackInterval = null;
  let analyzeInterval = null;
  
  // DOM elements
  const container = document.getElementById('spriteContainer');
  
  // Start recording
  function startRecording() {
    if (isRecording) return;
    
    console.log('Start recording');
    
    // Update UI
    if (container) {
      container.classList.add('recording');
    }
    
    // Start sprite animation without blocking the recording UI
    if (window.spriteAnimation && !window.spriteAnimation.isRunning()) {
      window.spriteAnimation.start();
    }
    
    // If we're already playing a recorded pattern, stop it
    if (isPlayingRecordedPattern) {
      stopPlayingRecordedPattern();
    }
    
    // Silence active synths immediately before recording
    if (window.SynthEngine) {
      window.SynthEngine.silenceSynths(true);
    }
    
    // Notify listeners
    EventBus.emit('recordingStarted');
    
    // Set recording flag
    isRecording = true;
    
    // Add a small delay before starting the recording to ensure silence
    setTimeout(() => {
      // Start recording audio
      startAudioRecording();
    }, 200);
    
    // Auto-stop after recording duration
    setTimeout(() => {
      if (isRecording) {
        stopRecording();
      }
    }, RECORDING.DURATION);
  }
  
  // Stop recording
  function stopRecording() {
    if (!isRecording) return;
    
    console.log('Stop recording');
    
    // Update UI
    if (container) {
      container.classList.remove('recording');
    }
    
    // Set recording flag
    isRecording = false;
    
    // Stop sprite animation
    if (window.spriteAnimation) {
      window.spriteAnimation.stop();
    }
    
    // Notify listeners
    EventBus.emit('recordingStopped', { 
      hasPattern: recordedPattern && recordedPattern.length > 0 
    });
    
    // Stop audio recording and process the data
    stopAudioRecording();
    
    // Add a small delay before starting pattern playback
    // to ensure clean transition
    setTimeout(() => {
      // Start playing the recorded pattern
      startPlayingRecordedPattern();
    }, 100);
  }
  
  // Start audio recording
  function startAudioRecording() {
    try {
      // Reset previous recording
      recordedPattern = [];
      
      // Set up audio recording if Web Audio API is available
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        recordingAudioContext = new AudioContext();
        
        // Get user microphone with specific constraints
        navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false  // Disable automatic gain to better detect peaks
          }, 
          video: false 
        })
          .then(stream => {
            recordingMediaStream = stream;
            
            // Create analyser node
            recordingAnalyser = recordingAudioContext.createAnalyser();
            recordingAnalyser.fftSize = 1024; // More detailed FFT for better detection
            recordingAnalyser.smoothingTimeConstant = 0.2; // Less smoothing for quicker response
            
            // Connect microphone to analyser
            const source = recordingAudioContext.createMediaStreamSource(stream);
            source.connect(recordingAnalyser);
            
            // Create buffer for frequency data
            const bufferLength = recordingAnalyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            // Ensure UI manager creates volume meter
            if (window.UIManager) {
              window.UIManager.createVolumeMeter();
            }
            
            // Previous peak detection variables
            let lastPeakTime = 0;
            
            // Start analyzing audio at regular intervals
            analyzeInterval = setInterval(() => {
              if (!isRecording) {
                clearInterval(analyzeInterval);
                return;
              }
              
              recordingAnalyser.getByteFrequencyData(dataArray);
              
              // Calculate average volume
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;
              
              // Update volume meter
              if (window.UIManager) {
                window.UIManager.updateVolumeMeter(average, 150);
              }
              
              // Emit volume level for any other listeners
              EventBus.emit('volumeLevel', { 
                average: average, 
                max: 150 
              });
              
              // Detect peaks - adjust threshold based on testing
              const now = Date.now();
              
              if (average > RECORDING.THRESHOLD && (now - lastPeakTime) > RECORDING.PEAK_DELAY) {
                // Record the timestamp of this pulse
                recordedPattern.push({
                  time: now,
                  intensity: Math.min(1, average / 150) // Normalize to 0-1, capped at 1
                });
                
                lastPeakTime = now;
                
                // Visual feedback
                if (container) {
                  container.classList.add('pulse');
                  setTimeout(() => {
                    container.classList.remove('pulse');
                  }, 100);
                }
              }
            }, 30); // Check every 30ms for more responsiveness
          })
          .catch(err => {
            console.error('Error accessing microphone:', err);
            
            if (window.UIManager) {
              window.UIManager.showErrorMessage('Could not access microphone. Recording functionality disabled.');
            }
            
            // Fallback
            resetRecordingState();
          });
      } else {
        console.error('Web Audio API not supported');
        
        if (window.UIManager) {
          window.UIManager.showErrorMessage('Your browser does not support audio recording');
        }
        
        // Fallback
        resetRecordingState();
      }
    } catch (error) {
      console.error('Error starting audio recording:', error);
      
      // Fallback
      resetRecordingState();
    }
  }
  
  // Reset recording state
  function resetRecordingState() {
    isRecording = false;
    
    // Notify state manager
    if (window.StateManager) {
      window.StateManager.setSubState('NORMAL');
    }
    
    // Update UI
    if (container) {
      container.classList.remove('recording');
    }
    
    // Restore synths
    if (window.SynthEngine) {
      window.SynthEngine.silenceSynths(false);
    }
    
    // Clear intervals
    if (analyzeInterval) {
      clearInterval(analyzeInterval);
      analyzeInterval = null;
    }
    
    // Notify listeners
    EventBus.emit('recordingStopped', { hasPattern: false });
  }
  
  // Stop audio recording
  function stopAudioRecording() {
    // Stop analyzing interval
    if (analyzeInterval) {
      clearInterval(analyzeInterval);
      analyzeInterval = null;
    }
    
    // Stop media stream tracks
    if (recordingMediaStream) {
      recordingMediaStream.getTracks().forEach(track => track.stop());
      recordingMediaStream = null;
    }
    
    // Clean up audio context
    if (recordingAudioContext && recordingAudioContext.state !== 'closed') {
      recordingAudioContext.close().catch(err => console.error('Error closing audio context:', err));
    }
    
    recordingAudioContext = null;
    recordingAnalyser = null;
    
    // Process recorded pattern
    if (recordedPattern && recordedPattern.length > 0) {
      // Convert absolute timestamps to relative intervals
      const startTime = recordedPattern[0].time;
      recordedPattern = recordedPattern.map((pulse) => ({
        time: pulse.time - startTime,
        intensity: pulse.intensity
      }));
      
      console.log('Recorded pattern:', recordedPattern);
    } else {
      // No pattern recorded, or empty pattern
      recordedPattern = null;
    }
  }
  
  // Start playing recorded pattern as a trigger for synths
  function startPlayingRecordedPattern() {
    if (!recordedPattern || recordedPattern.length === 0) {
      // No pattern to play, restore synths to normal
      if (window.SynthEngine) {
        window.SynthEngine.silenceSynths(false);
      }
      return;
    }
    
    // Enable synths but use pattern for triggering
    if (window.SynthEngine) {
      window.SynthEngine.silenceSynths(false);
    }
    
    isPlayingRecordedPattern = true;
    
    // Calculate total pattern duration
    const patternDuration = recordedPattern[recordedPattern.length - 1].time;
    
    // Create a loop that triggers synth based on recorded pattern
    let patternStartTime = Date.now();
    
    playbackInterval = setInterval(() => {
      const currentTime = Date.now() - patternStartTime;
      
      // Check if we need to restart the pattern
      if (currentTime > patternDuration) {
        patternStartTime = Date.now();
        return;
      }
      
      // Find pulses that should trigger now
      recordedPattern.forEach(pulse => {
        // Check if this pulse is happening now (within 30ms window)
        if (Math.abs(currentTime - pulse.time) < 30) {
          // Trigger synth note based on current state
          triggerSynthFromPattern(pulse.intensity);
          
          // Visual feedback
          if (container) {
            container.classList.add('pulse');
            setTimeout(() => {
              container.classList.remove('pulse');
            }, 100);
          }
        }
      });
    }, 20); // Check every 20ms for accurate timing
  }
  
  // Stop playing recorded pattern
  function stopPlayingRecordedPattern() {
    if (playbackInterval) {
      clearInterval(playbackInterval);
      playbackInterval = null;
    }
    
    isPlayingRecordedPattern = false;
  }
  
  // Trigger synth based on pattern pulse
  function triggerSynthFromPattern(intensity) {
    if (!window.SynthEngine) return;
    
    // Use the SynthEngine to trigger a note based on the intensity
    window.SynthEngine.triggerPatternNote(intensity);
  }
  
  // Check if recording is available
  function isRecordingAvailable() {
    return !!navigator.mediaDevices && 
           !!navigator.mediaDevices.getUserMedia &&
           (window.AudioContext || window.webkitAudioContext);
  }
  
  // Add cleanup for page unload
  window.addEventListener('beforeunload', function() {
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    // Clean up resources
    stopPlayingRecordedPattern();
  });
  
  // Initialize - subscribe to state changes
  function initialize() {
    // Listen for substate changes from state manager
    EventBus.subscribe('subStateChanged', (data) => {
      // If state changed to recording and we're not already recording, start
      if (data.subState === SUB_STATES.RECORD && !isRecording) {
        startRecording();
      } 
      // If state changed from recording and we are recording, stop
      else if (data.subState !== SUB_STATES.RECORD && isRecording) {
        stopRecording();
      }
    });
  }
  
  // Initialize when DOM is ready
  initialize();
  
  // Expose API
  window.RecordingManager = {
    startRecording,
    stopRecording,
    isRecording: () => isRecording,
    hasRecordedPattern: () => !!recordedPattern && recordedPattern.length > 0,
    isPlayingPattern: () => isPlayingRecordedPattern,
    stopPlayback: stopPlayingRecordedPattern,
    isAvailable: isRecordingAvailable
  };
});
