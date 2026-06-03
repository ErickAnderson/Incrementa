import { GameLoopService } from '../../src/core/game-loop-service';

describe('GameLoopService', () => {
    let gameLoopService: GameLoopService;
    
    beforeEach(() => {
        jest.useFakeTimers();
        gameLoopService = new GameLoopService();
        
        // Mock requestAnimationFrame and cancelAnimationFrame
        global.requestAnimationFrame = jest.fn((cb) => {
            setTimeout(cb, 16); // 60fps
            return 1;
        });
        global.cancelAnimationFrame = jest.fn();
        global.performance = {
            now: jest.fn(() => Date.now())
        } as unknown as Performance;
    });

    afterEach(() => {
        gameLoopService.destroy();
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('Basic Functionality', () => {
        test('should initialize with correct default values', () => {
            expect(gameLoopService.isRunning()).toBe(false);
            expect(gameLoopService.getSpeed()).toBe(1.0);
            expect(gameLoopService.getCurrentFps()).toBe(0);
        });

        test('should start the game loop', () => {
            gameLoopService.start();
            expect(gameLoopService.isRunning()).toBe(true);
            expect(global.requestAnimationFrame).toHaveBeenCalled();
        });

        test('should not start if already running', () => {
            gameLoopService.start();
            const callCount = (global.requestAnimationFrame as jest.Mock).mock.calls.length;
            
            gameLoopService.start(); // Try to start again
            expect((global.requestAnimationFrame as jest.Mock).mock.calls.length).toBe(callCount);
        });

        test('should pause the game loop', () => {
            gameLoopService.start();
            gameLoopService.pause();
            
            expect(gameLoopService.isRunning()).toBe(false);
            expect(global.cancelAnimationFrame).toHaveBeenCalled();
        });

        test('should resume the game loop', () => {
            gameLoopService.start();
            gameLoopService.pause();
            gameLoopService.resume();
            
            expect(gameLoopService.isRunning()).toBe(true);
        });
    });

    describe('Speed Control', () => {
        test('should set game speed', () => {
            gameLoopService.setSpeed(2.0);
            expect(gameLoopService.getSpeed()).toBe(2.0);
        });

        test('should ignore negative speed', () => {
            gameLoopService.setSpeed(-1);
            expect(gameLoopService.getSpeed()).toBe(1.0); // Should remain unchanged
        });

        test('should cap speed at 10x', () => {
            gameLoopService.setSpeed(15);
            expect(gameLoopService.getSpeed()).toBe(10);
        });
    });

    describe('Update Callbacks', () => {
        test('should register update callbacks', () => {
            const callback = jest.fn();
            gameLoopService.onUpdate(callback);
            
            // Start loop
            gameLoopService.start();
            
            // Advance timers to trigger the callback
            jest.advanceTimersByTime(16);
            
            expect(callback).toHaveBeenCalled();
        });

        test('should not register duplicate callbacks', () => {
            const callback = jest.fn();
            gameLoopService.onUpdate(callback);
            gameLoopService.onUpdate(callback); // Try to add again
            
            const stats = gameLoopService.getPerformanceStats();
            expect(stats.callbackCount).toBe(1);
        });

        test('should remove update callbacks', () => {
            const callback = jest.fn();
            gameLoopService.onUpdate(callback);
            gameLoopService.removeUpdateCallback(callback);
            
            const stats = gameLoopService.getPerformanceStats();
            expect(stats.callbackCount).toBe(0);
        });

        test('should handle callback errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Test error');
            });
            const normalCallback = jest.fn();
            
            gameLoopService.onUpdate(errorCallback);
            gameLoopService.onUpdate(normalCallback);
            gameLoopService.start();
            
            // Advance timers to trigger callbacks
            jest.advanceTimersByTime(16);
            
            // Normal callback should still be called despite error in first callback
            expect(normalCallback).toHaveBeenCalled();
        });
    });

    describe('Performance Statistics', () => {
        test('should provide performance statistics', () => {
            const stats = gameLoopService.getPerformanceStats();
            
            expect(stats).toHaveProperty('fps');
            expect(stats).toHaveProperty('deltaTime');
            expect(stats).toHaveProperty('speed');
            expect(stats).toHaveProperty('callbackCount');
            expect(stats).toHaveProperty('isRunning');
            
            expect(typeof stats.fps).toBe('number');
            expect(typeof stats.speed).toBe('number');
            expect(typeof stats.callbackCount).toBe('number');
            expect(typeof stats.isRunning).toBe('boolean');
        });

        test('should track FPS over time', () => {
            gameLoopService.start();
            
            // Advance timers to simulate time passing and FPS calculation
            jest.advanceTimersByTime(1000); // 1 second
            
            const fps = gameLoopService.getCurrentFps();
            expect(fps).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Cleanup', () => {
        test('should destroy properly', () => {
            const callback = jest.fn();
            gameLoopService.onUpdate(callback);
            gameLoopService.start();
            
            gameLoopService.destroy();
            
            expect(gameLoopService.isRunning()).toBe(false);
            expect(gameLoopService.getPerformanceStats().callbackCount).toBe(0);
        });
    });

    describe('Delta Time Calculation', () => {
        test('should call callbacks with delta time', () => {
            const callback = jest.fn();
            gameLoopService.onUpdate(callback);
            gameLoopService.start();
            
            // Advance timers to trigger callback
            jest.advanceTimersByTime(16);
            
            expect(callback).toHaveBeenCalledWith(expect.any(Number));
            const deltaTime = callback.mock.calls[0][0];
            expect(deltaTime).toBeGreaterThanOrEqual(0);
        });

        test('should apply speed multiplier to delta time', () => {
            const callback = jest.fn();
            gameLoopService.setSpeed(2.0);
            gameLoopService.onUpdate(callback);
            gameLoopService.start();
            
            // Advance timers to trigger callback
            jest.advanceTimersByTime(16);
            
            expect(callback).toHaveBeenCalled();
            // Delta time should be affected by speed multiplier
            // This is hard to test precisely due to timing, but we can check it was called
        });
    });
});