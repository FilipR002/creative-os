-- CreateTable
CREATE TABLE "angle_stats" (
    "id" TEXT NOT NULL,
    "angle_id" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "avg_ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_conversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "angle_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "format_stats" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "avg_ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_retention" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_conversion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "format_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_errors" (
    "id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "ctr_error" DOUBLE PRECISION NOT NULL,
    "retention_error" DOUBLE PRECISION NOT NULL,
    "conversion_error" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "angle_stats_angle_id_key" ON "angle_stats"("angle_id");

-- CreateIndex
CREATE UNIQUE INDEX "format_stats_format_key" ON "format_stats"("format");

-- AddForeignKey
ALTER TABLE "angle_stats" ADD CONSTRAINT "angle_stats_angle_id_fkey" FOREIGN KEY ("angle_id") REFERENCES "angles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_errors" ADD CONSTRAINT "prediction_errors_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
