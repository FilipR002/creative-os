/**
 * In-memory job store.
 * Stitching takes 15-90s — the API returns a jobId immediately,
 * caller polls GET /stitch/:jobId until status === 'done' | 'failed'.
 */

import { Job } from './types';

const jobs = new Map<string, Job>();

export function createJob(id: string, request: Job['request']): Job {
  const job: Job = { id, status: 'queued', request, createdAt: Date.now() };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...patch });
}
