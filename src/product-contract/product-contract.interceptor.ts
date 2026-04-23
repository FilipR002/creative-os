// ─── Phase 9.5 — ProductContract Interceptor ─────────────────────────────────
//
// Apply @UseInterceptors(ProductContractInterceptor) to any existing controller
// method to have its raw engine output automatically sanitized.
//
// The interceptor does NOT transform to ProductResponse — it only strips
// FORBIDDEN_FIELDS and rounds numbers. Use the ProductController's methods
// for full ProductResponse transformation.
//
// Usage:
//   @Get('state')
//   @UseInterceptors(ProductContractInterceptor)
//   state() { return this.service.getState(); }

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map }        from 'rxjs/operators';
import { ProductResponseContractService } from './product-contract.service';

@Injectable()
export class ProductContractInterceptor implements NestInterceptor {
  constructor(private readonly contract: ProductResponseContractService) {}

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map(data => this.contract.sanitize(data)),
    );
  }
}
