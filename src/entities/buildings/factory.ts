import {Building} from "./building";
import {Resource} from "../resources/resource";

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
     * @param name - The name of the factory
     * @param description - A description of the factory
     * @param cost - The resources required to build this factory
     * @param buildTime - Time required to construct this factory
     * @param productionRate - Rate at which this factory produces resources
     * @param inputResources - Array of resources consumed during production
     * @param outputResources - Array of resources produced by this factory
     * @param unlockCondition - Condition that must be met to unlock this factory
     */
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

    /**
     * Produces resources by consuming input resources and generating output resources
     * Consumes 1 unit of each input resource to produce 1 unit of each output resource
     */
    produceResources() {
        // Assume we consume 1 unit of each input resource to produce output resources
        this.inputResources.forEach((resource) => resource.amount--);
        this.outputResources.forEach((resource) => resource.amount++);
        console.log(`${this.name} produced resources.`);
    }
}
