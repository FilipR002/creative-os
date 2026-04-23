// @Global() — no other module needs to import this; injection is automatic.
import { Global, Module }       from '@nestjs/common';
import { MemoryEventService }   from './memory-event.service';

@Global()
@Module({
  providers: [MemoryEventService],
  exports:   [MemoryEventService],
})
export class MemoryEventModule {}
