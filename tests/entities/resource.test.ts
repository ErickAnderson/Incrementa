import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Resource } from '../../src/entities/resources/resource.js';
import { Game } from '../../src/core/game.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider, fastForward } from '../setup.js';

describe('Resource Entity', () => {
  let resource: Resource;
  let game: Game;
  let saveManager: SaveManager;

  beforeEach(() => {
    const mockStorage = createMockStorageProvider();
    saveManager = new SaveManager(mockStorage);
    game = new Game(saveManager);
    
    resource = new Resource({
      id: 'test-resource',
      name: 'Test Resource',
      description: 'A test resource',
      initialAmount: 10,
      rate: 0,
      basePassiveRate: 1,
      isUnlocked: false // Explicitly set to false initially
    });
  });

  describe('Basic Operations', () => {
    test('should initialize with correct values', () => {
      expect(resource.id).toBe('test-resource');
      expect(resource.name).toBe('Test Resource');
      expect(resource.amount).toBe(10);
      expect(resource.rate).toBe(0);
      expect(resource.basePassiveRate).toBe(1);
    });

    test('should increment amount correctly', () => {
      expect(resource.increment(5)).toBe(true);
      expect(resource.amount).toBe(15);
    });

    test('should decrement amount correctly', () => {
      expect(resource.decrement(3)).toBe(true);
      expect(resource.amount).toBe(7);
    });

    test('should not allow negative decrements', () => {
      expect(resource.decrement(-5)).toBe(false);
      expect(resource.amount).toBe(10);
    });

    test('should not decrement below zero', () => {
      expect(resource.decrement(15)).toBe(false);
      expect(resource.amount).toBe(10);
    });

    test('should set amount correctly', () => {
      resource.setAmount(25);
      expect(resource.amount).toBe(25);
    });

    test('should not allow negative amounts when setting', () => {
      resource.setAmount(-5);
      expect(resource.amount).toBe(0);
    });
  });

  describe('Capacity Management', () => {
    beforeEach(() => {
      resource.setGameReference(game);
    });

    test('should allow increment when no capacity limit', () => {
      expect(resource.increment(100)).toBe(true);
      expect(resource.amount).toBe(110);
    });

    test('should respect capacity limits when game reference is set', () => {
      // Mock the game to return a capacity limit
      jest.spyOn(game, 'getTotalCapacityFor').mockReturnValue(20);
      jest.spyOn(game, 'hasGlobalCapacity').mockReturnValue(false);

      expect(resource.increment(15)).toBe(false);
      expect(resource.amount).toBe(10); // Should not change
    });

    test('should allow increment within capacity', () => {
      jest.spyOn(game, 'getTotalCapacityFor').mockReturnValue(20);
      jest.spyOn(game, 'hasGlobalCapacity').mockReturnValue(true);

      expect(resource.increment(5)).toBe(true);
      expect(resource.amount).toBe(15);
    });

    test('should check capacity when canIncrement is called', () => {
      jest.spyOn(game, 'hasGlobalCapacity').mockReturnValue(true);
      
      expect(resource.canIncrement(5)).toBe(true);
      
      jest.mocked(game.hasGlobalCapacity).mockReturnValue(false);
      expect(resource.canIncrement(5)).toBe(false);
    });
  });

  describe('Passive Production', () => {
    beforeEach(() => {
      resource.setGameReference(game);
    });

    test('should generate passive income over time', async () => {
      resource.isUnlocked = true;
      const initialAmount = resource.amount;
      
      // Simulate 1 second (1000ms) of game time
      resource.onUpdate(1000);
      
      // Should gain 1 unit (basePassiveRate * 1 second)
      expect(resource.amount).toBe(initialAmount + 1);
    });

    test('should generate correct passive income over 5 seconds', async () => {
      resource.isUnlocked = true;
      const initialAmount = resource.amount;
      
      // Simulate 5 seconds of game time
      resource.onUpdate(5000);
      
      // Should gain 5 units (basePassiveRate * 5 seconds)
      expect(resource.amount).toBe(initialAmount + 5);
    });

    test('should not generate passive income when unlocked is false', () => {
      resource.isUnlocked = false;
      const initialAmount = resource.amount;
      
      resource.onUpdate(1000);
      
      expect(resource.amount).toBe(initialAmount);
    });

    test('should respect capacity limits during passive generation', () => {
      resource.isUnlocked = true;
      jest.spyOn(game, 'getTotalCapacityFor').mockReturnValue(12);
      jest.spyOn(game, 'hasGlobalCapacity').mockImplementation((resourceId, amount) => {
        return resource.amount + amount <= 12;
      });

      resource.onUpdate(5000); // Would normally add 5, but capacity is 12
      
      expect(resource.amount).toBeLessThanOrEqual(12); // Should be capped at capacity
    });
  });

  describe('Event Emission', () => {
    test('should emit amountChanged event on increment', () => {
      const mockCallback = jest.fn();
      resource.on('amountChanged', mockCallback);

      resource.increment(5);

      expect(mockCallback).toHaveBeenCalledWith({
        resource,
        oldAmount: 10,
        newAmount: 15,
        change: 5
      });
    });

    test('should emit amountChanged event on decrement', () => {
      const mockCallback = jest.fn();
      resource.on('amountChanged', mockCallback);

      resource.decrement(3);

      expect(mockCallback).toHaveBeenCalledWith({
        resource,
        oldAmount: 10,
        newAmount: 7,
        change: -3
      });
    });

    test('should emit capacityExceeded event when increment is blocked', () => {
      resource.setGameReference(game);
      jest.spyOn(game, 'getTotalCapacityFor').mockReturnValue(15);
      jest.spyOn(game, 'hasGlobalCapacity').mockReturnValue(false);
      jest.spyOn(game, 'getRemainingCapacityFor').mockReturnValue(3);

      const mockCallback = jest.fn();
      resource.on('capacityExceeded', mockCallback);

      resource.increment(10);

      expect(mockCallback).toHaveBeenCalledWith({
        resourceId: 'test-resource',
        attemptedAmount: 10,
        currentAmount: 10,
        totalCapacity: 15,
        remainingCapacity: 3
      });
    });
  });

  describe('Unlock Conditions', () => {
    test('should be locked initially when unlock condition provided', () => {
      const resourceWithCondition = new Resource({
        name: 'Locked Resource',
        unlockCondition: () => false
      });

      expect(resourceWithCondition.isUnlocked).toBe(false);
    });

    test('should unlock when condition is met', () => {
      let shouldUnlock = false;
      const resourceWithCondition = new Resource({
        name: 'Conditional Resource',
        unlockCondition: () => shouldUnlock
      });

      expect(resourceWithCondition.checkUnlockCondition()).toBe(false);
      
      shouldUnlock = true;
      expect(resourceWithCondition.checkUnlockCondition()).toBe(true);
      
      resourceWithCondition.unlock();
      expect(resourceWithCondition.isUnlocked).toBe(true);
    });
  });

  describe('Game Integration', () => {
    test('should properly integrate with game instance', () => {
      resource.setGameReference(game);
      
      expect(resource.game).toBe(game);
    });

    test('should clear game reference when set to undefined', () => {
      resource.setGameReference(game);
      resource.setGameReference(undefined);
      
      expect(resource.game).toBeUndefined();
    });
  });
});