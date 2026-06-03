/**
 * DeepCore Driller - A comprehensive showcase of the Incrementa framework
 *
 * This game demonstrates the major Incrementa features:
 * - Resource management with capacity limits
 * - Timed, automated production
 * - Cost system with scaling
 * - Storage systems with overflow protection
 * - Data-driven upgrade system
 * - Event-driven architecture
 * - Plugin system for extensibility
 * - Performance monitoring
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
  EventBatchingSystem
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
  constructor() {
    this.config = {
      id: 'production-stats',
      name: 'Production Statistics Tracker',
      version: '1.0.0',
      author: 'Incrementa Framework',
      description: 'Tracks and displays production statistics'
    };
    
    this.game = null;
    this.eventManager = null;
    this.stats = {
      totalProduced: {},
      productionRates: {},
      efficiency: {}
    };
    this.updateInterval = null;
  }

  onLoad(game, eventManager) {
    console.log("🔌 Production Stats Plugin loaded");
    this.game = game;
    this.eventManager = eventManager;
    
    // Listen to production events
    this.eventManager.on('resourceProduced', (data) => {
      const { resourceId, amount, producerId } = data;
      if (!this.stats.totalProduced[resourceId]) {
        this.stats.totalProduced[resourceId] = 0;
      }
      this.stats.totalProduced[resourceId] += amount;
    });
  }

  onActivate() {
    console.log("🔌 Production Stats Plugin activated");
    
    // Update production display periodically
    this.updateInterval = setInterval(() => {
      this.updateProductionDisplay();
    }, 2000);
  }

  onDeactivate() {
    console.log("🔌 Production Stats Plugin deactivated");
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  onUnload() {
    console.log("🔌 Production Stats Plugin unloaded");
    this.onDeactivate();
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
    const buildingLevel = building.level || 1;
    
    if (building instanceof Miner) {
      // For the new Miner system, gatherRate already includes level scaling
      return building.gatherRate || 0;
    } else if (building instanceof Factory) {
      const baseRate = building.productionConfig?.rate?.base || building.productionRate || 0;
      return baseRate * buildingLevel;
    }
    return (building.productionRate || 0) * buildingLevel;
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
  const productionPlugin = new ProductionStatsPlugin();
  gameState.game.pluginSystem.registerPlugin(productionPlugin);
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

  // Ore - Basic raw material
  gameState.resources.ore = gameState.game.createResource({
    id: 'ore',
    name: 'Ore',
    description: 'Raw material extracted from the depths. Used to create Metal.',
    initialAmount: 0,
    tags: ['raw-material']
  });

  // Metal - Refined resource
  gameState.resources.metal = gameState.game.createResource({
    id: 'metal',
    name: 'Metal',
    description: 'Refined Ore ready for advanced construction.',
    initialAmount: 0,
    unlockCondition: () => gameState.resources.ore.amount >= 5,
    tags: ['refined-material']
  });

  // Energy - Late-game resource
  gameState.resources.energy = gameState.game.createResource({
    id: 'energy',
    name: 'Energy',
    description: 'Pure energy condensed from Metal. Required for the Deepcore Reactor.',
    initialAmount: 0,
    unlockCondition: () => gameState.resources.metal.amount >= 20,
    tags: ['energy']
  });

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
    efficiency: 1.0
  });

  // Smelter - Showcases Factory conversion mechanics
  gameState.buildings.smelter = new Factory({
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
  gameState.buildings.smelter.setGameReference(gameState.game);
  gameState.game.addEntity(gameState.buildings.smelter);

  // Power Core - Advanced Factory with multiple costs
  gameState.buildings.powerCore = new Factory({
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
  gameState.buildings.powerCore.setGameReference(gameState.game);
  gameState.game.addEntity(gameState.buildings.powerCore);

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
        console.log(`🔄 Started production for ${data.building.name}`);
      }
      
      // Apply building-specific initialization
      if (data.building instanceof Miner) {
        // Set initial production rate based on level
        const baseRate = 2; // Original gather rate
        const newRate = baseRate * data.building.level;
        data.building.setGatherRate(newRate);
        console.log(`⛏️ Miner ${data.building.name} gather rate set to ${newRate}/sec`);
        
      } else if (data.building instanceof Storage) {
        // Set initial storage capacities based on level
        const baseCapacities = {
          ore: 100,
          metal: 50,
          energy: 25
        };
        
        for (const [resourceId, baseCapacity] of Object.entries(baseCapacities)) {
          const initialCapacity = baseCapacity * data.building.level;
          data.building.setCapacityFor(resourceId, initialCapacity);
          console.log(`📦 Storage ${data.building.name} set ${resourceId} capacity to ${initialCapacity}`);
        }
        
      } else if (data.building instanceof Factory) {
        // Ensure factory production rate is set correctly
        console.log(`🏭 Factory ${data.building.name} production initialized`);
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
  gameState.upgrades.drillEfficiency = new Upgrade({
    id: "drill-efficiency",
    name: "Drill Efficiency",
    description: "Improves mining equipment, increasing Ore production by 50%.",
    costs: createCosts([
      { resourceId: 'ore', amount: 50 },
      { resourceId: 'metal', amount: 10 }
    ]),
    unlockCondition: () => {
      return (
        gameState.buildings.miner.isBuilt &&
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
  gameState.upgrades.drillEfficiency.setGameReference(gameState.game);
  gameState.game.addEntity(gameState.upgrades.drillEfficiency);

  // Smelting Speed - Showcases Factory rate modification
  gameState.upgrades.smeltingSpeed = new Upgrade({
    id: "smelting-speed",
    name: "Smelting Speed",
    description: "Advanced furnace technology increases Metal production by 40%.",
    costs: createCosts([
      { resourceId: 'ore', amount: 80 },
      { resourceId: 'metal', amount: 25 }
    ]),
    unlockCondition: () => {
      return (
        gameState.buildings.smelter.isBuilt &&
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
  gameState.upgrades.smeltingSpeed.setGameReference(gameState.game);
  gameState.game.addEntity(gameState.upgrades.smeltingSpeed);

  // Storage Optimization - Showcases capacity upgrades
  gameState.upgrades.storageOptimization = new Upgrade({
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
        gameState.buildings.storage.isBuilt &&
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
  gameState.upgrades.storageOptimization.setGameReference(gameState.game);
  gameState.game.addEntity(gameState.upgrades.storageOptimization);

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
 * Calculate the current production rate for a resource
 * Manually calculates based on active buildings and their levels
 */
function calculateProductionRate(resourceId) {
  let totalRate = 0;
  
  // Check all buildings for production/consumption of this resource
  Object.values(gameState.buildings).forEach(building => {
    if (!building.isBuilt) return;
    
    const buildingLevel = building.level || 1;
    
    // Check miners - they produce resources directly
    if (building instanceof Miner && building.resourceId === resourceId) {
      // For the new production system, miners scale production with level automatically
      // The gatherRate already includes level scaling via setGatherRate
      totalRate += building.gatherRate || 0;
    }
    
    // Check factories
    if (building instanceof Factory) {
      // For factories, check if they're actually producing
      if (building.isCurrentlyProducing && building.isCurrentlyProducing()) {
        // Check outputs
        const outputs = building.productionConfig?.outputs || building.outputs || [];
        outputs.forEach(output => {
          if (output.resourceId === resourceId) {
            const rate = building.productionConfig?.rate?.current || building.productionConfig?.rate?.base || building.productionRate || 1;
            // Production scales with building level
            totalRate += (output.amount || 1) * rate * buildingLevel;
          }
        });
        
        // Check inputs (consumption - negative rate)
        const inputs = building.productionConfig?.inputs || building.inputs || [];
        inputs.forEach(input => {
          if (input.resourceId === resourceId) {
            const rate = building.productionConfig?.rate?.current || building.productionConfig?.rate?.base || building.productionRate || 1;
            // Consumption also scales with building level
            totalRate -= (input.amount || 1) * rate * buildingLevel;
          }
        });
      }
    }
  });
  
  return totalRate;
}

/**
 * Build a building using the framework's cost system
 */
function buildBuilding(buildingId) {
  const building = gameState.buildings[buildingId];
  if (!building || building.isBuilding) return;

  // If building is already built, level it up instead of building again
  if (building.isBuilt) {
    // Check if we can afford the next level (costs scale with level)
    const nextLevelCost = building.calculateCost({ level: building.level + 1 });
    let canAffordNextLevel = true;
    
    // Check each resource requirement for next level
    for (const [resourceId, amount] of Object.entries(nextLevelCost)) {
      const resource = gameState.resources[resourceId];
      if (!resource || resource.amount < amount) {
        canAffordNextLevel = false;
        break;
      }
    }
    
    if (!canAffordNextLevel) {
      showNotification(`Cannot afford ${building.name} level ${building.level + 1}`, 'error');
      return;
    }

    // Spend resources for the level up manually
    for (const [resourceId, amount] of Object.entries(nextLevelCost)) {
      const resource = gameState.resources[resourceId];
      if (resource) {
        resource.decrement(amount);
      }
    }
    
    // Level up the building
    building.levelUp();
    
    // Apply level-specific upgrades based on building type
    if (building instanceof Miner) {
      // For miners, update gather rate to scale with level
      const baseRate = 2; // Original gather rate
      const newRate = baseRate * building.level;
      building.setGatherRate(newRate);
      console.log(`⛏️ Miner upgraded: level ${building.level}, rate ${newRate}/sec`);
      
    } else if (building instanceof Factory) {
      // For factories, increase production rate
      const baseRate = building.productionRate || 1.0;
      const newRate = baseRate * building.level;
      if (building.setFactoryProductionRate) {
        building.setFactoryProductionRate(newRate);
      }
      console.log(`🏭 Factory upgraded: level ${building.level}, rate ${newRate}`);
      
    } else if (building instanceof Storage) {
      // For storage, increase capacity for all managed resources
      const baseCapacities = {
        ore: 100,
        metal: 50,
        energy: 25
      };
      
      // Scale capacity by level
      for (const [resourceId, baseCapacity] of Object.entries(baseCapacities)) {
        const newCapacity = baseCapacity * building.level;
        building.setCapacityFor(resourceId, newCapacity);
        console.log(`📦 Storage upgraded: ${resourceId} capacity = ${newCapacity}`);
      }
      
    } else {
      // For other buildings, apply generic level scaling
      console.log(`🏗️ Building upgraded: ${building.name} level ${building.level}`);
    }
    
    updateBuildingDisplay();
    updateResourceDisplay();
    showNotification(`${building.name} upgraded to level ${building.level}!`, 'success');
  } else {
    // First time building - use normal construction process
    const success = building.startConstruction();
    if (success) {
      updateBuildingDisplay();
      updateResourceDisplay();
      showNotification(`Started building ${building.name}`, 'info');
    } else {
      // Construction failed - show reason
      console.warn(`Failed to start construction for ${building.name}`);
      showNotification(`Cannot build ${building.name}`, 'error');
    }
  }
}

/**
 * Purchase an upgrade using the framework's upgrade system
 */
function purchaseUpgrade(upgradeId) {
  const upgrade = gameState.upgrades[upgradeId];
  if (!upgrade || upgrade.purchased) return;

  // Check if we can afford it
  if (!upgrade.canAfford()) {
    showNotification(`Cannot afford ${upgrade.name}`, 'error');
    return;
  }

  // Deduct costs manually (since upgrade doesn't handle this automatically)
  if (upgrade.costs) {
    for (const cost of upgrade.costs) {
      const resource = gameState.resources[cost.resourceId];
      if (resource) {
        resource.decrement(cost.amount);
      }
    }
  }

  // Apply the upgrade effect
  try {
    upgrade.apply();
    upgrade.purchased = true;
    
    updateUpgradeDisplay();
    updateResourceDisplay();
    updateBuildingDisplay();
    
    showNotification(`${upgrade.name} researched!`, 'success');
  } catch (error) {
    console.error('Failed to apply upgrade:', error);
    showNotification(`Failed to apply ${upgrade.name}`, 'error');
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

      // Calculate production rate manually
      if (rateElement) {
        const productionRate = calculateProductionRate(resource.id);
        rateElement.textContent = productionRate !== 0 
          ? `${productionRate > 0 ? '+' : ''}${productionRate.toFixed(1)}/sec` 
          : "+0/sec";
      }

      // Get capacity from storage buildings
      const storageBuildings = Object.values(gameState.buildings).filter(b => b instanceof Storage && b.isBuilt);
      let totalCapacity = 0;
      
      // Calculate total capacity from all storage buildings
      storageBuildings.forEach(storage => {
        const storageCapacity = storage.getCapacityFor(resource.id);
        if (storageCapacity) {
          totalCapacity += storageCapacity;
        }
      });
      
      if (totalCapacity > 0) {
        const utilization = (resource.amount / totalCapacity) * 100;
        if (capacityElement) {
          capacityElement.textContent = `${Math.floor(resource.amount)}/${totalCapacity}`;
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

      if (building.isBuilt) {
        const level = building.level || 1;
        countElement.textContent = level > 1 ? `Lv.${level}` : `x1`;
      } else {
        countElement.textContent = `x0`;
      }

      // Use manual cost validation for better reliability
      let canAfford = true;
      const isBuilding = building.isBuilding;
      
      // Calculate cost for current or next level
      const targetLevel = building.isBuilt ? building.level + 1 : building.level;
      const requiredCost = building.calculateCost({ level: targetLevel });
      
      // Check each resource requirement
      for (const [resourceId, amount] of Object.entries(requiredCost)) {
        const resource = gameState.resources[resourceId];
        if (!resource || resource.amount < amount) {
          canAfford = false;
          break;
        }
      }

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
        
        // Show different text based on whether it's first build or upgrade
        if (building.isBuilt) {
          buttonElement.textContent = `Upgrade (Lv.${building.level + 1})`;
        } else {
          buttonElement.textContent = "Build";
        }
      } else {
        Object.values(originalColors).forEach(colorSet => {
          buttonElement.classList.remove(...colorSet.main.split(' '), ...colorSet.hover.split(' '));
        });
        buttonElement.classList.add("bg-gray-600", "cursor-not-allowed");
        buttonElement.disabled = true;
        
        if (isBuilding) {
          buttonElement.textContent = "Building...";
        } else if (building.isBuilt) {
          buttonElement.textContent = `Upgrade (Lv.${building.level + 1})`;
        } else {
          buttonElement.textContent = "Build";
        }
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
    gameState.game.saveState();
    console.log("💾 Game saved");
    showNotification("Game saved!", 'success');
  } catch (error) {
    console.error("Failed to save game:", error);
    showNotification("Failed to save game", 'error');
  }
}

/**
 * Load game state
 */
function loadGame() {
  try {
    gameState.game.loadState();
    console.log("📂 Game loaded");
    showNotification("Game loaded!", 'success');
    
    // Refresh UI after loading
    updateResourceDisplay();
    updateBuildingDisplay();
    updateUpgradeDisplay();
    updateWinProgress();
  } catch (error) {
    console.error("Failed to load game:", error);
    showNotification("Failed to load game", 'error');
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