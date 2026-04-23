import { ClientContext } from '../context/client-context.interface';
import { BaseSignal }    from '../signals/signal-contracts';

export interface Phase5Plugin {
  /** Unique identifier — used as key in enrichment map and for error isolation. */
  readonly name: string;

  /**
   * Lower number = runs first.
   * Plugins at the same priority run in registration order.
   * Range: 1–100 (1 = highest priority).
   */
  readonly priority: number;

  /**
   * Required plan tier to activate this plugin.
   * Plugins that require 'enterprise' are silently skipped for 'basic'/'pro' clients.
   */
  readonly requiredPlan?: ClientContext['plan'];

  execute(
    ctx:     ClientContext,
    input:   Phase5PluginInput,
  ): Promise<Phase5PluginOutput>;
}

export interface Phase5PluginInput {
  phase4Output:   unknown;                 // raw Phase 4 decision/response
  signals:        BaseSignal[];            // normalised signal snapshot
  requestMs:      number;                 // elapsed ms since request start
}

export interface Phase5PluginOutput {
  data:     Record<string, unknown>;      // enrichment payload
  warnings: string[];                     // non-fatal issues detected by plugin
}

/** Slot names reserved for Phase 5.1–5.6. */
export type PluginSlot =
  | 'memory-isolation'     // 5.1
  | 'cross-client-learning' // 5.2
  | 'trend-intelligence'   // 5.3
  | 'dashboard'            // 5.4
  | 'routing'              // 5.5
  | 'cost-optimizer';      // 5.6
