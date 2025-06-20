import { BaseEntity } from './base-entity';
import { logger } from '../utils/logger';

/** Configuration interface for Events class */
interface EventsConfig {
    name: string;
    description: string;
    callbackEvents?: Array<() => void>;
    unlockCondition: (() => boolean) | undefined;
}

/**
 * Class for handling events and callbacks, extending the base Entity class.
 * @extends {Entity}
 */
export class Events extends BaseEntity {
    /** Array to store callback functions */
    private callbackEvents: Array<() => void>;

    /**
     * Creates a new Events instance
     * @param {EventsConfig} config - Configuration object for the Events instance
     * @param {string} config.name - The name of the event
     * @param {string} config.description - Description of what the event does
     * @param {Array<() => void>} [config.callbackEvents=[]] - Optional array of initial callback functions
     * @param {any} config.unlockCondition - Condition that must be met to unlock this event
     */
    constructor(config: EventsConfig) {
        super({
            name: config.name,
            description: config.description,
            unlockCondition: config.unlockCondition
        });
        this.callbackEvents = config.callbackEvents || [];
    }

    /**
     * Lifecycle hook - called when events system is initialized
     */
    onInitialize(): void {
        logger.info(`Events system ${this.name} initialized with ${this.callbackEvents.length} callbacks`);
    }

    /**
     * Triggers all callback functions stored in the callbackEvents array.
     * @returns {void}
     */
    triggerCallbacks(): void {
        if (!this.isUnlocked) return;
        
        this.callbackEvents.forEach(callback => {
            if (typeof callback === 'function') {
                callback();
            }
        });
    }

    /**
     * Adds a callback function to the list of callbacks.
     * @param {Function} callback - The callback function to add.
     * @returns {void}
     */
    addCallback(callback: () => void): void {
        if (typeof callback === 'function') {
            this.callbackEvents.push(callback);
        } else {
            logger.warn('Provided callback is not a function');
        }
    }

    /**
     * Gets all registered callback functions
     * @returns {Array<() => void>} Array of callback functions
     */
    getCallbacks(): Array<() => void> {
        return this.callbackEvents;
    }

    /**
     * Clears all registered callbacks
     * @returns {void}
     */
    clearCallbacks(): void {
        this.callbackEvents = [];
    }

    /**
     * Lifecycle method called when the event is unlocked
     * @override
     */
    onUnlock(): void {
        super.onUnlock();
        logger.info(`Event ${this.name} is now ready to trigger callbacks`);
    }
}
