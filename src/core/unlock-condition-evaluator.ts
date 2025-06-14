/**
 * Unlock Condition Evaluator for Incrementa framework
 * Handles data-driven unlock conditions and complex requirements
 */

import type {
  UnlockConditionDefinition,
  ComplexUnlockCondition,
  UnlockConditionResult,
  ConditionEvaluation,
  UnlockOperation,
  UnlockTemplate,
  UnlockMilestone,
  UnlockEventType,
  UnlockEvent,
  UnlockManagerStats,
  UnlockEvaluationContext
} from '../types/unlock-conditions';
import type { Game } from './game';
import type { BaseEntity } from './base-entity';
import { logger } from '../utils/logger';

export class UnlockConditionEvaluator {
  private game: Game;
  private stats: UnlockManagerStats;
  private templates: Map<string, UnlockTemplate> = new Map();
  private milestones: Map<string, UnlockMilestone> = new Map();
  private listeners: Map<UnlockEventType, Array<(event: UnlockEvent) => void>> = new Map();
  private evaluationCache: Map<string, { result: UnlockConditionResult; timestamp: number }> = new Map();
  private cacheTimeout: number = 1000; // 1 second cache timeout

  constructor(game: Game) {
    this.game = game;
    this.stats = {
      totalConditions: 0,
      conditionsMet: 0,
      entitiesUnlocked: 0,
      milestonesAchieved: 0,
      commonConditionTypes: [],
      averageUnlockTime: 0,
      totalEvaluationTime: 0
    };
  }

  /**
   * Evaluate a complex unlock condition
   */
  evaluateComplexCondition(
    condition: ComplexUnlockCondition,
    context: UnlockEvaluationContext
  ): UnlockConditionResult {
    const startTime = (globalThis as { performance?: { now?: () => number } }).performance?.now?.() || Date.now();
    
    try {
      // Check prerequisites first
      const prerequisitesMet = this.checkPrerequisites(condition.prerequisites || []);
      if (!prerequisitesMet) {
        return {
          isMet: false,
          evaluationDetails: [],
          failureReason: 'Prerequisites not met',
          progress: 0,
          prerequisitesMet: false
        };
      }

      // Check time delay
      if (condition.timeDelay && condition.timeDelay > 0) {
        const timeRemaining = this.checkTimeDelay();
        if (timeRemaining > 0) {
          return {
            isMet: false,
            evaluationDetails: [],
            failureReason: `Time delay: ${timeRemaining}s remaining`,
            progress: 0,
            prerequisitesMet: true,
            timeRemaining
          };
        }
      }

      // Evaluate main condition
      const mainResult = this.evaluateCondition(condition.condition, context);
      const evaluationDetails = [mainResult];

      // Evaluate AND conditions
      let andConditionsMet = true;
      if (condition.andConditions) {
        for (const andCondition of condition.andConditions) {
          const result = this.evaluateCondition(andCondition, context);
          evaluationDetails.push(result);
          if (!result.isMet) {
            andConditionsMet = false;
          }
        }
      }

      // Evaluate OR conditions
      let orConditionsMet = !condition.orConditions || condition.orConditions.length === 0;
      if (condition.orConditions && condition.orConditions.length > 0) {
        orConditionsMet = false;
        for (const orCondition of condition.orConditions) {
          const result = this.evaluateCondition(orCondition, context);
          evaluationDetails.push(result);
          if (result.isMet) {
            orConditionsMet = true;
          }
        }
      }

      // Evaluate NOT conditions
      let notConditionsMet = true;
      if (condition.notConditions) {
        for (const notCondition of condition.notConditions) {
          const result = this.evaluateCondition(notCondition, context);
          evaluationDetails.push({...result, isMet: !result.isMet}); // Invert the result
          if (result.isMet) {
            notConditionsMet = false;
          }
        }
      }

      // Apply custom validator if present
      let customValidatorResult = true;
      if (condition.customValidator) {
        try {
          const result = condition.customValidator();
          customValidatorResult = Boolean(result);
        } catch (error) {
          logger.error(`Custom validator error: ${error instanceof Error ? error.message : String(error)}`);
          customValidatorResult = false;
        }
      }

      // Combine all results
      // OR logic: main condition OR any OR condition can be met
      // AND logic: all AND conditions must be met
      // NOT logic: none of the NOT conditions should be met
      let primaryConditionMet = mainResult.isMet;
      
      // If there are OR conditions, check if the main condition OR any OR condition is met
      if (condition.orConditions && condition.orConditions.length > 0) {
        primaryConditionMet = mainResult.isMet || orConditionsMet;
      }
      
      const isMet = primaryConditionMet && andConditionsMet && notConditionsMet && customValidatorResult;
      
      // Calculate overall progress
      const totalEvaluations = evaluationDetails.length;
      const metEvaluations = evaluationDetails.filter(e => e.isMet).length;
      const progress = totalEvaluations > 0 ? metEvaluations / totalEvaluations : 0;

      const result: UnlockConditionResult = {
        isMet,
        evaluationDetails,
        failureReason: isMet ? undefined : this.generateFailureReason(evaluationDetails),
        progress,
        prerequisitesMet: true
      };

      // Update stats
      this.stats.totalEvaluationTime += ((globalThis as { performance?: { now?: () => number } }).performance?.now?.() || Date.now()) - startTime;
      this.stats.totalConditions++;
      if (isMet) {
        this.stats.conditionsMet++;
      }

      this._emitEvent('conditionEvaluated', { condition: condition.condition, result });

      return result;

    } catch (error) {
      logger.error(`Error evaluating complex condition: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isMet: false,
        evaluationDetails: [],
        failureReason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        progress: 0,
        prerequisitesMet: false
      };
    }
  }

  /**
   * Evaluate a single unlock condition
   */
  evaluateCondition(
    condition: UnlockConditionDefinition,
    context: UnlockEvaluationContext
  ): ConditionEvaluation {
    // Check cache first
    const cacheKey = this.generateCacheKey(condition, context);
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.result.evaluationDetails[0]; // Return first evaluation detail
    }

    try {
      const actualValue = this.getActualValue(condition, context);
      const expectedValue = condition.value;
      const isMet = this.performComparison(actualValue, condition.operation, expectedValue);
      const progress = this.calculateProgress(actualValue, expectedValue, condition.operation);

      const evaluation: ConditionEvaluation = {
        condition,
        isMet,
        actualValue,
        expectedValue,
        description: this.generateDescription(condition, actualValue, expectedValue, isMet),
        progress
      };

      // Cache the result
      this.evaluationCache.set(cacheKey, {
        result: {
          isMet,
          evaluationDetails: [evaluation],
          progress,
          prerequisitesMet: true
        },
        timestamp: Date.now()
      });

      return evaluation;

    } catch (error) {
      const evaluation: ConditionEvaluation = {
        condition,
        isMet: false,
        actualValue: undefined,
        expectedValue: condition.value,
        description: `Error evaluating condition: ${error instanceof Error ? error.message : 'Unknown error'}`,
        progress: 0
      };

      return evaluation;
    }
  }

  /**
   * Get the actual value for a condition based on its type
   */
  private getActualValue(condition: UnlockConditionDefinition, context: UnlockEvaluationContext): unknown {
    switch (condition.type) {
      case 'resource_amount': {
        const resource = this.game.getResourceById(condition.target);
        return resource?.amount || 0;
      }

      case 'resource_rate': {
        const resource = this.game.getResourceById(condition.target);
        return resource?.basePassiveRate || 0;
      }

      case 'building_count': {
        return this.game.getCurrentBuildings().filter(b => 
          b.name.toLowerCase().includes(condition.target.toLowerCase()) ||
          b.id === condition.target
        ).length;
      }

      case 'building_level': {
        const building = this.game.getEntityById(condition.target);
        return (building as unknown as { level?: number })?.level || 0;
      }

      case 'upgrade_purchased': {
        const upgrade = this.game.getEntityById(condition.target);
        return (upgrade as unknown as { isApplied?: boolean })?.isApplied || false;
      }

      case 'time_played': {
        // This would need to be tracked by the game
        return context.timestamp - (this.game as unknown as { startTime?: number }).startTime || 0;
      }

      case 'entities_unlocked': {
        return this.game.getCurrentResources().filter(r => r.isUnlocked).length +
               this.game.getCurrentBuildings().filter(b => b.isUnlocked).length +
               this.game.getCurrentUpgrades().filter(u => u.isUnlocked).length;
      }

      case 'storage_capacity': {
        return this.game.getTotalCapacityFor ? this.game.getTotalCapacityFor(condition.target) : 0;
      }

      case 'custom_property': {
        const [entityId, propertyPath] = condition.target.split('.');
        const entity = this.game.getEntityById(entityId);
        if (!entity) return undefined;
        
        return this.getNestedProperty(entity, propertyPath);
      }

      case 'count': {
        // Count entities matching specific criteria
        const entities = this.getAllEntities();
        return entities.filter(entity => 
          this.entityMatchesCriteria(entity, condition.target)
        ).length;
      }

      case 'sum': {
        // Sum property values from multiple entities
        const entities = this.getAllEntities();
        const [entityType, propertyPath] = condition.target.split('.');
        return entities
          .filter(entity => entity.constructor.name.toLowerCase() === entityType.toLowerCase())
          .reduce((sum, entity) => sum + (this.getNestedProperty(entity, propertyPath) || 0), 0);
      }

      default:
        throw new Error(`Unknown condition type: ${condition.type}`);
    }
  }

  /**
   * Perform comparison based on operation
   */
  private performComparison(actual: unknown, operation: UnlockOperation, expected: unknown): boolean {
    switch (operation) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return actual > expected;
      case 'greater_than_or_equal':
        return actual >= expected;
      case 'less_than':
        return actual < expected;
      case 'less_than_or_equal':
        return actual <= expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'not_contains':
        return !String(actual).includes(String(expected));
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'not_exists':
        return actual === undefined || actual === null;
      case 'between':
        if (Array.isArray(expected) && expected.length === 2) {
          return actual >= expected[0] && actual <= expected[1];
        }
        return false;
      case 'in_list':
        return Array.isArray(expected) && expected.includes(actual);
      case 'matches_pattern':
        try {
          const regex = new RegExp(String(expected));
          return regex.test(String(actual));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Calculate progress towards meeting a condition
   */
  private calculateProgress(actual: unknown, expected: unknown, operation: UnlockOperation): number {
    if (typeof actual !== 'number' || typeof expected !== 'number') {
      return 0;
    }

    switch (operation) {
      case 'greater_than':
      case 'greater_than_or_equal':
        return expected > 0 ? Math.min(actual / expected, 1) : 0;
      case 'less_than':
      case 'less_than_or_equal':
        return actual <= expected ? 1 : Math.max(1 - (actual - expected) / expected, 0);
      case 'equals':
        return actual === expected ? 1 : Math.max(1 - Math.abs(actual - expected) / Math.max(Math.abs(expected), 1), 0);
      default:
        return 0;
    }
  }

  /**
   * Check if prerequisites are met
   */
  private checkPrerequisites(prerequisites: string[]): boolean {
    for (const prerequisiteId of prerequisites) {
      const entity = this.game.getEntityById(prerequisiteId);
      if (!entity || !entity.isUnlocked) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check time delay conditions
   */
  private checkTimeDelay(): number {
    // This would need to track when prerequisites were met
    // For now, return 0 (no delay)
    return 0;
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    condition: UnlockConditionDefinition, 
    actual: unknown, 
    expected: unknown, 
    isMet: boolean
  ): string {
    const status = isMet ? '✓' : '✗';
    const operation = this.operationToText(condition.operation);
    
    return `${status} ${condition.target} ${operation} ${expected} (current: ${actual})`;
  }

  /**
   * Convert operation to human-readable text
   */
  private operationToText(operation: UnlockOperation): string {
    const operationMap: Record<UnlockOperation, string> = {
      'equals': 'equals',
      'not_equals': 'does not equal',
      'greater_than': 'is greater than',
      'greater_than_or_equal': 'is at least',
      'less_than': 'is less than',
      'less_than_or_equal': 'is at most',
      'contains': 'contains',
      'not_contains': 'does not contain',
      'exists': 'exists',
      'not_exists': 'does not exist',
      'between': 'is between',
      'in_list': 'is in',
      'matches_pattern': 'matches'
    };
    
    return operationMap[operation] || operation;
  }

  /**
   * Generate failure reason from evaluation details
   */
  private generateFailureReason(evaluations: ConditionEvaluation[]): string {
    const failedEvaluations = evaluations.filter(e => !e.isMet);
    if (failedEvaluations.length === 0) {
      return 'Unknown failure reason';
    }
    
    return failedEvaluations.map(e => e.description).join('; ');
  }

  /**
   * Generate cache key for condition evaluation
   */
  private generateCacheKey(condition: UnlockConditionDefinition, context: UnlockEvaluationContext): string {
    return `${condition.type}:${condition.target}:${condition.operation}:${condition.value}:${context.timestamp}`;
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => 
      current && typeof current === 'object' && key in (current as Record<string, unknown>) 
        ? (current as Record<string, unknown>)[key] 
        : undefined, obj);
  }

  /**
   * Get all entities from game
   */
  private getAllEntities(): BaseEntity[] {
    return [
      ...this.game.getCurrentResources(),
      ...this.game.getCurrentBuildings(),
      ...this.game.getCurrentUpgrades()
    ];
  }

  /**
   * Check if entity matches criteria
   */
  private entityMatchesCriteria(entity: BaseEntity, criteria: string): boolean {
    return entity.name.toLowerCase().includes(criteria.toLowerCase()) ||
           entity.id === criteria ||
           (entity.tags?.some(tag => tag.toLowerCase().includes(criteria.toLowerCase())) ?? false);
  }

  /**
   * Clear evaluation cache
   */
  clearCache(): void {
    this.evaluationCache.clear();
  }

  /**
   * Get evaluator statistics
   */
  getStats(): UnlockManagerStats {
    return { ...this.stats };
  }

  /**
   * Add event listener
   */
  on(eventType: UnlockEventType, callback: (event: UnlockEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: UnlockEventType, callback: (event: UnlockEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearCache();
    this.listeners.clear();
    this.templates.clear();
    this.milestones.clear();
  }

  // Private helper methods

  private _emitEvent(type: UnlockEventType, data: Record<string, unknown>): void {
    const event: UnlockEvent = {
      type,
      data: {
        ...data,
        timestamp: Date.now()
      }
    };

    const listeners = this.listeners.get(type);
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