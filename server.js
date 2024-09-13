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

  socket.on('joinRoom', (data) => {
    const { playerName, roomId, category } = data;
    console.log(`Received joinRoom request: Player: ${playerName}, Room: ${roomId}, Category: ${category}`);

    socket.playerName = playerName;
    socket.category = category;
    const room = io.sockets.adapter.rooms.get(roomId);
    const numPlayers = room ? room.size : 0;

    if (numPlayers < MAX_PLAYERS) {
      socket.join(roomId);
      socket.roomName = roomId;
      console.log(`${playerName} joined room: ${roomId}`);

      if (numPlayers === 0) {
        roomCreators[roomId] = socket.id;
        socket.emit('roomCreator');
        console.log(`${playerName} is the room creator for room: ${roomId}`);
      }

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

// Function to fetch UNESCO World Heritage Sites and their images using Wikipedia API and Wikimedia API
async function fetchImagesByCategory(category) {
  let apiUrl;

  switch (category) {
    case 'unesco':
      apiUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=UNESCO%20World%20Heritage%20Site&format=json';
      break;
    case 'buildings':
      apiUrl = 'https://pixabay.com/api/?key=45972763-80ccc4101ac506798a0f893fe&q=buildings&image_type=photo&per_page=5';
      break;
    case 'animals':
      apiUrl = 'https://pixabay.com/api/?key=Y45972763-80ccc4101ac506798a0f893fe&q=animals&image_type=photo&per_page=5';
      break;
    default:
      apiUrl = 'https://randomuser.me/api/?results=5&nat=us,gb,ca,au,nz'; // Default to faces
  }

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (category === 'unesco') {
    // Extract article titles for UNESCO World Heritage Sites
    const sites = data.query.search.slice(0, 5); // Take the first 5 sites
    const images = await Promise.all(
      sites.map(async (site) => {
        // Fetch image from Wikimedia API
        const imageResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(site.title)}&prop=pageimages&format=json&pithumbsize=500`);
        const imageData = await imageResponse.json();
        const page = Object.values(imageData.query.pages)[0]; // Get the first page

        return {
          imageSrc: page.thumbnail ? page.thumbnail.source : 'https://via.placeholder.com/500', // Placeholder if no image
          name: site.title, // Use the title as the name of the heritage site
        };
      })
    );
    return images;
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
