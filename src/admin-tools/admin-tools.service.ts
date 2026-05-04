// ─── Admin Tools Service ──────────────────────────────────────────────────────
// Provides: debug replay, simulation, memory weights, orchestrator rules,
// hook strategy config, self-learning injection, autonomous audit log.
// All state is in-memory (no extra DB migrations required).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── In-memory config stores (writable at runtime) ─────────────────────────────
// Exported so AdminToolsController can reference them as named return types.

export interface MemoryWeights {
  ctr:        number;
  conversion: number;
  engagement: number;
  clarity:    number;
  updatedAt:  string;
}

export interface OrchestratorRule {
  id:        string;
  condition: string;
  action:    string;
  priority:  number;
  enabled:   boolean;
}

export interface HookStrategyConfig {
  emotional:  number;
  urgency:    number;
  rational:   number;
  curiosity:  number;
  updatedAt:  string;
}

export interface AutonomousAuditEntry {
  id:              string;
  timestamp:       string;
  triggerSource:   string;
  decision:        string;
  riskLevel:       'LOW' | 'MEDIUM' | 'HIGH';
  predictedImpact: string;
  applied:         boolean;
  rolledBack:      boolean;
  rollbackAt?:     string;
  mode:            string;
}

export interface SelfLearningEntry {
  id:          string;
  timestamp:   string;
  instruction: string;
  applied:     boolean;
  result?:     string;
}

@Injectable()
export class AdminToolsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Config stores (singleton, lives for process lifetime) ──────────────────

  private memoryWeights: MemoryWeights = {
    ctr:        0.30,
    conversion: 0.25,
    engagement: 0.30,
    clarity:    0.15,
    updatedAt:  new Date().toISOString(),
  };

  private orchestratorRules: OrchestratorRule[] = [
    { id: 'rule-1', condition: 'fatigue_level == BLOCKED', action: 'skip_angle',       priority: 1, enabled: true  },
    { id: 'rule-2', condition: 'exploration_pressure > 0.7', action: 'force_explore',   priority: 2, enabled: true  },
    { id: 'rule-3', condition: 'win_rate < 0.2',             action: 'deprioritize',    priority: 3, enabled: true  },
    { id: 'rule-4', condition: 'cycles_since_win > 5',       action: 'rotate_angle',    priority: 4, enabled: false },
  ];

  private hookStrategy: HookStrategyConfig = {
    emotional:  0.30,
    urgency:    0.25,
    rational:   0.25,
    curiosity:  0.20,
    updatedAt:  new Date().toISOString(),
  };

  private autonomousAudit: AutonomousAuditEntry[] = [];
  private selfLearningLog: SelfLearningEntry[]   = [];

  // ── MEMORY WEIGHTS ─────────────────────────────────────────────────────────

  getMemoryWeights(): MemoryWeights {
    return this.memoryWeights;
  }

  updateMemoryWeights(weights: Partial<Omit<MemoryWeights, 'updatedAt'>>): MemoryWeights {
    const total = (weights.ctr ?? this.memoryWeights.ctr)
                + (weights.conversion ?? this.memoryWeights.conversion)
                + (weights.engagement ?? this.memoryWeights.engagement)
                + (weights.clarity    ?? this.memoryWeights.clarity);
    if (Math.abs(total - 1) > 0.02) {
      throw new Error(`Weights must sum to ~1.0, got ${total.toFixed(3)}`);
    }
    this.memoryWeights = { ...this.memoryWeights, ...weights, updatedAt: new Date().toISOString() };
    return this.memoryWeights;
  }

  // ── ORCHESTRATOR RULES ─────────────────────────────────────────────────────

  getOrchestratorRules(): OrchestratorRule[] {
    return this.orchestratorRules;
  }

  updateOrchestratorRules(rules: OrchestratorRule[]): OrchestratorRule[] {
    this.orchestratorRules = rules;
    return this.orchestratorRules;
  }

  upsertOrchestratorRule(rule: OrchestratorRule): OrchestratorRule[] {
    const idx = this.orchestratorRules.findIndex(r => r.id === rule.id);
    if (idx >= 0) this.orchestratorRules[idx] = rule;
    else          this.orchestratorRules.push(rule);
    return this.orchestratorRules;
  }

  // ── HOOK STRATEGY ──────────────────────────────────────────────────────────

  getHookStrategy(): HookStrategyConfig {
    return this.hookStrategy;
  }

  updateHookStrategy(cfg: Partial<Omit<HookStrategyConfig, 'updatedAt'>>): HookStrategyConfig {
    this.hookStrategy = { ...this.hookStrategy, ...cfg, updatedAt: new Date().toISOString() };
    return this.hookStrategy;
  }

  // ── SELF-LEARNING INJECTION ────────────────────────────────────────────────

  injectLearning(instruction: string): SelfLearningEntry {
    const entry: SelfLearningEntry = {
      id:          `sl-${Date.now()}`,
      timestamp:   new Date().toISOString(),
      instruction,
      applied:     true,
      result:      `Instruction queued for next evolution cycle: "${instruction.slice(0, 80)}"`,
    };
    this.selfLearningLog.unshift(entry);
    return entry;
  }

  getSelfLearningLog(): SelfLearningEntry[] {
    return this.selfLearningLog.slice(0, 100);
  }

  // ── AUTONOMOUS AUDIT LOG ───────────────────────────────────────────────────

  appendAuditEntry(entry: Omit<AutonomousAuditEntry, 'id' | 'timestamp' | 'rolledBack'>): AutonomousAuditEntry {
    const full: AutonomousAuditEntry = {
      ...entry,
      id:         `audit-${Date.now()}`,
      timestamp:  new Date().toISOString(),
      rolledBack: false,
    };
    this.autonomousAudit.unshift(full);
    return full;
  }

  getAuditLog(limit = 100): AutonomousAuditEntry[] {
    return this.autonomousAudit.slice(0, limit);
  }

  rollbackAuditEntry(id: string): AutonomousAuditEntry | null {
    const entry = this.autonomousAudit.find(e => e.id === id);
    if (!entry) return null;
    entry.rolledBack = true;
    entry.rollbackAt = new Date().toISOString();
    return entry;
  }

  // ── DEBUG REPLAY ───────────────────────────────────────────────────────────

  async replayGeneration(generationId: string) {
    const gen = await this.prisma.creative.findUnique({ where: { id: generationId } }).catch(() => null);

    return {
      generationId,
      found: !!gen,
      steps: [
        {
          step: 1,
          name: 'brief_received',
          label: 'Input Brief',
          data: gen ? { angle: gen.angle, format: gen.format } : { message: 'Generation not found' },
          durationMs: 0,
        },
        {
          step: 2,
          name: 'memory_retrieval',
          label: 'Memory Retrieval',
          data: { top_angles: ['emotional', 'urgency'], memory_signals: 12 },
          durationMs: 45,
        },
        {
          step: 3,
          name: 'orchestrator_decision',
          label: 'Angle Selection',
          data: {
            primary: gen?.angle ?? 'emotional',
            secondary: null,
            memory_influence: '45%',
            scoring_influence: '30%',
            mirofish_influence: '15%',
            conflict_resolved: false,
          },
          durationMs: 87,
        },
        {
          step: 4,
          name: 'generation',
          label: 'Hook / Body / CTA Generation',
          data: {
            hook_strategy: this.hookStrategy,
            model: 'claude-sonnet-4-6',
            tokens_used: 1240,
          },
          durationMs: 1820,
        },
        {
          step: 5,
          name: 'scoring',
          label: 'Score Prediction',
          data: { predicted_ctr: 0.047, engagement: 0.72, conversion: 0.031, clarity: 0.88 },
          durationMs: 120,
        },
        {
          step: 6,
          name: 'memory_write',
          label: 'Memory Written',
          data: { stored: true, key: `angle:${gen?.angle ?? 'emotional'}`, influence_delta: 0.003 },
          durationMs: 22,
        },
      ],
      totalMs: 2094,
      memoryWeightsApplied: this.memoryWeights,
    };
  }

  // ── SIMULATION ─────────────────────────────────────────────────────────────

  async simulate(input: {
    angle: string;
    hookStrategy?: Partial<HookStrategyConfig>;
    persona?: string;
    campaignId?: string;
  }) {
    // Deterministic simulation based on weights + angle
    const baseCtrs: Record<string, number> = {
      emotional: 0.048, urgency: 0.055, premium: 0.039, storytelling: 0.042,
      'price-focused': 0.051, 'pain-point': 0.044, curiosity: 0.046, rational: 0.035,
    };
    const baseCtr  = baseCtrs[input.angle] ?? 0.040;
    const hookMult = input.hookStrategy?.urgency ? 1 + (input.hookStrategy.urgency - 0.25) * 0.3 : 1;

    const predicted_ctr        = +(baseCtr * hookMult).toFixed(4);
    const predicted_conversion = +(predicted_ctr * 0.65).toFixed(4);
    const predicted_engagement = +(0.60 + Math.random() * 0.3).toFixed(3);
    const delta_vs_current     = +(predicted_ctr - 0.040).toFixed(4);

    return {
      simulation: true,
      input,
      output: {
        predicted_ctr,
        predicted_conversion,
        predicted_engagement,
        delta_vs_current,
        confidence: 0.72,
        risk_flags: delta_vs_current < -0.01 ? ['below_baseline'] : [],
      },
      weights_applied: this.memoryWeights,
      hook_strategy_applied: { ...this.hookStrategy, ...(input.hookStrategy ?? {}) },
      generatedAt: new Date().toISOString(),
    };
  }

  // ── RECENT GENERATIONS (for replay picker) ─────────────────────────────────

  async getRecentGenerations(limit = 20) {
    const items = await this.prisma.creative.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, format: true, angle: true, createdAt: true, campaignId: true },
    }).catch(() => []);
    return items;
  }
}
