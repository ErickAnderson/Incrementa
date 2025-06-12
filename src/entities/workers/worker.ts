import { BaseEntity } from "../../core/base-entity";
import {Resource} from "../resources/resource";
import {Factory} from "../buildings/factory";
import { logger } from "../../utils/logger";

/**
 * Represents a worker that gathers resources over time.
 */
export class Worker extends BaseEntity {
    // The gathering rate, or amount of resource collected per time interval
    gatheringRate: number;

    // Time interval for gathering resources
    interval: number;

    // The current status of the worker (e.g., idle, gathering)
    status: "idle" | "gathering";

    // Timer ID for tracking the gathering process
    timerId: number | null;

    /**
     * Constructs a new Worker instance.
     * @param name - The name of the worker.
     * @param description - Description of what the worker does.
     * @param gatheringRate - The rate at which the worker gathers resources.
     * @param interval - The time interval for gathering resources.
     * @param unlockCondition - Condition under which the worker can be unlocked.
     */
    /**
     * Creates a new Worker instance
     * @param config - Worker configuration object
     * @param config.name - The display name of the worker (e.g., "Lumberjack", "Miner")
     * @param config.description - Optional description of what this worker does
     * @param config.gatheringRate - Amount of resources gathered per interval (defaults to 1)
     * @param config.interval - Time in milliseconds between gathering cycles (defaults to 1000)
     * @param config.unlockCondition - Function that returns true when this worker should become available
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.tags - Optional array of strings for categorizing this worker (e.g., ["automation", "labor"])
     */
    constructor(config: {
        name: string;
        description?: string;
        gatheringRate?: number;
        interval?: number;
        unlockCondition?: () => boolean;
        id?: string;
        tags?: string[];
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            unlockCondition: config.unlockCondition,
            tags: config.tags
        });
        this.gatheringRate = config.gatheringRate || 1;
        this.interval = config.interval || 1000;
        this.status = "idle";
        this.timerId = null;
    }


    /**
     * Lifecycle hook - called when worker is initialized
     */
    onInitialize(): void {
        logger.info(`Worker ${this.name} initialized with gathering rate ${this.gatheringRate}`);
    }

    /**
     * Starts the gathering process for the worker.
     * @param resource - The resource to gather.
     */
    startGathering(resource: Resource) {
        if (this.status === "gathering") return; // Already gathering
        this.status = "gathering";

        this.timerId = (globalThis as any).setInterval(() => {
            this.gather(resource);
        }, this.interval);
    }

    /**
     * Stops the gathering process for the worker.
     */
    stopGathering() {
        if (this.timerId) {
            (globalThis as any).clearInterval(this.timerId);
            this.timerId = null;
            this.status = "idle";
        }
    }

    /**
     * Gathers resources at the defined gathering rate.
     * @param resource - The resource to gather.
     */
    private gather(resource: Resource) {
        if (this.isUnlocked) {
            resource.increment(this.gatheringRate);
        }
    }

    /**
     * Puts the worker to work on a building.
     * @param building - The building the worker will gather from.
     */
    workOnBuilding(building: Factory) {
        // Implement logic for gathering resources based on the building's properties
        // For example, if the building has a resource output rate
        if (this.isUnlocked) {
            logger.info(`${this.name} is working on ${building.name}.`);
            // this.startGathering(building.outputResource); // Assuming building has an outputResource property
            // @TODO Implement logic for gathering resources from the building
        }
    }

    /**
     * Cleanup method to stop gathering when the worker is no longer needed.
     */
    cleanup() {
        this.stopGathering();
        this.timerId = null; // Clear the timer reference
    }
}