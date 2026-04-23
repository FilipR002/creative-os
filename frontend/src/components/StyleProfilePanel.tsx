'use client';

import { useEffect, useState } from 'react';
import {
  loadProfile, resetProfile, dominantTone,
  type StyleProfile,
} from '@/lib/style-profile';
import { fetchStyleProfile, type BackendStyleProfile } from '@/lib/api/creator-client';

const THRESHOLD = 0.63;

function ScoreBar({ score, label }: { score: number; label: string }) {
  const filled = Math.round(score * 5);
  const trend  = score > THRESHOLD ? '↑' : score < 0.38 ? '↓' : '→';
  const color  = score > THRESHOLD ? '#22c55e' : score < 0.38 ? '#555' : '#f59e0b';
  return (
    <div className="spp-row">
      <span className="spp-dim-label">{label}</span>
      <div className="spp-dots">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`spp-dot${i < filled ? ' filled' : ''}`} />
        ))}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 6, width: 10 }}>{trend}</span>
    </div>
  );
}

const BEHAVIOR_MAP: { dim: keyof StyleProfile; label: string }[] = [
  { dim: 'hookShort',      label: 'Shortens hooks'          },
  { dim: 'toneEmotional',  label: 'Prefers emotional tone'  },
  { dim: 'tonePremium',    label: 'Favors premium voice'    },
  { dim: 'toneAggressive', label: 'Likes bold, direct copy' },
  { dim: 'toneCasual',     label: 'Prefers conversational'  },
  { dim: 'ctaUrgency',     label: 'Uses urgent CTAs'        },
  { dim: 'ctaDirect',      label: 'Prefers direct CTAs'     },
  { dim: 'copyShort',      label: 'Keeps copy concise'      },
];

interface StyleProfilePanelProps {
  onClose?: () => void;
}

export function StyleProfilePanel({ onClose }: StyleProfilePanelProps) {
  const [profile,     setProfile]     = useState<StyleProfile | null>(null);
  const [backendExt,  setBackendExt]  = useState<Pick<BackendStyleProfile, 'dominantTone' | 'adaptations'> | null>(null);

  useEffect(() => {
    fetchStyleProfile()
      .then(bp => {
        setProfile({ ...loadProfile(), ...bp, lastUpdated: Date.now() });
        setBackendExt({ dominantTone: bp.dominantTone, adaptations: bp.adaptations ?? [] });
      })
      .catch(() => setProfile(loadProfile()));
  }, []);

  function handleReset() {
    setProfile(resetProfile());
    setBackendExt(null);
  }

  if (!profile) return null;

  const tone      = backendExt?.dominantTone || dominantTone(profile);
  const behaviors = BEHAVIOR_MAP.filter(b => (profile[b.dim] as number) > THRESHOLD);

  return (
    <div className="spp-panel">
      <div className="spp-header">
        <div>
          <div className="spp-title">Your Style Profile</div>
          <div className="spp-subtitle">
            {profile.totalSignals < 3
              ? 'Keep editing — the system is learning your style'
              : `Based on ${profile.totalSignals} interactions · adapting in real-time`}
          </div>
        </div>
        {onClose && (
          <button className="spp-close" onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>

      {profile.totalSignals < 3 ? (
        <div className="spp-empty">
          <div className="spp-empty-icon">◎</div>
          <p>Refine a few outputs to build your profile. The AI will adapt to your style automatically.</p>
        </div>
      ) : (
        <>
          <div className="spp-section-label">Dominant Tone</div>
          <div className="spp-dominant-tone">{tone}</div>

          <div className="spp-section-label" style={{ marginTop: 14 }}>Dimensions</div>
          <ScoreBar score={profile.hookShort}      label="Short hooks"     />
          <ScoreBar score={profile.toneEmotional}  label="Emotional"       />
          <ScoreBar score={profile.tonePremium}     label="Premium"         />
          <ScoreBar score={profile.toneAggressive}  label="Bold & Direct"   />
          <ScoreBar score={profile.toneCasual}      label="Conversational"  />
          <ScoreBar score={profile.ctaUrgency}      label="Urgent CTA"      />
          <ScoreBar score={profile.copyShort}       label="Concise copy"    />

          {behaviors.length > 0 && (
            <>
              <div className="spp-section-label" style={{ marginTop: 14 }}>Your patterns</div>
              {behaviors.map(b => (
                <div key={b.dim as string} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#22c55e' }}>✓</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{b.label}</span>
                </div>
              ))}
            </>
          )}

          {(backendExt?.adaptations ?? []).length > 0 && (
            <>
              <div className="spp-section-label" style={{ marginTop: 14 }}>Active adaptations</div>
              {(backendExt?.adaptations ?? []).slice(0, 3).map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#6366f1', marginTop: 1 }}>◎</span>
                  <span style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}

      <div className="spp-footer">
        <button className="spp-reset-btn" onClick={handleReset}>Reset profile</button>
      </div>
    </div>
  );
}
