# Changelog

All notable changes to this project are documented here. The format is based on Keep a Changelog, and this project adheres to semantic versioning.

## [0.1.0] - Unreleased

First public release.

### Added

- Service-oriented `Game` orchestrator over entity, production, capacity, timer, event, unlock, game-loop, and game-state services.
- Entity model: resources, buildings, miners, factories, storage, and upgrades on a shared `BaseEntity` with lifecycle hooks and an event emitter.
- Structured cost system with linear, exponential, logarithmic, and polynomial scaling, validation, and spending with rollback.
- Data-driven upgrade system with property modifiers and id, type, or tag targeting.
- Unlock system with function-based and data-driven conditions, AND/OR/NOT composition, templates, and milestones.
- Event system with filtering, middleware, debouncing, and history.
- Storage and global capacity management.
- Save and load with offline progress through a pluggable storage provider.

### Changed

- Reconciled the codebase to a single service-oriented architecture, removing duplicate manager and god-class implementations.
- Capacity reporting: `getTotalCapacityFor` returns the real built-storage sum; the unlimited interpretation lives in `hasGlobalCapacity` and `getRemainingCapacityFor`.
- Modernised the toolchain to TypeScript 6, Vite 8, ESLint 10, and Jest 30 on Node.js 24 LTS, with zero runtime dependencies.

### Fixed

- Factory methods now register created entities with the event and unlock systems, so unlock conditions evaluate correctly.
- Capacity cache invalidates on construction completion and capacity changes.
- Resolved all TypeScript strict-mode errors and brought the test suite to passing (243 tests across 13 suites).
- Corrected the package `exports` map and `types` entry so the published package is installable with working type declarations.
