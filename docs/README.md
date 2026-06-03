# Incrementa Framework Documentation

Welcome to the comprehensive documentation for Incrementa, a TypeScript framework for building incremental/idle games. This documentation provides everything you need to understand, use, and extend the framework.

## 📚 Table of Contents

### Getting Started
- [Quick Start Guide](./getting-started/quick-start.md) - Get up and running in 5 minutes
- [Installation](./getting-started/installation.md) - Installation and setup instructions
- [Your First Game](./getting-started/first-game.md) - Build a simple game step-by-step

### Architecture Overview
- [Framework Architecture](./architecture/overview.md) - High-level system design
- [Service-Oriented Design](./architecture/services.md) - New service-based architecture
- [Entity System](./architecture/entities.md) - Core entity types and relationships
- [Event System](./architecture/events.md) - Event-driven communication

### Core Systems
- [Game Class](./core/game.md) - Main orchestrator and API reference
- [Entity Management](./core/entities.md) - Creating and managing game entities
- [Resource System](./core/resources.md) - Resource management and passive generation
- [Building System](./core/buildings.md) - Construction, production, and storage
- [Upgrade System](./core/upgrades.md) - Entity enhancement and progression
- [Save/Load System](./core/save-load.md) - Game state persistence

### Advanced Features
- [Production Chains](./advanced/production-chains.md) - Complex manufacturing workflows
- [Unlock Conditions](./advanced/unlock-conditions.md) - Progressive content unlocking
- [Performance Optimization](./advanced/performance.md) - Scaling to large games
- [Plugin System](./advanced/plugins.md) - Extending functionality
- [UI Integration](./advanced/ui-integration.md) - Framework-agnostic UI binding

### API Reference
- [Game API](./api/game.md) - Complete Game class reference
- [Services API](./api/services.md) - All service interfaces and methods
- [Entity APIs](./api/entities.md) - Entity class references
- [Type Definitions](./api/types.md) - TypeScript interfaces and types
- [Events Reference](./api/events.md) - All available events

### Examples & Tutorials
- [Basic Clicker Game](./examples/clicker-game.md) - Simple resource clicking
- [Resource Management](./examples/resource-management.md) - Complex resource systems
- [Production Chains](./examples/production-chains.md) - Manufacturing workflows
- [Plugin Development](./examples/plugin-development.md) - Creating custom plugins

### Migration & Compatibility
- [Migration Guide](./migration/service-migration.md) - Upgrading to service architecture
- [Backward Compatibility](./migration/compatibility.md) - Legacy API support
- [Breaking Changes](./migration/breaking-changes.md) - Version upgrade notes

### Development
- [Contributing](./development/contributing.md) - How to contribute to the framework
- [Testing Guide](./development/testing.md) - Writing and running tests
- [Performance Benchmarks](./development/benchmarks.md) - Performance testing
- [Code Standards](./development/standards.md) - Coding conventions

## 🚀 Framework Highlights

### Modern Service Architecture
Incrementa uses a service-oriented architecture that provides clean separation of concerns while maintaining backward compatibility:

```typescript
// New service-based API (recommended)
game.entities.createResource({ name: 'Gold', initialAmount: 100 });
game.production.startAllProduction();
game.capacity.getTotalCapacityFor('gold');

// Legacy API (still supported)
game.createResource({ name: 'Gold', initialAmount: 100 });
game.startAllProduction();
game.getTotalCapacityFor('gold');
```

### Key Services
- **EntityService** - Manages all game entities (resources, buildings, upgrades)
- **ProductionService** - Handles production optimization and management
- **CapacityService** - Manages storage capacity across buildings
- **TimerService** - Coordinates all game timers and scheduling
- **EventService** - Provides clean event system interface
- **UnlockService** - Manages progressive content unlocking

### Performance-First Design
- **Efficient Game Loop** - 60fps delta-time based updates
- **Event Batching** - Reduces event overhead for high-frequency updates
- **Capacity Caching** - Smart caching for expensive capacity calculations
- **Production Optimization** - Automatic producer management

### Framework-Agnostic UI
- Works with React, Vue, Angular, or vanilla JavaScript
- Event-driven updates for reactive UI frameworks
- No UI dependencies or assumptions

## 📋 Quick Reference

### Essential Classes
- `Game` - Main orchestrator and entry point
- `Resource` - Collectible game currency/materials
- `Building` - Constructible structures with build times
- `Miner` - Automated resource extraction buildings
- `Storage` - Resource capacity management buildings
- `Factory` - Resource transformation buildings
- `Upgrade` - Entity enhancement system

### Core Events
- `resourceChanged` - Resource amount updates
- `buildComplete` - Building construction finished
- `unlocked` - Entity becomes available
- `productionStarted/Stopped` - Production state changes

## 🔗 External Links
- [GitHub Repository](https://github.com/your-org/incrementa)
- [Examples Collection](../examples/)
- [NPM Package](https://npmjs.com/package/incrementa)
- [Issue Tracker](https://github.com/your-org/incrementa/issues)

---

*This documentation covers Incrementa v0.1.0 and the new service-oriented architecture.*