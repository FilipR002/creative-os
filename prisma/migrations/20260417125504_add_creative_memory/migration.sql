-- CreateTable
CREATE TABLE "creative_memory" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "concept" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "is_winner" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_memory_client_id_idx" ON "creative_memory"("client_id");

-- CreateIndex
CREATE INDEX "creative_memory_industry_idx" ON "creative_memory"("industry");

-- CreateIndex
CREATE INDEX "creative_memory_angle_idx" ON "creative_memory"("angle");

-- CreateIndex
CREATE INDEX "creative_memory_format_idx" ON "creative_memory"("format");

-- CreateIndex
CREATE INDEX "creative_memory_total_score_idx" ON "creative_memory"("total_score");
