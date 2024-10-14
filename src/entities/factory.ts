import {Building} from "./building.ts";
import {Resource} from "./resource.ts";

/**
 * Factory class takes one or more resources as input and produces new resources.
 */
export class Factory extends Building {
    inputResources: Resource[]; // Resources consumed as input
    outputResources: Resource[]; // Resources produced as output

    constructor(
        name: string,
        description: string,
        cost: Record<string, number>,
        buildTime: number,
        productionRate: number,
        inputResources: Resource[],
        outputResources: Resource[],
        unlockCondition: any
    ) {
        super(name, description, cost, buildTime, productionRate, unlockCondition);
        this.inputResources = inputResources;
        this.outputResources = outputResources;
    }

    // Produce resources from input resources
    produceResources() {
        // Assume we consume 1 unit of each input resource to produce output resources
        this.inputResources.forEach((resource) => resource.amount--);
        this.outputResources.forEach((resource) => resource.amount++);
        console.log(`${this.name} produced resources.`);
    }
}
