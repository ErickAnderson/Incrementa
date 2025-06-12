export { Game } from './game';
export { BaseEntity } from './base-entity';
export { Events } from './events';
export { Timer } from './timer';
export { SaveManager } from './saveManager';
export { Upgrade } from './upgrade';
export { 
    getConfig,
    updateConfig,
    setDebugMode,
    setLogLevel,
    setLoggerDriver,
    resetConfig,
    initializeFramework
} from './config';

export type { SaveData, StorageProvider } from './saveManager';
export type { FrameworkConfig } from './config'; 