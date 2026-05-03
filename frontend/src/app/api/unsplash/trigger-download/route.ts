/**
 * POST /api/unsplash/trigger-download
 *
 * Pings the Unsplash download_location URL on behalf of the client.
 * Required by Unsplash TOS whenever a photo is displayed / "downloaded".
 *
 * Body: { downloadLocation: string }
 * The actual download_location URL is kept server-side so the Access Key
 * is never exposed in client responses.
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    // Non-fatal — TOS ping is best-effort; don't crash the client
    return NextResponse.json({ ok: false, reason: 'no_key' }, { status: 200 });
  }

  let downloadLocation: string;
  try {
    const body = await request.json() as { downloadLocation?: string };
    downloadLocation = body.downloadLocation ?? '';
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 });
  }

  if (!downloadLocation.startsWith('https://api.unsplash.com/')) {
    return NextResponse.json({ ok: false, reason: 'invalid_url' }, { status: 400 });
  }

  try {
    // Unsplash requires the client_id param to be appended
    const sep = downloadLocation.includes('?') ? '&' : '?';
    await fetch(`${downloadLocation}${sep}client_id=${accessKey}`, {
      method: 'GET',
      headers: { 'Accept-Version': 'v1' },
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Best-effort — never fail the UI over a TOS ping
    return NextResponse.json({ ok: false, reason: 'fetch_failed' }, { status: 200 });
  }
}
