# Creative OS — Canonical System Architecture

> **Version:** 3.0  
> **Status:** Canonical — Production Reference  
> **Supersedes:** All previous architecture descriptions, diagrams, comments, and informal notes.  
> **Authority:** If any code, comment, or document contradicts this specification, **this document is correct**.

---

## Core Design Principle

Creative OS is a **single intelligent creative operating system**.

It is not a collection of tools.  
It is not a wrapper around video generators.  
It is not a multi-product suite.

It is a **unified decision-making system** that interprets campaign intent, routes execution intelligently, renders creative assets, and evolves continuously through learning.

```
One brain.  One routing system.  One execution pipeline.  Multiple rendering backends.
```

Every architectural decision is evaluated against one question:  
**Does this improve creative performance?**

---

## System Overview

```
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │                          CREATIVE OS — SYSTEM BOUNDARY                         │
 │                                                                                │
 │  ┌──────────────────────────────────────────────────────────────────────────┐  │
 │  │  [FRONTEND]          UGC CREATOR MODULE                                  │  │
 │  │                      persona builder · script generator · templates      │  │
 │  │                      ↓ outputs script text only — no render logic        │  │
 │  └─────────────────────────────────┬────────────────────────────────────────┘  │
 │                                    │  script / campaign brief                  │
 │                                    ▼                                           │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 1]     CREATIVE BRAIN  (Sonnet)                                   │ │
 │  │                script generation · narrative structure · blueprint output  │ │
 │  └────────────────────────────────┬──────────────────────────────────────────┘ │
 │                                   │  MasterBlueprint                           │
 │                                   ▼                                            │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 2]     MODE ROUTING LAYER  (Decision Engine)                      │ │
 │  │                ugc | cinematic | hybrid  ·  kling | veo | mixed           │ │
 │  └────────────────────────────────┬──────────────────────────────────────────┘ │
 │                                   │  { mode, model, reasoning }               │
 │                                   ▼                                            │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 2.5]   SCENE OPTIMIZATION LAYER                                   │ │
 │  │                hook-boost · scene rewrite · creative DNA injection        │ │
 │  └────────────────────────────────┬──────────────────────────────────────────┘ │
 │                                   │  enriched scene set                        │
 │                                   ▼                                            │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 3]     VIDEO RENDER ENGINE  (Unified Abstraction)                 │ │
 │  │                        Kling ◄──────────► Veo                             │ │
 │  │                    universal backends — not style-paradigms               │ │
 │  └────────────────────────────────┬──────────────────────────────────────────┘ │
 │                                   │  raw assets                                │
 │                                   ▼                                            │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 4]     EXECUTION ENGINE                                           │ │
 │  │                POST /product/execution/start                              │ │
 │  │                queue · orchestrate · assemble · return executionId        │ │
 │  └────────────────────────────────┬──────────────────────────────────────────┘ │
 │                                   │  executionId                               │
 │                                   ▼                                            │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 5]     SCORING + WINNER SELECTION                                 │ │
 │  │                evaluate · rank · select winner                            │ │
 │  └────────────────────────────────┬──────────────────────────────────────────┘ │
 │                                   │  scores + winner                           │
 │                                   ▼                                            │
 │  ┌───────────────────────────────────────────────────────────────────────────┐ │
 │  │  [LAYER 6]     LEARNING LOOP  (fire-and-forget)                           │ │
 │  │                outcomes · angle weights · creative DNA · evolution        │ │
 │  └───────────────────────────────────────────────────────────────────────────┘ │
 │                                                                                │
 └────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

| # | Component | Type | Layer | Responsibility | Scope |
|---|---|---|---|---|---|
| 1 | **UGC Creator Module** | Frontend UI | Pre-layer | Persona builder, script templates, creator presets | Script input only — no rendering |
| 2 | **Creative Brain (Sonnet)** | AI orchestrator | Layer 1 | Blueprint generation, narrative structuring, copy output | Backend — pure generation |
| 3 | **Mode Routing Layer** | Decision engine | Layer 2 | Select ugc / cinematic / hybrid; assign render engine | Backend — stateless |
| 4 | **Scene Optimization Layer** | Enrichment pipeline | Layer 2.5 | Hook boost, scene rewrite, Creative DNA injection | Backend — pure transform |
| 5 | **VideoRenderEngine (Kling)** | Render backend | Layer 3 | Universal video generation, motion control, fast iteration | Backend — render |
| 6 | **VideoRenderEngine (Veo)** | Render backend | Layer 3 | Universal video generation, cinematic depth, lighting | Backend — render |
| 7 | **Execution Engine** | Orchestrator | Layer 4 | Queue, scene execution, asset assembly | Backend — `POST /product/execution/start` |
| 8 | **Scoring System** | Evaluator | Layer 5 | CTR/engagement/conversion/clarity scoring, winner selection | Backend — `POST /api/scoring/evaluate` |
| 9 | **Learning Loop** | Feedback system | Layer 6 | Angle weights, Creative DNA, evolution, MIROFISH calibration | Backend — fire-and-forget |

---

## Layer Specifications

---

### Layer 0 — UGC Creator Module *(Frontend Only)*

**Type:** Frontend UI module  
**Scope:** Script input only. This module has zero effect on rendering logic.

**Contains:**
- Persona builder (define creator voice, style, audience)
- UGC script generator (testimonial, founder, review frameworks)
- Testimonial templates
- Creator style presets

**Critical boundary:**

> UGC is a **content style**. It is NOT an engine. It is NOT a backend system.  
> This module produces a script. That script enters the pipeline at Layer 1.  
> From that point, UGC is just a routing signal — nothing more.

**Hard rule:** No backend logic lives in this module. No rendering decisions are made here.

---

### Layer 1 — Creative Brain (Sonnet)

**Type:** AI orchestrator  
**Model:** Claude Sonnet  
**Role:** Interpret campaign intent. Generate structured creative blueprint.

**Inputs:**
- Campaign brief (name, goal, tone, persona, platform, formats)
- Concept data (audience, emotion, core message, offer, angle hint, objection, value proposition)
- Optional: preferred format, preferred angle slug

**Outputs — `MasterBlueprint`:**
```typescript
{
  format:           'video' | 'carousel' | 'banner'
  angle_slug:       string
  style_dna:        { tone, pacing, visual_style, emotion, hook_type }
  platform_copy:    { hook, core_message, value_proposition, key_objection, cta, platform }
  production_stack: { duration_tier?, slide_count?, sizes? }
  _meta:            { generated_at, model, version }
}
```

**Narrative structure enforced (always):**
```
HOOK → PROBLEM → SOLUTION → CTA
```

**Hard rule:** Sonnet decides WHAT to make and WHY. It does not decide which engine renders it.

---

### Layer 2 — Mode Routing Layer (Decision Engine)

**Type:** Stateless decision system  
**Role:** Translate creative intent into execution mode. Assign render engine.

**Inputs:**
- Script type
- Campaign goal (`conversion` | `awareness` | `engagement`)
- Platform
- Persona type
- Style DNA signals (pacing, hook aggressiveness, emotion)
- Risk tolerance from SmartRoutingService

**Output:**
```typescript
{
  mode:      'ugc' | 'cinematic' | 'hybrid'
  model:     'kling' | 'veo' | 'mixed'
  reasoning: string
  confidence: number   // 0–1
}
```

**Mode definitions:**

#### 🔵 UGC Mode
```
Used when:   TikTok / Reels ads · trust-based conversion · testimonial / founder / review content
Signal:      platform=tiktok · hookAggressiveness=high · pacing=aggressive
Default:     Kling (primary) — motion control, authentic feel
```

#### 🟣 Cinematic Mode
```
Used when:   brand awareness · product aesthetics · luxury / SaaS visual storytelling · YouTube
Signal:      platform=youtube · hookAggressiveness=low · pacing=moderate
Default:     Veo (primary) — cinematic depth, lighting, camera language
Also valid:  Kling in cinematic configuration (not the same as UGC Kling)
```

#### 🟡 Hybrid Mode
```
Used when:   full-funnel campaigns · mixed intent · Meta Ads · Google UAC
Signal:      riskTolerance > 0.55 · platform=instagram/facebook · mixed audience signals
Renderer:    Kling + Veo combination (scenes split by narrative position)
```

**Routing signal priority (in order):**
```
1. Risk tolerance > 0.55 + non-exploit mode  →  force hybrid
2. Platform signal                           →  tiktok=ugc, youtube=cinematic, instagram=hybrid
3. Hook aggressiveness                       →  high=ugc, low=cinematic
4. Scene type + pacing                       →  hook/aggressive=ugc, solution/moderate=cinematic
```

**Hard rule:** Routing ALWAYS happens before rendering. No scene is generated without a mode decision.

---

### Layer 2.5 — Scene Optimization Layer

**Type:** Transform pipeline (pure functions, no I/O side effects on hot path)  
**Role:** Enrich scenes with optimised copy and DNA patterns before rendering.

**Steps per scene:**

| Step | System | Condition | Effect |
|---|---|---|---|
| 1 | HookBoosterService | Hook / problem scenes only | Replaces overlay_text with highest-scoring hook variant |
| 2 | SceneRewriterService | All scenes | Rewrites overlay_text for best improvement type (clarity / emotional / performance) |
| 3 | CreativeDNAService | When DNA exists | Appends proven pattern context to kling_prompt |

**Hard rule:** Scene optimization failures are non-blocking. Original scene is used on failure.

---

### Layer 3 — VideoRenderEngine (Unified Abstraction)

**Type:** Render backend pair  
**Abstraction name:** `VideoRenderEngine`  
**Backends:** Kling, Veo

**⚠️ Critical clarification — read once, enforce always:**

> Kling and Veo are **NOT** paradigm-specific engines.  
> Kling is **NOT** the UGC engine.  
> Veo is **NOT** the cinematic engine.  
> Both are **universal render engines** with different technical strengths.  
> Either can execute either mode. Routing decides. Engines execute.

| Engine | Technical strengths | NOT exclusively |
|---|---|---|
| Kling | Motion control, reliable execution, fast iteration, authentic energy | UGC content |
| Veo | Cinematic depth, advanced lighting, camera language, visual richness | Cinematic content |

**Responsibilities:**
- Execute scene-level generation from kling_prompt instructions
- Respect mode configuration from routing layer
- Return raw video assets to execution engine

**Hard rule:** No engine has a monopoly on a content style. Routing decides assignment per campaign.

---

### Layer 4 — Execution Engine

**Type:** Centralised orchestrator  
**Entry point:** `POST /product/execution/start`

**Responsibilities:**
- Queue management (no direct bypass)
- Parallel scene execution
- Asset generation coordination
- Render pipeline orchestration
- Returns `executionId` for downstream status polling

**Generation endpoints (called by execution engine internally):**

| Endpoint | Format |
|---|---|
| `POST /api/video/generate` | Video |
| `POST /api/video/{id}/images` | Video scene images |
| `POST /api/carousel/generate` | Carousel |
| `POST /api/banner/generate` | Banner |

**Hard rule:** No layer bypasses `POST /product/execution/start`. Direct calls to generation endpoints from outside the pipeline are not permitted.

---

### Layer 5 — Scoring + Winner Selection

**Type:** Evaluation system  
**Role:** Score creative output. Rank variants. Identify winner.

**Endpoints:**
```
POST /api/scoring/evaluate      → score batch of creatives
POST /api/auto-winner/evaluate  → select highest-performing variant
```

**Scoring dimensions:**

| Dimension | Proxy for | Weight (base) |
|---|---|---|
| CTR proxy | Hook strength + visual hierarchy | 0.30 |
| Engagement proxy | Emotional intensity + retention | 0.30 |
| Conversion proxy | CTA clarity + objection handling | 0.25 |
| Clarity | Message density + readability | 0.15 |

> Weights are dynamic — adjusted per angle + format via historical performance data.

**Hard rule:** Scores are always persisted. Learning always fires after scoring. Neither blocks the API response.

---

### Layer 6 — Learning Loop *(Fire-and-Forget)*

**Type:** Continuous feedback system  
**Execution:** Always async, always non-blocking

**Responsibilities:**

| System | Mechanism | Trigger |
|---|---|---|
| Angle weight optimisation | EWMA smoothing on performance signals | After every outcome report |
| Creative DNA | Extract top-20% patterns, persist with Jaccard merge | After scoring |
| Format weight calibration | Per-format conversion rate weighting | After scoring |
| Evolution cycle | Mutate underperformers, promote champions | When batch ≥ 3 creatives scored |
| MIROFISH calibration | Compare predicted vs actual scores, adjust simulation | After scoring batch |
| Learning cycle | Update contextual angle weights per campaign | After scoring |

**Endpoints:**
```
POST /api/outcomes/report                  → ingest performance data
POST /api/angles/learning/cycle/{id}       → trigger angle weight update
```

**Hard rule:** Learning never blocks generation. All triggers are fire-and-forget.

---

## Execution Flow

```
 INPUT
   │
   │  POST /api/govolo/generate
   │  { campaignId, preferredFormat?, preferredAngleSlug? }
   │
   ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  GATE: ownership check → fetch campaign → fetch concept                     │
 └────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 1: CREATIVE BRAIN                                                    │
 │  Sonnet → MasterBlueprint → validate + auto-fix                             │
 └────────────────────────────────────┬────────────────────────────────────────┘
                                      │  validated blueprint
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 2: MODE ROUTING                                                      │
 │  SmartRoutingService.decide() → execution mode per scene                   │
 │  [ ugc | cinematic | hybrid ]  ×  [ kling | veo | mixed ]                  │
 └────────────────────────────────────┬────────────────────────────────────────┘
                                      │  routing decision
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 2.5: SCENE OPTIMIZATION                                              │
 │  blueprintToVirtualScenes() → hook-boost → scene rewrite → DNA inject      │
 └────────────────────────────────────┬────────────────────────────────────────┘
                                      │  optimised scenes + enriched styleContext
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 3 + 4: RENDER + EXECUTION                                            │
 │  VideoService / CarouselService / BannerService                             │
 │  → POST /product/execution/start                                            │
 └────────────────────────────────────┬────────────────────────────────────────┘
                                      │  creativeId
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 5: SCORING + WINNER SELECTION                                        │
 │  ScoringService.evaluate() → AutoWinnerService.evaluate()                  │
 └────────────────────────────────────┬────────────────────────────────────────┘
                                      │  score + winner
                  ┌───────────────────┤
                  │  fire-and-forget  │
                  ▼                   ▼
 ┌────────────────────────┐  ┌──────────────────────────────────────────────────┐
 │  LAYER 6: LEARNING     │  │  RESPONSE                                         │
 │  outcomes.report()     │  │  {                                                 │
 │  learning.runCycle()   │  │    executionId,  creativeId,  format,             │
 └────────────────────────┘  │    bestCreative, score,       modeUsage,          │
                             │    pipelineTrace, blueprintMeta                   │
                             │  }                                                 │
                             └──────────────────────────────────────────────────┘
```

---

## Architectural Rules

These rules are non-negotiable. Any implementation that violates them is wrong.

| # | Rule |
|---|---|
| R1 | Kling is NOT a UGC-only engine. Veo is NOT a cinematic-only engine. Both are universal. |
| R2 | UGC is a content **style**, not an engine. It is expressed through routing signals, not backend systems. |
| R3 | The UGC Creator Module is frontend-only. It affects script input, never render logic. |
| R4 | Mode routing ALWAYS happens before rendering. No scene is generated without a mode decision. |
| R5 | All generation MUST route through `POST /product/execution/start`. No bypass permitted. |
| R6 | Scoring MUST persist results. Learning MUST fire after scoring. Both are non-blocking. |
| R7 | Learning NEVER blocks a generation response. All learning is fire-and-forget. |
| R8 | No duplicate render pipelines. No format-specific engines. One `VideoRenderEngine` abstraction. |
| R9 | Kling and Veo assignments are made by the routing layer per campaign signals, not hardcoded by format. |
| R10 | Creative OS is one system. Not a collection of tools. Not a product suite. One system. |

---

## What Was Clarified or Normalized in This Version

| Area | Previous (incorrect / informal) | Canonical (this document) |
|---|---|---|
| Kling role | "UGC engine" | Universal render engine — strong in motion control |
| Veo role | "Cinematic engine" | Universal render engine — strong in depth/lighting |
| UGC status | "Backend system / separate engine" | Content style. Frontend UI module affects script only. |
| Mode routing output | `{ model: 'kling'\|'veo' }` | `{ mode: 'ugc'\|'cinematic'\|'hybrid', model: 'kling'\|'veo'\|'mixed' }` |
| Response field | `modelUsage: { kling, veo }` | `modeUsage: { ugc, cinematic, hybrid }` |
| Engine assignment | Hardcoded: exploit→kling, explore→veo | Signal-driven: platform → aggressiveness → pacing |
| Render abstraction | Two separate systems | One `VideoRenderEngine` abstraction with two backends |
| UGC Creator Module | Undefined / conflated with rendering | Formal layer 0 — frontend only, script input boundary |
| Architecture format | Informal markdown notes | Production-grade specification with enforcement rules |

---

## Endpoint Reference

| Endpoint | Layer | Role |
|---|---|---|
| `POST /api/govolo/generate` | Entry point | Full pipeline trigger |
| `POST /api/creative-director/generate` | Layer 1 | Multi-format creative plan — no execution |
| `POST /api/routing/decide` | Layer 2 | Mode routing decision |
| `POST /api/hook-booster/boost` | Layer 2.5 | Hook variant generation |
| `POST /api/scene-rewriter/rewrite` | Layer 2.5 | Scene copy optimisation |
| `GET /api/creative-dna/prompt-context` | Layer 2.5 | Creative DNA injection context |
| `POST /product/execution/start` | Layer 4 | **Sole execution entry point** |
| `POST /api/video/generate` | Layer 3+4 | Video asset generation |
| `POST /api/video/{id}/images` | Layer 3+4 | Scene image extraction |
| `POST /api/carousel/generate` | Layer 3+4 | Carousel asset generation |
| `POST /api/banner/generate` | Layer 3+4 | Banner asset generation |
| `POST /api/scoring/evaluate` | Layer 5 | Creative scoring |
| `POST /api/auto-winner/evaluate` | Layer 5 | Winner selection |
| `POST /api/outcomes/report` | Layer 6 | Outcome data ingestion |
| `POST /api/angles/learning/cycle/{id}` | Layer 6 | Angle learning cycle trigger |
