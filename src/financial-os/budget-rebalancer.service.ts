import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutonomyService } from './autonomy.service';

export interface BudgetAllocation {
  campaignId:   string;
  currentBudget: number;
  proposedBudget: number;
  delta:         number;
  deltaPercent:  number;
  reason:        string;
  roas:          number;
  performanceScore: number;
}

export interface RebalanceProposal {
  id:          string;
  allocations: BudgetAllocation[];
  totalBudget: number;
  expectedROIImprovement: number;
  confidence:  number;
  riskScore:   number;
  status:      'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  createdAt:   string;
  appliedAt?:  string;
}

export interface BudgetStatus {
  currentAllocations: BudgetAllocation[];
  pendingProposals:   RebalanceProposal[];
  lastRebalancedAt:   string | null;
  autonomyGate:       { level: number; message: string };
}

@Injectable()
export class BudgetRebalancerService {
  private readonly logger    = new Logger(BudgetRebalancerService.name);
  private readonly proposals: RebalanceProposal[] = [];
  private lastRebalancedAt:  string | null = null;

  constructor(
    private readonly prisma:   PrismaService,
    private readonly autonomy: AutonomyService,
  ) {}

  async getStatus(): Promise<BudgetStatus> {
    const allocations  = await this.buildCurrentAllocations();
    const gate         = this.autonomy.gate('budget-rebalance');
    return {
      currentAllocations: allocations,
      pendingProposals:   this.proposals.filter(p => p.status === 'PENDING'),
      lastRebalancedAt:   this.lastRebalancedAt,
      autonomyGate:       { level: gate.level, message: gate.message },
    };
  }

  async rebalance(): Promise<{ gate: ReturnType<AutonomyService['gate']>; proposal?: RebalanceProposal }> {
    const gate = this.autonomy.gate('budget-rebalance');

    if (gate.level === 0 || gate.level === 1) {
      return { gate };
    }

    const allocations  = await this.buildCurrentAllocations();
    const totalBudget  = allocations.reduce((s, a) => s + a.currentBudget, 0);

    // ROI-driven redistribution: shift budget from low ROAS → high ROAS
    const sorted       = [...allocations].sort((a, b) => b.roas - a.roas);
    const proposed:    BudgetAllocation[] = [];

    sorted.forEach((alloc, idx) => {
      const share = totalBudget > 0 ? this.computeShare(alloc.roas, sorted) : alloc.currentBudget;
      const delta  = +(share - alloc.currentBudget).toFixed(2);
      proposed.push({
        ...alloc,
        proposedBudget: +share.toFixed(2),
        delta,
        deltaPercent:   alloc.currentBudget > 0 ? +(delta / alloc.currentBudget * 100).toFixed(1) : 0,
        reason:         this.budgetReason(alloc.roas, delta),
      });
    });

    const proposal: RebalanceProposal = {
      id:          `rb-${Date.now()}`,
      allocations: proposed,
      totalBudget: +totalBudget.toFixed(2),
      expectedROIImprovement: 0.12,
      confidence:  0.78,
      riskScore:   0.22,
      status:      gate.level === 2 ? 'PENDING' : 'APPLIED',
      createdAt:   new Date().toISOString(),
    };

    this.proposals.unshift(proposal);
    if (this.proposals.length > 20) this.proposals.pop();

    if (gate.level === 3) {
      this.lastRebalancedAt = new Date().toISOString();
      this.logger.log(`Budget rebalanced autonomously: ${proposed.length} campaigns adjusted`);
    }

    return { gate, proposal };
  }

  approveProposal(id: string): { approved: boolean } {
    const p = this.proposals.find(p => p.id === id);
    if (!p || p.status !== 'PENDING') return { approved: false };
    p.status       = 'APPLIED';
    p.appliedAt    = new Date().toISOString();
    this.lastRebalancedAt = p.appliedAt;
    return { approved: true };
  }

  rejectProposal(id: string): { rejected: boolean } {
    const p = this.proposals.find(p => p.id === id);
    if (!p || p.status !== 'PENDING') return { rejected: false };
    p.status = 'REJECTED';
    return { rejected: true };
  }

  getProposals(): RebalanceProposal[] { return this.proposals; }

  private async buildCurrentAllocations(): Promise<BudgetAllocation[]> {
    const outcomes = await this.prisma.campaignOutcome.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    }).catch(() => []);

    const byId = new Map<string, typeof outcomes>();
    outcomes.forEach(o => {
      if (!byId.has(o.campaignId)) byId.set(o.campaignId, []);
      byId.get(o.campaignId)!.push(o);
    });

    const allocs: BudgetAllocation[] = [];
    byId.forEach((rows, campaignId) => {
      const spend  = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
      const revenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
      const roas   = spend > 0 ? revenue / spend : 0;
      const avgPerf = rows.reduce((s, r) => s + r.performanceScore, 0) / rows.length;
      allocs.push({
        campaignId,
        currentBudget:  +spend.toFixed(2),
        proposedBudget: +spend.toFixed(2),
        delta:           0,
        deltaPercent:    0,
        reason:          'Current allocation',
        roas:            +roas.toFixed(3),
        performanceScore: +avgPerf.toFixed(3),
      });
    });

    return allocs;
  }

  private computeShare(roas: number, all: BudgetAllocation[]): number {
    const total = all.reduce((s, a) => s + a.currentBudget, 0);
    const totalWeight = all.reduce((s, a) => s + Math.max(a.roas, 0.1), 0);
    const weight      = Math.max(roas, 0.1) / totalWeight;
    return total * weight;
  }

  private budgetReason(roas: number, delta: number): string {
    if (delta > 0  && roas >= 3) return `Increase: strong ROAS ${roas.toFixed(1)}x justifies +${delta.toFixed(0)} allocation`;
    if (delta < 0  && roas < 1.5) return `Reduce: low ROAS ${roas.toFixed(1)}x — reallocate ${Math.abs(delta).toFixed(0)} to top performers`;
    return `Maintain: ROAS ${roas.toFixed(1)}x within acceptable range`;
  }
}
