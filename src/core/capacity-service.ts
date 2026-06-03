import { Storage } from '../entities/buildings/storage';
import { logger } from '../utils/logger';

/**
 * Interface for the capacity service
 */
export interface ICapacityService {
    // Capacity calculations
    getTotalCapacityFor(resourceId: string): number;
    hasGlobalCapacity(resourceId: string, amount: number): boolean;
    getRemainingCapacityFor(resourceId: string): number;
    
    // Storage management
    getStorageStatus(): Storage[];
    
    // Maintenance
    performMaintenance(): void;
    
    // Cache management
    invalidateCache(): void;
    
    // Cleanup
    destroy(): void;
}

/**
 * Service responsible for managing storage capacity across all storage buildings
 * Extracted from Game class to reduce god class anti-pattern
 */
export class CapacityService implements ICapacityService {
    private capacityCache = new Map<string, number>();
    private cacheValidUntil = 0;
    private readonly CACHE_DURATION = 5000; // 5 seconds

    constructor(
        private getStorages: () => Storage[],
        private getResourceById: (id: string) => { amount: number } | undefined
    ) {
        logger.debug('CapacityService: Initialized');
    }

    /**
     * Gets total capacity for a resource across all storage buildings
     */
    getTotalCapacityFor(resourceId: string): number {
        // Check cache first
        const now = Date.now();
        if (now < this.cacheValidUntil && this.capacityCache.has(resourceId)) {
            return this.capacityCache.get(resourceId)!;
        }

        let totalCapacity = 0;
        const storages = this.getStorages();

        for (const storage of storages) {
            if (storage.isBuilt) {
                const capacity = storage.getCapacityFor(resourceId);
                if (capacity !== undefined && capacity > 0) {
                    totalCapacity += capacity;
                    logger.debug(`CapacityService: Storage '${storage.name}' provides ${capacity} capacity for ${resourceId}`);
                }
            }
        }

        // A total of 0 means no built storage defines a limit for this
        // resource. That is reported as 0 here; the "unlimited" interpretation
        // lives in hasGlobalCapacity / getRemainingCapacityFor.

        // Update cache
        this.capacityCache.set(resourceId, totalCapacity);
        this.cacheValidUntil = now + this.CACHE_DURATION;

        logger.debug(`CapacityService: Total capacity for ${resourceId}: ${totalCapacity}`);
        return totalCapacity;
    }

    /**
     * Checks if there is sufficient capacity across all storage buildings for a resource amount
     */
    hasGlobalCapacity(resourceId: string, amount: number): boolean {
        const totalCapacity = this.getTotalCapacityFor(resourceId);

        // No built storage defines a limit for this resource => unlimited
        if (totalCapacity === 0) {
            return true;
        }

        const resource = this.getResourceById(resourceId);
        const currentAmount = resource?.amount || 0;
        const wouldExceedCapacity = (currentAmount + amount) > totalCapacity;

        if (wouldExceedCapacity) {
            logger.debug(`CapacityService: Capacity check failed for ${resourceId}: ${currentAmount} + ${amount} > ${totalCapacity}`);
        }

        return !wouldExceedCapacity;
    }

    /**
     * Gets remaining capacity for a resource across all storage buildings
     */
    getRemainingCapacityFor(resourceId: string): number {
        const totalCapacity = this.getTotalCapacityFor(resourceId);

        // No built storage defines a limit for this resource => unlimited
        if (totalCapacity === 0) {
            return Number.MAX_SAFE_INTEGER;
        }

        const resource = this.getResourceById(resourceId);
        const currentAmount = resource?.amount || 0;
        const remaining = Math.max(0, totalCapacity - currentAmount);
        logger.debug(`CapacityService: Remaining capacity for ${resourceId}: ${remaining} (${totalCapacity} - ${currentAmount})`);
        
        return remaining;
    }

    /**
     * Returns all current storage buildings and their status
     */
    getStorageStatus(): Storage[] {
        return this.getStorages();
    }

    /**
     * Invalidates the capacity cache, forcing recalculation on next access
     */
    invalidateCache(): void {
        this.capacityCache.clear();
        this.cacheValidUntil = 0;
        logger.debug('CapacityService: Cache invalidated');
    }

    /**
     * Performs maintenance operations like cache cleanup
     */
    performMaintenance(): void {
        const now = Date.now();
        if (now >= this.cacheValidUntil) {
            this.capacityCache.clear();
            logger.debug('CapacityService: Cache expired and cleared during maintenance');
        }
    }

    /**
     * Gets capacity statistics for monitoring
     */
    getCapacityStats(): {
        cachedResources: number;
        cacheValidUntil: number;
        totalStorages: number;
        builtStorages: number;
    } {
        const storages = this.getStorages();
        return {
            cachedResources: this.capacityCache.size,
            cacheValidUntil: this.cacheValidUntil,
            totalStorages: storages.length,
            builtStorages: storages.filter(s => s.isBuilt).length
        };
    }

    /**
     * Cleanup method to release resources
     */
    destroy(): void {
        this.capacityCache.clear();
        this.cacheValidUntil = 0;
        logger.info('CapacityService: Destroyed and cache cleared');
    }
}