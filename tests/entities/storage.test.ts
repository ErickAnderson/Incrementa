import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Storage } from '../../src/entities/buildings/storage.js';
import { Resource } from '../../src/entities/resources/resource.js';
import { Game } from '../../src/core/game.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider, fastForward, createUnlockedStorage, setupGameWithBasicResources, TEST_CONSTANTS } from '../setup.js';

describe('Storage Entity', () => {
  let storage: Storage;
  let game: Game;
  let saveManager: SaveManager;
  let oreResource: Resource;
  let metalResource: Resource;

  beforeEach(() => {
    const mockStorage = createMockStorageProvider();
    saveManager = new SaveManager(mockStorage);
    game = new Game(saveManager);

    // Create test resources using helper
    const resources = setupGameWithBasicResources(game);
    oreResource = resources.ore;
    oreResource.setAmount(50); // Adjust to test values
    
    metalResource = resources.metal;
    metalResource.setAmount(25); // Adjust to test values

    // Create unlocked storage using helper instead of direct property access
    storage = createUnlockedStorage(game, {
      id: 'test-storage',
      name: 'Test Storage',
      description: 'A test storage facility',
      cost: { ore: 20, metal: 10 },
      buildTime: TEST_CONSTANTS.BUILD_TIMES.normal,
      capacities: {
        ore: 100,
        metal: 50
      }
    });
  });

  describe('Basic Properties', () => {
    test('should initialize with correct capacities', () => {
      expect(storage.getCapacityFor('ore')).toBe(100);
      expect(storage.getCapacityFor('metal')).toBe(50);
      expect(storage.getCapacityFor('energy')).toBeUndefined();
    });

    test('should inherit building properties', () => {
      expect(storage.id).toBe('test-storage');
      expect(storage.name).toBe('Test Storage');
      expect(storage.buildTime).toBe(2);
      expect(storage.productionRate).toBe(0); // Storage doesn't produce
    });

    test('should handle no capacities configuration', () => {
      const emptyStorage = new Storage({
        name: 'Empty Storage'
      });

      expect(emptyStorage.getManagedResourceIds()).toHaveLength(0);
      expect(emptyStorage.getTotalCapacity()).toBe(0);
    });
  });

  describe('Capacity Management', () => {

    test('should get correct capacity for resources', () => {
      expect(storage.getCapacityFor('ore')).toBe(100);
      expect(storage.getCapacityFor('metal')).toBe(50);
      expect(storage.getCapacityFor('nonexistent')).toBeUndefined();
    });

    test('should set capacity correctly', () => {
      const mockCallback = jest.fn();
      storage.on('capacityChanged', mockCallback);

      storage.setCapacityFor('ore', 150);

      expect(storage.getCapacityFor('ore')).toBe(150);
      expect(mockCallback).toHaveBeenCalledWith({
        resourceId: 'ore',
        oldCapacity: 100,
        newCapacity: 150
      });
    });

    test('should not allow negative capacity', () => {
      storage.setCapacityFor('ore', -50);
      expect(storage.getCapacityFor('ore')).toBe(100); // Should not change
    });

    test('should increase capacity correctly', () => {
      storage.increaseCapacity('ore', 25);
      expect(storage.getCapacityFor('ore')).toBe(125);
    });

    test('should calculate total capacity correctly', () => {
      expect(storage.getTotalCapacity()).toBe(150); // 100 + 50
    });

    test('should calculate used capacity correctly', () => {
      // Current: ore=50, metal=25
      expect(storage.getUsedCapacity()).toBe(75);
    });

    test('should calculate remaining capacity correctly', () => {
      expect(storage.getRemainingCapacity()).toBe(75); // 150 - 75
    });

    test('should calculate utilization correctly', () => {
      expect(storage.getUtilization()).toBe(0.5); // 75/150 = 0.5
    });
  });

  describe('Capacity Checking', () => {
    // Storage is already unlocked from main beforeEach using helper

    test('should allow addition within capacity', () => {
      expect(storage.hasCapacity('ore', 30)).toBe(true);
      expect(storage.canAddResource('ore', 30)).toBe(true);
    });

    test('should reject addition exceeding capacity', () => {
      expect(storage.hasCapacity('ore', 60)).toBe(false); // 50 + 60 > 100
      expect(storage.canAddResource('ore', 60)).toBe(false);
    });

    test('should allow unlimited for unmanaged resources', () => {
      expect(storage.hasCapacity('energy', 1000)).toBe(true);
      expect(storage.canAddResource('energy', 1000)).toBe(true);
    });

    test('should handle edge case at exact capacity', () => {
      const currentAmount = 50;
      const exactCapacityAmount = 50; // Will exactly reach 100 capacity
      const overCapacityAmount = 51; // Will exceed 100 capacity
      
      expect(storage.hasCapacity('ore', exactCapacityAmount)).toBe(true);
      expect(storage.hasCapacity('ore', overCapacityAmount)).toBe(false);
    });
  });

  describe('Game Integration', () => {
    test('should get resource amounts from game', () => {
      expect(storage.getResourceAmount('ore')).toBe(50);
      expect(storage.getResourceAmount('metal')).toBe(25);
      expect(storage.getResourceAmount('nonexistent')).toBe(0);
    });

    test('should handle missing game reference gracefully', () => {
      const isolatedStorage = new Storage({
        name: 'Isolated Storage',
        capacities: { ore: 100 }
      });

      expect(isolatedStorage.getResourceAmount('ore')).toBe(0);
      expect(isolatedStorage.hasCapacity('ore', 50)).toBe(true); // Should still work without game
    });

    test('should properly set and clear game reference', () => {
      expect(storage.game).toBe(game);

      storage.setGameReference(undefined);
      expect(storage.game).toBeUndefined();

      storage.setGameReference(game);
      expect(storage.game).toBe(game);
    });
  });

  describe('Built vs Unlocked Logic', () => {
    test('should not be built when not unlocked', () => {
      // Create a separate locked storage for this test
      const lockedStorage = new Storage({
        name: 'Locked Storage',
        unlockCondition: () => false // Never unlocks
      });
      lockedStorage.setGame(game);
      game.addEntity(lockedStorage);
      
      expect(lockedStorage.isBuilt).toBe(false);
    });

    test('should not be built when unlocked but building', () => {
      // Use debug construction for this specific test case
      storage.startConstruction(false); // Debug mode: start without spending
      expect(storage.isBuilt).toBe(false);
    });

    test('should be built after construction completes', async () => {
      storage.startConstruction(false); // Debug mode for test
      
      expect(storage.isBuilt).toBe(false);
      
      await fastForward(storage.buildTime * 1000);
      
      expect(storage.isBuilt).toBe(true);
    });

    test('should be instantly built if no build time', () => {
      const instantStorage = new Storage({
        name: 'Instant Storage',
        buildTime: 0,
        capacities: { ore: 50 }
      });
      game.addEntity(instantStorage);
      game.unlockEntity(instantStorage.id);

      expect(instantStorage.isBuilt).toBe(true);
    });
  });

  describe('Game Capacity Integration', () => {
    test('should not contribute to game capacity when not built', () => {
      storage.startConstruction(false); // Debug mode for test
      
      // Game should not count this storage's capacity
      const gameCapacity = game.getTotalCapacityFor('ore');
      expect(gameCapacity).toBe(0); // No built storage
    });

    test('should contribute to game capacity when built', async () => {
      storage.startConstruction(false); // Debug mode for test
      
      await fastForward(storage.buildTime * 1000);
      
      // Now game should count this storage's capacity
      const gameCapacity = game.getTotalCapacityFor('ore');
      expect(gameCapacity).toBe(100); // Storage is built
    });

    test('should contribute immediately if no build time', () => {
      const instantStorage = new Storage({
        name: 'Instant Storage',
        buildTime: 0,
        capacities: { ore: 75 }
      });
      instantStorage.setGame(game);
      game.addEntity(instantStorage);
      game.unlockEntity(instantStorage.id);

      const gameCapacity = game.getTotalCapacityFor('ore');
      expect(gameCapacity).toBe(75); // Instant storage contributes immediately
    });
  });

  describe('Event Emission', () => {
    test('should emit capacityChanged event', () => {
      const mockCallback = jest.fn();
      storage.on('capacityChanged', mockCallback);

      storage.setCapacityFor('ore', 120);

      expect(mockCallback).toHaveBeenCalledWith({
        resourceId: 'ore',
        oldCapacity: 100,
        newCapacity: 120
      });
    });

    test('should emit capacityReached event on unlock if already at capacity', () => {
      // Set resource to be at capacity
      oreResource.setAmount(100);
      
      const mockCallback = jest.fn();
      storage.on('capacityReached', mockCallback);

      storage.onUnlock();

      expect(mockCallback).toHaveBeenCalledWith({
        resourceId: 'ore',
        capacity: 100,
        currentAmount: 100
      });
    });

    test('should emit capacityReached events during updates', () => {
      oreResource.setAmount(100); // At capacity
      
      const mockCallback = jest.fn();
      storage.on('capacityReached', mockCallback);

      storage.onUpdate(1000);

      expect(mockCallback).toHaveBeenCalledWith({
        resourceId: 'ore',
        capacity: 100,
        currentAmount: 100
      });
    });
  });

  describe('Managed Resources', () => {
    test('should return correct managed resource IDs', () => {
      const managedIds = storage.getManagedResourceIds();
      expect(managedIds).toContain('ore');
      expect(managedIds).toContain('metal');
      expect(managedIds).toHaveLength(2);
    });

    test('should handle empty managed resources', () => {
      const emptyStorage = new Storage({
        name: 'Empty Storage'
      });

      expect(emptyStorage.getManagedResourceIds()).toHaveLength(0);
    });
  });
});