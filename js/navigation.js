// Navigation and Smooth Scrolling Functions

// Smooth scroll to sections
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Navigation functions called from HTML
function scrollToGame() {
    scrollToSection('game');
}

function scrollToLobby() {
    scrollToSection('game');
}

function scrollToAbout() {
    scrollToSection('about');
}

function scrollToSocials() {
    scrollToSection('socials');
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Expose startDemoGame safely after load
    window.startDemoGame = startDemoGame;
});



// Demo game function (now just scrolls to lobby)
function startDemoGame() {
    // Just scroll to lobby system instead of launching demo
    scrollToLobby();
}

// Original demo game launcher (for manual testing if needed)
function launchDemoGame() {
    var scrollTargetId = document.getElementById('game-interface') ? 'game-interface' : 'game';
    scrollToSection(scrollTargetId);

    function tryStart(attempt) {
        attempt = attempt || 0;
        try {
            if (!window.gameInterface || typeof window.gameInterface.startDemoGame !== 'function') {
                if (attempt < 20) {
                    return setTimeout(function() { tryStart(attempt + 1); }, 100);
                }
                throw new Error('GameInterface not ready');
            }

            if (!window.gameInterface.playerName) {
                window.gameInterface.playerName = 'DemoPlayer';
            }

            // Start on the next frame to ensure layout present
            requestAnimationFrame(function() {
                window.gameInterface.startDemoGame();
            });
        } catch (e) {
            console.error('Failed to start demo game:', e);
            if (window.gameInterface && typeof window.gameInterface.showMessage === 'function') {
                window.gameInterface.showMessage('Unable to start the demo. Please refresh and try again.', 'error');
            } else {
                alert('Unable to start the demo right now. Please refresh and try again.');
            }
        }
    }

    tryStart(0);
}

// Expose globally just in case
window.startDemoGame = startDemoGame;
