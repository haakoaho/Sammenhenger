document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridContainer = document.getElementById('grid-container');
    const completedContainer = document.getElementById('completed-groups-container');
    const shuffleButton = document.getElementById('shuffle-button');
    const deselectButton = document.getElementById('deselect-button');
    const submitButton = document.getElementById('submit-button');
    const mistakeDots = document.querySelectorAll('.mistake-dots .dot');
    const puzzleSelector = document.getElementById('puzzle-selector');
    const difficultyStarsContainer = document.getElementById('puzzle-difficulty-stars');

    const alertOneAway = document.getElementById('alert-one-away');
    const alertAlreadyGuessed = document.getElementById('alert-already-guessed');

    const rulesModal = document.getElementById('rules-modal');
    const resultsModal = document.getElementById('results-modal');
    const closeButtons = document.querySelectorAll('.modal-close');
    
    // --- Game State ---
    let state = {
        allPuzzles: [],
        currentPuzzle: null,
        items: [],
        activeItems: [],
        completedGroups: [],
        mistakesRemaining: 4,
        guesses: [],
        isFinished: false,
    };

    // --- Core Game Logic ---
    function init() {
        fetch('games.json')
            .then(response => response.json())
            .then(data => {
                state.allPuzzles = data;
                populateSelector();
                loadPuzzle(state.allPuzzles[0]);
                setupEventListeners();
                rulesModal.classList.remove('hidden'); // Show rules on first load
            });
    }

    function populateSelector() {
        state.allPuzzles.forEach((puzzle, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = puzzle.puzzle_name;
            puzzleSelector.appendChild(option);
        });
    }

    function loadPuzzle(puzzleData) {
        state.currentPuzzle = puzzleData;
        const allItems = puzzleData.groups.flatMap(g => g.items);
        
        state.items = shuffleArray(allItems);
        state.activeItems = [];
        state.completedGroups = [];
        state.mistakesRemaining = 4;
        state.guesses = [];
        state.isFinished = false;
        
        render();
        updateDifficultyStars();
    }

    function render() {
        // Clear containers
        gridContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        hideAlerts();

        // Render completed groups
        state.completedGroups.sort((a, b) => a.difficulty - b.difficulty).forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = `completed-group difficulty-${group.difficulty}`;
            groupDiv.innerHTML = `
                <div class="completed-group-category">${group.category}</div>
                <div class="completed-group-items">${group.items.join(', ')}</div>
            `;
            completedContainer.appendChild(groupDiv);
        });
        
        // Render grid items
        state.items.forEach(item => {
            const tile = document.createElement('button');
            tile.className = 'tile';
            tile.textContent = item;
            if (state.activeItems.includes(item)) {
                tile.classList.add('active');
            }
            tile.addEventListener('click', () => handleTileClick(item));
            gridContainer.appendChild(tile);
        });

        // Update mistakes
        mistakeDots.forEach((dot, index) => {
            dot.classList.toggle('used', index >= state.mistakesRemaining);
        });

        // Update buttons
        deselectButton.disabled = state.activeItems.length === 0 || state.isFinished;
        submitButton.disabled = state.activeItems.length !== 4 || state.isFinished;
        shuffleButton.disabled = state.isFinished;
    }

    // --- Event Handlers ---
    function setupEventListeners() {
        puzzleSelector.addEventListener('change', (e) => {
            loadPuzzle(state.allPuzzles[e.target.value]);
        });
        shuffleButton.addEventListener('click', handleShuffle);
        deselectButton.addEventListener('click', handleDeselect);
        submitButton.addEventListener('click', handleSubmit);
        closeButtons.forEach(btn => btn.addEventListener('click', () => {
            rulesModal.classList.add('hidden');
            resultsModal.classList.add('hidden');
        }));
    }

    function handleTileClick(item) {
        if (state.isFinished) return;

        hideAlerts();
        const itemIndex = state.activeItems.indexOf(item);
        if (itemIndex > -1) {
            state.activeItems.splice(itemIndex, 1);
        } else if (state.activeItems.length < 4) {
            state.activeItems.push(item);
        }
        render();
    }

    function handleShuffle() {
        state.items = shuffleArray(state.items);
        render();
    }
    
    function handleDeselect() {
        state.activeItems = [];
        render();
    }

    function handleSubmit() {
        if (state.activeItems.length !== 4) return;

        const guess = [...state.activeItems].sort();
        
        // Check for duplicate guess
        if (isAlreadyGuessed(guess)) {
            alertAlreadyGuessed.classList.remove('hidden');
            return;
        }
        state.guesses.push(guess);
        
        // Find which group the guess belongs to
        const matchedGroup = findMatchedGroup(state.activeItems);

        if (matchedGroup) { // Correct guess
            state.completedGroups.push(matchedGroup);
            state.items = state.items.filter(item => !state.activeItems.includes(item));
            state.activeItems = [];

            if (state.completedGroups.length === 4) {
                endGame();
            }
        } else { // Incorrect guess
            state.mistakesRemaining--;
            animateWrongGuess();
            if (isOneAway()) {
                alertOneAway.classList.remove('hidden');
            }
            if (state.mistakesRemaining === 0) {
                endGame(true); // Lost
            }
        }
        render();
    }
    
    function endGame(lost = false) {
        state.isFinished = true;
        if (lost) {
            const remainingGroups = state.currentPuzzle.groups.filter(g => !state.completedGroups.includes(g));
            state.completedGroups.push(...remainingGroups);
        }
        showResults();
        render();
    }

    function showResults() {
        const titleEl = document.getElementById('results-title');
        const subtitleEl = document.getElementById('results-subtitle');
        const emojisEl = document.getElementById('results-emojis');

        const mistakesMade = 4 - state.mistakesRemaining;
        const resultTitles = ["Perfekt!", "Utrolig!", "Bra jobbet!", "Bra!", "Synd..."];
        titleEl.textContent = `Resultater - ${resultTitles[mistakesMade] || resultTitles[4]}`;
        subtitleEl.textContent = `Du løste "${state.currentPuzzle.puzzle_name}"`;

        // Generate emoji grid
        let emojiText = '';
        const colorMap = {1: '🟨', 2: '🟩', 3: '🟦', 4: '🟪'};
        state.guesses.forEach(guess => {
            guess.forEach(item => {
                const group = state.currentPuzzle.groups.find(g => g.items.includes(item));
                emojiText += colorMap[group.difficulty];
            });
            emojiText += '\n';
        });
        emojisEl.textContent = emojiText;
        
        resultsModal.classList.remove('hidden');
    }

    // --- Helper Functions ---
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function findMatchedGroup(items) {
        return state.currentPuzzle.groups.find(group => 
            items.every(item => group.items.includes(item))
        );
    }

    function isAlreadyGuessed(guess) {
        return state.guesses.some(g => JSON.stringify(g) === JSON.stringify(guess));
    }

    function isOneAway() {
        return state.currentPuzzle.groups.some(group => {
            const matches = state.activeItems.filter(item => group.items.includes(item)).length;
            return matches === 3;
        });
    }
    
    function animateWrongGuess() {
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            if (state.activeItems.includes(tile.textContent)) {
                tile.classList.add('shake-animation');
                setTimeout(() => tile.classList.remove('shake-animation'), 500);
            }
        });
    }

    function hideAlerts() {
        alertOneAway.classList.add('hidden');
        alertAlreadyGuessed.classList.add('hidden');
    }
    
    function updateDifficultyStars() {
        difficultyStarsContainer.innerHTML = '';
        const difficulty = state.currentPuzzle.puzzle_difficulty || 0;
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.textContent = '★';
            if (i <= difficulty) {
                star.classList.add('filled');
            }
            difficultyStarsContainer.appendChild(star);
        }
    }

    // --- Start the game ---
    init();
});