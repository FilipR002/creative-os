import { Injectable } from '@nestjs/common';
import { NormalizedAd, AdPlatform } from './types';
import { randomUUID } from 'crypto';

const PLATFORM_FORMATS: Record<AdPlatform, string[]> = {
  meta:    ['carousel', 'single_image', 'video', 'story', 'collection'],
  tiktok:  ['short_video', 'spark_ad', 'branded_effect', 'topview'],
  google:  ['search_text', 'display_banner', 'responsive_search', 'performance_max'],
  youtube: ['pre_roll', 'skippable_video', 'bumper_ad', 'discovery'],
  web:     ['landing_page', 'homepage', 'pricing_page', 'blog'],
};

const PLATFORM_BIASES: Record<AdPlatform, string> = {
  meta:    'social_proof',
  tiktok:  'curiosity',
  google:  'value',
  youtube: 'desire',
  web:     'authority',
};

@Injectable()
export class PlatformNormalizerService {
  detectPlatform(url: string): AdPlatform {
    const u = url.toLowerCase();
    if (u.includes('facebook.com') || u.includes('instagram.com') || u.includes('fb.com')) return 'meta';
    if (u.includes('tiktok.com')) return 'tiktok';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('google.com') || u.includes('doubleclick.net')) return 'google';
    return 'web';
  }

  normalize(platform: AdPlatform, rawData: {
    brand: string;
    hook: string;
    copy: string;
    cta: string;
    emotionalTrigger: string;
    performanceSignal: number;
    landingPageStructure: string;
    sourceUrl: string;
  }): NormalizedAd {
    // Platform-specific format mapping
    const formats   = PLATFORM_FORMATS[platform];
    const ctaLower  = rawData.cta.toLowerCase();
    let creativeFormat = formats[0]; // default

    if (platform === 'meta') {
      if (rawData.hook.split(' ').length < 5) creativeFormat = 'single_image';
      else if (rawData.copy.length > 100)      creativeFormat = 'carousel';
      else                                      creativeFormat = 'video';
    } else if (platform === 'tiktok') {
      creativeFormat = rawData.hook.includes('?') ? 'spark_ad' : 'short_video';
    } else if (platform === 'google') {
      creativeFormat = ctaLower.includes('buy') || ctaLower.includes('shop') ? 'performance_max' : 'responsive_search';
    } else if (platform === 'youtube') {
      creativeFormat = rawData.copy.length > 50 ? 'pre_roll' : 'bumper_ad';
    }

    // Emotional trigger: use raw or fall back to platform bias
    const emotionalTrigger = rawData.emotionalTrigger !== 'neutral'
      ? rawData.emotionalTrigger
      : PLATFORM_BIASES[platform];

    // Engagement signal: modulate by platform (TikTok and YouTube amplify)
    const platformMultiplier = platform === 'tiktok' ? 1.15 : platform === 'youtube' ? 1.1 : 1.0;
    const engagementSignal   = +Math.min(1, rawData.performanceSignal * platformMultiplier).toFixed(3);

    return {
      id:                   randomUUID(),
      platform,
      brand:                rawData.brand,
      hook:                 rawData.hook.slice(0, 120),
      creativeFormat,
      emotionalTrigger,
      cta:                  rawData.cta.slice(0, 60),
      engagementSignal,
      estimatedPerformance: rawData.performanceSignal,
      landingPagePattern:   rawData.landingPageStructure,
      sourceUrl:            rawData.sourceUrl,
      scrapedAt:            new Date(),
      source:               'multi_platform_intelligence',
    };
  }
}
