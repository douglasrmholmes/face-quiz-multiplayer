// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fetch = require('node-fetch'); // For fetching random users' photos

const PORT = process.env.PORT || 10000; // Use PORT provided by Render, default to 10000

app.use(express.static('public'));

// Maximum number of players allowed in a room
const MAX_PLAYERS = 10;

// Store room creators to track who can start the game
const roomCreators = {};

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle room creation or joining
  socket.on('joinRoom', (data) => {
    const { playerName, roomId } = data;
    socket.playerName = playerName;

    const room = io.sockets.adapter.rooms.get(roomId);
    const numPlayers = room ? room.size : 0;

    if (numPlayers < MAX_PLAYERS) {
      // Player can join the room
      socket.join(roomId);
      socket.roomName = roomId;
      console.log(`${playerName} joined room: ${roomId} (${numPlayers + 1}/${MAX_PLAYERS})`);

      if (numPlayers === 0) {
        // This player is the room creator
        roomCreators[roomId] = socket.id;
        socket.emit('roomCreator'); // Tell the player they are the room creator
        console.log(`${playerName} is the room creator for room ${roomId}`);
      }

      // Notify all players in the room about the current player count
      io.to(roomId).emit('waitingForPlayers', `Room: ${roomId}. Players: ${numPlayers + 1}/${MAX_PLAYERS}. Waiting for the game to start...`);
    } else {
      // Room is full (more than MAX_PLAYERS players)
      console.log(`Room ${roomId} is full, player ${playerName} cannot join.`);
      socket.emit('roomFull');
    }
  });

  // Room creator starts the game
  socket.on('startGame', () => {
    const roomName = socket.roomName;
    if (roomCreators[roomName] === socket.id) {
      console.log(`Room creator ${socket.playerName} has started the game in room ${roomName}`);
      startGame(roomName);
    } else {
      console.log(`${socket.playerName} attempted to start the game but is not the room creator.`);
    }
  });

  socket.on('submitAnswers', (data) => {
    socket.answers = data.answers;
    socket.score = data.score;
    console.log(`${socket.playerName} submitted answers with a score of ${socket.score}`);

    const roomName = socket.roomName;
    const clients = Array.from(io.sockets.adapter.rooms.get(roomName) || []);

    // Check if all players in the room have submitted their answers
    if (clients.every(clientId => io.sockets.sockets.get(clientId).score !== undefined)) {
      const players = clients.map(clientId => io.sockets.sockets.get(clientId));

      console.log(`All players in room ${roomName} have submitted their answers.`);

      // Calculate and send the results to all players
      const results = players.map(player => ({
        playerName: player.playerName,
        score: player.score,
      })).sort((a, b) => b.score - a.score);

      console.log(`Game over in room ${roomName}. Sending results...`);
      io.to(roomName).emit('gameOver', results);

      // Remove players from the room after the game ends
      players.forEach(player => player.leave(roomName));
    } else {
      console.log(`Waiting for all players in room ${roomName} to submit their answers...`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Function to start the game for all players in a room
async function startGame(roomName) {
  console.log(`Starting game in ${roomName}...`);

  // Fetch faces and names
  const facesData = await loadFaces();
  if (facesData) {
    console.log(`Faces data fetched successfully for ${roomName}`);
    io.to(roomName).emit('startGame', facesData);
  } else {
    console.error('Failed to load faces. Sending error to players.');
    io.to(roomName).emit('error', 'Failed to load faces. Please try again later.');
  }
}

// Function to fetch faces and names
async function loadFaces() {
  const FACE_COUNT = 5;
  const faces = [];

  for (let i = 0; i < FACE_COUNT; i++) {
    let validName = false;
    let attempts = 0;
    while (!validName && attempts < 10) {
      attempts++;
      try {
        const response = await fetch('https://randomuser.me/api/?nat=us,gb,ca,au,nz');
        const data = await response.json();
        const user = data.results[0];
        const firstName = user.name.first;
        const lastName = user.name.last;
        const fullName = `${firstName} ${lastName}`;
        if (/^[A-Za-z\s'-]+$/.test(fullName)) {
          const imageSrc = user.picture.large;
          faces.push({ imageSrc, name: fullName });
          validName = true;
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    }
    if (!validName) {
      return null;
    }
  }
  return faces;
}

// Listen on the port specified by Render.com
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
