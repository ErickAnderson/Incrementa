import { BaseEntity, IGame } from "../../core/base-entity";
import { Upgrade } from "../../core/upgrade";
import { logger } from "../../utils/logger";
import type { CostDefinition, CostCalculationOptions, CostValidationResult, CostProvider } from "../../types/cost-definition";
import type { Game } from "../../core/game";

/**
 * Base class for all buildings, includes shared functionality for upgrading.
 * Implements PRD Building specification with construction lifecycle and level system.
 *
 * @property {CostDefinition[]} costs - Structured cost definitions for building construction.
 * @property {number} buildTime - Time required to build the building.
 * @property {number} productionRate - Rate at which the building produces or mines resources.
 * @property {number} level - Current level of the building.
 * @property {boolean} isBuilding - Whether construction is in progress.
 * @property {Upgrade[]} upgradesApplied - Array of upgrades applied to this building.
 * @extends {BaseEntity}
 * @implements {CostProvider}
 */
export class Building extends BaseEntity implements CostProvider {
    costs: CostDefinition[];
    buildTime: number;
    productionRate: number;
    level: number;
    isBuilding: boolean;
    upgradesApplied: Upgrade[];
    private constructionTimerId: number | null;
    private _constructionCompleted: boolean;

    /**
     * Constructor for the Building class.
     *
     * @param config - Building configuration object
     * @param config.name - The display name of the building (e.g., "Gold Mine", "Steel Factory")
     * @param config.description - Optional description of what this building does
     * @param config.costs - Structured cost definitions for building construction
     * @param config.cost - Legacy cost format (converted to CostDefinition[])
     * @param config.buildTime - Time in seconds required to complete construction (defaults to 0)
     * @param config.productionRate - Base rate of resource production per second (defaults to 0)
     * @param config.level - Starting level of the building (defaults to 1)
     * @param config.unlockCondition - Function that returns true when this building should become available
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.tags - Optional array of strings for categorizing this building (e.g., ["production", "mining"])
     */
    constructor(config: {
        name: string;
        description?: string;
        costs?: CostDefinition[];
        cost?: Record<string, number>; // Legacy support
        buildTime?: number;
        productionRate?: number;
        level?: number;
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
        
        this.buildTime = config.buildTime || 0;
        this.productionRate = config.productionRate || 0;
        this.level = config.level || 1;
        this.isBuilding = false;
        this.upgradesApplied = [];
        this.constructionTimerId = null;
        // Property to track construction completion state for internal lifecycle management
        // This is needed to differentiate between "never built" and "construction completed" states
        this._constructionCompleted = false;
    }


    /**
     * Lifecycle hook - called when building is initialized
     */
    onInitialize(): void {
        logger.info(`Building ${this.name} initialized at level ${this.level}`);
    }

    /**
     * Lifecycle hook called when building starts construction
     */
    onBuildStart(): void {
        logger.info(`Construction of ${this.name} has started`);
        this.emit('buildStart', { building: this });
    }

    /**
     * Lifecycle hook called when building construction is complete
     */
    onBuildComplete(): void {
        logger.info(`Construction of ${this.name} is complete`);
        this.emit('buildComplete', { building: this });
    }

    /**
     * Lifecycle hook called when building levels up
     */
    onLevelUp(oldLevel: number, newLevel: number): void {
        logger.info(`${this.name} leveled up to level ${newLevel}`);
        this.emit('levelUp', { building: this, oldLevel, newLevel });
    }

    /**
     * Starts the construction process with cost validation and spending
     * @param spendResources - Whether to spend resources immediately (default: true)
     * @returns Whether construction was started successfully
     */
    startConstruction(spendResources: boolean = true): boolean {
        if (this.isBuilding) {
            return false;
        }
        
        // Validate and spend costs if required
        if (spendResources) {
            if (!this.canAfford()) {
                this.emit('constructionFailed', { 
                    building: this, 
                    reason: 'insufficient_resources',
                    validation: this.validateCost()
                });
                return false;
            }
            
            if (!this.spendCost()) {
                this.emit('constructionFailed', { 
                    building: this, 
                    reason: 'spending_failed'
                });
                return false;
            }
        }
        
        this.isBuilding = true;
        this.onBuildStart();
        
        // Schedule construction completion with environment-agnostic timer
        const delayMs = this.buildTime * 1000;
        this.constructionTimerId = this.scheduleTimer(() => {
            this.completeConstruction();
        }, delayMs);
        
        return true;
    }

    /**
     * Completes the construction process
     */
    completeConstruction(): void {
        if (!this.isBuilding) {
            return;
        }
        
        this.isBuilding = false;
        this._constructionCompleted = true;
        if (this.constructionTimerId !== null) {
            this.clearTimer(this.constructionTimerId);
            this.constructionTimerId = null;
        }
        this.onBuildComplete();
    }

    /**
     * Increases the building's level
     * @param levels - Number of levels to increase (defaults to 1)
     */
    levelUp(levels: number = 1): void {
        const oldLevel = this.level;
        this.level += levels;
        this.onLevelUp(oldLevel, this.level);
        
        // Recalculate stats based on new level
        this.recalculateStats();
    }

    /**
     * Applies an upgrade to the building
     * @param upgrade - The upgrade to apply
     */
    applyUpgrade(upgrade: Upgrade): void {
        if (!this.upgradesApplied.includes(upgrade)) {
            this.upgradesApplied.push(upgrade);
            upgrade.apply();
            this.recalculateStats();
            this.emit('upgradeApplied', { building: this, upgrade });
        }
    }

    /**
     * Recalculates building stats based on level and upgrades
     * Override in subclasses for specific stat calculations
     */
    protected recalculateStats(): void {
        // Base implementation - can be overridden by subclasses
        this.emit('statsRecalculated', { building: this });
    }


    // CostProvider interface implementation
    
    /**
     * Gets the cost definitions for this building
     */
    getCosts(): CostDefinition[] {
        return this.costs;
    }

    /**
     * Sets the cost definitions for this building
     */
    setCosts(costs: CostDefinition[]): void {
        this.costs = costs;
        this.emit('costsChanged', { building: this, costs });
    }

    /**
     * Calculates the total cost based on level and options
     */
    calculateCost(options: CostCalculationOptions = {}): Record<string, number> {
        if (!this._game?.costSystem) {
            // Fallback calculation if no cost system available
            const calculatedCosts: Record<string, number> = {};
            const level = options.level || this.level;
            const multiplier = options.multiplier || 1;
            
            for (const cost of this.costs) {
                let amount = cost.amount;
                if (level > 1 && cost.scalingFactor) {
                    amount = cost.amount * Math.pow(cost.scalingFactor, level - 1);
                }
                amount *= multiplier;
                calculatedCosts[cost.resourceId] = (calculatedCosts[cost.resourceId] || 0) + Math.floor(amount);
            }
            
            return calculatedCosts;
        }
        
        return this._game.costSystem.calculateCost(this.costs, {
            level: this.level,
            ...options
        });
    }

    /**
     * Checks if the building's costs can be afforded
     */
    canAfford(options: CostCalculationOptions = {}): boolean {
        if (!this._game?.costSystem) {
            // Fallback validation if no cost system available
            const calculatedCosts = this.calculateCost(options);
            for (const [resourceId, requiredAmount] of Object.entries(calculatedCosts)) {
                const resource = this._game?.getResourceById(resourceId);
                if (!resource || resource.amount < requiredAmount) {
                    return false;
                }
            }
            return true;
        }
        
        const validation = this._game.costSystem.validateCost(this.costs, {
            level: this.level,
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
            level: this.level,
            ...options
        });
    }

    /**
     * Attempts to spend resources for construction or upgrade
     */
    spendCost(options: CostCalculationOptions = {}): boolean {
        if (!this._game?.costSystem) {
            return false;
        }
        
        const result = this._game.costSystem.spendResources(this.costs, {
            level: this.level,
            ...options
        });
        
        if (result.success) {
            this.emit('costSpent', { building: this, spent: result.spent });
        } else {
            this.emit('costSpendFailed', { building: this, error: result.error });
        }
        
        return result.success;
    }

    /**
     * Gets whether this building is built and functional
     * A building is considered built if it's unlocked, not currently building, and construction has completed
     */
    get isBuilt(): boolean {
        // Building must be unlocked and not currently under construction
        if (!this.isUnlocked || this.isBuilding) {
            return false;
        }
        
        // If building has no build time, it's instantly built when unlocked
        if (this.buildTime <= 0) {
            return true;
        }
        
        // Otherwise, check if construction has completed
        return this._constructionCompleted;
    }

    /**
     * Sets the game reference (GameAware interface implementation)
     */
    setGameReference(game: IGame): void {
        super.setGameReference(game);
    }

    /**
     * Sets the game reference (alias for setGameReference for backward compatibility)
     */
    setGame(game: Game): void {
        this.setGameReference(game);
    }

    /**
     * Gets the game reference
     */
    get game(): Game | undefined {
        return this._game;
    }

    /**
     * Gets the total cost for the current level (legacy method)
     * Override in subclasses for level-based cost scaling
     */
    getCurrentCost(): Record<string, number> {
        return this.calculateCost();
    }

    /**
     * Checks if the building can be leveled up
     * Override in subclasses for custom level-up conditions
     */
    canLevelUp(): boolean {
        return true;
    }

    /**
     * Environment-agnostic timer scheduling
     * Uses setTimeout in environments that support it,
     * otherwise calls the callback immediately
     * @private
     */
    private scheduleTimer(callback: () => void, delay: number): number {
        if (typeof (globalThis as { setTimeout?: (callback: () => void, delay: number) => number }).setTimeout === 'function') {
            return ((globalThis as { setTimeout: (callback: () => void, delay: number) => number }).setTimeout(callback, delay) as unknown) as number;
        } else {
            // Fallback for environments without setTimeout
            callback();
            return 0;
        }
    }

    /**
     * Environment-agnostic timer clearing
     * @private
     */
    private clearTimer(timerId: number): void {
        if (typeof (globalThis as { clearTimeout?: (timerId: number) => void }).clearTimeout === 'function') {
            (globalThis as { clearTimeout: (timerId: number) => void }).clearTimeout(timerId);
        }
    }

}