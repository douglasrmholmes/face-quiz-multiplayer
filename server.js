// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fetch = require('node-fetch');

const PORT = process.env.PORT || 10000;
app.use(express.static('public'));

// Maximum number of players allowed in a room
const MAX_PLAYERS = 10;
const roomCreators = {};

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Listen for 'joinRoom' event
  socket.on('joinRoom', (data) => {
    const { playerName, roomId, category } = data;
    console.log(`Received joinRoom request: Player: ${playerName}, Room: ${roomId}, Category: ${category}`);

    socket.playerName = playerName;
    socket.category = category;
    const room = io.sockets.adapter.rooms.get(roomId);
    const numPlayers = room ? room.size : 0;

    // Check if room is full
    if (numPlayers < MAX_PLAYERS) {
      socket.join(roomId);
      socket.roomName = roomId;
      console.log(`${playerName} joined room: ${roomId}`);

      // Assign room creator if first player
      if (numPlayers === 0) {
        roomCreators[roomId] = socket.id;
        socket.emit('roomCreator');
        console.log(`${playerName} is the room creator for room: ${roomId}`);
      }

      // Notify all players in the room
      io.to(roomId).emit('waitingForPlayers', `Room: ${roomId}. Players: ${numPlayers + 1}/${MAX_PLAYERS}. Waiting for the game to start...`);
    } else {
      socket.emit('roomFull');
      console.log(`Room ${roomId} is full`);
    }
  });

  // Room creator starts the game
  socket.on('startGame', async () => {
    const roomName = socket.roomName;
    if (roomCreators[roomName] === socket.id) {
      const category = socket.category; // Get the selected category from the room creator
      console.log(`Starting game in room ${roomName} with category: ${category}`);
      const images = await fetchImagesByCategory(category);
      io.to(roomName).emit('startGame', images);
    }
  });

  socket.on('submitAnswers', (data) => {
    socket.answers = data.answers;
    socket.score = data.score;
    const roomName = socket.roomName;
    const clients = Array.from(io.sockets.adapter.rooms.get(roomName) || []);

    if (clients.every(clientId => io.sockets.sockets.get(clientId).score !== undefined)) {
      const players = clients.map(clientId => io.sockets.sockets.get(clientId));
      const results = players.map(player => ({
        playerName: player.playerName,
        score: player.score,
      })).sort((a, b) => b.score - a.score);
      io.to(roomName).emit('gameOver', results);
      players.forEach(player => player.leave(roomName));
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Function to fetch images based on category using Pixabay
async function fetchImagesByCategory(category) {
  const API_KEY = '45972763-80ccc4101ac506798a0f893fe'; // Replace with your Pixabay API key
  let apiUrl;
  
  switch (category) {
    case 'faces':
      apiUrl = 'https://randomuser.me/api/?results=5&nat=us,gb,ca,au,nz';
      break;
    case 'buildings':
      apiUrl = `https://pixabay.com/api/?key=${API_KEY}&q=buildings&image_type=photo&per_page=5`;
      break;
    case 'animals':
      apiUrl = `https://pixabay.com/api/?key=${API_KEY}&q=animals&image_type=photo&per_page=5`;
      break;
    default:
      apiUrl = 'https://randomuser.me/api/?results=5&nat=us,gb,ca,au,nz';
  }

  const response = await fetch(apiUrl);
  const data = await response.json();
  
  if (category === 'faces') {
    return data.results.map(user => ({
      imageSrc: user.picture.large,
      name: `${user.name.first} ${user.name.last}`
    }));
  } else {
    return data.hits.map(hit => ({
      imageSrc: hit.webformatURL,
      name: hit.tags || 'Unknown'
    }));
  }
}

// Start the server
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
