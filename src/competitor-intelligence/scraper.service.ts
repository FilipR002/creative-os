import { Injectable, Logger } from '@nestjs/common';

export interface ScrapedPage {
  url:           string;
  title:         string;
  description:   string;
  headings:      string[];
  ctaTexts:      string[];
  benefits:      string[];
  priceMentions: string[];
  ogImage?:      string;
  scrapedAt:     Date;
  error?:        string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async scrapePage(url: string): Promise<ScrapedPage> {
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const res = await fetch(normalized, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MarketResearchBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      return this.parseHtml(normalized, html);
    } catch (err) {
      this.logger.warn(`Scrape failed for ${url}: ${(err as Error).message}`);
      return {
        url, title: '', description: '', headings: [], ctaTexts: [],
        benefits: [], priceMentions: [], scrapedAt: new Date(),
        error: (err as Error).message,
      };
    }
  }

  private parseHtml(url: string, html: string): ScrapedPage {
    const extract = (pattern: RegExp, group = 1): string =>
      pattern.exec(html)?.[group]?.replace(/<[^>]+>/g, '').trim() ?? '';

    const extractAll = (pattern: RegExp, group = 1): string[] => {
      const results: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(pattern.source, 'gi');
      while ((m = re.exec(html)) !== null) {
        const t = m[group]?.replace(/<[^>]+>/g, '').trim();
        if (t && t.length > 2 && t.length < 200) results.push(t);
      }
      return [...new Set(results)].slice(0, 15);
    };

    const title       = extract(/<title[^>]*>([^<]+)<\/title>/i);
    const description = extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)
                     || extract(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const ogImage     = extract(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
    const headings    = extractAll(/<h[123][^>]*>([^<]+)<\/h[123]>/i);
    const ctaTexts    = extractAll(/<(?:button|a)[^>]*>([^<]{3,60})<\/(?:button|a)>/i);
    const benefits    = headings.filter(h =>
      /free|save|boost|grow|increase|improve|fast|easy|instant/i.test(h));

    const priceRe = /\$[\d,.]+|\d+%\s+off|free trial|money.?back/gi;
    const priceMentions: string[] = [];
    let pm: RegExpExecArray | null;
    while ((pm = priceRe.exec(html)) !== null) priceMentions.push(pm[0]);

    return {
      url, title, description, headings, ctaTexts,
      benefits, priceMentions: [...new Set(priceMentions)].slice(0, 10),
      ogImage, scrapedAt: new Date(),
    };
  }

  /** Derive sub-pages to check (pricing, features, about) */
  subPages(baseUrl: string): string[] {
    try {
      const u = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
      const base = `${u.protocol}//${u.host}`;
      return [base, `${base}/pricing`, `${base}/features`, `${base}/about`];
    } catch { return [baseUrl]; }
  }
}
