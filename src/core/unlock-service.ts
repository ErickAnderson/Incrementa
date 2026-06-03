import { UnlockManager } from './unlock-manager';
import { BaseEntity } from './base-entity';
import { logger } from '../utils/logger';

/**
 * Interface for the unlock service
 */
export interface IUnlockService {
    // Unlock management
    checkUnlockConditions(): void;
    unlockEntity(entityId: string): boolean;
    
    // Statistics and monitoring
    getUnlockStats(): any;
    
    // Manager access
    getUnlockManager(): UnlockManager;
    
    // Lifecycle control
    pause(): void;
    resume(): void;
    checkConditions(): void;
    
    // Cleanup
    destroy(): void;
}

/**
 * Service responsible for managing entity unlock conditions
 * Extracted from Game class to reduce god class anti-pattern
 */
export class UnlockService implements IUnlockService {
    private unlockManager: UnlockManager;

    constructor(private game: any) {
        this.unlockManager = new UnlockManager(game);
        logger.debug('UnlockService: Initialized');
    }

    /**
     * Manually checks all unlock conditions
     * This is automatically called during game updates, but can be called manually for testing
     */
    checkUnlockConditions(): void {
        this.unlockManager.checkUnlockConditions();
    }

    /**
     * Manually unlocks an entity (bypasses condition check)
     */
    unlockEntity(entityId: string): boolean {
        // First try the unlock manager (for entities with conditions)
        const unlockManagerResult = this.unlockManager.unlockEntity(entityId);
        if (unlockManagerResult) {
            return true;
        }

        // If that fails, try to find and unlock the entity directly
        const entity = this.game.getEntityById?.(entityId);
        if (entity && !entity.isUnlocked) {
            // For manual unlock, directly set the unlocked state bypassing conditions
            entity.isUnlocked = true;
            entity.onUnlock();
            entity.emit('unlocked', { entity });
            logger.info(`UnlockService: Entity ${entity.name} (${entity.id}) manually unlocked`);
            return true;
        }

        return false;
    }

    /**
     * Gets unlock statistics from the unlock manager
     */
    getUnlockStats(): any {
        return this.unlockManager.getStats();
    }

    /**
     * Gets the underlying unlock manager instance
     */
    getUnlockManager(): UnlockManager {
        return this.unlockManager;
    }

    /**
     * Pauses unlock condition checking
     */
    pause(): void {
        this.unlockManager.pause();
        logger.info('UnlockService: Unlock checking paused');
    }

    /**
     * Resumes unlock condition checking
     */
    resume(): void {
        this.unlockManager.resume();
        logger.info('UnlockService: Unlock checking resumed');
    }

    /**
     * Registers an unlock condition for an entity
     */
    registerUnlockCondition(entity: BaseEntity, condition: () => boolean): void {
        this.unlockManager.registerUnlockCondition(entity, condition);
        logger.debug(`UnlockService: Registered unlock condition for '${entity.name}' (${entity.id})`);
    }

    /**
     * Removes an unlock condition for an entity
     */
    removeUnlockCondition(entityId: string): void {
        this.unlockManager.removeUnlockCondition(entityId);
        logger.debug(`UnlockService: Removed unlock condition for entity '${entityId}'`);
    }

    /**
     * Checks unlock conditions for specific entities (performance optimization)
     */
    checkConditions(): void {
        this.unlockManager.checkConditions();
    }

    /**
     * Gets detailed unlock statistics for monitoring
     */
    getDetailedStats(): {
        unlockStats: any;
        totalEntities: number;
        unlockedEntities: number;
        pendingUnlocks: number;
    } {
        const unlockStats = this.getUnlockStats();
        
        return {
            unlockStats,
            totalEntities: 0, // Would need entity service integration
            unlockedEntities: 0, // Would need entity service integration
            pendingUnlocks: 0 // UnlockManager doesn't expose this easily
        };
    }

    /**
     * Cleanup method to destroy the unlock manager and release resources
     */
    destroy(): void {
        this.unlockManager.destroy();
        logger.info('UnlockService: Destroyed and resources cleaned up');
    }
}