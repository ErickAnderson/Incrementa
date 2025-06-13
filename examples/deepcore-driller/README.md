# 🗻 DeepCore Driller - Incrementa Framework Example

This is a complete example game built using the **Incrementa** framework, demonstrating all major features and best practices for building incremental/idle games.

## 🎮 Game Overview

DeepCore Driller is a minimalist mining incremental game where players:
- Extract **Ore** through manual clicking and automated miners
- Refine Ore into **Metal** using smelters
- Generate **Energy** from Metal using power cores
- Manage storage capacity with storage units
- Purchase upgrades to improve efficiency
- Build the ultimate **Deepcore Reactor** to win

**Estimated completion time:** 8-12 minutes

## 🏗️ Framework Features Demonstrated

### Core Systems
- **Game Loop**: Automatic game state management with `Game` class
- **Entity System**: Base entities with lifecycle hooks and unlock conditions
- **Event System**: Real-time updates and entity communication
- **Save System**: Persistent storage management

### Resources (`Resource` class)
```javascript
// Ore - Basic resource with manual gathering
const ore = new Resource({
  id: 'ore',
  name: 'Ore',
  initialAmount: 0,
  rate: 1, // Manual mining rate
  tags: ['raw-material']
});

// Metal - Unlocks conditionally
const metal = new Resource({
  id: 'metal',
  name: 'Metal',
  unlockCondition: () => ore.amount >= 5,
  tags: ['refined-material']
});
```

### Buildings

#### Miner (`Miner` class)
```javascript
// Automated resource extraction
const miner = new Miner({
  id: 'miner',
  name: 'Miner',
  cost: { ore: 10 },
  buildTime: 3,
  gatherRate: 2, // Generates 2 ore/second
  resourceId: 'ore',
  unlockCondition: () => ore.amount >= 5
});
```

#### Factory (`Factory` class)
```javascript
// Resource transformation
const smelter = new Factory({
  id: 'smelter',
  name: 'Smelter',
  cost: { ore: 25 },
  buildTime: 5,
  inputs: [{ resourceId: 'ore', amount: 3 }],
  outputs: [{ resourceId: 'metal', amount: 1 }],
  productionRate: 1.0 // 1 cycle per second
});
```

#### Storage (`Storage` class)
```javascript
// Capacity management
const storage = new Storage({
  id: 'storage',
  name: 'Storage Unit',
  cost: { ore: 15, metal: 5 },
  capacities: {
    ore: 100,
    metal: 50,
    energy: 25
  }
});
```

### Upgrades (`Upgrade` class)
```javascript
// Permanent improvements
const drillEfficiency = new Upgrade({
  id: 'drill-efficiency',
  name: 'Drill Efficiency',
  cost: { ore: 50, metal: 10 },
  unlockCondition: () => miner.count >= 2,
  effect: () => {
    // Increase miner production by 50%
    miner.setGatherRate(miner.gatherRate * 1.5);
  }
});
```

## 🔧 Architecture Patterns

### Entity-Component System
All game objects inherit from `BaseEntity`:
```javascript
class BaseEntity {
  - id: unique identifier
  - name: display name
  - isUnlocked(): unlock status
  - on(event, callback): event subscription
  - emit(event, data): event emission
}
```

### Event-Driven Updates
Real-time UI updates through event system:
```javascript
resource.on('amountChanged', updateResourceDisplay);
building.on('buildComplete', updateBuildingDisplay);
upgrade.on('unlocked', updateUpgradeDisplay);
```

### Capacity Management
Automatic production pausing when storage is full:
```javascript
// Framework automatically checks capacity before production
if (game.hasGlobalCapacity(resourceId, amount)) {
  resource.increment(amount);
} else {
  // Production paused - capacity exceeded
}
```

### Unlock Conditions
Progressive game unlocking:
```javascript
// Buildings unlock based on resource thresholds
unlockCondition: () => resources.ore.amount >= 5

// Win condition requires multiple buildings
unlockCondition: () => {
  return ore.amount >= 100 &&
         metal.amount >= 50 &&
         energy.amount >= 25 &&
         miner.count >= 1 &&
         smelter.count >= 1;
}
```

## 📁 File Structure

```
deepcore-driller/
├── index.html          # Complete HTML structure with all UI elements
├── src/
│   ├── main.js         # Game logic using DOM manipulation
│   └── style.css       # TailwindCSS imports
├── package.json        # Dependencies
├── vite.config.js      # Vite + TailwindCSS config
└── README.md           # This file
```

## 🏗️ Architecture Design

### Clean Separation of Concerns
- **HTML (index.html)**: Complete dashboard UI structure with semantic elements
- **JavaScript (main.js)**: Pure game logic using `getElementById()` and DOM manipulation
- **CSS (TailwindCSS)**: Modern gradient design with responsive layout

### Beautiful Dashboard Interface
The game features a professional industrial-themed dashboard:

#### 🎨 **Design System**
- **Color Palette**: Dark slate/blue gradients with colorful accents
- **Layout**: Responsive 3-column grid (XL+ screens) with sticky header
- **Typography**: Gradient text effects, proper hierarchy, monospace numbers
- **Interactive Elements**: Hover effects, transitions, visual feedback

#### 📱 **Responsive Layout**
```
Header (Sticky)
├── Resource Overview (Top Banner)
│   ├── Ore Card (Amber theme)
│   ├── Metal Card (Slate theme) 
│   └── Energy Card (Purple theme)
└── Three Column Grid
    ├── Left: Buildings & Construction (Green theme)
    ├── Middle: Production Status (Yellow theme)
    └── Right: Research & Upgrades (Indigo theme)
```

#### 🔧 **TailwindCSS Features Used**
- **Gradients**: `bg-gradient-to-br`, `bg-gradient-to-r`
- **Opacity**: `/30`, `/40`, `/60` modifiers for transparency
- **Backdrop**: `backdrop-blur-sm` for glass morphism
- **Animation**: `animate-pulse` for status indicators
- **Responsive**: `md:`, `xl:` breakpoints
- **Spacing**: Consistent `gap-6`, `space-y-4` patterns

### No innerHTML Usage
The implementation uses proper DOM manipulation:
```javascript
// ❌ Avoid innerHTML (security risk, performance cost)
element.innerHTML = `<div>Dynamic content</div>`;

// ✅ Use proper DOM manipulation
element.textContent = 'Safe content';
element.style.display = 'block';
element.className = 'new-classes';
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ installed
- Built Incrementa framework (`npm run build` in root)

### Run the Game
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Build for Production
```bash
npm run build
npm run preview
```

## 💡 Learning Points

### 1. Framework Integration
```javascript
// Always create SaveManager first
const saveManager = new SaveManager({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
});

// Initialize game with save manager
const game = new Game(saveManager);

// Set game references for capacity checking
resource.setGameReference(game);
building.setGameReference(game);
```

### 2. Production Systems
```javascript
// Miners auto-start production when built
const miner = new Miner({
  autoStart: true, // Default for miners
  gatherRate: 2
});

// Factories require manual start or auto-start
const factory = new Factory({
  autoStart: false, // Default for factories
  inputs: [...],
  outputs: [...]
});

// Start production manually
factory.startProduction();
```

### 3. UI Integration
```javascript
// Clean DOM manipulation without innerHTML
function updateResourceDisplay() {
  Object.values(gameState.resources).forEach(resource => {
    const resourceElement = document.getElementById(`${resource.id}-resource`);
    const amountElement = document.getElementById(`${resource.id}-amount`);
    
    if (resource.isUnlocked()) {
      resourceElement.style.display = 'block';
      amountElement.textContent = Math.floor(resource.amount);
    } else {
      resourceElement.style.display = 'none';
    }
  });
}

// Subscribe to framework events for real-time updates
resource.on('amountChanged', updateResourceDisplay);
resource.on('unlocked', updateResourceDisplay);
```

### 4. Cost Systems
```javascript
// Simple cost objects
cost: { ore: 10, metal: 5 }

// Framework handles cost validation
if (game.costSystem.canAfford(building.cost)) {
  game.costSystem.spendResources(building.cost);
  building.build();
}
```

## 🎯 Game Balance

The game is designed to demonstrate framework features with these progression gates:

1. **Manual Mining** (0-30s): Learn basic mechanics
2. **First Miner** (30s-2m): Automated production
3. **Smelter** (1-3m): Resource transformation
4. **Storage** (2-4m): Capacity management
5. **Upgrades** (3-6m): Efficiency improvements
6. **Power Core** (4-8m): Advanced production
7. **Win Condition** (8-12m): Deepcore Reactor

## 🔧 Customization Guide

### Adding New Resources
```javascript
const newResource = new Resource({
  id: 'crystal',
  name: 'Crystal',
  description: 'Rare crystalline formations',
  unlockCondition: () => energy.amount >= 50,
  tags: ['rare-material']
});

game.addEntity(newResource);
```

### Adding New Buildings
```javascript
const refinery = new Factory({
  id: 'refinery',
  name: 'Crystal Refinery',
  inputs: [{ resourceId: 'energy', amount: 5 }],
  outputs: [{ resourceId: 'crystal', amount: 1 }],
  productionRate: 0.2, // Slow but valuable
  cost: { metal: 100, energy: 50 }
});
```

### Adding New Upgrades
```javascript
const advancedDrills = new Upgrade({
  id: 'advanced-drills',
  name: 'Advanced Drilling',
  effect: () => {
    // Find all miners and boost them
    game.getEntitiesByType(Miner).forEach(miner => {
      miner.setGatherRate(miner.gatherRate * 2);
    });
  }
});
```

## 📚 Further Reading

- [Incrementa Framework Documentation](../../../README.md)
- [Entity System Guide](../../../docs/entities.md)
- [Production System Guide](../../../docs/production.md)
- [Event System Guide](../../../docs/events.md)

## 🤝 Contributing

This example serves as both a playable game and a reference implementation. When making changes:

1. **Maintain clarity**: Code should be educational
2. **Add comments**: Explain framework usage patterns
3. **Test thoroughly**: Ensure all features work end-to-end
4. **Update documentation**: Keep README in sync with code

## 📄 License

This example is part of the Incrementa framework and follows the same license terms.