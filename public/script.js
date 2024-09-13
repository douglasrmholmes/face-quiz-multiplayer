// public/script.js

const socket = io(); // Use relative path for Socket.IO connection

const startButton = document.getElementById('start-button');
const facesContainer = document.getElementById('faces-container');
const messageDiv = document.getElementById('message');
const timerDiv = document.getElementById('timer');
const nameInputContainer = document.getElementById('name-input-container');
const playerNameInput = document.getElementById('player-name');

const SHOW_TIME = 30; // seconds
let faces = [];
let timeLeft = SHOW_TIME;
let timer;
let showNames = true;

startButton.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  if (playerName === '') {
    alert('Please enter your name.');
    return;
  }
  socket.emit('playerReady', playerName);
  nameInputContainer.style.display = 'none';
  messageDiv.textContent = 'Waiting for an opponent...';
});

socket.on('waitingForOpponent', () => {
  messageDiv.textContent = 'Waiting for an opponent...';
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
    // Create container
    const faceItem = document.createElement('div');
    faceItem.className = 'face-item';

    // Create image
    const img = document.createElement('img');
    img.src = this.imageSrc;
    faceItem.appendChild(img);

    // Create name or input field
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

  // Add a submit button
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
  messageDiv.innerHTML = 'Waiting for your opponent to finish...';
}

socket.on('gameOver', (data) => {
  const { result, player1Score, player2Score } = data;
  facesContainer.style.display = 'none';
  messageDiv.innerHTML = `${result}<br>Your Score: ${player1Score}<br>Opponent's Score: ${player2Score}<br>The game will restart shortly...`;
  setTimeout(() => {
    location.reload();
  }, 5000);
});
