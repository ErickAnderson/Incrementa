/**
 * Base class for all game objects, providing shared properties and methods.
 */
export class Entity {
    name: string;
    slug: string;
    description: string;
    isUnlocked: boolean;
    unlockCondition: any;

    constructor(name: string, description: string, unlockCondition: any) {
        this.name = name;
        this.slug = name.toLowerCase().replace(/\s+/g, "-");
        this.description = description;
        this.isUnlocked = false;
        this.unlockCondition = unlockCondition;
        this.onCreated();
    }

    // Called when the object is created
    onCreated() {
        console.log(`${this.name} created.`);
    }

    // Check and unlock the object
    checkUnlockCondition() {
        if (this.unlockCondition()) {
            this.unlock();
        }
    }

    // Unlock the object
    unlock() {
        this.isUnlocked = true;
        this.onUnlocked();
    }

    // Called when the object is unlocked
    onUnlocked() {
        console.log(`${this.name} unlocked.`);
    }
}
