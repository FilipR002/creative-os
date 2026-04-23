import { Module }                from '@nestjs/common';
import { UserInsightController } from './user-insight.controller';
import { UserInsightService }    from './user-insight.service';

@Module({
  controllers: [UserInsightController],
  providers:   [UserInsightService],
  exports:     [UserInsightService],
})
export class UserInsightModule {}
