import {Building} from "./building";
import {Resource} from "../resources/resource";

/**
 * Miner class responsible for gathering resources over time.
 */
export class Miner extends Building {
    /** The resource being mined by this miner */
    resource: Resource;
    
    /** Rate at which this miner gathers resources */
    gatherRate: number;

    /**
     * Creates a new Miner building
     * @param config - Miner configuration object
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.name - The display name of the miner (e.g., "Gold Mine", "Iron Excavator")
     * @param config.description - Optional description of what this miner extracts
     * @param config.cost - Resource costs to build this miner (e.g., {wood: 20, stone: 10})
     * @param config.buildTime - Time in seconds required to complete construction (defaults to 0)
     * @param config.productionRate - Base production multiplier (defaults to 0)
     * @param config.level - Starting level of the miner (defaults to 1)
     * @param config.gatherRate - Amount of target resource gathered per mining cycle
     * @param config.resource - The specific resource this miner will extract
     * @param config.unlockCondition - Function that returns true when this miner should become available
     * @param config.tags - Optional array of strings for categorizing this miner (e.g., ["mining", "automation"])
     */
    constructor(config: {
        id?: string;
        name: string;
        description?: string;
        tags?: string[];
        cost?: Record<string, number>;
        buildTime?: number;
        productionRate?: number;
        level?: number;
        gatherRate: number;
        resource: Resource;
        unlockCondition?: () => boolean;
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            tags: config.tags,
            cost: config.cost,
            buildTime: config.buildTime,
            productionRate: config.productionRate,
            level: config.level,
            unlockCondition: config.unlockCondition
        });
        this.resource = config.resource;
        this.gatherRate = config.gatherRate;
    }

    /**
     * Gathers resources at the miner's gather rate
     * Adds gathered resources directly to the resource's amount
     */
    gatherResources() {
        this.resource.increment(this.gatherRate);
        this.log(
            `${this.name} gathered ${this.gatherRate} ${this.resource.name}.`
        );
    }
}