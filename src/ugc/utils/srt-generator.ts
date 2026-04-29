/**
 * srt-generator.ts
 *
 * Converts timed text overlays into an SRT subtitle file string.
 *
 * SRT format (one block per subtitle):
 *   <index>
 *   HH:MM:SS,mmm --> HH:MM:SS,mmm
 *   text line(s)
 *   [blank line]
 *
 * Usage:
 *   import { generateSrt } from './srt-generator';
 *   const srt = generateSrt(textOverlays);
 *   // store in DB, send to frontend for download / WebVTT client-side rendering
 */

export interface SrtEntry {
  text:      string;
  startTime: number;   // seconds
  endTime:   number;   // seconds
}

// ─── SRT time formatter ───────────────────────────────────────────────────────

function toSrtTimestamp(seconds: number): string {
  const total = Math.max(0, seconds);
  const h     = Math.floor(total / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = Math.floor(total % 60);
  const ms    = Math.round((total - Math.floor(total)) * 1000);

  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0'),
  ].join(':') + ',' + String(ms).padStart(3, '0');
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a valid SRT string from an array of timed text entries.
 * Entries with empty text are skipped.
 * Returns an empty string if there are no valid entries.
 */
export function generateSrt(entries: SrtEntry[]): string {
  const valid = entries.filter(e => e.text.trim().length > 0);
  if (valid.length === 0) return '';

  return valid
    .map((entry, i) => [
      String(i + 1),
      `${toSrtTimestamp(entry.startTime)} --> ${toSrtTimestamp(entry.endTime)}`,
      entry.text.trim(),
      '',   // trailing blank line between blocks
    ].join('\n'))
    .join('\n');
}

/**
 * Parse an SRT string back into SrtEntry[] (for testing / round-trip checks).
 */
export function parseSrt(srt: string): SrtEntry[] {
  const blocks = srt.trim().split(/\n\n+/);
  const entries: SrtEntry[] = [];

  for (const block of blocks) {
    const lines     = block.trim().split('\n');
    const timeIdx   = lines.findIndex(l => l.includes(' --> '));
    if (timeIdx < 0) continue;

    const [startStr, endStr] = lines[timeIdx].split(' --> ');
    const text               = lines.slice(timeIdx + 1).join('\n').trim();
    if (!text) continue;

    entries.push({
      text,
      startTime: parseSrtTime(startStr),
      endTime:   parseSrtTime(endStr),
    });
  }

  return entries;
}

/**
 * Parse an SRT timestamp ("HH:MM:SS,mmm") into seconds.
 */
export function parseSrtTime(ts: string): number {
  const normalized = ts.replace(',', '.');
  const parts      = normalized.split(':');
  if (parts.length !== 3) return 0;
  const [h, m, s]  = parts.map(Number);
  return h * 3600 + m * 60 + s;
}
