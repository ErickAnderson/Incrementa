import { ProducerBuilding } from "./producer-building";
import { ProductionConfig, ProductionInput, ProductionOutput } from "../../types/production";
import { logger } from "../../utils/logger";

/**
 * Factory class takes one or more resources as input and produces new resources.
 * Extends ProducerBuilding with transformation-specific production logic.
 * 
 * Factories are transformation-based production buildings that convert
 * input resources into output resources with configurable rates and efficiency.
 */
export class Factory extends ProducerBuilding {
    /**
     * Creates a new Factory building
     * @param config - Factory configuration object
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.name - The display name of the factory (e.g., "Steel Mill", "Textile Factory")
     * @param config.description - Optional description of what this factory produces
     * @param config.cost - Resource costs to build this factory (e.g., {wood: 50, stone: 30})
     * @param config.buildTime - Time in seconds required to complete construction (defaults to 0)
     * @param config.level - Starting level of the factory (defaults to 1)
     * @param config.inputs - Array of production inputs with amounts (e.g., [{resourceId: "iron", amount: 2}])
     * @param config.outputs - Array of production outputs with amounts (e.g., [{resourceId: "steel", amount: 1}])
     * @param config.productionRate - Production cycles per second (defaults to 1.0)
     * @param config.efficiency - Production efficiency (defaults to 1.0 = 100%)
     * @param config.unlockCondition - Function that returns true when this factory should become available
     * @param config.tags - Optional array of strings for categorizing this factory (e.g., ["production", "conversion"])
     * @param config.autoStart - Whether production starts automatically when unlocked (defaults to false)
     */
    constructor(config: {
        id?: string;
        name: string;
        description?: string;
        cost?: Record<string, number>;
        buildTime?: number;
        level?: number;
        inputs: ProductionInput[];
        outputs: ProductionOutput[];
        productionRate?: number;
        efficiency?: number;
        unlockCondition?: () => boolean;
        tags?: string[];
        autoStart?: boolean;
    }) {
        // Create production configuration for factory transformation
        const productionConfig: ProductionConfig = {
            inputs: config.inputs,
            outputs: config.outputs,
            rate: {
                base: config.productionRate || 1.0,
                current: config.productionRate || 1.0,
                modifiers: []
            },
            efficiency: {
                base: config.efficiency || 1.0,
                current: config.efficiency || 1.0,
                modifiers: []
            },
            autoStart: config.autoStart || false, // Factories default to manual start
            continuous: true // Factory production is continuous when active
        };

        super({
            id: config.id,
            name: config.name,
            description: config.description,
            tags: config.tags || ["production", "conversion"],
            cost: config.cost,
            buildTime: config.buildTime,
            level: config.level,
            unlockCondition: config.unlockCondition,
            production: productionConfig
        });
    }

    /**
     * Override onUnlock to auto-start production if configured
     */
    onUnlock(): void {
        super.onUnlock();
        
        if (this.productionConfig.autoStart && !this.isBuilding) {
            this.startProduction();
        }
    }

    /**
     * Override onBuildComplete to auto-start production if configured
     */
    onBuildComplete(): void {
        super.onBuildComplete();
        
        if (this.productionConfig.autoStart) {
            this.startProduction();
        }
    }

    /**
     * Factory-specific production start logic
     */
    protected onProductionStart(): void {
        super.onProductionStart();
        
        const inputNames = this.productionConfig.inputs.map(i => `${i.amount}x${i.resourceId}`).join(", ");
        const outputNames = this.productionConfig.outputs.map(o => `${o.amount}x${o.resourceId}`).join(", ");
        
        logger.info(`${this.name} started producing [${outputNames}] from [${inputNames}] at ${this.productionConfig.rate.current}/sec`);
    }

    /**
     * Factory-specific production stop logic
     */
    protected onProductionStop(): void {
        super.onProductionStop();
        logger.info(`${this.name} stopped production`);
    }

    /**
     * Gets input resource requirements for display/validation
     * @returns Array of input resource information
     */
    getInputRequirements(): Array<{resourceId: string, amount: number, available: number}> {
        if (!this.game) {
            return this.productionConfig.inputs.map(input => ({
                resourceId: input.resourceId,
                amount: input.amount,
                available: 0
            }));
        }

        return this.productionConfig.inputs.map(input => {
            const resource = this.game!.getEntityById(input.resourceId);
            const available = resource && 'amount' in resource ? (resource as { amount: number }).amount : 0;
            
            return {
                resourceId: input.resourceId,
                amount: input.amount,
                available
            };
        });
    }

    /**
     * Gets output production information
     * @returns Array of output resource information
     */
    getOutputProduction(): Array<{resourceId: string, amount: number, capacity: number}> {
        if (!this.game) {
            return this.productionConfig.outputs.map(output => ({
                resourceId: output.resourceId,
                amount: output.amount,
                capacity: Infinity
            }));
        }

        return this.productionConfig.outputs.map(output => {
            const capacity = this.game!.getRemainingCapacityFor(output.resourceId);
            
            return {
                resourceId: output.resourceId,
                amount: output.amount * this.productionConfig.efficiency.current,
                capacity
            };
        });
    }

    /**
     * Checks if factory can currently produce (has inputs and output capacity)
     * @returns Whether production is possible
     */
    canProduce(): boolean {
        // Check basic building requirements
        if (this.isBuilding) {
            return false;
        }

        // Use parent class logic which checks inputs and outputs
        return super.canProduce();
    }

    /**
     * Gets production efficiency including level bonuses
     * @returns Current production efficiency as percentage
     */
    getProductionEfficiency(): number {
        return this.productionConfig.efficiency.current * 100;
    }

    /**
     * Sets production rate (cycles per second)
     * @param rate - New production rate
     */
    setFactoryProductionRate(rate: number): void {
        this.setProductionRate(rate);
        logger.info(`${this.name} production rate updated to ${rate}/sec`);
    }

    /**
     * Override recalculateProductionStats for factory-specific calculations
     */
    protected recalculateProductionStats(): void {
        // Factory-specific level scaling: 10% rate increase, 5% efficiency increase per level
        const levelMultiplier = 1 + ((this.level - 1) * 0.10);
        const efficiencyBonus = 1 + ((this.level - 1) * 0.05);
        
        // Update rate and efficiency based on level
        this.productionConfig.rate.current = this.productionConfig.rate.base * levelMultiplier;
        this.productionConfig.efficiency.current = Math.min(2.0, this.productionConfig.efficiency.base * efficiencyBonus);
        
        super.recalculateProductionStats();
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use production system instead
     */
    produceResources(): void {
        logger.warn(`${this.name}.produceResources() is deprecated. Use production system instead.`);
        
        if (!this.isCurrentlyProducing()) {
            this.startProduction();
        }
    }

    /**
     * Gets a summary of the factory's production setup
     * @returns Factory production summary
     */
    getProductionSummary(): {
        inputs: Array<{resourceId: string, amount: number}>;
        outputs: Array<{resourceId: string, amount: number}>;
        rate: number;
        efficiency: number;
        isProducing: boolean;
    } {
        return {
            inputs: this.productionConfig.inputs.map(i => ({
                resourceId: i.resourceId,
                amount: i.amount
            })),
            outputs: this.productionConfig.outputs.map(o => ({
                resourceId: o.resourceId,
                amount: o.amount * this.productionConfig.efficiency.current
            })),
            rate: this.productionConfig.rate.current,
            efficiency: this.productionConfig.efficiency.current,
            isProducing: this.isCurrentlyProducing()
        };
    }
}