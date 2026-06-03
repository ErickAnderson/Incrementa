# Incrementa

Incrementa is a TypeScript framework for building incremental and idle games. It provides modular entities (resources, buildings, producers, storage, upgrades) on a service-oriented, event-driven core, so you can prototype resource-gathering, automation, and progression games quickly.

The framework is frontend-agnostic. It manages game logic and state and exposes everything through an event system, leaving rendering to any HTML/CSS/JS frontend you choose. It has zero runtime dependencies.

## Features

- Entity model: resources, buildings, miners, factories, storage, and upgrades, all extending a common `BaseEntity` with lifecycle hooks and an event emitter.
- Service-oriented `Game` orchestrator: entity, production, capacity, timer, event, unlock, game-loop, and game-state services behind one API.
- Structured cost system with linear, exponential, logarithmic, and polynomial scaling, plus validation and spending with rollback.
- Data-driven upgrades: property modifiers (add, multiply, percentage, set, min, max) targeted by id, type, or tag, with repeatable application.
- Unlock system: function-based or data-driven conditions, AND/OR/NOT composition, templates, and milestones.
- Event system with filtering, middleware, debouncing, and history.
- Storage and global capacity management.
- Save and load with offline progress calculation through a pluggable storage provider.

## Installation

```bash
npm install incrementa
```

Incrementa targets Node.js 22 or later and ships ESM and CommonJS builds with TypeScript declarations.

## Quick start

```ts
import { Game, SaveManager, StorageProvider } from "incrementa";

// Any object with getItem/setItem works (browser localStorage, or your own).
const storage: StorageProvider = {
  getItem: (key) => null,
  setItem: (key, value) => {}
};

const game = new Game(new SaveManager(storage));

// Create a resource that generates passively.
const gold = game.createResource({
  name: "Gold",
  initialAmount: 50,
  basePassiveRate: 1.5, // gold per second
  unlockCondition: () => true
});

gold.on("amountChanged", (data) => {
  // Update your UI here.
  console.log("Gold:", data);
});

// Create a mine that costs wood and produces automatically.
const mine = game.createBuilding({
  name: "Gold Mine",
  costs: [{ resourceId: "wood", amount: 50, scalingFactor: 1.2 }],
  buildTime: 10,
  productionRate: 2.0,
  unlockCondition: () => gold.amount >= 100
});

if (mine.canAfford()) {
  mine.startConstruction();
}

// Start the game loop.
game.start();
```

## Core concepts

### Resources

Resources are the countable currencies of the game. They expose `increment`, `decrement`, and `setAmount`, and emit `amountChanged`.

```ts
const energy = game.createResource({ name: "Energy", initialAmount: 0, basePassiveRate: 0.5 });
energy.increment(10);
energy.decrement(3);
```

### Buildings and producers

Buildings have a construction lifecycle and structured costs. Miners extract a resource over time; factories convert inputs to outputs.

```ts
const ironMiner = game.createMiner({
  name: "Iron Miner",
  costs: [{ resourceId: "wood", amount: 100 }],
  buildTime: 15,
  gatherRate: 2.5,     // iron per second
  resourceId: "iron",
  autoStart: true
});

game.startAllProduction();
const stats = game.getGlobalProductionStats();
```

### Storage and capacity

Storage buildings define global capacity limits per resource. When no built storage defines a limit for a resource, that resource is treated as uncapped.

```ts
const warehouse = game.createStorage({
  name: "Warehouse",
  costs: [{ resourceId: "wood", amount: 50 }],
  buildTime: 20,
  capacities: { gold: 10000, iron: 5000 }
});

game.getTotalCapacityFor("gold");      // total across built storage
game.getRemainingCapacityFor("gold");
game.hasGlobalCapacity("gold", 500);
```

### Upgrades

Upgrades use data-driven effects targeting entities by id, type, or tag.

```ts
const productionBoost = game.createUpgrade({
  name: "Production Boost",
  costs: [{ resourceId: "gold", amount: 500, scalingFactor: 1.5 }],
  isRepeatable: true,
  maxApplications: 10,
  configuration: {
    effects: [{
      type: "property_modifier",
      targetProperty: "productionRate",
      operation: "percentage",
      value: 50,
      description: "Increase production by 50%"
    }],
    targets: [{ entityType: "building", tags: ["mining"] }],
    isRepeatable: true,
    maxApplications: 10,
    currentApplications: 0,
    autoApply: false
  }
});

const result = productionBoost.apply();
```

### Unlock conditions

Pass an `unlockCondition` function to any entity, then let the game check it.

```ts
const advancedMine = game.createBuilding({
  name: "Advanced Mine",
  unlockCondition: () => (game.getResourceByName("Gold")?.amount ?? 0) >= 5000
});

game.checkUnlockConditions();
```

### Costs

```ts
import { createCosts } from "incrementa";

const costs = createCosts({ gold: 1000, iron: 500 }, 1.3); // 30% scaling
const validation = game.costSystem.validateCost(costs, { level: 5 });
if (validation.canAfford) {
  game.costSystem.spendResources(costs, { level: 5 });
}
```

### Events

```ts
game.on("buildComplete", (data) => console.log("Built:", data));

game.getEventManager().onSystemEvent("amountChanged", (event) => {
  console.log("Resource changed:", event.data);
}, { debounce: 100 });
```

## Architecture

`Game` is a thin orchestrator over focused services:

- `EntityService` creates and tracks entities.
- `ProductionService` runs producers and reports bottlenecks.
- `CapacityService` computes storage capacity.
- `TimerService` manages timers.
- `EventService` wraps the `EventManager`.
- `UnlockService` wraps the `UnlockManager`.
- `GameLoopService` drives frame updates with delta time and a speed multiplier.
- `GameStateService` handles save, load, and offline progress.

The recommended entry point is the `Game` instance and its methods. The services and engines are also exported for advanced use.

## Documentation

Additional documentation lives in `docs/`:

- `docs/getting-started/` - installation and quick start
- `docs/architecture/` - architecture and service overview
- `docs/core/` - core class reference
- `docs/api/` - entity and service reference
- `docs/examples/` - worked examples

A runnable example is in `examples/deepcore-driller`.

## Testing

Incrementa follows test-driven development. The suite covers core systems, entities, integration scenarios, and performance.

```bash
npm test              # run all tests
npm run test:coverage # coverage report
npm run test:watch    # watch mode
```

Current status: 243 tests across 13 suites.

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md`. New features must include tests, full TypeScript types, and documentation.

## License

MIT. See `LICENSE.md`.
