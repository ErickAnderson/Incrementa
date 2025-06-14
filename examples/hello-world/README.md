# Hello World - Incrementa Example

A minimal incremental game demonstrating the basics of the Incrementa framework. This example showcases resource management, building construction, and the event-driven architecture.

## Features

- **Manual Resource Collection**: Click to collect gold manually
- **Unlockable Buildings**: Gold Miner unlocks when you have 5 gold
- **Construction System**: Buildings have build time with progress tracking
- **Automatic Production**: Miners produce resources continuously once built
- **Event-Driven UI**: Real-time updates using the framework's event system

## Quick Start

1. **Build the framework** (from project root):
   ```bash
   npm run build
   ```

2. **Install and run the example**:
   ```bash
   cd examples/hello-world
   npm install
   npm run dev
   ```

3. **Open your browser** to `http://localhost:3000` (opens automatically)

4. **Play the game**:
   - Click "Collect Gold" to gather gold manually
   - Once you reach 5 gold, the Gold Miner will unlock
   - Buy the miner for 10 gold and wait 2 seconds for construction
   - Watch the miner automatically produce 2 gold per second

## Code Structure

- **`index.html`** - Clean UI with resource display and building controls
- **`main.js`** - Complete game implementation demonstrating:
  - Game and SaveManager initialization
  - Resource creation with `game.createResource()`
  - Building creation with `game.createMiner()`
  - Event-driven UI updates
  - Construction lifecycle management
- **`package.json`** - Vite-based development server with hot reload
- **`vite.config.js`** - Vite configuration with module resolution for Incrementa

## Development Features

- **Vite Development Server**: Fast hot-reload development environment
- **ES Module Support**: Proper module handling with correct MIME types
- **Auto-open Browser**: Development server automatically opens browser
- **Production Build**: Optimized build for deployment with `npm run build`

## Framework Concepts Demonstrated

### Entity Creation
```javascript
// Create a resource
const gold = game.createResource({
    id: 'gold',
    name: 'Gold',
    initialAmount: 0
});

// Create a miner building
const miner = game.createMiner({
    id: 'miner',
    name: 'Gold Miner',
    cost: { gold: 10 }, // Resource costs
    buildTime: 2, // Construction time in seconds
    gatherRate: 2, // Resources per second
    resourceId: 'gold', // What resource to mine
    unlockCondition: () => gold.amount >= 5 // When to unlock
});
```

### Event System
```javascript
// Listen to building events
miner.on('buildStart', handleBuildStart);
miner.on('buildComplete', handleBuildComplete);
miner.on('unlocked', updateUI);
```

### Building Lifecycle
- **Locked**: Building not yet available
- **Unlocked**: Available for purchase when conditions met
- **Building**: Construction in progress with timer
- **Built**: Functional and producing resources

## Learning Objectives

This example teaches core Incrementa concepts:
- Entity creation and management
- Resource and building systems
- Event-driven architecture
- Unlock conditions and progression
- Cost validation and spending
- Construction and production lifecycles

Perfect starting point for understanding how to build incremental games with the Incrementa framework!