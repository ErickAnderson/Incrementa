import {Building} from "./building";
import {Resource} from "../resources/resource";

/**
 * Storage class to store multiple types of resources and increase capacity.
 */
export class Storage extends Building {
    /** Maximum number of resources this storage can hold */
    capacity: number;
    
    /** Array of resources currently stored in this storage */
    resources: Resource[];

    /**
     * Creates a new Storage building
     * @param name - The name of the storage building
     * @param description - A description of the storage building
     * @param cost - The resources required to build this storage
     * @param buildTime - Time required to construct this storage in milliseconds
     * @param capacity - Maximum number of resources this storage can hold
     * @param unlockCondition - Condition that must be met to unlock this storage
     */
    constructor(
        name: string,
        description: string,
        cost: Record<string, number>,
        buildTime: number,
        capacity: number,
        unlockCondition: any
    ) {
        super(name, description, cost, buildTime, 0, unlockCondition); // Storage doesn't produce resources directly
        this.capacity = capacity;
        this.resources = [];
    }

    /**
     * Adds a resource to this storage if there is available capacity
     * @param resource - The resource to add to storage
     * @returns {boolean} - Whether the resource was successfully added
     */
    addResource(resource: Resource): boolean {
        if (this.resources.length < this.capacity) {
            this.resources.push(resource);
            return true;
        }
        console.log(`Storage is full. Upgrade to increase capacity.`);
        return false;
    }

    /**
     * Increases the storage capacity by the specified amount
     * @param extraCapacity - The amount to increase the capacity by
     */
    increaseCapacity(extraCapacity: number): void {
        this.capacity += extraCapacity;
    }

    /**
     * Gets the amount of available space in the storage
     * @returns {number} - The number of additional resources that can be stored
     */
    getAvailableSpace(): number {
        return this.capacity - this.resources.length;
    }

    /**
     * Gets the current utilization of the storage as a percentage
     * @returns {number} - The percentage of storage space used (0-1)
     */
    getUtilization(): number {
        return this.resources.length / this.capacity;
    }

    /**
     * Removes a resource from storage if it exists
     * @param resourceType - The type of resource to remove
     * @returns {Resource | null} - The removed resource or null if not found
     */
    removeResource(resourceType: string): Resource | null {
        const index = this.resources.findIndex(r => r.name === resourceType);
        if (index !== -1) {
            return this.resources.splice(index, 1)[0];
        }
        return null;
    }

    /**
     * Checks if the storage contains a specific type of resource
     * @param resourceType - The type of resource to check for
     * @returns {boolean} - Whether the resource type exists in storage
     */
    hasResource(resourceType: string): boolean {
        return this.resources.some(r => r.name === resourceType);
    }

    /**
     * Gets the count of a specific resource type in storage
     * @param resourceType - The type of resource to count
     * @returns {number} - The number of resources of that type
     */
    getResourceCount(resourceType: string): number {
        return this.resources.filter(r => r.name === resourceType).length;
    }
}