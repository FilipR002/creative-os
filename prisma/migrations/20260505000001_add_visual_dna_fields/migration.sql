-- Phase 9.2.1: Visual DNA — add structured visual fields to CreativeDNA
-- and richer visual metadata to AngleCreativeInsight.
--
-- All columns use safe defaults so existing rows are never broken.

-- ── AngleCreativeInsight visual metadata ────────────────────────────────────
ALTER TABLE "angle_creative_insights"
  ADD COLUMN IF NOT EXISTS "color_palette"      TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "layout_complexity"  TEXT    NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS "composition_notes"  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "dominant_colors"    TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "text_density"       TEXT    NOT NULL DEFAULT 'balanced';

-- ── CreativeDNA structured visual dimensions ─────────────────────────────────
ALTER TABLE "creative_dna"
  ADD COLUMN IF NOT EXISTS "layout_complexity"  TEXT    NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS "image_text_ratio"   TEXT    NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS "contrast_level"     TEXT    NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "color_mood"         TEXT    NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS "typography_style"   TEXT    NOT NULL DEFAULT 'clean-sans',
  ADD COLUMN IF NOT EXISTS "composition_style"  TEXT    NOT NULL DEFAULT 'centered';

-- ── Index for fast visual-style lookups ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS "creative_dna_color_mood_typography_style_idx"
  ON "creative_dna" ("color_mood", "typography_style");
