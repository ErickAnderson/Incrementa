import {Entity} from "../../core/entity";

/**
 * Resource class, representing anything the player can collect or spend.
 */
export class Resource extends Entity {
    /** Current amount of this resource */
    amount: number;
    
    /** Rate at which this resource is collected per second */
    rate: number;

    /**
     * Creates a new Resource
     * @param name - The name of the resource
     * @param description - A description of the resource
     * @param initialAmount - Starting amount of this resource
     * @param rate - Rate at which this resource is collected per second
     * @param unlockCondition - Condition that must be met to unlock this resource
     */
    constructor(
        name: string,
        description: string,
        initialAmount: number,
        rate: number,
        unlockCondition: any
    ) {
        super(name, description, unlockCondition);
        this.amount = initialAmount;
        this.rate = rate;
    }

    /**
     * Adds the specified amount to this resource's total
     * @param amount - The amount to add to this resource
     */
    collect(amount: number) {
        this.amount += amount;
    }

    /**
     * Updates the collection rate for this resource
     * @param rate - The new collection rate to set
     */
    setRate(rate: number) {
        this.rate = rate;
    }
}
