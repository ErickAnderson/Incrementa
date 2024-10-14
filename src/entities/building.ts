import {Entity} from "./entity.ts";
import {Upgrade} from "./upgrade.ts";

/**
 * Base class for all buildings, includes shared functionality for upgrading.
 *
 * @property {Record<string, number>} cost - Cost to build the building.
 * @property {number} buildTime - Time required to build the building.
 * @property {number} productionRate - Rate at which the building produces or mines resources.
 * @property {Upgrade[]} upgrades - Array of upgrades associated with the building.
 * @extends {Entity}
 */
export class Building extends Entity {
    cost: Record<string, number>;
    buildTime: number;
    productionRate: number;
    upgrades: Upgrade[];

    /**
     * Constructor for the Building class.
     *
     * @param {string} name - Name of the building.
     * @param {string} description - Description of the building.
     * @param {Record<string, number>} cost - Object representing the resource costs to build the building.
     * @param {number} buildTime - Time (in seconds or another unit) to build the building.
     * @param {number} productionRate - Rate at which the building produces or mines resources.
     * @param {any} unlockCondition - Condition that determines when the building is unlocked.
     */
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

    /**
     * Starts the building process, typically involving a timer or construction logic.
     *
     * @returns {void}
     */
    startBuilding(): void {
        console.log(`Building ${this.name}...`);
    }

    /**
     * Adds an upgrade to the building. The upgrade modifies certain properties of the building (e.g., production rate).
     *
     * @param {Upgrade} upgrade - The upgrade to add to the building.
     * @returns {void}
     */
    addUpgrade(upgrade: Upgrade): void {
        this.upgrades.push(upgrade);
    }
}
