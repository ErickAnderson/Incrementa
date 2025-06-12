import { BaseEntity } from "./base-entity";

/**
 * Upgrade class to apply effects to buildings, storage, or resources.
 *
 * @property {any} effect - The effect of the upgrade (e.g., increase rate, capacity).
 * @property {Record<string, number>} cost - Cost of the upgrade.
 * @extends {Entity}
 */
export class Upgrade extends BaseEntity {
    effect: any; // The effect of the upgrade (e.g., increase rate, capacity)
    cost: Record<string, number>; // Cost of the upgrade

    /**
     * Creates a new Upgrade instance
     * @param config - Upgrade configuration object
     * @param config.name - The display name of the upgrade (e.g., "Faster Mining", "Double Production")
     * @param config.description - Optional description of what this upgrade does
     * @param config.effect - Function that implements the upgrade effect when applied
     * @param config.cost - Resource costs to purchase this upgrade (e.g., {gold: 100, iron: 50})
     * @param config.unlockCondition - Function that returns true when this upgrade should become available
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.tags - Optional array of strings for categorizing this upgrade (e.g., ["efficiency", "automation"])
     */
    constructor(config: {
        name: string;
        description?: string;
        effect?: any;
        cost?: Record<string, number>;
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
        this.effect = config.effect;
        this.cost = config.cost || {};
    }


    /**
     * Lifecycle hook - called when upgrade is initialized
     */
    onInitialize(): void {
        this.log(`Upgrade ${this.name} initialized`);
    }

    // Apply the upgrade effect
    apply() {
        this.log(`${this.name} upgrade applied.`);
        this.effect();
    }
}
