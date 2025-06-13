import { Game } from "../../src/core/game";
import { SaveManager } from "../../src/core/save-manager";
import { Upgrade } from "../../src/core/upgrade";
import { createCost } from "../../src/core/cost-system";
import { setupGameWithBasicResources, createUnlockedBuilding, createUnlockedResource } from "../setup";
import type { 
  UpgradeConfiguration, 
  UpgradeEffectDefinition,
  UpgradeTarget 
} from "../../src/types/upgrade-effects";

describe('Upgrade Effects System', () => {
  let game: Game;

  beforeEach(() => {
    const saveManager = new SaveManager();
    game = setupGameWithBasicResources(saveManager);
  });

  describe('Data-Driven Upgrade Effects', () => {
    test('should apply property modifier effects', () => {
      const building = createUnlockedBuilding({ 
        name: 'Test Mine',
        productionRate: 10
      });
      game.addEntity(building);
      
      const effect: UpgradeEffectDefinition = {
        type: 'property_modifier',
        targetProperty: 'productionRate',
        operation: 'multiply',
        value: 2,
        description: 'Double production rate'
      };
      
      const target: UpgradeTarget = {
        entityType: 'building',
        entityId: building.id
      };
      
      const configuration: UpgradeConfiguration = {
        effects: [effect],
        targets: [target]
      };
      
      const upgrade = new Upgrade({
        name: 'Production Boost',
        configuration,
        costs: [createCost('gold', 100)]
      });
      
      upgrade.setGame(game);
      game.addEntity(upgrade);
      
      const result = upgrade.apply();
      
      expect(result.success).toBe(true);
      expect(building.productionRate).toBe(20);
    });

    test('should apply percentage-based effects', () => {
      const building = createUnlockedBuilding({ 
        name: 'Test Mine',
        productionRate: 100
      });
      game.addEntity(building);
      
      const effect: UpgradeEffectDefinition = {
        type: 'property_modifier',
        targetProperty: 'productionRate',
        operation: 'percentage',
        value: 50, // +50%
        description: 'Increase production by 50%'
      };
      
      const target: UpgradeTarget = {
        entityType: 'building',
        entityId: building.id
      };
      
      const configuration: UpgradeConfiguration = {
        effects: [effect],
        targets: [target]
      };
      
      const upgrade = new Upgrade({
        name: 'Efficiency Boost',
        configuration
      });
      
      upgrade.setGame(game);
      const result = upgrade.apply();
      
      expect(result.success).toBe(true);
      expect(building.productionRate).toBe(150);
    });

    test('should apply effects to multiple targets', () => {
      const building1 = createUnlockedBuilding({ 
        name: 'Mine 1',
        productionRate: 10,
        tags: ['mining']
      });
      const building2 = createUnlockedBuilding({ 
        name: 'Mine 2',
        productionRate: 15,
        tags: ['mining']
      });
      
      game.addEntity(building1);
      game.addEntity(building2);
      
      const effect: UpgradeEffectDefinition = {
        type: 'property_modifier',
        targetProperty: 'productionRate',
        operation: 'add',
        value: 5,
        description: 'Add +5 production to all mines'
      };
      
      const target: UpgradeTarget = {
        entityType: 'building',
        tags: ['mining']
      };
      
      const configuration: UpgradeConfiguration = {
        effects: [effect],
        targets: [target]
      };
      
      const upgrade = new Upgrade({
        name: 'Mining Technology',
        configuration
      });
      
      upgrade.setGame(game);
      const result = upgrade.apply();
      
      expect(result.success).toBe(true);
      expect(building1.productionRate).toBe(15);
      expect(building2.productionRate).toBe(20);
    });
  });

  describe('Repeatable Upgrades', () => {
    test('should handle repeatable upgrades', () => {
      const building = createUnlockedBuilding({ 
        name: 'Test Mine',
        productionRate: 10
      });
      game.addEntity(building);
      
      const effect: UpgradeEffectDefinition = {
        type: 'property_modifier',
        targetProperty: 'productionRate',
        operation: 'add',
        value: 5
      };
      
      const target: UpgradeTarget = {
        entityType: 'building',
        entityId: building.id
      };
      
      const configuration: UpgradeConfiguration = {
        effects: [effect],
        targets: [target],
        isRepeatable: true,
        maxApplications: 3
      };
      
      const upgrade = new Upgrade({
        name: 'Incremental Boost',
        configuration,
        isRepeatable: true,
        maxApplications: 3
      });
      
      upgrade.setGame(game);
      
      // Apply upgrade multiple times
      upgrade.apply();
      expect(building.productionRate).toBe(15);
      expect(upgrade.currentApplications).toBe(1);
      
      upgrade.apply();
      expect(building.productionRate).toBe(20);
      expect(upgrade.currentApplications).toBe(2);
      
      upgrade.apply();
      expect(building.productionRate).toBe(25);
      expect(upgrade.currentApplications).toBe(3);
      
      // Should not apply beyond max
      const result = upgrade.apply();
      expect(result.success).toBe(false);
      expect(building.productionRate).toBe(25);
    });
  });

  describe('Cost Integration', () => {
    test('should calculate upgrade costs with scaling', () => {
      const gold = createUnlockedResource({ name: 'Gold', initialAmount: 10000 });
      game.addEntity(gold);
      
      const upgrade = new Upgrade({
        name: 'Scaling Upgrade',
        costs: [createCost('gold', 100, 1.5)],
        isRepeatable: true,
        maxApplications: 5
      });
      
      upgrade.setGame(game);
      
      // First application cost
      expect(upgrade.calculateCost()).toEqual({ gold: 100 });
      
      // After one application
      upgrade.currentApplications = 1;
      expect(upgrade.calculateCost().gold).toBeCloseTo(150); // 100 * 1.5^1
      
      // After two applications
      upgrade.currentApplications = 2;
      expect(upgrade.calculateCost().gold).toBeCloseTo(225); // 100 * 1.5^2
    });

    test('should validate upgrade affordability', () => {
      const gold = createUnlockedResource({ name: 'Gold', initialAmount: 500 });
      game.addEntity(gold);
      
      const upgrade = new Upgrade({
        name: 'Expensive Upgrade',
        costs: [createCost('gold', 1000)]
      });
      
      upgrade.setGame(game);
      
      expect(upgrade.canAfford()).toBe(false);
      
      gold.setAmount(1500);
      expect(upgrade.canAfford()).toBe(true);
    });

    test('should purchase upgrades with resource spending', () => {
      const gold = createUnlockedResource({ name: 'Gold', initialAmount: 1000 });
      game.addEntity(gold);
      
      const upgrade = new Upgrade({
        name: 'Purchase Test',
        costs: [createCost('gold', 500)]
      });
      
      upgrade.setGame(game);
      
      const result = upgrade.purchase();
      
      expect(result).toBe(true);
      expect(gold.amount).toBe(500);
    });
  });

  describe('Legacy Compatibility', () => {
    test('should support legacy effect functions', () => {
      let effectExecuted = false;
      
      const upgrade = new Upgrade({
        name: 'Legacy Upgrade',
        effect: () => {
          effectExecuted = true;
        }
      });
      
      const result = upgrade.apply();
      
      expect(result.success).toBe(true);
      expect(effectExecuted).toBe(true);
      expect(upgrade.isApplied).toBe(true);
    });

    test('should support legacy cost format', () => {
      const upgrade = new Upgrade({
        name: 'Legacy Cost',
        cost: { gold: 100, iron: 50 }
      });
      
      expect(upgrade.costs).toHaveLength(2);
      expect(upgrade.costs[0]).toMatchObject({
        resourceId: 'gold',
        amount: 100,
        scalingFactor: 1.2
      });
      expect(upgrade.costs[1]).toMatchObject({
        resourceId: 'iron',
        amount: 50,
        scalingFactor: 1.2
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid property paths gracefully', () => {
      const building = createUnlockedBuilding({ name: 'Test Mine' });
      game.addEntity(building);
      
      const effect: UpgradeEffectDefinition = {
        type: 'property_modifier',
        targetProperty: 'nonexistent.property',
        operation: 'add',
        value: 10
      };
      
      const target: UpgradeTarget = {
        entityType: 'building',
        entityId: building.id
      };
      
      const configuration: UpgradeConfiguration = {
        effects: [effect],
        targets: [target]
      };
      
      const upgrade = new Upgrade({
        name: 'Invalid Effect',
        configuration
      });
      
      upgrade.setGame(game);
      const result = upgrade.apply();
      
      expect(result.success).toBe(false);
      expect(result.effectResults[0].success).toBe(false);
    });

    test('should handle missing target entities', () => {
      const effect: UpgradeEffectDefinition = {
        type: 'property_modifier',
        targetProperty: 'productionRate',
        operation: 'add',
        value: 10
      };
      
      const target: UpgradeTarget = {
        entityType: 'building',
        entityId: 'nonexistent-id'
      };
      
      const configuration: UpgradeConfiguration = {
        effects: [effect],
        targets: [target]
      };
      
      const upgrade = new Upgrade({
        name: 'Missing Target',
        configuration
      });
      
      upgrade.setGame(game);
      const result = upgrade.apply();
      
      expect(result.success).toBe(true); // Should succeed but with no effects
      expect(result.effectResults).toHaveLength(0);
    });
  });
});