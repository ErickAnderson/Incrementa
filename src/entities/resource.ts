import {Entity} from "./entity.ts";

/**
 * Resource class, representing anything the player can collect or spend.
 */
export class Resource extends Entity {
    amount: number;
    rate: number;

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

    // Collect a certain amount of resource
    collect(amount: number) {
        this.amount += amount;
    }

    // Set the rate of resource collection (used by miners)
    setRate(rate: number) {
        this.rate = rate;
    }
}
