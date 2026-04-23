import { Injectable } from '@nestjs/common';
import { ScrapedPage } from './scraper.service';
import { AdIntelItem } from './types';

const EMOTIONAL_TRIGGERS: Record<string, string> = {
  urgency:      'urgency|now|today|hurry|limited|expires|fast|quick|instant',
  fear:         'risk|miss|lose|fail|behind|struggle|problem|pain|danger',
  desire:       'dream|want|love|amazing|incredible|stunning|powerful|best',
  social_proof: 'trusted|users|customers|reviews|rated|award|proven|popular',
  curiosity:    'secret|how|discover|reveal|unlock|surprising|hidden|new',
  authority:    'expert|professional|leader|certified|official|guarantee',
  value:        'free|save|cheap|affordable|deal|offer|discount|bonus',
};

function detectEmotionalTrigger(text: string): string {
  for (const [trigger, pattern] of Object.entries(EMOTIONAL_TRIGGERS)) {
    if (new RegExp(pattern, 'i').test(text)) return trigger;
  }
  return 'neutral';
}

function detectFormat(page: ScrapedPage): string {
  const u = page.url.toLowerCase();
  if (u.includes('/blog') || u.includes('/article')) return 'content';
  if (u.includes('/pricing'))                          return 'pricing_page';
  if (u.includes('/features'))                         return 'feature_page';
  if (page.ctaTexts.some(c => /buy|purchase|order/i.test(c))) return 'sales_page';
  if (page.ctaTexts.some(c => /sign.?up|start|try/i.test(c))) return 'landing_page';
  return 'homepage';
}

function detectLandingStructure(page: ScrapedPage): string {
  const parts: string[] = [];
  if (page.headings.length > 0)       parts.push('headline');
  if (page.benefits.length > 0)       parts.push('benefits');
  if (page.priceMentions.length > 0)  parts.push('pricing');
  if (page.ctaTexts.length > 0)       parts.push('cta');
  if (parts.length === 0)             parts.push('minimal');
  return parts.join(' → ');
}

@Injectable()
export class NormalizerService {
  normalize(brand: string, page: ScrapedPage, idx: number): AdIntelItem {
    const allText = [page.title, page.description, ...page.headings].join(' ');
    const hook    = page.headings[0] || page.title || page.description.slice(0, 80) || 'Unknown hook';
    const copy    = page.description || page.headings.slice(1, 3).join(' ') || '';
    const cta     = page.ctaTexts.find(c => c.length > 2 && c.length < 60) || 'Learn More';
    const format  = detectFormat(page);
    const emotional = detectEmotionalTrigger(allText);
    const landing   = detectLandingStructure(page);

    return {
      id:                   `${brand.toLowerCase().replace(/\s+/g, '_')}_${idx}_${Date.now()}`,
      brand,
      hook:                 hook.slice(0, 120),
      copy:                 copy.slice(0, 300),
      cta:                  cta.slice(0, 60),
      format,
      emotionalTrigger:     emotional,
      landingPageStructure: landing,
      performanceSignal:    0,  // filled by scorer
      clusterId:            '',  // filled by clusterer
      source:               page.url,
      scores: {
        engagementLikelihood: 0,
        clarityScore:         0,
        emotionalIntensity:   0,
        noveltyScore:         0,
        repetitionFrequency:  0,
      },
    };
  }
}
