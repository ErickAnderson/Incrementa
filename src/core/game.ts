import { Building, Resource, Storage, Miner } from "../entities";
import { Upgrade } from "./upgrade";
import { SaveManager } from "./save-manager";
import { BaseEntity } from "./base-entity";
import { Timer } from "./timer";
import { UnlockManager } from "./unlock-manager";
import { EventManager, EventStats } from "./event-manager";
import { CostSystem } from "./cost-system";
import { UpgradeEffectProcessor } from "./upgrade-effect-processor";
import { ProductionManager } from "./production-manager";
import { CapacityManager } from "./capacity-manager";
import { EntityRegistry } from "./entity-registry";
import { PluginSystem } from "./plugin-system";
import { EventBatchingSystem } from "./event-batching-system";
import { PerformanceMonitor } from "./performance-monitor";
import { logger } from "../utils/logger";
import { GAME_CONSTANTS } from "../utils/constants";
import type { CostDefinition } from "../types/cost-definition";
import { IGame } from "./game-aware";
/**
 * Game class that manages the entire game state and core loop functionality.
 */
export class Game implements IGame {
    /** Entity registry for managing all entities */
    private entityRegistry: EntityRegistry;
    
    /** Production optimization and coordination manager */
    private productionManager: ProductionManager;
    
    /** Capacity and storage management system */
    private capacityManager: CapacityManager;
    
    /** Plugin system for extensibility */
    public pluginSystem: PluginSystem;
    
    /** Event batching system for performance optimization */
    private eventBatchingSystem: EventBatchingSystem;
    
    /** Performance monitoring system */
    public performanceMonitor: PerformanceMonitor;
    
    /** Timestamp of the last game update */
    private lastUpdate: number;
    
    /** Flag indicating if the game loop is running */
    private isRunning: boolean;

    /** Main game timer for the game loop */
    private gameTimer: Timer;

    /** Collection of additional timers for specific game mechanics */
    private timers: Map<string, Timer>;

    /** Game speed multiplier */
    private gameSpeed: number;

    /** Total time the game has been running (in milliseconds) */
    private totalGameTime: number;

    /** Centralized unlock condition manager */
    private unlockManager: UnlockManager;

    /** Global event coordination manager */
    private eventManager: EventManager;

    /** Cost validation and resource spending system */
    public costSystem: CostSystem;

    /** Upgrade effect processing and application system */
    public upgradeEffectProcessor: UpgradeEffectProcessor;

    private saveManager: SaveManager;

    /**
     * Creates a new Game instance and initializes empty collections
     */
    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
        this.lastUpdate = Date.now();
        this.isRunning = false;
        this.timers = new Map();
        this.gameSpeed = 1.0;
        this.totalGameTime = 0;
        
        // Initialize core managers
        this.eventManager = new EventManager();
        this.entityRegistry = new EntityRegistry(this.eventManager);
        this.productionManager = new ProductionManager(this.eventManager);
        this.capacityManager = new CapacityManager(this.eventManager);
        
        // Initialize game systems
        this.unlockManager = new UnlockManager(this);
        this.costSystem = new CostSystem(this);
        this.upgradeEffectProcessor = new UpgradeEffectProcessor(this);
        this.pluginSystem = new PluginSystem(this, this.eventManager);
        
        // Initialize performance systems
        this.eventBatchingSystem = new EventBatchingSystem(this.eventManager, {
            batchedTypes: ['resourceChanged', 'buildProgress', 'capacityChanged'],
            excludedTypes: ['gameDestroyed', 'gamePaused', 'gameResumed', 'buildComplete']
        });
        this.performanceMonitor = new PerformanceMonitor(this.eventManager, {
            enabled: false // Disabled by default, can be enabled via config
        });
        
        // Initialize main game timer
        this.gameTimer = new Timer({
            totalTime: Number.MAX_SAFE_INTEGER, // Effectively infinite for main loop
            tickRate: GAME_CONSTANTS.DEFAULT_TICK_RATE, // ~60 FPS
            onUpdateCallbacks: [() => this.gameLoop()],
            conditionCallback: () => this.isRunning
        });
    }

    /**
     * Returns all current resources in the game.
     * @returns {Resource[]} Array of all game resources
     */
    getCurrentResources(): Resource[] {
        return this.entityRegistry.getResources();
    }

    /**
     * Returns all current buildings in the game.
     * @returns {Building[]} Array of all game buildings
     */
    getCurrentBuildings(): Building[] {
        return this.entityRegistry.getBuildings();
    }

    /**
     * Returns all current upgrades in the game.
     * @returns {Upgrade[]} Array of all game upgrades
     */
    getCurrentUpgrades(): Upgrade[] {
        return this.entityRegistry.getUpgrades();
    }

    /**
     * Returns all current storage buildings and their status.
     * @returns {Storage[]} Array of all storage buildings
     */
    getStorageStatus(): Storage[] {
        return this.entityRegistry.getStorages();
    }

    /**
     * Adds an entity to the game and registers it for updates
     * @param entity - The entity to add
     */
    addEntity(entity: BaseEntity): void {
        // Register with entity registry
        const result = this.entityRegistry.registerEntity(entity, this);
        if (!result.success) {
            logger.error(`Game: Failed to add entity ${entity.name}: ${result.error}`);
            return;
        }
        
        // Register with event manager
        this.eventManager.registerEntity(entity);
        this.eventManager.routeEntityEvents(entity);
        
        // Set up production optimization for building completion events
        if (entity instanceof Building) {
            entity.on('buildComplete', () => {
                // When a building completes construction, optimize production
                Promise.resolve().then(() => {
                    const optimizationResult = this.optimizeProduction();
                    if (optimizationResult.started > 0) {
                        logger.info(`Building completion triggered production optimization: ${optimizationResult.started} producers started`);
                    }
                });
            });
            
            // Invalidate capacity cache when storage buildings are added
            if (entity instanceof Storage) {
                this.capacityManager.invalidateCache();
                logger.info(`Game: Storage '${entity.name}' added - capacity cache invalidated`);
                
                // Optimize production when storage capacity changes
                Promise.resolve().then(() => {
                    const optimizationResult = this.optimizeProduction();
                    if (optimizationResult.started > 0) {
                        logger.info(`Storage addition triggered production resumption: ${optimizationResult.started} producers restarted`);
                    }
                });
            }
        }
        
        // Register unlock condition if entity has one and isn't already unlocked
        const unlockCondition = entity.getUnlockCondition();
        if (unlockCondition && !entity.isUnlocked) {
            this.unlockManager.registerUnlockCondition(entity, unlockCondition);
        }
        
        // Emit entity added event
        this.eventManager.emit('entityAdded', { entity });
        
        logger.info(`Entity ${entity.name} (${entity.id}) added to game`);
    }

    /**
     * Removes an entity from the game
     * @param entityId - The ID of the entity to remove
     * @returns Whether the entity was successfully removed
     */
    removeEntity(entityId: string): boolean {
        const entity = this.entityRegistry.getEntityById(entityId);
        if (!entity) {
            return false;
        }

        // Emit entity removal event before cleanup
        this.eventManager.emit('entityRemoved', { entity });

        // Unregister from managers
        this.eventManager.unregisterEntity(entityId);
        this.unlockManager.removeUnlockCondition(entityId);

        // Invalidate capacity cache if removing storage
        if (entity instanceof Storage) {
            this.capacityManager.invalidateCache();
            logger.info(`Game: Storage '${entity.name}' removed - capacity cache invalidated`);
        }

        // Remove from entity registry
        const success = this.entityRegistry.unregisterEntity(entityId);
        if (success) {
            logger.info(`Entity ${entity.name} (${entityId}) removed from game`);
        }
        return true;
    }

    /**
     * Gets an entity by its ID
     * @param entityId - The ID of the entity to retrieve
     * @returns The entity if found, undefined otherwise
     */
    getEntityById(entityId: string): BaseEntity | undefined {
        return this.entityRegistry.getEntityById(entityId);
    }

    /**
     * Gets a resource by its ID
     * @param resourceId - The ID of the resource to retrieve
     * @returns The resource if found, undefined otherwise
     */
    getResourceById(resourceId: string): Resource | undefined {
        const entity = this.entityRegistry.getEntityById(resourceId);
        return entity instanceof Resource ? entity : undefined;
    }

    /**
     * Gets a resource by its name (for backward compatibility)
     * @param name - The name of the resource to retrieve
     * @returns The resource if found, undefined otherwise
     */
    getResourceByName(name: string): Resource | undefined {
        return this.entityRegistry.getResources().find(r => r.name === name);
    }

    /**
     * Factory method to create and register a new resource
     * @param config - Resource configuration
     * @returns The created resource
     */
    createResource(config: {
        id?: string;
        name: string;
        description?: string;
        initialAmount?: number;
        rate?: number;
        basePassiveRate?: number;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Resource {
        const resource = new Resource(config);
        this.addEntity(resource);
        return resource;
    }

    /**
     * Factory method to create and register a new building
     * @param config - Building configuration
     * @returns The created building
     */
    createBuilding(config: {
        id?: string;
        name: string;
        description?: string;
        costs?: CostDefinition[];
        cost?: Record<string, number>; // Legacy support
        buildTime?: number;
        productionRate?: number;
        level?: number;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Building {
        const building = new Building(config);
        building.setGameReference(this);
        this.addEntity(building);
        return building;
    }

    /**
     * Factory method to create and register a new miner building
     * @param config - Miner configuration
     * @returns The created miner building
     */
    createMiner(config: {
        id?: string;
        name: string;
        description?: string;
        costs?: CostDefinition[];
        cost?: Record<string, number>; // Legacy support
        buildTime?: number;
        gatherRate: number;
        resourceId: string;
        unlockCondition?: () => boolean;
        tags?: string[];
        efficiency?: number;
        autoStart?: boolean;
    }): Miner {
        const miner = new Miner(config);
        miner.setGameReference(this);
        this.addEntity(miner);
        return miner;
    }

    /**
     * Factory method to create and register a new storage building
     * @param config - Storage configuration
     * @returns The created storage building
     */
    createStorage(config: {
        id?: string;
        name: string;
        description?: string;
        costs?: CostDefinition[];
        cost?: Record<string, number>; // Legacy support
        buildTime?: number;
        capacities?: Record<string, number>;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Storage {
        const storage = new Storage(config);
        storage.setGameReference(this);
        
        // Log storage creation with capacity info
        const capacityInfo = config.capacities 
            ? Object.entries(config.capacities).map(([id, cap]) => `${id}:${cap}`).join(', ')
            : 'no capacities defined';
        logger.info(`Game: Creating storage '${config.name}' with capacities: ${capacityInfo}`);
        
        this.addEntity(storage);
        return storage;
    }

    /**
     * Factory method to create and register a new upgrade
     * @param config - Upgrade configuration
     * @returns The created upgrade
     */
    createUpgrade(config: {
        id?: string;
        name: string;
        description?: string;
        effect?: Record<string, unknown>;
        costs?: CostDefinition[];
        cost?: Record<string, number>; // Legacy support
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Upgrade {
        const upgrade = new Upgrade(config);
        upgrade.setGameReference(this);
        this.addEntity(upgrade);
        return upgrade;
    }

    /**
     * Generic factory method to create and register any entity type
     * @param EntityClass - The entity class constructor
     * @param config - Entity configuration
     * @returns The created entity
     */
    createEntity<T extends BaseEntity>(EntityClass: new (config: Record<string, unknown>) => T, config: Record<string, unknown>): T {
        const entity = new EntityClass(config);
        this.addEntity(entity);
        return entity;
    }

    /**
     * Gets the current game time
     * @returns Current timestamp
     */
    getCurrentTime(): number {
        return Date.now();
    }

    /**
     * Adds a timer to the game for specific mechanics
     * @param id - Unique identifier for the timer
     * @param timer - Timer instance to add
     */
    addTimer(id: string, timer: Timer): void {
        if (this.timers.has(id)) {
            logger.warn(`Timer with id '${id}' already exists. Replacing.`);
        }
        this.timers.set(id, timer);
        logger.info(`Timer '${id}' added to game`);
    }

    /**
     * Removes a timer from the game
     * @param id - Identifier of the timer to remove
     * @returns Whether the timer was successfully removed
     */
    removeTimer(id: string): boolean {
        const timer = this.timers.get(id);
        if (timer) {
            timer.stop();
            this.timers.delete(id);
            logger.info(`Timer '${id}' removed from game`);
            return true;
        }
        return false;
    }

    /**
     * Gets a timer by its ID
     * @param id - Identifier of the timer to retrieve
     * @returns The timer if found, undefined otherwise
     */
    getTimer(id: string): Timer | undefined {
        return this.timers.get(id);
    }

    /**
     * Pauses all timers in the game
     */
    pauseTimers(): void {
        this.gameTimer.toggle();
        for (const timer of this.timers.values()) {
            if (timer.getIsRunning() && !timer.getIsPaused()) {
                timer.toggle();
            }
        }
        logger.info('All timers paused');
    }

    /**
     * Resumes all paused timers in the game
     */
    resumeTimers(): void {
        if (this.isRunning && this.gameTimer.getIsPaused()) {
            this.gameTimer.toggle();
        }
        for (const timer of this.timers.values()) {
            if (timer.getIsRunning() && timer.getIsPaused()) {
                timer.toggle();
            }
        }
        logger.info('All timers resumed');
    }

    /**
     * Sets the game speed multiplier
     * @param speed - Speed multiplier (1.0 = normal speed)
     */
    setGameSpeed(speed: number): void {
        if (speed <= 0) {
            throw new Error('Game speed must be greater than 0');
        }
        this.gameSpeed = speed;
        logger.info(`Game speed set to ${speed}x`);
    }

    /**
     * Gets the current game speed multiplier
     * @returns Current game speed
     */
    getGameSpeed(): number {
        return this.gameSpeed;
    }

    /**
     * Gets whether the game is currently running
     * @returns True if the game loop is active
     */
    isGameRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Gets the unlock manager instance
     * @returns UnlockManager instance
     */
    getUnlockManager(): UnlockManager {
        return this.unlockManager;
    }

    /**
     * Gets the event manager instance
     * @returns EventManager instance
     */
    getEventManager(): EventManager {
        return this.eventManager;
    }

    /**
     * Gets event statistics from the event manager
     * @returns Event statistics object
     */
    getEventStats(): EventStats {
        return this.eventManager.getEventStats();
    }

    /**
     * Gets unlock statistics from the unlock manager
     * @returns Unlock statistics object
     */
    getUnlockStats() {
        return this.unlockManager.getStats();
    }

    /**
     * Manually checks all unlock conditions
     * This is automatically called during game updates, but can be called manually for testing
     */
    checkUnlockConditions(): void {
        this.unlockManager.checkUnlockConditions();
    }

    /**
     * Manually unlocks an entity (bypasses condition check)
     * @param entityId - ID of the entity to unlock
     * @returns Whether the entity was successfully unlocked
     */
    unlockEntity(entityId: string): boolean {
        // First try the unlock manager (for entities with conditions)
        const unlockManagerResult = this.unlockManager.unlockEntity(entityId);
        if (unlockManagerResult) {
            return true;
        }

        // If that fails, try to find and unlock the entity directly
        const entity = this.getEntityById(entityId);
        if (entity && !entity.isUnlocked) {
            // For manual unlock, directly set the unlocked state bypassing conditions
            entity.isUnlocked = true;
            entity.onUnlock();
            entity.emit('unlocked', { entity });
            logger.info(`Entity ${entity.name} (${entity.id}) manually unlocked`);
            return true;
        }

        return false;
    }

    /**
     * Adds a global event listener
     * @param eventName - Name of the event to listen for
     * @param callback - Function to call when event is emitted
     */
    on(eventName: string, callback: (...args: unknown[]) => void): void {
        this.eventManager.on(eventName, callback);
    }

    /**
     * Removes a global event listener
     * @param eventName - Name of the event
     * @param callback - The callback function to remove
     * @returns Whether the listener was successfully removed
     */
    off(eventName: string, callback: (...args: unknown[]) => void): boolean {
        return this.eventManager.off(eventName, callback);
    }

    /**
     * Emits a global event
     * @param eventName - Name of the event to emit
     * @param data - Optional data to pass with the event
     */
    emit(eventName: string, data?: unknown): void {
        this.eventManager.emit(eventName, data);
    }

    /**
     * Gets total capacity for a resource across all storage buildings
     * @param resourceId - The ID of the resource
     * @returns Total capacity limit for the resource
     */
    getTotalCapacityFor(resourceId: string): number {
        return this.capacityManager.getTotalCapacityFor(resourceId, this.entityRegistry.getStorages());
    }

    /**
     * Checks if there is sufficient capacity across all storage buildings for a resource amount
     * @param resourceId - The ID of the resource
     * @param amount - The amount to check
     * @returns Whether there is sufficient capacity
     */
    hasGlobalCapacity(resourceId: string, amount: number): boolean {
        const resource = this.getResourceById(resourceId);
        const currentAmount = resource?.amount || 0;
        return this.capacityManager.hasGlobalCapacity(resourceId, amount, currentAmount, this.entityRegistry.getStorages());
    }

    /**
     * Gets remaining capacity for a resource across all storage buildings
     * @param resourceId - The ID of the resource
     * @returns Remaining capacity for the resource
     */
    getRemainingCapacityFor(resourceId: string): number {
        const resource = this.getResourceById(resourceId);
        const currentAmount = resource?.amount || 0;
        return this.capacityManager.getRemainingCapacityFor(resourceId, currentAmount, this.entityRegistry.getStorages());
    }

    // Production Management Methods

    /**
     * Starts production for all producer buildings that can produce
     * @returns Array of buildings that started production
     */
    startAllProduction(): BaseEntity[] {
        const startedBuildings: BaseEntity[] = [];
        
        for (const entity of this.entityRegistry.getAllEntities()) {
            if (entity.isUnlocked && 'startProduction' in entity && 'canProduce' in entity) {
                const producer = entity as Record<string, unknown> & BaseEntity;
                if (typeof producer.canProduce === 'function' && !producer.isCurrentlyProducing()) {
                    if (typeof producer.startProduction === 'function' && producer.startProduction()) {
                        startedBuildings.push(entity);
                    }
                }
            }
        }
        
        logger.info(`Started production for ${startedBuildings.length} buildings`);
        return startedBuildings;
    }

    /**
     * Stops production for all producer buildings
     * @returns Array of buildings that stopped production
     */
    stopAllProduction(): BaseEntity[] {
        const stoppedBuildings: BaseEntity[] = [];
        
        for (const entity of this.entityRegistry.getAllEntities()) {
            if (entity.isUnlocked && 'stopProduction' in entity && 'isCurrentlyProducing' in entity) {
                const producer = entity as Record<string, unknown> & BaseEntity;
                if (typeof producer.isCurrentlyProducing === 'function' && producer.isCurrentlyProducing()) {
                    if (typeof producer.stopProduction === 'function') {
                        producer.stopProduction();
                        stoppedBuildings.push(entity);
                    }
                }
            }
        }
        
        logger.info(`Stopped production for ${stoppedBuildings.length} buildings`);
        return stoppedBuildings;
    }

    /**
     * Gets all producer buildings in the game
     * @returns Array of producer building entities
     */
    getProducerBuildings(): BaseEntity[] {
        const producers: BaseEntity[] = [];
        
        for (const entity of this.entityRegistry.getAllEntities()) {
            if ('startProduction' in entity && 'stopProduction' in entity) {
                producers.push(entity);
            }
        }
        
        return producers;
    }

    /**
     * Gets all currently producing buildings
     * @returns Array of buildings that are actively producing
     */
    getActiveProducers(): BaseEntity[] {
        const activeProducers: BaseEntity[] = [];
        
        for (const entity of this.entityRegistry.getAllEntities()) {
            if (entity.isUnlocked && 'isCurrentlyProducing' in entity) {
                const producer = entity as Record<string, unknown> & BaseEntity;
                if (typeof producer.isCurrentlyProducing === 'function' && producer.isCurrentlyProducing()) {
                    activeProducers.push(entity);
                }
            }
        }
        
        return activeProducers;
    }

    /**
     * Gets production statistics across all producer buildings
     * @returns Aggregated production statistics
     */
    getGlobalProductionStats(): {
        totalProducers: number;
        activeProducers: number;
        totalCyclesCompleted: number;
        averageEfficiency: number;
        resourceProductionRates: Record<string, number>;
        resourceConsumptionRates: Record<string, number>;
    } {
        const producers = this.getProducerBuildings();
        const activeProducers = this.getActiveProducers();
        
        let totalCycles = 0;
        let totalEfficiency = 0;
        let efficiencyCount = 0;
        const productionRates: Record<string, number> = {};
        const consumptionRates: Record<string, number> = {};
        
        for (const entity of producers) {
            if ('getProductionStats' in entity) {
                const producer = entity as Record<string, unknown> & BaseEntity;
                const stats = typeof producer.getProductionStats === 'function' ? producer.getProductionStats() : {};
                
                totalCycles += stats.totalCycles || 0;
                
                if (stats.averageEfficiency !== undefined) {
                    totalEfficiency += stats.averageEfficiency;
                    efficiencyCount++;
                }
                
                // Aggregate production rates
                if (stats.productionRates) {
                    for (const [resourceId, rate] of Object.entries(stats.productionRates)) {
                        productionRates[resourceId] = (productionRates[resourceId] || 0) + (rate as number);
                    }
                }
                
                // Aggregate consumption rates
                if (stats.consumptionRates) {
                    for (const [resourceId, rate] of Object.entries(stats.consumptionRates)) {
                        consumptionRates[resourceId] = (consumptionRates[resourceId] || 0) + (rate as number);
                    }
                }
            }
        }
        
        return {
            totalProducers: producers.length,
            activeProducers: activeProducers.length,
            totalCyclesCompleted: totalCycles,
            averageEfficiency: efficiencyCount > 0 ? totalEfficiency / efficiencyCount : 0,
            resourceProductionRates: productionRates,
            resourceConsumptionRates: consumptionRates
        };
    }

    /**
     * Checks resource availability for a specific production requirement
     * @param inputs - Array of resource requirements
     * @returns Whether all input resources are available
     */
    checkResourceAvailability(inputs: Array<{resourceId: string, amount: number}>): boolean {
        return inputs.every(input => {
            const resource = this.getResourceById(input.resourceId);
            return resource && resource.amount >= input.amount;
        });
    }

    /**
     * Checks production capacity for a specific output
     * @param outputs - Array of resource outputs
     * @returns Whether all outputs can be stored
     */
    checkProductionCapacity(outputs: Array<{resourceId: string, amount: number}>): boolean {
        return outputs.every(output => {
            return this.hasGlobalCapacity(output.resourceId, output.amount);
        });
    }

    /**
     * Gets production bottlenecks - resources that are limiting production
     * @returns Object describing current production bottlenecks
     */
    getProductionBottlenecks(): {
        resourceShortages: Array<{resourceId: string, required: number, available: number}>;
        capacityLimits: Array<{resourceId: string, attempted: number, capacity: number}>;
        stoppedProducers: Array<{entityId: string, name: string, reason: string}>;
    } {
        const resourceShortages: Array<{resourceId: string, required: number, available: number}> = [];
        const capacityLimits: Array<{resourceId: string, attempted: number, capacity: number}> = [];
        const stoppedProducers: Array<{entityId: string, name: string, reason: string}> = [];
        
        for (const entity of this.getProducerBuildings()) {
            if (!entity.isUnlocked) continue;
            
            const producer = entity as Record<string, unknown> & BaseEntity;
            
            // Check if producer should be active but isn't
            if ('canProduce' in producer && 'isCurrentlyProducing' in producer) {
                const canProduce = typeof producer.canProduce === 'function' ? producer.canProduce() : false;
                const isProducing = typeof producer.isCurrentlyProducing === 'function' ? producer.isCurrentlyProducing() : false;
                if (!isProducing && !canProduce) {
                    let reason = 'Unknown';
                    
                    // Check for input shortages
                    if ('getProductionInputs' in producer) {
                        const inputs = typeof producer.getProductionInputs === 'function' ? producer.getProductionInputs() : [];
                        for (const input of inputs) {
                            const resource = this.getResourceById(input.resourceId);
                            const available = resource?.amount || 0;
                            if (available < input.amount) {
                                resourceShortages.push({
                                    resourceId: input.resourceId,
                                    required: input.amount,
                                    available
                                });
                                reason = `Insufficient ${input.resourceId}`;
                            }
                        }
                    }
                    
                    // Check for capacity limits
                    if ('getProductionOutputs' in producer) {
                        const outputs = typeof producer.getProductionOutputs === 'function' ? producer.getProductionOutputs() : [];
                        for (const output of outputs) {
                            if (!this.hasGlobalCapacity(output.resourceId, output.amount)) {
                                const capacity = this.getTotalCapacityFor(output.resourceId);
                                capacityLimits.push({
                                    resourceId: output.resourceId,
                                    attempted: output.amount,
                                    capacity
                                });
                                reason = `Capacity limit for ${output.resourceId}`;
                            }
                        }
                    }
                    
                    stoppedProducers.push({
                        entityId: entity.id,
                        name: entity.name,
                        reason
                    });
                }
            }
        }
        
        return {
            resourceShortages,
            capacityLimits,
            stoppedProducers
        };
    }

    /**
     * Optimizes production by starting/stopping producers based on resource availability
     * @returns Summary of optimization actions taken
     */
    optimizeProduction(): {
        started: number;
        stopped: number;
        bottlenecks: string[];
    } {
        return this.productionManager.optimizeProduction(
            this.entityRegistry.getBuildings(),
            (id) => this.getResourceById(id),
            (resourceId, amount) => this.hasGlobalCapacity(resourceId, amount)
        );
    }

    /**
     * Saves the current game state to persistent storage.
     * Serializes entities, resources, and game configuration to the save manager.
     * @returns {void}
     */
    saveState(): void {
        try {
            const gameState = {
                entities: this.entityRegistry.getAllEntities().map((entity) => ({
                    id: entity.id,
                    type: entity.constructor.name,
                    isUnlocked: entity.isUnlocked,
                    // Add other serializable properties as needed
                })),
                resources: this.entityRegistry.getResources().map(resource => ({
                    id: resource.id,
                    amount: resource.amount,
                    isUnlocked: resource.isUnlocked
                })),
                gameSpeed: this.gameSpeed,
                totalGameTime: this.totalGameTime,
                plugins: this.pluginSystem.getPluginSaveData()
            };
            
            this.saveManager.saveData('gameState', JSON.stringify(gameState));
            logger.info("Game state saved successfully.");
        } catch (error) {
            logger.error(`Failed to save game state: ${error}`);
        }
    }

    /**
     * Loads the previously saved game state from persistent storage.
     * Deserializes and restores entities, resources, and game configuration.
     * @returns {void}
     */
    loadState(): void {
        try {
            const savedData = this.saveManager.loadData('gameState');
            if (!savedData) {
                logger.info("No saved game state found.");
                return;
            }
            
            const gameState = JSON.parse(savedData);
            
            // Restore game properties
            if (gameState.gameSpeed !== undefined) {
                this.gameSpeed = gameState.gameSpeed;
            }
            if (gameState.totalGameTime !== undefined) {
                this.totalGameTime = gameState.totalGameTime;
            }
            
            // Restore resource amounts and unlock states
            if (gameState.resources) {
                for (const savedResource of gameState.resources) {
                    const resource = this.getResourceById(savedResource.id);
                    if (resource) {
                        resource.amount = savedResource.amount;
                        resource.isUnlocked = savedResource.isUnlocked;
                    }
                }
            }
            
            // Restore entity unlock states
            if (gameState.entities) {
                for (const savedEntity of gameState.entities) {
                    const entity = this.getEntityById(savedEntity.id);
                    if (entity) {
                        entity.isUnlocked = savedEntity.isUnlocked;
                    }
                }
            }
            
            // Load plugin data
            if (gameState.plugins) {
                this.pluginSystem.loadPluginSaveData(gameState.plugins);
            }
            
            logger.info("Game state loaded successfully.");
        } catch (error) {
            logger.error(`Failed to load game state: ${error}`);
        }
    }

    /**
     * Starts the game and main game loop
     * @returns {void}
     */
    start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameTimer.start();
        
        // Start all registered timers
        for (const timer of this.timers.values()) {
            if (!timer.getIsRunning()) {
                timer.start();
            }
        }
        
        logger.info('Game started');
    }

    /**
     * Pauses the game and game loop
     * @returns {void}
     */
    pause(): void {
        this.isRunning = false;
        this.pauseTimers();
        this.unlockManager.pause();
        this.eventManager.pause();
        this.emit('gamePaused');
        logger.info('Game paused');
    }

    /**
     * Resumes the game and game loop
     * @returns {void}
     */
    resume(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.resumeTimers();
        this.unlockManager.resume();
        this.eventManager.resume();
        this.emit('gameResumed');
        logger.info('Game resumed');
    }


    /**
     * Main game loop that updates game state based on elapsed time.
     * Handles resource generation, entity unlocking, and entity updates.
     * @private
     * @returns {void}
     */
    private gameLoop(): void {
        if (!this.isRunning) return;

        // Record frame timing for performance monitoring
        this.performanceMonitor.recordFrameTime();

        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) * this.gameSpeed;
        this.lastUpdate = now;
        this.totalGameTime += deltaTime;

        // Update all entities
        this.updateEntities(deltaTime);
        
        // Legacy resource update for backward compatibility
        this.updateResources(deltaTime);
        
        // Check unlock conditions using UnlockManager
        this.unlockManager.checkUnlockConditions();
    }

    /**
     * Calls onUpdate on all entities that need active updates
     * @private
     * @param deltaTime - Time elapsed since last update in milliseconds
     */
    private updateEntities(deltaTime: number): void {
        const updatableEntities = this.entityRegistry.getUpdatableEntities();
        for (const entity of updatableEntities) {
            entity.onUpdate(deltaTime);
        }
        
        // Perform maintenance on managers
        this.capacityManager.performMaintenance();
        
        // Update active plugins
        this.pluginSystem.updatePlugins(deltaTime);
    }

    /**
     * Updates all unlocked resources based on their rates and elapsed time.
     * @private
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @returns {void}
     */
    private updateResources(deltaTime: number): void {
        this.entityRegistry.getResources().forEach(resource => {
            if (resource.isUnlocked) {
                resource.amount += resource.rate * deltaTime;
            }
        });
    }


    /**
     * Calculates offline progress for resources based on time since last play.
     * @returns {void}
     */
    calculateOfflineProgress(): void {
        const lastPlayTime = this.saveManager.getLastPlayTime();
        if (!lastPlayTime) return;

        const now = Date.now();
        const offlineTime = (now - lastPlayTime) / 1000; // Convert to seconds
        
        // Calculate offline gains
        this.entityRegistry.getResources().forEach(resource => {
            if (resource.isUnlocked) {
                const offlineGain = resource.rate * offlineTime;
                resource.amount += offlineGain;
            }
        });
        
        this.saveManager.setLastPlayTime(now);
    }

    /**
     * Gets current performance metrics
     * @returns Performance metrics snapshot
     */
    getPerformanceMetrics() {
        const entityStats = this.entityRegistry.getEntityStats();
        return this.performanceMonitor.getMetrics({
            total: entityStats.total,
            unlocked: entityStats.unlocked,
            updatable: this.entityRegistry.getUpdatableEntities().length
        });
    }

    /**
     * Enables or disables performance monitoring
     * @param enabled - Whether to enable performance monitoring
     */
    setPerformanceMonitoring(enabled: boolean): void {
        this.performanceMonitor.setEnabled(enabled);
    }

    /**
     * Gets performance optimization recommendations
     * @returns Array of optimization suggestions
     */
    getPerformanceRecommendations(): string[] {
        const metrics = this.getPerformanceMetrics();
        return this.performanceMonitor.getOptimizationRecommendations(metrics);
    }

    /**
     * Cleanup method to stop all timers and release resources
     */
    destroy(): void {
        this.isRunning = false;
        
        // Emit destruction event before cleanup
        this.emit('gameDestroyed');
        
        // Stop timers
        this.gameTimer.stop();
        for (const timer of this.timers.values()) {
            timer.stop();
        }
        this.timers.clear();
        
        // Destroy managers
        this.unlockManager.destroy();
        this.eventManager.destroy();
        this.eventBatchingSystem.destroy();
        this.performanceMonitor.destroy();
        
        // Clear all entities from registry
        // Note: EntityRegistry handles the cleanup of individual entities
        const entityIds: string[] = [];
        const allResources = this.entityRegistry.getResources();
        const allBuildings = this.entityRegistry.getBuildings();
        const allUpgrades = this.entityRegistry.getUpgrades();
        
        [...allResources, ...allBuildings, ...allUpgrades].forEach(entity => {
            entityIds.push(entity.id);
        });
        
        entityIds.forEach(id => {
            this.entityRegistry.unregisterEntity(id);
        });
        
        logger.info('Game destroyed and resources cleaned up');
    }

}
