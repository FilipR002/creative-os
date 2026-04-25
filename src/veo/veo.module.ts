import { Module }         from '@nestjs/common';
import { VeoApiService }  from './veo-api.service';
import { BillingModule }  from '../billing/billing.module';

@Module({
  imports:   [BillingModule],
  providers: [VeoApiService],
  exports:   [VeoApiService],
})
export class VeoModule {}
