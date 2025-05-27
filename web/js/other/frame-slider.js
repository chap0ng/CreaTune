document.addEventListener('DOMContentLoaded', () => {
    const frameidle = document.querySelector('.frameidle');
    const frametop = document.querySelector('.frametop');
    const framebackground = document.querySelector('.framebackground');
    const frameleft = document.querySelector('.frameleft');
    const frameright = document.querySelector('.frameright');
    
    let isDragging = false;
    let startY = 0;
    let currentOffset = 0;
    let isOpen = false;
    
    // Make state available globally
    window.frameSliderState = { isOpen: false };
    
    // Set body overflow to crop
    document.body.style.overflow = 'hidden';
    
    function updateDrag(offset) {
        const frameHeight = frameidle.offsetHeight;
        const maxOffset = frameHeight * 0.5;
        const clampedOffset = Math.max(0, Math.min(maxOffset, offset));
        
        // Move top row as one unit
        const topElements = [frametop, document.querySelector('.corner1'), document.querySelector('.corner2')];
        const transform = `translateY(${clampedOffset}px)`;
        
        // Use requestAnimationFrame for synchronized updates
        requestAnimationFrame(() => {
            topElements.forEach(el => el.style.transform = transform);
            
            const marginTop = `${clampedOffset}px`;
            framebackground.style.marginTop = marginTop;
            frameleft.style.marginTop = marginTop;
            frameright.style.marginTop = marginTop;
        });
        
        currentOffset = clampedOffset;
    }
    
    function snap() {
        const frameHeight = frameidle.offsetHeight;
        const maxOffset = frameHeight * 0.7;
        const threshold = maxOffset * 0.4;
        const target = currentOffset > threshold ? maxOffset : 0;
        
        isOpen = target > 0; // Track open state
        window.frameSliderState.isOpen = isOpen; // Update global state
        
        const elements = [frametop, document.querySelector('.corner1'), document.querySelector('.corner2')];
        elements.forEach(el => el.style.transition = 'transform 0.3s ease-out');
        [framebackground, frameleft, frameright].forEach(el => el.style.transition = 'margin-top 0.3s ease-out');
        
        updateDrag(target);
        
        setTimeout(() => {
            elements.forEach(el => el.style.transition = '');
            [framebackground, frameleft, frameright].forEach(el => el.style.transition = '');
        }, 300);
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        if (isOpen) {
            const frameHeight = frameidle.offsetHeight;
            const newOffset = frameHeight * 0.7;
            updateDrag(newOffset);
            currentOffset = newOffset;
        }
    });
    
    frametop.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaY = e.clientY - startY;
        updateDrag(currentOffset + deltaY);
        e.preventDefault();
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            snap();
        }
    });
    
    frametop.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
        if (isDragging) {
            const deltaY = e.touches[0].clientY - startY;
            updateDrag(currentOffset + deltaY);
            e.preventDefault();
        }
    });
    
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            snap();
        }
    });
});