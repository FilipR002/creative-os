/**
 * GET /api/unsplash?id=<template-id>
 *
 * Server-side Unsplash proxy. Returns photo URL + attribution + download location.
 * Requires env var: UNSPLASH_ACCESS_KEY (free at unsplash.com/developers)
 * Caches one photo per template ID in-memory for the server lifetime.
 */

import { NextResponse } from 'next/server';

const PHOTO_QUERIES: Record<string, string> = {
  // ── Original 8 ──────────────────────────────────────────────────────────────
  'full-bleed':         'cinematic lifestyle dramatic portrait outdoor',
  'dark-luxury':        'dark marble luxury product black minimal',
  'overlay-card':       'cityscape bokeh night lights urban',
  'ugc-style':          'authentic person phone lifestyle selfie',
  'magazine-editorial': 'editorial fashion beauty cosmetics flat lay',
  'story-hook':         'dramatic moody landscape mountain cinematic',
  'product-center':     'product photography studio clean white minimal',
  'neon-dark':          'neon lights cyberpunk city night',
  // ── Batch 5 (dark-design templates only) ─────────────────────────────────────
  'caption-style':      'lifestyle portrait outdoor social media candid',
  'tiktok-native':      'person dancing street style youth urban lifestyle',
  'video-thumbnail':    'cinematic dramatic action portrait thumbnail bold',
  'duotone-photo':      'fashion portrait studio editorial bold color',
  'hot-take':           'dramatic bold neon abstract city night lights',
  'poll-card':          'crowd people street lifestyle diverse urban',
  'offer-announce':     'shopping sale retail colorful gift seasonal',
  'limited-drop':       'luxury exclusive sneaker streetwear hype product',
  'event-card':         'concert festival crowd lights music event night',
  'award-winner':       'trophy award success achievement celebration gold',
  'aurora-gradient':    'northern lights aurora borealis nature sky landscape',
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
