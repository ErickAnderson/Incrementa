# Contributing to Incrementa

Thanks for your interest in contributing. This guide covers the workflow, standards, and release process.

## Development setup

Incrementa targets the Node.js 24 LTS line (see `.nvmrc`).

```bash
npm install
```

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # build the library (vite build + tsc declarations)
npm test               # run the test suite
npm run test:coverage  # coverage report
npm run test:watch     # watch mode
npm run lint           # ESLint
npx tsc --noEmit       # type-check only
```

## Standards

Every change should keep the following green:

- `npx tsc --noEmit` reports zero errors. The project uses strict TypeScript; do not introduce `any` casually or use `@ts-ignore`.
- `npm test` passes. The project follows test-driven development.
- `npm run lint` reports zero errors.
- `npm run build` succeeds and emits declarations.

### Test-driven development

New functionality must include tests before it is considered complete:

1. Write failing tests that define the expected behaviour.
2. Implement until they pass.
3. Cover edge cases (null inputs, boundaries, error paths) and, for timing or production features, time-based accuracy.

Place tests in the matching directory:

- `tests/core/` for core systems
- `tests/entities/` for entity behaviour
- `tests/integration/` for multi-component scenarios

Update `tests/README.md` when you add a suite.

### Code style

- PascalCase for classes, camelCase for methods and variables.
- All entities extend `BaseEntity` and use the event system for communication.
- Keep the framework frontend-agnostic and dependency-free at runtime.
- Maintain accurate TypeScript types on all public APIs.

## Pull requests

Before opening a pull request:

1. Ensure type-check, tests, lint, and build all pass.
2. Add or update tests for your change.
3. Update documentation and code examples affected by your change.
4. Keep commits focused with clear messages.

## Release process

1. Update `CHANGELOG.md` with the changes under a new version heading.
2. Bump `version` in `package.json` following semantic versioning.
3. Run the full gate: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.
4. Inspect the package contents with `npm pack --dry-run` (should contain `dist`, `README.md`, and `LICENSE.md` only).
5. Tag the release and publish with `npm publish --access public`.
