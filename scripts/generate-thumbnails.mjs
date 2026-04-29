/**
 * generate-thumbnails.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders all 30 compositor templates with dummy copy → saves PNG thumbnails
 * to frontend/public/templates/{id}.png
 *
 * Usage:
 *   node scripts/generate-thumbnails.mjs
 *   API_URL=https://your-railway-url.up.railway.app node scripts/generate-thumbnails.mjs
 *
 * Requirements: backend must be running (local or remote), Puppeteer must work.
 * After running, commit frontend/public/templates/*.png to git.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname }            from 'path';
import { fileURLToPath }            from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../frontend/public/templates');
const API_BASE   = process.env.API_URL ?? 'http://localhost:4000';

// ── Template definitions (mirrors TEMPLATE_CATALOG on the backend) ────────────

const TEMPLATES = [
  // Base 5
  { id: 'full-bleed',           tone: 'bold',      requiresImage: true  },
  { id: 'split-panel',          tone: 'minimal',   requiresImage: true  },
  { id: 'bold-headline',        tone: 'bold',      requiresImage: false },
  { id: 'minimal',              tone: 'minimal',   requiresImage: false },
  { id: 'ugc-style',            tone: 'friendly',  requiresImage: true  },
  // Extended 10
  { id: 'testimonial',          tone: 'friendly',  requiresImage: false },
  { id: 'stats-hero',           tone: 'bold',      requiresImage: false },
  { id: 'feature-list',         tone: 'minimal',   requiresImage: false },
  { id: 'cta-final',            tone: 'bold',      requiresImage: false },
  { id: 'gradient-pop',         tone: 'bold',      requiresImage: false },
  { id: 'dark-luxury',          tone: 'premium',   requiresImage: true  },
  { id: 'bright-minimal',       tone: 'minimal',   requiresImage: false },
  { id: 'story-hook',           tone: 'bold',      requiresImage: true  },
  { id: 'problem-slide',        tone: 'urgent',    requiresImage: false },
  { id: 'text-only-bold',       tone: 'bold',      requiresImage: false },
  // Extended Batch 2
  { id: 'product-center',       tone: 'minimal',   requiresImage: true  },
  { id: 'neon-dark',            tone: 'energetic', requiresImage: false },
  { id: 'magazine-editorial',   tone: 'premium',   requiresImage: true  },
  { id: 'color-block',          tone: 'bold',      requiresImage: false },
  { id: 'floating-card',        tone: 'minimal',   requiresImage: false },
  { id: 'countdown-urgency',    tone: 'urgent',    requiresImage: false },
  { id: 'social-proof-grid',    tone: 'friendly',  requiresImage: false },
  { id: 'headline-badge',       tone: 'bold',      requiresImage: false },
  { id: 'side-by-side',         tone: 'minimal',   requiresImage: false },
  { id: 'diagonal-split',       tone: 'energetic', requiresImage: true  },
  { id: 'overlay-card',         tone: 'premium',   requiresImage: true  },
  { id: 'number-list',          tone: 'minimal',   requiresImage: false },
  { id: 'brand-manifesto',      tone: 'bold',      requiresImage: false },
  { id: 'product-demo',         tone: 'minimal',   requiresImage: true  },
  { id: 'retro-bold',           tone: 'energetic', requiresImage: false },
];

// Placeholder image URL for templates that require a background photo
// Using Unsplash — simple lifestyle/abstract image that looks good across tones
const PLACEHOLDER_IMAGES = {
  bold:      'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1080&h=1080&fit=crop',
  minimal:   'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1080&h=1080&fit=crop',
  premium:   'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1080&h=1080&fit=crop',
  friendly:  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1080&h=1080&fit=crop',
  urgent:    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&h=1080&fit=crop',
  energetic: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1080&h=1080&fit=crop',
};

// Dummy copy for thumbnail rendering — snappy, looks real at a glance
const DUMMY_COPY = {
  headline: 'Transform Your Brand',
  body:     'AI-powered creatives that convert',
  cta:      'Get Started Free',
  eyebrow:  'NEW',
  subtext:  'Trusted by 10,000+ marketers',
};

// ── Render one template thumbnail ─────────────────────────────────────────────

async function renderThumbnail(template) {
  const colorScheme =
    template.tone === 'minimal' || template.tone === 'premium' ? 'light' : 'dark';

  const body = {
    input: {
      templateId: template.id,
      size:       '1080x1080',
      copy:        DUMMY_COPY,
      imageUrl:    template.requiresImage ? PLACEHOLDER_IMAGES[template.tone] : undefined,
      style: {
        tone:        template.tone,
        platform:    'instagram',
        colorScheme,
      },
    },
  };

  const res = await fetch(`${API_BASE}/api/compositor/render`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error');
    throw new Error(text);
  }

  const data    = await res.json();
  const dataUrl = data.imageDataUrl ?? '';
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error(`Unexpected response format: ${dataUrl.slice(0, 60)}`);
  }

  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Creative OS — Template Thumbnail Generator   ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`\nAPI:    ${API_BASE}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Count:  ${TEMPLATES.length} templates\n`);

  // Quick connectivity check
  try {
    const ping = await fetch(`${API_BASE}/api/compositor/health`);
    if (!ping.ok) throw new Error(`status ${ping.status}`);
    console.log('✓ Backend connected\n');
  } catch (err) {
    console.error(`✗ Cannot reach backend at ${API_BASE}`);
    console.error(`  ${err.message}`);
    console.error('\nMake sure the backend is running:');
    console.error('  cd creative-os && npm run start:dev\n');
    process.exit(1);
  }

  let success = 0;
  let failed  = 0;
  const errors = [];

  for (const template of TEMPLATES) {
    const pad = template.id.padEnd(22, ' ');
    process.stdout.write(`  ${pad} `);

    try {
      const png     = await renderThumbnail(template);
      const outPath = join(OUTPUT_DIR, `${template.id}.png`);
      writeFileSync(outPath, png);
      const kb = (png.length / 1024).toFixed(0);
      console.log(`✓  ${kb} KB`);
       success++;
    } catch (err) {
      console.log(`✗  ${err.message}`);
      errors.push({ id: template.id, error: err.message });
      failed++;
    }
  }

  console.log('\n────────────────────────────────────────────────');
  console.log(`Done: ${success} succeeded, ${failed} failed`);

  if (errors.length > 0) {
    console.log('\nFailed templates:');
    errors.forEach(e => console.log(`  • ${e.id}: ${e.error}`));
  }

  if (success > 0) {
    console.log('\nNext step — commit the thumbnails to git:');
    console.log('  git add frontend/public/templates/*.png');
    console.log('  git commit -m "feat: add template thumbnail PNGs"');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
