import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitFeedbackDto } from './feedback.dto';

// Win/loss thresholds
const WIN_CTR_THRESHOLD        = 0.04;
const WIN_CONVERSION_THRESHOLD = 0.02;

// Weight adjustment rates
const WEIGHT_WIN_DELTA  =  0.10;
const WEIGHT_LOSS_DELTA = -0.05;
const WEIGHT_MIN        = 0.10;
const WEIGHT_MAX        = 2.00;

// Calibration
const CALIBRATION_LEARNING_RATE = 0.10;
const CALIBRATION_MIN           = 0.70;
const CALIBRATION_MAX           = 1.30;

function clamp(v: number, min = WEIGHT_MIN, max = WEIGHT_MAX): number {
  return Math.max(min, Math.min(max, v));
}

function clampCal(v: number): number {
  return Math.max(CALIBRATION_MIN, Math.min(CALIBRATION_MAX, v));
}

function rollingAvg(prevAvg: number, newValue: number, newCount: number): number {
  if (newCount <= 1) return newValue;
  return prevAvg + (newValue - prevAvg) / newCount;
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── SUBMIT REAL METRICS ─────────────────────────────────────────────────────
  async submitRealMetrics(dto: SubmitFeedbackDto) {
    const creative = await this.prisma.creative.findUnique({
      where:   { id: dto.creativeId },
      include: { score: true, angle: { include: { angleStats: true } } },
    });
    if (!creative) throw new NotFoundException(`Creative ${dto.creativeId} not found`);
    if (!creative.score) throw new NotFoundException(`No predicted scores found for creative ${dto.creativeId}. Run scoring first.`);

    const ctr        = Number(dto.ctr);
    const retention  = Number(dto.retention);
    const conversion = Number(dto.conversion);
    const predicted  = creative.score;
    const format     = creative.format.toLowerCase();

    // STEP 1: Prediction errors
    const ctrError        = ctr        - predicted.ctrScore;
    const retentionError  = retention  - predicted.engagement;
    const conversionError = conversion - predicted.conversion;

    await this.prisma.predictionError.create({
      data: { creativeId: creative.id, ctrError, retentionError, conversionError },
    });

    const isWin = ctr >= WIN_CTR_THRESHOLD || conversion >= WIN_CONVERSION_THRESHOLD;

    // STEP 2: Update angle_stats (weight + calibration)
    let newAngleWeight      = 1.0;
    let newAngleCalibration = 1.0;

    if (creative.angleId) {
      const existing = creative.angle?.angleStats;
      const uses    = (existing?.uses    ?? 0) + 1;
      const wins    = (existing?.wins    ?? 0) + (isWin ? 1 : 0);
      const losses  = (existing?.losses  ?? 0) + (isWin ? 0 : 1);

      const avgCtr        = rollingAvg(existing?.avgCtr        ?? 0, ctr,        uses);
      const avgRetention  = rollingAvg(existing?.avgRetention  ?? 0, retention,  uses);
      const avgConversion = rollingAvg(existing?.avgConversion ?? 0, conversion, uses);

      newAngleWeight = clamp(
        (existing?.weight ?? 1.0) + (isWin ? WEIGHT_WIN_DELTA : WEIGHT_LOSS_DELTA),
      );

      // Calibration: adjust by average of CTR + conversion errors
      const avgError = (ctrError + conversionError) / 2;
      newAngleCalibration = clampCal(
        (existing?.calibrationFactor ?? 1.0) + avgError * CALIBRATION_LEARNING_RATE,
      );

      await this.prisma.angleStats.upsert({
        where:  { angleId: creative.angleId },
        update: {
          uses, wins, losses, avgCtr, avgRetention, avgConversion,
          weight: newAngleWeight, calibrationFactor: newAngleCalibration,
        },
        create: {
          angleId: creative.angleId,
          uses, wins, losses, avgCtr, avgRetention, avgConversion,
          weight: newAngleWeight, calibrationFactor: newAngleCalibration,
        },
      });
    }

    // STEP 3: Update format_stats (weight + calibration)
    const existingFmt = await this.prisma.formatStats.findUnique({ where: { format } });

    const fTotal         = (existingFmt?.total        ?? 0) + 1;
    const fAvgCtr        = rollingAvg(existingFmt?.avgCtr        ?? 0, ctr,        fTotal);
    const fAvgRetention  = rollingAvg(existingFmt?.avgRetention  ?? 0, retention,  fTotal);
    const fAvgConversion = rollingAvg(existingFmt?.avgConversion ?? 0, conversion, fTotal);

    const fWeightDelta = ctr >= WIN_CTR_THRESHOLD ? 0.05 : -0.03;
    const fNewWeight   = clamp((existingFmt?.weight ?? 1.0) + fWeightDelta);

    // Format calibration uses CTR error (most reliable signal for format fit)
    const fNewCalibration = clampCal(
      (existingFmt?.calibrationFactor ?? 1.0) + ctrError * CALIBRATION_LEARNING_RATE,
    );

    await this.prisma.formatStats.upsert({
      where:  { format },
      update: {
        total: fTotal, avgCtr: fAvgCtr, avgRetention: fAvgRetention, avgConversion: fAvgConversion,
        weight: fNewWeight, calibrationFactor: fNewCalibration,
      },
      create: {
        format, total: fTotal, avgCtr: fAvgCtr, avgRetention: fAvgRetention, avgConversion: fAvgConversion,
        weight: fNewWeight, calibrationFactor: fNewCalibration,
      },
    });

    return {
      creativeId: dto.creativeId,
      outcome:    isWin ? 'win' : 'loss',
      errors: {
        ctr:        round(ctrError),
        retention:  round(retentionError),
        conversion: round(conversionError),
      },
      weights: {
        angle:  round(newAngleWeight),
        format: round(fNewWeight),
      },
      calibration: {
        angle:  round(newAngleCalibration),
        format: round(fNewCalibration),
      },
      message: isWin
        ? `Positive signal recorded. ${creative.angle?.slug ?? 'angle'} weight ↑ to ${round(newAngleWeight)}, calibration factor: ${round(newAngleCalibration)}.`
        : `Negative signal recorded. ${creative.angle?.slug ?? 'angle'} weight ↓ to ${round(newAngleWeight)}, calibration factor: ${round(newAngleCalibration)}.`,
    };
  }

  // ─── GET CALIBRATION SNAPSHOT ─────────────────────────────────────────────────
  async getCalibration() {
    const [angles, formats, accuracy] = await Promise.all([
      this.prisma.angleStats.findMany({
        include: { angle: { select: { slug: true, label: true } } },
        orderBy: { calibrationFactor: 'desc' },
      }),
      this.prisma.formatStats.findMany({ orderBy: { calibrationFactor: 'desc' } }),
      this.computeAccuracy(),
    ]);

    const interpretation = (cf: number) =>
      cf > 1.05 ? 'underpredicting — scores are being scaled UP'
        : cf < 0.95 ? 'overpredicting — scores are being scaled DOWN'
        : 'well-calibrated';

    return {
      angles: angles.map(a => ({
        slug:              a.angle.slug,
        label:             a.angle.label,
        calibrationFactor: round(a.calibrationFactor),
        interpretation:    interpretation(a.calibrationFactor),
        uses:              a.uses,
        avgCtrError:       round(a.avgCtr - 0.05), // simple bias estimate
      })),
      formats: formats.map(f => ({
        format:            f.format,
        calibrationFactor: round(f.calibrationFactor),
        interpretation:    interpretation(f.calibrationFactor),
        total:             f.total,
      })),
      predictionAccuracy: accuracy,
    };
  }

  // ─── WEIGHTS SNAPSHOT ─────────────────────────────────────────────────────────
  async getWeightsSnapshot() {
    const [angles, formats] = await Promise.all([
      this.prisma.angleStats.findMany({
        include: { angle: { select: { slug: true, label: true } } },
        orderBy: { weight: 'desc' },
      }),
      this.prisma.formatStats.findMany({ orderBy: { weight: 'desc' } }),
    ]);

    return {
      angles: angles.map(a => ({
        slug:              a.angle.slug,
        label:             a.angle.label,
        weight:            round(a.weight),
        calibrationFactor: round(a.calibrationFactor),
        uses:              a.uses,
        wins:              a.wins,
        losses:            a.losses,
        winRate:           a.uses > 0 ? round(a.wins / a.uses) : 0,
        avgCtr:            round(a.avgCtr),
        avgRetention:      round(a.avgRetention),
        avgConversion:     round(a.avgConversion),
      })),
      formats: formats.map(f => ({
        format:            f.format,
        weight:            round(f.weight),
        calibrationFactor: round(f.calibrationFactor),
        total:             f.total,
        avgCtr:            round(f.avgCtr),
        avgRetention:      round(f.avgRetention),
        avgConversion:     round(f.avgConversion),
      })),
      predictionAccuracy: await this.computeAccuracy(),
    };
  }

  // ─── MAE COMPUTATION ─────────────────────────────────────────────────────────
  private async computeAccuracy() {
    const errors = await this.prisma.predictionError.findMany({
      select: { ctrError: true, retentionError: true, conversionError: true },
    });
    if (!errors.length) return { maeCtr: 0, maeRetention: 0, maeConversion: 0, samples: 0 };

    const mae = (key: 'ctrError' | 'retentionError' | 'conversionError') =>
      round(errors.reduce((s, e) => s + Math.abs(e[key]), 0) / errors.length);

    return {
      maeCtr:        mae('ctrError'),
      maeRetention:  mae('retentionError'),
      maeConversion: mae('conversionError'),
      samples:       errors.length,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
