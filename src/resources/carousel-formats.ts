// ─── Carousel Format Knowledge Base ──────────────────────────────────────────
//
// Derived from proven high-reach carousel formats (Figma/Canva references).
// Each format defines: name, goal, how to structure it, and hook ideas.
// This is injected into the carousel generation system prompt so the AI
// knows exactly which format to use and how to write copy for it.

export interface CarouselFormat {
  id:        string;
  name:      string;
  goal:      string;
  structure: string;
  hookIdeas: string[];
  slideFlow: string;
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
  },
  {
    id:   'behind-the-scenes',
    name: 'Behind the Scenes',
    goal: 'Share what you do in a day or the process behind a specific task.',
    structure: `
      - Choose a part of your day or process your audience doesn\'t usually see.
      - Take casual, authentic moments that tell the story visually across slides.
      - Use short captions on each slide to explain what\'s happening.`,
    hookIdeas: [
      'What I do in a day as [your role]',
      'What my day really looks like as [role/niche]',
      'A day in my life: something specific about your work or routine',
      'Do [task] with me',
    ],
    slideFlow: 'cover (hook) → morning/start → main task → challenge → how solved → result/lesson → cta',
  },
  {
    id:   'photo-dump',
    name: 'Photo Dump',
    goal: 'Share personal and work moments to give your audience a glimpse into your week.',
    structure: `
      - Choose highlights that show your personality and what makes your routine unique.
      - Add a brief caption to each photo for context.`,
    hookIdeas: [
      'Life lately...',
      'What my week really looks like as [role/niche]',
      'Some favorite moments from this week',
      'A real-life look at my week in [niche/role]',
    ],
    slideFlow: 'cover (week hook) → moment 1 → moment 2 → moment 3 → moment 4 → reflection → cta',
  },
];

// ── Format selector ───────────────────────────────────────────────────────────
// Maps an angle label to the best carousel format for it.

export function selectCarouselFormat(angleLabel: string): CarouselFormat | null {
  const a = angleLabel.toLowerCase();

  if (a.match(/before.*after|transform|result|proof|change/))  return getFormat('before-and-after');
  if (a.match(/mistake|wrong|avoid|not.*that|do.*this/))       return getFormat('do-this-not-that');
  if (a.match(/behind|day.*life|process|bts|authentic/))       return getFormat('behind-the-scenes');
  if (a.match(/lesson|learn|experience|insight|hard.*way/))    return getFormat('lessons-learned');
  if (a.match(/opinion|controversial|unpopu|disagree|truth/))  return getFormat('unpopular-opinion');
  if (a.match(/guide|how.*to|step|tip|tutorial|friendly/))     return getFormat('friendly-guide');
  if (a.match(/photo|dump|week|life|moment|personal/))         return getFormat('photo-dump');

  // Default: friendly guide works for most educational/value carousels
  return getFormat('friendly-guide');
}

function getFormat(id: string): CarouselFormat | null {
  return CAROUSEL_FORMATS.find(f => f.id === id) ?? null;
}

// ── Prompt block builder ──────────────────────────────────────────────────────
// Returns the format context as a string to inject into the system prompt.

export function buildCarouselFormatBlock(angleLabel: string): string {
  const format = selectCarouselFormat(angleLabel);
  if (!format) return '';

  return `
CAROUSEL FORMAT: ${format.name.toUpperCase()}
Goal: ${format.goal}

How to structure it:${format.structure}

Proven hook ideas for this format:
${format.hookIdeas.map(h => `  - "${h}"`).join('\n')}

Slide flow to follow: ${format.slideFlow}

Apply this format to the concept above. The hook field on slide 1 must use one of the hook idea patterns above, adapted to the specific product/niche.
`.trim();
}
