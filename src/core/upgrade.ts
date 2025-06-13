import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";
import type { 
  CostDefinition, 
  CostCalculationOptions, 
  CostValidationResult, 
  CostProvider 
} from "../types/cost-definition";
import type {
  UpgradeConfiguration,
  UpgradeApplicationResult
} from "../types/upgrade-effects";
import type { Game } from "./game";

/**
 * Enhanced Upgrade class with data-driven effects and property modification.
 * Supports complex upgrade effects, repeatable upgrades, and condition-based application.
 *
 * @property {UpgradeConfiguration} configuration - Complete upgrade configuration with effects and targets
 * @property {CostDefinition[]} costs - Structured cost definitions for purchasing the upgrade
 * @property {boolean} isApplied - Whether this upgrade has been applied
 * @property {boolean} isRepeatable - Whether this upgrade can be applied multiple times
 * @property {number} maxApplications - Maximum number of times this upgrade can be applied
 * @property {number} currentApplications - Current number of times this upgrade has been applied
 * @extends {BaseEntity}
 * @implements {CostProvider}
 */
export class Upgrade extends BaseEntity implements CostProvider {
    configuration: UpgradeConfiguration;
    costs: CostDefinition[];
    isApplied: boolean;
    isRepeatable: boolean;
    maxApplications: number;
    currentApplications: number;
    private _game?: Game;
    
    // Legacy support
    effect?: any;
    cost?: Record<string, number>;

    /**
     * Creates a new Upgrade instance with enhanced data-driven effects
     * @param config - Upgrade configuration object
     * @param config.name - The display name of the upgrade (e.g., "Faster Mining", "Double Production")
     * @param config.description - Optional description of what this upgrade does
     * @param config.configuration - Complete upgrade configuration with effects and targets
     * @param config.costs - Structured cost definitions for purchasing the upgrade
     * @param config.cost - Legacy cost format (converted to CostDefinition[])
     * @param config.effect - Legacy effect function (for backward compatibility)
     * @param config.isRepeatable - Whether this upgrade can be applied multiple times
     * @param config.maxApplications - Maximum number of times this upgrade can be applied
     * @param config.unlockCondition - Function that returns true when this upgrade should become available
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.tags - Optional array of strings for categorizing this upgrade
     */
    constructor(config: {
        name: string;
        description?: string;
        configuration?: UpgradeConfiguration;
        costs?: CostDefinition[];
        cost?: Record<string, number>; // Legacy support
        effect?: any; // Legacy support
        isRepeatable?: boolean;
        maxApplications?: number;
        unlockCondition?: () => boolean;
        id?: string;
        tags?: string[];
        isUnlocked?: boolean;
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            unlockCondition: config.unlockCondition,
            tags: config.tags,
            isUnlocked: config.isUnlocked
        });
        
        // Handle new configuration system
        this.configuration = config.configuration || {
            effects: [],
            targets: [],
            isRepeatable: config.isRepeatable || false,
            maxApplications: config.maxApplications || 1,
            currentApplications: 0,
            autoApply: false
        };
        
        // Handle both new costs and legacy cost formats
        if (config.costs) {
            this.costs = config.costs;
        } else if (config.cost) {
            // Convert legacy cost format to CostDefinition[]
            this.costs = Object.entries(config.cost).map(([resourceId, amount]) => ({
                resourceId,
                amount,
                scalingFactor: 1.2 // Default scaling factor
            }));
        } else {
            this.costs = [];
        }
        
        this.isApplied = false;
        this.isRepeatable = config.isRepeatable || false;
        this.maxApplications = config.maxApplications || 1;
        this.currentApplications = 0;
        
        // Legacy support
        this.effect = config.effect;
        this.cost = config.cost;
    }


    /**
     * Lifecycle hook - called when upgrade is initialized
     */
    onInitialize(): void {
        logger.info(`Upgrade ${this.name} initialized`);
    }

    /**
     * Apply the upgrade using the data-driven effect system
     * @returns Whether the upgrade was successfully applied
     */
    apply(): UpgradeApplicationResult {
        if (!this.canApply()) {
            const result: UpgradeApplicationResult = {
                success: false,
                effectResults: [],
                modifiedEntities: [],
                error: 'Upgrade cannot be applied (conditions not met or max applications reached)'
            };
            this.emit('applicationFailed', { upgrade: this, result });
            return result;
        }
        
        // Use the game's upgrade effect processor if available
        if (this._game?.upgradeEffectProcessor) {
            const result = this._game.upgradeEffectProcessor.applyEffects(
                this.configuration.effects,
                this.configuration.targets,
                this.id
            );
            
            if (result.success) {
                this.currentApplications++;
                if (!this.isRepeatable || this.currentApplications >= this.maxApplications) {
                    this.isApplied = true;
                }
                this.onUpgradeApplied();
                logger.info(`${this.name} upgrade applied successfully (${this.currentApplications}/${this.maxApplications})`);
            } else {
                logger.error(`Failed to apply upgrade ${this.name}: ${result.error}`);
            }
            
            return result;
        }
        
        // Fallback to legacy effect system
        if (this.effect && typeof this.effect === 'function') {
            try {
                this.effect();
                this.currentApplications++;
                this.isApplied = true;
                this.onUpgradeApplied();
                logger.info(`${this.name} upgrade applied (legacy mode)`);
                
                return {
                    success: true,
                    effectResults: [],
                    modifiedEntities: []
                };
            } catch (error) {
                const result: UpgradeApplicationResult = {
                    success: false,
                    effectResults: [],
                    modifiedEntities: [],
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                this.emit('applicationFailed', { upgrade: this, result });
                return result;
            }
        }
        
        // No valid application method
        const result: UpgradeApplicationResult = {
            success: false,
            effectResults: [],
            modifiedEntities: [],
            error: 'No valid upgrade effects or legacy effect function defined'
        };
        this.emit('applicationFailed', { upgrade: this, result });
        return result;
    }
    
    /**
     * Check if the upgrade can be applied
     */
    canApply(): boolean {
        // Check if already at max applications
        if (!this.isRepeatable && this.isApplied) {
            return false;
        }
        
        if (this.currentApplications >= this.maxApplications) {
            return false;
        }
        
        // Check prerequisites if defined
        if (this.configuration.prerequisites && this._game?.upgradeEffectProcessor) {
            return this._game.upgradeEffectProcessor['checkConditions'](this.configuration.prerequisites, this as any);
        }
        
        return true;
    }
    
    /**
     * Reset the upgrade to unapplied state
     */
    reset(): void {
        this.isApplied = false;
        this.currentApplications = 0;
        this.emit('upgradeReset', { upgrade: this });
        logger.info(`Upgrade ${this.name} has been reset`);
    }
    
    /**
     * Get the number of remaining applications
     */
    getRemainingApplications(): number {
        return Math.max(0, this.maxApplications - this.currentApplications);
    }
    
    /**
     * Lifecycle hook called when upgrade is applied
     */
    onUpgradeApplied(): void {
        this.emit('upgradeApplied', { upgrade: this });
    }
    
    // CostProvider interface implementation
    
    /**
     * Gets the cost definitions for this upgrade
     */
    getCosts(): CostDefinition[] {
        return this.costs;
    }
    
    /**
     * Sets the cost definitions for this upgrade
     */
    setCosts(costs: CostDefinition[]): void {
        this.costs = costs;
        this.emit('costsChanged', { upgrade: this, costs });
    }
    
    /**
     * Calculates the total cost based on applications and options
     */
    calculateCost(options: CostCalculationOptions = {}): Record<string, number> {
        if (!this._game?.costSystem) {
            // Fallback calculation
            const calculatedCosts: Record<string, number> = {};
            const applications = options.level || this.currentApplications + 1;
            const multiplier = options.multiplier || 1;
            
            for (const cost of this.costs) {
                let amount = cost.amount;
                if (applications > 1 && cost.scalingFactor) {
                    amount = cost.amount * Math.pow(cost.scalingFactor, applications - 1);
                }
                amount *= multiplier;
                calculatedCosts[cost.resourceId] = (calculatedCosts[cost.resourceId] || 0) + Math.floor(amount);
            }
            
            return calculatedCosts;
        }
        
        return this._game.costSystem.calculateCost(this.costs, {
            level: this.currentApplications + 1,
            ...options
        });
    }
    
    /**
     * Checks if the upgrade's costs can be afforded
     */
    canAfford(options: CostCalculationOptions = {}): boolean {
        if (!this._game?.costSystem) {
            return false;
        }
        
        const validation = this._game.costSystem.validateCost(this.costs, {
            level: this.currentApplications + 1,
            ...options
        });
        
        return validation.canAfford;
    }
    
    /**
     * Gets detailed cost validation information
     */
    validateCost(options: CostCalculationOptions = {}): CostValidationResult | null {
        if (!this._game?.costSystem) {
            return null;
        }
        
        return this._game.costSystem.validateCost(this.costs, {
            level: this.currentApplications + 1,
            ...options
        });
    }
    
    /**
     * Attempts to spend resources to purchase this upgrade
     */
    purchase(options: CostCalculationOptions = {}): boolean {
        if (!this._game?.costSystem) {
            return false;
        }
        
        const result = this._game.costSystem.spendResources(this.costs, {
            level: this.currentApplications + 1,
            ...options
        });
        
        if (result.success) {
            this.emit('upgradePurchased', { upgrade: this, spent: result.spent });
            return true;
        } else {
            this.emit('purchaseFailed', { upgrade: this, error: result.error });
            return false;
        }
    }
    
    /**
     * Sets the game reference for system integration
     */
    setGame(game: Game): void {
        this._game = game;
    }
    
    /**
     * Sets the game reference (alias for consistency)
     */
    setGameReference(game: Game): void {
        this.setGame(game);
    }
    
    /**
     * Gets the game reference
     */
    get game(): Game | undefined {
        return this._game;
    }
}
