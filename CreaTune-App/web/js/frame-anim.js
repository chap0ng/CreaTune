// Modify frame-anim.js to work better with recording
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const sprite = document.getElementById('sprite');
    const container = document.getElementById('spriteContainer');
    const instructions = document.querySelector('.instructions');
    
    // Animation configuration
    const columns = 3;
    const rows = 4;
    const totalFrames = columns * rows;
    
    // Animation state
    let currentFrame = 0;
    let isAnimating = false;
    let animationInterval = null;
    let animationTimer = null;
    
    const animationDuration = 5000;
    
    // Show a specific frame
    function showFrame(frameIndex) {
        try {
            // Calculate position in sprite sheet
            const row = Math.floor(frameIndex / columns);
            const col = frameIndex % columns;
            
            // Apply background position safely
            if (sprite) {
                sprite.style.backgroundPosition = `${col * 50}% ${row * 33.33}%`;
            }
        } catch (err) {
            console.error(`Error showing frame ${frameIndex}:`, err);
        }
    }
    
    // Show the next frame in sequence
    function nextFrame() {
        try {
            // Show current frame
            showFrame(currentFrame);
            
            // Advance to next frame with wrap-around
            currentFrame = (currentFrame + 1) % totalFrames;
        } catch (err) {
            console.error('Error in nextFrame:', err);
        }
    }
    
    // Start the animation
    function startAnimation() {
        try {
            // Don't start if already running
            if (isAnimating) stopAnimation();
            
            // Don't start if tab is open
            if (window.dragContainer && window.dragContainer.isTabOpen()) return;
            
            // Reset to starting frame
            resetFrame();
            isAnimating = true;
            
            // Hide instructions during animation
            if (instructions) instructions.style.display = 'none';
            
            // Set up animation interval
            const frameRate = 1000 / 12; // 12 fps
            animationInterval = setInterval(nextFrame, frameRate);
            
            // Set up timer to stop animation after duration
            animationTimer = setTimeout(stopAnimation, animationDuration);
        } catch (err) {
            console.error('Error starting animation:', err);
            // Try to recover
            isAnimating = false;
            if (instructions) instructions.style.display = 'block';
        }
    }
    
    // Stop the animation
    function stopAnimation() {
        try {
            // Clear animation interval
            if (animationInterval) {
                clearInterval(animationInterval);
                animationInterval = null;
            }
            
            // Clear animation timer
            if (animationTimer) {
                clearTimeout(animationTimer);
                animationTimer = null;
            }
            
            // Update state
            isAnimating = false;
            
            // Show instructions when animation stops
            if (instructions) instructions.style.display = 'block';
            
            // Reset frame
            resetFrame();
        } catch (err) {
            console.error('Error stopping animation:', err);
            // Try to recover
            isAnimating = false;
            if (instructions) instructions.style.display = 'block';
            try {
                resetFrame();
            } catch (innerErr) {
                console.error('Error in resetFrame during recovery:', innerErr);
            }
        }
    }
    
    // Reset to frame 0
    function resetFrame() {
        try {
            currentFrame = 0;
            showFrame(0);
        } catch (err) {
            console.error('Error in resetFrame:', err);
        }
    }
    
    // Set up click handler for container
    if (container) {
        container.addEventListener('click', (e) => {
            try {
                // Get elements that should not trigger animation
                const dragHandle = document.getElementById('dragHandle');
                const handleOverlay = document.getElementById('handleOverlay');
                const topTab = document.getElementById('topTab');
                const frameCovers = [
                    document.getElementById('frameCoverLeft'),
                    document.getElementById('frameCoverRight'),
                    document.getElementById('frameCoverTop')
                ];
                
                // Don't start animation if clicking on special elements
                const specialElements = [dragHandle, handleOverlay, topTab, ...frameCovers];
                if (specialElements.some(el => el && (el === e.target || (el && el.contains(e.target))))) {
                    return;
                }
                
                // Check for state manager - don't interfere with recording
                const inRecordingMode = window.StateManager && 
                    window.StateManager.getSubState && 
                    window.StateManager.getSubState() === 'record';
                    
                // Check for open tab - don't animate if tab open
                const isTabOpen = window.dragContainer && 
                    window.dragContainer.isTabOpen && 
                    window.dragContainer.isTabOpen();
                
                // Only animate if conditions are right
                if (!inRecordingMode && !isTabOpen) {
                    // Check for recording system
                    const recordingActive = window.RecordingManager && 
                        (window.RecordingManager.isRecording() || 
                         window.RecordingManager.isPlayingPattern());
                         
                    // Start animation if not recording
                    if (!recordingActive) {
                        startAnimation();
                    }
                }
            } catch (err) {
                console.error('Error in container click handler:', err);
            }
        });
    }
    
    // Initialize to frame 0
    resetFrame();
    
    // Expose public API
    window.spriteAnimation = {
        start: function() {
            try {
                startAnimation();
            } catch (err) {
                console.error('Error starting animation:', err);
            }
        },
        stop: function() {
            try {
                stopAnimation();
            } catch (err) {
                console.error('Error stopping animation:', err);
            }
        },
        resetFrame: function() {
            try {
                resetFrame();
            } catch (err) {
                console.error('Error resetting frame:', err);
            }
        },
        showFrame: function(frameIndex) {
            try {
                showFrame(frameIndex);
            } catch (err) {
                console.error('Error showing frame:', err);
            }
        },
        isRunning: function() {
            return isAnimating;
        },
        onTabClosed: function() {
            try {
                resetFrame();
            } catch (err) {
                console.error('Error in onTabClosed:', err);
            }
        },
        onTabFullyOpen: function() {
            try {
                if (isAnimating) stopAnimation();
                resetFrame();
            } catch (err) {
                console.error('Error in onTabFullyOpen:', err);
            }
        },
        onTabPartiallyOpen: function() {
            try {
                if (isAnimating) stopAnimation();
                resetFrame();
            } catch (err) {
                console.error('Error in onTabPartiallyOpen:', err);
            }
        }
    };
});