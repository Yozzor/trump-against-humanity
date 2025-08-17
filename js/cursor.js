// Custom Trump Mouth Cursor System

class TrumpCursor {
    constructor() {
        this.defaultCursor = 'url("./images/trump mouth 4.png") 16 16, auto';
        this.clickCursor = 'url("./images/trump mouth1.png") 16 16, auto';
        this.hoverCursor = 'url("./images/trump mouth1.png") 16 16, pointer';
        this.isHovering = false;
        
        this.init();
    }

    init() {
        // Add click event listeners for click state
        document.addEventListener('mousedown', () => this.onMouseDown());
        document.addEventListener('mouseup', () => this.onMouseUp());

        // Add hover event listeners for interactive elements
        this.addHoverListeners();

        console.log('🎯 Trump cursor system initialized!');

        // Test cursor loading
        this.testCursorImages();
    }

    onMouseDown() {
        document.body.classList.add('clicking');
    }

    onMouseUp() {
        document.body.classList.remove('clicking');
    }

    startHoverAnimation() {
        // CSS handles hover cursors automatically
        this.isHovering = true;
    }

    stopHoverAnimation() {
        // CSS handles hover cursors automatically
        this.isHovering = false;
    }

    testCursorImages() {
        // Test if cursor images load
        const img1 = new Image();
        const img2 = new Image();

        img1.onload = () => {
            console.log('✅ trump mouth 4.png loaded successfully', img1.width + 'x' + img1.height);
        };
        img1.onerror = () => {
            console.error('❌ Failed to load trump mouth 4.png');
        };

        img2.onload = () => {
            console.log('✅ trump mouth1.png loaded successfully', img2.width + 'x' + img2.height);
        };
        img2.onerror = () => {
            console.error('❌ Failed to load trump mouth1.png');
        };

        img1.src = './images/trump mouth 4.png';
        img2.src = './images/trump mouth1.png';
    }

    addHoverListeners() {
        // Elements that should trigger hover animation
        const hoverElements = [
            'img', 'video', 'button', 'a', '.btn', 
            '.social-link', '.feature', '.lobby-item',
            'input', 'select', '.game-card'
        ];

        hoverElements.forEach(selector => {
            document.addEventListener('mouseover', (e) => {
                if (e.target.matches(selector) || e.target.closest(selector)) {
                    this.isHovering = true;
                    this.startHoverAnimation();
                }
            });

            document.addEventListener('mouseout', (e) => {
                if (e.target.matches(selector) || e.target.closest(selector)) {
                    this.isHovering = false;
                    this.stopHoverAnimation();
                }
            });
        });
    }
}

// Initialize cursor system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TrumpCursor();
});

// Add CSS for cursor images and styling
const cursorStyle = document.createElement('style');
cursorStyle.textContent = `
    /* Trump Cursor Styles */
    body {
        cursor: url('./images/trump mouth 4.png') 16 16, auto !important;
    }

    /* Hover cursors for interactive elements */
    a, button, .btn, .social-link, .feature, .lobby-item,
    img, video, select, .game-card, [onclick], [role="button"] {
        cursor: url('./images/trump mouth1.png') 16 16, pointer !important;
    }

    /* Click state */
    body.clicking {
        cursor: url('images/trump mouth1.png') 16 16, auto !important;
    }

    /* Special cursor for text inputs */
    input[type="text"], input[type="email"], input[type="password"],
    input[type="search"], textarea {
        cursor: text !important;
    }

    /* Preload cursor images */
    body::after {
        content: '';
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 1px;
        height: 1px;
        background-image:
            url('./images/trump mouth 4.png'),
            url('./images/trump mouth1.png');
    }
`;
document.head.appendChild(cursorStyle);
