import { ProducerBuilding } from "./producer-building";
import { ProductionConfig } from "../../types/production";
import { logger } from "../../utils/logger";

/**
 * Miner class responsible for extracting resources over time.
 * Extends ProducerBuilding with mining-specific production logic.
 * 
 * Miners are extraction-based production buildings that generate resources
 * without requiring input materials, representing extraction from deposits.
 */
export class Miner extends ProducerBuilding {
    /** ID of the resource being mined by this miner */
    resourceId: string;
    
    /** Base rate at which this miner gathers resources per second */
    gatherRate: number;

    /**
     * Creates a new Miner building
     * @param config - Miner configuration object
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.name - The display name of the miner (e.g., "Gold Mine", "Iron Excavator")
     * @param config.description - Optional description of what this miner extracts
     * @param config.cost - Resource costs to build this miner (e.g., {wood: 20, stone: 10})
     * @param config.buildTime - Time in seconds required to complete construction (defaults to 0)
     * @param config.level - Starting level of the miner (defaults to 1)
     * @param config.gatherRate - Amount of target resource gathered per second
     * @param config.resourceId - ID of the resource this miner will extract
     * @param config.unlockCondition - Function that returns true when this miner should become available
     * @param config.tags - Optional array of strings for categorizing this miner (e.g., ["mining", "extraction"])
     * @param config.efficiency - Production efficiency (defaults to 1.0 = 100%)
     * @param config.autoStart - Whether mining starts automatically when unlocked (defaults to true)
     */
    constructor(config: {
        id?: string;
        name: string;
        description?: string;
        tags?: string[];
        cost?: Record<string, number>;
        buildTime?: number;
        level?: number;
        gatherRate: number;
        resourceId: string;
        unlockCondition?: () => boolean;
        efficiency?: number;
        autoStart?: boolean;
    }) {
        // Create production configuration for mining (no inputs, only outputs)
        const productionConfig: ProductionConfig = {
            inputs: [], // Miners don't require input resources
            outputs: [{
                resourceId: config.resourceId,
                amount: config.gatherRate,
                efficiency: config.efficiency || 1.0
            }],
            rate: {
                base: 1.0, // Base rate of 1 cycle per second
                current: 1.0,
                modifiers: []
            },
            efficiency: {
                base: config.efficiency || 1.0,
                current: config.efficiency || 1.0,
                modifiers: []
            },
            autoStart: config.autoStart !== false, // Default to true
            continuous: true // Mining is continuous
        };

        super({
            id: config.id,
            name: config.name,
            description: config.description,
            tags: config.tags || ["mining", "extraction"],
            cost: config.cost,
            buildTime: config.buildTime,
            level: config.level,
            unlockCondition: config.unlockCondition,
            production: productionConfig
        });

        this.resourceId = config.resourceId;
        this.gatherRate = config.gatherRate;
    }

    /**
     * Override onUnlock to auto-start mining if configured
     */
    onUnlock(): void {
        super.onUnlock();
        
        if (this.productionConfig.autoStart && !this.isBuilding) {
            this.startProduction();
        }
    }

    /**
     * Override onBuildComplete to auto-start mining if configured
     */
    onBuildComplete(): void {
        super.onBuildComplete();
        
        if (this.productionConfig.autoStart) {
            this.startProduction();
        }
    }

    /**
     * Mining-specific production start logic
     */
    protected onProductionStart(): void {
        super.onProductionStart();
        logger.info(`${this.name} started mining ${this.resourceId} at ${this.gatherRate}/sec`);
    }

    /**
     * Mining-specific production stop logic
     */
    protected onProductionStop(): void {
        super.onProductionStop();
        logger.info(`${this.name} stopped mining ${this.resourceId}`);
    }

    /**
     * Miners can always produce (no input requirements)
     * Only limited by output capacity
     */
    canProduce(): boolean {
        // Check basic building requirements
        if (this.isBuilding) {
            return false;
        }

        // Check output capacity
        return this.hasCapacityForOutput();
    }

    /**
     * Checks if there's capacity for the mined resource
     */
    private hasCapacityForOutput(): boolean {
        if (!this.game) {
            return true; // No capacity limits if no game context
        }

        return this.game.hasGlobalCapacity(this.resourceId, this.gatherRate);
    }

    /**
     * Gets the resource being mined
     * @returns The resource entity or null if not found
     */
    getMinedResource(): unknown {
        if (!this.game) {
            return null;
        }
        return this.game.getEntityById(this.resourceId);
    }

    /**
     * Sets the gather rate (updates production output)
     * @param rate - New gather rate per second
     */
    setGatherRate(rate: number): void {
        this.gatherRate = Math.max(0, rate);
        
        // Update production configuration
        if (this.productionConfig.outputs.length > 0) {
            this.productionConfig.outputs[0].amount = this.gatherRate;
        }
        
        this.recalculateProductionStats();
        logger.info(`${this.name} gather rate updated to ${this.gatherRate}/sec`);
    }

    /**
     * Gets current effective gather rate including efficiency
     * @returns Effective gather rate per second
     */
    getEffectiveGatherRate(): number {
        return this.gatherRate * this.productionConfig.efficiency.current;
    }

    /**
     * Override recalculateProductionStats for mining-specific calculations
     */
    protected recalculateProductionStats(): void {
        // Update production output based on current gather rate and level
        const levelMultiplier = 1 + ((this.level - 1) * 0.15); // 15% increase per level for miners
        const effectiveGatherRate = this.gatherRate * levelMultiplier;
        
        // Update production configuration
        if (this.productionConfig.outputs.length > 0) {
            this.productionConfig.outputs[0].amount = effectiveGatherRate;
        }
        
        // Update rate and efficiency
        this.productionConfig.rate.current = this.productionConfig.rate.base * levelMultiplier;
        this.productionConfig.efficiency.current = Math.min(2.0, this.productionConfig.efficiency.base * (1 + (this.level - 1) * 0.05));
        
        super.recalculateProductionStats();
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use production system instead
     */
    gatherResources(): void {
        logger.warn(`${this.name}.gatherResources() is deprecated. Use production system instead.`);
        
        if (!this.isCurrentlyProducing()) {
            this.startProduction();
        }
    }
}