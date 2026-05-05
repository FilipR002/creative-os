// ─── Carousel Format Knowledge Base ──────────────────────────────────────────
//
// Derived from proven high-reach carousel formats (Figma/Canva references).
// Each format defines: name, goal, how to structure it, and hook ideas.
// This is injected into the carousel generation system prompt so the AI
// knows exactly which format to use and how to write copy for it.
//
// Formats map to both angle labels AND specific template IDs so the AI
// gets the right format knowledge regardless of how the carousel is triggered.

export interface CarouselFormat {
  id:          string;
  name:        string;
  goal:        string;
  structure:   string;
  hookIdeas:   string[];
  slideFlow:   string;
  copyStyle:   string;
}

export const CAROUSEL_FORMATS: CarouselFormat[] = [
  {
    id:   'friendly-guide',
    name: 'Friendly Guide',
    goal: 'Share an easy-to-follow guide that helps your audience do something in your niche.',
    structure: `
      - Pick a topic your audience regularly asks about or struggles with.
      - Break it down into simple, easy-to-follow steps or tips.
      - Use clear headings on each slide so people can quickly get each point.`,
    hookIdeas: [
      'The [topic] guide you\'ll actually use',
      'Your friendly guide to [topic]',
      'Let\'s make [topic] easier',
      'How to do [X] the easy way',
    ],
    slideFlow: 'cover (hook) → step 1 → step 2 → step 3 → step 4 → tip/bonus → cta',
    copyStyle: 'Warm, direct, instructional. Short sentences. Each slide = one idea. No fluff.',
  },
  {
    id:   'do-this-not-that',
    name: 'Do This, Not That',
    goal: 'Point out one common mistake and what to do instead.',
    structure: `
      - Pick one mistake or unhelpful habit your audience might have.
      - Explain why it\'s not the best option.
      - Then share what to do instead and why it works better.`,
    hookIdeas: [
      'Most people are doing [thing] wrong',
      'Stop doing [action] — it never works',
      '[Action] is a complete waste of time',
      'The mistake everyone makes with [topic]',
    ],
    slideFlow: 'cover (shocking hook) → the wrong way → why it fails → the right way → why it works → cta',
    copyStyle: 'Bold, opinionated, confident. Make the wrong way feel obviously wrong. Make the right way feel obvious in hindsight.',
  },
  {
    id:   'before-and-after',
    name: 'Before and After',
    goal: 'Show the difference your process, product, or approach can make.',
    structure: `
      - Pick a clear "before" and "after" moment, result, or example.
      - Use visuals that make the difference obvious.
      - Add short captions to explain what changed and why it matters.`,
    hookIdeas: [
      'Before vs. after [specific change]',
      'The difference [your process/product] can make',
      'From [situation] to [improved result]',
      'What happens when you [take action]',
    ],
    slideFlow: 'cover (before state hook) → before details → turning point → after details → result/proof → cta',
    copyStyle: 'Contrast-driven. Before = pain/frustration. After = relief/results. Be specific with numbers where possible.',
  },
  {
    id:   'unpopular-opinion',
    name: 'Unpopular Opinion',
    goal: 'Share a perspective that goes against common advice in your niche.',
    structure: `
      - Pick a belief or "common advice" in your niche you disagree with.
      - Back up your point with examples, results, or experiences.`,
    hookIdeas: [
      'Everyone says [X]... here\'s why I don\'t',
      'I might get cancelled for this, but...',
      'I know this isn\'t the usual advice...',
      'Not everyone will agree with this...',
    ],
    slideFlow: 'cover (controversial hook) → the common belief → why it\'s wrong → what I believe instead → evidence → cta',
    copyStyle: 'Confident, slightly provocative. Not aggressive. Back every claim with real experience or data.',
  },
  {
    id:   'lessons-learned',
    name: 'Lessons You\'ve Learned',
    goal: 'Share meaningful insights from your own experience.',
    structure: `
      - Choose lessons that feel relevant to your audience right now.
      - Give a quick example or story for each lesson.`,
    hookIdeas: [
      'What I wish I knew earlier about [topic]',
      'Lessons [X years] in [niche] have taught me',
      'Lessons that changed the way I think about [niche]',
      'Things I\'ve learned the hard way about [topic]',
    ],
    slideFlow: 'cover (hook) → lesson 1 → lesson 2 → lesson 3 → lesson 4 → key takeaway → cta',
    copyStyle: 'Personal, reflective, honest. Each lesson = one slide. Keep it real — share the struggle, not just the win.',
  },
  {
    id:   'behind-the-scenes',
    name: 'Behind the Scenes',
    goal: 'Share what you do in a day or the process behind a specific task.',
    structure: `
      - Choose a part of your day or process your audience doesn\'t usually see.
      - Keep it casual and authentic — not polished.
      - Use short captions on each slide to explain what\'s happening.`,
    hookIdeas: [
      'What I do in a day as [your role]',
      'What my day really looks like as [role/niche]',
      'A day in my life: [something specific]',
      'Do [task] with me',
    ],
    slideFlow: 'cover (hook) → morning/start → main task → challenge → how solved → result/lesson → cta',
    copyStyle: 'Casual, raw, unfiltered. No jargon. Write like you\'re texting a friend. Show the messy parts too.',
  },
  {
    id:   'photo-dump',
    name: 'Photo Dump',
    goal: 'Share personal and work moments to give your audience a glimpse into your week.',
    structure: `
      - Choose highlights that show your personality and routine.
      - Add a brief caption to each for context.`,
    hookIdeas: [
      'Life lately...',
      'What my week really looks like as [role/niche]',
      'Some favorite moments from this week',
      'A real-life look at my week in [niche/role]',
    ],
    slideFlow: 'cover (week hook) → moment 1 → moment 2 → moment 3 → moment 4 → reflection → cta',
    copyStyle: 'Casual, warm, personal. Very short captions. Each slide = one moment. End with something forward-looking.',
  },
  {
    id:   'tell-a-story',
    name: 'Tell a Story',
    goal: 'Take the audience through a real narrative arc — challenge, turning point, outcome.',
    structure: `
      - Start with a hook that drops the reader into the middle of the story.
      - Build tension through the problem or challenge.
      - Deliver the turning point and result.
      - End with the insight or CTA.`,
    hookIdeas: [
      'I made $0 for 3 years. Then one thing changed.',
      'What\'s your biggest [niche] challenge?',
      'For a lot of [audience], it\'s [problem].',
      'That\'s where [solution] steps in.',
    ],
    slideFlow: 'cover (story drop hook) → context/problem → escalation → turning point → result → insight → cta',
    copyStyle: 'Narrative, cinematic. Big bold statement on each slide. Alternate dark/bright energy. Minimal words per slide — each one lands hard.',
  },
  {
    id:   'data-infographic',
    name: 'Data Infographic',
    goal: 'Present striking data, statistics, or comparisons that make people stop and think.',
    structure: `
      - Lead with the most shocking or counterintuitive stat.
      - Break down the data across slides, one insight at a time.
      - Use comparisons (before/after, men/women, us/them) with clear visual contrast.
      - Always cite sources for credibility.`,
    hookIdeas: [
      'The [topic] is costing you $[X]',
      '[X]% of [audience] don\'t know this',
      'The stats on [topic] will shock you',
      'Here\'s what the data actually shows',
    ],
    slideFlow: 'cover (shocking stat hook) → data point 1 with context → comparison/breakdown → data point 2 → what it means → cta',
    copyStyle: 'Data-led, authoritative, visual. Each slide = one stat or comparison. Source everything. Make numbers feel real with analogies.',
  },
  {
    id:   'show-off-goods',
    name: 'Show Off Your Product',
    goal: 'Showcase your product or service in a way that makes people want to own it.',
    structure: `
      - Lead with the product itself — clean, beautiful, front and center.
      - Show multiple angles, variants, or use cases.
      - Include social proof or a specific result.`,
    hookIdeas: [
      'Coffee\'s even better when [product detail]',
      'Meet the [product] you\'ve been waiting for',
      'This is what [problem solved] looks like',
      'Swipe to see what\'s inside',
    ],
    slideFlow: 'cover (product beauty shot hook) → hero product view → detail/variant → in-use shot → result or proof → cta',
    copyStyle: 'Clean, minimal, let the product speak. Short captions. Focus on how it feels, not just what it does.',
  },
  {
    id:   'spark-conversation',
    name: 'Spark a Conversation',
    goal: 'Ask a question or pose a take that makes people want to comment or vote.',
    structure: `
      - Start with a question or divisive statement.
      - Show multiple perspectives or options.
      - Invite the audience to pick a side or share their view.`,
    hookIdeas: [
      'Which [X] is your favorite? 2002? 2015? 2017?',
      'Hot take: [bold opinion] — agree or disagree?',
      'Would you rather [option A] or [option B]?',
      'Everyone has an opinion on [topic]. What\'s yours?',
    ],
    slideFlow: 'cover (question/poll hook) → option A → option B → reveal/results → your take → cta (comment answer)',
    copyStyle: 'Punchy, fun, inclusive. Make it feel like a game. Every slide should make the reader want to respond.',
  },
  {
    id:   'teach-something',
    name: 'Teach Something',
    goal: 'Educate your audience on a concept, word, or skill in a structured, memorable way.',
    structure: `
      - Define the concept clearly on slide 1 — like a "word of the day".
      - Break it down with examples in the middle slides.
      - End with how to apply it or why it matters.`,
    hookIdeas: [
      '[Concept]: noun | [pronunciation]',
      'Most people misunderstand [concept]',
      'Here\'s what [concept] actually means',
      'The [concept] every [audience] needs to know',
    ],
    slideFlow: 'cover (concept definition hook) → why it matters → example 1 → example 2 → common mistake → how to apply → cta',
    copyStyle: 'Clear, authoritative, educational. Define terms. Use real examples. Never talk down — explain like a smart friend, not a professor.',
  },
];

// ── Template ID → Format mapping ─────────────────────────────────────────────
// Maps every template ID to the carousel format that fits it best.

const TEMPLATE_FORMAT_MAP: Record<string, string> = {
  // Tell a story
  'story-hook':       'tell-a-story',
  'brand-manifesto':  'tell-a-story',
  'founder-story':    'tell-a-story',
  'full-bleed':       'tell-a-story',
  'bold-headline':    'tell-a-story',
  'text-only-bold':   'tell-a-story',

  // Do This Not That
  'do-dont':          'do-this-not-that',
  'myth-reality':     'do-this-not-that',
  'mistake-alert':    'do-this-not-that',
  'versus-slide':     'do-this-not-that',
  'transform-split':  'do-this-not-that',

  // Before and After
  'before-after-slide': 'before-and-after',
  'problem-slide':      'before-and-after',
  'pain-diagnostic':    'before-and-after',
  'empathy-card':       'before-and-after',

  // Data Infographic
  'chart-reveal':     'data-infographic',
  'stats-hero':       'data-infographic',
  'vs-table':         'data-infographic',
  'stat-study':       'data-infographic',
  'value-math':       'data-infographic',
  'leaderboard':      'data-infographic',

  // Show Off Goods
  'product-center':   'show-off-goods',
  'flat-lay':         'show-off-goods',
  'photo-grid':       'show-off-goods',
  'bundle-stack':     'show-off-goods',
  'gallery-slide':    'show-off-goods',
  'receipt-style':    'show-off-goods',
  'product-demo':     'show-off-goods',

  // Behind the Scenes
  'ugc-style':        'behind-the-scenes',
  'caption-style':    'behind-the-scenes',
  'photo-reveal':     'behind-the-scenes',
  'community-quote':  'behind-the-scenes',

  // Spark Conversation
  'poll-card':        'spark-conversation',
  'hot-take':         'spark-conversation',
  'reddit-thread':    'spark-conversation',
  'tweet-screenshot': 'spark-conversation',
  'meme-format':      'spark-conversation',
  'comment-reply':    'spark-conversation',
  'chat-native':      'spark-conversation',

  // Teach Something
  'three-reasons':      'teach-something',
  'insight-frame':      'teach-something',
  'feature-list':       'teach-something',
  'checklist-viral':    'teach-something',
  'steps-infographic':  'teach-something',
  'number-list':        'teach-something',
  'timeline-journey':   'teach-something',
  'point-out-slide':    'teach-something',

  // Lessons Learned
  'case-study':         'lessons-learned',
  'award-winner':       'lessons-learned',
  'news-frame':         'lessons-learned',
  'magazine-editorial': 'lessons-learned',

  // Friendly Guide
  'feature-list-v2':    'friendly-guide',
  'how-to':             'friendly-guide',
  'app-mockup':         'friendly-guide',

  // Trust / Testimonial
  'testimonial':        'lessons-learned',
  'testimonial-card':   'lessons-learned',
  'press-slide':        'lessons-learned',
  'trust-bar':          'lessons-learned',
  'social-proof-grid':  'lessons-learned',
  'review-card':        'lessons-learned',
  'validation-card':    'lessons-learned',

  // Unpopular Opinion
  'hot-take-v2':        'unpopular-opinion',
  'retro-bold':         'unpopular-opinion',
  'brutalist':          'unpopular-opinion',

  // Offer/CTA formats → friendly-guide or lessons-learned depending on context
  'offer-drop':         'before-and-after',
  'cta-final':          'before-and-after',
  'countdown-urgency':  'before-and-after',
  'offer-announce':     'before-and-after',
  'limited-drop':       'before-and-after',
  'guarantee-badge':    'before-and-after',
  'free-trial':         'before-and-after',
  'offer-stack':        'show-off-goods',
  'price-compare':      'data-infographic',
};

// ── Format selectors ──────────────────────────────────────────────────────────

function getFormat(id: string): CarouselFormat | null {
  return CAROUSEL_FORMATS.find(f => f.id === id) ?? null;
}

/** Select by template ID first, fall back to angle label matching */
export function selectCarouselFormat(angleLabel: string, templateId?: string): CarouselFormat | null {
  // 1. Template ID takes priority — most specific signal
  if (templateId && TEMPLATE_FORMAT_MAP[templateId]) {
    return getFormat(TEMPLATE_FORMAT_MAP[templateId]);
  }

  // 2. Angle label keyword matching
  const a = angleLabel.toLowerCase();
  if (a.match(/before.*after|transform|result|proof|change/))    return getFormat('before-and-after');
  if (a.match(/mistake|wrong|avoid|not.*that|do.*this/))         return getFormat('do-this-not-that');
  if (a.match(/behind|day.*life|process|bts|authentic/))         return getFormat('behind-the-scenes');
  if (a.match(/lesson|learn|experience|insight|hard.*way/))      return getFormat('lessons-learned');
  if (a.match(/opinion|controversial|unpopu|disagree|truth/))    return getFormat('unpopular-opinion');
  if (a.match(/stat|data|number|percent|growth|metric|infograph/)) return getFormat('data-infographic');
  if (a.match(/product|goods|shop|buy|purchase|item|collection/)) return getFormat('show-off-goods');
  if (a.match(/poll|vote|spark|convers|question|debate|engage/)) return getFormat('spark-conversation');
  if (a.match(/teach|educat|explain|learn|word|concept|how/))    return getFormat('teach-something');
  if (a.match(/story|journey|founder|narrative|real/))            return getFormat('tell-a-story');
  if (a.match(/guide|how.*to|step|tip|tutorial|friendly/))       return getFormat('friendly-guide');
  if (a.match(/photo|dump|week|life|moment|personal/))           return getFormat('photo-dump');

  // 3. Default
  return getFormat('friendly-guide');
}

// ── Prompt block builder ──────────────────────────────────────────────────────

export function buildCarouselFormatBlock(angleLabel: string, templateId?: string): string {
  const format = selectCarouselFormat(angleLabel, templateId);
  if (!format) return '';

  return `
CAROUSEL FORMAT: ${format.name.toUpperCase()}
Goal: ${format.goal}

How to structure it:${format.structure}

Copy style: ${format.copyStyle}

Proven hook ideas for this format:
${format.hookIdeas.map(h => `  - "${h}"`).join('\n')}

Slide flow to follow: ${format.slideFlow}

Apply this format to the concept above. The hook field on slide 1 must use one of the hook idea patterns above, adapted to the specific product/niche/audience. Do not use the hook idea examples verbatim — adapt them.
`.trim();
}
