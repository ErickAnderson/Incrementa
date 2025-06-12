import { LogLevel, LoggerDriverType, logger } from '../utils/logger';

/**
 * Configuration interface for the Incrementa framework
 */
export interface FrameworkConfig {
    /** Whether debug mode is enabled (controls all logging output) */
    debugMode: boolean;
    /** Minimum log level to output */
    logLevel: LogLevel;
    /** Type of logger driver to use */
    loggerDriver: LoggerDriverType;
    /** Optional file path for file logging */
    fileLogPath?: string;
    /** Optional file writer function for file logging */
    fileWriter?: (path: string, data: string) => void | Promise<void>;
}

/**
 * Default framework configuration
 */
export const defaultConfig: FrameworkConfig = {
    debugMode: false,
    logLevel: LogLevel.INFO,
    loggerDriver: 'web',
    fileLogPath: undefined,
    fileWriter: undefined
};

/**
 * Current framework configuration (mutable copy of defaults)
 */
let currentConfig: FrameworkConfig = { ...defaultConfig };

/**
 * Get the current framework configuration
 * @returns Current configuration object
 */
export function getConfig(): Readonly<FrameworkConfig> {
    return { ...currentConfig };
}

/**
 * Update the framework configuration
 * @param newConfig - Partial configuration to merge with current config
 */
export function updateConfig(newConfig: Partial<FrameworkConfig>): void {
    const previousConfig = { ...currentConfig };
    currentConfig = { ...currentConfig, ...newConfig };
    
    // Apply configuration changes to the logger
    applyConfigToLogger(previousConfig, currentConfig);
}

/**
 * Set debug mode on or off
 * @param enabled - Whether to enable debug mode
 */
export function setDebugMode(enabled: boolean): void {
    updateConfig({ debugMode: enabled });
}

/**
 * Set the minimum log level
 * @param level - Minimum log level to output
 */
export function setLogLevel(level: LogLevel): void {
    updateConfig({ logLevel: level });
}

/**
 * Set the logger driver type
 * @param driverType - Type of driver to use
 * @param fileConfig - Optional file configuration for file driver
 */
export function setLoggerDriver(
    driverType: LoggerDriverType, 
    fileConfig?: { filePath: string; fileWriter: (path: string, data: string) => void | Promise<void> }
): void {
    const update: Partial<FrameworkConfig> = { loggerDriver: driverType };
    
    if (driverType === 'file' && fileConfig) {
        update.fileLogPath = fileConfig.filePath;
        update.fileWriter = fileConfig.fileWriter;
    }
    
    updateConfig(update);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
    currentConfig = { ...defaultConfig };
    applyConfigToLogger({} as FrameworkConfig, currentConfig);
}

/**
 * Internal function to apply configuration changes to the logger
 * @private
 */
function applyConfigToLogger(previousConfig: FrameworkConfig, newConfig: FrameworkConfig): void {
    const loggerInstance = logger;
    
    // Update debug mode
    if (previousConfig.debugMode !== newConfig.debugMode) {
        loggerInstance.setDebugMode(newConfig.debugMode);
    }
    
    // Update log level
    if (previousConfig.logLevel !== newConfig.logLevel) {
        loggerInstance.setLogLevel(newConfig.logLevel);
    }
    
    // Update logger driver
    if (previousConfig.loggerDriver !== newConfig.loggerDriver ||
        (newConfig.loggerDriver === 'file' && 
         (previousConfig.fileLogPath !== newConfig.fileLogPath || 
          previousConfig.fileWriter !== newConfig.fileWriter))) {
        
        if (newConfig.loggerDriver === 'file') {
            if (!newConfig.fileLogPath || !newConfig.fileWriter) {
                throw new Error('File logging requires both fileLogPath and fileWriter to be configured');
            }
            
            loggerInstance.setDriver('file', {
                filePath: newConfig.fileLogPath,
                fileWriter: newConfig.fileWriter
            });
        } else {
            loggerInstance.setDriver(newConfig.loggerDriver);
        }
    }
}

/**
 * Initialize the framework with optional configuration
 * @param config - Optional initial configuration
 */
export function initializeFramework(config?: Partial<FrameworkConfig>): void {
    if (config) {
        updateConfig(config);
    } else {
        // Apply default configuration to logger
        applyConfigToLogger({} as FrameworkConfig, currentConfig);
    }
}

// Initialize with defaults on module load
initializeFramework();