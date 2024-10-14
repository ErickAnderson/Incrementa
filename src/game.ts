import {Building, Resource, Storage, Upgrade} from "./entities";

/**
 * Game or Player class that holds the entire game state.
 *
 * @property {Resource[]} resources - List of all resources in the game.
 * @property {Building[]} buildings - List of all buildings in the game.
 * @property {Upgrade[]} upgrades - List of all upgrades in the game.
 * @property {Storage[]} storages - List of all storage buildings in the game.
 */
export class Game {
    resources: Resource[];
    buildings: Building[];
    upgrades: Upgrade[];
    storages: Storage[];

    constructor() {
        this.resources = [];
        this.buildings = [];
        this.upgrades = [];
        this.storages = [];
    }

    /**
     * Returns the list of all current resources in the game.
     *
     * @returns {Resource[]} - An array of resources.
     */
    getCurrentResources(): Resource[] {
        return this.resources;
    }

    /**
     * Returns the list of all current buildings in the game.
     *
     * @returns {Building[]} - An array of buildings.
     */
    getCurrentBuildings(): Building[] {
        return this.buildings;
    }

    /**
     * Returns the list of all current upgrades in the game.
     *
     * @returns {Upgrade[]} - An array of upgrades.
     */
    getCurrentUpgrades(): Upgrade[] {
        return this.upgrades;
    }

    /**
     * Returns the list of all current storages and their statuses.
     *
     * @returns {Storage[]} - An array of storages.
     */
    getStorageStatus(): Storage[] {
        return this.storages;
    }

    /**
     * Saves the current game state.
     *
     * @returns {void}
     */
    saveState(): void {
        console.log("Game state saved.");
    }

    /**
     * Loads the previously saved game state.
     *
     * @returns {void}
     */
    loadState(): void {
        console.log("Game state loaded.");
    }
}
