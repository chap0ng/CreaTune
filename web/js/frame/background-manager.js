document.addEventListener('DOMContentLoaded', function() {
    const frameBackground = document.querySelector('.framebackground');
    const idleCreature = document.querySelector('.idle-creature');
    const soilCreature = document.querySelector('.soil-creature');
    
    frameBackground.addEventListener('click', function() {
        this.classList.toggle('soil');
        
        // Toggle creatures based on soil state
        if (this.classList.contains('soil')) {
            idleCreature.style.display = 'none';
            soilCreature.style.display = 'block';
        } else {
            idleCreature.style.display = 'block';
            soilCreature.style.display = 'none';
        }
    });
});