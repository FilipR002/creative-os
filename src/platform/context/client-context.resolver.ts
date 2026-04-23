import { Injectable, Optional } from '@nestjs/common';
import { PrismaService }        from '../../prisma/prisma.service';
import { ClientContext }        from './client-context.interface';

/** Header names read during resolution. */
const H_CLIENT_ID = 'x-client-id';
const H_PLAN      = 'x-plan';
const H_INDUSTRY  = 'x-industry';
const H_REGION    = 'x-region';

type Plan = ClientContext['plan'];
const VALID_PLANS = new Set<Plan>(['basic', 'pro', 'enterprise']);

@Injectable()
export class ClientContextResolver {
  constructor(
    @Optional() private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve ClientContext from an HTTP request object.
   * Reads x-client-id, x-plan, x-industry headers.
   * Falls back gracefully when headers are absent.
   */
  fromRequest(req: Record<string, unknown>): ClientContext {
    const headers = (req['headers'] ?? {}) as Record<string, string>;

    const clientId = headers[H_CLIENT_ID]?.trim() || 'anonymous';
    const rawPlan  = headers[H_PLAN]?.trim().toLowerCase();
    const plan: Plan = VALID_PLANS.has(rawPlan as Plan) ? (rawPlan as Plan) : 'basic';

    return {
      clientId,
      userId:   (req['context'] as Record<string, unknown> | undefined)?.['userId'] as string | undefined,
      plan,
      metadata: {
        industry: headers[H_INDUSTRY]?.trim() || 'general',
        region:   headers[H_REGION]?.trim()   || undefined,
      },
    };
  }

  /** Build from explicit values — used by internal services (not HTTP path). */
  fromValues(
    clientId:  string,
    plan:      Plan = 'basic',
    industry:  string = 'general',
    userId?:   string,
    campaignId?: string,
  ): ClientContext {
    return {
      clientId,
      userId,
      campaignId,
      plan,
      metadata: { industry },
    };
  }
}
