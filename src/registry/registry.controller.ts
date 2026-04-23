import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

// ─── Endpoint Registry — single source of truth ───────────────────────────────
// uiExposure: VISIBLE_UI | ADMIN_UI | HIDDEN_INTERNAL
// uiType:     action | panel | page | toggle | metric | stream | none
// connected:  true = client function + UI both exist

export interface RegistryEndpoint {
  method:      'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path:        string;
  label:       string;
  module:      string;
  uiExposure:  'VISIBLE_UI' | 'ADMIN_UI' | 'HIDDEN_INTERNAL';
  uiType:      'action' | 'panel' | 'page' | 'toggle' | 'metric' | 'stream' | 'none';
  clientFn?:   string;        // name of function in creator-client.ts
  uiLocation?: string;        // route or component name where it appears
  connected:   boolean;       // has both clientFn and uiLocation
  notes?:      string;
}

export const ENDPOINTS: RegistryEndpoint[] = [
  // ── AUTH ────────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/auth/register',          label: 'Register user',               module: 'auth',               uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   connected: false },
  { method: 'POST', path: '/api/auth/login',             label: 'Login',                       module: 'auth',               uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   connected: false },
  { method: 'GET',  path: '/api/auth/me',                label: 'Get current user',            module: 'auth',               uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   connected: false },

  // ── CAMPAIGN ────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/campaigns',              label: 'Create campaign',             module: 'campaign',           uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'createCampaign',           uiLocation: '/app/campaign/new',           connected: true },
  { method: 'GET',  path: '/api/campaigns',              label: 'List campaigns',              module: 'campaign',           uiExposure: 'VISIBLE_UI',      uiType: 'page',   clientFn: 'getCampaigns',             uiLocation: '/app/dashboard',              connected: true },
  { method: 'GET',  path: '/api/campaigns/:id',          label: 'Get campaign by ID',          module: 'campaign',           uiExposure: 'VISIBLE_UI',      uiType: 'page',   clientFn: 'getCampaign',              uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'PATCH',path: '/api/campaigns/:id',          label: 'Update campaign',             module: 'campaign',           uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'updateCampaign',           uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/campaigns/:id/concepts', label: 'List concepts for campaign',  module: 'campaign',           uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getCampaignConcepts',      uiLocation: '/app/campaign/[id]',          connected: true },

  // ── CONCEPTS ────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/concepts',               label: 'Create concept',              module: 'concept',            uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'createConcept',            uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/concepts/:id',           label: 'Get concept',                 module: 'concept',            uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getConcept',               uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'PATCH',path: '/api/concepts/:id',           label: 'Update concept',              module: 'concept',            uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'updateConcept',            uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'POST', path: '/api/concepts/:id/execute',   label: 'Execute concept (run AI)',    module: 'concept',            uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'executeConcept',           uiLocation: '/app/campaign/[id]',          connected: true },

  // ── ANGLES ──────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/angles',                 label: 'List angles',                 module: 'angle',              uiExposure: 'VISIBLE_UI',      uiType: 'page',   clientFn: 'getAngles',                uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'POST', path: '/api/angles',                 label: 'Create angle',                module: 'angle',              uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'createAngle',              uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/angles/:slug',           label: 'Get angle detail by slug',    module: 'angle',              uiExposure: 'VISIBLE_UI',      uiType: 'page',   clientFn: 'getAngleBySlug',           uiLocation: '/app/angle/[slug]',           connected: false, notes: 'Page not yet created' },
  { method: 'GET',  path: '/api/angles/:id/performance', label: 'Angle performance metrics',   module: 'angle',              uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getAnglePerformance',      uiLocation: '/app/angle/[slug]',           connected: false, notes: 'Page not yet created' },

  // ── GENERATIONS ─────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/generations',            label: 'Create generation',           module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'createGeneration',         uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/generations/by-campaign',label: 'List generations by campaign',module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getGenerationsByCampaign', uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/generations/:id',        label: 'Get generation',              module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getGeneration',            uiLocation: '/result/[executionId]',       connected: true },
  { method: 'PATCH',path: '/api/generations/:id/block',  label: 'Update generation block',     module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'updateGenerationBlock',    uiLocation: '/result/[executionId]',       connected: true },
  { method: 'POST', path: '/api/generations/:id/improve',label: 'AI-improve generation block', module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'improveGenerationBlock',   uiLocation: '/result/[executionId]',       connected: true },
  { method: 'GET',  path: '/api/generations/:id/versions',label: 'List generation versions',   module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getGenerationVersions',    uiLocation: '/result/[executionId]',       connected: true },
  { method: 'POST', path: '/api/generations/:id/versions',label: 'Create version snapshot',    module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'createGenerationVersion',  uiLocation: '/result/[executionId]',       connected: true },
  { method: 'POST', path: '/api/versions/:id/restore',   label: 'Restore version',             module: 'generations',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'restoreGenerationVersion', uiLocation: '/result/[executionId]',       connected: true },

  // ── VIDEO / CAROUSEL / BANNER / IMAGE ────────────────────────────────────────
  { method: 'POST', path: '/api/video',                  label: 'Generate video',              module: 'video',              uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'generateVideo',            uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'POST', path: '/api/carousel',               label: 'Generate carousel',           module: 'carousel',           uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'generateCarousel',         uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'POST', path: '/api/banner',                 label: 'Generate banner',             module: 'banner',             uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'generateBanner',           uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'POST', path: '/api/image',                  label: 'Generate image',              module: 'image',              uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'generateImage',            uiLocation: '/app/campaign/[id]',          connected: true },

  // ── SCORING ─────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/scoring/score',          label: 'Score a creative',            module: 'scoring',            uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'scoreCreative',            uiLocation: '/result/[executionId]',       connected: true },
  { method: 'GET',  path: '/api/scoring/history',        label: 'Scoring history',             module: 'scoring',            uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getScoringHistory',        uiLocation: '/app/history',                connected: true },

  // ── MEMORY ──────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/memory',                 label: 'Read memory state',           module: 'memory',             uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getMemory',                uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'POST', path: '/api/memory/store',           label: 'Store memory signal',         module: 'memory',             uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'storeMemory',              uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },
  { method: 'POST', path: '/api/memory/query',           label: 'Query memory',                module: 'memory',             uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'queryMemory',              uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },
  { method: 'GET',  path: '/api/memory/campaign/:id',    label: 'Campaign memory signals',     module: 'memory',             uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getCampaignMemory',        uiLocation: '/app/campaign/[id] (pro)',    connected: true },

  // ── FEEDBACK ────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/feedback',               label: 'Send feedback signal',        module: 'feedback',           uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   clientFn: 'sendFeedback',             uiLocation: 'result page (auto)',          connected: true },

  // ── INSIGHTS ────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/insights/campaign/:id',  label: 'Campaign AI insight',         module: 'insights',           uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getCampaignInsight',       uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'POST', path: '/api/insights/campaign/:id/regenerate', label: 'Regenerate campaign insight', module: 'insights', uiExposure: 'VISIBLE_UI', uiType: 'action', clientFn: 'regenerateCampaignInsight', uiLocation: '/app/campaign/[id]', connected: true },

  // ── OUTCOMES ────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/outcomes',               label: 'List outcomes',               module: 'outcomes',           uiExposure: 'VISIBLE_UI',      uiType: 'page',   clientFn: 'getOutcomes',              uiLocation: '/app/outcomes',               connected: true },
  { method: 'POST', path: '/api/outcomes',               label: 'Submit outcome',              module: 'outcomes',           uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   clientFn: 'submitOutcome',            uiLocation: 'auto (feedback loop)',        connected: true },
  { method: 'GET',  path: '/api/outcomes/recent',        label: 'Recent outcomes',             module: 'outcomes',           uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getRecentOutcomes',        uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },
  { method: 'GET',  path: '/api/outcomes/analytics',     label: 'Outcomes analytics',          module: 'outcomes',           uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getOutcomesAnalytics',     uiLocation: '/app/outcomes',               connected: true },

  // ── PERFORMANCE ─────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/performance/import',     label: 'Import performance CSV',      module: 'performance',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'importPerformanceCsv',     uiLocation: '/app/import',                 connected: true },
  { method: 'POST', path: '/api/performance/confirm',    label: 'Confirm performance import',  module: 'performance',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'confirmImport',            uiLocation: '/app/import',                 connected: true },
  { method: 'GET',  path: '/api/performance/insights',   label: 'Performance insights',        module: 'performance',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getPerformanceInsights',   uiLocation: '/app/import (success)',       connected: true },

  // ── LEARNING ────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/learning/cycle',         label: 'Run learning cycle',          module: 'learning',           uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'runLearningCycle',         uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'GET',  path: '/api/learning/status',        label: 'Learning system status',      module: 'learning',           uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getLearningStatus',        uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'GET',  path: '/api/learning/global-stats',  label: 'Global learning stats',       module: 'learning',           uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getGlobalStats',           uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'GET',  path: '/api/learning/log',           label: 'AI decision log',             module: 'learning',           uiExposure: 'ADMIN_UI',        uiType: 'stream', clientFn: 'getDecisionLog',           uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'GET',  path: '/api/learning/signal-stream', label: 'Live signal stream',          module: 'learning',           uiExposure: 'ADMIN_UI',        uiType: 'stream', clientFn: 'getLiveSignalStream',      uiLocation: '/app/campaign/[id] (pro)',    connected: true },

  // ── EVOLUTION ───────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/evolution/mutations',    label: 'List evolution mutations',    module: 'evolution',          uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getEvolutionMutations',    uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'POST', path: '/api/evolution/mutate',       label: 'Force evolution mutation',    module: 'evolution',          uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'triggerEvolutionMutation', uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'GET',  path: '/api/evolution/status',       label: 'Evolution system status',     module: 'evolution',          uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getEvolutionStatus',       uiLocation: '/app/campaign/[id] (pro)',    connected: true },

  // ── MIROFISH ────────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/mirofish/simulate',      label: 'MIROFISH simulation',         module: 'mirofish',           uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'mirofishSimulate',         uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/mirofish/learning',      label: 'MIROFISH learning status',    module: 'mirofish',           uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'mirofishLearningStatus',   uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'POST', path: '/api/mirofish/learn',         label: 'MIROFISH run learning loop',  module: 'mirofish',           uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'mirofishRunLearningLoop',  uiLocation: '/app/campaign/[id] (pro)',    connected: true },

  // ── ORCHESTRATOR ────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/orchestrator/decide',    label: 'Orchestrator angle decision', module: 'orchestrator',       uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'orchestratorDecide',       uiLocation: '/app/campaign/[id]',          connected: true },

  // ── FATIGUE ─────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/fatigue',                label: 'All angle fatigue levels',    module: 'fatigue',            uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getFatigueAll',            uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'GET',  path: '/api/fatigue/:slug',          label: 'Single angle fatigue',        module: 'fatigue',            uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getFatigueSingle',         uiLocation: '/app/angle/[slug]',           connected: false, notes: 'Page not yet created' },
  { method: 'POST', path: '/api/fatigue/reset/:slug',    label: 'Reset angle fatigue',         module: 'fatigue',            uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'resetFatigue',             uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── EXPLORATION ─────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/exploration/pressure',   label: 'Exploration pressure delta',  module: 'exploration',        uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getExplorationPressure',   uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'POST', path: '/api/exploration/boost',      label: 'Boost exploration pressure',  module: 'exploration',        uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'boostExploration',         uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── EMERGENCE ───────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/emergence/state',        label: 'Emergence system state',      module: 'emergence',          uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getEmergenceState',        uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'POST', path: '/api/emergence/refresh',      label: 'Refresh emergence state',     module: 'emergence',          uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'refreshEmergenceState',    uiLocation: '/app/campaign/[id] (pro)',    connected: true },

  // ── CAUSAL ATTRIBUTION ──────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/causal/analyze/:id',     label: 'Causal attribution trace',    module: 'causal-attribution', uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'causalAttributionAnalyze', uiLocation: '/app/campaign/[id]',          connected: true },

  // ── HOOK BOOSTER ────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/hook-booster/generate',  label: 'Hook Booster v1 (generate)',  module: 'hook-booster',       uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'hookBoosterGenerate',      uiLocation: '/result/[executionId]',       connected: true },
  { method: 'POST', path: '/api/hook-booster/boost',     label: 'Hook Booster v2 (boost)',     module: 'hook-booster',       uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'hookBoosterBoost',         uiLocation: '/result/[executionId]',       connected: true },

  // ── SCENE REWRITER ──────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/scene-rewriter/rewrite', label: 'Scene rewriter',              module: 'scene-rewriter',     uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'sceneRewrite',             uiLocation: '/result/[executionId]',       connected: true },

  // ── AUTO-WINNER ─────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/auto-winner/evaluate',   label: 'Auto-winner evaluation',      module: 'auto-winner',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'autoWinnerEvaluate',       uiLocation: '/result/[executionId]',       connected: true },

  // ── CREATIVE AI ─────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/creative-ai/refine',     label: 'Refine creative block (AI)',  module: 'creative-ai',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'refineCreativeBlock',      uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },
  { method: 'GET',  path: '/api/creative-ai/history',    label: 'Creative AI refinement history', module: 'creative-ai',    uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getCreativeAiHistory',     uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── USER STYLE ──────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/user-style',             label: 'Get user style profile',      module: 'user-style',         uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getUserStyle',             uiLocation: '/app/settings',               connected: true },
  { method: 'POST', path: '/api/user-style/signal',      label: 'Send style signal',           module: 'user-style',         uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   clientFn: 'sendStyleSignal',          uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── CREATIVE DNA ────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/creative-dna',           label: 'Get creative DNA profile',    module: 'creative-dna',       uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getCreativeDna',           uiLocation: '/app/settings',               connected: true },
  { method: 'POST', path: '/api/creative-dna/rebuild',   label: 'Rebuild creative DNA',        module: 'creative-dna',       uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'rebuildCreativeDna',       uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── USER INSIGHT ────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/user-insight',           label: 'Get user insight summary',    module: 'user-insight',       uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getUserInsight',           uiLocation: '/app/dashboard',              connected: true },
  { method: 'POST', path: '/api/user-insight/refresh',   label: 'Refresh user insight',        module: 'user-insight',       uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'refreshUserInsight',       uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── GLOBAL MEMORY ───────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/global-memory',          label: 'Global memory state',         module: 'global-memory',      uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getGlobalMemory',          uiLocation: '/app/campaign/[id] (pro)',    connected: true },
  { method: 'POST', path: '/api/global-memory/learn',    label: 'Trigger global memory learn', module: 'global-memory',      uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'triggerGlobalMemoryLearn', uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── OBSERVABILITY ───────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/observability/status',   label: 'System observability status', module: 'observability',      uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getObservabilityStatus',   uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },
  { method: 'GET',  path: '/api/observability/logs',     label: 'Observability logs',          module: 'observability',      uiExposure: 'ADMIN_UI',        uiType: 'stream', clientFn: 'getObservabilityLogs',     uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── AUTONOMOUS LOOP ─────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/autonomous-loop/status', label: 'Autonomous loop status',      module: 'autonomous-loop',    uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getAutonomousLoopStatus',  uiLocation: '/admin/observability/self-improving-loop', connected: false, notes: 'Page not yet created' },
  { method: 'POST', path: '/api/autonomous-loop/trigger',label: 'Trigger autonomous loop',     module: 'autonomous-loop',    uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'triggerAutonomousLoop',    uiLocation: '/admin/observability/self-improving-loop', connected: false, notes: 'Page not yet created' },
  { method: 'POST', path: '/api/autonomous-loop/stop',   label: 'Stop autonomous loop',        module: 'autonomous-loop',    uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'stopAutonomousLoop',       uiLocation: '/admin/observability/self-improving-loop', connected: false, notes: 'Page not yet created' },
  { method: 'GET',  path: '/api/autonomous-loop/audit',  label: 'Autonomous loop audit log',   module: 'autonomous-loop',    uiExposure: 'ADMIN_UI',        uiType: 'stream', clientFn: 'getAutonomousLoopAudit',   uiLocation: '/admin/observability/self-improving-loop', connected: false, notes: 'Page not yet created' },
  { method: 'POST', path: '/api/autonomous-loop/rollback',label: 'Rollback autonomous action', module: 'autonomous-loop',    uiExposure: 'ADMIN_UI',        uiType: 'action', clientFn: 'rollbackAutonomousAction', uiLocation: '/admin/observability/self-improving-loop', connected: false, notes: 'Page not yet created' },

  // ── ANALYTICS / DASHBOARD ───────────────────────────────────────────────────
  { method: 'GET',  path: '/api/admin-analytics/overview', label: 'Admin analytics overview',  module: 'admin-analytics',    uiExposure: 'ADMIN_UI',        uiType: 'page',   clientFn: 'getAdminAnalytics',        uiLocation: '/app/analytics',              connected: true },
  { method: 'GET',  path: '/api/dashboard/performance',  label: 'Performance dashboard',       module: 'dashboard',          uiExposure: 'VISIBLE_UI',      uiType: 'page',   clientFn: 'getPerformanceDashboard',  uiLocation: '/app/dashboard',              connected: true },

  // ── ANGLE INSIGHTS / REFERENCES ─────────────────────────────────────────────
  { method: 'GET',  path: '/api/angle-insights',         label: 'Angle insights',              module: 'angle-insights',     uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getAngleInsights',         uiLocation: '/app/campaign/[id]',          connected: true },
  { method: 'GET',  path: '/api/angle-references',       label: 'Angle references library',    module: 'angle-references',   uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getAngleReferences',       uiLocation: '/app/campaign/[id]',          connected: true },

  // ── PRODUCT ─────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/product',                label: 'Get product profile',         module: 'product',            uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getProduct',               uiLocation: '/app/settings',               connected: true },
  { method: 'POST', path: '/api/product',                label: 'Create/update product',       module: 'product',            uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'upsertProduct',            uiLocation: '/app/settings',               connected: true },

  // ── PRODUCT CONTRACT ────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/product-contract',       label: 'Product contract',            module: 'product-contract',   uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getProductContract',       uiLocation: '/app/settings',               connected: true },
  { method: 'POST', path: '/api/product-contract',       label: 'Set product contract',        module: 'product-contract',   uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'setProductContract',       uiLocation: '/app/settings',               connected: true },

  // ── PRODUCT RUN ─────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/product-run',            label: 'Get product run config',      module: 'product-run',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getProductRun',            uiLocation: '/app/settings',               connected: true },
  { method: 'POST', path: '/api/product-run',            label: 'Set product run config',      module: 'product-run',        uiExposure: 'VISIBLE_UI',      uiType: 'action', clientFn: 'setProductRun',            uiLocation: '/app/settings',               connected: true },

  // ── REALITY ─────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/reality',                label: 'Reality check / grounding',   module: 'reality',            uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getReality',               uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── TRENDS ──────────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/trends',                 label: 'Market trends data',          module: 'trends',             uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getTrends',                uiLocation: '/app/dashboard',              connected: true },

  // ── SMART ROUTING ───────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/routing/smart',          label: 'Smart routing decision',      module: 'routing',            uiExposure: 'HIDDEN_INTERNAL', uiType: 'none',   clientFn: 'smartRoute',               uiLocation: 'none',                        connected: false, notes: 'Internal only' },

  // ── CROSS-CLIENT LEARNING ───────────────────────────────────────────────────
  { method: 'GET',  path: '/api/learning/cross-client',  label: 'Cross-client learning state', module: 'cross-client-learning', uiExposure: 'ADMIN_UI',   uiType: 'panel',  clientFn: 'getCrossClientLearning',   uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── CLIENT MEMORY ───────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/clients/memory',         label: 'Client memory profile',       module: 'client-memory',      uiExposure: 'ADMIN_UI',        uiType: 'panel',  clientFn: 'getClientMemory',          uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── COST OPTIMIZATION ───────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/optimization/cost',      label: 'Cost optimization state',     module: 'cost-optimization',  uiExposure: 'ADMIN_UI',        uiType: 'metric', clientFn: 'getCostOptimization',      uiLocation: 'none',                        connected: false, notes: 'Client fn missing' },

  // ── IMPROVEMENT ─────────────────────────────────────────────────────────────
  { method: 'POST', path: '/api/improvement/suggest',    label: 'Improvement suggestions',     module: 'improvement',        uiExposure: 'VISIBLE_UI',      uiType: 'panel',  clientFn: 'getImprovementSuggestions',uiLocation: '/result/[executionId]',       connected: true },

  // ── REGISTRY (self-referential) ──────────────────────────────────────────────
  { method: 'GET',  path: '/api/registry/endpoints',          label: 'Endpoint registry',                module: 'registry',      uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getRegistryEndpoints',  uiLocation: '/system-audit',          connected: true },

  // ── SYSTEM AUDIT — Self-Healing Engine ───────────────────────────────────────
  { method: 'GET',  path: '/api/system-audit/run',            label: 'Run self-healing audit',           module: 'system-audit',  uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'runSystemAudit',        uiLocation: '/system-audit',          connected: true },
  { method: 'POST', path: '/api/system-audit/resolve',        label: 'Resolve single orphan endpoint',   module: 'system-audit',  uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'resolveEndpoint',       uiLocation: '/system-audit',          connected: true },
  { method: 'POST', path: '/api/system-audit/resolve-all',    label: 'Resolve all orphans (batch)',      module: 'system-audit',  uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'resolveAllOrphans',     uiLocation: '/system-audit',          connected: true },
  { method: 'GET',  path: '/api/system-audit/generated',      label: 'List auto-generated UI tools',     module: 'system-audit',  uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getGeneratedTools',     uiLocation: '/system-generated',      connected: true },
  { method: 'GET',  path: '/api/system-audit/generated/:name',label: 'Get generated tool config',        module: 'system-audit',  uiExposure: 'VISIBLE_UI', uiType: 'panel',  clientFn: 'getGeneratedTool',      uiLocation: '/system-generated/[name]',connected: true },

  // ── FINANCIAL OS ─────────────────────────────────────────────────────────────
  { method: 'GET',  path: '/api/financial-os/autonomy',                   label: 'Get autonomy level',                  module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'metric', clientFn: 'getAutonomyLevel',              uiLocation: '/financial-os',          connected: true },
  { method: 'POST', path: '/api/financial-os/autonomy',                   label: 'Set autonomy level',                  module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'action', clientFn: 'setAutonomyLevel',              uiLocation: '/financial-os',          connected: true },
  { method: 'GET',  path: '/api/financial-os/cost/summary',               label: 'Real-time cost summary',              module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getCostSummary',               uiLocation: '/financial-os/cost',     connected: true },
  { method: 'GET',  path: '/api/financial-os/cost/events',                label: 'Cost events stream',                  module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'stream', clientFn: 'getCostEvents',                uiLocation: '/financial-os/cost',     connected: true },
  { method: 'GET',  path: '/api/financial-os/profit/zones',               label: 'Profit zones (SCALE/FIX/KILL)',       module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getProfitZones',               uiLocation: '/financial-os/profit',   connected: true },
  { method: 'POST', path: '/api/financial-os/profit/action',              label: 'Execute profit action',               module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'action', clientFn: 'executeProfitAction',          uiLocation: '/financial-os/profit',   connected: true },
  { method: 'GET',  path: '/api/financial-os/cfo/forecast',               label: 'AI CFO profit forecast',              module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getCfoForecast',               uiLocation: '/financial-os/cfo',      connected: true },
  { method: 'GET',  path: '/api/financial-os/cfo/insights',               label: 'AI CFO strategic insights',           module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'panel',  clientFn: 'getCfoInsights',               uiLocation: '/financial-os/cfo',      connected: true },
  { method: 'GET',  path: '/api/financial-os/budget/status',              label: 'Budget allocation status',            module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getBudgetStatus',              uiLocation: '/financial-os/budget',   connected: true },
  { method: 'POST', path: '/api/financial-os/budget/rebalance',           label: 'Trigger budget rebalance',            module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'action', clientFn: 'triggerRebalance',             uiLocation: '/financial-os/budget',   connected: true },
  { method: 'POST', path: '/api/financial-os/budget/approve/:id',         label: 'Approve rebalance proposal',          module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'action', clientFn: 'approveRebalanceProposal',     uiLocation: '/financial-os/budget',   connected: true },
  { method: 'GET',  path: '/api/financial-os/revenue/forecast/:campaignId',label: 'Per-campaign revenue forecast',      module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getCampaignRevenueForecast',   uiLocation: '/financial-os/revenue',  connected: true },
  { method: 'GET',  path: '/api/financial-os/revenue/portfolio',          label: 'Portfolio revenue forecast',          module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getPortfolioRevenueForecast',  uiLocation: '/financial-os/revenue',  connected: true },
  { method: 'GET',  path: '/api/financial-os/learning/profit/model',      label: 'Profit learning model state',         module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'panel',  clientFn: 'getProfitModel',               uiLocation: '/financial-os/learning', connected: true },
  { method: 'POST', path: '/api/financial-os/learning/profit/update',     label: 'Trigger profit learning cycle',       module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'action', clientFn: 'triggerProfitLearning',        uiLocation: '/financial-os/learning', connected: true },
  { method: 'GET',  path: '/api/financial-os/learning/profit/insights',   label: 'Learned profit patterns',             module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'panel',  clientFn: 'getLearningInsights',          uiLocation: '/financial-os/learning', connected: true },
  { method: 'GET',  path: '/api/financial-os/ceo/portfolio',              label: 'AI CEO portfolio view',               module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getCeoPortfolio',              uiLocation: '/financial-os/ceo',      connected: true },
  { method: 'GET',  path: '/api/financial-os/ceo/strategy',               label: 'AI CEO strategic decisions',          module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getCeoStrategy',               uiLocation: '/financial-os/ceo',      connected: true },
  { method: 'GET',  path: '/api/financial-os/ceo/allocation',             label: 'AI CEO capital allocation map',       module: 'financial-os', uiExposure: 'VISIBLE_UI', uiType: 'page',   clientFn: 'getCapitalAllocation',         uiLocation: '/financial-os/ceo',      connected: true },

  // Competitor Intelligence
  { method: 'POST', path: '/api/competitor/analyze',              label: 'Start competitor analysis',        module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'startCompetitorAnalysis',   uiLocation: '/competitor-intelligence', connected: true },
  { method: 'GET',  path: '/api/competitor/jobs',                 label: 'List analysis jobs',               module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'listCompetitorJobs',         uiLocation: '/competitor-intelligence', connected: true },
  { method: 'GET',  path: '/api/competitor/results/:jobId',       label: 'Get analysis result',              module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getCompetitorResult',         uiLocation: '/competitor-intelligence', connected: true },
  { method: 'GET',  path: '/api/competitor/insights/:jobId',      label: 'Get insights and clusters',        module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getCompetitorInsights',       uiLocation: '/competitor-intelligence', connected: true },
  { method: 'POST', path: '/api/competitor/export-to-builder',    label: 'Export intel to builder',          module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'exportIntelToBuilder',        uiLocation: '/competitor-intelligence', connected: true },
  { method: 'GET',  path: '/api/competitor/exports',              label: 'List previous builder exports',    module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getCompetitorExports',        uiLocation: '/competitor-intelligence', connected: true },
  { method: 'POST', path: '/api/competitor/monitoring/enable',    label: 'Enable CI monitoring',             module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'enableCIMonitoring',          uiLocation: '/competitor-intelligence', connected: true },
  { method: 'POST', path: '/api/competitor/monitoring/disable',   label: 'Disable CI monitoring',            module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'disableCIMonitoring',         uiLocation: '/competitor-intelligence', connected: true },
  { method: 'GET',  path: '/api/competitor/monitoring/status',    label: 'Get monitoring engine state',      module: 'competitor-intelligence', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getCIMonitoringStatus',       uiLocation: '/competitor-intelligence', connected: true },

  // Trend Prediction Engine
  { method: 'POST', path: '/api/trends/predict',               label: 'Run trend prediction pass',          module: 'trend-prediction', uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'runTrendPrediction',       uiLocation: '/trends', connected: true },
  { method: 'GET',  path: '/api/trends/predict',               label: 'Get current predicted trends',       module: 'trend-prediction', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getPredictedTrends',       uiLocation: '/trends', connected: true },
  { method: 'GET',  path: '/api/trends/stream',                label: 'SSE stream for trend updates',       module: 'trend-prediction', uiExposure: 'ADMIN_UI',   uiType: 'stream', clientFn: 'streamTrends',             uiLocation: '/trends', connected: true },
  { method: 'GET',  path: '/api/trends/history',               label: 'Full trend history',                 module: 'trend-prediction', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getTrendHistory',          uiLocation: '/trends', connected: true },
  { method: 'GET',  path: '/api/trends/summary',               label: 'Trend dashboard summary',            module: 'trend-prediction', uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getTrendSummary',          uiLocation: '/trends', connected: true },
  // Ad Intelligence
  { method: 'POST', path: '/api/ads/aggregate',                label: 'Aggregate multi-platform ad data',   module: 'ad-intelligence',  uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'aggregateAdIntel',         uiLocation: '/ad-intelligence', connected: true },
  { method: 'GET',  path: '/api/ads/platform-analysis',        label: 'Platform-level analysis breakdown',  module: 'ad-intelligence',  uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getAdPlatformAnalysis',    uiLocation: '/ad-intelligence', connected: true },
  { method: 'GET',  path: '/api/ads/unified-insights',         label: 'Unified cross-platform insights',    module: 'ad-intelligence',  uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getUnifiedAdInsights',     uiLocation: '/ad-intelligence', connected: true },
  { method: 'GET',  path: '/api/ads/all',                      label: 'All normalized ads',                 module: 'ad-intelligence',  uiExposure: 'ADMIN_UI',   uiType: 'page',   clientFn: 'getAllNormalizedAds',      uiLocation: '/ad-intelligence', connected: true },
  { method: 'POST', path: '/api/ads/generate-multi-platform',  label: 'Generate multi-platform ad variants',module: 'ad-intelligence',  uiExposure: 'ADMIN_UI',   uiType: 'action', clientFn: 'generateMultiPlatformAd', uiLocation: '/ad-intelligence', connected: true },
];

@ApiTags('Registry')
@Controller('api/registry')
export class RegistryController {

  @Get('endpoints')
  @ApiOperation({ summary: 'Full endpoint registry — uiExposure / uiType / connection status for every route' })
  getEndpoints(): {
    total: number;
    connected: number;
    disconnected: number;
    byExposure: Record<string, RegistryEndpoint[]>;
    endpoints: RegistryEndpoint[];
  } {
    const total        = ENDPOINTS.length;
    const connected    = ENDPOINTS.filter(e => e.connected).length;
    const disconnected = total - connected;

    const byExposure: Record<string, RegistryEndpoint[]> = {
      VISIBLE_UI:       ENDPOINTS.filter(e => e.uiExposure === 'VISIBLE_UI'),
      ADMIN_UI:         ENDPOINTS.filter(e => e.uiExposure === 'ADMIN_UI'),
      HIDDEN_INTERNAL:  ENDPOINTS.filter(e => e.uiExposure === 'HIDDEN_INTERNAL'),
    };

    return { total, connected, disconnected, byExposure, endpoints: ENDPOINTS };
  }
}
