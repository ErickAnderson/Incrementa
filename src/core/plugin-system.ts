import { Game } from "./game";
import { EventManager } from "./event-manager";
import { logger } from "../utils/logger";

/**
 * Configuration for a plugin
 */
export interface PluginConfig {
    /** Unique identifier for the plugin */
    id: string;
    /** Display name of the plugin */
    name: string;
    /** Plugin version */
    version: string;
    /** Plugin author */
    author?: string;
    /** Plugin description */
    description?: string;
    /** Dependencies on other plugins */
    dependencies?: string[];
    /** Minimum framework version required */
    minFrameworkVersion?: string;
}

/**
 * Plugin metadata and state information
 */
export interface PluginInfo extends PluginConfig {
    /** Whether the plugin is currently active */
    isActive: boolean;
    /** Whether the plugin is properly loaded */
    isLoaded: boolean;
    /** Load order index */
    loadOrder: number;
    /** Any error messages from loading */
    error?: string;
}

/**
 * Base interface for all plugins
 */
export interface Plugin {
    /** Plugin configuration */
    readonly config: PluginConfig;

    /**
     * Called when the plugin is loaded
     * @param game - The game instance
     * @param eventManager - The event manager for registering listeners
     */
    onLoad(game: Game, eventManager: EventManager): void;

    /**
     * Called when the plugin is activated
     */
    onActivate(): void;

    /**
     * Called when the plugin is deactivated
     */
    onDeactivate(): void;

    /**
     * Called when the plugin is unloaded
     */
    onUnload(): void;

    /**
     * Optional method called during game updates
     * @param deltaTime - Time elapsed since last update
     */
    onUpdate?(deltaTime: number): void;

    /**
     * Optional method for plugin-specific save data
     * @returns Object with plugin's saveable state
     */
    getSaveData?(): Record<string, unknown>;

    /**
     * Optional method for loading plugin-specific save data
     * @param data - Saved plugin data
     */
    loadSaveData?(data: Record<string, unknown>): void;
}

/**
 * Event data for plugin system events
 */
export interface PluginEvent {
    pluginId: string;
    eventType: 'loaded' | 'activated' | 'deactivated' | 'unloaded' | 'error';
    data?: Record<string, unknown>;
}

/**
 * Plugin system manager for the framework
 * Provides plugin loading, activation, and lifecycle management
 */
export class PluginSystem {
    private plugins: Map<string, Plugin> = new Map();
    private pluginInfo: Map<string, PluginInfo> = new Map();
    private game: Game;
    private eventManager: EventManager;
    private loadOrder: number = 0;

    /**
     * Creates a new PluginSystem instance
     * @param game - The game instance
     * @param eventManager - The event manager
     */
    constructor(game: Game, eventManager: EventManager) {
        this.game = game;
        this.eventManager = eventManager;
    }

    /**
     * Registers a plugin with the system
     * @param plugin - The plugin to register
     * @returns Whether registration was successful
     */
    registerPlugin(plugin: Plugin): boolean {
        const { id } = plugin.config;

        if (this.plugins.has(id)) {
            logger.error(`PluginSystem: Plugin ${id} is already registered`);
            return false;
        }

        // Validate plugin configuration
        if (!this.validatePlugin(plugin)) {
            return false;
        }

        // Check dependencies
        if (!this.checkDependencies(plugin.config)) {
            logger.error(`PluginSystem: Plugin ${id} has unmet dependencies`);
            return false;
        }

        try {
            // Store plugin
            this.plugins.set(id, plugin);
            this.pluginInfo.set(id, {
                ...plugin.config,
                isActive: false,
                isLoaded: false,
                loadOrder: this.loadOrder++
            });

            // Load the plugin
            plugin.onLoad(this.game, this.eventManager);
            
            // Update plugin info
            const info = this.pluginInfo.get(id)!;
            info.isLoaded = true;

            logger.info(`PluginSystem: Plugin ${id} (${plugin.config.name}) registered and loaded`);

            // Emit plugin loaded event
            this.eventManager.emitSystemEvent('pluginLoaded', {
                pluginId: id,
                eventType: 'loaded'
            } as PluginEvent);

            return true;
        } catch (error) {
            logger.error(`PluginSystem: Failed to load plugin ${id}: ${error}`);
            
            // Update plugin info with error
            const info = this.pluginInfo.get(id);
            if (info) {
                info.error = String(error);
            }

            // Remove failed plugin
            this.plugins.delete(id);
            return false;
        }
    }

    /**
     * Activates a plugin
     * @param pluginId - The ID of the plugin to activate
     * @returns Whether activation was successful
     */
    activatePlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        const info = this.pluginInfo.get(pluginId);

        if (!plugin || !info) {
            logger.error(`PluginSystem: Plugin ${pluginId} not found`);
            return false;
        }

        if (!info.isLoaded) {
            logger.error(`PluginSystem: Plugin ${pluginId} is not loaded`);
            return false;
        }

        if (info.isActive) {
            logger.warn(`PluginSystem: Plugin ${pluginId} is already active`);
            return true;
        }

        try {
            plugin.onActivate();
            info.isActive = true;

            logger.info(`PluginSystem: Plugin ${pluginId} activated`);

            // Emit plugin activated event
            this.eventManager.emitSystemEvent('pluginActivated', {
                pluginId,
                eventType: 'activated'
            } as PluginEvent);

            return true;
        } catch (error) {
            logger.error(`PluginSystem: Failed to activate plugin ${pluginId}: ${error}`);
            info.error = String(error);
            return false;
        }
    }

    /**
     * Deactivates a plugin
     * @param pluginId - The ID of the plugin to deactivate
     * @returns Whether deactivation was successful
     */
    deactivatePlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        const info = this.pluginInfo.get(pluginId);

        if (!plugin || !info) {
            logger.error(`PluginSystem: Plugin ${pluginId} not found`);
            return false;
        }

        if (!info.isActive) {
            logger.warn(`PluginSystem: Plugin ${pluginId} is not active`);
            return true;
        }

        try {
            plugin.onDeactivate();
            info.isActive = false;

            logger.info(`PluginSystem: Plugin ${pluginId} deactivated`);

            // Emit plugin deactivated event
            this.eventManager.emitSystemEvent('pluginDeactivated', {
                pluginId,
                eventType: 'deactivated'
            } as PluginEvent);

            return true;
        } catch (error) {
            logger.error(`PluginSystem: Failed to deactivate plugin ${pluginId}: ${error}`);
            info.error = String(error);
            return false;
        }
    }

    /**
     * Unloads and removes a plugin
     * @param pluginId - The ID of the plugin to unload
     * @returns Whether unloading was successful
     */
    unloadPlugin(pluginId: string): boolean {
        const plugin = this.plugins.get(pluginId);
        const info = this.pluginInfo.get(pluginId);

        if (!plugin || !info) {
            logger.error(`PluginSystem: Plugin ${pluginId} not found`);
            return false;
        }

        try {
            // Deactivate first if active
            if (info.isActive) {
                this.deactivatePlugin(pluginId);
            }

            // Unload the plugin
            plugin.onUnload();

            // Remove from system
            this.plugins.delete(pluginId);
            this.pluginInfo.delete(pluginId);

            logger.info(`PluginSystem: Plugin ${pluginId} unloaded`);

            // Emit plugin unloaded event
            this.eventManager.emitSystemEvent('pluginUnloaded', {
                pluginId,
                eventType: 'unloaded'
            } as PluginEvent);

            return true;
        } catch (error) {
            logger.error(`PluginSystem: Failed to unload plugin ${pluginId}: ${error}`);
            return false;
        }
    }

    /**
     * Gets information about all registered plugins
     * @returns Array of plugin information
     */
    getPluginInfo(): PluginInfo[] {
        return Array.from(this.pluginInfo.values());
    }

    /**
     * Gets information about a specific plugin
     * @param pluginId - The ID of the plugin
     * @returns Plugin information or undefined if not found
     */
    getPluginInfoById(pluginId: string): PluginInfo | undefined {
        return this.pluginInfo.get(pluginId);
    }

    /**
     * Gets all active plugins
     * @returns Array of active plugin IDs
     */
    getActivePlugins(): string[] {
        return Array.from(this.pluginInfo.entries())
            .filter(([_, info]) => info.isActive)
            .map(([id, _]) => id);
    }

    /**
     * Updates all active plugins
     * @param deltaTime - Time elapsed since last update
     */
    updatePlugins(deltaTime: number): void {
        for (const [pluginId, plugin] of this.plugins) {
            const info = this.pluginInfo.get(pluginId);
            if (info?.isActive && typeof plugin.onUpdate === 'function') {
                try {
                    plugin.onUpdate(deltaTime);
                } catch (error) {
                    logger.error(`PluginSystem: Error updating plugin ${pluginId}: ${error}`);
                    // Consider deactivating problematic plugins
                    this.deactivatePlugin(pluginId);
                }
            }
        }
    }

    /**
     * Gets save data for all active plugins
     * @returns Object with plugin save data
     */
    getPluginSaveData(): Record<string, Record<string, unknown>> {
        const saveData: Record<string, Record<string, unknown>> = {};
        
        for (const [pluginId, plugin] of this.plugins) {
            const info = this.pluginInfo.get(pluginId);
            if (info?.isActive && typeof plugin.getSaveData === 'function') {
                try {
                    const data = plugin.getSaveData();
                    if (data !== undefined) {
                        saveData[pluginId] = data;
                    }
                } catch (error) {
                    logger.error(`PluginSystem: Error getting save data from plugin ${pluginId}: ${error}`);
                }
            }
        }

        return saveData;
    }

    /**
     * Loads save data for all plugins
     * @param saveData - Object with plugin save data
     */
    loadPluginSaveData(saveData: Record<string, Record<string, unknown>>): void {
        for (const [pluginId, data] of Object.entries(saveData)) {
            const plugin = this.plugins.get(pluginId);
            if (plugin && typeof plugin.loadSaveData === 'function') {
                try {
                    plugin.loadSaveData(data);
                } catch (error) {
                    logger.error(`PluginSystem: Error loading save data for plugin ${pluginId}: ${error}`);
                }
            }
        }
    }

    /**
     * Validates a plugin configuration
     * @param plugin - The plugin to validate
     * @returns Whether the plugin is valid
     */
    private validatePlugin(plugin: Plugin): boolean {
        const { config } = plugin;

        if (!config.id || !config.name || !config.version) {
            logger.error('PluginSystem: Plugin missing required config fields (id, name, version)');
            return false;
        }

        if (typeof plugin.onLoad !== 'function' ||
            typeof plugin.onActivate !== 'function' ||
            typeof plugin.onDeactivate !== 'function' ||
            typeof plugin.onUnload !== 'function') {
            logger.error('PluginSystem: Plugin missing required lifecycle methods');
            return false;
        }

        return true;
    }

    /**
     * Checks if plugin dependencies are met
     * @param config - Plugin configuration
     * @returns Whether dependencies are satisfied
     */
    private checkDependencies(config: PluginConfig): boolean {
        if (!config.dependencies || config.dependencies.length === 0) {
            return true;
        }

        for (const dependency of config.dependencies) {
            if (!this.plugins.has(dependency)) {
                logger.error(`PluginSystem: Missing dependency ${dependency} for plugin ${config.id}`);
                return false;
            }

            const depInfo = this.pluginInfo.get(dependency);
            if (!depInfo?.isLoaded) {
                logger.error(`PluginSystem: Dependency ${dependency} is not loaded for plugin ${config.id}`);
                return false;
            }
        }

        return true;
    }
}