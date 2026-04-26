import { Module }                from '@nestjs/common';
import { PrismaModule }          from '../prisma/prisma.module';
import { ApiLogService }         from './api-log.service';
import { RevenueLogService }     from './revenue-log.service';
import { ProfitService }         from './profit.service';
import { SubscriptionService }   from './subscription.service';
import { BillingController }     from './billing.controller';
import { AdminProfitController } from './admin-profit.controller';
import { UserBillingController } from './user-billing.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [BillingController, AdminProfitController, UserBillingController],
  providers:   [ApiLogService, RevenueLogService, ProfitService, SubscriptionService],
  exports:     [ApiLogService, RevenueLogService, ProfitService, SubscriptionService],
})
export class BillingModule {}
