/**
 * Application-wide constants to avoid magic numbers
 */

/** Game loop and timing constants */
export const GAME_CONSTANTS = {
    /** Default tick rate for game loop in milliseconds (~60 FPS) */
    DEFAULT_TICK_RATE: 16,
    
    /** Target frames per second for game loop */
    TARGET_FPS: 60,
    
    /** Milliseconds per second conversion factor */
    MS_PER_SECOND: 1000,
} as const;

/** Logging and debug constants */
export const LOG_CONSTANTS = {
    /** Interval for periodic logging in milliseconds (5 seconds) */
    PERIODIC_LOG_INTERVAL: 5000,
    
    /** Batch size for log flushing */
    LOG_BATCH_SIZE: 100,
} as const;

/** Resource and production constants */
export const RESOURCE_CONSTANTS = {
    /** Default scaling factor for building costs */
    DEFAULT_COST_SCALING: 1.2,
    
    /** Default build time in seconds */
    DEFAULT_BUILD_TIME: 0,
    
    /** Default production rate */
    DEFAULT_PRODUCTION_RATE: 1,
} as const;

/** Entity and building constants */
export const ENTITY_CONSTANTS = {
    /** Default level for new entities */
    DEFAULT_LEVEL: 1,
    
    /** Default gathering interval for workers in milliseconds */
    DEFAULT_WORKER_INTERVAL: 1000,
} as const;