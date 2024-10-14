/**
 * Represents a Timer that processes time-based events globally, using delta time for accuracy.
 */
export class Timer {
    // Total time the timer will run for, in milliseconds
    private readonly totalTime: number;

    // The tick rate (in ms) that determines how often the timer checks progress
    private readonly tickRate: number;

    // Time remaining for the timer, in milliseconds
    private remainingTime: number;

    // Whether the timer is currently running
    private isRunning: boolean;

    // Whether the timer is currently paused
    private isPaused: boolean;

    // The timestamp of the last update (for delta time calculation)
    private lastTimestamp: number | null;

    // A list of callback functions to be executed when the timer finishes
    private onCompleteCallbacks: Array<() => void>;

    // A list of callback functions to be executed when the timer is stopped
    private onStopCallbacks: (() => void)[];

    // A list of callback functions to be executed on every update tick
    private onUpdateCallbacks: (() => void)[];

    // A globally accessible timer for all time-based activities
    private globalTimerId: number | null;

    /**
     * Constructs a Timer instance.
     * @param {Object} config - The configuration object for the timer.
     * @param {number} config.totalTime - The total time the timer should run for (in milliseconds).
     * @param {number} config.tickRate - The rate at which the timer should update (in milliseconds).
     * @param {Array<() => void>} [config.onCompleteCallbacks] - An optional array of callback functions to execute when the timer completes.
     * @param {Array<() => void>} [config.onStopCallbacks] - An optional array of callback functions to execute when the timer stops.
     * @param {Array<() => void>} [config.onUpdateCallbacks] - An optional array of callback functions to execute on every update tick.
     */
    constructor(config: {
        totalTime: number,
        tickRate: number,
        onCompleteCallbacks: Array<() => void>,
        onStopCallbacks: Array<() => void>,
        onUpdateCallbacks: Array<() => void>
    }) {
        this.totalTime = config.totalTime;
        this.remainingTime = config.totalTime;
        this.tickRate = config.tickRate;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTimestamp = null;
        this.onCompleteCallbacks = config.onCompleteCallbacks ?? [];
        this.onStopCallbacks = config.onStopCallbacks ?? [];
        this.onUpdateCallbacks = config.onUpdateCallbacks ?? [];
        this.globalTimerId = null;
    }

    /**
     * Starts the timer and updates based on delta time.
     *
     * @returns void
     */
    start(): void {
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
     *
     * @param callStopCallbacks - If true, executes stop callbacks when the timer is stopped.
     * @returns void
     */
    stop(callStopCallbacks = true): void {
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
     *
     * @returns void
     */
    toggle(): void {
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
     *
     * @returns void
     */
    private update(): void {
        if (this.isPaused || !this.isRunning) return; // Skip update if paused

        const now = Date.now();
        const deltaTime = now - (this.lastTimestamp || now);
        this.lastTimestamp = now;

        // Call onUpdate callbacks
        this.onUpdateCallbacks.forEach((callback) => callback());

        this.remainingTime -= deltaTime;

        if (this.remainingTime <= 0) {
            this.complete();
        }
    }

    /**
     * Marks the timer as complete and triggers any completion callbacks.
     */
    private complete(): void {
        this.remainingTime = this.totalTime;

        // Execute completion callbacks
        this.onCompleteCallbacks.forEach((callback) => callback());
    }

    /**
     * Adds a new callback function to be executed when the timer finishes.
     *
     * @param callback Array<callback> callback - The callback function to add.
     * @returns void
     */
    addOnCompleteCallback(callback: Array<() => void>): void {
        if (Array.isArray(callback)) {
            callback.forEach(
                (cb) => {
                    if (typeof cb === 'function') {
                        this.onCompleteCallbacks.push(cb);
                    }
                }
            )
        }
    }

    /**
     * Adds a new callback function to be executed when the timer is stopped.
     *
     * @param callback - The callback function to add.
     * @returns void
     */
    addOnStopCallback(callback: () => void): void {
        this.onStopCallbacks.push(callback);
    }

    /**
     * Adds a new callback function to be executed on every update tick.
     *
     * @param callback - The callback function to add.
     * @returns void
     */
    addOnUpdateCallback(callback: () => void): void {
        this.onUpdateCallbacks.push(callback);
    }

    /**
     * Gets the progress of the timer as a percentage (between 0 and 1).
     *
     * @returns The percentage progress of the timer.
     */
    getProgress(): number {
        return (this.totalTime - this.remainingTime) / this.totalTime;
    }

    /**
     * Resets the timer back to its original state.
     *
     * @returns void
     */
    reset(): void {
        this.remainingTime = this.totalTime;
        this.lastTimestamp = null;
        this.isRunning = false;
        this.isPaused = false; // Reset pause state
    }

    /**
     * Checks if the timer is currently running.
     *
     * @returns A boolean indicating whether the timer is active.
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Checks if the timer is currently paused.
     *
     * @returns A boolean indicating whether the timer is active.
     */
    getIsPaused(): boolean {
        return this.isPaused;
    }
}
