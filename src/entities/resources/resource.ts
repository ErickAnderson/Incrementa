import { BaseEntity } from "../../core/base-entity";

/**
 * Resource class, representing anything the player can collect or spend.
 * Emits 'amountChanged' events when resource amount changes.
 */
export class Resource extends BaseEntity {
    /** Current amount of this resource */
    amount: number;
    
    /** Rate at which this resource is collected per second */
    rate: number;
    
    /** Optional passive generation rate (e.g., mana regen) */
    basePassiveRate: number;

    /**
     * Creates a new Resource
     * @param config - Resource configuration object
     * @param config.name - The display name of the resource (e.g., "Gold", "Iron Ore")
     * @param config.description - Optional detailed description of what this resource represents
     * @param config.initialAmount - Starting quantity of this resource (defaults to 0)
     * @param config.rate - Base collection rate per second from manual gathering (defaults to 0)
     * @param config.basePassiveRate - Automatic generation rate per second (e.g., mana regen, defaults to 0)
     * @param config.unlockCondition - Function that returns true when this resource should become available
     * @param config.id - Optional unique identifier. If not provided, auto-generated from name
     * @param config.tags - Optional array of strings for categorizing this resource (e.g., ["metal", "currency"])
     */
    constructor(config: {
        name: string;
        description?: string;
        initialAmount?: number;
        rate?: number;
        basePassiveRate?: number;
        unlockCondition?: () => boolean;
        id?: string;
        tags?: string[];
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            unlockCondition: config.unlockCondition,
            tags: config.tags
        });
        this.amount = config.initialAmount || 0;
        this.rate = config.rate || 0;
        this.basePassiveRate = config.basePassiveRate || 0;
    }


    /**
     * Lifecycle hook - called when resource is initialized
     */
    onInitialize(): void {
        this.log(`Resource ${this.name} initialized with ${this.amount} units`);
    }

    /**
     * Update hook - called each game tick for passive generation
     */
    onUpdate(deltaTime: number): void {
        if (this.basePassiveRate > 0) {
            const passiveAmount = (this.basePassiveRate * deltaTime) / 1000;
            this.increment(passiveAmount);
        }
    }

    /**
     * Increases the resource amount and emits change event
     * @param amount - The amount to add to this resource
     */
    increment(amount: number): void {
        const oldAmount = this.amount;
        this.amount += amount;
        this.emit('amountChanged', {
            resource: this,
            oldAmount,
            newAmount: this.amount,
            change: amount
        });
    }

    /**
     * Decreases the resource amount (with non-negativity check) and emits change event
     * @param amount - The amount to subtract from this resource
     * @returns Whether the operation was successful
     */
    decrement(amount: number): boolean {
        if (this.amount >= amount) {
            const oldAmount = this.amount;
            this.amount -= amount;
            this.emit('amountChanged', {
                resource: this,
                oldAmount,
                newAmount: this.amount,
                change: -amount
            });
            return true;
        }
        return false;
    }

    /**
     * Sets the resource amount directly and emits change event
     * @param amount - The new amount to set
     */
    setAmount(amount: number): void {
        const oldAmount = this.amount;
        this.amount = Math.max(0, amount);
        this.emit('amountChanged', {
            resource: this,
            oldAmount,
            newAmount: this.amount,
            change: this.amount - oldAmount
        });
    }


    /**
     * Updates the collection rate for this resource
     * @param rate - The new collection rate to set
     */
    setRate(rate: number) {
        this.rate = rate;
    }
}
