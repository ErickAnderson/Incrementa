import {Building} from "./building.ts";
import {Resource} from "./resource.ts";

/**
 * Miner class responsible for gathering resources over time.
 */
export class Miner extends Building {
    resource: Resource; // Resource being mined
    gatherRate: number; // Rate at which the miner gathers resources

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

    // Gather resources function, specific to Miners
    gatherResources() {
        this.resource.amount += this.gatherRate;
        console.log(
            `${this.name} gathered ${this.gatherRate} ${this.resource.name}.`
        );
    }
}

