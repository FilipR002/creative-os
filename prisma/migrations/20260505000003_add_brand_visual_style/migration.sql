-- Add brand_visual_style to resources table.
-- Cached Gemini Vision analysis of uploaded brand/product images.
-- Written by POST /api/resources/analyze-images; read by image prompt builder.
ALTER TABLE "resources"
  ADD COLUMN IF NOT EXISTS "brand_visual_style" TEXT;
