document.addEventListener('DOMContentLoaded', function() {
    const idleCreature = document.querySelector('.idle-creature');
    const soilCreature = document.querySelector('.soil-creature');
    
    function updateCreatureVisibility() {
        const isFrameOpen = window.frameSliderState?.isOpen || false;
        
        if (isFrameOpen) {
            idleCreature.style.display = 'none';
            soilCreature.style.display = 'none';
        } else {
            const frameBackground = document.querySelector('.framebackground');
            const hasSoil = frameBackground.classList.contains('soil');
            
            if (hasSoil) {
                idleCreature.style.display = 'none';
                soilCreature.style.display = 'block';
            } else {
                idleCreature.style.display = 'block';
                soilCreature.style.display = 'none';
            }
        }
    }
    
    setInterval(updateCreatureVisibility, 100);
    updateCreatureVisibility();
});