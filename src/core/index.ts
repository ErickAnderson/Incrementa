export { Game } from './game';
export { BaseEntity } from './base-entity';
export { Events } from './events';
export { Timer } from './timer';
export { SaveManager } from './save-manager';
export { Upgrade } from './upgrade';
export { UnlockManager } from './unlock-manager';
export { EventManager } from './event-manager';
export { CostSystem, createCost, createCosts, ScalingFunctions } from './cost-system';
export { UpgradeEffectProcessor } from './upgrade-effect-processor';
export { UnlockConditionEvaluator } from './unlock-condition-evaluator';
export { ProductionManager } from './production-manager';
export { CapacityManager } from './capacity-manager';
export { EntityRegistry } from './entity-registry';
export { PluginSystem } from './plugin-system';
export { EventBatchingSystem } from './event-batching-system';
export { PerformanceMonitor } from './performance-monitor';
export { ConfigValidator, ConfigBuilder, createConfigBuilder } from './config-validator';
export { GameReferenceMixin, isGameAware, isResourceProvider, isCapacityProvider } from './game-aware';
export { 
    getConfig,
    updateConfig,
    setDebugMode,
    setLogLevel,
    setLoggerDriver,
    resetConfig,
    initializeFramework
} from './config';

export type { SaveData, StorageProvider } from './save-manager';
export type { FrameworkConfig } from './config';
export type { EventStats } from './event-manager';
export type { Plugin, PluginConfig, PluginInfo } from './plugin-system';
export type { ProductionOptimizationResult } from './production-manager';
export type { CapacityInfo } from './capacity-manager';
export type { EntityRegistrationResult, EntityStats } from './entity-registry';
export type { BatchedEvent, EventBatchConfig } from './event-batching-system';
export type { PerformanceMetrics, PerformanceThresholds } from './performance-monitor';
export type { 
    ValidationResult, ConfigSchema, BaseEntityConfig, BuildingConfig, 
    ResourceConfig, StorageConfig 
} from './config-validator';
export type { 
    GameAware, ResourceProvider, CapacityProvider 
} from './game-aware'; 