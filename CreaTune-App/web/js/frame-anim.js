// Modify frame-anim.js to work better with recording
document.addEventListener('DOMContentLoaded', () => {
    const sprite = document.getElementById('sprite');
    const container = document.getElementById('spriteContainer');
    const instructions = document.querySelector('.instructions');
    
    const columns = 3;
    const rows = 4;
    const totalFrames = columns * rows;
    
    let currentFrame = 0;
    let isAnimating = false;
    let animationInterval;
    let animationTimer;
    
    const animationDuration = 5000;
    
    function showFrame(frameIndex) {
        const row = Math.floor(frameIndex / columns);
        const col = frameIndex % columns;
        sprite.style.backgroundPosition = `${col * 50}% ${row * 33.33}%`;
    }
    
    function nextFrame() {
        showFrame(currentFrame);
        currentFrame = (currentFrame + 1) % totalFrames;
    }
    
    function startAnimation() {
        if (isAnimating) stopAnimation();
        if (window.dragContainer && window.dragContainer.isTabOpen()) return;
        
        // Allow animation during recording - don't block it
        resetFrame();
        isAnimating = true;
        
        if (instructions) instructions.style.display = 'none';
        
        const frameRate = 1000 / 12;
        animationInterval = setInterval(nextFrame, frameRate);
        animationTimer = setTimeout(stopAnimation, animationDuration);
    }
    
    function stopAnimation() {
        clearInterval(animationInterval);
        clearTimeout(animationTimer);
        isAnimating = false;
        if (instructions) instructions.style.display = 'block';
        resetFrame();
    }
    
    function resetFrame() {
        currentFrame = 0;
        showFrame(0);
    }
    
    // Disable the container click to handle animation - let state-manager handle clicks
    // We only want clicks for dragging to work
    container.addEventListener('click', (e) => {
        const dragHandle = document.getElementById('dragHandle');
        const handleOverlay = document.getElementById('handleOverlay');
        const topTab = document.getElementById('topTab');
        const frameCovers = [
            document.getElementById('frameCoverLeft'),
            document.getElementById('frameCoverRight'),
            document.getElementById('frameCoverTop')
        ];
        
        // If clicking on drag elements, don't start animation
        if ([dragHandle, handleOverlay, topTab, ...frameCovers].includes(e.target) || 
            (topTab && topTab.contains(e.target))) return;
            
        // Let state-manager handle the recording logic
        // We only animate if no recording is active
        if ((!window.stateManager || window.stateManager.getSubState() !== 'record') &&
            (!window.dragContainer || !window.dragContainer.isTabOpen())) {
            
            // Check if recording system exists and is recording or has a loop
            const recordingActive = window.recordingSystem && 
                (window.recordingSystem.isRecording() || window.recordingSystem.hasLoop());
                
            if (!recordingActive) {
                startAnimation();
            }
        }
    });
    
    resetFrame();
    
    window.spriteAnimation = {
        start: startAnimation,
        stop: stopAnimation,
        resetFrame: resetFrame,
        showFrame: showFrame,
        isRunning: () => isAnimating,
        onTabClosed: resetFrame,
        onTabFullyOpen: () => {
            if (isAnimating) stopAnimation();
            resetFrame();
        },
        onTabPartiallyOpen: () => {
            if (isAnimating) stopAnimation();
            resetFrame();
        }
    };
});