# Incrementa

## Overview

Incrementa is a JavaScript/TypeScript library designed to simplify the creation and prototyping of incremental or idle games. The library provides an abstract, modular set of entities and utilities
needed for resource collection, buildings, upgrades, and progression mechanics. Developers can quickly set up a game using a collection of pre-built, reusable components without being tied to specific
visual styles or opinions.

## Core Concepts

### Resources

Resources are the backbone of any incremental game. These entities are what players collect, spend, and progress with. The library offers a way to define, unlock, and upgrade resources easily.

### Buildings

Buildings automate or enhance resource collection. Buildings can be constructed, upgraded, and used to gather or convert resources.

- Miner: A specialized building that collects resources automatically over time.
- Factory: A building that takes one or more input resources and produces other resources.
- Storage: A building that stores multiple resources with upgradeable capacity. It limits how many resources can be gathered or stored by the player at any given time.

### Upgrades

Upgrades are applied to various entities to enhance their efficiency, reduce cost, increase production rates, or unlock new functionalities. They are applicable to buildings, storage, and resources.

### Timers

Timers track time-based activities like resource gathering, building construction, or research. These are essential for any game mechanic that involves waiting or time-based progression.

### Unlock Conditions

A flexible system for managing when an entity (resource, building, upgrade) becomes available to the player, based on certain conditions.

## Technical Overview

Incrementa is structured using Object-Oriented Programming (OOP) principles. Entities share common traits, reducing redundant code and providing a highly extendable base for additional features.

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

onCreated() { /* logic when created */ }
checkUnlockCondition() { /* logic to unlock */ }
unlock() { this.isUnlocked = true; this.onUnlocked(); }
onUnlocked() { /* logic when unlocked */ }
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

addUpgrade(upgrade: Upgrade) { this.upgrades.push(upgrade); }
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

collect(amount: number) { this.amount += amount; }
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

apply() { this.effect(); }
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

### Creating a Miner Building

```ts
const iron = new Resource("Iron", "A basic metal used for construction", 0, 1, () => true);
const miner = new Miner("Iron Miner", "Mines iron over time", { wood: 10 }, 10, 1, 5, iron, () => true);

miner.gatherResources();
```

### Adding an Upgrade

```ts
const upgrade = new Upgrade("Double Mining Speed", "Doubles the rate of mining", () => miner.gatherRate *= 2, {iron: 50}, () => miner.isUnlocked);
miner.addUpgrade(upgrade);
```

### Storage Management

```ts
const storage = new Storage("Iron Storage", "Stores iron", { wood: 20 }, 5, 100, () => true);
storage.addResource(iron);
```

## Roadmap

- Phase 1: Core Mechanics
  Finalize the Resource, Building, Miner, Factory, and Storage entities.
  Develop a demo game showcasing the library's ease of use.
  Implement basic game state management (save/load).
  "scaffolding "