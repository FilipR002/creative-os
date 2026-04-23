-- CreateTable
CREATE TABLE "creative_improvements" (
    "id" TEXT NOT NULL,
    "original_creative_id" TEXT NOT NULL,
    "improved_creative_id" TEXT,
    "improvement_type" TEXT NOT NULL,
    "improvement_reason" TEXT NOT NULL,
    "changes_applied" JSONB NOT NULL,
    "score_before" DOUBLE PRECISION NOT NULL,
    "score_after" DOUBLE PRECISION,
    "improvement_delta" DOUBLE PRECISION,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_improvements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "creative_improvements" ADD CONSTRAINT "creative_improvements_original_creative_id_fkey" FOREIGN KEY ("original_creative_id") REFERENCES "creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_improvements" ADD CONSTRAINT "creative_improvements_improved_creative_id_fkey" FOREIGN KEY ("improved_creative_id") REFERENCES "creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;
