import { Building, Resource, Storage } from "../entities";
import { Upgrade } from "./upgrade";
import { SaveManager } from "./saveManager";
/**
 * Game class that manages the entire game state and core loop functionality.
 */
export class Game {
    /** List of all resources in the game */
    private resources: Resource[];
    
    /** List of all buildings in the game */
    private buildings: Building[];
    
    /** List of all upgrades in the game */
    private upgrades: Upgrade[];
    
    /** List of all storage buildings in the game */
    private storages: Storage[];
    
    /** Timestamp of the last game update */
    private lastUpdate: number;
    
    /** Flag indicating if the game loop is running */
    private isRunning: boolean;

    private saveManager: SaveManager;

    /**
     * Creates a new Game instance and initializes empty collections
     */
    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
        this.resources = [];
        this.buildings = [];
        this.upgrades = [];
        this.storages = [];
        this.lastUpdate = Date.now();
        this.isRunning = false;
    }

    /**
     * Returns all current resources in the game.
     * @returns {Resource[]} Array of all game resources
     */
    getCurrentResources(): Resource[] {
        return this.resources;
    }

    /**
     * Returns all current buildings in the game.
     * @returns {Building[]} Array of all game buildings
     */
    getCurrentBuildings(): Building[] {
        return this.buildings;
    }

    /**
     * Returns all current upgrades in the game.
     * @returns {Upgrade[]} Array of all game upgrades
     */
    getCurrentUpgrades(): Upgrade[] {
        return this.upgrades;
    }

    /**
     * Returns all current storage buildings and their status.
     * @returns {Storage[]} Array of all storage buildings
     */
    getStorageStatus(): Storage[] {
        return this.storages;
    }

    /**
     * Saves the current game state to persistent storage.
     * @returns {void}
     */
    saveState(): void {
        // TODO: Implement actual save functionality
        console.log("Game state saved.");
    }

    /**
     * Loads the previously saved game state from persistent storage.
     * @returns {void}
     */
    loadState(): void {
        // TODO: Implement actual load functionality
        console.log("Game state loaded.");
    }

    /**
     * Starts the main game loop if it's not already running.
     * @returns {void}
     */
    startGameLoop(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameLoop();
    }

    /**
     * Stops the main game loop.
     * @returns {void}
     */
    stopGameLoop(): void {
        this.isRunning = false;
    }

    /**
     * Main game loop that updates game state based on elapsed time.
     * Handles resource generation and entity unlocking.
     * @private
     * @returns {void}
     */
    private gameLoop(): void {
        if (!this.isRunning) return;

        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;

        this.updateResources(deltaTime);
        this.checkUnlockConditions();

        requestAnimationFrame(() => this.gameLoop());
    }

    /**
     * Updates all unlocked resources based on their rates and elapsed time.
     * @private
     * @param {number} deltaTime - Time elapsed since last update in seconds
     * @returns {void}
     */
    private updateResources(deltaTime: number): void {
        this.resources.forEach(resource => {
            if (resource.isUnlocked) {
                resource.amount += resource.rate * deltaTime;
            }
        });
    }

    /**
     * Checks and processes unlock conditions for all game entities.
     * @private
     * @returns {void}
     */
    private checkUnlockConditions(): void {
        const entities = [...this.resources, ...this.buildings, ...this.upgrades];
        
        entities.forEach(entity => {
            if (!entity.isUnlocked) {
                entity.unlock();
            }
        });
    }

    /**
     * Calculates offline progress for resources based on time since last play.
     * @returns {void}
     */
    calculateOfflineProgress(): void {
        const lastPlayTime = this.saveManager.getLastPlayTime();
        if (!lastPlayTime) return;

        const now = Date.now();
        const offlineTime = (now - lastPlayTime) / 1000; // Convert to seconds
        
        // Calculate offline gains
        this.resources.forEach(resource => {
            if (resource.isUnlocked) {
                const offlineGain = resource.rate * offlineTime;
                resource.amount += offlineGain;
            }
        });
        
        this.saveManager.setLastPlayTime(now);
    }
}
