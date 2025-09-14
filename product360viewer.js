/**
 * Product360Viewer - Lightweight 360° Product Viewer
 * Drop-in solution for interactive product rotation
 * 
 * Usage:
 * <div id="product-viewer" data-images="path/to/images/" data-frames="36"></div>
 * <script src="product360viewer.js"></script>
 * <script>new Product360Viewer('#product-viewer');</script>
 */

class Product360Viewer {
    constructor(selector, options = {}) {
        this.container = typeof selector === 'string' 
            ? document.querySelector(selector) 
            : selector;
            
        if (!this.container) {
            console.error('Product360Viewer: Container not found');
            return;
        }
        
        // Default options
        this.options = {
            // Image settings
            totalFrames: parseInt(this.container.dataset.frames) || 36,
            imagePath: this.container.dataset.images || './images/',
            imagePrefix: this.container.dataset.prefix || 'frame_',
            imageExtension: this.container.dataset.extension || '.jpg',
            
            // Behavior settings
            autoRotate: this.container.dataset.autorotate === 'true' || false,
            rotationSpeed: parseInt(this.container.dataset.speed) || 3,
            sensitivity: parseFloat(this.container.dataset.sensitivity) || 1,
            clockwise: this.container.dataset.clockwise !== 'false',
            enableInertia: this.container.dataset.inertia !== 'false',
            preloadAll: this.container.dataset.preload !== 'false',
            
            // UI settings
            showControls: this.container.dataset.controls !== 'false',
            showProgress: this.container.dataset.progress !== 'false',
            showFullscreen: this.container.dataset.fullscreen !== 'false',
            
            // Size settings
            width: this.container.dataset.width || '100%',
            height: this.container.dataset.height || '400px',
            
            // Callbacks
            onLoad: options.onLoad || null,
            onRotate: options.onRotate || null,
            
            ...options
        };
        
        this.currentFrame = 0;
        this.isLoaded = false;
        this.isAutoRotating = false;
        this.isDragging = false;
        this.lastX = 0;
        this.velocity = 0;
        this.images = [];
        this.loadedCount = 0;
        
        this.init();
    }
    
    init() {
        this.createHTML();
        this.createImages();
        this.bindEvents();
        this.loadImages();
    }
    
    createHTML() {
        const width = this.options.width;
        const height = this.options.height;
        
        this.container.innerHTML = `
            <div class="p360-viewer" style="
                position: relative;
                width: ${width};
                height: ${height};
                background: #f5f5f5;
                border-radius: 8px;
                overflow: hidden;
                cursor: grab;
                user-select: none;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            ">
                <div class="p360-canvas" style="
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                "></div>
                
                <div class="p360-loading" style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255,255,255,0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    z-index: 10;
                ">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border: 4px solid #e3e3e3;
                        border-top: 4px solid #007bff;
                        border-radius: 50%;
                        animation: p360-spin 1s linear infinite;
                        margin-bottom: 10px;
                    "></div>
                    <div style="color: #666; font-size: 14px;">Loading...</div>
                </div>
                
                ${this.options.showProgress ? `
                <div class="p360-progress" style="
                    position: absolute;
                    bottom: 10px;
                    left: 10px;
                    right: 10px;
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 2px;
                    overflow: hidden;
                ">
                    <div class="p360-progress-bar" style="
                        width: 0%;
                        height: 100%;
                        background: #007bff;
                        border-radius: 2px;
                        transition: width 0.1s ease;
                    "></div>
                </div>
                ` : ''}
                
                ${this.options.showControls ? `
                <div class="p360-controls" style="
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    display: flex;
                    gap: 5px;
                    z-index: 5;
                ">
                    <button class="p360-btn p360-auto-btn" style="
                        background: rgba(0,0,0,0.7);
                        border: none;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.3s ease;
                    " title="Auto Rotate">⟲</button>
                    
                    <button class="p360-btn p360-reset-btn" style="
                        background: rgba(0,0,0,0.7);
                        border: none;
                        color: white;
                        padding: 8px 12px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 12px;
                        transition: all 0.3s ease;
                    " title="Reset View">⌂</button>
                </div>
                ` : ''}
                
                ${this.options.showFullscreen ? `
                <button class="p360-fullscreen-btn" style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(0,0,0,0.7);
                    border: none;
                    color: white;
                    padding: 8px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    z-index: 5;
                " title="Fullscreen">⛶</button>
                ` : ''}
            </div>
            
            <style>
                @keyframes p360-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .p360-viewer:active {
                    cursor: grabbing !important;
                }
                
                .p360-btn:hover, .p360-fullscreen-btn:hover {
                    background: rgba(0,0,0,0.9) !important;
                    transform: scale(1.1);
                }
                
                .p360-btn.active {
                    background: #007bff !important;
                }
                
                .p360-viewer img {
                    position: absolute;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    opacity: 0;
                    transition: opacity 0.1s ease;
                    pointer-events: none;
                    user-select: none;
                    -webkit-user-drag: none;
                }
                
                .p360-viewer img.active {
                    opacity: 1;
                }
                
                .p360-fullscreen {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 9999 !important;
                    background: #000 !important;
                    border-radius: 0 !important;
                }
            </style>
        `;
        
        this.canvas = this.container.querySelector('.p360-canvas');
        this.viewer = this.container.querySelector('.p360-viewer');
        this.loading = this.container.querySelector('.p360-loading');
        this.progressBar = this.container.querySelector('.p360-progress-bar');
    }
    
    createImages() {
        for (let i = 0; i < this.options.totalFrames; i++) {
            const img = document.createElement('img');
            
            // Use your actual image paths here
            const frameNumber = String(i + 1).padStart(3, '0');
            img.src = `${this.options.imagePath}${this.options.imagePrefix}${frameNumber}${this.options.imageExtension}`;
            
            img.alt = `Frame ${i + 1}`;
            img.classList.add('p360-frame');
            
            if (i === 0) {
                img.classList.add('active');
            }
            
            this.canvas.appendChild(img);
            this.images.push(img);
            
            if (this.options.preloadAll) {
                img.onload = () => this.onImageLoad();
                img.onerror = () => this.onImageError(i);
            }
        }
        
        if (!this.options.preloadAll) {
            // Load only first image initially
            this.images[0].onload = () => this.onImagesLoaded();
        }
    }
    
    onImageLoad() {
        this.loadedCount++;
        if (this.loadedCount === this.options.totalFrames) {
            this.onImagesLoaded();
        }
    }
    
    onImageError(index) {
        console.warn(`Product360Viewer: Failed to load image at index ${index}`);
        this.loadedCount++;
        if (this.loadedCount === this.options.totalFrames) {
            this.onImagesLoaded();
        }
    }
    
    onImagesLoaded() {
        this.isLoaded = true;
        this.loading.style.display = 'none';
        this.updateProgress();
        
        if (this.options.onLoad) {
            this.options.onLoad(this);
        }
        
        if (this.options.autoRotate) {
            this.startAutoRotate();
        }
    }
    
    bindEvents() {
        // Mouse events
        this.viewer.addEventListener('mousedown', this.onPointerDown.bind(this));
        document.addEventListener('mousemove', this.onPointerMove.bind(this));
        document.addEventListener('mouseup', this.onPointerUp.bind(this));
        
        // Touch events
        this.viewer.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.viewer.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.viewer.addEventListener('touchend', this.onPointerUp.bind(this));
        
        // Control buttons
        const autoBtn = this.container.querySelector('.p360-auto-btn');
        const resetBtn = this.container.querySelector('.p360-reset-btn');
        const fullscreenBtn = this.container.querySelector('.p360-fullscreen-btn');
        
        if (autoBtn) autoBtn.addEventListener('click', this.toggleAutoRotate.bind(this));
        if (resetBtn) resetBtn.addEventListener('click', this.resetView.bind(this));
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', this.toggleFullscreen.bind(this));
        
        // Prevent context menu
        this.viewer.addEventListener('contextmenu', e => e.preventDefault());
    }
    
    onPointerDown(e) {
        if (!this.isLoaded) return;
        this.isDragging = true;
        this.lastX = e.clientX || e.touches[0].clientX;
        this.velocity = 0;
        this.stopAutoRotate();
    }
    
    onTouchStart(e) {
        if (!this.isLoaded) return;
        e.preventDefault();
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.velocity = 0;
        this.stopAutoRotate();
    }
    
    onPointerMove(e) {
        if (!this.isDragging || !this.isLoaded) return;
        
        const currentX = e.clientX || (e.touches && e.touches[0].clientX);
        if (!currentX) return;
        
        const deltaX = currentX - this.lastX;
        const threshold = 3; // Minimum movement threshold
        
        if (Math.abs(deltaX) > threshold) {
            this.velocity = deltaX * this.options.sensitivity;
            this.rotateByDelta(deltaX);
            this.lastX = currentX;
        }
    }
    
    onTouchMove(e) {
        if (!this.isDragging || !this.isLoaded) return;
        e.preventDefault();
        this.onPointerMove(e);
    }
    
    onPointerUp() {
        this.isDragging = false;
        
        if (this.options.enableInertia && Math.abs(this.velocity) > 2) {
            this.applyInertia();
        }
    }
    
    rotateByDelta(deltaX) {
        const sensitivity = this.options.sensitivity * 0.1;
        const frameChange = Math.round(deltaX * sensitivity);
        
        if (frameChange !== 0) {
            this.rotateBy(frameChange);
        }
    }
    
    rotateBy(frames) {
        const direction = this.options.clockwise ? 1 : -1;
        this.currentFrame = (this.currentFrame + (frames * direction) + this.options.totalFrames) % this.options.totalFrames;
        this.showFrame(this.currentFrame);
        this.updateProgress();
        
        if (this.options.onRotate) {
            this.options.onRotate(this.currentFrame, this);
        }
    }
    
    showFrame(frameIndex) {
        this.images.forEach((img, index) => {
            img.classList.toggle('active', index === frameIndex);
        });
    }
    
    updateProgress() {
        if (this.progressBar) {
            const progress = (this.currentFrame / (this.options.totalFrames - 1)) * 100;
            this.progressBar.style.width = progress + '%';
        }
    }
    
    applyInertia() {
        if (Math.abs(this.velocity) < 0.5) return;
        
        this.rotateByDelta(this.velocity);
        this.velocity *= 0.95; // Decay factor
        
        requestAnimationFrame(() => this.applyInertia());
    }
    
    // Public API methods
    startAutoRotate() {
        this.isAutoRotating = true;
        const btn = this.container.querySelector('.p360-auto-btn');
        if (btn) btn.classList.add('active');
        
        this.autoRotateInterval = setInterval(() => {
            this.rotateBy(1);
        }, 150 / this.options.rotationSpeed);
    }
    
    stopAutoRotate() {
        this.isAutoRotating = false;
        const btn = this.container.querySelector('.p360-auto-btn');
        if (btn) btn.classList.remove('active');
        
        if (this.autoRotateInterval) {
            clearInterval(this.autoRotateInterval);
            this.autoRotateInterval = null;
        }
    }
    
    toggleAutoRotate() {
        if (this.isAutoRotating) {
            this.stopAutoRotate();
        } else {
            this.startAutoRotate();
        }
    }
    
    resetView() {
        this.currentFrame = 0;
        this.showFrame(0);
        this.updateProgress();
        this.stopAutoRotate();
    }
    
    goToFrame(frameIndex) {
        if (frameIndex >= 0 && frameIndex < this.options.totalFrames) {
            this.currentFrame = frameIndex;
            this.showFrame(frameIndex);
            this.updateProgress();
        }
    }
    
    toggleFullscreen() {
        if (!this.viewer.classList.contains('p360-fullscreen')) {
            this.viewer.classList.add('p360-fullscreen');
            if (this.viewer.requestFullscreen) {
                this.viewer.requestFullscreen().catch(() => {
                    // Fallback for browsers that don't support fullscreen
                });
            }
        } else {
            this.viewer.classList.remove('p360-fullscreen');
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }
    
    destroy() {
        this.stopAutoRotate();
        
        // Remove event listeners
        this.viewer.removeEventListener('mousedown', this.onPointerDown);
        document.removeEventListener('mousemove', this.onPointerMove);
        document.removeEventListener('mouseup', this.onPointerUp);
        
        // Clear container
        this.container.innerHTML = '';
    }
}

// Auto-initialize viewers with data attributes
document.addEventListener('DOMContentLoaded', function() {
    const viewers = document.querySelectorAll('[data-product360]');
    viewers.forEach(viewer => {
        new Product360Viewer(viewer);
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Product360Viewer;
}

// Global for direct usage
if (typeof window !== 'undefined') {
    window.Product360Viewer = Product360Viewer;
}
