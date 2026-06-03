# Incrementa end-to-end showcase

A complete idle game running headless, built with Incrementa consumed as an installed package. It shows what you get from the framework and doubles as an end-to-end test (it asserts 23 invariants and exits non-zero if any fail).

## Why this exists

It answers one question for a developer evaluating Incrementa: what do I actually have to write, and what does the framework do for me?

You write plain configuration that declares the world and a few event subscriptions. The framework does the rest from a single `game.start()`:

- Runs a frame-rate-independent game loop (headless here via `setTimeout`, `requestAnimationFrame` in a browser).
- Drives production: miners gather resources, factories convert inputs to outputs, resources generate passively.
- Enforces global storage capacity.
- Evaluates unlock conditions and milestones, and applies milestone rewards.
- Processes data-driven and legacy upgrade effects, with cost scaling.
- Emits events (`amountChanged`, `buildComplete`, `unlocked`, `milestoneAchieved`) so a UI reacts without polling.
- Handles save and load, offline progress, plugins, and timers.

It is frontend-agnostic with zero runtime dependencies, so the same code runs in Node and in the browser.

## What it demonstrates

A full ore to iron to gold production chain plus energy, built from declarative entities:

- Resources with passive generation
- Miners and factories (the production chain)
- Storage with capacity limits
- Function-based and data-driven unlock conditions, plus a milestone with a reward
- Repeatable, data-driven upgrades and a legacy function-effect upgrade
- A plugin that runs each tick
- Save / load round trip and offline progress
- The framework `Timer` utility (the harness itself uses `game.addTimer`)

## Run it

From the repository root:

```bash
npm run build          # the sim imports the built package, not src
cd examples/e2e-sim
npm install            # first time only: links incrementa
node sim.mjs           # defaults to ~180s
```

Shorter run:

```bash
DURATION_MS=100000 node sim.mjs
```

Re-run `npm run build` after changing anything in `src/`, since the sim resolves `incrementa` to `dist`.

## What to expect

A progress line every 10 seconds while a scripted player unlocks, builds, levels up, and buys upgrades:

```
[ 80s] wood=698 ore=673 iron=9 gold=56 energy=167 | built=4 upg=4 lvlUps=4 fps=59 | events bc=8 ul=10 ms=1
```

Then a results block. A full run (about 90s or more, so the economy reaches the milestone) prints:

```
23/23 checks passed
```

and exits with code 0. A failing check prints `FAIL <name>` with a reason and exits 1.
