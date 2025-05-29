document.addEventListener('DOMContentLoaded', () => {
    const frameidle = document.querySelector('.frameidle');
    const frametop = document.querySelector('.frametop');
    const framebackground = document.querySelector('.framebackground');
    const frameleft = document.querySelector('.frameleft');
    const frameright = document.querySelector('.frameright');
    
    let isDragging = false;
    let initialMouseY = 0;      // Stores mouse Y when drag starts
    let initialFrameOffset = 0; // Stores frame's visual offset when drag starts
    let currentOffset = 0;      // Tracks the current actual visual offset of the frame
    let isOpen = false;
    
    window.frameSliderState = { isOpen: false }; // Global state
    
    // Ensure body overflow is hidden if the script intends to control scrolling.
    // The CSS also sets body overflow, JS inline style will take precedence.
    document.body.style.overflow = 'hidden'; 

    // Applies the visual offset to frame elements
    function applyFrameOffset(offsetValue) {
        // Ensure offsetValue is not negative
        const finalOffset = Math.max(0, offsetValue);

        const topElements = [frametop, document.querySelector('.corner1'), document.querySelector('.corner2')];
        const transform = `translateY(${finalOffset}px)`;
        
        topElements.forEach(el => {
            if (el) el.style.transform = transform;
        });

        const marginTop = `${finalOffset}px`;
        if (framebackground) framebackground.style.marginTop = marginTop;
        if (frameleft) frameleft.style.marginTop = marginTop;
        if (frameright) frameright.style.marginTop = marginTop;
    }

    // Handles interactive dragging, clamping the drag range
    function handleInteractiveDrag(newCalculatedTargetOffset) {
        const frameHeight = frameidle.offsetHeight;
        // Max offset user can achieve through direct dragging
        const maxInteractiveDragOffset = frameHeight * 0.5; 
        
        const clampedOffsetForDrag = Math.max(0, Math.min(maxInteractiveDragOffset, newCalculatedTargetOffset));
        
        requestAnimationFrame(() => {
            applyFrameOffset(clampedOffsetForDrag);
        });
        
        currentOffset = clampedOffsetForDrag; // Update currentOffset to the interactively dragged position
    }
    
    // Snaps the frame to open or closed position
    function snap() {
        const frameHeight = frameidle.offsetHeight;
        const snapOpenTargetOffset = frameHeight * 0.7; // Target when snapping open
        const snapClosedTargetOffset = 0;
        
        // Threshold to decide: if currentOffset (max 0.5*H from drag) is > 40% of snapOpenTargetOffset, then open.
        const decisionThreshold = snapOpenTargetOffset * 0.4; // e.g., 0.7H * 0.4 = 0.28H

        const finalSnapPosition = currentOffset > decisionThreshold ? snapOpenTargetOffset : snapClosedTargetOffset;

        isOpen = finalSnapPosition > 0;
        window.frameSliderState.isOpen = isOpen;

        const elementsToTransform = [frametop, document.querySelector('.corner1'), document.querySelector('.corner2')];
        const elementsToMargin = [framebackground, frameleft, frameright];

        elementsToTransform.forEach(el => {
            if (el) el.style.transition = 'transform 0.3s ease-out';
        });
        elementsToMargin.forEach(el => {
            if (el) el.style.transition = 'margin-top 0.3s ease-out';
        });
        
        requestAnimationFrame(() => {
            applyFrameOffset(finalSnapPosition);
        });
        
        currentOffset = finalSnapPosition; // Update currentOffset to the final snapped position

        setTimeout(() => {
            elementsToTransform.forEach(el => {
                if (el) el.style.transition = '';
            });
            elementsToMargin.forEach(el => {
                if (el) el.style.transition = '';
            });
        }, 300); // Duration of the snap animation
    }
    
    // Adjusts frame position on window resize
    window.addEventListener('resize', () => {
        const frameHeight = frameidle.offsetHeight; // Get current height
        let newTargetOffsetOnResize = 0;

        if (isOpen) {
            newTargetOffsetOnResize = frameHeight * 0.7; // Maintain open state at 70% of new height
        }
        // No transition needed for resize, apply directly
        requestAnimationFrame(() => {
            applyFrameOffset(newTargetOffsetOnResize);
        });
        currentOffset = newTargetOffsetOnResize;
    });
    
    // Mouse Events
    if (frametop) {
        frametop.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialMouseY = e.clientY;
            initialFrameOffset = currentOffset; // Capture the frame's current offset at drag start
            e.preventDefault(); // Prevent text selection, etc.
        });
    }
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaY = e.clientY - initialMouseY;
        const newTargetOffset = initialFrameOffset + deltaY;
        handleInteractiveDrag(newTargetOffset);
        // e.preventDefault(); // Usually not needed here unless specific issues arise
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            snap();
        }
    });
    
    // Touch Events
    if (frametop) {
        frametop.addEventListener('touchstart', (e) => {
            isDragging = true;
            initialMouseY = e.touches[0].clientY;
            initialFrameOffset = currentOffset;
            // preventDefault is important here if touch-action:none is not fully handling scroll prevention
            // or if you want to be absolutely sure.
            // CSS has touch-action: none on .frametop, which should help.
            e.preventDefault(); 
        }, { passive: false }); // Explicitly not passive due to preventDefault
    }
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return; 
        const deltaY = e.touches[0].clientY - initialMouseY;
        const newTargetOffset = initialFrameOffset + deltaY;
        handleInteractiveDrag(newTargetOffset);
        e.preventDefault(); // Prevent page scroll while dragging the frame element
    }, { passive: false }); // Explicitly not passive due to preventDefault
    
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            snap();
        }
    });
});