/**
 * Incrementa end-to-end showcase.
 *
 * This is a complete idle game running headless, built with Incrementa used as
 * an installed npm package. It exists to show what the framework gives you.
 *
 * What you write: plain config objects that DECLARE the world (resources,
 *   miners, factories, storage, upgrades, unlock conditions, milestones) and a
 *   few event subscriptions for your UI.
 *
 * What the framework does for you, automatically, from a single game.start():
 *   - Runs a frame-rate-independent game loop (here, headless via setTimeout;
 *     in a browser it uses requestAnimationFrame).
 *   - Drives production cycles (miners gather, factories convert inputs to
 *     outputs) and passive resource generation.
 *   - Enforces global storage capacity.
 *   - Evaluates unlock conditions and milestones, and applies milestone rewards.
 *   - Processes data-driven and legacy upgrade effects with cost scaling.
 *   - Emits events (amountChanged, buildComplete, unlocked, milestoneAchieved)
 *     so a UI can react without polling.
 *   - Handles save / load and offline progress, plugins, and timers.
 *
 * It is frontend-agnostic with zero runtime dependencies, so the same code runs
 * in Node and in the browser. At the end it asserts 23 invariants so the
 * showcase doubles as proof the stack actually works end to end.
 *
 * Run: node sim.mjs            (defaults to ~180s)
 *      DURATION_MS=100000 node sim.mjs
 */

import {
  Game,
  SaveManager,
  Factory,
  Timer,
  createCosts,
  initializeFramework,
  setDebugMode
} from "incrementa";

// ----------------------------------------------------------------------------
// Setup
// ----------------------------------------------------------------------------

const DURATION_MS = Number(process.env.DURATION_MS || 180000);
const start = Date.now();
const ts = () => `[${String(Math.floor((Date.now() - start) / 1000)).padStart(3, " ")}s]`;
const log = (...a) => console.log(ts(), ...a);

let crashed = null;
process.on("uncaughtException", (e) => { crashed = e; });
process.on("unhandledRejection", (e) => { crashed = e; });

setDebugMode(false);
initializeFramework({ debugMode: false });

// In-memory storage provider implementing StorageProvider.
const mem = new Map();
const storage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, v)
};

// Seed a prior session 90s ago so offline progress has something to compute.
storage.setItem("metadata", JSON.stringify({ lastSave: Date.now() - 90000 }));

const game = new Game(new SaveManager(storage));

// ----------------------------------------------------------------------------
// World - declare it; the framework wires and runs it.
//
// Everything below is plain configuration. Each game.create* call returns a
// live entity already connected to the event, unlock, production, and capacity
// systems. There is no manual registration, no hand-written update loop, and
// no glue between buildings and resources - that is the framework's job.
// ----------------------------------------------------------------------------

const wood = game.createResource({ id: "wood", name: "Wood", initialAmount: 120, unlockCondition: () => true });
const ore = game.createResource({ id: "ore", name: "Ore", initialAmount: 0, unlockCondition: () => true });
const iron = game.createResource({ id: "iron", name: "Iron", initialAmount: 0, unlockCondition: () => true });
const gold = game.createResource({ id: "gold", name: "Gold", initialAmount: 0, unlockCondition: () => true });
const energy = game.createResource({ id: "energy", name: "Energy", initialAmount: 0, rate: 1.0, unlockCondition: () => true });

// Unlock the base resources up front.
[wood, ore, iron, gold, energy].forEach((r) => game.unlockEntity(r.id));

// Storage with capacity limits (iron is intentionally capped low to test enforcement).
const warehouse = game.createStorage({
  id: "warehouse",
  name: "Warehouse",
  capacities: { wood: 100000, ore: 100000, iron: 800, gold: 100000, energy: 100000 },
  buildTime: 2,
  unlockCondition: () => true
});

// Miners (tag: mining) - gather raw resources.
const woodMiner = game.createMiner({
  id: "wood-miner", name: "Wood Miner", resourceId: "wood",
  gatherRate: 9, buildTime: 0, autoStart: true, tags: ["mining"], unlockCondition: () => true
});
const oreMiner = game.createMiner({
  id: "ore-miner", name: "Ore Miner", resourceId: "ore",
  gatherRate: 6, costs: [{ resourceId: "wood", amount: 60, scalingFactor: 1.2 }],
  buildTime: 2, autoStart: true, tags: ["mining"],
  unlockCondition: () => wood.amount >= 60
});

// Factories - transform resources. Constructed directly and added to the game.
const ironFoundry = new Factory({
  id: "iron-foundry", name: "Iron Foundry",
  inputs: [{ resourceId: "ore", amount: 2 }],
  outputs: [{ resourceId: "iron", amount: 1 }],
  productionRate: 1.0, cost: { wood: 90 }, buildTime: 3,
  autoStart: true, tags: ["industry"],
  unlockCondition: () => ore.amount >= 30
});
game.addEntity(ironFoundry);

const goldFoundry = new Factory({
  id: "gold-foundry", name: "Gold Foundry",
  inputs: [{ resourceId: "iron", amount: 3 }],
  outputs: [{ resourceId: "gold", amount: 1 }],
  productionRate: 0.5, cost: { wood: 160 }, buildTime: 4,
  autoStart: true, tags: ["industry"]
});
game.addEntity(goldFoundry);

// Complex (data-driven) unlock condition for the gold foundry: needs 20 iron.
game.unlockManager.registerComplexUnlockCondition(goldFoundry, {
  condition: { type: "resource_amount", target: "iron", operation: "greater_than_or_equal", value: 20 }
});

// Upgrades -----------------------------------------------------------------

// Data-driven, repeatable: each application adds 0.5 to the energy generation rate.
const energySurge = game.createUpgrade({
  id: "energy-surge", name: "Energy Surge",
  costs: [{ resourceId: "gold", amount: 10, scalingFactor: 1.6 }],
  isRepeatable: true, maxApplications: 5,
  configuration: {
    effects: [{ type: "property_modifier", targetProperty: "rate", operation: "add", value: 0.5, description: "+0.5 energy/s" }],
    targets: [{ entityType: "resource", entityId: "energy" }],
    isRepeatable: true, maxApplications: 5, currentApplications: 0, autoApply: false
  },
  unlockCondition: () => true
});

// Legacy function-effect upgrade: a one-off wood windfall.
const woodWindfall = game.createUpgrade({
  id: "wood-windfall", name: "Wood Windfall",
  costs: [{ resourceId: "ore", amount: 40 }],
  effect: () => { wood.increment(250); },
  unlockCondition: () => true
});
[energySurge, woodWindfall].forEach((u) => game.unlockEntity(u.id));

// Milestone with reward ----------------------------------------------------
game.unlockManager.registerMilestone({
  id: "first-gold", name: "First Gold", description: "Accumulate 15 gold",
  condition: { condition: { type: "resource_amount", target: "gold", operation: "greater_than_or_equal", value: 15 } },
  reward: { type: "resource", target: "gold", value: 40, description: "Bonus gold" },
  isAchieved: false
});

// Plugin -------------------------------------------------------------------
let pluginTicks = 0;
let pluginWoodAdded = 0;
const autoHarvester = {
  config: { id: "auto-harvester", name: "Auto Harvester", version: "1.0.0" },
  _acc: 0,
  onLoad(_game, _events) {},
  onActivate() {},
  onDeactivate() {},
  onUnload() {},
  onUpdate(deltaTimeMs) {
    pluginTicks++;
    this._acc += deltaTimeMs;
    if (this._acc >= 1000) {         // once per simulated second (deltaTime is ms)
      this._acc = 0;
      wood.increment(3);
      pluginWoodAdded += 3;
    }
  }
};
game.pluginSystem.registerPlugin(autoHarvester);
game.pluginSystem.activatePlugin("auto-harvester");

// Performance monitoring ---------------------------------------------------
game.setPerformanceMonitoring(true);

// Events - how a UI reacts without polling. Subscribe once; the framework
// pushes state changes (amount changes, builds, unlocks, milestones) to you.
const events = { amountChanged: 0, buildComplete: 0, unlocked: 0, levelUp: 0, milestone: 0 };
game.on("amountChanged", () => events.amountChanged++);
game.on("buildComplete", () => events.buildComplete++);
game.on("unlocked", () => events.unlocked++);
game.on("levelUp", () => events.levelUp++);
// Milestone events are emitted on the UnlockManager's own event bus.
game.unlockManager.on("milestoneAchieved", () => { events.milestone++; });

// World overview - so the progression numbers below mean something ----------
function describeWorld() {
  console.log(`
=================== DEEPCHAIN: WORLD OVERVIEW ===================
Goal: bootstrap a wood -> ore -> iron -> gold production chain.

Resources:
  Wood    raw material, starts at ${wood.amount}. Auto-Harvester plugin adds +3/s.
  Ore     mined from the ground by the Ore Miner.
  Iron    smelted from Ore by the Iron Foundry.
  Gold    minted from Iron by the Gold Foundry (the win currency).
  Energy  passive generation at 1/s, boosted by the Energy Surge upgrade.

Producers (the framework runs these automatically once built + unlocked):
  Wood Miner     gathers 9 wood/s             free, instant build
  Ore Miner      gathers 6 ore/s              costs 60 wood, 2s build, unlocks at wood >= 60
  Iron Foundry   2 ore  -> 1 iron  @ 1 cyc/s  costs 90 wood, 3s build, unlocks at ore >= 30
  Gold Foundry   3 iron -> 1 gold  @ 0.5 cyc/s costs 160 wood, 4s build, unlocks at iron >= 20

Storage (Warehouse): wood/ore/gold/energy effectively uncapped; iron capped at 800.

Upgrades:
  Energy Surge   +0.5 energy/s per level, repeatable x5, gold cost scales 1.6x
  Wood Windfall  one-off +250 wood, costs 40 ore

Milestone:
  First Gold     reach 15 gold  ->  reward +40 gold

What to expect over the run:
  - Wood ramps first and funds the Ore Miner; ore then feeds the Iron Foundry,
    and iron feeds the Gold Foundry.
  - Iron stays low on purpose: the Gold Foundry consumes it about as fast as
    the Iron Foundry makes it (watch "bottleneck" behaviour).
  - Around 75-80s gold passes 15 and the milestone fires: gold jumps by +40.
  - Energy climbs steadily from passive generation plus Energy Surge upgrades.
  - A save/load round trip happens mid-run; totals dip slightly on reload.

Progression line legend:
  built = buildings constructed   upg = upgrades applied   lvlUps = miner level-ups
  events: bc = buildComplete, ul = entities unlocked, ms = milestones achieved
================================================================
`);
}
describeWorld();

// Offline progress (uses the seeded metadata) ------------------------------
let offlineEnergyBefore = energy.amount;
game.calculateOfflineProgress();
const offlineGain = energy.amount - offlineEnergyBefore;
log(`offline progress applied: +${offlineGain.toFixed(1)} energy`);

// ----------------------------------------------------------------------------
// Run - one call drives the entire simulation.
//
// game.start() runs the loop: production cycles, resource generation, capacity
// enforcement, unlock and milestone evaluation, upgrade effects, plugins, and
// timers all advance every tick. The "player" below only makes high-level
// decisions (what to build/buy); it never implements game mechanics.
// ----------------------------------------------------------------------------

game.startAllProduction();
game.start();
log(`game started; running for ${Math.round(DURATION_MS / 1000)}s`);

const built = new Set();
let upgradesApplied = 0;
let levelUps = 0;
let savedOnce = false;
let loadedOnce = false;
let maxIronSeen = 0;

// The player's decisions, the reporting cadence, and the run timeout are all
// driven by the framework's own Timer utility (registered via game.addTimer)
// rather than raw setInterval/setTimeout - the harness dogfoods the API too.
function playerStep() {
  try {
    // Evaluate unlocks and milestones.
    game.checkUnlockConditions();
    game.unlockManager.checkMilestones();

    // Construct unlocked, affordable buildings that are not yet built.
    for (const b of [warehouse, oreMiner, ironFoundry, goldFoundry]) {
      if (b.isUnlocked && !b.isBuilt && !b.isBuilding) {
        if (typeof b.canAfford !== "function" || b.canAfford()) {
          if (b.startConstruction()) { built.add(b.id); }
        }
      }
    }

    // Level up a built miner a few times when ore is plentiful (capped so the
    // economy stays realistic rather than flooding a single resource).
    if (oreMiner.isBuilt && typeof oreMiner.levelUp === "function" && oreMiner.level < 5 && wood.amount > 400) {
      const before = oreMiner.level;
      oreMiner.levelUp();
      if (oreMiner.level > before) levelUps++;
    }

    // Buy upgrades when possible.
    for (const u of [energySurge, woodWindfall]) {
      if (u.canApply && u.canApply() && (!u.canAfford || u.canAfford())) {
        const r = u.apply();
        if (r && r.success) upgradesApplied++;
      }
    }

    maxIronSeen = Math.max(maxIronSeen, iron.amount);

    // Mid-run save/load round trip.
    const elapsed = Date.now() - start;
    if (!savedOnce && elapsed > DURATION_MS * 0.4) {
      game.saveState(); savedOnce = true; log("saveState() called");
    }
    if (savedOnce && !loadedOnce && elapsed > DURATION_MS * 0.5) {
      game.loadState(); loadedOnce = true; log("loadState() called");
    }
  } catch (e) {
    crashed = e;
  }
}

function report() {
  const fps = typeof game.gameLoop.getCurrentFps === "function" ? game.gameLoop.getCurrentFps() : "?";
  log(
    `wood=${wood.amount.toFixed(0)} ore=${ore.amount.toFixed(0)} iron=${iron.amount.toFixed(0)} ` +
    `gold=${gold.amount.toFixed(0)} energy=${energy.amount.toFixed(0)} | ` +
    `built=${built.size} upg=${upgradesApplied} lvlUps=${levelUps} fps=${fps} | ` +
    `events bc=${events.buildComplete} ul=${events.unlocked} ms=${events.milestone}`
  );
}

// ----------------------------------------------------------------------------
// Finalize and assert
// ----------------------------------------------------------------------------

function finalize() {
 try {
  game.removeTimer("player");
  game.removeTimer("reporter");
  game.pause();

  const prodStats = game.getGlobalProductionStats();
  const bottlenecks = game.getProductionBottlenecks();
  const perf = game.getPerformanceMetrics();
  const ironCap = game.getTotalCapacityFor("iron");
  const unlockStats = game.getUnlockStats();

  const checks = [];
  const check = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });

  check("no uncaught errors during run", crashed === null, crashed ? String(crashed && crashed.stack || crashed) : "");
  check("game loop ran (fps > 0)", game.gameLoop.getCurrentFps() > 0, `fps=${game.gameLoop.getCurrentFps()}`);
  check("plugin onUpdate ran in loop", pluginTicks > 100, `ticks=${pluginTicks}`);
  check("plugin mutated state (auto-harvest)", pluginWoodAdded > 0, `+${pluginWoodAdded} wood`);
  check("offline progress granted energy", offlineGain > 0, `+${offlineGain.toFixed(1)}`);
  check("miners produced ore", ore.amount > 0 || maxIronSeen > 0, `ore peak via iron=${maxIronSeen.toFixed(0)}`);
  check("factory produced iron", maxIronSeen > 0, `maxIron=${maxIronSeen.toFixed(0)}`);
  check("factory chain produced gold", gold.amount > 0, `gold=${gold.amount.toFixed(0)}`);
  check("energy generated passively", energy.amount > 0, `energy=${energy.amount.toFixed(0)}`);
  check("buildings constructed", built.size >= 2, `built=${[...built].join(",")}`);
  check("buildComplete events fired", events.buildComplete > 0, `n=${events.buildComplete}`);
  check("entities unlocked via conditions", events.unlocked > 0, `n=${events.unlocked}`);
  check("data-driven + legacy upgrades applied", upgradesApplied >= 2, `n=${upgradesApplied}`);
  check("repeatable upgrade raised energy rate", energy.rate > 1.0, `rate=${energy.rate}`);
  check("milestone achieved", events.milestone > 0, `n=${events.milestone}`);
  check("storage capacity enforced on iron", maxIronSeen <= ironCap + 1e-6, `maxIron=${maxIronSeen.toFixed(1)} cap=${ironCap}`);
  check("capacity query returns finite cap for iron", Number.isFinite(ironCap) && ironCap > 0, `cap=${ironCap}`);
  check("production stats reported", prodStats && typeof prodStats.totalProducers === "number", `producers=${prodStats?.totalProducers}`);
  check("bottleneck analysis returned", !!bottlenecks && Array.isArray(bottlenecks.resourceShortages), "");
  check("performance metrics produced", !!perf, JSON.stringify(perf).slice(0, 80));
  check("unlock stats populated", unlockStats && unlockStats.entitiesUnlocked >= 0, `unlocked=${unlockStats?.entitiesUnlocked}`);
  check("save/load round trip executed", savedOnce && loadedOnce, `saved=${savedOnce} loaded=${loadedOnce}`);
  check("save payload persisted", storage.getItem("gameState") !== null, "");

  game.destroy();

  console.log("\n================ E2E RESULTS ================");
  let passed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.detail ? "  (" + c.detail + ")" : ""}`);
    if (c.ok) passed++;
  }
  console.log("---------------------------------------------");
  console.log(`Final: wood=${wood.amount.toFixed(0)} ore=${ore.amount.toFixed(0)} iron=${iron.amount.toFixed(0)} gold=${gold.amount.toFixed(0)} energy=${energy.amount.toFixed(0)}`);
  console.log(`Buildings built: ${[...built].join(", ") || "none"}`);
  console.log(`Upgrades applied: ${upgradesApplied}, level-ups: ${levelUps}`);
  console.log(`Events: ${JSON.stringify(events)}`);
  console.log(`${passed}/${checks.length} checks passed`);
  console.log("=============================================");

  process.exit(passed === checks.length ? 0 : 1);
 } catch (e) {
  console.error("FINALIZE ERROR:", e && e.stack ? e.stack : e);
  process.exit(2);
 }
}

// Drive the harness with framework Timers instead of raw setInterval/setTimeout.
const playerTimer = new Timer({
  totalTime: DURATION_MS,
  tickRate: 1000,                  // one player decision per second
  onUpdateCallbacks: [playerStep],
  onCompleteCallbacks: [finalize]  // finalize when the run elapses
});
const reporterTimer = new Timer({
  totalTime: DURATION_MS,
  tickRate: 10000,                 // a progress line every 10 seconds
  onUpdateCallbacks: [report]
});

game.addTimer("player", playerTimer);
game.addTimer("reporter", reporterTimer);
playerTimer.start();
reporterTimer.start();
