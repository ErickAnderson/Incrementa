import { BaseEntity } from "../core/base-entity";
import { Game } from "../core/game";
import { logger } from "./logger";

/**
 * UI update callback function type
 */
export type UIUpdateCallback = (entity: BaseEntity, data?: Record<string, unknown>) => void;

/**
 * UI integration configuration
 */
export interface UIIntegrationConfig {
    /** Whether to enable automatic UI updates */
    autoUpdate: boolean;
    /** Debounce delay for UI updates in milliseconds */
    debounceDelay: number;
    /** Whether to batch multiple updates */
    batchUpdates: boolean;
}

/**
 * Event to UI mapping configuration
 */
export interface EventUIMapping {
    /** Event name to listen for */
    eventName: string;
    /** CSS selector for the element to update */
    selector: string;
    /** Function to generate the new content */
    updateFunction: (data: Record<string, unknown>) => string | number;
    /** Whether to use innerHTML (true) or textContent (false) */
    useInnerHTML?: boolean;
}

/**
 * Utility class for integrating framework events with UI updates
 * Provides standardized patterns for reactive UI programming
 */
export class UIIntegration {
    private game: Game;
    private config: UIIntegrationConfig;
    private updateQueue: Map<string, { callback: UIUpdateCallback; data: Record<string, unknown> }> = new Map();
    private debounceTimers: Map<string, number> = new Map();

    /**
     * Creates a new UIIntegration instance
     * @param game - The game instance to integrate with
     * @param config - Configuration for UI integration
     */
    constructor(game: Game, config: Partial<UIIntegrationConfig> = {}) {
        this.game = game;
        this.config = {
            autoUpdate: true,
            debounceDelay: 16, // ~60fps
            batchUpdates: true,
            ...config
        };

        if (this.config.autoUpdate) {
            this.setupAutoUpdates();
        }
    }

    /**
     * Binds entity events to UI updates
     * @param entity - The entity to bind
     * @param eventName - The event name to listen for
     * @param callback - The UI update callback
     */
    bindEntityToUI(entity: BaseEntity, eventName: string, callback: UIUpdateCallback): void {
        entity.on(eventName, (data) => {
            if (this.config.batchUpdates) {
                this.queueUpdate(`${entity.id}-${eventName}`, callback, data);
            } else {
                callback(entity, data);
            }
        });

        logger.debug(`UIIntegration: Bound ${entity.name} event '${eventName}' to UI callback`);
    }

    /**
     * Creates a reactive display element that automatically updates
     * @param entity - The entity to track
     * @param propertyPath - The property to display (e.g., 'amount', 'isUnlocked')
     * @param element - The DOM element to update
     * @param formatter - Optional formatter function
     */
    createReactiveDisplay(
        entity: BaseEntity, 
        propertyPath: string, 
        element: HTMLElement, 
        formatter?: (value: unknown) => string
    ): void {
        const updateDisplay = () => {
            const value = this.getNestedProperty(entity, propertyPath);
            const displayValue = formatter ? formatter(value) : String(value);
            
            if (element.textContent !== displayValue) {
                element.textContent = displayValue;
            }
        };

        // Initial update
        updateDisplay();

        // Listen for property changes (this is a simplified approach)
        // In a real implementation, you might want to use more specific events
        entity.on('updated', updateDisplay);
        entity.on('amountChanged', updateDisplay);
        entity.on('unlocked', updateDisplay);

        logger.debug(`UIIntegration: Created reactive display for ${entity.name}.${propertyPath}`);
    }

    /**
     * Sets up automatic UI mappings based on configuration
     * @param mappings - Array of event to UI mappings
     */
    setupEventMappings(mappings: EventUIMapping[]): void {
        for (const mapping of mappings) {
            this.game.getEventManager().on(mapping.eventName, (data) => {
                const elements = document.querySelectorAll(mapping.selector);
                const content = mapping.updateFunction(data);
                
                elements.forEach(element => {
                    if (mapping.useInnerHTML) {
                        (element as HTMLElement).innerHTML = String(content);
                    } else {
                        element.textContent = String(content);
                    }
                });
            });
        }

        logger.info(`UIIntegration: Set up ${mappings.length} event mappings`);
    }

    /**
     * Creates a progress bar that tracks entity progress
     * @param entity - The entity to track
     * @param progressProperty - Property that represents current progress
     * @param maxProperty - Property that represents maximum progress
     * @param element - The progress bar element
     */
    createProgressBar(
        entity: BaseEntity, 
        progressProperty: string, 
        maxProperty: string, 
        element: HTMLProgressElement
    ): void {
        const updateProgress = () => {
            const current = this.getNestedProperty(entity, progressProperty) || 0;
            const max = this.getNestedProperty(entity, maxProperty) || 1;
            
            element.value = current;
            element.max = max;
            
            // Update percentage attribute for CSS styling
            const percentage = max > 0 ? (current / max) * 100 : 0;
            element.setAttribute('data-percentage', percentage.toFixed(1));
        };

        // Initial update
        updateProgress();

        // Listen for changes
        entity.on('updated', updateProgress);
        entity.on('amountChanged', updateProgress);

        logger.debug(`UIIntegration: Created progress bar for ${entity.name}`);
    }

    /**
     * Creates a notification system for entity events
     * @param containerElement - Container for notifications
     * @param options - Notification options
     */
    createNotificationSystem(
        containerElement: HTMLElement,
        options: {
            duration?: number;
            maxNotifications?: number;
            template?: (message: string, type: string) => HTMLElement;
        } = {}
    ): void {
        const config = {
            duration: 3000,
            maxNotifications: 5,
            ...options
        };

        const showNotification = (message: string, type: string = 'info') => {
            const notification = config.template 
                ? config.template(message, type)
                : this.createDefaultNotification(message, type);

            containerElement.appendChild(notification);

            // Remove old notifications if we exceed the limit
            while (containerElement.children.length > config.maxNotifications) {
                containerElement.removeChild(containerElement.firstChild!);
            }

            // Auto-remove after duration
            setTimeout(() => {
                if (notification.parentNode) {
                    containerElement.removeChild(notification);
                }
            }, config.duration);
        };

        // Listen for common entity events
        this.game.getEventManager().on('entityUnlocked', (data) => {
            showNotification(`${data.entity.name} unlocked!`, 'success');
        });

        this.game.getEventManager().on('buildingCompleted', (data) => {
            showNotification(`${data.building.name} construction completed!`, 'success');
        });

        this.game.getEventManager().on('resourceCapacityExceeded', (data) => {
            showNotification(`${data.resourceId} storage full!`, 'warning');
        });

        logger.info('UIIntegration: Notification system created');
    }

    /**
     * Utility method for common UI patterns
     */
    static createEntityCard(entity: BaseEntity, options: {
        showProgress?: boolean;
        showActions?: boolean;
        customTemplate?: string;
    } = {}): HTMLElement {
        const card = document.createElement('div');
        card.className = 'entity-card';
        card.setAttribute('data-entity-id', entity.id);

        const title = document.createElement('h3');
        title.textContent = entity.name;
        card.appendChild(title);

        if (entity.description) {
            const description = document.createElement('p');
            description.textContent = entity.description;
            card.appendChild(description);
        }

        if (options.showActions) {
            const actions = document.createElement('div');
            actions.className = 'entity-actions';
            card.appendChild(actions);
        }

        return card;
    }

    /**
     * Private methods
     */

    private setupAutoUpdates(): void {
        // Set up automatic batched updates
        if (this.config.batchUpdates) {
            setInterval(() => {
                this.processBatchedUpdates();
            }, this.config.debounceDelay);
        }
    }

    private queueUpdate(key: string, callback: UIUpdateCallback, data: Record<string, unknown>): void {
        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Queue the update
        this.updateQueue.set(key, { callback, data });

        // Set new debounce timer
        const timer = setTimeout(() => {
            this.processBatchedUpdates();
            this.debounceTimers.delete(key);
        }, this.config.debounceDelay) as unknown as number;

        this.debounceTimers.set(key, timer);
    }

    private processBatchedUpdates(): void {
        for (const [key, { callback, data }] of this.updateQueue) {
            try {
                callback(data.entity || data, data);
            } catch (error) {
                logger.error(`UIIntegration: Error processing UI update for ${key}: ${error}`);
            }
        }
        this.updateQueue.clear();
    }

    private getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    private createDefaultNotification(message: string, type: string): HTMLElement {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'notification-close';
        closeBtn.onclick = () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        };
        notification.appendChild(closeBtn);

        return notification;
    }
}