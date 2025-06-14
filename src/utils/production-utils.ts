/**
 * Utility functions for production-related operations
 * Reduces code duplication across production buildings
 */

import { logger } from "./logger";

/**
 * Production input/output configuration
 */
export interface ProductionConfig {
    inputs: Array<{ resourceId: string; amount: number }>;
    outputs: Array<{ resourceId: string; amount: number }>;
}

/**
 * Game interface for production utilities
 */
export interface ProductionGameContext {
    getResourceById(id: string): { amount: number } | undefined;
    hasGlobalCapacity(resourceId: string, amount: number): boolean;
}

/**
 * Utility class for common production operations
 */
export class ProductionUtils {
    
    /**
     * Checks if there's sufficient capacity for all production outputs
     * @param config - Production configuration
     * @param game - Game context for capacity checking
     * @param buildingName - Name of the building for logging
     * @returns Whether there's capacity for all outputs
     */
    static hasCapacityForOutputs(
        config: ProductionConfig, 
        game: ProductionGameContext | undefined,
        buildingName: string = 'Building'
    ): boolean {
        if (!game) {
            logger.debug(`${buildingName}: No game context - assuming unlimited capacity`);
            return true;
        }
        
        for (const output of config.outputs) {
            if (!game.hasGlobalCapacity(output.resourceId, output.amount)) {
                logger.debug(`${buildingName}: Insufficient capacity for ${output.resourceId} (need ${output.amount})`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Checks if there are sufficient input resources for production
     * @param config - Production configuration
     * @param game - Game context for resource checking
     * @param buildingName - Name of the building for logging
     * @returns Whether there are sufficient input resources
     */
    static hasInputResources(
        config: ProductionConfig,
        game: ProductionGameContext | undefined,
        buildingName: string = 'Building'
    ): boolean {
        if (!game) {
            logger.debug(`${buildingName}: No game context - cannot check input resources`);
            return false;
        }
        
        for (const input of config.inputs) {
            const resource = game.getResourceById(input.resourceId);
            if (!resource || resource.amount < input.amount) {
                const available = resource?.amount || 0;
                logger.debug(`${buildingName}: Insufficient ${input.resourceId} (need ${input.amount}, have ${available})`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Checks if production can proceed (both inputs and outputs)
     * @param config - Production configuration
     * @param game - Game context
     * @param buildingName - Name of the building for logging
     * @returns Whether production can proceed
     */
    static canProduce(
        config: ProductionConfig,
        game: ProductionGameContext | undefined,
        buildingName: string = 'Building'
    ): boolean {
        return this.hasInputResources(config, game, buildingName) && 
               this.hasCapacityForOutputs(config, game, buildingName);
    }
    
    /**
     * Validates production configuration
     * @param config - Production configuration to validate
     * @param buildingName - Name of the building for error messages
     * @returns Array of validation errors (empty if valid)
     */
    static validateProductionConfig(config: Partial<ProductionConfig>, buildingName: string = 'Building'): string[] {
        const errors: string[] = [];
        
        if (!config.inputs || !Array.isArray(config.inputs)) {
            errors.push(`${buildingName}: Production inputs must be an array`);
        } else {
            for (let i = 0; i < config.inputs.length; i++) {
                const input = config.inputs[i];
                if (!input.resourceId || typeof input.resourceId !== 'string') {
                    errors.push(`${buildingName}: Input ${i} must have a valid resourceId`);
                }
                if (typeof input.amount !== 'number' || input.amount <= 0) {
                    errors.push(`${buildingName}: Input ${i} must have a positive amount`);
                }
            }
        }
        
        if (!config.outputs || !Array.isArray(config.outputs)) {
            errors.push(`${buildingName}: Production outputs must be an array`);
        } else {
            for (let i = 0; i < config.outputs.length; i++) {
                const output = config.outputs[i];
                if (!output.resourceId || typeof output.resourceId !== 'string') {
                    errors.push(`${buildingName}: Output ${i} must have a valid resourceId`);
                }
                if (typeof output.amount !== 'number' || output.amount <= 0) {
                    errors.push(`${buildingName}: Output ${i} must have a positive amount`);
                }
            }
        }
        
        return errors;
    }
    
    /**
     * Calculates production efficiency based on available inputs
     * @param config - Production configuration
     * @param game - Game context
     * @returns Efficiency factor (0-1) based on available inputs
     */
    static calculateProductionEfficiency(
        config: ProductionConfig,
        game: ProductionGameContext | undefined
    ): number {
        if (!game || config.inputs.length === 0) {
            return 1.0; // No inputs required or no game context
        }
        
        let minEfficiency = 1.0;
        
        for (const input of config.inputs) {
            const resource = game.getResourceById(input.resourceId);
            const available = resource?.amount || 0;
            
            if (available < input.amount) {
                const efficiency = available / input.amount;
                minEfficiency = Math.min(minEfficiency, efficiency);
            }
        }
        
        return Math.max(0, minEfficiency);
    }
    
    /**
     * Gets a summary of production requirements and availability
     * @param config - Production configuration
     * @param game - Game context
     * @returns Production status summary
     */
    static getProductionStatus(
        config: ProductionConfig,
        game: ProductionGameContext | undefined
    ): {
        canProduce: boolean;
        efficiency: number;
        blockers: string[];
        inputs: Array<{ resourceId: string; required: number; available: number; sufficient: boolean }>;
        outputs: Array<{ resourceId: string; amount: number; hasCapacity: boolean }>;
    } {
        const blockers: string[] = [];
        const inputs = config.inputs.map(input => {
            const resource = game?.getResourceById(input.resourceId);
            const available = resource?.amount || 0;
            const sufficient = available >= input.amount;
            
            if (!sufficient) {
                blockers.push(`Insufficient ${input.resourceId} (need ${input.amount}, have ${available})`);
            }
            
            return {
                resourceId: input.resourceId,
                required: input.amount,
                available,
                sufficient
            };
        });
        
        const outputs = config.outputs.map(output => {
            const hasCapacity = game?.hasGlobalCapacity(output.resourceId, output.amount) ?? true;
            
            if (!hasCapacity) {
                blockers.push(`Insufficient capacity for ${output.resourceId} (need ${output.amount})`);
            }
            
            return {
                resourceId: output.resourceId,
                amount: output.amount,
                hasCapacity
            };
        });
        
        const efficiency = this.calculateProductionEfficiency(config, game);
        const canProduce = this.canProduce(config, game);
        
        return {
            canProduce,
            efficiency,
            blockers,
            inputs,
            outputs
        };
    }
}

/**
 * Creates a production configuration object
 * @param inputs - Input resources required
 * @param outputs - Output resources produced
 * @returns Production configuration
 */
export function createProductionConfig(
    inputs: Array<{ resourceId: string; amount: number }>,
    outputs: Array<{ resourceId: string; amount: number }>
): ProductionConfig {
    return { inputs, outputs };
}

/**
 * Helper function to create a single input production config
 * @param inputResourceId - ID of the input resource
 * @param inputAmount - Amount of input resource required
 * @param outputResourceId - ID of the output resource
 * @param outputAmount - Amount of output resource produced
 * @returns Production configuration
 */
export function createSimpleProductionConfig(
    inputResourceId: string,
    inputAmount: number,
    outputResourceId: string,
    outputAmount: number
): ProductionConfig {
    return createProductionConfig(
        [{ resourceId: inputResourceId, amount: inputAmount }],
        [{ resourceId: outputResourceId, amount: outputAmount }]
    );
}