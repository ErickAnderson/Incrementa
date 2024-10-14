import {Entity} from "./entity.ts";
import {Upgrade} from "./upgrade.ts";

/**
 * Base class for all buildings, includes shared functionality for upgrading.
 */
export class Building extends Entity {
    cost: Record<string, number>; // Cost to build the building
    buildTime: number; // Time required to build
    productionRate: number; // How fast it produces/mine resources
    upgrades: Upgrade[]; // Array of upgrades associated with the building

    constructor(
        name: string,
        description: string,
        cost: Record<string, number>,
        buildTime: number,
        productionRate: number,
        unlockCondition: any
    ) {
        super(name, description, unlockCondition);
        this.cost = cost;
        this.buildTime = buildTime;
        this.productionRate = productionRate;
        this.upgrades = [];
    }

    // Start building process
    startBuilding() {
        console.log(`Building ${this.name}...`);
    }

    // Add upgrade to the building
    addUpgrade(upgrade: Upgrade) {
        this.upgrades.push(upgrade);
    }
}
