import { Module }              from '@nestjs/common';
import { PrismaModule }        from '../prisma/prisma.module';
import { AdminToolsController } from './admin-tools.controller';
import { AdminToolsService }    from './admin-tools.service';

@Module({
  imports:     [PrismaModule],
  controllers: [AdminToolsController],
  providers:   [AdminToolsService],
  exports:     [AdminToolsService],
})
export class AdminToolsModule {}
