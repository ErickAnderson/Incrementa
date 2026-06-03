import { Timer } from './timer';
import { logger } from '../utils/logger';

/**
 * Interface for the timer service
 */
export interface ITimerService {
    // Timer management
    addTimer(id: string, timer: Timer): void;
    removeTimer(id: string): boolean;
    getTimer(id: string): Timer | undefined;
    
    // Lifecycle control
    pauseAllTimers(): void;
    resumeAllTimers(): void;
    
    // Statistics and monitoring
    getActiveTimerCount(): number;
    getPausedTimerCount(): number;
    getTimerStats(): {
        totalTimers: number;
        activeTimers: number;
        pausedTimers: number;
        completedTimers: number;
        totalUpdateTime: number;
        averageUpdateTime: number;
    };
    
    // Updates
    updateTimers(deltaTime: number): void;
    
    // Cleanup
    clearAllTimers(): void;
    destroy(): void;
}

/**
 * Service responsible for managing all game timers
 * Extracted from Game class to reduce god class anti-pattern
 */
export class TimerService implements ITimerService {
    private timers = new Map<string, Timer>();
    private pausedTimers = new Set<string>();
    private completedTimers = new Set<string>();
    private updateStats = {
        totalUpdateTime: 0,
        updateCount: 0
    };

    constructor() {
        logger.debug('TimerService: Initialized');
    }

    /**
     * Adds a timer to the service for specific mechanics
     */
    addTimer(id: string, timer: Timer): void {
        if (this.timers.has(id)) {
            logger.warn(`TimerService: Timer with id '${id}' already exists. Replacing.`);
        }
        
        this.timers.set(id, timer);
        logger.info(`TimerService: Timer '${id}' added (${this.timers.size} total)`);
    }

    /**
     * Removes a timer from the service
     */
    removeTimer(id: string): boolean {
        const timer = this.timers.get(id);
        if (timer) {
            timer.stop();
            this.timers.delete(id);
            this.pausedTimers.delete(id);
            this.completedTimers.delete(id);
            logger.info(`TimerService: Timer '${id}' removed (${this.timers.size} remaining)`);
            return true;
        }
        return false;
    }

    /**
     * Gets a timer by its ID
     */
    getTimer(id: string): Timer | undefined {
        return this.timers.get(id);
    }

    /**
     * Pauses all timers in the service
     */
    pauseAllTimers(): void {
        for (const [id, timer] of this.timers) {
            if (timer.getIsRunning() && !timer.getIsPaused()) {
                timer.toggle();
                this.pausedTimers.add(id);
            }
        }
        logger.info(`TimerService: All timers paused (${this.pausedTimers.size} timers)`);
    }

    /**
     * Resumes all paused timers in the service
     */
    resumeAllTimers(): void {
        for (const id of this.pausedTimers) {
            const timer = this.timers.get(id);
            if (timer && timer.getIsRunning() && timer.getIsPaused()) {
                timer.toggle();
            }
        }
        const resumedCount = this.pausedTimers.size;
        this.pausedTimers.clear();
        logger.info(`TimerService: All timers resumed (${resumedCount} timers)`);
    }

    /**
     * Updates all active timers (called by game loop)
     */
    updateTimers(deltaTime: number): void {
        if (deltaTime <= 0) return;

        const startTime = performance.now();
        const completedThisUpdate: string[] = [];

        for (const [id, timer] of this.timers) {
            try {
                if (timer.getIsRunning()) {
                    // Timer is still running, continue
                } else {
                    // Timer has completed, mark for removal
                    completedThisUpdate.push(id);
                    this.completedTimers.add(id);
                }
            } catch (error) {
                logger.error(`TimerService: Error checking timer '${id}': ${error}`);
                completedThisUpdate.push(id); // Remove problematic timers
            }
        }

        // Remove completed timers
        for (const id of completedThisUpdate) {
            this.removeTimer(id);
        }

        // Update performance stats
        const updateTime = performance.now() - startTime;
        this.updateStats.totalUpdateTime += updateTime;
        this.updateStats.updateCount++;
    }

    /**
     * Gets the number of active (running) timers
     */
    getActiveTimerCount(): number {
        let activeCount = 0;
        for (const timer of this.timers.values()) {
            if (timer.getIsRunning() && !timer.getIsPaused()) {
                activeCount++;
            }
        }
        return activeCount;
    }

    /**
     * Gets the number of paused timers
     */
    getPausedTimerCount(): number {
        return this.pausedTimers.size;
    }

    /**
     * Gets comprehensive timer statistics
     */
    getTimerStats(): {
        totalTimers: number;
        activeTimers: number;
        pausedTimers: number;
        completedTimers: number;
        totalUpdateTime: number;
        averageUpdateTime: number;
    } {
        return {
            totalTimers: this.timers.size,
            activeTimers: this.getActiveTimerCount(),
            pausedTimers: this.getPausedTimerCount(),
            completedTimers: this.completedTimers.size,
            totalUpdateTime: this.updateStats.totalUpdateTime,
            averageUpdateTime: this.updateStats.updateCount > 0 
                ? this.updateStats.totalUpdateTime / this.updateStats.updateCount 
                : 0
        };
    }

    /**
     * Gets detailed information about each timer
     */
    getTimerDetails(): Array<{
        id: string;
        isActive: boolean;
        isPaused: boolean;
        averageUpdateTime: number;
        updateCount: number;
    }> {
        const details: Array<{
            id: string;
            isActive: boolean;
            isPaused: boolean;
            averageUpdateTime: number;
            updateCount: number;
        }> = [];

        for (const [id, timer] of this.timers) {
            details.push({
                id,
                isActive: timer.getIsRunning() && !timer.getIsPaused(),
                isPaused: timer.getIsPaused(),
                averageUpdateTime: 0, // Timer class doesn't expose this
                updateCount: 0 // Timer class doesn't expose this
            });
        }

        return details;
    }

    /**
     * Clears all timers from the service
     */
    clearAllTimers(): void {
        for (const timer of this.timers.values()) {
            timer.stop();
        }
        
        const clearedCount = this.timers.size;
        this.timers.clear();
        this.pausedTimers.clear();
        this.completedTimers.clear();
        
        logger.info(`TimerService: Cleared ${clearedCount} timers`);
    }

    /**
     * Performs maintenance operations
     */
    performMaintenance(): void {
        // Clean up completed timers from tracking
        this.completedTimers.clear();
        
        // Remove any orphaned paused timer references
        for (const id of this.pausedTimers) {
            if (!this.timers.has(id)) {
                this.pausedTimers.delete(id);
            }
        }
    }

    /**
     * Cleanup method to stop all timers and release resources
     */
    destroy(): void {
        this.clearAllTimers();
        this.updateStats = { totalUpdateTime: 0, updateCount: 0 };
        logger.info('TimerService: Destroyed and resources cleaned up');
    }
}