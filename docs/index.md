# Incrementa Framework Documentation

> **A TypeScript framework for building incremental/idle games with a service-oriented architecture**

Welcome to the comprehensive documentation for Incrementa! This framework provides everything you need to build scalable, performant incremental games with modern development practices.

## 🚀 Quick Navigation

### New to Incrementa?
- **[Quick Start Guide](./getting-started/quick-start.md)** - Build your first game in 5 minutes
- **[Installation](./getting-started/installation.md)** - Get set up with different environments
- **[Architecture Overview](./architecture/overview.md)** - Understand the framework design

### Building Games
- **[Core Game Class](./core/game.md)** - Main API and orchestrator
- **[Entity Management](./api/entities.md)** - Resources, buildings, upgrades
- **[Service APIs](./api/services.md)** - All service interfaces and methods
- **[Complete Examples](./examples/)** - Full game implementations

### Advanced Topics
- **[Service Architecture](./architecture/services.md)** - Deep dive into service design
- **[Performance Guide](./advanced/performance.md)** - Scaling to large games
- **[Plugin System](./advanced/plugins.md)** - Extending functionality

## 🎯 Framework Highlights

### Modern Service Architecture
Incrementa uses a service-oriented architecture that eliminates god classes while maintaining backward compatibility:

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

### Six Core Services
- **🏗️ EntityService** - Entity CRUD operations and factory methods
- **⚙️ ProductionService** - Production optimization and management
- **📦 CapacityService** - Storage capacity calculations with caching
- **⏰ TimerService** - Timer coordination and performance tracking
- **🎭 EventService** - Event system interface and statistics
- **🔓 UnlockService** - Unlock condition management and progression

### Performance-First Design
- **68% Code Reduction**: Game class reduced from 1,063 to 339 lines
- **Efficient Scaling**: Tested with 1000+ entities (6.7ms creation time)
- **Smart Caching**: 5-second capacity cache with automatic invalidation
- **Event Batching**: High-frequency events batched for performance

### Framework-Agnostic UI
Works seamlessly with any frontend framework:
- ✅ React, Vue, Angular, Svelte
- ✅ Vanilla JavaScript/TypeScript
- ✅ Event-driven updates for reactive frameworks
- ✅ No UI dependencies or assumptions

## 📚 Documentation Sections

### Getting Started
Learn the basics and get your first game running quickly.

| Guide | Description | Time |
|-------|-------------|------|
| [Quick Start](./getting-started/quick-start.md) | Build a game in 5 minutes | 5 min |
| [Installation](./getting-started/installation.md) | Setup for different environments | 10 min |
| [First Game Tutorial](./getting-started/first-game.md) | Step-by-step beginner guide | 30 min |

### Architecture
Understand the framework design and principles.

| Topic | Description | Audience |
|-------|-------------|----------|
| [Overview](./architecture/overview.md) | High-level system design | All developers |
| [Services](./architecture/services.md) | Service-oriented architecture | Intermediate |
| [Entities](./architecture/entities.md) | Entity system and relationships | Intermediate |
| [Events](./architecture/events.md) | Event-driven communication | All developers |

### Core Systems
Learn the main framework components.

| System | Description | Key Features |
|--------|-------------|--------------|
| [Game Class](./core/game.md) | Main orchestrator | Service coordination, lifecycle |
| [Resources](./core/resources.md) | Currency/materials | Passive generation, capacity limits |
| [Buildings](./core/buildings.md) | Structures | Construction, production, storage |
| [Upgrades](./core/upgrades.md) | Enhancements | Property modifiers, custom effects |
| [Save/Load](./core/save-load.md) | Persistence | State serialization, offline progress |

### API Reference
Complete technical reference for all APIs.

| Reference | Description | Use Case |
|-----------|-------------|----------|
| [Game API](./api/game.md) | Complete Game class reference | Primary development |
| [Services](./api/services.md) | All service interfaces | Service-oriented development |
| [Entities](./api/entities.md) | Entity class references | Entity customization |
| [Types](./api/types.md) | TypeScript definitions | Type-safe development |
| [Events](./api/events.md) | Event system reference | Event handling |

### Examples & Tutorials
Learn through complete working examples.

| Example | Type | Complexity | Features |
|---------|------|------------|----------|
| [Clicker Game](./examples/clicker-game.md) | Complete Tutorial | Intermediate | Clicking, buildings, upgrades, prestige |
| [Resource Management](./examples/resource-management.md) | Tutorial | Advanced | Complex resources, conversion chains |
| [Production Chains](./examples/production-chains.md) | Tutorial | Advanced | Multi-step manufacturing |
| [Plugin Development](./examples/plugin-development.md) | Tutorial | Advanced | Custom plugins, extensibility |

### Advanced Features
Explore sophisticated framework capabilities.

| Feature | Description | Benefits |
|---------|-------------|----------|
| [Production Chains](./advanced/production-chains.md) | Complex manufacturing | Interconnected systems |
| [Unlock Conditions](./advanced/unlock-conditions.md) | Progressive content | Player progression |
| [Performance](./advanced/performance.md) | Optimization | Large-scale games |
| [Plugins](./advanced/plugins.md) | Extensibility | Custom functionality |
| [UI Integration](./advanced/ui-integration.md) | Frontend frameworks | Reactive UIs |

### Migration & Compatibility
Upgrade existing games and maintain compatibility.

| Guide | Purpose | Target Audience |
|-------|---------|-----------------|
| [Service Migration](./migration/service-migration.md) | Upgrade to services | Existing users |
| [Backward Compatibility](./migration/compatibility.md) | Legacy API support | Migration planning |
| [Breaking Changes](./migration/breaking-changes.md) | Version differences | Version upgrades |

### Development
Contribute to the framework and follow best practices.

| Topic | Description | Audience |
|-------|-------------|----------|
| [Contributing](./development/contributing.md) | How to contribute | Contributors |
| [Testing](./development/testing.md) | Testing strategies | All developers |
| [Benchmarks](./development/benchmarks.md) | Performance testing | Performance-focused |
| [Standards](./development/standards.md) | Code conventions | Contributors |

## 🎮 Framework Philosophy

### Design Principles

#### 1. Service-Oriented Architecture
Break down monolithic game classes into focused, testable services:
```typescript
// Instead of one massive Game class
class Game {
  // 1000+ lines of mixed responsibilities
}

// Use specialized services
game.entities    // Entity management
game.production  // Production optimization
game.capacity    // Storage calculations
game.timers      // Timer coordination
```

#### 2. Backward Compatibility
Preserve existing APIs while introducing modern alternatives:
```typescript
// Legacy API continues to work
const resource = game.createResource({ name: 'Gold' });

// New API provides better organization
const resource = game.entities.createResource({ name: 'Gold' });
```

#### 3. Performance First
Optimize for real-world game scale:
- Smart caching strategies
- Efficient data structures  
- Event batching for high frequency updates
- Memory-conscious design patterns

#### 4. Framework Agnostic
Work with any frontend technology:
- No UI framework dependencies
- Event-driven architecture for reactive updates
- Clean separation of game logic and presentation

#### 5. Developer Experience
Provide excellent TypeScript support and clear APIs:
- Full type safety
- Comprehensive documentation
- Intuitive method naming
- Consistent patterns across services

## 📊 Performance Benchmarks

Framework performance tested with large-scale scenarios:

| Operation | Scale | Performance |
|-----------|-------|-------------|
| Resource Creation | 1,000 resources | 6.7ms |
| Building Creation | 500 buildings | 3.5ms |
| Mixed Entity Creation | 400 entities | 3.7ms |
| Game Loop (250 entities) | 100 cycles | 1.4ms |
| Production Optimization | 50 producers | 0.8ms |
| Capacity Calculation | Cached | 0.01ms |
| Timer Updates | 100 timers | 0.3ms |

See [Performance Guide](./advanced/performance.md) for detailed benchmarks and optimization strategies.

## 🔗 Useful Links

### Framework Resources
- **[GitHub Repository](https://github.com/your-org/incrementa)** - Source code and issues
- **[NPM Package](https://npmjs.com/package/incrementa)** - Package information
- **[Live Examples](../examples/)** - Working game implementations
- **[TypeScript Playground](https://www.typescriptlang.org/play)** - Test code snippets

### Community
- **[Discord Server](#)** - Real-time community help
- **[Stack Overflow](https://stackoverflow.com/questions/tagged/incrementa)** - Technical Q&A
- **[Reddit Community](#)** - Game showcases and discussions

### Development Tools
- **[VS Code Extension](#)** - Enhanced development experience
- **[Chrome DevTools Extension](#)** - Game debugging tools
- **[Performance Profiler](#)** - Frame-by-frame analysis

## 🚦 Getting Started Checklist

Ready to build your incremental game? Follow this checklist:

### Prerequisites
- ✅ Node.js 16.0.0 or higher
- ✅ Basic TypeScript/JavaScript knowledge
- ✅ Text editor or IDE (VS Code recommended)

### Setup Steps
1. **[Install Incrementa](./getting-started/installation.md)** - Package manager setup
2. **[Run Quick Start](./getting-started/quick-start.md)** - 5-minute working game
3. **[Follow Tutorial](./getting-started/first-game.md)** - Detailed step-by-step guide
4. **[Explore Examples](./examples/)** - See complete implementations
5. **[Read API Docs](./api/)** - Understand available features

### Next Steps
- **Join the Community** - Get help and share your games
- **Build Something Cool** - Create your unique incremental game
- **Contribute Back** - Help improve the framework

---

## 📝 Documentation Notes

This documentation covers **Incrementa v0.1.0** and the new service-oriented architecture. 

- **Framework Version**: v0.1.0
- **Documentation Updated**: January 2024
- **TypeScript Version**: 5.0+
- **Node.js Version**: 16.0.0+

For older versions or migration guides, see the [Migration section](./migration/).

---

*Ready to build your incremental game? Start with the [Quick Start Guide](./getting-started/quick-start.md)!*