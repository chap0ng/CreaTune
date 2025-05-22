document.addEventListener('DOMContentLoaded', function() {
    const frameBackground = document.querySelector('.framebackground');
    
    frameBackground.addEventListener('click', function() {
        this.classList.toggle('soil');
    });
    
});