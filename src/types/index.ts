// Entity system types
export * from './entity';

// Production system types
export * from './production';

// Cost system types
export * from './cost-definition';

// Upgrade effects types
export * from './upgrade-effects';

// Unlock conditions types
export * from './unlock-conditions';

// System event aliases (to resolve export conflicts)
export * from './system-events-alias';

export interface SaveData {
  lastPlayTime: number;
  resources: ResourceData[];
  buildings: BuildingData[];
  upgrades: UpgradeData[];
}

export interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ResourceData {
  id: string;
  amount: number;
  rate: number;
  isUnlocked: boolean;
}

export interface BuildingData {
  id: string;
  amount: number;
}   

export interface UpgradeData {
  id: string;
  amount: number;
}   
