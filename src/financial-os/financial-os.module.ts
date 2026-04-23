import { Module }                   from '@nestjs/common';
import { PrismaModule }             from '../prisma/prisma.module';
import { FinancialOsController }    from './financial-os.controller';
import { AutonomyService }          from './autonomy.service';
import { CostTrackingService }      from './cost-tracking.service';
import { ProfitOptimizerService }   from './profit-optimizer.service';
import { AiCfoService }             from './ai-cfo.service';
import { BudgetRebalancerService }  from './budget-rebalancer.service';
import { RevenueForecastService }   from './revenue-forecast.service';
import { ProfitLearningService }    from './profit-learning.service';
import { AiCeoService }             from './ai-ceo.service';
import { ProfitIntelligenceService } from './profit-intelligence.service';

@Module({
  imports:     [PrismaModule],
  controllers: [FinancialOsController],
  providers: [
    AutonomyService,
    CostTrackingService,
    ProfitOptimizerService,
    AiCfoService,
    BudgetRebalancerService,
    RevenueForecastService,
    ProfitLearningService,
    AiCeoService,
    ProfitIntelligenceService,
  ],
  exports: [AutonomyService, CostTrackingService],
})
export class FinancialOsModule {}
