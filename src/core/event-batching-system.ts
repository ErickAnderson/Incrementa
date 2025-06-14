import { EventManager } from "./event-manager";
import { SystemEventType } from "../types/system-events";
import { logger } from "../utils/logger";

/**
 * Batched event data
 */
export interface BatchedEvent {
    type: string;
    data: unknown;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Event batch configuration
 */
export interface EventBatchConfig {
    /** Maximum number of events per batch */
    batchSize: number;
    /** Maximum time to wait before flushing batch (ms) */
    flushInterval: number;
    /** Event types to batch (empty array = batch all) */
    batchedTypes: string[];
    /** Event types that should never be batched */
    excludedTypes: string[];
}

/**
 * Performance-optimized event batching system
 * Reduces GC pressure by batching frequent events and reusing objects
 */
export class EventBatchingSystem {
    private eventManager: EventManager;
    private config: EventBatchConfig;
    private eventQueue: Map<string, BatchedEvent[]>;
    private eventPool: BatchedEvent[];
    private batchTimer: number | null;
    private lastFlushTime: number;
    private stats: {
        totalBatched: number;
        totalFlushed: number;
        poolHits: number;
        poolMisses: number;
    };

    constructor(eventManager: EventManager, config: Partial<EventBatchConfig> = {}) {
        this.eventManager = eventManager;
        this.config = {
            batchSize: 20,
            flushInterval: 16, // ~60fps
            batchedTypes: [],
            excludedTypes: ['gameDestroyed', 'gamePaused', 'gameResumed'],
            ...config
        };
        
        this.eventQueue = new Map();
        this.eventPool = [];
        this.batchTimer = null;
        this.lastFlushTime = Date.now();
        this.stats = {
            totalBatched: 0,
            totalFlushed: 0,
            poolHits: 0,
            poolMisses: 0
        };

        this.startBatchTimer();
    }

    /**
     * Queues an event for batching or emits immediately if not batchable
     * @param type - Event type
     * @param data - Event data
     * @param metadata - Optional metadata
     */
    emitEvent(type: string, data?: unknown, metadata?: Record<string, unknown>): void {
        if (!this.shouldBatchEvent(type)) {
            // Emit immediately for non-batchable events
            this.eventManager.emitSystemEvent(type as SystemEventType, data, { metadata });
            return;
        }

        // Get or create queue for this event type
        if (!this.eventQueue.has(type)) {
            this.eventQueue.set(type, []);
        }

        const queue = this.eventQueue.get(type)!;
        const event = this.getEventFromPool();
        
        // Configure the event
        event.type = type;
        event.data = data;
        event.timestamp = Date.now();
        event.metadata = metadata;

        queue.push(event);
        this.stats.totalBatched++;

        // Flush if batch is full
        if (queue.length >= this.config.batchSize) {
            this.flushEventType(type);
        }
    }

    /**
     * Forces immediate flush of all batched events
     */
    flushAll(): void {
        for (const eventType of this.eventQueue.keys()) {
            this.flushEventType(eventType);
        }
        this.lastFlushTime = Date.now();
    }

    /**
     * Flushes all events of a specific type
     * @param eventType - The event type to flush
     */
    private flushEventType(eventType: string): void {
        const queue = this.eventQueue.get(eventType);
        if (!queue || queue.length === 0) {
            return;
        }

        // Emit batched event
        this.eventManager.emitSystemEvent(`${eventType}Batch` as SystemEventType, {
            events: queue.map(event => ({
                data: event.data,
                timestamp: event.timestamp,
                metadata: event.metadata
            })),
            count: queue.length,
            eventType: eventType
        });

        this.stats.totalFlushed += queue.length;

        // Return events to pool
        for (const event of queue) {
            this.returnEventToPool(event);
        }

        // Clear the queue
        queue.length = 0;
    }

    /**
     * Gets an event object from the pool or creates a new one
     * @returns A reusable event object
     */
    private getEventFromPool(): BatchedEvent {
        const pooled = this.eventPool.pop();
        if (pooled) {
            this.stats.poolHits++;
            return pooled;
        }

        this.stats.poolMisses++;
        return {
            type: '',
            data: undefined,
            timestamp: 0,
            metadata: undefined
        };
    }

    /**
     * Returns an event object to the pool for reuse
     * @param event - The event to return to the pool
     */
    private returnEventToPool(event: BatchedEvent): void {
        // Clear references to prevent memory leaks
        event.type = '';
        event.data = undefined;
        event.timestamp = 0;
        event.metadata = undefined;

        // Keep pool size reasonable
        if (this.eventPool.length < 100) {
            this.eventPool.push(event);
        }
    }

    /**
     * Determines whether an event should be batched
     * @param eventType - The event type to check
     * @returns Whether the event should be batched
     */
    private shouldBatchEvent(eventType: string): boolean {
        // Never batch excluded types
        if (this.config.excludedTypes.includes(eventType)) {
            return false;
        }

        // If specific types are configured, only batch those
        if (this.config.batchedTypes.length > 0) {
            return this.config.batchedTypes.includes(eventType);
        }

        // Batch all events by default (except excluded)
        return true;
    }

    /**
     * Starts the periodic batch flushing timer
     */
    private startBatchTimer(): void {
        if (this.batchTimer) {
            (globalThis as typeof globalThis).clearInterval(this.batchTimer);
        }

        this.batchTimer = (globalThis as typeof globalThis).setInterval(() => {
            const now = Date.now();
            if (now - this.lastFlushTime >= this.config.flushInterval) {
                this.flushAll();
            }
        }, this.config.flushInterval) as number;
    }

    /**
     * Stops the batch timer
     */
    stop(): void {
        if (this.batchTimer) {
            (globalThis as typeof globalThis).clearInterval(this.batchTimer);
            this.batchTimer = null;
        }

        // Flush any remaining events
        this.flushAll();
    }

    /**
     * Gets batching statistics for performance monitoring
     * @returns Performance statistics
     */
    getStats(): {
        totalBatched: number;
        totalFlushed: number;
        poolEfficiency: number;
        queueSizes: Record<string, number>;
        poolSize: number;
    } {
        const queueSizes: Record<string, number> = {};
        for (const [type, queue] of this.eventQueue) {
            queueSizes[type] = queue.length;
        }

        const totalPoolAccess = this.stats.poolHits + this.stats.poolMisses;
        const poolEfficiency = totalPoolAccess > 0 ? this.stats.poolHits / totalPoolAccess : 0;

        return {
            totalBatched: this.stats.totalBatched,
            totalFlushed: this.stats.totalFlushed,
            poolEfficiency,
            queueSizes,
            poolSize: this.eventPool.length
        };
    }

    /**
     * Updates configuration at runtime
     * @param newConfig - New configuration values
     */
    updateConfig(newConfig: Partial<EventBatchConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart timer with new interval if changed
        if (newConfig.flushInterval !== undefined) {
            this.startBatchTimer();
        }

        logger.debug(`EventBatchingSystem: Configuration updated ${JSON.stringify(this.config)}`);
    }

    /**
     * Cleanup method
     */
    destroy(): void {
        this.stop();
        this.eventQueue.clear();
        this.eventPool.length = 0;
    }
}