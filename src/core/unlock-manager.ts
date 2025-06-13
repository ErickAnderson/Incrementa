import { BaseEntity } from "./base-entity";
import { logger } from "../utils/logger";

/**
 * Interface for unlock condition registrations
 */
interface UnlockConditionEntry {
    entity: BaseEntity;
    condition: () => boolean;
    isChecked: boolean;
}

/**
 * Centralized manager for handling entity unlock conditions and events
 */
export class UnlockManager {
    /** Registered unlock conditions */
    private unlockConditions: Map<string, UnlockConditionEntry>;
    
    /** Entities that have been unlocked */
    private unlockedEntities: Set<string>;
    
    /** Callbacks to execute when entities are unlocked */
    private unlockListeners: Array<(entity: BaseEntity) => void>;
    
    /** Whether the manager is actively checking conditions */
    private isActive: boolean;

    constructor() {
        this.unlockConditions = new Map();
        this.unlockedEntities = new Set();
        this.unlockListeners = [];
        this.isActive = true;
    }

    /**
     * Registers an unlock condition for an entity
     * @param entity - The entity to register unlock condition for
     * @param condition - Function that returns true when entity should be unlocked
     */
    registerUnlockCondition(entity: BaseEntity, condition: () => boolean): void {
        if (entity.isUnlocked) {
            logger.warn(`Entity ${entity.name} (${entity.id}) is already unlocked`);
            return;
        }

        this.unlockConditions.set(entity.id, {
            entity,
            condition,
            isChecked: false
        });

        logger.info(`Unlock condition registered for entity ${entity.name} (${entity.id})`);
    }

    /**
     * Removes an unlock condition for an entity
     * @param entityId - ID of the entity to remove unlock condition for
     * @returns Whether the condition was successfully removed
     */
    removeUnlockCondition(entityId: string): boolean {
        const removed = this.unlockConditions.delete(entityId);
        if (removed) {
            logger.info(`Unlock condition removed for entity ${entityId}`);
        }
        return removed;
    }

    /**
     * Manually unlocks an entity (bypasses condition check)
     * @param entityId - ID of the entity to unlock
     * @returns Whether the entity was successfully unlocked
     */
    unlockEntity(entityId: string): boolean {
        const conditionEntry = this.unlockConditions.get(entityId);
        if (!conditionEntry) {
            logger.warn(`No unlock condition found for entity ${entityId}`);
            return false;
        }

        return this.performUnlock(conditionEntry, true);
    }

    /**
     * Checks all registered unlock conditions and unlocks entities whose conditions are met
     */
    checkUnlockConditions(): void {
        if (!this.isActive) return;

        for (const [entityId, entry] of this.unlockConditions.entries()) {
            if (entry.isChecked || entry.entity.isUnlocked) {
                continue;
            }

            try {
                if (entry.condition()) {
                    this.performUnlock(entry);
                }
            } catch (error) {
                logger.error(`Error checking unlock condition for ${entityId}: ${error}`);
                // Mark as checked to prevent repeated errors
                entry.isChecked = true;
            }
        }
    }

    /**
     * Performs the actual unlock operation for an entity
     * @private
     * @param entry - The unlock condition entry
     * @returns Whether the unlock was successful
     */
    private performUnlock(entry: UnlockConditionEntry, force: boolean = false): boolean {
        try {
            // Mark entity as unlocked
            if (force) {
                // For manual unlock, directly set the unlocked state bypassing conditions
                entry.entity.isUnlocked = true;
                entry.entity.onUnlock();
                entry.entity.emit('unlocked', { entity: entry.entity });
            } else {
                const unlockResult = entry.entity.unlock();
                if (!unlockResult) {
                    return false;
                }
            }
            
            // Add to unlocked set
            this.unlockedEntities.add(entry.entity.id);
            
            // Remove from conditions to check
            this.unlockConditions.delete(entry.entity.id);
            
            // Notify listeners
            this.notifyUnlockListeners(entry.entity);
            
            logger.info(`Entity ${entry.entity.name} (${entry.entity.id}) unlocked`);
            return true;
        } catch (error) {
            logger.error(`Error unlocking entity ${entry.entity.id}: ${error}`);
            return false;
        }
    }

    /**
     * Gets all entities that have been unlocked
     * @returns Array of unlocked entities
     */
    getUnlockedEntities(): BaseEntity[] {
        const unlockedEntities: BaseEntity[] = [];
        
        // Note: This requires access to entity registry from Game class
        // In practice, this would be injected or entities would be tracked here
        if (this.unlockedEntities.size > 0) {
            logger.warn('getUnlockedEntities requires entity registry access');
        }
        
        return unlockedEntities;
    }

    /**
     * Gets the IDs of all unlocked entities
     * @returns Array of unlocked entity IDs
     */
    getUnlockedEntityIds(): string[] {
        return Array.from(this.unlockedEntities);
    }

    /**
     * Checks if a specific entity is unlocked
     * @param entityId - ID of the entity to check
     * @returns Whether the entity is unlocked
     */
    isEntityUnlocked(entityId: string): boolean {
        return this.unlockedEntities.has(entityId);
    }

    /**
     * Gets the count of entities pending unlock
     * @returns Number of entities with unlock conditions that haven't been unlocked
     */
    getPendingUnlockCount(): number {
        return this.unlockConditions.size;
    }

    /**
     * Gets the count of unlocked entities
     * @returns Number of entities that have been unlocked
     */
    getUnlockedCount(): number {
        return this.unlockedEntities.size;
    }

    /**
     * Adds a listener for unlock events
     * @param callback - Function to call when any entity is unlocked
     */
    addUnlockListener(callback: (entity: BaseEntity) => void): void {
        if (typeof callback !== 'function') {
            throw new Error('Unlock listener must be a function');
        }
        this.unlockListeners.push(callback);
        logger.info('Unlock listener added');
    }

    /**
     * Removes a specific unlock listener
     * @param callback - The listener function to remove
     * @returns Whether the listener was successfully removed
     */
    removeUnlockListener(callback: (entity: BaseEntity) => void): boolean {
        const index = this.unlockListeners.indexOf(callback);
        if (index > -1) {
            this.unlockListeners.splice(index, 1);
            logger.info('Unlock listener removed');
            return true;
        }
        return false;
    }

    /**
     * Removes all unlock listeners
     */
    clearUnlockListeners(): void {
        this.unlockListeners = [];
        logger.info('All unlock listeners cleared');
    }

    /**
     * Notifies all unlock listeners about an entity unlock
     * @private
     * @param entity - The entity that was unlocked
     */
    private notifyUnlockListeners(entity: BaseEntity): void {
        for (const listener of this.unlockListeners) {
            try {
                listener(entity);
            } catch (error) {
                logger.error(`Error in unlock listener: ${error}`);
            }
        }
    }

    /**
     * Pauses unlock condition checking
     */
    pause(): void {
        this.isActive = false;
        logger.info('UnlockManager paused');
    }

    /**
     * Resumes unlock condition checking
     */
    resume(): void {
        this.isActive = true;
        logger.info('UnlockManager resumed');
    }

    /**
     * Gets statistics about the unlock manager
     * @returns Object containing unlock statistics
     */
    getStats() {
        return {
            pendingUnlocks: this.unlockConditions.size,
            unlockedCount: this.unlockedEntities.size,
            listenersCount: this.unlockListeners.length,
            isActive: this.isActive
        };
    }

    /**
     * Clears all unlock conditions and resets the manager
     */
    reset(): void {
        this.unlockConditions.clear();
        this.unlockedEntities.clear();
        this.clearUnlockListeners();
        this.isActive = true;
        logger.info('UnlockManager reset');
    }

    /**
     * Cleans up resources and stops the manager
     */
    destroy(): void {
        this.reset();
        this.isActive = false;
        logger.info('UnlockManager destroyed');
    }
}