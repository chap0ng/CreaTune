document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('spriteContainer');
    const dragHandle = document.getElementById('dragHandle');
    const handleOverlay = document.getElementById('handleOverlay');
    const topTab = document.getElementById('topTab');
    const sprite = document.getElementById('sprite');
    const frameCoverLeft = document.getElementById('frameCoverLeft');
    const frameCoverRight = document.getElementById('frameCoverRight');
    const frameCoverTop = document.getElementById('frameCoverTop');
    
    let isDragging = false;
    let isTabOpen = false;
    let lastMouseY = 0;
    
    const tabHeight = 500;
    const handleHeight = 30;
    const snapThreshold = 30;
    let maxHandlePosition;
    
    function initDrag() {
        maxHandlePosition = container.offsetHeight * 0.7;
        dragHandle.style.top = '0px';
        updateOverlaySize();
        
        dragHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startDrag(e.clientY);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            stopSpriteAnimation();
        });
        
        dragHandle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrag(e.touches[0].clientY);
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
            stopSpriteAnimation();
        });

        window.addEventListener('resize', () => {
            maxHandlePosition = container.offsetHeight * 0.7;
            updateOverlaySize();
            if (isTabOpen) {
                const handleTop = parseInt(window.getComputedStyle(dragHandle).top, 10);
                topTab.style.top = `${handleTop - tabHeight}px`;
            }
        });
    }
    
    function updateOverlaySize() {
        const containerWidth = container.offsetWidth;
        handleOverlay.style.width = `${containerWidth}px`;
        const aspectRatio = 2340 / 150;
        const calculatedHeight = containerWidth / aspectRatio;
        if (calculatedHeight < handleHeight) {
            handleOverlay.style.backgroundSize = `100% ${handleHeight * 1.5}px`;
        }
    }
    
    function startDrag(clientY) {
        isDragging = true;
        lastMouseY = clientY;
        dragHandle.classList.add('dragging');
        topTab.classList.add('dragging');
    }
    
    function onMouseMove(e) {
        if (!isDragging) return;
        lastMouseY = e.clientY;
        updateHandlePosition(e.clientY);
        updateTabPosition();
        updateActiveState();
    }
    
    function showFrameCovers(show) {
        frameCoverLeft.style.display = show ? 'block' : 'none';
        frameCoverRight.style.display = show ? 'block' : 'none';
        frameCoverTop.style.display = show ? 'block' : 'none';
    }
    
    function updateHandlePosition(clientY) {
        const containerRect = container.getBoundingClientRect();
        let relativeY = clientY - containerRect.top;
        relativeY = Math.max(0, Math.min(maxHandlePosition, relativeY));
        dragHandle.style.top = `${relativeY}px`;
    }
    
    function updateTabPosition() {
        const handleTop = parseInt(window.getComputedStyle(dragHandle).top, 10);
        topTab.style.top = `${handleTop - tabHeight}px`;
        isTabOpen = handleTop > 30;
        
        if (isTabOpen) {
            container.classList.add('tab-open');
            topTab.style.backgroundImage = "url('assets/tab-top.png')";
        } else {
            container.classList.remove('tab-open');
            topTab.style.backgroundImage = "none";
        }
    }
    
    function updateActiveState() {
        const handleTop = parseInt(window.getComputedStyle(dragHandle).top, 10);
        if (handleTop > 5) {
            dragHandle.classList.add('active');
            showFrameCovers(true);
        } else {
            dragHandle.classList.remove('active');
            showFrameCovers(false);
        }
    }
    
    function onTouchMove(e) {
        if (!isDragging) return;
        const touchY = e.touches[0].clientY;
        lastMouseY = touchY;
        updateHandlePosition(touchY);
        updateTabPosition();
        updateActiveState();
    }
    
    function onMouseUp() {
        endDrag();
    }
    
    function onTouchEnd() {
        endDrag();
    }
    
    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        
        dragHandle.classList.remove('dragging');
        topTab.classList.remove('dragging');
        checkForHandleSnap();
    }
    
    function checkForHandleSnap() {
        const handleTop = parseInt(window.getComputedStyle(dragHandle).top, 10);
        
        if (handleTop < snapThreshold) {
            snapToClosed();
        } else if (handleTop > maxHandlePosition - snapThreshold) {
            snapToOpen();
        } else {
            maintainPosition(handleTop);
        }
    }
    
    function snapToClosed() {
        dragHandle.style.top = '0px';
        topTab.style.top = `-${tabHeight}px`;
        isTabOpen = false;
        container.classList.remove('tab-open');
        dragHandle.classList.remove('active');
        showFrameCovers(false);
        topTab.style.backgroundImage = "none";
        notifyTabClosed();
    }
    
    function snapToOpen() {
        dragHandle.style.top = `${maxHandlePosition}px`;
        topTab.style.top = `${maxHandlePosition - tabHeight}px`;
        isTabOpen = true;
        container.classList.add('tab-open');
        dragHandle.classList.add('active');
        showFrameCovers(true);
        topTab.style.backgroundImage = "url('assets/tab-top.png')";
        notifyTabFullyOpen();
    }
    
    function maintainPosition(handleTop) {
        topTab.style.top = `${handleTop - tabHeight}px`;
        showFrameCovers(true);
        container.classList.add('tab-open');
        topTab.style.backgroundImage = "url('assets/tab-top.png')";
        dragHandle.classList.add('active');
        notifyTabPartiallyOpen(handleTop / maxHandlePosition);
    }
    
    function stopSpriteAnimation() {
        if (window.spriteAnimation && window.spriteAnimation.isRunning()) {
            window.spriteAnimation.stop();
        }
    }
    
    function notifyTabClosed() {
        if (window.spriteAnimation && window.spriteAnimation.onTabClosed) {
            window.spriteAnimation.onTabClosed();
        }
    }
    
    function notifyTabFullyOpen() {
        if (window.spriteAnimation && window.spriteAnimation.onTabFullyOpen) {
            window.spriteAnimation.onTabFullyOpen();
        }
    }
    
    function notifyTabPartiallyOpen(percentage) {
        if (window.spriteAnimation && window.spriteAnimation.onTabPartiallyOpen) {
            window.spriteAnimation.onTabPartiallyOpen(percentage);
        }
    }
    
    initDrag();
    topTab.style.top = `-${tabHeight}px`;
    topTab.style.backgroundImage = "none";
    showFrameCovers(false);
    
    window.dragContainer = {
        isTabOpen: () => isTabOpen,
        getTabOpenPercentage: () => {
            const handleTop = parseInt(window.getComputedStyle(dragHandle).top, 10);
            return maxHandlePosition > 0 ? handleTop / maxHandlePosition : 0;
        },
        closeTab: () => snapToClosed(),
        openTab: () => snapToOpen()
    };
});