-- FIX 7: Add blueprints table for MasterBlueprint persistence.
-- Replaces the synthetic colon-joined string used as blueprintId with a real DB PK.

CREATE TABLE "blueprints" (
    "id"         TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "concept_id"  TEXT,
    "format"      TEXT NOT NULL,
    "angle_slug"  TEXT NOT NULL,
    "data"        JSONB NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blueprints_campaign_id_idx" ON "blueprints"("campaign_id");
CREATE INDEX "blueprints_angle_slug_idx"  ON "blueprints"("angle_slug");
