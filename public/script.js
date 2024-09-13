// public/script.js

const socket = io(); // Use relative path for Socket.IO connection

const startButton = document.getElementById('start-button');
const facesContainer = document.getElementById('faces-container');
const messageDiv = document.getElementById('message');
const timerDiv = document.getElementById('timer');
const nameInputContainer = document.getElementById('name-input-container');
const playerNameInput = document.getElementById('player-name');
const roomIdInput = document.getElementById('room-id'); // New field for room ID

const SHOW_TIME = 30; // seconds
let faces = [];
let timeLeft = SHOW_TIME;
let timer;
let showNames = true;

// Join room when the start button is clicked
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
  messageDiv.textContent = `Waiting for another player to join room: ${roomId}...`;
});

socket.on('waitingForOpponent', () => {
  messageDiv.textContent = 'Waiting for an opponent...';
});

socket.on('roomFull', () => {
  alert('This room is full. Please try a different room ID.');
  location.reload();
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
    this.name
