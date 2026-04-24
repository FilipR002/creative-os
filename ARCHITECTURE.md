# Creative OS — Final System Architecture

> **Version:** 2.0  
> **Status:** Canonical  
> This document supersedes all previous architecture descriptions, diagrams, and comments.  
> If anything in the codebase contradicts this document, the codebase is wrong.

---

## Mental Model

Creative OS is a **single intelligent creative operating system**.

It is not a collection of tools.  
It is not a wrapper around video generators.  
It is a decision-making system that interprets campaign intent and outputs conversion-optimised creative assets.

Every layer serves one goal: **maximise creative performance**.

---

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    CREATIVE BRAIN LAYER                      │
│                  (Sonnet — decision + script)                │
└───────────────────────────┬─────────────────────────────────┘
                            │  structured blueprint
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   MODE ROUTING LAYER                         │
│          (decides: UGC / Cinematic / Hybrid)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │  { mode, model, reasoning }
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  VIDEO RENDER ENGINE                         │
│              Kling ◄──────────────► Veo                     │
│           (universal render engines — not paradigms)         │
└───────────────────────────┬─────────────────────────────────┘
                            │  raw assets
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXECUTION ENGINE                           │
│              POST /product/execution/start                   │
└───────────────────────────┬─────────────────────────────────┘
                            │  executionId
                            ▼
┌─────────────────────────────────────────────────────────────┐
│               SCORING + LEARNING LAYER                       │
│         evaluate → rank → select winner → learn             │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Creative Brain Layer (Sonnet)

**Role:** Interpret campaign intent. Generate creative strategy. Produce blueprint.

**Responsibilities:**
- Parse campaign brief + concept data
- Define hook / problem / solution / CTA narrative arc
- Select angle slug and creative positioning
- Determine execution mode hint (UGC / cinematic / hybrid)
- Produce platform-specific copy (hook, CTA, value proposition, objection)

**Outputs:**
```typescript
MasterBlueprint {
  format:           'video' | 'carousel' | 'banner'
  angle_slug:       string
  style_dna:        { tone, pacing, visual_style, emotion, hook_type }
  platform_copy:    { hook, core_message, value_proposition, key_objection, cta, platform }
  production_stack: { duration_tier?, slide_count?, sizes? }
}
```

**Key rule:** Sonnet decides WHAT to make and WHY. It does not decide which render engine executes it.

---

## Layer 2 — Mode Routing Layer (Decision Engine)

**Role:** Translate creative intent into execution mode. Select the best render engine pairing.

**Responsibilities:**
- Evaluate campaign goal, platform, script type, audience signal
- Decide execution mode
- Assign render engine(s) accordingly

**Decision Output:**
```typescript
{
  mode:      'ugc' | 'cinematic' | 'hybrid'
  model:     'kling' | 'veo' | 'mixed'
  reasoning: string
}
```

**Mode definitions:**

| Mode | Description | Typical platform | Render engine |
|---|---|---|---|
| `ugc` | Raw, authentic, creator-feel content | TikTok, IG Reels | kling (primary) |
| `cinematic` | High-production, brand-forward content | YouTube, Display, CTV | veo (primary) |
| `hybrid` | Mixed — UGC hook, cinematic solution/CTA | Meta Ads, Google UAC | mixed (kling + veo) |

**Routing signals (in priority order):**
1. Platform signal (`tiktok` → ugc; `youtube` → cinematic; `instagram` → balanced)
2. Hook aggressiveness (`high` → ugc; `low` → cinematic)
3. Pacing (`aggressive` → ugc; `moderate` → cinematic)
4. Campaign goal (`conversion` → mode determined by platform; `awareness` → cinematic)
5. Risk tolerance (`> 0.55` → hybrid; `≤ 0.4` → exploit known mode)

**Key rule:** The routing layer decides HOW to make it. Not what to make.

---

## Layer 3 — Video Render Engine (Kling / Veo)

**Role:** Generate video from scene instructions.

### ⚠️ Critical Clarification

**Kling and Veo are NOT separate systems.**  
**They are NOT associated with specific content styles.**

Both are **universal render engines** with different technical strengths:

| Engine | Strengths | Not exclusive to |
|---|---|---|
| Kling | Reliable execution, motion control, fast iteration | UGC only |
| Veo | Cinematic depth, lighting, camera language | Cinematic only |

Either engine can execute either mode. The routing layer assigns based on campaign signals, not on a hardcoded kling=UGC / veo=cinematic rule.

**Responsibilities:**
- Receive scene-level instructions from the execution layer
- Generate video frames/clips per kling_prompt
- Return raw assets to the execution engine

**Key rule:** No engine has a monopoly on a style. Routing decides. Engines execute.

---

## Layer 4 — Execution Engine

**Role:** Single, unified entry point for all asset generation and orchestration.

**Endpoint:** `POST /product/execution/start`

**Responsibilities:**
- Queue management
- Parallel scene execution
- Asset assembly
- Render pipeline orchestration
- Return `executionId` for downstream polling

**Hard rule:** No layer bypasses this endpoint. All generation routes through it.

**Related endpoints (internal):**
- `POST /api/video/generate` — video asset generation
- `POST /api/video/{id}/images` — scene image extraction
- `POST /api/carousel/generate` — carousel asset generation
- `POST /api/banner/generate` — banner asset generation

---

## Layer 5 — Scoring + Learning Layer

**Role:** Evaluate creative output. Select winner. Feed learning system.

**Scoring endpoints:**
```
POST /api/scoring/evaluate    → evaluate creative batch
POST /api/auto-winner/evaluate → select best performer
```

**Learning endpoints:**
```
POST /api/outcomes/report              → ingest real performance data
POST /api/angles/learning/cycle/{id}   → trigger angle weight update
```

**Scoring dimensions:**
- CTR proxy (hook strength, visual hierarchy)
- Engagement proxy (emotional intensity, retention)
- Conversion proxy (CTA clarity, objection handling)
- Clarity (message density, readability)

**Key rule:** Scores are always persisted. Learning always fires after scoring. Both are non-blocking to the response.

---

## Layer 6 — Learning Loop

**Role:** Continuous system improvement through outcome feedback.

**Responsibilities:**
- Angle weight optimisation (EWMA smoothing)
- Creative DNA extraction and persistence (top-20% threshold)
- Performance weighting per format + angle combo
- Evolution cycle (mutation + promotion of creative variants)
- MIROFISH predictive simulation calibration

**Key rule:** Learning never blocks generation. All learning triggers are fire-and-forget.

---

## Full Request Flow

```
POST /api/govolo/generate
        │
        ├─ 1. Ownership check (CampaignService)
        ├─ 2. Fetch campaign + concept
        ├─ 3. Sonnet → MasterBlueprint        [Layer 1]
        ├─ 4. Blueprint validation + auto-fix
        │
        ├─ 5. Fetch Creative DNA context
        ├─ 6. SmartRoutingService.decide()     [Layer 2]
        ├─ 7. Extract virtual scenes
        ├─ 8. Optimise scenes
        │       ├─ HookBoosterService
        │       ├─ SceneRewriterService
        │       └─ DNA injection
        ├─ 9. Route each scene → mode + engine [Layer 2]
        ├─ 10. Execute via VideoService/Carousel/Banner  [Layer 3 + 4]
        │
        ├─ 11. ScoringService.evaluate()       [Layer 5]
        ├─ 12. AutoWinnerService.evaluate()    [Layer 5]
        │
        ├─ 13. OutcomesService.report()   ──── fire-and-forget [Layer 6]
        └─ 14. LearningService.runCycle() ──── fire-and-forget [Layer 6]

Response: { executionId, bestCreative, score, modeUsage, pipelineTrace }
```

---

## What Was Removed / Corrected

| Old (incorrect) | New (correct) |
|---|---|
| kling = UGC engine | kling = universal render engine, strong in motion control |
| veo = cinematic engine | veo = universal render engine, strong in depth/lighting |
| model routing → kling \| veo | mode routing → ugc \| cinematic \| hybrid |
| `modelUsage: { kling, veo }` in response | `modeUsage: { ugc, cinematic, hybrid }` |
| exploit → kling / explore → veo | mode derived from platform + goal + signals |
| Govolo = separate product name | Creative OS = single system name |

---

## Endpoints Reference

| Endpoint | Layer | Purpose |
|---|---|---|
| `POST /api/govolo/generate` | Entry | Full pipeline trigger |
| `POST /api/creative-director/generate` | Layer 1 | Multi-format creative plan (no execution) |
| `POST /api/routing/decide` | Layer 2 | Mode routing decision |
| `POST /api/hook-booster/boost` | Layer 1 support | Hook optimisation |
| `POST /api/scene-rewriter/rewrite` | Layer 1 support | Scene copy optimisation |
| `GET /api/creative-dna/prompt-context` | Layer 1 support | DNA injection |
| `POST /product/execution/start` | Layer 4 | Execution engine |
| `POST /api/video/generate` | Layer 3+4 | Video asset generation |
| `POST /api/carousel/generate` | Layer 3+4 | Carousel asset generation |
| `POST /api/banner/generate` | Layer 3+4 | Banner asset generation |
| `POST /api/scoring/evaluate` | Layer 5 | Creative scoring |
| `POST /api/auto-winner/evaluate` | Layer 5 | Winner selection |
| `POST /api/outcomes/report` | Layer 6 | Outcome ingestion |
