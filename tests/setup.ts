// Global test setup
import { jest } from '@jest/globals';

// Mock global functions that might not be available in test environment
global.globalThis = global.globalThis || (global as any);

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
  jest.advanceTimersByTime(ms);
  await waitForAsync();
  await new Promise(resolve => process.nextTick(resolve));
};

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});