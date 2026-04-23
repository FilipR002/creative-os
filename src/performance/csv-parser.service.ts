import { Injectable } from '@nestjs/common';

// ── Canonical column name maps (lowercase, trimmed) ──────────────────────────

const URL_COLS         = ['final url','destination url','website url','landing page','url','final_url','destination_url','landing_page','link url','ad url'];
const IMPRESSIONS_COLS = ['impressions','impr.','impr','reach'];
const CLICKS_COLS      = ['clicks','link clicks','link clicks (all)','website clicks','outbound clicks'];
const CTR_COLS         = ['ctr','ctr (link click-through rate)','click-through rate','ctr (all)'];
const CONVERSIONS_COLS = ['conversions','results','purchases','purchase','conversion','leads','website conversions'];
const REVENUE_COLS     = ['revenue','conv. value','purchase value','conversion value','value','purchase conversion value'];
const AD_NAME_COLS     = ['ad name','name','ad_name','creative name','ad','creative'];
const CAMPAIGN_COLS    = ['campaign','campaign name','campaign_name','campaign name'];

// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  adName:      string;
  campaignName: string;
  url:         string;
  impressions: number;
  clicks:      number;
  ctr:         number;   // 0–1
  conversions: number;
  revenue:     number;
}

@Injectable()
export class CsvParserService {

  parse(buffer: Buffer): ParsedRow[] {
    // Strip BOM if present
    const text  = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    const rawHeaders = this.splitLine(lines[0]);
    const headers    = rawHeaders.map(h => h.toLowerCase().trim());

    const col = (candidates: string[]) => this.findCol(headers, candidates);

    const idxUrl         = col(URL_COLS);
    const idxImpressions = col(IMPRESSIONS_COLS);
    const idxClicks      = col(CLICKS_COLS);
    const idxCtr         = col(CTR_COLS);
    const idxConversions = col(CONVERSIONS_COLS);
    const idxRevenue     = col(REVENUE_COLS);
    const idxAdName      = col(AD_NAME_COLS);
    const idxCampaign    = col(CAMPAIGN_COLS);

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = this.splitLine(lines[i]);
      const g     = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '');

      rows.push({
        adName:      g(idxAdName),
        campaignName: g(idxCampaign),
        url:         g(idxUrl),
        impressions: this.num(g(idxImpressions)),
        clicks:      this.num(g(idxClicks)),
        ctr:         this.pct(g(idxCtr)),
        conversions: this.num(g(idxConversions)),
        revenue:     this.num(g(idxRevenue)),
      });
    }

    return rows.filter(r => r.url || r.adName);   // skip fully empty rows
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private findCol(headers: string[], candidates: string[]): number {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h === c || h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  /** Split a CSV line respecting quoted fields and escaped quotes. */
  private splitLine(line: string): string[] {
    const result: string[] = [];
    let field    = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }   // "" = escaped quote
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(field);
        field = '';
      } else {
        field += c;
      }
    }
    result.push(field);
    return result;
  }

  /** Parse numeric strings like "1,234" or "1234.5". */
  private num(raw: string): number {
    const clean = raw.replace(/[,%$€£]/g, '').trim();
    const n     = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  /** Parse percent strings: "3.2%" → 0.032, "0.032" → 0.032, "32" → 0.32. */
  private pct(raw: string): number {
    const clean = raw.replace(/[,%\s]/g, '').trim();
    const n     = parseFloat(clean);
    if (isNaN(n)) return 0;
    if (n > 1)   return n / 100;   // "3.2" → 0.032
    return n;                       // "0.032" already normalised
  }
}

// ── Standalone helpers (used by PerformanceService) ──────────────────────────

/** Extract co_id tracking parameter from any URL string. */
export function extractTrackingId(url: string): string | null {
  if (!url) return null;
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const parsed     = new URL(normalized);
    return parsed.searchParams.get('co_id');
  } catch {
    // Malformed URL — try regex fallback
    const m = url.match(/[?&]co_id=([^&\s]+)/);
    return m ? m[1] : null;
  }
}

/** Append co_id to a URL, handling existing query params. */
export function buildTrackedUrl(baseUrl: string, creativeId: string): string {
  if (!baseUrl) return `?co_id=${creativeId}`;
  try {
    const url = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
    url.searchParams.set('co_id', creativeId);
    return url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}co_id=${creativeId}`;
  }
}
