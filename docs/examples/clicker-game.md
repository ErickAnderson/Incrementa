# Building a Complete Clicker Game

This tutorial walks through creating a complete incremental clicker game using Incrementa. We'll build a cookie clicker-style game with manual clicking, auto-clickers, upgrades, and prestige mechanics.

> **Live Example**: Check out the [`examples/hello-world`](../../examples/hello-world/) directory for a complete implementation.

## 🎯 Game Overview

We'll create "Cookie Empire" with these features:
- Manual cookie clicking
- Auto-clicker buildings
- Upgrade system for click efficiency
- Prestige mechanics
- Save/load functionality
- Responsive UI

## 🏗️ Project Setup

### 1. Initialize Project
```bash
mkdir cookie-empire
cd cookie-empire
npm init -y
npm install incrementa
npm install --save-dev typescript vite

# Create project structure
mkdir src public
```

### 2. Basic Files

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**vite.config.js:**
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020'
  },
  esbuild: {
    target: 'es2020'
  }
});
```

## 🎮 Core Game Logic

### 1. Game Initialization

**src/game.ts:**
```typescript
import { Game, SaveManager, Resource, Building, Upgrade } from 'incrementa';

export class CookieGame {
    private game: Game;
    private cookies: Resource;
    private clickPower: number = 1;
    private totalCookiesEver: number = 0;

    constructor() {
        const saveManager = new SaveManager(localStorage);
        this.game = new Game(saveManager);
        this.setupGame();
    }

    private setupGame() {
        this.createResources();
        this.createBuildings();
        this.createUpgrades();
        this.setupEventListeners();
        this.game.start();
        
        // Load saved game if it exists
        this.game.loadState();
        this.updateClickPower();
    }

    private createResources() {
        // Main currency
        this.cookies = this.game.entities.createResource({
            name: 'Cookies',
            initialAmount: 0,
            rate: 0, // No passive generation initially
            description: 'Delicious cookies baked with love'
        });

        // Prestige currency
        this.game.entities.createResource({
            name: 'Prestige Points',
            initialAmount: 0,
            rate: 0,
            description: 'Points earned from prestigious achievements'
        });
    }

    private createBuildings() {
        // Auto-clicker buildings with exponential costs
        const buildings = [
            {
                name: 'Cursor',
                description: 'Automatically clicks for you',
                baseCost: 15,
                production: 0.1,
                multiplier: 1.15
            },
            {
                name: 'Grandma',
                description: 'Experienced cookie baker',
                baseCost: 100,
                production: 1,
                multiplier: 1.15
            },
            {
                name: 'Farm',
                description: 'Grows cookie ingredients',
                baseCost: 1100,
                production: 8,
                multiplier: 1.15
            },
            {
                name: 'Mine',
                description: 'Mines chocolate chips',
                baseCost: 12000,
                production: 47,
                multiplier: 1.15
            },
            {
                name: 'Factory',
                description: 'Mass produces cookies',
                baseCost: 130000,
                production: 260,
                multiplier: 1.15
            }
        ];

        buildings.forEach((buildingData, index) => {
            this.createAutoclicker(buildingData, index);
        });
    }

    private createAutoclicker(data: any, index: number) {
        const building = this.game.entities.createMiner({
            name: data.name,
            description: data.description,
            resourceId: 'cookies',
            gatherRate: data.production,
            buildTime: 0, // Instant construction
            costs: [{ resourceId: 'cookies', amount: data.baseCost }],
            autoStart: true,
            tags: ['autoclicker', `tier-${index + 1}`]
        });

        // Store building data for cost scaling
        (building as any).baseCost = data.baseCost;
        (building as any).costMultiplier = data.multiplier;
        (building as any).ownedCount = 0;
    }

    private createUpgrades() {
        // Click power upgrades
        const clickUpgrades = [
            { name: 'Reinforced Index Finger', cost: 100, multiplier: 2 },
            { name: 'Carpal Tunnel Prevention Cream', cost: 500, multiplier: 2 },
            { name: 'Ambidextrous', cost: 10000, multiplier: 2 },
            { name: 'Thousand Fingers', cost: 100000, multiplier: 5 },
            { name: 'Million Fingers', cost: 10000000, multiplier: 10 }
        ];

        clickUpgrades.forEach((upgradeData, index) => {
            this.game.entities.createUpgrade({
                name: upgradeData.name,
                description: `Increases click power by ${upgradeData.multiplier}x`,
                costs: [{ resourceId: 'cookies', amount: upgradeData.cost }],
                effect: {
                    type: 'custom',
                    callback: () => {
                        this.clickPower *= upgradeData.multiplier;
                        this.updateClickPower();
                    }
                },
                unlockCondition: index === 0 ? undefined : () => {
                    // Unlock based on total cookies baked
                    return this.totalCookiesEver >= upgradeData.cost / 10;
                },
                tags: ['click-upgrade']
            });
        });

        // Building efficiency upgrades
        this.createBuildingUpgrades();
    }

    private createBuildingUpgrades() {
        const buildings = this.game.entities.getBuildings();
        
        buildings.forEach(building => {
            if (building.tags?.includes('autoclicker')) {
                // Create efficiency upgrade for each building type
                this.game.entities.createUpgrade({
                    name: `${building.name} Efficiency`,
                    description: `Doubles the productivity of all ${building.name}s`,
                    costs: [{ 
                        resourceId: 'cookies', 
                        amount: (building as any).baseCost * 10 
                    }],
                    effect: {
                        type: 'property_modifier',
                        target: { 
                            entityName: building.name,
                            entityType: 'Miner'
                        },
                        property: 'gatherRate',
                        operation: 'multiply',
                        value: 2
                    },
                    unlockCondition: () => {
                        // Unlock when you own 5 of this building
                        return (building as any).ownedCount >= 5;
                    },
                    tags: ['building-upgrade', building.name.toLowerCase()]
                });
            }
        });
    }

    private setupEventListeners() {
        // Track total cookies for achievements and unlocks
        this.game.events.on('resourceChanged', (data) => {
            if (data.resourceId === 'cookies' && data.delta > 0) {
                this.totalCookiesEver += data.delta;
                this.checkAchievements();
            }
        });

        // Update building counts for upgrade unlocks
        this.game.events.on('buildComplete', (data) => {
            if (data.building.tags?.includes('autoclicker')) {
                (data.building as any).ownedCount++;
                this.game.unlocks.checkUnlockConditions();
            }
        });

        // Auto-save every 30 seconds
        setInterval(() => {
            this.saveGame();
        }, 30000);
    }

    // Public methods for UI interaction
    public clickCookie(): number {
        const gained = this.clickPower;
        this.cookies.increment(gained);
        this.showClickEffect(gained);
        return gained;
    }

    public buyBuilding(buildingName: string): boolean {
        const building = this.game.entities.getBuildings()
            .find(b => b.name === buildingName);
        
        if (!building) return false;

        const currentCost = this.getBuildingCost(building);
        
        if (this.cookies.amount >= currentCost) {
            this.cookies.decrement(currentCost);
            
            // Increase cost for next purchase
            (building as any).baseCost = Math.floor(
                (building as any).baseCost * (building as any).costMultiplier
            );
            
            // Create a new instance (simulate buying another)
            const newBuilding = this.game.entities.createMiner({
                name: building.name,
                resourceId: 'cookies',
                gatherRate: (building as any).gatherRate,
                buildTime: 0,
                costs: [],
                autoStart: true,
                tags: building.tags
            });
            
            (building as any).ownedCount++;
            
            return true;
        }
        
        return false;
    }

    public buyUpgrade(upgradeName: string): boolean {
        const upgrade = this.game.entities.getUpgrades()
            .find(u => u.name === upgradeName && u.isUnlocked);
        
        if (!upgrade) return false;

        return this.game.costSystem.canAfford(upgrade.costs) && 
               this.game.costSystem.spendCost(upgrade.costs);
    }

    public getBuildingCost(building: Building): number {
        return (building as any).baseCost;
    }

    public getBuildingCount(buildingName: string): number {
        const building = this.game.entities.getBuildings()
            .find(b => b.name === buildingName);
        return building ? (building as any).ownedCount : 0;
    }

    public getStats() {
        return {
            cookies: this.cookies.amount,
            cookiesPerSecond: this.calculateCPS(),
            totalCookiesEver: this.totalCookiesEver,
            clickPower: this.clickPower,
            buildings: this.game.entities.getBuildings().map(b => ({
                name: b.name,
                count: (b as any).ownedCount || 0,
                cost: this.getBuildingCost(b),
                production: (b as any).gatherRate || 0
            })),
            upgrades: this.game.entities.getUpgrades().map(u => ({
                name: u.name,
                isUnlocked: u.isUnlocked,
                isPurchased: (u as any).isPurchased || false,
                cost: u.costs?.[0]?.amount || 0
            }))
        };
    }

    private calculateCPS(): number {
        return this.game.production.getGlobalProductionStats()
            .resourceProductionRates['cookies'] || 0;
    }

    private updateClickPower() {
        // Emit event for UI updates
        this.game.events.emit('clickPowerChanged', { 
            clickPower: this.clickPower 
        });
    }

    private showClickEffect(amount: number) {
        this.game.events.emit('cookieClicked', { 
            amount,
            timestamp: Date.now() 
        });
    }

    private checkAchievements() {
        // Simple achievement system
        const achievements = [
            { name: 'First Cookie', threshold: 1 },
            { name: 'Cookie Novice', threshold: 100 },
            { name: 'Cookie Expert', threshold: 1000 },
            { name: 'Cookie Master', threshold: 10000 },
            { name: 'Cookie Legend', threshold: 100000 }
        ];

        achievements.forEach(achievement => {
            if (this.totalCookiesEver >= achievement.threshold) {
                this.game.events.emit('achievementUnlocked', achievement);
            }
        });
    }

    public saveGame() {
        this.game.saveState();
        // Save custom data
        localStorage.setItem('cookieGame_customData', JSON.stringify({
            clickPower: this.clickPower,
            totalCookiesEver: this.totalCookiesEver
        }));
    }

    public loadGame() {
        this.game.loadState();
        // Load custom data
        const customData = localStorage.getItem('cookieGame_customData');
        if (customData) {
            const data = JSON.parse(customData);
            this.clickPower = data.clickPower || 1;
            this.totalCookiesEver = data.totalCookiesEver || 0;
        }
    }

    public resetGame() {
        localStorage.clear();
        location.reload();
    }

    // Prestige system
    public calculatePrestigeGain(): number {
        return Math.floor(Math.sqrt(this.totalCookiesEver / 1000000));
    }

    public canPrestige(): boolean {
        return this.calculatePrestigeGain() > 0;
    }

    public prestige() {
        const prestigeGain = this.calculatePrestigeGain();
        if (prestigeGain > 0) {
            const prestigePoints = this.game.entities.getResourceById('prestige-points');
            prestigePoints?.increment(prestigeGain);
            
            // Reset most progress but keep prestige points
            this.cookies.setAmount(0);
            this.clickPower = 1;
            this.totalCookiesEver = 0;
            
            // Remove all buildings
            this.game.entities.getBuildings().forEach(building => {
                if (building.tags?.includes('autoclicker')) {
                    (building as any).ownedCount = 0;
                }
            });
            
            this.game.events.emit('prestiged', { 
                prestigeGain,
                totalPrestigePoints: prestigePoints?.amount 
            });
        }
    }

    // Getters for UI
    public get gameInstance() { return this.game; }
    public get cookieResource() { return this.cookies; }
}
```

## 🎨 User Interface

### 1. HTML Structure

**public/index.html:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cookie Empire</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <header>
            <h1>🍪 Cookie Empire</h1>
            <div class="stats">
                <div class="stat">
                    <span class="label">Cookies:</span>
                    <span id="cookie-count">0</span>
                </div>
                <div class="stat">
                    <span class="label">Per Second:</span>
                    <span id="cookies-per-second">0</span>
                </div>
                <div class="stat">
                    <span class="label">Click Power:</span>
                    <span id="click-power">1</span>
                </div>
            </div>
        </header>

        <main>
            <div class="game-area">
                <!-- Cookie Clicker -->
                <div class="cookie-section">
                    <div id="cookie-button" class="cookie">
                        🍪
                    </div>
                    <div id="click-effects"></div>
                </div>

                <!-- Buildings -->
                <div class="buildings-section">
                    <h2>Buildings</h2>
                    <div id="buildings-list"></div>
                </div>

                <!-- Upgrades -->
                <div class="upgrades-section">
                    <h2>Upgrades</h2>
                    <div id="upgrades-list"></div>
                </div>
            </div>

            <!-- Side Panel -->
            <aside class="side-panel">
                <div class="achievements">
                    <h3>Achievements</h3>
                    <div id="achievements-list"></div>
                </div>

                <div class="prestige">
                    <h3>Prestige</h3>
                    <p>Total Cookies: <span id="total-cookies-ever">0</span></p>
                    <p>Prestige Points: <span id="prestige-points">0</span></p>
                    <button id="prestige-button" disabled>
                        Prestige (+<span id="prestige-gain">0</span> points)
                    </button>
                </div>

                <div class="controls">
                    <button id="save-button">Save Game</button>
                    <button id="reset-button">Reset Game</button>
                </div>
            </aside>
        </main>
    </div>

    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 2. CSS Styling

**public/style.css:**
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #333;
    min-height: 100vh;
}

#app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

header {
    text-align: center;
    margin-bottom: 30px;
    background: rgba(255, 255, 255, 0.9);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

header h1 {
    font-size: 2.5em;
    margin-bottom: 15px;
    color: #8b4513;
}

.stats {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
}

.stat {
    font-size: 1.2em;
    font-weight: bold;
}

.stat .label {
    color: #666;
}

main {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
}

.game-area {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.cookie-section {
    grid-column: 1 / -1;
    text-align: center;
    background: rgba(255, 255, 255, 0.9);
    padding: 30px;
    border-radius: 15px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.cookie {
    font-size: 8em;
    cursor: pointer;
    transition: transform 0.1s ease;
    user-select: none;
    display: inline-block;
}

.cookie:hover {
    transform: scale(1.05);
}

.cookie:active {
    transform: scale(0.95);
}

#click-effects {
    position: relative;
    height: 50px;
}

.click-effect {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 1.5em;
    font-weight: bold;
    color: #ff6b35;
    pointer-events: none;
    animation: floatUp 1s ease-out forwards;
}

@keyframes floatUp {
    0% {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
    100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-50px);
    }
}

.buildings-section, .upgrades-section {
    background: rgba(255, 255, 255, 0.9);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.buildings-section h2, .upgrades-section h2 {
    margin-bottom: 15px;
    color: #8b4513;
    border-bottom: 2px solid #ddd;
    padding-bottom: 5px;
}

.building-item, .upgrade-item {
    background: #f8f9fa;
    border: 2px solid #ddd;
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.building-item:hover, .upgrade-item:hover {
    background: #e9ecef;
    border-color: #8b4513;
    transform: translateY(-2px);
}

.building-item.disabled, .upgrade-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.building-item.disabled:hover, .upgrade-item.disabled:hover {
    transform: none;
    background: #f8f9fa;
    border-color: #ddd;
}

.item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.item-name {
    font-weight: bold;
    font-size: 1.1em;
}

.item-cost {
    color: #8b4513;
    font-weight: bold;
}

.item-description {
    color: #666;
    font-size: 0.9em;
    margin-bottom: 5px;
}

.item-stats {
    font-size: 0.9em;
    color: #555;
}

.side-panel {
    background: rgba(255, 255, 255, 0.9);
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    height: fit-content;
}

.side-panel h3 {
    color: #8b4513;
    margin-bottom: 10px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 5px;
}

.achievements, .prestige, .controls {
    margin-bottom: 25px;
}

.achievement-item {
    background: #f8f9fa;
    padding: 8px;
    margin-bottom: 5px;
    border-radius: 5px;
    font-size: 0.9em;
}

.achievement-item.unlocked {
    background: #d4edda;
    color: #155724;
}

button {
    background: #8b4513;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1em;
    transition: background-color 0.3s ease;
    width: 100%;
    margin-bottom: 10px;
}

button:hover:not(:disabled) {
    background: #a0522d;
}

button:disabled {
    background: #ccc;
    cursor: not-allowed;
}

#prestige-button {
    background: #6f42c1;
}

#prestige-button:hover:not(:disabled) {
    background: #5a32a8;
}

@media (max-width: 768px) {
    main {
        grid-template-columns: 1fr;
    }
    
    .game-area {
        grid-template-columns: 1fr;
    }
    
    .stats {
        gap: 15px;
    }
    
    .cookie {
        font-size: 6em;
    }
}
```

### 3. Main Application Logic

**src/main.ts:**
```typescript
import { CookieGame } from './game';

class CookieGameUI {
    private game: CookieGame;
    private updateInterval: number;

    constructor() {
        this.game = new CookieGame();
        this.setupEventListeners();
        this.startUpdateLoop();
        this.render();
    }

    private setupEventListeners() {
        // Cookie clicking
        const cookieButton = document.getElementById('cookie-button')!;
        cookieButton.addEventListener('click', (e) => {
            const gained = this.game.clickCookie();
            this.showClickEffect(e, gained);
        });

        // Game events
        this.game.gameInstance.events.on('cookieClicked', (data) => {
            this.updateDisplay();
        });

        this.game.gameInstance.events.on('clickPowerChanged', () => {
            this.updateDisplay();
        });

        this.game.gameInstance.events.on('achievementUnlocked', (achievement) => {
            this.showAchievement(achievement);
        });

        this.game.gameInstance.events.on('prestiged', (data) => {
            this.showPrestigeNotification(data);
            this.render(); // Full re-render after prestige
        });

        // Controls
        document.getElementById('save-button')!.addEventListener('click', () => {
            this.game.saveGame();
            this.showNotification('Game saved!');
        });

        document.getElementById('reset-button')!.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset your game? This cannot be undone!')) {
                this.game.resetGame();
            }
        });

        document.getElementById('prestige-button')!.addEventListener('click', () => {
            if (confirm('Are you sure you want to prestige? You will lose most progress but gain prestige points!')) {
                this.game.prestige();
            }
        });
    }

    private startUpdateLoop() {
        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 100) as unknown as number;
    }

    private updateDisplay() {
        const stats = this.game.getStats();

        // Update main stats
        document.getElementById('cookie-count')!.textContent = 
            this.formatNumber(stats.cookies);
        document.getElementById('cookies-per-second')!.textContent = 
            this.formatNumber(stats.cookiesPerSecond);
        document.getElementById('click-power')!.textContent = 
            this.formatNumber(stats.clickPower);

        // Update prestige info
        document.getElementById('total-cookies-ever')!.textContent = 
            this.formatNumber(this.game.totalCookiesEver);
        
        const prestigeGain = this.game.calculatePrestigeGain();
        document.getElementById('prestige-gain')!.textContent = 
            prestigeGain.toString();
        
        const prestigeButton = document.getElementById('prestige-button')! as HTMLButtonElement;
        prestigeButton.disabled = !this.game.canPrestige();

        // Update building affordability
        this.updateBuildingStates(stats);
        this.updateUpgradeStates(stats);
    }

    private render() {
        this.renderBuildings();
        this.renderUpgrades();
        this.renderAchievements();
        this.updateDisplay();
    }

    private renderBuildings() {
        const stats = this.game.getStats();
        const buildingsList = document.getElementById('buildings-list')!;
        buildingsList.innerHTML = '';

        stats.buildings.forEach(building => {
            const buildingElement = document.createElement('div');
            buildingElement.className = 'building-item';
            buildingElement.innerHTML = `
                <div class="item-header">
                    <span class="item-name">${building.name}</span>
                    <span class="item-cost">${this.formatNumber(building.cost)} cookies</span>
                </div>
                <div class="item-description">Produces ${this.formatNumber(building.production)} cookies/sec</div>
                <div class="item-stats">Owned: ${building.count}</div>
            `;

            buildingElement.addEventListener('click', () => {
                if (this.game.buyBuilding(building.name)) {
                    this.render();
                }
            });

            buildingsList.appendChild(buildingElement);
        });
    }

    private renderUpgrades() {
        const stats = this.game.getStats();
        const upgradesList = document.getElementById('upgrades-list')!;
        upgradesList.innerHTML = '';

        stats.upgrades
            .filter(upgrade => upgrade.isUnlocked && !upgrade.isPurchased)
            .forEach(upgrade => {
                const upgradeElement = document.createElement('div');
                upgradeElement.className = 'upgrade-item';
                upgradeElement.innerHTML = `
                    <div class="item-header">
                        <span class="item-name">${upgrade.name}</span>
                        <span class="item-cost">${this.formatNumber(upgrade.cost)} cookies</span>
                    </div>
                `;

                upgradeElement.addEventListener('click', () => {
                    if (this.game.buyUpgrade(upgrade.name)) {
                        this.render();
                    }
                });

                upgradesList.appendChild(upgradeElement);
            });
    }

    private renderAchievements() {
        const achievementsList = document.getElementById('achievements-list')!;
        // This would be populated based on your achievement system
        // For now, showing placeholder achievements
    }

    private updateBuildingStates(stats: any) {
        const buildingItems = document.querySelectorAll('.building-item');
        buildingItems.forEach((item, index) => {
            const building = stats.buildings[index];
            const canAfford = stats.cookies >= building.cost;
            
            if (canAfford) {
                item.classList.remove('disabled');
            } else {
                item.classList.add('disabled');
            }
        });
    }

    private updateUpgradeStates(stats: any) {
        const upgradeItems = document.querySelectorAll('.upgrade-item');
        upgradeItems.forEach((item, index) => {
            const upgrades = stats.upgrades.filter(u => u.isUnlocked && !u.isPurchased);
            if (upgrades[index]) {
                const upgrade = upgrades[index];
                const canAfford = stats.cookies >= upgrade.cost;
                
                if (canAfford) {
                    item.classList.remove('disabled');
                } else {
                    item.classList.add('disabled');
                }
            }
        });
    }

    private showClickEffect(event: MouseEvent, amount: number) {
        const effectElement = document.createElement('div');
        effectElement.className = 'click-effect';
        effectElement.textContent = `+${this.formatNumber(amount)}`;
        
        const effectsContainer = document.getElementById('click-effects')!;
        effectsContainer.appendChild(effectElement);
        
        setTimeout(() => {
            effectElement.remove();
        }, 1000);
    }

    private showAchievement(achievement: any) {
        this.showNotification(`🏆 Achievement Unlocked: ${achievement.name}!`);
    }

    private showPrestigeNotification(data: any) {
        this.showNotification(`✨ Prestiged! Gained ${data.prestigeGain} prestige points!`);
    }

    private showNotification(message: string) {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    private formatNumber(num: number): string {
        if (num < 1000) return Math.floor(num).toString();
        if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M';
        return (num / 1000000000).toFixed(1) + 'B';
    }

    public destroy() {
        clearInterval(this.updateInterval);
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CookieGameUI();
});
```

## 🚀 Running the Game

1. **Start development server:**
```bash
npm run dev
```

2. **Open in browser:**
Navigate to `http://localhost:5173`

3. **Play the game:**
- Click the cookie to earn cookies
- Buy buildings to automate cookie production
- Purchase upgrades to increase efficiency
- Work towards prestige for permanent bonuses

## 🎯 Features Explained

### Manual Clicking System
The cookie clicking provides immediate feedback with visual effects and scales with purchased upgrades.

### Exponential Building Costs
Building costs increase exponentially to maintain game balance as production scales up.

### Unlock Progression
New content unlocks based on progress milestones, keeping players engaged with new goals.

### Prestige Mechanics
Players can reset progress for permanent bonuses, providing long-term progression.

### Save/Load System
Game state persists between sessions using the Incrementa save system plus custom data storage.

## 🔧 Customization Ideas

### Additional Buildings
```typescript
// Add new building types
const spaceStation = this.game.entities.createMiner({
    name: 'Space Cookie Station',
    resourceId: 'cookies',
    gatherRate: 10000,
    buildTime: 0,
    costs: [{ resourceId: 'cookies', amount: 50000000 }],
    unlockCondition: () => this.totalCookiesEver >= 100000000
});
```

### New Resources
```typescript
// Add secondary resources
const milk = this.game.entities.createResource({
    name: 'Milk',
    initialAmount: 0,
    rate: 0,
    description: 'Essential for cookie dunking'
});
```

### Complex Upgrades
```typescript
// Conditional upgrades
const grandmaUpgrade = this.game.entities.createUpgrade({
    name: 'Bingo Center',
    description: 'Grandmas are twice as efficient',
    costs: [{ resourceId: 'cookies', amount: 1000000 }],
    effect: {
        type: 'property_modifier',
        target: { entityName: 'Grandma' },
        property: 'gatherRate',
        operation: 'multiply',
        value: 2
    },
    unlockCondition: () => this.getBuildingCount('Grandma') >= 10
});
```

## 📚 Next Steps

1. **Add more building types** with unique mechanics
2. **Implement achievement system** with rewards
3. **Create prestige upgrades** that persist between resets
4. **Add golden cookies** for temporary bonuses
5. **Implement seasonal events** with special content
6. **Add sound effects** and better animations
7. **Create mobile-responsive design**
8. **Add multiplayer features** or leaderboards

---

*Next: [Resource Management Example](./resource-management.md) - Complex resource systems and chains*