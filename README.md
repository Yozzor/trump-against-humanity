# 🎺 Trump Against Humanity - The Most Tremendous Memecoin Website

> **"The greatest memecoin website ever created, believe me! You've never seen anything like it!"** - The Donald

A spectacular newspaper-style website featuring the **Trump Against Humanity** multiplayer card game - combining Cards Against Humanity mechanics with Trump-themed content and South Park humor.

## 🌟 Features

- **📰 Authentic Newspaper Design**: Professional newspaper layout with Trump Times branding
- **🎮 Multiplayer Card Game**: Real-time Cards Against Humanity with Trump tweets
- **🔴 Live News Feed**: Dynamic content with embedded video
- **🎯 Custom Cursors**: Trump mouth cursor system for maximum engagement
- **📱 Responsive Design**: Works perfectly on all devices
- **⚡ Real-time Multiplayer**: Socket.io powered instant gameplay

## 🚀 Live Demo

- **Website**: [Your Domain Here]
- **Backend API**: [Your Render URL Here]

## 🏗️ Architecture

```
Frontend (Namecheap) ←→ Backend (Render)
     ↓                        ↓
Static HTML/CSS/JS      Node.js + Socket.io
Newspaper Interface     Multiplayer Game Logic
```

## 📁 Project Structure

```
trump-against-humanity/
├── index.html              # Main newspaper website
├── server.js              # Node.js server with Socket.io
├── package.json           # Dependencies and scripts
├── .gitignore            # Git ignore rules
├── README.md             # This documentation
├── css/
│   └── styles.css        # Newspaper styling + game UI
├── js/
│   ├── cursor.js         # Trump mouth cursor system
│   ├── navigation.js     # Smooth scrolling animations
│   ├── game.js          # Game interface logic
│   └── multiplayer.js   # Socket.io multiplayer client
├── images/              # Trump and South Park assets
│   ├── trumpbg1.jpg     # Hero backgrounds
│   ├── trumpbody.png    # Character images
│   └── trump sp.png     # Favicon and branding
│   ├── trump mouth 1.png # Click cursor state
│   ├── trump mouth 2.png # Hover cursor state (closed)
│   ├── trump mouth 3.png # Hover cursor state (open)
│   ├── trump mouth 4.png # Default cursor state
│   ├── trump sp.png     # Additional Trump image
│   └── hey relax guy animation.mp4 # Looping animation
└── soundboard/          # Audio files for in-game taunts
    ├── bomb you.mp3
    ├── come on satan.mp3
    ├── dictator from the middle east.mp3
    ├── fckn sue you.mp3
    ├── get this guy out of here.mp3
    ├── hahaha.mp3
    ├── hey satan.mp3
    ├── iran iraq.mp3
    ├── nobody makes fun of me.mp3
    ├── oh come on satan.mp3
    ├── oh come on.mp3
    ├── relax guy.mp3
    ├── small dick.mp3
    ├── sue you.mp3
    ├── take a rest.mp3
    └── what the f.mp3
```

## Features

### Website Features
- **Trump-style Content**: All text written in Trump's distinctive voice and tone
- **Newspaper Aesthetic**: Design combines memecoin elements with newspaper styling
- **Custom Cursor System**: Dynamic Trump mouth cursors that change based on interaction
- **Responsive Design**: Mobile-first approach with cross-device compatibility
- **Smooth Animations**: Parallax effects, typing animations, and smooth scrolling

### Game Features
- **Multiplayer Lobbies**: Create and join lobbies for 2-5 players
- **Real-time Communication**: Socket.io powered real-time multiplayer
- **Cards Against Humanity Style**: Trump-themed card game mechanics
- **Soundboard Taunts**: In-game audio taunts with spam prevention
- **Leaderboards**: Score tracking and winner determination

## Installation and Setup

### Prerequisites
- Node.js (version 16 or higher)
- npm (comes with Node.js)

### Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Access the Website**
   Open your browser and go to: `http://localhost:3000`

## How to Play

1. **Enter Your Name**: Set your player name when you first visit the site
2. **Create or Join Lobby**: Create a new lobby or join an existing one
3. **Wait for Players**: Lobbies need 2-5 players to start
4. **Start Game**: The lobby host can start the game when ready
5. **Play Cards Against Humanity**: Follow the classic rules with Trump-themed cards
6. **Use Soundboard**: Taunt other players with Trump audio clips (10-second cooldown)
7. **Win and Celebrate**: Check the leaderboard and start a new game!

## Technical Details

### Frontend Technologies
- **HTML5**: Semantic structure with accessibility considerations
- **CSS3**: Modern styling with CSS Grid, Flexbox, and custom properties
- **JavaScript ES6+**: Modular code with classes and modern syntax
- **Socket.io Client**: Real-time communication with the server

### Backend Technologies
- **Node.js**: Server runtime environment
- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional event-based communication
- **UUID**: Unique identifier generation for lobbies and players

### Key Features Implementation
- **Custom Cursors**: CSS cursor property with JavaScript event handling
- **Real-time Multiplayer**: Socket.io rooms for lobby management
- **Game State Management**: Server-side game logic with client synchronization
- **Audio System**: Web Audio API for soundboard functionality
- **Responsive Design**: CSS media queries and flexible layouts

## Development Status

This project is currently in active development. The basic website structure and multiplayer lobby system are complete. The following features are planned:

- [ ] Complete Cards Against Humanity game mechanics
- [ ] Trump-themed card database
- [ ] Soundboard integration
- [ ] Leaderboard system
- [ ] Mobile optimization
- [ ] Performance optimization

## Contributing

This is the most tremendous project ever, and we welcome contributions! Please ensure all code follows the existing style and maintains the Trump voice throughout the content.

## License

MIT License - Making open source great again!

---

*"This is going to be HUGE! The best memecoin website you've ever seen, believe me!"* - The Management
