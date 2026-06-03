# 🗻 DeepCore Driller - Incrementa Framework Showcase

DeepCore Driller is a complete incremental game that demonstrates ALL major features of the Incrementa framework. This example serves as both a playable game and a comprehensive learning resource for developers.

## 🎮 Game Overview

In DeepCore Driller, players:
- Mine Ore manually or with automated Miners
- Refine Ore into Metal using Smelters
- Generate Energy from Metal using Power Cores
- Expand storage capacity with Storage Units
- Research upgrades to improve efficiency
- Build the ultimate Deepcore Reactor to win!

## 🚀 Running the Game

```bash
# From the deepcore-driller directory
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

**Note**: Make sure the main Incrementa framework is built first by running `npm run build` in the root directory.

## 📚 Framework Features Demonstrated

### 1. **Core Entity System**
- All game objects (resources, buildings, upgrades) extend from `BaseEntity`
- Proper lifecycle management with unlock conditions
- Event-driven architecture for entity interactions

```javascript
// Example: Creating a resource with unlock condition
gameState.resources.metal = gameState.game.createResource({
  id: 'metal',
  name: 'Metal',
  unlockCondition: () => gameState.resources.ore.amount >= 5
});
```

### 2. **Cost System with Scaling**
- Uses the new `CostDefinition` format with scaling factors
- Demonstrates `createCost` and `createCosts` helper functions
- Shows exponential cost scaling for buildings

```javascript
// Example: Building with scaling costs
costs: [
  createCost('ore', 10, { scalingFactor: 1.5, scalingType: 'exponential' })
]
```

### 3. **Production Management**
- `ProductionManager` tracks all resource generation
- Real-time production rate calculations
- Net production (production - consumption) display

```javascript
// Getting production rate from the framework
const productionRate = gameState.game.productionManager.getNetProductionRate(resource.id);
```

### 4. **Capacity Management**
- `CapacityManager` handles storage limits
- Storage buildings add capacity for specific resources
- Overflow protection prevents resource waste

```javascript
// Getting total capacity for a resource
const capacity = gameState.game.capacityManager.getTotalCapacity(resource.id);
```

### 5. **Plugin System**
- Custom `ProductionStatsPlugin` demonstrates extensibility
- Plugins can listen to game events and add functionality
- Shows how to register and use plugins

```javascript
// Example plugin registration
const productionPlugin = new ProductionStatsPlugin(gameState.game);
gameState.game.pluginSystem.register('production-stats', productionPlugin);
```

### 6. **Event System & Batching**
- Extensive use of events for UI updates
- Event batching for performance optimization
- Shows both immediate and batched event handling

```javascript
// Event listeners for real-time updates
resource.on("amountChanged", updateResourceDisplay);
building.on("buildComplete", handleBuildComplete);
```

### 7. **Building Types**

#### Miner
- Demonstrates automatic resource extraction
- Shows `gatherRate` and timer-based production

#### Factory
- Input/output resource conversion
- Production rate configuration
- Resource consumption mechanics

#### Storage
- Capacity expansion for multiple resources
- Integration with CapacityManager

#### Building (Base)
- Construction lifecycle with timers
- Cost validation and spending
- Level progression system (multiple buildings = higher levels)
- Scaling production and costs with building levels

### 8. **Upgrade System**
- `UpgradeEffectProcessor` for purchase handling
- Effect application to modify game mechanics
- Conditional unlocking based on game state

```javascript
// Upgrade that modifies production
effect: () => {
  const miner = gameState.buildings.miner;
  miner.setGatherRate(miner.gatherRate * 1.5);
}
```

### 9. **Save/Load System**
- Automatic saving every 30 seconds using `game.saveState()`
- Manual save/load buttons with `game.loadState()`
- Uses localStorage for persistence
- Visual feedback with notifications

### 10. **Performance Monitoring**
- Framework's built-in performance tracking
- FPS and frame time monitoring
- Entity update timing

### 11. **Framework Configuration**
- Framework initialization with custom settings
- Type-safe configuration objects
- Built-in validation for entity creation

```javascript
// Framework initialization
initializeFramework({
  debugMode: false,
  logLevel: 'info',
  performanceMonitoring: true
});
```

### 12. **UI Integration Patterns**
- Framework-agnostic event-based updates
- Real-time resource display
- Progress bars and animations
- Notification system

## 🏗️ Code Structure

```
src/
├── main.js          # Complete game implementation
├── style.css        # Tailwind CSS styles
└── index.html       # Game UI
```

### Key Sections in main.js

1. **Plugin Definition** (lines 65-153)
   - Shows how to create custom plugins
   - Event listening and stat tracking

2. **Resource Setup** (lines 230-270)
   - Game factory methods
   - Resource lifecycle

3. **Building Setup** (lines 275-395)
   - All building types demonstrated
   - Cost definitions with scaling
   - Event handling

4. **Upgrade Setup** (lines 420-520)
   - Upgrade effects
   - Integration with buildings

5. **UI Updates** (lines 620-850)
   - Event-driven display updates
   - Production rate display
   - Capacity visualization

## 🏗️ Level-Based Building System

The game uses a **level-based building system** rather than multiple instances:

- **First Build**: Creates the building at Level 1
- **Additional Builds**: Upgrades existing building to higher levels  
- **Production Scaling**: All production scales with building level
- **Storage Scaling**: Storage capacity scales with building level
- **Cost Scaling**: Each level costs more (configurable scaling factor)
- **UI Display**: Shows `Lv.X` for levels > 1, or `x1` for single level

### Building Type Scaling:

**Miners**: Production = Base Rate × Level
```
Miner Level 1: 2 Ore/sec
Miner Level 2: 4 Ore/sec  (2 × 2)
Miner Level 3: 6 Ore/sec  (2 × 3)
```

**Factories**: Production Rate = Base Rate × Level
```
Smelter Level 1: 1.0 rate (3 Ore → 1 Metal/sec)
Smelter Level 2: 2.0 rate (6 Ore → 2 Metal/sec)
```

**Storage**: Capacity = Base Capacity × Level
```
Storage Level 1: 100 Ore, 50 Metal, 25 Energy
Storage Level 2: 200 Ore, 100 Metal, 50 Energy  
Storage Level 3: 300 Ore, 150 Metal, 75 Energy
```

## 🎯 Learning Points

### For New Users
- Start with resource creation and basic clicking
- Progress to buildings and automation
- Learn about capacity limits and storage
- Build multiple levels of the same building for increased production
- Discover the upgrade system

### For Developers
- Study the plugin system for extensibility
- Examine event handling patterns
- Learn cost scaling mechanics
- Understand production/capacity management
- See save/load implementation

## 🔧 Customization Ideas

1. **Add New Resources**
   - Create rare materials
   - Add resource chains

2. **Create New Buildings**
   - Research labs
   - Trading posts
   - Defense structures

3. **Implement New Plugins**
   - Achievement system
   - Statistics tracker
   - Offline progress calculator

4. **Enhance UI**
   - Add charts/graphs
   - Create animations
   - Build mobile-responsive design

## 📈 Performance Considerations

The game demonstrates several performance optimizations:
- Event batching for frequent updates
- Efficient UI update cycles (100ms intervals)
- Conditional rendering based on unlock state
- Performance monitoring integration

## 🐛 Debugging

Enable debug mode to see detailed logs:
```javascript
initializeFramework({
  debugMode: true,
  logLevel: 'debug'
});
```

## 📄 License

This example is part of the Incrementa framework and follows the same license terms.