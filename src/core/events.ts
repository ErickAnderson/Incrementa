import { Entity } from './entity';

/** Configuration interface for Events class */
interface EventsConfig {
    name: string;
    description: string;
    callbackEvents?: Array<() => void>;
    unlockCondition: any;
}

/**
 * Class for handling events and callbacks, extending the base Entity class.
 * @extends {Entity}
 */
export class Events extends Entity {
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
        super(config.name, config.description, config.unlockCondition);
        this.callbackEvents = config.callbackEvents || [];
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
            console.error('Provided callback is not a function');
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
    onUnlocked(): void {
        super.onUnlocked();
        console.log(`Event ${this.name} is now ready to trigger callbacks`);
    }
}
