/**
 * Configuration validation and default value management system
 * Provides runtime validation and type safety for entity configurations
 */

import { logger } from "../utils/logger";

/**
 * Validation result for configuration checks
 */
export interface ValidationResult<T> {
    /** Whether validation passed */
    isValid: boolean;
    /** Validated and normalized configuration */
    config: T;
    /** Array of validation errors if any */
    errors: string[];
    /** Array of warnings for non-critical issues */
    warnings: string[];
}

/**
 * Base configuration schema interface
 */
export interface ConfigSchema<T> {
    /** Schema name for debugging */
    name: string;
    /** Validation function */
    validate: (config: unknown) => ValidationResult<T>;
    /** Default values provider */
    getDefaults: () => Partial<T>;
}

/**
 * Base entity configuration
 */
export interface BaseEntityConfig {
    id?: string;
    name: string;
    description?: string;
    tags?: string[];
    unlockCondition?: () => boolean;
    isUnlocked?: boolean;
}

/**
 * Building configuration
 */
export interface BuildingConfig extends BaseEntityConfig {
    costs?: Array<{ resourceId: string; amount: number; scalingFactor?: number }>;
    cost?: Record<string, number>; // Legacy format
    buildTime?: number;
    productionRate?: number;
    level?: number;
}

/**
 * Resource configuration
 */
export interface ResourceConfig extends BaseEntityConfig {
    initialAmount?: number;
    maxAmount?: number;
    rate?: number;
    basePassiveRate?: number;
}

/**
 * Storage configuration
 */
export interface StorageConfig extends BuildingConfig {
    capacities?: Record<string, number>;
}

/**
 * Configuration validator with built-in schemas
 */
export class ConfigValidator {
    
    /**
     * Validates base entity configuration
     * @param config - Configuration to validate
     * @returns Validation result
     */
    static validateBaseEntity(config: unknown): ValidationResult<BaseEntityConfig> {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!config || typeof config !== 'object') {
            return {
                isValid: false,
                config: {} as BaseEntityConfig,
                errors: ['Configuration must be an object'],
                warnings: []
            };
        }
        
        const cfg = config as Record<string, unknown>;
        const result: BaseEntityConfig = {
            name: ''
        };
        
        // Validate required fields
        if (!cfg.name || typeof cfg.name !== 'string' || cfg.name.trim().length === 0) {
            errors.push('Name is required and must be a non-empty string');
        } else {
            result.name = cfg.name.trim();
        }
        
        // Validate optional fields
        if (cfg.id !== undefined) {
            if (typeof cfg.id !== 'string' || cfg.id.trim().length === 0) {
                warnings.push('ID should be a non-empty string, will auto-generate if invalid');
            } else {
                result.id = cfg.id.trim();
            }
        }
        
        if (cfg.description !== undefined) {
            if (typeof cfg.description === 'string') {
                result.description = cfg.description;
            } else {
                warnings.push('Description should be a string, ignoring invalid value');
            }
        }
        
        if (cfg.tags !== undefined) {
            if (Array.isArray(cfg.tags) && cfg.tags.every((tag: unknown) => typeof tag === 'string')) {
                result.tags = cfg.tags;
            } else {
                warnings.push('Tags should be an array of strings, ignoring invalid value');
            }
        }
        
        if (cfg.unlockCondition !== undefined) {
            if (typeof cfg.unlockCondition === 'function') {
                result.unlockCondition = cfg.unlockCondition;
            } else {
                warnings.push('Unlock condition should be a function, ignoring invalid value');
            }
        }
        
        if (cfg.isUnlocked !== undefined) {
            if (typeof cfg.isUnlocked === 'boolean') {
                result.isUnlocked = cfg.isUnlocked;
            } else {
                warnings.push('isUnlocked should be a boolean, ignoring invalid value');
            }
        }
        
        return {
            isValid: errors.length === 0,
            config: result,
            errors,
            warnings
        };
    }
    
    /**
     * Validates building configuration
     * @param config - Configuration to validate
     * @returns Validation result
     */
    static validateBuilding(config: unknown): ValidationResult<BuildingConfig> {
        const baseResult = this.validateBaseEntity(config);
        if (!baseResult.isValid) {
            return baseResult as ValidationResult<BuildingConfig>;
        }
        
        const errors = [...baseResult.errors];
        const warnings = [...baseResult.warnings];
        const cfg = config as Record<string, unknown>;
        
        const result: BuildingConfig = {
            ...baseResult.config,
            buildTime: 0,
            productionRate: 0,
            level: 1
        };
        
        // Validate costs
        if (cfg.costs !== undefined) {
            if (Array.isArray(cfg.costs)) {
                const validCosts = cfg.costs.filter((cost: unknown) => {
                    if (!cost || typeof cost !== 'object') return false;
                    if (typeof cost.resourceId !== 'string' || cost.resourceId.trim().length === 0) return false;
                    if (typeof cost.amount !== 'number' || cost.amount < 0) return false;
                    return true;
                });
                
                if (validCosts.length !== cfg.costs.length) {
                    warnings.push('Some cost entries were invalid and ignored');
                }
                
                result.costs = validCosts.map((cost: Record<string, unknown>) => ({
                    resourceId: cost.resourceId,
                    amount: cost.amount,
                    scalingFactor: typeof cost.scalingFactor === 'number' ? cost.scalingFactor : 1.2
                }));
            } else {
                warnings.push('Costs should be an array, ignoring invalid value');
            }
        }
        
        // Handle legacy cost format
        if (cfg.cost !== undefined && !result.costs) {
            if (typeof cfg.cost === 'object' && cfg.cost !== null) {
                const costs = Object.entries(cfg.cost).filter(([key, value]) => 
                    typeof key === 'string' && typeof value === 'number' && value >= 0
                );
                
                if (costs.length > 0) {
                    result.cost = Object.fromEntries(costs) as Record<string, number>;
                } else {
                    warnings.push('Legacy cost format contains invalid entries, ignoring');
                }
            } else {
                warnings.push('Legacy cost should be an object, ignoring invalid value');
            }
        }
        
        // Validate numeric fields
        if (cfg.buildTime !== undefined) {
            if (typeof cfg.buildTime === 'number' && cfg.buildTime >= 0) {
                result.buildTime = cfg.buildTime;
            } else {
                warnings.push('Build time should be a non-negative number, using default');
            }
        }
        
        if (cfg.productionRate !== undefined) {
            if (typeof cfg.productionRate === 'number' && cfg.productionRate >= 0) {
                result.productionRate = cfg.productionRate;
            } else {
                warnings.push('Production rate should be a non-negative number, using default');
            }
        }
        
        if (cfg.level !== undefined) {
            if (typeof cfg.level === 'number' && cfg.level >= 1 && Number.isInteger(cfg.level)) {
                result.level = cfg.level;
            } else {
                warnings.push('Level should be a positive integer, using default');
            }
        }
        
        return {
            isValid: errors.length === 0,
            config: result,
            errors,
            warnings
        };
    }
    
    /**
     * Validates resource configuration
     * @param config - Configuration to validate
     * @returns Validation result
     */
    static validateResource(config: unknown): ValidationResult<ResourceConfig> {
        const baseResult = this.validateBaseEntity(config);
        if (!baseResult.isValid) {
            return baseResult as ValidationResult<ResourceConfig>;
        }
        
        const errors = [...baseResult.errors];
        const warnings = [...baseResult.warnings];
        const cfg = config as Record<string, unknown>;
        
        const result: ResourceConfig = {
            ...baseResult.config,
            initialAmount: 0,
            rate: 0,
            basePassiveRate: 0
        };
        
        // Validate numeric fields
        if (cfg.initialAmount !== undefined) {
            if (typeof cfg.initialAmount === 'number' && cfg.initialAmount >= 0) {
                result.initialAmount = cfg.initialAmount;
            } else {
                warnings.push('Initial amount should be a non-negative number, using default');
            }
        }
        
        if (cfg.maxAmount !== undefined) {
            if (typeof cfg.maxAmount === 'number' && cfg.maxAmount >= 0) {
                result.maxAmount = cfg.maxAmount;
            } else {
                warnings.push('Max amount should be a non-negative number, ignoring invalid value');
            }
        }
        
        if (cfg.rate !== undefined) {
            if (typeof cfg.rate === 'number') {
                result.rate = cfg.rate;
            } else {
                warnings.push('Rate should be a number, using default');
            }
        }
        
        if (cfg.basePassiveRate !== undefined) {
            if (typeof cfg.basePassiveRate === 'number') {
                result.basePassiveRate = cfg.basePassiveRate;
            } else {
                warnings.push('Base passive rate should be a number, using default');
            }
        }
        
        return {
            isValid: errors.length === 0,
            config: result,
            errors,
            warnings
        };
    }
    
    /**
     * Validates storage configuration
     * @param config - Configuration to validate
     * @returns Validation result
     */
    static validateStorage(config: unknown): ValidationResult<StorageConfig> {
        const buildingResult = this.validateBuilding(config);
        if (!buildingResult.isValid) {
            return buildingResult as ValidationResult<StorageConfig>;
        }
        
        const errors = [...buildingResult.errors];
        const warnings = [...buildingResult.warnings];
        const cfg = config as Record<string, unknown>;
        
        const result: StorageConfig = {
            ...buildingResult.config
        };
        
        // Validate capacities
        if (cfg.capacities !== undefined) {
            if (typeof cfg.capacities === 'object' && cfg.capacities !== null) {
                const validCapacities = Object.entries(cfg.capacities).filter(([key, value]) => 
                    typeof key === 'string' && 
                    key.trim().length > 0 &&
                    typeof value === 'number' && 
                    value > 0
                );
                
                if (validCapacities.length > 0) {
                    result.capacities = Object.fromEntries(validCapacities) as Record<string, number>;
                } else {
                    warnings.push('No valid capacity entries found, storage will have no limits');
                }
                
                if (validCapacities.length !== Object.entries(cfg.capacities).length) {
                    warnings.push('Some capacity entries were invalid and ignored');
                }
            } else {
                warnings.push('Capacities should be an object, ignoring invalid value');
            }
        }
        
        return {
            isValid: errors.length === 0,
            config: result,
            errors,
            warnings
        };
    }
    
    /**
     * Validates any configuration with logging
     * @param config - Configuration to validate
     * @param validator - Validation function to use
     * @param entityName - Name of the entity for logging
     * @returns Validated configuration
     */
    static validateWithLogging<T>(
        config: unknown, 
        validator: (config: unknown) => ValidationResult<T>,
        entityName: string = 'Entity'
    ): T {
        const result = validator(config);
        
        if (result.warnings.length > 0) {
            logger.warn(`${entityName} configuration warnings: ${JSON.stringify(result.warnings)}`);
        }
        
        if (!result.isValid) {
            logger.error(`${entityName} configuration errors: ${JSON.stringify(result.errors)}`);
            throw new Error(`Invalid ${entityName.toLowerCase()} configuration: ${result.errors.join(', ')}`);
        }
        
        return result.config;
    }
}

/**
 * Configuration builder with fluent API
 */
export class ConfigBuilder<T> {
    private config: Partial<T> = {};
    
    /**
     * Sets a property value
     * @param key - Property key
     * @param value - Property value
     * @returns Builder instance for chaining
     */
    set<K extends keyof T>(key: K, value: T[K]): this {
        this.config[key] = value;
        return this;
    }
    
    /**
     * Sets multiple properties at once
     * @param properties - Object with properties to set
     * @returns Builder instance for chaining
     */
    merge(properties: Partial<T>): this {
        Object.assign(this.config, properties);
        return this;
    }
    
    /**
     * Builds the final configuration
     * @param validator - Validation function to use
     * @returns Validated configuration
     */
    build<R>(validator: (config: unknown) => ValidationResult<R>): R {
        const result = validator(this.config);
        
        if (!result.isValid) {
            throw new Error(`Configuration validation failed: ${result.errors.join(', ')}`);
        }
        
        return result.config;
    }
    
    /**
     * Gets the current configuration without validation
     * @returns Current configuration
     */
    get(): Partial<T> {
        return { ...this.config };
    }
}

/**
 * Creates a new configuration builder
 * @returns New ConfigBuilder instance
 */
export function createConfigBuilder<T>(): ConfigBuilder<T> {
    return new ConfigBuilder<T>();
}