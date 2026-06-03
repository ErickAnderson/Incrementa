# Game Class - Core Orchestrator

The `Game` class is the main entry point and orchestrator for the Incrementa framework. It has been refactored from a monolithic 1,063-line god class into a lean 339-line service orchestrator that coordinates specialized services.

> **File Location**: [`src/core/game.ts`](../../src/core/game.ts)

## 🎯 Overview

The Game class serves as:
- **Service Orchestrator** - Coordinates all framework services
- **API Gateway** - Provides both new service APIs and legacy compatibility
- **Lifecycle Manager** - Handles game start/pause/destroy operations
- **Event Hub** - Central point for game-wide event coordination

## 🏗️ Architecture

### Service-Based Design
```typescript
export class Game implements IGame {
    // New Service APIs (Recommended)
    public readonly entities: IEntityService;
    public readonly production: IProductionService;
    public readonly capacity: ICapacityService;
    public readonly timers: ITimerService;
    public readonly events: IEventService;
    public readonly unlocks: IUnlockService;
    public readonly gameLoop: IGameLoopService;
    public readonly gameState: IGameStateService;

    // Legacy Systems (Backward Compatibility)
    public readonly costSystem: CostSystem;
    public readonly upgradeEffectProcessor: UpgradeEffectProcessor;
    public readonly pluginSystem: PluginSystem;
    public readonly performanceMonitor: PerformanceMonitor;
}
```

## 🚀 Quick Start

### Basic Game Setup
```typescript
import { Game, SaveManager } from 'incrementa';

// Initialize save system
const saveManager = new SaveManager(localStorage);
const game = new Game(saveManager);

// Create basic resources
const gold = game.entities.createResource({
    name: 'Gold',
    initialAmount: 100,
    rate: 1.0 // Passive generation per second
});

const stone = game.entities.createResource({
    name: 'Stone', 
    initialAmount: 0
});

// Create a miner building
const goldMiner = game.entities.createMiner({
    name: 'Gold Mine',
    resourceId: 'gold',
    gatherRate: 5.0, // Gold per second when active
    buildTime: 2000, // 2 seconds to build
    costs: [{ resourceId: 'gold', amount: 50 }]
});

// Start the game
game.start();

// Start production
game.production.startAllProduction();
```

## 📋 Core Methods

### Lifecycle Management

#### `start(): void`
Starts the game and all services.
```typescript
game.start();
// Triggers: gameLoop, unlocks, events, timers
// Emits: 'gameStarted' event
```

#### `pause(): void`
Pauses the game and all services.
```typescript
game.pause();
// Pauses: gameLoop, timers, unlocks, events
// Emits: 'gamePaused' event
```

#### `resume(): void`
Resumes the game from paused state.
```typescript
game.resume();
// Resumes: gameLoop, timers, unlocks, events  
// Emits: 'gameResumed' event
```

#### `destroy(): void`
Destroys the game and cleans up all resources.
```typescript
game.destroy();
// Destroys: all services, clears collections
// Emits: 'gameDestroyed' event
```

### Game State Management

#### `setGameSpeed(speed: number): void`
Sets the game speed multiplier.
```typescript
game.setGameSpeed(2.0); // 2x speed
game.setGameSpeed(0.5); // Half speed
// Must be > 0
```

#### `getGameSpeed(): number`
Gets the current game speed multiplier.
```typescript
const speed = game.getGameSpeed(); // Returns current multiplier
```

#### `isGameRunning(): boolean`
Checks if the game is currently running.
```typescript
if (game.isGameRunning()) {
    console.log('Game is active');
}
```

#### `getCurrentTime(): number`
Gets the current game timestamp.
```typescript
const now = game.getCurrentTime(); // Returns Date.now()
```

### Save/Load System

#### `saveState(): void`
Saves the current game state to persistent storage.
```typescript
game.saveState();
// Saves: entities, resources, gameSpeed, totalGameTime, plugins
```

#### `loadState(): void`
Loads previously saved game state.
```typescript
game.loadState();
// Restores: entity unlock states, resource amounts, game properties
```

#### `calculateOfflineProgress(): void`
Calculates and applies offline progress for resources.
```typescript
game.calculateOfflineProgress();
// Applies resource gains based on time offline
```

## 🔧 Service APIs

### Entity Management
```typescript
// Create entities using the entity service
const resource = game.entities.createResource({
    name: 'Iron',
    initialAmount: 0,
    rate: 0.1
});

const building = game.entities.createBuilding({
    name: 'Workshop',
    buildTime: 5000,
    costs: [{ resourceId: 'wood', amount: 10 }]
});

// Access entity collections
const allResources = game.entities.getResources();
const allBuildings = game.entities.getBuildings();
const specificEntity = game.entities.getEntityById('iron');
```

### Production Management
```typescript
// Control production
const startedProducers = game.production.startAllProduction();
const stoppedProducers = game.production.stopAllProduction();

// Get production information
const producers = game.production.getProducerBuildings();
const activeProducers = game.production.getActiveProducers();
const stats = game.production.getGlobalProductionStats();

// Optimization
const result = game.production.optimizeProduction();
console.log(`Started ${result.started}, stopped ${result.stopped}`);
```

### Capacity Management
```typescript
// Check storage capacity
const totalCapacity = game.capacity.getTotalCapacityFor('gold');
const hasCapacity = game.capacity.hasGlobalCapacity('gold', 100);
const remaining = game.capacity.getRemainingCapacityFor('gold');

// Get storage status
const storages = game.capacity.getStorageStatus();
```

### Timer Management
```typescript
import { Timer } from 'incrementa';

// Create and manage timers
const timer = new Timer({
    totalTime: 5000, // 5 seconds
    onComplete: () => console.log('Timer finished!'),
    onUpdate: (progress) => console.log(`Progress: ${progress}%`)
});

game.timers.addTimer('custom-timer', timer);
timer.start();

// Timer control
game.timers.pauseAllTimers();
game.timers.resumeAllTimers();
```

### Event System
```typescript
// Listen for events
game.events.on('resourceChanged', (data) => {
    console.log(`${data.resourceId}: ${data.newAmount}`);
});

game.events.on('buildComplete', (data) => {
    console.log(`${data.building.name} finished building!`);
});

// Emit custom events
game.events.emit('customEvent', { data: 'value' });

// Event statistics
const stats = game.events.getEventStats();
```

### Unlock System
```typescript
// Manual unlock checking
game.unlocks.checkUnlockConditions();

// Force unlock for debugging
game.unlocks.unlockEntity('advanced-building');

// Unlock statistics
const unlockStats = game.unlocks.getUnlockStats();
```

## 🔄 Legacy API Support

For backward compatibility, all legacy methods are preserved:

```typescript
// Legacy API (deprecated but supported)
const resource = game.createResource({ name: 'Gold' });
game.addEntity(resource);
game.startAllProduction();
game.pauseTimers();

// Equivalent new API (recommended)
const resource = game.entities.createResource({ name: 'Gold' });
game.entities.addEntity(resource);
game.production.startAllProduction();
game.timers.pauseAllTimers();
```

### Legacy Property Access
```typescript
// Legacy property access still works
game.entityRegistry.getResources(); // → game.entities.getResources()
game.unlockManager.getStats();       // → game.unlocks.getUnlockStats()
game.eventManager.emit('event');     // → game.events.emit('event')
```

## 🎮 Complete Game Example

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

const wood = game.entities.createResource({
    name: 'Wood', 
    initialAmount: 0
});

// Create buildings
const goldMine = game.entities.createMiner({
    name: 'Gold Mine',
    resourceId: 'gold',
    gatherRate: 5.0,
    buildTime: 2000,
    costs: [{ resourceId: 'gold', amount: 50 }]
});

const warehouse = game.entities.createStorage({
    name: 'Warehouse',
    capacities: { 
        gold: 1000,
        wood: 500 
    },
    buildTime: 3000,
    costs: [{ resourceId: 'gold', amount: 100 }]
});

// Create upgrades
const efficiency = game.entities.createUpgrade({
    name: 'Mining Efficiency',
    effect: {
        type: 'property_modifier',
        target: { entityType: 'Miner' },
        property: 'gatherRate',
        operation: 'multiply',
        value: 1.5
    },
    costs: [{ resourceId: 'gold', amount: 200 }]
});

// Set up event handlers
game.events.on('resourceChanged', (data) => {
    updateUI(data.resourceId, data.newAmount);
});

game.events.on('buildComplete', (data) => {
    showNotification(`${data.building.name} completed!`);
});

// Start the game
game.start();

// Begin production
game.production.startAllProduction();

// Save periodically
setInterval(() => {
    game.saveState();
}, 30000); // Save every 30 seconds

function updateUI(resourceId: string, amount: number) {
    document.getElementById(`${resourceId}-amount`).textContent = amount.toFixed(2);
}

function showNotification(message: string) {
    console.log(`[Game] ${message}`);
}
```

## ⚡ Performance Tips

### Efficient Resource Management
```typescript
// Batch entity creation for better performance
const resources = ['gold', 'wood', 'stone', 'iron'].map(name =>
    game.entities.createResource({ name, initialAmount: 0 })
);

// Use capacity checking before resource operations
if (game.capacity.hasGlobalCapacity('gold', 100)) {
    gold.increment(100);
}

// Monitor production bottlenecks
const bottlenecks = game.production.getProductionBottlenecks();
if (bottlenecks.resourceShortages.length > 0) {
    console.log('Resource shortages detected:', bottlenecks.resourceShortages);
}
```

### Performance Monitoring
```typescript
// Enable performance monitoring for development
game.setPerformanceMonitoring(true);

// Get performance metrics
const metrics = game.getPerformanceMetrics();
console.log('FPS:', 1000 / metrics.frameTime.average);
console.log('Entity count:', metrics.entities.total);

// Check for performance recommendations
const recommendations = game.performanceMonitor.getOptimizationRecommendations(metrics);
```

## 🐛 Debugging

### Game State Inspection
```typescript
// Inspect current state
console.log('Game running:', game.isGameRunning());
console.log('Game speed:', game.getGameSpeed());
console.log('Resources:', game.entities.getResources().map(r => `${r.name}: ${r.amount}`));
console.log('Buildings:', game.entities.getBuildings().map(b => `${b.name}: ${b.isBuilt ? 'Built' : 'Building'}`));

// Check unlock conditions
game.unlocks.checkUnlockConditions();
console.log('Unlock stats:', game.unlocks.getUnlockStats());

// Event system debugging
console.log('Event stats:', game.events.getEventStats());

// Production analysis
console.log('Production stats:', game.production.getGlobalProductionStats());
console.log('Bottlenecks:', game.production.getProductionBottlenecks());
```

---

*Next: [Entity Management](./entities.md) - Deep dive into entity creation and management*