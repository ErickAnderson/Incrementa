/**
 * Upgrade effect type definitions for Incrementa framework
 * Provides data-driven upgrade effects and property modification
 */

export interface UpgradeEffectDefinition {
  /** The type of effect this upgrade applies */
  type: UpgradeEffectType;
  
  /** The property path to modify (e.g., 'productionRate', 'costs.gold.amount') */
  targetProperty: string;
  
  /** The operation to perform on the target property */
  operation: UpgradeOperation;
  
  /** The value to apply with the operation */
  value: number;
  
  /** Optional conditions that must be met for this effect to apply */
  conditions?: UpgradeCondition[];
  
  /** Optional description of what this effect does */
  description?: string;
}

export type UpgradeEffectType = 
  | 'property_modifier'     // Modifies a numeric property
  | 'cost_modifier'         // Modifies cost requirements
  | 'production_modifier'   // Modifies production rates
  | 'capacity_modifier'     // Modifies storage capacity
  | 'unlock_modifier'       // Unlocks new functionality
  | 'efficiency_modifier'   // Modifies efficiency calculations
  | 'custom';              // Custom effect with function

export type UpgradeOperation = 
  | 'add'          // Add value to property
  | 'multiply'     // Multiply property by value
  | 'set'          // Set property to specific value
  | 'percentage'   // Increase property by percentage
  | 'divide'       // Divide property by value
  | 'power'        // Raise property to power
  | 'min'          // Set property to minimum of current and value
  | 'max';         // Set property to maximum of current and value

export interface UpgradeCondition {
  /** The type of condition to check */
  type: UpgradeConditionType;
  
  /** The target entity or property to check */
  target: string;
  
  /** The operation to perform for the condition */
  operation: ConditionOperation;
  
  /** The value to compare against */
  value: number | string | boolean;
  
  /** Optional description of this condition */
  description?: string;
}

export type UpgradeConditionType =
  | 'entity_level'      // Check entity level
  | 'resource_amount'   // Check resource amount
  | 'building_count'    // Check number of buildings
  | 'upgrade_applied'   // Check if other upgrade is applied
  | 'time_played'       // Check total time played
  | 'custom';          // Custom condition function

export type ConditionOperation =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains';

export interface UpgradeTarget {
  /** The type of entity to target */
  entityType: 'building' | 'resource' | 'storage' | 'worker' | 'all';
  
  /** Specific entity ID to target (optional) */
  entityId?: string;
  
  /** Filter entities by tags */
  tags?: string[];
  
  /** Filter entities by name pattern */
  namePattern?: string;
}

export interface UpgradeConfiguration {
  /** Array of effects this upgrade applies */
  effects: UpgradeEffectDefinition[];
  
  /** What entities this upgrade targets */
  targets: UpgradeTarget[];
  
  /** Whether this upgrade can be applied multiple times */
  isRepeatable?: boolean;
  
  /** Maximum number of times this upgrade can be applied */
  maxApplications?: number;
  
  /** Current number of times this upgrade has been applied */
  currentApplications?: number;
  
  /** Whether this upgrade is automatically applied when conditions are met */
  autoApply?: boolean;
  
  /** Prerequisites that must be met before this upgrade becomes available */
  prerequisites?: UpgradeCondition[];
}

export interface UpgradeApplicationResult {
  /** Whether the upgrade was successfully applied */
  success: boolean;
  
  /** Detailed results for each effect that was applied */
  effectResults: EffectApplicationResult[];
  
  /** Error message if application failed */
  error?: string;
  
  /** Entities that were modified by this upgrade */
  modifiedEntities: string[];
}

export interface EffectApplicationResult {
  /** The effect that was applied */
  effect: UpgradeEffectDefinition;
  
  /** Whether this specific effect was successfully applied */
  success: boolean;
  
  /** The entity ID that was modified */
  entityId: string;
  
  /** The property that was modified */
  property: string;
  
  /** The old value before modification */
  oldValue: any;
  
  /** The new value after modification */
  newValue: any;
  
  /** Error message if this effect failed */
  error?: string;
}

export interface UpgradeStats {
  /** Total number of upgrades applied */
  totalApplied: number;
  
  /** Total number of failed upgrade attempts */
  totalFailed: number;
  
  /** Most commonly applied upgrade types */
  commonUpgradeTypes: UpgradeEffectType[];
  
  /** Entities most frequently targeted by upgrades */
  frequentTargets: string[];
  
  /** Total value of modifications applied */
  totalValueModified: number;
}

// Event types for upgrade system
export type UpgradeEventType = 
  | 'upgradeApplied'
  | 'upgradeRemoved'
  | 'upgradeAvailable'
  | 'upgradeConditionMet'
  | 'upgradeApplicationFailed'
  | 'effectApplied'
  | 'effectRemoved';

export interface UpgradeEvent {
  type: UpgradeEventType;
  data: {
    upgradeId?: string;
    upgrade?: any;
    result?: UpgradeApplicationResult;
    effectResult?: EffectApplicationResult;
    entityId?: string;
    timestamp: number;
  };
}