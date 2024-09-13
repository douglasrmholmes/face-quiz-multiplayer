// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fetch = require('node-fetch'); // For fetching random users' photos

const PORT = process.env.PORT || 10000; // Use PORT provided by Render, default to 10000

let waitingPlayer = null;
let gameRooms = 0;

app.use(express.static('public'));

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('playerReady', (playerName) => {
    socket.playerName = playerName;
    console.log(`${playerName} is ready with ID: ${socket.id}`);

    if (waitingPlayer) {
      // Start a new game
      gameRooms++;
      const roomName = `room${gameRooms}`;
      
      // Assign players to the room
      socket.join(roomName);
      waitingPlayer.join(roomName);
      
      // Track the room name on each socket
      socket.roomName = roomName;
      waitingPlayer.roomName = roomName;

      console.log(`${waitingPlayer.playerName} and ${playerName} have been assigned to ${roomName}`);

      // Initialize game data
      startGame(roomName, [waitingPlayer, socket]);

      waitingPlayer = null;
    } else {
      // Wait for another player
      waitingPlayer = socket;
      console.log(`${playerName} is waiting for an opponent...`);
      socket.emit('waitingForOpponent');
    }
  });

  socket.on('submitAnswers', (data) => {
    socket.answers = data.answers;
    socket.score = data.score;
    console.log(`${socket.playerName} submitted answers with a score of ${socket.score}`);

    // Use the roomName that was explicitly stored on the socket
    const roomName = socket.roomName;
    console.log(`${socket.playerName} is in room: ${roomName}`);

    // Check if both players in the room have submitted their answers
    const clients = Array.from(io.sockets.adapter.rooms.get(roomName) || []);
    if (clients.length === 2) {
      const [player1Id, player2Id] = clients;
      const player1 = io.sockets.sockets.get(player1Id);
      const player2 = io.sockets.sockets.get(player2Id);

      console.log(`Player 1 (${player1.playerName}) score: ${player1.score}`);
      console.log(`Player 2 (${player2.playerName}) score: ${player2.score}`);

      if (player1.score !== undefined && player2.score !== undefined) {
        let result;
        if (player1.score > player2.score) {
          result = `${player1.playerName} wins!`;
        } else if (player2.score > player1.score) {
          result = `${player2.playerName} wins!`;
        } else {
          result = "It's a tie!";
        }

        console.log(`Game over in ${roomName}. Result: ${result}`);

        // Send the result to both players
        io.to(roomName).emit('gameOver', {
          result,
          player1Score: player1.score,
          player2Score: player2.score,
        });

        // Remove players from the room after the game ends
        player1.leave(roomName);
        player2.leave(roomName);
      } else {
        console.log('Waiting for both players to submit their answers...');
      }
    } else {
      console.log(`Only one player has submitted in room ${roomName}. Waiting for the other...`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (waitingPlayer === socket) {
      waitingPlayer = null;
      console.log(`${socket.playerName} disconnected while waiting for an opponent.`);
    }
  });
});

// Function to start the game for both players
async function startGame(roomName, players) {
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
