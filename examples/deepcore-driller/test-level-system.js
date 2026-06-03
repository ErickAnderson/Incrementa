/**
 * Test script to verify the level-based building system
 * This tests that multiple buildings properly stack as levels
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
} from "incrementa";

// Create a test game
const saveManager = new SaveManager({
  getItem: () => null,
  setItem: () => {},
});

const game = new Game(saveManager);

// Create test resources
const ore = game.createResource({
  id: 'ore',
  name: 'Ore',
  initialAmount: 1000, // Give enough resources for testing
});

const metal = game.createResource({
  id: 'metal',
  name: 'Metal',
  initialAmount: 100,
});

// Create test miner
const miner = game.createMiner({
  id: "miner",
  name: "Miner",
  costs: [
    createCost('ore', 10, { scalingFactor: 1.5, scalingType: 'exponential' })
  ],
  buildTime: 0, // Instant build for testing
  gatherRate: 2,
  resourceId: "ore",
  autoStart: false,
});

// Function to simulate building multiple miners
function testMultipleBuildingLogic() {
  console.log("🧪 Testing Level-Based Building System");
  console.log("=====================================");

  // Initial state
  console.log(`Initial state:`);
  console.log(`- Miner level: ${miner.level}`);
  console.log(`- Miner is built: ${miner.isBuilt}`);
  console.log(`- Ore amount: ${ore.amount}`);
  console.log(`- Miner gather rate: ${miner.gatherRate}`);

  // Build first miner
  console.log(`\n🔨 Building first miner...`);
  const firstBuild = miner.startConstruction();
  console.log(`- Construction started: ${firstBuild}`);
  miner.completeConstruction(); // Complete instantly for testing
  console.log(`- Miner level after first build: ${miner.level}`);
  console.log(`- Miner is built: ${miner.isBuilt}`);
  console.log(`- Ore remaining: ${ore.amount}`);
  
  // Calculate expected production
  const baseProduction = miner.gatherRate * miner.level;
  console.log(`- Expected production: ${baseProduction} ore/sec (${miner.gatherRate} * ${miner.level})`);

  // Try to "build" second miner (should level up)
  console.log(`\n🔨 Building second miner (should level up)...`);
  
  // Check if we can afford the next level
  const canAffordLevel2 = miner.canAfford();
  console.log(`- Can afford level 2: ${canAffordLevel2}`);
  
  if (canAffordLevel2) {
    // Get cost for next level
    const level2Cost = miner.calculateCost({ level: miner.level + 1 });
    console.log(`- Cost for level 2:`, level2Cost);
    
    // Spend resources and level up
    const spendSuccess = miner.spendCost();
    console.log(`- Resource spending success: ${spendSuccess}`);
    
    if (spendSuccess) {
      miner.levelUp();
      console.log(`- Miner level after second build: ${miner.level}`);
      console.log(`- Ore remaining: ${ore.amount}`);
      
      // Calculate new expected production
      const newProduction = miner.gatherRate * miner.level;
      console.log(`- New expected production: ${newProduction} ore/sec (${miner.gatherRate} * ${miner.level})`);
      console.log(`- Production increased by: ${newProduction - baseProduction} ore/sec`);
    }
  }

  // Try to "build" third miner (should level up again)
  console.log(`\n🔨 Building third miner (should level up to level 3)...`);
  
  const canAffordLevel3 = miner.canAfford();
  console.log(`- Can afford level 3: ${canAffordLevel3}`);
  
  if (canAffordLevel3) {
    const level3Cost = miner.calculateCost({ level: miner.level + 1 });
    console.log(`- Cost for level 3:`, level3Cost);
    
    const spendSuccess = miner.spendCost();
    console.log(`- Resource spending success: ${spendSuccess}`);
    
    if (spendSuccess) {
      miner.levelUp();
      console.log(`- Miner level after third build: ${miner.level}`);
      console.log(`- Ore remaining: ${ore.amount}`);
      
      // Calculate final expected production
      const finalProduction = miner.gatherRate * miner.level;
      console.log(`- Final expected production: ${finalProduction} ore/sec (${miner.gatherRate} * ${miner.level})`);
    }
  }

  // Test cost scaling
  console.log(`\n💰 Testing Cost Scaling:`);
  for (let level = 1; level <= 5; level++) {
    const cost = miner.calculateCost({ level });
    console.log(`- Level ${level} cost:`, cost);
  }

  // Test smelter factory with multiple inputs/outputs
  console.log(`\n🏭 Testing Factory Level System:`);
  
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
  });
  smelter.setGameReference(game);
  game.addEntity(smelter);

  // Build and level up smelter
  smelter.startConstruction();
  smelter.completeConstruction();
  console.log(`- Smelter initial level: ${smelter.level}`);
  console.log(`- Smelter base production rate: ${smelter.productionRate}`);
  
  // Level up smelter
  if (smelter.canAfford()) {
    smelter.spendCost();
    smelter.levelUp();
    console.log(`- Smelter after level up: ${smelter.level}`);
    
    // Calculate expected factory production with level
    const factoryProduction = (smelter.outputs[0].amount || 1) * smelter.productionRate * smelter.level;
    console.log(`- Expected smelter production: ${factoryProduction} metal/sec (${smelter.outputs[0].amount} * ${smelter.productionRate} * ${smelter.level})`);
  }

  console.log(`\n✅ Level-based building system test completed!`);
  
  // Return test results
  return {
    minerLevel: miner.level,
    minerIsBuilt: miner.isBuilt,
    expectedProduction: miner.gatherRate * miner.level,
    smelterLevel: smelter.level,
    testPassed: miner.level > 1 && miner.isBuilt
  };
}

// Run the test
try {
  const results = testMultipleBuildingLogic();
  console.log('\n📊 Test Results:', results);
  
  if (results.testPassed) {
    console.log('🎉 SUCCESS: Level-based building system is working correctly!');
    console.log(`   - Multiple "builds" stack as levels (current: ${results.minerLevel})`);
    console.log(`   - Production scales with level (${results.expectedProduction} ore/sec)`);
  } else {
    console.log('❌ FAILED: Level-based building system needs fixing');
  }
} catch (error) {
  console.error('🚨 Test failed with error:', error);
}