/**
 * Cost system type definitions for Incrementa framework
 * Provides structured cost definitions and resource spending validation
 */

export interface CostDefinition {
  /** The resource identifier that this cost requires */
  resourceId: string;
  
  /** The amount of the resource required */
  amount: number;
  
  /** Optional scaling factor for cost calculations (e.g., level-based costs) */
  scalingFactor?: number;
  
  /** Optional base multiplier for cost calculations */
  multiplier?: number;
}

export interface CostConfiguration {
  /** Array of resource costs required */
  costs: CostDefinition[];
  
  /** Whether this cost configuration scales with level/quantity */
  isScaling?: boolean;
  
  /** Base scaling multiplier for all costs */
  baseScaling?: number;
  
  /** Optional description of what this cost is for */
  description?: string;
}

export interface CostValidationResult {
  /** Whether the cost can be afforded */
  canAfford: boolean;
  
  /** Detailed breakdown of each cost requirement */
  breakdown: CostBreakdown[];
  
  /** Missing resources that prevent affording the cost */
  missingResources: MissingResource[];
  
  /** Total cost summary */
  totalCost: Record<string, number>;
}

export interface CostBreakdown {
  /** The resource ID for this cost item */
  resourceId: string;
  
  /** The required amount */
  required: number;
  
  /** The available amount */
  available: number;
  
  /** Whether this cost item can be afforded */
  canAfford: boolean;
  
  /** The shortage amount if not affordable */
  shortage?: number;
}

export interface MissingResource {
  /** The resource ID that is missing */
  resourceId: string;
  
  /** The amount that is missing */
  amount: number;
  
  /** The percentage of the requirement that is missing */
  percentageMissing: number;
}

export interface CostCalculationOptions {
  /** The level or quantity to calculate costs for */
  level?: number;
  
  /** Additional multiplier to apply */
  multiplier?: number;
  
  /** Whether to apply scaling calculations */
  applyScaling?: boolean;
  
  /** Custom scaling function */
  scalingFunction?: (baseCost: number, level: number) => number;
}

export interface ResourceSpendingResult {
  /** Whether the spending was successful */
  success: boolean;
  
  /** Resources that were actually spent */
  spent: Record<string, number>;
  
  /** Error message if spending failed */
  error?: string;
  
  /** Resources that couldn't be spent */
  failed?: Record<string, number>;
}

// Event types for cost system
export type CostEventType = 
  | 'costCalculated'
  | 'costValidated' 
  | 'resourcesSpent'
  | 'spendingFailed'
  | 'costChanged';

export interface CostEvent {
  type: CostEventType;
  data: {
    costs?: CostDefinition[];
    validation?: CostValidationResult;
    spending?: ResourceSpendingResult;
    entityId?: string;
    timestamp: number;
  };
}

// Utility types for cost system integration
export type CostProvider = {
  getCosts(): CostDefinition[];
  setCosts(costs: CostDefinition[]): void;
  calculateCost(options?: CostCalculationOptions): Record<string, number>;
  canAfford(options?: CostCalculationOptions): boolean;
};

export interface CostSystemStats {
  /** Total number of cost validations performed */
  validationsPerformed: number;
  
  /** Total number of successful resource spending operations */
  successfulSpending: number;
  
  /** Total number of failed spending attempts */
  failedSpending: number;
  
  /** Most expensive costs calculated */
  mostExpensiveCosts: Record<string, number>;
  
  /** Most commonly required resources */
  commonResources: string[];
}