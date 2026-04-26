import { exec }   from 'child_process';
import { promisify } from 'util';
import axios         from 'axios';
import fs            from 'fs';
import path          from 'path';

const execAsync = promisify(exec);

const TEMP_DIR    = path.join(process.cwd(), 'temp');
const OUTPUTS_DIR = path.join(process.cwd(), 'outputs');

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
  jobId:       string,
  sceneUrls:   string[],
  transitions: 'cut' | 'fade' = 'cut',
  audioUrl?:   string,
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

    // ── 2. Download optional audio ───────────────────────────────────────────
    let audioPath: string | null = null;
    if (audioUrl) {
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

    // ── 4. Run FFmpeg ────────────────────────────────────────────────────────
    const outputPath = path.join(OUTPUTS_DIR, `${jobId}.mp4`);

    let cmd: string;

    if (transitions === 'fade') {
      // Crossfade via xfade filter — works for 2+ clips, chain dynamically
      cmd = buildFadeCmd(localFiles, outputPath, audioPath);
    } else {
      // Simple concat (fast, frame-accurate)
      cmd = buildCutCmd(concatFile, outputPath, audioPath);
    }

    await execAsync(cmd, { timeout: 300_000 }); // 5-min max

    // ── 5. Get duration via ffprobe ──────────────────────────────────────────
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
