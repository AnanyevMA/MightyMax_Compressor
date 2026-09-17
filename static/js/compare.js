/**
 * Interactive Before / After Image Comparison Slider Module
 */
class ImageCompareModal {
    constructor() {
        this.modal = document.getElementById('compare-modal');
        this.closeBtn = document.getElementById('compare-modal-close');
        this.viewer = document.getElementById('compare-viewer');
        this.imgBefore = document.getElementById('compare-img-before');
        this.imgAfter = document.getElementById('compare-img-after');
        this.overlay = document.getElementById('compare-overlay');
        this.handle = document.getElementById('compare-handle');
        this.titleEl = document.getElementById('compare-modal-title');
        this.statsEl = document.getElementById('compare-modal-stats');

        this.isDragging = false;
        this.initEvents();
    }

    initEvents() {
        if (!this.modal) return;

        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });

        const startDrag = (e) => {
            this.isDragging = true;
            this.updatePosition(e);
        };

        const stopDrag = () => {
            this.isDragging = false;
        };

        const onDrag = (e) => {
            if (!this.isDragging) return;
            this.updatePosition(e);
        };

        // Mouse events
        this.viewer.addEventListener('mousedown', startDrag);
        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('mousemove', onDrag);

        // Touch events
        this.viewer.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.updatePosition(e.touches[0]);
        }, { passive: true });
        window.addEventListener('touchend', stopDrag);
        window.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            this.updatePosition(e.touches[0]);
        }, { passive: true });
    }

    isOpen() {
        return this.modal.style.display === 'flex';
    }

    open(data) {
        // data: { name, originalUrl, compressedUrl, origSizeStr, compSizeStr, ratioStr }
        this.titleEl.textContent = `Сравнение: ${data.name}`;
        this.statsEl.textContent = `До: ${data.origSizeStr} → После: ${data.compSizeStr} (${data.ratioStr})`;

        this.imgBefore.src = data.originalUrl;
        this.imgAfter.src = data.compressedUrl;

        // Reset split to 50%
        this.setSliderPosition(50);

        this.modal.style.display = 'flex';

        // Match inner overlay image dimensions once loaded
        const syncSizes = () => {
            const rect = this.imgAfter.getBoundingClientRect();
            if (rect.width > 0) {
                this.imgBefore.style.width = `${rect.width}px`;
                this.imgBefore.style.height = `${rect.height}px`;
            }
        };

        this.imgAfter.onload = syncSizes;
        window.addEventListener('resize', syncSizes);
    }

    close() {
        this.modal.style.display = 'none';
        this.imgBefore.src = '';
        this.imgAfter.src = '';
    }

    updatePosition(e) {
        const rect = this.viewer.getBoundingClientRect();
        if (!rect.width) return;
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const percent = (x / rect.width) * 100;
        this.setSliderPosition(percent);
    }

    setSliderPosition(percent) {
        percent = Math.max(0, Math.min(100, percent));
        this.overlay.style.width = `${percent}%`;
        this.handle.style.left = `${percent}%`;
    }
}

// Global instance
window.compareModal = null;
document.addEventListener('DOMContentLoaded', () => {
    window.compareModal = new ImageCompareModal();
});
