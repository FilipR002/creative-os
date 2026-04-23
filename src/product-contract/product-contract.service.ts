// ─── Phase 9.5 — UI Contract Layer: Translation Service ──────────────────────
//
// Converts every engine-internal data shape into a ProductResponse.
//
// RULES:
//   • Every public method returns ProductResponse or ProductListResponse
//   • Internal numbers are NEVER forwarded — only human labels
//   • sanitize() runs recursively and strips FORBIDDEN_FIELDS from any object
//   • neutral() / error() ensure the UI always has a renderable fallback

import { Injectable } from '@nestjs/common';
import type {
  ProductResponse,
  ProductListResponse,
  ProductCard,
  ScreenType,
} from './product-contract.types';
import { FORBIDDEN_FIELDS } from './product-contract.types';

// ── Performance tier → human label ────────────────────────────────────────────
function perfLabel(score: number): { label: string; metric: string; state: ProductResponse['state'] } {
  if (score >= 0.35) return { label: 'Exceptional',         metric: 'Strong engagement',          state: 'success' };
  if (score >= 0.28) return { label: 'Strong',              metric: 'Above average performance',  state: 'success' };
  if (score >= 0.18) return { label: 'Solid',               metric: 'Meeting expectations',       state: 'neutral' };
  if (score >= 0.10) return { label: 'Below expectations',  metric: 'Needs improvement',          state: 'warning' };
  return               { label: 'Low traction',            metric: 'Significant room to improve', state: 'warning' };
}

// ── Score tier → human label (for creative scoring) ──────────────────────────
function scoreTierLabel(score: number): { label: string; state: ProductResponse['state'] } {
  if (score >= 0.80) return { label: 'Outstanding creative',  state: 'success' };
  if (score >= 0.65) return { label: 'Strong creative',       state: 'success' };
  if (score >= 0.50) return { label: 'Good creative',         state: 'neutral' };
  if (score >= 0.35) return { label: 'Average creative',      state: 'neutral' };
  return               { label: 'Needs refinement',         state: 'warning' };
}

// ── Dominant causal driver → one-line human phrase ────────────────────────────
function driverPhrase(driver: string): string {
  switch (driver) {
    case 'angle':     return 'Your message direction drove performance';
    case 'creative':  return 'Your ad copy and hook drove performance';
    case 'vision':    return 'Your visual format drove performance';
    case 'evolution': return 'An improved variation drove performance';
    case 'noise':     return 'External factors played a role in this result';
    default:          return 'Creative execution drove performance';
  }
}

@Injectable()
export class ProductResponseContractService {

  // ── Domain transformers ────────────────────────────────────────────────────

  /**
   * Campaign overview — wraps outcome data + optional 9.4 insight.
   * performanceScore is read internally and NEVER forwarded.
   */
  fromCampaignOutcome(
    outcome: { performanceScore: number; angleSlug: string; campaignId: string; createdAt: Date } | null,
    insight: { headline: string; reason: string; suggestion: string; expectedImpact: string } | null,
    causalDriver?: string,
  ): ProductResponse {
    if (!outcome) return this.neutral('campaign_overview', 'No campaign data yet');

    const { label, metric, state } = perfLabel(outcome.performanceScore);
    const driverLine = causalDriver ? driverPhrase(causalDriver) : null;

    return {
      screen:          'campaign_overview',
      title:           insight?.headline ?? `${label} performance`,
      subtitle:        driverLine ?? insight?.reason ?? 'Performance summary ready',
      primaryMetric:   metric,
      secondaryMetric: insight?.expectedImpact ?? undefined,
      insight:         insight?.suggestion ?? undefined,
      cta:             state === 'success' ? 'Scale this campaign' : 'Improve this campaign',
      state,
      metadata: {
        hasInsight:   !!insight,
        campaignDate: outcome.createdAt.toISOString().slice(0, 10),
      },
    };
  }

  /**
   * Creative results — wraps a scored creative.
   * totalScore is read internally and NEVER forwarded.
   */
  fromCreativeScore(
    score:   { totalScore: number; creativeId: string; format: string; isWinner: boolean },
    label?:  string,
  ): ProductResponse {
    const { label: tierLabel, state } = scoreTierLabel(score.totalScore);
    const formatLabel = this.formatLabel(score.format);

    return {
      screen:        'creative_results',
      title:         score.isWinner ? `Best performing ${formatLabel}` : `${tierLabel} ${formatLabel}`,
      subtitle:      score.isWinner
        ? 'This creative outperformed all variations in this campaign'
        : `${tierLabel} — ${this.scoreSuggestion(score.totalScore)}`,
      primaryMetric: score.isWinner ? 'Top variation' : tierLabel,
      insight:       this.scoreSuggestion(score.totalScore),
      cta:           score.isWinner ? 'Use this creative' : 'Refine and retest',
      state,
      metadata: {
        format:    formatLabel,
        isWinner:  score.isWinner,
        variantId: score.creativeId.slice(-8),
      },
    };
  }

  /**
   * Angle selection panel — converts scored angles to product cards.
   * Confidence scores, weights, and slugs are NEVER forwarded.
   */
  fromAngleSelection(
    angles: { id: string; label: string; description?: string; rank: number; isTopPick: boolean }[],
    campaignGoal?: string,
  ): ProductListResponse {
    if (!angles.length) {
      return {
        screen:  'angle_selection',
        items:   [],
        summary: 'No angles available for this campaign type.',
        state:   'neutral',
      };
    }

    const items: ProductCard[] = angles.slice(0, 6).map((a, i) => ({
      id:          a.id,
      label:       a.label,
      description: a.description ?? this.defaultAngleDescription(i),
      tag:         a.isTopPick ? 'Recommended'
                   : i === 1   ? 'Strong choice'
                   : undefined,
      state:       a.isTopPick ? 'success' : 'neutral',
    }));

    return {
      screen:  'angle_selection',
      items,
      summary: campaignGoal
        ? `Best message directions for "${campaignGoal}"`
        : 'Top message directions for your campaign',
      state: 'success',
    };
  }

  /**
   * Insights panel — wraps 9.4 UserInsight directly.
   * UserInsight is already human-readable; this just standardises the envelope.
   */
  fromUserInsight(
    insight: { headline: string; reason: string; suggestion: string; expectedImpact: string; campaignId: string },
  ): ProductResponse {
    const state: ProductResponse['state'] =
      insight.headline.toLowerCase().includes('strong') ||
      insight.headline.toLowerCase().includes('exceptional') ||
      insight.headline.toLowerCase().includes('best') ||
      insight.headline.toLowerCase().includes('above')
        ? 'success'
        : insight.headline.toLowerCase().includes('under') ||
          insight.headline.toLowerCase().includes('low') ||
          insight.headline.toLowerCase().includes('traction') ||
          insight.headline.toLowerCase().includes("isn't")
        ? 'warning'
        : 'neutral';

    return {
      screen:          'insights_panel',
      title:           insight.headline,
      subtitle:        insight.reason,
      primaryMetric:   insight.expectedImpact,
      insight:         insight.suggestion,
      cta:             state === 'success' ? 'Scale this approach' : 'Apply this suggestion',
      state,
      metadata: {
        campaignId: insight.campaignId,
        hasData:    true,
      },
    };
  }

  /**
   * Dashboard — wraps system-level summary.
   * Emergence/ALC internals are NEVER forwarded.
   */
  fromDashboardSummary(data: {
    activeCampaigns:  number;
    avgPerformance:   number;
    topAngleLabel:    string;
    recentCampaigns:  number;
  }): ProductResponse {
    const { label, state } = perfLabel(data.avgPerformance);

    return {
      screen:          'dashboard',
      title:           'Your creative system is learning',
      subtitle:        `${data.activeCampaigns} active campaign${data.activeCampaigns !== 1 ? 's' : ''} · ${data.recentCampaigns} updated recently`,
      primaryMetric:   `Overall: ${label}`,
      secondaryMetric: `Best direction: ${data.topAngleLabel}`,
      insight:         this.dashboardInsight(data.avgPerformance, data.activeCampaigns),
      cta:             'View campaigns',
      state,
      metadata: {
        activeCampaigns: data.activeCampaigns,
        recentCampaigns: data.recentCampaigns,
      },
    };
  }

  // ── Sanitizer ──────────────────────────────────────────────────────────────
  // Strips FORBIDDEN_FIELDS from any object recursively.
  // Used by the interceptor to clean arbitrary engine responses.
  // Numbers are rounded to 1 decimal to avoid leaking precise engine values.

  sanitize<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data === 'number') return Math.round(data * 10) / 10 as unknown as T;
    if (typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(item => this.sanitize(item)) as unknown as T;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (FORBIDDEN_FIELDS.has(key)) continue;
      result[key] = this.sanitize(value);
    }
    return result as T;
  }

  // ── Fallbacks ──────────────────────────────────────────────────────────────

  neutral(screen: ScreenType, message = 'Loading...'): ProductResponse {
    return {
      screen,
      title:    message,
      subtitle: 'Data is being processed — check back shortly.',
      state:    'neutral',
      metadata: {},
    };
  }

  error(screen: ScreenType): ProductResponse {
    return {
      screen:   screen,
      title:    'Something went wrong',
      subtitle: 'We\'re working on it. Your campaigns are safe.',
      insight:  'Try refreshing the page or contact support if this persists.',
      state:    'warning',
      metadata: { isError: true },
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private formatLabel(format: string): string {
    switch (format.toLowerCase()) {
      case 'video':    return 'video';
      case 'carousel': return 'carousel';
      case 'banner':   return 'banner';
      default:         return 'creative';
    }
  }

  private scoreSuggestion(score: number): string {
    if (score >= 0.65) return 'Replicate this structure in your next campaign';
    if (score >= 0.50) return 'Small refinements to the hook could push this further';
    if (score >= 0.35) return 'Consider a stronger opening and clearer call-to-action';
    return 'A full creative refresh will likely improve results significantly';
  }

  private defaultAngleDescription(rank: number): string {
    const descriptions = [
      'Highly effective for driving engagement with your audience',
      'Consistently strong performance across similar campaigns',
      'Solid choice with good conversion potential',
      'Tested and reliable message direction',
      'Worth testing with your target audience',
      'Alternative direction to explore',
    ];
    return descriptions[rank] ?? 'Relevant message direction for your campaign';
  }

  private dashboardInsight(avgScore: number, campaigns: number): string {
    if (campaigns === 0) return 'Create your first campaign to start generating insights.';
    if (avgScore >= 0.28) return 'Your campaigns are performing well. Keep testing new variations to find your next winner.';
    if (avgScore >= 0.18) return 'Solid foundation. Focusing on hook quality across your campaigns could lift overall results.';
    return 'Your campaigns have room to improve. Try applying the suggestions on individual campaign insights.';
  }
}
