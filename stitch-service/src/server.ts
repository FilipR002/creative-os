import express, { Request, Response, NextFunction } from 'express';
import path                                          from 'path';
import { v4 as uuidv4 }                              from 'uuid';
import { stitchScenes }                              from './ffmpeg.engine';
import { storeVideo }                                from './storage.service';
import { createJob, getJob, updateJob }              from './jobs.store';
import { StitchRequest }                             from './types';

const app  = express();
const PORT = Number(process.env.PORT ?? 3100);

app.use(express.json({ limit: '1mb' }));

// Serve finished videos (local storage mode)
app.use('/outputs', express.static(path.join(process.cwd(), 'outputs')));

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── POST /stitch — enqueue a stitch job ──────────────────────────────────────

app.post('/stitch', (req: Request, res: Response) => {
  const body = req.body as Partial<StitchRequest>;

  if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
    res.status(400).json({ error: '`scenes` must be a non-empty array of URLs' });
    return;
  }
  if (body.scenes.length > 20) {
    res.status(400).json({ error: 'Maximum 20 scenes per stitch job' });
    return;
  }

  const jobId = uuidv4();
  const job   = createJob(jobId, {
    scenes:      body.scenes,
    transitions: body.transitions ?? 'cut',
    audio:       body.audio,
    format:      body.format ?? '9:16',
  });

  // Fire-and-forget — caller polls GET /stitch/:jobId
  runJob(jobId).catch(() => { /* errors are written into the job record */ });

  res.status(202).json({ jobId, status: job.status });
});

// ── GET /stitch/:jobId — poll job status ─────────────────────────────────────

app.get('/stitch/:jobId', (req: Request, res: Response) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({
    jobId:       job.id,
    status:      job.status,
    videoUrl:    job.videoUrl,
    duration:    job.duration,
    scenes:      job.scenes,
    error:       job.error,
    createdAt:   job.createdAt,
    completedAt: job.completedAt,
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[stitch-service]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[stitch-service] listening on port ${PORT}`);
});

// ── Job runner ────────────────────────────────────────────────────────────────

async function runJob(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;

  updateJob(jobId, { status: 'processing' });

  try {
    const { outputPath, duration } = await stitchScenes(
      jobId,
      job.request.scenes,
      job.request.transitions ?? 'cut',
      job.request.audio,
    );

    const videoUrl = await storeVideo(jobId, outputPath);

    updateJob(jobId, {
      status:      'done',
      videoUrl,
      duration,
      scenes:      job.request.scenes.length,
      completedAt: Date.now(),
    });

    console.log(`[stitch-service] job ${jobId} done → ${videoUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stitch-service] job ${jobId} failed: ${message}`);
    updateJob(jobId, {
      status:      'failed',
      error:       message,
      completedAt: Date.now(),
    });
  }
}
