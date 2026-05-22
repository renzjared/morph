const MS_PER_DAY = 86400000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const JAVA_EPOCH_OFFSET = 20581; 

let dictionary = new Set();
let dailyPuzzles = [];
let currentPuzzle = null;
let wordLength = 4;

let state = {
    puzzleId: 0,
    guesses: [],
    isSolved: false
};

let currentInput = [];

const startWordRow = document.getElementById("startWordRow");
const targetWordRow = document.getElementById("targetWordRow");
const guessesContainer = document.getElementById("guessesContainer");
const activeInputRow = document.getElementById("activeInputRow");

async function init() {
    try {
        const wordsRes = await fetch('words.txt');
        const wordsText = await wordsRes.text();
        wordsText.split('\n').forEach(w => dictionary.add(w.trim().toUpperCase()));
        const puzzlesRes = await fetch('morph_puzzles.json');
        dailyPuzzles = await puzzlesRes.json();
    } catch (err) {
        console.error("Failed to fetch data. Using fallbacks.", err);
        dictionary = new Set(["COLD","CORD","CARD","WARD","WARM"]);
        dailyPuzzles = [{ "start": "COLD", "end": "WARM" }];
    }

    const currentPhtDay = Math.floor((Date.now() + MANILA_OFFSET_MS) / MS_PER_DAY) - JAVA_EPOCH_OFFSET;
    const urlParams = new URLSearchParams(window.location.search);
    let requestedId = urlParams.get('p') !== null ? parseInt(urlParams.get('p')) : currentPhtDay;
    
    if (requestedId > currentPhtDay) {
        requestedId = currentPhtDay;
        window.history.replaceState({}, document.title, window.location.pathname + "?p=" + currentPhtDay);
    }
    
    state.puzzleId = Math.max(0, requestedId);
    currentPuzzle = dailyPuzzles[state.puzzleId % dailyPuzzles.length];
    wordLength = currentPuzzle.start.length;
    document.getElementById("puzzleNumber").innerText = `Morph #${state.puzzleId}`;
    
    loadState();
    renderBoard();
    setupKeyboard();
    
    const archiveLinks = document.getElementById("archiveLinks");
    for(let i = Math.max(0, state.puzzleId - 5); i <= state.puzzleId; i++) {
        let a = document.createElement("a");
        a.href = `?p=${i}`; a.className = "archive-link"; a.innerText = `#${i}`;
        archiveLinks.appendChild(a);
    }
}

function loadState() {
    const saved = localStorage.getItem(`morph_state_${state.puzzleId}`);
    if (saved) state = JSON.parse(saved);
}

function saveState() {
    localStorage.setItem(`morph_state_${state.puzzleId}`, JSON.stringify(state));
}

function renderBoard() {
    startWordRow.innerHTML = "";
    targetWordRow.innerHTML = "";
    for(let i=0; i<wordLength; i++) {
        startWordRow.innerHTML += `<div class="letter-box">${currentPuzzle.start[i]}</div>`;
        targetWordRow.innerHTML += `<div class="letter-box">${currentPuzzle.end[i]}</div>`;
    }
    guessesContainer.innerHTML = "";
    state.guesses.forEach(word => {
        const row = document.createElement("div");
        row.className = "word-row guess-word";
        for(let i=0; i<wordLength; i++) {
            row.innerHTML += `<div class="letter-box">${word[i]}</div>`;
        }
        guessesContainer.appendChild(row);
    });

    updateActiveRow();
    if (state.isSolved) {
        activeInputRow.style.display = "none";
        showEndScreen();
    }
}

function updateActiveRow() {
    activeInputRow.innerHTML = "";
    for(let i=0; i<wordLength; i++) {
        const letter = currentInput[i] || "";
        activeInputRow.innerHTML += `<div class="letter-box ${letter ? 'filled' : ''}">${letter}</div>`;
    }
}

function handleKey(key) {
    if (state.isSolved) return;

    if (key === "BACKSPACE") {
        currentInput.pop();
    } else if (key === "ENTER") {
        submitGuess();
    } else if (/^[A-Z]$/.test(key) && currentInput.length < wordLength) {
        currentInput.push(key);
    }
    updateActiveRow();
}

function submitGuess() {
    if (currentInput.length !== wordLength) {
        triggerShake("Not enough letters");
        return;
    }

    const guessWord = currentInput.join("");
    const previousWord = state.guesses.length > 0 ? state.guesses[state.guesses.length - 1] : currentPuzzle.start;

    if (!dictionary.has(guessWord)) {
        triggerShake("Not in word list");
        return;
    }
    let diffCount = 0;
    for (let i = 0; i < wordLength; i++) {
        if (guessWord[i] !== previousWord[i]) diffCount++;
    }

    if (diffCount !== 1) {
        triggerShake("Must change exactly 1 letter");
        return;
    }

    // Success
    state.guesses.push(guessWord);
    currentInput = [];
    
    if (guessWord === currentPuzzle.end) {
        state.isSolved = true;
    }
    
    saveState();
    renderBoard();
    if(state.isSolved) setTimeout(showEndScreen, 500);
}

function triggerShake(msg) {
    activeInputRow.classList.add("shake");
    showToast(msg);
    setTimeout(() => activeInputRow.classList.remove("shake"), 400);
}

// listeners
function setupKeyboard() {
    // Virtual Keyboard (on screen)
    document.querySelectorAll(".key").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            handleKey(btn.getAttribute("data-key"));
        });
    });

    // Physical Keyboard
    document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleKey("ENTER");
        else if (e.key === "Backspace") handleKey("BACKSPACE");
        else {
            const char = e.key.toUpperCase();
            if (/^[A-Z]$/.test(char)) handleKey(char);
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.innerText = msg; toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2500);
}

function showEndScreen() {
    document.getElementById("modalOverlay").style.display = "block";
    document.getElementById("endModal").style.display = "block";
    document.getElementById("endMessage").innerText = `You connected ${currentPuzzle.start} to ${currentPuzzle.end} in ${state.guesses.length} steps!`;
}

document.getElementById("shareBtn").onclick = () => {
    let shareText = `Morph #${state.puzzleId}\n${currentPuzzle.start} ➡️ ${currentPuzzle.end}\nSolved in ${state.guesses.length} steps!`;
    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
        navigator.share({ title: 'Morph', text: shareText }).catch(console.error);
    } else {
        navigator.clipboard.writeText(shareText).then(() => { showToast("Copied to clipboard!"); closeModals(); });
    }
};

// dark Mode
const themeBtn = document.getElementById("themeBtn");
let savedTheme = null;
try { savedTheme = localStorage.getItem("morph_theme"); } catch(e) {}
const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
    document.body.classList.add("dark-mode"); themeBtn.innerText = "☀️";
}

themeBtn.addEventListener("click", (e) => {
    e.preventDefault(); document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeBtn.innerText = isDark ? "☀️" : "🌙";
    try { localStorage.setItem("morph_theme", isDark ? "dark" : "light"); } catch(e) {}
});

// Modals
document.getElementById("helpBtn").onclick = () => { document.getElementById("modalOverlay").style.display = "block"; document.getElementById("helpModal").style.display = "block"; };
document.getElementById("archiveBtn").onclick = () => {
    document.getElementById("modalOverlay").style.display = "block"; document.getElementById("archiveModal").style.display = "block";
    const grid = document.getElementById("archiveGrid"); grid.innerHTML = "";
    const currentPhtDay = Math.floor((Date.now() + MANILA_OFFSET_MS) / MS_PER_DAY) - JAVA_EPOCH_OFFSET;
    
    for (let i = currentPhtDay; i >= 0; i--) {
        let a = document.createElement("a"); a.href = `?p=${i}`; a.className = "archive-item"; a.innerText = `${i}`;
        if (i === state.puzzleId) a.classList.add("current");
        let saved = localStorage.getItem(`morph_state_${i}`);
        if (saved) {
            try { if (JSON.parse(saved).isSolved) a.classList.add("solved"); } catch(e) {}
        }
        grid.appendChild(a);
    }
};
function closeModals() { document.getElementById("modalOverlay").style.display = "none"; document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

init();