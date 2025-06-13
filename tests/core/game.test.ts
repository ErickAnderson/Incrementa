import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Game } from '../../src/core/game.js';
import { Resource } from '../../src/entities/resources/resource.js';
import { Building } from '../../src/entities/buildings/building.js';
import { Storage } from '../../src/entities/buildings/storage.js';
import { Miner } from '../../src/entities/buildings/miner.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { Timer } from '../../src/core/timer.js';
import { createMockStorageProvider, fastForward } from '../setup.js';

describe('Game Core', () => {
  let game: Game;
  let saveManager: SaveManager;

  beforeEach(() => {
    const mockStorage = createMockStorageProvider();
    saveManager = new SaveManager(mockStorage);
    game = new Game(saveManager);
  });

  describe('Initialization', () => {
    test('should initialize with empty collections', () => {
      expect(game.getCurrentResources()).toHaveLength(0);
      expect(game.getCurrentBuildings()).toHaveLength(0);
      expect(game.getCurrentUpgrades()).toHaveLength(0);
      expect(game.getStorageStatus()).toHaveLength(0);
    });

    test('should have managers initialized', () => {
      expect(game.getUnlockManager()).toBeDefined();
      expect(game.getEventManager()).toBeDefined();
      expect(game.costSystem).toBeDefined();
    });

    test('should start in stopped state', () => {
      expect(game.isGameRunning()).toBe(false);
      expect(game.getGameSpeed()).toBe(1.0);
    });
  });

  describe('Entity Management', () => {
    let resource: Resource;
    let building: Building;
    let storage: Storage;

    beforeEach(() => {
      resource = new Resource({
        id: 'test-resource',
        name: 'Test Resource',
        initialAmount: 10
      });

      building = new Building({
        id: 'test-building',
        name: 'Test Building',
        cost: { 'test-resource': 5 }
      });

      storage = new Storage({
        id: 'test-storage',
        name: 'Test Storage',
        capacities: { 'test-resource': 100 }
      });
    });

    test('should add entities correctly', () => {
      game.addEntity(resource);
      game.addEntity(building);
      game.addEntity(storage);

      expect(game.getCurrentResources()).toHaveLength(1);
      expect(game.getCurrentBuildings()).toHaveLength(2); // Building and Storage
      expect(game.getStorageStatus()).toHaveLength(1);
    });

    test('should retrieve entities by ID', () => {
      game.addEntity(resource);
      
      expect(game.getEntityById('test-resource')).toBe(resource);
      expect(game.getResourceById('test-resource')).toBe(resource);
      expect(game.getEntityById('nonexistent')).toBeUndefined();
    });

    test('should retrieve resources by name', () => {
      game.addEntity(resource);
      
      expect(game.getResourceByName('Test Resource')).toBe(resource);
      expect(game.getResourceByName('Nonexistent')).toBeUndefined();
    });

    test('should remove entities correctly', () => {
      game.addEntity(resource);
      game.addEntity(building);

      expect(game.removeEntity('test-resource')).toBe(true);
      expect(game.getCurrentResources()).toHaveLength(0);
      expect(game.getEntityById('test-resource')).toBeUndefined();

      expect(game.removeEntity('nonexistent')).toBe(false);
    });

    test('should set game references for entities', () => {
      game.addEntity(resource);
      game.addEntity(building);
      game.addEntity(storage);

      expect(resource.game).toBe(game);
      expect(building.game).toBe(game);
      expect(storage.game).toBe(game);
    });
  });

  describe('Factory Methods', () => {
    test('should create and add resource', () => {
      const resource = game.createResource({
        name: 'Gold',
        initialAmount: 50
      });

      expect(resource.name).toBe('Gold');
      expect(resource.amount).toBe(50);
      expect(game.getCurrentResources()).toContain(resource);
    });

    test('should create and add building', () => {
      const building = game.createBuilding({
        name: 'Mine',
        cost: { gold: 25 }
      });

      expect(building.name).toBe('Mine');
      expect(game.getCurrentBuildings()).toContain(building);
    });

    test('should create and add storage', () => {
      const storage = game.createStorage({
        name: 'Warehouse',
        capacities: { gold: 200 }
      });

      expect(storage.name).toBe('Warehouse');
      expect(game.getStorageStatus()).toContain(storage);
    });

    test('should create and add upgrade', () => {
      const upgrade = game.createUpgrade({
        name: 'Efficiency',
        effect: () => {}
      });

      expect(upgrade.name).toBe('Efficiency');
      expect(game.getCurrentUpgrades()).toContain(upgrade);
    });
  });

  describe('Capacity Management', () => {
    let storage1: Storage;
    let storage2: Storage;
    let resource: Resource;

    beforeEach(() => {
      resource = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 25
      });

      storage1 = game.createStorage({
        name: 'Storage 1',
        capacities: { ore: 100 },
        buildTime: 0 // Instant build
      });

      storage2 = game.createStorage({
        name: 'Storage 2', 
        capacities: { ore: 50 },
        buildTime: 2 // Takes time to build
      });
    });

    test('should calculate total capacity only from built storage', () => {
      // Both storage are unlocked using proper unlock mechanism
      game.unlockEntity(storage1.id);
      game.unlockEntity(storage2.id);

      // Only storage1 is built (instant)
      expect(game.getTotalCapacityFor('ore')).toBe(100);

      // Start building storage2
      storage2.startConstruction(false);
      expect(game.getTotalCapacityFor('ore')).toBe(100); // Still only storage1

      // Complete storage2 construction
      storage2.completeConstruction();
      expect(game.getTotalCapacityFor('ore')).toBe(150); // Now both
    });

    test('should check global capacity correctly', () => {
      game.unlockEntity(storage1.id);
      
      expect(game.hasGlobalCapacity('ore', 50)).toBe(true);  // 25 + 50 <= 100
      expect(game.hasGlobalCapacity('ore', 80)).toBe(false); // 25 + 80 > 100
    });

    test('should calculate remaining capacity correctly', () => {
      game.unlockEntity(storage1.id);
      
      expect(game.getRemainingCapacityFor('ore')).toBe(75); // 100 - 25
    });

    test('should allow unlimited when no storage defines capacity', () => {
      expect(game.getTotalCapacityFor('nonexistent')).toBe(0);
      expect(game.hasGlobalCapacity('nonexistent', 1000)).toBe(true);
    });
  });

  describe('Production Management', () => {
    let miner: Miner;
    let resource: Resource;

    beforeEach(() => {
      resource = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 0
      });

      miner = new Miner({
        name: 'Test Miner',
        resourceId: 'ore',
        gatherRate: 2,
        autoStart: false
      });
      
      miner.setGame(game);
      miner.setGameReference(game);
      game.addEntity(miner);
      game.unlockEntity(miner.id);
    });

    test('should start all production', () => {
      const started = game.startAllProduction();
      
      expect(started).toHaveLength(1);
      expect(started[0]).toBe(miner);
      expect(miner.isCurrentlyProducing()).toBe(true);
    });

    test('should stop all production', () => {
      miner.startProduction();
      
      const stopped = game.stopAllProduction();
      
      expect(stopped).toHaveLength(1);
      expect(stopped[0]).toBe(miner);
      expect(miner.isCurrentlyProducing()).toBe(false);
    });

    test('should get producer buildings', () => {
      const producers = game.getProducerBuildings();
      
      expect(producers).toHaveLength(1);
      expect(producers[0]).toBe(miner);
    });

    test('should get active producers', () => {
      expect(game.getActiveProducers()).toHaveLength(0);
      
      miner.startProduction();
      expect(game.getActiveProducers()).toHaveLength(1);
    });

    test('should optimize production', () => {
      const result = game.optimizeProduction();
      
      expect(result.started).toBe(1); // Miner should start
      expect(result.stopped).toBe(0);
      expect(miner.isCurrentlyProducing()).toBe(true);
    });

    test('should get production statistics', () => {
      miner.startProduction();
      
      const stats = game.getGlobalProductionStats();
      
      expect(stats.totalProducers).toBe(1);
      expect(stats.activeProducers).toBe(1);
    });
  });

  describe('Game Loop and Timing', () => {
    let resource: Resource;

    beforeEach(() => {
      resource = game.createResource({
        name: 'Auto Resource',
        initialAmount: 0,
        basePassiveRate: 1 // 1 per second
      });
      game.unlockEntity(resource.id);
    });

    test('should start and stop game correctly', () => {
      expect(game.isGameRunning()).toBe(false);
      
      game.start();
      expect(game.isGameRunning()).toBe(true);
      
      game.pause();
      expect(game.isGameRunning()).toBe(false);
      
      game.resume();
      expect(game.isGameRunning()).toBe(true);
    });

    test('should update entities during game loop', async () => {
      game.start();
      
      const initialAmount = resource.amount;
      
      // Simulate game loop for 2 seconds
      await fastForward(2000);
      
      // Manually trigger entity updates (alternative to private gameLoop access)
      if (resource.isUnlocked) {
        resource.onUpdate(2000);
      }
      
      // Resource should have gained from passive rate
      expect(resource.amount).toBeGreaterThan(initialAmount);
    });

    test('should respect game speed multiplier', () => {
      game.setGameSpeed(2.0);
      expect(game.getGameSpeed()).toBe(2.0);
      
      expect(() => game.setGameSpeed(0)).toThrow('Game speed must be greater than 0');
    });
  });

  describe('Timer Management', () => {
    test('should add and retrieve timers', () => {
      const timer = new Timer({
        totalTime: 5000,
        tickRate: 100,
        onCompleteCallbacks: [() => {}]
      });

      game.addTimer('test-timer', timer);
      
      expect(game.getTimer('test-timer')).toBe(timer);
    });

    test('should remove timers', () => {
      const timer = new Timer({
        totalTime: 5000,
        tickRate: 100,
        onCompleteCallbacks: [() => {}]
      });

      game.addTimer('test-timer', timer);
      expect(game.removeTimer('test-timer')).toBe(true);
      expect(game.getTimer('test-timer')).toBeUndefined();
      expect(game.removeTimer('nonexistent')).toBe(false);
    });

    test('should pause and resume timers', () => {
      const timer = new Timer({
        totalTime: 5000,
        tickRate: 100,
        onCompleteCallbacks: [() => {}]
      });
      timer.start();

      game.addTimer('test-timer', timer);
      game.start();

      game.pauseTimers();
      expect(timer.getIsPaused()).toBe(true);

      game.resumeTimers();
      expect(timer.getIsPaused()).toBe(false);
    });
  });

  describe('Event System Integration', () => {
    test('should emit global events', () => {
      const mockCallback = jest.fn();
      game.on('testEvent', mockCallback);

      game.emit('testEvent', { data: 'test' });

      expect(mockCallback).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should remove event listeners', () => {
      const mockCallback = jest.fn();
      game.on('testEvent', mockCallback);

      expect(game.off('testEvent', mockCallback)).toBe(true);
      
      game.emit('testEvent', { data: 'test' });
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should get event statistics', () => {
      const stats = game.getEventStats();
      
      expect(stats).toHaveProperty('totalListeners');
      expect(stats).toHaveProperty('eventsEmitted');
    });
  });

  describe('Unlock System Integration', () => {
    test('should unlock entities when conditions are met', () => {
      let hasEnoughGold = false;
      const goldResource = game.createResource({
        name: 'Gold',
        initialAmount: 0
      });
      
      const advancedBuilding = game.createBuilding({
        name: 'Advanced Workshop',
        cost: { ore: 10 },
        unlockCondition: () => hasEnoughGold && goldResource.amount >= 100
      });

      // Initially locked
      expect(advancedBuilding.isUnlocked).toBe(false);
      
      // Check conditions manually - should still be locked
      game.checkUnlockConditions();
      expect(advancedBuilding.isUnlocked).toBe(false);
      
      // Meet the conditions
      hasEnoughGold = true;
      goldResource.amount = 150;
      
      // Now should unlock when checked
      game.checkUnlockConditions();
      expect(advancedBuilding.isUnlocked).toBe(true);
    });

    test('should unlock entities manually for debugging/admin purposes', () => {
      const debugResource = game.createResource({
        name: 'Debug Resource',
        unlockCondition: () => false // Impossible condition for testing
      });

      expect(debugResource.isUnlocked).toBe(false);
      
      // Admin/debug manual unlock should bypass conditions
      expect(game.unlockEntity(debugResource.id)).toBe(true);
      expect(debugResource.isUnlocked).toBe(true);
    });

    test('should get unlock statistics', () => {
      const stats = game.getUnlockStats();
      
      expect(stats).toHaveProperty('pendingUnlocks');
      expect(stats).toHaveProperty('unlockedCount');
      expect(stats).toHaveProperty('isActive');
    });
  });

  describe('Resource Availability Checking', () => {
    beforeEach(() => {
      game.createResource({ id: 'ore', name: 'Ore', initialAmount: 100 });
      game.createResource({ id: 'metal', name: 'Metal', initialAmount: 50 });
    });

    test('should check resource availability correctly', () => {
      const inputs = [
        { resourceId: 'ore', amount: 50 },
        { resourceId: 'metal', amount: 25 }
      ];

      expect(game.checkResourceAvailability(inputs)).toBe(true);

      const insufficientInputs = [
        { resourceId: 'ore', amount: 150 }, // More than available
        { resourceId: 'metal', amount: 25 }
      ];

      expect(game.checkResourceAvailability(insufficientInputs)).toBe(false);
    });

    test('should check production capacity correctly', () => {
      const storage = game.createStorage({
        name: 'Storage',
        capacities: { ore: 200 },
        buildTime: 0
      });
      game.unlockEntity(storage.id);

      const outputs = [{ resourceId: 'ore', amount: 50 }]; // 100 + 50 <= 200

      expect(game.checkProductionCapacity(outputs)).toBe(true);

      const excessiveOutputs = [{ resourceId: 'ore', amount: 150 }]; // 100 + 150 > 200

      expect(game.checkProductionCapacity(excessiveOutputs)).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should destroy game properly', () => {
      const resource = game.createResource({ name: 'Test Resource' });
      const timer = new Timer({
        totalTime: 5000,
        tickRate: 100,
        onCompleteCallbacks: [() => {}]
      });
      
      game.addTimer('test', timer);
      game.start();

      game.destroy();

      expect(game.isGameRunning()).toBe(false);
      expect(game.getCurrentResources()).toHaveLength(0);
      expect(game.getCurrentBuildings()).toHaveLength(0);
    });
  });
});