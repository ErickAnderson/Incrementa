import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Miner } from '../../src/entities/buildings/miner.js';
import { Factory } from '../../src/entities/buildings/factory.js';
import { Resource } from '../../src/entities/resources/resource.js';
import { Game } from '../../src/core/game.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider, fastForward } from '../setup.js';

describe('Producer Buildings', () => {
  let game: Game;
  let saveManager: SaveManager;
  let oreResource: Resource;
  let metalResource: Resource;
  let energyResource: Resource;

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

    energyResource = new Resource({
      id: 'energy',
      name: 'Energy',
      initialAmount: 25
    });

    game.addEntity(oreResource);
    game.addEntity(metalResource);
    game.addEntity(energyResource);
  });

  describe('Miner Production', () => {
    let miner: Miner;

    beforeEach(() => {
      miner = new Miner({
        id: 'test-miner',
        name: 'Test Miner',
        cost: { ore: 10 },
        buildTime: 1,
        resourceId: 'ore',
        gatherRate: 2, // 2 ore per second
        autoStart: false
      });

      miner.setGame(game);
      miner.setGameReference(game);
      miner.isUnlocked = true;
    });

    test('should initialize with correct production config', () => {
      expect(miner.resourceId).toBe('ore');
      expect(miner.gatherRate).toBe(2);
      expect(miner.productionConfig.outputs[0]).toEqual({
        resourceId: 'ore',
        amount: 2,
        efficiency: 1
      });
    });

    test('should start production successfully', () => {
      expect(miner.startProduction()).toBe(true);
      expect(miner.isCurrentlyProducing()).toBe(true);
    });

    test('should not start production when already producing', () => {
      miner.startProduction();
      expect(miner.startProduction()).toBe(false);
    });

    test('should produce resources over time - 1 second', async () => {
      const initialAmount = oreResource.amount;
      
      miner.startProduction();
      
      // Simulate 1 second of production
      await fastForward(1000);
      miner.onUpdate(1000);
      
      // Should produce 2 ore (rate of 2/sec for 1 second)
      expect(oreResource.amount).toBeGreaterThan(initialAmount);
    });

    test('should produce correct amount over 5 seconds', async () => {
      const initialAmount = oreResource.amount;
      
      miner.startProduction();
      
      // Simulate 5 seconds of production
      for (let i = 0; i < 5; i++) {
        await fastForward(1000);
        miner.onUpdate(1000);
      }
      
      // Should produce approximately 10 ore (2/sec * 5 seconds)
      const produced = oreResource.amount - initialAmount;
      expect(produced).toBeGreaterThanOrEqual(8); // Allow some tolerance
      expect(produced).toBeLessThanOrEqual(12);
    });

    test('should stop production when capacity is reached', () => {
      // Mock capacity to be very low
      jest.spyOn(game, 'hasGlobalCapacity').mockReturnValue(false);
      
      expect(miner.canProduce()).toBe(false);
      expect(miner.startProduction()).toBe(false);
    });

    test('should not produce when building', () => {
      miner.startConstruction(false);
      expect(miner.canProduce()).toBe(false);
      expect(miner.startProduction()).toBe(false);
    });

    test('should start automatically after build completion if autoStart is true', async () => {
      const autoMiner = new Miner({
        name: 'Auto Miner',
        resourceId: 'ore',
        gatherRate: 1,
        buildTime: 1,
        autoStart: true
      });
      autoMiner.setGame(game);
      autoMiner.setGameReference(game);
      autoMiner.isUnlocked = true;

      autoMiner.startConstruction(false);
      await fastForward(1000);

      expect(autoMiner.isCurrentlyProducing()).toBe(true);
    });

    test('should update gather rate and recalculate production', () => {
      miner.setGatherRate(5);
      
      expect(miner.gatherRate).toBe(5);
      expect(miner.productionConfig.outputs[0].amount).toBe(5);
    });

    test('should get effective gather rate with efficiency', () => {
      miner.productionConfig.efficiency.current = 1.5;
      
      expect(miner.getEffectiveGatherRate()).toBe(3); // 2 * 1.5
    });
  });

  describe('Factory Production', () => {
    let factory: Factory;

    beforeEach(() => {
      factory = new Factory({
        id: 'test-factory',
        name: 'Test Factory',
        cost: { ore: 25 },
        buildTime: 2,
        inputs: [{ resourceId: 'ore', amount: 3 }],
        outputs: [{ resourceId: 'metal', amount: 1 }],
        productionRate: 1, // 1 cycle per second
        autoStart: false
      });

      factory.setGame(game);
      factory.setGameReference(game);
      factory.isUnlocked = true;
    });

    test('should initialize with correct production config', () => {
      expect(factory.productionConfig.inputs).toEqual([
        { resourceId: 'ore', amount: 3 }
      ]);
      expect(factory.productionConfig.outputs).toEqual([
        { resourceId: 'metal', amount: 1 }
      ]);
      expect(factory.productionConfig.rate.current).toBe(1);
    });

    test('should check input requirements correctly', () => {
      expect(factory.hasRequiredInputs()).toBe(true); // We have 100 ore
      
      oreResource.setAmount(2); // Less than required 3
      expect(factory.hasRequiredInputs()).toBe(false);
    });

    test('should check output capacity correctly', () => {
      expect(factory.hasCapacityForOutputs()).toBe(true);
      
      jest.spyOn(game, 'hasGlobalCapacity').mockReturnValue(false);
      expect(factory.hasCapacityForOutputs()).toBe(false);
    });

    test('should start production when inputs available', () => {
      expect(factory.startProduction()).toBe(true);
      expect(factory.isCurrentlyProducing()).toBe(true);
    });

    test('should not start production when inputs insufficient', () => {
      oreResource.setAmount(2);
      expect(factory.startProduction()).toBe(false);
    });

    test('should consume inputs and produce outputs over time', async () => {
      const initialOre = oreResource.amount;
      const initialMetal = metalResource.amount;
      
      factory.startProduction();
      
      // Simulate production cycles for 3 seconds
      for (let i = 0; i < 3; i++) {
        await fastForward(1000);
        factory.onUpdate(1000);
      }
      
      // Should have consumed some ore and produced some metal
      expect(oreResource.amount).toBeLessThan(initialOre);
      expect(metalResource.amount).toBeGreaterThan(initialMetal);
      
      // Each cycle consumes 3 ore and produces 1 metal
      const oreConsumed = initialOre - oreResource.amount;
      const metalProduced = metalResource.amount - initialMetal;
      
      expect(oreConsumed).toBeGreaterThan(0);
      expect(metalProduced).toBeGreaterThan(0);
      expect(oreConsumed).toBe(metalProduced * 3); // 3:1 ratio
    });

    test('should stop production when inputs run out', async () => {
      oreResource.setAmount(6); // Only enough for 2 cycles
      
      factory.startProduction();
      
      // Run for several seconds
      for (let i = 0; i < 5; i++) {
        await fastForward(1000);
        factory.onUpdate(1000);
      }
      
      // Should have stopped producing when ore ran out
      expect(factory.isCurrentlyProducing()).toBe(false);
      expect(oreResource.amount).toBeLessThan(3); // Less than one cycle's worth
    });

    test('should track production statistics', async () => {
      factory.startProduction();
      
      await fastForward(2000);
      factory.onUpdate(2000);
      
      const stats = factory.getProductionStats();
      expect(stats.totalCycles).toBeGreaterThan(0);
      expect(stats.productionRates.metal).toBeGreaterThan(0);
      expect(stats.consumptionRates.ore).toBeGreaterThan(0);
    });

    test('should get input requirements with availability', () => {
      const requirements = factory.getInputRequirements();
      
      expect(requirements).toHaveLength(1);
      expect(requirements[0]).toEqual({
        resourceId: 'ore',
        amount: 3,
        available: 100
      });
    });

    test('should get output production with capacity info', () => {
      const outputs = factory.getOutputProduction();
      
      expect(outputs).toHaveLength(1);
      expect(outputs[0].resourceId).toBe('metal');
      expect(outputs[0].amount).toBe(1);
    });

    test('should update production rate correctly', () => {
      factory.setFactoryProductionRate(2);
      
      expect(factory.productionConfig.rate.current).toBe(2);
    });

    test('should calculate production efficiency correctly', () => {
      factory.productionConfig.efficiency.current = 1.25;
      
      expect(factory.getProductionEfficiency()).toBe(125);
    });
  });

  describe('Complex Factory Chain', () => {
    let smelter: Factory;
    let powerCore: Factory;

    beforeEach(() => {
      // Smelter: ore -> metal
      smelter = new Factory({
        name: 'Smelter',
        inputs: [{ resourceId: 'ore', amount: 3 }],
        outputs: [{ resourceId: 'metal', amount: 1 }],
        productionRate: 1,
        autoStart: false
      });

      // Power Core: metal -> energy
      powerCore = new Factory({
        name: 'Power Core',
        inputs: [{ resourceId: 'metal', amount: 2 }],
        outputs: [{ resourceId: 'energy', amount: 1 }],
        productionRate: 0.5, // Slower production
        autoStart: false
      });

      smelter.setGame(game);
      smelter.setGameReference(game);
      smelter.isUnlocked = true;

      powerCore.setGame(game);
      powerCore.setGameReference(game);
      powerCore.isUnlocked = true;
    });

    test('should handle production chain over time', async () => {
      const initialOre = oreResource.amount;
      const initialMetal = metalResource.amount;
      const initialEnergy = energyResource.amount;

      // Start both factories
      smelter.startProduction();
      powerCore.startProduction();

      // Run production for 10 seconds
      for (let i = 0; i < 10; i++) {
        await fastForward(1000);
        smelter.onUpdate(1000);
        powerCore.onUpdate(1000);
      }

      // Should have transformed ore -> metal -> energy
      expect(oreResource.amount).toBeLessThan(initialOre);
      expect(energyResource.amount).toBeGreaterThan(initialEnergy);

      // Metal might be higher or lower depending on production rates
      const metalChange = metalResource.amount - initialMetal;
      console.log('Metal change:', metalChange);
    });

    test('should stop power core when metal runs out', async () => {
      metalResource.setAmount(3); // Only enough for 1-2 cycles
      
      powerCore.startProduction();
      
      for (let i = 0; i < 5; i++) {
        await fastForward(1000);
        powerCore.onUpdate(1000);
      }

      expect(powerCore.isCurrentlyProducing()).toBe(false);
    });
  });
});