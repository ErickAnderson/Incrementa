# Incrementa

## Overview

Incrementa is a JavaScript/TypeScript library that streamlines the development of incremental and idle games. It offers a modular set of abstract entities and utilities for core mechanics like resource collection, buildings, upgrades, and progression—without imposing any specific visual style or opinionated structure.

Designed with clarity and developer experience in mind from day one, Incrementa features clean, well-documented code with meaningful naming and inline comments. Every class, method, and config object is easy to understand, making the source code feel like a built-in tutorial. Whether you're building a prototype or diving deep into custom mechanics, Incrementa enables rapid development with minimal friction and no reliance on external documentation.

## Core Concepts

### Resources

Resources are the backbone of any incremental game. These entities are what players collect, spend, and progress with. The library offers a way to define, unlock, and upgrade resources easily.

### Buildings

Buildings automate or enhance resource collection. Buildings can be constructed, upgraded, and used to gather or convert resources. All production buildings extend the **ProducerBuilding** base class which provides a complete production lifecycle system.

- **Miner**: Extraction-based production building that generates resources automatically without input requirements
- **Factory**: Transformation-based production building that converts input resources into output resources
- **Storage**: Capacity management building that defines global resource storage limits
- **ProducerBuilding**: Base class providing production lifecycle (`startProduction()`, `stopProduction()`, `canProduce()`), resource validation, and efficiency systems

### Upgrades

Upgrades are applied to various entities to enhance their efficiency, reduce cost, increase production rates, or unlock new functionalities. They are applicable to buildings, storage, and resources.

### Timers

Timers track time-based activities like resource gathering, building construction, or research. These are essential for any game mechanic that involves waiting or time-based progression.

### Unlock Conditions

A flexible system for managing when an entity (resource, building, upgrade) becomes available to the player, based on certain conditions.

### Advanced Logging System

Incrementa features a sophisticated, configurable logging system with multiple output drivers and debug mode control. The logging system is completely environment-agnostic, working seamlessly in browsers, Node.js, and any JavaScript runtime.

**Key Features:**
- **Multiple Output Drivers**: Web console (default), file logging, and Node.js-specific console
- **Debug Mode Control**: Global on/off switch for all framework logging
- **Log Levels**: DEBUG, INFO, WARN, ERROR with filtering capabilities
- **Runtime Configuration**: Change logging behavior dynamically without restarting
- **Environment Agnostic**: Works in any JavaScript environment using dependency injection
- **Performance Optimized**: Buffered file logging and level-based filtering

## Technical Overview

Incrementa is structured using Object-Oriented Programming (OOP) principles. Entities share common traits, reducing redundant code and providing a highly extendable base for additional features.

### Recent Updates: Production System Architecture

The framework now includes a comprehensive **Production System** with:

- **ProducerBuilding Base Class**: Complete production lifecycle with `startProduction()`, `stopProduction()`, `canProduce()`
- **Resource Validation**: Automatic input availability and output capacity checking
- **Game Loop Integration**: Production ticks integrated with delta time calculations
- **Global Production Management**: Game class methods for production optimization and bottleneck detection
- **Event System**: Comprehensive production event emission for UI integration
- **Type-Safe Configuration**: Complete TypeScript types for production inputs, outputs, rates, and efficiency

### Base Object Structure

All entities derive from a common class OBJECT. This class encapsulates shared traits such as:

- ```name```: The name of the entity.
- ```slug```: An internal ID, a "slugged" version of the name.
- ```description```: A short description for the player.
- ```isUnlocked```: Boolean indicating whether the entity is unlocked.
- ```unlockCondition```: Function that determines when the entity can be unlocked.

```ts
class OBJECT {
  name: string;
  slug: string;
  description: string;
  isUnlocked: boolean;
  unlockCondition: any;

  constructor(name: string, description: string, unlockCondition: any) {
    this.name = name;
    this.slug = name.toLowerCase().replace(/\s+/g, '-');
    this.description = description;
    this.isUnlocked = false;
    this.unlockCondition = unlockCondition;
    this.onCreated();
  }

  onCreated() { /* logic when created */
  }

  checkUnlockCondition() { /* logic to unlock */
  }

  unlock() {
    this.isUnlocked = true;
    this.onUnlocked();
  }

  onUnlocked() { /* logic when unlocked */
  }
}
```

## Buildings

Building extends OBJECT and introduces additional traits like cost, build time, production rates, and upgrades.

### Miner: Gathers resources.

Factory: Produces resources using other resources as inputs.
Storage: Inherits from Building, manages multiple resources with a capacity.

```ts
class Building extends OBJECT {
  cost: Record<string, number>;
  buildTime: number;
  productionRate: number;
  upgrades: Upgrade[];

  constructor(name: string, description: string, cost: Record<string, number>, buildTime: number, productionRate: number, unlockCondition: any) {
    super(name, description, unlockCondition);
    this.cost = cost;
    this.buildTime = buildTime;
    this.productionRate = productionRate;
    this.upgrades = [];
  }

  addUpgrade(upgrade: Upgrade) {
    this.upgrades.push(upgrade);
  }
}
```

### Resources

Resources are another extension of the OBJECT class. They store an amount and can be gathered or spent.

```ts
class Resource extends OBJECT {
  amount: number;
  rate: number;

  constructor(name: string, description: string, initialAmount: number, rate: number, unlockCondition: any) {
    super(name, description, unlockCondition);
    this.amount = initialAmount;
    this.rate = rate;
  }

  collect(amount: number) {
    this.amount += amount;
  }
}
```

### Upgrades

Upgrades modify the behavior of buildings, resources, and storage. They have an associated cost and effect.

```ts
class Upgrade extends OBJECT {
  effect: any;
  cost: Record<string, number>;

  constructor(name: string, description: string, effect: any, cost: Record<string, number>, unlockCondition: any) {
    super(name, description, unlockCondition);
    this.effect = effect;
    this.cost = cost;
  }

  apply() {
    this.effect();
  }
}
```

### Game State

A Game class manages the current state, holding all resources, buildings, storage, and upgrades.

```ts
class Game {
    resources: Resource[];
    buildings: Building[];
    upgrades: Upgrade[];
    storages: Storage[];

    constructor() {
        this.resources = [];
        this.buildings = [];
        this.upgrades = [];
        this.storages = [];
    }

    saveState() { /* logic to save game state */
    }

    loadState() { /* logic to load game state */
    }
}
```

## Examples

### Creating a Miner Building (New Production System)

```ts
// Create resources
const game = new Game(saveManager);
const iron = game.createResource({
  name: "Iron",
  description: "A basic metal used for construction"
});

// Create miner with production configuration
const miner = new Miner({
  name: "Iron Miner",
  description: "Extracts iron automatically",
  cost: { wood: 10 },
  buildTime: 5,
  gatherRate: 2.0, // 2 iron per second
  resourceId: iron.id,
  autoStart: true // Starts production automatically when built
});

game.addEntity(miner);

// Production starts automatically when unlocked/built
// Or manually control production:
// miner.startProduction();
// miner.stopProduction();
```

### Adding an Upgrade

```ts
const upgrade = new Upgrade("Double Mining Speed", "Doubles the rate of mining", () => miner.gatherRate *= 2, {iron: 50}, () => miner.isUnlocked);
miner.addUpgrade(upgrade);
```

### Factory Production (New System)

```ts
// Create a factory that converts iron to steel
const factory = new Factory({
  name: "Steel Mill",
  description: "Converts iron to steel",
  cost: { wood: 50, stone: 25 },
  buildTime: 10,
  inputs: [{ resourceId: iron.id, amount: 2 }], // Consumes 2 iron per cycle
  outputs: [{ resourceId: steel.id, amount: 1 }], // Produces 1 steel per cycle
  productionRate: 0.5, // 0.5 cycles per second
  efficiency: 1.0 // 100% efficiency
});

game.addEntity(factory);
factory.startProduction(); // Start when resources are available
```

### Storage Management (New Capacity System)

```ts
// Storage now manages capacity limits, not local storage
const storage = game.createStorage({
  name: "Resource Warehouse",
  description: "Increases storage capacity for all resources",
  cost: { wood: 20 },
  buildTime: 5,
  capacities: {
    [iron.id]: 100, // Can store up to 100 iron
    [steel.id]: 50  // Can store up to 50 steel
  }
});

// Check global capacity
const canStore = game.hasGlobalCapacity(iron.id, 25); // Can we store 25 more iron?
const remaining = game.getRemainingCapacityFor(iron.id); // How much space left?
```

## Advanced Logging Configuration

Incrementa includes a basic logging system that can be configured for different environments and use cases.

### Basic Usage

```ts
import { setDebugMode, logger } from 'incrementa';

// Enable debug mode to see framework logs
setDebugMode(true);

// Use the logger in your game code
logger.info('Game started successfully');
logger.warn('Resource limit approaching');
logger.error('Failed to save game state');
logger.debug('Detailed debugging information');
```

### Web Console Logging (Default)

The framework uses web console logging by default, which works in both browsers and Node.js:

```ts
import { Game, SaveManager } from 'incrementa';

// Default configuration - logs to console when debug mode is enabled
const saveManager = new SaveManager(/* your storage provider */);
const game = new Game(saveManager);

// Enable debug mode to see framework logs
setDebugMode(true);
```

### File Logging for Node.js

Configure file logging for server environments or when you need persistent logs:

```ts
import { setLoggerDriver, setDebugMode } from 'incrementa';
import fs from 'fs';

// Configure file logging
setLoggerDriver('file', {
  filePath: './game.log',
  fileWriter: (path, data) => {
    fs.appendFileSync(path, data);
  }
});

setDebugMode(true);

// All framework logs will now be written to ./game.log
```

### Node.js Console with Colors

For Node.js environments, use the enhanced console driver with color coding:

```ts
import { setLoggerDriver, setDebugMode } from 'incrementa';

// Configure Node.js console with colors
setLoggerDriver('node');
setDebugMode(true);

// Logs will appear with color coding in the terminal
```

### Advanced Configuration

```ts
import { 
  setDebugMode, 
  setLogLevel, 
  setLoggerDriver, 
  LogLevel, 
  logger 
} from 'incrementa';

// Enable debug mode
setDebugMode(true);

// Set minimum log level (only WARN and ERROR will be shown)
setLogLevel(LogLevel.WARN);

// Configure async file logging
setLoggerDriver('file', {
  filePath: './logs/incrementa.log',
  fileWriter: async (path, data) => {
    await fs.promises.appendFile(path, data);
  }
});

// Runtime logging configuration
logger.info('This will not be shown (below WARN level)');
logger.warn('This warning will be logged to file');
logger.error('This error will be logged to file');

// Change driver at runtime
setLoggerDriver('web'); // Switch back to console
logger.error('This will now appear in console');
```

### Production Configuration

For production environments, disable debug mode to prevent any logging overhead:

```ts
import { setDebugMode } from 'incrementa';

// Disable all framework logging in production
setDebugMode(false);

// No logs will be output regardless of level or driver configuration
```

### Performance and Debug Mode Behavior

Understanding how the logging system behaves in different modes is crucial for production deployments.

#### Default Behavior (Debug Mode OFF)

```ts
import { logger } from 'incrementa';

// Debug mode is FALSE by default
logger.info('This message will not appear anywhere');
logger.error('This error will also be silent');
logger.warn('No warnings will be shown');
logger.debug('No debug output');

// All calls above return immediately with zero output
```

#### Enabling Debug Mode for Troubleshooting

Enable debug mode at runtime to troubleshoot issues without code changes:

```ts
import { setDebugMode, setLogLevel, LogLevel } from 'incrementa';

// Enable debug mode and set detailed logging
setDebugMode(true);
setLogLevel(LogLevel.DEBUG);

// Now all previously silent logs will appear
```

## Testing & Quality Assurance

Incrementa follows **Test-Driven Development (TDD)** principles to ensure robust, reliable functionality. The framework includes a comprehensive unit test suite covering all core features.

### Test Coverage

- **151 total tests** across 6 test suites
- **Core systems**: Game management, timers, events, unlocks
- **Entity testing**: Resources, buildings, storage, producers
- **Integration tests**: Time-based scenarios, production chains
- **Production accuracy**: 5-second timing tests for precise rates

### Development Workflow

**For Contributors and Framework Development:**

1. **Write tests first** - Before implementing new features, create failing tests that define the expected behavior
2. **Implement feature** - Write the minimum code needed to make tests pass
3. **Refactor & optimize** - Improve code quality while maintaining test coverage
4. **Document behavior** - Update documentation and add examples

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test suite
npm test tests/entities/resource.test.ts

# Watch mode for development
npm run test:watch
```

### Test Structure

```
tests/
├── core/           # Game, events, timers, unlock systems
├── entities/       # Resources, buildings, storage, producers
├── integration/    # Multi-component scenarios and timing tests
└── setup.ts        # Test utilities and mocking
```

**Key Testing Principles:**
- **Isolated tests** - Each test runs independently with clean setup
- **Time simulation** - Fake timers for consistent time-based testing
- **Production accuracy** - Tests verify exact production rates and timing
- **Edge case coverage** - Boundary conditions and error scenarios
- **Integration validation** - Multi-entity interactions and workflows

See `/tests/README.md` for detailed test documentation and current coverage status.

## Development Guidelines

### Test-Driven Development

**All new framework features must include comprehensive unit tests.** This ensures:

- **Regression prevention** - Changes don't break existing functionality
- **API contract validation** - Public interfaces work as documented
- **Edge case handling** - Boundary conditions are properly managed
- **Performance verification** - Time-sensitive features work accurately

### Code Quality Standards

- **TypeScript strict mode** - Full type safety and compile-time validation
- **Comprehensive logging** - Debug-friendly with environment-agnostic output
- **Clear documentation** - Every public method and class is documented
- **Consistent patterns** - Entity lifecycle hooks and event emission patterns

## Roadmap

- **Phase 1: Core Mechanics** ✅
  - Finalized Resource, Building, Miner, Factory, and Storage entities
  - Complete production system with lifecycle management
  - Comprehensive test suite (151 tests)
  - DeepCore Driller example game demonstrating all features
  
- **Phase 2: Advanced Features** 🚧
  - Prestige and reset systems
  - Achievement and milestone tracking
  - Report and statistics module to track rates, resources and current state of the game
  - Advanced unlock condition chaining
  - Performance optimization for large-scale games
  
- **Phase 3: Developer Experience** 📋
  - Framework documentation website
  - Interactive playground and examples
  - More game examples to showcase and theme templates