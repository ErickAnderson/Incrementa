import { Building } from "../entities/buildings/building";
import { ProducerBuilding } from "../entities/buildings/producer-building";
import { EventManager } from "./event-manager";
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
}