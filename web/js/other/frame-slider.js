document.addEventListener('DOMContentLoaded', () => {
    const frameidle = document.querySelector('.frameidle');
    const frametop = document.querySelector('.frametop');
    const framebackground = document.querySelector('.framebackground');
    const frameleft = document.querySelector('.frameleft');
    const frameright = document.querySelector('.frameright');

    // Get references to UI elements
    const interactiveUIContainer = document.getElementById('interactive-ui-container'); // Updated
    const notesDisplay = document.getElementById('notes-display');
    const songModeToggle = document.getElementById('song-mode-toggle');
    const songModeToggleImg = songModeToggle ? songModeToggle.querySelector('img') : null;
    
    let isDragging = false;
    let initialMouseY = 0;
    let initialFrameOffset = 0;
    let currentOffset = 0;
    let isOpen = false;
    
    let isSongModeActive = false;
    const songModeActiveImgSrc = 'sprites/ui/song_mode_active.png';
    const songModeInactiveImgSrc = 'sprites/ui/song_mode_inactive.png';

    window.frameSliderState = { 
        isOpen: false,
        isSongModeActive: false
    };
    
    document.body.style.overflow = 'hidden'; 

    function applyFrameOffset(offsetValue) {
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

    function handleInteractiveDrag(newCalculatedTargetOffset) {
        if (!frameidle) return;
        const frameHeight = frameidle.offsetHeight;
        const maxInteractiveDragOffset = frameHeight * 0.5; 
        const clampedOffsetForDrag = Math.max(0, Math.min(maxInteractiveDragOffset, newCalculatedTargetOffset));
        
        requestAnimationFrame(() => {
            applyFrameOffset(clampedOffsetForDrag);
        });
        currentOffset = clampedOffsetForDrag;
    }
    
    function updateInteractiveUIState(isFrameOpen) {
        // Toggle visibility of the container
        if (interactiveUIContainer) { 
            interactiveUIContainer.classList.toggle('visible', isFrameOpen);
        }
    }

    function snap() {
        if (!frameidle) return;
        const frameHeight = frameidle.offsetHeight;
        const snapOpenTargetOffset = frameHeight * 0.7;
        const snapClosedTargetOffset = 0;
        const decisionThreshold = snapOpenTargetOffset * 0.4;
        const finalSnapPosition = currentOffset > decisionThreshold ? snapOpenTargetOffset : snapClosedTargetOffset;

        isOpen = finalSnapPosition > 0;
        window.frameSliderState.isOpen = isOpen;
        updateInteractiveUIState(isOpen); 

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
        currentOffset = finalSnapPosition;

        setTimeout(() => {
            elementsToTransform.forEach(el => {
                if (el) el.style.transition = '';
            });
            elementsToMargin.forEach(el => {
                if (el) el.style.transition = '';
            });
        }, 300);
    }
    
    window.addEventListener('resize', () => {
        if (!frameidle) return;
        const frameHeight = frameidle.offsetHeight;
        let newTargetOffsetOnResize = 0;

        if (isOpen) {
            newTargetOffsetOnResize = frameHeight * 0.7;
        }
        requestAnimationFrame(() => {
            applyFrameOffset(newTargetOffsetOnResize);
        });
        currentOffset = newTargetOffsetOnResize;
        updateInteractiveUIState(isOpen); 
    });
    
    if (frameidle) {
        if (frametop) {
            frametop.addEventListener('mousedown', (e) => {
                isDragging = true;
                initialMouseY = e.clientY;
                initialFrameOffset = currentOffset;
                e.preventDefault();
            });
        }
    }
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaY = e.clientY - initialMouseY;
        const newTargetOffset = initialFrameOffset + deltaY;
        handleInteractiveDrag(newTargetOffset);
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            snap();
        }
    });
    
    if (frametop) {
        frametop.addEventListener('touchstart', (e) => {
            isDragging = true;
            initialMouseY = e.touches[0].clientY;
            initialFrameOffset = currentOffset;
            e.preventDefault(); 
        }, { passive: false }); 
    }
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return; 
        const deltaY = e.touches[0].clientY - initialMouseY;
        const newTargetOffset = initialFrameOffset + deltaY;
        handleInteractiveDrag(newTargetOffset);
        e.preventDefault(); 
    }, { passive: false }); 
    
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            snap();
        }
    });

    if (songModeToggle && songModeToggleImg) {
        songModeToggle.addEventListener('click', () => {
            isSongModeActive = !isSongModeActive;
            songModeToggleImg.src = isSongModeActive ? songModeActiveImgSrc : songModeInactiveImgSrc;
            window.frameSliderState.isSongModeActive = isSongModeActive;
            console.log('Song mode toggled:', isSongModeActive);
        });
    }

    window.updateNotesDisplay = function(notesText) {
        if (notesDisplay) {
            notesDisplay.textContent = notesText;
        }
    }
    
    // Initialize UI state
    updateInteractiveUIState(isOpen);
});