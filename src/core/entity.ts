/**
 * Base class for all game objects, providing shared properties and methods.
 */
export class Entity {
    /** The display name of the entity */
    name: string;

    /** URL-friendly version of the entity name */
    slug: string;

    /** Detailed description of the entity */
    description: string;

    /** Flag indicating if the entity is currently unlocked */
    isUnlocked: boolean;

    /** Function that determines if the entity should be unlocked */
    unlockCondition: any;

    /**
     * Creates a new Entity instance
     * @param {string} name - The display name of the entity
     * @param {string} description - Detailed description of the entity
     * @param {Function} unlockCondition - Function that returns true when entity should unlock
     */
    constructor(name: string, description: string, unlockCondition: any) {
        this.name = name;
        this.slug = name.toLowerCase().replace(/\s+/g, "-");
        this.description = description;
        this.isUnlocked = false;
        this.unlockCondition = unlockCondition;
        this.onCreated();
    }

    /**
     * Lifecycle method called when the entity is created
     */
    onCreated() {
        console.log(`${this.name} created.`);
    }

    /**
     * Checks if the entity can be unlocked based on its condition
     * @returns {boolean} Whether the unlock condition is met
     */
    checkUnlockCondition(): boolean {
        if (typeof this.unlockCondition === 'function') {
            return this.unlockCondition();
        }
        return false;
    }

    /**
     * Unlocks the entity if conditions are met
     * @returns {boolean} Whether the unlock was successful
     */
    unlock(): boolean {
        if (this.checkUnlockCondition()) {
            this.isUnlocked = true;
            this.onUnlocked();
            return true;
        }
        return false;
    }

    /**
     * Lifecycle method called when entity is unlocked
     */
    onUnlocked(): void {
        console.log(`${this.name} unlocked!`);
    }
}
