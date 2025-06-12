import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";


/**
 * Interface for event statistics
 */
export interface EventStats {
    totalListeners: number;
    globalListeners: number;
    entityListeners: number;
    eventTypes: string[];
    eventsEmitted: number;
    errorsCount: number;
}

/**
 * Centralized manager for coordinating events across the game system
 */
export class EventManager {
    /** Global event listeners */
    private globalListeners: Map<string, Function[]>;
    
    /** Entity-specific event listeners */
    private entityListeners: Map<string, Map<string, Function[]>>;
    
    /** Registered entities for event routing */
    private registeredEntities: Map<string, BaseEntity>;
    
    /** Event emission statistics */
    private stats: {
        eventsEmitted: number;
        errorsCount: number;
    };
    
    /** Whether the event manager is active */
    private isActive: boolean;

    /** Debug mode for verbose logging */
    private debugMode: boolean;

    constructor(debugMode: boolean = false) {
        this.globalListeners = new Map();
        this.entityListeners = new Map();
        this.registeredEntities = new Map();
        this.stats = {
            eventsEmitted: 0,
            errorsCount: 0
        };
        this.isActive = true;
        this.debugMode = debugMode;
    }

    /**
     * Registers an entity for event routing
     * @param entity - The entity to register
     */
    registerEntity(entity: BaseEntity): void {
        this.registeredEntities.set(entity.id, entity);
        this.entityListeners.set(entity.id, new Map());
        
        if (this.debugMode) {
            logger.info(`Entity ${entity.name} (${entity.id}) registered with EventManager`);
        }
    }

    /**
     * Unregisters an entity from event routing
     * @param entityId - ID of the entity to unregister
     * @returns Whether the entity was successfully unregistered
     */
    unregisterEntity(entityId: string): boolean {
        const removed = this.registeredEntities.delete(entityId);
        this.entityListeners.delete(entityId);
        
        if (removed && this.debugMode) {
            logger.info(`Entity ${entityId} unregistered from EventManager`);
        }
        
        return removed;
    }

    /**
     * Emits a global event to all global listeners
     * @param eventName - Name of the event to emit
     * @param data - Optional data to pass with the event
     */
    emit(eventName: string, data?: any): void {
        if (!this.isActive) return;

        try {
            this.stats.eventsEmitted++;
            
            const listeners = this.globalListeners.get(eventName);
            if (listeners) {
                for (const callback of listeners) {
                    try {
                        callback(data);
                    } catch (error) {
                        this.stats.errorsCount++;
                        logger.error(`Error in global event listener for '${eventName}': ${error}`);
                    }
                }
            }
            
            if (this.debugMode) {
                logger.info(`Global event '${eventName}' emitted to ${listeners?.length || 0} listeners`);
            }
        } catch (error) {
            this.stats.errorsCount++;
            logger.error(`Error emitting global event '${eventName}': ${error}`);
        }
    }

    /**
     * Emits an event from a specific entity
     * @param entityId - ID of the entity emitting the event
     * @param eventName - Name of the event to emit
     * @param data - Optional data to pass with the event
     */
    emitFromEntity(entityId: string, eventName: string, data?: any): void {
        if (!this.isActive) return;

        try {
            this.stats.eventsEmitted++;
            
            // Emit to entity-specific listeners
            const entityEventListeners = this.entityListeners.get(entityId);
            if (entityEventListeners) {
                const listeners = entityEventListeners.get(eventName);
                if (listeners) {
                    for (const callback of listeners) {
                        try {
                            callback(data);
                        } catch (error) {
                            this.stats.errorsCount++;
                            logger.error(`Error in entity event listener for '${eventName}' on entity ${entityId}: ${error}`);
                        }
                    }
                }
            }
            
            // Also emit to global listeners with entity context
            const globalListeners = this.globalListeners.get(eventName);
            if (globalListeners) {
                const eventData = {
                    entityId,
                    entity: this.registeredEntities.get(entityId),
                    data
                };
                
                for (const callback of globalListeners) {
                    try {
                        callback(eventData);
                    } catch (error) {
                        this.stats.errorsCount++;
                        logger.error(`Error in global event listener for entity event '${eventName}': ${error}`);
                    }
                }
            }
            
            if (this.debugMode) {
                const entityListenerCount = entityEventListeners?.get(eventName)?.length || 0;
                const globalListenerCount = globalListeners?.length || 0;
                logger.info(`Entity event '${eventName}' from ${entityId} emitted to ${entityListenerCount} entity listeners and ${globalListenerCount} global listeners`);
            }
        } catch (error) {
            this.stats.errorsCount++;
            logger.error(`Error emitting entity event '${eventName}' from ${entityId}: ${error}`);
        }
    }

    /**
     * Adds a global event listener
     * @param eventName - Name of the event to listen for
     * @param callback - Function to call when event is emitted
     */
    on(eventName: string, callback: Function): void {
        if (typeof callback !== 'function') {
            throw new Error('Event callback must be a function');
        }

        if (!this.globalListeners.has(eventName)) {
            this.globalListeners.set(eventName, []);
        }
        
        this.globalListeners.get(eventName)!.push(callback);
        
        if (this.debugMode) {
            logger.info(`Global listener added for event '${eventName}'`);
        }
    }

    /**
     * Adds an entity-specific event listener
     * @param entityId - ID of the entity to listen to
     * @param eventName - Name of the event to listen for
     * @param callback - Function to call when event is emitted
     */
    onEntity(entityId: string, eventName: string, callback: Function): void {
        if (typeof callback !== 'function') {
            throw new Error('Event callback must be a function');
        }

        if (!this.entityListeners.has(entityId)) {
            logger.warn(`Entity ${entityId} not registered. Registering empty listener map.`);
            this.entityListeners.set(entityId, new Map());
        }
        
        const entityEventListeners = this.entityListeners.get(entityId)!;
        if (!entityEventListeners.has(eventName)) {
            entityEventListeners.set(eventName, []);
        }
        
        entityEventListeners.get(eventName)!.push(callback);
        
        if (this.debugMode) {
            logger.info(`Entity listener added for event '${eventName}' on entity ${entityId}`);
        }
    }

    /**
     * Removes a global event listener
     * @param eventName - Name of the event
     * @param callback - The callback function to remove
     * @returns Whether the listener was successfully removed
     */
    off(eventName: string, callback: Function): boolean {
        const listeners = this.globalListeners.get(eventName);
        if (!listeners) return false;
        
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
            
            // Clean up empty arrays
            if (listeners.length === 0) {
                this.globalListeners.delete(eventName);
            }
            
            if (this.debugMode) {
                logger.info(`Global listener removed for event '${eventName}'`);
            }
            return true;
        }
        
        return false;
    }

    /**
     * Removes an entity-specific event listener
     * @param entityId - ID of the entity
     * @param eventName - Name of the event
     * @param callback - The callback function to remove
     * @returns Whether the listener was successfully removed
     */
    offEntity(entityId: string, eventName: string, callback: Function): boolean {
        const entityEventListeners = this.entityListeners.get(entityId);
        if (!entityEventListeners) return false;
        
        const listeners = entityEventListeners.get(eventName);
        if (!listeners) return false;
        
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
            
            // Clean up empty arrays
            if (listeners.length === 0) {
                entityEventListeners.delete(eventName);
            }
            
            if (this.debugMode) {
                logger.info(`Entity listener removed for event '${eventName}' on entity ${entityId}`);
            }
            return true;
        }
        
        return false;
    }

    /**
     * Routes entity events through the global event system
     * This integrates entity event emitters with the global event manager
     * @param entity - The entity to route events for
     */
    routeEntityEvents(entity: BaseEntity): void {
        if (!this.registeredEntities.has(entity.id)) {
            this.registerEntity(entity);
        }
        
        // Override entity's emit method to route through EventManager
        const originalEmit = entity.emit.bind(entity);
        entity.emit = (eventName: string, data?: any) => {
            // Call original entity emit for local listeners
            originalEmit(eventName, data);
            
            // Route through global event manager
            this.emitFromEntity(entity.id, eventName, data);
        };
        
        if (this.debugMode) {
            logger.info(`Event routing enabled for entity ${entity.name} (${entity.id})`);
        }
    }

    /**
     * Removes all listeners for a specific event
     * @param eventName - Name of the event to clear
     */
    clearEvent(eventName: string): void {
        // Clear global listeners
        this.globalListeners.delete(eventName);
        
        // Clear entity listeners
        for (const entityEventListeners of this.entityListeners.values()) {
            entityEventListeners.delete(eventName);
        }
        
        if (this.debugMode) {
            logger.info(`All listeners cleared for event '${eventName}'`);
        }
    }

    /**
     * Removes all event listeners
     */
    clearAllListeners(): void {
        this.globalListeners.clear();
        this.entityListeners.clear();
        
        if (this.debugMode) {
            logger.info('All event listeners cleared');
        }
    }

    /**
     * Gets event statistics
     * @returns Object containing event statistics
     */
    getEventStats(): EventStats {
        let totalListeners = 0;
        let globalListeners = 0;
        let entityListeners = 0;
        const eventTypes = new Set<string>();
        
        // Count global listeners
        for (const [eventName, listeners] of this.globalListeners) {
            globalListeners += listeners.length;
            totalListeners += listeners.length;
            eventTypes.add(eventName);
        }
        
        // Count entity listeners
        for (const entityEventListeners of this.entityListeners.values()) {
            for (const [eventName, listeners] of entityEventListeners) {
                entityListeners += listeners.length;
                totalListeners += listeners.length;
                eventTypes.add(eventName);
            }
        }
        
        return {
            totalListeners,
            globalListeners,
            entityListeners,
            eventTypes: Array.from(eventTypes),
            eventsEmitted: this.stats.eventsEmitted,
            errorsCount: this.stats.errorsCount
        };
    }

    /**
     * Enables or disables debug mode
     * @param enabled - Whether to enable debug mode
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        logger.info(`EventManager debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Pauses event emission and processing
     */
    pause(): void {
        this.isActive = false;
        logger.info('EventManager paused');
    }

    /**
     * Resumes event emission and processing
     */
    resume(): void {
        this.isActive = true;
        logger.info('EventManager resumed');
    }

    /**
     * Resets all statistics
     */
    resetStats(): void {
        this.stats.eventsEmitted = 0;
        this.stats.errorsCount = 0;
        logger.info('EventManager statistics reset');
    }

    /**
     * Cleans up resources and shuts down the event manager
     */
    destroy(): void {
        this.clearAllListeners();
        this.registeredEntities.clear();
        this.isActive = false;
        logger.info('EventManager destroyed');
    }
}