const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRID_SIZE = 20;
const TILE_COUNT_X = canvas.width / GRID_SIZE;
const TILE_COUNT_Y = canvas.height / GRID_SIZE;
const GAME_SPEED = 100; // ms per frame

// Colors
const COLOR_SNAKE_TOP = '#28e028';
const COLOR_SNAKE_SIDE = '#1a5c1a';
const COLOR_APPLE = '#ff3333';
const COLOR_APPLE_SIDE = '#990000';
const COLOR_BG = '#111';

// Game State
let snake = [];
let velocity = { x: 0, y: 0 };
let food = { x: 5, y: 5 };
let score = 0;
let gameInterval;
let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER

// Input Queue to fix "random death" bug
let inputQueue = [];

// Menu Navigation
let currentMenuIndex = 0;
const menus = {
    'START': document.getElementById('mainMenu'),
    'PAUSED': document.getElementById('pauseMenu'),
    'GAMEOVER': document.getElementById('gameOverMenu')
};

// --- AUDIO SYSTEM ---
let audioCtx = null;
let musicInterval = null;
let isMuted = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration, vol = 0.1) {
    if (!audioCtx || isMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Simple 8-bit Arpeggio Music
const musicNotes = [
    220, 0, 261, 0, 329, 0, 261, 0,
    196, 0, 246, 0, 293, 0, 246, 0
];
let noteIndex = 0;

function startMusic() {
    if (musicInterval) clearInterval(musicInterval);
    noteIndex = 0;
    musicInterval = setInterval(() => {
        if (gameState === 'PLAYING') {
            const freq = musicNotes[noteIndex];
            if (freq > 0) playTone(freq, 'square', 0.1, 0.05);
            noteIndex = (noteIndex + 1) % musicNotes.length;
        }
    }, 150);
}

function stopMusic() {
    if (musicInterval) clearInterval(musicInterval);
}

function playEatSound() {
    playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(800, 'sine', 0.1, 0.1), 50);
}

function playGameOverSound() {
    playTone(150, 'sawtooth', 0.5, 0.2);
    setTimeout(() => playTone(100, 'sawtooth', 0.5, 0.2), 200);
}

function playMenuMoveSound() {
    playTone(200, 'square', 0.05, 0.05);
}

function playMenuSelectSound() {
    playTone(440, 'square', 0.1, 0.1);
    setTimeout(() => playTone(660, 'square', 0.2, 0.1), 50);
}

// --- GAME LOGIC ---

function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 }
    ];
    velocity = { x: 0, y: -1 }; // Start moving up
    inputQueue = []; // Clear input queue
    score = 0;
    placeFood();
}

function placeFood() {
    food = {
        x: Math.floor(Math.random() * TILE_COUNT_X),
        y: Math.floor(Math.random() * TILE_COUNT_Y)
    };
    // Check if food spawns on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            placeFood();
            return;
        }
    }
}

// Input Handling
document.addEventListener('keydown', handleInput);

function handleInput(e) {
    // Initialize audio on first interaction
    if (!audioCtx) initAudio();

    if (gameState === 'PLAYING') {
        // Prevent default scrolling for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) > -1) {
            e.preventDefault();
        }

        const key = e.key.toLowerCase();

        // Determine desired direction based on key
        let newVelocity = null;

        if (key === 'arrowup' || key === 'w') newVelocity = { x: 0, y: -1 };
        else if (key === 'arrowdown' || key === 's') newVelocity = { x: 0, y: 1 };
        else if (key === 'arrowleft' || key === 'a') newVelocity = { x: -1, y: 0 };
        else if (key === 'arrowright' || key === 'd') newVelocity = { x: 1, y: 0 };

        if (newVelocity) {
            // Add to queue if it's not full (limit 2 to prevent huge lag)
            if (inputQueue.length < 2) {
                inputQueue.push(newVelocity);
            }
        } else if (key === 'escape') {
            pauseGame();
        }
    } else if (['START', 'PAUSED', 'GAMEOVER'].includes(gameState)) {
        handleMenuInput(e);
    }
}

function handleMenuInput(e) {
    const currentMenu = menus[gameState];
    const options = currentMenu.querySelectorAll('.menu-item');

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        currentMenuIndex = (currentMenuIndex - 1 + options.length) % options.length;
        updateMenuSelection(options);
        playMenuMoveSound();
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        currentMenuIndex = (currentMenuIndex + 1) % options.length;
        updateMenuSelection(options);
        playMenuMoveSound();
    } else if (e.key === 'Enter') {
        playMenuSelectSound();
        const action = options[currentMenuIndex].dataset.action;
        executeMenuAction(action);
    }
}

function updateMenuSelection(options) {
    options.forEach((opt, index) => {
        if (index === currentMenuIndex) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
}

function executeMenuAction(action) {
    switch (action) {
        case 'start':
            initAudio(); // Ensure audio is ready
            startGame();
            break;
        case 'exit':
            location.reload();
            break;
        case 'resume':
            resumeGame();
            break;
        case 'quit':
            showMainMenu();
            break;
        case 'retry':
            startGame();
            break;
    }
}

// Game Logic
function startGame() {
    initGame();
    hideAllMenus();
    gameState = 'PLAYING';
    startMusic();
    gameInterval = setInterval(gameLoop, GAME_SPEED);
}

function pauseGame() {
    clearInterval(gameInterval);
    gameState = 'PAUSED';
    showMenu('PAUSED');
}

function resumeGame() {
    hideAllMenus();
    gameState = 'PLAYING';
    gameInterval = setInterval(gameLoop, GAME_SPEED);
}

function showMainMenu() {
    clearInterval(gameInterval);
    stopMusic();
    gameState = 'START';
    showMenu('START');
}

function gameOver() {
    clearInterval(gameInterval);
    stopMusic();
    playGameOverSound();
    gameState = 'GAMEOVER';
    document.getElementById('finalScore').innerText = score;
    showMenu('GAMEOVER');
}

function showMenu(state) {
    hideAllMenus();
    menus[state].classList.add('active');
    currentMenuIndex = 0;
    const options = menus[state].querySelectorAll('.menu-item');
    updateMenuSelection(options);
}

function hideAllMenus() {
    Object.values(menus).forEach(menu => menu.classList.remove('active'));
}

function gameLoop() {
    update();
    draw();
}

function update() {
    // Process Input Queue
    if (inputQueue.length > 0) {
        const nextMove = inputQueue.shift();
        // Validate move: cannot reverse direction directly
        // If moving UP (y=-1), cannot move DOWN (y=1)
        // If moving LEFT (x=-1), cannot move RIGHT (x=1)
        if (velocity.x === 0 && nextMove.y !== -velocity.y) {
            velocity = nextMove;
        } else if (velocity.y === 0 && nextMove.x !== -velocity.x) {
            velocity = nextMove;
        }
        // If invalid, we just ignore it and keep current velocity (or check next in queue if we wanted to be fancy, but dropping is standard)
    }

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    // Wall Collision
    if (head.x < 0 || head.x >= TILE_COUNT_X || head.y < 0 || head.y >= TILE_COUNT_Y) {
        gameOver();
        return;
    }

    // Self Collision
    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Eat Food
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        playEatSound();
        placeFood();
    } else {
        snake.pop();
    }
}

// Rendering
function draw() {
    // Clear Screen
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Subtle)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < TILE_COUNT_X; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < TILE_COUNT_Y; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    // Draw Food (Low Poly Cube Style)
    drawCube(food.x, food.y, COLOR_APPLE, COLOR_APPLE_SIDE);

    // Draw Snake
    snake.forEach(segment => {
        drawCube(segment.x, segment.y, COLOR_SNAKE_TOP, COLOR_SNAKE_SIDE);
    });
}

function drawCube(x, y, colorTop, colorSide) {
    const px = x * GRID_SIZE;
    const py = y * GRID_SIZE;
    const size = GRID_SIZE - 2; // Slight gap

    // "3D" effect: Draw side/shadow first
    ctx.fillStyle = colorSide;
    ctx.fillRect(px + 2, py + 2, size, size);

    // Draw top face slightly offset
    ctx.fillStyle = colorTop;
    ctx.fillRect(px, py, size, size);
}

// Initial Draw
showMainMenu();
