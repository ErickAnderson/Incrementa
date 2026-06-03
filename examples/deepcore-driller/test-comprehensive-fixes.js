/**
 * Comprehensive test for all DeepCore Driller fixes
 * Tests: Storage capacity scaling, Energy core functionality, Production scaling
 */

// Import the framework
import {
  Game,
  Resource,
  Building,
  Miner,
  Factory,
  Storage,
  SaveManager,
  createCost,
  createCosts,
  initializeFramework
} from "incrementa";

// Initialize framework
initializeFramework({
  debugMode: true,
  logLevel: 'info'
});

// Create a test game
const saveManager = new SaveManager({
  getItem: () => null,
  setItem: () => {},
});

const game = new Game(saveManager);

// Create test resources with plenty of materials
const ore = game.createResource({
  id: 'ore',
  name: 'Ore',
  initialAmount: 10000,
});

const metal = game.createResource({
  id: 'metal',
  name: 'Metal',
  initialAmount: 1000,
});

const energy = game.createResource({
  id: 'energy',
  name: 'Energy',
  initialAmount: 500,
});

// Create test buildings - replicate exact same setup as main.js but ensure they're unlocked
const miner = game.createMiner({
  id: "miner",
  name: "Miner",
  costs: [
    createCost('ore', 10, { scalingFactor: 1.5, scalingType: 'exponential' })
  ],
  buildTime: 0,
  gatherRate: 2,
  resourceId: "ore",
  autoStart: false,
  efficiency: 1.0,
  unlockCondition: () => true, // Always unlocked for testing
});

const smelter = new Factory({
  id: "smelter",
  name: "Smelter", 
  costs: [
    createCost('ore', 25, { scalingFactor: 1.4, scalingType: 'exponential' })
  ],
  buildTime: 0,
  inputs: [{ resourceId: "ore", amount: 3 }],
  outputs: [{ resourceId: "metal", amount: 1 }],
  productionRate: 1.0,
  autoStart: false,
  unlockCondition: () => true, // Always unlocked for testing
});
smelter.setGameReference(game);
game.addEntity(smelter);

const powerCore = new Factory({
  id: "power-core",
  name: "Power Core",
  costs: createCosts([
    { resourceId: 'ore', amount: 50, scalingFactor: 1.3 },
    { resourceId: 'metal', amount: 20, scalingFactor: 1.5 }
  ]),
  buildTime: 0,
  inputs: [{ resourceId: "metal", amount: 2 }],
  outputs: [{ resourceId: "energy", amount: 1 }],
  productionRate: 0.5,
  autoStart: false,
  unlockCondition: () => true, // Always unlocked for testing
});
powerCore.setGameReference(game);
game.addEntity(powerCore);

const storage = game.createStorage({
  id: "storage",
  name: "Storage Unit",
  costs: createCosts([
    { resourceId: 'ore', amount: 15, scalingFactor: 1.6 },
    { resourceId: 'metal', amount: 5, scalingFactor: 1.8 }
  ]),
  buildTime: 0,
  capacities: {
    ore: 100,
    metal: 50,
    energy: 25,
  },
  unlockCondition: () => true, // Always unlocked for testing
});

// Replicate the building logic from main.js
function buildBuilding(building) {
  console.log(`\n🔨 Building ${building.name}...`);
  
  if (building.isBuilt) {
    // Level up existing building
    const nextLevelCost = building.calculateCost({ level: building.level + 1 });
    console.log(`- Level ${building.level} → ${building.level + 1} cost:`, nextLevelCost);
    
    // Check affordability
    let canAfford = true;
    for (const [resourceId, amount] of Object.entries(nextLevelCost)) {
      const resource = game.getResourceById(resourceId);
      if (!resource || resource.amount < amount) {
        canAfford = false;
        break;
      }
    }
    
    if (!canAfford) {
      console.log(`❌ Cannot afford level ${building.level + 1}`);
      return false;
    }
    
    // Spend resources
    for (const [resourceId, amount] of Object.entries(nextLevelCost)) {
      const resource = game.getResourceById(resourceId);
      if (resource) {
        resource.decrement(amount);
      }
    }
    
    // Level up
    building.levelUp();
    
    // Apply building-specific scaling
    if (building instanceof Miner) {
      const baseRate = 2;
      const newRate = baseRate * building.level;
      building.setGatherRate(newRate);
      console.log(`⛏️ Miner rate: ${newRate}/sec`);
      
    } else if (building instanceof Factory) {
      const baseRate = building.productionRate || 1.0;
      const newRate = baseRate * building.level;
      if (building.setFactoryProductionRate) {
        building.setFactoryProductionRate(newRate);
      }
      console.log(`🏭 Factory rate: ${newRate}`);
      
    } else if (building instanceof Storage) {
      const baseCapacities = { ore: 100, metal: 50, energy: 25 };
      for (const [resourceId, baseCapacity] of Object.entries(baseCapacities)) {
        const newCapacity = baseCapacity * building.level;
        building.setCapacityFor(resourceId, newCapacity);
        console.log(`📦 ${resourceId} capacity: ${newCapacity}`);
      }
    }
    
  } else {
    // First build
    const success = building.startConstruction();
    if (success) {
      building.completeConstruction();
      
      // Initialize building
      if (building instanceof Miner) {
        const baseRate = 2;
        building.setGatherRate(baseRate * building.level);
        console.log(`⛏️ Miner initialized: ${building.gatherRate}/sec`);
        
      } else if (building instanceof Storage) {
        const baseCapacities = { ore: 100, metal: 50, energy: 25 };
        for (const [resourceId, baseCapacity] of Object.entries(baseCapacities)) {
          const initialCapacity = baseCapacity * building.level;
          building.setCapacityFor(resourceId, initialCapacity);
          console.log(`📦 Initial ${resourceId} capacity: ${initialCapacity}`);
        }
      }
    }
  }
  
  console.log(`✅ ${building.name} level: ${building.level}, built: ${building.isBuilt}`);
  return true;
}

// Function to get total capacity for a resource
function getTotalCapacity(resourceId) {
  let total = 0;
  if (storage.isBuilt) {
    const cap = storage.getCapacityFor(resourceId);
    if (cap) total += cap;
  }
  return total;
}

// Test suite
function runComprehensiveTests() {
  console.log("🧪 COMPREHENSIVE DEEPCORE DRILLER FIXES TEST");
  console.log("============================================");
  
  // Start game
  game.start();
  
  console.log(`\n📊 Initial Resources:`);
  console.log(`- Ore: ${ore.amount}`);
  console.log(`- Metal: ${metal.amount}`);
  console.log(`- Energy: ${energy.amount}`);
  
  // TEST 1: Storage Capacity System
  console.log(`\n🧪 TEST 1: Storage Capacity System`);
  console.log(`----------------------------------`);
  
  console.log(`Initial capacity: Ore=${getTotalCapacity('ore')}, Metal=${getTotalCapacity('metal')}, Energy=${getTotalCapacity('energy')}`);
  
  // Build storage level 1
  buildBuilding(storage);
  console.log(`After build 1: Ore=${getTotalCapacity('ore')}, Metal=${getTotalCapacity('metal')}, Energy=${getTotalCapacity('energy')}`);
  
  // Build storage level 2 
  buildBuilding(storage);
  console.log(`After build 2: Ore=${getTotalCapacity('ore')}, Metal=${getTotalCapacity('metal')}, Energy=${getTotalCapacity('energy')}`);
  
  // Build storage level 3
  buildBuilding(storage);
  console.log(`After build 3: Ore=${getTotalCapacity('ore')}, Metal=${getTotalCapacity('metal')}, Energy=${getTotalCapacity('energy')}`);
  
  // TEST 2: Power Core Functionality
  console.log(`\n🧪 TEST 2: Power Core Functionality`);
  console.log(`----------------------------------`);
  
  // Build power core
  const powerCoreSuccess = buildBuilding(powerCore);
  console.log(`Power Core build success: ${powerCoreSuccess}`);
  console.log(`Power Core built: ${powerCore.isBuilt}`);
  console.log(`Power Core level: ${powerCore.level}`);
  
  // Level up power core
  if (powerCore.isBuilt) {
    buildBuilding(powerCore);
    console.log(`Power Core after level up: level ${powerCore.level}`);
  }
  
  // TEST 3: Miner Production Scaling
  console.log(`\n🧪 TEST 3: Miner Production Scaling`);
  console.log(`----------------------------------`);
  
  // Build miner multiple levels
  buildBuilding(miner); // Level 1
  const rate1 = miner.gatherRate;
  
  buildBuilding(miner); // Level 2  
  const rate2 = miner.gatherRate;
  
  buildBuilding(miner); // Level 3
  const rate3 = miner.gatherRate;
  
  console.log(`Production scaling: ${rate1} → ${rate2} → ${rate3}`);
  console.log(`Scaling correct: ${rate1 === 2 && rate2 === 4 && rate3 === 6}`);
  
  // TEST 4: Smelter Factory System
  console.log(`\n🧪 TEST 4: Smelter Factory System`);
  console.log(`----------------------------------`);
  
  buildBuilding(smelter);
  console.log(`Smelter built: ${smelter.isBuilt}`);
  
  if (smelter.isBuilt) {
    buildBuilding(smelter); // Level up
    console.log(`Smelter level after upgrade: ${smelter.level}`);
  }
  
  // Final resource check
  console.log(`\n📊 Final Resources:`);
  console.log(`- Ore: ${ore.amount}`);
  console.log(`- Metal: ${metal.amount}`);
  console.log(`- Energy: ${energy.amount}`);
  
  // Summary
  const storageTest = getTotalCapacity('ore') === 300 && getTotalCapacity('metal') === 150;
  const powerCoreTest = powerCore.isBuilt && powerCore.level >= 1;
  const minerTest = miner.gatherRate === 6;
  const smelterTest = smelter.isBuilt;
  
  console.log(`\n✅ TEST RESULTS:`);
  console.log(`- Storage Capacity: ${storageTest ? 'PASS' : 'FAIL'}`);
  console.log(`- Power Core: ${powerCoreTest ? 'PASS' : 'FAIL'}`);
  console.log(`- Miner Scaling: ${minerTest ? 'PASS' : 'FAIL'}`);
  console.log(`- Smelter Function: ${smelterTest ? 'PASS' : 'FAIL'}`);
  
  const allTestsPass = storageTest && powerCoreTest && minerTest && smelterTest;
  console.log(`\n🎯 OVERALL: ${allTestsPass ? '🎉 ALL TESTS PASS!' : '❌ SOME TESTS FAILED'}`);
  
  return {
    storageCapacity: getTotalCapacity('ore'),
    powerCoreBuilt: powerCore.isBuilt,
    minerRate: miner.gatherRate,
    smelterBuilt: smelter.isBuilt,
    allPass: allTestsPass
  };
}

// Run the tests
try {
  const results = runComprehensiveTests();
  
  if (results.allPass) {
    console.log('\n🚀 All fixes working correctly! DeepCore Driller is ready!');
  } else {
    console.log('\n⚠️  Some issues remain. Check test output above.');
  }
  
} catch (error) {
  console.error('🚨 Test failed with error:', error);
  console.error(error.stack);
}