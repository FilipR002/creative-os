import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface MonitoringState {
  enabled:      boolean;
  intervalMs:   number;
  jobIds:       string[];
  lastCheckAt?: Date;
  checksRun:    number;
}

@Injectable()
export class MonitoringService implements OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private state: MonitoringState = {
    enabled: false, intervalMs: 3_600_000, // 1 hour default
    jobIds: [], checksRun: 0,
  };
  private timer?: ReturnType<typeof setInterval>;
  private rerunCallback?: (jobId: string) => Promise<void>;

  onModuleDestroy() { this.stop(); }

  getState(): MonitoringState { return { ...this.state }; }

  enable(intervalMs = 3_600_000, rerunCb: (id: string) => Promise<void>): void {
    this.stop();
    this.rerunCallback = rerunCb;
    this.state.enabled  = true;
    this.state.intervalMs = intervalMs;
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.logger.log(`Monitoring enabled (interval: ${intervalMs}ms)`);
  }

  disable(): void {
    this.stop();
    this.state.enabled = false;
    this.logger.log('Monitoring disabled');
  }

  trackJob(jobId: string): void {
    if (!this.state.jobIds.includes(jobId)) this.state.jobIds.push(jobId);
  }

  private stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
  }

  private async tick(): Promise<void> {
    this.state.lastCheckAt = new Date();
    this.state.checksRun++;
    this.logger.log(`Monitoring tick #${this.state.checksRun} — ${this.state.jobIds.length} jobs tracked`);
    if (this.rerunCallback) {
      for (const id of this.state.jobIds.slice(-3)) { // re-run last 3 jobs
        await this.rerunCallback(id).catch(e => this.logger.warn(`Re-run failed: ${e.message}`));
      }
    }
  }
}
