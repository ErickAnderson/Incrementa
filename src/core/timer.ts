/**
 * Represents a Timer that processes time-based events globally, using delta time for accuracy.
 */
export class Timer {
    // Total time the timer will run for, in milliseconds
    private totalTime: number;

    // The tick rate, in milliseconds that determines how often the timer updates
    private tickRate: number;

    // Time remaining for the timer to be completed, in milliseconds
    private remainingTime: number;

    // The timestamp of the last update (for delta time calculation)
    private lastTimestamp: number | null;

    // A globally accessible timer for all time-based activities
    private globalTimerId: number | null;

    // Whether the timer is currently running
    private isRunning: boolean;

    // Whether the timer is currently paused
    private isPaused: boolean;

    // A list of callback functions to be executed when the timer finishes
    private onCompleteCallbacks: Array<() => void>;

    // A list of callback functions to be executed when the timer is stopped
    private onStopCallbacks: Array<() => void>;

    // A list of callback functions to be executed on every update tick
    private onUpdateCallbacks: Array<() => void>;

    // A callback function to check if the timer should continue running
    private conditionCallback?: () => boolean;

    /**
     * Creates an instance of the Timer class.
     *
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
        onCompleteCallbacks?: Array<() => void>,
        onStopCallbacks?: Array<() => void>,
        onUpdateCallbacks?: Array<() => void>,
        conditionCallback?: () => boolean
    }) {
        this.totalTime = config.totalTime;
        this.remainingTime = config.totalTime;
        this.tickRate = config.tickRate;
        this.lastTimestamp = null;
        this.globalTimerId = null;

        this.isRunning = false;
        this.isPaused = false;

        this.onCompleteCallbacks = config.onCompleteCallbacks || [];
        this.onStopCallbacks = config.onStopCallbacks || [];
        this.onUpdateCallbacks = config.onUpdateCallbacks || [];
        this.conditionCallback = config.conditionCallback || (() => true);
    }

    /**
     * Starts the timer and updates based on delta time.
     *
     * @returns void
     */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.lastTimestamp = Date.now();

        this.globalTimerId = setInterval(() => {
            if (this.conditionCallback!()) {
                this.update();
            }
        }, this.tickRate);
    }

    /**
     * Stops the timer and maybe calls any stop callbacks.
     *
     * @param {boolean} [callStopCallbacks=true] - If true, executes stop callbacks when the timer is stopped.
     * @returns void
     */
    stop(callStopCallbacks: boolean = true): void {
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
            this.isPaused = false;
            this.lastTimestamp = Date.now();
        } else {
            this.isPaused = true;
        }
    }

    /**
     * Updates the timer based on delta time since the last tick.
     * If the timer is finished, it triggers the complete callbacks and restarts the timer.
     *
     * @returns void
     */
    private update(): void {
        // Skip update if paused or not running
        if (this.isPaused || !this.isRunning) return;

        const now = Date.now();
        const deltaTime = now - (this.lastTimestamp || now);
        this.lastTimestamp = now;

        // Call on update callbacks
        this.onUpdateCallbacks.forEach((callback) => callback());

        this.remainingTime -= deltaTime;

        if (this.remainingTime <= 0) {
            this.complete();
        }
    }

    /**
     * Resets the remaining time back to the total time and calls the complete callbacks.
     *
     * @returns void
     */
    private complete(): void {
        this.remainingTime = this.totalTime;

        // Execute completion callbacks
        this.onCompleteCallbacks.forEach((callback) => callback());
    }

    /**
     * Sets the timer's on complete callbacks to the provided array of functions.
     *
     * @param {() => void} callbacks - An array of callback functions to set.
     * @returns void
     */
    setOnCompleteCallbacks(callbacks: Array<() => void>): void {
        this.onCompleteCallbacks = callbacks;
    }

    /**
     * Sets the timer's on stop callbacks to the provided array of functions.
     *
     * @param {Array<() => void} callbacks - An array of callback functions to set.
     * @returns void
     */
    setOnStopCallbacks(callbacks: Array<() => void>): void {
        this.onStopCallbacks = callbacks;
    }

    /**
     * Sets the timer's on update callbacks to the provided array of functions.
     *
     * @param {Array<() => void} callbacks - An array of callback functions to set.
     * @returns void
     */
    setOnUpdateCallbacks(callbacks: Array<() => void>): void {
        this.onUpdateCallbacks = callbacks
    }

    /**
     * Sets the timer's condition callback to the provided function.
     *
     * @param {() => boolean} callback - The callback function to set.
     * @returns void
     */
    setConditionCallback(callback: () => boolean): void {
        this.conditionCallback = callback;
    }

    /**
     * Adds the provided callback functions to the list of callbacks.
     *
     * @param {Array<() => void} callbacks - An array of callback functions to add.
     * @param {Array<() => void} callbackList - The Timer property list to add the callbacks to.
     */
    addCallbacks(callbacks: Array<() => void>, callbackList: Array<() => void>): void {
        if (Array.isArray(callbacks)) {
            callbacks.forEach(
                (callback) => {
                    if (typeof callback === 'function') {
                        callbackList.push(callback);
                    }
                }
            )
        }
    }

    /**
     * Adds the provided callback functions to the list of completion callbacks.
     *
     * @param {Array<() => void} callbacks - An array of callback functions to add.
     * @returns void
     */
    addOnCompleteCallback(callbacks: Array<() => void>): void {
        this.addCallbacks(callbacks, this.onCompleteCallbacks);
    }

    /**
     * Adds a new callback function to be executed when the timer is stopped.
     *
     * @param {Array<() => void} callbacks - An array of callback functions to add.
     * @returns void
     */
    addOnStopCallback(callbacks: Array<() => void>): void {
        this.addCallbacks(callbacks, this.onStopCallbacks);
    }

    /**
     * Adds a new callback function to be executed on every update tick.
     *
     * @param {Array<() => void} callbacks - An array of callback functions to add.
     * @returns void
     */
    addOnUpdateCallback(callbacks: Array<() => void>): void {
        this.addCallbacks(callbacks, this.onUpdateCallbacks);
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
     * Resets the timer to its initial state.
     * Stops the timer if it is running.
     * Clears the remaining time and last timestamp.
     *
     * @returns void
     */
    reset(): void {
        this.remainingTime = this.totalTime;
        this.lastTimestamp = null;
        this.isRunning = false;
        this.isPaused = false;
    }

    /**
     * Sets or updates the total time for the timer.
     *
     * @param {number} time - The total time in milliseconds for the timer.
     * @returns void
     */
    setTotalTime(time: number): void {
        this.totalTime = time;
    }

    /**
     * Sets or updates the tick rate for the timer.
     *
     * @param {number} rate - The tick rate in milliseconds for the timer.
     * @returns void
     */
    setTickRate(rate: number): void {
        this.tickRate = rate;
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
