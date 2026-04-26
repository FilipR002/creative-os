import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Logger,
  HttpCode,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { ConfigService }                  from '@nestjs/config';
import { SubscriptionService }            from './subscription.service';
import { TOPUP_PACKAGES, PLAN_TOKENS }    from './tokens.constants';
import { Public }                         from '../common/decorators/public.decorator';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require('stripe');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeInstance = any;

interface RequestWithUser extends Request {
  context?: { userId?: string };
}

/**
 * UserBillingController
 *
 * All user-facing billing endpoints.
 *   GET  /api/billing/status          — current plan + token balance
 *   GET  /api/billing/costs           — token cost table (public info)
 *   POST /api/billing/checkout        — create Stripe checkout session
 *   POST /api/billing/topup           — direct top-up (for testing / manual)
 *   GET  /api/billing/history         — recent token transactions
 *   POST /api/billing/stripe-webhook  — (handled in BillingController)
 */
@ApiTags('User Billing')
@Controller('api/billing')
export class UserBillingController {
  private readonly logger = new Logger(UserBillingController.name);
  private readonly stripe?: StripeInstance;

  constructor(
    private readonly subs:   SubscriptionService,
    private readonly config: ConfigService,
  ) {
    const sk = this.config.get<string>('STRIPE_SECRET_KEY');
    if (sk) {
      const StripeClass = StripeLib.default ?? StripeLib;
      this.stripe = new StripeClass(sk);
    }
  }

  // ─── GET /api/billing/status ─────────────────────────────────────────────

  @Get('status')
  @ApiOperation({ summary: 'Current subscription plan + token balance' })
  async getStatus(@Req() req: RequestWithUser) {
    const userId = req.context?.userId;
    if (!userId) throw new BadRequestException('Authentication required');
    return this.subs.getStatus(userId);
  }

  // ─── GET /api/billing/costs ──────────────────────────────────────────────

  @Get('costs')
  @Public()
  @ApiOperation({ summary: 'Token cost table — video/carousel/banner + plans + packages' })
  getCosts() {
    return this.subs.getTokenCosts();
  }

  // ─── GET /api/billing/history ────────────────────────────────────────────

  @Get('history')
  @ApiOperation({ summary: 'Recent token transactions for the current user' })
  async getHistory(@Req() req: RequestWithUser) {
    const userId = req.context?.userId;
    if (!userId) throw new BadRequestException('Authentication required');
    return this.subs.getTransactions(userId);
  }

  // ─── POST /api/billing/checkout ─────────────────────────────────────────
  // Creates a Stripe Checkout Session for a subscription or top-up.
  // Returns { url } — frontend redirects there.

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe checkout session for plan or top-up' })
  @ApiBody({ schema: { properties: { type: { type: 'string' }, plan: { type: 'string' }, package: { type: 'string' }, successUrl: { type: 'string' }, cancelUrl: { type: 'string' } } } })
  async createCheckout(
    @Req() req: RequestWithUser,
    @Body() body: { type: 'subscription' | 'topup'; plan?: string; package?: string; successUrl: string; cancelUrl: string },
  ) {
    const userId = req.context?.userId;
    if (!userId) throw new BadRequestException('Authentication required');

    if (!this.stripe) {
      // Stripe not configured — return mock URL for dev
      this.logger.warn('[Billing] Stripe not configured — returning mock checkout URL');
      return { url: `${body.cancelUrl}?stripe_not_configured=1`, mock: true };
    }

    const status = await this.subs.getStatus(userId);
    const customerId = status.stripeCustomerId;

    if (body.type === 'subscription') {
      const planKey = body.plan ?? 'starter';
      const priceId = this.config.get<string>(`STRIPE_PRICE_${planKey.toUpperCase()}`);
      if (!priceId) {
        throw new BadRequestException(`STRIPE_PRICE_${planKey.toUpperCase()} env var not set`);
      }

      const session = await this.stripe.checkout.sessions.create({
        mode:              'subscription',
        payment_method_types: ['card'],
        customer:          customerId ?? undefined,
        line_items:        [{ price: priceId, quantity: 1 }],
        success_url:       `${body.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:        body.cancelUrl,
        metadata:          { userId, plan: planKey },
        subscription_data: { metadata: { userId, plan: planKey } },
      });

      this.logger.log(`[Billing] Checkout session created for ${planKey} — userId=${userId}`);
      return { url: session.url, sessionId: session.id };
    }

    if (body.type === 'topup') {
      const pkg = TOPUP_PACKAGES[body.package ?? 'topup_100'];
      if (!pkg) throw new BadRequestException(`Unknown top-up package: ${body.package}`);

      const session = await this.stripe.checkout.sessions.create({
        mode:              'payment',
        payment_method_types: ['card'],
        customer:          customerId ?? undefined,
        line_items:        [{
          price_data: {
            currency:     'usd',
            unit_amount:  pkg.priceCents,
            product_data: { name: `Creative OS — ${pkg.label}` },
          },
          quantity: 1,
        }],
        success_url: `${body.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  body.cancelUrl,
        metadata:    { userId, type: 'topup', package: body.package ?? 'topup_100', tokens: String(pkg.tokens) },
      });

      this.logger.log(`[Billing] Top-up checkout created — ${pkg.label} — userId=${userId}`);
      return { url: session.url, sessionId: session.id };
    }

    throw new BadRequestException('type must be "subscription" or "topup"');
  }

  // ─── POST /api/billing/topup (direct, for testing) ───────────────────────

  @Post('topup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply a token top-up directly (dev/test — no Stripe payment)' })
  @ApiBody({ schema: { properties: { package: { type: 'string', example: 'topup_100' } } } })
  async directTopup(
    @Req()  req:  RequestWithUser,
    @Body() body: { package: string },
  ) {
    const userId = req.context?.userId;
    if (!userId) throw new BadRequestException('Authentication required');
    if (!body.package) throw new BadRequestException('package is required');
    return this.subs.applyTopup(userId, body.package);
  }
}
