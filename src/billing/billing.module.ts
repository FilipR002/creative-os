import { Module }                from '@nestjs/common';
import { PrismaModule }          from '../prisma/prisma.module';
import { ApiLogService }         from './api-log.service';
import { RevenueLogService }     from './revenue-log.service';
import { ProfitService }         from './profit.service';
import { BillingController }     from './billing.controller';
import { AdminProfitController } from './admin-profit.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [BillingController, AdminProfitController],
  providers:   [ApiLogService, RevenueLogService, ProfitService],
  exports:     [ApiLogService, RevenueLogService, ProfitService],
})
export class BillingModule {}
