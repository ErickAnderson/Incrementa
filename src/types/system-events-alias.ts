/**
 * Type aliases to resolve export conflicts between modules
 */

// Re-export types with prefixes to avoid conflicts
export type {
  CostEventType as CostSystemEventType,
  CostEvent as CostSystemEvent
} from './cost-definition';

export type {
  ProductionEventType as ProductionSystemEventType,
  ProductionEvent as ProductionSystemEvent
} from './production';

export type {
  UpgradeEventType as UpgradeSystemEventType,
  UpgradeEvent as UpgradeSystemEvent
} from './upgrade-effects';

export type {
  UnlockEventType as UnlockSystemEventType,
  UnlockEvent as UnlockSystemEvent
} from './unlock-conditions';