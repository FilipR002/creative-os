// ─── Phase 9.5 — Product-Facing API Endpoints ────────────────────────────────
//
// These are the ONLY endpoints the frontend dashboard should ever call.
// Every response is a ProductResponse or ProductListResponse — no engine data.
//
// /api/product/dashboard              → overview of all campaigns
// /api/product/campaign/:id           → single campaign performance
// /api/product/insights/:id           → 9.4 human insight wrapped
// /api/product/angles/:campaignId     → angle selection panel (no weights)
// /api/product/creatives/:campaignId  → creative results (no scores)

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }         from '@nestjs/swagger';
import { ProductResponseContractService } from './product-contract.service';
import { UserInsightService }            from '../user-insight/user-insight.service';
import { PrismaService }                 from '../prisma/prisma.service';

@ApiTags('product')
@Controller('api/product')
export class ProductController {
  constructor(
    private readonly contract: ProductResponseContractService,
    private readonly insight:  UserInsightService,
    private readonly prisma:   PrismaService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard summary (product view)' })
  async dashboard() {
    try {
      const [campaigns, outcomes, topStat] = await Promise.all([
        this.prisma.campaign.count(),
        this.prisma.campaignOutcome.findMany({
          orderBy: { createdAt: 'desc' },
          take:    50,
          select:  { performanceScore: true, createdAt: true },
        }),
        this.prisma.anglePerformanceStat.findFirst({
          orderBy: { avgPerformanceScore: 'desc' },
          select:  { angleSlug: true },
        }),
      ]);

      const avgPerf = outcomes.length
        ? outcomes.reduce((s, o) => s + o.performanceScore, 0) / outcomes.length
        : 0;

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent = outcomes.filter(o => o.createdAt >= sevenDaysAgo).length;

      // Humanise the top angle slug into a readable label
      const topAngleLabel = await this.resolveAngleLabel(topStat?.angleSlug ?? null);

      return this.contract.fromDashboardSummary({
        activeCampaigns: campaigns,
        avgPerformance:  avgPerf,
        topAngleLabel,
        recentCampaigns: recent,
      });
    } catch {
      return this.contract.error('dashboard');
    }
  }

  // ── Campaign overview ──────────────────────────────────────────────────────

  @Get('campaign/:campaignId')
  @ApiOperation({ summary: 'Campaign performance overview (product view)' })
  async campaign(@Param('campaignId') campaignId: string) {
    try {
      const [outcome, userInsight, causalTrace] = await Promise.all([
        this.prisma.campaignOutcome.findFirst({
          where:   { campaignId },
          orderBy: { createdAt: 'desc' },
          select:  { performanceScore: true, angleSlug: true, campaignId: true, createdAt: true },
        }),
        this.insight.generateUserInsight(campaignId).catch(() => null),
        this.prisma.causalTrace.findFirst({
          where:   { campaignId },
          orderBy: { createdAt: 'desc' },
          select:  {
            angleContribution: true, creativeContribution: true,
            visionContribution: true, evolutionContribution: true,
            noiseEstimate: true, confidence: true,
          },
        }),
      ]);

      // Resolve dominant driver (internal — not forwarded as-is)
      const driver = this.resolveDominantDriver(causalTrace);

      return this.contract.fromCampaignOutcome(outcome, userInsight, driver);
    } catch {
      return this.contract.error('campaign_overview');
    }
  }

  // ── Insights panel ─────────────────────────────────────────────────────────

  @Get('insights/:campaignId')
  @ApiOperation({ summary: 'Campaign insight panel (product view)' })
  async insights(@Param('campaignId') campaignId: string) {
    try {
      const userInsight = await this.insight.generateUserInsight(campaignId);

      if (!userInsight || userInsight.headline === 'No performance data yet') {
        return this.contract.neutral('insights_panel', userInsight?.headline ?? 'No data yet');
      }

      return this.contract.fromUserInsight(userInsight);
    } catch {
      return this.contract.error('insights_panel');
    }
  }

  // ── Angle selection panel ──────────────────────────────────────────────────

  @Get('angles/:campaignId')
  @ApiOperation({ summary: 'Angle selection panel (product view — no weights)' })
  async angles(@Param('campaignId') campaignId: string) {
    try {
      // Load the campaign to get goal context
      const [campaign, memory] = await Promise.all([
        this.prisma.campaign.findUnique({
          where:   { id: campaignId },
          include: { concept: true },
        }),
        this.prisma.creativeMemory.findMany({
          where:   { campaignId },
          orderBy: { totalScore: 'desc' },
          take:    6,
          select:  { angle: true, totalScore: true },
        }),
      ]);

      if (!memory.length) {
        // Fall back to global angle performance stats
        const stats = await this.prisma.anglePerformanceStat.findMany({
          orderBy: { avgPerformanceScore: 'desc' },
          take:    6,
        });

        const angleIds = await this.prisma.angle.findMany({
          where:  { slug: { in: stats.map(s => s.angleSlug) } },
          select: { id: true, slug: true, label: true, description: true },
        });

        const mapped = stats.map((s, i) => {
          const a = angleIds.find(x => x.slug === s.angleSlug);
          return {
            id:         a?.id ?? s.angleSlug,
            label:      a?.label ?? s.angleSlug,
            description: a?.description ?? undefined,
            rank:        i,
            isTopPick:  i === 0,
          };
        });

        const goal = (campaign?.concept?.rawJson as any)?.goal as string | undefined;
        return this.contract.fromAngleSelection(mapped, goal);
      }

      // Build product cards from memory (used angles for this campaign)
      const angleRows = await this.prisma.angle.findMany({
        where:  { slug: { in: memory.map(m => m.angle) } },
        select: { id: true, slug: true, label: true, description: true },
      });

      // Deduplicate by angle slug (memory may have multiple rows per angle)
      const seen = new Set<string>();
      const unique = memory.filter(m => seen.has(m.angle) ? false : (seen.add(m.angle), true));

      const mapped = unique.map((m, i) => {
        const a = angleRows.find(x => x.slug === m.angle);
        return {
          id:          a?.id ?? m.angle,
          label:       a?.label ?? m.angle,
          description: a?.description ?? undefined,
          rank:        i,
          isTopPick:   i === 0,
        };
      });

      const goal = (campaign?.concept?.rawJson as any)?.goal as string | undefined;
      return this.contract.fromAngleSelection(mapped, goal);
    } catch {
      return this.contract.error('angle_selection');
    }
  }

  // ── Creative results panel ─────────────────────────────────────────────────

  @Get('creatives/:campaignId')
  @ApiOperation({ summary: 'Creative results panel (product view — no scores)' })
  async creatives(@Param('campaignId') campaignId: string) {
    try {
      const scores = await this.prisma.creativeScore.findMany({
        where:   { creative: { campaignId } },
        include: { creative: true },
        orderBy: { totalScore: 'desc' },
        take:    10,
      });

      if (!scores.length) return this.contract.neutral('creative_results', 'No creative results yet');

      // Return a list of product cards — one per scored creative
      const items = scores.map(s =>
        this.contract.fromCreativeScore({
          totalScore: s.totalScore,
          creativeId: s.creativeId,
          format:     s.creative.format.toLowerCase(),
          isWinner:   s.creative.isWinner,
        })
      );

      // Top-level screen wraps the list
      const winner = items.find(i => i.metadata.isWinner === true);
      return {
        screen:   'creative_results' as const,
        title:    winner ? 'Winner selected' : 'Creative performance summary',
        subtitle: `${scores.length} variation${scores.length !== 1 ? 's' : ''} scored`,
        state:    (winner ? 'success' : 'neutral') as ProductResponse['state'],
        items,
        metadata: { count: scores.length, hasWinner: !!winner },
      };
    } catch {
      return this.contract.error('creative_results');
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private resolveDominantDriver(trace: {
    angleContribution: number; creativeContribution: number;
    visionContribution: number; evolutionContribution: number;
    noiseEstimate: number; confidence: number;
  } | null): string | undefined {
    if (!trace || trace.confidence < 0.30) return undefined;

    const entries: [string, number][] = [
      ['angle',     trace.angleContribution],
      ['creative',  trace.creativeContribution],
      ['vision',    trace.visionContribution],
      ['evolution', trace.evolutionContribution],
      ['noise',     trace.noiseEstimate],
    ];

    return entries.reduce((best, cur) => cur[1] > best[1] ? cur : best)[0];
  }

  private async resolveAngleLabel(slug: string | null): Promise<string> {
    if (!slug) return 'Not enough data yet';
    const angle = await this.prisma.angle.findFirst({
      where:  { slug },
      select: { label: true },
    }).catch(() => null);
    return angle?.label ?? slug;
  }
}

// Local type alias to avoid import cycle in inline JSDoc
type ProductResponse = import('./product-contract.types').ProductResponse;
