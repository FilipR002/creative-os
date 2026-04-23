import { Module }              from '@nestjs/common';
import { PrismaModule }        from '../prisma/prisma.module';
import { UserStyleService }    from './user-style.service';
import { UserStyleController } from './user-style.controller';

@Module({
  imports:     [PrismaModule],
  providers:   [UserStyleService],
  controllers: [UserStyleController],
  exports:     [UserStyleService],
})
export class UserStyleModule {}
