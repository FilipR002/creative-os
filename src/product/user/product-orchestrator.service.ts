// ─── Phase 7 — Product Orchestrator Service ──────────────────────────────────
// THE ABSTRACTION WALL.
// Translates user intent → engine input → ProductOutput.
// Nothing from the engine leaks past this service.

import { Injectable } from '@nestjs/common';
import { OrchestratorService } from '../../orchestrator/orchestrator.service';
import type { ExplainedBundle }   from '../../orchestrator/execution/execution.types';
import type { OrchestratorDecision } from '../../orchestrator/orchestrator.types';
import type { DecideInput }       from '../../orchestrator/orchestrator.types';
import { ProductOutput, ProductProject } from './product.types';

@Injectable()
export class ProductOrchestratorService {
  constructor(private readonly orchestrator: OrchestratorService) {}

  async generate(
    project:  ProductProject,
    emotion?: string,
    format?:  string,
  ): Promise<ProductOutput> {
    const input: DecideInput = {
      client_id: project.clientId,
      goal:      project.goal || undefined,
      emotion:   emotion || undefined,
      format:    format  || undefined,
    };

    const execution = await this.orchestrator.executeDecision(input);

    if (!execution.decision || !execution.bundles?.length) {
      return this.emptyOutput(project);
    }

    return this.mapToProductOutput(execution.decision, execution.bundles, project);
  }

  // ── Mapping ───────────────────────────────────────────────────────────────
  // All engine internals are consumed and discarded here.

  private mapToProductOutput(
    decision: OrchestratorDecision,
    bundles:  ExplainedBundle[],
    project:  ProductProject,
  ): ProductOutput {
    const primary = bundles.find(b => b.slug === decision.primary_angle);

    const alternatives = bundles
      .filter(b => b.slug !== decision.primary_angle && b.fatigueLevel !== 'BLOCKED')
      .sort((a, b) => b.finalWeight - a.finalWeight)
      .slice(0, 3)
      .map(b => this.toLabel(b.slug));

    return {
      title:                 this.toLabel(decision.primary_angle),
      primaryRecommendation: this.buildRecommendation(decision.primary_angle, primary, project),
      alternatives,
      explanation:           this.buildExplanation(primary, decision),
      confidence:            Math.round((primary?.finalWeight ?? 0.5) * 100),
      category:              this.inferCategory(decision.primary_angle, project.goal),
    };
  }

  // ── Copy builders — no signals, no math, no internal terminology ──────────

  private buildRecommendation(
    slug:    string,
    bundle:  ExplainedBundle | undefined,
    project: ProductProject,
  ): string {
    const label     = this.toLabel(slug);
    const goalPart  = project.goal ? ` for your "${project.goal}" goal` : '';
    const perfPart  = (bundle?.sampleCount ?? 0) >= 5
      ? 'backed by strong historical performance'
      : 'identified as your strongest opportunity right now';
    return `Lead with "${label}"${goalPart} — ${perfPart}.`;
  }

  private buildExplanation(
    bundle:   ExplainedBundle | undefined,
    decision: OrchestratorDecision,
  ): string {
    if (!bundle) {
      return 'Our AI analyzed your creative patterns and market signals to find the strongest approach for your goal.';
    }

    const reasons: string[] = [];

    if (bundle.memoryScore >= 0.65)      reasons.push('this approach has a proven track record in your account');
    if (bundle.explorationFactor >= 0.60) reasons.push("it's fresh for your audience and avoids fatigue");
    if (bundle.sampleCount < 5)          reasons.push("this is an emerging opportunity — ideal for testing");
    if (decision.system_stability_state === 'stable') reasons.push('your account data is stable and reliable');

    if (!reasons.length) {
      return 'Our AI balanced your account history, audience freshness, and performance signals to select this as your best option.';
    }

    return `We recommend this because ${reasons.slice(0, 2).join(' and ')}.`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toLabel(slug: string): string {
    return slug
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private inferCategory(slug: string, goal: string): string {
    const g = (goal ?? '').toLowerCase();
    if (g.includes('awareness') || g.includes('brand'))   return 'Brand Awareness';
    if (g.includes('convert')   || g.includes('sale'))    return 'Conversion';
    if (g.includes('retarget')  || g.includes('retain'))  return 'Retention';
    if (g.includes('engag'))                              return 'Engagement';

    const s = slug.toLowerCase();
    if (s.includes('social') || s.includes('proof'))      return 'Social Proof';
    if (s.includes('emotion') || s.includes('story'))     return 'Emotional';
    if (s.includes('benefit') || s.includes('value'))     return 'Value Prop';
    return 'Creative Strategy';
  }

  private emptyOutput(project: ProductProject): ProductOutput {
    return {
      title:                 'Getting Started',
      primaryRecommendation: 'Add more creative history to your account to get personalized AI recommendations.',
      alternatives:          [],
      explanation:           'We need more data from your account to make confident recommendations. Run a few campaigns first.',
      confidence:            0,
      category:              project.goal ? this.inferCategory('', project.goal) : 'General',
    };
  }
}
