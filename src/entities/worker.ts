import {Entity} from "./entity.ts";
import {Resource} from "./resource.ts";
import {Factory} from "./factory.ts";

/**
 * Represents a worker that gathers resources over time.
 */
export class Worker extends Entity {
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
    constructor(
        name: string,
        description: string,
        gatheringRate: number,
        interval: number,
        unlockCondition: any
    ) {
        super(name, description, unlockCondition);
        this.gatheringRate = gatheringRate;
        this.interval = interval;
        this.status = "idle";
        this.timerId = null;
    }

    /**
     * Starts the gathering process for the worker.
     * @param resource - The resource to gather.
     */
    startGathering(resource: Resource) {
        if (this.status === "gathering") return; // Already gathering
        this.status = "gathering";

        this.timerId = setInterval(() => {
            this.gather(resource);
        }, this.interval);
    }

    /**
     * Stops the gathering process for the worker.
     */
    stopGathering() {
        if (this.timerId) {
            clearInterval(this.timerId);
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
            resource.collect(this.gatheringRate);
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
            console.log(`${this.name} is working on ${building.name}.`);
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