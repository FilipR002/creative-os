import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { UserGuard } from './common/guards/user.guard';
import { CampaignModule } from './campaign/campaign.module';
import { ConceptModule } from './concept/concept.module';
import { AngleModule } from './angle/angle.module';
import { VideoModule } from './video/video.module';
import { CarouselModule } from './carousel/carousel.module';
import { BannerModule } from './banner/banner.module';
import { CreativesModule } from './creatives/creatives.module';
import { ScoringModule } from './scoring/scoring.module';
import { MemoryModule } from './memory/memory.module';
import { FeedbackModule } from './feedback/feedback.module';
import { InsightsModule } from './insights/insights.module';
import { ImprovementModule } from './improvement/improvement.module';
import { AuthModule } from './auth/auth.module';
import { AdminAnalyticsModule } from './admin-analytics/admin-analytics.module';
import { ImageModule } from './image/image.module';
import { LearningModule }      from './learning/learning.module';
import { MirofishModule }      from './mirofish/mirofish.module';
import { OrchestratorModule }  from './orchestrator/orchestrator.module';
import { FatigueModule }       from './fatigue/fatigue.module';
import { ExplorationModule }   from './exploration/exploration.module';
import { HookBoosterModule }   from './hook-booster/hook-booster.module';
import { SceneRewriterModule } from './scene-rewriter/scene-rewriter.module';
import { AutoWinnerModule }    from './auto-winner/auto-winner.module';
import { GlobalMemoryModule }  from './global-memory/global-memory.module';
import { RedisModule }         from './redis/redis.module';
import { ObservabilityModule } from './observability/observability.module';
import { PlatformModule }             from './platform/platform.module';
import { ClientMemoryModule }         from './clients/memory/client-memory.module';
import { CrossClientLearningModule }  from './learning/cross-client/cross-client-learning.module';
import { TrendsModule }               from './trends/trends.module';
import { PerformanceDashboardModule } from './dashboard/performance/performance.module';
import { SmartRoutingModule }         from './routing/smart/routing.module';
import { CostOptimizationModule }     from './optimization/cost/cost.module';
import { MemoryEventModule }          from './optimization/cost/memory-event.module';
import { ProductModule }              from './product/product.module';
import { OutcomesModule }            from './outcomes/outcomes.module';
import { EvolutionModule }           from './evolution/evolution.module';
import { CreativeAiModule }          from './creative-ai/creative-ai.module';
import { AngleReferencesModule }     from './angle-references/angle-references.module';
import { AngleInsightsModule }       from './angle-insights/angle-insights.module';
import { AutonomousLoopModule }      from './autonomous-loop/autonomous-loop.module';
import { EmergenceModule }           from './emergence/emergence.module';
import { CreativeDNAModule }         from './creative-dna/creative-dna.module';
import { CausalAttributionModule }   from './causal-attribution/causal-attribution.module';
import { UserInsightModule }         from './user-insight/user-insight.module';
import { ProductContractModule }     from './product-contract/product-contract.module';
import { RealityModule }             from './reality/reality.module';
import { ProductRunModule }          from './product-run/product-run.module';
import { UserStyleModule }           from './user-style/user-style.module';
import { GenerationsModule }         from './generations/generations.module';
import { PerformanceModule }          from './performance/performance.module';
import { RegistryModule }                 from './registry/registry.module';
import { AdminToolsModule }               from './admin-tools/admin-tools.module';
import { AutonomousIntelligenceModule }   from './autonomous-intelligence/autonomous-intelligence.module';
import { SystemAuditModule }              from './system-audit/system-audit.module';
import { FinancialOsModule }              from './financial-os/financial-os.module';
import { CompetitorIntelligenceModule }  from './competitor-intelligence/competitor-intelligence.module';
import { TrendPredictionModule }  from './trend-prediction/trend-prediction.module';
import { AdIntelligenceModule }   from './ad-intelligence/ad-intelligence.module';
import { AdGroupsModule }         from './ad-groups/ad-groups.module';
import { CreativeOSModule }       from './creative-os/creative-os.module';
import { CreativeDirectorModule } from './creative-director/creative-director.module';
import { UGCModule }              from './ugc/ugc.module';
import { FunnelRouterModule }     from './funnel-router/funnel-router.module';
import { CreativeOSV2Module }     from './creative-os-v2/creative-os-v2.module';
import { BillingModule }          from './billing/billing.module';
import { HealthModule }           from './health/health.module';
import { VideoQueueModule }       from './video-queue/video-queue.module';
import { ResourcesModule }        from './resources/resources.module';
import { CompositorModule }       from './compositor/compositor.module';
import { ElevenLabsModule }       from './elevenlabs/elevenlabs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MemoryEventModule,
    RedisModule,
    ObservabilityModule,
    PlatformModule,
    ClientMemoryModule,
    CrossClientLearningModule,
    TrendsModule,
    PerformanceDashboardModule,
    SmartRoutingModule,
    CostOptimizationModule,
    PrismaModule,
    UsersModule,
    CampaignModule,
    ConceptModule,
    AngleModule,
    VideoModule,
    CarouselModule,
    BannerModule,
    CreativesModule,
    ScoringModule,
    MemoryModule,
    FeedbackModule,
    InsightsModule,
    ImprovementModule,
    AuthModule,
    AdminAnalyticsModule,
    ImageModule,
    LearningModule,
    MirofishModule,
    OrchestratorModule,
    FatigueModule,
    ExplorationModule,
    HookBoosterModule,
    SceneRewriterModule,
    AutoWinnerModule,
    GlobalMemoryModule,
    ProductModule,
    OutcomesModule,
    EvolutionModule,
    CreativeAiModule,
    AngleReferencesModule,
    AngleInsightsModule,
    AutonomousLoopModule,
    EmergenceModule,
    CreativeDNAModule,
    CausalAttributionModule,
    UserInsightModule,
    ProductContractModule,
    RealityModule,
    ProductRunModule,
    UserStyleModule,
    GenerationsModule,
    PerformanceModule,
    RegistryModule,
    AdminToolsModule,
    AutonomousIntelligenceModule,
    SystemAuditModule,
    FinancialOsModule,
    CompetitorIntelligenceModule,
    TrendPredictionModule,
    AdIntelligenceModule,
    AdGroupsModule,
    CreativeOSModule,
    CreativeDirectorModule,
    UGCModule,
    FunnelRouterModule,
    CreativeOSV2Module,
    BillingModule,
    HealthModule,
    VideoQueueModule,   // async video-render queue + GET /api/jobs/:jobId
    ResourcesModule,    // product / brand knowledge base + personas
    CompositorModule,   // ad compositor: HTML/CSS templates → PNG via Puppeteer
    ElevenLabsModule,   // Phase 5 — TTS voiceover: GET /api/elevenlabs/voices
  ],
  providers: [
    // UserGuard runs globally — populates req.context (single source of truth for identity).
    // Controllers read identity via @UserId() only. Services receive userId: string explicitly.
    { provide: APP_GUARD, useClass: UserGuard },
  ],
})
export class AppModule {}
