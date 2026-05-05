// ─── Style Translator Service ─────────────────────────────────────────────────
//
// The missing bridge between learned style weights and compositor parameters.
//
// Previously, carousel.service and banner.service computed colorScheme with a
// single naive rule:
//   colorScheme = (tone === 'premium' || tone === 'minimal') ? 'light' : 'dark'
// and fontPairingId was NEVER set — so selectFontPairing() randomly rotated
// through 2-3 pairings for the tone every second, creating the "same font" loop.
//
// This service reads both the user's learned style profile AND the top Creative
// DNA visual dimensions, then returns exact compositor parameters. DNA always
// wins when available (it reflects what actually performed) — style profile is
// the fallback when DNA is sparse.
//
// Usage:
//   const style = await this.styleTranslator.resolveCompositorStyle(userId, baseTone);
//   // returns: { tone, colorScheme, fontPairingId, accentColor? }

import { Injectable, Logger } from '@nestjs/common';
import type { AdTone, ColorScheme } from '../compositor/types/compositor.types';
import { UserStyleService }        from './user-style.service';
import { CreativeDNAService }      from '../creative-dna/creative-dna.service';
import type { StyleProfileResponse } from './user-style.types';
import type { AngleVisualOverrides }  from '../evolution/evolution.types';

const THRESHOLD = 0.63; // weight above which a preference is "active"

export interface CompositorStyleParams {
  tone:           AdTone;
  colorScheme:    ColorScheme;
  fontPairingId:  string;
  accentColor?:   string;
}

@Injectable()
export class StyleTranslatorService {
  private readonly logger = new Logger(StyleTranslatorService.name);

  constructor(
    private readonly userStyle : UserStyleService,
    private readonly dna       : CreativeDNAService,
  ) {}

  /**
   * Resolve full compositor style params for a userId.
   *
   * Priority chain (highest → lowest):
   *   1. angleOverrides  — set by visual-type evolution mutations on Angle.visualOverrides
   *   2. dnaHints        — CreativeDNA top visual dimensions (what performed best)
   *   3. profile         — learned EWMA style weights
   *   4. baseTone        — angle-label tone (naive fallback)
   *
   * @param userId          - the user whose style profile to read
   * @param baseTone        - the angle-derived tone (caller's current naive pick)
   * @param primaryColor    - optional brand hex already on the campaign
   * @param angleOverrides  - optional visual overrides from a visually-mutated angle
   */
  async resolveCompositorStyle(
    userId:          string,
    baseTone:        AdTone,
    primaryColor?:   string,
    angleOverrides?: AngleVisualOverrides | null,
  ): Promise<CompositorStyleParams> {
    // Fetch both sources in parallel
    const [profile, dnaHints] = await Promise.all([
      this.userStyle.getProfile(userId).catch(() => null),
      this.dna.getCompositorHints().catch(() => null),
    ]);

    // 1. Tone — angle override wins, then style weights, then baseTone
    const tone: AdTone =
      (angleOverrides?.tone as AdTone | undefined) ??
      (profile ? this.deriveTone(profile, baseTone) : baseTone);

    // 2. Color scheme — angle override wins (via colorMood), then DNA, then profile, then fallback
    const colorScheme: ColorScheme =
      (angleOverrides?.colorMood ? this.colorMoodToScheme(angleOverrides.colorMood) : undefined) ??
      dnaHints?.colorScheme ??
      (profile ? this.deriveColorScheme(profile, tone) : this.toneToColorScheme(tone));

    // 3. Font pairing — angle override wins (via typographyStyle), then DNA, then profile, then fallback
    const fontPairingId: string =
      (angleOverrides?.typographyStyle ? this.typographyStyleToFontPairing(angleOverrides.typographyStyle, tone) : undefined) ??
      dnaHints?.fontPairingId ??
      (profile ? this.deriveFontPairingId(profile, tone, colorScheme) : this.toneToFontPairing(tone, colorScheme));

    // 4. Accent color — only when DNA says high-contrast and no brand color set
    const accentColor = primaryColor ?? (
      dnaHints?.highContrast && colorScheme === 'dark' ? '#F97316' : undefined
    );

    this.logger.debug(
      `[StyleTranslator] userId=${userId} ` +
      `baseTone=${baseTone} → tone=${tone} scheme=${colorScheme} font=${fontPairingId} ` +
      `(angleOverrides=${!!angleOverrides} dnaHints=${!!dnaHints} profile=${!!profile})`,
    );

    return { tone, colorScheme, fontPairingId, accentColor };
  }

  // ── colorMood → ColorScheme (for visual mutation overrides) ─────────────────

  private colorMoodToScheme(colorMood: string): ColorScheme | undefined {
    switch (colorMood) {
      case 'dark':       return 'dark';
      case 'light':      return 'light';
      case 'vibrant':    return 'gradient';
      case 'muted':      return 'light';
      case 'monochrome': return 'dark';
      case 'warm':       return 'brand';
      case 'cool':       return 'dark';
      default:           return undefined;
    }
  }

  // ── typographyStyle → fontPairingId (for visual mutation overrides) ──────────

  private typographyStyleToFontPairing(typographyStyle: string, tone: AdTone): string | undefined {
    switch (typographyStyle) {
      case 'display-serif':   return 'editorial-serif';
      case 'editorial':       return 'luxury-editorial';
      case 'modern-sans':     return 'modern-clean';
      case 'geometric-bold':  return 'impact-modern';
      case 'punchy':          return 'punchy';
      case 'tech-saas':       return 'tech-saas';
      case 'heavy-condensed': return 'heavy-condensed';
      case 'warm-soft':       return 'warm-soft';
      case 'sharp-modern':    return 'sharp-modern';
      default:                return undefined;
    }
  }

  // ── Tone derivation ──────────────────────────────────────────────────────────
  // Maps the highest active style weight to the closest AdTone.
  // Keeps the angle-derived baseTone when no weight exceeds threshold.

  private deriveTone(profile: StyleProfileResponse, baseTone: AdTone): AdTone {
    const candidates: [AdTone, number][] = [
      ['premium',   profile.tonePremium],
      ['bold',      profile.toneAggressive],
      ['urgent',    profile.ctaUrgency],
      ['friendly',  profile.toneEmotional],
      ['minimal',   profile.toneCasual],
    ];

    const active = candidates.filter(([, s]) => s > THRESHOLD);
    if (!active.length) return baseTone;

    // Pick whichever active tone has the highest weight
    const [tone] = active.reduce((a, b) => b[1] > a[1] ? b : a);
    return tone;
  }

  // ── Color scheme derivation ──────────────────────────────────────────────────
  // Nuanced — considers BOTH the tone AND the relative premium/casual weights
  // so a "bold" user who also has high premium gets light-dark hybrid treatment.

  private deriveColorScheme(profile: StyleProfileResponse, tone: AdTone): ColorScheme {
    switch (tone) {
      case 'premium':
        // Premium always light — unless very high emotional (lifestyle brand)
        return profile.toneEmotional > 0.75 ? 'gradient' : 'light';

      case 'bold':
        // Bold + premium blend → brand; pure bold → dark
        return profile.tonePremium > 0.60 ? 'brand' : 'dark';

      case 'urgent':
        // Urgency is always high-contrast dark
        return 'dark';

      case 'friendly':
        // Friendly + premium → light; purely emotional → gradient
        if (profile.tonePremium > 0.60) return 'light';
        if (profile.toneEmotional > 0.75) return 'gradient';
        return 'dark';

      case 'energetic':
        return 'gradient';

      case 'minimal':
      default:
        // Minimal: premium leaning → light, aggressive leaning → dark
        return profile.tonePremium > profile.toneAggressive ? 'light' : 'dark';
    }
  }

  // ── Font pairing derivation ──────────────────────────────────────────────────
  // Maps to actual IDs in font-library.ts — every ID here must exist there.
  // Intensity matters: very high weights get the more extreme pairings.

  private deriveFontPairingId(
    profile:     StyleProfileResponse,
    tone:        AdTone,
    colorScheme: ColorScheme,
  ): string {
    switch (tone) {
      case 'premium':
        // Very premium → full luxury serif; moderate → standard editorial
        return profile.tonePremium > 0.80 ? 'luxury-editorial' : 'editorial-serif';

      case 'bold':
        // Very aggressive → Anton (punchy); standard bold → Bebas Neue (impact-modern)
        return profile.toneAggressive > 0.80 ? 'punchy' : 'impact-modern';

      case 'urgent':
        // Very urgent → Oswald condensed; standard → Barlow black
        return profile.ctaUrgency > 0.80 ? 'heavy-condensed' : 'black-grotesque';

      case 'friendly':
        // Very emotional → Nunito (warm-soft); standard → Poppins (friendly-rounded)
        return profile.toneEmotional > 0.80 ? 'warm-soft' : 'friendly-rounded';

      case 'minimal':
        // Light scheme → sharp geometric; dark scheme → tech/SaaS feel
        return colorScheme === 'light' ? 'sharp-modern' : 'tech-saas';

      case 'energetic':
        return 'black-grotesque';

      default:
        return 'modern-clean';
    }
  }

  // ── Tone-only fallbacks (used when no profile exists) ────────────────────────

  private toneToColorScheme(tone: AdTone): ColorScheme {
    if (tone === 'premium' || tone === 'minimal') return 'light';
    if (tone === 'energetic') return 'gradient';
    return 'dark';
  }

  private toneToFontPairing(tone: AdTone, scheme: ColorScheme): string {
    switch (tone) {
      case 'premium':   return 'editorial-serif';
      case 'bold':      return 'impact-modern';
      case 'urgent':    return 'heavy-condensed';
      case 'friendly':  return 'friendly-rounded';
      case 'energetic': return 'punchy';
      case 'minimal':   return scheme === 'light' ? 'sharp-modern' : 'tech-saas';
      default:          return 'modern-clean';
    }
  }
}
