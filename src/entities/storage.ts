import {Building} from "./building.ts";
import {Resource} from "./resource.ts";

/**
 * Storage class to store multiple types of resources and increase capacity.
 */
export class Storage extends Building {
    capacity: number; // Capacity of the storage
    resources: Resource[]; // Array of resources this storage manages

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

    // Add a resource to this storage
    addResource(resource: Resource) {
        if (this.resources.length < this.capacity) {
            this.resources.push(resource);
        } else {
            console.log(`Storage is full. Upgrade to increase capacity.`);
        }
    }

    // Increase the capacity via an upgrade
    increaseCapacity(extraCapacity: number) {
        this.capacity += extraCapacity;
    }
}