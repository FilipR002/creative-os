// ─── Angle Definitions ────────────────────────────────────────────────────────
// Each angle is a full creative execution brief for Claude.
// Used in concept, carousel, banner, and video prompts.

export interface AngleDefinition {
  id:               string;
  name:             string;
  subtitle:         string;
  strategy:         string;
  tone:             string;
  hooks:            string[];
  slide_structure:  string[];
  copy_rules:       string[];
  differentiate_from: string;
  not_this:         string;
}

export const ANGLE_DEFINITIONS: AngleDefinition[] = [
  {
    id:       'urgency',
    name:     'Urgency',
    subtitle: 'Fear of missing out / time pressure',
    strategy: 'Force the audience to act now by making the cost of inaction concrete and immediate. Every element must answer: why does waiting make things worse? Urgency only works when the reason is specific and believable — never manufactured. It can be time-based (deadline), scarcity-based (limited supply), or consequence-based (the problem compounds the longer they wait).',
    tone:     'Direct, pressured, decisive. Short sentences. No softeners, no hedges, no fluff. Every word either raises the stakes or drives to the CTA.',
    hooks: [
      'If you keep waiting, [specific negative consequence that compounds over time].',
      'This closes [specific deadline]. After that, [what they lose].',
      '[Scarcity signal] left. Once they\'re gone, [consequence].',
    ],
    slide_structure: [
      'Identify the pain that gets worse with inaction',
      'Name the specific cost of waiting (money, time, outcome)',
      'Introduce the deadline or scarcity with a concrete reason',
      'Present the solution as the immediate exit from the problem',
      'CTA with deadline reinforced',
    ],
    copy_rules: [
      'Always give a reason for the urgency — never say "limited time" without explaining why',
      'Use: now, before, today, last chance, closing soon, don\'t wait, after [date] this is gone',
      'Never be vague — "3 spots left" beats "limited availability"',
      'The CTA must echo the urgency — "Get access before it closes" not just "Sign up"',
      'Avoid false urgency — if it resets every day, audiences learn to ignore it',
    ],
    differentiate_from: 'Unlike Emotional, this angle leads with consequence not feeling. Unlike Price-focused, it leads with a deadline not value math. If there is no real time pressure or scarcity, use a different angle.',
    not_this: 'Do NOT write: "Hurry, this deal won\'t last long!" — too vague. Do NOT manufacture fake countdowns with no real cutoff. Do NOT use urgency as a wrapper for a feature list.',
  },
  {
    id:       'emotional',
    name:     'Emotional',
    subtitle: 'Feeling-first transformation',
    strategy: 'Lead entirely with emotion, not product features. The audience buys the feeling they will gain or the pain they will escape — the product is simply the bridge. This angle works by making the audience feel deeply understood before they hear a single claim. Start with an emotional moment they recognize from their own life, validate it, then show the transformation the product enables.',
    tone:     'Warm, human, vulnerable. Conversational — like a close friend talking, not a brand. Use "you" constantly. Avoid clinical language, stats, or specs entirely.',
    hooks: [
      'You deserve to finally feel [specific positive emotion they\'ve been denied].',
      'Remember the last time [relatable painful moment]? You don\'t have to keep feeling that.',
      'That feeling when [emotional low point] — we built this for exactly that moment.',
    ],
    slide_structure: [
      'Open with a specific emotional pain moment the audience recognizes',
      'Validate it — make them feel understood, not judged',
      'Introduce hope — the transformation is possible',
      'Product as the bridge, framed by feeling not features',
      'Paint the emotional outcome — what life feels like after',
    ],
    copy_rules: [
      'Use: feel, imagine, finally, deserve, tired of, you\'re not alone, what if',
      'Always paint a before AND after — both must be emotional, not functional',
      'Never lead with specs, price, or feature lists — those kill emotional momentum',
      'Target one specific emotion per ad — don\'t blend hope + pride + relief in the same creative',
      'The CTA should be emotionally framed — "Start feeling better" not "Buy now"',
    ],
    differentiate_from: 'Unlike Pain Point, this angle validates and heals rather than agitates. Unlike Storytelling, it stays in second person ("you") and doesn\'t follow a character arc. If the audience is primarily rational buyers or B2B decision-makers, this angle underperforms.',
    not_this: 'Do NOT write a list of product features with emotional adjectives attached. Do NOT use generic emotions like "happy" — be specific: "proud of yourself again", "not dreading Mondays". Do NOT end with a transactional CTA like "Shop now".',
  },
  {
    id:       'premium',
    name:     'Premium',
    subtitle: 'Exclusivity and elevated quality',
    strategy: 'Signal that this product is not for everyone — and that choosing it says something about who you are. Premium is built on restraint, confidence, and aspiration. It never shouts, never discounts, and never lists features competitively. Quality is implied through how the ad is written, not explained. The audience should feel they are being let in on something, not sold at.',
    tone:     'Understated, confident, elevated. Short declarative sentences. Never defensive. Never comparative. Never enthusiastic in a way that feels commercial.',
    hooks: [
      'Not for everyone. But if you know, you know.',
      'This is what [desired outcome] actually looks like.',
      'Most people never experience [aspiration]. This is for the ones who want to.',
    ],
    slide_structure: [
      'Open with an aspirational statement that signals a world the audience wants to belong to',
      'Establish quality proof — subtle and specific, never superlative',
      'Exclusivity signal — who this is for (and implicitly, who it isn\'t)',
      'One defining product truth, stated simply',
      'CTA that feels like an invitation, not a push',
    ],
    copy_rules: [
      'Use: crafted, selected, for those who, built for, designed with, rare, exceptional',
      'Never use: cheap, free, discount, deal, affordable, best value, save money',
      'Sentences should be short. Restraint is the signal. White space does the selling.',
      'Proof must be specific and qualitative — not "4.9 stars" but "hand-tested by [expert]"',
      'The CTA is an invitation — "Join the waitlist", "Explore the collection", never "Buy now"',
    ],
    differentiate_from: 'Unlike Social Proof, this angle never relies on crowd validation — premium products are not defined by how many people use them. Unlike Price-focused, it never mentions cost or value math. If your product\'s core value is affordability, this angle will misrepresent it.',
    not_this: 'Do NOT write enthusiastically about features — enthusiasm reads as desperation at the premium tier. Do NOT use customer review language or testimonial framing. Do NOT put a price or comparison anywhere in this angle.',
  },
  {
    id:       'price_focused',
    name:     'Price-focused',
    subtitle: 'Value math and cost anchoring',
    strategy: 'Make the financial decision undeniable. This angle wins by anchoring the audience against what they are already spending — on a competing solution, on the problem itself, or on doing nothing. The goal is to make NOT buying feel like the expensive choice. Always show the math explicitly. The audience should be able to calculate the value in their head before the CTA.',
    tone:     'Bold, no-nonsense, straight shooter. Confident but never aggressive. Numbers-first. The product doesn\'t need dressing up — the math does the work.',
    hooks: [
      '[Competitor/current solution price] vs [your price] for [same or better outcome].',
      'Stop paying [X amount] for [inferior thing] when [your product] costs [fraction].',
      'This pays for itself in [specific short timeframe]. Here\'s the math.',
    ],
    slide_structure: [
      'Open with the price anchor — what the audience currently pays or the cost of the problem',
      'Make the cost of the problem tangible (money lost, time wasted, outcome missed)',
      'Introduce your price in context of what they\'re already spending',
      'Show the value proof — ROI, time saved, specific result',
      'CTA framed around the decision being a financial no-brainer',
    ],
    copy_rules: [
      'Always show the math — never let the audience do the calculation themselves',
      'Use: save $X, for less than [relatable daily expense], pays for itself, ROI, per day/week',
      'Be specific: "$312 saved in the first month" beats "save hundreds"',
      'If your price is a weakness, do not use this angle — use Emotional or Pain Point instead',
      'Never hide the price — the whole angle depends on transparency',
    ],
    differentiate_from: 'Unlike Urgency, there is no deadline — this is about permanent value logic. Unlike Premium, cost is the central argument, not quality signaling. If your pricing is comparable to competitors with no clear advantage, this angle exposes rather than persuades.',
    not_this: 'Do NOT write vague value claims like "great ROI" without numbers. Do NOT use this angle if your product is priced at premium without a clear cost-saving mechanism. Do NOT bury the price comparison — it must be the opening statement.',
  },
  {
    id:       'storytelling',
    name:     'Storytelling',
    subtitle: 'Character journey and transformation proof',
    strategy: 'Take the audience through a narrative arc with a specific character — a real customer, the founder, or an archetype the audience deeply identifies with. Stories bypass sales resistance because the audience tracks a person\'s journey, not evaluates a product. The transformation must be earned through the story — the product appears as a turning point, not a hero. Every slide is one story beat, never more.',
    tone:     'Narrative, honest, confessional. First person where possible. Reads like a real person talking, not a brand writing copy. Avoid polished corporate language entirely.',
    hooks: [
      '[Name/character] almost gave up. Then this happened.',
      '6 months ago I was [specific painful situation]. Here\'s what changed.',
      'She tried everything. Nothing worked. Until one thing did.',
    ],
    slide_structure: [
      'Character at their lowest — name the specific situation, not a generic struggle',
      'The moment of almost giving up — make it feel real and earned',
      'The turning point — discovery of the solution (story beat, not sales pitch)',
      'Early transformation — small, believable proof that things are changing',
      'The outcome — concrete and specific, months later',
      'CTA that invites the audience into the same journey',
    ],
    copy_rules: [
      'One slide = one story beat — never pile multiple beats onto one screen',
      'The character must have a name or clear archetype — "a busy mom of two" beats "a customer"',
      'The struggle must be named specifically — "$400/month on tools that didn\'t talk to each other" beats "struggling with costs"',
      'The product appears in slide 3-4, never slide 1 — story first, product second',
      'End with proof the transformation stuck — not just "she felt better" but "she closed 3 new clients that month"',
    ],
    differentiate_from: 'Unlike Emotional, this angle follows a narrative arc with a beginning, middle, and end. Unlike Educational, it doesn\'t teach a framework — it demonstrates change through a character. If you don\'t have a real story or credible archetype, this angle will feel fabricated.',
    not_this: 'Do NOT write a story that is secretly a feature list in disguise. Do NOT use a character with no specific detail — vague characters create no empathy. Do NOT make the product the hero — the character is the hero, the product is the tool.',
  },
  {
    id:       'pain_point',
    name:     'Pain Point',
    subtitle: 'Precise frustration identification and resolution',
    strategy: 'Name the exact frustration the audience lives with every single day — with enough specificity that they feel seen, not just targeted. Then agitate it by explaining why the problem keeps happening (systemic cause, not personal failure), before positioning the product as the logical resolution. This angle works because it demonstrates that you understand the problem better than anyone else, including the audience themselves.',
    tone:     'Empathetic but sharp. You are their advocate, not their therapist. You understand the problem deeply, you are not afraid to name it directly, and you have the fix.',
    hooks: [
      'Tired of [hyper-specific frustration that happens repeatedly]?',
      'If [exact painful scenario] sounds familiar, keep reading.',
      'You\'ve tried [common failed solution]. Here\'s why it never actually works.',
    ],
    slide_structure: [
      'Name the pain — specific, visceral, the exact moment they feel it',
      'Agitate — why does this keep happening? (Root cause, not surface symptom)',
      'Reframe — this is not their fault; the existing solutions are broken',
      'Introduce the product as the fix that addresses the root cause',
      'Proof — show it actually solved the problem for someone like them',
      'CTA',
    ],
    copy_rules: [
      'Be brutally specific about the pain — "forgetting to follow up with leads" beats "losing sales"',
      'Use: still, every time, again, keeps happening, no matter what you try, sound familiar',
      'Never blame the audience for the problem — the system failed them, not the other way around',
      'Agitation must explain WHY the problem persists, not just repeat that it hurts',
      'The product must be positioned as a root-cause fix, not a band-aid',
    ],
    differentiate_from: 'Unlike Emotional, this angle is sharp and diagnostic — naming a problem precisely, not exploring how it feels. Unlike Educational, it doesn\'t teach a framework — it identifies a broken pattern and resolves it. Generic pains produce generic responses — specificity is the entire strategy.',
    not_this: 'Do NOT use broad universal pains like "not enough time" — too generic to convert. Do NOT suggest the audience is doing something wrong — they are the victim of broken tools or systems. Do NOT skip agitation — naming the pain without explaining why it persists leaves no reason to believe your fix is different.',
  },
  {
    id:       'social_proof',
    name:     'Social Proof',
    subtitle: 'Peer validation and result credibility',
    strategy: 'Let real results from real people do the persuasion. Audiences trust peers infinitely more than brands, so this angle removes the brand voice as much as possible and replaces it with specific, credible, third-party evidence. The goal is to make the result feel inevitable — not because the brand claims it, but because a believable number of people who look like the target audience have already experienced it.',
    tone:     'Credible, transparent, measured. Reads like a review or case study, never an ad. Data-backed but humanized — numbers with names, results with context.',
    hooks: [
      '[Specific number] people switched from [X] to [product] in the last [timeframe].',
      'I was skeptical. Here\'s what actually happened after [short timeframe].',
      '[Name], [relatable title], went from [before state] to [result] in [timeframe].',
    ],
    slide_structure: [
      'Lead with the most credible proof signal — a number, a quote, or a before/after result',
      'Humanize the proof — who are these people and why does the audience relate to them?',
      'Show the before state — what were they working with before?',
      'Show the specific transformation — not just "it worked" but how and how fast',
      'Layer in additional proof (a second person, a number, a pattern)',
      'CTA framed around joining the group who already made the switch',
    ],
    copy_rules: [
      'Always use specific numbers — "312 customers" beats "thousands", "11 days" beats "quickly"',
      'Results must include timeframe — "saved $400 in the first month" is credible, "saved money" is not',
      'The proof subject must be relatable to the target audience — match demographics, job title, or situation',
      'Never use vague superlatives — "life-changing" without proof is worthless',
      'CTA should frame joining as following others — "Join [X] people who already made the switch"',
    ],
    differentiate_from: 'Unlike Emotional, this angle leads with data and credibility rather than feeling. Unlike Storytelling, the character gives evidence — they are not a narrative arc the audience follows. If you don\'t have real, specific, verifiable proof, do not use this angle — fabricated social proof destroys trust.',
    not_this: 'Do NOT write "Thousands of happy customers love us!" — too vague to convert. Do NOT use a testimonial that could describe any product in any category. Do NOT lead with brand claims and use social proof as a footnote — the proof must be the lead.',
  },
  {
    id:       'educational',
    name:     'Educational',
    subtitle: 'Insight-first, product as natural next step',
    strategy: 'Teach something genuinely useful that the audience does not already know — before ever mentioning the product. The education must stand on its own: if the audience watches and learns nothing actionable, the angle has failed. The product is introduced only after the insight has been delivered, positioned as the most efficient way to act on what was just learned. The audience should feel the CTA is a logical conclusion, not a pitch.',
    tone:     'Expert, generous, calm. Like a mentor sharing something they rarely tell people. No pressure, no urgency — the value comes from the knowledge, and the product extends it.',
    hooks: [
      'Most [target audience] don\'t know this — but it\'s costing them [specific consequence].',
      'Here\'s why [common accepted practice] is actually working against you.',
      'The reason [desired outcome] isn\'t happening isn\'t what you think.',
    ],
    slide_structure: [
      'Open with the insight — a surprising fact, a myth-bust, or a counterintuitive truth',
      'Explain why this matters and what it costs them not to know it',
      'Deliver the actionable framework or method — this is the genuine education',
      'Show the gap — where does the product fit in? What does it make easier or faster?',
      'CTA that positions the product as the natural next step for someone who now understands the insight',
    ],
    copy_rules: [
      'The education must be useful without the product — if it only makes sense as a setup for a pitch, rewrite it',
      'Use: here\'s why, the reason, what most people miss, the real cause, what actually happens',
      'One insight per ad — don\'t try to teach multiple things in one creative',
      'Never make the education feel condescending — assume a smart audience who just hasn\'t seen this framing',
      'The product is introduced in slide 4, never earlier — teaching comes first',
    ],
    differentiate_from: 'Unlike Pain Point, this angle leads with knowledge rather than frustration. Unlike Storytelling, there is no character arc — the audience is addressed directly as intelligent people learning something new. If your product solves a problem the audience already fully understands, use Pain Point instead.',
    not_this: 'Do NOT write an insight that is common knowledge — it will feel patronizing. Do NOT use the education section as a slow build to the product pitch — the education must be genuinely complete before the product appears. Do NOT lead with "Did you know?" — it is overused and signals a weak hook.',
  },
];

// ─── Lookup by id ─────────────────────────────────────────────────────────────

export function getAngleDefinition(id: string): AngleDefinition | undefined {
  return ANGLE_DEFINITIONS.find(a => a.id === id);
}

// ─── Build a formatted prompt block for a specific angle ──────────────────────
// Injected into carousel / banner / concept system prompts.

export function buildAngleBlock(angleId: string | undefined | null): string {
  // ── Auto: Claude picks from the 8 defined angles ──────────────────────────
  if (!angleId || angleId === '' || angleId === 'auto') {
    const list = ANGLE_DEFINITIONS.map(a => `- ${a.id}: ${a.name} — ${a.subtitle}`).join('\n');
    return `
ANGLE SELECTION — AUTO MODE:
Choose exactly ONE of the following angles that best fits the brief, goal, and audience.
Do not invent new angles. Do not blend multiple angles. Pick one and execute it fully.

Available angles:
${list}

After selecting, apply ALL execution rules for that angle: strategy, tone, hook style, slide structure, and copy rules.
`.trim();
  }

  // ── Specific angle selected by user ───────────────────────────────────────
  const def = getAngleDefinition(angleId);
  if (!def) return `ANGLE: ${angleId}`;

  return `
ANGLE: ${def.name} — ${def.subtitle}

STRATEGY:
${def.strategy}

TONE:
${def.tone}

HOOK TEMPLATES (adapt to the brief, do not copy verbatim):
${def.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}

SLIDE / SECTION STRUCTURE:
${def.slide_structure.map((s, i) => `${i + 1}. ${s}`).join('\n')}

COPY RULES (follow all of these):
${def.copy_rules.map(r => `• ${r}`).join('\n')}

DIFFERENTIATE FROM OTHER ANGLES:
${def.differentiate_from}

DO NOT DO THIS:
${def.not_this}
`.trim();
}
