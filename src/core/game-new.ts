import { SaveManager } from "./save-manager";
import { BaseEntity } from "./base-entity";
import { Resource } from "../entities/resources/resource";
import { Building } from "../entities/buildings/building";
import { Storage } from "../entities/buildings/storage";
import { Miner } from "../entities/buildings/miner";
import { Upgrade } from "./upgrade";
import { Timer } from "./timer";
import { logger } from "../utils/logger";
import { GAME_CONSTANTS } from "../utils/constants";
import type { CostDefinition } from "../types/cost-definition";
import { IGame } from "./game-aware";

// Import all services
import { EntityService, IEntityService, ResourceConfig, BuildingConfig, MinerConfig, StorageConfig, UpgradeConfig } from "./entity-service";
import { ProductionService, IProductionService, ProductionOptimizationResult, GlobalProductionStats, ProductionBottlenecks } from "./production-service";
import { CapacityService, ICapacityService } from "./capacity-service";
import { TimerService, ITimerService } from "./timer-service";
import { EventService, IEventService } from "./event-service";
import { UnlockService, IUnlockService } from "./unlock-service";
import { GameLoopService, IGameLoopService } from "./game-loop-service";
import { GameStateService, IGameStateService } from "./game-state-service";

// Legacy imports for compatibility
import { EventStats } from "./event-manager";
import { UnlockManager } from "./unlock-manager";
import { EventManager } from "./event-manager";
import { CostSystem } from "./cost-system";
import { UpgradeEffectProcessor } from "./upgrade-effect-processor";
import { PluginSystem } from "./plugin-system";
import { EventBatchingSystem } from "./event-batching-system";
import { PerformanceMonitor } from "./performance-monitor";

/**
 * Game class that orchestrates services and provides a unified API
 * Refactored from god class to service orchestrator pattern
 */
export class Game implements IGame {
    // Public service APIs (new recommended approach)
    public readonly entities: IEntityService;
    public readonly production: IProductionService;
    public readonly capacity: ICapacityService;
    public readonly timers: ITimerService;
    public readonly events: IEventService;
    public readonly unlocks: IUnlockService;
    public readonly gameLoop: IGameLoopService;
    public readonly gameState: IGameStateService;

    // Legacy systems for backward compatibility
    public readonly costSystem: CostSystem;
    public readonly upgradeEffectProcessor: UpgradeEffectProcessor;
    public readonly pluginSystem: PluginSystem;
    public readonly performanceMonitor: PerformanceMonitor;
    private readonly eventBatchingSystem: EventBatchingSystem;

    // Core game state
    private gameSpeed: number = 1.0;
    private totalGameTime: number = 0;
    private lastUpdate: number = Date.now();
    private isRunning: boolean = false;

    // Legacy timer support
    private legacyTimers = new Map<string, Timer>();

    constructor(saveManager: SaveManager) {
        logger.info('Game: Initializing service-oriented architecture');

        // Initialize services in dependency order
        this.events = new EventService();
        this.entities = new EntityService(this);
        this.capacity = new CapacityService(
            () => this.entities.getStorages(),
            (id) => this.entities.getResourceById(id)
        );
        this.production = new ProductionService(
            () => this.entities.getAllEntities(),
            (id) => this.entities.getResourceById(id),
            (resourceId, amount) => this.capacity.hasGlobalCapacity(resourceId, amount)
        );
        this.timers = new TimerService();
        this.unlocks = new UnlockService(this);
        this.gameLoop = new GameLoopService();
        this.gameState = new GameStateService(saveManager);

        // Initialize legacy systems for backward compatibility
        this.costSystem = new CostSystem(this);
        this.upgradeEffectProcessor = new UpgradeEffectProcessor(this);
        this.pluginSystem = new PluginSystem(this, this.events.getEventManager());
        this.eventBatchingSystem = new EventBatchingSystem(this.events.getEventManager(), {
            batchedTypes: ['resourceChanged', 'buildProgress', 'capacityChanged'],
            excludedTypes: ['gameDestroyed', 'gamePaused', 'gameResumed', 'buildComplete']
        });
        this.performanceMonitor = new PerformanceMonitor(this.events.getEventManager(), {
            enabled: false
        });

        // Wire service dependencies
        this.wireServices();

        logger.info('Game: Service orchestrator initialized successfully');
    }

    // ==========================================
    // CORE ORCHESTRATION METHODS (~50 lines)
    // ==========================================

    /**
     * Starts the game and all services
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastUpdate = Date.now();

        // Start core services
        this.gameLoop.start();
        this.unlocks.resume();
        this.events.resume();

        // Start legacy timers
        for (const timer of this.legacyTimers.values()) {
            if (!timer.getIsRunning()) {
                timer.start();
            }
        }

        this.events.emit('gameStarted');
        logger.info('Game: All services started');
    }

    /**
     * Pauses the game and all services
     */
    pause(): void {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.gameLoop.pause();
        this.timers.pauseAllTimers();
        this.unlocks.pause();
        this.events.pause();

        // Pause legacy timers
        for (const timer of this.legacyTimers.values()) {
            if (timer.getIsRunning() && !timer.getIsPaused()) {
                timer.toggle();
            }
        }

        this.events.emit('gamePaused');
        logger.info('Game: All services paused');
    }

    /**
     * Resumes the game and all services
     */
    resume(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameLoop.resume();
        this.timers.resumeAllTimers();
        this.unlocks.resume();
        this.events.resume();

        // Resume legacy timers
        for (const timer of this.legacyTimers.values()) {
            if (timer.getIsRunning() && timer.getIsPaused()) {
                timer.toggle();
            }
        }

        this.events.emit('gameResumed');
        logger.info('Game: All services resumed');
    }

    /**
     * Destroys the game and cleans up all services
     */
    destroy(): void {
        this.isRunning = false;
        this.events.emit('gameDestroyed');

        // Destroy all services
        this.gameLoop.destroy();
        this.timers.destroy();
        this.entities.destroy();
        this.production.destroy();
        this.capacity.destroy();
        this.events.destroy();
        this.unlocks.destroy();
        this.gameState = null as any;

        // Destroy legacy systems
        this.eventBatchingSystem.destroy();
        this.performanceMonitor.destroy();
        this.legacyTimers.clear();

        logger.info('Game: All services destroyed');
    }

    // ==========================================
    // CORE GAME STATE (~30 lines)
    // ==========================================

    /**
     * Sets the game speed multiplier
     */
    setGameSpeed(speed: number): void {
        if (speed <= 0) {
            throw new Error('Game speed must be greater than 0');
        }
        this.gameSpeed = speed;
        this.gameLoop.setSpeed(speed);
        logger.info(`Game: Speed set to ${speed}x`);
    }

    /**
     * Gets the current game speed multiplier
     */
    getGameSpeed(): number {
        return this.gameSpeed;
    }

    /**
     * Gets whether the game is currently running
     */
    isGameRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Gets the current game time
     */
    getCurrentTime(): number {
        return Date.now();
    }

    /**
     * Saves the current game state
     */
    saveState(): void {
        this.gameState.saveState({
            entities: this.entities.getAllEntities(),
            resources: this.entities.getResources(),
            gameSpeed: this.gameSpeed,
            totalGameTime: this.totalGameTime,
            plugins: this.pluginSystem.getPluginSaveData()
        });
    }

    /**
     * Loads the previously saved game state
     */
    loadState(): void {
        const loadedState = this.gameState.loadState();
        if (!loadedState) return;

        // Restore game properties
        if (loadedState.gameSpeed !== undefined) {
            this.gameSpeed = loadedState.gameSpeed;
        }
        if (loadedState.totalGameTime !== undefined) {
            this.totalGameTime = loadedState.totalGameTime;
        }

        // Restore resource amounts and unlock states
        if (loadedState.resources) {
            for (const savedResource of loadedState.resources) {
                const resource = this.entities.getResourceById(savedResource.id);
                if (resource) {
                    resource.amount = savedResource.amount;
                    resource.isUnlocked = savedResource.isUnlocked;
                }
            }
        }

        // Restore entity unlock states
        if (loadedState.entities) {
            for (const savedEntity of loadedState.entities) {
                const entity = this.entities.getEntityById(savedEntity.id);
                if (entity) {
                    entity.isUnlocked = savedEntity.isUnlocked;
                }
            }
        }

        // Load plugin data
        if (loadedState.plugins) {
            this.pluginSystem.loadPluginSaveData(loadedState.plugins);
        }
    }

    /**
     * Calculates offline progress for resources
     */
    calculateOfflineProgress(): void {
        const offlineProgress = this.gameState.calculateOfflineProgress(
            this.entities.getResources()
        );

        if (offlineProgress && offlineProgress.offlineTime > 0) {
            for (const [resourceId, gain] of Object.entries(offlineProgress.resourceGains)) {
                const resource = this.entities.getResourceById(resourceId);
                if (resource) {
                    resource.amount += gain;
                }
            }
            logger.info(`Applied offline progress: ${offlineProgress.offlineTime}s offline`);
        }
    }

    // ==========================================
    // LEGACY API METHODS (~150 lines)
    // These provide backward compatibility
    // ==========================================

    /** @deprecated Use game.entities.getResources() instead */
    getCurrentResources(): Resource[] {
        return this.entities.getResources();
    }

    /** @deprecated Use game.entities.getBuildings() instead */
    getCurrentBuildings(): Building[] {
        return this.entities.getBuildings();
    }

    /** @deprecated Use game.entities.getUpgrades() instead */
    getCurrentUpgrades(): Upgrade[] {
        return this.entities.getUpgrades();
    }

    /** @deprecated Use game.capacity.getStorageStatus() instead */
    getStorageStatus(): Storage[] {
        return this.capacity.getStorageStatus();
    }

    /** @deprecated Use game.entities.addEntity() instead */
    addEntity(entity: BaseEntity): void {
        this.entities.addEntity(entity);
        this.events.registerEntity(entity);
        this.events.routeEntityEvents(entity);

        // Legacy unlock condition registration
        const unlockCondition = entity.getUnlockCondition();
        if (unlockCondition && !entity.isUnlocked) {
            this.unlocks.registerUnlockCondition(entity, unlockCondition);
        }

        this.events.emit('entityAdded', { entity });
    }

    /** @deprecated Use game.entities.removeEntity() instead */
    removeEntity(entityId: string): boolean {
        const entity = this.entities.getEntityById(entityId);
        if (!entity) return false;

        this.events.emit('entityRemoved', { entity });
        this.events.unregisterEntity(entityId);
        this.unlocks.removeUnlockCondition(entityId);

        if (entity instanceof Storage) {
            this.capacity.invalidateCache();
        }

        return this.entities.removeEntity(entityId);
    }

    /** @deprecated Use game.entities.getEntityById() instead */
    getEntityById(entityId: string): BaseEntity | undefined {
        return this.entities.getEntityById(entityId);
    }

    /** @deprecated Use game.entities.getResourceById() instead */
    getResourceById(resourceId: string): Resource | undefined {
        return this.entities.getResourceById(resourceId);
    }

    /** @deprecated Use game.entities.getResourceByName() instead */
    getResourceByName(name: string): Resource | undefined {
        return this.entities.getResourceByName(name);
    }

    /** @deprecated Use game.entities.createResource() instead */
    createResource(config: ResourceConfig): Resource {
        return this.entities.createResource(config);
    }

    /** @deprecated Use game.entities.createBuilding() instead */
    createBuilding(config: BuildingConfig): Building {
        return this.entities.createBuilding(config);
    }

    /** @deprecated Use game.entities.createMiner() instead */
    createMiner(config: MinerConfig): Miner {
        return this.entities.createMiner(config);
    }

    /** @deprecated Use game.entities.createStorage() instead */
    createStorage(config: StorageConfig): Storage {
        return this.entities.createStorage(config);
    }

    /** @deprecated Use game.entities.createUpgrade() instead */
    createUpgrade(config: UpgradeConfig): Upgrade {
        return this.entities.createUpgrade(config);
    }

    /** @deprecated Use game.entities.createEntity() instead */
    createEntity<T extends BaseEntity>(EntityClass: new (config: Record<string, unknown>) => T, config: Record<string, unknown>): T {
        return this.entities.createEntity(EntityClass, config);
    }

    /** @deprecated Use game.timers.addTimer() instead */
    addTimer(id: string, timer: Timer): void {
        this.timers.addTimer(id, timer);
        this.legacyTimers.set(id, timer);
    }

    /** @deprecated Use game.timers.removeTimer() instead */
    removeTimer(id: string): boolean {
        this.legacyTimers.delete(id);
        return this.timers.removeTimer(id);
    }

    /** @deprecated Use game.timers.getTimer() instead */
    getTimer(id: string): Timer | undefined {
        return this.timers.getTimer(id) || this.legacyTimers.get(id);
    }

    /** @deprecated Use game.production.startAllProduction() instead */
    startAllProduction(): BaseEntity[] {
        return this.production.startAllProduction();
    }

    /** @deprecated Use game.production.stopAllProduction() instead */
    stopAllProduction(): BaseEntity[] {
        return this.production.stopAllProduction();
    }

    /** @deprecated Use game.production.getProducerBuildings() instead */
    getProducerBuildings(): BaseEntity[] {
        return this.production.getProducerBuildings();
    }

    /** @deprecated Use game.production.getActiveProducers() instead */
    getActiveProducers(): BaseEntity[] {
        return this.production.getActiveProducers();
    }

    /** @deprecated Use game.production.getGlobalProductionStats() instead */
    getGlobalProductionStats(): GlobalProductionStats {
        return this.production.getGlobalProductionStats();
    }

    /** @deprecated Use game.production.optimizeProduction() instead */
    optimizeProduction(): ProductionOptimizationResult {
        return this.production.optimizeProduction();
    }

    /** @deprecated Use game.production.checkResourceAvailability() instead */
    checkResourceAvailability(inputs: Array<{resourceId: string, amount: number}>): boolean {
        return this.production.checkResourceAvailability(inputs);
    }

    /** @deprecated Use game.production.checkProductionCapacity() instead */
    checkProductionCapacity(outputs: Array<{resourceId: string, amount: number}>): boolean {
        return this.production.checkProductionCapacity(outputs);
    }

    /** @deprecated Use game.production.getProductionBottlenecks() instead */
    getProductionBottlenecks(): ProductionBottlenecks {
        return this.production.getProductionBottlenecks();
    }

    /** @deprecated Use game.capacity.getTotalCapacityFor() instead */
    getTotalCapacityFor(resourceId: string): number {
        return this.capacity.getTotalCapacityFor(resourceId);
    }

    /** @deprecated Use game.capacity.hasGlobalCapacity() instead */
    hasGlobalCapacity(resourceId: string, amount: number): boolean {
        return this.capacity.hasGlobalCapacity(resourceId, amount);
    }

    /** @deprecated Use game.capacity.getRemainingCapacityFor() instead */
    getRemainingCapacityFor(resourceId: string): number {
        return this.capacity.getRemainingCapacityFor(resourceId);
    }

    /** @deprecated Use game.unlocks.checkUnlockConditions() instead */
    checkUnlockConditions(): void {
        this.unlocks.checkUnlockConditions();
    }

    /** @deprecated Use game.unlocks.unlockEntity() instead */
    unlockEntity(entityId: string): boolean {
        return this.unlocks.unlockEntity(entityId);
    }

    /** @deprecated Use game.events.on() instead */
    on(eventName: string, callback: (...args: unknown[]) => void): void {
        this.events.on(eventName, callback);
    }

    /** @deprecated Use game.events.off() instead */
    off(eventName: string, callback: (...args: unknown[]) => void): boolean {
        return this.events.off(eventName, callback);
    }

    /** @deprecated Use game.events.emit() instead */
    emit(eventName: string, data?: unknown): void {
        this.events.emit(eventName, data);
    }

    /** @deprecated Use game.events.getEventStats() instead */
    getEventStats(): EventStats {
        return this.events.getEventStats();
    }

    /** @deprecated Use game.unlocks.getUnlockStats() instead */
    getUnlockStats() {
        return this.unlocks.getUnlockStats();
    }

    /** @deprecated Use game.unlocks.getUnlockManager() instead */
    getUnlockManager(): UnlockManager {
        return this.unlocks.getUnlockManager();
    }

    /** @deprecated Use game.events.getEventManager() instead */
    getEventManager(): EventManager {
        return this.events.getEventManager();
    }

    // Legacy timer methods
    pauseTimers(): void {
        this.timers.pauseAllTimers();
    }

    resumeTimers(): void {
        this.timers.resumeAllTimers();
    }

    // Performance and monitoring methods
    getPerformanceMetrics() {
        const entityStats = this.entities.getEntityStats();
        return this.performanceMonitor.getMetrics({
            total: entityStats.total,
            unlocked: entityStats.unlocked,
            updatable: this.entities.getUpdatableEntities().length
        });
    }

    setPerformanceMonitoring(enabled: boolean): void {
        this.performanceMonitor.setEnabled(enabled);
    }

    getPerformanceRecommendations(): string[] {
        const metrics = this.getPerformanceMetrics();
        return this.performanceMonitor.getOptimizationRecommendations(metrics);
    }

    // ==========================================
    // PRIVATE SERVICE COORDINATION (~30 lines)
    // ==========================================

    /**
     * Wires up dependencies between services
     */
    private wireServices(): void {
        // Set up game loop to update all services
        this.gameLoop.onUpdate((deltaTime) => {
            this.performanceMonitor.recordFrameTime(deltaTime * 1000);
            this.updateEntities(deltaTime);
            this.timers.updateTimers(deltaTime);
            this.unlocks.checkConditions();
            this.production.optimizeProduction();
            this.pluginSystem.updatePlugins(deltaTime);
            this.updateResources(deltaTime);
        });

        // Set up game state service timing
        this.gameState.setTotalGameTime(this.totalGameTime);
        this.gameLoop.setSpeed(this.gameSpeed);

        logger.debug('Game: Service dependencies wired successfully');
    }

    /**
     * Updates all entities that need active updates
     */
    private updateEntities(deltaTime: number): void {
        const updatableEntities = this.entities.getUpdatableEntities();
        for (const entity of updatableEntities) {
            entity.onUpdate(deltaTime);
        }
        this.capacity.performMaintenance();
    }

    /**
     * Updates all unlocked resources based on their rates
     */
    private updateResources(deltaTime: number): void {
        this.entities.getResources().forEach(resource => {
            if (resource.isUnlocked) {
                resource.amount += resource.rate * deltaTime;
            }
        });
    }
}