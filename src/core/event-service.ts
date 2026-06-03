import { EventManager, EventStats } from './event-manager';
import { BaseEntity } from './base-entity';
import { logger } from '../utils/logger';

/**
 * Interface for the event service
 */
export interface IEventService {
    // Event management
    on(eventName: string, callback: (...args: unknown[]) => void): void;
    off(eventName: string, callback: (...args: unknown[]) => void): boolean;
    emit(eventName: string, data?: unknown): void;

    // Entity event registration
    registerEntity(entity: BaseEntity): void;
    routeEntityEvents(entity: BaseEntity): void;
    unregisterEntity(entityId: string): void;

    // Statistics and monitoring
    getEventStats(): EventStats;

    // Manager access
    getEventManager(): EventManager;
    
    // Lifecycle control
    pause(): void;
    resume(): void;
    
    // Cleanup
    destroy(): void;
}

/**
 * Service responsible for managing all global events
 * Extracted from Game class to reduce god class anti-pattern
 */
export class EventService implements IEventService {
    private eventManager: EventManager;

    constructor() {
        this.eventManager = new EventManager();
        logger.debug('EventService: Initialized');
    }

    /**
     * Adds a global event listener
     */
    on(eventName: string, callback: (...args: unknown[]) => void): void {
        this.eventManager.on(eventName, callback);
        logger.debug(`EventService: Added listener for '${eventName}'`);
    }

    /**
     * Removes a global event listener
     */
    off(eventName: string, callback: (...args: unknown[]) => void): boolean {
        const removed = this.eventManager.off(eventName, callback);
        if (removed) {
            logger.debug(`EventService: Removed listener for '${eventName}'`);
        }
        return removed;
    }

    /**
     * Emits a global event
     */
    emit(eventName: string, data?: unknown): void {
        this.eventManager.emit(eventName, data);
        logger.debug(`EventService: Emitted '${eventName}' event`);
    }

    /**
     * Gets event statistics from the event manager
     */
    getEventStats(): EventStats {
        return this.eventManager.getEventStats();
    }

    /**
     * Gets the underlying event manager instance
     */
    getEventManager(): EventManager {
        return this.eventManager;
    }

    /**
     * Pauses event processing
     */
    pause(): void {
        this.eventManager.pause();
        logger.info('EventService: Event processing paused');
    }

    /**
     * Resumes event processing
     */
    resume(): void {
        this.eventManager.resume();
        logger.info('EventService: Event processing resumed');
    }

    /**
     * Registers an entity with the event manager
     */
    registerEntity(entity: any): void {
        this.eventManager.registerEntity(entity);
        logger.debug(`EventService: Registered entity '${entity.name}' (${entity.id})`);
    }

    /**
     * Unregisters an entity from the event manager
     */
    unregisterEntity(entityId: string): void {
        this.eventManager.unregisterEntity(entityId);
        logger.debug(`EventService: Unregistered entity '${entityId}'`);
    }

    /**
     * Routes entity events through the event manager
     */
    routeEntityEvents(entity: any): void {
        this.eventManager.routeEntityEvents(entity);
        logger.debug(`EventService: Routing events for entity '${entity.name}' (${entity.id})`);
    }

    /**
     * Gets comprehensive event statistics for monitoring
     */
    getDetailedStats(): {
        eventStats: EventStats;
        registeredEntities: number;
        totalListeners: number;
    } {
        const eventStats = this.getEventStats();
        
        return {
            eventStats,
            registeredEntities: 0, // EventManager doesn't expose this easily
            totalListeners: 0 // EventManager doesn't expose this easily
        };
    }

    /**
     * Cleanup method to destroy the event manager and release resources
     */
    destroy(): void {
        this.eventManager.destroy();
        logger.info('EventService: Destroyed and resources cleaned up');
    }
}