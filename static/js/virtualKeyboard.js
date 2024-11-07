const keyboard = document.getElementById("virtual-keyboard");
let currentInput = null;
let isShiftActive = false;
let isSymbolsActive = false;

const keys = {
    numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    symbols1: ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    symbols2: ["-", "_", "=", "+", "[", "]", "{", "}", "|", "\\"],
    symbols3: [";", ":", "'", '"', ",", ".", "<", ">", "?", "/"],
    topRow: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    middleRow: ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    bottomRow: ["z", "x", "c", "v", "b", "n", "m"],
};

export function initializeVirtualKeyboard() {
    initializeKeyboard();
    addInputFocusListeners();
    addDocumentClickListener();
}

function initializeKeyboard() {
    keyboard.innerHTML = `
        <div class="keyboard">
            <div class="keyboard-row" id="number-row"></div>
            <div class="keyboard-row" id="symbols1-row"></div>
            <div class="keyboard-row" id="symbols2-row"></div>
            <div class="keyboard-row" id="symbols3-row"></div>
            <div class="keyboard-row" id="top-row"></div>
            <div class="keyboard-row" id="middle-row"></div>
            <div class="keyboard-row" id="bottom-row"></div>
            <div class="keyboard-row" id="action-row">
                <button class="keyboard-key shift-key">Shift</button>
                <button class="keyboard-key symbols-key">!#$</button>
                <button class="keyboard-key space-key">Space</button>
                <button class="keyboard-key backspace-key">←</button>
                <button class="keyboard-key enter-key">Enter</button>
            </div>
        </div>
    `;

    initializeRow("number-row", keys.numbers);
    initializeRow("symbols1-row", keys.symbols1);
    initializeRow("symbols2-row", keys.symbols2);
    initializeRow("symbols3-row", keys.symbols3);
    initializeRow("top-row", keys.topRow);
    initializeRow("middle-row", keys.middleRow);
    initializeRow("bottom-row", keys.bottomRow);

    document.querySelector(".shift-key").addEventListener("click", toggleShift);
    document.querySelector(".symbols-key").addEventListener("click", toggleSymbols);
    document.querySelector(".space-key").addEventListener("click", () => handleInput(" "));
    document.querySelector(".backspace-key").addEventListener("click", handleBackspace);
    document.querySelector(".enter-key").addEventListener("click", hideKeyboard);

    toggleSymbolRows(false);
}

function initializeRow(rowId, keys) {
    const row = document.getElementById(rowId);
    keys.forEach((key) => {
        const button = createKeyButton(key);
        row.appendChild(button);
    });
}

function createKeyButton(key) {
    const button = document.createElement("button");
    button.className = "keyboard-key";
    button.textContent = key;
    if (key.length === 1) {
        button.addEventListener("click", () => handleInput(key));
    }
    return button;
}

function toggleShift() {
    isShiftActive = !isShiftActive;
    document.querySelector(".shift-key").classList.toggle("active");
    updateKeyboardCase();
}

function toggleSymbols() {
    isSymbolsActive = !isSymbolsActive;
    document.querySelector(".symbols-key").classList.toggle("active");
    toggleSymbolRows(isSymbolsActive);
}

function toggleSymbolRows(show) {
    const symbolRows = [
        document.getElementById("symbols1-row"),
        document.getElementById("symbols2-row"),
        document.getElementById("symbols3-row"),
    ];

    symbolRows.forEach((row) => {
        row.style.display = show ? "flex" : "none";
    });
}

function updateKeyboardCase() {
    const keyButtons = document.querySelectorAll(".keyboard-key");
    keyButtons.forEach((button) => {
        if (button.textContent.length === 1) {
            button.textContent = isShiftActive
                ? button.textContent.toUpperCase()
                : button.textContent.toLowerCase();
        }
    });
}

function handleInput(key) {
    if (!currentInput) return;

    const newValue =
        currentInput.value + (isShiftActive ? key.toUpperCase() : key);
    currentInput.value = newValue;

    // Trigger input event for validation
    const event = new Event("input", { bubbles: true });
    currentInput.dispatchEvent(event);
}

function handleBackspace() {
    if (!currentInput) return;
    currentInput.value = currentInput.value.slice(0, -1);

    // Trigger input event for validation
    const event = new Event("input", { bubbles: true });
    currentInput.dispatchEvent(event);
}

function showKeyboard(input) {
    currentInput = input;
    keyboard.style.display = "block";

    // Reset keyboard state
    isShiftActive = false;
    isSymbolsActive = false;
    document.querySelector(".shift-key")?.classList.remove("active");
    document.querySelector(".symbols-key")?.classList.remove("active");

    // Switch keyboard layout based on input type
    if (input.type === "number") {
        showNumberKeyboard();
    } else if (input.type === "password") {
        showPasswordKeyboard();
    } else {
        showFullKeyboard();
    }

    updateKeyboardCase();
}

function showNumberKeyboard() {
    // Show only number row and hide others
    const rows = keyboard.querySelectorAll(".keyboard-row");
    rows.forEach((row) => {
        if (row.id === "number-row" || row.id === "action-row") {
            row.style.display = "flex";
        } else {
            row.style.display = "none";
        }
    });

    // Hide unnecessary action buttons
    keyboard.querySelector(".shift-key").style.display = "none";
    keyboard.querySelector(".symbols-key").style.display = "none";
    keyboard.querySelector(".space-key").style.display = "none";
}

function showPasswordKeyboard() {
    // Show all rows but keep symbols hidden initially
    const rows = keyboard.querySelectorAll(".keyboard-row");
    rows.forEach((row) => (row.style.display = "flex"));
    toggleSymbolRows(false);

    // Show all action buttons
    keyboard.querySelector(".shift-key").style.display = "block";
    keyboard.querySelector(".symbols-key").style.display = "block";
    keyboard.querySelector(".space-key").style.display = "block";
}

function showFullKeyboard() {
    // Show all rows except symbols
    const rows = keyboard.querySelectorAll(".keyboard-row");
    rows.forEach((row) => (row.style.display = "flex"));
    toggleSymbolRows(false);

    // Show all action buttons
    keyboard.querySelector(".shift-key").style.display = "block";
    keyboard.querySelector(".symbols-key").style.display = "block";
    keyboard.querySelector(".space-key").style.display = "block";
}

function hideKeyboard() {
    keyboard.style.display = "none";
    currentInput = null;
    isShiftActive = false;
    isSymbolsActive = false;
}

function addInputFocusListeners() {
    const inputs = document.querySelectorAll(
        'input[type="text"], input[type="password"], input[type="number"]'
    );
    inputs.forEach((input) => {
        input.addEventListener("focus", () => showKeyboard(input));
    });
}

function addDocumentClickListener() {
    document.addEventListener("click", (e) => {
        if (
            !keyboard.contains(e.target) &&
            !e.target.matches(
                'input[type="text"], input[type="password"], input[type="number"]'
            )
        ) {
            hideKeyboard();
        }
    });
}