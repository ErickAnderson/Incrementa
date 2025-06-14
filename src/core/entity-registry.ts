import { BaseEntity } from "./base-entity";
import { Resource } from "../entities/resources/resource";
import { Building } from "../entities/buildings/building";
import { Storage } from "../entities/buildings/storage";
import { Upgrade } from "./upgrade";
import { EventManager } from "./event-manager";
import { logger } from "../utils/logger";
import { IGame } from "./game-aware";

/**
 * Entity registration result
 */
export interface EntityRegistrationResult {
    /** Whether the registration was successful */
    success: boolean;
    /** Error message if registration failed */
    error?: string;
    /** The entity that was registered */
    entity?: BaseEntity;
}

/**
 * Entity statistics
 */
export interface EntityStats {
    /** Total number of entities */
    total: number;
    /** Number of unlocked entities */
    unlocked: number;
    /** Breakdown by entity type */
    byType: {
        resources: number;
        buildings: number;
        storages: number;
        upgrades: number;
        others: number;
    };
}

/**
 * Manages entity registration, lookup, and lifecycle
 * Provides type-safe entity management with automatic categorization
 */
export class EntityRegistry {
    private entities: Map<string, BaseEntity>;
    private resources: Resource[];
    private buildings: Building[];
    private storages: Storage[];
    private upgrades: Upgrade[];
    private eventManager: EventManager;

    /**
     * Creates a new EntityRegistry instance
     * @param eventManager - The event manager for emitting entity events
     */
    constructor(eventManager: EventManager) {
        this.entities = new Map();
        this.resources = [];
        this.buildings = [];
        this.storages = [];
        this.upgrades = [];
        this.eventManager = eventManager;
    }

    /**
     * Registers a new entity in the registry
     * Automatically categorizes the entity and sets up game references
     * @param entity - The entity to register
     * @param gameInstance - The game instance to inject into the entity
     * @returns Registration result
     */
    registerEntity(entity: BaseEntity, gameInstance: IGame): EntityRegistrationResult {
        if (!entity.id) {
            return {
                success: false,
                error: "Entity must have an ID"
            };
        }

        if (this.entities.has(entity.id)) {
            return {
                success: false,
                error: `Entity with ID '${entity.id}' already exists`
            };
        }

        try {
            // Register in main collection
            this.entities.set(entity.id, entity);

            // Categorize and register in type-specific collections
            this.categorizeEntity(entity);

            // Set game reference if entity supports it
            this.setGameReference(entity, gameInstance);

            // Emit registration event
            this.eventManager.emitSystemEvent('entityRegistered', {
                entityId: entity.id,
                entityType: entity.constructor.name,
                entityName: entity.name
            });

            logger.debug(`EntityRegistry: Registered ${entity.constructor.name} '${entity.name}' with ID ${entity.id}`);

            return {
                success: true,
                entity
            };
        } catch (error) {
            // Cleanup partial registration
            this.entities.delete(entity.id);
            this.removeFromTypeCollections(entity);

            return {
                success: false,
                error: `Failed to register entity: ${error}`
            };
        }
    }

    /**
     * Unregisters an entity from the registry
     * @param entityId - The ID of the entity to unregister
     * @returns Whether the unregistration was successful
     */
    unregisterEntity(entityId: string): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) {
            logger.warn(`EntityRegistry: Attempted to unregister non-existent entity ${entityId}`);
            return false;
        }

        try {
            // Remove from main collection
            this.entities.delete(entityId);

            // Remove from type-specific collections
            this.removeFromTypeCollections(entity);

            // Clean up entity references
            if (typeof entity.destroy === 'function') {
                entity.destroy();
            }

            // Emit unregistration event
            this.eventManager.emitSystemEvent('entityUnregistered', {
                entityId,
                entityType: entity.constructor.name,
                entityName: entity.name
            });

            logger.debug(`EntityRegistry: Unregistered ${entity.constructor.name} '${entity.name}'`);
            return true;
        } catch (error) {
            logger.error(`EntityRegistry: Failed to unregister entity ${entityId}: ${error}`);
            return false;
        }
    }

    /**
     * Gets an entity by its ID
     * @param entityId - The ID of the entity to retrieve
     * @returns The entity, or undefined if not found
     */
    getEntityById(entityId: string): BaseEntity | undefined {
        return this.entities.get(entityId);
    }

    /**
     * Gets an entity by ID with type checking
     * @param entityId - The ID of the entity to retrieve
     * @param entityClass - The expected class of the entity
     * @returns The entity cast to the expected type, or undefined
     */
    getEntityByIdTyped<T extends BaseEntity>(entityId: string, entityClass: new (...args: unknown[]) => T): T | undefined {
        const entity = this.entities.get(entityId);
        if (entity && entity instanceof entityClass) {
            return entity as T;
        }
        return undefined;
    }

    /**
     * Gets all entities of a specific type
     * @param entityClass - The class to filter by
     * @returns Array of entities of the specified type
     */
    getEntitiesByType<T extends BaseEntity>(entityClass: new (...args: unknown[]) => T): T[] {
        const result: T[] = [];
        for (const entity of this.entities.values()) {
            if (entity instanceof entityClass) {
                result.push(entity as T);
            }
        }
        return result;
    }

    /**
     * Gets all unlocked entities
     * @returns Array of unlocked entities
     */
    getUnlockedEntities(): BaseEntity[] {
        return Array.from(this.entities.values()).filter(entity => entity.isUnlocked);
    }

    /**
     * Gets all entities that need update calls
     * @returns Array of entities that should receive onUpdate calls
     */
    getUpdatableEntities(): BaseEntity[] {
        return Array.from(this.entities.values()).filter(entity => 
            entity.isUnlocked && typeof entity.onUpdate === 'function'
        );
    }

    /**
     * Gets all resources
     * @returns Array of all resource entities
     */
    getResources(): Resource[] {
        return [...this.resources];
    }

    /**
     * Gets all buildings
     * @returns Array of all building entities
     */
    getBuildings(): Building[] {
        return [...this.buildings];
    }

    /**
     * Gets all storage buildings
     * @returns Array of all storage building entities
     */
    getStorages(): Storage[] {
        return [...this.storages];
    }

    /**
     * Gets all upgrades
     * @returns Array of all upgrade entities
     */
    getUpgrades(): Upgrade[] {
        return [...this.upgrades];
    }

    /**
     * Gets all entities registered in the registry
     * @returns Array of all entities
     */
    getAllEntities(): BaseEntity[] {
        return Array.from(this.entities.values());
    }

    /**
     * Gets entity statistics
     * @returns Object with entity counts and breakdown
     */
    getEntityStats(): EntityStats {
        const unlocked = Array.from(this.entities.values()).filter(e => e.isUnlocked).length;

        return {
            total: this.entities.size,
            unlocked,
            byType: {
                resources: this.resources.length,
                buildings: this.buildings.length,
                storages: this.storages.length,
                upgrades: this.upgrades.length,
                others: this.entities.size - this.resources.length - this.buildings.length - this.upgrades.length
            }
        };
    }

    /**
     * Finds entities by name (case-insensitive partial match)
     * @param namePattern - The name pattern to search for
     * @returns Array of matching entities
     */
    findEntitiesByName(namePattern: string): BaseEntity[] {
        const pattern = namePattern.toLowerCase();
        return Array.from(this.entities.values()).filter(entity =>
            entity.name.toLowerCase().includes(pattern)
        );
    }

    /**
     * Validates the integrity of the entity registry
     * @returns Array of validation issues found
     */
    validateRegistry(): string[] {
        const issues: string[] = [];
        const seenIds = new Set<string>();

        // Check for duplicate IDs
        for (const [id, entity] of this.entities) {
            if (seenIds.has(id)) {
                issues.push(`Duplicate entity ID found: ${id}`);
            }
            seenIds.add(id);

            // Check entity ID consistency
            if (entity.id !== id) {
                issues.push(`Entity ID mismatch: map key '${id}' vs entity ID '${entity.id}'`);
            }

            // Check for missing names
            if (!entity.name || entity.name.trim().length === 0) {
                issues.push(`Entity ${id} has no name`);
            }
        }

        // Validate type collections consistency
        const expectedResourceCount = this.getEntitiesByType(Resource).length;
        if (this.resources.length !== expectedResourceCount) {
            issues.push(`Resource collection inconsistency: stored ${this.resources.length}, expected ${expectedResourceCount}`);
        }

        const expectedBuildingCount = this.getEntitiesByType(Building).length;
        if (this.buildings.length !== expectedBuildingCount) {
            issues.push(`Building collection inconsistency: stored ${this.buildings.length}, expected ${expectedBuildingCount}`);
        }

        return issues;
    }

    /**
     * Categorizes an entity and adds it to the appropriate type-specific collection
     * @param entity - The entity to categorize
     */
    private categorizeEntity(entity: BaseEntity): void {
        if (entity instanceof Resource) {
            this.resources.push(entity);
            logger.debug(`EntityRegistry: Categorized ${entity.name} as Resource`);
        }
        
        if (entity instanceof Building) {
            this.buildings.push(entity);
            logger.debug(`EntityRegistry: Categorized ${entity.name} as Building`);
            
            if (entity instanceof Storage) {
                this.storages.push(entity);
                logger.debug(`EntityRegistry: Also categorized ${entity.name} as Storage`);
            }
        }
        
        if (entity instanceof Upgrade) {
            this.upgrades.push(entity);
            logger.debug(`EntityRegistry: Categorized ${entity.name} as Upgrade`);
        }
    }

    /**
     * Removes an entity from all type-specific collections
     * @param entity - The entity to remove
     */
    private removeFromTypeCollections(entity: BaseEntity): void {
        if (entity instanceof Resource) {
            const index = this.resources.indexOf(entity);
            if (index !== -1) {
                this.resources.splice(index, 1);
            }
        }
        
        if (entity instanceof Building) {
            const buildingIndex = this.buildings.indexOf(entity);
            if (buildingIndex !== -1) {
                this.buildings.splice(buildingIndex, 1);
            }
            
            if (entity instanceof Storage) {
                const storageIndex = this.storages.indexOf(entity);
                if (storageIndex !== -1) {
                    this.storages.splice(storageIndex, 1);
                }
            }
        }
        
        if (entity instanceof Upgrade) {
            const index = this.upgrades.indexOf(entity);
            if (index !== -1) {
                this.upgrades.splice(index, 1);
            }
        }
    }

    /**
     * Sets the game reference on an entity if it supports it
     * @param entity - The entity to set the reference on
     * @param gameInstance - The game instance to inject
     */
    private setGameReference(entity: BaseEntity, gameInstance: IGame): void {
        if ('setGameReference' in entity && typeof (entity as Record<string, unknown>).setGameReference === 'function') {
            (entity as Record<string, unknown> & { setGameReference: (game: IGame) => void }).setGameReference(gameInstance);
        } else if ('setGame' in entity && typeof (entity as Record<string, unknown>).setGame === 'function') {
            (entity as Record<string, unknown> & { setGame: (game: IGame) => void }).setGame(gameInstance);
        }
    }
}