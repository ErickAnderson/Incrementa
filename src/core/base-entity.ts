import { logger } from "../utils/logger";

/**
 * Base abstract class for all game entities, providing shared properties and methods.
 * Implements PRD specification for BaseEntity with event emitters and lifecycle hooks.
 */
export abstract class BaseEntity {
    /** Unique identifier for the entity - user-defined or auto-generated */
    readonly id: string;
    
    /** The display name of the entity */
    name: string;
    
    /** Optional detailed description of the entity */
    description?: string;
    
    /** Flag indicating if the entity is currently unlocked */
    isUnlocked: boolean;
    
    /** Optional array for custom categorization and querying */
    tags?: string[];
    
    /** Function that determines if the entity should be unlocked */
    protected unlockCondition?: () => boolean;
    
    /** Event listener registry for this entity */
    private eventListeners: Map<string, Array<Function>> = new Map();

    /**
     * Creates a new BaseEntity instance
     * @param config - Configuration object for the entity
     * @param config.id - Optional unique identifier. If not provided, will be auto-generated from name
     * @param config.name - The display name of the entity
     * @param config.description - Optional detailed description of the entity
     * @param config.unlockCondition - Optional function that returns true when entity should unlock
     * @param config.tags - Optional array for custom categorization and querying
     * @param config.isUnlocked - Optional initial unlock state (defaults to false)
     */
    constructor(config: {
        id?: string;
        name: string;
        description?: string;
        unlockCondition?: () => boolean;
        tags?: string[];
        isUnlocked?: boolean;
    }) {
        this.id = config.id || this.generateId(config.name);
        this.name = config.name;
        this.description = config.description;
        this.unlockCondition = config.unlockCondition;
        this.tags = config.tags;
        this.isUnlocked = config.isUnlocked || false;
        
        // Call initialization hook after construction
        this.onInitialize();
    }


    /**
     * Generates a unique ID from the entity name
     * @param name - The entity name to generate ID from
     * @returns URL-friendly ID string
     */
    private generateId(name: string): string {
        return name.toLowerCase().replace(/\s+/g, "-");
    }

    /**
     * Registers an event listener for a specific event
     * @param eventName - The name of the event to listen for
     * @param callback - The callback function to execute when event is emitted
     */
    on(eventName: string, callback: Function): void {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName)!.push(callback);
    }

    /**
     * Removes an event listener for a specific event
     * @param eventName - The name of the event
     * @param callback - The specific callback to remove
     */
    off(eventName: string, callback: Function): void {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emits an event to all registered listeners
     * @param eventName - The name of the event to emit
     * @param data - Optional data to pass to event listeners
     */
    emit(eventName: string, data?: any): void {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.error(`Error in event listener for ${eventName}: ${error}`);
                }
            });
        }
    }

    /**
     * Removes all event listeners for this entity
     */
    removeAllListeners(): void {
        this.eventListeners.clear();
    }

    /**
     * Checks if the entity can be unlocked based on its condition
     * @returns Whether the unlock condition is met
     */
    checkUnlockCondition(): boolean {
        if (this.isUnlocked) return true;
        if (typeof this.unlockCondition === 'function') {
            return this.unlockCondition();
        }
        return false;
    }

    /**
     * Unlocks the entity if conditions are met
     * @returns Whether the unlock was successful
     */
    unlock(): boolean {
        if (this.isUnlocked) return true;
        
        if (this.checkUnlockCondition()) {
            this.isUnlocked = true;
            this.onUnlock();
            this.emit('unlocked', { entity: this });
            return true;
        }
        return false;
    }

    /**
     * Abstract lifecycle method - must be implemented by subclasses
     * Called once when the entity is created and added to the game
     */
    abstract onInitialize(): void;

    /**
     * Lifecycle method called when entity is unlocked
     * Can be overridden by subclasses for custom unlock behavior
     */
    onUnlock(): void {
        logger.info(`${this.name} unlocked!`);
    }

    /**
     * Lifecycle method called on each game tick by the central Timer
     * Override in subclasses that need active updates
     * @param deltaTime - Time elapsed since last update in milliseconds
     */
    onUpdate(_deltaTime: number): void {
        // Base implementation does nothing - override in subclasses as needed
    }


    /**
     * Gets the slug (URL-friendly version) of the entity name
     * @returns URL-friendly string
     */
    get slug(): string {
        return this.id;
    }

    /**
     * Checks if the entity has a specific tag
     * @param tag - The tag to check for
     * @returns Whether the entity has the specified tag
     */
    hasTag(tag: string): boolean {
        return this.tags ? this.tags.includes(tag) : false;
    }

    /**
     * Adds a tag to the entity
     * @param tag - The tag to add
     */
    addTag(tag: string): void {
        if (!this.tags) {
            this.tags = [];
        }
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
            this.emit('tagAdded', { tag, entity: this });
        }
    }

    /**
     * Removes a tag from the entity
     * @param tag - The tag to remove
     */
    removeTag(tag: string): void {
        if (this.tags) {
            const index = this.tags.indexOf(tag);
            if (index > -1) {
                this.tags.splice(index, 1);
                this.emit('tagRemoved', { tag, entity: this });
            }
        }
    }

    /**
     * Returns a plain object representation of the entity for serialization
     * @returns Serializable object representation
     */
    toJSON(): any {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            isUnlocked: this.isUnlocked,
            tags: this.tags
        };
    }

}