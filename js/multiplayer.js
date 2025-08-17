// Multiplayer Manager using Socket.io

// Use global configuration from config.js
const CONFIG = window.TRUMP_CONFIG || {
    // Fallback configuration if config.js fails to load
    isDevelopment: true,
    BACKEND_URL: 'http://localhost:3000',
    socketOptions: {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
    }
};

class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.playerName = '';
        this.currentLobby = null;
        this.gameState = null;
        this.connected = false;
        // Track local card selection always (online/offline)
        this.localSelection = { selectedCards: [], maxCards: 1 };
        // Offline demo session state
        this.demoSession = null; // { currentRound, totalRounds, scores, prompts }
        this.localGameData = null; // last rendered gameData in offline mode

        // Cards Against Humanity game state
        this.cahGameState = {
            players: ['You', 'AI Player 1', 'AI Player 2', 'AI Player 3'],
            scores: {},
            currentJudgeIndex: 0,
            winningScore: 5,
            gameStarted: false,
            // Voting system
            currentVotes: {},
            votingPhase: false,
            hasVoted: false
        };

        // Timer system
        this.currentTimer = null;
        this.timerInterval = null;
        this.timerCallbacks = [];

        // Audio taunt system
        this.audioTaunts = [
            'bomb you.mp3',
            'come on satan.mp3',
            'dictator from the middle east.mp3',
            'fckn sue you.mp3',
            'get this guy out of here.mp3',
            'hahaha.mp3',
            'hey satan.mp3',
            'iran iraq.mp3',
            'nobody makes fun of me.mp3',
            'oh come on satan.mp3',
            'oh come on.mp3',
            'relax guy.mp3',
            'small dick.mp3',
            'sue you.mp3',
            'take a rest.mp3',
            'what the f.mp3'
        ];
        this.lastTauntTime = 0;
        this.tauntCooldown = 10000; // 10 seconds

        this.init();
    }

    init() {
        this.connectToServer();
    }

    connectToServer() {
        try {
            if (typeof io === 'undefined') {
                console.error('❌ Socket.io not loaded yet');
                setTimeout(() => this.connectToServer(), 500);
                return;
            }

            console.log(`🔌 Connecting to backend: ${CONFIG.BACKEND_URL}`);

            // Connect to Socket.io server with environment-specific configuration
            this.socket = io(CONFIG.BACKEND_URL, CONFIG.socketOptions);

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.connected = true;
                this.setupEventListeners();
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.connected = false;
                this.showConnectionError();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.connected = false;
                this.showConnectionError();
            });

        } catch (error) {
            console.error('Failed to initialize Socket.io:', error);
            this.showConnectionError();
        }
    }

    setupEventListeners() {
        if (!this.socket) return;

        // Lobby events
        this.socket.on('lobby-list', (lobbies) => {
            if (window.gameInterface) {
                window.gameInterface.displayLobbies(lobbies);
            }
        });

        this.socket.on('lobby-created', (lobby) => {
            this.currentLobby = lobby;
            this.showMessage('Lobby created successfully!', 'success');
            this.requestLobbyList();
        });

        this.socket.on('lobby-joined', (lobby) => {
            this.currentLobby = lobby;
            console.log('lobby-joined event received, currentLobby set to:', this.currentLobby);
            this.showMessage(`Joined lobby: ${lobby.name}`, 'success');
            this.showLobbyWaitingRoom(lobby);
        });

        this.socket.on('lobby-updated', (lobby) => {
            this.currentLobby = lobby;
            console.log('lobby-updated event received, currentLobby updated to:', this.currentLobby);
            this.updateLobbyWaitingRoom(lobby);
        });

        this.socket.on('lobby-left', () => {
            this.currentLobby = null;
            this.showMessage('Left lobby successfully', 'success');
            console.log('Lobby left event received, calling showLobbySystem');
            if (window.gameInterface) {
                window.gameInterface.showLobbySystem();
            }
        });

        this.socket.on('game-started', (gameData) => {
            console.log('game-started event received:', gameData);
            this.gameState = gameData;
            this.onGameStarted(gameData);
        });

        this.socket.on('game-updated', (gameData) => {
            this.gameState = gameData;

            // Clear any existing timer to prevent carryover
            this.clearTimer();
            console.log('🔄 Game updated - timer cleared for fresh start');

            this.updateGame(gameData);

            // Update card selection visual state after render
            setTimeout(() => {
                this.updateCardSelection();
            }, 100);
        });

        this.socket.on('game-ended', (results) => {
            this.showGameResults(results);
        });

        // Error handling
        this.socket.on('error', (error) => {
            this.showMessage(error.message, 'error');
        });

        this.socket.on('player-disconnected', (playerName) => {
            this.showMessage(`${playerName} disconnected`, 'info');
        });

        this.socket.on('player-reconnected', (playerName) => {
            this.showMessage(`${playerName} reconnected`, 'success');
        });

        this.socket.on('soundboard-played', (data) => {
            console.log(`🔊 Soundboard played by ${data.playerName}: ${data.soundId}`);
            this.showMessage(`${data.playerName} played: ${data.soundId}`, 'info');
            // Play the sound locally for all players
            this.playLocalSound(data.soundId);
        });
    }

    setPlayerName(name) {
        this.playerName = name;
        if (this.socket && this.connected) {
            this.socket.emit('set-name', name);
        }
    }

    createLobby(name, maxPlayers) {
        if (this.socket && this.connected) {
            this.socket.emit('create-lobby', { name, maxPlayers });
        } else {
            this.showMessage('Not connected to server', 'error');
        }
    }

    joinLobby(lobbyId) {
        if (this.socket && this.connected) {
            this.socket.emit('join-lobby', lobbyId);
        } else {
            this.showMessage('Not connected to server', 'error');
        }
    }

    leaveLobby() {
        if (this.socket && this.connected) {
            this.socket.emit('leave-lobby');
            // Don't immediately change state - wait for server confirmation
        } else {
            // If not connected, just return to lobby selection
            this.currentLobby = null;
            if (window.gameInterface) {
                window.gameInterface.showLobbySystem();
            }
        }
    }

    requestLobbyList() {
        if (this.socket && this.connected) {
            this.socket.emit('get-lobbies');
        }
    }

    startGame() {
        console.log('🎮 startGame() SENDER method called');
        console.log('Socket connected:', this.socket && this.connected);
        console.log('Current lobby:', this.currentLobby);

        if (this.socket && this.connected && this.currentLobby) {
            console.log('✅ Emitting start-game event to server');
            this.socket.emit('start-game');
        } else {
            console.log('❌ Cannot start game - missing socket, connection, or lobby');
            console.log('Socket exists:', !!this.socket);
            console.log('Connected:', this.connected);
            console.log('Current lobby exists:', !!this.currentLobby);
        }
    }

    submitCard(cardId) {
        if (this.socket && this.connected) {
            this.socket.emit('submit-card', cardId);
        }
    }

    selectWinner(cardId) {
        if (this.socket && this.connected) {
            this.socket.emit('select-winner', cardId);
        }
    }

    playSoundboard(soundId) {
        if (this.socket && this.connected) {
            console.log(`🔊 Playing soundboard: ${soundId}`);
            this.socket.emit('play-soundboard', soundId);
        } else {
            // Demo mode - play locally only
            this.playLocalSound(soundId);
        }
    }

    playLocalSound(soundId) {
        // Play the actual sound effect
        console.log(`🎵 Playing local sound: ${soundId}`);

        try {
            // Create and play audio directly (same as playTaunt method)
            const audio = new Audio(`soundboard/${soundId}`);
            audio.volume = 0.7; // Set volume to 70%

            audio.addEventListener('canplaythrough', () => {
                audio.play().catch(error => {
                    console.error('Error playing synced taunt:', error);
                });
            });

            // Fallback: try to play immediately
            audio.play().catch(error => {
                console.log('Immediate play failed, waiting for canplaythrough:', error);
            });
        } catch (error) {
            console.error('Error creating audio for synced taunt:', error);
        }
    }

    getPlayerHand(gameData) {
        // For multiplayer: extract current player's hand from server data
        if (this.socket && this.connected && gameData.hands) {
            // Find current player's ID from the players list
            const currentPlayer = gameData.players?.find(p => p.name === this.playerName);
            if (currentPlayer && gameData.hands[currentPlayer.id]) {
                console.log('🃏 Using server hand for player:', this.playerName, '→', gameData.hands[currentPlayer.id].length, 'cards');
                return gameData.hands[currentPlayer.id];
            }
        }

        // Fallback for demo mode or if server hand not available
        console.log('🃏 Using demo hand (fallback)');
        return gameData.playerHand || this.drawPlayerHand(8);
    }

    showLobbyWaitingRoom(lobby) {
        const gameInterface = document.getElementById('game-interface');
        if (!gameInterface) return;

        gameInterface.innerHTML = `
            <div class="lobby-waiting-room">
                <h3>Lobby: ${lobby.name}</h3>
                <div class="lobby-players">
                    <h4>Players (${lobby.players.length}/${lobby.maxPlayers}):</h4>
                    <ul class="players-list">
                        ${lobby.players.map(player => `
                            <li class="player-item ${player.isHost ? 'host' : ''}">
                                ${player.name} ${player.isHost ? '(Host)' : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="lobby-controls">
                    ${lobby.isHost ? `
                        <button class="btn btn-primary" onclick="multiplayerManager.startGame()"
                                ${lobby.players.length < 2 ? 'disabled' : ''}>
                            START GAME
                        </button>
                    ` : '<p>Waiting for host to start the game...</p>'}
                    <button class="btn btn-secondary" onclick="multiplayerManager.leaveLobby()">
                        LEAVE LOBBY
                    </button>
                </div>
            </div>
        `;

        if (window.gameInterface) {
            window.gameInterface.showGameInterface();
        }
    }

    updateLobbyWaitingRoom(lobby) {
        // Update player count header
        const playersHeader = document.querySelector('.lobby-players h4');
        if (playersHeader) {
            playersHeader.textContent = `Players (${lobby.players.length}/${lobby.maxPlayers}):`;
        }

        // Update players list
        const playersList = document.querySelector('.players-list');
        if (playersList) {
            playersList.innerHTML = lobby.players.map(player => `
                <li class="player-item ${player.isHost ? 'host' : ''}">
                    ${player.name} ${player.isHost ? '(Host)' : ''}
                </li>
            `).join('');
        }

        // Update start button
        const startButton = document.querySelector('.lobby-controls .btn-primary');
        if (startButton && lobby.isHost) {
            startButton.disabled = lobby.players.length < 2;
        }

        // Update current lobby reference
        this.currentLobby = lobby;
    }

    onGameStarted(gameData) {
        console.log('Game started:', gameData);
        this.showMessage('Game started!', 'success');
        this.renderGameInterface(gameData);
    }

    updateGame(gameData) {
        console.log('Game updated:', gameData);
        this.renderGameInterface(gameData);
    }

    showGameResults(results) {
        console.log('Game ended:', results);
        this.showMessage('Game ended!', 'info');

        // Clear any existing timer
        this.clearTimer();

        // Render the game over screen
        const gameInterface = document.getElementById('game-interface');
        if (gameInterface) {
            gameInterface.innerHTML = this.renderGameOver(results);
        }
    }

    renderGameInterface(gameData) {
        const gameInterface = document.getElementById('game-interface');
        if (!gameInterface) return;

        // Save a copy in offline mode for stateful transitions
        if (!(this.socket && this.connected)) {
            this.localGameData = JSON.parse(JSON.stringify(gameData));
        }

        const isJudge = gameData.currentJudge === this.playerName;
        const currentRound = gameData.currentRound || 1;
        const totalRounds = gameData.totalRounds || 10;

        gameInterface.innerHTML = `
            <div class="trump-tweet-game">
                <button class="close-game-btn" onclick="multiplayerManager.closeGame()">×</button>
                <div class="game-timer-container"></div>
                <div class="game-header">
                    <h2>TRUMP AGAINST HUMANITY</h2>
                    <div class="game-info">
                        <span>Round ${currentRound}/${totalRounds}</span>
                        <span>Judge: ${this.getCurrentJudge()}</span>
                        <span>Phase: ${gameData.phase}</span>
                        <span>Target: ${this.cahGameState.winningScore} points</span>
                    </div>
                    <div class="round-progress"><div class="bar" style="width:${Math.max(0, Math.min(100, Math.floor((currentRound/totalRounds)*100)))}%"></div></div>
                </div>

                <div class="scoreboard">
                    <h3>SCOREBOARD</h3>
                    <div class="scores">
                        ${this.getScoreboard().map(({player, score}) => `
                            <div class="score-item ${player === this.getCurrentJudge() ? 'judge' : ''} ${player === (this.playerName || 'You') ? 'you' : ''}">
                                <span class="player-name">${player}</span>
                                <span class="player-score">${score}</span>
                                ${player === this.getCurrentJudge() ? '<span class="judge-badge">JUDGE</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>



                ${this.renderGamePhase(gameData, isJudge)}

                <div class="scoreboard">
                    <h4>SCOREBOARD</h4>
                    <div class="scores">
                        ${Object.entries(gameData.scores || {}).map(([player, score]) =>
                            `<div class="score-item ${player === this.playerName ? 'current-player' : ''}">
                                ${player}: ${score} points
                            </div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;

        if (window.gameInterface) {
            window.gameInterface.showGameInterface();
        }
    }

    renderGamePhase(gameData, isJudge) {
        switch(gameData.phase) {
            case 'starting':
                return `<div class="waiting"><h3>Preparing round…</h3></div>`;
            case 'playing':
                return this.renderPlayingPhase(gameData, isJudge);
            case 'judging':
                return this.renderJudgingPhase(gameData, isJudge);
            case 'results':
                return this.renderRoundResults(gameData);
            case 'gameover':
                return this.renderGameOver(gameData);
            default:
                return '<div class="waiting">Waiting for game to start...</div>';
        }
    }

    renderPlayingPhase(gameData, isJudge) {
        if (isJudge) {
            return `
                <div class="judge-waiting">
                    <h3>You are the Judge this round!</h3>
                    <p>Wait for other players to submit their cards...</p>
                    <div class="waiting-players">
                        Waiting for: ${(gameData.waitingFor || []).join(', ')}
                    </div>
                </div>
            `;
        }

        // Initialize demo game state if needed
        const requiredCards = gameData.currentPrompt?.blanks || 1;
        if (!this.demoGameState) {
            this.demoGameState = {
                selectedCards: [],
                maxCards: requiredCards
            };
        }
        // Update maxCards in case prompt changed
        this.demoGameState.maxCards = requiredCards;

        // Get selected cards based on mode
        let selectedCards = [];
        if (this.socket && this.connected) {
            // Multiplayer: get from server playerSelections
            const currentPlayer = gameData.players?.find(p => p.name === this.playerName);
            if (currentPlayer && gameData.playerSelections) {
                selectedCards = gameData.playerSelections[currentPlayer.id] || [];
                console.log('🎯 Using server selections for', this.playerName, '→', selectedCards);
            }
        } else {
            // Demo mode: use local state
            selectedCards = this.demoGameState.selectedCards || this.localSelection.selectedCards;
        }

        // Start timer for card selection if not already running
        if (!this.currentTimer) {
            console.log('⏰ Starting fresh card selection timer');
            this.startCardSelectionTimer();
        }

        return `
            <div class="player-hand">
                <h3>Your Cards - Select ${gameData.currentPrompt?.blanks || 1} card(s):</h3>

                <!-- Live Tweet Preview -->
                <div class="tweet-preview-area">
                    <h4>Tweet Preview:</h4>
                    <div class="tweet-preview">
                        <div class="fake-tweet preview">
                            <div class="tweet-header">
                                <strong>@realDonaldTrump</strong>
                                <span class="tweet-time">now</span>
                            </div>
                            <div class="tweet-text" id="live-tweet-preview">
                                ${gameData.currentPrompt?.text || 'Loading prompt...'}
                            </div>
                            <div class="tweet-stats">
                                <span>RT ${Math.floor(Math.random() * 10000)}</span>
                                <span>LIKES ${Math.floor(Math.random() * 50000)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="taunt-button-container">
                        <button class="taunt-btn" onclick="multiplayerManager.playRandomTaunt()" id="taunt-btn">TAUNT</button>
                    </div>
                </div>

                <div class="hand-cards">
                    ${this.getPlayerHand(gameData).map((card, index) => `
                        <div class="white-card ${selectedCards.includes(index) ? 'selected' : ''}"
                             onclick="multiplayerManager.selectCard(${index})">
                            <div class="card-content">${card}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary submit-cards-btn"
                        onclick="multiplayerManager.submitSelectedCards()"
                        ${selectedCards.length !== (gameData.currentPrompt?.blanks || 1) ? 'disabled' : ''}>
                    SUBMIT CARDS
                </button>
            </div>
        `;
    }

    renderJudgingPhase(gameData, isJudge) {
        // Start timer for judging phase if not already running
        if (isJudge && !this.currentTimer) {
            console.log('⏰ Starting judging timer for judge');
            this.startTimer(30,
                (remaining) => this.updateTimerDisplay(remaining, 'Judge Selection'),
                () => {
                    console.log('⏰ Judging time expired - auto-selecting random winner');
                    this.autoSelectWinner();
                }
            );
        }

        // Proper Cards Against Humanity: Only judge selects winner
        if (isJudge) {
            return `
                <div class="judging-phase">
                    <h3>You are the Judge! Select the Best Tweet:</h3>

                    <p class="judging-instructions">
                        Click on the tweet you think is the funniest to award the point!
                    </p>
                    <div class="tweet-options">
                        ${(gameData.submittedCombinations || []).map((combo, index) => `
                            <div class="tweet-option clickable"
                                 onclick="multiplayerManager.selectWinner(${index})">
                                <div class="fake-tweet">
                                    <div class="tweet-header">
                                        <strong>@realDonaldTrump</strong>
                                        <span class="tweet-time">now</span>
                                    </div>
                                    <div class="tweet-text">${this.formatTweet(gameData.currentPrompt, combo.cards)}</div>
                                    <div class="tweet-stats">
                                        <span>RT ${Math.floor(Math.random() * 10000)}</span>
                                        <span>LIKES ${Math.floor(Math.random() * 50000)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="waiting-for-judge">
                    <h3>Waiting for Judge to Select Winner...</h3>
                    <p>The judge is reviewing all submissions and will select the best tweet.</p>
                    <div class="tweet-options">
                        ${(gameData.submittedCombinations || []).map((combo, index) => `
                            <div class="tweet-option">
                                <div class="fake-tweet">
                                    <div class="tweet-header">
                                        <strong>@realDonaldTrump</strong>
                                        <span class="tweet-time">now</span>
                                    </div>
                                    <div class="tweet-text">${this.formatTweet(gameData.currentPrompt, combo.cards)}</div>
                                    <div class="tweet-stats">
                                        <span>RT ${Math.floor(Math.random() * 10000)}</span>
                                        <span>LIKES ${Math.floor(Math.random() * 50000)}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    renderRoundResults(gameData) {
        const winner = gameData.roundWinner;
        const winningTweet = gameData.winningCombination;

        // Start auto-progression timer for results phase
        if (!this.currentTimer) {
            this.startTimer(10,
                (remaining) => this.updateTimerDisplay(remaining, 'Next Round'),
                () => {
                    console.log('Results time expired - auto-advancing to next round');
                    this.nextRound();
                }
            );
        }

        return `
            <div class="round-results">
                <h3>Round Winner: ${winner?.player || 'Unknown'}</h3>
                <div class="winning-tweet">
                    <div class="fake-tweet winner">
                        <div class="tweet-header">
                            <strong>@realDonaldTrump</strong>
                            <span class="tweet-time">now</span>
                        </div>
                        <div class="tweet-text">${this.formatTweet(gameData.currentPrompt, winningTweet?.cards || [])}</div>

                        <div class="tweet-stats">
                            <span>RT ${Math.floor(Math.random() * 10000)}</span>
                            <span>LIKES ${Math.floor(Math.random() * 50000)}</span>
                        </div>
                    </div>
                </div>
                <div class="results-actions">
                    <button class="btn btn-primary" onclick="multiplayerManager.nextRound()">
                        NEXT ROUND
                    </button>
                    <p class="auto-advance-notice">Next round starts automatically in <span id="auto-advance-countdown">10</span> seconds</p>
                </div>
            </div>
        `;
    }

    formatTweet(prompt, cards) {
        if (!prompt || !cards) return 'Loading tweet...';
        let tweet = prompt.text || '';
        console.log('formatTweet - Prompt:', prompt.text);
        console.log('formatTweet - Cards:', cards);
        cards.forEach((card, index) => {
            const placeholder = `{${index}}`;
            console.log(`formatTweet - Replacing ${placeholder} with "${card}"`);
            tweet = tweet.replace(placeholder, `<strong>${card}</strong>`);
        });
        console.log('formatTweet - Final tweet:', tweet);
        return tweet;
    }

    getDemoCards() {
        return [
            // Classic Trump Phrases
            "the fake news media",
            "tremendous success",
            "very smart people",
            "believe me",
            "China",
            "the best deal ever",
            "crooked politicians",
            "beautiful phone call",

            // More Trump Vocabulary
            "tremendous phone call",
            "perfect conversation",
            "witch hunt",
            "total disaster",
            "complete hoax",
            "rigged election",
            "stolen votes",
            "massive fraud",
            "incredible ratings",
            "record crowds",
            "standing ovation",
            "fake polls",
            "corrupt media",
            "radical left",
            "deep state",
            "swamp creatures",
            "establishment politicians",
            "career politicians",
            "sleepy Joe",
            "crazy Nancy",
            "shifty Schiff",
            "pencil neck",
            "low energy",
            "sad loser",
            "total lightweight",
            "third-rate politician",

            // Business & Success Terms
            "billion dollars",
            "tremendous wealth",
            "incredible success",
            "amazing profits",
            "record earnings",
            "best negotiator",
            "art of the deal",
            "winning strategy",
            "tremendous victory",
            "incredible achievement",
            "massive success",
            "phenomenal results",
            "outstanding performance",
            "unbelievable numbers",

            // Political Terms
            "America First",
            "Make America Great Again",
            "drain the swamp",
            "build the wall",
            "secure borders",
            "fair trade",
            "peace through strength",
            "law and order",
            "constitutional rights",
            "freedom of speech",
            "second amendment",
            "religious liberty",
            "tax cuts",
            "job creation",
            "economic boom",

            // International
            "North Korea",
            "Vladimir Putin",
            "Xi Jinping",
            "European Union",
            "NATO allies",
            "trade war",
            "nuclear weapons",
            "peace treaty",
            "diplomatic victory",
            "international respect",

            // Random Descriptors
            "absolutely incredible",
            "totally amazing",
            "completely ridiculous",
            "utterly fantastic",
            "extremely successful",
            "highly respected",
            "widely admired",
            "greatly appreciated",
            "strongly supported",
            "deeply loved",
            "tremendously popular",
            "incredibly smart",
            "very stable genius",
            "perfect timing",
            "flawless execution"
        ];
    }

    // Draw a limited hand from the full deck (Cards Against Humanity style)
    drawPlayerHand(handSize = 10) {
        const fullDeck = this.getDemoCards();
        const shuffled = [...fullDeck].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, handSize);
    }

    getDemoPrompts() {
        return [
            // Classic Trump Scenarios
            {
                text: "Just had a {0} with {1}. They said {2}. Fake news!",
                blanks: 3
            },
            {
                text: "The {0} are totally {1}. We need {2} immediately!",
                blanks: 3
            },
            {
                text: "My {0} was {1}. Everyone knows it!",
                blanks: 2
            },
            {
                text: "I just made the {0} deal with {1}. {2} are going crazy!",
                blanks: 3
            },
            {
                text: "The {0} said I couldn't {1}, but I did it anyway. {2}!",
                blanks: 3
            },
            {
                text: "Nobody has ever seen {0} like this before. {1}!",
                blanks: 2
            },
            {
                text: "I told {0} that {1} was {2}. They agreed completely!",
                blanks: 3
            },
            {
                text: "The {0} are rigged! We need {1} to fix this mess!",
                blanks: 2
            },

            // Politics & Elections
            {
                text: "The polls show I'm winning by {0}! {1} can't believe it!",
                blanks: 2
            },
            {
                text: "My opponent is {0}. They want to {1} our country!",
                blanks: 2
            },
            {
                text: "The election was {0}! We had {1} and they know it!",
                blanks: 2
            },
            {
                text: "I won {0} by the biggest margin in history. {1} are furious!",
                blanks: 2
            },
            {
                text: "The Democrats are trying to {0} with {1}. Not happening!",
                blanks: 2
            },
            {
                text: "My rally had {0} people! {1} said it was small. Wrong!",
                blanks: 2
            },
            {
                text: "The voters love {0}. That's why {1} are panicking!",
                blanks: 2
            },

            // Business & Deals
            {
                text: "I made a {0} deal worth {1}. Art of the Deal!",
                blanks: 2
            },
            {
                text: "My business empire is {0}. {1} wish they had my success!",
                blanks: 2
            },
            {
                text: "The stock market hit {0} because of {1}. You're welcome!",
                blanks: 2
            },
            {
                text: "I negotiated {0} in just {1}. Nobody else could do it!",
                blanks: 2
            },
            {
                text: "My net worth is {0}. {1} are jealous of my success!",
                blanks: 2
            },
            {
                text: "I built {0} with {1}. Greatest achievement ever!",
                blanks: 2
            },

            // Media & Fake News
            {
                text: "The media won't report on {0}. They hate {1}!",
                blanks: 2
            },
            {
                text: "{0} is fake news! They're spreading {1} about me!",
                blanks: 2
            },
            {
                text: "I gave {0} an exclusive interview about {1}. Ratings through the roof!",
                blanks: 2
            },
            {
                text: "The press is {0}. They can't handle {1}!",
                blanks: 2
            },
            {
                text: "My Truth Social post about {0} got {1} views. Incredible!",
                blanks: 2
            },
            {
                text: "The mainstream media hates {0} because {1}!",
                blanks: 2
            },

            // International Relations
            {
                text: "I had dinner with {0}. We discussed {1}. Great meeting!",
                blanks: 2
            },
            {
                text: "China is trying to {0} with {1}. Not on my watch!",
                blanks: 2
            },
            {
                text: "The President of {0} called me about {1}. Very respectful!",
                blanks: 2
            },
            {
                text: "I stopped {0} from happening in {1}. World peace!",
                blanks: 2
            },
            {
                text: "My foreign policy on {0} saved {1}. Thank you!",
                blanks: 2
            },
            {
                text: "The trade war with {0} is over. We won {1}!",
                blanks: 2
            },

            // Personal Achievements
            {
                text: "I'm the first president to {0} while {1}. Historic!",
                blanks: 2
            },
            {
                text: "My {0} is bigger than {1}. Size matters!",
                blanks: 2
            },
            {
                text: "I invented {0}. Before me, nobody knew about {1}!",
                blanks: 2
            },
            {
                text: "My IQ is {0}. That's why I understand {1} so well!",
                blanks: 2
            },
            {
                text: "I'm the best at {0}. {1} admit I'm incredible!",
                blanks: 2
            },
            {
                text: "My book about {0} will be {1}. Pre-order now!",
                blanks: 2
            },

            // Legal & Investigations
            {
                text: "The witch hunt about {0} is {1}. Total hoax!",
                blanks: 2
            },
            {
                text: "My lawyers proved {0} was {1}. Complete exoneration!",
                blanks: 2
            },
            {
                text: "The judge in {0} is {1}. Totally biased!",
                blanks: 2
            },
            {
                text: "I'm being investigated for {0} by {1}. Political persecution!",
                blanks: 2
            },
            {
                text: "The FBI raid was about {0}. They found {1}!",
                blanks: 2
            },

            // Social Media & Technology
            {
                text: "My tweet about {0} broke {1}. Most liked ever!",
                blanks: 2
            },
            {
                text: "Big Tech is censoring {0} because of {1}. Disgraceful!",
                blanks: 2
            },
            {
                text: "I have {0} followers who love {1}. Incredible reach!",
                blanks: 2
            },
            {
                text: "Twitter banned me for {0}. They fear {1}!",
                blanks: 2
            },
            {
                text: "My social media platform will have {0} and {1}. Revolutionary!",
                blanks: 2
            },

            // Economy & Trade
            {
                text: "The economy grew {0} because of {1}. Best ever!",
                blanks: 2
            },
            {
                text: "I created {0} jobs in {1}. Record breaking!",
                blanks: 2
            },
            {
                text: "Gas prices are {0} thanks to {1}. You're welcome!",
                blanks: 2
            },
            {
                text: "The trade deficit with {0} is now {1}. Winning!",
                blanks: 2
            },
            {
                text: "My tariffs on {0} saved {1}. America First!",
                blanks: 2
            },

            // Military & Security
            {
                text: "Our military has {0} and {1}. Strongest ever!",
                blanks: 2
            },
            {
                text: "I defeated {0} with {1}. Mission accomplished!",
                blanks: 2
            },
            {
                text: "The generals said {0} was impossible. I proved them wrong with {1}!",
                blanks: 2
            },
            {
                text: "Border security is {0} because of {1}. No more invasion!",
                blanks: 2
            },
            {
                text: "I rebuilt {0} with {1}. Peace through strength!",
                blanks: 2
            },

            // Rallies & Crowds
            {
                text: "My rally in {0} had {1}. Biggest crowd ever!",
                blanks: 2
            },
            {
                text: "The crowd chanted {0} for {1}. Amazing energy!",
                blanks: 2
            },
            {
                text: "I spoke about {0} and {1} went wild. Love it!",
                blanks: 2
            },
            {
                text: "The venue was packed with {0} supporters. {1} couldn't get in!",
                blanks: 2
            },
            {
                text: "My speech about {0} lasted {1}. Standing ovation!",
                blanks: 2
            },

            // Single Blank Prompts for Variety
            {
                text: "I am the {0} president in history!",
                blanks: 1
            },
            {
                text: "Nobody knows {0} better than me!",
                blanks: 1
            },
            {
                text: "I have the best {0}. Everyone says so!",
                blanks: 1
            },
            {
                text: "The {0} love me. Tremendous support!",
                blanks: 1
            },
            {
                text: "I will make {0} great again!",
                blanks: 1
            },
            {
                text: "My {0} is unmatched. Believe me!",
                blanks: 1
            },
            {
                text: "The {0} are out of control. Sad!",
                blanks: 1
            },
            {
                text: "I fixed {0} in record time!",
                blanks: 1
            }
        ];
    }

    // Game interaction methods
    selectCard(cardIndex) {
        if (this.socket && this.connected) {
            // Multiplayer mode - send to server
            console.log('🎯 Card selected (multiplayer):', cardIndex);
            this.socket.emit('select-card', cardIndex);
        } else {
            // Demo mode - handle locally
            const gameData = this.ensureLocalGameData();
            const playerHand = this.getPlayerHand(gameData);
            console.log('🎯 Card selected (demo):', cardIndex, '→', playerHand[cardIndex]);
            this.handleLocalCardSelection(cardIndex);
        }
    }

    renderGameOver(gameData) {
        // Clear any existing timer
        this.clearTimer();

        // Use multiplayer data if available, otherwise fall back to demo mode
        let standings;
        if (gameData && gameData.players) {
            // Multiplayer mode - use gameData.players
            standings = gameData.players
                .map(player => ({ player: player.name, score: player.score }))
                .sort((a, b) => b.score - a.score);
        } else {
            // Demo mode - use cahGameState
            standings = this.getScoreboard();
        }

        // Handle ties and winner detection
        const maxScore = standings[0]?.score || 0;
        const winners = standings.filter(entry => entry.score === maxScore);

        let winnerText, winnerScore;
        if (winners.length > 1) {
            // It's a tie!
            const winnerNames = winners.map(w => w.player);
            if (winnerNames.includes(this.playerName || 'You')) {
                winnerText = `It's a tie! You tied with ${winnerNames.filter(n => n !== (this.playerName || 'You')).join(' and ')}!`;
            } else {
                winnerText = `It's a tie between ${winnerNames.join(' and ')}!`;
            }
            winnerScore = maxScore;
        } else {
            // Single winner
            const winner = winners[0]?.player || 'Winner';
            winnerText = winner === (this.playerName || 'You') ? 'You win!' : `${winner} wins!`;
            winnerScore = maxScore;
        }

        return `
            <div class="game-over">
                <div class="victory-banner">
                    <h2>GAME OVER!</h2>
                    <div class="winner-announcement">
                        <h3>${winnerText}</h3>
                        <p class="winner-score">Final Score: ${winnerScore} points</p>
                    </div>
                </div>

                <div class="final-scoreboard">
                    <h3>Final Standings</h3>
                    <div class="scores">
                        ${standings.map((entry, index) => {
                            const isWinner = entry.score === maxScore;
                            const isYou = entry.player === (this.playerName || 'You');
                            return `
                                <div class="score-item final ${isWinner ? 'winner' : ''} ${isYou ? 'you' : ''}">
                                    <span class="rank">#${index + 1}</span>
                                    <span class="player-name">${entry.player}</span>
                                    <span class="player-score">${entry.score} points</span>
                                    ${isWinner ? '<span class="crown">🏆</span>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="game-over-actions">
                    <button class="btn btn-primary" onclick="multiplayerManager.startNewGame()">
                        PLAY AGAIN
                    </button>
                    <button class="btn btn-secondary" onclick="multiplayerManager.closeGame()">
                        CLOSE GAME
                    </button>
                </div>
            </div>
        `;
    }

    handleLocalCardSelection(cardIndex) {
        // Get current game data to determine required cards
        const gameData = this.ensureLocalGameData();
        const requiredCards = gameData.currentPrompt?.blanks || 1;

        // Initialize demo game state if not exists
        if (!this.demoGameState) {
            this.demoGameState = {
                selectedCards: [],
                maxCards: requiredCards
            };
        }

        // Update maxCards in case prompt changed
        this.demoGameState.maxCards = requiredCards;

        const selectedCards = this.demoGameState.selectedCards;
        const maxCards = this.demoGameState.maxCards;

        // Toggle card selection
        const cardIndexPos = selectedCards.indexOf(cardIndex);
        if (cardIndexPos > -1) {
            // Deselect card
            selectedCards.splice(cardIndexPos, 1);
        } else {
            // Select card (limit to maxCards)
            if (selectedCards.length < maxCards) {
                selectedCards.push(cardIndex);
            } else {
                // Replace first selected card
                selectedCards[0] = cardIndex;
            }
        }

        // Also mirror to localSelection for simpler access
        this.localSelection.selectedCards = [...selectedCards];
        this.localSelection.maxCards = maxCards;

        // Debug logging
        const playerHand = gameData.playerHand || this.drawPlayerHand(10);
        const selectedCardTexts = selectedCards.map(index => playerHand[index]);
        console.log('Current selection order:', selectedCards, '→', selectedCardTexts);

        // Update visual state
        this.updateCardSelection();

        // Start timer for card selection if not already running
        if (!this.currentTimer && gameData.phase === 'playing') {
            this.startCardSelectionTimer();
        }
    }

    updateCardSelection() {
        const cards = document.querySelectorAll('.white-card');

        // Get selected cards based on mode
        let selectedCards = [];
        let maxCards = 1;

        if (this.socket && this.connected && this.gameState) {
            // Multiplayer mode: get from server
            const currentPlayer = this.gameState.players?.find(p => p.name === this.playerName);
            selectedCards = currentPlayer && this.gameState.playerSelections ?
                (this.gameState.playerSelections[currentPlayer.id] || []) : [];
            maxCards = this.gameState.currentPrompt?.blanks || 1;
        } else {
            // Demo mode: use local state
            selectedCards = this.demoGameState?.selectedCards || this.localSelection.selectedCards || [];
            maxCards = this.demoGameState?.maxCards || this.localSelection.maxCards || 1;
        }

        cards.forEach((card, index) => {
            // Remove existing selection indicators
            card.classList.remove('selected');
            const existingIndicator = card.querySelector('.selection-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }

            // Check if this card is selected and get its position
            const selectionPosition = selectedCards.indexOf(index);
            if (selectionPosition > -1) {
                card.classList.add('selected');

                // Add placeholder indicator showing which position this card fills
                const indicator = document.createElement('div');
                indicator.className = 'selection-indicator';
                indicator.textContent = `{${selectionPosition}}`;
                card.appendChild(indicator);
            }
        });

        // Update submit button
        const submitBtn = document.querySelector('.submit-cards-btn');
        if (submitBtn) {
            submitBtn.disabled = selectedCards.length !== maxCards;
        }

        // Update live tweet preview
        this.updateTweetPreview();
    }

    updateTweetPreview() {
        const previewElement = document.getElementById('live-tweet-preview');
        if (!previewElement) return;

        // Get current game data and selections
        let gameData, selectedCards, playerHand;

        if (this.socket && this.connected && this.gameState) {
            // Multiplayer mode: use server data
            gameData = this.gameState;
            const currentPlayer = gameData.players?.find(p => p.name === this.playerName);
            selectedCards = currentPlayer && gameData.playerSelections ?
                (gameData.playerSelections[currentPlayer.id] || []) : [];
            playerHand = this.getPlayerHand(gameData);
        } else {
            // Demo mode: use local data
            gameData = this.ensureLocalGameData();
            selectedCards = this.demoGameState?.selectedCards || this.localSelection.selectedCards || [];
            playerHand = this.getPlayerHand(gameData);
        }

        // Build the preview cards array in selection order
        const previewCards = selectedCards.map(index => playerHand[index]);
        console.log('🔄 Preview update - Selected indices:', selectedCards, '→ Cards:', previewCards);

        // Create preview tweet with selected cards or placeholders
        let previewText = gameData.currentPrompt?.text || '';
        const totalBlanks = gameData.currentPrompt?.blanks || 1;

        for (let i = 0; i < totalBlanks; i++) {
            const placeholder = `{${i}}`;
            if (i < previewCards.length) {
                // Replace with selected card
                previewText = previewText.replace(placeholder, `<strong class="selected-word">${previewCards[i]}</strong>`);
            } else {
                // Keep as placeholder with styling
                previewText = previewText.replace(placeholder, `<span class="placeholder-text">${placeholder}</span>`);
            }
        }

        previewElement.innerHTML = previewText;
    }

    submitSelectedCards() {
        // Clear card selection timer
        this.clearTimer();

        if (this.socket && this.connected) {
            this.socket.emit('submit-cards');
        } else {
            // Demo mode - advance to judging with generated options
            this.handleDemoSubmission();
        }
    }

    ensureLocalGameData() {
        if (!this.localGameData) {
            // Initialize CAH game if not started
            if (!this.cahGameState.gameStarted) {
                this.initializeCAHGame();
            }

            this.localGameData = {
                currentJudge: this.getCurrentJudge(),
                currentRound: 1,
                totalRounds: 10,
                phase: 'playing',
                currentPrompt: this.getDemoPrompts()[Math.floor(Math.random() * this.getDemoPrompts().length)],
                playerHand: this.drawPlayerHand(10), // Draw 10 cards from full deck
                scores: this.cahGameState.scores,
            };
        }
        return this.localGameData;
    }

    handleDemoSubmission() {
        const gameData = this.ensureLocalGameData();
        const selectedIndexes = this.demoGameState?.selectedCards || this.localSelection.selectedCards || [];
        if (selectedIndexes.length === 0) return;

        const playerHand = gameData.playerHand || this.drawPlayerHand(10);
        const selectedCardTexts = selectedIndexes.map(index => playerHand[index]);

        console.log('SUBMISSION - Selected indices:', selectedIndexes);
        console.log('SUBMISSION - Selected card texts:', selectedCardTexts);
        console.log('SUBMISSION - Prompt:', gameData.currentPrompt?.text);

        // Build 3 tweet combinations including the player's selection
        const combos = [];
        combos.push({ cards: selectedCardTexts, isPlayerSelection: true });
        // Two random alternatives from full deck
        const fullDeck = this.getDemoCards();
        for (let i = 0; i < 2; i++) {
            const alt = [];
            const blanks = gameData.currentPrompt?.blanks || 1;
            for (let b = 0; b < blanks; b++) {
                alt.push(fullDeck[Math.floor(Math.random() * fullDeck.length)]);
            }
            combos.push({ cards: alt, isPlayerSelection: false });
        }

        console.log('All combinations created:', combos.map((combo, index) => ({
            index,
            isPlayer: combo.isPlayerSelection,
            cards: combo.cards
        })));

        gameData.submittedCombinations = combos;
        gameData.currentJudge = this.getCurrentJudge();
        gameData.phase = 'judging';

        // Reset voting state for new judging phase
        this.cahGameState.currentVotes = {};
        this.cahGameState.hasVoted = false;

        // Reset selection for next phase
        this.demoGameState.selectedCards = [];
        this.localSelection.selectedCards = [];

        this.renderGameInterface(gameData);
    }

    nextRound() {
        if (this.socket && this.connected) {
            this.socket.emit('next-round');
        } else if (this.localGameData) {
            const gd = this.localGameData;

            // Clear any existing timer
            this.clearTimer();

            // Rotate judge (CAH rule: winner becomes next judge, or rotate if no winner)
            if (gd.roundWinner && gd.roundWinner.player) {
                // Find the winner's index and set them as judge
                const winnerIndex = this.cahGameState.players.indexOf(gd.roundWinner.player);
                if (winnerIndex !== -1) {
                    this.cahGameState.currentJudgeIndex = winnerIndex;
                }
            } else {
                // No winner, just rotate normally
                this.rotateJudge();
            }

            if (gd.currentRound >= (gd.totalRounds || 10)) {
                gd.phase = 'gameover';
            } else {
                gd.currentRound += 1;
                gd.currentJudge = this.getCurrentJudge();
                gd.currentPrompt = this.getDemoPrompts()[Math.floor(Math.random() * this.getDemoPrompts().length)];
                gd.playerHand = this.drawPlayerHand(10); // Draw fresh hand each round
                gd.submittedCombinations = [];
                gd.roundWinner = null;
                gd.winningCombination = null;
                gd.phase = 'playing';
                gd.scores = this.cahGameState.scores;

                // Reset demo game state for new round
                this.demoGameState = null;
                this.localSelection = { selectedCards: [], maxCards: gd.currentPrompt?.blanks || 1 };
            }
            this.renderGameInterface(gd);
        }
    }

    closeGame() {
        const gameInterface = document.getElementById('game-interface');
        if (gameInterface) {
            gameInterface.style.display = 'none';
        }
    }

    selectWinner(index) {
        if (this.socket && this.connected) {
            this.socket.emit('select-winner', index);
            return;
        }

        // Clear timer
        this.clearTimer();

        // Offline: compute winner and update scores using CAH rules
        const gd = this.ensureLocalGameData();
        const combo = (gd.submittedCombinations || [])[index];

        // Determine winner (for demo, assume player wins if they selected this combo)
        const winnerName = combo?.isPlayerSelection ? (this.playerName || 'You') :
                          this.cahGameState.players[Math.floor(Math.random() * this.cahGameState.players.length)];

        // Award point using CAH system
        const gameResult = this.awardPoint(winnerName);

        gd.roundWinner = { player: winnerName };
        gd.winningCombination = { cards: combo?.cards || [] };
        gd.scores = this.cahGameState.scores;

        // Check if game is over
        if (gameResult && gameResult.winner) {
            gd.phase = 'gameover';
            gd.gameWinner = gameResult;
        } else {
            gd.phase = 'results';
        }

        this.renderGameInterface(gd);
    }

    showConnectionError() {
        this.showMessage('Unable to connect to game server. Some features may not work.', 'error');
    }

    showMessage(message, type = 'info') {
        if (window.gameInterface) {
            window.gameInterface.showMessage(message, type);
        }
    }

    // Timer System
    startTimer(duration, onTick, onComplete) {
        this.clearTimer();

        this.currentTimer = {
            duration: duration,
            remaining: duration,
            onTick: onTick || (() => {}),
            onComplete: onComplete || (() => {})
        };

        // Update immediately
        this.currentTimer.onTick(this.currentTimer.remaining);

        // Start countdown
        this.timerInterval = setInterval(() => {
            this.currentTimer.remaining--;
            this.currentTimer.onTick(this.currentTimer.remaining);

            if (this.currentTimer.remaining <= 0) {
                this.clearTimer();
                this.currentTimer.onComplete();
            }
        }, 1000);
    }

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.currentTimer = null;
    }

    renderTimer(remaining, phase) {
        const urgentClass = remaining <= 5 ? 'urgent' : '';
        const warningClass = remaining <= 10 ? 'warning' : '';

        return `
            <div class="game-timer ${urgentClass} ${warningClass}">
                <div class="timer-display">
                    <div class="timer-icon">⏰</div>
                    <div class="timer-text">
                        <div class="timer-phase">${phase}</div>
                        <div class="timer-countdown">${remaining}s</div>
                    </div>
                </div>
                <div class="timer-bar">
                    <div class="timer-progress" style="width: ${(remaining / 20) * 100}%"></div>
                </div>
            </div>
        `;
    }

    updateTimerDisplay(remaining, phase) {
        const timerContainer = document.querySelector('.game-timer-container');
        if (timerContainer) {
            timerContainer.innerHTML = this.renderTimer(remaining, phase);
        }

        // Also update auto-advance countdown if present
        const countdownElement = document.getElementById('auto-advance-countdown');
        if (countdownElement) {
            countdownElement.textContent = remaining;
        }
    }

    startCardSelectionTimer() {
        this.startTimer(20,
            (remaining) => this.updateTimerDisplay(remaining, 'Select Cards'),
            () => {
                console.log('Card selection time expired - auto-submitting');
                this.autoSubmitCards();
            }
        );
    }

    startVotingTimer() {
        this.startTimer(20,
            (remaining) => this.updateTimerDisplay(remaining, 'Vote for Best'),
            () => {
                console.log('Voting time expired - auto-selecting random');
                this.autoVote();
            }
        );
    }

    autoSubmitCards() {
        console.log('⏰ Timer expired - auto-submitting cards');

        if (this.socket && this.connected && this.gameState) {
            // Multiplayer mode: get current selections and auto-select if needed
            const currentPlayer = this.gameState.players?.find(p => p.name === this.playerName);
            const selectedCards = currentPlayer && this.gameState.playerSelections ?
                (this.gameState.playerSelections[currentPlayer.id] || []) : [];
            const requiredCards = this.gameState.currentPrompt?.blanks || 1;
            const playerHand = this.getPlayerHand(this.gameState);

            console.log(`🎯 Auto-submit: ${selectedCards.length}/${requiredCards} cards selected`);

            // If not enough cards selected, randomly select remaining
            while (selectedCards.length < requiredCards) {
                const availableCards = playerHand.map((_, index) => index)
                    .filter(index => !selectedCards.includes(index));
                if (availableCards.length > 0) {
                    const randomIndex = availableCards[Math.floor(Math.random() * availableCards.length)];
                    selectedCards.push(randomIndex);
                    console.log(`🎲 Auto-selected card ${randomIndex}: ${playerHand[randomIndex]}`);
                    // Send selection to server
                    this.socket.emit('select-card', randomIndex);
                } else {
                    break;
                }
            }

            // Submit the cards
            console.log('📤 Auto-submitting cards to server');
            this.submitSelectedCards();
        } else {
            // Demo mode: use existing logic
            const gameData = this.ensureLocalGameData();
            const selectedCards = this.demoGameState?.selectedCards || this.localSelection.selectedCards || [];
            const requiredCards = gameData.currentPrompt?.blanks || 1;

            // If not enough cards selected, randomly select remaining
            while (selectedCards.length < requiredCards) {
                const playerHand = gameData.playerHand || this.drawPlayerHand(10);
                const availableCards = playerHand.map((_, index) => index)
                    .filter(index => !selectedCards.includes(index));
                if (availableCards.length > 0) {
                    const randomIndex = availableCards[Math.floor(Math.random() * availableCards.length)];
                    selectedCards.push(randomIndex);
                } else {
                    break;
                }
            }

            // Update state and submit
            if (this.demoGameState) {
                this.demoGameState.selectedCards = selectedCards;
            }
            this.localSelection.selectedCards = selectedCards;
            this.updateCardSelection();
            this.submitSelectedCards();
        }
    }

    autoSelectWinner() {
        console.log('⏰ Judge timer expired - auto-selecting winner');

        if (this.socket && this.connected && this.gameState) {
            // Multiplayer mode: auto-select random winner
            const combinations = this.gameState.submittedCombinations || [];
            if (combinations.length > 0) {
                const randomIndex = Math.floor(Math.random() * combinations.length);
                console.log(`🎲 Auto-selected winner: combination ${randomIndex}`);
                this.selectWinner(randomIndex);
            }
        } else {
            // Demo mode: use existing auto-vote logic
            this.autoVote();
        }
    }

    autoVote() {
        const gameData = this.ensureLocalGameData();
        const combinations = gameData.submittedCombinations || [];
        if (combinations.length > 0) {
            // If player hasn't voted, vote randomly for them
            if (!this.cahGameState.hasVoted) {
                const randomIndex = Math.floor(Math.random() * combinations.length);
                this.voteForTweet(randomIndex);
            }

            // Automatically finish voting after a short delay
            setTimeout(() => {
                this.finishVoting();
            }, 1000);
        }
    }

    // Cards Against Humanity Game Logic
    initializeCAHGame() {
        // Initialize scores for all players
        this.cahGameState.players.forEach(player => {
            this.cahGameState.scores[player] = 0;
        });
        this.cahGameState.currentJudgeIndex = 0;
        this.cahGameState.gameStarted = true;

        console.log('CAH Game initialized:', this.cahGameState);
    }

    getCurrentJudge() {
        return this.cahGameState.players[this.cahGameState.currentJudgeIndex];
    }

    isPlayerJudge(playerName = null) {
        const player = playerName || this.playerName || 'You';
        return this.getCurrentJudge() === player;
    }

    rotateJudge() {
        this.cahGameState.currentJudgeIndex =
            (this.cahGameState.currentJudgeIndex + 1) % this.cahGameState.players.length;
        console.log('Judge rotated to:', this.getCurrentJudge());
    }

    awardPoint(playerName) {
        if (!this.cahGameState.scores[playerName]) {
            this.cahGameState.scores[playerName] = 0;
        }
        this.cahGameState.scores[playerName]++;
        console.log(`Point awarded to ${playerName}. Score: ${this.cahGameState.scores[playerName]}`);

        // Check for winner
        if (this.cahGameState.scores[playerName] >= this.cahGameState.winningScore) {
            return { winner: playerName, finalScore: this.cahGameState.scores[playerName] };
        }
        return null;
    }

    getScoreboard() {
        return Object.entries(this.cahGameState.scores)
            .map(([player, score]) => ({ player, score }))
            .sort((a, b) => b.score - a.score);
    }

    checkGameEnd() {
        const maxScore = Math.max(...Object.values(this.cahGameState.scores));
        if (maxScore >= this.cahGameState.winningScore) {
            const winner = Object.entries(this.cahGameState.scores)
                .find(([player, score]) => score === maxScore);
            return winner ? { winner: winner[0], score: winner[1] } : null;
        }
        return null;
    }

    // Voting System Methods
    voteForTweet(tweetIndex) {
        if (this.cahGameState.hasVoted) {
            console.log('Already voted!');
            return;
        }

        // Record vote
        if (!this.cahGameState.currentVotes[tweetIndex]) {
            this.cahGameState.currentVotes[tweetIndex] = 0;
        }
        this.cahGameState.currentVotes[tweetIndex]++;
        this.cahGameState.hasVoted = true;

        console.log(`🗳️ Voted for tweet ${tweetIndex}. Current votes:`, this.cahGameState.currentVotes);

        // Simulate AI votes
        this.simulateAIVotes();

        // Re-render to show updated vote counts
        const gameData = this.ensureLocalGameData();
        this.renderGameInterface(gameData);
    }

    simulateAIVotes() {
        const gameData = this.ensureLocalGameData();
        const totalTweets = (gameData.submittedCombinations || []).length;

        // Each AI player votes for a random tweet
        for (let i = 1; i < this.cahGameState.players.length; i++) {
            const randomTweetIndex = Math.floor(Math.random() * totalTweets);
            if (!this.cahGameState.currentVotes[randomTweetIndex]) {
                this.cahGameState.currentVotes[randomTweetIndex] = 0;
            }
            this.cahGameState.currentVotes[randomTweetIndex]++;
        }

        console.log('🤖 AI votes simulated. Final votes:', this.cahGameState.currentVotes);
    }

    finishVoting() {
        // Clear timer
        this.clearTimer();

        // Find winner (tweet with most votes)
        const votes = this.cahGameState.currentVotes;
        let maxVotes = 0;
        let winningTweetIndex = 0;

        Object.entries(votes).forEach(([tweetIndex, voteCount]) => {
            if (voteCount > maxVotes) {
                maxVotes = voteCount;
                winningTweetIndex = parseInt(tweetIndex);
            }
        });

        console.log(`Voting finished! Tweet ${winningTweetIndex} wins with ${maxVotes} votes`);

        // Reset voting state for next round
        this.cahGameState.currentVotes = {};
        this.cahGameState.hasVoted = false;

        // Select the winner
        this.selectWinner(winningTweetIndex);
    }

    startNewGame() {
        // Reset all game state
        this.cahGameState = {
            players: ['You', 'AI Player 1', 'AI Player 2', 'AI Player 3'],
            scores: {},
            currentJudgeIndex: 0,
            winningScore: 5,
            gameStarted: false,
            currentVotes: {},
            votingPhase: false,
            hasVoted: false
        };

        this.localGameData = null;
        this.demoGameState = null;
        this.localSelection = { selectedCards: [], maxCards: 1 };
        this.clearTimer();

        // Start fresh game
        this.startDemoGame();
    }

    // Audio Taunt System
    playRandomTaunt() {
        const now = Date.now();
        const timeSinceLastTaunt = now - this.lastTauntTime;

        if (timeSinceLastTaunt < this.tauntCooldown) {
            const remainingCooldown = Math.ceil((this.tauntCooldown - timeSinceLastTaunt) / 1000);
            console.log(`Taunt on cooldown. Wait ${remainingCooldown} more seconds.`);
            this.updateTauntButton(remainingCooldown);
            return;
        }

        // Select random taunt
        const randomIndex = Math.floor(Math.random() * this.audioTaunts.length);
        const selectedTaunt = this.audioTaunts[randomIndex];

        console.log('Playing taunt:', selectedTaunt);

        // Use soundboard sync system instead of direct playTaunt
        this.playSoundboard(selectedTaunt);

        // Update cooldown
        this.lastTauntTime = now;
        this.startTauntCooldown();
    }

    playTaunt(filename) {
        try {
            const audio = new Audio(`soundboard/${filename}`);
            audio.volume = 0.7; // Set volume to 70%

            audio.addEventListener('canplaythrough', () => {
                audio.play().catch(error => {
                    console.error('Error playing taunt:', error);
                });
            });

            audio.addEventListener('error', (error) => {
                console.error('Error loading taunt audio:', error);
            });

            // Load the audio
            audio.load();

        } catch (error) {
            console.error('Error creating audio element:', error);
        }
    }

    startTauntCooldown() {
        this.updateTauntButton(10);

        const cooldownInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastTaunt = now - this.lastTauntTime;
            const remainingCooldown = Math.ceil((this.tauntCooldown - timeSinceLastTaunt) / 1000);

            if (remainingCooldown <= 0) {
                clearInterval(cooldownInterval);
                this.updateTauntButton(0);
            } else {
                this.updateTauntButton(remainingCooldown);
            }
        }, 1000);
    }

    updateTauntButton(remainingSeconds) {
        const tauntBtn = document.getElementById('taunt-btn');
        if (!tauntBtn) return;

        if (remainingSeconds > 0) {
            tauntBtn.textContent = `TAUNT (${remainingSeconds}s)`;
            tauntBtn.disabled = true;
            tauntBtn.classList.add('cooldown');
        } else {
            tauntBtn.textContent = 'TAUNT';
            tauntBtn.disabled = false;
            tauntBtn.classList.remove('cooldown');
        }
    }
}

// Initialize multiplayer manager when DOM is loaded and Socket.io is available
document.addEventListener('DOMContentLoaded', () => {
    function initializeMultiplayer() {
        if (typeof io !== 'undefined') {
            console.log('🎮 Initializing multiplayer manager...');
            window.multiplayerManager = new MultiplayerManager();
        } else {
            console.log('⏳ Waiting for Socket.io to load...');
            setTimeout(initializeMultiplayer, 100);
        }
    }

    initializeMultiplayer();
});

// Add CSS for lobby waiting room and game interface
const gameStyles = document.createElement('style');
gameStyles.textContent = `
    .lobby-waiting-room {
        max-width: 600px;
        margin: 0 auto;
        padding: 30px;
        background-color: white;
        border: 2px solid var(--border-color);
        text-align: center;
    }

    .lobby-waiting-room h3 {
        color: var(--trump-red);
        font-size: 2rem;
        margin-bottom: 30px;
    }

    .lobby-players {
        margin-bottom: 30px;
    }

    .lobby-players h4 {
        color: var(--accent-blue);
        margin-bottom: 15px;
    }

    .players-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .player-item {
        padding: 10px;
        margin: 5px 0;
        background-color: var(--newspaper-gray);
        border: 1px solid var(--border-color);
    }

    .player-item.host {
        background-color: var(--primary-gold);
        font-weight: bold;
    }

    .lobby-controls {
        display: flex;
        gap: 20px;
        justify-content: center;
        flex-wrap: wrap;
    }

    /* Trump Tweet Game Styles */
    .trump-tweet-game {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: var(--newspaper-cream);
        border: 3px solid var(--newspaper-ink);
        position: relative;
    }

    .close-game-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        background: var(--trump-red);
        color: white;
        border: none;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        font-size: 1.8rem;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: normal;
        line-height: 1;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .close-game-btn:hover {
        background: #c82333;
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    /* Taunt Button Container */
    .taunt-button-container {
        text-align: center;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 2px solid var(--newspaper-ink);
    }

    /* Taunt Button Styles */
    .taunt-btn {
        background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
        color: white;
        border: 2px solid #d68910;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 1rem;
        transition: all 0.3s ease;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .taunt-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
        transform: translateY(-3px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.3);
    }

    .taunt-btn:disabled {
        background: #95a5a6;
        border-color: #7f8c8d;
        cursor: not-allowed;
        transform: none;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .taunt-btn.cooldown {
        background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
        animation: cooldownPulse 1s infinite alternate;
    }

    @keyframes cooldownPulse {
        from { opacity: 0.7; }
        to { opacity: 1; }
    }

    .game-header {
        text-align: center;
        margin-bottom: 28px;
        padding: 18px 20px 16px;
        background: var(--trump-red);
        color: white;
        border-radius: 10px;
        border: 3px solid var(--newspaper-ink);
        box-shadow: 0 6px 14px rgba(0,0,0,.15);
    }

    .game-header h2 {
        margin: 0 0 8px 0;
        font-size: 2.1rem;
        letter-spacing: .5px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.35);
    }

    .game-info {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 18px;
        font-weight: 800;
        font-size: 1rem;
    }

    .black-card-area { display: flex; justify-content: center; margin: 22px 0 26px; }

    .black-card {
        background: var(--newspaper-ink);
        color: var(--newspaper-cream);
        padding: 26px 28px;
        border-radius: 12px;
        max-width: 640px;
        min-height: 160px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 16px rgba(0,0,0,0.25);
        border: 3px solid #111;
    }

    .card-content { text-align: center; font-size: 1.2rem; line-height: 1.5; }
    .tweet-prompt { font-weight: 900; margin-bottom: 10px; letter-spacing: .2px; }

    .hand-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin-bottom: 22px; }

    .white-card {
        background: var(--newspaper-cream);
        border: 2px solid var(--newspaper-ink);
        border-radius: 10px;
        padding: 18px 16px;
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        min-height: 110px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 1rem;
        line-height: 1.4;
        position: relative;
        overflow: hidden;
    }

    .white-card:hover {
        border-color: var(--trump-red);
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    }

    .white-card.selected {
        border-color: var(--trump-red);
        background: linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%);
        transform: translateY(-3px) scale(1.05);
        box-shadow: 0 8px 25px rgba(220, 53, 69, 0.3);
        position: relative;
    }

    .selection-indicator {
        position: absolute;
        top: -8px;
        right: -8px;
        background: linear-gradient(135deg, var(--trump-red) 0%, #ff6b6b 100%);
        color: white;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        font-weight: bold;
        border: 3px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.25);
        z-index: 10;
        animation: indicatorPop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    @keyframes indicatorPop {
        0% { transform: scale(0) rotate(180deg); opacity: 0; }
        50% { transform: scale(1.2) rotate(90deg); opacity: 0.8; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    .tweet-preview-area {
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border: 2px solid var(--newspaper-ink);
        border-radius: 8px;
    }

    .tweet-preview-area h4 {
        margin: 0 0 10px 0;
        color: var(--trump-red);
        font-size: 1.1rem;
    }

    .fake-tweet.preview {
        background: white;
        border: 1px solid #e1e8ed;
        margin: 0;
        max-width: none;
    }

    .selected-word {
        color: var(--trump-red);
        background: linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%);
        padding: 3px 6px;
        border-radius: 4px;
        font-weight: bold;
        transition: all 0.3s ease;
        animation: wordSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Timer System Styles */
    .game-timer-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
    }

    .game-timer {
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        border: 2px solid var(--trump-red);
        border-radius: 12px;
        padding: 15px;
        color: white;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        min-width: 200px;
        transition: all 0.3s ease;
    }

    .game-timer.warning {
        border-color: #ff9500;
        animation: timerPulse 1s ease-in-out infinite;
    }

    .game-timer.urgent {
        border-color: #ff0000;
        background: linear-gradient(135deg, #330000 0%, #660000 100%);
        animation: timerUrgent 0.5s ease-in-out infinite;
    }

    .timer-display {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
    }

    .timer-icon {
        font-size: 24px;
        animation: timerTick 1s ease-in-out infinite;
    }

    .timer-text {
        flex: 1;
    }

    .timer-phase {
        font-size: 12px;
        color: #ccc;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 2px;
    }

    .timer-countdown {
        font-size: 24px;
        font-weight: bold;
        color: var(--trump-red);
    }

    .game-timer.warning .timer-countdown {
        color: #ff9500;
    }

    .game-timer.urgent .timer-countdown {
        color: #ff0000;
    }

    .timer-bar {
        height: 6px;
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
        overflow: hidden;
    }

    .timer-progress {
        height: 100%;
        background: linear-gradient(90deg, var(--trump-red) 0%, #ff6b6b 100%);
        transition: width 1s linear;
        border-radius: 3px;
    }

    .game-timer.warning .timer-progress {
        background: linear-gradient(90deg, #ff9500 0%, #ffb347 100%);
    }

    .game-timer.urgent .timer-progress {
        background: linear-gradient(90deg, #ff0000 0%, #ff4444 100%);
    }

    @keyframes timerPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
    }

    @keyframes timerUrgent {
        0%, 100% { transform: scale(1); box-shadow: 0 8px 25px rgba(255,0,0,0.3); }
        50% { transform: scale(1.05); box-shadow: 0 12px 35px rgba(255,0,0,0.6); }
    }

    @keyframes timerTick {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
    }

    /* Scoreboard Styles */
    .scoreboard {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border: 2px solid var(--newspaper-ink);
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .scoreboard h3 {
        margin: 0 0 15px 0;
        color: var(--trump-red);
        font-size: 1.2rem;
        text-align: center;
        border-bottom: 2px solid var(--trump-red);
        padding-bottom: 8px;
    }

    .scores {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .score-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 15px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        transition: all 0.3s ease;
    }

    .score-item.judge {
        background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
        border-color: #f39c12;
        box-shadow: 0 2px 8px rgba(243,156,18,0.2);
    }

    .score-item.you {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        border-color: #2196f3;
        font-weight: bold;
    }

    .player-name {
        font-weight: 600;
        color: var(--newspaper-ink);
    }

    .player-score {
        font-size: 1.2rem;
        font-weight: bold;
        color: var(--trump-red);
        min-width: 30px;
        text-align: center;
    }

    .judge-badge {
        font-size: 1.1rem;
        margin-left: 8px;
    }

    .score-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    /* Voting System Styles */
    .voting-phase {
        text-align: center;
    }

    .voting-instructions {
        font-size: 1.1rem;
        color: var(--newspaper-ink);
        margin: 15px 0;
        padding: 10px;
        background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
        border-radius: 8px;
        border-left: 4px solid var(--trump-red);
    }

    .vote-count {
        background: linear-gradient(135deg, var(--trump-red) 0%, #ff6b6b 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-weight: bold;
        margin-top: 10px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(220,53,69,0.3);
    }

    .tweet-option.disabled {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
    }

    .tweet-option.disabled:hover {
        transform: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .voting-status {
        margin-top: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 8px;
        border: 2px solid var(--newspaper-ink);
    }

    .voting-status h4 {
        color: var(--trump-red);
        margin-bottom: 15px;
        font-size: 1.2rem;
    }

    .vote-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
        margin-bottom: 15px;
    }

    .vote-item {
        background: white;
        padding: 8px 15px;
        border-radius: 6px;
        border: 1px solid #ddd;
        font-weight: 600;
        color: var(--newspaper-ink);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .btn-secondary {
        background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 10px;
    }

    .btn-secondary:hover {
        background: linear-gradient(135deg, #5a6268 0%, #495057 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    /* Auto-progression Styles */
    .results-actions {
        text-align: center;
        margin-top: 20px;
    }

    .auto-advance-notice {
        margin-top: 15px;
        color: #666;
        font-style: italic;
        font-size: 0.9rem;
    }

    #auto-advance-countdown {
        font-weight: bold;
        color: var(--trump-red);
    }

    /* Game Over Styles */
    .game-over {
        text-align: center;
        padding: 30px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 12px;
        border: 3px solid var(--trump-red);
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    }

    .victory-banner {
        margin-bottom: 30px;
        padding: 20px;
        background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
        border-radius: 8px;
        border: 2px solid #f39c12;
    }

    .victory-banner h2 {
        color: var(--trump-red);
        font-size: 2.5rem;
        margin-bottom: 15px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }

    .winner-announcement h3 {
        color: #f39c12;
        font-size: 2rem;
        margin-bottom: 10px;
    }

    .winner-score {
        font-size: 1.3rem;
        color: var(--newspaper-ink);
        font-weight: bold;
    }

    .final-scoreboard {
        margin: 30px 0;
        padding: 20px;
        background: white;
        border-radius: 8px;
        border: 2px solid var(--newspaper-ink);
    }

    .final-scoreboard h3 {
        color: var(--trump-red);
        margin-bottom: 20px;
        font-size: 1.5rem;
    }

    .score-item.final {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        margin: 8px 0;
        border-radius: 8px;
        font-size: 1.1rem;
    }

    .score-item.final.winner {
        background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
        border: 2px solid #f39c12;
        box-shadow: 0 4px 12px rgba(243,156,18,0.3);
        transform: scale(1.02);
    }

    .rank {
        font-weight: bold;
        color: var(--trump-red);
        min-width: 40px;
    }

    .crown {
        font-size: 1.5rem;
        margin-left: 10px;
    }

    .game-over-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-top: 30px;
    }

    .game-over-actions .btn {
        padding: 15px 30px;
        font-size: 1.1rem;
        font-weight: bold;
        border-radius: 8px;
        transition: all 0.3s ease;
    }

    .game-over-actions .btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    }

    .placeholder-text {
        color: #999;
        background: #f0f0f0;
        padding: 3px 6px;
        border-radius: 4px;
        font-style: italic;
        transition: all 0.3s ease;
        animation: placeholderPulse 2s ease-in-out infinite;
    }

    @keyframes wordSlideIn {
        0% { transform: translateY(-10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
    }

    @keyframes placeholderPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
    }

    .fake-tweet { background: white; border: 2px solid var(--newspaper-ink); border-radius: 12px; padding: 18px; margin: 10px 0; max-width: 560px; }
    .fake-tweet.winner { border: 3px solid gold; background: #fffbf0; box-shadow: 0 0 16px rgba(255,215,0,.25); }

    .tweet-option.clickable { cursor: pointer; transition: all 0.3s ease; }
    .tweet-option.clickable:hover { transform: translateY(-2px); }
    .tweet-option.clickable:hover .fake-tweet { border-color: var(--trump-red); box-shadow: 0 4px 12px rgba(220, 38, 127, 0.2); }

    .tweet-option.player-tweet { position: relative; }
    .tweet-option.player-tweet .fake-tweet { border: 3px solid var(--trump-red); background: linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%); }

    .player-indicator {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--trump-red);
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: bold;
        z-index: 10;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        animation: indicatorPulse 2s ease-in-out infinite;
    }

    /* Progress bar */
    .round-progress { height: 6px; background: #fff2f2; border-radius: 4px; overflow: hidden; margin-top: 10px; border: 1px solid rgba(0,0,0,.15); }
    .round-progress .bar { height: 100%; background: linear-gradient(90deg, var(--trump-red), #ff8a80); transition: width .3s ease; }


    .tweet-header { display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; font-size:.9rem; }
    .tweet-header strong { color: #1da1f2; }
    .tweet-time { color: #657786; }
    .tweet-text { font-size:1.05rem; line-height:1.4; margin-bottom:12px; color:#14171a; }
    .tweet-stats { display:flex; gap:18px; color:#657786; font-size:.9rem; }

    .tweet-options { display:grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px; margin: 18px 0; }
    .tweet-option.clickable { cursor:pointer; transition: transform .2s ease, box-shadow .2s ease; }
    .tweet-option.clickable:hover { transform: scale(1.02); box-shadow: 0 8px 16px rgba(0,0,0,.08); }

    .scoreboard { background: var(--newspaper-aged); padding: 18px; border-radius: 10px; margin-top: 26px; border: 2px solid var(--newspaper-ink); }
    .scoreboard h4 { text-align:center; margin-bottom: 12px; color: var(--trump-red); font-size: 1.35rem; }
    .scores { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .score-item { padding:10px; background:white; border-radius:6px; text-align:center; font-weight:900; border:2px solid transparent; }
    .score-item.current-player { border-color: var(--trump-red); background:#ffe6e6; }

    .judge-waiting, .waiting-for-judge, .round-results { text-align:center; padding: 34px; background: var(--newspaper-aged); border-radius: 10px; margin: 18px 0; border: 2px solid var(--newspaper-ink); }
    .submit-cards-btn:disabled { opacity: .55; cursor: not-allowed; }

    @media (max-width: 768px) {
      .game-info { flex-direction: column; gap: 10px; }
      .hand-cards { grid-template-columns: 1fr; }
      .tweet-options { grid-template-columns: 1fr; }
    }
`;
document.head.appendChild(gameStyles);
