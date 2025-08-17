// Trump by South Park - Node.js Server with Socket.io
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Game state management
const lobbies = new Map();
const players = new Map();

// Game Data - Cards and Prompts
function getShuffledDeck() {
    const cards = [
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
        "nasty woman",
        "crooked Hillary",
        "little Marco",
        "lyin' Ted",
        "rocket man",
        "fire and fury",
        "nuclear button",
        "very stable genius",
        "covfefe",
        "alternative facts",
        "tremendous crowds",
        "biggest inauguration",
        "perfect phone call",
        "no collusion",
        "total exoneration",
        "presidential harassment",
        "angry Democrats",
        "do-nothing Democrats",
        "radical socialist agenda",
        "America First",
        "Make America Great Again",
        "tremendous wall",
        "beautiful wall",
        "Mexico will pay",
        "trade war",
        "tariffs",
        "unfair trade deals",
        "renegotiated NAFTA",
        "incredible economy",
        "best economy ever",
        "record unemployment",
        "booming stock market",
        "tremendous jobs",
        "beautiful factories",
        "incredible military",
        "rebuilt military",
        "Space Force",
        "tremendous generals",
        "my generals",
        "beautiful letter",
        "love letters",
        "fell in love",
        "tremendous respect",
        "incredible relationship",
        "perfect meeting",
        "historic summit",
        "tremendous progress",
        "incredible success",
        "total victory",
        "complete domination",
        "tremendous power",
        "incredible strength",
        "unmatched wisdom",
        "stable genius",
        "very good genes",
        "tremendous brain",
        "incredible memory",
        "perfect recall",
        "tremendous energy",
        "incredible stamina",
        "perfect health",
        "tremendous doctor",
        "incredible results",
        "perfect score"
    ];

    // Shuffle the deck
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getShuffledPrompts() {
    const prompts = [
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
            text: "I defeated {0} with {1}. Total landslide!",
            blanks: 2
        },
        {
            text: "The {0} are trying to steal the election with {1}!",
            blanks: 2
        },
        {
            text: "My rally had {0} people! {1} is fake news!",
            blanks: 2
        },
        {
            text: "I will drain the swamp of {0} and {1}!",
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

    // Shuffle the prompts
    const shuffled = [...prompts];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function drawCards(deck, count) {
    return deck.splice(0, count);
}

function buildPublicGameState(lobby) {
    const gs = lobby.gameState;
    if (!gs) return null;

    // For judging phase, convert submissions to combinations format
    let submittedCombinations = [];
    if (gs.phase === 'judging' && gs.submissions) {
        submittedCombinations = gs.submissions.map(sub => ({
            playerId: sub.playerId,
            cards: sub.cards
        }));
    }

    return {
        lobbyId: lobby.id,
        players: gs.players,
        currentRound: gs.currentRound,
        maxRounds: gs.maxRounds,
        phase: gs.phase,
        currentPrompt: gs.currentPrompt,
        currentJudge: lobby.players[gs.currentJudgeIndex]?.name || 'Unknown',
        currentJudgeIndex: gs.currentJudgeIndex,
        submissions: gs.submissions || [],
        submittedCombinations: submittedCombinations, // For judging phase
        playerSelections: gs.playerSelections || {}, // Include current selections
        roundWinner: gs.roundWinner,
        winningCombination: gs.winningCombination,
        playerCount: lobby.players.length,
        hands: gs.hands || {} // Include player hands
    };
}

// Lobby class
class Lobby {
    constructor(id, name, maxPlayers, hostId) {
        this.id = id;
        this.name = name;
        this.maxPlayers = maxPlayers;
        this.hostId = hostId;
        this.players = [];
        this.status = 'waiting'; // waiting, in-game, finished
        this.gameState = null;
        this.createdAt = new Date();
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        this.players.push(player);
        return true;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);

        // If host leaves, assign new host
        if (this.hostId === playerId && this.players.length > 0) {
            this.hostId = this.players[0].id;
            this.players[0].isHost = true;
        }
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            maxPlayers: this.maxPlayers,
            currentPlayers: this.players.length,
            status: this.status,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                isHost: p.isHost
            })),
            isHost: false // Will be set per player
        };
    }
}

// Player class
class Player {
    constructor(id, name, socketId) {
        this.id = id;
        this.name = name;
        this.socketId = socketId;
        this.lobbyId = null;
        this.isHost = false;
        this.lastActivity = new Date();
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Set player name
    socket.on('set-name', (name) => {
        const playerId = uuidv4();
        const player = new Player(playerId, name, socket.id);
        players.set(socket.id, player);

        console.log(`Player ${name} (${playerId}) connected`);
        socket.emit('name-set', { playerId, name });
    });

    // Get lobbies list
    socket.on('get-lobbies', () => {
        const lobbiesList = Array.from(lobbies.values())
            .filter(lobby => lobby.status === 'waiting')
            .map(lobby => lobby.toJSON());

        socket.emit('lobby-list', lobbiesList);
    });

    // Create lobby
    socket.on('create-lobby', (data) => {
        const player = players.get(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Please set your name first' });
            return;
        }

        if (player.lobbyId) {
            socket.emit('error', { message: 'You are already in a lobby' });
            return;
        }

        const lobbyId = uuidv4();
        const lobby = new Lobby(lobbyId, data.name, data.maxPlayers, player.id);

        player.lobbyId = lobbyId;
        player.isHost = true;
        lobby.addPlayer(player);

        lobbies.set(lobbyId, lobby);
        socket.join(lobbyId);

        console.log(`Lobby "${data.name}" created by ${player.name}`);

        const lobbyData = lobby.toJSON();
        lobbyData.isHost = true;
        socket.emit('lobby-created', lobbyData);
        socket.emit('lobby-joined', lobbyData);
    });

    // Join lobby
    socket.on('join-lobby', (lobbyId) => {
        const player = players.get(socket.id);
        const lobby = lobbies.get(lobbyId);

        if (!player) {
            socket.emit('error', { message: 'Please set your name first' });
            return;
        }

        if (!lobby) {
            socket.emit('error', { message: 'Lobby not found' });
            return;
        }

        if (lobby.status !== 'waiting') {
            socket.emit('error', { message: 'Lobby is not accepting new players' });
            return;
        }

        if (player.lobbyId) {
            socket.emit('error', { message: 'You are already in a lobby' });
            return;
        }

        if (!lobby.addPlayer(player)) {
            socket.emit('error', { message: 'Lobby is full' });
            return;
        }

        player.lobbyId = lobbyId;
        socket.join(lobbyId);

        console.log(`${player.name} joined lobby "${lobby.name}"`);

        // Send lobby data to the joining player
        const lobbyData = lobby.toJSON();
        lobbyData.isHost = player.id === lobby.hostId;
        socket.emit('lobby-joined', lobbyData);

        // Notify ALL players in the lobby with their specific host status
        lobby.players.forEach(p => {
            const playerLobbyData = lobby.toJSON();
            playerLobbyData.isHost = p.id === lobby.hostId;
            io.to(p.socketId).emit('lobby-updated', playerLobbyData);
        });
    });

    // Leave lobby
    socket.on('leave-lobby', () => {
        const player = players.get(socket.id);
        if (!player || !player.lobbyId) {
            socket.emit('lobby-left'); // Send confirmation even if not in lobby
            return;
        }

        const lobby = lobbies.get(player.lobbyId);
        if (lobby) {
            lobby.removePlayer(player.id);
            socket.leave(player.lobbyId);

            console.log(`${player.name} left lobby "${lobby.name}"`);

            // If lobby is empty, delete it
            if (lobby.players.length === 0) {
                lobbies.delete(lobby.id);
                console.log(`Lobby "${lobby.name}" deleted (empty)`);
            } else {
                // Notify remaining players with their specific host status
                lobby.players.forEach(p => {
                    const playerLobbyData = lobby.toJSON();
                    playerLobbyData.isHost = p.id === lobby.hostId;
                    io.to(p.socketId).emit('lobby-updated', playerLobbyData);
                });
            }
        }

        player.lobbyId = null;
        player.isHost = false;

        // Send confirmation to the leaving player
        socket.emit('lobby-left');
    });

    // Start game
    socket.on('start-game', () => {
        const player = players.get(socket.id);
        if (!player || !player.lobbyId) {
            socket.emit('error', { message: 'You are not in a lobby' });
            return;
        }

        const lobby = lobbies.get(player.lobbyId);
        if (!lobby) {
            socket.emit('error', { message: 'Lobby not found' });
            return;
        }

        if (player.id !== lobby.hostId) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }

        if (lobby.players.length < 2) {
            socket.emit('error', { message: 'Need at least 2 players to start' });
            return;
        }

        lobby.status = 'in-game';
        console.log(`Game started in lobby "${lobby.name}"`);

        // Initialize game state
        const gameState = {
            lobbyId: lobby.id,
            players: lobby.players.map(p => ({
                id: p.id,
                name: p.name,
                score: 0
            })),
            currentRound: 1,
            maxRounds: 10,
            phase: 'playing',
            deck: getShuffledDeck(),
            prompts: getShuffledPrompts(),
            currentPrompt: null,
            hands: {},
            currentJudgeIndex: 0,
            submissions: [],
            playerSelections: {}, // Track current card selections per player
            roundWinner: null,
            winningCombination: null
        };

        // Deal initial hands and set first prompt
        lobby.players.forEach(p => {
            gameState.hands[p.id] = drawCards(gameState.deck, 8);
        });
        gameState.currentPrompt = gameState.prompts[0];

        lobby.gameState = gameState;

        const publicGameState = buildPublicGameState(lobby);
        console.log('Sending game-started event to lobby:', lobby.id);
        console.log('Public game state:', JSON.stringify(publicGameState, null, 2));

        io.to(lobby.id).emit('game-started', publicGameState);
    });

    // --- In-game events ---
    socket.on('select-card', (cardIndex) => {
        const player = players.get(socket.id);
        const lobby = player && player.lobbyId ? lobbies.get(player.lobbyId) : null;
        if (!player || !lobby || lobby.status !== 'in-game') return;
        const gs = lobby.gameState;

        // Initialize player selections if not exists
        gs.playerSelections = gs.playerSelections || {};
        if (!gs.playerSelections[player.id]) {
            gs.playerSelections[player.id] = [];
        }

        const currentSelection = gs.playerSelections[player.id];
        const maxCards = gs.currentPrompt?.blanks || 1;

        // Toggle card selection
        const cardIndexPos = currentSelection.indexOf(cardIndex);
        if (cardIndexPos > -1) {
            // Deselect card
            currentSelection.splice(cardIndexPos, 1);
            console.log(`🎯 ${player.name} deselected card ${cardIndex}`);
        } else {
            // Select card (limit to maxCards)
            if (currentSelection.length < maxCards) {
                currentSelection.push(cardIndex);
                console.log(`🎯 ${player.name} selected card ${cardIndex} (${currentSelection.length}/${maxCards})`);
            } else {
                // Replace first selected card
                currentSelection[0] = cardIndex;
                console.log(`🎯 ${player.name} replaced selection with card ${cardIndex}`);
            }
        }

        io.to(lobby.id).emit('game-updated', buildPublicGameState(lobby));
    });

    socket.on('submit-cards', () => {
        const player = players.get(socket.id);
        const lobby = player && player.lobbyId ? lobbies.get(player.lobbyId) : null;
        if (!player || !lobby || lobby.status !== 'in-game') return;
        const gs = lobby.gameState;

        // Get player's current selection
        const playerSelection = gs.playerSelections?.[player.id] || [];
        if (playerSelection.length === 0) return;

        // Check if player already submitted
        const alreadySubmitted = gs.submissions?.some(sub => sub.playerId === player.id);
        if (alreadySubmitted) {
            console.log(`⚠️ ${player.name} already submitted cards`);
            return;
        }

        // Convert selection indices to actual cards
        const selectedCards = playerSelection.map(index => gs.hands[player.id][index]);

        // Add to submissions
        gs.submissions = gs.submissions || [];
        gs.submissions.push({
            playerId: player.id,
            cards: selectedCards
        });

        // Clear player's selection
        if (gs.playerSelections) {
            gs.playerSelections[player.id] = [];
        }

        console.log(`📤 ${player.name} submitted cards:`, selectedCards);

        // Check if all non-judge players have submitted
        const judgeId = lobby.players[gs.currentJudgeIndex]?.id;
        const nonJudgePlayers = lobby.players.filter(p => p.id !== judgeId);
        const submittedPlayerIds = gs.submissions.map(sub => sub.playerId);
        const allSubmitted = nonJudgePlayers.every(p => submittedPlayerIds.includes(p.id));

        console.log(`📊 Submissions: ${gs.submissions.length}/${nonJudgePlayers.length} non-judge players`);

        if (allSubmitted) {
            // All players submitted - advance to judging phase
            gs.phase = 'judging';
            console.log(`🏛️ All players submitted! Advancing to judging phase`);
        }

        io.to(lobby.id).emit('game-updated', buildPublicGameState(lobby));
    });

    socket.on('select-winner', (index) => {
        const player = players.get(socket.id);
        const lobby = player && player.lobbyId ? lobbies.get(player.lobbyId) : null;
        if (!player || !lobby || lobby.status !== 'in-game') return;
        const gs = lobby.gameState;
        const judge = lobby.players[gs.currentJudgeIndex];
        if (judge.id !== player.id) return; // only judge can pick
        const winning = (gs.submissions || [])[index];
        if (!winning) return;
        const winnerPlayer = lobby.getPlayerById(winning.playerId);
        const pState = gs.players.find(p => p.id === winning.playerId);
        if (pState) pState.score = (pState.score || 0) + 1;
        gs.roundWinner = { player: winnerPlayer?.name || 'Unknown' };
        gs.winningCombination = { cards: winning.cards };
        gs.phase = 'results';
        io.to(lobby.id).emit('game-updated', buildPublicGameState(lobby));
    });

    socket.on('next-round', () => {
        const player = players.get(socket.id);
        const lobby = player && player.lobbyId ? lobbies.get(player.lobbyId) : null;
        if (!player || !lobby || lobby.status !== 'in-game') return;
        const gs = lobby.gameState;

        console.log(`🎯 ${player.name} requested next round. Current round: ${gs.currentRound}/${gs.maxRounds}`);

        // Only judge can advance
        const judge = lobby.players[gs.currentJudgeIndex];
        if (judge.id !== player.id) {
            console.log(`❌ ${player.name} is not the judge (${judge.name}), ignoring next-round request`);
            return;
        }
        if (gs.currentRound >= gs.maxRounds) {
            // Game is over - set phase and status
            gs.phase = 'gameover';
            lobby.status = 'finished';
            console.log(`🏁 Game ended in lobby "${lobby.name}" after ${gs.maxRounds} rounds`);
            io.to(lobby.id).emit('game-ended', buildPublicGameState(lobby));
            return;
        }
        gs.currentRound += 1;
        gs.currentJudgeIndex = (gs.currentJudgeIndex + 1) % lobby.players.length;
        gs.currentPrompt = gs.prompts[gs.currentRound - 1] || gs.prompts[0];
        gs.submissions = [];
        gs.roundWinner = null;
        gs.winningCombination = null;
        gs.phase = 'playing';
        io.to(lobby.id).emit('game-updated', buildPublicGameState(lobby));
    });

    // Soundboard sync
    socket.on('play-soundboard', (soundId) => {
        const player = players.get(socket.id);
        const lobby = player && player.lobbyId ? lobbies.get(player.lobbyId) : null;
        if (!player || !lobby) return;

        console.log(`🔊 ${player.name} played soundboard: ${soundId}`);

        // Broadcast to all players in the lobby
        io.to(lobby.id).emit('soundboard-played', {
            playerId: player.id,
            playerName: player.name,
            soundId: soundId
        });
    });



    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        const player = players.get(socket.id);
        if (player) {
            // Handle lobby cleanup
            if (player.lobbyId) {
                const lobby = lobbies.get(player.lobbyId);
                if (lobby) {
                    lobby.removePlayer(player.id);

                    if (lobby.players.length === 0) {
                        lobbies.delete(lobby.id);
                        console.log(`Lobby "${lobby.name}" deleted (empty after disconnect)`);
                    } else {
                        // Notify remaining players with their specific host status
                        lobby.players.forEach(p => {
                            const playerLobbyData = lobby.toJSON();
                            playerLobbyData.isHost = p.id === lobby.hostId;
                            io.to(p.socketId).emit('lobby-updated', playerLobbyData);
                        });
                        io.to(lobby.id).emit('player-disconnected', player.name);
                    }
                }
            }

            players.delete(socket.id);
            console.log(`Player ${player.name} removed`);
        }
    });
});

// Cleanup inactive lobbies every 5 minutes
setInterval(() => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    for (const [lobbyId, lobby] of lobbies.entries()) {
        if (lobby.createdAt < fiveMinutesAgo && lobby.status === 'waiting' && lobby.players.length === 0) {
            lobbies.delete(lobbyId);
            console.log(`Cleaned up inactive lobby: ${lobby.name}`);
        }
    }
}, 5 * 60 * 1000);

// Start server
server.listen(PORT, () => {
    console.log(`Trump by South Park server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to play the most tremendous game ever!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {


        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
