/**
 * DeepCore Driller - A comprehensive showcase of the Incrementa framework
 *
 * This game demonstrates ALL major Incrementa features:
 * - Resource management with CapacityManager
 * - Timed production with ProductionManager
 * - Cost system with CostDefinition and scaling
 * - Storage systems with overflow protection
 * - Upgrade system with UpgradeEffectProcessor
 * - Event-driven architecture with EventManager
 * - Plugin system for extensibility
 * - Performance monitoring
 * - Entity registry pattern
 * - Save/Load functionality
 * - Win conditions and game progression
 */

// Import styles
import "./style.css";

// Import ALL Incrementa framework components to showcase capabilities
import {
  Game,
  Resource,
  Building,
  Miner,
  Factory,
  Storage,
  Upgrade,
  SaveManager,
  Timer,
  createCost,
  createCosts,
  ScalingFunctions,
  initializeFramework,
  setDebugMode,
  PluginSystem,
  PerformanceMonitor,
  EventBatchingSystem,
  createConfigBuilder
} from "incrementa";

// Initialize framework with custom configuration
initializeFramework({
  debugMode: false,
  logLevel: 'info',
  performanceMonitoring: true
});

// Game state object to hold all game entities and data
const gameState = {
  game: null,
  resources: {},
  buildings: {},
  upgrades: {},
  isGameWon: false,
  gameStartTime: Date.now(),
  plugins: {}
};

/**
 * Example Plugin: Production Statistics Tracker
 * Demonstrates the plugin system by tracking detailed production statistics
 */
class ProductionStatsPlugin {
  constructor(game) {
    this.game = game;
    this.stats = {
      totalProduced: {},
      productionRates: {},
      efficiency: {}
    };
  }

  onRegister() {
    console.log("🔌 Production Stats Plugin registered");
    
    // Listen to production events
    this.game.eventManager.on('resourceProduced', (data) => {
      const { resourceId, amount, producerId } = data;
      if (!this.stats.totalProduced[resourceId]) {
        this.stats.totalProduced[resourceId] = 0;
      }
      this.stats.totalProduced[resourceId] += amount;
    });

    // Update production display periodically
    setInterval(() => {
      this.updateProductionDisplay();
    }, 2000);
  }

  updateProductionDisplay() {
    const container = document.getElementById('production-status');
    if (!container) return;

    const activeProduction = [];
    
    // Check all miners
    Object.values(gameState.buildings).forEach(building => {
      if (building.isBuilt && building.productionRate > 0) {
        const rate = this.calculateActualRate(building);
        if (rate > 0) {
          activeProduction.push({
            name: building.name,
            rate: rate,
            resource: this.getResourceForBuilding(building)
          });
        }
      }
    });

    if (activeProduction.length === 0) {
      container.innerHTML = `
        <div class="text-center text-yellow-200/60 py-8">
          <div class="text-4xl mb-2">⚙️</div>
          <div>No active production</div>
        </div>
      `;
    } else {
      container.innerHTML = activeProduction.map(prod => `
        <div class="bg-yellow-800/20 rounded-lg p-3 border border-yellow-600/30">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-yellow-200">${prod.name}</span>
            <span class="text-yellow-300">+${prod.rate.toFixed(1)} ${prod.resource}/s</span>
          </div>
        </div>
      `).join('');
    }
  }

  calculateActualRate(building) {
    if (building instanceof Miner) {
      return building.gatherRate;
    } else if (building instanceof Factory) {
      return building.productionConfig?.rate?.base || 0;
    }
    return building.productionRate || 0;
  }

  getResourceForBuilding(building) {
    if (building instanceof Miner) {
      return building.resourceId;
    } else if (building instanceof Factory && building.productionConfig?.outputs?.[0]) {
      return building.productionConfig.outputs[0].resourceId;
    }
    return 'unknown';
  }

  getStats() {
    return this.stats;
  }
}

/**
 * Initialize the game and all its components
 * This function sets up the complete game state and starts the game loop
 */
function initializeGame() {
  console.log("🎮 Initializing DeepCore Driller...");

  // Create save manager with localStorage for browser storage
  const saveManager = new SaveManager({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  });

  // Create the main game instance
  gameState.game = new Game(saveManager);

  // Register custom plugin to showcase plugin system
  const productionPlugin = new ProductionStatsPlugin(gameState.game);
  gameState.game.pluginSystem.register('production-stats', productionPlugin);
  gameState.plugins.productionStats = productionPlugin;

  // Initialize all game systems
  setupResources();
  setupBuildings();
  setupUpgrades();
  setupEventListeners();
  setupPerformanceMonitoring();

  // Start the game loop
  gameState.game.start();

  // Set up auto-save every 30 seconds
  setInterval(() => {
    saveGame();
  }, 30000);

  console.log("✅ Game initialized successfully!");
  console.log("📊 Performance monitoring enabled");
  console.log("🔌 Plugin system active");
  console.log("💾 Auto-save enabled (every 30s)");
}

/**
 * Define and initialize all game resources
 * Showcases Resource entity with capacity integration
 */
function setupResources() {
  console.log("Setting up resources...");

  // Use ConfigBuilder for validation
  const resourceBuilder = createConfigBuilder('resource');

  // Ore - Basic raw material
  gameState.resources.ore = gameState.game.createResource(
    resourceBuilder
      .withId('ore')
      .withName('Ore')
      .withDescription('Raw material extracted from the depths. Used to create Metal.')
      .withInitialAmount(0)
      .withTags(['raw-material'])
      .build()
  );

  // Metal - Refined resource
  gameState.resources.metal = gameState.game.createResource(
    resourceBuilder
      .withId('metal')
      .withName('Metal')
      .withDescription('Refined Ore ready for advanced construction.')
      .withInitialAmount(0)
      .withUnlockCondition(() => gameState.resources.ore.amount >= 5)
      .withTags(['refined-material'])
      .build()
  );

  // Energy - Late-game resource
  gameState.resources.energy = gameState.game.createResource(
    resourceBuilder
      .withId('energy')
      .withName('Energy')
      .withDescription('Pure energy condensed from Metal. Required for the Deepcore Reactor.')
      .withInitialAmount(0)
      .withUnlockCondition(() => gameState.resources.metal.amount >= 20)
      .withTags(['energy'])
      .build()
  );

  // Set up real-time UI updates using event batching
  Object.values(gameState.resources).forEach((resource) => {
    resource.on("amountChanged", updateResourceDisplay);
    resource.on("unlocked", updateResourceDisplay);
    resource.on("capacityChanged", updateResourceDisplay);
  });

  console.log("✅ Resources initialized:", Object.keys(gameState.resources));
}

/**
 * Define and initialize all game buildings
 * Showcases all building types with new CostDefinition system
 */
function setupBuildings() {
  console.log("Setting up buildings...");

  const buildingBuilder = createConfigBuilder('building');

  // Miner - Showcases automatic resource extraction
  gameState.buildings.miner = gameState.game.createMiner({
    id: "miner",
    name: "Miner",
    description: "Automated ore extraction machine. Generates Ore continuously.",
    costs: [
      createCost('ore', 10, { scalingFactor: 1.5, scalingType: 'exponential' })
    ],
    buildTime: 3,
    gatherRate: 2,
    resourceId: "ore",
    autoStart: false,
    unlockCondition: () => gameState.resources.ore.amount >= 5,
    tags: ["production", "ore-generator"],
  });

  // Smelter - Showcases Factory conversion mechanics
  gameState.buildings.smelter = gameState.game.createFactory({
    id: "smelter",
    name: "Smelter", 
    description: "Refines raw Ore into valuable Metal.",
    costs: [
      createCost('ore', 25, { scalingFactor: 1.4, scalingType: 'exponential' })
    ],
    buildTime: 5,
    inputs: [{ resourceId: "ore", amount: 3 }],
    outputs: [{ resourceId: "metal", amount: 1 }],
    productionRate: 1.0,
    autoStart: false,
    unlockCondition: () => gameState.resources.ore.amount >= 15,
    tags: ["production", "conversion"],
  });

  // Power Core - Advanced Factory with multiple costs
  gameState.buildings.powerCore = gameState.game.createFactory({
    id: "power-core",
    name: "Power Core",
    description: "Advanced facility that transforms Metal into pure Energy.",
    costs: createCosts([
      { resourceId: 'ore', amount: 50, scalingFactor: 1.3 },
      { resourceId: 'metal', amount: 20, scalingFactor: 1.5 }
    ]),
    buildTime: 10,
    inputs: [{ resourceId: "metal", amount: 2 }],
    outputs: [{ resourceId: "energy", amount: 1 }],
    productionRate: 0.5,
    autoStart: false,
    unlockCondition: () => gameState.resources.metal.amount >= 10,
    tags: ["production", "energy-generation"],
  });

  // Storage Unit - Showcases capacity management
  gameState.buildings.storage = gameState.game.createStorage({
    id: "storage",
    name: "Storage Unit",
    description: "Expands storage capacity for all resources.",
    costs: createCosts([
      { resourceId: 'ore', amount: 15, scalingFactor: 1.6 },
      { resourceId: 'metal', amount: 5, scalingFactor: 1.8 }
    ]),
    buildTime: 4,
    capacities: {
      ore: 100,
      metal: 50,
      energy: 25,
    },
    unlockCondition: () => gameState.resources.ore.amount >= 20,
    tags: ["infrastructure", "storage"],
  });

  // Deepcore Reactor - Win condition with complex costs
  gameState.buildings.deepcoreReactor = gameState.game.createBuilding({
    id: "deepcore-reactor",
    name: "Deepcore Reactor",
    description: "The ultimate drilling achievement! Build this to win the game.",
    costs: createCosts([
      { resourceId: 'ore', amount: 500, scalingFactor: 1.0 },
      { resourceId: 'metal', amount: 200, scalingFactor: 1.0 },
      { resourceId: 'energy', amount: 100, scalingFactor: 1.0 }
    ]),
    buildTime: 30,
    unlockCondition: () => {
      return (
        gameState.resources.ore.amount >= 100 &&
        gameState.resources.metal.amount >= 50 &&
        gameState.resources.energy.amount >= 25 &&
        gameState.buildings.miner.isBuilt &&
        gameState.buildings.smelter.isBuilt &&
        gameState.buildings.powerCore.isBuilt
      );
    },
    tags: ["win-condition", "ultimate"],
  });

  // Listen for building events
  Object.values(gameState.buildings).forEach((building) => {
    building.on("buildComplete", (data) => {
      console.log(`🏗️ Building completed: ${data.building.name}`);
      
      // Start production for production buildings
      if (typeof data.building.startProduction === 'function') {
        data.building.startProduction();
      }
      
      updateBuildingDisplay();
      updateResourceDisplay();
      updateWinProgress();

      // Check win condition
      if (data.building.id === "deepcore-reactor") {
        triggerWinCondition();
      }
    });

    building.on("unlocked", updateBuildingDisplay);
    building.on("levelUp", updateBuildingDisplay);
    building.on("buildStart", updateBuildingDisplay);
    building.on("constructionFailed", (data) => {
      console.warn(`Construction failed for ${data.building.name}: ${data.reason}`);
      showNotification(`Cannot build ${data.building.name}: ${data.reason}`, 'error');
    });
  });

  console.log("✅ Buildings initialized:", Object.keys(gameState.buildings));
}

/**
 * Define and initialize all game upgrades
 * Showcases Upgrade system with UpgradeEffectProcessor
 */
function setupUpgrades() {
  console.log("Setting up upgrades...");

  // Drill Efficiency - Showcases upgrade effects on production
  gameState.upgrades.drillEfficiency = gameState.game.createUpgrade({
    id: "drill-efficiency",
    name: "Drill Efficiency",
    description: "Improves mining equipment, increasing Ore production by 50%.",
    costs: createCosts([
      { resourceId: 'ore', amount: 50 },
      { resourceId: 'metal', amount: 10 }
    ]),
    unlockCondition: () => {
      return (
        gameState.buildings.miner.level >= 2 &&
        gameState.resources.metal.amount >= 5
      );
    },
    effect: () => {
      const miner = gameState.buildings.miner;
      if (miner) {
        const currentRate = miner.gatherRate;
        miner.setGatherRate(currentRate * 1.5);
        console.log(`Drill Efficiency applied: Miner rate increased to ${miner.gatherRate}`);
      }
    },
    tags: ["production", "efficiency"],
  });

  // Smelting Speed - Showcases Factory rate modification
  gameState.upgrades.smeltingSpeed = gameState.game.createUpgrade({
    id: "smelting-speed",
    name: "Smelting Speed",
    description: "Advanced furnace technology increases Metal production by 40%.",
    costs: createCosts([
      { resourceId: 'ore', amount: 80 },
      { resourceId: 'metal', amount: 25 }
    ]),
    unlockCondition: () => {
      return (
        gameState.buildings.smelter.level >= 1 &&
        gameState.resources.metal.amount >= 15
      );
    },
    effect: () => {
      const smelter = gameState.buildings.smelter;
      if (smelter && smelter.productionConfig) {
        const newRate = smelter.productionConfig.rate.base * 1.4;
        smelter.setFactoryProductionRate(newRate);
        console.log(`Smelting Speed applied: Smelter rate increased`);
      }
    },
    tags: ["production", "efficiency"],
  });

  // Storage Optimization - Showcases capacity upgrades
  gameState.upgrades.storageOptimization = gameState.game.createUpgrade({
    id: "storage-optimization",
    name: "Storage Optimization",
    description: "Better organization doubles the capacity of all Storage Units.",
    costs: createCosts([
      { resourceId: 'ore', amount: 100 },
      { resourceId: 'metal', amount: 40 },
      { resourceId: 'energy', amount: 10 }
    ]),
    unlockCondition: () => {
      return (
        gameState.buildings.storage.level >= 1 &&
        gameState.resources.energy.amount >= 5
      );
    },
    effect: () => {
      const storage = gameState.buildings.storage;
      if (storage) {
        const resourceIds = storage.getManagedResourceIds();
        resourceIds.forEach((resourceId) => {
          const currentCapacity = storage.getCapacityFor(resourceId) || 0;
          storage.setCapacityFor(resourceId, currentCapacity * 2);
        });
        console.log(`Storage Optimization applied: All capacities doubled`);
      }
    },
    tags: ["infrastructure", "capacity"],
  });

  // Listen for upgrade events
  Object.values(gameState.upgrades).forEach((upgrade) => {
    upgrade.on("unlocked", updateUpgradeDisplay);
    upgrade.on("purchased", (data) => {
      console.log(`🔬 Upgrade purchased: ${data.upgrade.name}`);
      showNotification(`${data.upgrade.name} researched!`, 'success');
    });
  });

  console.log("✅ Upgrades initialized:", Object.keys(gameState.upgrades));
}

/**
 * Set up performance monitoring display
 */
function setupPerformanceMonitoring() {
  const monitor = gameState.game.performanceMonitor;
  
  // Display performance stats in console every 10 seconds during development
  if (gameState.game.config?.debugMode) {
    setInterval(() => {
      const metrics = monitor.getMetrics();
      console.log('📊 Performance Metrics:', {
        fps: metrics.fps.toFixed(1),
        frameTime: `${metrics.averageFrameTime.toFixed(2)}ms`,
        entityUpdates: metrics.entityUpdateTime.toFixed(2) + 'ms',
        eventProcessing: metrics.eventProcessingTime.toFixed(2) + 'ms'
      });
    }, 10000);
  }
}

/**
 * Manual mining with visual feedback
 */
function mineOre() {
  const oreResource = gameState.resources.ore;
  const mineButton = document.getElementById("mine-button");
  
  if (oreResource && mineButton) {
    const mined = oreResource.increment(1);
    
    if (mined) {
      // Success feedback
      mineButton.classList.add("scale-95");
      setTimeout(() => mineButton.classList.remove("scale-95"), 100);
      
      // Create floating +1 animation
      const floater = document.createElement('div');
      floater.className = 'absolute text-green-400 font-bold pointer-events-none animate-float-up';
      floater.textContent = '+1';
      floater.style.left = '50%';
      floater.style.top = '50%';
      mineButton.parentElement.appendChild(floater);
      setTimeout(() => floater.remove(), 1000);
    } else {
      // Capacity reached feedback
      mineButton.classList.add("shake");
      setTimeout(() => mineButton.classList.remove("shake"), 500);
      showNotification("Storage full! Build more Storage Units.", 'warning');
    }
  }
}

/**
 * Build a building using the framework's cost system
 */
function buildBuilding(buildingId) {
  const building = gameState.buildings[buildingId];
  if (!building || building.isBuilding) return;

  // The Building class now handles all validation and resource spending
  const success = building.startConstruction();

  if (success) {
    updateBuildingDisplay();
    updateResourceDisplay();
    showNotification(`Started building ${building.name}`, 'info');
  }
}

/**
 * Purchase an upgrade using the framework's upgrade system
 */
function purchaseUpgrade(upgradeId) {
  const upgrade = gameState.upgrades[upgradeId];
  if (!upgrade || upgrade.purchased) return;

  // Use the game's upgrade processor for proper handling
  const success = gameState.game.upgradeEffectProcessor.purchaseUpgrade(upgrade);

  if (success) {
    updateUpgradeDisplay();
    updateResourceDisplay();
    updateBuildingDisplay();
  }
}

/**
 * Update resource display with production rates from ProductionManager
 */
function updateResourceDisplay() {
  Object.values(gameState.resources).forEach((resource) => {
    const resourceElement = document.getElementById(`${resource.id}-resource`);
    const amountElement = document.getElementById(`${resource.id}-amount`);
    const rateElement = document.getElementById(`${resource.id}-rate`);
    const capacityElement = document.getElementById(`${resource.id}-capacity`);
    const progressElement = document.getElementById(`${resource.id}-progress`);

    if (!resourceElement || !amountElement) return;

    if (resource.id === "ore" || resource.isUnlocked) {
      resourceElement.style.display = "block";
      amountElement.textContent = Math.floor(resource.amount);

      // Get production rate from ProductionManager
      if (rateElement) {
        const productionRate = gameState.game.productionManager.getNetProductionRate(resource.id);
        rateElement.textContent = productionRate !== 0 
          ? `${productionRate > 0 ? '+' : ''}${productionRate.toFixed(1)}/sec` 
          : "+0/sec";
      }

      // Get capacity from CapacityManager
      const capacity = gameState.game.capacityManager.getTotalCapacity(resource.id);
      if (capacity > 0) {
        const utilization = (resource.amount / capacity) * 100;
        if (capacityElement) {
          capacityElement.textContent = `${Math.floor(resource.amount)}/${capacity}`;
        }
        if (progressElement) {
          progressElement.style.width = `${Math.min(utilization, 100)}%`;
        }
      } else {
        if (capacityElement) capacityElement.textContent = "Unlimited";
        if (progressElement) progressElement.style.width = "0%";
      }
    } else {
      resourceElement.style.display = "none";
    }
  });
}

/**
 * Update building display with cost calculations
 */
function updateBuildingDisplay() {
  const noBuildingsMessage = document.getElementById("no-buildings");
  let hasVisibleBuildings = false;

  Object.values(gameState.buildings).forEach((building) => {
    const buildingElement = document.getElementById(`${building.id}-building`);
    const countElement = document.getElementById(`${building.id}-count`);
    const buttonElement = document.getElementById(`${building.id}-button`);
    const progressElement = document.getElementById(`${building.id}-progress`);

    if (!buildingElement || !countElement || !buttonElement) return;

    if (building.isUnlocked) {
      buildingElement.style.display = "block";
      hasVisibleBuildings = true;

      const buildingCount = building.isBuilt ? (building.level || 1) : 0;
      countElement.textContent = `x${buildingCount}`;

      // Use the cost system for validation
      const canAfford = building.canAfford();
      const isBuilding = building.isBuilding;

      // Update button state
      const originalColors = {
        'miner': { main: 'bg-green-600', hover: 'hover:bg-green-500' },
        'smelter': { main: 'bg-orange-600', hover: 'hover:bg-orange-500' },
        'power-core': { main: 'bg-purple-600', hover: 'hover:bg-purple-500' },
        'storage': { main: 'bg-blue-600', hover: 'hover:bg-blue-500' },
        'deepcore-reactor': { main: 'bg-gradient-to-r from-red-600 to-pink-600', hover: 'hover:from-red-500 hover:to-pink-500' }
      };

      const colors = originalColors[building.id] || { main: 'bg-gray-600', hover: 'hover:bg-gray-500' };

      if (canAfford && !isBuilding) {
        buttonElement.classList.remove("bg-gray-600", "cursor-not-allowed");
        buttonElement.classList.add(...colors.main.split(' '), ...colors.hover.split(' '));
        buttonElement.disabled = false;
        buttonElement.textContent = "Build";
      } else {
        Object.values(originalColors).forEach(colorSet => {
          buttonElement.classList.remove(...colorSet.main.split(' '), ...colorSet.hover.split(' '));
        });
        buttonElement.classList.add("bg-gray-600", "cursor-not-allowed");
        buttonElement.disabled = true;
        buttonElement.textContent = isBuilding ? "Building..." : "Build";
      }

      // Update build progress
      if (progressElement && isBuilding) {
        // Calculate progress based on build time
        const progress = building.buildTimer 
          ? ((building.buildTime - building.buildTimer.getTimeRemaining()) / building.buildTime * 100).toFixed(1)
          : 0;
        progressElement.textContent = `Building... ${progress}%`;
        progressElement.style.display = "block";
      } else if (progressElement) {
        progressElement.style.display = "none";
      }
    } else {
      buildingElement.style.display = "none";
    }
  });

  if (noBuildingsMessage) {
    noBuildingsMessage.style.display = hasVisibleBuildings ? "none" : "block";
  }
}

/**
 * Update upgrade display
 */
function updateUpgradeDisplay() {
  const noUpgradesMessage = document.getElementById("no-upgrades");
  let hasVisibleUpgrades = false;

  Object.values(gameState.upgrades).forEach((upgrade) => {
    const upgradeElement = document.getElementById(`${upgrade.id}-upgrade`);
    const buttonElement = document.getElementById(`${upgrade.id}-button`);

    if (!upgradeElement || !buttonElement) return;

    if (upgrade.isUnlocked && !upgrade.purchased) {
      upgradeElement.style.display = "block";
      hasVisibleUpgrades = true;

      const canAfford = upgrade.canAfford();

      if (canAfford) {
        buttonElement.classList.remove("bg-gray-600", "cursor-not-allowed");
        buttonElement.classList.add("bg-indigo-600", "hover:bg-indigo-500");
        buttonElement.disabled = false;
      } else {
        buttonElement.classList.remove("bg-indigo-600", "hover:bg-indigo-500");
        buttonElement.classList.add("bg-gray-600", "cursor-not-allowed");
        buttonElement.disabled = true;
      }
    } else {
      upgradeElement.style.display = "none";
    }
  });

  if (noUpgradesMessage) {
    noUpgradesMessage.style.display = hasVisibleUpgrades ? "none" : "block";
  }
}

/**
 * Update win condition progress
 */
function updateWinProgress() {
  const progressElement = document.getElementById('win-progress');
  if (!progressElement) return;

  const reactor = gameState.buildings.deepcoreReactor;
  const requirements = [
    { name: 'Build 1 Miner', completed: gameState.buildings.miner.isBuilt },
    { name: 'Build 1 Smelter', completed: gameState.buildings.smelter.isBuilt },
    { name: 'Build 1 Power Core', completed: gameState.buildings.powerCore.isBuilt },
    { name: 'Gather 100 Ore', completed: gameState.resources.ore.amount >= 100 },
    { name: 'Refine 50 Metal', completed: gameState.resources.metal.amount >= 50 },
    { name: 'Generate 25 Energy', completed: gameState.resources.energy.amount >= 25 }
  ];

  const completedCount = requirements.filter(r => r.completed).length;
  const totalCount = requirements.length;

  progressElement.innerHTML = `
    <div class="space-y-2">
      <div class="flex justify-between items-center mb-2">
        <span>Progress:</span>
        <span>${completedCount}/${totalCount}</span>
      </div>
      <div class="w-full bg-red-900/30 rounded-full h-2">
        <div class="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full transition-all duration-300" 
             style="width: ${(completedCount / totalCount) * 100}%"></div>
      </div>
      <div class="space-y-1 mt-3">
        ${requirements.map(req => `
          <div class="flex items-center space-x-2 text-xs">
            <span class="${req.completed ? 'text-green-400' : 'text-red-400'}">${req.completed ? '✓' : '✗'}</span>
            <span class="${req.completed ? 'text-red-200/70 line-through' : 'text-red-200/70'}">${req.name}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Show reactor when all requirements are met
  if (completedCount === totalCount && reactor.isUnlocked) {
    progressElement.innerHTML += `
      <div class="mt-4 p-3 bg-red-800/30 rounded-lg border border-red-600/50">
        <div class="text-center text-red-200 font-bold">
          🎯 Deepcore Reactor Unlocked!
        </div>
      </div>
    `;
  }
}

/**
 * Show notification messages
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 z-50`;
  
  const colors = {
    info: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  };
  
  notification.classList.add(colors[type] || colors.info);
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('translate-x-0'), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Trigger win condition
 */
function triggerWinCondition() {
  gameState.isGameWon = true;
  const completionTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
  const minutes = Math.floor(completionTime / 60);
  const seconds = completionTime % 60;

  const completionTimeElement = document.getElementById("completion-time");
  const winScreenElement = document.getElementById("win-screen");

  if (completionTimeElement) {
    completionTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  if (winScreenElement) {
    winScreenElement.style.display = "flex";
  }

  // Get final stats from plugin
  const stats = gameState.plugins.productionStats?.getStats();
  if (stats) {
    console.log("🏆 Final Production Stats:", stats);
  }

  console.log("🎉 Game Won! Deepcore Reactor completed!");
}

/**
 * Save game state
 */
function saveGame() {
  try {
    gameState.game.save();
    console.log("💾 Game saved");
  } catch (error) {
    console.error("Failed to save game:", error);
  }
}

/**
 * Load game state
 */
function loadGame() {
  try {
    gameState.game.load();
    console.log("📂 Game loaded");
    
    // Refresh UI after loading
    updateResourceDisplay();
    updateBuildingDisplay();
    updateUpgradeDisplay();
    updateWinProgress();
  } catch (error) {
    console.error("Failed to load game:", error);
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  console.log("Setting up event listeners...");

  // Make functions globally available
  window.mineOre = mineOre;
  window.buildBuilding = buildBuilding;
  window.purchaseUpgrade = purchaseUpgrade;
  window.saveGame = saveGame;
  window.loadGame = loadGame;

  // Manual mining button
  const mineButton = document.getElementById("mine-button");
  if (mineButton) {
    mineButton.addEventListener("click", mineOre);
  }

  // Save/Load buttons (if added to UI)
  const saveButton = document.getElementById("save-button");
  if (saveButton) {
    saveButton.addEventListener("click", saveGame);
  }

  const loadButton = document.getElementById("load-button");
  if (loadButton) {
    loadButton.addEventListener("click", loadGame);
  }

  // Use event delegation for dynamic content
  document.addEventListener('click', (e) => {
    // Building buttons
    if (e.target.id && e.target.id.endsWith('-button')) {
      const buildingId = e.target.id.replace('-button', '');
      if (gameState.buildings[buildingId]) {
        buildBuilding(buildingId);
      } else if (gameState.upgrades[buildingId]) {
        purchaseUpgrade(buildingId);
      }
    }
  });

  // Set up periodic UI updates with event batching
  const uiUpdateInterval = setInterval(() => {
    updateResourceDisplay();
    updateBuildingDisplay();
    updateUpgradeDisplay();
    updateWinProgress();
  }, 100); // Fast updates for smooth UI

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(uiUpdateInterval);
    saveGame();
  });

  // Initial UI update
  updateResourceDisplay();
  updateBuildingDisplay();
  updateUpgradeDisplay();
  updateWinProgress();
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes float-up {
    0% { transform: translate(-50%, -50%) translateY(0); opacity: 1; }
    100% { transform: translate(-50%, -50%) translateY(-30px); opacity: 0; }
  }
  .animate-float-up {
    animation: float-up 1s ease-out forwards;
  }
  .shake {
    animation: shake 0.5s ease-in-out;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);

// Initialize the game when the page loads
document.addEventListener("DOMContentLoaded", initializeGame);