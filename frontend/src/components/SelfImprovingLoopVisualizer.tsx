'use client';
// ─── Self-Improving Loop Visualizer ──────────────────────────────────────────
// Animated circular graph showing the 6-stage autonomous improvement loop.
// Accepts live AIBrainEvents to highlight the active stage.

import { useEffect, useRef, useState } from 'react';
import type { AIBrainEvent, AIBrainEventType } from '@/lib/api/creator-client';

// ── Stage definitions ─────────────────────────────────────────────────────────

interface LoopStage {
  key:       AIBrainEventType | 'IDLE';
  label:     string;
  icon:      string;
  color:     string;
  desc:      string;
  angle:     number; // degrees — 0 = top, clockwise
}

const STAGES: LoopStage[] = [
  { key: 'CREATIVE_EVAL',       label: 'Evaluate',   icon: '📊', color: '#10b981', desc: 'Scores creatives via ML model',     angle: 0   },
  { key: 'ANGLE_SELECT',        label: 'Select',     icon: '🎯', color: '#6366f1', desc: 'Memory-weighted angle selection',   angle: 60  },
  { key: 'MUTATION',            label: 'Mutate',     icon: '🧬', color: '#f59e0b', desc: 'Generates variant creatives',       angle: 120 },
  { key: 'LEARNING',            label: 'Learn',      icon: '📚', color: '#ec4899', desc: 'Ingests signals, updates weights',  angle: 180 },
  { key: 'IMPROVEMENT',         label: 'Improve',    icon: '⬆️', color: '#3b82f6', desc: 'Applies best mutations to winners', angle: 240 },
  { key: 'FATIGUE_DETECT',      label: 'Fatigue',    icon: '⚠️', color: '#ef4444', desc: 'Detects overused angles',           angle: 300 },
];

// Map event types → stage
const EVENT_TO_STAGE: Partial<Record<AIBrainEventType, string>> = {
  CREATIVE_EVAL:       'CREATIVE_EVAL',
  ANGLE_SELECT:        'ANGLE_SELECT',
  MUTATION:            'MUTATION',
  LEARNING:            'LEARNING',
  IMPROVEMENT:         'IMPROVEMENT',
  FATIGUE_DETECT:      'FATIGUE_DETECT',
  EXPLORATION_TRIGGER: 'ANGLE_SELECT',
  DECISION:            'ANGLE_SELECT',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SelfImprovingLoopVisualizerProps {
  /** Latest AI brain events to drive stage highlighting */
  events?:    AIBrainEvent[];
  /** Size of the circular diagram in px */
  size?:      number;
  /** Whether the loop is currently running */
  running?:   boolean;
  /** Show the side legend */
  showLegend?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SelfImprovingLoopVisualizer({
  events    = [],
  size      = 320,
  running   = true,
  showLegend = true,
}: SelfImprovingLoopVisualizerProps) {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [pulsing,     setPulsing]     = useState<string | null>(null);
  const rotRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);

  // Drive active stage from incoming events
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[0];
    const stage  = EVENT_TO_STAGE[latest.type];
    if (stage) {
      setActiveStage(stage);
      setPulsing(stage);
      const t = setTimeout(() => setPulsing(null), 900);
      return () => clearTimeout(t);
    }
  }, [events]);

  // Slow rotation animation when running
  useEffect(() => {
    if (!running) return;
    let prev = performance.now();
    function frame(now: number) {
      const dt = now - prev;
      prev = now;
      rotRef.current = (rotRef.current + dt * 0.008) % 360; // ~8°/s
      setRotation(rotRef.current);
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [running]);

  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.34; // orbit radius
  const nodeR = size * 0.09;

  function stagePos(stage: LoopStage) {
    const deg = stage.angle - 90; // offset so 0° = top
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + R * Math.cos(rad),
      y: cy + R * Math.sin(rad),
    };
  }

  // Build arc segments between stages
  const arcSegments = STAGES.map((s, i) => {
    const next = STAGES[(i + 1) % STAGES.length];
    const startDeg = s.angle - 90;
    const endDeg   = next.angle - 90;
    const startRad = (startDeg * Math.PI) / 180;
    const endRad   = (endDeg   * Math.PI) / 180;
    const x1 = cx + R * Math.cos(startRad);
    const y1 = cy + R * Math.sin(startRad);
    const x2 = cx + R * Math.cos(endRad);
    const y2 = cy + R * Math.sin(endRad);
    const active = activeStage === s.key;
    return { x1, y1, x2, y2, color: s.color, active };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            {/* Glow filters */}
            {STAGES.map(s => (
              <filter key={s.key} id={`glow-${s.key}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
            {/* Rotating gradient ring */}
            <linearGradient id="ring-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size} y2={size}>
              <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.15" />
              <stop offset="50%"  stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Outer ring */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e2330" strokeWidth={1.5} />

          {/* Animated progress ring */}
          {running && (
            <circle
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke="url(#ring-gradient)"
              strokeWidth={3}
              strokeDasharray={`${R * 2 * Math.PI * 0.6} ${R * 2 * Math.PI * 0.4}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'transform 0.05s linear' }}
            />
          )}

          {/* Arc segments */}
          {arcSegments.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke={seg.color}
              strokeWidth={seg.active ? 2 : 1}
              strokeOpacity={seg.active ? 0.8 : 0.2}
            />
          ))}

          {/* Stage nodes */}
          {STAGES.map(stage => {
            const { x, y } = stagePos(stage);
            const isActive  = activeStage === stage.key;
            const isPulsing = pulsing === stage.key;
            return (
              <g key={stage.key} transform={`translate(${x},${y})`}>
                {/* Pulse ring */}
                {isPulsing && (
                  <circle r={nodeR * 1.6} fill="none" stroke={stage.color} strokeWidth={2} opacity={0.4}>
                    <animate attributeName="r" from={nodeR} to={nodeR * 2.2} dur="0.8s" fill="freeze" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="0.8s" fill="freeze" />
                  </circle>
                )}
                {/* Active glow */}
                {isActive && (
                  <circle r={nodeR * 1.2} fill={stage.color} opacity={0.12} />
                )}
                {/* Node circle */}
                <circle
                  r={nodeR}
                  fill={isActive ? `${stage.color}22` : '#080910'}
                  stroke={stage.color}
                  strokeWidth={isActive ? 2 : 1}
                  strokeOpacity={isActive ? 1 : 0.4}
                  filter={isActive ? `url(#glow-${stage.key})` : undefined}
                />
                {/* Icon */}
                <text
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={nodeR * 0.9}
                  opacity={isActive ? 1 : 0.6}
                >
                  {stage.icon}
                </text>
                {/* Label below/above */}
                <text
                  y={nodeR + 12}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={isActive ? 700 : 500}
                  fill={isActive ? stage.color : '#555'}
                  fontFamily="system-ui, sans-serif"
                >
                  {stage.label}
                </text>
              </g>
            );
          })}

          {/* Center hub */}
          <circle cx={cx} cy={cy} r={size * 0.1} fill="#0d0e14" stroke="#1e2330" strokeWidth={1.5} />
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={16} dominantBaseline="central">🤖</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={8} fill={running ? '#10b981' : '#555'} fontFamily="system-ui, sans-serif" fontWeight={700}>
            {running ? 'RUNNING' : 'PAUSED'}
          </text>
        </svg>
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Loop Stages</div>
          {STAGES.map(stage => {
            const isActive = activeStage === stage.key;
            const lastEvent = events.find(e => EVENT_TO_STAGE[e.type] === stage.key);
            return (
              <div
                key={stage.key}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', marginBottom: 4,
                  borderRadius: 8, transition: 'all 0.2s',
                  background: isActive ? `${stage.color}10` : 'transparent',
                  border: `1px solid ${isActive ? stage.color + '33' : 'transparent'}`,
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${stage.color}18`, border: `1.5px solid ${stage.color}${isActive ? 'bb' : '33'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {stage.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? stage.color : '#888' }}>{stage.label}</span>
                    {isActive && <span style={{ fontSize: 9, color: stage.color, fontWeight: 800, letterSpacing: '0.06em' }}>● ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#444', marginTop: 1 }}>{stage.desc}</div>
                  {lastEvent && (
                    <div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>
                      Last: {lastEvent.title} · {(lastEvent.confidence * 100).toFixed(0)}% conf
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SelfImprovingLoopVisualizer;
