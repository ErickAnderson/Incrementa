import { BaseEntity, IGame } from "../../core/base-entity";
import { logger } from "../../utils/logger";
import { LOG_CONSTANTS, GAME_CONSTANTS } from "../../utils/constants";

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
    
    /** Reference to the game instance for capacity checking */
    private game?: IGame;
    
    /** Timestamp for throttling passive generation logs */
    private _lastPassiveLog?: number;

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
        isUnlocked?: boolean;
    }) {
        super({
            id: config.id,
            name: config.name,
            description: config.description,
            unlockCondition: config.unlockCondition,
            tags: config.tags,
            isUnlocked: config.isUnlocked
        });
        this.amount = config.initialAmount || 0;
        this.rate = config.rate || 0;
        this.basePassiveRate = config.basePassiveRate || 0;
    }


    /**
     * Lifecycle hook - called when resource is initialized
     */
    onInitialize(): void {
        const passiveInfo = this.basePassiveRate > 0 ? ` (passive rate: ${this.basePassiveRate}/sec)` : '';
        logger.info(`Resource ${this.name}: Initialized with ${this.amount} units${passiveInfo}`);
    }

    /**
     * Update hook - called each game tick for passive generation
     */
    onUpdate(deltaTime: number): void {
        // Generate passive resources based on basePassiveRate when unlocked
        // Logic validated: rate * deltaTime / 1000 gives correct per-second generation
        if (this.basePassiveRate > 0 && this.isUnlocked) {
            const passiveAmount = (this.basePassiveRate * deltaTime) / GAME_CONSTANTS.MS_PER_SECOND;
            
            // Log passive generation periodically (every ~5 seconds)
            const logInterval = LOG_CONSTANTS.PERIODIC_LOG_INTERVAL;
            if (!this._lastPassiveLog || Date.now() - this._lastPassiveLog >= logInterval) {
                logger.debug(`Resource ${this.name}: Passive generation +${passiveAmount.toFixed(3)}/tick (rate: ${this.basePassiveRate}/sec)`);
                this._lastPassiveLog = Date.now();
            }
            
            const success = this.increment(passiveAmount);
            
            // Log if passive generation is blocked by capacity
            if (!success && this.game) {
                const capacity = this.game.getTotalCapacityFor(this.id);
                if (capacity > 0) {
                    logger.info(`Resource ${this.name}: Passive generation halted - at capacity (${this.amount}/${capacity})`);
                }
            }
        }
    }

    /**
     * Increases the resource amount and emits change event
     * @param amount - The amount to add to this resource
     * @param checkCapacity - Whether to check capacity limits (defaults to true)
     * @returns Whether the increment was successful
     */
    increment(amount: number, checkCapacity: boolean = true): boolean {
        if (amount < 0) {
            throw new Error('Increment amount must be non-negative');
        }
        
        // Check capacity if requested and game reference is available
        if (checkCapacity && this.game) {
            const totalCapacity = this.game.getTotalCapacityFor(this.id);
            
            if (!this.game.hasGlobalCapacity(this.id, amount)) {
                const remainingCapacity = this.game.getRemainingCapacityFor(this.id);
                logger.warn(`Resource ${this.name}: Increment blocked by capacity - attempted +${amount}, current: ${this.amount}, capacity: ${totalCapacity}, remaining: ${remainingCapacity}`);
                
                this.emit('capacityExceeded', {
                    resourceId: this.id,
                    attemptedAmount: amount,
                    currentAmount: this.amount,
                    totalCapacity,
                    remainingCapacity
                });
                return false;
            } else if (totalCapacity > 0) {
                // Log successful increment with capacity info
                const newAmount = this.amount + amount;
                const utilization = ((newAmount / totalCapacity) * 100).toFixed(1);
                logger.debug(`Resource ${this.name}: +${amount} (${this.amount} → ${newAmount}, ${utilization}% capacity used)`);
            }
        } else if (!checkCapacity) {
            logger.debug(`Resource ${this.name}: +${amount} (capacity check bypassed)`);
        }
        
        const oldAmount = this.amount;
        this.amount += amount;
        
        // Log significant increments
        if (amount >= 100 || this.amount >= 1000) {
            logger.info(`Resource ${this.name}: Significant increment +${amount} (total: ${this.amount})`);
        }
        
        this.emit('amountChanged', {
            resource: this,
            oldAmount,
            newAmount: this.amount,
            change: amount
        });
        return true;
    }

    /**
     * Decreases the resource amount (with non-negativity check) and emits change event
     * @param amount - The amount to subtract from this resource
     * @returns Whether the operation was successful
     */
    decrement(amount: number): boolean {
        if (amount < 0) {
            logger.warn(`Resource ${this.name}: Attempted negative decrement (${amount})`);
            return false;
        }
        
        if (this.amount >= amount) {
            const oldAmount = this.amount;
            this.amount -= amount;
            
            logger.debug(`Resource ${this.name}: -${amount} (${oldAmount} → ${this.amount})`);
            
            // Log significant decrements or when resources get low
            if (amount >= 100 || (oldAmount >= 100 && this.amount < 10)) {
                logger.info(`Resource ${this.name}: Significant decrement -${amount} (remaining: ${this.amount})`);
            }
            
            this.emit('amountChanged', {
                resource: this,
                oldAmount,
                newAmount: this.amount,
                change: -amount
            });
            return true;
        } else {
            logger.warn(`Resource ${this.name}: Insufficient amount for decrement - attempted -${amount}, available: ${this.amount}`);
            return false;
        }
    }

    /**
     * Sets the resource amount directly and emits change event
     * @param amount - The new amount to set
     */
    setAmount(amount: number): void {
        const oldAmount = this.amount;
        const clampedAmount = Math.max(0, amount);
        
        if (amount !== clampedAmount) {
            logger.warn(`Resource ${this.name}: Negative amount clamped to 0 (attempted: ${amount})`);
        }
        
        this.amount = clampedAmount;
        const change = this.amount - oldAmount;
        
        if (Math.abs(change) > 0) {
            const changeSign = change > 0 ? '+' : '';
            logger.debug(`Resource ${this.name}: Direct set ${changeSign}${change} (${oldAmount} → ${this.amount})`);
            
            // Log significant changes
            if (Math.abs(change) >= 100) {
                logger.info(`Resource ${this.name}: Large amount change ${changeSign}${change} (total: ${this.amount})`);
            }
        }
        
        this.emit('amountChanged', {
            resource: this,
            oldAmount,
            newAmount: this.amount,
            change
        });
    }


    /**
     * Updates the collection rate for this resource
     * @param rate - The new collection rate to set
     */
    setRate(rate: number) {
        this.rate = rate;
    }
    
    /**
     * Sets the game instance reference for capacity checking
     * @param game - The game instance
     * @internal
     */
    setGameReference(game: IGame): void {
        // Call parent method to set _game for event forwarding
        super.setGameReference(game);
        
        // Set local game reference for capacity checking
        this.game = game;
        if (game) {
            logger.debug(`Resource ${this.name}: Game reference set - capacity checking enabled`);
        } else {
            logger.debug(`Resource ${this.name}: Game reference cleared - capacity checking disabled`);
        }
    }
    
    /**
     * Checks if adding a specific amount would exceed capacity
     * @param amount - The amount to check
     * @returns Whether the amount can be added without exceeding capacity
     */
    canIncrement(amount: number): boolean {
        if (!this.game) {
            logger.debug(`Resource ${this.name}: Capacity check - no game reference, allowing increment`);
            return true; // No capacity checking without game reference
        }
        
        const canAdd = this.game.hasGlobalCapacity(this.id, amount);
        const capacity = this.game.getTotalCapacityFor(this.id);
        
        if (capacity > 0) {
            logger.debug(`Resource ${this.name}: Capacity check for +${amount} - ${canAdd ? 'ALLOWED' : 'BLOCKED'} (${this.amount + (canAdd ? amount : 0)}/${capacity})`);
        }
        
        return canAdd;
    }

    /**
     * Enhanced save data including resource-specific properties
     * @returns Object containing resource's saveable state
     */
    getSaveData(): Record<string, unknown> {
        return {
            ...super.getSaveData(),
            amount: this.amount,
            rate: this.rate,
            basePassiveRate: this.basePassiveRate
        };
    }

    /**
     * Restores resource from saved state
     * @param saveData - The saved state data
     */
    loadSaveData(saveData: Record<string, unknown>): void {
        super.loadSaveData(saveData);
        
        if (saveData.amount !== undefined) {
            this.amount = saveData.amount;
        }
        if (saveData.rate !== undefined) {
            this.rate = saveData.rate;
        }
        if (saveData.basePassiveRate !== undefined) {
            this.basePassiveRate = saveData.basePassiveRate;
        }
    }
}
