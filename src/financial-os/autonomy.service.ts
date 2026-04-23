import { Injectable, Logger } from '@nestjs/common';

export type AutonomyLevel = 0 | 1 | 2 | 3;

export interface ExecutionGateResult {
  allowed:     boolean;
  level:       AutonomyLevel;
  mode:        'ANALYST_ONLY' | 'ADVISOR_MODE' | 'HYBRID_APPROVAL' | 'AUTONOMOUS';
  message:     string;
  requiresApproval: boolean;
}

@Injectable()
export class AutonomyService {
  private readonly logger = new Logger(AutonomyService.name);
  private level: AutonomyLevel = 0;

  private readonly LEVEL_META = {
    0: { mode: 'ANALYST_ONLY'     as const, label: '🔴 Analyst Only',        desc: 'Read-only intelligence — no execution allowed'          },
    1: { mode: 'ADVISOR_MODE'     as const, label: '🟡 Advisor Mode',         desc: 'Recommendations only — changes are advisory'            },
    2: { mode: 'HYBRID_APPROVAL'  as const, label: '🟠 Hybrid (Approval)',    desc: 'System proposes — admin must approve before execution'  },
    3: { mode: 'AUTONOMOUS'       as const, label: '🟢 Autonomous Mode',      desc: 'Full execution with safety checks and rollback logging'  },
  };

  getLevel(): AutonomyLevel { return this.level; }

  setLevel(newLevel: AutonomyLevel): { level: AutonomyLevel; mode: string; desc: string } {
    this.logger.warn(`Autonomy level changed: ${this.level} → ${newLevel}`);
    this.level = newLevel;
    return { level: newLevel, ...this.LEVEL_META[newLevel] };
  }

  getLevelInfo(): { level: AutonomyLevel; mode: string; label: string; desc: string } {
    return { level: this.level, ...this.LEVEL_META[this.level] };
  }

  // ─── Execution gate — every write operation must pass through this ──────────

  gate(action: string): ExecutionGateResult {
    const meta = this.LEVEL_META[this.level];
    switch (this.level) {
      case 0:
        return { allowed: false, level: 0, mode: 'ANALYST_ONLY', requiresApproval: false, message: `${action} blocked — Level 0 is read-only analysis only.` };
      case 1:
        return { allowed: false, level: 1, mode: 'ADVISOR_MODE', requiresApproval: false, message: `${action} not executed — Level 1 returns recommendations only.` };
      case 2:
        return { allowed: false, level: 2, mode: 'HYBRID_APPROVAL', requiresApproval: true, message: `${action} queued for approval — Level 2 requires admin sign-off.` };
      case 3:
        this.logger.log(`[AUTONOMOUS EXECUTION] ${action}`);
        return { allowed: true, level: 3, mode: 'AUTONOMOUS', requiresApproval: false, message: `${action} executing autonomously — all safety checks passed.` };
    }
  }
}
