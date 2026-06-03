import { BaseEntity } from './base-entity';
import { Building } from '../entities/buildings/building';
import { ProducerBuilding } from '../entities/buildings/producer-building';
import { logger } from '../utils/logger';

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
    stoppedProducers: string[];
    blockedProducers: string[];
}

/**
 * Interface for the production service
 */
export interface IProductionService {
    // Production control
    startAllProduction(): BaseEntity[];
    stopAllProduction(): BaseEntity[];
    optimizeProduction(): ProductionOptimizationResult;
    
    // Producer management
    getProducerBuildings(): BaseEntity[];
    getActiveProducers(): BaseEntity[];
    
    // Statistics and analysis
    getGlobalProductionStats(): GlobalProductionStats;
    getProductionBottlenecks(): ProductionBottlenecks;
    
    // Resource validation
    checkResourceAvailability(inputs: Array<{resourceId: string, amount: number}>): boolean;
    checkProductionCapacity(outputs: Array<{resourceId: string, amount: number}>): boolean;
    
    // Cleanup
    destroy(): void;
}

/**
 * Service responsible for managing all production operations
 * Extracted from Game class to reduce god class anti-pattern
 */
export class ProductionService implements IProductionService {
    constructor(
        private getEntities: () => BaseEntity[],
        private getResourceById: (id: string) => { amount: number; [key: string]: unknown } | undefined,
        private hasGlobalCapacity: (resourceId: string, amount: number) => boolean
    ) {
        logger.debug('ProductionService: Initialized');
    }

    /**
     * Starts production for all producer buildings that can produce
     */
    startAllProduction(): BaseEntity[] {
        const entities = this.getEntities();
        const started: BaseEntity[] = [];

        for (const entity of entities) {
            if (entity instanceof Building && entity.isUnlocked && entity.isBuilt) {
                // Check if it's a producer building with production methods
                if ('startProduction' in entity && typeof entity.startProduction === 'function') {
                    if (this.canStartProduction(entity as any)) {
                        try {
                            (entity as any).startProduction();
                            started.push(entity);
                        } catch (error) {
                            logger.warn(`ProductionService: Failed to start production for ${entity.name}: ${error}`);
                        }
                    }
                }
            }
        }

        logger.info(`ProductionService: Started production for ${started.length} buildings`);
        return started;
    }

    /**
     * Stops production for all producer buildings
     */
    stopAllProduction(): BaseEntity[] {
        const entities = this.getEntities();
        const stopped: BaseEntity[] = [];

        for (const entity of entities) {
            if (entity instanceof Building && entity.isUnlocked) {
                // Check if it's a producer building with production methods
                if ('stopProduction' in entity && typeof entity.stopProduction === 'function') {
                    try {
                        (entity as any).stopProduction();
                        stopped.push(entity);
                    } catch (error) {
                        logger.warn(`ProductionService: Failed to stop production for ${entity.name}: ${error}`);
                    }
                }
            }
        }

        logger.info(`ProductionService: Stopped production for ${stopped.length} buildings`);
        return stopped;
    }

    /**
     * Gets all producer buildings in the game
     */
    getProducerBuildings(): BaseEntity[] {
        return this.getEntities().filter(entity => 
            entity instanceof Building && 
            entity.isUnlocked && 
            'startProduction' in entity
        );
    }

    /**
     * Gets all currently producing buildings
     */
    getActiveProducers(): BaseEntity[] {
        return this.getProducerBuildings().filter(entity => 
            'isProducing' in entity && (entity as any).isProducing
        );
    }

    /**
     * Gets production statistics across all producer buildings
     */
    getGlobalProductionStats(): GlobalProductionStats {
        const producers = this.getProducerBuildings();
        const activeProducers = this.getActiveProducers();
        
        let totalCyclesCompleted = 0;
        let totalEfficiency = 0;
        const resourceProductionRates: Record<string, number> = {};
        const resourceConsumptionRates: Record<string, number> = {};

        for (const producer of producers) {
            // Get production statistics if available
            if ('getProductionStats' in producer) {
                const stats = (producer as any).getProductionStats();
                if (stats) {
                    totalCyclesCompleted += stats.cyclesCompleted || 0;
                    totalEfficiency += stats.efficiency || 0;
                }
            }

            // Calculate production rates
            if ('getProductionConfig' in producer) {
                const config = (producer as any).getProductionConfig();
                if (config) {
                    // Track output rates
                    if (config.outputs) {
                        for (const output of config.outputs) {
                            resourceProductionRates[output.resourceId] = 
                                (resourceProductionRates[output.resourceId] || 0) + output.amount;
                        }
                    }
                    
                    // Track input rates
                    if (config.inputs) {
                        for (const input of config.inputs) {
                            resourceConsumptionRates[input.resourceId] = 
                                (resourceConsumptionRates[input.resourceId] || 0) + input.amount;
                        }
                    }
                }
            }
        }

        return {
            totalProducers: producers.length,
            activeProducers: activeProducers.length,
            totalCyclesCompleted,
            averageEfficiency: producers.length > 0 ? totalEfficiency / producers.length : 0,
            resourceProductionRates,
            resourceConsumptionRates
        };
    }

    /**
     * Checks resource availability for a specific production requirement
     */
    checkResourceAvailability(inputs: Array<{resourceId: string, amount: number}>): boolean {
        return inputs.every(input => {
            const resource = this.getResourceById(input.resourceId);
            return resource && resource.amount >= input.amount;
        });
    }

    /**
     * Checks production capacity for a specific output
     */
    checkProductionCapacity(outputs: Array<{resourceId: string, amount: number}>): boolean {
        return outputs.every(output => 
            this.hasGlobalCapacity(output.resourceId, output.amount)
        );
    }

    /**
     * Gets production bottlenecks - resources that are limiting production
     */
    getProductionBottlenecks(): ProductionBottlenecks {
        const resourceShortages: Array<{resourceId: string, required: number, available: number}> = [];
        const capacityLimits: Array<{resourceId: string, attempted: number, capacity: number}> = [];
        const stoppedProducers: string[] = [];
        const blockedProducers: string[] = [];

        const producers = this.getProducerBuildings();

        for (const producer of producers) {
            if (!('isProducing' in producer) || !('getProductionConfig' in producer)) {
                continue;
            }

            const isProducing = (producer as any).isProducing();
            const config = (producer as any).getProductionConfig();

            if (!isProducing) {
                stoppedProducers.push(producer.id);
                
                if (config) {
                    // Check for resource shortages
                    if (config.inputs) {
                        for (const input of config.inputs) {
                            const resource = this.getResourceById(input.resourceId);
                            if (!resource || resource.amount < input.amount) {
                                resourceShortages.push({
                                    resourceId: input.resourceId,
                                    required: input.amount,
                                    available: resource?.amount || 0
                                });
                            }
                        }
                    }

                    // Check for capacity issues
                    if (config.outputs) {
                        for (const output of config.outputs) {
                            if (!this.hasGlobalCapacity(output.resourceId, output.amount)) {
                                blockedProducers.push(producer.id);
                                // Note: We can't easily get total capacity here without additional dependencies
                                capacityLimits.push({
                                    resourceId: output.resourceId,
                                    attempted: output.amount,
                                    capacity: 0 // Would need capacity service integration
                                });
                            }
                        }
                    }
                }
            }
        }

        return {
            resourceShortages,
            capacityLimits,
            stoppedProducers,
            blockedProducers
        };
    }

    /**
     * Optimizes production by starting/stopping producers based on resource availability
     */
    optimizeProduction(): ProductionOptimizationResult {
        const producers = this.getProducerBuildings();
        let started = 0;
        let stopped = 0;
        const bottlenecks: string[] = [];

        for (const producer of producers) {
            if (!('isProducing' in producer)) continue;

            const isProducing = (producer as any).isProducing;

            if (!isProducing && this.canStartProduction(producer as any)) {
                try {
                    (producer as any).startProduction();
                    started++;
                } catch (error) {
                    logger.warn(`ProductionService: Failed to start production for ${producer.name}: ${error}`);
                }
            } else if (isProducing && !this.canContinueProduction(producer as any)) {
                try {
                    (producer as any).stopProduction();
                    stopped++;
                    bottlenecks.push(...this.getProductionIssues(producer as any));
                } catch (error) {
                    logger.warn(`ProductionService: Failed to stop production for ${producer.name}: ${error}`);
                }
            }
        }

        logger.debug(`ProductionService: Optimization complete - started: ${started}, stopped: ${stopped}`);
        return {
            started,
            stopped,
            bottlenecks: [...new Set(bottlenecks)], // Remove duplicates
            totalChecked: producers.length
        };
    }

    /**
     * Checks if a producer can start production
     */
    private canStartProduction(producer: any): boolean {
        if (!producer.isBuilt) {
            return false;
        }

        const config = producer.getProductionConfig?.();
        if (!config) {
            return true; // No config means no restrictions
        }

        // Check input resource availability
        if (config.inputs && !this.hasInputResources(producer)) {
            return false;
        }

        // Check output capacity
        if (config.outputs && !this.hasOutputCapacity(producer)) {
            return false;
        }

        return true;
    }

    /**
     * Checks if a producer can continue production
     */
    private canContinueProduction(producer: any): boolean {
        return this.canStartProduction(producer);
    }

    /**
     * Checks if producer has required input resources
     */
    private hasInputResources(producer: any): boolean {
        const config = producer.getProductionConfig?.();
        if (!config?.inputs) {
            return true; // No inputs required
        }

        return config.inputs.every((input: any) => {
            const resource = this.getResourceById(input.resourceId);
            return resource && resource.amount >= input.amount;
        });
    }

    /**
     * Checks if producer has capacity for outputs
     */
    private hasOutputCapacity(producer: any): boolean {
        const config = producer.getProductionConfig?.();
        if (!config?.outputs) {
            return true; // No outputs produced
        }

        return config.outputs.every((output: any) => {
            return this.hasGlobalCapacity(output.resourceId, output.amount);
        });
    }

    /**
     * Gets a list of issues preventing a producer from operating
     */
    private getProductionIssues(producer: any): string[] {
        const issues: string[] = [];
        const config = producer.getProductionConfig?.();

        if (config) {
            // Check for resource shortages
            if (config.inputs) {
                for (const input of config.inputs) {
                    const resource = this.getResourceById(input.resourceId);
                    if (!resource || resource.amount < input.amount) {
                        issues.push(input.resourceId);
                    }
                }
            }

            // Check for capacity issues
            if (config.outputs) {
                for (const output of config.outputs) {
                    if (!this.hasGlobalCapacity(output.resourceId, output.amount)) {
                        issues.push(output.resourceId);
                    }
                }
            }
        }

        return issues;
    }

    /**
     * Cleanup method to release resources
     */
    destroy(): void {
        logger.info('ProductionService: Destroyed');
    }
}