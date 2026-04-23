// ─── Phase 7 — Product API Client ────────────────────────────────────────────

import type { ProductGenerateResult, ProductProject } from '../types/product';

const BASE = '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function createProject(data: {
  name:      string;
  goal:      string;
  context:   string;
  client_id: string;
}): Promise<ProductProject> {
  return req<ProductProject>('/product/project', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function listProjects(clientId: string): Promise<ProductProject[]> {
  return req<ProductProject[]>(`/product/project?client_id=${encodeURIComponent(clientId)}`);
}

export function getProject(id: string): Promise<ProductProject> {
  return req<ProductProject>(`/product/project/${id}`);
}

// ── Generate ──────────────────────────────────────────────────────────────────

export function generateForProject(
  id:      string,
  opts?:   { emotion?: string; format?: string },
): Promise<ProductGenerateResult> {
  return req<ProductGenerateResult>(`/product/project/${id}/generate`, {
    method: 'POST',
    body:   JSON.stringify(opts ?? {}),
  });
}
