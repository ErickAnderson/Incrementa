import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";
import type {
  SystemEvent,
  SystemEventType,
  EventSubscriptionOptions,
  EventEmissionOptions,
  EventMiddleware,
  EventError,
  SystemEventListener
} from "../types/system-events";


/**
 * Enhanced interface for event statistics
 */
export interface EventStats {
    totalListeners: number;
    globalListeners: number;
    entityListeners: number;
    eventTypes: string[];
    eventsEmitted: number;
    errorsCount: number;
    batchesProcessed: number;
    middlewareCount: number;
    averageEmissionTime: number;
    eventsPerSecond: number;
}

/**
 * Enhanced centralized manager for coordinating events across the game system
 * Supports system-wide events, middleware, batching, and comprehensive event filtering
 */
export class EventManager {
    /** Global event listeners with subscription options */
    private globalListeners: Map<string, Array<{callback: Function; options?: EventSubscriptionOptions}>>;
    
    /** Entity-specific event listeners */
    private entityListeners: Map<string, Map<string, Array<{callback: Function; options?: EventSubscriptionOptions}>>>;
    
    /** Registered entities for event routing */
    private registeredEntities: Map<string, BaseEntity>;
    
    /** Event emission statistics */
    private stats: {
        eventsEmitted: number;
        errorsCount: number;
        batchesProcessed: number;
        totalEmissionTime: number;
        startTime: number;
    };
    
    /** Whether the event manager is active */
    private isActive: boolean;

    /** Debug mode for verbose logging */
    private debugMode: boolean;
    
    /** Event middleware stack */
    private middleware: EventMiddleware[];
    
    /** Event batching system */
    private eventBatches: Map<string, SystemEvent[]>;
    private batchTimers: Map<string, any>;
    // private batchDelay: number = 10; // ms - Currently unused
    
    /** Event replay system for debugging */
    private eventHistory: SystemEvent[];
    private maxHistorySize: number = 1000;
    
    /** Error handling */
    private errorHandlers: Array<(error: EventError) => void>;
    
    /** Debounce tracking */
    private debounceTimers: Map<string, any>;

    constructor(debugMode: boolean = false) {
        this.globalListeners = new Map();
        this.entityListeners = new Map();
        this.registeredEntities = new Map();
        this.stats = {
            eventsEmitted: 0,
            errorsCount: 0,
            batchesProcessed: 0,
            totalEmissionTime: 0,
            startTime: Date.now()
        };
        this.isActive = true;
        this.debugMode = debugMode;
        this.middleware = [];
        this.eventBatches = new Map();
        this.batchTimers = new Map();
        this.eventHistory = [];
        this.errorHandlers = [];
        this.debounceTimers = new Map();
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
     * Emits a system event with enhanced features
     * @param eventType - Type of the event to emit
     * @param data - Event data
     * @param options - Emission options
     */
    emitSystemEvent(eventType: SystemEventType, data: any, options: EventEmissionOptions = {}): void {
        if (!this.isActive) return;

        const startTime = performance.now();
        
        try {
            const event: SystemEvent = {
                type: eventType,
                data: {
                    ...data,
                    timestamp: Date.now(),
                    ...options.metadata
                },
                timestamp: Date.now(),
                source: options.metadata?.source,
                target: options.metadata?.target
            };
            
            // Add to event history
            this.addToHistory(event);
            
            // Process through middleware
            this.processMiddleware(event, () => {
                // Emit to global listeners if enabled
                if (options.global !== false) {
                    this.emitToGlobalListeners(event);
                }
                
                // Emit to entity listeners if enabled and entityId is provided
                if (options.entity !== false && data.entityId) {
                    this.emitToEntityListeners(data.entityId, event);
                }
            });
            
            this.stats.eventsEmitted++;
            this.stats.totalEmissionTime += performance.now() - startTime;
            
            if (this.debugMode) {
                logger.info(`System event '${eventType}' emitted`);
            }
        } catch (error) {
            this.handleEventError({
                eventType,
                error: error instanceof Error ? error : new Error(String(error)),
                event: { type: eventType, data, timestamp: Date.now() },
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Legacy emit method for backward compatibility
     * @param eventName - Name of the event to emit
     * @param data - Optional data to pass with the event
     */
    emit(eventName: string, data?: any): void {
        this.emitSystemEvent(eventName as SystemEventType, data);
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
                    for (const { callback } of listeners) {
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
                
                for (const { callback } of globalListeners) {
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
     * Adds a global event listener with enhanced options
     * @param eventType - Type of the event to listen for
     * @param callback - Function to call when event is emitted
     * @param options - Subscription options
     */
    onSystemEvent(eventType: SystemEventType, callback: SystemEventListener, options?: EventSubscriptionOptions): void {
        if (typeof callback !== 'function') {
            throw new Error('Event callback must be a function');
        }

        if (!this.globalListeners.has(eventType)) {
            this.globalListeners.set(eventType, []);
        }
        
        this.globalListeners.get(eventType)!.push({ callback, options });
        
        if (this.debugMode) {
            logger.info(`Global listener added for event '${eventType}'`);
        }
    }
    
    /**
     * Legacy on method for backward compatibility
     * @param eventName - Name of the event to listen for
     * @param callback - Function to call when event is emitted
     */
    on(eventName: string, callback: Function): void {
        this.onSystemEvent(eventName as SystemEventType, callback as SystemEventListener);
    }

    /**
     * Adds an entity-specific event listener
     * @param entityId - ID of the entity to listen to
     * @param eventName - Name of the event to listen for
     * @param callback - Function to call when event is emitted
     */
    onEntity(entityId: string, eventName: string, callback: Function, options?: EventSubscriptionOptions): void {
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
        
        entityEventListeners.get(eventName)!.push({ callback, options });
        
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
        
        const index = listeners.findIndex(listener => listener.callback === callback);
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
        
        const index = listeners.findIndex(listener => listener.callback === callback);
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
     * Gets comprehensive event statistics
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
        
        // Calculate performance metrics
        const uptime = Date.now() - this.stats.startTime;
        const eventsPerSecond = uptime > 0 ? (this.stats.eventsEmitted / (uptime / 1000)) : 0;
        const averageEmissionTime = this.stats.eventsEmitted > 0 ? 
            (this.stats.totalEmissionTime / this.stats.eventsEmitted) : 0;
        
        return {
            totalListeners,
            globalListeners,
            entityListeners,
            eventTypes: Array.from(eventTypes),
            eventsEmitted: this.stats.eventsEmitted,
            errorsCount: this.stats.errorsCount,
            batchesProcessed: this.stats.batchesProcessed,
            middlewareCount: this.middleware.length,
            averageEmissionTime,
            eventsPerSecond
        };
    }
    
    /**
     * Add middleware for event processing
     */
    addMiddleware(middleware: EventMiddleware): void {
        this.middleware.push(middleware);
        if (this.debugMode) {
            logger.info('Event middleware added');
        }
    }
    
    /**
     * Remove middleware
     */
    removeMiddleware(middleware: EventMiddleware): boolean {
        const index = this.middleware.indexOf(middleware);
        if (index > -1) {
            this.middleware.splice(index, 1);
            if (this.debugMode) {
                logger.info('Event middleware removed');
            }
            return true;
        }
        return false;
    }
    
    /**
     * Add error handler
     */
    onError(handler: (error: EventError) => void): void {
        this.errorHandlers.push(handler);
    }
    
    /**
     * Get event history for debugging
     */
    getEventHistory(filters?: EventSubscriptionOptions): SystemEvent[] {
        if (!filters) {
            return [...this.eventHistory];
        }
        
        return this.eventHistory.filter(event => this.eventMatchesFilters(event, filters));
    }
    
    /**
     * Clear event history
     */
    clearEventHistory(): void {
        this.eventHistory = [];
        if (this.debugMode) {
            logger.info('Event history cleared');
        }
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
        this.middleware = [];
        this.eventBatches.clear();
        this.errorHandlers = [];
        this.eventHistory = [];
        
        // Clear all timers
        for (const timer of this.batchTimers.values()) {
            if (typeof timer === 'number' && typeof clearTimeout === 'function') {
                clearTimeout(timer);
            }
        }
        this.batchTimers.clear();
        
        for (const timer of this.debounceTimers.values()) {
            if (typeof timer === 'number' && typeof clearTimeout === 'function') {
                clearTimeout(timer);
            }
        }
        this.debounceTimers.clear();
        
        this.isActive = false;
        logger.info('EventManager destroyed');
    }
    
    // Private helper methods
    
    private emitToGlobalListeners(event: SystemEvent): void {
        const listeners = this.globalListeners.get(event.type);
        if (!listeners) return;
        
        for (const { callback, options } of listeners) {
            try {
                // Check filters
                if (options && !this.eventMatchesFilters(event, options)) {
                    continue;
                }
                
                // Handle debouncing
                if (options?.debounce) {
                    this.handleDebounce(event, callback, options);
                    continue;
                }
                
                // Handle once subscription
                if (options?.once) {
                    this.off(event.type, callback);
                }
                
                callback(event);
            } catch (error) {
                this.handleEventError({
                    eventType: event.type,
                    error: error instanceof Error ? error : new Error(String(error)),
                    event,
                    timestamp: Date.now(),
                    listener: callback
                });
            }
        }
    }
    
    private emitToEntityListeners(entityId: string, event: SystemEvent): void {
        const entityEventListeners = this.entityListeners.get(entityId);
        if (!entityEventListeners) return;
        
        const listeners = entityEventListeners.get(event.type);
        if (!listeners) return;
        
        for (const { callback, options } of listeners) {
            try {
                // Check filters
                if (options && !this.eventMatchesFilters(event, options)) {
                    continue;
                }
                
                // Handle once subscription
                if (options?.once) {
                    this.offEntity(entityId, event.type, callback);
                }
                
                callback(event);
            } catch (error) {
                this.handleEventError({
                    eventType: event.type,
                    error: error instanceof Error ? error : new Error(String(error)),
                    event,
                    timestamp: Date.now(),
                    listener: callback
                });
            }
        }
    }
    
    private processMiddleware(event: SystemEvent, finalCallback: () => void): void {
        let index = 0;
        
        const next = () => {
            if (index >= this.middleware.length) {
                finalCallback();
                return;
            }
            
            const middleware = this.middleware[index++];
            try {
                middleware(event, next);
            } catch (error) {
                this.handleEventError({
                    eventType: event.type,
                    error: error instanceof Error ? error : new Error(String(error)),
                    event,
                    timestamp: Date.now()
                });
                next(); // Continue with next middleware
            }
        };
        
        next();
    }
    
    private eventMatchesFilters(event: SystemEvent, filters: EventSubscriptionOptions): boolean {
        if (filters.entityId && event.data.entityId !== filters.entityId) {
            return false;
        }
        
        if (filters.entityType && event.data.entity?.constructor.name !== filters.entityType) {
            return false;
        }
        
        if (filters.tags && filters.tags.length > 0) {
            const eventTags = event.data.entity?.tags || [];
            if (!filters.tags.some(tag => eventTags.includes(tag))) {
                return false;
            }
        }
        
        if (filters.filter && !filters.filter(event)) {
            return false;
        }
        
        return true;
    }
    
    private handleDebounce(event: SystemEvent, callback: Function, options: EventSubscriptionOptions): void {
        const debounceKey = `${event.type}:${event.data.entityId || 'global'}:${callback.toString()}`;
        
        // Clear existing timer
        const existingTimer = this.debounceTimers.get(debounceKey);
        if (existingTimer && typeof clearTimeout === 'function') {
            clearTimeout(existingTimer);
        }
        
        // Set new timer
        if (typeof setTimeout === 'function') {
            const timer = setTimeout(() => {
                callback(event);
                this.debounceTimers.delete(debounceKey);
            }, options.debounce!);
            
            this.debounceTimers.set(debounceKey, timer);
        }
    }
    
    private addToHistory(event: SystemEvent): void {
        this.eventHistory.push(event);
        
        // Maintain max history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    
    private handleEventError(error: EventError): void {
        this.stats.errorsCount++;
        
        // Call error handlers
        for (const handler of this.errorHandlers) {
            try {
                handler(error);
            } catch (handlerError) {
                logger.error(`Error in event error handler: ${handlerError}`);
            }
        }
        
        // Log the error
        logger.error(`Event error in ${error.eventType}: ${error.error.message}`);
    }
}