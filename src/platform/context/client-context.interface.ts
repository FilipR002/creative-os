export interface ClientContext {
  clientId:   string;
  userId?:    string;
  campaignId?: string;

  plan: 'basic' | 'pro' | 'enterprise';

  metadata: {
    industry:  string;
    region?:   string;
    timezone?: string;
  };
}

/** Narrow subset accepted by Phase 4 APIs that predates Phase 5. */
export interface Phase4CompatContext {
  client_id?:  string;
  user_id?:    string;
  campaign_id?: string;
  industry?:   string;
}

/** Convert a raw Phase 4 input into a ClientContext (best-effort; plan defaults to 'basic'). */
export function fromPhase4Input(input: Phase4CompatContext): ClientContext {
  return {
    clientId:    input.client_id   ?? 'anonymous',
    userId:      input.user_id     ?? undefined,
    campaignId:  input.campaign_id ?? undefined,
    plan:        'basic',
    metadata: {
      industry:  input.industry ?? 'general',
    },
  };
}
