-- Add visual_overrides JSONB column to angles table.
-- Written by evolution visual-mutation cycles; read by banner/carousel compositor.
ALTER TABLE "angles"
  ADD COLUMN IF NOT EXISTS "visual_overrides" JSONB;
