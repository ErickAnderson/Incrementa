# Quick Start Guide

Get up and running with Incrementa in 5 minutes! This guide will walk you through creating your first incremental game with resources, buildings, and production.

## 📦 Installation

```bash
npm install incrementa
# or
yarn add incrementa
```

## 🚀 Basic Setup

Create a new TypeScript/JavaScript file and import Incrementa:

```typescript
import { Game, SaveManager } from 'incrementa';

// Set up save system (uses localStorage by default)
const saveManager = new SaveManager(localStorage);

// Create the game instance
const game = new Game(saveManager);
```

## 🎯 Your First Resource

Let's create a basic gold resource with passive generation:

```typescript
const gold = game.entities.createResource({
    name: 'Gold',
    initialAmount: 100,          // Start with 100 gold
    rate: 1.0,                   // Generate 1 gold per second
    description: 'Shiny currency used for everything'
});

console.log(`Starting gold: ${gold.amount}`);
```

## 🏗️ Add a Building

Create a building that produces more gold:

```typescript
const goldMine = game.entities.createMiner({
    name: 'Gold Mine',
    resourceId: 'gold',          // Produces gold
    gatherRate: 5.0,             // 5 gold per second when active
    buildTime: 2000,             // Takes 2 seconds to build
    costs: [
        { resourceId: 'gold', amount: 50 }  // Costs 50 gold to build
    ],
    autoStart: true              // Automatically start producing when built
});
```

## 📦 Storage Management

Add storage to hold more resources:

```typescript
const warehouse = game.entities.createStorage({
    name: 'Warehouse',
    buildTime: 3000,             // 3 seconds to build
    capacities: {
        gold: 1000,              // Can store 1000 gold
        wood: 500                // Can store 500 wood (for future use)
    },
    costs: [
        { resourceId: 'gold', amount: 100 }
    ]
});
```

## 🔓 Progressive Unlocks

Create content that unlocks as you progress:

```typescript
const advancedMine = game.entities.createMiner({
    name: 'Advanced Gold Mine',
    resourceId: 'gold',
    gatherRate: 20.0,            // Much faster than basic mine
    buildTime: 5000,
    costs: [
        { resourceId: 'gold', amount: 500 }
    ],
    unlockCondition: () => {
        // Unlock when you have a basic mine and 300+ gold
        return goldMine.isBuilt && gold.amount >= 300;
    }
});
```

## 🎮 Start the Game

Start the game loop and begin production:

```typescript
// Start the game engine
game.start();

// Begin all possible production
game.production.startAllProduction();

console.log('Game started! Watch your gold grow.');
```

## 📊 Monitor Progress

Set up basic monitoring to see what's happening:

```typescript
// Update display every second
setInterval(() => {
    console.log(`Gold: ${gold.amount.toFixed(2)}`);
    console.log(`Buildings: ${game.entities.getBuildings().filter(b => b.isBuilt).length} built`);
    console.log(`Production: ${game.production.getActiveProducers().length} active producers`);
    console.log('---');
}, 1000);

// Save game every 30 seconds
setInterval(() => {
    game.saveState();
    console.log('Game saved!');
}, 30000);
```

## 🔄 Handle Events

React to game events for dynamic behavior:

```typescript
// Listen for building completion
game.events.on('buildComplete', (data) => {
    console.log(`🎉 ${data.building.name} finished building!`);
    
    // Start production automatically
    if ('startProduction' in data.building) {
        data.building.startProduction();
    }
});

// Listen for unlocks
game.events.on('unlocked', (data) => {
    console.log(`🔓 ${data.entity.name} is now available!`);
});

// Listen for resource changes
game.events.on('resourceChanged', (data) => {
    // Update UI when resources change
    updateResourceDisplay(data.resourceId, data.newAmount);
});

function updateResourceDisplay(resourceId: string, amount: number) {
    const element = document.getElementById(`${resourceId}-display`);
    if (element) {
        element.textContent = amount.toFixed(2);
    }
}
```

## 🏁 Complete Example

Here's the complete working example:

```typescript
import { Game, SaveManager } from 'incrementa';

// Initialize game
const saveManager = new SaveManager(localStorage);
const game = new Game(saveManager);

// Create resources
const gold = game.entities.createResource({
    name: 'Gold',
    initialAmount: 100,
    rate: 1.0
});

// Create buildings
const goldMine = game.entities.createMiner({
    name: 'Gold Mine',
    resourceId: 'gold',
    gatherRate: 5.0,
    buildTime: 2000,
    costs: [{ resourceId: 'gold', amount: 50 }],
    autoStart: true
});

const warehouse = game.entities.createStorage({
    name: 'Warehouse',
    buildTime: 3000,
    capacities: { gold: 1000 },
    costs: [{ resourceId: 'gold', amount: 100 }]
});

// Advanced content
const advancedMine = game.entities.createMiner({
    name: 'Advanced Gold Mine',
    resourceId: 'gold',
    gatherRate: 20.0,
    buildTime: 5000,
    costs: [{ resourceId: 'gold', amount: 500 }],
    unlockCondition: () => goldMine.isBuilt && gold.amount >= 300
});

// Event handlers
game.events.on('buildComplete', (data) => {
    console.log(`🎉 ${data.building.name} completed!`);
});

game.events.on('unlocked', (data) => {
    console.log(`🔓 ${data.entity.name} unlocked!`);
});

// Start the game
game.start();
game.production.startAllProduction();

// Monitor progress
setInterval(() => {
    const stats = {
        gold: gold.amount.toFixed(2),
        buildings: game.entities.getBuildings().filter(b => b.isBuilt).length,
        producers: game.production.getActiveProducers().length
    };
    console.log(`Gold: ${stats.gold} | Buildings: ${stats.buildings} | Producers: ${stats.producers}`);
}, 1000);

// Auto-save
setInterval(() => game.saveState(), 30000);

console.log('🎮 Game started! Watch your resources grow!');
```

## 🎨 Add a Simple UI

Create a basic HTML interface:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My First Incremental Game</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .resource { font-size: 18px; margin: 10px 0; }
        .building { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
        button { padding: 5px 10px; margin: 5px; }
        .locked { opacity: 0.5; pointer-events: none; }
    </style>
</head>
<body>
    <h1>My Incremental Game</h1>
    
    <!-- Resources -->
    <div class="resource">
        Gold: <span id="gold-display">100</span>
    </div>
    
    <!-- Buildings -->
    <div class="building">
        <h3>Gold Mine</h3>
        <p>Produces 5 gold/second</p>
        <button id="build-gold-mine">Build (50 gold)</button>
        <span id="gold-mine-status">Not built</span>
    </div>
    
    <div class="building">
        <h3>Warehouse</h3>
        <p>Stores 1000 gold</p>
        <button id="build-warehouse">Build (100 gold)</button>
        <span id="warehouse-status">Not built</span>
    </div>
    
    <div class="building locked" id="advanced-mine-building">
        <h3>Advanced Gold Mine</h3>
        <p>Produces 20 gold/second</p>
        <button id="build-advanced-mine">Build (500 gold)</button>
        <span id="advanced-mine-status">Locked</span>
    </div>

    <script type="module" src="./game.js"></script>
</body>
</html>
```

And the corresponding JavaScript:

```typescript
// game.js
import { Game, SaveManager } from 'incrementa';

// ... (game setup code from above) ...

// UI Update Functions
function updateUI() {
    // Update resource displays
    document.getElementById('gold-display').textContent = gold.amount.toFixed(2);
    
    // Update building statuses
    updateBuildingStatus('gold-mine', goldMine);
    updateBuildingStatus('warehouse', warehouse);
    updateBuildingStatus('advanced-mine', advancedMine);
    
    // Update button states
    updateButtonState('build-gold-mine', goldMine, 50);
    updateButtonState('build-warehouse', warehouse, 100);
    updateButtonState('build-advanced-mine', advancedMine, 500);
}

function updateBuildingStatus(elementId: string, building: any) {
    const statusElement = document.getElementById(`${elementId}-status`);
    if (building.isBuilt) {
        statusElement.textContent = 'Built';
    } else if (building.isBuilding) {
        statusElement.textContent = 'Building...';
    } else if (!building.isUnlocked) {
        statusElement.textContent = 'Locked';
    } else {
        statusElement.textContent = 'Not built';
    }
}

function updateButtonState(buttonId: string, building: any, cost: number) {
    const button = document.getElementById(buttonId);
    const canAfford = gold.amount >= cost;
    const canBuild = building.isUnlocked && !building.isBuilt && !building.isBuilding;
    
    button.disabled = !canAfford || !canBuild;
}

// Button click handlers
document.getElementById('build-gold-mine').addEventListener('click', () => {
    if (gold.amount >= 50) {
        gold.decrement(50);
        goldMine.startConstruction();
    }
});

document.getElementById('build-warehouse').addEventListener('click', () => {
    if (gold.amount >= 100) {
        gold.decrement(100);
        warehouse.startConstruction();
    }
});

document.getElementById('build-advanced-mine').addEventListener('click', () => {
    if (gold.amount >= 500) {
        gold.decrement(500);
        advancedMine.startConstruction();
    }
});

// Update UI regularly
setInterval(updateUI, 100);

// Handle unlock events
game.events.on('unlocked', (data) => {
    if (data.entity === advancedMine) {
        document.getElementById('advanced-mine-building').classList.remove('locked');
    }
});

// Initial UI update
updateUI();
```

## 🎯 Next Steps

Now that you have a basic game running, explore these advanced features:

1. **[Resource System](../core/resources.md)** - Learn about complex resource mechanics
2. **[Production Chains](../advanced/production-chains.md)** - Create interconnected production systems
3. **[Upgrade System](../core/upgrades.md)** - Add progression and enhancement mechanics
4. **[UI Integration](../advanced/ui-integration.md)** - Build more sophisticated interfaces
5. **[Examples](../examples/)** - See complete game implementations

## 🐛 Troubleshooting

### Game Not Starting
```typescript
// Make sure to call start()
game.start();

// Check console for errors
console.log('Game running:', game.isGameRunning());
```

### Resources Not Updating
```typescript
// Ensure production is started
game.production.startAllProduction();

// Check if buildings are built
console.log('Built buildings:', game.entities.getBuildings().filter(b => b.isBuilt));
```

### Storage Issues
```typescript
// Check capacity
console.log('Gold capacity:', game.capacity.getTotalCapacityFor('gold'));
console.log('Gold remaining:', game.capacity.getRemainingCapacityFor('gold'));
```

### Save/Load Problems
```typescript
// Test save/load manually
game.saveState();
console.log('Saved successfully');

game.loadState();
console.log('Loaded successfully');
```

---

*Next: [Installation Guide](./installation.md) - Detailed setup instructions*