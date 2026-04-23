import { Module } from '@nestjs/common';
import { PrismaModule }    from '../prisma/prisma.module';
import { FeedbackModule }  from '../feedback/feedback.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService }    from './performance.service';
import { CsvParserService }      from './csv-parser.service';

@Module({
  imports:     [PrismaModule, FeedbackModule],
  controllers: [PerformanceController],
  providers:   [PerformanceService, CsvParserService],
})
export class PerformanceModule {}
