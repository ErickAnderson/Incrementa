/**
 * Incrementa end-to-end simulation.
 *
 * Consumes Incrementa as an installed npm package (resolves to dist via the
 * package "exports" map, not the source) and runs the real game loop for a
 * few minutes while a scripted "player" unlocks entities, constructs
 * buildings, levels them up, and buys upgrades. Exercises every major
 * subsystem and asserts invariants at the end.
 *
 * Run: node sim.mjs            (defaults to ~180s)
 *      DURATION_MS=60000 node sim.mjs
 */

import {
  Game,
  SaveManager,
  Factory,
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
// World
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

// Event instrumentation ----------------------------------------------------
const events = { amountChanged: 0, buildComplete: 0, unlocked: 0, levelUp: 0, milestone: 0 };
game.on("amountChanged", () => events.amountChanged++);
game.on("buildComplete", () => events.buildComplete++);
game.on("unlocked", () => events.unlocked++);
game.on("levelUp", () => events.levelUp++);
// Milestone events are emitted on the UnlockManager's own event bus.
game.unlockManager.on("milestoneAchieved", () => { events.milestone++; });

// Offline progress (uses the seeded metadata) ------------------------------
let offlineEnergyBefore = energy.amount;
game.calculateOfflineProgress();
const offlineGain = energy.amount - offlineEnergyBefore;
log(`offline progress applied: +${offlineGain.toFixed(1)} energy`);

// ----------------------------------------------------------------------------
// Run
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

const player = setInterval(() => {
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
}, 1000);

const reporter = setInterval(() => {
  const fps = typeof game.gameLoop.getCurrentFps === "function" ? game.gameLoop.getCurrentFps() : "?";
  log(
    `wood=${wood.amount.toFixed(0)} ore=${ore.amount.toFixed(0)} iron=${iron.amount.toFixed(0)} ` +
    `gold=${gold.amount.toFixed(0)} energy=${energy.amount.toFixed(0)} | ` +
    `built=${built.size} upg=${upgradesApplied} lvlUps=${levelUps} fps=${fps} | ` +
    `events bc=${events.buildComplete} ul=${events.unlocked} ms=${events.milestone}`
  );
}, 10000);

// ----------------------------------------------------------------------------
// Finalize and assert
// ----------------------------------------------------------------------------

setTimeout(() => {
 try {
  clearInterval(player);
  clearInterval(reporter);
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
}, DURATION_MS);
