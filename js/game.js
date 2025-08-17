// Game Interface and Local Game Logic

class GameInterface {
    constructor() {
        this.playerName = '';
        this.currentLobby = null;
        this.gameState = 'name-entry'; // name-entry, lobby-selection, in-lobby, in-game
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showNameRegistration();
    }

    setupEventListeners() {
        // Name registration
        const setNameBtn = document.getElementById('set-name-btn');
        const playerNameInput = document.getElementById('player-name');
        
        if (setNameBtn) {
            setNameBtn.addEventListener('click', () => this.setPlayerName());
        }
        
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.setPlayerName();
                }
            });
        }

        // Lobby controls
        const createLobbyBtn = document.getElementById('create-lobby-btn');
        const refreshLobbiesBtn = document.getElementById('refresh-lobbies-btn');
        const confirmCreateLobby = document.getElementById('confirm-create-lobby');
        const cancelCreateLobby = document.getElementById('cancel-create-lobby');

        if (createLobbyBtn) {
            createLobbyBtn.addEventListener('click', () => this.showLobbyCreation());
        }

        if (refreshLobbiesBtn) {
            refreshLobbiesBtn.addEventListener('click', () => this.refreshLobbies());
        }

        if (confirmCreateLobby) {
            confirmCreateLobby.addEventListener('click', () => this.createLobby());
        }

        if (cancelCreateLobby) {
            cancelCreateLobby.addEventListener('click', () => this.hideLobbyCreation());
        }
    }

    setPlayerName() {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();

        if (name.length < 2) {
            this.showMessage('Name must be at least 2 characters long!', 'error');
            return;
        }

        if (name.length > 20) {
            this.showMessage('Name must be less than 20 characters!', 'error');
            return;
        }

        // Basic profanity filter (simple version)
        const profanityWords = ['fuck', 'shit', 'damn', 'bitch', 'ass'];
        const lowerName = name.toLowerCase();
        if (profanityWords.some(word => lowerName.includes(word))) {
            this.showMessage('Please choose a more appropriate name!', 'error');
            return;
        }

        this.playerName = name;
        this.gameState = 'lobby-selection';
        this.showLobbySystem();
        
        // Notify multiplayer system if available
        if (window.multiplayerManager) {
            window.multiplayerManager.setPlayerName(name);
        }
    }

    showNameRegistration() {
        const nameReg = document.getElementById('name-registration');
        const lobbySystem = document.getElementById('lobby-system');
        const gameInterface = document.getElementById('game-interface');

        if (nameReg) nameReg.style.display = 'block';
        if (lobbySystem) lobbySystem.style.display = 'none';
        if (gameInterface) gameInterface.style.display = 'none';
    }

    showLobbySystem() {
        const nameReg = document.getElementById('name-registration');
        const lobbySystem = document.getElementById('lobby-system');
        const gameInterface = document.getElementById('game-interface');

        if (nameReg) nameReg.style.display = 'none';
        if (lobbySystem) lobbySystem.style.display = 'block';
        if (gameInterface) gameInterface.style.display = 'none';

        this.refreshLobbies();
    }

    showLobbyCreation() {
        const lobbyCreation = document.getElementById('lobby-creation');
        if (lobbyCreation) {
            lobbyCreation.style.display = 'block';
        }
    }

    hideLobbyCreation() {
        const lobbyCreation = document.getElementById('lobby-creation');
        if (lobbyCreation) {
            lobbyCreation.style.display = 'none';
        }
    }

    createLobby() {
        const lobbyNameInput = document.getElementById('lobby-name');
        const maxPlayersSelect = document.getElementById('max-players');

        const lobbyName = lobbyNameInput.value.trim();
        const maxPlayers = parseInt(maxPlayersSelect.value);

        if (lobbyName.length < 3) {
            this.showMessage('Lobby name must be at least 3 characters!', 'error');
            return;
        }

        // Notify multiplayer system
        if (window.multiplayerManager) {
            window.multiplayerManager.createLobby(lobbyName, maxPlayers);
        }

        this.hideLobbyCreation();
        lobbyNameInput.value = '';
    }

    refreshLobbies() {
        // Request lobby list from multiplayer system
        if (window.multiplayerManager) {
            window.multiplayerManager.requestLobbyList();
        } else {
            // Show placeholder if no multiplayer connection
            this.displayLobbies([]);
        }
    }

    displayLobbies(lobbies) {
        const lobbiesList = document.getElementById('lobbies-list');
        if (!lobbiesList) return;

        if (lobbies.length === 0) {
            lobbiesList.innerHTML = `
                <div class="no-lobbies">
                    <p>No lobbies available. Create one to get started!</p>
                </div>
            `;
            return;
        }

        lobbiesList.innerHTML = lobbies.map(lobby => `
            <div class="lobby-item" data-lobby-id="${lobby.id}">
                <div class="lobby-info">
                    <h5>${lobby.name}</h5>
                    <p>Players: ${lobby.currentPlayers}/${lobby.maxPlayers}</p>
                    <p>Status: ${lobby.status}</p>
                </div>
                <button class="btn btn-primary join-lobby-btn" 
                        onclick="gameInterface.joinLobby('${lobby.id}')"
                        ${lobby.currentPlayers >= lobby.maxPlayers ? 'disabled' : ''}>
                    ${lobby.currentPlayers >= lobby.maxPlayers ? 'FULL' : 'JOIN'}
                </button>
            </div>
        `).join('');
    }

    joinLobby(lobbyId) {
        if (window.multiplayerManager) {
            window.multiplayerManager.joinLobby(lobbyId);
        }
    }

    showGameInterface() {
        const nameReg = document.getElementById('name-registration');
        const lobbySystem = document.getElementById('lobby-system');
        const gameInterface = document.getElementById('game-interface');

        if (nameReg) nameReg.style.display = 'none';
        if (lobbySystem) lobbySystem.style.display = 'none';
        if (gameInterface) gameInterface.style.display = 'block';

        this.gameState = 'in-game';
    }

    // Demo mode for testing the game interface
    startDemoGame() {
        const me = this.playerName || 'You';
        const demoGameData = {
            currentJudge: me,
            currentRound: 1,
            totalRounds: 3,
            phase: 'playing',
            currentPrompt: {
                text: "Just had a {0} with {1}. They said {2}. Fake news!",
                blanks: 3
            },
            playerHand: [
                "the fake news media",
                "tremendous success",
                "very smart people",
                "believe me",
                "China",
                "the best deal ever",
                "crooked politicians",
                "beautiful phone call",
                "tremendous phone call",
                "perfect conversation",
                "witch hunt",
                "total disaster"
            ],
            selectedCards: [],
            scores: {
                [me]: 0
            },
            waitingFor: []
        };

        // Show the game interface within the newspaper
        const gameInterface = document.getElementById('game-interface');
        if (gameInterface) {
            gameInterface.style.display = 'block';
        }

        if (window.multiplayerManager) {
            window.multiplayerManager.renderGameInterface(demoGameData);
        }
    }

    showMessage(message, type = 'info') {
        // Create or update message display
        let messageDiv = document.getElementById('game-message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'game-message';
            messageDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                border-radius: 5px;
                font-weight: bold;
                z-index: 1000;
                max-width: 300px;
                word-wrap: break-word;
            `;
            document.body.appendChild(messageDiv);
        }

        messageDiv.textContent = message;
        messageDiv.className = `message-${type}`;
        
        // Style based on type
        if (type === 'error') {
            messageDiv.style.backgroundColor = '#ff4444';
            messageDiv.style.color = 'white';
        } else if (type === 'success') {
            messageDiv.style.backgroundColor = '#44ff44';
            messageDiv.style.color = 'black';
        } else {
            messageDiv.style.backgroundColor = '#4444ff';
            messageDiv.style.color = 'white';
        }

        messageDiv.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageDiv) {
                messageDiv.style.display = 'none';
            }
        }, 3000);
    }
}

// Initialize game interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gameInterface = new GameInterface();
});

// Add CSS for lobby items
const lobbyStyle = document.createElement('style');
lobbyStyle.textContent = `
    .lobby-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        background-color: white;
        border: 2px solid var(--border-color);
        margin-bottom: 10px;
    }
    
    .lobby-item:hover {
        border-color: var(--trump-red);
    }
    
    .lobby-info h5 {
        margin: 0 0 5px 0;
        color: var(--trump-red);
        font-size: 1.2rem;
    }
    
    .lobby-info p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-dark);
    }
    
    .no-lobbies {
        text-align: center;
        padding: 40px;
        color: var(--text-dark);
        font-style: italic;
    }
    
    .join-lobby-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;
document.head.appendChild(lobbyStyle);
