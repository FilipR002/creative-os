-- AlterTable
ALTER TABLE "angle_stats" ADD COLUMN     "calibration_factor" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "format_stats" ADD COLUMN     "calibration_factor" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "creative_insights" (
    "id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "key_factors" JSONB NOT NULL,
    "improvement_suggestions" JSONB NOT NULL,
    "winner_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creative_insights_creative_id_key" ON "creative_insights"("creative_id");

-- AddForeignKey
ALTER TABLE "creative_insights" ADD CONSTRAINT "creative_insights_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
