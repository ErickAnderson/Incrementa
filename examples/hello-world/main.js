// Incrementa Hello World - A minimal incremental game
import { Game, SaveManager } from 'incrementa';

// Initialize the game
const saveManager = new SaveManager();
const game = new Game(saveManager);

// Create a simple resource: Gold
const gold = game.createResource({
    id: 'gold',
    name: 'Gold',
    initialAmount: 0
});

// Create a building: Gold Miner
const miner = game.createMiner({
    id: 'miner',
    name: 'Gold Miner',
    cost: { gold: 10 }, // Legacy cost format
    buildTime: 2, // 2 seconds
    gatherRate: 2, // 2 gold per second
    resourceId: 'gold',
    unlockCondition: () => gold.amount >= 5
});

// UI Elements
const goldDisplay = document.getElementById('gold-amount');
const collectBtn = document.getElementById('collect-gold');
const minerDiv = document.getElementById('miner-building');
const buyMinerBtn = document.getElementById('buy-miner');
const minerStatus = document.getElementById('miner-status');
const minerState = document.getElementById('miner-state');

// Track build start time for progress calculation
let buildStartTime = null;

// Update UI
function updateUI() {
    goldDisplay.textContent = Math.floor(gold.amount);
    
    if (miner.isUnlocked && minerDiv.style.display === 'none') {
        minerDiv.style.display = 'block';
    }
    
    buyMinerBtn.disabled = !miner.canAfford() || miner.isBuilding || miner.isBuilt;
    
    if (miner.isBuilding) {
        const elapsed = buildStartTime ? (Date.now() - buildStartTime) / 1000 : 0;
        const remaining = Math.max(0, miner.buildTime - elapsed);
        minerState.textContent = `Building... ${Math.ceil(remaining)}s`;
        minerStatus.style.display = 'block';
    } else if (miner.isBuilt) {
        minerState.textContent = 'Active - Producing gold!';
        minerStatus.style.display = 'block';
    } else {
        minerStatus.style.display = 'none';
    }
}

// Collect gold manually
collectBtn.addEventListener('click', () => {
    gold.amount += 1;
    updateUI();
});

// Buy miner
buyMinerBtn.addEventListener('click', () => {
    if (miner.canAfford()) {
        buildStartTime = Date.now();
        miner.startConstruction();
        updateUI();
    }
});

// Listen to game events
miner.on('buildStart', () => {
    buildStartTime = Date.now();
    updateUI();
});
miner.on('buildComplete', updateUI);
miner.on('unlocked', updateUI);

// Start the game loop
game.start();
updateUI();

// Add periodic UI updates to show build progress
if (typeof setInterval !== 'undefined') {
    setInterval(updateUI, 500);
}

// Log when ready
if (typeof console !== 'undefined') {
    console.log('Hello World game started! Click "Collect Gold" to begin.');
}