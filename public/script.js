// public/script.js

const socket = io(); // Use relative path for Socket.IO connection

const singlePlayerButton = document.getElementById('single-player-button');
const multiPlayerButton = document.getElementById('multi-player-button');
const startButton = document.getElementById('start-button');
const facesContainer = document.getElementById('faces-container');
const messageDiv = document.getElementById('message');
const timerDiv = document.getElementById('timer');
const nameInputContainer = document.getElementById('name-input-container');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id');

const SHOW_TIME = 30; // seconds
let faces = [];
let timeLeft = SHOW_TIME;
let timer;
let showNames = true;
let gameMode = ''; // 'single' or 'multi'

// Single-Player Mode: Start the game immediately
singlePlayerButton.addEventListener('click', () => {
  gameMode = 'single';
  startSinglePlayerGame();
});

// Multiplayer Mode: Show name and room input fields
multiPlayerButton.addEventListener('click', () => {
  gameMode = 'multi';
  nameInputContainer.style.display = 'block';
  document.getElementById('mode-selection').style.display = 'none'; // Hide mode selection buttons
});

// Join room when the start button is clicked in multiplayer mode
startButton.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  const roomId = roomIdInput.value.trim();
  
  if (playerName === '' || roomId === '') {
    alert('Please enter both your name and a room ID.');
    return;
  }

  // Emit event to join room with the given room ID
  socket.emit('joinRoom', { playerName, roomId });
  nameInputContainer.style.display = 'none';
  messageDiv.textContent = `Waiting for players to join room: ${roomId}...`;
});

socket.on('waitingForPlayers', (message) => {
  messageDiv.textContent = message;
});

// Function to start the game in single-player mode
function startSinglePlayerGame() {
  messageDiv.textContent = 'Starting single-player game...';

  // Simulate the fetching of faces as if in multiplayer mode
  fetchFaces().then((facesData) => {
    faces = facesData.map((data) => new Face(data.imageSrc, data.name));
    startMemorization();
  });
}

// Fetch random faces (simulating what the server would do)
async function fetchFaces() {
  const response = await fetch('https://randomuser.me/api/?results=5&nat=us,gb,ca,au,nz');
  const data = await response.json();
  return data.results.map(user => ({
    imageSrc: user.picture.large,
    name: `${user.name.first} ${user.name.last}`
  }));
}

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
  timeLeft = SHOW_TIME;
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

  if (gameMode === 'single') {
    displaySinglePlayerResults(correct);
  } else {
    // Multiplayer: send answers to the server
    socket.emit('submitAnswers', { answers, score: correct });
    messageDiv.innerHTML = 'Waiting for other players to finish...';
  }
}

function displaySinglePlayerResults(score) {
  messageDiv.innerHTML = `Game over!<br>Your Score: ${score}/5<br>The game will restart shortly...`;
  setTimeout(() => {
    location.reload();
  }, 5000);
}

socket.on('gameOver', (results) => {
  facesContainer.style.display = 'none';
  let resultMessage = 'Game Over!<br>';
  results.forEach((player, index) => {
    resultMessage += `${index + 1}. ${player.playerName} - ${player.score}/5<br>`;
  });
  messageDiv.innerHTML = resultMessage + 'The game will restart shortly...';
  setTimeout(() => {
    location.reload();
  }, 5000);
});
