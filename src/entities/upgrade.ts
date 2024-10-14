import {Entity} from "./entity";

/**
 * Upgrade class to apply effects to buildings, storage, or resources.
 */
export class Upgrade extends Entity {
    effect: any; // The effect of the upgrade (e.g., increase rate, capacity)
    cost: Record<string, number>; // Cost of the upgrade

    constructor(
        name: string,
        description: string,
        effect: any,
        cost: Record<string, number>,
        unlockCondition: any
    ) {
        super(name, description, unlockCondition);
        this.effect = effect;
        this.cost = cost;
    }

    // Apply the upgrade effect
    apply() {
        console.log(`${this.name} upgrade applied.`);
        this.effect();
    }
}
