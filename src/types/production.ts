/**
 * Production system type definitions for Incrementa framework
 * Defines interfaces for resource production, transformation, and management
 */

export interface ProductionInput {
  /** ID of the resource required for production */
  resourceId: string;
  
  /** Amount of resource required per production cycle */
  amount: number;
  
  /** Optional efficiency modifier for this input */
  efficiency?: number;
}

export interface ProductionOutput {
  /** ID of the resource produced */
  resourceId: string;
  
  /** Amount of resource produced per production cycle */
  amount: number;
  
  /** Optional efficiency modifier for this output */
  efficiency?: number;
}

export interface ProductionRate {
  /** Base production rate (cycles per second) */
  base: number;
  
  /** Current production rate including modifiers */
  current: number;
  
  /** Rate modifiers from upgrades, buildings, etc. */
  modifiers: number[];
}

export interface ProductionEfficiency {
  /** Base efficiency percentage (1.0 = 100%) */
  base: number;
  
  /** Current efficiency including modifiers */
  current: number;
  
  /** Efficiency modifiers from upgrades, buildings, etc. */
  modifiers: number[];
}

export interface ProductionState {
  /** Whether production is currently active */
  isProducing: boolean;
  
  /** Time since last production cycle */
  timeSinceLastCycle: number;
  
  /** Total number of production cycles completed */
  cyclesCompleted: number;
  
  /** Total resources produced (by resource ID) */
  totalProduced: Record<string, number>;
  
  /** Total resources consumed (by resource ID) */
  totalConsumed: Record<string, number>;
}

export interface ProductionConfig {
  /** Input resources required for production */
  inputs: ProductionInput[];
  
  /** Output resources produced */
  outputs: ProductionOutput[];
  
  /** Production rate configuration */
  rate: ProductionRate;
  
  /** Production efficiency configuration */
  efficiency: ProductionEfficiency;
  
  /** Whether production starts automatically when conditions are met */
  autoStart: boolean;
  
  /** Whether production continues automatically when resources are available */
  continuous: boolean;
}

export interface ProductionCycle {
  /** Duration of a single production cycle in seconds */
  duration: number;
  
  /** Resources consumed in this cycle */
  inputsConsumed: Record<string, number>;
  
  /** Resources produced in this cycle */
  outputsProduced: Record<string, number>;
  
  /** Efficiency achieved in this cycle */
  efficiency: number;
  
  /** Timestamp when cycle started */
  startTime: number;
  
  /** Timestamp when cycle completed */
  endTime?: number;
}

export interface ProductionStats {
  /** Total production cycles completed */
  totalCycles: number;
  
  /** Total production time in seconds */
  totalProductionTime: number;
  
  /** Average production efficiency */
  averageEfficiency: number;
  
  /** Resources produced per second (by resource ID) */
  productionRates: Record<string, number>;
  
  /** Resources consumed per second (by resource ID) */
  consumptionRates: Record<string, number>;
  
  /** Production uptime percentage */
  uptimePercentage: number;
}

export type ProductionEventType = 
  | 'productionStarted'
  | 'productionStopped' 
  | 'productionTick'
  | 'productionCycleComplete'
  | 'resourceShortage'
  | 'capacityExceeded'
  | 'efficiencyChanged'
  | 'rateChanged';

export interface ProductionEvent {
  /** Type of production event */
  type: ProductionEventType;
  
  /** ID of the producing entity */
  producerId: string;
  
  /** Event data specific to event type */
  data?: any;
  
  /** Timestamp when event occurred */
  timestamp: number;
}