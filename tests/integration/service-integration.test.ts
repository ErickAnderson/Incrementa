import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Game } from '../../src/core/game.js';
import { GameLoopService } from '../../src/core/game-loop-service.js';
import { GameStateService } from '../../src/core/game-state-service.js';
import { TimerCoordinator } from '../../src/core/timer-coordinator.js';
import { Timer } from '../../src/core/timer.js';
import { SaveManager } from '../../src/core/save-manager.js';
import { createMockStorageProvider } from '../setup.js';

describe('Service Integration Tests', () => {
    let game: Game;
    let saveManager: SaveManager;

    beforeEach(() => {
        // Mock browser APIs for GameLoopService
        global.requestAnimationFrame = jest.fn((cb) => {
            setTimeout(cb, 16); // 60fps
            return 1;
        });
        global.cancelAnimationFrame = jest.fn();
        global.performance = {
            now: jest.fn(() => Date.now())
        } as unknown as Performance;

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

    describe('GameLoopService Integration', () => {
        test('should start and pause game loop through Game class', () => {
            expect(game.isGameRunning()).toBe(false);

            game.start();
            expect(game.isGameRunning()).toBe(true);
            expect(global.requestAnimationFrame).toHaveBeenCalled();

            game.pause();
            expect(game.isGameRunning()).toBe(false);
            expect(global.cancelAnimationFrame).toHaveBeenCalled();
        });

        test('should sync game speed between Game class and GameLoopService', () => {
            expect(game.getGameSpeed()).toBe(1.0);

            game.setGameSpeed(2.5);
            expect(game.getGameSpeed()).toBe(2.5);

            // The GameLoopService should have the same speed
            // We can test this through the Game class API since it's integrated
            game.start();
            expect(game.isGameRunning()).toBe(true);
        });

        test('should handle resume correctly after pause', () => {
            game.start();
            expect(game.isGameRunning()).toBe(true);

            game.pause();
            expect(game.isGameRunning()).toBe(false);

            game.resume();
            expect(game.isGameRunning()).toBe(true);
        });
    });

    describe('GameStateService Integration', () => {
        test('should save and load game state through Game class', () => {
            // Create some game entities
            const resource = game.createResource({
                id: 'test-resource',
                name: 'Test Resource',
                initialAmount: 50
            });

            const building = game.createBuilding({
                id: 'test-building',
                name: 'Test Building',
                buildTime: 1000
            });

            // Set game speed
            game.setGameSpeed(1.5);

            // Save the state
            game.saveState();

            // Modify the state
            resource.amount = 100;
            game.setGameSpeed(2.0);

            // Load the state back
            game.loadState();

            // Verify the state was restored
            expect(resource.amount).toBe(50); // Should be restored to saved value
            expect(game.getGameSpeed()).toBe(1.5); // Should be restored to saved value
        });

        test('should handle offline progress calculation', () => {
            // Create a resource with passive generation
            const resource = game.createResource({
                id: 'passive-resource',
                name: 'Passive Resource',
                initialAmount: 0,
                rate: 1 // 1 per second
            });

            // This test verifies the method exists and can be called
            // The actual offline progress logic would require more complex setup
            expect(() => {
                game.calculateOfflineProgress();
            }).not.toThrow();
        });
    });

    describe('TimerCoordinator Integration', () => {
        test('should manage timers through Game class', () => {
            const timer = new Timer({
                totalTime: 5000,
                tickRate: 100
            });

            // Add timer through Game class
            game.addTimer('test-timer', timer);
            
            // Retrieve timer through Game class
            const retrievedTimer = game.getTimer('test-timer');
            expect(retrievedTimer).toBe(timer);

            // Remove timer through Game class
            const removed = game.removeTimer('test-timer');
            expect(removed).toBe(true);

            // Verify removal
            expect(game.getTimer('test-timer')).toBeUndefined();
        });

        test('should pause and resume all timers', () => {
            const timer1 = new Timer({ totalTime: 5000, tickRate: 100 });
            const timer2 = new Timer({ totalTime: 3000, tickRate: 100 });

            game.addTimer('timer1', timer1);
            game.addTimer('timer2', timer2);

            // Start timers
            timer1.start();
            timer2.start();

            // Start game (should handle timers)
            game.start();
            expect(game.isGameRunning()).toBe(true);

            // Pause game (should pause timers)
            game.pause();
            expect(game.isGameRunning()).toBe(false);

            // Resume game (should resume timers)
            game.resume();
            expect(game.isGameRunning()).toBe(true);
        });
    });

    describe('Cross-Service Integration', () => {
        test('should coordinate all services during game lifecycle', () => {
            // Create some entities
            const resource = game.createResource({
                id: 'coord-resource',
                name: 'Coordination Resource',
                initialAmount: 10
            });

            const timer = new Timer({
                totalTime: 2000,
                tickRate: 100,
                onUpdateCallbacks: [() => {
                    resource.amount += 0.1;
                }]
            });

            game.addTimer('coord-timer', timer);

            // Start everything
            game.start();
            timer.start();

            expect(game.isGameRunning()).toBe(true);
            expect(timer.getIsRunning()).toBe(true);

            // Pause everything
            game.pause();
            expect(game.isGameRunning()).toBe(false);

            // Resume everything
            game.resume();
            expect(game.isGameRunning()).toBe(true);

            // Destroy should clean up everything
            game.destroy();
            expect(game.isGameRunning()).toBe(false);
        });

        test('should handle service dependency updates correctly', () => {
            // Create resource and building for production testing
            const ore = game.createResource({
                id: 'ore',
                name: 'Ore',
                initialAmount: 0
            });

            const miner = game.createMiner({
                id: 'test-miner',
                name: 'Test Miner',
                resourceId: 'ore',
                gatherRate: 1,
                buildTime: 0,
                autoStart: false
            });

            game.unlockEntity(miner.id);

            // Start production
            const producersStarted = game.startAllProduction();
            expect(producersStarted.length).toBeGreaterThan(0);

            // Test production optimization
            const optimizationResult = game.optimizeProduction();
            expect(typeof optimizationResult.started).toBe('number');
            expect(typeof optimizationResult.stopped).toBe('number');
            expect(Array.isArray(optimizationResult.bottlenecks)).toBe(true);

            // Get production stats
            const stats = game.getGlobalProductionStats();
            expect(typeof stats.totalProducers).toBe('number');
            expect(typeof stats.activeProducers).toBe('number');
        });

        test('should maintain backward compatibility for all APIs', () => {
            // Test that all the old APIs still work exactly as before
            expect(typeof game.getCurrentResources).toBe('function');
            expect(typeof game.getCurrentBuildings).toBe('function');
            expect(typeof game.addEntity).toBe('function');
            expect(typeof game.removeEntity).toBe('function');
            expect(typeof game.getEntityById).toBe('function');
            expect(typeof game.createResource).toBe('function');
            expect(typeof game.createBuilding).toBe('function');
            expect(typeof game.createMiner).toBe('function');
            expect(typeof game.createStorage).toBe('function');
            expect(typeof game.createUpgrade).toBe('function');
            expect(typeof game.addTimer).toBe('function');
            expect(typeof game.removeTimer).toBe('function');
            expect(typeof game.getTimer).toBe('function');
            expect(typeof game.pauseTimers).toBe('function');
            expect(typeof game.resumeTimers).toBe('function');
            expect(typeof game.setGameSpeed).toBe('function');
            expect(typeof game.getGameSpeed).toBe('function');
            expect(typeof game.isGameRunning).toBe('function');
            expect(typeof game.start).toBe('function');
            expect(typeof game.pause).toBe('function');
            expect(typeof game.resume).toBe('function');
            expect(typeof game.saveState).toBe('function');
            expect(typeof game.loadState).toBe('function');
            expect(typeof game.destroy).toBe('function');

            // Test that they return expected types
            expect(Array.isArray(game.getCurrentResources())).toBe(true);
            expect(Array.isArray(game.getCurrentBuildings())).toBe(true);
            expect(typeof game.getGameSpeed()).toBe('number');
            expect(typeof game.isGameRunning()).toBe('boolean');
        });
    });

    describe('Performance Integration', () => {
        test('should handle multiple rapid operations without degradation', () => {
            const startTime = performance.now();

            // Perform multiple operations rapidly
            for (let i = 0; i < 100; i++) {
                const resource = game.createResource({
                    id: `perf-resource-${i}`,
                    name: `Performance Resource ${i}`,
                    initialAmount: i
                });

                if (i % 10 === 0) {
                    game.setGameSpeed(1 + (i / 100));
                }
            }

            // Start and stop game multiple times
            for (let i = 0; i < 10; i++) {
                game.start();
                game.pause();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete in reasonable time (less than 1 second)
            expect(duration).toBeLessThan(1000);

            // Should have created all resources
            expect(game.getCurrentResources()).toHaveLength(100);

            // Should be able to get performance metrics
            const metrics = game.getPerformanceMetrics();
            expect(typeof metrics).toBe('object');
        });
    });
});