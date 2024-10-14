// import NodeJS from 'node:events';

/**
 * Represents a Timer that processes time-based events globally, using delta time for accuracy.
 */
export class Timer {
    // Total time the timer will run for, in milliseconds
    private totalTime: number;

    // Time remaining for the timer, in milliseconds
    private remainingTime: number;

    // The tick rate (in ms) that determines how often the timer checks progress
    private tickRate: number;

    // Whether the timer is currently running
    private isRunning: boolean;

    // Whether the timer is currently paused
    private isPaused: boolean;

    // The timestamp of the last update (for delta time calculation)
    private lastTimestamp: number | null;

    // A list of callback functions to be executed when the timer finishes
    private onCompleteCallbacks: (() => void)[];

    // A list of callback functions to be executed when the timer is stopped
    private onStopCallbacks: (() => void)[];

    // A list of callback functions to be executed on every update tick
    private onUpdateCallbacks: (() => void)[];

    // A globally accessible timer for all time-based activities
    private globalTimerId: number | null;

    /**
     * Constructs a Timer instance.
     * @param totalTime - The total time the timer should run for (in milliseconds).
     * @param tickRate - The rate at which the timer ticks (in milliseconds).
     * @param onCompleteCallbacks - Optional array of functions to call when the timer finishes.
     * @param onStopCallbacks - Optional array of functions to call when the timer is stopped.
     * @param onUpdateCallbacks - Optional array of functions to call on every update tick.
     */
    constructor(
        totalTime: number,
        tickRate: number,
        onCompleteCallbacks: (() => void)[] = [],
        onStopCallbacks: (() => void)[] = [],
        onUpdateCallbacks: (() => void)[] = []
    ) {
        this.totalTime = totalTime;
        this.remainingTime = totalTime;
        this.tickRate = tickRate;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTimestamp = null;
        this.onCompleteCallbacks = onCompleteCallbacks;
        this.onStopCallbacks = onStopCallbacks;
        this.onUpdateCallbacks = onUpdateCallbacks;
        this.globalTimerId = null;
    }

    /**
     * Starts the timer and updates based on delta time.
     */
    start() {
        if (this.isRunning) return; // Avoid multiple starts

        this.isRunning = true;
        this.isPaused = false;
        this.lastTimestamp = Date.now();

        this.globalTimerId = setInterval(() => {
            this.update();
        }, this.tickRate);
    }

    /**
     * Stops the timer and calls any stop callbacks.
     * @param callStopCallbacks - If true, executes stop callbacks when the timer is stopped.
     */
    stop(callStopCallbacks = true) {
        if (this.globalTimerId) {
            clearInterval(this.globalTimerId);
            this.globalTimerId = null;
        }
        this.reset();

        if (callStopCallbacks) {
            this.onStopCallbacks.forEach((callback) => callback());
        }
    }

    /**
     * Toggles the timer state between running and paused.
     */
    toggle() {
        if (this.isPaused) {
            this.isPaused = false; // Resume
            this.lastTimestamp = Date.now(); // Reset timestamp to now for accurate timing
        } else {
            this.isPaused = true; // Pause
        }
    }

    /**
     * Updates the timer based on delta time since the last tick.
     * If the timer is finished, it triggers the complete callbacks and restarts the timer.
     * @param ongoing - Whether to restart the timer after it finishes. Defaults to true.
     */
    private update(ongoing: boolean = true) {
        if (this.isPaused || ! this.isRunning) return; // Skip update if paused

        const now = Date.now();
        const deltaTime = now - (this.lastTimestamp || now);
        this.lastTimestamp = now;

        // Call onUpdate callbacks if delta time is lower than tickRate
        if (deltaTime < this.tickRate) {
            this.onUpdateCallbacks.forEach((callback) => callback());
        }

        this.remainingTime -= deltaTime;

        if (this.remainingTime <= 0) {
            this.remainingTime = 0;
            this.complete();
            if (ongoing) {
                this.reset(); // Reset to start again
                this.start(); // Restart the timer
            }
        }
    }

    /**
     * Marks the timer as complete and triggers any completion callbacks.
     */
    private complete() {
        this.stop(false); // Stop without calling the stop callbacks

        // Execute completion callbacks
        this.onCompleteCallbacks.forEach((callback) => callback());
    }

    /**
     * Adds a new callback function to be executed when the timer finishes.
     * @param callback - The callback function to add.
     */
    addOnCompleteCallback(callback: () => void) {
        this.onCompleteCallbacks.push(callback);
    }

    /**
     * Adds a new callback function to be executed when the timer is stopped.
     * @param callback - The callback function to add.
     */
    addOnStopCallback(callback: () => void) {
        this.onStopCallbacks.push(callback);
    }

    /**
     * Adds a new callback function to be executed on every update tick.
     * @param callback - The callback function to add.
     */
    addOnUpdateCallback(callback: () => void) {
        this.onUpdateCallbacks.push(callback);
    }

    /**
     * Gets the progress of the timer as a percentage (between 0 and 1).
     * @returns The percentage progress of the timer.
     */
    getProgress(): number {
        return (this.totalTime - this.remainingTime) / this.totalTime;
    }

    /**
     * Resets the timer back to its original state.
     */
    reset() {
        this.remainingTime = this.totalTime;
        this.lastTimestamp = null;
        this.isRunning = false;
        this.isPaused = false; // Reset pause state
    }

    /**
     * Checks if the timer is currently running.
     * @returns A boolean indicating whether the timer is active.
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Checks if the timer is currently paused.
     * @returns A boolean indicating whether the timer is active.
     */
    getIsPaused(): boolean {
        return this.isPaused;
    }
}
