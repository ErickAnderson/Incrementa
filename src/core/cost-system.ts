/**
 * Cost System for Incrementa framework
 * Handles cost validation, resource spending, and cost calculations
 */

import type { 
  CostDefinition, 
  CostConfiguration, 
  CostValidationResult, 
  CostBreakdown, 
  MissingResource, 
  CostCalculationOptions, 
  ResourceSpendingResult,
  CostEvent,
  CostEventType,
  CostSystemStats 
} from '../types/cost-definition';
import type { Game } from './game';
import { logger } from '../utils/logger';

export class CostSystem {
  private game: Game;
  private stats: CostSystemStats;
  private listeners: Map<CostEventType, Function[]> = new Map();

  constructor(game: Game) {
    this.game = game;
    this.stats = {
      validationsPerformed: 0,
      successfulSpending: 0,
      failedSpending: 0,
      mostExpensiveCosts: {},
      commonResources: []
    };
  }

  /**
   * Calculate the actual cost based on level, scaling, and multipliers
   */
  calculateCost(
    costs: CostDefinition[], 
    options: CostCalculationOptions = {}
  ): Record<string, number> {
    const { level = 1, multiplier = 1, applyScaling = true, scalingFunction } = options;
    const calculatedCosts: Record<string, number> = {};

    for (const cost of costs) {
      let amount = cost.amount;

      if (applyScaling && level > 1) {
        if (scalingFunction) {
          amount = scalingFunction(cost.amount, level);
        } else if (cost.scalingFactor) {
          // Exponential scaling: baseCost * (scalingFactor ^ (level - 1))
          amount = cost.amount * Math.pow(cost.scalingFactor, level - 1);
        }
      }

      if (cost.multiplier) {
        amount *= cost.multiplier;
      }

      amount *= multiplier;
      amount = Math.floor(amount); // Ensure integer costs

      calculatedCosts[cost.resourceId] = (calculatedCosts[cost.resourceId] || 0) + amount;
    }

    // Update stats
    this._updateMostExpensiveCosts(calculatedCosts);
    this._updateCommonResources(Object.keys(calculatedCosts));

    this._emitEvent('costCalculated', { costs, calculatedCosts });

    return calculatedCosts;
  }

  /**
   * Validate whether costs can be afforded
   */
  validateCost(
    costs: CostDefinition[], 
    options: CostCalculationOptions = {}
  ): CostValidationResult {
    this.stats.validationsPerformed++;

    const calculatedCosts = this.calculateCost(costs, options);
    const breakdown: CostBreakdown[] = [];
    const missingResources: MissingResource[] = [];
    let canAfford = true;

    for (const [resourceId, requiredAmount] of Object.entries(calculatedCosts)) {
      const resource = this.game.getResourceById(resourceId);
      const availableAmount = resource?.amount || 0;
      const itemCanAfford = availableAmount >= requiredAmount;
      
      if (!itemCanAfford) {
        canAfford = false;
        const shortage = requiredAmount - availableAmount;
        const percentageMissing = requiredAmount > 0 ? (shortage / requiredAmount) * 100 : 0;
        
        missingResources.push({
          resourceId,
          amount: shortage,
          percentageMissing
        });
      }

      breakdown.push({
        resourceId,
        required: requiredAmount,
        available: availableAmount,
        canAfford: itemCanAfford,
        shortage: itemCanAfford ? undefined : requiredAmount - availableAmount
      });
    }

    const result: CostValidationResult = {
      canAfford,
      breakdown,
      missingResources,
      totalCost: calculatedCosts
    };

    this._emitEvent('costValidated', { validation: result });

    return result;
  }

  /**
   * Spend resources according to cost definitions
   */
  spendResources(
    costs: CostDefinition[], 
    options: CostCalculationOptions = {}
  ): ResourceSpendingResult {
    const validation = this.validateCost(costs, options);
    
    if (!validation.canAfford) {
      this.stats.failedSpending++;
      
      const result: ResourceSpendingResult = {
        success: false,
        spent: {},
        error: `Cannot afford costs. Missing: ${validation.missingResources.map(mr => `${mr.amount} ${mr.resourceId}`).join(', ')}`,
        failed: validation.totalCost
      };

      this._emitEvent('spendingFailed', { spending: result });
      return result;
    }

    // Perform the actual spending
    const spent: Record<string, number> = {};
    const calculatedCosts = validation.totalCost;

    try {
      for (const [resourceId, amount] of Object.entries(calculatedCosts)) {
        const resource = this.game.getResourceById(resourceId);
        if (resource) {
          resource.decrement(amount);
          spent[resourceId] = amount;
        }
      }

      this.stats.successfulSpending++;

      const result: ResourceSpendingResult = {
        success: true,
        spent
      };

      this._emitEvent('resourcesSpent', { spending: result });
      return result;

    } catch (error) {
      this.stats.failedSpending++;
      
      // Rollback any spending that occurred
      for (const [resourceId, amount] of Object.entries(spent)) {
        const resource = this.game.getResourceById(resourceId);
        if (resource) {
          resource.increment(amount);
        }
      }

      const result: ResourceSpendingResult = {
        success: false,
        spent: {},
        error: `Failed to spend resources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        failed: calculatedCosts
      };

      this._emitEvent('spendingFailed', { spending: result });
      return result;
    }
  }

  /**
   * Create a cost configuration from simple cost definitions
   */
  createCostConfiguration(
    costs: CostDefinition[], 
    options: { isScaling?: boolean; baseScaling?: number; description?: string } = {}
  ): CostConfiguration {
    return {
      costs,
      isScaling: options.isScaling,
      baseScaling: options.baseScaling,
      description: options.description
    };
  }

  /**
   * Get cost system statistics
   */
  getStats(): CostSystemStats {
    return { ...this.stats };
  }

  /**
   * Reset cost system statistics
   */
  resetStats(): void {
    this.stats = {
      validationsPerformed: 0,
      successfulSpending: 0,
      failedSpending: 0,
      mostExpensiveCosts: {},
      commonResources: []
    };
  }

  /**
   * Add event listener for cost events
   */
  on(eventType: CostEventType, callback: (event: CostEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType: CostEventType, callback: (event: CostEvent) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Clean up resources and event listeners
   */
  destroy(): void {
    this.listeners.clear();
    this.resetStats();
  }

  // Private methods

  private _emitEvent(type: CostEventType, data: any): void {
    const event: CostEvent = {
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
          // Use logger instead of console for better compatibility
          logger.error(`Error in cost event listener for ${type}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    }
  }

  private _updateMostExpensiveCosts(costs: Record<string, number>): void {
    for (const [resourceId, amount] of Object.entries(costs)) {
      if (!this.stats.mostExpensiveCosts[resourceId] || amount > this.stats.mostExpensiveCosts[resourceId]) {
        this.stats.mostExpensiveCosts[resourceId] = amount;
      }
    }
  }

  private _updateCommonResources(resourceIds: string[]): void {
    const resourceCounts = new Map<string, number>();
    
    // Count existing common resources
    for (const resourceId of this.stats.commonResources) {
      resourceCounts.set(resourceId, (resourceCounts.get(resourceId) || 0) + 1);
    }
    
    // Add new resources
    for (const resourceId of resourceIds) {
      resourceCounts.set(resourceId, (resourceCounts.get(resourceId) || 0) + 1);
    }
    
    // Update common resources list (top 10 most common)
    this.stats.commonResources = Array.from(resourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([resourceId]) => resourceId);
  }
}

// Utility functions for cost calculations

/**
 * Create simple cost definition
 */
export function createCost(resourceId: string, amount: number, scalingFactor?: number): CostDefinition {
  return {
    resourceId,
    amount,
    scalingFactor
  };
}

/**
 * Create multiple cost definitions
 */
export function createCosts(costs: Record<string, number>, scalingFactor?: number): CostDefinition[] {
  return Object.entries(costs).map(([resourceId, amount]) => ({
    resourceId,
    amount,
    scalingFactor
  }));
}

/**
 * Common scaling functions
 */
export const ScalingFunctions = {
  linear: (baseCost: number, level: number) => baseCost * level,
  exponential: (baseCost: number, level: number, factor: number = 1.2) => baseCost * Math.pow(factor, level - 1),
  logarithmic: (baseCost: number, level: number) => baseCost * Math.log(level + 1),
  polynomial: (baseCost: number, level: number, power: number = 2) => baseCost * Math.pow(level, power)
};