/**
 * kling-compiler.service.ts
 *
 * Kling UGC Compiler — third stage of the UGC Engine.
 *
 * Converts a UGCVariant into a KlingCompilerOutput:
 *   - Splits the script into timed scenes
 *   - Assigns camera, emotion, transition, and pacing per scene
 *   - Writes a production-ready kling_prompt per scene
 *   - Calculates total duration from durationSeconds budget
 *
 * Scene structure (5-scene template by default):
 *   1. Hook      (first 20% of duration)
 *   2. Problem   (20–40%)
 *   3. Agitation (40–55%)   ← intensifies the problem
 *   4. Solution  (55–80%)
 *   5. CTA       (80–100%)
 */

import { Injectable, Logger } from '@nestjs/common';

import type {
  UGCVariant,
  KlingScene,
  KlingCompilerOutput,
  KlingCamera,
  KlingTransition,
  KlingPacing,
} from './types/ugc.types';

// ─── Scene templates ──────────────────────────────────────────────────────────

interface SceneTemplate {
  role:       'hook' | 'problem' | 'agitation' | 'solution' | 'cta';
  /** Fraction of total duration for this scene */
  durationFraction: number;
  camera:     KlingCamera;
  transition: KlingTransition;
  emotion:    string;
}

const SCENE_TEMPLATES: SceneTemplate[] = [
  { role: 'hook',       durationFraction: 0.20, camera: 'close_up', transition: 'glitch', emotion: 'surprise'    },
  { role: 'problem',    durationFraction: 0.20, camera: 'front',    transition: 'cut',    emotion: 'frustration' },
  { role: 'agitation',  durationFraction: 0.15, camera: 'wide',     transition: 'zoom',   emotion: 'tension'     },
  { role: 'solution',   durationFraction: 0.25, camera: 'back',     transition: 'burst',  emotion: 'relief'      },
  { role: 'cta',        durationFraction: 0.20, camera: 'front',    transition: 'fade',   emotion: 'excitement'  },
];

// ─── Pacing override ──────────────────────────────────────────────────────────

function resolveKlingPacing(variantPacing: string, role: string): KlingPacing {
  if (variantPacing === 'fast')   return 'aggressive';
  if (variantPacing === 'slow')   return 'moderate';
  // medium: hook and cta are aggressive, body is moderate
  return (role === 'hook' || role === 'cta') ? 'aggressive' : 'moderate';
}

// ─── Script splitter ──────────────────────────────────────────────────────────

/**
 * Extract speech lines from the structured script format produced by VariantService.
 * Returns one speech string per scene role.
 */
function extractSceneSpeech(
  script: string,
  role:   SceneTemplate['role'],
  hook:   string,
): string {
  const ROLE_SECTION: Record<SceneTemplate['role'], string[]> = {
    hook:       ['[HOOK]'],
    problem:    ['[PROBLEM]'],
    agitation:  ['[ANGLE:'],
    solution:   ['[SOLUTION]', '[BENEFIT]'],
    cta:        ['[CTA]'],
  };

  const tags   = ROLE_SECTION[role];
  const lines  = script.split('\n');
  const found: string[] = [];

  for (const tag of tags) {
    const line = lines.find(l => l.startsWith(tag));
    if (line) {
      found.push(
        line.replace(/^\[[^\]]+\]\s*/u, '').trim(),
      );
    }
  }

  if (found.length === 0) return role === 'hook' ? hook : '';
  return found.join(' ');
}

// ─── Kling prompt builder ─────────────────────────────────────────────────────

function buildKlingPrompt(opts: {
  role:     SceneTemplate['role'];
  speech:   string;
  emotion:  string;
  camera:   KlingCamera;
  pacing:   KlingPacing;
  variant:  UGCVariant;
}): string {
  const { role, speech, emotion, camera, pacing, variant } = opts;

  const roleDescriptions: Record<SceneTemplate['role'], string> = {
    hook:       'Attention-grabbing opener. First 3 seconds must hook the viewer.',
    problem:    'Relatable struggle. Viewer feels understood.',
    agitation:  'Tension builds. The cost of NOT solving this becomes clear.',
    solution:   'Product enters. Transformation is visible. Relief is tangible.',
    cta:        'Clear call to action. Urgency. Brand presence. White space.',
  };

  const cameraLabels: Record<KlingCamera, string> = {
    front:    'direct front-facing camera, eye contact',
    back:     'product hero angle, close product shot',
    wide:     'environmental wide shot, context-building',
    close_up: 'extreme close-up, personal and intimate',
    overhead: 'overhead flat-lay, product detail focus',
  };

  return [
    `UGC video scene — ${roleDescriptions[role]}`,
    `Persona: ${variant.persona} | Tone: ${variant.tone}`,
    `Camera: ${cameraLabels[camera]}`,
    `Emotion: ${emotion}`,
    `Pacing: ${pacing}`,
    `Hook strategy: ${variant.hookStrategy}`,
    speech ? `On-screen speech: "${speech.slice(0, 150)}"` : '',
    'Style: authentic UGC, natural lighting, handheld feel, no heavy production.',
  ].filter(Boolean).join('\n');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class KlingCompilerService {
  private readonly logger = new Logger(KlingCompilerService.name);

  /**
   * Compile a UGCVariant into a Kling render plan.
   *
   * @param variant         — The UGC variant to compile
   * @param durationSeconds — Target total duration (15 | 60 | 90)
   */
  compile(variant: UGCVariant, durationSeconds: number = 15): KlingCompilerOutput {
    const scenes: KlingScene[] = SCENE_TEMPLATES.map((tmpl, idx) => {
      const duration = Math.round(tmpl.durationFraction * durationSeconds);
      const pacing   = resolveKlingPacing(variant.pacing, tmpl.role);
      const speech   = extractSceneSpeech(variant.script, tmpl.role, variant.hook);

      const klingPrompt = buildKlingPrompt({
        role:    tmpl.role,
        speech,
        emotion: tmpl.emotion,
        camera:  tmpl.camera,
        pacing,
        variant,
      });

      return {
        scene_id:    idx + 1,
        visual:      `UGC scene ${idx + 1}: ${tmpl.role} moment`,
        camera:      tmpl.camera,
        speech:      speech.slice(0, 300),
        emotion:     tmpl.emotion,
        transition:  tmpl.transition,
        pacing,
        duration,
        kling_prompt: klingPrompt,
      };
    });

    const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

    this.logger.debug(
      `[KlingCompiler] variant=${variant.id} scenes=${scenes.length} ` +
      `totalDuration=${totalDuration}s persona=${variant.persona}`,
    );

    return {
      model:         'kling',
      mode:          'ugc',
      totalDuration,
      scenes,
    };
  }
}
