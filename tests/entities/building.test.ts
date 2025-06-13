import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Building } from '../../src/entities/buildings/building.js';
import { Resource } from '../../src/entities/resources/resource.js';
import { Game } from '../../src/core/game.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider, fastForward } from '../setup.js';

describe('Building Entity', () => {
  let building: Building;
  let game: Game;
  let saveManager: SaveManager;
  let oreResource: Resource;
  let metalResource: Resource;

  beforeEach(() => {
    const mockStorage = createMockStorageProvider();
    saveManager = new SaveManager(mockStorage);
    game = new Game(saveManager);

    // Create test resources
    oreResource = new Resource({
      id: 'ore',
      name: 'Ore',
      initialAmount: 100
    });
    
    metalResource = new Resource({
      id: 'metal', 
      name: 'Metal',
      initialAmount: 50
    });

    game.addEntity(oreResource);
    game.addEntity(metalResource);

    building = new Building({
      id: 'test-building',
      name: 'Test Building',
      description: 'A test building',
      costs: [
        { resourceId: 'ore', amount: 10, scalingFactor: 1.2 },
        { resourceId: 'metal', amount: 5, scalingFactor: 1.1 }
      ],
      buildTime: 3,
      productionRate: 2,
      level: 1
    });

    building.setGame(game);
  });

  describe('Basic Properties', () => {
    test('should initialize with correct values', () => {
      expect(building.id).toBe('test-building');
      expect(building.name).toBe('Test Building');
      expect(building.buildTime).toBe(3);
      expect(building.productionRate).toBe(2);
      expect(building.level).toBe(1);
      expect(building.isBuilding).toBe(false);
    });

    test('should handle legacy cost format', () => {
      const legacyBuilding = new Building({
        name: 'Legacy Building',
        cost: { ore: 15, metal: 8 }
      });

      expect(legacyBuilding.costs).toHaveLength(2);
      expect(legacyBuilding.costs[0]).toEqual({ 
        resourceId: 'ore', 
        amount: 15, 
        scalingFactor: 1.2 
      });
      expect(legacyBuilding.costs[1]).toEqual({ 
        resourceId: 'metal', 
        amount: 8, 
        scalingFactor: 1.2 
      });
    });

    test('should handle no costs', () => {
      const freeBuilding = new Building({
        name: 'Free Building'
      });

      expect(freeBuilding.costs).toHaveLength(0);
    });
  });

  describe('Cost Calculation', () => {
    test('should calculate base costs correctly', () => {
      const costs = building.calculateCost();
      
      expect(costs.ore).toBe(10);
      expect(costs.metal).toBe(5);
    });

    test('should scale costs with level', () => {
      building.level = 3;
      const costs = building.calculateCost();
      
      // Level 3: ore = 10 * 1.2^2 = 14.4 -> 14, metal = 5 * 1.1^2 = 6.05 -> 6
      expect(costs.ore).toBe(14);
      expect(costs.metal).toBe(6);
    });

    test('should apply multiplier correctly', () => {
      const costs = building.calculateCost({ multiplier: 2 });
      
      expect(costs.ore).toBe(20);
      expect(costs.metal).toBe(10);
    });
  });

  describe('Cost Validation', () => {
    test('should return true when resources are sufficient', () => {
      expect(building.canAfford()).toBe(true);
    });

    test('should return false when resources are insufficient', () => {
      oreResource.setAmount(5); // Less than required 10
      expect(building.canAfford()).toBe(false);
    });

    test('should validate costs with detailed information', () => {
      const validation = building.validateCost();
      
      expect(validation?.canAfford).toBe(true);
      expect(validation?.breakdown).toHaveLength(2);
      expect(validation?.breakdown[0].resourceId).toBe('ore');
      expect(validation?.breakdown[0].canAfford).toBe(true);
    });
  });

  describe('Cost Spending', () => {
    test('should spend resources successfully when affordable', () => {
      const initialOre = oreResource.amount;
      const initialMetal = metalResource.amount;

      expect(building.spendCost()).toBe(true);
      expect(oreResource.amount).toBe(initialOre - 10);
      expect(metalResource.amount).toBe(initialMetal - 5);
    });

    test('should not spend resources when unaffordable', () => {
      oreResource.setAmount(5);
      const initialOre = oreResource.amount;
      const initialMetal = metalResource.amount;

      expect(building.spendCost()).toBe(false);
      expect(oreResource.amount).toBe(initialOre);
      expect(metalResource.amount).toBe(initialMetal);
    });
  });

  describe('Construction Process', () => {
    test('should start construction when resources are available', () => {
      const mockCallback = jest.fn();
      building.on('buildStart', mockCallback);

      expect(building.startConstruction()).toBe(true);
      expect(building.isBuilding).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
    });

    test('should not start construction when already building', () => {
      building.startConstruction();
      expect(building.startConstruction()).toBe(false);
    });

    test('should not start construction when resources insufficient', () => {
      oreResource.setAmount(5);
      expect(building.startConstruction()).toBe(false);
      expect(building.isBuilding).toBe(false);
    });

    test('should complete construction after build time', async () => {
      const mockCallback = jest.fn();
      building.on('buildComplete', mockCallback);

      building.startConstruction();
      expect(building.isBuilding).toBe(true);

      // Fast forward time by build time
      await fastForward(building.buildTime * 1000);

      expect(building.isBuilding).toBe(false);
      expect(building.isBuilt).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
    });

    test('should start construction without spending when specified', () => {
      const initialOre = oreResource.amount;
      
      expect(building.startConstruction(false)).toBe(true);
      expect(oreResource.amount).toBe(initialOre); // Should not change
      expect(building.isBuilding).toBe(true);
    });
  });

  describe('isBuilt Logic', () => {
    test('should not be built when not unlocked', () => {
      building.isUnlocked = false;
      expect(building.isBuilt).toBe(false);
    });

    test('should not be built when currently building', () => {
      building.isUnlocked = true;
      building.startConstruction();
      expect(building.isBuilt).toBe(false);
    });

    test('should be built immediately when no build time and unlocked', () => {
      const instantBuilding = new Building({
        name: 'Instant Building',
        buildTime: 0
      });
      instantBuilding.isUnlocked = true;
      
      expect(instantBuilding.isBuilt).toBe(true);
    });

    test('should be built after construction completes', async () => {
      building.isUnlocked = true;
      building.startConstruction();
      
      expect(building.isBuilt).toBe(false);
      
      await fastForward(building.buildTime * 1000);
      
      expect(building.isBuilt).toBe(true);
    });

    test('should not be built if construction never started', () => {
      building.isUnlocked = true;
      // Don't start construction
      
      expect(building.isBuilt).toBe(false);
    });
  });

  describe('Level System', () => {
    test('should level up correctly', () => {
      const mockCallback = jest.fn();
      building.on('levelUp', mockCallback);

      building.levelUp();

      expect(building.level).toBe(2);
      expect(mockCallback).toHaveBeenCalledWith({
        building,
        oldLevel: 1,
        newLevel: 2
      });
    });

    test('should level up by specified amount', () => {
      building.levelUp(3);
      expect(building.level).toBe(4);
    });

    test('should recalculate stats after level up', () => {
      const mockRecalculate = jest.fn();
      building.recalculateStats = mockRecalculate;

      building.levelUp();

      expect(mockRecalculate).toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    test('should emit costSpent event on successful spending', () => {
      const mockCallback = jest.fn();
      building.on('costSpent', mockCallback);

      building.spendCost();

      expect(mockCallback).toHaveBeenCalledWith({
        building,
        spent: expect.objectContaining({
          ore: 10,
          metal: 5
        })
      });
    });

    test('should emit costSpendFailed event on failed spending', () => {
      oreResource.setAmount(5);
      const mockCallback = jest.fn();
      building.on('costSpendFailed', mockCallback);

      building.spendCost();

      expect(mockCallback).toHaveBeenCalled();
    });

    test('should emit constructionFailed event when starting construction fails', () => {
      oreResource.setAmount(5);
      const mockCallback = jest.fn();
      building.on('constructionFailed', mockCallback);

      building.startConstruction();

      expect(mockCallback).toHaveBeenCalledWith({
        building,
        reason: 'insufficient_resources',
        validation: expect.any(Object)
      });
    });
  });

  describe('Timer Integration', () => {
    test('should handle timer scheduling correctly', async () => {
      building.startConstruction();
      
      // Verify construction timer is active
      expect(building.isBuilding).toBe(true);
      
      // Complete construction
      await fastForward(building.buildTime * 1000);
      
      expect(building.isBuilding).toBe(false);
    });

    test('should clear timer on manual completion', () => {
      building.startConstruction();
      building.completeConstruction();
      
      expect(building.isBuilding).toBe(false);
      expect(building.isBuilt).toBe(true);
    });
  });
});