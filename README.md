# Incrementa

## Overview

Incrementa is a comprehensive TypeScript framework for building incremental and idle games. It provides a complete suite of advanced systems including cost validation, data-driven upgrades, complex unlock conditions, and sophisticated event management—all designed for maximum flexibility and developer productivity.

Designed with clarity and developer experience in mind from day one, Incrementa features clean, well-documented code with meaningful naming and comprehensive TypeScript types. Every class, method, and configuration object is thoroughly typed and documented, making the framework both powerful and approachable.

## 🚀 Key Features

### 🏗️ **Advanced Building System**
- **Complete Construction Lifecycle**: `startConstruction()`, `completeConstruction()` with cost validation
- **Structured Cost Definitions**: Type-safe cost requirements with scaling and multipliers
- **Level-based Progression**: Building levels with automatic stat recalculation
- **Upgrade Integration**: Apply complex upgrades with property modification

### 🔄 **Data-Driven Upgrade System**
- **Property Modification**: Add, multiply, percentage, set, min/max operations
- **Complex Targeting**: Target by entity ID, type, tags, or name patterns
- **Repeatable Upgrades**: Configure max applications and scaling costs
- **Effect Validation**: Resource availability and condition checking
- **Legacy Compatibility**: Supports both new data-driven and legacy function-based effects

### 🔓 **Sophisticated Unlock System**
- **Data Structure Conditions**: Resource amounts, building counts, time played, custom properties
- **Complex Logic**: AND, OR, NOT combinations with multiple conditions
- **Template System**: Reusable condition templates with parameters
- **Milestone Tracking**: Achievement system with rewards
- **Performance Optimized**: Caching and efficient evaluation

### 🎯 **Comprehensive Event System**
- **System Events**: Structured events for all entity state changes
- **Event Filtering**: Subscribe by entity ID, type, tags, or custom filters
- **Middleware Support**: Process events through custom middleware
- **Event History**: Debugging and replay capabilities
- **Performance Metrics**: Detailed statistics and monitoring

### 💰 **Advanced Cost System**
- **Structured Definitions**: Type-safe cost requirements with validation
- **Resource Spending**: Automatic validation and rollback on failure
- **Scaling Calculations**: Exponential, linear, logarithmic, polynomial scaling
- **Statistics Tracking**: Cost validation and spending metrics
- **Event Integration**: Cost calculation and spending events

## Core Concepts

### Resources

Resources are the fundamental currency of incremental games. The framework provides comprehensive resource management with:

```ts
const game = new Game(saveManager);

// Create a resource with enhanced features
const gold = game.createResource({
  name: "Gold",
  description: "Primary currency for purchasing upgrades",
  initialAmount: 100,
  basePassiveRate: 1.5, // Generates 1.5 gold per second
  unlockCondition: () => true
});

// Advanced resource manipulation
gold.increment(50); // Add 50 gold
gold.decrement(25); // Remove 25 gold
gold.setAmount(1000); // Set to exact amount

// Event handling
gold.on('amountChanged', (data) => {
  console.log(`Gold changed from ${data.oldAmount} to ${data.newAmount}`);
});
```

### Buildings with Advanced Construction

Buildings now feature a complete construction lifecycle with cost validation:

```ts
// Create building with structured costs
const mine = game.createBuilding({
  name: "Gold Mine",
  description: "Generates gold automatically",
  costs: [
    { resourceId: 'wood', amount: 50, scalingFactor: 1.2 },
    { resourceId: 'stone', amount: 25, scalingFactor: 1.15 }
  ],
  buildTime: 10, // 10 seconds to build
  productionRate: 2.0,
  unlockCondition: () => game.getResourceByName('Gold')?.amount >= 100
});

// Construction lifecycle
if (mine.canAfford()) {
  mine.startConstruction(); // Validates and spends resources
  // Building automatically completes after buildTime
}

// Level up with scaling costs
mine.levelUp(); // Increases level and recalculates stats
```

### Data-Driven Upgrade System

The new upgrade system supports complex, data-driven effects:

```ts
// Create upgrade with property modification effects
const productionBoost = game.createUpgrade({
  name: "Production Boost",
  description: "Increases production rate by 50%",
  costs: [{ resourceId: 'gold', amount: 500, scalingFactor: 1.5 }],
  configuration: {
    effects: [{
      type: 'property_modifier',
      targetProperty: 'productionRate',
      operation: 'percentage',
      value: 50, // +50% increase
      description: 'Boost production by 50%'
    }],
    targets: [{
      entityType: 'building',
      tags: ['mining'] // Applies to all buildings with 'mining' tag
    }],
    isRepeatable: true,
    maxApplications: 10
  }
});

// Apply upgrade with automatic effect processing
const result = productionBoost.apply();
if (result.success) {
  console.log(`Modified ${result.modifiedEntities.length} entities`);
}
```

### Complex Unlock Conditions

Define sophisticated unlock requirements using data structures:

```ts
// Complex unlock condition with AND/OR logic
const advancedMine = game.createBuilding({
  name: "Advanced Gold Mine",
  // ... other config
});

// Register complex unlock condition
game.unlockManager.registerComplexUnlockCondition(advancedMine, {
  condition: {
    type: 'resource_amount',
    target: 'gold',
    operation: 'greater_than_or_equal',
    value: 5000
  },
  andConditions: [{
    type: 'building_count',
    target: 'mine',
    operation: 'greater_than_or_equal',
    value: 3
  }],
  orConditions: [{
    type: 'time_played',
    target: 'total',
    operation: 'greater_than_or_equal',
    value: 300000 // 5 minutes
  }]
});

// Automatically checked during game loop
game.unlockManager.checkUnlockConditions();
```

### Production System

Comprehensive production system with input/output validation:

```ts
// Create miner with extraction-based production
const ironMiner = new Miner({
  name: "Iron Miner",
  description: "Extracts iron automatically",
  costs: [{ resourceId: 'wood', amount: 100 }],
  buildTime: 15,
  gatherRate: 2.5, // 2.5 iron per second
  resourceId: 'iron',
  autoStart: true // Starts production when built
});

// Create factory with transformation-based production
const steelFactory = new Factory({
  name: "Steel Mill",
  description: "Converts iron to steel",
  costs: [{ resourceId: 'stone', amount: 200 }],
  buildTime: 30,
  inputs: [{ resourceId: 'iron', amount: 3 }], // Consumes 3 iron per cycle
  outputs: [{ resourceId: 'steel', amount: 1 }], // Produces 1 steel per cycle
  productionRate: 0.8, // 0.8 cycles per second
  efficiency: 1.0
});

// Global production management
game.startAllProduction(); // Start all producer buildings
game.stopAllProduction(); // Stop all production
const stats = game.getGlobalProductionStats(); // Get production metrics
```

### Enhanced Event System

Comprehensive event system with filtering and middleware:

```ts
// Subscribe to system events with filtering
game.eventManager.onSystemEvent('amountChanged', (event) => {
  console.log(`Resource ${event.data.resourceId} changed`);
}, {
  entityId: gold.id, // Only events from gold resource
  debounce: 100 // Debounce rapid events
});

// Entity-specific event listeners
game.eventManager.onEntity(mine.id, 'levelUp', (event) => {
  console.log(`${mine.name} leveled up to ${event.data.newLevel}`);
});

// Event middleware for processing
game.eventManager.addMiddleware((event, next) => {
  // Add timestamp to all events
  event.data.processedAt = Date.now();
  next();
});

// Event history for debugging
const history = game.eventManager.getEventHistory({
  entityType: 'building'
}); // Get all building-related events
```

## Advanced Features

### Cost System with Validation

```ts
// Create complex cost definitions
const costs = createCosts({ 
  gold: 1000, 
  iron: 500, 
  steel: 100 
}, 1.3); // 30% scaling factor

// Validate costs before spending
const validation = game.costSystem.validateCost(costs, { level: 5 });
if (validation.canAfford) {
  // Spend resources with automatic rollback on failure
  const result = game.costSystem.spendResources(costs, { level: 5 });
  console.log(`Spent: ${JSON.stringify(result.spent)}`);
} else {
  console.log(`Missing: ${validation.missingResources.map(r => 
    `${r.amount} ${r.resourceId}`
  ).join(', ')}`);
}
```

### Storage Management

```ts
// Storage manages global capacity limits
const warehouse = game.createStorage({
  name: "Resource Warehouse",
  description: "Increases storage capacity",
  costs: [{ resourceId: 'wood', amount: 50 }],
  buildTime: 20,
  capacities: {
    'gold': 10000,   // Can store up to 10,000 gold
    'iron': 5000,    // Can store up to 5,000 iron
    'steel': 1000    // Can store up to 1,000 steel
  }
});

// Check global capacity across all storage buildings
const totalCapacity = game.getTotalCapacityFor('gold');
const remainingSpace = game.getRemainingCapacityFor('gold');
const canStore = game.hasGlobalCapacity('gold', 500);
```

### Milestone System

```ts
// Register milestones with rewards
game.unlockManager.registerMilestone({
  id: 'first-thousand',
  name: 'Gold Collector',
  description: 'Collect 1,000 gold',
  condition: {
    condition: {
      type: 'resource_amount',
      target: 'gold',
      operation: 'greater_than_or_equal',
      value: 1000
    }
  },
  reward: {
    type: 'resource',
    target: 'gold',
    value: 500,
    description: '500 bonus gold'
  },
  isAchieved: false
});

// Check milestones during game loop
game.unlockManager.checkMilestones();
```

## Testing & Quality Assurance

Incrementa follows **Test-Driven Development (TDD)** principles with comprehensive test coverage:

### Test Coverage
- **200+ total tests** across 10 test suites
- **Core systems**: Cost validation, upgrade effects, unlock conditions, events
- **Entity testing**: Resources, buildings, storage, producers
- **Integration tests**: Multi-system interactions and workflows
- **Performance tests**: Event system metrics and timing accuracy

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test suite
npm test tests/core/cost-system.test.ts

# Watch mode for development
npm run test:watch
```

### Test Structure

```
tests/
├── core/           # Core systems (cost, upgrades, unlocks, events)
├── entities/       # Entity tests (resources, buildings, storage)
├── integration/    # Multi-component scenarios
└── setup.ts        # Test utilities and helpers
```

## Performance & Optimization

### Event System Performance
- **Middleware processing** for event transformation
- **Event filtering** to reduce unnecessary processing
- **Debouncing** for rapid event sequences
- **Memory management** with automatic cleanup

### Unlock System Optimization
- **Condition caching** for expensive evaluations
- **Batch processing** for multiple conditions
- **Template system** for reusable patterns

### Production System Efficiency
- **Delta-time calculations** for frame-rate independence
- **Resource validation** before production attempts
- **Batch production** for improved performance

## Advanced Configuration

### Logging System

```ts
import { setDebugMode, setLogLevel, LogLevel, logger } from 'incrementa';

// Configure debugging
setDebugMode(true);
setLogLevel(LogLevel.DEBUG);

// Framework will log detailed information about:
// - Cost calculations and validations
// - Upgrade effect applications
// - Unlock condition evaluations
// - Event system operations
// - Production lifecycle events
```

### Game Initialization

```ts
import { Game, SaveManager, initializeFramework } from 'incrementa';

// Initialize framework with custom configuration
initializeFramework({
  debugMode: true,
  logLevel: LogLevel.INFO,
  eventHistorySize: 1000,
  unlockCheckInterval: 1000 // Check unlocks every second
});

// Create game instance
const saveManager = new SaveManager(/* your storage provider */);
const game = new Game(saveManager);

// Game is now ready with all enhanced systems
```

## Migration Guide

### From Legacy Systems

The framework maintains backward compatibility while providing enhanced features:

```ts
// Legacy upgrade (still works)
const oldUpgrade = new Upgrade({
  name: "Simple Boost",
  effect: () => { building.productionRate *= 2; },
  cost: { gold: 100 }
});

// New data-driven upgrade (recommended)
const newUpgrade = new Upgrade({
  name: "Advanced Boost",
  configuration: {
    effects: [{
      type: 'property_modifier',
      targetProperty: 'productionRate',
      operation: 'multiply',
      value: 2
    }],
    targets: [{ entityType: 'building', entityId: building.id }]
  },
  costs: [{ resourceId: 'gold', amount: 100 }]
});
```

## Roadmap

- **Phase 1: Core Architecture** ✅
  - Advanced cost system with validation
  - Data-driven upgrade effects  
  - Complex unlock conditions
  - Enhanced event system
  - Comprehensive test suite (200+ tests)
  
- **Phase 2: Advanced Features** ✅
  - Production system with input/output validation
  - Storage capacity management
  - Milestone and achievement tracking
  - Performance optimization and caching
  
- **Phase 3: Developer Experience** 🚧
  - Interactive documentation website
  - More game examples to showcase and theme templates

## Contributing

Incrementa welcomes contributions! Please ensure all new features include:

1. **Comprehensive tests** following TDD principles
2. **TypeScript types** for all public APIs
3. **Documentation** with usage examples
4. **Backward compatibility** when possible

See `/tests/README.md` for testing guidelines and current coverage status.

## License

MIT License - see LICENSE file for details.