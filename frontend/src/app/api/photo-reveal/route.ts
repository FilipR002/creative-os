/**
 * POST /api/photo-reveal
 *
 * AI-generates a photo-reveal carousel:
 *   - hook headline (slide 1)
 *   - reveal labels for each slide
 *   - unsplash keyword per slide (auto-fetched by caller)
 *   - optional: picks from user's media library by index
 *
 * Body: { brief, slideCount?, mediaCount? }
 * Response: { hook, slides: [{ label, unsplashKeyword, mediaIndex? }] }
 */

import { NextResponse } from 'next/server';

interface SlideResult {
  label:           string;
  unsplashKeyword: string;
  mediaIndex?:     number | null;
}

interface GenerateResult {
  hook:   string;
  slides: SlideResult[];
}

export async function POST(request: Request) {
  const body = await request.json() as { brief?: string; slideCount?: number; mediaCount?: number };
  const { brief = '', slideCount = 5, mediaCount = 0 } = body;

  if (!brief.trim()) {
    return NextResponse.json({ error: 'brief is required' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const hasMedia = mediaCount > 0;

  const system = `You are a viral social media content strategist specialising in carousel posts.
You write reveal-style carousels that stop scrolls, build curiosity slide-by-slide, and drive saves and shares.
Labels must be SHORT, PUNCHY, ALL CAPS — 2-6 words max.
Hook must be a pattern-interrupt that makes people swipe immediately.
Return ONLY valid JSON, no markdown, no explanation.`;

  const user = `Create a photo-reveal carousel for: "${brief}"

Rules:
- Hook headline: one punchy ALL CAPS line that creates curiosity or shock
- Generate exactly ${slideCount} reveal slides after the hook
- Each slide reveals ONE surprising/interesting thing, building on the previous
- Labels: SHORT ALL CAPS, max 6 words
- For each slide pick a specific Unsplash search keyword that would find a great matching photo
${hasMedia ? `- The user has ${mediaCount} photos in their media library (indexed 0 to ${mediaCount - 1}). If a slide would match a library photo better than Unsplash, set mediaIndex to that index. Otherwise set mediaIndex to null.` : ''}

Return JSON exactly:
{
  "hook": "YOUR PUNCHY HOOK IN ALL CAPS",
  "slides": [
    {
      "label": "REVEAL LABEL",
      "unsplashKeyword": "specific photo keyword",
      "mediaIndex": ${hasMedia ? 'null' : 'null'}
    }
  ]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => 'unknown');
      return NextResponse.json({ error: `Claude error ${res.status}: ${txt}` }, { status: 502 });
    }

    const data = await res.json() as { content: { text: string }[] };
    const raw  = (data.content?.[0]?.text ?? '').trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    const parsed = JSON.parse(raw) as GenerateResult;
    return NextResponse.json(parsed);

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
