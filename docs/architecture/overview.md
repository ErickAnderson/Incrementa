# Framework Architecture Overview

Incrementa is built with a modern service-oriented architecture that promotes modularity, testability, and maintainability while supporting complex incremental game mechanics.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Game Class                           │
│                   (Service Orchestrator)                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Legacy    │ │   Service   │ │   Event     │           │
│  │     API     │ │   API       │ │   System    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Services                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Entity      │ │ Production   │ │  Capacity    │        │
│  │  Service     │ │  Service     │ │  Service     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Timer       │ │   Event      │ │  Unlock      │        │
│  │  Service     │ │  Service     │ │  Service     │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Entity System                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Resources   │ │  Buildings   │ │  Upgrades    │        │
│  │              │ │              │ │              │        │
│  │ • Gold       │ │ • Miners     │ │ • Efficiency │        │
│  │ • Materials  │ │ • Factories  │ │ • Capacity   │        │
│  │ • Energy     │ │ • Storage    │ │ • Speed      │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Design Principles

### 1. Service-Oriented Architecture
The framework follows a service-oriented design where each major system is encapsulated in a dedicated service:

```typescript
// Each service has a clear responsibility
game.entities     // Entity CRUD operations
game.production   // Production management
game.capacity     // Storage capacity calculations
game.timers       // Timer coordination
game.events       // Event handling
game.unlocks      // Unlock condition management
```

### 2. Separation of Concerns
Each component has a single, well-defined responsibility:

- **Game Class**: Service orchestration and API coordination
- **Services**: Specific domain logic (entities, production, etc.)
- **Entities**: Game object state and behavior
- **Managers**: Low-level system coordination

### 3. Event-Driven Communication
Components communicate through events rather than direct coupling:

```typescript
// Entities emit events
resource.emit('amountChanged', { newAmount: 1000, delta: 50 });

// Other systems react to events
game.on('amountChanged', (data) => {
  ui.updateResourceDisplay(data);
});
```

### 4. Backward Compatibility
Legacy APIs are preserved while new service APIs are introduced:

```typescript
// Legacy API (deprecated but supported)
const resource = game.createResource({ name: 'Gold' });
game.startAllProduction();

// New service API (recommended)
const resource = game.entities.createResource({ name: 'Gold' });
game.production.startAllProduction();
```

## 📦 Core Components

### Game Class (`src/core/game.ts`)
The main entry point and service orchestrator. Reduced from 1,063 lines to 339 lines through service extraction.

**Key Responsibilities:**
- Service initialization and coordination
- Legacy API preservation  
- Game lifecycle management (start/pause/destroy)
- Service dependency wiring

### Services Layer
Six specialized services handle different aspects of game logic:

#### EntityService (`src/core/entity-service.ts`)
- Entity CRUD operations (create, read, update, delete)
- Type-specific collections (resources, buildings, upgrades)
- Game reference management
- Factory methods for entity creation

#### ProductionService (`src/core/production-service.ts`)
- Production optimization and management
- Producer building coordination
- Resource availability checking
- Production bottleneck analysis

#### CapacityService (`src/core/capacity-service.ts`)
- Storage capacity calculations across buildings
- Capacity caching for performance
- Global capacity checking
- Remaining capacity calculations

#### TimerService (`src/core/timer-service.ts`)
- Timer lifecycle management
- Bulk timer operations (pause/resume all)
- Timer statistics and monitoring
- Performance tracking

#### EventService (`src/core/event-service.ts`)
- Clean interface to EventManager
- Entity event registration
- Event routing and statistics
- Pause/resume functionality

#### UnlockService (`src/core/unlock-service.ts`)
- Unlock condition management
- Manual entity unlocking
- Unlock statistics and monitoring
- Condition checking coordination

### Entity System
Base entity types that represent game objects:

#### BaseEntity (`src/core/base-entity.ts`)
Abstract base class for all game objects with:
- Unique ID generation
- Unlock condition support
- Event emission capabilities
- Game reference management
- Lifecycle hooks (onCreated, onUnlocked, onUpdate)

#### Specialized Entities
- **Resource** (`src/entities/resources/resource.ts`) - Collectible currencies/materials
- **Building** (`src/entities/buildings/building.ts`) - Constructible structures with build times
- **Miner** (`src/entities/buildings/miner.ts`) - Resource extraction buildings
- **Storage** (`src/entities/buildings/storage.ts`) - Capacity management buildings
- **Factory** (`src/entities/buildings/factory.ts`) - Resource transformation buildings
- **Upgrade** (`src/core/upgrade.ts`) - Entity enhancement system

## 🔄 Data Flow

### Game Loop Flow
```
GameLoop.onUpdate() 
    ↓
Game.wireServices()
    ↓
┌─── PerformanceMonitor.recordFrameTime()
├─── EntityService.updateEntities(deltaTime)
├─── TimerService.updateTimers(deltaTime) 
├─── UnlockService.checkConditions()
├─── ProductionService.optimizeProduction()
├─── PluginSystem.updatePlugins(deltaTime)
└─── Game.updateResources(deltaTime)
```

### Entity Creation Flow
```
game.entities.createResource(config)
    ↓
EntityService.createResource()
    ↓
new Resource(config)
    ↓
resource.setGameReference(game)
    ↓
EntityService.addEntity(resource)
    ↓
Type-specific registration
    ↓
Event emission: 'entityAdded'
```

### Production Flow
```
game.production.startAllProduction()
    ↓
ProductionService.startAllProduction()
    ↓
EntityService.getAllEntities()
    ↓
Filter for producer buildings
    ↓
Check canStartProduction() for each
    ↓
Call building.startProduction()
    ↓
Event emission: 'productionStarted'
```

## 🚀 Performance Considerations

### Caching Strategies
- **Capacity calculations** cached for 5 seconds
- **Entity collections** cached until invalidated
- **Production state** cached per optimization cycle

### Event Batching
High-frequency events are batched to reduce overhead:
```typescript
// Events like 'resourceChanged' are batched
config: {
  batchedTypes: ['resourceChanged', 'buildProgress', 'capacityChanged'],
  excludedTypes: ['gameDestroyed', 'gamePaused', 'gameResumed']
}
```

### Efficient Updates
- Delta-time based game loop (60fps target)
- Only update entities that need active updates
- Lazy loading of expensive calculations

## 🧪 Testing Architecture

### Service Integration Tests
Each service is tested in isolation and in integration:
```typescript
// Service isolation test
const entityService = new EntityService(mockGame);
const resource = entityService.createResource(config);

// Service integration test  
const game = new Game(saveManager);
game.entities.createResource(config);
expect(game.entities.getResources()).toHaveLength(1);
```

### Cross-Service Testing
Integration tests verify service interactions:
```typescript
// Production service depends on entity and capacity services
game.entities.createResource({ name: 'Gold' });
game.entities.createMiner({ resourceId: 'gold' });
const producers = game.production.startAllProduction();
expect(producers).toHaveLength(1);
```

## 📈 Scalability

### Entity Limits
- Tested with 1000+ resources (7ms creation time)
- Tested with 500+ buildings (3.5ms creation time)
- Game loop handles 250+ entities efficiently

### Memory Management
- Automatic cleanup on entity removal
- Service destruction patterns
- Event listener cleanup

## 🔌 Extensibility

### Plugin System
```typescript
// Custom plugin extending functionality
class AutoClickerPlugin extends Plugin {
  onUpdate(deltaTime: number) {
    // Auto-click resource generation
  }
}

game.pluginSystem.registerPlugin(new AutoClickerPlugin());
```

### Custom Entities
```typescript
// Extend base entities for custom behavior
class PowerPlant extends Building {
  generateEnergy(deltaTime: number) {
    // Custom energy generation logic
  }
}
```

---

*Next: [Service-Oriented Design](./services.md) - Deep dive into the service architecture*