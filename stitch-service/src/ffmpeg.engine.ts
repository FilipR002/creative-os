import { exec }   from 'child_process';
import { promisify } from 'util';
import axios         from 'axios';
import fs            from 'fs';
import path          from 'path';

import type { TextOverlay } from './types';

const execAsync = promisify(exec);

const TEMP_DIR    = path.join(process.cwd(), 'temp');
const OUTPUTS_DIR = path.join(process.cwd(), 'outputs');

// DejaVu Bold — installed in Docker via fonts-dejavu-core
const FONT_FILE = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

// Ensure dirs exist on startup
fs.mkdirSync(TEMP_DIR,    { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await axios.get<NodeJS.ReadableStream>(url, {
    responseType: 'stream',
    timeout:      30_000,
  });
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(dest);
    (res.data as NodeJS.ReadableStream).pipe(writer);
    writer.on('finish', resolve);
    writer.on('error',  reject);
  });
}

function cleanup(files: string[]): void {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch { /* best-effort */ }
  }
}

export async function stitchScenes(
  jobId:         string,
  sceneUrls:     string[],
  transitions:   'cut' | 'fade' = 'cut',
  audioUrl?:     string,
  textOverlays?: TextOverlay[],
  audioBase64?:  string,
): Promise<{ outputPath: string; duration: number }> {

  const tempFiles:  string[] = [];
  const localFiles: string[] = [];

  try {
    // ── 1. Download all scenes ───────────────────────────────────────────────
    for (let i = 0; i < sceneUrls.length; i++) {
      const dest = path.join(TEMP_DIR, `${jobId}_scene_${i}.mp4`);
      await downloadFile(sceneUrls[i], dest);
      localFiles.push(dest);
      tempFiles.push(dest);
    }

    // ── 2. Resolve audio — base64 takes priority over URL ───────────────────
    let audioPath: string | null = null;
    if (audioBase64) {
      // Phase 5: ElevenLabs voiceover — decode base64 MP3 to temp file
      audioPath = path.join(TEMP_DIR, `${jobId}_audio.mp3`);
      const buf = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(audioPath, buf);
      tempFiles.push(audioPath);
      console.log(`[ffmpeg] audioBase64 decoded → ${buf.byteLength} bytes`);
    } else if (audioUrl) {
      audioPath = path.join(TEMP_DIR, `${jobId}_audio.mp3`);
      await downloadFile(audioUrl, audioPath);
      tempFiles.push(audioPath);
    }

    // ── 3. Build concat list ─────────────────────────────────────────────────
    const concatFile = path.join(TEMP_DIR, `${jobId}_concat.txt`);
    fs.writeFileSync(
      concatFile,
      localFiles.map(f => `file '${f}'`).join('\n'),
    );
    tempFiles.push(concatFile);

    // ── 4. Run FFmpeg stitch ─────────────────────────────────────────────────
    // If text overlays requested: stitch to intermediate, then burn text in a second pass.
    // Otherwise: stitch directly to final output.
    const hasOverlays = Array.isArray(textOverlays) && textOverlays.length > 0;
    const stitchOutput = hasOverlays
      ? path.join(TEMP_DIR, `${jobId}_stitched.mp4`)
      : path.join(OUTPUTS_DIR, `${jobId}.mp4`);

    if (hasOverlays) tempFiles.push(stitchOutput);

    let stitchCmd: string;

    if (transitions === 'fade') {
      stitchCmd = buildFadeCmd(localFiles, stitchOutput, audioPath);
    } else {
      stitchCmd = buildCutCmd(concatFile, stitchOutput, audioPath);
    }

    await execAsync(stitchCmd, { timeout: 300_000 }); // 5-min max

    // ── 5. Text burn-in pass (Phase 3 — no diffusion text hallucinations) ───
    const outputPath = path.join(OUTPUTS_DIR, `${jobId}.mp4`);

    if (hasOverlays) {
      // Write each text to a temp file to avoid FFmpeg escaping issues
      const textFiles: string[] = [];
      const validOverlays = textOverlays!.filter(o => o.text.trim().length > 0);

      for (let i = 0; i < validOverlays.length; i++) {
        const textFile = path.join(TEMP_DIR, `${jobId}_text_${i}.txt`);
        fs.writeFileSync(textFile, sanitizeText(validOverlays[i].text), 'utf8');
        textFiles.push(textFile);
        tempFiles.push(textFile);
      }

      const drawFilters = validOverlays.map((overlay, i) => buildDrawtextFilter(
        textFiles[i],
        overlay.startTime,
        overlay.endTime,
      )).join(',');

      const burnCmd = (
        `ffmpeg -y -i "${stitchOutput}" ` +
        `-vf "${drawFilters}" ` +
        `-c:v libx264 -preset fast -crf 23 -movflags +faststart ` +
        `-c:a copy "${outputPath}"`
      );

      await execAsync(burnCmd, { timeout: 120_000 }); // 2-min max for text burn
    }

    // ── 6. Get duration via ffprobe ──────────────────────────────────────────
    let duration = sceneUrls.length * 5; // fallback estimate
    try {
      const probe = await execAsync(
        `ffprobe -v error -show_entries format=duration ` +
        `-of default=noprint_wrappers=1:nokey=1 "${outputPath}"`,
      );
      duration = Math.round(parseFloat(probe.stdout.trim()));
    } catch { /* use estimate */ }

    return { outputPath, duration };

  } finally {
    cleanup(tempFiles);
  }
}

// ── Text sanitisation (for textfile content) ─────────────────────────────────

/**
 * Sanitize text written to the drawtext textfile.
 * FFmpeg textfile content is plain UTF-8; newlines become line breaks.
 * We strip control characters and trim.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\r/g, '')           // remove CR
    .replace(/\t/g, ' ')          // tabs → spaces
    .trim()
    .slice(0, 120);               // hard cap so it fits on screen
}

// ── drawtext filter builder ───────────────────────────────────────────────────

/**
 * Build a single FFmpeg drawtext filter segment.
 *
 * Design: lower-third placement (y = 78% of height), white text,
 * semi-transparent black box, DejaVu Bold, 52pt.
 * `textfile` avoids all escaping issues — the file holds raw UTF-8 text.
 */
function buildDrawtextFilter(
  textFilePath: string,
  startTime:    number,
  endTime:      number,
): string {
  // FFmpeg filter value escaping: colons and backslashes in VALUES must be escaped.
  // textfile path uses forward slashes; no special chars in our /tmp paths.
  const safeFilePath = textFilePath.replace(/\\/g, '/');

  return [
    `drawtext=textfile='${safeFilePath}'`,
    `enable='between(t,${startTime.toFixed(2)},${endTime.toFixed(2)})'`,
    fs.existsSync(FONT_FILE) ? `fontfile='${FONT_FILE}'` : 'font=DejaVu',
    'fontsize=52',
    'fontcolor=white',
    'x=(w-text_w)/2',
    'y=h*0.78',
    'box=1',
    'boxcolor=black@0.55',
    'boxborderw=18',
    'line_spacing=6',
  ].join(':');
}

// ── FFmpeg command builders ──────────────────────────────────────────────────

function buildCutCmd(
  concatFile: string,
  output:     string,
  audio?:     string | null,
): string {
  const audioFlags = audio
    ? `-i "${audio}" -c:a aac -shortest`
    : '-an';

  return (
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" ` +
    `-c:v libx264 -preset fast -crf 23 -movflags +faststart ` +
    `${audioFlags} "${output}"`
  );
}

function buildFadeCmd(
  files:  string[],
  output: string,
  audio?: string | null,
): string {
  if (files.length === 1) return buildCutCmd(
    // single file — just re-encode cleanly
    (() => { const f = path.join(path.dirname(files[0]), '_single.txt'); fs.writeFileSync(f, `file '${files[0]}'`); return f; })(),
    output,
    audio,
  );

  // Build complex xfade filter for N clips
  const FADE_DURATION = 0.5; // seconds
  const inputs  = files.map(f => `-i "${f}"`).join(' ');

  // Each clip is assumed ~5 s; track offset per clip
  let filterParts = '';
  let lastLabel   = '[0:v]';
  let offset      = 0;

  for (let i = 1; i < files.length; i++) {
    const nextLabel = i === files.length - 1 ? '[vout]' : `[v${i}]`;
    offset += 5 - FADE_DURATION; // approximate per-clip duration
    filterParts +=
      `${lastLabel}[${i}:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset}${nextLabel};`;
    lastLabel = nextLabel;
  }
  // Remove trailing semicolon
  filterParts = filterParts.replace(/;$/, '');

  const audioFlags = audio
    ? `-i "${audio}" -map "[vout]" -map ${files.length}:a -c:a aac -shortest`
    : `-map "[vout]" -an`;

  return (
    `ffmpeg -y ${inputs} ` +
    `-filter_complex "${filterParts}" ` +
    `-c:v libx264 -preset fast -crf 23 -movflags +faststart ` +
    `${audioFlags} "${output}"`
  );
}
