import type { ResourceContext } from './resources.service';

/**
 * Build a persona + product/brand enrichment block to inject into any Claude prompt.
 * Returns an empty string when no context is available.
 */
export function buildPersonaBlock(ctx: ResourceContext | undefined): string {
  if (!ctx) return '';

  const lines: string[] = [];

  // Product section
  if (ctx.productName || ctx.productDescription || ctx.productBenefits?.length) {
    lines.push('PRODUCT CONTEXT:');
    if (ctx.productName)        lines.push(`- Product: ${ctx.productName}`);
    if (ctx.productDescription) lines.push(`- Description: ${ctx.productDescription}`);
    if (ctx.productBenefits?.length) {
      lines.push(`- Key benefits: ${ctx.productBenefits.join(', ')}`);
    }
  }

  // Brand section
  if (ctx.brandTone || ctx.brandVoice) {
    lines.push('BRAND VOICE:');
    if (ctx.brandTone)  lines.push(`- Tone: ${ctx.brandTone}`);
    if (ctx.brandVoice) lines.push(`- Voice: ${ctx.brandVoice}`);
  }

  // Persona section (most important for targeting)
  if (ctx.persona) {
    const p = ctx.persona;
    lines.push('TARGET PERSONA (tailor every word for this specific person):');
    lines.push(`- Name: ${p.name}`);
    lines.push(`- Who they are: ${p.description}`);
    if (p.demographics)        lines.push(`- Demographics: ${p.demographics}`);
    if (p.painPoints?.length)  lines.push(`- Pain points: ${p.painPoints.join('; ')}`);
    if (p.desires?.length)     lines.push(`- Desires / goals: ${p.desires.join('; ')}`);
    lines.push('Use their pain points as hooks. Speak to their desires as the outcome. Write like you know them personally.');
  }

  if (!lines.length) return '';
  return '\n' + lines.join('\n') + '\n';
}
