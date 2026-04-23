import { Injectable, Logger } from '@nestjs/common';
import { ClientContext }      from '../context/client-context.interface';
import {
  Phase5Plugin,
  Phase5PluginInput,
  Phase5PluginOutput,
} from './phase5-plugin.interface';

const PLAN_TIER: Record<ClientContext['plan'], number> = {
  basic:      1,
  pro:        2,
  enterprise: 3,
};

@Injectable()
export class PluginRegistry {
  private readonly logger  = new Logger(PluginRegistry.name);
  private readonly plugins = new Map<string, Phase5Plugin>();

  register(plugin: Phase5Plugin): void {
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin "${plugin.name}" already registered — skipping duplicate`);
      return;
    }
    this.plugins.set(plugin.name, plugin);
    this.logger.log(`Plugin registered: "${plugin.name}" (priority=${plugin.priority})`);
  }

  get(name: string): Phase5Plugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): Phase5Plugin[] {
    return [...this.plugins.values()].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute all eligible plugins for the given client context.
   *
   * Isolation guarantee: each plugin runs in its own try/catch.
   * If a plugin throws, its enrichment is omitted and a warning is logged —
   * the pipeline continues and Phase 4 output is never affected.
   */
  async executeAll(
    ctx:   ClientContext,
    input: Phase5PluginInput,
  ): Promise<Record<string, Phase5PluginOutput>> {
    const eligible = this.getAll().filter(p => this.isEligible(ctx, p));
    const results: Record<string, Phase5PluginOutput> = {};

    await Promise.all(
      eligible.map(async plugin => {
        try {
          results[plugin.name] = await plugin.execute(ctx, input);
        } catch (err) {
          this.logger.error(
            `Plugin "${plugin.name}" failed (clientId=${ctx.clientId}): ${(err as Error).message}`,
          );
          // Swallow — Phase 4 output is unaffected
        }
      }),
    );

    return results;
  }

  private isEligible(ctx: ClientContext, plugin: Phase5Plugin): boolean {
    if (!plugin.requiredPlan) return true;
    return PLAN_TIER[ctx.plan] >= PLAN_TIER[plugin.requiredPlan];
  }
}
