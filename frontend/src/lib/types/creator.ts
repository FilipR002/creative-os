// ─── Phase 7.1 — Creator Types ───────────────────────────────────────────────

export interface Campaign {
  id:        string;
  userId:    string;
  mode:      'SINGLE' | 'PARTIAL' | 'FULL';
  status:    'DRAFT' | 'GENERATED' | 'SCORED' | 'DONE';
  formats:   string[];
  // Phase 4 strategy settings
  name?:     string;
  goal?:     string;
  angle?:    string;
  tone?:     string;
  persona?:  string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Concept {
  id:               string;
  campaignId:       string;
  goal:             string;
  audience:         string;
  emotion:          string;
  coreMessage:      string;
  offer?:           string;
  style?:           string;
  platform?:        string;
  durationTier?:    string;
  keyObjection?:    string;
  valueProposition?: string;
  rawJson: {
    hook_angle: string;
    why:        string;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface AngleData {
  id:          string;
  slug:        string;
  label:       string;
  description?: string;
}

export interface SelectedAngle {
  angle:                  string;   // slug
  tag:                    string;
  section:                string;
  type:                   'exploit' | 'secondary' | 'explore';
  goal:                   string;
  emotion:                string;
  confidence_score:       number;
  outcome_learning_boost: number;   // real-world performance multiplier [0.5–1.5], 1.0 = neutral
  reason:                 string;
  fatigue_level:          'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';
  angleData:              AngleData;
  is_blended:             boolean;
}

export interface AngleSelectResult {
  selected_angles: SelectedAngle[];
  exploration_mode: string;
}

// ── Video ─────────────────────────────────────────────────────────────────────

export interface VideoScene {
  scene_number:    number;
  type:            string;
  duration_seconds: number;
  voiceover:       string;
  on_screen_text:  string;
  visual_prompt:   string;
  emotion:         string;
}

export interface VideoCreative {
  creativeId:  string;
  format:      'video';
  durationTier: string;
  angle:       string;
  sceneCount:  number;
  hookScore:   number;
  hookBoosted: boolean;
  scenes:      VideoScene[];
}

// ── Carousel ──────────────────────────────────────────────────────────────────

export interface CarouselSlide {
  slide_number: number;
  type:         string;
  hook:         string;
  headline:     string;
  body:         string;
  cta:          string;
}

export interface CarouselCreative {
  creativeId: string;
  format:     'carousel';
  platform:   string;
  angle:      string;
  slideCount: number;
  slides:     CarouselSlide[];
}

// ── Banner ────────────────────────────────────────────────────────────────────

export interface BannerItem {
  size:             string;
  headline:         string;
  subtext:          string;
  cta:              string;
  layout:           string;
  visual_direction: string;
}

export interface BannerCreative {
  creativeId: string;
  format:     'banner';
  angle:      string;
  count:      number;
  banners:    BannerItem[];
}
