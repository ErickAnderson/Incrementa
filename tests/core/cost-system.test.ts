import { Game } from "../../src/core/game";
import { SaveManager } from "../../src/core/save-manager";
import { createCost, createCosts } from "../../src/core/cost-system";
import { TEST_CONSTANTS, createUnlockedResource, setupGameWithBasicResources } from "../setup";

describe('Cost System', () => {
  let game: Game;

  beforeEach(() => {
    const saveManager = new SaveManager();
    const setup = setupGameWithBasicResources(saveManager);
    game = setup.game;
  });

  describe('Cost Creation', () => {
    test('should create single cost definition', () => {
      const cost = createCost('gold', 100, 1.2);
      
      expect(cost).toEqual({
        resourceId: 'gold',
        amount: 100,
        scalingFactor: 1.2
      });
    });

    test('should create multiple cost definitions', () => {
      const costs = createCosts({ gold: 100, iron: 50 }, 1.5);
      
      expect(costs).toHaveLength(2);
      expect(costs[0]).toEqual({
        resourceId: 'gold',
        amount: 100,
        scalingFactor: 1.5
      });
      expect(costs[1]).toEqual({
        resourceId: 'iron',
        amount: 50,
        scalingFactor: 1.5
      });
    });
  });

  describe('Cost Calculation', () => {
    test('should calculate basic costs', () => {
      const costs = [createCost('gold', 100)];
      const result = game.costSystem.calculateCost(costs);
      
      expect(result).toEqual({ gold: 100 });
    });

    test('should calculate scaled costs', () => {
      const costs = [createCost('gold', 100, 1.5)];
      const result = game.costSystem.calculateCost(costs, { level: 3 });
      
      expect(result.gold).toBeCloseTo(225); // 100 * 1.5^(3-1)
    });

    test('should apply multipliers', () => {
      const costs = [createCost('gold', 100)];
      const result = game.costSystem.calculateCost(costs, { multiplier: 2 });
      
      expect(result).toEqual({ gold: 200 });
    });
  });

  describe('Cost Validation', () => {
    test('should validate affordable costs', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      
      const costs = [createCost('gold', 500)];
      const result = game.costSystem.validateCost(costs);
      
      expect(result.canAfford).toBe(true);
      expect(result.breakdown[0]).toMatchObject({
        resourceId: 'gold',
        required: 500,
        available: 1000,
        canAfford: true
      });
    });

    test('should validate unaffordable costs', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 100 });
      
      const costs = [createCost('gold', 500)];
      const result = game.costSystem.validateCost(costs);
      
      expect(result.canAfford).toBe(false);
      expect(result.missingResources).toHaveLength(1);
      expect(result.missingResources[0]).toMatchObject({
        resourceId: 'gold',
        amount: 400,
        percentageMissing: 80
      });
    });
  });

  describe('Resource Spending', () => {
    test('should spend resources successfully', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      
      const costs = [createCost('gold', 500)];
      const result = game.costSystem.spendResources(costs);
      
      expect(result.success).toBe(true);
      expect(result.spent).toEqual({ gold: 500 });
      expect(gold.amount).toBe(500);
    });

    test('should fail to spend insufficient resources', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 100 });
      
      const costs = [createCost('gold', 500)];
      const result = game.costSystem.spendResources(costs);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot afford costs');
      expect(gold.amount).toBe(100); // Should remain unchanged
    });

    test('should rollback on partial failure', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      const iron = game.createResource({ id: 'iron', name: 'Iron', initialAmount: 10 });
      
      const costs = [createCost('gold', 500), createCost('iron', 50)];
      const result = game.costSystem.spendResources(costs);
      
      expect(result.success).toBe(false);
      expect(gold.amount).toBe(1000); // Should remain unchanged
      expect(iron.amount).toBe(10); // Should remain unchanged
    });
  });

  describe('Statistics', () => {
    test('should track cost system statistics', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      
      const costs = [createCost('gold', 100)];
      
      // Perform some operations
      game.costSystem.validateCost(costs);
      game.costSystem.spendResources(costs);
      
      const stats = game.costSystem.getStats();
      
      expect(stats.validationsPerformed).toBeGreaterThan(0);
      expect(stats.successfulSpending).toBeGreaterThan(0);
      expect(stats.mostExpensiveCosts.gold).toBeGreaterThan(0);
    });

    test('should reset statistics', () => {
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      
      const costs = [createCost('gold', 100)];
      game.costSystem.spendResources(costs);
      
      game.costSystem.resetStats();
      const stats = game.costSystem.getStats();
      
      expect(stats.validationsPerformed).toBe(0);
      expect(stats.successfulSpending).toBe(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit cost events', () => {
      const costCalculatedHandler = jest.fn();
      const resourcesSpentHandler = jest.fn();
      
      // Use cost system's own event system
      game.costSystem.on('costCalculated', costCalculatedHandler);
      game.costSystem.on('resourcesSpent', resourcesSpentHandler);
      
      const gold = game.createResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      
      const costs = [createCost('gold', 100)];
      game.costSystem.spendResources(costs);
      
      expect(costCalculatedHandler).toHaveBeenCalled();
      expect(resourcesSpentHandler).toHaveBeenCalled();
    });
  });
});