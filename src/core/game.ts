import { Building, Resource, Storage } from "../entities";
import { Upgrade } from "./upgrade";
import { SaveManager } from "./save-manager";
import { BaseEntity } from "./base-entity";
import { Timer } from "./timer";
import { UnlockManager } from "./unlock-manager";
import { EventManager, EventStats } from "./event-manager";
import { logger } from "../utils/logger";
/**
 * Game class that manages the entire game state and core loop functionality.
 */
export class Game {
    /** List of all resources in the game */
    private resources: Resource[];
    
    /** List of all buildings in the game */
    private buildings: Building[];
    
    /** List of all upgrades in the game */
    private upgrades: Upgrade[];
    
    /** List of all storage buildings in the game */
    private storages: Storage[];
    
    /** Centralized collection of all entities */
    private entities: Map<string, BaseEntity>;
    
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

    /** Centralized unlock condition manager */
    private unlockManager: UnlockManager;

    /** Global event coordination manager */
    private eventManager: EventManager;

    private saveManager: SaveManager;

    /**
     * Creates a new Game instance and initializes empty collections
     */
    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
        this.resources = [];
        this.buildings = [];
        this.upgrades = [];
        this.storages = [];
        this.entities = new Map();
        this.lastUpdate = Date.now();
        this.isRunning = false;
        this.timers = new Map();
        this.gameSpeed = 1.0;
        
        // Initialize managers
        this.unlockManager = new UnlockManager();
        this.eventManager = new EventManager();
        
        // Initialize main game timer
        this.gameTimer = new Timer({
            totalTime: Number.MAX_SAFE_INTEGER, // Effectively infinite for main loop
            tickRate: 16, // ~60 FPS
            onUpdateCallbacks: [() => this.gameLoop()],
            conditionCallback: () => this.isRunning
        });
    }

    /**
     * Returns all current resources in the game.
     * @returns {Resource[]} Array of all game resources
     */
    getCurrentResources(): Resource[] {
        return this.resources;
    }

    /**
     * Returns all current buildings in the game.
     * @returns {Building[]} Array of all game buildings
     */
    getCurrentBuildings(): Building[] {
        return this.buildings;
    }

    /**
     * Returns all current upgrades in the game.
     * @returns {Upgrade[]} Array of all game upgrades
     */
    getCurrentUpgrades(): Upgrade[] {
        return this.upgrades;
    }

    /**
     * Returns all current storage buildings and their status.
     * @returns {Storage[]} Array of all storage buildings
     */
    getStorageStatus(): Storage[] {
        return this.storages;
    }

    /**
     * Adds an entity to the game and registers it for updates
     * @param entity - The entity to add
     */
    addEntity(entity: BaseEntity): void {
        this.entities.set(entity.id, entity);
        
        // Register with managers
        this.eventManager.registerEntity(entity);
        this.eventManager.routeEntityEvents(entity);
        
        // Register unlock condition if entity has one and isn't already unlocked
        const unlockCondition = entity.getUnlockCondition();
        if (unlockCondition && !entity.isUnlocked) {
            this.unlockManager.registerUnlockCondition(entity, unlockCondition);
        }
        
        // Add to specific collections for backward compatibility
        if (entity instanceof Resource) {
            this.resources.push(entity);
            // Set game reference for capacity checking
            entity.setGameReference(this);
            logger.debug(`Game: Resource '${entity.name}' registered for capacity management`);
        } else if (entity instanceof Building) {
            this.buildings.push(entity);
            if (entity instanceof Storage) {
                this.storages.push(entity);
                // Set game reference for capacity management
                entity.setGameReference(this);
                logger.info(`Game: Storage '${entity.name}' added - now managing ${this.storages.length} storage buildings`);
            }
            // Set game reference for producer buildings
            if ('setGameReference' in entity) {
                (entity as any).setGameReference(this);
                logger.debug(`Game: Game reference set for building '${entity.name}'`);
            }
        } else if (entity instanceof Upgrade) {
            this.upgrades.push(entity);
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
        const entity = this.entities.get(entityId);
        if (!entity) {
            return false;
        }

        // Emit entity removal event before cleanup
        this.eventManager.emit('entityRemoved', { entity });

        // Unregister from managers
        this.eventManager.unregisterEntity(entityId);
        this.unlockManager.removeUnlockCondition(entityId);

        // Remove from specific collections
        if (entity instanceof Resource) {
            const index = this.resources.indexOf(entity);
            if (index > -1) this.resources.splice(index, 1);
            // Clear game reference
            entity.setGameReference(undefined);
            logger.debug(`Game: Resource '${entity.name}' unregistered from capacity management`);
        } else if (entity instanceof Building) {
            const index = this.buildings.indexOf(entity);
            if (index > -1) this.buildings.splice(index, 1);
            if (entity instanceof Storage) {
                const storageIndex = this.storages.indexOf(entity);
                if (storageIndex > -1) this.storages.splice(storageIndex, 1);
                // Clear game reference
                entity.setGameReference(undefined);
                logger.info(`Game: Storage '${entity.name}' removed - ${this.storages.length} storage buildings remaining`);
            }
            // Clear game reference for producer buildings
            if ('setGameReference' in entity) {
                (entity as any).setGameReference(undefined);
                logger.debug(`Game: Game reference cleared for building '${entity.name}'`);
            }
        } else if (entity instanceof Upgrade) {
            const index = this.upgrades.indexOf(entity);
            if (index > -1) this.upgrades.splice(index, 1);
        }

        // Clean up event listeners
        entity.removeAllListeners();
        
        this.entities.delete(entityId);
        logger.info(`Entity ${entity.name} (${entityId}) removed from game`);
        return true;
    }

    /**
     * Gets an entity by its ID
     * @param entityId - The ID of the entity to retrieve
     * @returns The entity if found, undefined otherwise
     */
    getEntityById(entityId: string): BaseEntity | undefined {
        return this.entities.get(entityId);
    }

    /**
     * Gets a resource by its ID
     * @param resourceId - The ID of the resource to retrieve
     * @returns The resource if found, undefined otherwise
     */
    getResourceById(resourceId: string): Resource | undefined {
        const entity = this.entities.get(resourceId);
        return entity instanceof Resource ? entity : undefined;
    }

    /**
     * Gets a resource by its name (for backward compatibility)
     * @param name - The name of the resource to retrieve
     * @returns The resource if found, undefined otherwise
     */
    getResourceByName(name: string): Resource | undefined {
        return this.resources.find(r => r.name === name);
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
        cost?: Record<string, number>;
        buildTime?: number;
        productionRate?: number;
        level?: number;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Building {
        const building = new Building(config);
        this.addEntity(building);
        return building;
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
        cost?: Record<string, number>;
        buildTime?: number;
        capacities?: Record<string, number>;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Storage {
        const storage = new Storage(config);
        
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
        effect?: any;
        cost?: Record<string, number>;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Upgrade {
        const upgrade = new Upgrade(config);
        this.addEntity(upgrade);
        return upgrade;
    }

    /**
     * Generic factory method to create and register any entity type
     * @param EntityClass - The entity class constructor
     * @param config - Entity configuration
     * @returns The created entity
     */
    createEntity<T extends BaseEntity>(EntityClass: new (config: any) => T, config: any): T {
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
     * Manually unlocks an entity (bypasses condition check)
     * @param entityId - ID of the entity to unlock
     * @returns Whether the entity was successfully unlocked
     */
    unlockEntity(entityId: string): boolean {
        return this.unlockManager.unlockEntity(entityId);
    }

    /**
     * Adds a global event listener
     * @param eventName - Name of the event to listen for
     * @param callback - Function to call when event is emitted
     */
    on(eventName: string, callback: Function): void {
        this.eventManager.on(eventName, callback);
    }

    /**
     * Removes a global event listener
     * @param eventName - Name of the event
     * @param callback - The callback function to remove
     * @returns Whether the listener was successfully removed
     */
    off(eventName: string, callback: Function): boolean {
        return this.eventManager.off(eventName, callback);
    }

    /**
     * Emits a global event
     * @param eventName - Name of the event to emit
     * @param data - Optional data to pass with the event
     */
    emit(eventName: string, data?: any): void {
        this.eventManager.emit(eventName, data);
    }

    /**
     * Gets total capacity for a resource across all storage buildings
     * @param resourceId - The ID of the resource
     * @returns Total capacity limit for the resource
     */
    getTotalCapacityFor(resourceId: string): number {
        let totalCapacity = 0;
        let storageCount = 0;
        
        for (const storage of this.storages) {
            if (storage.isUnlocked) {
                const capacity = storage.getCapacityFor(resourceId);
                if (capacity !== undefined) {
                    totalCapacity += capacity;
                    storageCount++;
                }
            }
        }
        
        if (storageCount > 0) {
            logger.debug(`Game: Total capacity for ${resourceId}: ${totalCapacity} (from ${storageCount} storage buildings)`);
        }
        
        return totalCapacity;
    }

    /**
     * Checks if there is sufficient capacity across all storage buildings for a resource amount
     * @param resourceId - The ID of the resource
     * @param amount - The amount to check
     * @returns Whether there is sufficient capacity
     */
    hasGlobalCapacity(resourceId: string, amount: number): boolean {
        const totalCapacity = this.getTotalCapacityFor(resourceId);
        if (totalCapacity === 0) {
            // No storage buildings define capacity for this resource - unlimited
            logger.debug(`Game: No capacity limits for ${resourceId} - allowing unlimited storage`);
            return true;
        }
        
        const currentAmount = this.getResourceById(resourceId)?.amount || 0;
        const hasCapacity = currentAmount + amount <= totalCapacity;
        
        if (!hasCapacity) {
            logger.warn(`Game: Global capacity exceeded for ${resourceId} - attempted +${amount}, current: ${currentAmount}, limit: ${totalCapacity}`);
        }
        
        return hasCapacity;
    }

    /**
     * Gets remaining capacity for a resource across all storage buildings
     * @param resourceId - The ID of the resource
     * @returns Remaining capacity for the resource
     */
    getRemainingCapacityFor(resourceId: string): number {
        const totalCapacity = this.getTotalCapacityFor(resourceId);
        const currentAmount = this.getResourceById(resourceId)?.amount || 0;
        const remaining = Math.max(0, totalCapacity - currentAmount);
        
        if (totalCapacity > 0) {
            const utilization = ((currentAmount / totalCapacity) * 100).toFixed(1);
            logger.debug(`Game: Remaining capacity for ${resourceId}: ${remaining}/${totalCapacity} (${utilization}% used)`);
        }
        
        return remaining;
    }

    // Production Management Methods

    /**
     * Starts production for all producer buildings that can produce
     * @returns Array of buildings that started production
     */
    startAllProduction(): BaseEntity[] {
        const startedBuildings: BaseEntity[] = [];
        
        for (const entity of this.entities.values()) {
            if (entity.isUnlocked && 'startProduction' in entity && 'canProduce' in entity) {
                const producer = entity as any;
                if (producer.canProduce() && !producer.isCurrentlyProducing()) {
                    if (producer.startProduction()) {
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
        
        for (const entity of this.entities.values()) {
            if (entity.isUnlocked && 'stopProduction' in entity && 'isCurrentlyProducing' in entity) {
                const producer = entity as any;
                if (producer.isCurrentlyProducing()) {
                    producer.stopProduction();
                    stoppedBuildings.push(entity);
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
        
        for (const entity of this.entities.values()) {
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
        
        for (const entity of this.entities.values()) {
            if (entity.isUnlocked && 'isCurrentlyProducing' in entity) {
                const producer = entity as any;
                if (producer.isCurrentlyProducing()) {
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
                const producer = entity as any;
                const stats = producer.getProductionStats();
                
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
            
            const producer = entity as any;
            
            // Check if producer should be active but isn't
            if ('canProduce' in producer && 'isCurrentlyProducing' in producer) {
                if (!producer.isCurrentlyProducing() && !producer.canProduce()) {
                    let reason = 'Unknown';
                    
                    // Check for input shortages
                    if ('getProductionInputs' in producer) {
                        const inputs = producer.getProductionInputs();
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
                        const outputs = producer.getProductionOutputs();
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
        let started = 0;
        let stopped = 0;
        const bottlenecks: string[] = [];
        
        for (const entity of this.getProducerBuildings()) {
            if (!entity.isUnlocked) continue;
            
            const producer = entity as any;
            
            if ('canProduce' in producer && 'startProduction' in producer && 'stopProduction' in producer) {
                const canProduce = producer.canProduce();
                const isProducing = producer.isCurrentlyProducing();
                
                if (canProduce && !isProducing) {
                    if (producer.startProduction()) {
                        started++;
                    }
                } else if (!canProduce && isProducing) {
                    producer.stopProduction();
                    stopped++;
                    bottlenecks.push(`${entity.name}: Cannot produce`);
                }
            }
        }
        
        const result = { started, stopped, bottlenecks };
        logger.info(`Production optimization: Started ${started}, Stopped ${stopped}, Bottlenecks: ${bottlenecks.length}`);
        return result;
    }

    /**
     * Saves the current game state to persistent storage.
     * @returns {void}
     */
    saveState(): void {
        // TODO: Implement actual save functionality
        logger.info("Game state saved.");
    }

    /**
     * Loads the previously saved game state from persistent storage.
     * @returns {void}
     */
    loadState(): void {
        // TODO: Implement actual load functionality
        logger.info("Game state loaded.");
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

        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) * this.gameSpeed;
        this.lastUpdate = now;

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
        for (const entity of this.entities.values()) {
            if (entity.isUnlocked) {
                entity.onUpdate(deltaTime);
            }
        }
    }

    /**
     * Updates all unlocked resources based on their rates and elapsed time.
     * @private
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @returns {void}
     */
    private updateResources(deltaTime: number): void {
        this.resources.forEach(resource => {
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
        this.resources.forEach(resource => {
            if (resource.isUnlocked) {
                const offlineGain = resource.rate * offlineTime;
                resource.amount += offlineGain;
            }
        });
        
        this.saveManager.setLastPlayTime(now);
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
        
        // Clear all entities
        for (const entity of this.entities.values()) {
            entity.removeAllListeners();
        }
        this.entities.clear();
        this.resources = [];
        this.buildings = [];
        this.upgrades = [];
        this.storages = [];
        
        logger.info('Game destroyed and resources cleaned up');
    }

}
