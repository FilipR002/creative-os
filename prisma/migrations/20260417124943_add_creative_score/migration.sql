-- CreateTable
CREATE TABLE "creative_scores" (
    "id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "ctr_score" DOUBLE PRECISION NOT NULL,
    "engagement" DOUBLE PRECISION NOT NULL,
    "conversion" DOUBLE PRECISION NOT NULL,
    "clarity" DOUBLE PRECISION NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "is_winner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creative_scores_creative_id_key" ON "creative_scores"("creative_id");

-- AddForeignKey
ALTER TABLE "creative_scores" ADD CONSTRAINT "creative_scores_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
