// ─── Typed API client — Phase 6.1 ────────────────────────────────────────────

import type {
  DecisionPageViewModel,
  MemorySnapshot,
  SystemStatus,
} from '../types/view-models';
import type { DecisionExecution } from '../types/execution';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Sync decide — returns complete execution result ───────────────────────────

export interface DecisionRequest {
  client_id:    string;
  campaign_id?: string;
  user_id?:     string;
  goal?:        string;
  emotion?:     string;
  format?:      string;
  industry?:    string;
}

export function runDecision(body: DecisionRequest): Promise<DecisionExecution> {
  return request<DecisionExecution>('/product/decision', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
}

// ── Async start — returns executionId immediately ─────────────────────────────

export async function startExecution(body: DecisionRequest): Promise<string> {
  const { executionId } = await request<{ executionId: string }>(
    '/product/execution/start',
    { method: 'POST', body: JSON.stringify(body) },
  );
  return executionId;
}

// ── Poll execution state ──────────────────────────────────────────────────────

export function pollExecution(id: string): Promise<DecisionExecution> {
  return request<DecisionExecution>(`/product/execution/${id}`);
}

// ── Poll until terminal phase ─────────────────────────────────────────────────
// Calls onUpdate after each poll. Resolves when completed or failed.

export async function pollUntilDone(
  id:         string,
  onUpdate:   (exec: DecisionExecution) => void,
  intervalMs = 400,
): Promise<DecisionExecution> {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const exec = await pollExecution(id);
        onUpdate(exec);
        if (exec.phase === 'completed' || exec.phase === 'failed') {
          resolve(exec);
        } else {
          setTimeout(tick, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };
    tick();
  });
}

// ── SSE stream — subscribes to execution events ───────────────────────────────
// Returns an EventSource. Caller should close() when done.

export function streamExecution(
  id:        string,
  onEvent:   (event: unknown) => void,
  onDone?:   () => void,
): EventSource {
  const es = new EventSource(`${BASE}/product/execution/${id}/stream`);
  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      onEvent(parsed);
      if (parsed.phase === 'completed' || parsed.phase === 'failed') {
        es.close();
        onDone?.();
      }
    } catch { /* ignore parse errors */ }
  };
  es.onerror = () => { es.close(); onDone?.(); };
  return es;
}

// ── Memory ────────────────────────────────────────────────────────────────────

export function fetchMemory(
  clientId:  string,
  industry?: string,
  angle?:    string,
): Promise<MemorySnapshot> {
  const params = new URLSearchParams({ client_id: clientId });
  if (industry) params.set('industry', industry);
  if (angle)    params.set('angle', angle);
  return request<MemorySnapshot>(`/product/memory?${params}`);
}

// ── Status ────────────────────────────────────────────────────────────────────

export function fetchStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/product/status');
}
