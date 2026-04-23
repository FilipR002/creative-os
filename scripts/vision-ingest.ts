#!/usr/bin/env ts-node
// ─── Phase 8.2 — Vision Ingestion Batch Script ────────────────────────────────
//
// Reads:  ~/Desktop/resources/<folder name>/
// Sends:  each image → Claude Vision API
// Saves:  structured insights → Creative OS API (POST /angle-insights/bulk)
//
// Features:
//   • Concurrency pool   — N images processed in parallel
//   • Retry/backoff      — 3 attempts, exponential delay
//   • Checkpoint file    — resume after crash (skips already-processed images)
//   • Progress bar       — live terminal output
//   • Batch DB writes    — buffers N results then flushes
//
// Usage:
//   npx ts-node -r tsconfig-paths/register scripts/vision-ingest.ts
//   npx ts-node -r tsconfig-paths/register scripts/vision-ingest.ts --concurrency 3
//   npx ts-node -r tsconfig-paths/register scripts/vision-ingest.ts --dry-run
// ─────────────────────────────────────────────────────────────────────────────

import * as fs       from 'fs';
import * as path     from 'path';
import * as os       from 'os';
import axios         from 'axios';
import * as dotenv   from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const RESOURCES_DIR   = path.join(os.homedir(), 'Desktop', 'resources');
const CHECKPOINT_FILE = path.join(__dirname, '.vision-checkpoint.json');
const API_BASE        = 'http://localhost:4000';
const API_USER_ID     = 'vision-ingest-script';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const MODEL             = 'claude-opus-4-5';

const CONCURRENCY       = Number(getArg('--concurrency') ?? 5);
const BATCH_FLUSH_SIZE  = 10;
const DRY_RUN           = process.argv.includes('--dry-run');

const SUPPORTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// ── Folder → angleSlug mapping ────────────────────────────────────────────────
// Maps real folder names (with spaces) to system angle slugs.
// Add entries here as you add more resource folders.

const FOLDER_TO_SLUG: Record<string, string> = {
  'before after':       'before_after',
  'behind the scenes':  'behind_the_scenes',
  'data inforgraphic':  'data_stats',
  'data infographic':   'data_stats',
  'new carousel ideas': 'tips_tricks',
  'show off goods':     'show_off',
  'spark conversation': 'spark_conversation',
  'teach something':    'teach',
  'tell a story':       'storytelling',
  'proof':              'proof',
  'curiosity':          'curiosity',
  'urgency':            'problem_solution',
  'hot take':           'hot_take',
  'do this not that':   'do_this_not_that',
};

// ── Vision prompt ─────────────────────────────────────────────────────────────

function buildPrompt(angleSlug: string): string {
  return `You are a Vision Intelligence System for an advertising analysis engine called Creative OS.

Analyze this advertising creative and extract structured, high-signal marketing intelligence.

angleSlug: ${angleSlug}

TASK: Extract WHY this ad works in marketing terms — NOT a description of what you see.

Focus on:
- Attention hook (what stops scroll in first 1–1.5 seconds)
- Psychological trigger (emotion driver)
- Conversion mechanism (why user would click/buy)
- Visual structure logic (layout pattern)
- CTA design intent (how action is triggered)

ANALYSIS PRIORITY:
1. Scroll-stopping mechanism (first 1.5s impact)
2. Emotional trigger (fear, curiosity, trust, urgency, aspiration)
3. Cognitive pattern (comparison, proof, transformation, authority)
4. Conversion path (why user takes action)
5. Layout structure (how attention flows visually)

RULES:
- Do NOT describe literal image content
- Convert everything into marketing meaning
- Be concise but high-signal
- Output ONLY valid JSON — no markdown, no extra text

Return this exact JSON schema:
{
  "angle": "${angleSlug}",
  "hook": "<primary attention trigger — what stops the scroll>",
  "layout": "<visual structure pattern>",
  "emotion": "<dominant psychological trigger>",
  "cta_style": "<CTA tone and structure>",
  "visual_elements": ["<element 1>", "<element 2>", "<element 3>"],
  "insight": "<why this ad works from a conversion psychology perspective>"
}`;
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

interface Checkpoint {
  processed: string[];   // list of "folder/filename" already done
  failed:    string[];   // list that failed all retries
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch {
      return { processed: [], failed: [] };
    }
  }
  return { processed: [], failed: [] };
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Retry / backoff ───────────────────────────────────────────────────────────

async function withRetry<T>(
  fn:       () => Promise<T>,
  attempts: number,
  label:    string,
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = i === attempts;
      const delay  = 1000 * Math.pow(2, i - 1);   // 1s, 2s, 4s
      if (isLast) throw err;
      log(`  ⚠ Retry ${i}/${attempts - 1} for ${label} (wait ${delay}ms): ${err.message ?? err}`);
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
// Runs tasks in parallel, at most `limit` at a time.

async function pool<T>(
  tasks:  (() => Promise<T>)[],
  limit:  number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let   next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      try {
        results[idx] = { status: 'fulfilled', value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// ── Claude Vision call ────────────────────────────────────────────────────────

interface VisionInsight {
  angle:           string;
  hook:            string;
  layout:          string;
  emotion:         string;
  cta_style:       string;
  visual_elements: string[];
  insight:         string;
}

async function analyzeImage(
  imagePath:  string,
  angleSlug:  string,
): Promise<VisionInsight> {
  const raw       = fs.readFileSync(imagePath);
  const b64       = raw.toString('base64');
  const ext       = path.extname(imagePath).toLowerCase().replace('.', '');
  const mediaType = ext === 'jpg' ? 'image/jpeg'
                  : ext === 'jpeg' ? 'image/jpeg'
                  : ext === 'png'  ? 'image/png'
                  : ext === 'webp' ? 'image/webp'
                  : ext === 'gif'  ? 'image/gif'
                  : 'image/jpeg';

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model:      MODEL,
      max_tokens: 800,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: b64 },
          },
          {
            type: 'text',
            text: buildPrompt(angleSlug),
          },
        ],
      }],
    },
    {
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      timeout: 30_000,
    },
  );

  const text    = response.data?.content?.[0]?.text ?? '';
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  // Direct parse
  try {
    return JSON.parse(cleaned) as VisionInsight;
  } catch {
    // Regex extraction fallback
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as VisionInsight;
    throw new Error(`Unparseable response: ${cleaned.slice(0, 120)}`);
  }
}

// ── DB flush via API ──────────────────────────────────────────────────────────

interface InsightRecord {
  angleSlug:      string;
  imageUrl:       string;
  hook:           string;
  layout:         string;
  emotion:        string;
  ctaStyle:       string;
  visualElements: string[];
  insight:        string;
  sourceFolder:   string;
  model:          string;
}

async function flushBatch(batch: InsightRecord[]): Promise<void> {
  if (!batch.length) return;
  await axios.post(
    `${API_BASE}/angle-insights/bulk`,
    { items: batch },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id':    API_USER_ID,
      },
      timeout: 15_000,
    },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg: string) { process.stdout.write(msg + '\n'); }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

function toSlug(folderName: string): string {
  const mapped = FOLDER_TO_SLUG[folderName.toLowerCase()];
  if (mapped) return mapped;
  // Fallback: replace spaces with underscores
  return folderName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!ANTHROPIC_API_KEY && !DRY_RUN) {
    log('✖ ANTHROPIC_API_KEY not set in .env');
    process.exit(1);
  }
  if (!fs.existsSync(RESOURCES_DIR)) {
    log(`✖ Resources folder not found: ${RESOURCES_DIR}`);
    process.exit(1);
  }

  log('\n╔══════════════════════════════════════════════════════╗');
  log('║   Creative OS — Phase 8.2 Vision Ingestion           ║');
  log('╚══════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) log('⚡ DRY-RUN mode — no API calls, no DB writes\n');

  const cp = loadCheckpoint();
  const processedSet = new Set(cp.processed);

  // ── Collect all work items ─────────────────────────────────────────────────

  interface WorkItem {
    key:         string;   // "folder/filename" — checkpoint key
    imagePath:   string;
    angleSlug:   string;
    folderName:  string;
    filename:    string;
  }

  const allItems: WorkItem[] = [];

  const folders = fs.readdirSync(RESOURCES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const folder of folders) {
    const angleSlug = toSlug(folder);
    const folderPath = path.join(RESOURCES_DIR, folder);
    const files = fs.readdirSync(folderPath)
      .filter(f => SUPPORTED_EXT.has(path.extname(f).toLowerCase()));

    for (const file of files) {
      const key = `${folder}/${file}`;
      if (processedSet.has(key)) continue;   // already done — skip
      allItems.push({
        key,
        imagePath:  path.join(folderPath, file),
        angleSlug,
        folderName: folder,
        filename:   file,
      });
    }
  }

  const total   = allItems.length;
  const skipped = cp.processed.length;

  log(`📁 Folders found:    ${folders.length}`);
  log(`🖼  Images total:     ${total + skipped}`);
  log(`✅ Already done:     ${skipped}`);
  log(`🔄 To process:       ${total}`);
  log(`⚡ Concurrency:      ${CONCURRENCY}`);
  log(`💾 Batch flush size: ${BATCH_FLUSH_SIZE}\n`);

  if (total === 0) {
    log('✓ Nothing to process — all images already ingested.');
    return;
  }

  // ── Process ────────────────────────────────────────────────────────────────

  let done     = 0;
  let errors   = 0;
  const buffer: InsightRecord[] = [];

  async function flushIfFull(force = false): Promise<void> {
    if (buffer.length === 0) return;
    if (!force && buffer.length < BATCH_FLUSH_SIZE) return;
    const chunk = buffer.splice(0, buffer.length);
    if (!DRY_RUN) {
      await withRetry(() => flushBatch(chunk), 3, 'DB flush');
    }
    log(`  💾 Flushed ${chunk.length} insights to DB`);
  }

  const tasks = allItems.map(item => async () => {
    const label = `[${item.folderName}] ${item.filename}`;
    try {
      let insight: VisionInsight;

      if (DRY_RUN) {
        // Simulate without API call
        insight = {
          angle: item.angleSlug, hook: 'dry-run', layout: 'dry-run',
          emotion: 'dry-run', cta_style: 'dry-run',
          visual_elements: [], insight: 'dry-run',
        };
      } else {
        insight = await withRetry(
          () => analyzeImage(item.imagePath, item.angleSlug),
          3,
          label,
        );
      }

      buffer.push({
        angleSlug:      item.angleSlug,
        imageUrl:       item.imagePath,
        hook:           insight.hook,
        layout:         insight.layout,
        emotion:        insight.emotion,
        ctaStyle:       insight.cta_style,
        visualElements: insight.visual_elements ?? [],
        insight:        insight.insight,
        sourceFolder:   item.folderName,
        model:          MODEL,
      });

      if (!DRY_RUN) {
        cp.processed.push(item.key);
        saveCheckpoint(cp);
      }
      done++;

      await flushIfFull();

      const pct = Math.round((done / total) * 100);
      log(`  ✓ [${done}/${total}] ${pct}% — ${label}`);
    } catch (err: any) {
      errors++;
      if (!DRY_RUN) {
        cp.failed.push(item.key);
        saveCheckpoint(cp);
      }
      log(`  ✖ FAILED [${done + errors}/${total}] — ${label}: ${err.message ?? err}`);
    }
  });

  await pool(tasks, CONCURRENCY);

  // Final flush
  await flushIfFull(true);
  saveCheckpoint(cp);

  // ── Summary ────────────────────────────────────────────────────────────────

  log('\n╔══════════════════════════════════════════════════════╗');
  log('║   INGEST COMPLETE                                     ║');
  log('╚══════════════════════════════════════════════════════╝');
  log(`  ✅ Success:  ${done}`);
  log(`  ✖  Failed:   ${errors}`);
  log(`  💾 Total in DB (cumulative): ${cp.processed.length}`);
  if (errors > 0) {
    log(`\n  Failed items saved to checkpoint — rerun to retry.`);
  }
  log('');
}

main().catch(err => {
  log(`\n✖ Fatal: ${err.message ?? err}`);
  process.exit(1);
});
