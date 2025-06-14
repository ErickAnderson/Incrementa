// Forward declaration for the Game interface to avoid circular dependencies
export interface IGame {
    eventManager?: {
        emitFromEntity(entityId: string, eventName: string, data?: unknown): void;
    };
}

/**
 * Interface for entities that need a reference to the game instance
 */
export interface GameAware {
    /**
     * Sets the game instance reference
     * @param game - The game instance to reference
     */
    setGameReference(game: IGame): void;
    
    /**
     * Gets the current game instance reference
     * @returns The game instance or undefined if not set
     */
    getGameReference(): IGame | undefined;
}

/**
 * Interface for entities that can provide resource amounts
 */
export interface ResourceProvider {
    /** Current amount of the resource */
    amount: number;
    
    /**
     * Increases the resource amount
     * @param amount - Amount to add
     * @returns Whether the operation was successful
     */
    increment(amount: number): boolean;
    
    /**
     * Decreases the resource amount
     * @param amount - Amount to remove
     * @returns Whether the operation was successful
     */
    decrement(amount: number): boolean;
}

/**
 * Interface for entities that have capacity limits
 */
export interface CapacityProvider {
    /**
     * Gets the capacity limit for a specific resource
     * @param resourceId - The resource ID to check
     * @returns The capacity limit, or undefined if unlimited
     */
    getCapacityFor(resourceId: string): number | undefined;
    
    /**
     * Gets all resource IDs managed by this capacity provider
     * @returns Array of resource IDs
     */
    getManagedResourceIds(): string[];
}

/**
 * Type guard to check if an entity implements GameAware interface
 * @param entity - The entity to check
 * @returns Whether the entity implements GameAware
 */
export function isGameAware(entity: unknown): entity is GameAware {
    return entity && 
           typeof entity.setGameReference === 'function' &&
           typeof entity.getGameReference === 'function';
}

/**
 * Type guard to check if an entity implements ResourceProvider interface
 * @param entity - The entity to check
 * @returns Whether the entity implements ResourceProvider
 */
export function isResourceProvider(entity: unknown): entity is ResourceProvider {
    return entity &&
           typeof entity.amount === 'number' &&
           typeof entity.increment === 'function' &&
           typeof entity.decrement === 'function';
}

/**
 * Type guard to check if an entity implements CapacityProvider interface
 * @param entity - The entity to check
 * @returns Whether the entity implements CapacityProvider
 */
export function isCapacityProvider(entity: unknown): entity is CapacityProvider {
    return entity &&
           typeof entity.getCapacityFor === 'function' &&
           typeof entity.getManagedResourceIds === 'function';
}

/**
 * Mixin for GameAware functionality
 * Provides standard implementation of game reference management
 */
export class GameReferenceMixin implements GameAware {
    protected _game?: IGame;

    /**
     * Sets the game instance reference
     * @param game - The game instance to reference
     */
    setGameReference(game: IGame): void {
        this._game = game;
    }

    /**
     * Gets the current game instance reference
     * @returns The game instance or undefined if not set
     */
    getGameReference(): IGame | undefined {
        return this._game;
    }

    /**
     * Gets the game instance with type assertion
     * @returns The game instance
     * @throws Error if game reference is not set
     */
    protected requireGame(): IGame {
        if (!this._game) {
            throw new Error(`${this.constructor.name}: Game reference not set`);
        }
        return this._game;
    }
}