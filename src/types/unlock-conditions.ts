/**
 * Enhanced unlock condition types for Incrementa framework
 * Provides data-driven unlock conditions and complex requirements
 */

export interface UnlockConditionDefinition {
  /** The type of unlock condition */
  type: UnlockConditionType;
  
  /** The target to evaluate (entity ID, resource ID, etc.) */
  target: string;
  
  /** The operation to perform for the condition */
  operation: UnlockOperation;
  
  /** The value to compare against */
  value: number | string | boolean;
  
  /** Optional description of this condition */
  description?: string;
  
  /** Whether this condition must remain true (persistent) or just needs to be met once */
  persistent?: boolean;
}

export type UnlockConditionType =
  | 'resource_amount'        // Check if a resource has a certain amount
  | 'resource_rate'          // Check if a resource has a certain generation rate
  | 'building_count'         // Check if a certain number of buildings exist
  | 'building_level'         // Check if a specific building has reached a level
  | 'upgrade_purchased'      // Check if a specific upgrade has been purchased
  | 'time_played'           // Check if a certain amount of time has been played
  | 'entities_unlocked'     // Check if a certain number of entities are unlocked
  | 'production_rate'       // Check if global production rate meets threshold
  | 'storage_capacity'      // Check if storage capacity meets threshold
  | 'custom_property'       // Check a custom property on an entity
  | 'and'                   // Logical AND of multiple conditions
  | 'or'                    // Logical OR of multiple conditions
  | 'not'                   // Logical NOT of a condition
  | 'count'                 // Count entities matching criteria
  | 'sum'                   // Sum values from multiple entities
  | 'achievement';          // Check if achievement/milestone is met

export type UnlockOperation =
  | 'equals'                // Value must equal target
  | 'not_equals'           // Value must not equal target
  | 'greater_than'         // Value must be greater than target
  | 'greater_than_or_equal' // Value must be greater than or equal to target
  | 'less_than'            // Value must be less than target
  | 'less_than_or_equal'   // Value must be less than or equal to target
  | 'contains'             // String/array must contain target
  | 'not_contains'         // String/array must not contain target
  | 'exists'               // Target must exist
  | 'not_exists'           // Target must not exist
  | 'between'              // Value must be between two targets
  | 'in_list'              // Value must be in a list of targets
  | 'matches_pattern';     // Value must match a regex pattern

export interface ComplexUnlockCondition {
  /** The main condition definition */
  condition: UnlockConditionDefinition;
  
  /** Additional conditions that must be met (AND logic) */
  andConditions?: UnlockConditionDefinition[];
  
  /** Alternative conditions that can be met (OR logic) */
  orConditions?: UnlockConditionDefinition[];
  
  /** Conditions that must NOT be met */
  notConditions?: UnlockConditionDefinition[];
  
  /** Prerequisites that must be unlocked first */
  prerequisites?: string[];
  
  /** Time delay after prerequisites are met (in seconds) */
  timeDelay?: number;
  
  /** Whether this condition can be re-evaluated */
  canReEvaluate?: boolean;
  
  /** Custom validator function for complex logic */
  customValidator?: () => boolean;
}

export interface UnlockConditionResult {
  /** Whether the condition is currently met */
  isMet: boolean;
  
  /** Detailed evaluation of each condition part */
  evaluationDetails: ConditionEvaluation[];
  
  /** Human-readable description of why condition failed */
  failureReason?: string;
  
  /** Progress towards meeting the condition (0-1) */
  progress?: number;
  
  /** Whether prerequisites are met */
  prerequisitesMet: boolean;
  
  /** Time remaining for time-delayed conditions */
  timeRemaining?: number;
}

export interface ConditionEvaluation {
  /** The condition that was evaluated */
  condition: UnlockConditionDefinition;
  
  /** Whether this specific condition was met */
  isMet: boolean;
  
  /** The actual value that was evaluated */
  actualValue: any;
  
  /** The expected/target value */
  expectedValue: any;
  
  /** Human-readable description of the evaluation */
  description: string;
  
  /** Progress towards meeting this condition (0-1) */
  progress?: number;
}

export interface UnlockTemplate {
  /** Template name for reusability */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Base condition structure */
  baseCondition: ComplexUnlockCondition;
  
  /** Parameters that can be customized */
  parameters: Record<string, any>;
  
  /** Tags for categorizing templates */
  tags?: string[];
}

export interface UnlockMilestone {
  /** Milestone identifier */
  id: string;
  
  /** Milestone name */
  name: string;
  
  /** Milestone description */
  description: string;
  
  /** Condition to achieve this milestone */
  condition: ComplexUnlockCondition;
  
  /** Reward for achieving milestone */
  reward?: UnlockReward;
  
  /** Whether this milestone is achieved */
  isAchieved: boolean;
  
  /** When this milestone was achieved */
  achievedAt?: number;
}

export interface UnlockReward {
  /** Type of reward */
  type: 'resource' | 'unlock' | 'multiplier' | 'custom';
  
  /** Target of the reward (resource ID, entity ID, etc.) */
  target: string;
  
  /** Value/amount of the reward */
  value: number | string | any;
  
  /** Description of the reward */
  description: string;
}

export interface UnlockManagerStats {
  /** Total number of conditions being tracked */
  totalConditions: number;
  
  /** Number of conditions currently met */
  conditionsMet: number;
  
  /** Number of entities unlocked */
  entitiesUnlocked: number;
  
  /** Number of milestones achieved */
  milestonesAchieved: number;
  
  /** Most common condition types */
  commonConditionTypes: UnlockConditionType[];
  
  /** Average time to unlock entities */
  averageUnlockTime: number;
  
  /** Total evaluation time */
  totalEvaluationTime: number;
}

// Event types for unlock system
export type UnlockEventType =
  | 'conditionMet'
  | 'conditionFailed'
  | 'entityUnlocked'
  | 'milestoneAchieved'
  | 'prerequisiteMet'
  | 'unlockDelayed'
  | 'conditionEvaluated';

export interface UnlockEvent {
  type: UnlockEventType;
  data: {
    entityId?: string;
    condition?: UnlockConditionDefinition;
    result?: UnlockConditionResult;
    milestone?: UnlockMilestone;
    timestamp: number;
  };
}

// Utility types
export type UnlockConditionValidator = (condition: UnlockConditionDefinition, context: any) => UnlockConditionResult;
export type UnlockEvaluationContext = {
  game: any;
  entity: any;
  timestamp: number;
  [key: string]: any;
};