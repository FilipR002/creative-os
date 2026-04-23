import { Module }                         from '@nestjs/common';
import { ProductController }              from './product-contract.controller';
import { ProductResponseContractService } from './product-contract.service';
import { ProductContractInterceptor }     from './product-contract.interceptor';
import { UserInsightModule }             from '../user-insight/user-insight.module';

@Module({
  imports:     [UserInsightModule],
  controllers: [ProductController],
  providers:   [ProductResponseContractService, ProductContractInterceptor],
  exports:     [ProductResponseContractService, ProductContractInterceptor],
})
export class ProductContractModule {}
