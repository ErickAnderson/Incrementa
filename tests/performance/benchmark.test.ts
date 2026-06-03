import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Game } from '../../src/core/game.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider } from '../setup.js';

describe('Performance Benchmarks', () => {
    let game: Game;
    let saveManager: SaveManager;

    beforeEach(() => {
        // Use real timers for performance measurements
        jest.useRealTimers();
        
        // Mock browser APIs
        global.requestAnimationFrame = jest.fn((cb) => {
            setTimeout(cb, 16);
            return 1;
        });
        global.cancelAnimationFrame = jest.fn();
        // Use real performance.now for accurate timing
        if (!global.performance) {
            global.performance = {
                now: () => Date.now()
            } as unknown as Performance;
        }

        const mockStorage = createMockStorageProvider();
        saveManager = new SaveManager(mockStorage);
        game = new Game(saveManager);
    });

    afterEach(() => {
        if (game) {
            game.destroy();
        }
        jest.clearAllMocks();
    });

    describe('Entity Creation Performance', () => {
        test('should create 1000 resources efficiently', () => {
            const startTime = performance.now();

            for (let i = 0; i < 1000; i++) {
                game.createResource({
                    id: `resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: Math.random() * 100
                });
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Created 1000 resources in ${duration.toFixed(2)}ms`);
            
            // Should complete in reasonable time (less than 500ms)
            expect(duration).toBeLessThan(500);
            expect(game.getCurrentResources()).toHaveLength(1000);
        });

        test('should create 500 buildings efficiently', () => {
            const startTime = performance.now();

            for (let i = 0; i < 500; i++) {
                game.createBuilding({
                    id: `building-${i}`,
                    name: `Building ${i}`,
                    buildTime: 1000 + (i * 10)
                });
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Created 500 buildings in ${duration.toFixed(2)}ms`);
            
            // Should complete in reasonable time (less than 300ms)
            expect(duration).toBeLessThan(300);
            expect(game.getCurrentBuildings()).toHaveLength(500);
        });

        test('should create mixed entities efficiently', () => {
            const startTime = performance.now();

            // Create a mix of different entity types
            for (let i = 0; i < 100; i++) {
                game.createResource({
                    id: `mixed-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: i
                });

                game.createBuilding({
                    id: `mixed-building-${i}`,
                    name: `Building ${i}`,
                    buildTime: 1000
                });

                game.createStorage({
                    id: `mixed-storage-${i}`,
                    name: `Storage ${i}`,
                    capacities: {
                        [`mixed-resource-${i}`]: 1000
                    }
                });

                game.createUpgrade({
                    id: `mixed-upgrade-${i}`,
                    name: `Upgrade ${i}`,
                    effect: { multiplier: 1.1 }
                });
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Created 400 mixed entities in ${duration.toFixed(2)}ms`);
            
            // Should complete in reasonable time (less than 1 second)
            expect(duration).toBeLessThan(1000);
            expect(game.getCurrentResources()).toHaveLength(100);
            expect(game.getCurrentBuildings()).toHaveLength(200); // Buildings + Storage count as buildings
            expect(game.getStorageStatus()).toHaveLength(100);
            expect(game.getCurrentUpgrades()).toHaveLength(100);
        });
    });

    describe('Game Loop Performance', () => {
        test('should handle game loop with many entities efficiently', () => {
            // Create a substantial number of entities
            for (let i = 0; i < 200; i++) {
                const resource = game.createResource({
                    id: `loop-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: 0,
                    rate: 0.1 // Small passive generation
                });
            }

            // Create some miners for production
            for (let i = 0; i < 50; i++) {
                game.createMiner({
                    id: `loop-miner-${i}`,
                    name: `Miner ${i}`,
                    resourceId: `loop-resource-${i % 200}`,
                    gatherRate: 1,
                    buildTime: 0,
                    autoStart: false
                });
            }

            const startTime = performance.now();

            // Start the game and let it run briefly
            game.start();
            
            // Simulate several update cycles
            for (let cycle = 0; cycle < 100; cycle++) {
                // The game loop service will handle updates
                // We're measuring the overhead of starting/stopping
                if (cycle % 10 === 0) {
                    game.pause();
                    game.resume();
                }
            }

            game.pause();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Game loop with 250 entities for 100 cycles: ${duration.toFixed(2)}ms`);
            
            // Should handle efficiently (less than 1 second)
            expect(duration).toBeLessThan(1000);
        });

        test('should handle rapid start/stop cycles efficiently', () => {
            const startTime = performance.now();

            // Rapid start/stop cycles to test service overhead
            for (let i = 0; i < 100; i++) {
                game.start();
                game.pause();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`100 start/stop cycles: ${duration.toFixed(2)}ms`);
            
            // Should handle rapid cycles efficiently (less than 200ms)
            expect(duration).toBeLessThan(200);
        });
    });

    describe('Production System Performance', () => {
        test('should optimize production for many producers efficiently', () => {
            // Create resources and miners
            for (let i = 0; i < 100; i++) {
                game.createResource({
                    id: `prod-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: 1000
                });

                game.createMiner({
                    id: `prod-miner-${i}`,
                    name: `Miner ${i}`,
                    resourceId: `prod-resource-${i}`,
                    gatherRate: 1,
                    buildTime: 0,
                    autoStart: false
                });
            }

            // Unlock all miners
            for (let i = 0; i < 100; i++) {
                game.unlockEntity(`prod-miner-${i}`);
            }

            const startTime = performance.now();

            // Test production optimization
            const optimizationResult = game.optimizeProduction();
            
            // Test production statistics
            const stats = game.getGlobalProductionStats();
            
            // Test starting all production
            const startedProducers = game.startAllProduction();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Production optimization for 100 producers: ${duration.toFixed(2)}ms`);
            
            // Should handle efficiently (less than 100ms)
            expect(duration).toBeLessThan(100);
            expect(typeof optimizationResult.started).toBe('number');
            expect(typeof stats.totalProducers).toBe('number');
            expect(Array.isArray(startedProducers)).toBe(true);
        });

        test('should handle production bottleneck analysis efficiently', () => {
            // Create complex production chain
            const ore = game.createResource({
                id: 'ore',
                name: 'Ore',
                initialAmount: 50
            });

            const metal = game.createResource({
                id: 'metal',
                name: 'Metal',
                initialAmount: 0
            });

            // Create miners and factories
            for (let i = 0; i < 20; i++) {
                game.createMiner({
                    id: `chain-miner-${i}`,
                    name: `Miner ${i}`,
                    resourceId: 'ore',
                    gatherRate: 2,
                    buildTime: 0
                });
            }

            const startTime = performance.now();

            // Analyze bottlenecks
            const bottlenecks = game.getProductionBottlenecks();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Bottleneck analysis for 20 producers: ${duration.toFixed(2)}ms`);
            
            // Should analyze efficiently (less than 50ms)
            expect(duration).toBeLessThan(50);
            expect(typeof bottlenecks).toBe('object');
            expect(Array.isArray(bottlenecks.resourceShortages)).toBe(true);
            expect(Array.isArray(bottlenecks.capacityLimits)).toBe(true);
        });
    });

    describe('Save/Load Performance', () => {
        test('should save large game state efficiently', () => {
            // Create substantial game state
            for (let i = 0; i < 500; i++) {
                game.createResource({
                    id: `save-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: Math.random() * 1000
                });
            }

            for (let i = 0; i < 200; i++) {
                game.createBuilding({
                    id: `save-building-${i}`,
                    name: `Building ${i}`,
                    buildTime: 1000
                });
            }

            const startTime = performance.now();

            // Save the state
            game.saveState();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Saved game state (700 entities) in ${duration.toFixed(2)}ms`);
            
            // Should save efficiently (less than 100ms)
            expect(duration).toBeLessThan(100);
        });

        test('should load large game state efficiently', () => {
            // Create and save substantial game state first
            for (let i = 0; i < 300; i++) {
                const resource = game.createResource({
                    id: `load-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: i * 10
                });
            }

            game.saveState();

            const startTime = performance.now();

            // Load the state
            game.loadState();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Loaded game state (300 entities) in ${duration.toFixed(2)}ms`);
            
            // Should load efficiently (less than 50ms)
            expect(duration).toBeLessThan(50);
        });
    });

    describe('Memory Usage Optimization', () => {
        test('should handle entity cleanup efficiently', () => {
            const initialEntityCount = game.getCurrentResources().length + 
                                     game.getCurrentBuildings().length + 
                                     game.getCurrentUpgrades().length;

            // Create many entities
            const entityIds: string[] = [];
            for (let i = 0; i < 200; i++) {
                const resource = game.createResource({
                    id: `cleanup-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: 0
                });
                entityIds.push(resource.id);
            }

            expect(game.getCurrentResources().length).toBe(initialEntityCount + 200);

            const startTime = performance.now();

            // Remove all created entities
            for (const entityId of entityIds) {
                game.removeEntity(entityId);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Cleaned up 200 entities in ${duration.toFixed(2)}ms`);
            
            // Should cleanup efficiently (less than 100ms)
            expect(duration).toBeLessThan(100);
            expect(game.getCurrentResources().length).toBe(initialEntityCount);
        });

        test('should destroy game with many entities efficiently', () => {
            // Create substantial game state
            for (let i = 0; i < 300; i++) {
                game.createResource({
                    id: `destroy-resource-${i}`,
                    name: `Resource ${i}`,
                    initialAmount: 0
                });

                if (i < 100) {
                    game.createBuilding({
                        id: `destroy-building-${i}`,
                        name: `Building ${i}`,
                        buildTime: 1000
                    });
                }
            }

            game.start(); // Start the game to test service cleanup

            const startTime = performance.now();

            // Destroy the game and all its entities
            game.destroy();

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`Destroyed game with 400 entities in ${duration.toFixed(2)}ms`);
            
            // Should destroy efficiently (less than 200ms)
            expect(duration).toBeLessThan(200);
            expect(game.isGameRunning()).toBe(false);
        });
    });

    describe('Service Performance', () => {
        test('should handle GameLoopService operations efficiently', () => {
            const startTime = performance.now();

            // Test rapid service operations
            for (let i = 0; i < 50; i++) {
                game.setGameSpeed(1 + (i * 0.1));
                game.start();
                game.pause();
                game.resume();
                game.pause();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`50 GameLoopService operation cycles: ${duration.toFixed(2)}ms`);
            
            // Should handle service operations efficiently (less than 100ms)
            expect(duration).toBeLessThan(100);
        });

        test('should handle TimerCoordinator operations efficiently', () => {
            const startTime = performance.now();

            // Create and manage many timers
            for (let i = 0; i < 100; i++) {
                const timer = new (require('../../src/core/timer.js').Timer)({
                    totalTime: 1000,
                    tickRate: 100
                });
                
                game.addTimer(`perf-timer-${i}`, timer);
            }

            // Test timer operations
            for (let i = 0; i < 100; i++) {
                const timer = game.getTimer(`perf-timer-${i}`);
                expect(timer).toBeDefined();
            }

            // Remove all timers
            for (let i = 0; i < 100; i++) {
                game.removeTimer(`perf-timer-${i}`);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            console.log(`TimerCoordinator with 100 timers: ${duration.toFixed(2)}ms`);
            
            // Should handle timer operations efficiently (less than 50ms)
            expect(duration).toBeLessThan(50);
        });
    });
});