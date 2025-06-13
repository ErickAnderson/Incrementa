import { Game } from "../../src/core/game";
import { SaveManager } from "../../src/core/save-manager";
import { setupGameWithBasicResources, createUnlockedResource, createUnlockedBuilding } from "../setup";
import type { 
  UnlockConditionDefinition,
  ComplexUnlockCondition
} from "../../src/types/unlock-conditions";

describe('Unlock Conditions System', () => {
  let game: Game;

  beforeEach(() => {
    const saveManager = new SaveManager();
    const setup = setupGameWithBasicResources(saveManager);
    game = setup.game;
  });

  describe('Simple Unlock Conditions', () => {
    test('should evaluate resource amount conditions', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 500 });
      game.addEntity(gold);
      
      const condition: UnlockConditionDefinition = {
        type: 'resource_amount',
        target: 'gold',
        operation: 'greater_than_or_equal',
        value: 1000
      };
      
      const context = {
        game,
        entity: null,
        timestamp: Date.now()
      };
      
      let result = game.unlockManager['conditionEvaluator'].evaluateCondition(condition, context);
      expect(result.isMet).toBe(false);
      expect(result.actualValue).toBe(500);
      
      gold.setAmount(1500);
      // Clear cache to ensure fresh evaluation
      game.unlockManager['conditionEvaluator'].clearCache();
      result = game.unlockManager['conditionEvaluator'].evaluateCondition(condition, context);
      expect(result.isMet).toBe(true);
      expect(result.actualValue).toBe(1500);
    });

    test('should evaluate building count conditions', () => {
      const condition: UnlockConditionDefinition = {
        type: 'building_count',
        target: 'mine',
        operation: 'greater_than_or_equal',
        value: 3
      };
      
      const context = {
        game,
        entity: null,
        timestamp: Date.now()
      };
      
      // Initially no buildings
      let result = game.unlockManager['conditionEvaluator'].evaluateCondition(condition, context);
      expect(result.isMet).toBe(false);
      expect(result.actualValue).toBe(0);
      
      // Add buildings with names containing 'mine'
      game.addEntity(createUnlockedBuilding({ name: 'Gold Mine' }));
      game.addEntity(createUnlockedBuilding({ name: 'Iron Mine' }));
      game.addEntity(createUnlockedBuilding({ name: 'Coal Mine' }));
      
      // Clear cache to ensure fresh evaluation
      game.unlockManager['conditionEvaluator'].clearCache();
      result = game.unlockManager['conditionEvaluator'].evaluateCondition(condition, context);
      expect(result.isMet).toBe(true);
      expect(result.actualValue).toBe(3);
    });

    test('should evaluate building level conditions', () => {
      const building = createUnlockedBuilding({ name: 'Test Mine', level: 2 });
      game.addEntity(building);
      
      const condition: UnlockConditionDefinition = {
        type: 'building_level',
        target: building.id,
        operation: 'greater_than_or_equal',
        value: 5
      };
      
      const context = {
        game,
        entity: null,
        timestamp: Date.now()
      };
      
      let result = game.unlockManager['conditionEvaluator'].evaluateCondition(condition, context);
      expect(result.isMet).toBe(false);
      expect(result.actualValue).toBe(2);
      
      building.level = 7;
      // Clear cache to ensure fresh evaluation
      game.unlockManager['conditionEvaluator'].clearCache();
      result = game.unlockManager['conditionEvaluator'].evaluateCondition(condition, context);
      expect(result.isMet).toBe(true);
      expect(result.actualValue).toBe(7);
    });
  });

  describe('Complex Unlock Conditions', () => {
    test('should evaluate AND conditions', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      const iron = createUnlockedResource({ id: 'iron', name: 'Iron', initialAmount: 500 });
      game.addEntity(gold);
      game.addEntity(iron);
      
      const complexCondition: ComplexUnlockCondition = {
        condition: {
          type: 'resource_amount',
          target: 'gold',
          operation: 'greater_than_or_equal',
          value: 800
        },
        andConditions: [
          {
            type: 'resource_amount',
            target: 'iron',
            operation: 'greater_than_or_equal',
            value: 600
          }
        ]
      };
      
      const context = {
        game,
        entity: null,
        timestamp: Date.now()
      };
      
      let result = game.unlockManager['conditionEvaluator'].evaluateComplexCondition(complexCondition, context);
      expect(result.isMet).toBe(false); // Iron requirement not met
      
      iron.setAmount(700);
      // Clear cache to ensure fresh evaluation
      game.unlockManager['conditionEvaluator'].clearCache();
      result = game.unlockManager['conditionEvaluator'].evaluateComplexCondition(complexCondition, context);
      expect(result.isMet).toBe(true); // Both conditions met
    });

    test('should evaluate OR conditions', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 100 });
      const iron = createUnlockedResource({ id: 'iron', name: 'Iron', initialAmount: 1000 });
      game.addEntity(gold);
      game.addEntity(iron);
      
      const complexCondition: ComplexUnlockCondition = {
        condition: {
          type: 'resource_amount',
          target: 'gold',
          operation: 'greater_than_or_equal',
          value: 500
        },
        orConditions: [
          {
            type: 'resource_amount',
            target: 'iron',
            operation: 'greater_than_or_equal',
            value: 800
          }
        ]
      };
      
      const context = {
        game,
        entity: null,
        timestamp: Date.now()
      };
      
      // Clear cache to ensure fresh evaluation
      game.unlockManager['conditionEvaluator'].clearCache();
      const result = game.unlockManager['conditionEvaluator'].evaluateComplexCondition(complexCondition, context);
      expect(result.isMet).toBe(true); // Iron OR condition met, even though gold isn't
    });

    test('should evaluate NOT conditions', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      game.addEntity(gold);
      
      const complexCondition: ComplexUnlockCondition = {
        condition: {
          type: 'resource_amount',
          target: 'gold',
          operation: 'greater_than_or_equal',
          value: 500
        },
        notConditions: [
          {
            type: 'resource_amount',
            target: 'gold',
            operation: 'greater_than_or_equal',
            value: 2000
          }
        ]
      };
      
      const context = {
        game,
        entity: null,
        timestamp: Date.now()
      };
      
      let result = game.unlockManager['conditionEvaluator'].evaluateComplexCondition(complexCondition, context);
      expect(result.isMet).toBe(true); // Main condition met AND not condition is false
      
      gold.setAmount(2500);
      // Clear cache to ensure fresh evaluation
      game.unlockManager['conditionEvaluator'].clearCache();
      result = game.unlockManager['conditionEvaluator'].evaluateComplexCondition(complexCondition, context);
      expect(result.isMet).toBe(false); // Not condition is now true, failing the check
    });
  });

  describe('Unlock Manager Integration', () => {
    test('should register and evaluate legacy unlock conditions', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 500 });
      game.addEntity(gold);
      
      const testBuilding = createUnlockedBuilding({ 
        name: 'Test Building',
        unlockCondition: () => gold.amount >= 1000
      });
      
      // Don't add to game yet - should be locked
      testBuilding.isUnlocked = false;
      
      game.unlockManager.registerUnlockCondition(testBuilding, testBuilding.getUnlockCondition()!);
      
      // Check initial state
      game.unlockManager.checkUnlockConditions();
      expect(testBuilding.isUnlocked).toBe(false);
      
      // Meet condition
      gold.setAmount(1500);
      // Clear cache before checking conditions
      game.unlockManager['conditionEvaluator'].clearCache();
      game.unlockManager.checkUnlockConditions();
      expect(testBuilding.isUnlocked).toBe(true);
    });

    test('should register and evaluate complex unlock conditions', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 800 });
      const iron = createUnlockedResource({ id: 'iron', name: 'Iron', initialAmount: 400 });
      game.addEntity(gold);
      game.addEntity(iron);
      
      const testBuilding = createUnlockedBuilding({ name: 'Advanced Building' });
      testBuilding.isUnlocked = false;
      game.addEntity(testBuilding);
      
      const complexCondition: ComplexUnlockCondition = {
        condition: {
          type: 'resource_amount',
          target: 'gold',
          operation: 'greater_than_or_equal',
          value: 1000
        },
        andConditions: [
          {
            type: 'resource_amount',
            target: 'iron',
            operation: 'greater_than_or_equal',
            value: 500
          }
        ]
      };
      
      game.unlockManager.registerComplexUnlockCondition(testBuilding, complexCondition);
      
      // Check initial state
      game.unlockManager.checkUnlockConditions();
      expect(testBuilding.isUnlocked).toBe(false);
      
      // Meet partial condition
      gold.setAmount(1200);
      // Clear cache before checking conditions
      game.unlockManager['conditionEvaluator'].clearCache();
      game.unlockManager.checkUnlockConditions();
      expect(testBuilding.isUnlocked).toBe(false); // Iron still not enough
      
      // Meet all conditions
      iron.setAmount(600);
      // Clear cache before checking conditions
      game.unlockManager['conditionEvaluator'].clearCache();
      game.unlockManager.checkUnlockConditions();
      expect(testBuilding.isUnlocked).toBe(true);
    });

    test('should manually unlock entities', () => {
      const testBuilding = createUnlockedBuilding({ name: 'Manual Building' });
      testBuilding.isUnlocked = false;
      
      game.unlockManager.registerUnlockCondition(testBuilding, () => false); // Never unlocks normally
      
      const result = game.unlockManager.unlockEntity(testBuilding.id);
      expect(result).toBe(true);
      expect(testBuilding.isUnlocked).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track unlock statistics', () => {
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      game.addEntity(gold);
      
      const building1 = createUnlockedBuilding({ name: 'Building 1' });
      const building2 = createUnlockedBuilding({ name: 'Building 2' });
      building1.isUnlocked = false;
      building2.isUnlocked = false;
      game.addEntity(building1);
      game.addEntity(building2);
      
      game.unlockManager.registerUnlockCondition(building1, () => gold.amount >= 500);
      game.unlockManager.registerUnlockCondition(building2, () => gold.amount >= 1500);
      
      const stats = game.unlockManager.getStats();
      
      expect(stats.totalConditions).toBe(2);
      expect(stats.entitiesUnlocked).toBe(0);
      
      game.unlockManager.checkUnlockConditions();
      
      const updatedStats = game.unlockManager.getStats();
      expect(updatedStats.entitiesUnlocked).toBe(1); // Only building1 should unlock
    });
  });

  describe('Event Emission', () => {
    test('should emit unlock events', () => {
      const unlockHandler = jest.fn();
      game.unlockManager.on('entityUnlocked', unlockHandler);
      
      const gold = createUnlockedResource({ id: 'gold', name: 'Gold', initialAmount: 1000 });
      game.addEntity(gold);
      
      const testBuilding = createUnlockedBuilding({ name: 'Test Building' });
      testBuilding.isUnlocked = false;
      game.addEntity(testBuilding);
      
      game.unlockManager.registerUnlockCondition(testBuilding, () => true);
      game.unlockManager.checkUnlockConditions();
      
      expect(unlockHandler).toHaveBeenCalled();
    });
  });
});