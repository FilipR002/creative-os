import { Module } from '@nestjs/common';
import { SystemAuditController } from './system-audit.controller';
import { SystemAuditService }    from './system-audit.service';

@Module({
  controllers: [SystemAuditController],
  providers:   [SystemAuditService],
  exports:     [SystemAuditService],
})
export class SystemAuditModule {}
