import { Building } from "./building";
import { 
  ProductionConfig, 
  ProductionState, 
  ProductionInput, 
  ProductionOutput, 
  ProductionCycle,
  ProductionStats,
  ProductionEventType
} from "../../types/production";
import { logger } from "../../utils/logger";

/**
 * Base class for buildings that produce or transform resources.
 * Extends Building with production lifecycle and resource management.
 * 
 * This class implements the PRD specification for production buildings
 * with configurable input/output resources, production rates, and efficiency.
 */
export class ProducerBuilding extends Building {
  protected productionConfig: ProductionConfig;
  protected productionState: ProductionState;
  protected currentCycle: ProductionCycle | null = null;
  protected stats: ProductionStats;
  // Game reference inherited from Building class

  /**
   * Constructor for ProducerBuilding
   * 
   * @param config - Building configuration extended with production settings
   */
  constructor(config: {
    name: string;
    description?: string;
    cost?: Record<string, number>;
    buildTime?: number;
    level?: number;
    unlockCondition?: () => boolean;
    id?: string;
    tags?: string[];
    production: ProductionConfig;
  }) {
    super({
      name: config.name,
      description: config.description,
      cost: config.cost,
      buildTime: config.buildTime,
      level: config.level,
      unlockCondition: config.unlockCondition,
      id: config.id,
      tags: config.tags
    });

    this.productionConfig = config.production;
    
    // Initialize production state
    this.productionState = {
      isProducing: false,
      timeSinceLastCycle: 0,
      cyclesCompleted: 0,
      totalProduced: {},
      totalConsumed: {}
    };

    // Initialize production stats
    this.stats = {
      totalCycles: 0,
      totalProductionTime: 0,
      averageEfficiency: 0,
      productionRates: {},
      consumptionRates: {},
      uptimePercentage: 0
    };

    // Initialize resource tracking
    this.initializeResourceTracking();
  }

  /**
   * Initialize resource tracking for inputs and outputs
   */
  private initializeResourceTracking(): void {
    // Initialize produced resource tracking
    this.productionConfig.outputs.forEach(output => {
      this.productionState.totalProduced[output.resourceId] = 0;
      this.stats.productionRates[output.resourceId] = 0;
    });

    // Initialize consumed resource tracking
    this.productionConfig.inputs.forEach(input => {
      this.productionState.totalConsumed[input.resourceId] = 0;
      this.stats.consumptionRates[input.resourceId] = 0;
    });
  }

  /**
   * Starts production if conditions are met
   * @returns Whether production was started successfully
   */
  startProduction(): boolean {
    if (this.productionState.isProducing) {
      return false;
    }

    if (!this.canProduce()) {
      this.emitProductionEvent('resourceShortage', {
        missingResources: this.getMissingResources()
      });
      return false;
    }

    this.productionState.isProducing = true;
    this.productionState.timeSinceLastCycle = 0;
    
    this.emitProductionEvent('productionStarted');
    this.onProductionStart();
    
    logger.info(`${this.name} started production`);
    return true;
  }

  /**
   * Stops production
   */
  stopProduction(): void {
    if (!this.productionState.isProducing) {
      return;
    }

    this.productionState.isProducing = false;
    this.currentCycle = null;
    
    this.emitProductionEvent('productionStopped');
    this.onProductionStop();
    
    logger.info(`${this.name} stopped production`);
  }

  /**
   * Attempts to resume production if conditions are now met
   * Called when capacity changes or resources become available
   * @returns Whether production was resumed
   */
  tryResumeProduction(): boolean {
    // Only try to resume if we're not already producing
    if (this.productionState.isProducing) {
      return false;
    }

    // Only try to resume if we're unlocked and not building
    if (!this.isUnlocked || this.isBuilding) {
      return false;
    }

    // Attempt to start production if conditions are now met
    return this.startProduction();
  }

  /**
   * Checks if production can start/continue
   * @returns Whether all production requirements are met
   */
  canProduce(): boolean {
    // Check if building is constructed
    if (this.isBuilding) {
      return false;
    }

    // Check resource availability for inputs
    return this.hasRequiredInputs() && this.hasCapacityForOutputs();
  }

  /**
   * Checks if all required input resources are available
   * @returns Whether inputs are available
   */
  private hasRequiredInputs(): boolean {
    if (!this.game) {
      return false;
    }

    return this.productionConfig.inputs.every(input => {
      const resource = this.game!.getEntityById(input.resourceId);
      if (!resource || !('amount' in resource)) {
        return false;
      }
      return (resource as { amount: number }).amount >= input.amount;
    });
  }

  /**
   * Checks if there's capacity for output resources
   * @returns Whether outputs can be stored
   */
  private hasCapacityForOutputs(): boolean {
    if (!this.game) {
      return true; // No capacity limits if no game context
    }

    return this.productionConfig.outputs.every(output => {
      return this.game!.hasGlobalCapacity(output.resourceId, output.amount);
    });
  }

  /**
   * Gets list of missing resources that prevent production
   * @returns Array of missing resource information
   */
  private getMissingResources(): Array<{resourceId: string, required: number, available: number}> {
    if (!this.game) {
      return [];
    }

    const missing: Array<{resourceId: string, required: number, available: number}> = [];

    this.productionConfig.inputs.forEach(input => {
      const resource = this.game!.getEntityById(input.resourceId);
      const available = resource && 'amount' in resource ? (resource as { amount: number }).amount : 0;
      
      if (available < input.amount) {
        missing.push({
          resourceId: input.resourceId,
          required: input.amount,
          available
        });
      }
    });

    return missing;
  }

  /**
   * Production tick - called from game loop
   * @param deltaTime - Time elapsed since last update in seconds
   */
  onProductionTick(deltaTime: number): void {
    if (!this.productionState.isProducing) {
      return;
    }

    // Check if we can still produce
    if (!this.canProduce()) {
      this.stopProduction();
      return;
    }

    // Convert deltaTime from milliseconds to seconds for proper cycle timing
    this.productionState.timeSinceLastCycle += deltaTime / 1000;
    this.stats.totalProductionTime += deltaTime;

    // Calculate cycle duration based on production rate
    const cycleTime = 1 / this.productionConfig.rate.current;

    // Check if cycle is complete
    if (this.productionState.timeSinceLastCycle >= cycleTime) {
      this.completeProductionCycle();
    }

    this.emitProductionEvent('productionTick', {
      deltaTime,
      progress: this.productionState.timeSinceLastCycle / cycleTime
    });
  }

  /**
   * Completes a production cycle
   */
  private completeProductionCycle(): void {
    if (!this.game) {
      logger.warn(`${this.name} cannot complete production cycle without game context`);
      return;
    }

    const cycle: ProductionCycle = {
      duration: 1 / this.productionConfig.rate.current,
      inputsConsumed: {},
      outputsProduced: {},
      efficiency: this.productionConfig.efficiency.current,
      startTime: Date.now() - (this.productionState.timeSinceLastCycle * 1000),
      endTime: Date.now()
    };

    // Consume input resources
    let consumptionSuccess = true;
    this.productionConfig.inputs.forEach(input => {
      const resource = this.game!.getEntityById(input.resourceId);
      if (resource && 'decrement' in resource) {
        const actualConsumed = Math.min(input.amount, (resource as { amount: number }).amount);
        (resource as { decrement: (amount: number) => void }).decrement(actualConsumed);
        cycle.inputsConsumed[input.resourceId] = actualConsumed;
        this.productionState.totalConsumed[input.resourceId] += actualConsumed;

        if (actualConsumed < input.amount) {
          consumptionSuccess = false;
        }
      }
    });

    // Produce output resources (only if consumption was successful)
    if (consumptionSuccess) {
      this.productionConfig.outputs.forEach(output => {
        const resource = this.game!.getEntityById(output.resourceId);
        if (resource && 'increment' in resource) {
          const actualProduced = output.amount * this.productionConfig.efficiency.current;
          const canIncrement = (resource as { canIncrement?: (amount: number) => boolean }).canIncrement ? (resource as { canIncrement: (amount: number) => boolean }).canIncrement(actualProduced) : true;
          
          if (canIncrement) {
            (resource as { increment: (amount: number, respectCapacity?: boolean) => void }).increment(actualProduced, true); // Respect capacity
            cycle.outputsProduced[output.resourceId] = actualProduced;
            this.productionState.totalProduced[output.resourceId] += actualProduced;
          } else {
            this.emitProductionEvent('capacityExceeded', {
              resourceId: output.resourceId,
              attemptedAmount: actualProduced
            });
          }
        }
      });
    }

    // Update statistics
    this.productionState.cyclesCompleted++;
    this.stats.totalCycles++;
    this.updateProductionStats();

    // Reset cycle timer
    this.productionState.timeSinceLastCycle = 0;
    this.currentCycle = cycle;

    this.emitProductionEvent('productionCycleComplete', { cycle });
    this.onProductionCycleComplete(cycle);

    logger.debug(`${this.name} completed production cycle ${this.productionState.cyclesCompleted}`);
  }

  /**
   * Updates production statistics
   */
  private updateProductionStats(): void {
    if (this.stats.totalCycles === 0) return;

    // Calculate average efficiency
    this.stats.averageEfficiency = this.productionConfig.efficiency.current;

    // Calculate production rates (per second)
    const rateMultiplier = this.productionConfig.rate.current;
    this.productionConfig.outputs.forEach(output => {
      this.stats.productionRates[output.resourceId] = output.amount * rateMultiplier * this.productionConfig.efficiency.current;
    });

    this.productionConfig.inputs.forEach(input => {
      this.stats.consumptionRates[input.resourceId] = input.amount * rateMultiplier;
    });

    // Calculate uptime percentage (simplified)
    this.stats.uptimePercentage = this.productionState.isProducing ? 100 : 0;
  }

  /**
   * Gets production inputs configuration
   * @returns Array of production inputs
   */
  getProductionInputs(): ProductionInput[] {
    return [...this.productionConfig.inputs];
  }

  /**
   * Gets production outputs configuration
   * @returns Array of production outputs
   */
  getProductionOutputs(): ProductionOutput[] {
    return [...this.productionConfig.outputs];
  }

  /**
   * Sets production rate
   * @param rate - New production rate (cycles per second)
   */
  setProductionRate(rate: number): void {
    const oldRate = this.productionConfig.rate.current;
    this.productionConfig.rate.current = Math.max(0, rate);
    
    if (oldRate !== this.productionConfig.rate.current) {
      this.emitProductionEvent('rateChanged', {
        oldRate,
        newRate: this.productionConfig.rate.current
      });
    }
  }

  /**
   * Sets production efficiency
   * @param efficiency - New efficiency (1.0 = 100%)
   */
  setProductionEfficiency(efficiency: number): void {
    const oldEfficiency = this.productionConfig.efficiency.current;
    this.productionConfig.efficiency.current = Math.max(0, efficiency);
    
    if (oldEfficiency !== this.productionConfig.efficiency.current) {
      this.emitProductionEvent('efficiencyChanged', {
        oldEfficiency,
        newEfficiency: this.productionConfig.efficiency.current
      });
    }
  }

  /**
   * Gets production statistics
   * @returns Current production statistics
   */
  getProductionStats(): ProductionStats {
    return { ...this.stats };
  }

  /**
   * Gets current production state
   * @returns Current production state
   */
  getProductionState(): ProductionState {
    return { ...this.productionState };
  }

  /**
   * Checks if currently producing
   * @returns Whether production is active
   */
  isCurrentlyProducing(): boolean {
    return this.productionState.isProducing;
  }

  /**
   * Alias for isCurrentlyProducing for compatibility
   * @returns Whether production is active
   */
  get isProducing(): boolean {
    return this.productionState.isProducing;
  }

  /**
   * Gets production configuration
   * @returns Production configuration object
   */
  getProductionConfig(): ProductionConfig {
    return { ...this.productionConfig };
  }

  /**
   * Emits a production-specific event
   * @param type - Type of production event
   * @param data - Optional event data
   */
  private emitProductionEvent(type: ProductionEventType, data?: Record<string, unknown>): void {
    this.emit(type, {
      producerId: this.id,
      type,
      data,
      timestamp: Date.now()
    });
  }

  // Lifecycle hooks for subclasses to override

  /**
   * Called when production starts
   * Override in subclasses for custom start logic
   */
  protected onProductionStart(): void {
    // Default implementation - subclasses can override
  }

  /**
   * Called when production stops
   * Override in subclasses for custom stop logic
   */
  protected onProductionStop(): void {
    // Default implementation - subclasses can override
  }

  /**
   * Called when a production cycle completes
   * Override in subclasses for custom cycle completion logic
   * @param cycle - The completed production cycle
   */
  protected onProductionCycleComplete(_cycle: ProductionCycle): void {
    // Default implementation - subclasses can override
  }

  /**
   * Sets the game reference for capacity and resource checking
   * @param game - Game instance reference
   */
  setGameReference(game: unknown): void {
    super.setGameReference(game);
  }

  /**
   * Override base onUpdate to include production tick
   * @param deltaTime - Time elapsed since last update in seconds
   */
  onUpdate(deltaTime: number): void {
    super.onUpdate(deltaTime);
    this.onProductionTick(deltaTime);
  }

  /**
   * Override recalculateStats to include production recalculation
   */
  protected recalculateStats(): void {
    super.recalculateStats();
    
    // Recalculate production rates and efficiency based on level and upgrades
    this.recalculateProductionStats();
  }

  /**
   * Recalculates production statistics based on level and upgrades
   * Override in subclasses for specific production calculations
   */
  protected recalculateProductionStats(): void {
    // Base implementation - apply level-based scaling
    const levelMultiplier = 1 + ((this.level - 1) * 0.1); // 10% increase per level
    
    this.productionConfig.rate.current = this.productionConfig.rate.base * levelMultiplier;
    this.productionConfig.efficiency.current = Math.min(2.0, this.productionConfig.efficiency.base * levelMultiplier);
    
    this.updateProductionStats();
  }
}