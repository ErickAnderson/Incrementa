import { logger } from "../utils/logger";

/**
 * Interface for the game loop service
 */
export interface IGameLoopService {
    start(): void;
    pause(): void;
    resume(): void;
    setSpeed(speed: number): void;
    getSpeed(): number;
    isRunning(): boolean;
    onUpdate(callback: (deltaTime: number) => void): void;
    removeUpdateCallback(callback: (deltaTime: number) => void): void;
    destroy(): void;
}

/**
 * Game loop service that manages the main game update cycle
 * Handles frame rate management, delta time calculation, and update orchestration
 */
export class GameLoopService implements IGameLoopService {
    private _isRunning = false;
    private gameSpeed = 1.0;
    private lastUpdateTime = 0;
    private animationFrameId: number | null = null;
    private updateCallbacks: ((deltaTime: number) => void)[] = [];
    private frameCount = 0;
    private lastFpsTime = 0;
    private currentFps = 0;

    /**
     * Creates a new GameLoopService instance
     */
    constructor() {
        this.lastUpdateTime = performance.now();
        this.lastFpsTime = performance.now();
        
        // Bind the loop method to maintain context
        this.loop = this.loop.bind(this);
    }

    /**
     * Starts the game loop
     */
    start(): void {
        if (this._isRunning) {
            logger.warn('GameLoopService: Attempted to start an already running game loop');
            return;
        }

        this._isRunning = true;
        this.lastUpdateTime = performance.now();
        this.lastFpsTime = performance.now();
        this.frameCount = 0;
        
        logger.info('GameLoopService: Starting game loop');
        this.loop();
    }

    /**
     * Pauses the game loop
     */
    pause(): void {
        if (!this._isRunning) {
            logger.warn('GameLoopService: Attempted to pause a non-running game loop');
            return;
        }

        this._isRunning = false;
        
        if (this.animationFrameId !== null) {
            this.cancelFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        logger.info('GameLoopService: Game loop paused');
    }

    /**
     * Resumes the game loop from a paused state
     */
    resume(): void {
        if (this._isRunning) {
            logger.warn('GameLoopService: Attempted to resume an already running game loop');
            return;
        }

        this._isRunning = true;
        this.lastUpdateTime = performance.now();
        
        logger.info('GameLoopService: Game loop resumed');
        this.loop();
    }

    /**
     * Sets the game speed multiplier
     * @param speed - Speed multiplier (1.0 = normal speed, 2.0 = double speed, 0.5 = half speed)
     */
    setSpeed(speed: number): void {
        if (speed < 0) {
            logger.warn('GameLoopService: Speed cannot be negative, ignoring');
            return;
        }

        if (speed > 10) {
            logger.warn('GameLoopService: Speed capped at 10x for stability');
            speed = 10;
        }

        const oldSpeed = this.gameSpeed;
        this.gameSpeed = speed;
        
        logger.debug(`GameLoopService: Speed changed from ${oldSpeed}x to ${speed}x`);
    }

    /**
     * Gets the current game speed multiplier
     * @returns Current speed multiplier
     */
    getSpeed(): number {
        return this.gameSpeed;
    }

    /**
     * Checks if the game loop is currently running
     * @returns Whether the game loop is running
     */
    isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Registers a callback to be called on each update
     * @param callback - Function to call with delta time
     */
    onUpdate(callback: (deltaTime: number) => void): void {
        if (!this.updateCallbacks.includes(callback)) {
            this.updateCallbacks.push(callback);
            logger.debug(`GameLoopService: Added update callback (${this.updateCallbacks.length} total)`);
        }
    }

    /**
     * Removes an update callback
     * @param callback - Function to remove from updates
     */
    removeUpdateCallback(callback: (deltaTime: number) => void): void {
        const index = this.updateCallbacks.indexOf(callback);
        if (index !== -1) {
            this.updateCallbacks.splice(index, 1);
            logger.debug(`GameLoopService: Removed update callback (${this.updateCallbacks.length} remaining)`);
        }
    }

    /**
     * Gets the current FPS (frames per second)
     * @returns Current FPS value
     */
    getCurrentFps(): number {
        return this.currentFps;
    }

    /**
     * Gets performance statistics
     * @returns Object with performance metrics
     */
    getPerformanceStats(): {
        fps: number;
        deltaTime: number;
        speed: number;
        callbackCount: number;
        isRunning: boolean;
    } {
        return {
            fps: this.currentFps,
            deltaTime: this.lastUpdateTime,
            speed: this.gameSpeed,
            callbackCount: this.updateCallbacks.length,
            isRunning: this._isRunning
        };
    }

    /**
     * Destroys the game loop service and cleans up resources
     */
    destroy(): void {
        this.pause();
        this.updateCallbacks.length = 0;
        
        logger.info('GameLoopService: Service destroyed');
    }

    /**
     * Main game loop function
     * Calculates delta time and calls all registered update callbacks
     */
    private loop = (): void => {
        if (!this._isRunning) return;

        const currentTime = performance.now();

        // Delta time is in milliseconds (frame-rate independent), capped to
        // avoid large jumps after a stall. Milliseconds are the single timing
        // unit across the framework so sub-second production cadences work.
        const rawDeltaTime = Math.min(currentTime - this.lastUpdateTime, 100); // cap at 100ms
        const deltaTime = rawDeltaTime * this.gameSpeed;

        // Update FPS calculation
        this.frameCount++;
        if (currentTime - this.lastFpsTime >= 1000) {
            this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsTime));
            this.frameCount = 0;
            this.lastFpsTime = currentTime;
        }

        // Call all registered update callbacks
        for (const callback of this.updateCallbacks) {
            try {
                callback(deltaTime);
            } catch (error) {
                logger.error(`GameLoopService: Error in update callback: ${error}`);
            }
        }

        this.lastUpdateTime = currentTime;
        this.animationFrameId = this.scheduleFrame();
    };

    /**
     * Schedules the next frame. Uses requestAnimationFrame in browser
     * environments and falls back to setTimeout (~60fps) elsewhere, so the
     * loop works in headless contexts such as servers or tests.
     */
    private scheduleFrame(): number {
        const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
        if (typeof raf === 'function') {
            return raf(this.loop);
        }
        return setTimeout(this.loop, 16) as unknown as number;
    }

    /**
     * Cancels a scheduled frame using the matching cancellation function.
     */
    private cancelFrame(id: number): void {
        const caf = (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame;
        if (typeof caf === 'function') {
            caf(id);
        } else {
            clearTimeout(id);
        }
    }
}