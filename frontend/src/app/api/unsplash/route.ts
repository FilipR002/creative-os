/**
 * GET /api/unsplash?id=<template-id>
 *
 * Server-side Unsplash proxy. Returns photo URL + attribution + download location.
 * Requires env var: UNSPLASH_ACCESS_KEY (free at unsplash.com/developers)
 * Caches one photo per template ID in-memory for the server lifetime.
 */

import { NextResponse } from 'next/server';

const PHOTO_QUERIES: Record<string, string> = {
  // ── Original 8 — matched to template story ───────────────────────────────────
  // full-bleed: "Stop Scrolling. This changes your game." — bold brand moment
  'full-bleed':         'confident person brand lifestyle product modern marketing',
  // dark-luxury: premium product dark background
  'dark-luxury':        'luxury watch perfume jewelry product dark background minimal',
  // overlay-card: urban brand ad vibe
  'overlay-card':       'brand store shopping urban street style retail',
  // ugc-style: authentic customer using product
  'ugc-style':          'authentic person smiling using product phone happy customer',
  // magazine-editorial: premium brand editorial layout
  'magazine-editorial': 'magazine editorial brand beauty skincare product flatlay',
  // story-hook: founder/entrepreneur story — person with purpose
  'story-hook':         'entrepreneur founder confident business person working startup',
  // product-center: clean product shot
  'product-center':     'product studio white background clean minimal packshot',
  // neon-dark: tech / app brand in dark environment
  'neon-dark':          'tech startup app developer laptop neon dark office',
  // ── Batch 5 — matched to template story ──────────────────────────────────────
  // caption-style: "When I tried X for 30 days…" — personal transformation
  'caption-style':      'person transformation result before after lifestyle progress',
  // tiktok-native: "@brand · Discover what actually works" — creator/product
  'tiktok-native':      'content creator filming product review phone trendy',
  // video-thumbnail: "Watch the demo · 2.4M views" — presenter or product screen
  'video-thumbnail':    'presenter speaking product demo screen tutorial confident',
  // duotone-photo: "A new kind of brand. Bold by design." — fashion/brand editorial
  'duotone-photo':      'fashion brand editorial bold design portrait creative',
  // hot-take: "Most experts are just guessing." — debate / bold opinion
  'hot-take':           'bold debate social media discussion opinion engagement people',
  // poll-card: social poll — community / diverse audience
  'poll-card':          'diverse group people community vote choice social poll',
  // offer-announce: "40% Off Everything · Today Only" — shopping / sale
  'offer-announce':     'shopping bags sale discount retail store happy customer',
  // limited-drop: "Only 47 Left · Ships today · No restock" — exclusive product
  'limited-drop':       'exclusive limited edition product sneaker streetwear hype drop',
  // event-card: "Free Masterclass · 2PM EST · Live" — event / webinar
  'event-card':         'conference event speaker stage audience professional seminar',
  // award-winner: "Voted #1 · Best in Category 2026" — award / success
  'award-winner':       'award trophy winner success celebration achievement business',
  // aurora-gradient: "The future is here. AI-Powered." — tech / innovation
  'aurora-gradient':    'technology innovation futuristic AI software product modern',
};

interface CachedPhoto {
  url:              string;
  credit:           string;
  creditUrl:        string;
  downloadLocation: string;   // must be pinged when user "uses" photo (Unsplash TOS)
}

const cache = new Map<string, CachedPhoto>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id         = searchParams.get('id') ?? '';
  const customQuery = searchParams.get('q') ?? '';   // free-text query for photo-reveal

  // Free-text query mode (photo-reveal per-slide search) — no caching
  if (customQuery) {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return NextResponse.json({ error: 'UNSPLASH_ACCESS_KEY not configured' }, { status: 503 });
    try {
      const res = await fetch(
        `https://api.unsplash.com/photos/random?query=${encodeURIComponent(customQuery)}&orientation=landscape&content_filter=high&client_id=${accessKey}`,
        { headers: { 'Accept-Version': 'v1' } },
      );
      if (!res.ok) return NextResponse.json({ error: `Unsplash ${res.status}` }, { status: 502 });
      const data = await res.json() as { urls: { regular: string }; links: { download_location: string }; user: { name: string; links: { html: string } } };
      return NextResponse.json({
        url:              `${data.urls.regular}&w=700&q=80&fit=crop&auto=format`,
        credit:           data.user.name,
        creditUrl:        `${data.user.links.html}?utm_source=creative_os&utm_medium=referral`,
        downloadLocation: data.links.download_location,
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  const query = PHOTO_QUERIES[id];

  if (!query) {
    return NextResponse.json({ error: 'Unknown template id' }, { status: 400 });
  }

  const hit = cache.get(id);
  if (hit) return NextResponse.json(hit);

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json({ error: 'UNSPLASH_ACCESS_KEY not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&client_id=${accessKey}`,
      { headers: { 'Accept-Version': 'v1' }, next: { revalidate: 86400 } },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => 'unknown');
      return NextResponse.json({ error: `Unsplash error ${res.status}: ${txt}` }, { status: 502 });
    }

    const data = await res.json() as {
      urls:  { regular: string };
      links: { download_location: string };
      user:  { name: string; links: { html: string } };
    };

    const result: CachedPhoto = {
      url:              `${data.urls.regular}&w=700&q=80&fit=crop&auto=format`,
      credit:           data.user.name,
      creditUrl:        `${data.user.links.html}?utm_source=creative_os&utm_medium=referral`,
      downloadLocation: data.links.download_location,
    };

    cache.set(id, result);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 's-maxage=86400, stale-while-revalidate' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
