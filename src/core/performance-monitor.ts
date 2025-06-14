import { EventManager } from "./event-manager";
import { logger } from "../utils/logger";

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetrics {
    /** Frame timing metrics */
    frameTime: {
        current: number;
        average: number;
        max: number;
        min: number;
        samples: number;
    };
    /** Entity count metrics */
    entities: {
        total: number;
        unlocked: number;
        updatable: number;
    };
    /** Event system metrics */
    events: {
        emissionsPerSecond: number;
        listenersCount: number;
        batchingStats?: Record<string, unknown>;
    };
    /** Memory usage estimates */
    memory: {
        heapUsed?: number;
        entityMemory: number;
        cacheMemory: number;
    };
    /** Performance warnings */
    warnings: string[];
}

/**
 * Performance thresholds for warnings
 */
export interface PerformanceThresholds {
    /** Maximum frame time in milliseconds */
    maxFrameTime: number;
    /** Maximum entities to update per frame */
    maxUpdatableEntities: number;
    /** Maximum events per second */
    maxEventsPerSecond: number;
    /** Maximum memory growth per minute in MB */
    maxMemoryGrowthPerMinute: number;
}

/**
 * Performance monitoring and optimization system
 * Tracks key performance metrics and provides warnings
 */
export class PerformanceMonitor {
    private eventManager: EventManager;
    private isEnabled: boolean;
    private frameTimings: number[];
    private lastFrameTime: number;
    private eventCounts: number[];
    private lastEventCount: number;
    private memoryBaseline: number;
    private lastMemoryCheck: number;
    private thresholds: PerformanceThresholds;
    private monitoringInterval: NodeJS.Timeout | null;
    private frameTimeWindow: number;

    constructor(eventManager: EventManager, options: {
        enabled?: boolean;
        frameTimeWindow?: number;
        thresholds?: Partial<PerformanceThresholds>;
    } = {}) {
        this.eventManager = eventManager;
        this.isEnabled = options.enabled ?? false;
        this.frameTimeWindow = options.frameTimeWindow ?? 60; // Track last 60 frames
        this.frameTimings = [];
        this.lastFrameTime = (globalThis as unknown as { performance?: Performance }).performance?.now() || Date.now();
        this.eventCounts = [];
        this.lastEventCount = 0;
        this.memoryBaseline = this.getMemoryUsage();
        this.lastMemoryCheck = Date.now();
        this.monitoringInterval = null;

        this.thresholds = {
            maxFrameTime: 16.67, // 60 FPS
            maxUpdatableEntities: 1000,
            maxEventsPerSecond: 100,
            maxMemoryGrowthPerMinute: 1,
            ...options.thresholds
        };

        if (this.isEnabled) {
            this.startMonitoring();
        }
    }

    /**
     * Records a frame timing measurement
     * Call this from the game loop
     */
    recordFrameTime(): void {
        if (!this.isEnabled) return;

        const now = (globalThis as unknown as { performance?: Performance }).performance?.now() || Date.now();
        const frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameTimings.push(frameTime);
        
        // Keep only recent frames
        if (this.frameTimings.length > this.frameTimeWindow) {
            this.frameTimings.shift();
        }
    }

    /**
     * Records event emission for tracking
     * @param eventType - The type of event emitted
     */
    recordEventEmission(_eventType: string): void {
        if (!this.isEnabled) return;

        this.lastEventCount++;
    }

    /**
     * Gets current performance metrics
     * @param entityStats - Current entity statistics
     * @returns Current performance snapshot
     */
    getMetrics(entityStats: {
        total: number;
        unlocked: number;
        updatable: number;
    }): PerformanceMetrics {
        const warnings: string[] = [];
        
        // Frame timing analysis
        const frameTime = this.analyzeFrameTimings();
        if (frameTime.average > this.thresholds.maxFrameTime) {
            warnings.push(`High frame time: ${frameTime.average.toFixed(2)}ms (target: ${this.thresholds.maxFrameTime}ms)`);
        }

        // Entity count analysis
        if (entityStats.updatable > this.thresholds.maxUpdatableEntities) {
            warnings.push(`High updatable entity count: ${entityStats.updatable} (threshold: ${this.thresholds.maxUpdatableEntities})`);
        }

        // Event system analysis
        const eventsPerSecond = this.calculateEventsPerSecond();
        if (eventsPerSecond > this.thresholds.maxEventsPerSecond) {
            warnings.push(`High event emission rate: ${eventsPerSecond.toFixed(1)}/sec (threshold: ${this.thresholds.maxEventsPerSecond})`);
        }

        // Memory analysis
        const memoryUsage = this.getMemoryUsage();
        const memoryGrowth = this.calculateMemoryGrowth(memoryUsage);
        if (memoryGrowth > this.thresholds.maxMemoryGrowthPerMinute) {
            warnings.push(`High memory growth: ${memoryGrowth.toFixed(2)}MB/min (threshold: ${this.thresholds.maxMemoryGrowthPerMinute})`);
        }

        return {
            frameTime,
            entities: entityStats,
            events: {
                emissionsPerSecond: eventsPerSecond,
                listenersCount: 0 // TODO: Implement getStats() in EventManager
            },
            memory: {
                heapUsed: memoryUsage,
                entityMemory: this.estimateEntityMemory(entityStats.total),
                cacheMemory: this.estimateCacheMemory()
            },
            warnings
        };
    }

    /**
     * Analyzes frame timing data
     * @returns Frame timing statistics
     */
    private analyzeFrameTimings(): PerformanceMetrics['frameTime'] {
        if (this.frameTimings.length === 0) {
            return {
                current: 0,
                average: 0,
                max: 0,
                min: 0,
                samples: 0
            };
        }

        const current = this.frameTimings[this.frameTimings.length - 1] || 0;
        const sum = this.frameTimings.reduce((a, b) => a + b, 0);
        const average = sum / this.frameTimings.length;
        const max = Math.max(...this.frameTimings);
        const min = Math.min(...this.frameTimings);

        return {
            current,
            average,
            max,
            min,
            samples: this.frameTimings.length
        };
    }

    /**
     * Calculates events per second
     * @returns Events per second
     */
    private calculateEventsPerSecond(): number {
        const now = Date.now();
        const timeSinceLastCount = now - this.lastMemoryCheck;
        
        if (timeSinceLastCount < 1000) {
            return 0; // Not enough time elapsed
        }

        const eventsPerMs = this.lastEventCount / timeSinceLastCount;
        const eventsPerSecond = eventsPerMs * 1000;
        
        // Reset counters
        this.lastEventCount = 0;
        this.lastMemoryCheck = now;
        
        return eventsPerSecond;
    }

    /**
     * Gets current memory usage
     * @returns Memory usage in MB
     */
    private getMemoryUsage(): number {
        const perf = (globalThis as unknown as { performance?: Performance & { memory?: { usedJSHeapSize: number } } }).performance;
        if (typeof perf !== 'undefined' && perf.memory) {
            return perf.memory.usedJSHeapSize / 1024 / 1024;
        }
        
        // Fallback for Node.js
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed / 1024 / 1024;
        }
        
        return 0;
    }

    /**
     * Calculates memory growth rate
     * @param currentMemory - Current memory usage in MB
     * @returns Memory growth in MB per minute
     */
    private calculateMemoryGrowth(currentMemory: number): number {
        const now = Date.now();
        const timeSinceBaseline = now - this.lastMemoryCheck;
        
        if (timeSinceBaseline < 60000) {
            return 0; // Not enough time elapsed
        }
        
        const memoryGrowth = currentMemory - this.memoryBaseline;
        const growthPerMinute = (memoryGrowth / timeSinceBaseline) * 60000;
        
        // Update baseline
        this.memoryBaseline = currentMemory;
        
        return growthPerMinute;
    }

    /**
     * Estimates memory usage by entities
     * @param entityCount - Total number of entities
     * @returns Estimated memory usage in MB
     */
    private estimateEntityMemory(entityCount: number): number {
        // Rough estimate: 1KB per entity
        return (entityCount * 1024) / 1024 / 1024;
    }

    /**
     * Estimates memory usage by caches
     * @returns Estimated cache memory usage in MB
     */
    private estimateCacheMemory(): number {
        // Rough estimate for capacity cache and other caches
        return 0.1; // 100KB estimate
    }

    /**
     * Starts automatic performance monitoring
     */
    private startMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(() => {
            this.recordPerformanceMetrics();
        }, 5000); // Check every 5 seconds
    }

    /**
     * Records performance metrics and emits warnings
     */
    private recordPerformanceMetrics(): void {
        const metrics = this.getMetrics({
            total: 0, // Will be provided by caller
            unlocked: 0,
            updatable: 0
        });

        if (metrics.warnings.length > 0) {
            logger.warn(`Performance warnings: ${JSON.stringify(metrics.warnings)}`);
            this.eventManager.emitSystemEvent('performanceWarning', {
                warnings: metrics.warnings,
                metrics
            });
        }

        // Emit periodic performance update
        this.eventManager.emitSystemEvent('performanceUpdate', { metrics });
    }

    /**
     * Enables or disables performance monitoring
     * @param enabled - Whether to enable monitoring
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        
        if (enabled) {
            this.startMonitoring();
        } else {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }
        }

        logger.info(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Updates performance thresholds
     * @param newThresholds - New threshold values
     */
    updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        logger.debug(`Performance thresholds updated: ${JSON.stringify(this.thresholds)}`);
    }

    /**
     * Resets all performance tracking data
     */
    reset(): void {
        this.frameTimings.length = 0;
        this.eventCounts.length = 0;
        this.lastFrameTime = (globalThis as unknown as { performance?: Performance }).performance?.now() || Date.now();
        this.lastEventCount = 0;
        this.memoryBaseline = this.getMemoryUsage();
        this.lastMemoryCheck = Date.now();
    }

    /**
     * Gets performance optimization recommendations
     * @param metrics - Current performance metrics
     * @returns Array of optimization suggestions
     */
    getOptimizationRecommendations(metrics: PerformanceMetrics): string[] {
        const recommendations: string[] = [];

        if (metrics.frameTime.average > this.thresholds.maxFrameTime) {
            recommendations.push(
                'Consider reducing entity update frequency or implementing time-slicing for heavy operations'
            );
        }

        if (metrics.entities.updatable > this.thresholds.maxUpdatableEntities) {
            recommendations.push(
                'Consider implementing entity pooling or reducing the number of entities that require updates'
            );
        }

        if (metrics.events.emissionsPerSecond > this.thresholds.maxEventsPerSecond) {
            recommendations.push(
                'Consider implementing event batching or reducing event emission frequency'
            );
        }

        if (metrics.memory.heapUsed && metrics.memory.heapUsed > 100) {
            recommendations.push(
                'Consider implementing object pooling or reviewing memory usage patterns'
            );
        }

        return recommendations;
    }

    /**
     * Cleanup method
     */
    destroy(): void {
        this.setEnabled(false);
        this.reset();
    }
}