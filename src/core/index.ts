// ============================================================================
// Core orchestrator and primitives
// ============================================================================
export { Game } from './game';
export { BaseEntity } from './base-entity';
export { Events } from './events';
export { Timer } from './timer';
export { SaveManager } from './save-manager';
export { Upgrade } from './upgrade';

// ============================================================================
// Services (recommended public API, accessed via Game instance)
// ============================================================================
export { EntityService } from './entity-service';
export { ProductionService } from './production-service';
export { CapacityService } from './capacity-service';
export { TimerService } from './timer-service';
export { EventService } from './event-service';
export { UnlockService } from './unlock-service';
export { GameLoopService } from './game-loop-service';
export { GameStateService } from './game-state-service';

// ============================================================================
// Engines (used internally by services; exposed for advanced / plugin use)
// ============================================================================
export { EventManager } from './event-manager';
export { UnlockManager } from './unlock-manager';
export { CostSystem, createCost, createCosts, ScalingFunctions } from './cost-system';
export { UpgradeEffectProcessor } from './upgrade-effect-processor';
export { UnlockConditionEvaluator } from './unlock-condition-evaluator';
export { PluginSystem } from './plugin-system';
export { EventBatchingSystem } from './event-batching-system';
export { PerformanceMonitor } from './performance-monitor';
export { ConfigValidator, ConfigBuilder, createConfigBuilder } from './config-validator';
export { GameReferenceMixin, isGameAware, isResourceProvider, isCapacityProvider } from './game-aware';

// ============================================================================
// Framework configuration
// ============================================================================
export {
    getConfig,
    updateConfig,
    setDebugMode,
    setLogLevel,
    setLoggerDriver,
    resetConfig,
    initializeFramework
} from './config';

// ============================================================================
// Type exports
// ============================================================================

// Entity factory configuration types (passed to game.entities.create*)
export type {
    ResourceConfig,
    BuildingConfig,
    MinerConfig,
    StorageConfig,
    UpgradeConfig,
    IEntityService
} from './entity-service';

// Service interfaces
export type { IProductionService, ProductionOptimizationResult, GlobalProductionStats, ProductionBottlenecks } from './production-service';
export type { ICapacityService } from './capacity-service';
export type { ITimerService } from './timer-service';
export type { IEventService } from './event-service';
export type { IUnlockService } from './unlock-service';
export type { IGameLoopService } from './game-loop-service';
export type { IGameStateService, GameStateStats } from './game-state-service';
export type { IGame } from './game-aware';

// Supporting types
export type { SaveData, StorageProvider } from './save-manager';
export type { FrameworkConfig } from './config';
export type { EventStats } from './event-manager';
export type { Plugin, PluginConfig, PluginInfo } from './plugin-system';
export type { BatchedEvent, EventBatchConfig } from './event-batching-system';
export type { PerformanceMetrics, PerformanceThresholds } from './performance-monitor';
export type { ValidationResult, ConfigSchema, BaseEntityConfig } from './config-validator';
export type { GameAware, ResourceProvider, CapacityProvider } from './game-aware';
