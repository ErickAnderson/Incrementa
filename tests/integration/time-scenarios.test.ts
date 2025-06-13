import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Game } from '../../src/core/game.js';
import { Resource } from '../../src/entities/resources/resource.js';
import { Storage } from '../../src/entities/buildings/storage.js';
import { Miner } from '../../src/entities/buildings/miner.js';
import { Factory } from '../../src/entities/buildings/factory.js';
import { Building } from '../../src/entities/buildings/building.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider, fastForward } from '../setup.js';

describe('Time-Based Integration Scenarios', () => {
  let game: Game;
  let saveManager: SaveManager;

  beforeEach(() => {
    const mockStorage = createMockStorageProvider();
    saveManager = new SaveManager(mockStorage);
    game = new Game(saveManager);
  });

  describe('5 Second Production Test', () => {
    test('miner should gather exactly 10 ore in 5 seconds at 2/sec rate', async () => {
      // Setup
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 0
      });

      const miner = new Miner({
        name: 'Test Miner',
        resourceId: 'ore',
        gatherRate: 2, // 2 per second
        autoStart: false,
        buildTime: 0 // Instant build
      });

      miner.setGame(game);
      miner.setGameReference(game);
      miner.isUnlocked = true;
      game.addEntity(miner);

      const initialAmount = ore.amount;

      // Start production
      expect(miner.startProduction()).toBe(true);

      // Simulate exactly 5 seconds of production
      for (let second = 0; second < 5; second++) {
        await fastForward(1000);
        miner.onUpdate(1000);
      }

      // Verify result
      const produced = ore.amount - initialAmount;
      expect(produced).toBeGreaterThanOrEqual(8); // Allow slight tolerance
      expect(produced).toBeLessThanOrEqual(12);
      
      // Should be close to 10 (2/sec * 5 sec)
      expect(Math.abs(produced - 10)).toBeLessThan(2);
    });

    test('factory should consume 15 ore and produce 5 metal in 5 seconds', async () => {
      // Setup: 3 ore -> 1 metal, 1 cycle per second
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 100
      });

      const metal = game.createResource({
        id: 'metal',
        name: 'Metal',
        initialAmount: 0
      });

      const factory = new Factory({
        name: 'Smelter',
        inputs: [{ resourceId: 'ore', amount: 3 }],
        outputs: [{ resourceId: 'metal', amount: 1 }],
        productionRate: 1, // 1 cycle per second
        autoStart: false,
        buildTime: 0
      });

      factory.setGame(game);
      factory.setGameReference(game);
      factory.isUnlocked = true;
      game.addEntity(factory);

      const initialOre = ore.amount;
      const initialMetal = metal.amount;

      // Start production
      expect(factory.startProduction()).toBe(true);

      // Simulate 5 seconds
      for (let second = 0; second < 5; second++) {
        await fastForward(1000);
        factory.onUpdate(1000);
      }

      // Verify consumption and production
      const oreConsumed = initialOre - ore.amount;
      const metalProduced = metal.amount - initialMetal;

      expect(oreConsumed).toBeGreaterThanOrEqual(12); // Should be around 15
      expect(oreConsumed).toBeLessThanOrEqual(18);
      
      expect(metalProduced).toBeGreaterThanOrEqual(4); // Should be around 5
      expect(metalProduced).toBeLessThanOrEqual(6);

      // 3:1 ratio should be maintained
      expect(Math.abs(oreConsumed - metalProduced * 3)).toBeLessThan(3);
    });
  });

  describe('Building Construction Timing', () => {
    test('building should complete construction in exactly specified time', async () => {
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 100
      });

      const building = new Building({
        name: 'Test Building',
        cost: { ore: 10 },
        buildTime: 3 // 3 seconds
      });

      building.setGame(game);
      building.isUnlocked = true;
      game.addEntity(building);

      // Start construction
      expect(building.startConstruction()).toBe(true);
      expect(building.isBuilding).toBe(true);
      expect(building.isBuilt).toBe(false);

      // After 2 seconds - should still be building
      await fastForward(2000);
      expect(building.isBuilding).toBe(true);
      expect(building.isBuilt).toBe(false);

      // After 3 seconds - should be complete
      await fastForward(1000);
      expect(building.isBuilding).toBe(false);
      expect(building.isBuilt).toBe(true);
    });

    test('storage should only contribute capacity after construction completes', async () => {
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 50
      });

      const storage = game.createStorage({
        name: 'Test Storage',
        cost: { ore: 20 },
        buildTime: 2, // 2 seconds to build
        capacities: { ore: 100 }
      });

      storage.isUnlocked = true;

      // Initially no capacity from unbuilt storage
      expect(game.getTotalCapacityFor('ore')).toBe(0);

      // Start construction
      expect(storage.startConstruction()).toBe(true);
      expect(game.getTotalCapacityFor('ore')).toBe(0); // Still no capacity

      // After 1 second - still building
      await fastForward(1000);
      expect(game.getTotalCapacityFor('ore')).toBe(0);

      // After 2 seconds - construction complete
      await fastForward(1000);
      expect(storage.isBuilt).toBe(true);
      expect(game.getTotalCapacityFor('ore')).toBe(100); // Now has capacity
    });
  });

  describe('Production Chain Scenarios', () => {
    test('complete ore -> metal -> energy chain over 10 seconds', async () => {
      // Setup resources
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 0
      });

      const metal = game.createResource({
        id: 'metal',
        name: 'Metal',
        initialAmount: 0
      });

      const energy = game.createResource({
        id: 'energy',
        name: 'Energy',
        initialAmount: 0
      });

      // Setup production chain
      const miner = new Miner({
        name: 'Ore Miner',
        resourceId: 'ore',
        gatherRate: 3, // 3 ore per second
        autoStart: false,
        buildTime: 0
      });

      const smelter = new Factory({
        name: 'Metal Smelter',
        inputs: [{ resourceId: 'ore', amount: 3 }],
        outputs: [{ resourceId: 'metal', amount: 1 }],
        productionRate: 1, // 1 cycle per second = 1 metal per second
        autoStart: false,
        buildTime: 0
      });

      const powerCore = new Factory({
        name: 'Power Core',
        inputs: [{ resourceId: 'metal', amount: 2 }],
        outputs: [{ resourceId: 'energy', amount: 1 }],
        productionRate: 0.5, // 0.5 cycles per second = 1 energy per 2 seconds
        autoStart: false,
        buildTime: 0
      });

      // Setup game references
      [miner, smelter, powerCore].forEach(building => {
        building.setGame(game);
        building.setGameReference(game);
        building.isUnlocked = true;
        game.addEntity(building);
      });

      // Start all production
      miner.startProduction();
      smelter.startProduction();
      powerCore.startProduction();

      // Run for 10 seconds
      for (let second = 0; second < 10; second++) {
        await fastForward(1000);
        miner.onUpdate(1000);
        smelter.onUpdate(1000);
        powerCore.onUpdate(1000);
      }

      // Expected results after 10 seconds:
      // Miner: 30 ore (3/sec * 10 sec)
      // Smelter: consumes ore, produces metal
      // Power Core: consumes metal, produces energy

      expect(ore.amount).toBeGreaterThan(0); // Some ore should remain
      expect(metal.amount).toBeGreaterThan(0); // Some metal should be produced
      expect(energy.amount).toBeGreaterThan(0); // Some energy should be produced

      // Energy production should be the bottleneck (0.5/sec)
      expect(energy.amount).toBeGreaterThanOrEqual(3); // Around 5 energy
      expect(energy.amount).toBeLessThanOrEqual(7);

      console.log('Chain results:', {
        ore: ore.amount,
        metal: metal.amount,
        energy: energy.amount
      });
    });

    test('production should stop when capacity is reached', async () => {
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 45 // Start close to capacity
      });

      const storage = game.createStorage({
        name: 'Small Storage',
        capacities: { ore: 50 }, // Very small capacity
        buildTime: 0
      });
      storage.isUnlocked = true;

      const miner = new Miner({
        name: 'Fast Miner',
        resourceId: 'ore',
        gatherRate: 10, // Very fast production
        autoStart: false,
        buildTime: 0
      });

      miner.setGame(game);
      miner.setGameReference(game);
      miner.isUnlocked = true;
      game.addEntity(miner);

      // Start production
      miner.startProduction();

      // Run for 3 seconds
      for (let second = 0; second < 3; second++) {
        await fastForward(1000);
        miner.onUpdate(1000);
      }

      // Should have stopped at capacity
      expect(ore.amount).toBeLessThanOrEqual(50);
      expect(miner.isCurrentlyProducing()).toBe(false); // Should have stopped
    });
  });

  describe('Passive Resource Generation', () => {
    test('resource should generate passively over 5 seconds', async () => {
      const energy = game.createResource({
        id: 'energy',
        name: 'Energy',
        initialAmount: 10,
        basePassiveRate: 2 // 2 per second passive
      });
      energy.isUnlocked = true;

      const initialAmount = energy.amount;

      // Simulate 5 seconds of passive generation
      for (let second = 0; second < 5; second++) {
        await fastForward(1000);
        energy.onUpdate(1000);
      }

      // Should have gained 10 energy (2/sec * 5 sec)
      const gained = energy.amount - initialAmount;
      expect(gained).toBeGreaterThanOrEqual(8);
      expect(gained).toBeLessThanOrEqual(12);
    });

    test('passive generation should respect capacity limits', async () => {
      const energy = game.createResource({
        id: 'energy',
        name: 'Energy',
        initialAmount: 47,
        basePassiveRate: 5 // 5 per second
      });
      energy.isUnlocked = true;
      energy.setGameReference(game);

      const storage = game.createStorage({
        name: 'Energy Storage',
        capacities: { energy: 50 },
        buildTime: 0
      });
      storage.isUnlocked = true;

      // Run for 2 seconds (would normally produce 10 energy)
      for (let second = 0; second < 2; second++) {
        await fastForward(1000);
        energy.onUpdate(1000);
      }

      // Should be capped at 50
      expect(energy.amount).toBeLessThanOrEqual(50);
    });
  });

  describe('Game Loop Integration', () => {
    test('full game loop should update all entities correctly', async () => {
      // Create a mini game scenario
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 0,
        basePassiveRate: 1 // 1/sec passive
      });
      ore.isUnlocked = true;

      const metal = game.createResource({
        id: 'metal',
        name: 'Metal',
        initialAmount: 0
      });

      const miner = new Miner({
        name: 'Auto Miner',
        resourceId: 'ore',
        gatherRate: 2,
        autoStart: false,
        buildTime: 1 // 1 second build time
      });

      miner.setGame(game);
      miner.setGameReference(game);
      miner.isUnlocked = true;
      game.addEntity(miner);

      // Start the game
      game.start();

      // Build the miner
      miner.startConstruction(false);

      // Simulate 3 seconds of game time
      for (let second = 0; second < 3; second++) {
        await fastForward(1000);
        game['gameLoop'](); // Call game loop directly
      }

      // After 3 seconds:
      // - Passive generation: 3 ore
      // - Miner builds after 1 sec, then produces for 2 sec: +4 ore
      // Total expected: ~7 ore

      expect(ore.amount).toBeGreaterThan(5);
      expect(ore.amount).toBeLessThan(10);
      expect(miner.isBuilt).toBe(true);
    });
  });

  describe('Complex Multi-Building Scenario', () => {
    test('multiple buildings with different build times should work correctly', async () => {
      const ore = game.createResource({
        id: 'ore',
        name: 'Ore',
        initialAmount: 200 // Enough for all construction
      });

      const metal = game.createResource({
        id: 'metal',
        name: 'Metal',
        initialAmount: 0
      });

      // Quick miner
      const miner1 = new Miner({
        name: 'Quick Miner',
        resourceId: 'ore',
        gatherRate: 1,
        buildTime: 1,
        cost: { ore: 20 },
        autoStart: false
      });

      // Slow miner
      const miner2 = new Miner({
        name: 'Slow Miner',
        resourceId: 'ore',
        gatherRate: 2,
        buildTime: 3,
        cost: { ore: 30 },
        autoStart: false
      });

      // Factory
      const factory = new Factory({
        name: 'Factory',
        inputs: [{ resourceId: 'ore', amount: 2 }],
        outputs: [{ resourceId: 'metal', amount: 1 }],
        productionRate: 1,
        buildTime: 2,
        cost: { ore: 40 },
        autoStart: false
      });

      [miner1, miner2, factory].forEach(building => {
        building.setGame(game);
        building.setGameReference(game);
        building.isUnlocked = true;
        game.addEntity(building);
      });

      // Start all construction simultaneously
      const constructionStartTime = Date.now();
      miner1.startConstruction();
      miner2.startConstruction();
      factory.startConstruction();

      // Track construction completion over time
      const completionTimes: Record<string, number> = {};

      for (let second = 0; second < 5; second++) {
        await fastForward(1000);

        if (miner1.isBuilt && !completionTimes.miner1) {
          completionTimes.miner1 = second + 1;
        }
        if (miner2.isBuilt && !completionTimes.miner2) {
          completionTimes.miner2 = second + 1;
        }
        if (factory.isBuilt && !completionTimes.factory) {
          completionTimes.factory = second + 1;
        }
      }

      // Verify construction times
      expect(completionTimes.miner1).toBe(1); // 1 second build time
      expect(completionTimes.factory).toBe(2); // 2 second build time
      expect(completionTimes.miner2).toBe(3); // 3 second build time

      // Start production on all completed buildings
      if (miner1.isBuilt) miner1.startProduction();
      if (miner2.isBuilt) miner2.startProduction();
      if (factory.isBuilt) factory.startProduction();

      // Run production for 2 more seconds
      for (let second = 0; second < 2; second++) {
        await fastForward(1000);
        [miner1, miner2, factory].forEach(building => {
          if (building.isBuilt) {
            building.onUpdate(1000);
          }
        });
      }

      // All buildings should be producing
      expect(miner1.isCurrentlyProducing()).toBe(true);
      expect(miner2.isCurrentlyProducing()).toBe(true);
      expect(factory.isCurrentlyProducing()).toBe(true);

      // Should have produced some metal
      expect(metal.amount).toBeGreaterThan(0);
    });
  });
});