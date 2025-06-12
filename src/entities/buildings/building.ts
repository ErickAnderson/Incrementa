import { BaseEntity } from "../../core/base-entity";
import { Upgrade } from "../../core/upgrade";
import { logger } from "../../utils/logger";

/**
 * Base class for all buildings, includes shared functionality for upgrading.
 * Implements PRD Building specification with construction lifecycle and level system.
 *
 * @property {Record<string, number>} cost - Cost to build the building.
 * @property {number} buildTime - Time required to build the building.
 * @property {number} productionRate - Rate at which the building produces or mines resources.
 * @property {number} level - Current level of the building.
 * @property {boolean} isBuilding - Whether construction is in progress.
 * @property {Upgrade[]} upgradesApplied - Array of upgrades applied to this building.
 * @extends {BaseEntity}
 */
export class Building extends BaseEntity {
    cost: Record<string, number>;
    buildTime: number;
    productionRate: number;
    level: number;
    isBuilding: boolean;
    upgradesApplied: Upgrade[];
    private constructionTimerId: number | null;

    /**
     * Constructor for the Building class.
     *
     * @param config - Building configuration object
     * @param config.name - The display name of the building (e.g., "Gold Mine", "Steel Factory")
     * @param config.description - Optional description of what this building does
     * @param config.cost - Resource costs to construct this building (e.g., {wood: 20, stone: 10})
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
        cost?: Record<string, number>;
        buildTime?: number;
        productionRate?: number;
        level?: number;
        unlockCondition?: () => boolean;
        id?: string;
        tags?: string[];
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            unlockCondition: config.unlockCondition,
            tags: config.tags
        });
        this.cost = config.cost || {};
        this.buildTime = config.buildTime || 0;
        this.productionRate = config.productionRate || 0;
        this.level = config.level || 1;
        this.isBuilding = false;
        this.upgradesApplied = [];
        this.constructionTimerId = null;
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
    onLevelUp(newLevel: number): void {
        logger.info(`${this.name} leveled up to level ${newLevel}`);
        this.emit('levelUp', { building: this, oldLevel: this.level, newLevel });
    }

    /**
     * Starts the construction process
     * @returns Whether construction was started successfully
     */
    startConstruction(): boolean {
        if (this.isBuilding) {
            return false;
        }
        
        this.isBuilding = true;
        this.onBuildStart();
        
        // Schedule construction completion with environment-agnostic timer
        this.constructionTimerId = this.scheduleTimer(() => {
            this.completeConstruction();
        }, this.buildTime * 1000);
        
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
        this.level += levels;
        this.onLevelUp(this.level);
        
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


    /**
     * Gets the total cost for the current level
     * Override in subclasses for level-based cost scaling
     */
    getCurrentCost(): Record<string, number> {
        return this.cost;
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
        if (typeof (globalThis as any).setTimeout === 'function') {
            return (globalThis as any).setTimeout(callback, delay);
        } else {
            callback();
            return 0;
        }
    }

    /**
     * Environment-agnostic timer clearing
     * @private
     */
    private clearTimer(timerId: number): void {
        if (typeof (globalThis as any).clearTimeout === 'function') {
            (globalThis as any).clearTimeout(timerId);
        }
    }

}