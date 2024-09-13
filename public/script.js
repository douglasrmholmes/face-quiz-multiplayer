// public/script.js

const socket = io(); // Ensure Socket.IO connection is working correctly

const startButton = document.getElementById('start-button');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id');
const categorySelect = document.getElementById('category-select'); // Category select dropdown
const messageDiv = document.getElementById('message');
const facesContainer = document.getElementById('faces-container');
const timerDiv = document.getElementById('timer');
const nameInputContainer = document.getElementById('name-input-container');

const SHOW_TIME = 30; // seconds
let faces = [];
let timeLeft = SHOW_TIME;
let timer;
let showNames = true;
let gameMode = ''; // 'single' or 'multi'
let isRoomCreator = false; // Track if the player is the room creator

// Ensure the "Join Room" button triggers the event correctly
startButton.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  const roomId = roomIdInput.value.trim();
  const category = categorySelect.value; // Get the selected category

  if (playerName === '' || roomId === '') {
    alert('Please enter both your name and a room ID.');
    return;
  }

  console.log(`Joining room: ${roomId} as ${playerName} with category: ${category}`); // Debugging log
  socket.emit('joinRoom', { playerName, roomId, category });
  messageDiv.textContent = `Waiting for players to join room: ${roomId}...`;
});

// Room creator is notified
socket.on('roomCreator', () => {
  isRoomCreator = true;
  messageDiv.innerHTML = 'You are the room creator! You can start the game when ready.';
  const startGameButton = document.createElement('button');
  startGameButton.textContent = 'Start Game';
  startGameButton.style.padding = '10px 20px';
  startGameButton.style.fontSize = '16px';
  messageDiv.appendChild(startGameButton);

  // Room creator starts the game
  startGameButton.addEventListener('click', () => {
    socket.emit('startGame');
    startGameButton.style.display = 'none'; // Hide the button once the game starts
  });
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

  socket.emit('submitAnswers', { answers, score: correct });
  messageDiv.innerHTML = 'Waiting for other players to finish...';
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
