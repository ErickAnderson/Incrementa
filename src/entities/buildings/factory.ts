import {Building} from "./building";
import {Resource} from "../resources/resource";
import { logger } from "../../utils/logger";

/**
 * Factory class takes one or more resources as input and produces new resources.
 */
export class Factory extends Building {
    /** Resources that are consumed during production */
    inputResources: Resource[];
    
    /** Resources that are produced by this factory */
    outputResources: Resource[];

    /**
     * Creates a new Factory building
     * @param config - Factory configuration object
     * @param config.name - The display name of the factory (e.g., "Steel Mill", "Textile Factory")
     * @param config.description - Optional description of what this factory produces
     * @param config.cost - Resource costs to build this factory (e.g., {wood: 50, stone: 30})
     * @param config.buildTime - Time in seconds required to complete construction (defaults to 0)
     * @param config.productionRate - Base production speed multiplier (defaults to 0)
     * @param config.level - Starting level of the factory (defaults to 1)
     * @param config.inputResources - Array of resources this factory consumes to operate
     * @param config.outputResources - Array of resources this factory produces
     * @param config.unlockCondition - Function that returns true when this factory should become available
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.tags - Optional array of strings for categorizing this factory (e.g., ["production", "conversion"])
     */
    constructor(config: {
        name: string;
        description?: string;
        cost?: Record<string, number>;
        buildTime?: number;
        productionRate?: number;
        level?: number;
        inputResources: Resource[];
        outputResources: Resource[];
        unlockCondition?: () => boolean;
        id?: string;
        tags?: string[];
    }) {
        super({
            name: config.name,
            description: config.description,
            cost: config.cost,
            buildTime: config.buildTime,
            productionRate: config.productionRate,
            level: config.level,
            unlockCondition: config.unlockCondition,
            id: config.id,
            tags: config.tags
        });
        this.inputResources = config.inputResources;
        this.outputResources = config.outputResources;
    }

    /**
     * Produces resources by consuming input resources and generating output resources
     * Consumes 1 unit of each input resource to produce 1 unit of each output resource
     */
    produceResources() {
        // Check if we have enough input resources
        const canProduce = this.inputResources.every(resource => resource.amount >= 1);
        
        if (canProduce) {
            // Consume input resources
            this.inputResources.forEach((resource) => resource.decrement(1));
            // Produce output resources
            this.outputResources.forEach((resource) => resource.increment(1));
            logger.info(`${this.name} produced resources.`);
        } else {
            logger.info(`${this.name} cannot produce - insufficient input resources.`);
        }
    }
}