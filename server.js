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

// Extended list of UNESCO World Heritage Sites
const unescoSites = [
  'Great Wall of China',
  'Taj Mahal',
  'Machu Picchu',
  'Stonehenge',
  'Statue of Liberty',
  'Acropolis of Athens',
  'Angkor Wat',
  'Colosseum',
  'Chichen Itza',
  'Alhambra',
  'Pyramids of Giza',
  'Sydney Opera House',
  'Mont-Saint-Michel',
  'Grand Canyon National Park',
  'Yellowstone National Park',
  'Petra',
  'Hagia Sophia',
  'Venice and its Lagoon',
  'Historic Centre of Rome',
  'Kremlin and Red Square',
  'Versailles Palace',
  'Tower of London',
  'Mount Fuji',
  'Historic Sanctuary of Machu Picchu',
  'Galápagos Islands',
  'Great Barrier Reef',
  'Iguazu National Park',
  'Teotihuacan',
  'Banff National Park',
  'Medina of Fez',
  'Cappadocia',
  'Hampi',
  'Jungfrau-Aletsch Protected Area',
  'Old City of Jerusalem',
  'Yellowstone National Park',
  'Cenotes of Yucatán',
  'Historic Monuments of Kyoto',
  'Old Havana and its Fortifications',
  'Antelope Canyon',
  'Historic Centre of Florence',
  'Palace of Westminster',
  'Historic Centre of Bruges',
  'Forbidden City',
  'Carlsbad Caverns National Park',
  'Halong Bay',
  'Victoria Falls',
  'Serengeti National Park',
  'Torres del Paine National Park',
  'Notre-Dame Cathedral',
  'Mount Kilimanjaro',
  'Ngorongoro Conservation Area',
  'Redwood National and State Parks',
  'Old Town of Dubrovnik',
  'Sagrada Familia',
  'Monticello and the University of Virginia',
  'Independence Hall',
  'Giant’s Causeway',
  'Historic Centre of Vienna',
  'Rapa Nui National Park (Easter Island)',
  'Kilimanjaro National Park',
  'Surtsey',
  'Auschwitz-Birkenau',
  'Bryce Canyon National Park',
  'Plitvice Lakes National Park',
  'Vatnajökull National Park',
  'Selous Game Reserve',
  'Goreme National Park and Rock Sites of Cappadocia',
  'Sintra',
  'Historic Centre of Oporto',
  'Archaeological Site of Delphi',
  'Olympia',
  'Royal Botanic Gardens, Kew',
  'Valley of the Temples',
  'Cathedral of Notre-Dame, Former Abbey of Saint-Rémi and Palace of Tau, Reims',
  'Historic Centre of Salzburg',
  'Wartburg Castle',
  'Old City of Bern',
  'Fjords of Norway',
  'Royal Exhibition Building and Carlton Gardens',
  'Fortress of Suomenlinna',
  'Pre-Hispanic City of Teotihuacan',
  'San Agustin Archaeological Park',
  'Ancient City of Damascus',
  'Historic Centre of San Gimignano',
  'Historic Centre of Tallinn',
  'Historic Centre of Prague',
  'Alcázar of Seville',
  'Pont du Gard',
  'Canterbury Cathedral',
  'Galapagos Islands',
  'Bryggen',
  'Old City of Salamanca',
  'City of Cusco',
  'Old Town of Lijiang',
  'Medina of Marrakesh',
  'Island of Mozambique',
  'Old Town of Corfu',
  'Mausoleum of the First Qin Emperor',
  'Newgrange'
];

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
  if (category === 'unesco') {
    // Fetch images for predefined UNESCO World Heritage Sites
    const images = await Promise.all(
      unescoSites.map(async (site) => {
        // Fetch image from Wikimedia API based on site name
        const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(site)}&prop=pageimages&format=json&pithumbsize=500`);
        const data = await response.json();
        const page = Object.values(data.query.pages)[0];

        return {
          imageSrc: page.thumbnail ? page.thumbnail.source : 'https://via.placeholder.com/500', // Placeholder if no image
          name: site
        };
      })
    );
    return images;
  } else {
    // Handle other categories (e.g., Faces, Buildings, Animals)
    return fetchImagesForOtherCategories(category);
  }
}

// Function to handle other categories
async function fetchImagesForOtherCategories(category) {
  let apiUrl;

  switch (category) {
    case 'buildings':
      apiUrl = 'https://pixabay.com/api/?key=YOUR_PIXABAY_API_KEY&q=buildings&image_type=photo&per_page=5';
      break;
    case 'animals':
      apiUrl = 'https://pixabay.com/api/?key=YOUR_PIXABAY_API_KEY&q=animals&image_type=photo&per_page=5';
      break;
    default:
      apiUrl = 'https://randomuser.me/api/?results=5&nat=us,gb,ca,au,nz'; // Default to faces
  }

  const response = await fetch(apiUrl);
  const data = await response.json();

  return data.hits.map(hit => ({
    imageSrc: hit.webformatURL,
    name: hit.tags || 'Unknown'
  }));
}

// Start the server
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
