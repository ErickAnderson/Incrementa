import {Building} from "./building";
import { logger } from "../../utils/logger";

/**
 * Storage class that manages capacity limits for global resources.
 * Instead of storing resources locally, it defines maximum amounts that can be held globally.
 */
export class Storage extends Building {
    /** Map of resource IDs to their capacity limits */
    private resourceCapacities: Map<string, number>;
    
    // Game reference inherited from Building class

    /**
     * Creates a new Storage building
     * @param config - Storage configuration object
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.name - The display name of the storage (e.g., "Warehouse", "Resource Depot")
     * @param config.description - Optional description of what this storage facility manages
     * @param config.tags - Optional array of strings for categorizing this storage (e.g., ["storage", "infrastructure"])
     * @param config.cost - Resource costs to build this storage (e.g., {wood: 30, stone: 20})
     * @param config.buildTime - Time in seconds required to complete construction (defaults to 0)
     * @param config.capacities - Map of resource IDs to their capacity limits
     * @param config.unlockCondition - Function that returns true when this storage should become available
     */
    constructor(config: {
        id?: string;
        name: string;
        description?: string;
        tags?: string[];
        cost?: Record<string, number>;
        buildTime?: number;
        capacities?: Record<string, number>;
        unlockCondition?: () => boolean;
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            tags: config.tags,
            cost: config.cost,
            buildTime: config.buildTime,
            productionRate: 0, // Storage doesn't produce resources directly
            unlockCondition: config.unlockCondition
        });
        
        this.resourceCapacities = new Map();
        
        // Initialize capacities if provided
        if (config.capacities) {
            for (const [resourceId, capacity] of Object.entries(config.capacities)) {
                this.resourceCapacities.set(resourceId, capacity);
            }
        }
    }

    /**
     * Gets the capacity limit for a specific resource
     * @param resourceId - The ID of the resource to check
     * @returns The capacity limit, or undefined if no limit is set for this resource
     */
    getCapacityFor(resourceId: string): number | undefined {
        return this.resourceCapacities.get(resourceId);
    }

    /**
     * Sets the capacity limit for a specific resource
     * @param resourceId - The ID of the resource
     * @param capacity - The capacity limit to set
     */
    setCapacityFor(resourceId: string, capacity: number): void {
        if (capacity < 0) {
            logger.warn(`Attempted to set negative capacity for resource ${resourceId}`);
            return;
        }
        
        const oldCapacity = this.resourceCapacities.get(resourceId);
        this.resourceCapacities.set(resourceId, capacity);
        
        // Emit capacity change event
        this.emit('capacityChanged', {
            resourceId,
            oldCapacity,
            newCapacity: capacity
        });
        
        logger.info(`Capacity for resource ${resourceId} set to ${capacity}`);
    }

    /**
     * Checks if there is sufficient capacity for a given amount of a resource
     * @param resourceId - The ID of the resource to check
     * @param amountToCheck - The amount to check capacity for
     * @returns Whether there is sufficient capacity
     */
    hasCapacity(resourceId: string, amountToCheck: number): boolean {
        const capacity = this.resourceCapacities.get(resourceId);
        if (capacity === undefined) {
            // No capacity limit set for this resource means unlimited capacity
            logger.debug(`Storage ${this.name}: No capacity limit for resource ${resourceId} - allowing unlimited`);
            return true;
        }
        
        const currentAmount = this.getResourceAmount(resourceId);
        const hasSpace = currentAmount + amountToCheck <= capacity;
        
        if (hasSpace) {
            logger.debug(`Storage ${this.name}: Capacity check passed for ${resourceId} - ${amountToCheck} units (${currentAmount}/${capacity} used)`);
        } else {
            logger.warn(`Storage ${this.name}: Capacity exceeded for resource ${resourceId} - attempted ${amountToCheck}, current: ${currentAmount}, capacity: ${capacity}`);
        }
        
        return hasSpace;
    }

    /**
     * Gets the current amount of a resource from the global game state
     * @param resourceId - The ID of the resource
     * @returns The current global amount of the resource
     */
    getResourceAmount(resourceId: string): number {
        if (!this.game) {
            logger.warn(`Storage ${this.name}: Not integrated with game instance - cannot check resource amounts`);
            return 0;
        }
        
        const resource = this.game.getResourceById(resourceId);
        if (!resource) {
            logger.debug(`Storage ${this.name}: Resource ${resourceId} not found in game`);
            return 0;
        }
        
        return resource.amount;
    }

    /**
     * Checks if adding a specific amount of a resource would exceed capacity
     * @param resourceId - The ID of the resource
     * @param amount - The amount to check
     * @returns Whether the resource can be added without exceeding capacity
     */
    canAddResource(resourceId: string, amount: number): boolean {
        return this.hasCapacity(resourceId, amount);
    }

    /**
     * Gets the total capacity across all managed resources
     * @returns The sum of all capacity limits
     */
    getTotalCapacity(): number {
        let total = 0;
        for (const capacity of this.resourceCapacities.values()) {
            total += capacity;
        }
        return total;
    }

    /**
     * Gets the total used capacity across all managed resources
     * @returns The sum of all current resource amounts for managed resources
     */
    getUsedCapacity(): number {
        let used = 0;
        for (const resourceId of this.resourceCapacities.keys()) {
            used += this.getResourceAmount(resourceId);
        }
        return used;
    }

    /**
     * Gets the total remaining capacity across all managed resources
     * @returns The difference between total capacity and used capacity
     */
    getRemainingCapacity(): number {
        return this.getTotalCapacity() - this.getUsedCapacity();
    }

    /**
     * Gets the utilization percentage of this storage
     * @returns A value between 0 and 1 representing utilization percentage
     */
    getUtilization(): number {
        const total = this.getTotalCapacity();
        if (total === 0) return 0;
        return this.getUsedCapacity() / total;
    }

    /**
     * Gets all resource IDs managed by this storage
     * @returns Array of resource IDs that have capacity limits set
     */
    getManagedResourceIds(): string[] {
        return Array.from(this.resourceCapacities.keys());
    }

    /**
     * Increases the capacity for a specific resource
     * @param resourceId - The ID of the resource
     * @param extraCapacity - The amount to increase the capacity by
     */
    increaseCapacity(resourceId: string, extraCapacity: number): void {
        const currentCapacity = this.resourceCapacities.get(resourceId) || 0;
        const newCapacity = currentCapacity + extraCapacity;
        
        logger.info(`Storage ${this.name}: Increasing capacity for ${resourceId} by ${extraCapacity} (${currentCapacity} → ${newCapacity})`);
        this.setCapacityFor(resourceId, newCapacity);
    }

    /**
     * Sets the game instance reference for accessing global resources
     * @param game - The game instance
     * @internal
     */
    setGameReference(game: any): void {
        this.game = game;
        if (game) {
            logger.debug(`Storage ${this.name}: Game reference set - capacity management active`);
        } else {
            logger.debug(`Storage ${this.name}: Game reference cleared - capacity management disabled`);
        }
    }

    /**
     * Lifecycle hook called when the storage is unlocked
     * Emits capacity reached events if any resources are already at capacity
     */
    onUnlock(): void {
        super.onUnlock();
        
        logger.info(`Storage ${this.name}: Unlocked - managing capacity for ${this.resourceCapacities.size} resource types`);
        
        // Check if any resources are already at capacity when storage is unlocked
        for (const resourceId of this.resourceCapacities.keys()) {
            const currentAmount = this.getResourceAmount(resourceId);
            const capacity = this.resourceCapacities.get(resourceId)!;
            
            logger.debug(`Storage ${this.name}: Initial capacity check for ${resourceId}: ${currentAmount}/${capacity}`);
            
            if (currentAmount >= capacity) {
                logger.warn(`Storage ${this.name}: Resource ${resourceId} already at capacity on unlock (${currentAmount}/${capacity})`);
                this.emit('capacityReached', { resourceId, capacity, currentAmount });
            }
        }
    }

    /**
     * Update method called each game tick to monitor capacity status
     * @param deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime: number): void {
        super.onUpdate(deltaTime);
        
        // Check for capacity violations and emit events
        let capacityViolations = 0;
        for (const resourceId of this.resourceCapacities.keys()) {
            const currentAmount = this.getResourceAmount(resourceId);
            const capacity = this.resourceCapacities.get(resourceId)!;
            
            if (currentAmount >= capacity) {
                capacityViolations++;
                if (currentAmount > capacity) {
                    logger.warn(`Storage ${this.name}: Capacity exceeded for ${resourceId} - ${currentAmount}/${capacity} (overflow: ${currentAmount - capacity})`);
                }
                this.emit('capacityReached', { resourceId, capacity, currentAmount });
            }
        }
        
        if (capacityViolations > 0 && this.resourceCapacities.size > 1) {
            logger.info(`Storage ${this.name}: ${capacityViolations}/${this.resourceCapacities.size} resources at capacity`);
        }
    }
}