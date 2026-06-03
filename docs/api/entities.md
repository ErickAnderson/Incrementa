# Entity APIs Reference

This document provides a comprehensive reference for all entity classes in the Incrementa framework. Entities are the core building blocks of incremental games, representing resources, buildings, upgrades, and other game objects.

## 🎯 Entity Hierarchy

```
BaseEntity (Abstract)
├── Resource
├── Building
│   ├── Miner
│   ├── Factory  
│   └── Storage
├── Upgrade
└── Worker
```

---

## 🏗️ BaseEntity (Abstract)

**File**: [`src/core/base-entity.ts`](../../src/core/base-entity.ts)

The abstract base class for all game entities, providing common functionality and interfaces.

### Core Properties
```typescript
abstract class BaseEntity {
    readonly id: string;           // Unique identifier
    readonly name: string;         // Display name
    readonly description?: string; // Optional description
    readonly tags?: string[];      // Categorization tags
    
    isUnlocked: boolean = false;   // Whether entity is available
    readonly entityType: string;  // Type identifier for serialization
    
    protected game?: IGame;        // Reference to game instance
}
```

### Core Methods

#### Lifecycle Hooks
```typescript
// Called when entity is first created
onCreated(): void

// Called when entity becomes unlocked
onUnlock(): void

// Called every game loop update (if entity needs active updates)
onUpdate(deltaTime: number): void

// Called when entity is destroyed/removed
onDestroy(): void
```

#### Game Integration
```typescript
// Set reference to game instance
setGameReference(game: IGame): void

// Get unlock condition function
getUnlockCondition(): (() => boolean) | undefined

// Check if entity needs active updates
needsUpdate(): boolean
```

#### Event System
```typescript
// Emit events (inherited from EventEmitter pattern)
emit(eventName: string, data?: unknown): void

// Listen for events
on(eventName: string, callback: (...args: unknown[]) => void): void

// Remove event listeners
off(eventName: string, callback: (...args: unknown[]) => void): void
```

### Example Usage
```typescript
// Base entity functionality is inherited by all entity types
const resource = game.entities.createResource({ name: 'Gold' });

// All entities have these capabilities
console.log(resource.id);           // Auto-generated UUID
console.log(resource.isUnlocked);   // true/false
console.log(resource.entityType);   // "Resource"

// Event handling
resource.on('amountChanged', (data) => {
    console.log(`Gold changed: ${data.newAmount}`);
});

// Game reference (automatically set when added to game)
console.log(resource.game === game); // true
```

---

## 💰 Resource

**File**: [`src/entities/resources/resource.ts`](../../src/entities/resources/resource.ts)

Represents collectible currencies, materials, or commodities in the game.

### Properties
```typescript
class Resource extends BaseEntity {
    amount: number;                    // Current amount
    rate: number;                      // Passive generation per second
    readonly basePassiveRate: number;  // Base rate before modifiers
    readonly maxAmount?: number;       // Optional maximum amount
    
    // Statistics
    readonly totalGenerated: number;   // Total amount ever generated
    readonly totalSpent: number;       // Total amount ever spent
}
```

### Core Methods

#### Amount Management
```typescript
// Increase amount
increment(amount: number): void

// Decrease amount
decrement(amount: number): void

// Set exact amount
setAmount(amount: number): void

// Check if can spend amount
canSpend(amount: number): boolean

// Spend amount (returns success)
spend(amount: number): boolean
```

#### Rate Management
```typescript
// Set passive generation rate
setRate(rate: number): void

// Get effective rate (including modifiers)
getEffectiveRate(): number

// Reset rate to base value
resetRate(): void
```

#### Capacity Integration
```typescript
// Check if amount can be added (respects storage capacity)
canIncrement(amount: number): boolean

// Get current capacity limit
getCapacityLimit(): number

// Get remaining capacity
getRemainingCapacity(): number
```

### Configuration
```typescript
interface ResourceConfig {
    id?: string;                    // Auto-generated if not provided
    name: string;                   // Display name
    description?: string;           // Optional description
    initialAmount?: number;         // Starting amount (default: 0)
    rate?: number;                  // Passive generation per second (default: 0)
    basePassiveRate?: number;       // Base rate before modifiers
    maxAmount?: number;             // Maximum amount (unlimited if not set)
    unlockCondition?: () => boolean; // Unlock condition function
    tags?: string[];                // Categorization tags
}
```

### Events
```typescript
// Emitted when amount changes
'amountChanged': { 
    resourceId: string, 
    newAmount: number, 
    oldAmount: number, 
    delta: number 
}

// Emitted when rate changes
'rateChanged': { 
    resourceId: string, 
    newRate: number, 
    oldRate: number 
}

// Emitted when capacity is reached
'capacityReached': { 
    resourceId: string, 
    amount: number, 
    capacity: number 
}
```

### Example Usage
```typescript
// Create a basic resource
const gold = game.entities.createResource({
    name: 'Gold',
    initialAmount: 100,
    rate: 1.0,
    description: 'Precious metal currency',
    tags: ['currency', 'basic']
});

// Amount operations
gold.increment(50);           // Add 50 gold
gold.decrement(25);           // Spend 25 gold
gold.setAmount(200);          // Set to exactly 200 gold

// Check operations
if (gold.canSpend(100)) {
    gold.spend(100);
}

// Rate management
gold.setRate(2.0);            // 2 gold per second
console.log(gold.getEffectiveRate()); // May be modified by upgrades

// Event handling
gold.on('amountChanged', (data) => {
    updateGoldDisplay(data.newAmount);
});

// Capacity integration (if storage buildings exist)
if (gold.canIncrement(500)) {
    gold.increment(500);
} else {
    console.log('Not enough storage capacity');
}
```

---

## 🏢 Building

**File**: [`src/entities/buildings/building.ts`](../../src/entities/buildings/building.ts)

Base class for all constructible structures in the game.

### Properties
```typescript
class Building extends BaseEntity {
    readonly costs: CostDefinition[];     // Construction costs
    readonly buildTime: number;           // Time to construct (ms)
    readonly level: number;               // Building level/tier
    
    isBuilding: boolean = false;          // Currently under construction
    buildProgress: number = 0;            // Construction progress (0-1)
    buildStartTime?: number;              // When construction began
    
    // Building state
    readonly isBuilt: boolean;            // Construction completed
    readonly completionTime?: number;     // When construction finished
}
```

### Core Methods

#### Construction Management
```typescript
// Start construction
startConstruction(): boolean

// Force complete construction (for testing/admin)
finishConstruction(): void

// Cancel construction (if allowed)
cancelConstruction(): boolean

// Update construction progress (called by game loop)
updateConstruction(deltaTime: number): void
```

#### Cost System Integration
```typescript
// Check if can afford construction
canAfford(): boolean

// Validate cost requirements
validateCost(): CostValidationResult

// Spend construction costs
spendCost(): boolean
```

#### Building Information
```typescript
// Get remaining build time
getRemainingBuildTime(): number

// Get build progress percentage
getBuildProgressPercentage(): number

// Get construction efficiency (affected by upgrades)
getBuildEfficiency(): number
```

### Configuration
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

### Events
```typescript
// Emitted when construction starts
'buildStarted': { 
    building: Building, 
    estimatedCompletion: number 
}

// Emitted during construction progress
'buildProgress': { 
    building: Building, 
    progress: number, 
    remainingTime: number 
}

// Emitted when construction completes
'buildComplete': { 
    building: Building, 
    completionTime: number 
}

// Emitted if construction is cancelled
'buildCancelled': { 
    building: Building, 
    refund?: Record<string, number> 
}
```

### Example Usage
```typescript
// Create a basic building
const workshop = game.entities.createBuilding({
    name: 'Workshop',
    description: 'Basic crafting facility',
    buildTime: 5000,  // 5 seconds
    costs: [
        { resourceId: 'wood', amount: 10 },
        { resourceId: 'stone', amount: 5 }
    ],
    unlockCondition: () => wood.amount >= 5,
    tags: ['production', 'basic']
});

// Construction workflow
if (workshop.canAfford()) {
    if (workshop.startConstruction()) {
        console.log('Construction started');
    }
}

// Monitor construction
workshop.on('buildProgress', (data) => {
    updateBuildProgressBar(data.progress);
});

workshop.on('buildComplete', (data) => {
    console.log('Workshop completed!');
    // Building is now functional
});

// Check building state
console.log(workshop.isBuilt);      // true/false
console.log(workshop.isBuilding);   // true/false
console.log(workshop.buildProgress); // 0.0 - 1.0
```

---

## ⛏️ Miner

**File**: [`src/entities/buildings/miner.ts`](../../src/entities/buildings/miner.ts)

Specialized building that extracts resources automatically.

### Properties
```typescript
class Miner extends Building {
    readonly resourceId: string;        // Target resource to mine
    readonly gatherRate: number;        // Resources per second
    readonly efficiency: number;        // Efficiency multiplier
    readonly autoStart: boolean;        // Auto-start when built
    
    // Production state
    isProducing: boolean = false;       // Currently mining
    totalGathered: number = 0;          // Total resources mined
    lastGatherTime?: number;            // Last production time
}
```

### Core Methods

#### Production Control
```typescript
// Start mining production
startProduction(): boolean

// Stop mining production
stopProduction(): void

// Toggle production state
toggleProduction(): boolean

// Check if can start production
canProduce(): boolean
```

#### Production Information
```typescript
// Get effective gather rate (including modifiers)
getEffectiveGatherRate(): number

// Get production statistics
getProductionStats(): {
    isProducing: boolean;
    rate: number;
    efficiency: number;
    totalGathered: number;
    uptime: number;
}

// Check output capacity
hasCapacityForOutput(): boolean
```

#### Resource Integration
```typescript
// Get target resource reference
getTargetResource(): Resource | undefined

// Check if resource is available for mining
isResourceAvailable(): boolean
```

### Configuration
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
    efficiency?: number;            // Efficiency multiplier (default: 1.0)
    autoStart?: boolean;            // Auto-start production when built
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

### Events
```typescript
// Emitted when production starts
'productionStarted': { 
    miner: Miner, 
    resourceId: string 
}

// Emitted when production stops
'productionStopped': { 
    miner: Miner, 
    reason: string 
}

// Emitted when resources are gathered
'resourceGathered': { 
    miner: Miner, 
    resourceId: string, 
    amount: number 
}

// Emitted when production is blocked (capacity/availability)
'productionBlocked': { 
    miner: Miner, 
    reason: string 
}
```

### Example Usage
```typescript
// Create a gold mine
const goldMine = game.entities.createMiner({
    name: 'Gold Mine',
    resourceId: 'gold',
    gatherRate: 5.0,       // 5 gold per second
    buildTime: 3000,       // 3 seconds to build
    efficiency: 1.0,       // 100% efficiency
    autoStart: true,       // Start producing when built
    costs: [
        { resourceId: 'gold', amount: 50 },
        { resourceId: 'wood', amount: 20 }
    ],
    unlockCondition: () => gold.amount >= 25
});

// Production control
goldMine.startProduction();
goldMine.stopProduction();
goldMine.toggleProduction();

// Monitor production
goldMine.on('resourceGathered', (data) => {
    console.log(`Mined ${data.amount} ${data.resourceId}`);
});

goldMine.on('productionBlocked', (data) => {
    console.log(`Production blocked: ${data.reason}`);
});

// Get production info
const stats = goldMine.getProductionStats();
console.log(`Mining efficiency: ${stats.efficiency * 100}%`);
console.log(`Total gathered: ${stats.totalGathered}`);

// Check production capability
if (goldMine.canProduce()) {
    goldMine.startProduction();
}
```

---

## 🏭 Factory

**File**: [`src/entities/buildings/factory.ts`](../../src/entities/buildings/factory.ts)

Specialized building that transforms input resources into output resources.

### Properties
```typescript
class Factory extends Building {
    readonly inputs: Array<{            // Required input resources
        resourceId: string;
        amount: number;
    }>;
    readonly outputs: Array<{           // Produced output resources
        resourceId: string;
        amount: number;
    }>;
    readonly cycleTime: number;         // Time per production cycle (ms)
    readonly efficiency: number;        // Production efficiency multiplier
    
    // Production state
    isProducing: boolean = false;
    currentCycle?: ProductionCycle;     // Current production cycle
    cyclesCompleted: number = 0;        // Total cycles completed
}
```

### Core Methods

#### Production Control
```typescript
// Start factory production
startProduction(): boolean

// Stop factory production
stopProduction(): void

// Check if can start production cycle
canStartCycle(): boolean

// Process production cycle
processCycle(): boolean
```

#### Resource Management
```typescript
// Check input availability
checkInputAvailability(): boolean

// Check output capacity
checkOutputCapacity(): boolean

// Consume input resources
consumeInputs(): boolean

// Produce output resources
produceOutputs(): void
```

#### Production Information
```typescript
// Get production configuration
getProductionConfig(): {
    inputs: Array<{resourceId: string, amount: number}>;
    outputs: Array<{resourceId: string, amount: number}>;
    cycleTime: number;
    efficiency: number;
}

// Get production statistics
getProductionStats(): {
    isProducing: boolean;
    cyclesCompleted: number;
    efficiency: number;
    totalInputsConsumed: Record<string, number>;
    totalOutputsProduced: Record<string, number>;
}
```

### Configuration
```typescript
interface FactoryConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];
    cost?: Record<string, number>;
    buildTime?: number;
    inputs: Array<{                 // Required inputs per cycle
        resourceId: string;
        amount: number;
    }>;
    outputs: Array<{                // Produced outputs per cycle
        resourceId: string;
        amount: number;
    }>;
    cycleTime: number;              // Time per production cycle (ms)
    efficiency?: number;            // Production efficiency (default: 1.0)
    autoStart?: boolean;            // Auto-start when built
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

### Events
```typescript
// Emitted when production cycle starts
'cycleStarted': { 
    factory: Factory, 
    cycle: ProductionCycle 
}

// Emitted when production cycle completes
'cycleCompleted': { 
    factory: Factory, 
    inputs: Record<string, number>, 
    outputs: Record<string, number> 
}

// Emitted when production is blocked
'productionBlocked': { 
    factory: Factory, 
    reason: 'insufficient_inputs' | 'insufficient_capacity' 
}
```

### Example Usage
```typescript
// Create a bread factory
const bakery = game.entities.createFactory({
    name: 'Bakery',
    description: 'Converts wheat into bread',
    buildTime: 5000,
    cycleTime: 2000,        // 2 seconds per bread
    inputs: [
        { resourceId: 'wheat', amount: 2 },
        { resourceId: 'water', amount: 1 }
    ],
    outputs: [
        { resourceId: 'bread', amount: 1 }
    ],
    efficiency: 1.0,
    costs: [
        { resourceId: 'wood', amount: 50 },
        { resourceId: 'stone', amount: 30 }
    ]
});

// Production monitoring
bakery.on('cycleCompleted', (data) => {
    console.log('Produced bread:', data.outputs);
});

bakery.on('productionBlocked', (data) => {
    console.log('Production blocked:', data.reason);
});

// Control production
if (bakery.canStartCycle()) {
    bakery.startProduction();
}

// Get production information
const config = bakery.getProductionConfig();
console.log('Recipe:', config.inputs, '→', config.outputs);

const stats = bakery.getProductionStats();
console.log('Cycles completed:', stats.cyclesCompleted);
```

---

## 📦 Storage

**File**: [`src/entities/buildings/storage.ts`](../../src/entities/buildings/storage.ts)

Specialized building that provides storage capacity for resources.

### Properties
```typescript
class Storage extends Building {
    readonly capacities: Record<string, number>; // Resource capacities
    readonly isGlobal: boolean;                   // Affects all resources
    readonly storageEfficiency: number;           // Capacity multiplier
    
    // Storage statistics
    readonly totalCapacityProvided: number;       // Total capacity provided
    readonly utilizationStats: Record<string, {  // Usage statistics
        provided: number;
        used: number;
        utilization: number;
    }>;
}
```

### Core Methods

#### Capacity Management
```typescript
// Get capacity for specific resource
getCapacityFor(resourceId: string): number

// Get total capacity provided
getTotalCapacity(): number

// Get effective capacity (including modifiers)
getEffectiveCapacity(resourceId: string): number

// Check if provides capacity for resource
providesCapacityFor(resourceId: string): boolean
```

#### Storage Information
```typescript
// Get storage utilization
getUtilization(resourceId: string): number

// Get remaining capacity
getRemainingCapacity(resourceId: string): number

// Get storage statistics
getStorageStats(): {
    totalCapacity: number;
    totalUsed: number;
    utilization: number;
    resourceBreakdown: Record<string, {
        capacity: number;
        used: number;
        remaining: number;
        utilization: number;
    }>;
}

// Check if storage is full
isFull(resourceId?: string): boolean
```

#### Capacity Integration
```typescript
// Register with capacity manager
registerCapacity(): void

// Update capacity calculations
updateCapacity(): void

// Get capacity contribution to global pool
getCapacityContribution(): Record<string, number>
```

### Configuration
```typescript
interface StorageConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];
    cost?: Record<string, number>;
    buildTime?: number;
    capacities: Record<string, number>;  // Resource ID → capacity amount
    isGlobal?: boolean;                  // Provides capacity for all resources
    storageEfficiency?: number;          // Capacity multiplier (default: 1.0)
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

### Events
```typescript
// Emitted when storage capacity changes
'capacityChanged': { 
    storage: Storage, 
    resourceId: string, 
    newCapacity: number 
}

// Emitted when storage becomes full
'storageFull': { 
    storage: Storage, 
    resourceId: string 
}

// Emitted when storage utilization changes significantly
'utilizationChanged': { 
    storage: Storage, 
    resourceId: string, 
    utilization: number 
}
```

### Example Usage
```typescript
// Create a warehouse
const warehouse = game.entities.createStorage({
    name: 'Warehouse',
    description: 'Large storage facility',
    buildTime: 8000,
    capacities: {
        wood: 1000,
        stone: 500,
        iron: 200
    },
    storageEfficiency: 1.2,  // 20% bonus capacity
    costs: [
        { resourceId: 'wood', amount: 100 },
        { resourceId: 'stone', amount: 50 }
    ]
});

// Check capacity
console.log('Wood capacity:', warehouse.getCapacityFor('wood'));
console.log('Total capacity:', warehouse.getTotalCapacity());

// Monitor storage
warehouse.on('capacityChanged', (data) => {
    console.log(`Capacity changed for ${data.resourceId}: ${data.newCapacity}`);
});

warehouse.on('storageFull', (data) => {
    console.log(`Storage full for ${data.resourceId}`);
});

// Get storage statistics
const stats = warehouse.getStorageStats();
console.log('Storage utilization:', stats.utilization);
console.log('Resource breakdown:', stats.resourceBreakdown);

// Check specific utilization
const woodUtilization = warehouse.getUtilization('wood');
console.log(`Wood storage: ${woodUtilization * 100}% full`);
```

---

## ⬆️ Upgrade

**File**: [`src/core/upgrade.ts`](../../src/core/upgrade.ts)

Represents permanent improvements that can be purchased to enhance entities or game mechanics.

### Properties
```typescript
class Upgrade extends BaseEntity {
    readonly costs: CostDefinition[];      // Purchase costs
    readonly effect: UpgradeEffect;        // Effect definition
    readonly isRepeatable: boolean;        // Can be purchased multiple times
    readonly maxLevel?: number;            // Maximum purchase level
    
    isPurchased: boolean = false;          // Has been purchased
    currentLevel: number = 0;              // Current purchase level
    totalSpent: Record<string, number> = {}; // Total resources spent
}
```

### Core Methods

#### Purchase Management
```typescript
// Purchase the upgrade
purchase(): boolean

// Check if can afford upgrade
canAfford(): boolean

// Get current purchase cost (may scale with level)
getCurrentCost(): CostDefinition[]

// Check if can be purchased
canPurchase(): boolean
```

#### Effect Management
```typescript
// Apply upgrade effect
applyEffect(): void

// Remove upgrade effect (if reversible)
removeEffect(): void

// Get effect description
getEffectDescription(): string

// Check if effect is active
isEffectActive(): boolean
```

#### Level Management (for repeatable upgrades)
```typescript
// Get next level cost
getNextLevelCost(): CostDefinition[]

// Purchase next level
purchaseNextLevel(): boolean

// Get level-based effect value
getLevelEffectValue(): number

// Check if at maximum level
isMaxLevel(): boolean
```

### Configuration
```typescript
interface UpgradeConfig {
    id?: string;
    name: string;
    description?: string;
    costs: CostDefinition[];            // Purchase costs
    effect: UpgradeEffectDefinition;    // Effect to apply
    isRepeatable?: boolean;             // Can purchase multiple times
    maxLevel?: number;                  // Maximum level (for repeatable)
    costScaling?: {                     // Cost scaling for levels
        type: 'linear' | 'exponential' | 'custom';
        factor: number;
        customFunction?: (level: number) => number;
    };
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

### Effect Types
```typescript
// Property modifier effect
interface PropertyModifierEffect {
    type: 'property_modifier';
    target: {
        entityType?: string;        // Target entity type
        entityName?: string;        // Specific entity name
        entityId?: string;          // Specific entity ID
        tags?: string[];           // Entities with specific tags
    };
    property: string;              // Property to modify
    operation: 'add' | 'multiply' | 'set';
    value: number;                 // Modification value
}

// Custom callback effect
interface CustomEffect {
    type: 'custom';
    callback: () => void;          // Custom effect function
    reverseCallback?: () => void;  // Reverse effect (for refunds)
}

// Global modifier effect
interface GlobalModifierEffect {
    type: 'global_modifier';
    modifier: string;              // Global modifier name
    value: number;                 // Modifier value
}
```

### Events
```typescript
// Emitted when upgrade is purchased
'upgradePurchased': { 
    upgrade: Upgrade, 
    level: number, 
    cost: Record<string, number> 
}

// Emitted when upgrade effect is applied
'effectApplied': { 
    upgrade: Upgrade, 
    target: BaseEntity | 'global', 
    effect: UpgradeEffect 
}

// Emitted when upgrade is refunded (if supported)
'upgradeRefunded': { 
    upgrade: Upgrade, 
    refund: Record<string, number> 
}
```

### Example Usage
```typescript
// Create a simple upgrade
const efficiency = game.entities.createUpgrade({
    name: 'Mining Efficiency',
    description: 'Increases all miner output by 50%',
    costs: [
        { resourceId: 'gold', amount: 500 },
        { resourceId: 'research', amount: 10 }
    ],
    effect: {
        type: 'property_modifier',
        target: { entityType: 'Miner' },
        property: 'gatherRate',
        operation: 'multiply',
        value: 1.5
    },
    unlockCondition: () => totalMiners >= 5
});

// Purchase upgrade
if (efficiency.canAfford()) {
    if (efficiency.purchase()) {
        console.log('Upgrade purchased successfully!');
    }
}

// Create repeatable upgrade
const clickPower = game.entities.createUpgrade({
    name: 'Click Power',
    description: 'Increases manual click power',
    costs: [{ resourceId: 'gold', amount: 100 }],
    effect: {
        type: 'custom',
        callback: () => {
            // Custom effect implementation
            game.clickPower *= 1.1;
        }
    },
    isRepeatable: true,
    maxLevel: 50,
    costScaling: {
        type: 'exponential',
        factor: 1.15
    }
});

// Purchase levels
while (clickPower.canPurchase() && clickPower.currentLevel < 10) {
    clickPower.purchaseNextLevel();
}

// Monitor upgrades
game.events.on('upgradePurchased', (data) => {
    console.log(`Purchased ${data.upgrade.name} level ${data.level}`);
    updateUpgradeDisplay();
});
```

---

## 👷 Worker

**File**: [`src/entities/workers/worker.ts`](../../src/entities/workers/worker.ts)

Represents autonomous units that can be assigned to various tasks.

### Properties
```typescript
class Worker extends BaseEntity {
    readonly efficiency: number;           // Work efficiency multiplier
    readonly skills: string[];             // Available skills/tasks
    readonly maintenanceCost: Record<string, number>; // Upkeep costs
    
    isAssigned: boolean = false;           // Currently assigned to task
    currentTask?: WorkerTask;              // Current assignment
    assignedBuilding?: string;             // Assigned building ID
    totalWorkTime: number = 0;             // Total time worked
}
```

### Core Methods

#### Task Management
```typescript
// Assign worker to building
assignToBuilding(buildingId: string): boolean

// Assign worker to specific task
assignToTask(task: WorkerTask): boolean

// Unassign worker
unassign(): void

// Check if can perform task
canPerformTask(task: WorkerTask): boolean
```

#### Work Operations
```typescript
// Get work efficiency for task
getEfficiencyForTask(task: string): number

// Update work progress
updateWork(deltaTime: number): void

// Get work statistics
getWorkStats(): {
    isAssigned: boolean;
    currentTask?: string;
    efficiency: number;
    totalWorkTime: number;
    tasksCompleted: number;
}
```

#### Maintenance
```typescript
// Get maintenance cost
getMaintenanceCost(): Record<string, number>

// Pay maintenance (called periodically)
payMaintenance(): boolean

// Check if maintenance is due
isMaintenanceDue(): boolean
```

### Configuration
```typescript
interface WorkerConfig {
    id?: string;
    name: string;
    description?: string;
    efficiency?: number;               // Work efficiency (default: 1.0)
    skills?: string[];                 // Available skills
    maintenanceCost?: Record<string, number>; // Upkeep costs
    hireCost?: Record<string, number>; // Cost to hire
    unlockCondition?: () => boolean;
    tags?: string[];
}
```

### Example Usage
```typescript
// Create a worker
const miner = game.entities.createWorker({
    name: 'Experienced Miner',
    description: 'Skilled in resource extraction',
    efficiency: 1.25,
    skills: ['mining', 'geology'],
    maintenanceCost: {
        food: 1,    // 1 food per hour
        gold: 0.5   // 0.5 gold per hour
    },
    hireCost: {
        gold: 100
    }
});

// Assign to building
const goldMine = game.entities.getBuildings()
    .find(b => b.name === 'Gold Mine');

if (goldMine && miner.assignToBuilding(goldMine.id)) {
    console.log('Miner assigned to gold mine');
}

// Monitor work
miner.on('taskCompleted', (data) => {
    console.log(`Task completed: ${data.task}`);
});

// Check work stats
const stats = miner.getWorkStats();
console.log(`Efficiency: ${stats.efficiency * 100}%`);
console.log(`Total work time: ${stats.totalWorkTime}s`);
```

---

## 🔧 Entity Utilities

### Entity Factory Methods

All entities can be created through the EntityService factory methods:

```typescript
// Direct creation through game.entities
const resource = game.entities.createResource(config);
const building = game.entities.createBuilding(config);
const miner = game.entities.createMiner(config);
const storage = game.entities.createStorage(config);
const upgrade = game.entities.createUpgrade(config);
const worker = game.entities.createWorker(config);

// Generic creation
const entity = game.entities.createEntity(EntityClass, config);
```

### Entity Querying

```typescript
// Get all entities
const allEntities = game.entities.getAllEntities();

// Get by type
const resources = game.entities.getResources();
const buildings = game.entities.getBuildings();
const upgrades = game.entities.getUpgrades();

// Get by ID
const entity = game.entities.getEntityById('entity-id');
const resource = game.entities.getResourceById('gold');

// Get by name
const goldResource = game.entities.getResourceByName('Gold');

// Get statistics
const stats = game.entities.getEntityStats();
console.log(`Total entities: ${stats.total}`);
console.log(`Unlocked entities: ${stats.unlocked}`);
```

### Entity Events

All entities inherit from BaseEntity and support event handling:

```typescript
// Listen for entity events
entity.on('unlocked', () => {
    console.log(`${entity.name} is now available!`);
});

// Game-wide entity events
game.events.on('entityAdded', (data) => {
    console.log(`Added ${data.entity.name}`);
});

game.events.on('entityRemoved', (data) => {
    console.log(`Removed ${data.entity.name}`);
});
```

---

*Next: [Type Definitions](./types.md) - Complete TypeScript interface reference*