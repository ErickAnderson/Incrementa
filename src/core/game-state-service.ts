import { SaveManager } from "./save-manager";
import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";
import { IGame } from "./game-aware";

/**
 * A serialized entity, produced by BaseEntity.getSaveData(). Carries the entity
 * id and type plus whatever per-type state each entity persists (resource
 * amounts, building level and construction state, upgrade applications, ...).
 */
export interface SerializedEntity {
    id: string;
    entityType?: string;
    isUnlocked?: boolean;
    [key: string]: unknown;
}

/**
 * The persisted game-state payload.
 */
export interface GameSaveData {
    entities: SerializedEntity[];
    gameSpeed: number;
    totalGameTime: number;
    plugins: Record<string, unknown>;
    metadata?: { version: string; timestamp: number; totalGameTime: number };
}

/**
 * Interface for the game state service
 */
export interface IGameStateService {
    saveState(data: GameSaveData): void;
    loadState(game?: IGame): GameSaveData | null;
    calculateOfflineProgress(resources: Array<{ id: string; isUnlocked: boolean; rate?: number }>): { offlineTime: number; resourceGains: Record<string, number> } | null;
    getTotalGameTime(): number;
    setTotalGameTime(time: number): void;
    resetGameTime(): void;
    getGameStats(): GameStateStats;
}

/**
 * Game state statistics
 */
export interface GameStateStats {
    totalGameTime: number;
    lastSaveTime: number;
    lastLoadTime: number;
    saveCount: number;
    loadCount: number;
    offlineProgressCalculations: number;
}

/**
 * Game state service that manages save/load operations and offline progress
 * Handles state serialization/deserialization and time tracking
 */
export class GameStateService implements IGameStateService {
    private saveManager: SaveManager;
    private totalGameTime = 0;
    private lastSaveTime = 0;
    private lastLoadTime = 0;
    private saveCount = 0;
    private loadCount = 0;
    private offlineProgressCalculations = 0;

    /**
     * Creates a new GameStateService instance
     * @param saveManager - The save manager to use for persistence
     */
    constructor(saveManager: SaveManager) {
        this.saveManager = saveManager;
        this.lastLoadTime = Date.now();
    }

    /**
     * Saves the current game state to persistent storage
     * @param data - The game state data to save
     */
    saveState(data: GameSaveData): void {
        try {
            logger.info('GameStateService: Starting game state save');

            // Entities arrive already serialized via getSaveData(), so the full
            // per-entity state (resource amounts, building level and
            // construction state, upgrade applications) is persisted - not just
            // id and isUnlocked.
            const gameState: GameSaveData = {
                metadata: {
                    version: '1.0.0',
                    timestamp: Date.now(),
                    totalGameTime: data.totalGameTime ?? this.totalGameTime
                },
                entities: data.entities || [],
                gameSpeed: data.gameSpeed ?? 1.0,
                totalGameTime: data.totalGameTime ?? this.totalGameTime,
                plugins: data.plugins ?? {}
            };

            // Save to persistent storage
            this.saveManager.saveData('gameState', JSON.stringify(gameState));
            this.saveManager.saveData('metadata', JSON.stringify({
                lastSave: Date.now(),
                gameTime: this.totalGameTime,
                version: '1.0.0'
            }));

            this.lastSaveTime = Date.now();
            this.saveCount++;

            logger.info(`GameStateService: Game state saved successfully (${gameState.entities.length} entities, ${this.totalGameTime}ms game time)`);
        } catch (error) {
            logger.error(`GameStateService: Failed to save game state: ${error}`);
            throw new Error(`Save operation failed: ${error}`);
        }
    }

    /**
     * Loads game state from persistent storage
     * @param game - The game instance to load into
     */
    loadState(game?: IGame): GameSaveData | null {
        try {
            logger.info('GameStateService: Starting game state load');

            const gameStateData = this.saveManager.loadData('gameState');
            if (!gameStateData) {
                logger.warn('GameStateService: No saved game state found, starting fresh');
                return null;
            }

            const gameState = JSON.parse(gameStateData);
            if (!game) {
                return gameState;
            }

            // Validate game state structure
            if (!this.validateGameState(gameState)) {
                throw new Error('Invalid game state format');
            }

            // Load metadata
            if (gameState.metadata) {
                this.totalGameTime = ((gameState.metadata as Record<string, unknown>).totalGameTime as number) || 0;
                logger.debug(`GameStateService: Loaded game time: ${this.totalGameTime}ms`);
            }

            // Load entities
            if (gameState.entities && Array.isArray(gameState.entities)) {
                this.loadEntities(game, gameState.entities);
            }

            // Load settings
            if (gameState.settings) {
                this.loadGameSettings(game, gameState.settings as Record<string, unknown>);
            }

            this.lastLoadTime = Date.now();
            this.loadCount++;

            logger.info(`GameStateService: Game state loaded successfully (${(gameState.entities as unknown[])?.length || 0} entities)`);
            return gameState as unknown as GameSaveData;
        } catch (error) {
            logger.error(`GameStateService: Failed to load game state: ${error}`);
            throw new Error(`Load operation failed: ${error}`);
        }
    }

    /**
     * Calculates offline progress for resources based on time since last save
     * @param resources - Array of resources to calculate offline progress for
     * @returns Offline progress data or null if no progress to apply
     */
    calculateOfflineProgress(resources: Array<{ id: string; isUnlocked: boolean; rate?: number }>): { offlineTime: number; resourceGains: Record<string, number> } | null {
        try {
            const metadataData = this.saveManager.loadData('metadata');
            if (!metadataData) {
                logger.debug('GameStateService: No metadata found for offline progress calculation');
                return null;
            }

            const metadata = JSON.parse(metadataData);
            if (!metadata || !metadata.lastSave) {
                logger.debug('GameStateService: No lastSave timestamp found for offline progress calculation');
                return null;
            }

            const now = Date.now();
            const timeSinceLastSave = now - metadata.lastSave;
            const offlineTimeSeconds = timeSinceLastSave / 1000;

            if (offlineTimeSeconds < 10) {
                logger.debug('GameStateService: Offline time too short, skipping progress calculation');
                return null;
            }

            logger.info(`GameStateService: Calculating offline progress for ${Math.floor(offlineTimeSeconds)} seconds`);

            // Calculate offline resource gains
            const resourceGains: Record<string, number> = {};
            for (const resource of resources) {
                if (resource.isUnlocked && resource.rate && resource.rate > 0) {
                    const gain = resource.rate * offlineTimeSeconds;
                    resourceGains[resource.id] = gain;
                }
            }

            // Update total game time
            this.totalGameTime += timeSinceLastSave;
            this.offlineProgressCalculations++;

            logger.info(`GameStateService: Offline progress calculated - ${Object.keys(resourceGains).length} resources with gains`);
            
            return {
                offlineTime: offlineTimeSeconds,
                resourceGains
            };
        } catch (error) {
            logger.error(`GameStateService: Failed to calculate offline progress: ${error}`);
            return null;
        }
    }

    /**
     * Gets the total game time in milliseconds
     * @returns Total game time
     */
    getTotalGameTime(): number {
        return this.totalGameTime;
    }

    /**
     * Sets the total game time
     * @param time - Time in milliseconds
     */
    setTotalGameTime(time: number): void {
        if (time < 0) {
            logger.warn('GameStateService: Attempted to set negative game time, ignoring');
            return;
        }
        
        this.totalGameTime = time;
        logger.debug(`GameStateService: Game time set to ${time}ms`);
    }

    /**
     * Resets the total game time to zero
     */
    resetGameTime(): void {
        this.totalGameTime = 0;
        logger.info('GameStateService: Game time reset to zero');
    }

    /**
     * Gets game state statistics
     * @returns Statistics object
     */
    getGameStats(): GameStateStats {
        return {
            totalGameTime: this.totalGameTime,
            lastSaveTime: this.lastSaveTime,
            lastLoadTime: this.lastLoadTime,
            saveCount: this.saveCount,
            loadCount: this.loadCount,
            offlineProgressCalculations: this.offlineProgressCalculations
        };
    }

    /**
     * Validates the structure of a game state object
     * @param gameState - The game state to validate
     * @returns Whether the game state is valid
     */
    private validateGameState(gameState: unknown): gameState is Record<string, unknown> {
        if (!gameState || typeof gameState !== 'object') {
            return false;
        }

        const state = gameState as Record<string, unknown>;
        
        // Check for required properties
        if (!state.metadata || typeof state.metadata !== 'object') {
            logger.warn('GameStateService: Game state missing metadata');
            return false;
        }

        if (!Array.isArray(state.entities)) {
            logger.warn('GameStateService: Game state entities is not an array');
            return false;
        }

        return true;
    }

    /**
     * Loads entities from saved state
     * @param game - The game instance
     * @param entitiesData - Array of entity data
     */
    private loadEntities(game: IGame, entitiesData: unknown[]): void {
        let loadedCount = 0;

        for (const entityData of entitiesData) {
            try {
                if (this.loadEntity(game, entityData)) {
                    loadedCount++;
                }
            } catch (error) {
                logger.error(`GameStateService: Failed to load entity: ${error}`);
            }
        }

        logger.debug(`GameStateService: Loaded ${loadedCount}/${entitiesData.length} entities`);
    }

    /**
     * Loads a single entity from saved data
     * @param game - The game instance
     * @param entityData - The entity data to load
     * @returns Whether the entity was loaded successfully
     */
    private loadEntity(game: IGame, entityData: unknown): boolean {
        if (!entityData || typeof entityData !== 'object') {
            return false;
        }

        const data = entityData as Record<string, unknown>;
        
        if (typeof data.id !== 'string' || typeof data.type !== 'string') {
            return false;
        }

        // Try to find and update existing entity
        if ('getEntityById' in game && typeof (game as unknown as Record<string, unknown>).getEntityById === 'function') {
            const getEntityById = (game as unknown as Record<string, unknown>).getEntityById as (id: string) => BaseEntity | undefined;
            const entity = getEntityById(data.id);
            
            if (entity && 'deserialize' in entity && typeof (entity as unknown as Record<string, unknown>).deserialize === 'function') {
                ((entity as unknown as Record<string, unknown>).deserialize as (data: Record<string, unknown>) => void)(data.data as Record<string, unknown> || {});
                return true;
            }
        }

        return false;
    }

    /**
     * Loads game settings from saved state
     * @param game - The game instance
     * @param settings - Settings to load
     */
    private loadGameSettings(game: IGame, settings: Record<string, unknown>): void {
        if (typeof settings.gameSpeed === 'number' && 'setSpeed' in game && typeof (game as unknown as Record<string, unknown>).setSpeed === 'function') {
            ((game as unknown as Record<string, unknown>).setSpeed as (speed: number) => void)(settings.gameSpeed);
        }
    }
}