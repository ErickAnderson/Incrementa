import {Building, Resource, Storage, Upgrade} from "./entities";
/**
 * Game or Player class that holds the entire game state.
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

    // Display current resources
    getCurrentResources() {
        return this.resources;
    }

    // Display current buildings
    getCurrentBuildings() {
        return this.buildings;
    }

    // Display current upgrades
    getCurrentUpgrades() {
        return this.upgrades;
    }

    // Display current storage status
    getStorageStatus() {
        return this.storages;
    }

    // Save game state
    saveState() {
        console.log("Game state saved.");
    }

    // Load game state
    loadState() {
        console.log("Game state loaded.");
    }
}