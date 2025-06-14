import { Storage } from "../entities/buildings/storage";
import { Resource } from "../entities/resources/resource";
import { EventManager } from "./event-manager";
import { logger } from "../utils/logger";

/**
 * Capacity information for a specific resource
 */
export interface CapacityInfo {
    /** Current amount of the resource */
    current: number;
    /** Total capacity across all storage buildings */
    total: number;
    /** Remaining capacity */
    remaining: number;
    /** Utilization percentage (0-1) */
    utilization: number;
    /** Number of storage buildings managing this resource */
    storageCount: number;
}

/**
 * Manages resource capacity limits across all storage buildings
 * Provides caching and optimization for capacity calculations
 */
export class CapacityManager {
    private eventManager: EventManager;
    private capacityCache: Map<string, number>;
    private cacheValidFlags: Set<string>;
    private lastCacheClean: number;
    private readonly CACHE_CLEAN_INTERVAL = 10000; // 10 seconds

    /**
     * Creates a new CapacityManager instance
     * @param eventManager - The event manager for emitting capacity events
     */
    constructor(eventManager: EventManager) {
        this.eventManager = eventManager;
        this.capacityCache = new Map();
        this.cacheValidFlags = new Set();
        this.lastCacheClean = Date.now();
        
        // Listen for storage building events that affect capacity
        this.eventManager.on('buildComplete', (data: { building?: unknown; data?: { building?: unknown } }) => {
            // Handle both direct event format and batched event format
            const building = data.building || (data.data && data.data.building);
            
            if (building && typeof building.getCapacityFor === 'function') {
                // This is a storage building - invalidate all cache since we don't know which resources it affects
                this.invalidateCache();
                logger.debug(`CapacityManager: Cache invalidated due to storage building completion: ${building.name}`);
            }
        });
        
        // Listen for capacity changes on storage buildings
        this.eventManager.on('capacityChanged', (data: { resourceId?: string }) => {
            if (data.resourceId) {
                this.invalidateCache(data.resourceId);
            } else {
                this.invalidateCache();
            }
        });
    }

    /**
     * Gets the total capacity for a specific resource across all storage buildings
     * Uses caching for performance optimization
     * @param resourceId - The ID of the resource to check
     * @param storages - Array of all storage buildings
     * @returns Total capacity for the resource (0 = unlimited)
     */
    getTotalCapacityFor(resourceId: string, storages: Storage[]): number {
        // Check cache first
        if (this.cacheValidFlags.has(resourceId)) {
            const cached = this.capacityCache.get(resourceId);
            if (cached !== undefined) {
                return cached;
            }
        }

        // Calculate total capacity
        let totalCapacity = 0;
        let hasAnyLimit = false;

        for (const storage of storages) {
            if (storage.isBuilt && storage.isUnlocked) {
                const capacity = storage.getCapacityFor(resourceId);
                if (capacity !== undefined) {
                    totalCapacity += capacity;
                    hasAnyLimit = true;
                }
            }
        }

        // 0 means unlimited if no storage buildings set a limit
        const result = hasAnyLimit ? totalCapacity : 0;

        // Cache the result
        this.capacityCache.set(resourceId, result);
        this.cacheValidFlags.add(resourceId);

        return result;
    }

    /**
     * Checks if adding a specific amount of resource would exceed capacity
     * @param resourceId - The ID of the resource
     * @param amount - The amount to check
     * @param currentAmount - Current amount of the resource
     * @param storages - Array of all storage buildings
     * @returns Whether the resource can be added without exceeding capacity
     */
    hasGlobalCapacity(
        resourceId: string, 
        amount: number, 
        currentAmount: number, 
        storages: Storage[]
    ): boolean {
        const totalCapacity = this.getTotalCapacityFor(resourceId, storages);
        
        // 0 capacity means unlimited
        if (totalCapacity === 0) {
            return true;
        }

        const hasSpace = currentAmount + amount <= totalCapacity;
        
        if (!hasSpace) {
            logger.debug(`CapacityManager: Capacity exceeded for ${resourceId} - attempting ${amount}, current: ${currentAmount}, capacity: ${totalCapacity}`);
            
            // Emit capacity warning event
            this.eventManager.emitSystemEvent('capacityExceeded', {
                resourceId,
                attempted: amount,
                current: currentAmount,
                capacity: totalCapacity,
                overage: (currentAmount + amount) - totalCapacity
            });
        }

        return hasSpace;
    }

    /**
     * Gets the remaining capacity for a specific resource
     * @param resourceId - The ID of the resource
     * @param currentAmount - Current amount of the resource
     * @param storages - Array of all storage buildings
     * @returns Remaining capacity (Number.MAX_SAFE_INTEGER for unlimited)
     */
    getRemainingCapacityFor(
        resourceId: string, 
        currentAmount: number, 
        storages: Storage[]
    ): number {
        const totalCapacity = this.getTotalCapacityFor(resourceId, storages);
        
        if (totalCapacity === 0) {
            return Number.MAX_SAFE_INTEGER; // Unlimited
        }

        return Math.max(0, totalCapacity - currentAmount);
    }

    /**
     * Gets comprehensive capacity information for a resource
     * @param resourceId - The ID of the resource
     * @param resource - The resource entity
     * @param storages - Array of all storage buildings
     * @returns Detailed capacity information
     */
    getCapacityInfo(resourceId: string, resource: Resource, storages: Storage[]): CapacityInfo {
        const current = resource.amount;
        const total = this.getTotalCapacityFor(resourceId, storages);
        const remaining = this.getRemainingCapacityFor(resourceId, current, storages);
        const storageCount = storages.filter(storage => 
            storage.isBuilt && storage.isUnlocked && storage.getCapacityFor(resourceId) !== undefined
        ).length;

        return {
            current,
            total: total === 0 ? Number.MAX_SAFE_INTEGER : total,
            remaining,
            utilization: total === 0 ? 0 : current / total,
            storageCount
        };
    }

    /**
     * Gets capacity information for all resources that have storage limits
     * @param resources - Array of all resources
     * @param storages - Array of all storage buildings
     * @returns Map of resource IDs to their capacity information
     */
    getAllCapacityInfo(resources: Resource[], storages: Storage[]): Map<string, CapacityInfo> {
        const result = new Map<string, CapacityInfo>();

        // Get all unique resource IDs that have capacity limits
        const managedResourceIds = new Set<string>();
        for (const storage of storages) {
            if (storage.isBuilt && storage.isUnlocked) {
                for (const resourceId of storage.getManagedResourceIds()) {
                    managedResourceIds.add(resourceId);
                }
            }
        }

        // Generate capacity info for each managed resource
        for (const resourceId of managedResourceIds) {
            const resource = resources.find(r => r.id === resourceId);
            if (resource) {
                result.set(resourceId, this.getCapacityInfo(resourceId, resource, storages));
            }
        }

        return result;
    }

    /**
     * Invalidates the capacity cache for a specific resource
     * Call this when storage buildings are added/removed/modified
     * @param resourceId - The resource ID to invalidate, or undefined to clear all
     */
    invalidateCache(resourceId?: string): void {
        if (resourceId) {
            this.cacheValidFlags.delete(resourceId);
            this.capacityCache.delete(resourceId);
            logger.debug(`CapacityManager: Cache invalidated for resource ${resourceId}`);
        } else {
            this.cacheValidFlags.clear();
            this.capacityCache.clear();
            logger.debug("CapacityManager: All capacity cache cleared");
        }

        // Emit cache invalidation event
        this.eventManager.emitSystemEvent('capacityCacheInvalidated', { resourceId });
    }

    /**
     * Clears old cache entries periodically to prevent memory leaks
     * Should be called periodically by the game loop
     */
    performMaintenance(): void {
        const now = Date.now();
        if (now - this.lastCacheClean > this.CACHE_CLEAN_INTERVAL) {
            // For now, just clear everything periodically
            // Could be optimized to track usage and only clear unused entries
            const cacheSize = this.capacityCache.size;
            this.invalidateCache();
            this.lastCacheClean = now;
            
            if (cacheSize > 0) {
                logger.debug(`CapacityManager: Maintenance completed - cleared ${cacheSize} cache entries`);
            }
        }
    }

    /**
     * Gets cache statistics for debugging and monitoring
     * @returns Object with cache performance metrics
     */
    getCacheStats(): { size: number; validEntries: number; hitRate?: number } {
        return {
            size: this.capacityCache.size,
            validEntries: this.cacheValidFlags.size
        };
    }

    /**
     * Validates that all storage buildings are properly configured
     * @param storages - Array of all storage buildings to validate
     * @returns Array of validation issues found
     */
    validateStorageConfiguration(storages: Storage[]): string[] {
        const issues: string[] = [];
        const resourceCapacities = new Map<string, number>();

        for (const storage of storages) {
            if (!storage.isBuilt || !storage.isUnlocked) {
                continue;
            }

            const managedResources = storage.getManagedResourceIds();
            if (managedResources.length === 0) {
                issues.push(`Storage ${storage.name} has no capacity limits set`);
                continue;
            }

            for (const resourceId of managedResources) {
                const capacity = storage.getCapacityFor(resourceId);
                if (capacity !== undefined && capacity < 0) {
                    issues.push(`Storage ${storage.name} has negative capacity for resource ${resourceId}`);
                }

                // Track total capacity per resource
                const current = resourceCapacities.get(resourceId) || 0;
                resourceCapacities.set(resourceId, current + (capacity || 0));
            }
        }

        // Check for extremely low capacities that might be configuration errors
        for (const [resourceId, totalCapacity] of resourceCapacities) {
            if (totalCapacity > 0 && totalCapacity < 10) {
                issues.push(`Resource ${resourceId} has very low total capacity (${totalCapacity}) - possible configuration error`);
            }
        }

        return issues;
    }
}