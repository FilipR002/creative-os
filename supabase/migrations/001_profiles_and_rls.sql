-- ─── Migration 001: Profiles table + RLS policies ────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor
-- Order matters: run top to bottom.

-- ── 1. Profiles table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        UNIQUE,
  is_admin   BOOLEAN     NOT NULL DEFAULT FALSE,
  role       TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Auto-create profile on Supabase signup ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, role)
  VALUES (
    NEW.id,
    NEW.email,
    FALSE,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 3. updated_at auto-update ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies — Profiles ────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "profiles_read_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but NOT is_admin or role)
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
    AND role     = (SELECT role     FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can read ALL profiles
CREATE POLICY "profiles_admin_read_all"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update ALL profiles (including role changes)
CREATE POLICY "profiles_admin_update_all"
  ON public.profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ── 6. Make yourself admin ────────────────────────────────────────────────────
-- Run AFTER first login (your profile must exist first).

-- UPDATE public.profiles
-- SET is_admin = TRUE, role = 'admin'
-- WHERE email = 'filipradonjic1@gmail.com';

-- ── 7. Helpful view: user + profile joined ────────────────────────────────────

CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  u.id,
  u.email,
  u.created_at,
  p.is_admin,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id;
