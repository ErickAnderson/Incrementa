export abstract class Entity {
  readonly id: string;
  name: string;
  description: string;
  isUnlocked: boolean;
  protected unlockCondition: () => boolean;

  constructor(name: string, description: string, unlockCondition: () => boolean) {
    this.id = this.generateId(name);
    this.name = name;
    this.description = description;
    this.isUnlocked = false;
    this.unlockCondition = unlockCondition;
  }

  private generateId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  abstract onUnlock(): void;
} 