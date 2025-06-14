/**
 * Type definitions for the entity system
 */

/** Configuration interface for creating BaseEntity instances */
export interface EntityConfig {
    /** Optional unique identifier. If not provided, will be auto-generated from name */
    id?: string;
    /** The display name of the entity */
    name: string;
    /** Optional detailed description of the entity */
    description?: string;
    /** Optional function that returns true when entity should unlock */
    unlockCondition?: () => boolean;
    /** Optional array for custom categorization */
    tags?: string[];
    /** Optional initial unlock state (defaults to false) */
    isUnlocked?: boolean;
}

/** Event data emitted when an entity is unlocked */
export interface EntityUnlockedEvent {
    entity: Record<string, unknown>;
}

/** Event data emitted when a tag is added or removed */
export interface EntityTagEvent {
    tag: string;
    entity: Record<string, unknown>;
}

/** Standard entity events */
export type EntityEvent = 
    | 'unlocked'
    | 'tagAdded' 
    | 'tagRemoved'
    | 'stateChanged';

/** Generic event listener function type */
export type EventListener<T = Record<string, unknown>> = (data?: T) => void;