-- CreateTable
CREATE TABLE "competitors" (
    "id"             TEXT NOT NULL,
    "resource_id"    TEXT NOT NULL,
    "url"            TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "positioning"    TEXT NOT NULL,
    "target_audience" TEXT NOT NULL,
    "key_messages"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strengths"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses"     TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone"           TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competitors_resource_id_idx" ON "competitors"("resource_id");

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
