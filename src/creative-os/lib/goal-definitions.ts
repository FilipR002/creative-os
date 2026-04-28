// ─── Goal Definitions ─────────────────────────────────────────────────────────
// Each goal is a full campaign execution brief for Claude.
// Used in concept, carousel, banner, and video prompts.

export interface GoalDefinition {
  id:               string;
  name:             string;
  subtitle:         string;
  primary_objective: string;
  success_metrics:  string[];
  creative_direction: string;
  cta_style:        string;
  content_rules:    string[];
  tone:             string;
  not_this:         string;
}

export const GOAL_DEFINITIONS: GoalDefinition[] = [
  {
    id:       'awareness',
    name:     'Awareness',
    subtitle: 'Brand discovery and first impression',
    primary_objective: 'Introduce the brand, product, or idea to people who have never heard of it. The goal is not a sale — it is a memorable first contact. The audience should walk away knowing exactly what you do, who it is for, and why it matters. Awareness content succeeds when it is shared, saved, or sparks curiosity.',
    success_metrics: [
      'Reach and unique impressions',
      'Video completion rate (did they watch to the end?)',
      'Shares and saves',
      'Brand recall (would they remember this brand tomorrow?)',
    ],
    creative_direction: 'Lead with a bold, arresting opening that stops the scroll. Prioritize clarity over cleverness — the audience must instantly understand what this brand does. Use the brand\'s most distinctive visual and verbal identity. Do not assume any prior knowledge of the brand.',
    cta_style: 'Soft CTAs only: "Learn more", "Discover [brand]", "See what everyone is talking about". Never hard-sell CTAs like "Buy now" — they signal distrust to a cold audience.',
    content_rules: [
      'The brand name and what it does must be clear within the first 3 seconds or first 2 slides',
      'Never assume the audience knows the category — define it simply',
      'Prioritize visual distinctiveness — awareness is won through memorability, not information density',
      'One idea per ad — do not try to communicate everything about the brand in one creative',
      'End with the brand clearly visible and memorable, not a price or offer',
    ],
    tone: 'Confident, distinct, and memorable. The brand should feel like someone worth knowing. Avoid desperation or sales energy — this is an introduction, not a pitch.',
    not_this: 'Do NOT lead with an offer or price — awareness content is not a sales pitch. Do NOT pack in product features — awareness is about identity, not specification. Do NOT use a hard CTA — a cold audience that has never heard of the brand will not convert on first contact.',
  },
  {
    id:       'engagement',
    name:     'Engagement',
    subtitle: 'Interaction, reaction, and community building',
    primary_objective: 'Spark a response — a comment, a share, a save, a reaction, or an opinion. Engagement content is designed to make the audience want to participate, not just watch. It works by being relatable, polarizing, funny, or thought-provoking. The post becomes the context for a conversation.',
    success_metrics: [
      'Comments (volume and depth)',
      'Shares and saves',
      'Reactions and poll responses',
      'DMs and replies',
      'Stitch / duet / remix rate',
    ],
    creative_direction: 'Create content that demands a response. Ask a question, take a stance, show something relatable, or trigger an opinion. The best engagement content makes the audience think "I need to share this" or "I have to respond to this." Controversy within brand-safe limits outperforms neutral, balanced content.',
    cta_style: 'Conversation-first CTAs: "Tag someone who needs this", "Drop your [X] in the comments", "Would you try this?", "Which one are you?". Never transactional CTAs — the goal is dialogue, not a click.',
    content_rules: [
      'Ask one clear question or take one clear stance — do not hedge',
      'Make it relatable enough that the audience recognizes themselves in it',
      'Use formats that invite participation: polls, "this or that", unpopular opinions, "name a type"',
      'The hook must provoke — boredom kills engagement before it starts',
      'Leave space for the audience to add value with their comment — do not say everything',
    ],
    tone: 'Conversational, direct, and human. Drop the corporate voice entirely. Sound like a person who has an opinion, not a brand trying to seem likable.',
    not_this: 'Do NOT write engagement content that is secretly a sales post — audiences see through it instantly and punish it. Do NOT ask questions no one actually cares about ("What\'s your favorite color?"). Do NOT be neutral — bland content generates no engagement.',
  },
  {
    id:       'sales',
    name:     'Sales',
    subtitle: 'Direct response and conversion',
    primary_objective: 'Drive an immediate action: purchase, sign-up, booking, or trial start. Every element of this ad must move the audience closer to that decision. The audience may be warm (has seen the brand) or cold (retargeted, interest-targeted). The ad must resolve doubt, establish value, and make the next step frictionless.',
    success_metrics: [
      'Click-through rate to purchase page',
      'Conversion rate (purchase / sign-up completed)',
      'Cost per acquisition (CPA)',
      'Return on ad spend (ROAS)',
      'Add-to-cart rate',
    ],
    creative_direction: 'Lead with the strongest value signal — the best offer, the most credible result, or the most compelling reason to act now. Resolve the top objection before the audience raises it. Every slide must advance the decision. No wasted words, no atmospheric content, no brand storytelling — this is a closing argument.',
    cta_style: 'Hard, specific, action-forward CTAs: "Shop now", "Get [X]% off today", "Start your free trial", "Book your spot", "Claim the offer". The CTA must be specific about what happens next. Never vague.',
    content_rules: [
      'The offer must be stated clearly and early — do not bury the value proposition',
      'Address the single biggest objection the audience has (price, trust, relevance) before the CTA',
      'Include social proof or credibility signal — a number, a result, a recognizable name',
      'Every slide must contribute to the decision — cut anything that does not move the audience forward',
      'Urgency is powerful here when real — deadline, scarcity, or consequence of waiting',
    ],
    tone: 'Confident, direct, and momentum-building. The tone of someone who knows this product is right for the audience and is making a clear, honest case for it. No fluff, no hedging.',
    not_this: 'Do NOT write a beautiful brand piece with a "shop now" at the end — that is awareness content with a sales CTA bolted on. Do NOT list every feature — one compelling offer beats a feature inventory. Do NOT omit price or offer if it is the strongest reason to buy.',
  },
  {
    id:       'retention',
    name:     'Retention',
    subtitle: 'Re-engagement and loyalty building',
    primary_objective: 'Strengthen the relationship with existing customers or lapsed users. Retention content reminds them why they chose the brand, shows them value they are not using, celebrates their loyalty, or re-activates them if they have gone quiet. The audience already knows the brand — this content deepens the relationship rather than building it.',
    success_metrics: [
      'Repeat purchase rate',
      'Reactivation rate (lapsed users returning)',
      'Feature adoption (using a product capability they ignored)',
      'Loyalty program engagement',
      'Subscription renewal rate',
      'NPS or satisfaction signal',
    ],
    creative_direction: 'Speak to existing customers as insiders who already understand the value. Acknowledge their history with the brand when possible. Introduce new features, hidden value, tips for getting more out of the product, or exclusive rewards. This content should feel like hearing from a brand that actually knows you — not receiving another promotional blast.',
    cta_style: 'Value-add CTAs: "Unlock your [loyalty reward]", "You\'ve earned [X] — here\'s how to use it", "Discover what you\'re missing", "Continue where you left off", "Your next order is [X]% off". Frame the action as something they deserve, not something they owe.',
    content_rules: [
      'Acknowledge customer status — "As one of our [X] members" or "You\'ve been with us since [X]" creates belonging',
      'Introduce one piece of hidden or underused value — most customers use a fraction of what they paid for',
      'Do not sell them something new before reinforcing why what they have is valuable',
      'Celebrate milestones — purchase anniversaries, usage streaks, loyalty tier upgrades',
      'Re-engagement content must acknowledge the absence without blame: "We noticed you\'ve been quiet" not "Why haven\'t you ordered?"',
    ],
    tone: 'Warm, personal, and appreciative. Sounds like a brand that genuinely values the relationship. Not transactional, not desperate — the tone of a brand that would rather lose a sale than lose a customer\'s trust.',
    not_this: 'Do NOT send retention content that sounds identical to acquisition content — existing customers can tell and it signals you do not know them. Do NOT lead with a discount as the only retention tool — price-only retention trains customers to wait for sales. Do NOT ignore the existing relationship — retention content that feels cold or generic destroys loyalty rather than building it.',
  },
  {
    id:       'install',
    name:     'Install',
    subtitle: 'App download and first use activation',
    primary_objective: 'Drive installs of an app and, ideally, the first meaningful action inside it. Install ads must make the value instantly obvious, reduce the perceived barrier of downloading, and set accurate expectations about what the app does and what the experience will feel like. The audience is deciding in seconds whether this app belongs on their phone.',
    success_metrics: [
      'Install volume (downloads)',
      'Cost per install (CPI)',
      'Day-1 retention rate (did they return after downloading?)',
      'First action completion (onboarding, profile creation, first use)',
      'App store rating lift',
    ],
    creative_direction: 'Show the app, do not describe it. A 3-second in-app screen recording showing the core value beats 30 seconds of generic lifestyle footage. The audience needs to answer two questions instantly: "What does this do?" and "Will this work for me?". Remove every perceived barrier — address install anxiety (storage, privacy, complexity) before the CTA.',
    cta_style: 'App-specific CTAs: "Download free", "Get the app — it\'s free", "Install in seconds", "Try it free — no credit card". Always mention cost status (free to download or free trial) unless there is a compelling reason not to. The CTA must make the download decision feel effortless.',
    content_rules: [
      'Show the actual app UI within the first 2 seconds — lifestyle opens that hide the product underperform',
      'Name the single most compelling use case — not the full feature set',
      'Address install friction explicitly: "Free to download", "No sign-up needed to start", "30 seconds to set up"',
      'If the app requires a learning curve, show the experience as simple and guided',
      'Include a social signal where possible — "Rated 4.8 by [X] users" builds download confidence',
    ],
    tone: 'Clear, energetic, and frictionless. Sounds like an app that was designed to make something easier. No complexity, no technical language — the app solves a problem and this ad makes that obvious.',
    not_this: 'Do NOT run an install ad that does not show the app — brand lifestyle content does not drive installs. Do NOT bury the download CTA — every second of delay costs installs. Do NOT omit the cost signal — "Is this free?" is the first question every potential user has and if the ad does not answer it, most will not find out.',
  },
];

// ─── Lookup by id ─────────────────────────────────────────────────────────────

export function getGoalDefinition(id: string): GoalDefinition | undefined {
  return GOAL_DEFINITIONS.find(g => g.id === id);
}

// ─── Build a formatted prompt block for a specific goal ───────────────────────
// Injected into carousel / banner / concept system prompts.

export function buildGoalBlock(goalId: string | undefined | null): string {
  // Normalise legacy "conversion" → "sales"
  const normalised = goalId === 'conversion' ? 'sales' : goalId;

  if (!normalised || normalised === '') {
    const list = GOAL_DEFINITIONS.map(g => `- ${g.id}: ${g.name} — ${g.subtitle}`).join('\n');
    return `
CAMPAIGN GOAL — NOT SPECIFIED:
Infer the most appropriate goal from the brief. Choose from:
${list}
Apply all execution rules for the selected goal.
`.trim();
  }

  const def = getGoalDefinition(normalised);
  if (!def) return `CAMPAIGN GOAL: ${goalId}`;

  return `
CAMPAIGN GOAL: ${def.name} — ${def.subtitle}

PRIMARY OBJECTIVE:
${def.primary_objective}

SUCCESS METRICS (optimise creative decisions toward these):
${def.success_metrics.map(m => `• ${m}`).join('\n')}

CREATIVE DIRECTION:
${def.creative_direction}

CTA STYLE:
${def.cta_style}

CONTENT RULES (follow all of these):
${def.content_rules.map(r => `• ${r}`).join('\n')}

TONE:
${def.tone}

DO NOT DO THIS:
${def.not_this}
`.trim();
}
