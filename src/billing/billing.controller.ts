import {
  Controller,
  Post,
  Req,
  RawBodyRequest,
  Logger,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService }         from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require('stripe');
import { RevenueLogService }     from './revenue-log.service';
import { SubscriptionService }   from './subscription.service';

// Use any-typed Stripe to avoid namespace conflicts with older @types/stripe
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeEvent    = any;

/**
 * BillingController
 *
 * POST /api/billing/stripe-webhook  — receives Stripe events (no auth guard —
 *   signature verified via STRIPE_WEBHOOK_SECRET instead).
 *
 * Only payment_intent.succeeded and invoice.paid are recorded as revenue.
 * All other event types are acknowledged (200) but not stored.
 */
@ApiTags('Billing')
@Controller('api/billing')
export class BillingController {
  private readonly logger  = new Logger(BillingController.name);
  private readonly stripe?: StripeInstance;
  private readonly webhookSecret?: string;

  constructor(
    private readonly revenue: RevenueLogService,
    private readonly subs:   SubscriptionService,
    private readonly config:  ConfigService,
  ) {
    const sk = this.config.get<string>('STRIPE_SECRET_KEY');
    if (sk) {
      // StripeLib may be default export or class depending on version
      const StripeClass   = StripeLib.default ?? StripeLib;
      this.stripe         = new StripeClass(sk);
      this.webhookSecret  = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    } else {
      this.logger.warn('[Billing] STRIPE_SECRET_KEY not set — webhook handler inactive.');
    }
  }

  @Post('stripe-webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook endpoint (signature-verified)' })
  async handleStripeWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    if (!this.stripe || !this.webhookSecret) {
      // Stripe not configured — ack silently to avoid Stripe retries
      return { received: true };
    }

    const headers = req.headers as unknown as Record<string, string>;
    const sig     = headers['stripe-signature'];
    if (!sig) throw new BadRequestException('Missing stripe-signature header');

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody as Buffer,
        sig,
        this.webhookSecret,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Billing] Webhook signature verification failed: ${msg}`);
      throw new BadRequestException(`Webhook Error: ${msg}`);
    }

    await this.processEvent(event);
    return { received: true };
  }

  private async processEvent(event: StripeEvent): Promise<void> {
    try {

      // ── Checkout completed: subscription activation or top-up ─────────────
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId  = session.metadata?.userId as string | undefined;

        if (!userId) {
          this.logger.warn('[Billing] checkout.session.completed missing userId in metadata');
        } else if (session.mode === 'subscription') {
          // Subscription checkout — activate plan
          const plan         = session.metadata?.plan as string ?? 'starter';
          const subId        = typeof session.subscription === 'string' ? session.subscription : '';
          const customerId   = typeof session.customer     === 'string' ? session.customer     : '';
          await this.subs.activatePlan(userId, plan, subId, customerId);
          this.logger.log(`[Billing] Plan activated via checkout — userId=${userId} plan=${plan}`);
        } else if (session.mode === 'payment' && session.metadata?.type === 'topup') {
          // Top-up payment — credit tokens
          const packageKey = session.metadata?.package as string ?? 'topup_100';
          const piId       = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;
          await this.subs.applyTopup(userId, packageKey, piId);
          this.logger.log(`[Billing] Top-up applied via checkout — userId=${userId} pkg=${packageKey}`);
        }
      }

      // ── Invoice paid: subscription renewal (monthly cycle) ───────────────
      if (event.type === 'invoice.paid') {
        const inv = event.data.object;

        await this.revenue.record({
          stripeEventId:    event.id,
          stripeCustomerId: typeof inv.customer === 'string' ? inv.customer : undefined,
          eventType:        event.type,
          amountUsd:        (inv.amount_paid ?? 0) / 100,
          currency:         inv.currency ?? 'usd',
          metadata:         { subscriptionId: inv.subscription ?? null },
        });
        this.logger.log(`[Billing] invoice.paid — $${((inv.amount_paid ?? 0) / 100).toFixed(2)}`);

        // Renew monthly tokens for subscription_cycle invoices
        if (inv.billing_reason === 'subscription_cycle') {
          // Pull userId from subscription metadata (set when plan was activated)
          const subMeta = inv.subscription_details?.metadata as Record<string, string> | undefined;
          const userId  = subMeta?.userId;
          const plan    = subMeta?.plan as string | undefined;

          if (userId && plan) {
            await this.subs.renewCycle(userId, plan);
            this.logger.log(`[Billing] Monthly renewal — userId=${userId} plan=${plan}`);
          } else {
            this.logger.warn('[Billing] invoice.paid subscription_cycle: missing userId or plan in subscription metadata');
          }
        }
      }

      // ── payment_intent.succeeded: log revenue for non-invoice payments ────
      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        await this.revenue.record({
          stripeEventId:    event.id,
          stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : undefined,
          eventType:        event.type,
          amountUsd:        (pi.amount_received ?? 0) / 100,
          currency:         pi.currency ?? 'usd',
          metadata:         pi.metadata ?? {},
        });
        this.logger.log(`[Billing] payment_intent.succeeded — $${((pi.amount_received ?? 0) / 100).toFixed(2)}`);
      }

    } catch (err) {
      this.logger.error(`[Billing] processEvent failed: ${err}`);
    }
  }
}
