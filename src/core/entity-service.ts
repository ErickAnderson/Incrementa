import { BaseEntity } from './base-entity';
import { Resource } from '../entities/resources/resource';
import { Building } from '../entities/buildings/building';
import { Storage } from '../entities/buildings/storage';
import { Miner } from '../entities/buildings/miner';
import { Upgrade } from './upgrade';
import { logger } from '../utils/logger';
import type { CostDefinition } from '../types/cost-definition';
import type { UpgradeConfiguration } from '../types/upgrade-effects';

/**
 * Configuration for creating a resource
 */
export interface ResourceConfig {
    id?: string;
    name: string;
    description?: string;
    initialAmount?: number;
    rate?: number;
    basePassiveRate?: number;
    unlockCondition?: () => boolean;
    tags?: string[];
}

/**
 * Configuration for creating a building
 */
export interface BuildingConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];
    cost?: Record<string, number>; // Legacy support
    buildTime?: number;
    productionRate?: number;
    level?: number;
    unlockCondition?: () => boolean;
    tags?: string[];
}

/**
 * Configuration for creating a miner
 */
export interface MinerConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];
    cost?: Record<string, number>; // Legacy support
    buildTime?: number;
    gatherRate: number;
    resourceId: string;
    unlockCondition?: () => boolean;
    tags?: string[];
    efficiency?: number;
    autoStart?: boolean;
}

/**
 * Configuration for creating storage
 */
export interface StorageConfig {
    id?: string;
    name: string;
    description?: string;
    costs?: CostDefinition[];
    cost?: Record<string, number>; // Legacy support
    buildTime?: number;
    capacities?: Record<string, number>;
    unlockCondition?: () => boolean;
    tags?: string[];
}

/**
 * Configuration for creating an upgrade
 */
export interface UpgradeConfig {
    id?: string;
    name: string;
    description?: string;
    /** Data-driven effect configuration (effects + targets) */
    configuration?: UpgradeConfiguration;
    /** Legacy function or data effect */
    effect?: (() => void) | Record<string, unknown>;
    costs?: CostDefinition[];
    cost?: Record<string, number>; // Legacy support
    isRepeatable?: boolean;
    maxApplications?: number;
    unlockCondition?: () => boolean;
    tags?: string[];
}

/**
 * Interface for the entity service
 */
export interface IEntityService {
    // Entity management
    addEntity(entity: BaseEntity): boolean;
    removeEntity(entityId: string): boolean;
    getEntityById(entityId: string): BaseEntity | undefined;
    getAllEntities(): BaseEntity[];
    
    // Typed entity getters
    getResources(): Resource[];
    getBuildings(): Building[];
    getUpgrades(): Upgrade[];
    getStorages(): Storage[];
    
    // Factory methods
    createResource(config: ResourceConfig): Resource;
    createBuilding(config: BuildingConfig): Building;
    createMiner(config: MinerConfig): Miner;
    createStorage(config: StorageConfig): Storage;
    createUpgrade(config: UpgradeConfig): Upgrade;
    createEntity<T extends BaseEntity>(EntityClass: new (config: Record<string, unknown>) => T, config: Record<string, unknown>): T;
    
    // Resource-specific methods
    getResourceById(resourceId: string): Resource | undefined;
    getResourceByName(name: string): Resource | undefined;
    
    // Entity statistics
    getEntityStats(): {
        total: number;
        unlocked: number;
        resources: number;
        buildings: number;
        upgrades: number;
    };
    
    // Updatable entities
    getUpdatableEntities(): BaseEntity[];
    
    // Cleanup
    destroy(): void;
}

/**
 * Service responsible for managing all game entities
 * Extracted from Game class to reduce god class anti-pattern
 */
export class EntityService implements IEntityService {
    private entities = new Map<string, BaseEntity>();
    private resources = new Map<string, Resource>();
    private buildings = new Map<string, Building>();
    private upgrades = new Map<string, Upgrade>();
    private storages = new Map<string, Storage>();

    constructor(private game?: any) {
        logger.debug('EntityService: Initialized');
    }

    /**
     * Legacy compatibility method for registering entities (use addEntity instead)
     * @deprecated Use addEntity() instead
     */
    registerEntity(entity: BaseEntity, _game?: any): { success: boolean; error?: string } {
        try {
            const success = this.addEntity(entity);
            return { success };
        } catch (error) {
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            };
        }
    }

    /**
     * Adds an entity to the service
     */
    addEntity(entity: BaseEntity): boolean {
        if (this.entities.has(entity.id)) {
            logger.warn(`EntityService: Entity with id '${entity.id}' already exists`);
            return false;
        }

        this.entities.set(entity.id, entity);

        // Set game reference if available
        if (this.game && entity.setGameReference) {
            entity.setGameReference(this.game);
        }

        // Type-specific registration
        if (entity instanceof Resource) {
            this.resources.set(entity.id, entity);
        } else if (entity instanceof Storage) {
            this.storages.set(entity.id, entity);
            this.buildings.set(entity.id, entity); // Storage is also a building
        } else if (entity instanceof Building) {
            this.buildings.set(entity.id, entity);
        } else if (entity instanceof Upgrade) {
            this.upgrades.set(entity.id, entity);
        }

        logger.debug(`EntityService: Added entity '${entity.name}' (${entity.id})`);
        return true;
    }

    /**
     * Legacy compatibility method for unregistering entities (use removeEntity instead)
     * @deprecated Use removeEntity() instead
     */
    unregisterEntity(entityId: string): boolean {
        return this.removeEntity(entityId);
    }

    /**
     * Removes an entity from the service
     */
    removeEntity(entityId: string): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) {
            return false;
        }

        this.entities.delete(entityId);
        this.resources.delete(entityId);
        this.buildings.delete(entityId);
        this.upgrades.delete(entityId);
        this.storages.delete(entityId);

        logger.debug(`EntityService: Removed entity '${entity.name}' (${entityId})`);
        return true;
    }

    /**
     * Gets an entity by its ID
     */
    getEntityById(entityId: string): BaseEntity | undefined {
        return this.entities.get(entityId);
    }

    /**
     * Gets all entities
     */
    getAllEntities(): BaseEntity[] {
        return Array.from(this.entities.values());
    }

    /**
     * Gets all resources
     */
    getResources(): Resource[] {
        return Array.from(this.resources.values());
    }

    /**
     * Gets all buildings (including storage)
     */
    getBuildings(): Building[] {
        return Array.from(this.buildings.values());
    }

    /**
     * Gets all upgrades
     */
    getUpgrades(): Upgrade[] {
        return Array.from(this.upgrades.values());
    }

    /**
     * Gets all storage buildings
     */
    getStorages(): Storage[] {
        return Array.from(this.storages.values());
    }

    /**
     * Gets a resource by its ID
     */
    getResourceById(resourceId: string): Resource | undefined {
        return this.resources.get(resourceId);
    }

    /**
     * Gets a resource by its name (for backward compatibility)
     */
    getResourceByName(name: string): Resource | undefined {
        return Array.from(this.resources.values()).find(r => r.name === name);
    }

    /**
     * Factory method to create and register a new resource
     */
    createResource(config: ResourceConfig): Resource {
        const resource = new Resource(config);
        if (this.game) {
            resource.setGameReference(this.game);
        }
        this.addEntity(resource);
        return resource;
    }

    /**
     * Factory method to create and register a new building
     */
    createBuilding(config: BuildingConfig): Building {
        const building = new Building(config);
        if (this.game) {
            building.setGameReference(this.game);
        }
        this.addEntity(building);
        return building;
    }

    /**
     * Factory method to create and register a new miner building
     */
    createMiner(config: MinerConfig): Miner {
        const miner = new Miner(config);
        if (this.game) {
            miner.setGameReference(this.game);
        }
        this.addEntity(miner);
        return miner;
    }

    /**
     * Factory method to create and register a new storage building
     */
    createStorage(config: StorageConfig): Storage {
        // Log storage creation with capacity info
        const capacityInfo = config.capacities 
            ? Object.entries(config.capacities).map(([id, cap]) => `${id}:${cap}`).join(', ')
            : 'no capacities defined';
        logger.info(`EntityService: Creating storage '${config.name}' with capacities: ${capacityInfo}`);
        
        const storage = new Storage(config);
        if (this.game) {
            storage.setGameReference(this.game);
        }
        this.addEntity(storage);
        return storage;
    }

    /**
     * Factory method to create and register a new upgrade
     */
    createUpgrade(config: UpgradeConfig): Upgrade {
        const upgrade = new Upgrade(config);
        if (this.game) {
            upgrade.setGameReference(this.game);
        }
        this.addEntity(upgrade);
        return upgrade;
    }

    /**
     * Generic factory method to create and register any entity type
     */
    createEntity<T extends BaseEntity>(EntityClass: new (config: Record<string, unknown>) => T, config: Record<string, unknown>): T {
        const entity = new EntityClass(config);
        if (this.game) {
            entity.setGameReference(this.game);
        }
        this.addEntity(entity);
        return entity;
    }

    /**
     * Gets entity statistics
     */
    getEntityStats(): {
        total: number;
        unlocked: number;
        resources: number;
        buildings: number;
        upgrades: number;
    } {
        const allEntities = this.getAllEntities();
        return {
            total: allEntities.length,
            unlocked: allEntities.filter(e => e.isUnlocked).length,
            resources: this.resources.size,
            buildings: this.buildings.size,
            upgrades: this.upgrades.size
        };
    }

    /**
     * Gets entities that need active updates
     */
    getUpdatableEntities(): BaseEntity[] {
        return this.getAllEntities().filter(entity => 
            typeof entity.onUpdate === 'function' && entity.isUnlocked
        );
    }

    /**
     * Sets the game reference for all entities
     */
    setGameReference(game: any): void {
        this.game = game;
        for (const entity of this.entities.values()) {
            entity.setGameReference(game);
        }
    }

    /**
     * Cleanup method to release resources
     */
    destroy(): void {
        this.entities.clear();
        this.resources.clear();
        this.buildings.clear();
        this.upgrades.clear();
        this.storages.clear();
        logger.info('EntityService: Destroyed and resources cleaned up');
    }
}