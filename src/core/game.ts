import { Building, Resource, Storage } from "../entities";
import { Upgrade } from "./upgrade";
import { SaveManager } from "./saveManager";
import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";
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
    
    /** Centralized collection of all entities */
    private entities: Map<string, BaseEntity>;
    
    /** Timestamp of the last game update */
    private lastUpdate: number;
    
    /** Flag indicating if the game loop is running */
    private isRunning: boolean;

    /** Custom timer ID for environment-agnostic game loop */
    private gameLoopTimerId: number | null;

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
        this.entities = new Map();
        this.lastUpdate = Date.now();
        this.isRunning = false;
        this.gameLoopTimerId = null;
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
     * Adds an entity to the game and registers it for updates
     * @param entity - The entity to add
     */
    addEntity(entity: BaseEntity): void {
        this.entities.set(entity.id, entity);
        
        // Add to specific collections for backward compatibility
        if (entity instanceof Resource) {
            this.resources.push(entity);
        } else if (entity instanceof Building) {
            this.buildings.push(entity);
            if (entity instanceof Storage) {
                this.storages.push(entity);
            }
        } else if (entity instanceof Upgrade) {
            this.upgrades.push(entity);
        }
        
        logger.info(`Entity ${entity.name} (${entity.id}) added to game`);
    }

    /**
     * Removes an entity from the game
     * @param entityId - The ID of the entity to remove
     * @returns Whether the entity was successfully removed
     */
    removeEntity(entityId: string): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) {
            return false;
        }

        // Remove from specific collections
        if (entity instanceof Resource) {
            const index = this.resources.indexOf(entity);
            if (index > -1) this.resources.splice(index, 1);
        } else if (entity instanceof Building) {
            const index = this.buildings.indexOf(entity);
            if (index > -1) this.buildings.splice(index, 1);
            if (entity instanceof Storage) {
                const storageIndex = this.storages.indexOf(entity);
                if (storageIndex > -1) this.storages.splice(storageIndex, 1);
            }
        } else if (entity instanceof Upgrade) {
            const index = this.upgrades.indexOf(entity);
            if (index > -1) this.upgrades.splice(index, 1);
        }

        // Clean up event listeners
        entity.removeAllListeners();
        
        this.entities.delete(entityId);
        logger.info(`Entity ${entity.name} (${entityId}) removed from game`);
        return true;
    }

    /**
     * Gets an entity by its ID
     * @param entityId - The ID of the entity to retrieve
     * @returns The entity if found, undefined otherwise
     */
    getEntityById(entityId: string): BaseEntity | undefined {
        return this.entities.get(entityId);
    }

    /**
     * Gets a resource by its ID
     * @param resourceId - The ID of the resource to retrieve
     * @returns The resource if found, undefined otherwise
     */
    getResourceById(resourceId: string): Resource | undefined {
        const entity = this.entities.get(resourceId);
        return entity instanceof Resource ? entity : undefined;
    }

    /**
     * Gets a resource by its name (for backward compatibility)
     * @param name - The name of the resource to retrieve
     * @returns The resource if found, undefined otherwise
     */
    getResourceByName(name: string): Resource | undefined {
        return this.resources.find(r => r.name === name);
    }

    /**
     * Factory method to create and register a new resource
     * @param config - Resource configuration
     * @returns The created resource
     */
    createResource(config: {
        id?: string;
        name: string;
        description?: string;
        initialAmount?: number;
        rate?: number;
        basePassiveRate?: number;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Resource {
        const resource = new Resource(config);
        this.addEntity(resource);
        return resource;
    }

    /**
     * Factory method to create and register a new building
     * @param config - Building configuration
     * @returns The created building
     */
    createBuilding(config: {
        id?: string;
        name: string;
        description?: string;
        cost?: Record<string, number>;
        buildTime?: number;
        productionRate?: number;
        level?: number;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Building {
        const building = new Building(config);
        this.addEntity(building);
        return building;
    }

    /**
     * Factory method to create and register a new upgrade
     * @param config - Upgrade configuration
     * @returns The created upgrade
     */
    createUpgrade(config: {
        id?: string;
        name: string;
        description?: string;
        effect?: any;
        cost?: Record<string, number>;
        unlockCondition?: () => boolean;
        tags?: string[];
    }): Upgrade {
        const upgrade = new Upgrade(config);
        this.addEntity(upgrade);
        return upgrade;
    }

    /**
     * Generic factory method to create and register any entity type
     * @param EntityClass - The entity class constructor
     * @param config - Entity configuration
     * @returns The created entity
     */
    createEntity<T extends BaseEntity>(EntityClass: new (config: any) => T, config: any): T {
        const entity = new EntityClass(config);
        this.addEntity(entity);
        return entity;
    }

    /**
     * Gets the current game time
     * @returns Current timestamp
     */
    getCurrentTime(): number {
        return Date.now();
    }

    /**
     * Saves the current game state to persistent storage.
     * @returns {void}
     */
    saveState(): void {
        // TODO: Implement actual save functionality
        logger.info("Game state saved.");
    }

    /**
     * Loads the previously saved game state from persistent storage.
     * @returns {void}
     */
    loadState(): void {
        // TODO: Implement actual load functionality
        logger.info("Game state loaded.");
    }

    /**
     * Starts the game and main game loop
     * @returns {void}
     */
    start(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameLoop();
        logger.info('Game started');
    }

    /**
     * Pauses the game and game loop
     * @returns {void}
     */
    pause(): void {
        this.isRunning = false;
        if (this.gameLoopTimerId !== null) {
            this.clearTimer(this.gameLoopTimerId);
            this.gameLoopTimerId = null;
        }
        logger.info('Game paused');
    }

    /**
     * Resumes the game and game loop
     * @returns {void}
     */
    resume(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastUpdate = Date.now();
        this.gameLoop();
        logger.info('Game resumed');
    }


    /**
     * Main game loop that updates game state based on elapsed time.
     * Handles resource generation, entity unlocking, and entity updates.
     * @private
     * @returns {void}
     */
    private gameLoop(): void {
        if (!this.isRunning) return;

        const now = Date.now();
        const deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;

        // Update all entities
        this.updateEntities(deltaTime);
        
        // Legacy resource update for backward compatibility
        this.updateResources(deltaTime);
        
        // Check unlock conditions for all entities
        this.checkUnlockConditions();

        this.gameLoopTimerId = this.scheduleTimer(() => this.gameLoop(), 16);
    }

    /**
     * Calls onUpdate on all entities that need active updates
     * @private
     * @param deltaTime - Time elapsed since last update in milliseconds
     */
    private updateEntities(deltaTime: number): void {
        for (const entity of this.entities.values()) {
            if (entity.isUnlocked) {
                entity.onUpdate(deltaTime);
            }
        }
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
        for (const entity of this.entities.values()) {
            if (!entity.isUnlocked) {
                entity.unlock();
            }
        }
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

    /**
     * Environment-agnostic timer scheduling
     * Uses setTimeout in browsers/Node.js environments that support it,
     * otherwise falls back to immediate execution
     * @private
     */
    private scheduleTimer(callback: () => void, delay: number): number {
        if (typeof (globalThis as any).setTimeout === 'function') {
            return (globalThis as any).setTimeout(callback, delay);
        } else {
            callback();
            return 0;
        }
    }

    /**
     * Environment-agnostic timer clearing
     * @private
     */
    private clearTimer(timerId: number): void {
        if (typeof (globalThis as any).clearTimeout === 'function') {
            (globalThis as any).clearTimeout(timerId);
        }
    }

}
