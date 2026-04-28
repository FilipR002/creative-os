// ─── Resources API Client ────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const BASE = API_URL && !API_URL.includes('localhost') ? API_URL : '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { getSupabase } = await import('../supabase');
  const { data: { session } } = await getSupabase().auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Persona {
  id:           string;
  resourceId:   string;
  name:         string;
  description:  string;
  painPoints:   string[];
  desires:      string[];
  demographics: string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface Resource {
  id:                 string | null;
  userId:             string;
  productName:        string | null;
  productDescription: string | null;
  productBenefits:    string[];
  brandTone:          string | null;
  brandVoice:         string | null;
  imageUrls:          string[];
  personas:           Persona[];
}

export interface UpsertResourcePayload {
  productName?:        string;
  productDescription?: string;
  productBenefits?:    string[];
  brandTone?:          string;
  brandVoice?:         string;
  imageUrls?:          string[];
}

export interface CreatePersonaPayload {
  name:         string;
  description:  string;
  painPoints?:  string[];
  desires?:     string[];
  demographics?: string;
}

export interface UpdatePersonaPayload {
  name?:         string;
  description?:  string;
  painPoints?:   string[];
  desires?:      string[];
  demographics?: string;
}

export interface BrandScan {
  productName:        string;
  productDescription: string;
  productBenefits:    string[];
  brandTone:          string;
  brandVoice:         string;
}

export interface Competitor {
  id:             string;
  resourceId:     string;
  url:            string;
  name:           string;
  description:    string;
  positioning:    string;
  targetAudience: string;
  keyMessages:    string[];
  strengths:      string[];
  weaknesses:     string[];
  tone:           string;
  createdAt:      string;
  updatedAt:      string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function scanUrl(url: string): Promise<BrandScan> {
  return request<BrandScan>('/api/resources/scan', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function scanCompetitor(url: string): Promise<Competitor> {
  return request<Competitor>('/api/resources/competitors/scan', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function getCompetitors(): Promise<Competitor[]> {
  return request<Competitor[]>('/api/resources/competitors');
}

export async function deleteCompetitor(id: string): Promise<void> {
  return request<void>(`/api/resources/competitors/${id}`, { method: 'DELETE' });
}

export async function getResource(): Promise<Resource> {
  return request<Resource>('/api/resources');
}

export async function upsertResource(payload: UpsertResourcePayload): Promise<Resource> {
  return request<Resource>('/api/resources', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function createPersona(payload: CreatePersonaPayload): Promise<Persona> {
  return request<Persona>('/api/resources/personas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePersona(id: string, payload: UpdatePersonaPayload): Promise<Persona> {
  return request<Persona>(`/api/resources/personas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deletePersona(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/api/resources/personas/${id}`, {
    method: 'DELETE',
  });
}
