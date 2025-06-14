/**
 * Upgrade Effect Processor for Incrementa framework
 * Handles data-driven upgrade effects and property modification
 */

import type {
  UpgradeEffectDefinition,
  UpgradeOperation,
  UpgradeCondition,
  UpgradeTarget,
  UpgradeApplicationResult,
  EffectApplicationResult,
  ConditionOperation,
  UpgradeEventType,
  UpgradeEvent,
  UpgradeStats
} from '../types/upgrade-effects';
import type { Game } from './game';
import type { BaseEntity } from './base-entity';
import { logger } from '../utils/logger';

export class UpgradeEffectProcessor {
  private game: Game;
  private stats: UpgradeStats;
  private listeners: Map<UpgradeEventType, Array<(event: UpgradeEvent) => void>> = new Map();

  constructor(game: Game) {
    this.game = game;
    this.stats = {
      totalApplied: 0,
      totalFailed: 0,
      commonUpgradeTypes: [],
      frequentTargets: [],
      totalValueModified: 0
    };
  }

  /**
   * Apply multiple upgrade effects to their targets
   */
  applyEffects(
    effects: UpgradeEffectDefinition[], 
    targets: UpgradeTarget[],
    upgradeId: string
  ): UpgradeApplicationResult {
    const effectResults: EffectApplicationResult[] = [];
    const modifiedEntities: string[] = [];
    let overallSuccess = true;

    try {
      for (const effect of effects) {
        for (const target of targets) {
          const targetEntities = this.resolveTargets(target);
          
          for (const entity of targetEntities) {
            // Check conditions before applying effect
            if (!this.checkConditions(effect.conditions || [], entity)) {
              continue;
            }

            const result = this.applySingleEffect(effect, entity);
            effectResults.push(result);

            if (result.success) {
              if (!modifiedEntities.includes(entity.id)) {
                modifiedEntities.push(entity.id);
              }
              this._emitEvent('effectApplied', { effectResult: result, entityId: entity.id });
            } else {
              overallSuccess = false;
              logger.warn(`Failed to apply effect to ${entity.name}: ${result.error}`);
            }
          }
        }
      }

      if (overallSuccess) {
        this.stats.totalApplied++;
        this._updateUpgradeStats(effects);
      } else {
        this.stats.totalFailed++;
      }

      const result: UpgradeApplicationResult = {
        success: overallSuccess,
        effectResults,
        modifiedEntities
      };

      this._emitEvent('upgradeApplied', { upgradeId, result });
      return result;

    } catch (error) {
      this.stats.totalFailed++;
      const result: UpgradeApplicationResult = {
        success: false,
        effectResults,
        modifiedEntities,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this._emitEvent('upgradeApplicationFailed', { upgradeId, result });
      return result;
    }
  }

  /**
   * Apply a single effect to a specific entity
   */
  private applySingleEffect(
    effect: UpgradeEffectDefinition, 
    entity: BaseEntity
  ): EffectApplicationResult {
    try {
      const oldValue = this.getPropertyValue(entity, effect.targetProperty);
      const newValue = this.calculateNewValue(oldValue, effect.operation, effect.value);
      
      this.setPropertyValue(entity, effect.targetProperty, newValue);
      
      // Update stats
      if (typeof oldValue === 'number' && typeof newValue === 'number') {
        this.stats.totalValueModified += Math.abs(newValue - oldValue);
      }

      return {
        effect,
        success: true,
        entityId: entity.id,
        property: effect.targetProperty,
        oldValue,
        newValue
      };

    } catch (error) {
      return {
        effect,
        success: false,
        entityId: entity.id,
        property: effect.targetProperty,
        oldValue: undefined,
        newValue: undefined,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate new value based on operation and current value
   */
  private calculateNewValue(currentValue: unknown, operation: UpgradeOperation, value: number): unknown {
    if (typeof currentValue !== 'number') {
      throw new Error(`Cannot perform ${operation} on non-numeric value: ${currentValue}`);
    }

    switch (operation) {
      case 'add':
        return currentValue + value;
      case 'multiply':
        return currentValue * value;
      case 'set':
        return value;
      case 'percentage':
        return currentValue * (1 + value / 100);
      case 'divide':
        if (value === 0) throw new Error('Division by zero');
        return currentValue / value;
      case 'power':
        return Math.pow(currentValue, value);
      case 'min':
        return Math.min(currentValue, value);
      case 'max':
        return Math.max(currentValue, value);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Get property value from entity using dot notation
   */
  private getPropertyValue(entity: Record<string, unknown>, propertyPath: string): unknown {
    const parts = propertyPath.split('.');
    let current = entity;
    
    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        throw new Error(`Cannot access property '${part}' on ${current}`);
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Set property value on entity using dot notation
   */
  private setPropertyValue(entity: Record<string, unknown>, propertyPath: string, value: unknown): void {
    const parts = propertyPath.split('.');
    const lastPart = parts.pop()!;
    let current = entity;
    
    for (const part of parts) {
      if (current[part] == null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[lastPart] = value;

    // Trigger recalculation if entity supports it
    if (typeof entity.recalculateStats === 'function') {
      entity.recalculateStats();
    }

    // Emit property change event
    if (typeof entity.emit === 'function') {
      entity.emit('propertyChanged', { 
        property: propertyPath, 
        oldValue: current[lastPart], 
        newValue: value 
      });
    }
  }

  /**
   * Resolve target specification to actual entities
   */
  private resolveTargets(target: UpgradeTarget): BaseEntity[] {
    let entities: BaseEntity[] = [];

    // If specific entity ID is provided, use that
    if (target.entityId) {
      const entity = this.game.getEntityById(target.entityId);
      if (entity) {
        entities = [entity];
      }
    } else {
      // Get all entities of specified type
      entities = this.getEntitiesByType(target.entityType);
    }

    // Filter by tags if specified
    if (target.tags && target.tags.length > 0) {
      entities = entities.filter(entity => 
        target.tags!.some(tag => entity.tags?.includes(tag))
      );
    }

    // Filter by name pattern if specified
    if (target.namePattern) {
      const pattern = new RegExp(target.namePattern, 'i');
      entities = entities.filter(entity => pattern.test(entity.name));
    }

    return entities;
  }

  /**
   * Get entities by type from game
   */
  private getEntitiesByType(entityType: string): BaseEntity[] {
    switch (entityType) {
      case 'building':
        return this.game.getCurrentBuildings();
      case 'resource':
        return this.game.getCurrentResources();
      case 'storage':
        return this.game.getCurrentBuildings().filter(building => 
          building.constructor.name === 'Storage'
        );
      case 'all':
        return [
          ...this.game.getCurrentResources(),
          ...this.game.getCurrentBuildings(),
          ...this.game.getCurrentUpgrades()
        ];
      default:
        return [];
    }
  }

  /**
   * Check if all conditions are met for an entity
   */
  private checkConditions(conditions: UpgradeCondition[], entity: BaseEntity): boolean {
    for (const condition of conditions) {
      if (!this.checkSingleCondition(condition, entity)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check a single condition
   */
  private checkSingleCondition(condition: UpgradeCondition, entity: BaseEntity): boolean {
    let actualValue: unknown;

    switch (condition.type) {
      case 'entity_level':
        actualValue = (entity as unknown as { level?: number }).level || 1;
        break;
      case 'resource_amount': {
        const resource = this.game.getResourceById(condition.target);
        actualValue = resource?.amount || 0;
        break;
      }
      case 'building_count':
        actualValue = this.game.getCurrentBuildings().filter(b => 
          b.name.toLowerCase().includes(condition.target.toLowerCase())
        ).length;
        break;
      case 'upgrade_applied':
        // Check if specific upgrade is applied to this entity
        actualValue = (entity as unknown as { upgradesApplied?: Array<{ name: string }> }).upgradesApplied?.some((u) => 
          u.name === condition.target
        ) || false;
        break;
      default:
        return true; // Unknown condition types default to true
    }

    return this.compareValues(actualValue, condition.operation, condition.value);
  }

  /**
   * Compare values based on operation
   */
  private compareValues(actual: unknown, operation: ConditionOperation, expected: unknown): boolean {
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
      default:
        return true;
    }
  }

  /**
   * Get upgrade processor statistics
   */
  getStats(): UpgradeStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalApplied: 0,
      totalFailed: 0,
      commonUpgradeTypes: [],
      frequentTargets: [],
      totalValueModified: 0
    };
  }

  /**
   * Add event listener
   */
  on(eventType: UpgradeEventType, callback: (event: UpgradeEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: UpgradeEventType, callback: (event: UpgradeEvent) => void): void {
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
    this.listeners.clear();
    this.resetStats();
  }

  // Private helper methods

  private _emitEvent(type: UpgradeEventType, data: Record<string, unknown>): void {
    const event: UpgradeEvent = {
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
          logger.error(`Error in upgrade event listener for ${type}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    }
  }

  private _updateUpgradeStats(effects: UpgradeEffectDefinition[]): void {
    // Update common upgrade types
    const types = effects.map(e => e.type);
    for (const type of types) {
      if (!this.stats.commonUpgradeTypes.includes(type)) {
        this.stats.commonUpgradeTypes.push(type);
      }
    }

    // Keep only top 10 most common
    this.stats.commonUpgradeTypes = this.stats.commonUpgradeTypes.slice(0, 10);
  }
}