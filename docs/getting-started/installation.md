# Installation Guide

This guide covers different ways to install and set up Incrementa for your incremental game project.

## 📦 Package Manager Installation

### NPM
```bash
npm install incrementa
```

### Yarn
```bash
yarn add incrementa
```

### PNPM
```bash
pnpm add incrementa
```

## 🚀 Project Setup Options

### 1. Create New Project with Vite (Recommended)

**For TypeScript projects:**
```bash
# Create new Vite project
npm create vite@latest my-game -- --template vanilla-ts
cd my-game

# Install Incrementa
npm install incrementa

# Start development
npm run dev
```

**For JavaScript projects:**
```bash
# Create new Vite project
npm create vite@latest my-game -- --template vanilla
cd my-game

# Install Incrementa
npm install incrementa

# Start development
npm run dev
```

### 2. Add to Existing Project

If you have an existing project, simply install Incrementa:

```bash
cd your-existing-project
npm install incrementa
```

### 3. Framework Integration

#### React
```bash
npx create-react-app my-game --template typescript
cd my-game
npm install incrementa
```

#### Vue
```bash
npm create vue@latest my-game
cd my-game
npm install
npm install incrementa
```

#### Angular
```bash
ng new my-game
cd my-game
npm install incrementa
```

## 🔧 Configuration

### TypeScript Configuration

If using TypeScript, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### Vite Configuration

For Vite projects, ensure `vite.config.js` is configured properly:

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020'
  },
  esbuild: {
    target: 'es2020'
  },
  // For React projects
  // plugins: [react()],
  
  // For Vue projects  
  // plugins: [vue()],
});
```

## 📁 Project Structure

### Recommended Structure

```
my-game/
├── src/
│   ├── game/              # Game logic
│   │   ├── entities/      # Custom entities
│   │   ├── plugins/       # Game plugins
│   │   └── config.ts      # Game configuration
│   ├── ui/                # User interface
│   │   ├── components/    # UI components
│   │   └── styles/        # Stylesheets
│   ├── assets/            # Images, sounds, etc.
│   ├── main.ts           # Entry point
│   └── game.ts           # Main game class
├── public/               # Static assets
├── dist/                 # Built output
├── package.json
├── vite.config.js
└── tsconfig.json
```

### Basic Files Setup

**src/main.ts:**
```typescript
import { GameManager } from './game';
import './ui/styles/main.css';

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new GameManager();
});
```

**src/game.ts:**
```typescript
import { Game, SaveManager } from 'incrementa';

export class GameManager {
    private game: Game;

    constructor() {
        // Set up save system
        const saveManager = new SaveManager(localStorage);
        
        // Create game instance
        this.game = new Game(saveManager);
        
        // Initialize game content
        this.initializeGame();
        
        // Start the game
        this.game.start();
    }

    private initializeGame() {
        // Create your game content here
        // See Quick Start guide for examples
    }
}
```

## 🌐 CDN Usage (Browser)

For quick prototyping or simple setups, you can use Incrementa via CDN:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Incremental Game</title>
</head>
<body>
    <div id="game"></div>
    
    <!-- Include Incrementa from CDN -->
    <script type="module">
        // Note: Replace with actual CDN URL when available
        import { Game, SaveManager } from 'https://unpkg.com/incrementa@latest/dist/index.js';
        
        const saveManager = new SaveManager(localStorage);
        const game = new Game(saveManager);
        
        // Your game logic here
        
        game.start();
    </script>
</body>
</html>
```

## 🔍 Verification

### Test Installation

Create a simple test file to verify Incrementa is working:

**test-incrementa.ts:**
```typescript
import { Game, SaveManager } from 'incrementa';

// Test basic functionality
const saveManager = new SaveManager(localStorage);
const game = new Game(saveManager);

// Create a test resource
const testResource = game.entities.createResource({
    name: 'Test Resource',
    initialAmount: 100
});

console.log('Incrementa installed successfully!');
console.log('Test resource created:', testResource.name);
console.log('Initial amount:', testResource.amount);

// Test basic operations
testResource.increment(50);
console.log('After increment:', testResource.amount);

game.start();
console.log('Game started:', game.isGameRunning());
```

### Build Test

Test that your project builds correctly:

```bash
# For Vite projects
npm run build

# For Create React App
npm run build

# For Vue CLI
npm run build

# For Angular
ng build
```

## 🐛 Troubleshooting

### Common Issues

#### Module Not Found
```
Error: Cannot resolve module 'incrementa'
```

**Solution:**
```bash
# Reinstall
npm uninstall incrementa
npm install incrementa

# Clear cache
npm cache clean --force
```

#### TypeScript Errors
```
TS2307: Cannot find module 'incrementa'
```

**Solution:**
```bash
# Install types (if separate package exists)
npm install --save-dev @types/incrementa

# Or add to tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

#### Build Errors with Vite
```
Error: Top-level await is not available
```

**Solution:** Update `vite.config.js`:
```javascript
export default defineConfig({
  build: {
    target: 'es2022'
  },
  esbuild: {
    target: 'es2022'
  }
});
```

#### Browser Compatibility Issues

**Solution:** Add polyfills if targeting older browsers:
```bash
npm install --save-dev @vitejs/plugin-legacy
```

```javascript
// vite.config.js
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ]
});
```

### Environment Requirements

#### Minimum Versions
- **Node.js**: 16.0.0 or higher
- **TypeScript**: 4.5.0 or higher (if using TypeScript)
- **Modern browsers**: Chrome 91+, Firefox 90+, Safari 15+

#### Check Versions
```bash
node --version     # Should be 16.0.0+
npm --version      # Should be 8.0.0+
tsc --version      # Should be 4.5.0+ (if using TypeScript)
```

### Performance Considerations

#### Bundle Size
Incrementa is designed to be lightweight, but you can optimize further:

```javascript
// vite.config.js - Tree shaking optimization
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['incrementa'],
      output: {
        manualChunks: {
          incrementa: ['incrementa']
        }
      }
    }
  }
});
```

#### Development vs Production
```javascript
// Use different configurations for development
if (process.env.NODE_ENV === 'development') {
  // Enable debug features
  game.setPerformanceMonitoring(true);
} else {
  // Optimize for production
  game.setPerformanceMonitoring(false);
}
```

## 📚 Next Steps

After successful installation:

1. **[Quick Start Guide](./quick-start.md)** - Build your first game in 5 minutes
2. **[Your First Game](./first-game.md)** - Detailed step-by-step tutorial
3. **[Architecture Overview](../architecture/overview.md)** - Understand the framework
4. **[API Reference](../api/)** - Explore all available features

## 💬 Getting Help

If you encounter issues during installation:

1. **Check Documentation**: Review this guide and the troubleshooting section
2. **GitHub Issues**: [Report bugs or ask questions](https://github.com/your-org/incrementa/issues)
3. **Community Discord**: Join our community for real-time help
4. **Stack Overflow**: Use the `incrementa` tag for technical questions

---

*Next: [Your First Game](./first-game.md) - Step-by-step tutorial for beginners*