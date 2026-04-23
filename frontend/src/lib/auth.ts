// ─── Auth System (localStorage mock) ─────────────────────────────────────────
// UserContext fields are embedded in AuthUser so the session is one record.
// In production: swap signup/login to call a real JWT backend.

import type { GoalType, OfferType, PlatformType, ContentStyle, RiskLevel } from './user-context';
import { initSessionState, clearOnboardingDraft } from './user-context';

export interface AuthUser {
  id:           string;   // UUID — same as cos_user_id for API calls
  email:        string;
  name:         string;
  onboarded:    boolean;
  createdAt:    string;

  // ── UserContext fields (set on onboarding completion) ──
  goalType?:     GoalType;
  industry?:     string;
  offerType?:    OfferType;
  platform?:     PlatformType;
  contentStyle?: ContentStyle;
  riskLevel?:    RiskLevel;

  // ── Legacy (mapped from old 3-step onboarding, kept for compat) ──
  goal?:         string;   // old field — use goalType instead
}

type StoredUser = AuthUser & { password: string };

// ── internal helpers ──────────────────────────────────────────────────────────

function getDb(): StoredUser[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('cos_users_db') || '[]'); }
  catch { return []; }
}

function saveDb(users: StoredUser[]) {
  localStorage.setItem('cos_users_db', JSON.stringify(users));
}

function persist(user: AuthUser) {
  localStorage.setItem('cos_auth_user',  JSON.stringify(user));
  localStorage.setItem('cos_user_id',    user.id);
  localStorage.setItem('cos_user_email', user.email);
}

// ── public API ────────────────────────────────────────────────────────────────

export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('cos_auth_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch { return null; }
}

export function signup(email: string, password: string, name: string): AuthUser {
  const db = getDb();
  if (db.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
    throw new Error('An account with this email already exists.');
  }
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  const user: AuthUser = {
    id:        crypto.randomUUID(),
    email:     email.toLowerCase().trim(),
    name:      name.trim(),
    onboarded: false,
    createdAt: new Date().toISOString(),
  };
  saveDb([...db, { ...user, password }]);
  persist(user);
  return user;
}

export function emailExists(email: string): boolean {
  return !!getDb().find(u => u.email.toLowerCase() === email.toLowerCase().trim());
}

export function login(email: string, password: string): AuthUser {
  const db      = getDb();
  const byEmail = db.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!byEmail) throw new Error('NO_ACCOUNT');
  if (byEmail.password !== password) throw new Error('WRONG_PASSWORD');
  const { password: _pw, ...user } = byEmail;
  persist(user);
  return user;
}

export function loginOrCreate(email: string, password: string, name?: string): AuthUser {
  if (emailExists(email)) return login(email, password);
  return signup(email, password, name ?? email.split('@')[0]);
}

export function logout() {
  localStorage.removeItem('cos_auth_user');
  localStorage.removeItem('cos_session_state');
}

export function updateAuthUser(updates: Partial<AuthUser>): AuthUser | null {
  const current = getAuthUser();
  if (!current) return null;
  const updated = { ...current, ...updates };
  persist(updated);

  // Sync to db
  const db  = getDb();
  const idx = db.findIndex(u => u.id === current.id);
  if (idx >= 0) db[idx] = { ...db[idx], ...updates };
  saveDb(db);

  // If onboarding just completed, initialise engine session state
  if (updates.onboarded && updated.goalType && updated.industry && updated.offerType
      && updated.platform && updated.contentStyle && updated.riskLevel) {
    clearOnboardingDraft();
    initSessionState(updated.id, {
      goalType:     updated.goalType,
      industry:     updated.industry,
      offerType:    updated.offerType,
      platform:     updated.platform,
      contentStyle: updated.contentStyle,
      riskLevel:    updated.riskLevel,
    });
  }

  return updated;
}
