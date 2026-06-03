# Service-Oriented Design

Incrementa's service architecture provides clean separation of concerns while maintaining high performance and backward compatibility. This document details the service-oriented design principles and implementation.

## 🎯 Service Architecture Overview

The framework is built around six core services that handle different aspects of game logic:

```
┌─────────────────────────────────────────────────────────────┐
│                     Game Orchestrator                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Unified   │ │   Legacy    │ │   Event     │          │
│  │   Service   │ │     API     │ │   System    │          │
│  │     API     │ │ (Backward   │ │             │          │
│  │             │ │Compatible)  │ │             │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Entity     │ │ Production   │ │  Capacity    │        │
│  │  Service     │ │  Service     │ │  Service     │        │
│  │              │ │              │ │              │        │
│  │ • CRUD Ops   │ │ • Optimization│ │ • Calculations│       │
│  │ • Factory    │ │ • Coordination│ │ • Caching     │       │
│  │ • Collections│ │ • Bottlenecks │ │ • Validation  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Timer      │ │   Event      │ │  Unlock      │        │
│  │  Service     │ │  Service     │ │  Service     │        │
│  │              │ │              │ │              │        │
│  │ • Lifecycle  │ │ • Coordination│ │ • Conditions │        │
│  │ • Performance│ │ • Statistics  │ │ • Manual     │        │
│  │ • Monitoring │ │ • Routing     │ │ • Statistics │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Service Contracts

Each service implements a well-defined interface ensuring consistency and testability:

### Service Interface Pattern
```typescript
// Standard service interface pattern
interface IService {
    // Core operations
    // Lifecycle methods  
    destroy(): void;
    
    // Performance/monitoring
    getStats?(): ServiceStats;
}

// Example implementation
class ServiceImpl implements IService {
    constructor(dependencies: ServiceDependencies) {
        // Initialize with dependencies
    }
    
    // Implementation...
    
    destroy(): void {
        // Cleanup resources
    }
}
```

## 🏗️ EntityService

**Responsibility**: Entity lifecycle management and CRUD operations  
**Interface**: [`IEntityService`](../../src/core/entity-service.ts#L65-L88)

### Design Principles
- **Single Source of Truth**: All entities managed in centralized collections
- **Type Safety**: Strongly typed collections for different entity types
- **Factory Pattern**: Consistent entity creation with automatic game reference setting
- **Event Integration**: Automatic event registration for all entities

### Architecture
```typescript
class EntityService implements IEntityService {
    // Type-specific collections for performance
    private entities = new Map<string, BaseEntity>();
    private resources = new Map<string, Resource>();
    private buildings = new Map<string, Building>();
    private upgrades = new Map<string, Upgrade>();
    private storages = new Map<string, Storage>();

    // Factory methods ensure consistent creation
    createResource(config: ResourceConfig): Resource {
        const resource = new Resource(config);
        if (this.game) {
            resource.setGameReference(this.game);
        }
        this.addEntity(resource);
        return resource;
    }
}
```

### Performance Optimizations
- **Separate Collections**: Type-specific maps for O(1) lookups
- **Lazy Loading**: Entities created only when needed
- **Batch Operations**: Efficient bulk entity operations

### Usage Patterns
```typescript
// Recommended: Use service API
const gold = game.entities.createResource({ name: 'Gold' });
const allResources = game.entities.getResources();
const specificResource = game.entities.getResourceById('gold');

// Legacy: Still supported
const gold = game.createResource({ name: 'Gold' });
```

## ⚙️ ProductionService

**Responsibility**: Production optimization and coordination  
**Interface**: [`IProductionService`](../../src/core/production-service.ts#L45-L70)

### Design Principles
- **Optimization Focus**: Automatically optimize production chains
- **Resource Integration**: Seamless integration with resource and capacity systems
- **Performance Monitoring**: Track production efficiency and bottlenecks
- **Scalable Architecture**: Handle hundreds of producers efficiently

### Architecture
```typescript
class ProductionService implements IProductionService {
    constructor(
        private getEntities: () => BaseEntity[],
        private getResourceById: (id: string) => Resource | undefined,
        private hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ) {
        // Dependency injection for loose coupling
    }

    optimizeProduction(): ProductionOptimizationResult {
        // 1. Get all producer buildings
        // 2. Check resource availability
        // 3. Verify output capacity
        // 4. Start/stop producers based on conditions
        // 5. Return optimization results
    }
}
```

### Optimization Algorithm
```typescript
// Production optimization workflow
1. Scan all producer buildings
2. For each producer:
   a. Check if can start production
   b. Verify input resource availability
   c. Confirm output capacity exists
   d. Start production if all conditions met
3. For active producers:
   a. Check if should continue production
   b. Stop if resources insufficient or capacity full
4. Return statistics on actions taken
```

### Performance Features
- **Efficient Scanning**: Only check relevant producers
- **Bottleneck Detection**: Identify resource and capacity constraints
- **Statistics Tracking**: Monitor production performance over time

## 📦 CapacityService

**Responsibility**: Storage capacity management and calculations  
**Interface**: [`ICapacityService`](../../src/core/capacity-service.ts#L7-L24)

### Design Principles
- **Global Coordination**: Manage capacity across all storage buildings
- **Performance Caching**: Cache expensive calculations for 5 seconds
- **Automatic Invalidation**: Smart cache invalidation on storage changes
- **Resource Integration**: Work seamlessly with resource management

### Architecture
```typescript
class CapacityService implements ICapacityService {
    private capacityCache = new Map<string, number>();
    private cacheValidUntil = 0;
    private readonly CACHE_DURATION = 5000; // 5 seconds

    getTotalCapacityFor(resourceId: string): number {
        // Check cache first for performance
        const now = Date.now();
        if (now < this.cacheValidUntil && this.capacityCache.has(resourceId)) {
            return this.capacityCache.get(resourceId)!;
        }

        // Calculate fresh capacity
        let totalCapacity = 0;
        const storages = this.getStorages();
        
        for (const storage of storages) {
            if (storage.isBuilt) {
                const capacity = storage.getCapacityFor(resourceId);
                if (capacity > 0) {
                    totalCapacity += capacity;
                }
            }
        }

        // Cache result
        this.capacityCache.set(resourceId, totalCapacity);
        this.cacheValidUntil = now + this.CACHE_DURATION;
        
        return totalCapacity;
    }
}
```

### Caching Strategy
- **Time-Based Cache**: 5-second cache duration for capacity calculations
- **Smart Invalidation**: Cache cleared when storage buildings change
- **Performance Impact**: ~90% reduction in calculation time for frequent checks

## ⏰ TimerService

**Responsibility**: Timer lifecycle and performance management  
**Interface**: [`ITimerService`](../../src/core/timer-service.ts#L7-L35)

### Design Principles
- **Centralized Management**: All timers managed through single service
- **Performance Tracking**: Monitor timer update performance
- **Bulk Operations**: Efficient pause/resume all functionality
- **Automatic Cleanup**: Remove completed timers automatically

### Architecture
```typescript
class TimerService implements ITimerService {
    private timers = new Map<string, Timer>();
    private pausedTimers = new Set<string>();
    private completedTimers = new Set<string>();
    
    updateTimers(deltaTime: number): void {
        const startTime = performance.now();
        const completedThisUpdate: string[] = [];

        for (const [id, timer] of this.timers) {
            if (timer.getIsRunning()) {
                // Timer is still running
            } else {
                // Timer completed, mark for removal
                completedThisUpdate.push(id);
                this.completedTimers.add(id);
            }
        }

        // Remove completed timers
        for (const id of completedThisUpdate) {
            this.removeTimer(id);
        }

        // Track performance
        const updateTime = performance.now() - startTime;
        this.updateStats.totalUpdateTime += updateTime;
        this.updateStats.updateCount++;
    }
}
```

### Performance Features
- **Efficient Updates**: Only update active timers
- **Automatic Cleanup**: Remove completed timers immediately
- **Performance Metrics**: Track update time and frequency
- **Bulk Operations**: Pause/resume all timers in single operation

## 🎭 EventService

**Responsibility**: Event system coordination and statistics  
**Interface**: [`IEventService`](../../src/core/event-service.ts#L7-L25)

### Design Principles
- **Clean Interface**: Simplified API over complex EventManager
- **Entity Integration**: Automatic entity event registration
- **Performance Monitoring**: Track event emission statistics
- **System Control**: Global pause/resume functionality

### Architecture
```typescript
class EventService implements IEventService {
    private eventManager: EventManager;

    constructor() {
        this.eventManager = new EventManager();
    }

    // Clean interface to underlying event manager
    on(eventName: string, callback: (...args: unknown[]) => void): void {
        this.eventManager.on(eventName, callback);
    }

    emit(eventName: string, data?: unknown): void {
        this.eventManager.emit(eventName, data);
    }

    // Entity integration
    registerEntity(entity: BaseEntity): void {
        this.eventManager.registerEntity(entity);
    }

    routeEntityEvents(entity: BaseEntity): void {
        this.eventManager.routeEntityEvents(entity);
    }
}
```

### Event System Features
- **Event Batching**: High-frequency events batched for performance
- **Entity Routing**: Automatic routing of entity events to global system
- **Statistics Tracking**: Monitor event emission frequency and performance
- **Error Handling**: Graceful handling of event listener errors

## 🔓 UnlockService

**Responsibility**: Unlock condition management and progression  
**Interface**: [`IUnlockService`](../../src/core/unlock-service.ts#L8-L26)

### Design Principles
- **Condition Management**: Centralized unlock condition checking
- **Manual Override**: Admin/debug manual unlocking capability
- **Performance Optimization**: Efficient condition checking
- **Statistics Tracking**: Monitor unlock progression

### Architecture
```typescript
class UnlockService implements IUnlockService {
    private unlockManager: UnlockManager;

    checkUnlockConditions(): void {
        this.unlockManager.checkUnlockConditions();
    }

    unlockEntity(entityId: string): boolean {
        // Try unlock manager first
        const result = this.unlockManager.unlockEntity(entityId);
        if (result) return true;

        // Fallback to direct entity unlock
        const entity = this.game.getEntityById?.(entityId);
        if (entity && !entity.isUnlocked) {
            entity.isUnlocked = true;
            entity.onUnlock();
            entity.emit('unlocked', { entity });
            return true;
        }
        return false;
    }
}
```

### Unlock Features
- **Condition Evaluation**: Efficient condition checking with caching
- **Manual Override**: Debug/admin capability to force unlock entities
- **Statistics**: Track unlock progression and timing
- **Event Integration**: Emit unlock events for UI updates

## 🔄 Service Coordination

### Dependency Management
Services are initialized in dependency order to ensure proper functionality:

```typescript
// Service initialization order in Game constructor
constructor(saveManager: SaveManager) {
    // 1. Core services (no dependencies)
    this.events = new EventService();
    
    // 2. Entity service (depends on game reference)
    this.entities = new EntityService(this);
    
    // 3. Capacity service (depends on entities)
    this.capacity = new CapacityService(
        () => this.entities.getStorages(),
        (id) => this.entities.getResourceById(id)
    );
    
    // 4. Production service (depends on entities and capacity)
    this.production = new ProductionService(
        () => this.entities.getAllEntities(),
        (id) => this.entities.getResourceById(id),
        (resourceId, amount) => this.capacity.hasGlobalCapacity(resourceId, amount)
    );
    
    // 5. Independent services
    this.timers = new TimerService();
    this.unlocks = new UnlockService(this);
    this.gameLoop = new GameLoopService();
    this.gameState = new GameStateService(saveManager);
    
    // 6. Wire service dependencies
    this.wireServices();
}
```

### Service Communication
Services communicate through:
- **Dependency Injection**: Services receive needed dependencies in constructor
- **Event System**: Services emit and listen for events
- **Direct Method Calls**: Game class coordinates service interactions

### Game Loop Integration
```typescript
private wireServices(): void {
    this.gameLoop.onUpdate((deltaTime) => {
        // Update all services in coordination
        this.performanceMonitor.recordFrameTime();
        this.updateEntities(deltaTime);
        this.timers.updateTimers(deltaTime);
        this.unlocks.checkConditions();
        this.production.optimizeProduction();
        this.pluginSystem.updatePlugins(deltaTime);
        this.updateResources(deltaTime);
    });
}
```

## 📊 Performance Characteristics

### Service Performance Benchmarks
Based on framework testing with 1000+ entities:

| Service | Operation | Performance |
|---------|-----------|-------------|
| EntityService | Create 1000 resources | 6.7ms |
| EntityService | Create 500 buildings | 3.5ms |
| ProductionService | Optimize 50 producers | 0.8ms |
| CapacityService | Calculate capacity (cached) | 0.01ms |
| CapacityService | Calculate capacity (fresh) | 0.5ms |
| TimerService | Update 100 timers | 0.3ms |
| EventService | Emit 1000 events | 2.1ms |

### Scaling Characteristics
- **Entity Service**: Linear scaling O(n) for most operations
- **Production Service**: O(n) where n = number of producers
- **Capacity Service**: O(m) where m = number of storage buildings
- **Timer Service**: O(t) where t = number of active timers
- **Event Service**: O(l) where l = number of listeners per event

### Memory Usage
- **Service Overhead**: ~50KB total for all services
- **Entity Collections**: ~1KB per 100 entities
- **Cache Storage**: ~10KB for typical capacity cache
- **Event System**: ~5KB for typical listener setup

## 🧪 Testing Strategy

### Service Unit Testing
Each service is tested in isolation:

```typescript
// Service isolation test example
describe('EntityService', () => {
    let entityService: EntityService;
    let mockGame: IGame;

    beforeEach(() => {
        mockGame = createMockGame();
        entityService = new EntityService(mockGame);
    });

    test('should create resource with game reference', () => {
        const resource = entityService.createResource({ name: 'Gold' });
        expect(resource.game).toBe(mockGame);
        expect(entityService.getResources()).toContain(resource);
    });
});
```

### Service Integration Testing
Services tested together to verify interactions:

```typescript
// Service integration test example
describe('Service Integration', () => {
    let game: Game;

    beforeEach(() => {
        game = new Game(mockSaveManager);
    });

    test('should coordinate production and capacity', () => {
        // Create entities through entity service
        const gold = game.entities.createResource({ name: 'Gold' });
        const storage = game.entities.createStorage({
            name: 'Vault',
            capacities: { gold: 1000 }
        });
        const miner = game.entities.createMiner({
            name: 'Gold Mine',
            resourceId: 'gold',
            gatherRate: 10
        });

        // Storage should provide capacity
        expect(game.capacity.getTotalCapacityFor('gold')).toBe(1000);

        // Production should start miner
        const started = game.production.startAllProduction();
        expect(started).toContain(miner);
    });
});
```

## 🔧 Extension Points

### Custom Services
The architecture supports custom services:

```typescript
// Define custom service interface
interface ICustomService {
    doCustomOperation(): void;
    getCustomStats(): CustomStats;
    destroy(): void;
}

// Implement custom service
class CustomService implements ICustomService {
    constructor(private game: IGame) {}
    
    doCustomOperation(): void {
        // Custom logic
    }
    
    getCustomStats(): CustomStats {
        return { /* custom stats */ };
    }
    
    destroy(): void {
        // Cleanup
    }
}

// Extend Game class to include custom service
class ExtendedGame extends Game {
    public readonly customService: ICustomService;
    
    constructor(saveManager: SaveManager) {
        super(saveManager);
        this.customService = new CustomService(this);
    }
}
```

### Service Plugins
Services can be extended through plugins:

```typescript
// Service plugin pattern
interface ServicePlugin {
    name: string;
    initialize(service: IService): void;
    destroy(): void;
}

class ProductionAnalyticsPlugin implements ServicePlugin {
    name = 'ProductionAnalytics';
    
    initialize(productionService: IProductionService): void {
        // Add analytics to production service
        productionService.on?.('optimizationComplete', (data) => {
            this.trackOptimization(data);
        });
    }
    
    destroy(): void {
        // Cleanup
    }
}
```

## 🚀 Best Practices

### Service Usage Guidelines

#### Do:
```typescript
// Use service APIs for new code
const resource = game.entities.createResource(config);
game.production.startAllProduction();
game.capacity.hasGlobalCapacity('gold', 100);

// Inject dependencies properly
class CustomManager {
    constructor(
        private entityService: IEntityService,
        private productionService: IProductionService
    ) {}
}

// Handle service lifecycle
class CustomGame extends Game {
    destroy(): void {
        this.customService.destroy();
        super.destroy();
    }
}
```

#### Don't:
```typescript
// Avoid direct manager access in new code
game.entityRegistry.registerEntity(entity); // Legacy

// Don't create tight coupling
class BadManager {
    constructor(private game: Game) {
        // Accessing game internals directly
        this.entities = game.entities.entities; // Private access
    }
}

// Don't skip service cleanup
// Missing cleanup can cause memory leaks
```

### Performance Guidelines
- **Cache Wisely**: Use service caching but invalidate appropriately
- **Batch Operations**: Group related operations when possible
- **Monitor Performance**: Use service statistics to identify bottlenecks
- **Lazy Loading**: Create entities/services only when needed

---

*Next: [Entity System](./entities.md) - Deep dive into entity architecture and relationships*