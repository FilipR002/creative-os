import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CampaignPortfolioEntry {
  campaignId:      string;
  name?:           string;
  totalSpend:      number;
  totalRevenue:    number;
  roas:            number;
  performanceScore: number;
  status:          'CHAMPION' | 'ACTIVE' | 'DECLINING' | 'PAUSED';
  rank:            number;
  capitalSuggestion: 'INCREASE' | 'MAINTAIN' | 'REDUCE' | 'EXIT';
}

export interface Portfolio {
  totalSpend:         number;
  totalRevenue:       number;
  portfolioROAS:      number;
  activeCount:        number;
  championCount:      number;
  decliningCount:     number;
  campaigns:          CampaignPortfolioEntry[];
  topOpportunity:     string | null;
  biggestRisk:        string | null;
}

export interface CeoStrategy {
  quarterGoal:        string;
  budgetPriority:     string;
  topAngle:           string | null;
  riskAlert:          string | null;
  scalingTarget:      string | null;
  decisions:          StrategicDecision[];
}

export interface StrategicDecision {
  id:          string;
  title:       string;
  rationale:   string;
  impact:      'HIGH' | 'MEDIUM' | 'LOW';
  urgency:     'IMMEDIATE' | 'THIS_WEEK' | 'THIS_MONTH';
  expectedROI: number;
}

export interface CapitalAllocation {
  campaignId:  string;
  currentShare: number;    // % of total budget
  idealShare:   number;    // % recommended by CEO
  action:       'INCREASE' | 'MAINTAIN' | 'REDUCE' | 'EXIT';
  rationale:    string;
}

@Injectable()
export class AiCeoService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(): Promise<Portfolio> {
    const outcomes = await this.prisma.campaignOutcome.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []);

    const campaigns = await this.prisma.campaign.findMany({
      select: { id: true, name: true, isActive: true },
      take: 100,
    }).catch(() => []);

    const nameMap = new Map<string, string>(campaigns.map(c => [c.id, c.name ?? c.id.slice(0, 8)] as [string, string]));

    const byId = new Map<string, typeof outcomes>();
    outcomes.forEach(o => {
      if (!byId.has(o.campaignId)) byId.set(o.campaignId, []);
      byId.get(o.campaignId)!.push(o);
    });

    const entries: CampaignPortfolioEntry[] = [];
    byId.forEach((rows, campaignId) => {
      const spend   = rows.reduce((s, r) => s + (r.spend ?? 0), 0);
      const revenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
      const roas    = spend > 0 ? revenue / spend : 0;
      const avgPerf = rows.reduce((s, r) => s + r.performanceScore, 0) / rows.length;

      // Trend
      const recent = rows.slice(0, 3);
      const older  = rows.slice(3, 6);
      const recentAvg = recent.reduce((s, r) => s + r.performanceScore, 0) / Math.max(recent.length, 1);
      const olderAvg  = older.length > 0 ? older.reduce((s, r) => s + r.performanceScore, 0) / older.length : recentAvg;
      const status: CampaignPortfolioEntry['status'] = roas > 3.5 ? 'CHAMPION' : recentAvg < olderAvg * 0.9 ? 'DECLINING' : 'ACTIVE';

      entries.push({
        campaignId,
        name:             nameMap.get(campaignId) ?? campaignId.slice(0, 8),
        totalSpend:       +spend.toFixed(2),
        totalRevenue:     +revenue.toFixed(2),
        roas:             +roas.toFixed(3),
        performanceScore: +avgPerf.toFixed(3),
        status,
        rank:             0,
        capitalSuggestion: roas >= 3 ? 'INCREASE' : roas >= 1.5 ? 'MAINTAIN' : roas >= 0.8 ? 'REDUCE' : 'EXIT',
      });
    });

    entries.sort((a, b) => b.roas - a.roas);
    entries.forEach((e, i) => { e.rank = i + 1; });

    const totalSpend     = entries.reduce((s, e) => s + e.totalSpend, 0);
    const totalRevenue   = entries.reduce((s, e) => s + e.totalRevenue, 0);
    const topOpportunity = entries.find(e => e.status === 'CHAMPION')?.campaignId ?? null;
    const biggestRisk    = entries.slice().reverse().find(e => e.status === 'DECLINING' || e.roas < 1)?.campaignId ?? null;

    return {
      totalSpend:     +totalSpend.toFixed(2),
      totalRevenue:   +totalRevenue.toFixed(2),
      portfolioROAS:  totalSpend > 0 ? +(totalRevenue / totalSpend).toFixed(3) : 0,
      activeCount:    entries.filter(e => e.status === 'ACTIVE').length,
      championCount:  entries.filter(e => e.status === 'CHAMPION').length,
      decliningCount: entries.filter(e => e.status === 'DECLINING').length,
      campaigns:      entries.slice(0, 20),
      topOpportunity,
      biggestRisk,
    };
  }

  async getStrategy(): Promise<CeoStrategy> {
    const portfolio = await this.getPortfolio();

    const decisions: StrategicDecision[] = [];

    if (portfolio.championCount > 0) {
      decisions.push({ id: 'd1', title: `Scale ${portfolio.championCount} champion campaign${portfolio.championCount > 1 ? 's' : ''}`, rationale: `Champion campaigns showing 3.5x+ ROAS. Doubling budget on these would be highest-ROI capital deployment.`, impact: 'HIGH', urgency: 'IMMEDIATE', expectedROI: 0.35 });
    }
    if (portfolio.decliningCount > 0) {
      decisions.push({ id: 'd2', title: `Review ${portfolio.decliningCount} declining campaign${portfolio.decliningCount > 1 ? 's' : ''}`, rationale: `Performance declining relative to own baseline. Rotate creative or pause before full fatigue.`, impact: 'MEDIUM', urgency: 'THIS_WEEK', expectedROI: 0.15 });
    }
    const exitCandidates = portfolio.campaigns.filter(c => c.capitalSuggestion === 'EXIT');
    if (exitCandidates.length > 0) {
      decisions.push({ id: 'd3', title: `Exit ${exitCandidates.length} sub-ROI campaign${exitCandidates.length > 1 ? 's' : ''}`, rationale: `These campaigns are consuming budget with ROAS < 0.8x. Reallocating frees capital for productive use.`, impact: 'HIGH', urgency: 'THIS_WEEK', expectedROI: 0.20 });
    }
    decisions.push({ id: 'd4', title: 'Enable autonomous budget rebalancing', rationale: 'Setting Autonomy Level 3 + budget rebalancer enables real-time capital optimization without manual intervention.', impact: 'MEDIUM', urgency: 'THIS_MONTH', expectedROI: 0.12 });

    return {
      quarterGoal:    portfolio.portfolioROAS > 2 ? 'Maximize scale on champion campaigns — 40% revenue growth' : 'Portfolio restructuring — eliminate waste, amplify winners',
      budgetPriority: portfolio.championCount > 0 ? `Focus ${(portfolio.championCount / Math.max(portfolio.campaigns.length, 1) * 100).toFixed(0)}% of budget on champion campaigns` : 'Build baseline performance before concentration',
      topAngle:       portfolio.topOpportunity,
      riskAlert:      portfolio.biggestRisk ? `Campaign ${portfolio.biggestRisk.slice(0, 8)}… showing declining performance` : null,
      scalingTarget:  portfolio.topOpportunity,
      decisions,
    };
  }

  async getCapitalAllocation(): Promise<CapitalAllocation[]> {
    const portfolio = await this.getPortfolio();
    const totalSpend = portfolio.totalSpend;

    return portfolio.campaigns.slice(0, 15).map(c => {
      const currentShare = totalSpend > 0 ? +(c.totalSpend / totalSpend * 100).toFixed(1) : 0;
      const idealShare   = this.computeIdealShare(c.roas, portfolio.campaigns);
      return {
        campaignId:   c.campaignId,
        currentShare,
        idealShare:   +idealShare.toFixed(1),
        action:       c.capitalSuggestion,
        rationale:    c.capitalSuggestion === 'INCREASE' ? `ROAS ${c.roas.toFixed(1)}x justifies higher allocation` : c.capitalSuggestion === 'EXIT' ? `ROAS ${c.roas.toFixed(1)}x — capital better deployed elsewhere` : `Maintain current allocation`,
      };
    });
  }

  private computeIdealShare(roas: number, all: CampaignPortfolioEntry[]): number {
    const totalWeight = all.reduce((s, e) => s + Math.max(e.roas, 0.1), 0);
    return totalWeight > 0 ? (Math.max(roas, 0.1) / totalWeight) * 100 : 0;
  }
}
