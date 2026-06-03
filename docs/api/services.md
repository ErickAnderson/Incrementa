# Services API Reference

This document provides a comprehensive reference for all services in the Incrementa framework. Services provide specialized functionality and can be accessed through the main Game instance.

## 🎯 Service Overview

```typescript
// Access services through the game instance
game.entities     // EntityService - Entity management
game.production   // ProductionService - Production optimization  
game.capacity     // CapacityService - Storage capacity management
game.timers       // TimerService - Timer coordination
game.events       // EventService - Event handling
game.unlocks      // UnlockService - Unlock condition management
```

---

## 🏗️ EntityService

**Interface**: `IEntityService`  
**Implementation**: [`src/core/entity-service.ts`](../../src/core/entity-service.ts)  
**Access**: `game.entities`

Manages all game entities including resources, buildings, and upgrades.

### Core Methods

#### Entity Management
```typescript
// Add entity to the game
addEntity(entity: BaseEntity): boolean

// Remove entity by ID
removeEntity(entityId: string): boolean

// Get entity by ID
getEntityById(entityId: string): BaseEntity | undefined

// Get all entities
getAllEntities(): BaseEntity[]
```

#### Type-Specific Access
```typescript
// Resource access
getResources(): Resource[]
getResourceById(resourceId: string): Resource | undefined
getResourceByName(name: string): Resource | undefined

// Building access  
getBuildings(): Building[]
getBuildingById(buildingId: string): Building | undefined

// Storage access
getStorages(): Storage[]
getStorageById(storageId: string): Storage | undefined

// Upgrade access
getUpgrades(): Upgrade[]
getUpgradeById(upgradeId: string): Upgrade | undefined
```

#### Factory Methods
```typescript
// Create and register entities
createResource(config: ResourceConfig): Resource
createBuilding(config: BuildingConfig): Building
createMiner(config: MinerConfig): Miner
createStorage(config: StorageConfig): Storage
createUpgrade(config: UpgradeConfig): Upgrade

// Generic entity creation
createEntity<T extends BaseEntity>(
    EntityClass: new (config: Record<string, unknown>) => T,
    config: Record<string, unknown>
): T
```

### Configuration Interfaces

#### ResourceConfig
```typescript
interface ResourceConfig {
    id?: string;                    // Auto-generated if not provided
    name: string;                   // Display name
    description?: string;           // Optional description
    initialAmount?: number;         // Starting amount (default: 0)
    rate?: number;                  // Passive generation per second
    basePassiveRate?: number;       // Base rate before modifiers
    unlockCondition?: () => boolean; // Unlock condition function
    tags?: string[];                // Categorization tags
}
```

#### BuildingConfig
```typescript
interface BuildingConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];       // New cost system
    cost?: Record<string, number>;  // Legacy cost format
    buildTime?: number;             // Build time in milliseconds
    productionRate?: number;        // Production rate modifier
    level?: number;                 // Building level (default: 1)
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

#### MinerConfig
```typescript
interface MinerConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];
    cost?: Record<string, number>;
    buildTime?: number;
    gatherRate: number;             // Resources per second when active
    resourceId: string;             // Target resource ID
    efficiency?: number;            // Efficiency multiplier
    autoStart?: boolean;            // Auto-start production when built
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

### Example Usage
```typescript
// Create a basic resource
const gold = game.entities.createResource({
    name: 'Gold',
    initialAmount: 100,
    rate: 1.0,
    tags: ['currency', 'basic']
});

// Create a miner building
const goldMine = game.entities.createMiner({
    name: 'Gold Mine',
    resourceId: 'gold',
    gatherRate: 5.0,
    buildTime: 2000,
    costs: [{ resourceId: 'gold', amount: 50 }],
    unlockCondition: () => gold.amount >= 25
});

// Access entities
const allResources = game.entities.getResources();
const specificResource = game.entities.getResourceById('gold');
const namedResource = game.entities.getResourceByName('Gold');
```

---

## ⚙️ ProductionService

**Interface**: `IProductionService`  
**Implementation**: [`src/core/production-service.ts`](../../src/core/production-service.ts)  
**Access**: `game.production`

Manages production optimization, producer building coordination, and resource flow analysis.

### Core Methods

#### Production Control
```typescript
// Start all production that can be started
startAllProduction(): BaseEntity[]

// Stop all active production
stopAllProduction(): BaseEntity[]

// Optimize production based on resources/capacity
optimizeProduction(): ProductionOptimizationResult
```

#### Producer Information
```typescript
// Get all buildings capable of production
getProducerBuildings(): BaseEntity[]

// Get currently producing buildings
getActiveProducers(): BaseEntity[]

// Get global production statistics
getGlobalProductionStats(): GlobalProductionStats

// Analyze production bottlenecks
getProductionBottlenecks(): ProductionBottlenecks
```

#### Resource Checking
```typescript
// Check if inputs are available for production
checkResourceAvailability(inputs: Array<{resourceId: string, amount: number}>): boolean

// Check if outputs can be stored
checkProductionCapacity(outputs: Array<{resourceId: string, amount: number}>): boolean
```

### Return Types

#### ProductionOptimizationResult
```typescript
interface ProductionOptimizationResult {
    started: number;        // Number of producers started
    stopped: number;        // Number of producers stopped  
    bottlenecks: string[];  // Resource IDs causing bottlenecks
    totalChecked: number;   // Total producers examined
}
```

#### GlobalProductionStats
```typescript
interface GlobalProductionStats {
    totalProducers: number;
    activeProducers: number;
    totalCyclesCompleted: number;
    averageEfficiency: number;
    resourceProductionRates: Record<string, number>;
    resourceConsumptionRates: Record<string, number>;
}
```

#### ProductionBottlenecks
```typescript
interface ProductionBottlenecks {
    resourceShortages: Array<{
        resourceId: string;
        required: number;
        available: number;
    }>;
    capacityLimits: Array<{
        resourceId: string;
        attempted: number;
        capacity: number;
    }>;
    stoppedProducers: string[];
    blockedProducers: string[];
}
```

### Example Usage
```typescript
// Start all possible production
const startedProducers = game.production.startAllProduction();
console.log(`Started ${startedProducers.length} producers`);

// Optimize production
const result = game.production.optimizeProduction();
console.log(`Optimization: +${result.started}, -${result.stopped}`);

// Check production bottlenecks
const bottlenecks = game.production.getProductionBottlenecks();
if (bottlenecks.resourceShortages.length > 0) {
    console.log('Resource shortages:', bottlenecks.resourceShortages);
}

// Get production statistics
const stats = game.production.getGlobalProductionStats();
console.log(`Production efficiency: ${stats.averageEfficiency}%`);
```

---

## 📦 CapacityService

**Interface**: `ICapacityService`  
**Implementation**: [`src/core/capacity-service.ts`](../../src/core/capacity-service.ts)  
**Access**: `game.capacity`

Manages storage capacity calculations across all storage buildings with performance caching.

### Core Methods

#### Capacity Calculations
```typescript
// Get total capacity for a resource across all storage
getTotalCapacityFor(resourceId: string): number

// Check if there's capacity for additional amount
hasGlobalCapacity(resourceId: string, amount: number): boolean

// Get remaining capacity for a resource
getRemainingCapacityFor(resourceId: string): number
```

#### Storage Management
```typescript
// Get all storage buildings and their status
getStorageStatus(): Storage[]

// Invalidate capacity cache (force recalculation)
invalidateCache(): void

// Perform maintenance operations
performMaintenance(): void
```

### Caching Behavior
The service implements intelligent caching for expensive capacity calculations:
- **Cache Duration**: 5 seconds
- **Cache Invalidation**: Automatic on storage changes
- **Performance**: Significant speedup for frequent capacity checks

### Example Usage
```typescript
// Check if we can add 100 gold
if (game.capacity.hasGlobalCapacity('gold', 100)) {
    gold.increment(100);
}

// Get capacity information
const totalCapacity = game.capacity.getTotalCapacityFor('gold');
const remaining = game.capacity.getRemainingCapacityFor('gold');
console.log(`Gold capacity: ${remaining}/${totalCapacity}`);

// Force cache refresh after adding storage
game.capacity.invalidateCache();
```

---

## ⏰ TimerService

**Interface**: `ITimerService`  
**Implementation**: [`src/core/timer-service.ts`](../../src/core/timer-service.ts)  
**Access**: `game.timers`

Coordinates all game timers with lifecycle management and performance tracking.

### Core Methods

#### Timer Management
```typescript
// Add a timer to the service
addTimer(id: string, timer: Timer): void

// Remove a timer by ID
removeTimer(id: string): boolean

// Get a timer by ID
getTimer(id: string): Timer | undefined
```

#### Lifecycle Control
```typescript
// Pause all timers
pauseAllTimers(): void

// Resume all paused timers
resumeAllTimers(): void

// Clear all timers
clearAllTimers(): void

// Update all timers (called by game loop)
updateTimers(deltaTime: number): void
```

#### Statistics and Monitoring
```typescript
// Get active timer count
getActiveTimerCount(): number

// Get paused timer count
getPausedTimerCount(): number

// Get comprehensive timer statistics
getTimerStats(): {
    totalTimers: number;
    activeTimers: number;
    pausedTimers: number;
    completedTimers: number;
    totalUpdateTime: number;
    averageUpdateTime: number;
}
```

### Example Usage
```typescript
import { Timer } from 'incrementa';

// Create a custom timer
const buildTimer = new Timer({
    totalTime: 5000, // 5 seconds
    onComplete: () => {
        console.log('Building completed!');
        building.finishConstruction();
    },
    onUpdate: (progress) => {
        updateProgressBar(progress);
    }
});

// Add to service
game.timers.addTimer('building-1', buildTimer);
buildTimer.start();

// Bulk operations
game.timers.pauseAllTimers();   // Pause everything
game.timers.resumeAllTimers();  // Resume everything

// Monitoring
const stats = game.timers.getTimerStats();
console.log(`Active timers: ${stats.activeTimers}/${stats.totalTimers}`);
```

---

## 🎭 EventService

**Interface**: `IEventService`  
**Implementation**: [`src/core/event-service.ts`](../../src/core/event-service.ts)  
**Access**: `game.events`

Provides a clean interface to the event system with entity registration and statistics.

### Core Methods

#### Event Handling
```typescript
// Add event listener
on(eventName: string, callback: (...args: unknown[]) => void): void

// Remove event listener
off(eventName: string, callback: (...args: unknown[]) => void): boolean

// Emit event
emit(eventName: string, data?: unknown): void
```

#### Entity Integration
```typescript
// Register entity for event handling
registerEntity(entity: BaseEntity): void

// Unregister entity
unregisterEntity(entityId: string): void

// Route entity events through global system
routeEntityEvents(entity: BaseEntity): void
```

#### System Control
```typescript
// Pause event processing
pause(): void

// Resume event processing
resume(): void

// Get event statistics
getEventStats(): EventStats

// Get underlying event manager
getEventManager(): EventManager
```

### Example Usage
```typescript
// Listen for resource changes
game.events.on('resourceChanged', (data) => {
    updateResourceDisplay(data.resourceId, data.newAmount);
});

// Listen for building completion
game.events.on('buildComplete', (data) => {
    showNotification(`${data.building.name} completed!`);
    game.production.optimizeProduction();
});

// Emit custom events
game.events.emit('playerAction', {
    action: 'manual_click',
    resourceId: 'gold',
    amount: 10
});

// Monitor event system
const stats = game.events.getEventStats();
console.log(`Events emitted: ${stats.eventsEmitted}`);
```

---

## 🔓 UnlockService

**Interface**: `IUnlockService`  
**Implementation**: [`src/core/unlock-service.ts`](../../src/core/unlock-service.ts)  
**Access**: `game.unlocks`

Manages entity unlock conditions with manual override capabilities.

### Core Methods

#### Unlock Management
```typescript
// Check all unlock conditions
checkUnlockConditions(): void

// Manually unlock an entity (debug/admin)
unlockEntity(entityId: string): boolean

// Check conditions (performance optimized)
checkConditions(): void
```

#### Condition Registration
```typescript
// Register unlock condition for entity
registerUnlockCondition(entity: BaseEntity, condition: () => boolean): void

// Remove unlock condition
removeUnlockCondition(entityId: string): void
```

#### Statistics and Monitoring
```typescript
// Get unlock statistics
getUnlockStats(): any

// Get detailed unlock information
getDetailedStats(): {
    unlockStats: any;
    totalEntities: number;
    unlockedEntities: number;
    pendingUnlocks: number;
}

// Get underlying unlock manager
getUnlockManager(): UnlockManager
```

#### Lifecycle Control
```typescript
// Pause unlock checking
pause(): void

// Resume unlock checking
resume(): void
```

### Example Usage
```typescript
// Entities with unlock conditions
const advancedMine = game.entities.createMiner({
    name: 'Advanced Gold Mine',
    resourceId: 'gold',
    gatherRate: 15.0,
    unlockCondition: () => gold.amount >= 500 && goldMine.isBuilt
});

// Manual unlock for testing/debugging
game.unlocks.unlockEntity('advanced-gold-mine');

// Check unlock progress
const stats = game.unlocks.getDetailedStats();
console.log(`Unlocked: ${stats.unlockedEntities}/${stats.totalEntities}`);

// Force unlock check after resource change
gold.increment(100);
game.unlocks.checkUnlockConditions();
```

---

## 🔧 Service Integration Examples

### Cross-Service Coordination
```typescript
// Complete production workflow
async function optimizeGameProduction() {
    // 1. Check what can be produced
    const producers = game.production.getProducerBuildings();
    
    // 2. Verify capacity for outputs
    const bottlenecks = game.production.getProductionBottlenecks();
    
    // 3. Build storage if needed
    if (bottlenecks.capacityLimits.length > 0) {
        const warehouse = game.entities.createStorage({
            name: 'Emergency Storage',
            capacities: { gold: 1000, wood: 1000 }
        });
    }
    
    // 4. Start optimized production
    const result = game.production.optimizeProduction();
    
    // 5. Check for new unlocks
    game.unlocks.checkUnlockConditions();
    
    console.log(`Production optimization: ${result.started} started, ${result.stopped} stopped`);
}
```

### Event-Driven UI Updates
```typescript
class GameUI {
    constructor(game: Game) {
        this.setupEventListeners(game);
    }
    
    private setupEventListeners(game: Game) {
        // Resource updates
        game.events.on('resourceChanged', (data) => {
            this.updateResourceDisplay(data.resourceId, data.newAmount);
        });
        
        // Building completion
        game.events.on('buildComplete', (data) => {
            this.showBuildingComplete(data.building);
            this.updateBuildingList();
        });
        
        // Unlock notifications
        game.events.on('unlocked', (data) => {
            this.showUnlockNotification(data.entity);
            this.refreshAvailableBuildings();
        });
        
        // Production changes
        game.events.on('productionStarted', (data) => {
            this.updateProductionStatus(data.producer, 'active');
        });
    }
}
```

### Performance Monitoring Integration
```typescript
function monitorGamePerformance(game: Game) {
    setInterval(() => {
        // Get service statistics
        const entityStats = game.entities.getEntityStats();
        const timerStats = game.timers.getTimerStats();
        const eventStats = game.events.getEventStats();
        const productionStats = game.production.getGlobalProductionStats();
        
        // Performance metrics
        const metrics = game.getPerformanceMetrics();
        
        console.log('=== Game Performance ===');
        console.log(`Entities: ${entityStats.total} (${entityStats.unlocked} unlocked)`);
        console.log(`Timers: ${timerStats.activeTimers}/${timerStats.totalTimers} active`);
        console.log(`Events: ${eventStats.eventsEmitted} emitted`);
        console.log(`Producers: ${productionStats.activeProducers}/${productionStats.totalProducers}`);
        console.log(`FPS: ${(1000 / metrics.frameTime.average).toFixed(1)}`);
        
        // Check for performance issues
        if (metrics.frameTime.average > 16.67) {
            console.warn('Performance warning: Low FPS detected');
        }
        
        if (entityStats.total > 1000) {
            console.warn('Performance warning: High entity count');
        }
    }, 10000); // Every 10 seconds
}
```

---

*Next: [Entity APIs](./entities.md) - Detailed entity class references*