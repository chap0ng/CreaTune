// creature-hidder.js
// Simple creature visibility management

document.addEventListener('DOMContentLoaded', function() {
    const idleCreature = document.querySelector('.idle-creature');
    const soilCreature = document.querySelector('.soil-creature');
    
    function updateCreatureVisibility() {
        const isFrameOpen = window.frameSliderState?.isOpen || false;
        const frameBackground = document.querySelector('.framebackground');
        const isActive = frameBackground?.classList.contains('active') || false;
        
        if (isFrameOpen) {
            // Hide all creatures when frame is open
            if (idleCreature) idleCreature.style.display = 'none';
            if (soilCreature) soilCreature.style.display = 'none';
        } else {
            // Show appropriate creature when frame is closed
            if (isActive) {
                // Active state - show soil creature
                if (idleCreature) idleCreature.style.display = 'none';
                if (soilCreature) soilCreature.style.display = 'block';
            } else {
                // Inactive state - show idle creature
                if (idleCreature) idleCreature.style.display = 'block';
                if (soilCreature) soilCreature.style.display = 'none';
            }
        }
    }
    
    // Check visibility every 100ms
    setInterval(updateCreatureVisibility, 100);
    updateCreatureVisibility();
});