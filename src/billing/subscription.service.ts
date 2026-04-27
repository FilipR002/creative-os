import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_TOKENS, TOKEN_COST, TOPUP_PACKAGES } from './tokens.constants';
import type { SubscriptionPlan } from '@prisma/client';

export interface BillingStatus {
  plan:             string;
  tokensRemaining:  number;
  tokensMonthlyLimit: number;
  billingCycleEnd:  string;
  isTrialActive:    boolean;
  trialExpiresAt?:  string;
  stripeCustomerId?: string;
}

export interface TokenCheckResult {
  allowed:   boolean;
  remaining: number;
  required:  number;
  reason?:   string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Get or create subscription (called on first generation or login) ────────
  async getOrCreate(userId: string): Promise<BillingStatus> {
    let sub = await this.prisma.subscription.findUnique({ where: { userId } });

    if (!sub) {
      const now        = new Date();
      const trialEnd   = new Date(now.getTime() + 7 * 86_400_000); // 7 days
      const cycleEnd   = trialEnd;

      sub = await this.prisma.subscription.create({
        data: {
          userId,
          plan:              'trial' as SubscriptionPlan,
          tokensRemaining:   PLAN_TOKENS['trial'],
          tokensMonthlyLimit: PLAN_TOKENS['trial'],
          billingCycleStart: now,
          billingCycleEnd:   cycleEnd,
          isTrialActive:     true,
          trialExpiresAt:    trialEnd,
        },
      });

      // Log the trial grant
      await this.logTransaction(userId, sub.id, 'trial_grant', PLAN_TOKENS['trial'], PLAN_TOKENS['trial'], undefined, undefined, 'Trial started');
      this.logger.log(`[Subscription] Created trial for userId=${userId} — ${PLAN_TOKENS['trial']} tokens`);
    }

    return this.toStatus(sub);
  }

  // ── Status endpoint ─────────────────────────────────────────────────────────
  async getStatus(userId: string): Promise<BillingStatus> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return this.getOrCreate(userId);
    return this.toStatus(sub);
  }

  // ── Admin bypass — user IDs listed in ADMIN_USER_IDS skip all token gates ──
  private isAdmin(userId: string): boolean {
    const raw = process.env.ADMIN_USER_IDS ?? '';
    if (!raw.trim()) return false;
    return raw.split(',').map(s => s.trim()).includes(userId);
  }

  // ── Token check — call BEFORE execution ─────────────────────────────────────
  async checkTokens(userId: string, format: string): Promise<TokenCheckResult> {
    const required = TOKEN_COST[format] ?? 5;

    // Admins always pass — no token cost
    if (this.isAdmin(userId)) {
      this.logger.log(`[Tokens] Admin bypass for userId=${userId} format=${format}`);
      return { allowed: true, remaining: 999999, required };
    }

    const sub      = await this.prisma.subscription.findUnique({ where: { userId } });

    if (!sub) {
      // Auto-create trial
      await this.getOrCreate(userId);
      return { allowed: true, remaining: PLAN_TOKENS['trial'], required };
    }

    // Check trial expiry
    if (sub.isTrialActive && sub.trialExpiresAt && sub.trialExpiresAt < new Date()) {
      await this.prisma.subscription.update({
        where: { userId },
        data:  { isTrialActive: false, tokensRemaining: 0 },
      });
      return { allowed: false, remaining: 0, required, reason: 'TRIAL_EXPIRED' };
    }

    // Check billing cycle — if past end, auto-reset for paid plans
    if (sub.billingCycleEnd < new Date() && sub.plan !== 'trial' as SubscriptionPlan) {
      await this.renewCycle(userId, sub.plan as string, sub.id);
      const refreshed = await this.prisma.subscription.findUnique({ where: { userId } });
      const remaining = refreshed?.tokensRemaining ?? 0;
      if (remaining < required) {
        return { allowed: false, remaining, required, reason: 'INSUFFICIENT_TOKENS' };
      }
      return { allowed: true, remaining, required };
    }

    if (sub.tokensRemaining < required) {
      return { allowed: false, remaining: sub.tokensRemaining, required, reason: 'INSUFFICIENT_TOKENS' };
    }

    return { allowed: true, remaining: sub.tokensRemaining, required };
  }

  // ── Deduct tokens — call ONLY AFTER successful execution ───────────────────
  async deductTokens(userId: string, format: string, campaignId?: string): Promise<void> {
    // Admins are never charged
    if (this.isAdmin(userId)) return;

    const cost = TOKEN_COST[format] ?? 5;

    const sub = await this.prisma.subscription.update({
      where: { userId },
      data:  { tokensRemaining: { decrement: cost } },
    });

    await this.logTransaction(userId, sub.id, 'usage', -cost, sub.tokensRemaining, format, campaignId);
    this.logger.log(`[Tokens] Deducted ${cost} for ${format} — userId=${userId} remaining=${sub.tokensRemaining}`);
  }

  // ── Top-up ─────────────────────────────────────────────────────────────────
  async applyTopup(userId: string, packageKey: string, stripePaymentId?: string): Promise<BillingStatus> {
    const pkg = TOPUP_PACKAGES[packageKey];
    if (!pkg) throw new Error(`Unknown top-up package: ${packageKey}`);

    const sub = await this.prisma.subscription.update({
      where: { userId },
      data:  { tokensRemaining: { increment: pkg.tokens } },
    });

    await this.logTransaction(userId, sub.id, 'topup', pkg.tokens, sub.tokensRemaining, undefined, undefined, pkg.label, stripePaymentId);
    this.logger.log(`[Tokens] Top-up ${pkg.tokens} applied — userId=${userId} new balance=${sub.tokensRemaining}`);
    return this.toStatus(sub);
  }

  // ── Plan upgrade (called from Stripe webhook) ──────────────────────────────
  async activatePlan(
    userId:              string,
    plan:                string,
    stripeSubscriptionId: string,
    stripeCustomerId:    string,
  ): Promise<void> {
    const tokens  = PLAN_TOKENS[plan] ?? PLAN_TOKENS['starter'];
    const now     = new Date();
    const cycleEnd = new Date(now.getTime() + 30 * 86_400_000);

    const sub = await this.prisma.subscription.upsert({
      where:  { userId },
      update: {
        plan:                plan as SubscriptionPlan,
        tokensRemaining:     tokens,
        tokensMonthlyLimit:  tokens,
        billingCycleStart:   now,
        billingCycleEnd:     cycleEnd,
        stripeSubscriptionId,
        stripeCustomerId,
        isTrialActive:       false,
      },
      create: {
        userId,
        plan:                plan as SubscriptionPlan,
        tokensRemaining:     tokens,
        tokensMonthlyLimit:  tokens,
        billingCycleStart:   now,
        billingCycleEnd:     cycleEnd,
        stripeSubscriptionId,
        stripeCustomerId,
        isTrialActive:       false,
      },
    });

    await this.logTransaction(userId, sub.id, 'reset', tokens, tokens, undefined, undefined, `Plan activated: ${plan}`);
    this.logger.log(`[Subscription] Plan ${plan} activated — userId=${userId} tokens=${tokens}`);
  }

  // ── Monthly renewal (called from Stripe invoice.paid webhook) ──────────────
  async renewCycle(userId: string, plan: string, subId?: string): Promise<void> {
    const tokens  = PLAN_TOKENS[plan] ?? PLAN_TOKENS['starter'];
    const now     = new Date();
    const cycleEnd = new Date(now.getTime() + 30 * 86_400_000);

    const sub = await this.prisma.subscription.update({
      where: { userId },
      data: {
        tokensRemaining:    tokens,
        tokensMonthlyLimit: tokens,
        billingCycleStart:  now,
        billingCycleEnd:    cycleEnd,
      },
    });

    await this.logTransaction(userId, subId ?? sub.id, 'reset', tokens, tokens, undefined, undefined, `Monthly renewal: ${plan}`);
    this.logger.log(`[Subscription] Renewed ${plan} — userId=${userId} tokens=${tokens}`);
  }

  // ── Recent usage history ───────────────────────────────────────────────────
  async getTransactions(userId: string, limit = 20) {
    return this.prisma.tokenTransaction.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  // ── Token cost table (public info) ─────────────────────────────────────────
  getTokenCosts() {
    return {
      costs:    TOKEN_COST,
      plans:    PLAN_TOKENS,
      packages: TOPUP_PACKAGES,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toStatus(sub: {
    plan: string; tokensRemaining: number; tokensMonthlyLimit: number;
    billingCycleEnd: Date; isTrialActive: boolean; trialExpiresAt: Date | null;
    stripeCustomerId: string | null;
  }): BillingStatus {
    return {
      plan:               sub.plan,
      tokensRemaining:    sub.tokensRemaining,
      tokensMonthlyLimit: sub.tokensMonthlyLimit,
      billingCycleEnd:    sub.billingCycleEnd.toISOString(),
      isTrialActive:      sub.isTrialActive,
      trialExpiresAt:     sub.trialExpiresAt?.toISOString(),
      stripeCustomerId:   sub.stripeCustomerId ?? undefined,
    };
  }

  private async logTransaction(
    userId:          string,
    subscriptionId:  string,
    type:            string,
    amount:          number,
    balanceAfter:    number,
    format?:         string,
    campaignId?:     string,
    description?:    string,
    stripePaymentId?: string,
  ): Promise<void> {
    await this.prisma.tokenTransaction.create({
      data: {
        userId,
        subscriptionId,
        type,
        amount,
        balanceAfter,
        format:         format ?? null,
        campaignId:     campaignId ?? null,
        description:    description ?? null,
        stripePaymentId: stripePaymentId ?? null,
      },
    }).catch(err => this.logger.warn(`[TokenLog] Failed: ${err?.message}`));
  }
}
