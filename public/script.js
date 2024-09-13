// public/script.js

const socket = io(); // Ensure Socket.IO connection is working correctly

const modeSelection = document.getElementById('mode-selection');
const roomSelection = document.getElementById('room-selection');
const categorySelection = document.getElementById('category-selection');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id');
const categorySelect = document.getElementById('category-select'); // Category select dropdown
const messageDiv = document.getElementById('message');
const facesContainer = document.getElementById('faces-container');
const timerDiv = document.getElementById('timer');

const singlePlayerButton = document.getElementById('single-player-button');
const joinRoomButton = document.getElementById('join-room-button');
const createRoomButton = document.getElementById('create-room-button');
const joinRoomSubmitButton = document.getElementById('join-room-submit-button');
const startGameButton = document.getElementById('start-game-button');

let isRoomCreator = false; // Track if the player is the room creator
let gameMode = ''; // 'single' or 'multi'

modeSelection.style.display = 'block'; // Show mode selection by default

// Single Player Mode: Show category selection
singlePlayerButton.addEventListener('click', () => {
  gameMode = 'single';
  modeSelection.style.display = 'none';
  categorySelection.style.display = 'block';
});

// Join Room Mode: Show room input field
joinRoomButton.addEventListener('click', () => {
  gameMode = 'multi';
  isRoomCreator = false;
  modeSelection.style.display = 'none';
  roomSelection.style.display = 'block';
});

// Create Room Mode: Show category selection for creating a room
createRoomButton.addEventListener('click', () => {
  gameMode = 'multi';
  isRoomCreator = true;
  modeSelection.style.display = 'none';
  categorySelection.style.display = 'block';
});

// Handle room join submission
joinRoomSubmitButton.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (roomId === '') {
    alert('Please enter a room ID.');
    return;
  }
  
  socket.emit('joinRoom', { playerName: 'Player', roomId, category: '' });
  messageDiv.textContent = `Waiting for players to join room: ${roomId}...`;
  roomSelection.style.display = 'none';
});

// Start the game after category selection (for single player or room creation)
startGameButton.addEventListener('click', () => {
  const category = categorySelect.value;
  
  if (gameMode === 'single') {
    startSinglePlayerGame(category);
  } else if (isRoomCreator) {
    const roomId = Math.random().toString(36).substring(7); // Generate random room ID
    socket.emit('joinRoom', { playerName: 'Player', roomId, category });
    messageDiv.textContent = `Room ID: ${roomId} - Waiting for players to join...`;
    categorySelection.style.display = 'none';
  }
});

// Function to start the game in single-player mode
function startSinglePlayerGame(category) {
  messageDiv.textContent = `Starting single-player game with category: ${category}...`;
  fetchFaces(category).then((facesData) => {
    faces = facesData.map((data) => new Face(data.imageSrc, data.name));
    startMemorization();
  });
}

// Fetch faces for different categories
function fetchFaces(category) {
  return new Promise((resolve, reject) => {
    if (category === 'unesco') {
      // Use Pixabay API to search for UNESCO World Heritage Site images
      const unescoSites = [
        'Great Wall of China',
        'Taj Mahal',
        'Machu Picchu',
        'Stonehenge',
        'Statue of Liberty'
      ];

      const apiKey = '45972763-80ccc4101ac506798a0f893fe'; // Replace with your Pixabay API key
      const imagePromises = unescoSites.map((site) =>
        fetch(`https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(site)}&image_type=photo&per_page=1`)
          .then((response) => response.json())
          .then((data) => {
            if (data.hits.length > 0) {
              return {
                imageSrc: data.hits[0].webformatURL,
                name: site
              };
            } else {
              // Fallback to placeholder if no image found
              return {
                imageSrc: 'https://via.placeholder.com/500',
                name: site
              };
            }
          })
      );

      Promise.all(imagePromises)
        .then((images) => resolve(images))
        .catch((error) => reject(error));
    } else {
      // Fetch random user images for 'faces' category
      fetch(`https://randomuser.me/api/?results=5&nat=us,gb,ca,au,nz`)
        .then((response) => response.json())
        .then((data) => {
          const faces = data.results.map((user) => ({
            imageSrc: user.picture.large,
            name: `${user.name.first} ${user.name.last}`
          }));
          resolve(faces);
        })
        .catch((error) => {
          reject(error);
        });
    }
  });
}

socket.on('roomCreator', () => {
  isRoomCreator = true;
  messageDiv.innerHTML = 'You are the room creator! Waiting for players to join...';
});

socket.on('startGame', (facesData) => {
  faces = facesData.map((data) => new Face(data.imageSrc, data.name));
  messageDiv.textContent = '';
  startMemorization();
});

socket.on('error', (errorMessage) => {
  messageDiv.textContent = errorMessage;
});

class Face {
  constructor(imageSrc, name) {
    this.imageSrc = imageSrc;
    this.name = name;
    this.userInput = '';
    this.element = null;
    this.inputElement = null;
  }

  createElement() {
    const faceItem = document.createElement('div');
    faceItem.className = 'face-item';

    const img = document.createElement('img');
    img.src = this.imageSrc;
    faceItem.appendChild(img);

    if (showNames) {
      const nameDiv = document.createElement('div');
      nameDiv.textContent = this.name;
      nameDiv.style.marginTop = '10px';
      faceItem.appendChild(nameDiv);
    } else {
      this.inputElement = document.createElement('input');
      this.inputElement.type = 'text';
      this.inputElement.className = 'face-input';
      this.inputElement.placeholder = 'Enter name';
      faceItem.appendChild(this.inputElement);
    }

    this.element = faceItem;
    facesContainer.appendChild(faceItem);
  }
}

function displayFaces() {
  facesContainer.innerHTML = '';
  faces.forEach((face) => {
    face.createElement();
  });
}

function startMemorization() {
  showNames = true;
  timeLeft = 30;
  facesContainer.style.display = 'flex';
  displayFaces();
  timerDiv.textContent = `Time Left: ${timeLeft}`;

  timer = setInterval(() => {
    timeLeft--;
    timerDiv.textContent = `Time Left: ${timeLeft}`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      startRecall();
    }
  }, 1000);
}

function startRecall() {
  showNames = false;
  facesContainer.innerHTML = '';
  displayFaces();
  timerDiv.textContent = '';
  messageDiv.textContent = '';

  const submitButton = document.createElement('button');
  submitButton.id = 'submit-button';
  submitButton.textContent = 'Submit Answers';
  submitButton.style.marginTop = '20px';
  submitButton.style.padding = '10px 20px';
  submitButton.style.fontSize = '16px';
  submitButton.addEventListener('click', submitAnswers);
  messageDiv.appendChild(submitButton);
}

function submitAnswers() {
  let correct = 0;
  const answers = [];
  faces.forEach((face) => {
    const userAnswer = face.inputElement.value.trim();
    answers.push({ name: face.name, userAnswer });
    if (userAnswer.toLowerCase() === face.name.toLowerCase()) {
      correct++;
    }
  });

  messageDiv.innerHTML = `You got ${correct}/${faces.length} correct!`;
}
