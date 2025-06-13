import { BaseEntity } from "./base-entity";
import { UnlockConditionEvaluator } from "./unlock-condition-evaluator";
import { logger } from "../utils/logger";
import type {
  UnlockConditionDefinition,
  ComplexUnlockCondition,
  UnlockConditionResult,
  UnlockTemplate,
  UnlockMilestone,
  UnlockEventType,
  UnlockEvent,
  UnlockManagerStats
} from "../types/unlock-conditions";
import type { Game } from "./game";

/**
 * Interface for unlock condition registrations
 */
interface UnlockConditionEntry {
    entity: BaseEntity;
    condition?: () => boolean; // Legacy function-based condition
    complexCondition?: ComplexUnlockCondition; // New data-driven condition
    isChecked: boolean;
    lastEvaluationTime?: number;
    evaluationResult?: UnlockConditionResult;
}

/**
 * Enhanced centralized manager for handling entity unlock conditions and events
 * Supports both legacy function-based conditions and new data-driven conditions
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
    
    /** Data-driven condition evaluator */
    private conditionEvaluator?: UnlockConditionEvaluator;
    
    /** Game reference for advanced condition evaluation */
    private game?: Game;
    
    /** Event listeners for unlock events */
    private eventListeners: Map<UnlockEventType, Function[]> = new Map();
    
    /** Registered templates for reusable conditions */
    private templates: Map<string, UnlockTemplate> = new Map();
    
    /** Tracked milestones */
    private milestones: Map<string, UnlockMilestone> = new Map();

    constructor(game?: Game) {
        this.unlockConditions = new Map();
        this.unlockedEntities = new Set();
        this.unlockListeners = [];
        this.isActive = true;
        this.game = game;
        
        if (game) {
            this.conditionEvaluator = new UnlockConditionEvaluator(game);
        }
    }

    /**
     * Registers a legacy function-based unlock condition for an entity
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

        logger.info(`Legacy unlock condition registered for entity ${entity.name} (${entity.id})`);
    }
    
    /**
     * Registers a data-driven unlock condition for an entity
     * @param entity - The entity to register unlock condition for
     * @param condition - Complex unlock condition definition
     */
    registerComplexUnlockCondition(entity: BaseEntity, condition: ComplexUnlockCondition): void {
        if (entity.isUnlocked) {
            logger.warn(`Entity ${entity.name} (${entity.id}) is already unlocked`);
            return;
        }
        
        if (!this.conditionEvaluator) {
            logger.error('Cannot register complex condition: no condition evaluator available');
            return;
        }

        this.unlockConditions.set(entity.id, {
            entity,
            complexCondition: condition,
            isChecked: false
        });

        logger.info(`Complex unlock condition registered for entity ${entity.name} (${entity.id})`);
    }
    
    /**
     * Registers a simple unlock condition using data structures
     * @param entity - The entity to register unlock condition for
     * @param condition - Simple unlock condition definition
     */
    registerSimpleCondition(entity: BaseEntity, condition: UnlockConditionDefinition): void {
        const complexCondition: ComplexUnlockCondition = {
            condition,
            canReEvaluate: true
        };
        
        this.registerComplexUnlockCondition(entity, complexCondition);
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
                let conditionMet = false;
                
                // Handle legacy function-based conditions
                if (entry.condition) {
                    conditionMet = entry.condition();
                }
                // Handle new data-driven conditions
                else if (entry.complexCondition && this.conditionEvaluator && this.game) {
                    const context = {
                        game: this.game,
                        entity: entry.entity,
                        timestamp: Date.now()
                    };
                    
                    const result = this.conditionEvaluator.evaluateComplexCondition(
                        entry.complexCondition,
                        context
                    );
                    
                    entry.evaluationResult = result;
                    entry.lastEvaluationTime = Date.now();
                    conditionMet = result.isMet;
                    
                    // Emit evaluation event
                    this._emitEvent('conditionEvaluated', {
                        entityId,
                        condition: entry.complexCondition.condition,
                        result
                    });
                }
                
                if (conditionMet) {
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
                // For complex conditions, we've already evaluated the condition in the manager
                // so we can directly unlock the entity
                if (entry.complexCondition) {
                    entry.entity.isUnlocked = true;
                    entry.entity.onUnlock();
                    entry.entity.emit('unlocked', { entity: entry.entity });
                } else {
                    // For legacy function-based conditions, we've already evaluated the condition in the manager
                    // so we can directly unlock the entity (similar to complex conditions)
                    entry.entity.isUnlocked = true;
                    entry.entity.onUnlock();
                    entry.entity.emit('unlocked', { entity: entry.entity });
                }
            }
            
            // Add to unlocked set
            this.unlockedEntities.add(entry.entity.id);
            
            // Remove from conditions to check
            this.unlockConditions.delete(entry.entity.id);
            
            // Notify listeners
            this.notifyUnlockListeners(entry.entity);
            
            // Emit unlock event
            this._emitEvent('entityUnlocked', {
                entity: entry.entity,
                entityId: entry.entity.id,
                entityName: entry.entity.name
            });
            
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
     * Gets comprehensive statistics about the unlock manager
     * @returns Object containing unlock statistics
     */
    getStats(): UnlockManagerStats {
        const baseStats = {
            totalConditions: this.unlockConditions.size,
            conditionsMet: this.unlockedEntities.size,
            entitiesUnlocked: this.unlockedEntities.size,
            milestonesAchieved: Array.from(this.milestones.values()).filter(m => m.isAchieved).length,
            commonConditionTypes: this.getCommonConditionTypes(),
            averageUnlockTime: this.calculateAverageUnlockTime(),
            totalEvaluationTime: 0
        };
        
        // Add evaluator stats if available
        if (this.conditionEvaluator) {
            const evaluatorStats = this.conditionEvaluator.getStats();
            return {
                ...baseStats,
                totalEvaluationTime: evaluatorStats.totalEvaluationTime
            };
        }
        
        return baseStats;
    }
    
    /**
     * Register a reusable unlock condition template
     */
    registerTemplate(template: UnlockTemplate): void {
        this.templates.set(template.name, template);
        logger.info(`Unlock template '${template.name}' registered`);
    }
    
    /**
     * Apply a template to create an unlock condition for an entity
     */
    applyTemplate(entity: BaseEntity, templateName: string, _parameters: Record<string, any> = {}): void {
        const template = this.templates.get(templateName);
        if (!template) {
            logger.error(`Template '${templateName}' not found`);
            return;
        }
        
        // Merge template parameters with provided parameters
        // const mergedParams = { ...template.parameters, ...parameters };
        
        // Create condition from template (simplified implementation)
        const condition = this.processTemplate(template.baseCondition);
        this.registerComplexUnlockCondition(entity, condition);
    }
    
    /**
     * Register a milestone
     */
    registerMilestone(milestone: UnlockMilestone): void {
        this.milestones.set(milestone.id, milestone);
        logger.info(`Milestone '${milestone.name}' registered`);
    }
    
    /**
     * Check milestone conditions
     */
    checkMilestones(): void {
        if (!this.conditionEvaluator || !this.game) return;
        
        for (const milestone of this.milestones.values()) {
            if (milestone.isAchieved) continue;
            
            const context = {
                game: this.game,
                entity: null,
                timestamp: Date.now()
            };
            
            const result = this.conditionEvaluator.evaluateComplexCondition(
                milestone.condition,
                context
            );
            
            if (result.isMet) {
                milestone.isAchieved = true;
                milestone.achievedAt = Date.now();
                
                this._emitEvent('milestoneAchieved', { milestone });
                logger.info(`Milestone achieved: ${milestone.name}`);
                
                // Apply reward if present
                if (milestone.reward) {
                    this.applyMilestoneReward(milestone);
                }
            }
        }
    }
    
    /**
     * Add event listener for unlock events
     */
    on(eventType: UnlockEventType, callback: (event: UnlockEvent) => void): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(callback);
    }
    
    /**
     * Remove event listener
     */
    off(eventType: UnlockEventType, callback: (event: UnlockEvent) => void): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * Set game reference for condition evaluation
     */
    setGame(game: Game): void {
        this.game = game;
        if (!this.conditionEvaluator) {
            this.conditionEvaluator = new UnlockConditionEvaluator(game);
        }
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
        this.eventListeners.clear();
        this.templates.clear();
        this.milestones.clear();
        if (this.conditionEvaluator) {
            this.conditionEvaluator.destroy();
        }
        logger.info('UnlockManager destroyed');
    }
    
    // Private helper methods
    
    private getCommonConditionTypes(): any[] {
        const typeCount = new Map<string, number>();
        
        for (const entry of this.unlockConditions.values()) {
            if (entry.complexCondition) {
                const type = entry.complexCondition.condition.type;
                typeCount.set(type, (typeCount.get(type) || 0) + 1);
            }
        }
        
        return Array.from(typeCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type]) => type as any);
    }
    
    private calculateAverageUnlockTime(): number {
        // This would require tracking unlock times
        // For now, return 0
        return 0;
    }
    
    private processTemplate(condition: ComplexUnlockCondition): ComplexUnlockCondition {
        // Simplified template processing
        // In a real implementation, this would replace placeholders in the condition
        return { ...condition };
    }
    
    private applyMilestoneReward(milestone: UnlockMilestone): void {
        // Simplified reward application
        // In a real implementation, this would apply the specific reward
        logger.info(`Applying reward for milestone: ${milestone.name}`);
    }
    
    private _emitEvent(type: UnlockEventType, data: any): void {
        const event: UnlockEvent = {
            type,
            data: {
                ...data,
                timestamp: Date.now()
            }
        };

        const listeners = this.eventListeners.get(type);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    logger.error(`Error in unlock event listener for ${type}: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
        }
    }
}