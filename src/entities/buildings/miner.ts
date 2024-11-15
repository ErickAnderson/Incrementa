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
     * @param name - The name of the miner
     * @param description - A description of the miner
     * @param cost - The resources required to build this miner
     * @param buildTime - Time required to construct this miner
     * @param productionRate - Base production rate of this miner
     * @param gatherRate - Rate at which this miner gathers resources
     * @param resource - The resource this miner will gather
     * @param unlockCondition - Condition that must be met to unlock this miner
     */
    constructor(
        name: string,
        description: string,
        cost: Record<string, number>,
        buildTime: number,
        productionRate: number,
        gatherRate: number,
        resource: Resource,
        unlockCondition: any
    ) {
        super(name, description, cost, buildTime, productionRate, unlockCondition);
        this.resource = resource;
        this.gatherRate = gatherRate;
    }

    /**
     * Gathers resources at the miner's gather rate
     * Adds gathered resources directly to the resource's amount
     */
    gatherResources() {
        this.resource.amount += this.gatherRate;
        console.log(
            `${this.name} gathered ${this.gatherRate} ${this.resource.name}.`
        );
    }
}

