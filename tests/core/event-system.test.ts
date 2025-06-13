import { Game } from "../../src/core/game";
import { SaveManager } from "../../src/core/save-manager";
import { setupGameWithBasicResources, createUnlockedResource } from "../setup";
import type { SystemEvent, SystemEventType, EventSubscriptionOptions } from "../../src/types/system-events";

describe('Enhanced Event System', () => {
  let game: Game;

  beforeEach(() => {
    const saveManager = new SaveManager();
    const setup = setupGameWithBasicResources(saveManager);
    game = setup.game;
  });

  describe('System Event Emission', () => {
    test('should emit system events with structured data', () => {
      const eventHandler = jest.fn();
      
      game.eventManager.onSystemEvent('resourceGenerated', eventHandler);
      
      const eventData = {
        resourceId: 'gold',
        amount: 100,
        entityId: 'test-entity'
      };
      
      game.eventManager.emitSystemEvent('resourceGenerated', eventData);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'resourceGenerated',
          data: expect.objectContaining({
            resourceId: 'gold',
            amount: 100,
            entityId: 'test-entity',
            timestamp: expect.any(Number)
          }),
          timestamp: expect.any(Number)
        })
      );
    });

    test('should emit to both global and entity listeners', () => {
      const globalHandler = jest.fn();
      const entityHandler = jest.fn();
      
      const resource = createUnlockedResource({ name: 'Gold' });
      game.addEntity(resource);
      
      game.eventManager.onSystemEvent('amountChanged', globalHandler);
      game.eventManager.onEntity(resource.id, 'amountChanged', entityHandler);
      
      const eventData = {
        entityId: resource.id,
        resourceId: 'gold',
        oldAmount: 0,
        newAmount: 100
      };
      
      game.eventManager.emitSystemEvent('amountChanged', eventData);
      
      expect(globalHandler).toHaveBeenCalled();
      expect(entityHandler).toHaveBeenCalled();
    });
  });

  describe('Event Filtering and Subscription Options', () => {
    test('should filter events by entity ID', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      const resource1 = createUnlockedResource({ name: 'Gold' });
      const resource2 = createUnlockedResource({ name: 'Iron' });
      game.addEntity(resource1);
      game.addEntity(resource2);
      
      const options: EventSubscriptionOptions = {
        entityId: resource1.id
      };
      
      game.eventManager.onSystemEvent('amountChanged', handler1, options);
      game.eventManager.onSystemEvent('amountChanged', handler2); // No filter
      
      // Emit event for resource1
      game.eventManager.emitSystemEvent('amountChanged', { entityId: resource1.id });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      
      // Emit event for resource2
      game.eventManager.emitSystemEvent('amountChanged', { entityId: resource2.id });
      expect(handler1).toHaveBeenCalledTimes(1); // Should not increase
      expect(handler2).toHaveBeenCalledTimes(2); // Should increase
    });

    test('should handle once subscription option', () => {
      const handler = jest.fn();
      
      const options: EventSubscriptionOptions = {
        once: true
      };
      
      game.eventManager.onSystemEvent('testEvent', handler, options);
      
      game.eventManager.emitSystemEvent('testEvent', {});
      game.eventManager.emitSystemEvent('testEvent', {});
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should filter events by tags', () => {
      const handler = jest.fn();
      
      const resource1 = createUnlockedResource({ name: 'Gold', tags: ['precious'] });
      const resource2 = createUnlockedResource({ name: 'Iron', tags: ['common'] });
      game.addEntity(resource1);
      game.addEntity(resource2);
      
      const options: EventSubscriptionOptions = {
        tags: ['precious']
      };
      
      game.eventManager.onSystemEvent('amountChanged', handler, options);
      
      // Event from precious resource
      game.eventManager.emitSystemEvent('amountChanged', { 
        entityId: resource1.id,
        entity: resource1 
      });
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Event from common resource
      game.eventManager.emitSystemEvent('amountChanged', { 
        entityId: resource2.id,
        entity: resource2 
      });
      expect(handler).toHaveBeenCalledTimes(1); // Should not increase
    });

    test('should apply custom filter functions', () => {
      const handler = jest.fn();
      
      const options: EventSubscriptionOptions = {
        filter: (event: SystemEvent) => event.data.amount > 100
      };
      
      game.eventManager.onSystemEvent('amountChanged', handler, options);
      
      // Event with amount > 100\n      game.eventManager.emitSystemEvent('amountChanged', { amount: 150 });
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Event with amount <= 100
      game.eventManager.emitSystemEvent('amountChanged', { amount: 50 });
      expect(handler).toHaveBeenCalledTimes(1); // Should not increase
    });
  });

  describe('Event Middleware', () => {
    test('should process events through middleware', () => {
      const middlewareHandler = jest.fn((event: SystemEvent, next: () => void) => {
        event.data.processed = true;
        next();
      });
      
      const eventHandler = jest.fn();
      
      game.eventManager.addMiddleware(middlewareHandler);
      game.eventManager.onSystemEvent('testEvent', eventHandler);
      
      game.eventManager.emitSystemEvent('testEvent', { test: 'data' });
      
      expect(middlewareHandler).toHaveBeenCalled();
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            test: 'data',
            processed: true
          })
        })
      );
    });

    test('should handle middleware errors gracefully', () => {
      const errorMiddleware = jest.fn(() => {
        throw new Error('Middleware error');
      });
      
      const eventHandler = jest.fn();
      
      game.eventManager.addMiddleware(errorMiddleware);
      game.eventManager.onSystemEvent('testEvent', eventHandler);
      
      // Should not throw and should still call event handler
      expect(() => {
        game.eventManager.emitSystemEvent('testEvent', {});
      }).not.toThrow();
      
      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Event History and Debugging', () => {
    test('should track event history', () => {
      game.eventManager.emitSystemEvent('testEvent1', { data: 'first' });
      game.eventManager.emitSystemEvent('testEvent2', { data: 'second' });
      
      const history = game.eventManager.getEventHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('testEvent1');
      expect(history[1].type).toBe('testEvent2');
    });

    test('should filter event history', () => {
      const resource = createUnlockedResource({ name: 'Gold' });
      game.addEntity(resource);
      
      game.eventManager.emitSystemEvent('amountChanged', { entityId: resource.id });
      game.eventManager.emitSystemEvent('testEvent', { entityId: 'other' });
      
      const filteredHistory = game.eventManager.getEventHistory({
        entityId: resource.id
      });
      
      expect(filteredHistory).toHaveLength(1);
      expect(filteredHistory[0].type).toBe('amountChanged');
    });

    test('should clear event history', () => {
      game.eventManager.emitSystemEvent('testEvent', {});
      
      expect(game.eventManager.getEventHistory()).toHaveLength(1);
      
      game.eventManager.clearEventHistory();
      
      expect(game.eventManager.getEventHistory()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle event listener errors', () => {
      const errorHandler = jest.fn();
      const workingHandler = jest.fn();
      const systemErrorHandler = jest.fn();
      
      game.eventManager.onError(systemErrorHandler);
      
      game.eventManager.onSystemEvent('testEvent', () => {
        throw new Error('Handler error');
      });
      game.eventManager.onSystemEvent('testEvent', workingHandler);
      
      game.eventManager.emitSystemEvent('testEvent', {});
      
      expect(systemErrorHandler).toHaveBeenCalled();
      expect(workingHandler).toHaveBeenCalled(); // Should still be called
    });
  });

  describe('Performance Metrics', () => {
    test('should track event statistics', () => {
      const handler = jest.fn();
      
      game.eventManager.onSystemEvent('testEvent', handler);
      
      game.eventManager.emitSystemEvent('testEvent', {});
      game.eventManager.emitSystemEvent('testEvent', {});
      
      const stats = game.eventManager.getEventStats();
      
      expect(stats.eventsEmitted).toBeGreaterThanOrEqual(2);
      expect(stats.totalListeners).toBeGreaterThanOrEqual(1);
      expect(stats.eventTypes).toContain('testEvent');
      expect(stats.averageEmissionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Entity Event Routing', () => {
    test('should route entity events through global manager', () => {
      const globalHandler = jest.fn();
      const entityHandler = jest.fn();
      
      const resource = createUnlockedResource({ name: 'Gold' });
      
      game.eventManager.onSystemEvent('amountChanged', globalHandler);
      game.eventManager.onEntity(resource.id, 'amountChanged', entityHandler);
      game.eventManager.routeEntityEvents(resource);
      
      // Emit through entity (should route to global manager)
      resource.emit('amountChanged', { amount: 100 });
      
      expect(globalHandler).toHaveBeenCalled();
      expect(entityHandler).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('should clean up resources on destroy', () => {
      const handler = jest.fn();
      
      game.eventManager.onSystemEvent('testEvent', handler);
      game.eventManager.emitSystemEvent('testEvent', {});
      
      expect(handler).toHaveBeenCalled();
      
      game.eventManager.destroy();
      
      // Should not throw or cause issues
      game.eventManager.emitSystemEvent('testEvent', {});
      
      const stats = game.eventManager.getEventStats();
      expect(stats.totalListeners).toBe(0);
    });
  });
});