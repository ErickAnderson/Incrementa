import { Timer } from "./timer";
import { logger } from "../utils/logger";

/**
 * Interface for the timer coordinator
 */
export interface ITimerCoordinator {
    addTimer(id: string, timer: Timer): void;
    removeTimer(id: string): boolean;
    getTimer(id: string): Timer | undefined;
    pauseAllTimers(): void;
    resumeAllTimers(): void;
    updateTimers(deltaTime: number): void;
    getTimerStats(): TimerStats;
    clearAllTimers(): void;
    getActiveTimerCount(): number;
    getPausedTimerCount(): number;
}

/**
 * Timer statistics interface
 */
export interface TimerStats {
    totalTimers: number;
    activeTimers: number;
    pausedTimers: number;
    completedTimers: number;
    totalUpdateTime: number;
    averageUpdateTime: number;
}

/**
 * Timer state tracking
 */
interface TimerState {
    timer: Timer;
    isActive: boolean;
    isPaused: boolean;
    totalUpdateTime: number;
    updateCount: number;
    lastUpdateTime: number;
}

/**
 * Timer coordinator that manages timer lifecycle and coordination
 * Provides centralized timer management with pause/resume orchestration
 */
export class TimerCoordinator implements ITimerCoordinator {
    private timers = new Map<string, TimerState>();
    private globallyPaused = false;
    private updateCount = 0;
    private totalUpdateDuration = 0;

    /**
     * Creates a new TimerCoordinator instance
     */
    constructor() {
        logger.debug('TimerCoordinator: Initialized');
    }

    /**
     * Adds a timer to the coordinator
     * @param id - Unique identifier for the timer
     * @param timer - The timer instance to add
     */
    addTimer(id: string, timer: Timer): void {
        if (this.timers.has(id)) {
            logger.warn(`TimerCoordinator: Timer with ID '${id}' already exists, replacing`);
        }

        const timerState: TimerState = {
            timer,
            isActive: true,
            isPaused: this.globallyPaused,
            totalUpdateTime: 0,
            updateCount: 0,
            lastUpdateTime: 0
        };

        this.timers.set(id, timerState);
        
        logger.debug(`TimerCoordinator: Added timer '${id}' (${this.timers.size} total)`);
    }

    /**
     * Removes a timer from the coordinator
     * @param id - ID of the timer to remove
     * @returns Whether the timer was successfully removed
     */
    removeTimer(id: string): boolean {
        const timerState = this.timers.get(id);
        if (!timerState) {
            logger.warn(`TimerCoordinator: Attempted to remove non-existent timer '${id}'`);
            return false;
        }

        // Clean up timer if it has a destroy method
        if ('destroy' in timerState.timer && typeof (timerState.timer as unknown as Record<string, unknown>).destroy === 'function') {
            try {
                ((timerState.timer as unknown as Record<string, unknown>).destroy as () => void)();
            } catch (error) {
                logger.error(`TimerCoordinator: Error destroying timer '${id}': ${error}`);
            }
        }

        this.timers.delete(id);
        
        logger.debug(`TimerCoordinator: Removed timer '${id}' (${this.timers.size} remaining)`);
        return true;
    }

    /**
     * Gets a timer by its ID
     * @param id - ID of the timer to retrieve
     * @returns The timer instance or undefined if not found
     */
    getTimer(id: string): Timer | undefined {
        const timerState = this.timers.get(id);
        return timerState?.timer;
    }

    /**
     * Pauses all timers managed by this coordinator
     */
    pauseAllTimers(): void {
        this.globallyPaused = true;
        
        let pausedCount = 0;
        for (const [id, timerState] of this.timers) {
            if (timerState.isActive && !timerState.isPaused) {
                timerState.isPaused = true;
                
                // Use Timer's toggle method if timer is running
                try {
                    if (timerState.timer.getIsRunning() && !timerState.timer.getIsPaused()) {
                        timerState.timer.toggle(); // This will pause the timer
                    }
                } catch (error) {
                    logger.error(`TimerCoordinator: Error pausing timer '${id}': ${error}`);
                }
                
                pausedCount++;
            }
        }

        logger.info(`TimerCoordinator: Paused ${pausedCount} timers`);
    }

    /**
     * Resumes all timers managed by this coordinator
     */
    resumeAllTimers(): void {
        this.globallyPaused = false;
        
        let resumedCount = 0;
        for (const [id, timerState] of this.timers) {
            if (timerState.isActive && timerState.isPaused) {
                timerState.isPaused = false;
                
                // Use Timer's toggle method if timer is paused
                try {
                    if (timerState.timer.getIsRunning() && timerState.timer.getIsPaused()) {
                        timerState.timer.toggle(); // This will resume the timer
                    }
                } catch (error) {
                    logger.error(`TimerCoordinator: Error resuming timer '${id}': ${error}`);
                }
                
                resumedCount++;
            }
        }

        logger.info(`TimerCoordinator: Resumed ${resumedCount} timers`);
    }

    /**
     * Updates timer states and checks for completed timers
     * Note: The Timer class manages its own updates internally
     * @param deltaTime - Time elapsed since last update (for performance tracking)
     */
    updateTimers(deltaTime: number): void {
        if (this.globallyPaused || deltaTime <= 0) {
            return;
        }

        const updateStartTime = performance.now();
        let checkedCount = 0;
        const completedTimers: string[] = [];

        for (const [id, timerState] of this.timers) {
            if (!timerState.isActive || timerState.isPaused) {
                continue;
            }

            try {
                const beforeCheck = performance.now();
                
                // Check timer status (Timer manages its own updates)
                const isRunning = timerState.timer.getIsRunning();
                
                const afterCheck = performance.now();
                const checkDuration = afterCheck - beforeCheck;
                
                // Track performance metrics
                timerState.totalUpdateTime += checkDuration;
                timerState.updateCount++;
                timerState.lastUpdateTime = afterCheck;
                
                checkedCount++;

                // Check if timer is completed
                if (!isRunning) {
                    timerState.isActive = false;
                    completedTimers.push(id);
                    logger.debug(`TimerCoordinator: Timer '${id}' completed`);
                }
            } catch (error) {
                logger.error(`TimerCoordinator: Error checking timer '${id}': ${error}`);
                // Deactivate problematic timer
                timerState.isActive = false;
                completedTimers.push(id);
            }
        }

        // Clean up completed timers
        for (const id of completedTimers) {
            this.removeTimer(id);
        }

        // Track global performance metrics
        const totalUpdateTime = performance.now() - updateStartTime;
        this.totalUpdateDuration += totalUpdateTime;
        this.updateCount++;

        if (checkedCount > 0) {
            logger.debug(`TimerCoordinator: Checked ${checkedCount} timers in ${totalUpdateTime.toFixed(2)}ms`);
        }
    }

    /**
     * Gets timer statistics
     * @returns Statistics about timer performance and state
     */
    getTimerStats(): TimerStats {
        let activeTimers = 0;
        let pausedTimers = 0;
        let completedTimers = 0;

        for (const timerState of this.timers.values()) {
            if (timerState.isActive) {
                if (timerState.isPaused) {
                    pausedTimers++;
                } else {
                    activeTimers++;
                }
            } else {
                completedTimers++;
            }
        }

        return {
            totalTimers: this.timers.size,
            activeTimers,
            pausedTimers,
            completedTimers,
            totalUpdateTime: this.totalUpdateDuration,
            averageUpdateTime: this.updateCount > 0 ? this.totalUpdateDuration / this.updateCount : 0
        };
    }

    /**
     * Clears all timers from the coordinator
     */
    clearAllTimers(): void {
        const timerCount = this.timers.size;
        
        for (const [id, timerState] of this.timers) {
            // Clean up timer if it has a destroy method
            if ('destroy' in timerState.timer && typeof (timerState.timer as unknown as Record<string, unknown>).destroy === 'function') {
                try {
                    ((timerState.timer as unknown as Record<string, unknown>).destroy as () => void)();
                } catch (error) {
                    logger.error(`TimerCoordinator: Error destroying timer '${id}': ${error}`);
                }
            }
        }

        this.timers.clear();
        this.globallyPaused = false;
        
        logger.info(`TimerCoordinator: Cleared ${timerCount} timers`);
    }

    /**
     * Gets the count of active timers
     * @returns Number of active timers
     */
    getActiveTimerCount(): number {
        let count = 0;
        for (const timerState of this.timers.values()) {
            if (timerState.isActive && !timerState.isPaused) {
                count++;
            }
        }
        return count;
    }

    /**
     * Gets the count of paused timers
     * @returns Number of paused timers
     */
    getPausedTimerCount(): number {
        let count = 0;
        for (const timerState of this.timers.values()) {
            if (timerState.isActive && timerState.isPaused) {
                count++;
            }
        }
        return count;
    }

    /**
     * Gets detailed information about all timers
     * @returns Array of timer information
     */
    getTimerDetails(): Array<{
        id: string;
        isActive: boolean;
        isPaused: boolean;
        averageUpdateTime: number;
        updateCount: number;
        progress?: number;
    }> {
        const details: Array<{
            id: string;
            isActive: boolean;
            isPaused: boolean;
            averageUpdateTime: number;
            updateCount: number;
            progress?: number;
        }> = [];

        for (const [id, timerState] of this.timers) {
            const averageUpdateTime = timerState.updateCount > 0 
                ? timerState.totalUpdateTime / timerState.updateCount 
                : 0;

            let progress: number | undefined;
            if ('getProgress' in timerState.timer && typeof (timerState.timer as unknown as Record<string, unknown>).getProgress === 'function') {
                try {
                    progress = ((timerState.timer as unknown as Record<string, unknown>).getProgress as () => number)();
                } catch (error) {
                    logger.debug(`TimerCoordinator: Could not get progress for timer '${id}': ${error}`);
                }
            }

            details.push({
                id,
                isActive: timerState.isActive,
                isPaused: timerState.isPaused,
                averageUpdateTime,
                updateCount: timerState.updateCount,
                progress
            });
        }

        return details;
    }

    /**
     * Destroys the timer coordinator and cleans up all resources
     */
    destroy(): void {
        this.clearAllTimers();
        
        // Reset performance metrics
        this.updateCount = 0;
        this.totalUpdateDuration = 0;
        
        logger.info('TimerCoordinator: Destroyed');
    }
}