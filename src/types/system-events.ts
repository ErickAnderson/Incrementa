/**
 * System event types and definitions for Incrementa framework
 * Provides comprehensive event emission for all entity state changes and system operations
 */

// Core Entity Events
export type EntityEventType =
  | 'entityCreated'
  | 'entityDestroyed'
  | 'entityUnlocked'
  | 'entityLocked'
  | 'entityUpdated'
  | 'propertyChanged'
  | 'tagsChanged';

// Resource Events  
export type ResourceEventType =
  | 'amountChanged'
  | 'rateChanged'
  | 'capacityReached'
  | 'capacityExceeded'
  | 'resourceDepleted'
  | 'resourceGenerated'
  | 'passiveRateChanged';

// Building Events
export type BuildingEventType =
  | 'buildStart'
  | 'buildComplete'
  | 'buildCanceled'
  | 'constructionFailed'
  | 'levelUp'
  | 'upgradeApplied'
  | 'statsRecalculated'
  | 'costSpent'
  | 'costSpendFailed'
  | 'costsChanged';

// Production Events
export type ProductionEventType =
  | 'productionStarted'
  | 'productionStopped'
  | 'productionTick'
  | 'productionComplete'
  | 'resourceShortage'
  | 'productionOptimized'
  | 'efficiencyChanged'
  | 'productionRateChanged';

// Storage Events
export type StorageEventType =
  | 'capacityChanged'
  | 'capacityReached'
  | 'capacityIncreased'
  | 'storageUtilizationChanged'
  | 'resourceStored'
  | 'resourceRemoved';

// Upgrade Events
export type UpgradeEventType =
  | 'upgradeApplied'
  | 'upgradeRemoved'
  | 'upgradeAvailable'
  | 'upgradeConditionMet'
  | 'upgradeApplicationFailed'
  | 'upgradePurchased'
  | 'purchaseFailed'
  | 'upgradeReset'
  | 'effectApplied'
  | 'effectRemoved';

// Game System Events
export type GameEventType =
  | 'gameStarted'
  | 'gamePaused'
  | 'gameResumed'
  | 'gameSaved'
  | 'gameLoaded'
  | 'gameDestroyed'
  | 'gameSpeedChanged'
  | 'offlineProgressCalculated'
  | 'entityAdded'
  | 'entityRemoved';

// Timer Events
export type TimerEventType =
  | 'timerStarted'
  | 'timerStopped'
  | 'timerPaused'
  | 'timerResumed'
  | 'timerComplete'
  | 'timerTick'
  | 'timerDestroyed';

// Cost System Events
export type CostEventType =
  | 'costCalculated'
  | 'costValidated'
  | 'resourcesSpent'
  | 'spendingFailed'
  | 'costChanged';

// Worker Events (if implemented)
export type WorkerEventType =
  | 'workerAssigned'
  | 'workerUnassigned'
  | 'workerEfficiencyChanged'
  | 'workCompleted'
  | 'workerIdle';

// All system events
export type SystemEventType = 
  | EntityEventType
  | ResourceEventType
  | BuildingEventType
  | ProductionEventType
  | StorageEventType
  | UpgradeEventType
  | GameEventType
  | TimerEventType
  | CostEventType
  | WorkerEventType;

// Event data structures
export interface EntityEventData {
  entity: any;
  entityId: string;
  entityName: string;
  oldValue?: any;
  newValue?: any;
  property?: string;
  timestamp: number;
}

export interface ResourceEventData extends EntityEventData {
  resourceId: string;
  amount?: number;
  oldAmount?: number;
  newAmount?: number;
  rate?: number;
  capacity?: number;
}

export interface BuildingEventData extends EntityEventData {
  buildingId: string;
  level?: number;
  oldLevel?: number;
  newLevel?: number;
  upgrade?: any;
  cost?: Record<string, number>;
  spent?: Record<string, number>;
  error?: string;
}

export interface ProductionEventData extends EntityEventData {
  producerId: string;
  inputResources?: Record<string, number>;
  outputResources?: Record<string, number>;
  productionRate?: number;
  efficiency?: number;
  shortage?: string[];
}

export interface StorageEventData extends EntityEventData {
  storageId: string;
  resourceId?: string;
  capacity?: number;
  oldCapacity?: number;
  newCapacity?: number;
  utilization?: number;
  amount?: number;
}

export interface UpgradeEventData extends EntityEventData {
  upgradeId: string;
  targetEntityId?: string;
  effect?: any;
  result?: any;
  spent?: Record<string, number>;
  error?: string;
  applications?: number;
}

export interface GameEventData {
  timestamp: number;
  gameTime?: number;
  deltaTime?: number;
  entityId?: string;
  entity?: any;
  offlineTime?: number;
  progress?: any;
  speed?: number;
}

export interface TimerEventData {
  timerId: string;
  timerName?: string;
  duration?: number;
  remaining?: number;
  progress?: number;
  callback?: string;
  timestamp: number;
}

export interface CostEventData {
  costs?: any[];
  validation?: any;
  spending?: any;
  entityId?: string;
  calculatedCosts?: Record<string, number>;
  timestamp: number;
}

// Generic system event
export interface SystemEvent<T = any> {
  type: SystemEventType;
  data: T;
  timestamp: number;
  source?: string;
  target?: string;
}

// Event listener types
export type EntityEventListener = (event: SystemEvent<EntityEventData>) => void;
export type ResourceEventListener = (event: SystemEvent<ResourceEventData>) => void;
export type BuildingEventListener = (event: SystemEvent<BuildingEventData>) => void;
export type ProductionEventListener = (event: SystemEvent<ProductionEventData>) => void;
export type StorageEventListener = (event: SystemEvent<StorageEventData>) => void;
export type UpgradeEventListener = (event: SystemEvent<UpgradeEventData>) => void;
export type GameEventListener = (event: SystemEvent<GameEventData>) => void;
export type TimerEventListener = (event: SystemEvent<TimerEventData>) => void;
export type CostEventListener = (event: SystemEvent<CostEventData>) => void;
export type SystemEventListener = (event: SystemEvent) => void;

// Event filtering and subscription options
export interface EventSubscriptionOptions {
  /** Filter events by entity ID */
  entityId?: string;
  
  /** Filter events by entity type */
  entityType?: string;
  
  /** Filter events by tags */
  tags?: string[];
  
  /** Only receive events once */
  once?: boolean;
  
  /** Debounce events (minimum time between events in ms) */
  debounce?: number;
  
  /** Custom filter function */
  filter?: (event: SystemEvent) => boolean;
}

// Event emission options
export interface EventEmissionOptions {
  /** Whether to emit to global listeners */
  global?: boolean;
  
  /** Whether to emit to entity-specific listeners */
  entity?: boolean;
  
  /** Additional metadata to include */
  metadata?: Record<string, any>;
  
  /** Priority level for event processing */
  priority?: 'low' | 'normal' | 'high';
  
  /** Whether this event can be batched */
  batchable?: boolean;
}

// Event batch for performance optimization
export interface EventBatch {
  events: SystemEvent[];
  batchId: string;
  timestamp: number;
  source: string;
}

// Event middleware for processing events
export type EventMiddleware = (event: SystemEvent, next: () => void) => void;

// Event error handling
export interface EventError {
  eventType: SystemEventType;
  error: Error;
  event: SystemEvent;
  timestamp: number;
  listener?: Function;
}

// Event replay system for debugging
export interface EventReplay {
  events: SystemEvent[];
  startTime: number;
  endTime: number;
  filters?: EventSubscriptionOptions;
}