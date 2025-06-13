// Global test setup
import { jest } from '@jest/globals';
import { Game } from '../src/core/game.js';
import { Resource } from '../src/entities/resources/resource.js';
import { Building } from '../src/entities/buildings/building.js';
import { Storage } from '../src/entities/buildings/storage.js';
import { Miner } from '../src/entities/buildings/miner.js';
import { Factory } from '../src/entities/buildings/factory.js';
import { BaseEntity } from '../src/core/base-entity.js';

// Mock global functions that might not be available in test environment
if (typeof globalThis === 'undefined') {
  (global as any).globalThis = global;
}

// Test constants for consistency
export const TEST_CONSTANTS = {
  // Tolerance values for time-based tests
  TOLERANCE_MARGIN: 2,
  PRODUCTION_RATE_TOLERANCE: 0.1,
  CAPACITY_TOLERANCE: 1,
  
  // Common resource amounts
  STARTING_RESOURCES: {
    ore: 100,
    metal: 50,
    energy: 25
  },
  
  // Common build times
  BUILD_TIMES: {
    instant: 0,
    fast: 1,
    normal: 2,
    slow: 3
  },
  
  // Common production rates
  PRODUCTION_RATES: {
    slow: 1,
    normal: 2,
    fast: 3
  }
};

// Common test utilities
export const createMockStorageProvider = () => {
  const storage = new Map<string, string>();
  return {
    storage,
    getItem: jest.fn((key: string) => storage.get(key) || null),
    setItem: jest.fn((key: string, value: string) => storage.set(key, value))
  };
};

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve));

// Fast-forward time and flush promises
export const fastForward = async (ms: number) => {
  // Advance timers by the specified time
  jest.advanceTimersByTime(ms);
  
  // Flush all microtasks
  await Promise.resolve();
};

// Test helper functions for common patterns
export const createUnlockedEntity = <T extends BaseEntity>(
  game: Game, 
  EntityClass: new (config: any) => T, 
  config: any
): T => {
  const entity = new EntityClass(config);
  if ('setGame' in entity) {
    (entity as any).setGame(game);
  }
  if ('setGameReference' in entity) {
    (entity as any).setGameReference(game);
  }
  game.addEntity(entity);
  
  // Use proper unlock mechanism instead of direct property access
  game.unlockEntity(entity.id);
  
  return entity;
};

export const createUnlockedResource = (game: Game, config: any): Resource => {
  return createUnlockedEntity(game, Resource, config);
};

export const createUnlockedBuilding = (game: Game, config: any): Building => {
  return createUnlockedEntity(game, Building, config);
};

export const createUnlockedStorage = (game: Game, config: any): Storage => {
  return createUnlockedEntity(game, Storage, config);
};

export const createUnlockedMiner = (game: Game, config: any): Miner => {
  return createUnlockedEntity(game, Miner, config);
};

export const createUnlockedFactory = (game: Game, config: any): Factory => {
  return createUnlockedEntity(game, Factory, config);
};

// Helper for creating realistic unlock conditions
export const createResourceBasedUnlock = (resourceId: string, minAmount: number) => {
  return (game: Game) => {
    const resource = game.getResourceById(resourceId);
    return resource ? resource.amount >= minAmount : false;
  };
};

// Helper for waiting until a building is built
export const waitUntilBuilt = async (building: Building, maxWaitMs: number = 10000): Promise<boolean> => {
  const startTime = Date.now();
  while (!building.isBuilt && (Date.now() - startTime) < maxWaitMs) {
    await fastForward(100);
  }
  return building.isBuilt;
};

// Helper for setting up a complete game scenario with resources and storage
export const setupGameWithBasicResources = (game: Game) => {
  const ore = createUnlockedResource(game, {
    id: 'ore',
    name: 'Ore',
    initialAmount: TEST_CONSTANTS.STARTING_RESOURCES.ore
  });
  
  const metal = createUnlockedResource(game, {
    id: 'metal',
    name: 'Metal',
    initialAmount: TEST_CONSTANTS.STARTING_RESOURCES.metal
  });
  
  return { ore, metal };
};

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});