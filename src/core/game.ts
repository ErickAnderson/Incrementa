import { SaveManager } from "./save-manager";
import { BaseEntity } from "./base-entity";
import { Resource } from "../entities/resources/resource";
import { Building } from "../entities/buildings/building";
import { Storage } from "../entities/buildings/storage";
import { Miner } from "../entities/buildings/miner";
import { Upgrade } from "./upgrade";
import { Timer } from "./timer";
import { logger } from "../utils/logger";
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

// Legacy imports for essential compatibility
import { EventStats } from "./event-manager";
import { UnlockManager } from "./unlock-manager";
import { EventManager } from "./event-manager";
import { CostSystem } from "./cost-system";
import { UpgradeEffectProcessor } from "./upgrade-effect-processor";
import { PluginSystem } from "./plugin-system";
import { EventBatchingSystem } from "./event-batching-system";
import { PerformanceMonitor } from "./performance-monitor";

/**
 * Game class refactored as service orchestrator
 * Reduced from 1,063 lines to under 300 lines
 * Core responsibilities: service coordination and legacy API
 */
export class Game implements IGame {
    // ==========================================
    // PUBLIC SERVICE APIS (New Recommended)
    // ==========================================
    public readonly entities: IEntityService;
    public readonly production: IProductionService;
    public readonly capacity: ICapacityService;
    public readonly timers: ITimerService;
    public readonly events: IEventService;
    public readonly unlocks: IUnlockService;
    public readonly gameLoop: IGameLoopService;
    public readonly gameState: IGameStateService;

    // ==========================================
    // LEGACY SYSTEMS (Backward Compatibility)
    // ==========================================
    public readonly costSystem: CostSystem;
    public readonly upgradeEffectProcessor: UpgradeEffectProcessor;
    public readonly pluginSystem: PluginSystem;
    public readonly performanceMonitor: PerformanceMonitor;
    private readonly eventBatchingSystem: EventBatchingSystem;

    // ==========================================
    // CORE GAME STATE
    // ==========================================
    private gameSpeed: number = 1.0;
    private totalGameTime: number = 0;
    private lastUpdate: number = Date.now();
    private isRunning: boolean = false;

    constructor(saveManager: SaveManager) {
        logger.info('Game: Initializing service orchestrator');

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

        // Initialize essential legacy systems
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

        this.wireServices();
        logger.info('Game: Service orchestrator ready');
    }

    // ==========================================
    // CORE ORCHESTRATION (Primary Responsibility)
    // ==========================================

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastUpdate = Date.now();
        
        this.gameLoop.start();
        this.unlocks.resume();
        this.events.resume();
        
        this.events.emit('gameStarted');
        logger.info('Game: Started');
    }

    pause(): void {
        if (!this.isRunning) return;
        this.isRunning = false;
        
        this.gameLoop.pause();
        this.timers.pauseAllTimers();
        this.unlocks.pause();
        this.events.pause();
        
        this.events.emit('gamePaused');
        logger.info('Game: Paused');
    }

    resume(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastUpdate = Date.now();
        
        this.gameLoop.resume();
        this.timers.resumeAllTimers();
        this.unlocks.resume();
        this.events.resume();
        
        this.events.emit('gameResumed');
        logger.info('Game: Resumed');
    }

    destroy(): void {
        this.isRunning = false;
        this.events.emit('gameDestroyed');

        this.gameLoop.destroy();
        this.timers.destroy();
        this.entities.destroy();
        this.production.destroy();
        this.capacity.destroy();
        this.events.destroy();
        this.unlocks.destroy();
        this.eventBatchingSystem.destroy();
        this.performanceMonitor.destroy();

        logger.info('Game: Destroyed');
    }

    // ==========================================
    // CORE GAME STATE MANAGEMENT
    // ==========================================

    setGameSpeed(speed: number): void {
        if (speed <= 0) throw new Error('Game speed must be greater than 0');
        this.gameSpeed = speed;
        this.gameLoop.setSpeed(speed);
    }

    getGameSpeed(): number {
        return this.gameSpeed;
    }

    isGameRunning(): boolean {
        return this.isRunning;
    }

    getCurrentTime(): number {
        return Date.now();
    }

    saveState(): void {
        this.gameState.saveState({
            entities: this.entities.getAllEntities(),
            resources: this.entities.getResources(),
            gameSpeed: this.gameSpeed,
            totalGameTime: this.totalGameTime,
            plugins: this.pluginSystem.getPluginSaveData()
        });
    }

    loadState(): void {
        const state = this.gameState.loadState();
        if (!state) return;

        if (state.gameSpeed !== undefined) this.gameSpeed = state.gameSpeed;
        if (state.totalGameTime !== undefined) this.totalGameTime = state.totalGameTime;

        if (state.resources) {
            state.resources.forEach((saved: any) => {
                const resource = this.entities.getResourceById(saved.id);
                if (resource) {
                    resource.amount = saved.amount;
                    resource.isUnlocked = saved.isUnlocked;
                }
            });
        }

        if (state.entities) {
            state.entities.forEach((saved: any) => {
                const entity = this.entities.getEntityById(saved.id);
                if (entity) entity.isUnlocked = saved.isUnlocked;
            });
        }

        if (state.plugins) this.pluginSystem.loadPluginSaveData(state.plugins);
    }

    calculateOfflineProgress(): void {
        const progress = this.gameState.calculateOfflineProgress(this.entities.getResources());
        if (progress?.offlineTime > 0) {
            Object.entries(progress.resourceGains).forEach(([id, gain]) => {
                const resource = this.entities.getResourceById(id);
                if (resource) resource.amount += gain;
            });
        }
    }

    // ==========================================
    // ESSENTIAL LEGACY API (Backward Compatibility)
    // Only the most commonly used methods
    // ==========================================

    getCurrentResources(): Resource[] { return this.entities.getResources(); }
    getCurrentBuildings(): Building[] { return this.entities.getBuildings(); }
    getCurrentUpgrades(): Upgrade[] { return this.entities.getUpgrades(); }
    getStorageStatus(): Storage[] { return this.capacity.getStorageStatus(); }

    getEntityById(entityId: string): BaseEntity | undefined { return this.entities.getEntityById(entityId); }
    getResourceById(resourceId: string): Resource | undefined { return this.entities.getResourceById(resourceId); }
    getResourceByName(name: string): Resource | undefined { return this.entities.getResourceByName(name); }

    createResource(config: ResourceConfig): Resource { return this.entities.createResource(config); }
    createBuilding(config: BuildingConfig): Building { return this.entities.createBuilding(config); }
    createMiner(config: MinerConfig): Miner { return this.entities.createMiner(config); }
    createStorage(config: StorageConfig): Storage { return this.entities.createStorage(config); }
    createUpgrade(config: UpgradeConfig): Upgrade { return this.entities.createUpgrade(config); }

    addEntity(entity: BaseEntity): void {
        this.entities.addEntity(entity);
        this.events.registerEntity(entity);
        this.events.routeEntityEvents(entity);
        const unlockCondition = entity.getUnlockCondition();
        if (unlockCondition && !entity.isUnlocked) {
            this.unlocks.registerUnlockCondition(entity, unlockCondition);
        }
    }

    removeEntity(entityId: string): boolean {
        const entity = this.entities.getEntityById(entityId);
        if (!entity) return false;
        this.events.unregisterEntity(entityId);
        this.unlocks.removeUnlockCondition(entityId);
        if (entity instanceof Storage) this.capacity.invalidateCache();
        return this.entities.removeEntity(entityId);
    }

    startAllProduction(): BaseEntity[] { return this.production.startAllProduction(); }
    stopAllProduction(): BaseEntity[] { return this.production.stopAllProduction(); }
    getProducerBuildings(): BaseEntity[] { return this.production.getProducerBuildings(); }
    getActiveProducers(): BaseEntity[] { return this.production.getActiveProducers(); }
    optimizeProduction(): ProductionOptimizationResult { return this.production.optimizeProduction(); }
    getGlobalProductionStats(): GlobalProductionStats { return this.production.getGlobalProductionStats(); }
    getProductionBottlenecks(): ProductionBottlenecks { return this.production.getProductionBottlenecks(); }

    getTotalCapacityFor(resourceId: string): number { return this.capacity.getTotalCapacityFor(resourceId); }
    hasGlobalCapacity(resourceId: string, amount: number): boolean { return this.capacity.hasGlobalCapacity(resourceId, amount); }
    getRemainingCapacityFor(resourceId: string): number { return this.capacity.getRemainingCapacityFor(resourceId); }

    addTimer(id: string, timer: Timer): void { this.timers.addTimer(id, timer); }
    removeTimer(id: string): boolean { return this.timers.removeTimer(id); }
    getTimer(id: string): Timer | undefined { return this.timers.getTimer(id); }

    checkUnlockConditions(): void { this.unlocks.checkUnlockConditions(); }
    unlockEntity(entityId: string): boolean { return this.unlocks.unlockEntity(entityId); }

    on(eventName: string, callback: (...args: unknown[]) => void): void { this.events.on(eventName, callback); }
    off(eventName: string, callback: (...args: unknown[]) => void): boolean { return this.events.off(eventName, callback); }
    emit(eventName: string, data?: unknown): void { this.events.emit(eventName, data); }

    getEventStats(): EventStats { return this.events.getEventStats(); }
    getUnlockStats() { return this.unlocks.getUnlockStats(); }
    getUnlockManager(): UnlockManager { return this.unlocks.getUnlockManager(); }
    getEventManager(): EventManager { return this.events.getEventManager(); }

    // Legacy compatibility property access
    get entityRegistry() { return this.entities; }
    get unlockManager() { return this.unlocks.getUnlockManager(); }
    get eventManager() { return this.events.getEventManager(); }

    // Legacy timer methods
    pauseTimers(): void { this.timers.pauseAllTimers(); }
    resumeTimers(): void { this.timers.resumeAllTimers(); }

    // Performance monitoring
    getPerformanceMetrics() {
        const stats = this.entities.getEntityStats();
        return this.performanceMonitor.getMetrics({
            total: stats.total,
            unlocked: stats.unlocked,
            updatable: this.entities.getUpdatableEntities().length
        });
    }

    setPerformanceMonitoring(enabled: boolean): void { this.performanceMonitor.setEnabled(enabled); }

    // ==========================================
    // PRIVATE SERVICE COORDINATION
    // ==========================================

    private wireServices(): void {
        this.gameLoop.onUpdate((deltaTime) => {
            this.performanceMonitor.recordFrameTime();
            this.updateEntities(deltaTime);
            this.timers.updateTimers(deltaTime);
            this.unlocks.checkConditions();
            this.production.optimizeProduction();
            this.pluginSystem.updatePlugins(deltaTime);
            this.updateResources(deltaTime);
        });

        this.gameState.setTotalGameTime(this.totalGameTime);
        this.gameLoop.setSpeed(this.gameSpeed);
    }

    private updateEntities(deltaTime: number): void {
        this.entities.getUpdatableEntities().forEach(entity => entity.onUpdate(deltaTime));
        this.capacity.performMaintenance();
    }

    private updateResources(deltaTime: number): void {
        this.entities.getResources().forEach(resource => {
            if (resource.isUnlocked) {
                resource.amount += resource.rate * deltaTime;
            }
        });
    }
}