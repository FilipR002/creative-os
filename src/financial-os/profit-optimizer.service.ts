import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutonomyService } from './autonomy.service';

export type ProfitZone = 'SCALE' | 'FIX' | 'KILL';

export interface CampaignProfitProfile {
  campaignId:       string;
  zone:             ProfitZone;
  roas:             number;
  roi:              number;
  performanceScore: number;
  efficiencyScore:  number;
  spend:            number;
  revenue:          number;
  impressions:      number;
  conversions:      number;
  recommendation:   string;
  confidence:       number;
  riskScore:        number;
  appliedAt?:       string;
}

export interface ProfitOptimizerResult {
  zones:      { SCALE: CampaignProfitProfile[]; FIX: CampaignProfitProfile[]; KILL: CampaignProfitProfile[] };
  summary:    { totalWaste: number; scalePotential: number; totalCampaigns: number };
  executionGate: { level: number; message: string; requiresApproval: boolean };
}

export interface ActionResult {
  executed:   boolean;
  action:     string;
  campaignId: string;
  gate:       ReturnType<AutonomyService['gate']>;
  diff?:      { before: unknown; after: unknown };
  loggedAt:   string;
}

// Pending approval queue (Level 2)
export interface PendingAction {
  id:         string;
  campaignId: string;
  action:     string;
  zone:       ProfitZone;
  proposal:   CampaignProfitProfile;
  createdAt:  string;
}

@Injectable()
export class ProfitOptimizerService {
  private readonly pendingQueue: PendingAction[] = [];
  private readonly actionLog:    ActionResult[]  = [];

  constructor(
    private readonly prisma:    PrismaService,
    private readonly autonomy:  AutonomyService,
  ) {}

  async getZones(): Promise<ProfitOptimizerResult> {
    const outcomes = await this.prisma.campaignOutcome.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
    }).catch(() => []);

    // Aggregate by campaign
    const byId = new Map<string, typeof outcomes[number][]>();
    outcomes.forEach(o => {
      if (!byId.has(o.campaignId)) byId.set(o.campaignId, []);
      byId.get(o.campaignId)!.push(o);
    });

    const profiles: CampaignProfitProfile[] = [];

    byId.forEach((rows, campaignId) => {
      const spend        = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
      const revenue      = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
      const impressions  = rows.reduce((s, r) => s + r.impressions, 0);
      const conversions  = rows.reduce((s, r) => s + r.conversions, 0);
      const avgPerf      = rows.reduce((s, r) => s + r.performanceScore, 0) / rows.length;
      const roas         = spend > 0 ? revenue / spend : (revenue > 0 ? 99 : 0);
      const roi          = spend > 0 ? (revenue - spend) / spend : 0;
      const efficiency   = spend > 0 ? avgPerf / spend : avgPerf;

      const zone = this.classify(roas, avgPerf);
      profiles.push({
        campaignId,
        zone,
        roas:             +roas.toFixed(3),
        roi:              +roi.toFixed(3),
        performanceScore: +avgPerf.toFixed(3),
        efficiencyScore:  +Math.min(efficiency * 100, 100).toFixed(2),
        spend:            +spend.toFixed(2),
        revenue:          +revenue.toFixed(2),
        impressions,
        conversions,
        recommendation:   this.recommend(zone, roas, avgPerf),
        confidence:       this.confidenceScore(rows.length, avgPerf),
        riskScore:        this.riskScore(zone, roas),
      });
    });

    const zones = {
      SCALE: profiles.filter(p => p.zone === 'SCALE'),
      FIX:   profiles.filter(p => p.zone === 'FIX'),
      KILL:  profiles.filter(p => p.zone === 'KILL'),
    };

    const gate = this.autonomy.gate('profit-optimization-execute');

    return {
      zones,
      summary: {
        totalWaste:      +zones.KILL.reduce((s, p) => s + p.spend, 0).toFixed(2),
        scalePotential:  +zones.SCALE.reduce((s, p) => s + (p.revenue * 0.3), 0).toFixed(2),
        totalCampaigns:  profiles.length,
      },
      executionGate: { level: gate.level, message: gate.message, requiresApproval: gate.requiresApproval },
    };
  }

  async executeAction(campaignId: string, action: 'scale' | 'fix' | 'kill'): Promise<ActionResult> {
    const gate = this.autonomy.gate(`profit-optimizer:${action}:${campaignId}`);
    const logEntry: ActionResult = {
      executed:   false,
      action,
      campaignId,
      gate,
      loggedAt:   new Date().toISOString(),
    };

    if (gate.level === 2) {
      // Queue for approval
      this.pendingQueue.push({
        id:         `pa-${Date.now()}`,
        campaignId,
        action,
        zone:       action === 'scale' ? 'SCALE' : action === 'kill' ? 'KILL' : 'FIX',
        proposal:   {} as CampaignProfitProfile,
        createdAt:  new Date().toISOString(),
      });
    } else if (gate.level === 3) {
      logEntry.executed = true;
      logEntry.diff     = { before: { action: 'pending' }, after: { action, appliedAt: new Date().toISOString() } };
    }

    this.actionLog.unshift(logEntry);
    if (this.actionLog.length > 200) this.actionLog.pop();
    return logEntry;
  }

  getPendingQueue(): PendingAction[] { return this.pendingQueue; }
  getActionLog():    ActionResult[]  { return this.actionLog.slice(0, 50); }

  approveAction(id: string): { approved: boolean; id: string } {
    const idx = this.pendingQueue.findIndex(p => p.id === id);
    if (idx === -1) return { approved: false, id };
    this.pendingQueue.splice(idx, 1);
    return { approved: true, id };
  }

  rejectAction(id: string): { rejected: boolean; id: string } {
    const idx = this.pendingQueue.findIndex(p => p.id === id);
    if (idx === -1) return { rejected: false, id };
    this.pendingQueue.splice(idx, 1);
    return { rejected: true, id };
  }

  private classify(roas: number, perfScore: number): ProfitZone {
    if (roas >= 3.0 || perfScore >= 0.75) return 'SCALE';
    if (roas >= 1.5 || perfScore >= 0.50) return 'FIX';
    return 'KILL';
  }

  private recommend(zone: ProfitZone, roas: number, perf: number): string {
    if (zone === 'SCALE') return `High ROI signal (ROAS ${roas.toFixed(1)}x) — increase budget allocation by 25–40%.`;
    if (zone === 'FIX')   return `Mid-tier performance (ROAS ${roas.toFixed(1)}x, score ${(perf * 100).toFixed(0)}%) — test angle variation or tighten targeting.`;
    return `Low ROI (ROAS ${roas.toFixed(1)}x) — pause spend, redirect budget to SCALE campaigns.`;
  }

  private confidenceScore(sampleCount: number, avgPerf: number): number {
    return +(Math.min((sampleCount / 10) * 0.5 + avgPerf * 0.5, 1.0).toFixed(2));
  }

  private riskScore(zone: ProfitZone, roas: number): number {
    if (zone === 'KILL')  return +(Math.min(1 - (roas / 3), 1.0).toFixed(2));
    if (zone === 'FIX')   return 0.35;
    return 0.10;
  }
}
