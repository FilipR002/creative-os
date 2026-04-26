/**
 * storage.service.ts
 *
 * Pluggable storage layer.
 * Currently: serves files directly from the Railway service (local disk).
 *
 * To add R2 / S3:
 *   1. npm install @aws-sdk/client-s3
 *   2. Implement uploadToR2() below
 *   3. Set STORAGE_BACKEND=r2 + R2_* env vars
 *   4. Call uploadToR2(outputPath) instead of buildLocalUrl()
 */

import fs   from 'fs';
import path from 'path';

const BACKEND    = process.env.STORAGE_BACKEND ?? 'local';   // 'local' | 'r2' | 's3'
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'http://localhost:3100').replace(/\/$/, '');

export async function storeVideo(
  jobId:      string,
  outputPath: string,
): Promise<string> {
  if (BACKEND === 'local') {
    // File is already in outputs/ — just return a URL pointing to this service
    return `${PUBLIC_URL}/outputs/${path.basename(outputPath)}`;
  }

  // ── R2 / S3 stub ─────────────────────────────────────────────────────────
  // Uncomment + implement when you add credentials:
  //
  // if (BACKEND === 'r2') {
  //   return uploadToR2(jobId, outputPath);
  // }

  throw new Error(`Unknown STORAGE_BACKEND: ${BACKEND}`);
}

// Called after the URL has been handed back to the caller — clean up disk.
export function deleteLocalFile(outputPath: string): void {
  try { fs.unlinkSync(outputPath); } catch { /* best-effort */ }
}
