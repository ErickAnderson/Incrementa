import { Building } from "../entities/buildings/building";
import { ProducerBuilding } from "../entities/buildings/producer-building";
import { EventManager } from "./event-manager";
import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";

/**
 * Result of production optimization operation
 */
export interface ProductionOptimizationResult {
    /** Number of producers that were started */
    started: number;
    /** Number of producers that were stopped */
    stopped: number;
    /** List of resource IDs that are bottlenecks */
    bottlenecks: string[];
    /** Total number of producers checked */
    totalChecked: number;
}

/**
 * Production chain validation result
 */
export interface ProductionChainValidation {
    /** Whether the production chain is valid */
    isValid: boolean;
    /** List of missing resource IDs */
    missingResources: string[];
    /** List of capacity issues */
    capacityIssues: string[];
}

/**
 * Global production statistics
 */
export interface GlobalProductionStats {
    totalProducers: number;
    activeProducers: number;
    totalCyclesCompleted: number;
    averageEfficiency: number;
    resourceProductionRates: Record<string, number>;
    resourceConsumptionRates: Record<string, number>;
}

/**
 * Production bottlenecks analysis
 */
export interface ProductionBottlenecks {
    resourceShortages: Array<{resourceId: string, required: number, available: number}>;
    capacityLimits: Array<{resourceId: string, attempted: number, capacity: number}>;
    stoppedProducers: Array<{entityId: string, name: string, reason: string}>;
}

/**
 * Manages all production-related operations for the game
 * Handles producer optimization, validation, and coordination
 */
export class ProductionManager {
    private eventManager: EventManager;
    
    /**
     * Creates a new ProductionManager instance
     * @param eventManager - The event manager for emitting production events
     */
    constructor(eventManager: EventManager) {
        this.eventManager = eventManager;
    }

    /**
     * Optimizes production across all producer buildings
     * Automatically starts/stops producers based on resource availability and capacity
     * @param buildings - Array of all buildings to optimize
     * @param getResourceById - Function to get resource by ID
     * @param hasGlobalCapacity - Function to check global capacity
     * @returns Optimization results with counts and bottlenecks
     */
    optimizeProduction(
        buildings: Building[],
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ): ProductionOptimizationResult {
        const result: ProductionOptimizationResult = {
            started: 0,
            stopped: 0,
            bottlenecks: [],
            totalChecked: 0
        };

        const bottleneckSet = new Set<string>();
        const producerBuildings = buildings.filter(building => 
            building instanceof ProducerBuilding && building.isBuilt
        ) as ProducerBuilding[];

        logger.debug(`ProductionManager: Optimizing ${producerBuildings.length} producer buildings`);

        for (const producer of producerBuildings) {
            result.totalChecked++;

            try {
                const shouldProduce = this.shouldProducerOperate(
                    producer,
                    getResourceById,
                    hasGlobalCapacity
                );

                if (shouldProduce && !producer.isProducing) {
                    if (this.startProducer(producer, getResourceById)) {
                        result.started++;
                        logger.debug(`ProductionManager: Started producer ${producer.name}`);
                    } else {
                        // Track what prevented starting
                        const issues = this.getProductionIssues(producer, getResourceById, hasGlobalCapacity);
                        issues.forEach(issue => bottleneckSet.add(issue));
                    }
                } else if (!shouldProduce && producer.isProducing) {
                    if (this.stopProducer(producer)) {
                        result.stopped++;
                        logger.debug(`ProductionManager: Stopped producer ${producer.name}`);
                    }
                }
            } catch (error) {
                logger.error(`ProductionManager: Error optimizing producer ${producer.name}: ${error}`);
            }
        }

        result.bottlenecks = Array.from(bottleneckSet);

        if (result.started > 0 || result.stopped > 0) {
            logger.info(`ProductionManager: Optimization complete - Started: ${result.started}, Stopped: ${result.stopped}, Bottlenecks: ${result.bottlenecks.length}`);
        }

        // Emit optimization event
        this.eventManager.emitSystemEvent('productionOptimized', result);

        return result;
    }

    /**
     * Validates the entire production chain for potential issues
     * @param buildings - Array of all buildings to validate
     * @param getResourceById - Function to get resource by ID
     * @returns Validation result with issues identified
     */
    validateProductionChain(
        buildings: Building[],
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined
    ): ProductionChainValidation {
        const validation: ProductionChainValidation = {
            isValid: true,
            missingResources: [],
            capacityIssues: []
        };

        const producerBuildings = buildings.filter(building => 
            building instanceof ProducerBuilding
        ) as ProducerBuilding[];

        const requiredResources = new Set<string>();
        const producedResources = new Set<string>();

        // Analyze what resources are required vs produced
        for (const producer of producerBuildings) {
            const config = producer.getProductionConfig();
            if (config) {
                // Add input requirements
                config.inputs?.forEach(input => {
                    requiredResources.add(input.resourceId);
                });

                // Add output production
                config.outputs?.forEach(output => {
                    producedResources.add(output.resourceId);
                });
            }
        }

        // Check for missing resources
        for (const resourceId of requiredResources) {
            const resource = getResourceById(resourceId);
            if (!resource) {
                validation.missingResources.push(resourceId);
                validation.isValid = false;
            }
        }

        logger.debug(`ProductionManager: Validation complete - Required: ${requiredResources.size}, Produced: ${producedResources.size}, Missing: ${validation.missingResources.length}`);

        return validation;
    }

    /**
     * Determines if a producer should be operating based on current conditions
     * @param producer - The producer building to check
     * @param getResourceById - Function to get resource by ID
     * @param hasGlobalCapacity - Function to check global capacity
     * @returns Whether the producer should be operating
     */
    private shouldProducerOperate(
        producer: ProducerBuilding,
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ): boolean {
        if (!producer.isUnlocked || !producer.isBuilt) {
            return false;
        }

        // Check if inputs are available
        if (!this.hasRequiredInputs(producer, getResourceById)) {
            return false;
        }

        // Check if outputs have capacity
        if (!this.hasOutputCapacity(producer, hasGlobalCapacity)) {
            return false;
        }

        return true;
    }

    /**
     * Starts a producer if conditions are met
     * @param producer - The producer to start
     * @param getResourceById - Function to get resource by ID
     * @returns Whether the producer was successfully started
     */
    private startProducer(
        producer: ProducerBuilding,
        _getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined
    ): boolean {
        try {
            if (typeof producer.startProduction === 'function') {
                const success = producer.startProduction();
                if (success) {
                    this.eventManager.emitSystemEvent('producerStarted', {
                        producerId: producer.id,
                        producerName: producer.name
                    });
                }
                return success;
            }
            return false;
        } catch (error) {
            logger.error(`ProductionManager: Failed to start producer ${producer.name}: ${error}`);
            return false;
        }
    }

    /**
     * Stops a producer
     * @param producer - The producer to stop
     * @returns Whether the producer was successfully stopped
     */
    private stopProducer(producer: ProducerBuilding): boolean {
        try {
            if (typeof producer.stopProduction === 'function') {
                const wasProducing = producer.isProducing;
                producer.stopProduction();
                if (wasProducing) {
                    this.eventManager.emitSystemEvent('producerStopped', {
                        producerId: producer.id,
                        producerName: producer.name
                    });
                }
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`ProductionManager: Failed to stop producer ${producer.name}: ${error}`);
            return false;
        }
    }

    /**
     * Checks if a producer has all required input resources
     * @param producer - The producer to check
     * @param getResourceById - Function to get resource by ID
     * @returns Whether all inputs are available
     */
    private hasRequiredInputs(
        producer: ProducerBuilding,
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined
    ): boolean {
        const config = producer.getProductionConfig();
        if (!config?.inputs) {
            return true; // No inputs required
        }

        return config.inputs.every(input => {
            const resource = getResourceById(input.resourceId);
            return resource && resource.amount >= input.amount;
        });
    }

    /**
     * Checks if a producer has capacity for all output resources
     * @param producer - The producer to check
     * @param hasGlobalCapacity - Function to check global capacity
     * @returns Whether all outputs have capacity
     */
    private hasOutputCapacity(
        producer: ProducerBuilding,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ): boolean {
        const config = producer.getProductionConfig();
        if (!config?.outputs) {
            return true; // No outputs produced
        }

        return config.outputs.every(output => {
            return hasGlobalCapacity(output.resourceId, output.amount);
        });
    }

    /**
     * Gets a list of issues preventing a producer from operating
     * @param producer - The producer to analyze
     * @param getResourceById - Function to get resource by ID
     * @param hasGlobalCapacity - Function to check global capacity
     * @returns Array of resource IDs that are causing issues
     */
    private getProductionIssues(
        producer: ProducerBuilding,
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ): string[] {
        const issues: string[] = [];

        const config = producer.getProductionConfig();
        
        // Check input availability
        if (config?.inputs) {
            for (const input of config.inputs) {
                const resource = getResourceById(input.resourceId);
                if (!resource || resource.amount < input.amount) {
                    issues.push(input.resourceId);
                }
            }
        }

        // Check output capacity
        if (config?.outputs) {
            for (const output of config.outputs) {
                if (!hasGlobalCapacity(output.resourceId, output.amount)) {
                    issues.push(output.resourceId);
                }
            }
        }

        return issues;
    }

    /**
     * Starts production for all producer buildings that can produce
     * @param entities - Array of all entities to check
     * @param getResourceById - Function to get resource by ID
     * @param hasGlobalCapacity - Function to check global capacity
     * @returns Array of buildings that started production
     */
    startAllProduction(
        entities: BaseEntity[],
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ): BaseEntity[] {
        const startedBuildings: BaseEntity[] = [];
        
        for (const entity of entities) {
            if (entity.isUnlocked && 'startProduction' in entity && 'canProduce' in entity) {
                const producer = entity as Record<string, unknown> & BaseEntity;
                if (typeof producer.canProduce === 'function' && !producer.isCurrentlyProducing()) {
                    // Check if the producer should start based on resources and capacity
                    if (this.shouldProducerOperate(
                        producer as ProducerBuilding,
                        getResourceById,
                        hasGlobalCapacity
                    )) {
                        if (typeof producer.startProduction === 'function' && producer.startProduction()) {
                            startedBuildings.push(entity);
                        }
                    }
                }
            }
        }
        
        logger.info(`ProductionManager: Started production for ${startedBuildings.length} buildings`);
        
        // Emit event
        this.eventManager.emitSystemEvent('allProductionStarted', {
            count: startedBuildings.length,
            entities: startedBuildings.map(e => ({ id: e.id, name: e.name }))
        });
        
        return startedBuildings;
    }

    /**
     * Stops production for all producer buildings
     * @param entities - Array of all entities to check
     * @returns Array of buildings that stopped production
     */
    stopAllProduction(entities: BaseEntity[]): BaseEntity[] {
        const stoppedBuildings: BaseEntity[] = [];
        
        for (const entity of entities) {
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
        
        logger.info(`ProductionManager: Stopped production for ${stoppedBuildings.length} buildings`);
        
        // Emit event
        this.eventManager.emitSystemEvent('allProductionStopped', {
            count: stoppedBuildings.length,
            entities: stoppedBuildings.map(e => ({ id: e.id, name: e.name }))
        });
        
        return stoppedBuildings;
    }

    /**
     * Gets all producer buildings in the game
     * @param entities - Array of all entities to filter
     * @returns Array of producer building entities
     */
    getProducerBuildings(entities: BaseEntity[]): BaseEntity[] {
        const producers: BaseEntity[] = [];
        
        for (const entity of entities) {
            if ('startProduction' in entity && 'stopProduction' in entity) {
                producers.push(entity);
            }
        }
        
        return producers;
    }

    /**
     * Gets all currently producing buildings
     * @param entities - Array of all entities to filter
     * @returns Array of buildings that are actively producing
     */
    getActiveProducers(entities: BaseEntity[]): BaseEntity[] {
        const activeProducers: BaseEntity[] = [];
        
        for (const entity of entities) {
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
     * @param entities - Array of all entities to analyze
     * @returns Aggregated production statistics
     */
    getGlobalProductionStats(entities: BaseEntity[]): GlobalProductionStats {
        const producers = this.getProducerBuildings(entities);
        const activeProducers = this.getActiveProducers(entities);
        
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
     * @param getResourceById - Function to get resource by ID
     * @returns Whether all input resources are available
     */
    checkResourceAvailability(
        inputs: Array<{resourceId: string, amount: number}>,
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined
    ): boolean {
        return inputs.every(input => {
            const resource = getResourceById(input.resourceId);
            return resource && resource.amount >= input.amount;
        });
    }

    /**
     * Checks production capacity for a specific output
     * @param outputs - Array of resource outputs
     * @param hasGlobalCapacity - Function to check global capacity
     * @returns Whether all outputs can be stored
     */
    checkProductionCapacity(
        outputs: Array<{resourceId: string, amount: number}>,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ): boolean {
        return outputs.every(output => {
            return hasGlobalCapacity(output.resourceId, output.amount);
        });
    }

    /**
     * Gets production bottlenecks - resources that are limiting production
     * @param entities - Array of all entities to analyze
     * @param getResourceById - Function to get resource by ID
     * @param hasGlobalCapacity - Function to check global capacity
     * @param getTotalCapacityFor - Function to get total capacity for a resource
     * @returns Object describing current production bottlenecks
     */
    getProductionBottlenecks(
        entities: BaseEntity[],
        getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined,
        hasGlobalCapacity: (resourceId: string, amount: number) => boolean,
        getTotalCapacityFor: (resourceId: string) => number
    ): ProductionBottlenecks {
        const resourceShortages: Array<{resourceId: string, required: number, available: number}> = [];
        const capacityLimits: Array<{resourceId: string, attempted: number, capacity: number}> = [];
        const stoppedProducers: Array<{entityId: string, name: string, reason: string}> = [];
        
        for (const entity of this.getProducerBuildings(entities)) {
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
                            const resource = getResourceById(input.resourceId);
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
                            if (!hasGlobalCapacity(output.resourceId, output.amount)) {
                                const capacity = getTotalCapacityFor(output.resourceId);
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
}