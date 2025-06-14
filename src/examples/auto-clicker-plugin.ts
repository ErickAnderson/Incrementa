import { Plugin, PluginConfig } from "../core/plugin-system";
import { Game } from "../core/game";
import { EventManager } from "../core/event-manager";
import { Resource } from "../entities/resources/resource";
import { logger } from "../utils/logger";

/**
 * Auto-clicker plugin configuration
 */
interface AutoClickerConfig {
    /** How often to auto-click in milliseconds */
    interval: number;
    /** Amount to add per auto-click */
    amount: number;
    /** Which resource to auto-click */
    targetResourceId: string;
    /** Whether the auto-clicker is enabled */
    enabled: boolean;
}

/**
 * Example plugin that automatically generates resources
 * Demonstrates the plugin system with save/load functionality
 */
export class AutoClickerPlugin implements Plugin {
    readonly config: PluginConfig = {
        id: "auto-clicker",
        name: "Auto Clicker",
        version: "1.0.0",
        author: "Incrementa Framework",
        description: "Automatically generates resources over time"
    };

    private game: Game | null = null;
    private eventManager: EventManager | null = null;
    private autoClickerConfig: AutoClickerConfig;
    private timerId: number | null = null;

    constructor(config: Partial<AutoClickerConfig> = {}) {
        // Default configuration
        this.autoClickerConfig = {
            interval: 1000, // 1 second
            amount: 1,
            targetResourceId: 'ore',
            enabled: true,
            ...config
        };
    }

    onLoad(game: Game, eventManager: EventManager): void {
        this.game = game;
        this.eventManager = eventManager;

        // Listen for game events
        eventManager.on('gameStarted', this.onGameStarted.bind(this));
        eventManager.on('gameStopped', this.onGameStopped.bind(this));

        logger.info(`AutoClickerPlugin: Loaded - will auto-click ${this.autoClickerConfig.targetResourceId} every ${this.autoClickerConfig.interval}ms`);
    }

    onActivate(): void {
        if (this.autoClickerConfig.enabled) {
            this.startAutoClicker();
        }
        logger.info("AutoClickerPlugin: Activated");
    }

    onDeactivate(): void {
        this.stopAutoClicker();
        logger.info("AutoClickerPlugin: Deactivated");
    }

    onUnload(): void {
        this.stopAutoClicker();
        this.game = null;
        this.eventManager = null;
        logger.info("AutoClickerPlugin: Unloaded");
    }

    onUpdate(_deltaTime: number): void {
        // Plugin can perform per-frame updates if needed
        // For this plugin, the timer handles the auto-clicking
    }

    getSaveData(): Record<string, unknown> {
        return {
            config: this.autoClickerConfig,
            totalClicks: this.getTotalClicks()
        };
    }

    loadSaveData(data: Record<string, unknown>): void {
        if (data.config) {
            this.autoClickerConfig = { ...this.autoClickerConfig, ...data.config };
        }
        // Could restore totalClicks if we were tracking it
        logger.info(`AutoClickerPlugin: Loaded save data - enabled: ${this.autoClickerConfig.enabled}`);
    }

    /**
     * Public API methods for the plugin
     */

    /**
     * Enables or disables the auto-clicker
     * @param enabled - Whether to enable the auto-clicker
     */
    setEnabled(enabled: boolean): void {
        this.autoClickerConfig.enabled = enabled;
        
        if (enabled) {
            this.startAutoClicker();
        } else {
            this.stopAutoClicker();
        }

        logger.info(`AutoClickerPlugin: ${enabled ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Changes the target resource for auto-clicking
     * @param resourceId - The ID of the resource to target
     */
    setTargetResource(resourceId: string): void {
        this.autoClickerConfig.targetResourceId = resourceId;
        logger.info(`AutoClickerPlugin: Target changed to ${resourceId}`);
    }

    /**
     * Changes the auto-click interval
     * @param interval - New interval in milliseconds
     */
    setInterval(interval: number): void {
        this.autoClickerConfig.interval = Math.max(100, interval); // Minimum 100ms
        
        // Restart auto-clicker with new interval if currently running
        if (this.timerId !== null) {
            this.stopAutoClicker();
            this.startAutoClicker();
        }

        logger.info(`AutoClickerPlugin: Interval changed to ${this.autoClickerConfig.interval}ms`);
    }

    /**
     * Changes the amount added per auto-click
     * @param amount - New amount per click
     */
    setAmount(amount: number): void {
        this.autoClickerConfig.amount = Math.max(0.1, amount); // Minimum 0.1
        logger.info(`AutoClickerPlugin: Amount changed to ${this.autoClickerConfig.amount}`);
    }

    /**
     * Gets the current configuration
     * @returns Current auto-clicker configuration
     */
    getConfig(): AutoClickerConfig {
        return { ...this.autoClickerConfig };
    }

    /**
     * Private methods
     */

    private onGameStarted(): void {
        if (this.autoClickerConfig.enabled) {
            this.startAutoClicker();
        }
    }

    private onGameStopped(): void {
        this.stopAutoClicker();
    }

    private startAutoClicker(): void {
        if (this.timerId !== null || !this.game) {
            return; // Already running or no game reference
        }

        this.timerId = ((globalThis as { setInterval: (callback: () => void, interval: number) => number }).setInterval(() => {
            this.performAutoClick();
        }, this.autoClickerConfig.interval) as unknown) as number;

        logger.debug("AutoClickerPlugin: Auto-clicker started");
    }

    private stopAutoClicker(): void {
        if (this.timerId !== null) {
            (globalThis as { clearInterval: (timerId: number) => void }).clearInterval(this.timerId);
            this.timerId = null;
            logger.debug("AutoClickerPlugin: Auto-clicker stopped");
        }
    }

    private performAutoClick(): void {
        if (!this.game) {
            return;
        }

        const resource = this.game.getResourceById(this.autoClickerConfig.targetResourceId);
        if (resource instanceof Resource) {
            const success = resource.increment(this.autoClickerConfig.amount);
            
            if (success) {
                // Emit custom plugin event
                if (this.eventManager) {
                    this.eventManager.emitSystemEvent('autoClickerClick', {
                        resourceId: this.autoClickerConfig.targetResourceId,
                        amount: this.autoClickerConfig.amount,
                        newTotal: resource.amount
                    });
                }
            }
        } else {
            logger.warn(`AutoClickerPlugin: Target resource '${this.autoClickerConfig.targetResourceId}' not found`);
            // Could auto-disable or switch to a different resource
        }
    }

    private getTotalClicks(): number {
        // Could implement click tracking if needed
        return 0;
    }
}