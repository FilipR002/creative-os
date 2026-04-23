import { Injectable } from '@nestjs/common';
import { CIAutonomyLevel } from './types';

export interface CIGateResult {
  allowed:          boolean;
  level:            CIAutonomyLevel;
  requiresApproval: boolean;
  message:          string;
}

@Injectable()
export class CiAutonomyService {
  private level: CIAutonomyLevel = 0; // DEFAULT: manual only

  getLevel(): CIAutonomyLevel { return this.level; }

  setLevel(l: CIAutonomyLevel): void { this.level = l; }

  gate(action: string): CIGateResult {
    switch (this.level) {
      case 0:
        return { allowed: false, level: 0, requiresApproval: false, message: `L0 Manual Only — "${action}" requires user initiation` };
      case 1:
        return { allowed: false, level: 1, requiresApproval: false, message: `L1 Suggest Only — insights surfaced but not applied` };
      case 2:
        return { allowed: false, level: 2, requiresApproval: true,  message: `L2 Approval Required — waiting for admin approval` };
      case 3:
        return { allowed: true,  level: 3, requiresApproval: false, message: `L3 Autonomous — executing "${action}"` };
    }
  }

  getLevelMeta() {
    const META = [
      { level: 0, label: 'Manual Only',         desc: 'User initiates everything. No background activity.' },
      { level: 1, label: 'Suggest Insights',    desc: 'Surfaces recommendations. No auto-usage.' },
      { level: 2, label: 'Approval Required',   desc: 'System proposes; admin approves before any usage.' },
      { level: 3, label: 'Full Autonomous',     desc: 'Auto-monitors + injects approved patterns. ADMIN ONLY.' },
    ];
    return { current: this.level, meta: META };
  }
}
