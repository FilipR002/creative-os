import { Global, Module }         from '@nestjs/common';
import { PrismaModule }           from '../prisma/prisma.module';
import { ClientContextResolver }  from './context/client-context.resolver';
import { MEMORY_STORE }           from './memory/memory-store.interface';
import { PrismaMemoryStore }      from './memory/prisma-memory.store';
import { AggregationService }     from './aggregation/aggregation.service';
import { PluginRegistry }         from './plugins/plugin-registry.service';
import { PipelineService }        from './pipeline/pipeline.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    ClientContextResolver,
    AggregationService,
    PluginRegistry,
    PipelineService,
    { provide: MEMORY_STORE, useClass: PrismaMemoryStore },
  ],
  exports: [
    ClientContextResolver,
    AggregationService,
    PluginRegistry,
    PipelineService,
    MEMORY_STORE,
  ],
})
export class PlatformModule {}
