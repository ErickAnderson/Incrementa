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