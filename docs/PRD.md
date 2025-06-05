# Product Requirements Document (PRD): Incrementa

## 1. Overview

**Incrementa** is a JavaScript/TypeScript framework and toolkit for building web-based incremental (idle) games. Its mission is to empower developers to rapidly prototype and scale resource-gathering, automation, and upgrade-driven games using a clean, composable, and extensible API. Incrementa is designed for use with HTML/CSS frontends and is completely agnostic to rendering or game engine choices.

**Supported Game Types:**  
- Idle/clicker games  
- Resource management and gathering games  
- Automation/progression games  
- Factory and production chain games

---

## 2. Core Concepts

### Entities

- **BaseEntity**:  
  Abstract base class for all game elements.  
  - Properties: `id`, `name`, `description`, `isUnlocked`
  - Lifecycle hooks: `onCreated()`, `onUnlocked()`
- **Resource**:  
  Represents a passive or gathered resource (e.g., gold, wood, energy).  
  - Properties: `amount`, `rate`
  - Methods: `collect(amount)`, `setRate(rate)`
- **Building (abstract)**:  
  Shared logic for all buildings.  
  - Properties: `cost`, `buildTime`, `productionRate`, `upgrades`
  - Methods: `addUpgrade(upgrade)`, `startBuilding()`
- **Miner**:  
  Specialized building that gathers resources over time using a `Timer`.
  - Properties: `gatherRate`, `resource`
  - Methods: `gatherResources()`
- **Factory**:  
  Consumes input resources to produce output resources.
  - Properties: `inputResources`, `outputResources`
  - Methods: `produceResources()`
- **Storage**:  
  Limits how much of a resource can be stored.
  - Properties: `capacity`, `resources`
  - Methods: `addResource(resource)`, `increaseCapacity(amount)`

### Timer

- Centralized timer utility for all time-based activities.
- Features:
  - Pause/resume (`toggle`)
  - Auto-looping (repeats on completion)
  - Tick/update callbacks (`onUpdate`)
  - Completion/stop callbacks (`onComplete`, `onStop`)
  - Conditional stop (e.g., storage full, no input resources)

### Unlocks and Upgrades

- **Unlocks**:  
  Entities can define unlock conditions (e.g., resource thresholds, custom logic).
- **Upgrades**:  
  Enhance entities (e.g., increase rates, reduce costs).  
  - Properties: `effect`, `cost`
  - Methods: `apply()`

---

## 3. Architecture

- **OOP Design:**  
  All entities inherit from a common base, promoting code reuse and extensibility.
- **Modular Structure:**  
  - `src/entities/` (Resource, Building, Miner, Factory, Storage, etc.)
  - `src/core/` (Timer, Game, SaveManager, etc.)
  - `src/utils/` (utility functions)
- **Example File Structure:**
  ```
  src/
    core/
      entity.ts
      timer.ts
      game.ts
      ...
    entities/
      resources/
      buildings/
      workers/
      ...
    utils/
    types/
  ```
- **Importing:**
  ```ts
  import { Miner, Resource, Timer } from "incrementa";
  ```

---

## 4. Developer Usage Examples

### Creating a Resource

```ts
const iron = new Resource(
  "Iron",
  "A basic metal used for construction",
  0,      // initial amount
  1,      // rate per second
  () => true // unlock condition
);
```

### Defining a Miner and Linking to a Timer

```ts
const miner = new Miner(
  "Iron Miner",
  "Mines iron over time",
  { wood: 10 }, // cost
  10,           // build time
  1,            // production rate
  5,            // gather rate
  iron,         // resource to gather
  () => true    // unlock condition
);

// Start gathering resources
miner.gatherResources();
```

### Controlling Game Flow with Storage and Factory

```ts
const storage = new Storage(
  "Iron Storage",
  "Stores iron",
  { wood: 20 },
  5,    // build time
  100,  // capacity
  () => true
);

storage.addResource(iron);

const factory = new Factory(
  "Steel Factory",
  "Turns iron into steel",
  { iron: 50 },
  20, // build time
  1,  // production rate
  [iron], // input resources
  [steel], // output resources
  () => iron.amount >= 50
);

factory.produceResources();
```

---

## 5. Extensibility

- **Custom Logic:**  
  Developers can subclass any entity and override hooks like `onTick`, `onProduce`, `onUnlock`.
- **Custom Conditions:**  
  Unlocks and upgrades accept arbitrary functions for conditions.
- **UI Bindings:**  
  Entities expose state and events for easy integration with any frontend framework.
- **Abstract Hooks:**  
  - `onTick()`: Called on each timer tick
  - `onProduce()`: Called when a factory/miner produces resources
  - `onUnlock()`: Called when an entity is unlocked

---

## 6. Tech Stack

- **Node.js** (for development and build)
- **TypeScript** (for type safety and DX)
- **Frontend-agnostic:** No rendering or UI dependencies; works with any HTML/CSS/JS frontend.

---

## 7. Non-Goals

- **Not a visual rendering engine or UI kit:**  
  No built-in UI components or rendering logic.
- **Not responsible for saving/loading state:**  
  Persistence is optional and may be provided via plugins.
- **No external dependencies:**  
  Designed to be as "vanilla" and lightweight as possible.

---

## 8. Future Roadmap

- **Plugin System:**  
  Allow custom storage backends, analytics, or automation plugins.
- **Save/Load System:**  
  Optional, pluggable persistence for game state.
- **Debug/Dev Mode:**  
  Built-in logging and developer tools for easier debugging and balancing.

---

*This PRD defines the vision, scope, and technical requirements for Incrementa. It is intended as a living document and should be updated as the project evolves.*