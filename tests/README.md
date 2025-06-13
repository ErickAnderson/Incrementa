# Incrementa Framework Test Suite

This directory contains comprehensive unit and integration tests for the Incrementa framework. The test suite ensures all core framework features work correctly and provides regression testing for future development.

## Test Structure

```
tests/
├── README.md                 # This file
├── setup.ts                  # Global test configuration and utilities
├── core/                     # Core system tests
│   └── game.test.ts         # Game class and main orchestration
├── entities/                 # Entity-specific tests
│   ├── resource.test.ts     # Resource management and capacity
│   ├── building.test.ts     # Building construction and lifecycle
│   ├── storage.test.ts      # Storage capacity management
│   └── producers.test.ts    # Miner and Factory production
└── integration/              # Integration and scenario tests
    └── time-scenarios.test.ts # Time-based production scenarios
```

## Test Coverage Overview

### Core Framework Tests ✅
- [x] Game entity management
- [x] Game loop and timing
- [x] Timer management
- [x] Event system integration
- [x] Unlock system integration
- [x] Capacity management
- [x] Production management
- [x] Resource availability checking

### Resource Entity Tests ✅ (22 tests)
- [x] Basic operations (initialize, increment, decrement, set amount)
- [x] Capacity management (limits, game integration)
- [x] Passive production (time-based generation, unlock conditions)
- [x] Event emission (amount changes, capacity exceeded)
- [x] Unlock conditions (conditional unlocking)
- [x] Game integration (references, cleanup)

### Building Entity Tests ✅
- [x] Basic properties and initialization
- [x] Cost calculation and scaling
- [x] Cost validation and spending
- [x] Construction process (start, complete, timing)
- [x] `isBuilt` logic (unlocked vs built states)
- [x] Level system and upgrades
- [x] Event emission (construction, costs)
- [x] Timer integration

### Storage Entity Tests ✅
- [x] Capacity management (get, set, increase)
- [x] Capacity checking (hasCapacity, canAddResource)
- [x] Game integration (resource amounts, references)
- [x] Built vs unlocked logic (capacity contribution)
- [x] Event emission (capacity changes, limits reached)
- [x] Managed resources tracking

### Producer Building Tests ✅
- [x] Miner production (resource gathering, rates, timing)
- [x] Factory production (input/output conversion, cycles)
- [x] Production control (start, stop, auto-start)
- [x] Capacity and resource checking
- [x] Statistics tracking
- [x] Production chains (multi-building scenarios)

### Time-Based Integration Tests ✅
- [x] 5-second production accuracy tests
- [x] Building construction timing
- [x] Storage capacity build completion
- [x] Production chain scenarios
- [x] Capacity limit enforcement
- [x] Passive resource generation
- [x] Game loop integration
- [x] Multi-building construction timing

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/entities/resource.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Test Utilities

The `setup.ts` file provides common utilities:
- `createMockStorageProvider()` - Mock storage for SaveManager
- `fastForward(ms)` - Advance fake timers and flush promises
- `waitForAsync()` - Wait for asynchronous operations

## Current Test Status

**Total Tests**: 151 tests across 6 test suites
**Passing**: 121 tests ✅
**Failing**: 30 tests (mostly timing-related) ⚠️
**Coverage**: Core framework features comprehensively tested

## Future Test Additions

### Planned Tests
- [ ] **Event System Tests** - Comprehensive event emission and routing
- [ ] **Unlock System Tests** - Condition checking and automatic unlocking  
- [ ] **Cost System Tests** - Validation, spending, and scaling logic
- [ ] **Timer System Tests** - Scheduling, completion, and pausing
- [ ] **Upgrade System Tests** - Upgrade application and effects
- [ ] **Worker Entity Tests** - Autonomous resource gathering
- [ ] **Save/Load System Tests** - Persistence and restoration

### Integration Scenarios to Add
- [ ] **Complex Production Chains** - Multi-stage resource transformation
- [ ] **Capacity Overflow Scenarios** - Edge cases and error handling
- [ ] **Performance Tests** - Large-scale entity management
- [ ] **Unlock Cascade Tests** - Chain reaction unlocking
- [ ] **Multi-Storage Scenarios** - Complex capacity management
- [ ] **Long-Running Production** - Extended time simulation tests

### Edge Cases to Test
- [ ] **Negative Resource Amounts** - Error handling and prevention
- [ ] **Zero Production Rates** - Edge case behavior
- [ ] **Circular Dependencies** - Resource requirement loops
- [ ] **Memory Leaks** - Event listener cleanup
- [ ] **Concurrent Operations** - Race condition handling
- [ ] **Invalid Configurations** - Error handling for bad inputs

## Test Guidelines

1. **Naming**: Use descriptive test names that explain the expected behavior
2. **Setup**: Use `beforeEach` for common setup, keep tests isolated
3. **Assertions**: Test one specific behavior per test case
4. **Mocking**: Mock external dependencies, test units in isolation
5. **Timing**: Use fake timers for time-based tests, avoid real delays
6. **Coverage**: Aim for both happy path and error condition coverage

## Contributing Tests

When adding new framework features:
1. Create corresponding test files in the appropriate directory
2. Follow existing test patterns and naming conventions
3. Update this README with new test descriptions
4. Ensure all tests pass before submitting changes
5. Add integration tests for complex feature interactions