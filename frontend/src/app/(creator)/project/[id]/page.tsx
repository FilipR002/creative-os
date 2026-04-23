'use client';

// ─── /project/:id — Generate + Results ───────────────────────────────────────
// The main creator experience. User hits Generate, watches results appear.
// No AI signals, no engine details — only human-readable outputs.

import { useState, useEffect, useCallback } from 'react';
import { useParams }                          from 'next/navigation';
import { getProject, generateForProject }     from '@/lib/api/product-client';
import type { ProductProject, ProductOutput } from '@/lib/types/product';
import { ProductOutputCard }                  from '@/components/product/ProductOutputCard';

function GeneratingState() {
  const steps = ['Analysing your goal…', 'Finding the best angle…', 'Building your strategy…'];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 56, height: 56 }}>
          <svg width={56} height={56} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
            <circle cx={28} cy={28} r={22} fill="none" stroke="var(--creator-border)" strokeWidth={4} />
            <circle
              cx={28} cy={28} r={22}
              fill="none" stroke="var(--accent)" strokeWidth={4}
              strokeDasharray="138"
              strokeLinecap="round"
              style={{ animation: 'spin 1.4s linear infinite' }}
            />
          </svg>
        </div>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {steps[step]}
      </p>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        AI is working — this takes a few seconds
      </p>
    </div>
  );
}

export default function ProjectPage() {
  const { id }  = useParams<{ id: string }>();

  const [project,   setProject]   = useState<ProductProject | null>(null);
  const [output,    setOutput]    = useState<ProductOutput | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [emotion,   setEmotion]   = useState('');
  const [format,    setFormat]    = useState('');

  useEffect(() => {
    getProject(id)
      .then(p => {
        setProject(p);
        if (p.lastResult) setOutput(p.lastResult.output);
      })
      .catch(() => setError('Project not found'))
      .finally(() => setFetching(false));
  }, [id]);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateForProject(id, {
        emotion: emotion || undefined,
        format:  format  || undefined,
      });
      setOutput(result.output);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, project, emotion, format]);

  if (fetching) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="shimmer" style={{ height: 32, width: 200, borderRadius: 8 }} />
        <div className="shimmer" style={{ height: 16, width: 300, borderRadius: 6 }} />
        <div className="shimmer" style={{ height: 220, borderRadius: 16, marginTop: 24 }} />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <p style={{ color: 'var(--danger)', fontSize: 15 }}>{error}</p>
        <a href="/app" style={{ color: 'var(--accent)', fontSize: 14, marginTop: 12, display: 'inline-block' }}>← Back to projects</a>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <a href="/app" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
        ← Projects
      </a>

      {/* Project header */}
      <div style={{ marginBottom: 36 }}>
        <h1 className="creator-title">{project?.name}</h1>
        {project?.goal && (
          <p className="creator-sub">Goal: {project.goal}</p>
        )}
      </div>

      {/* Generate panel */}
      <div style={{ background: 'var(--creator-surface)', border: '1px solid var(--creator-border)', borderRadius: 16, padding: 24, marginBottom: 36 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Generate recommendation</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label className="creator-label">Emotional angle <span style={{ fontWeight: 400, color: 'var(--creator-muted)' }}>(optional)</span></label>
            <input
              value={emotion}
              onChange={e => setEmotion(e.target.value)}
              placeholder="e.g. Urgency, Trust, Excitement"
              className="creator-input"
              style={{ resize: 'none' }}
            />
          </div>
          <div>
            <label className="creator-label">Format <span style={{ fontWeight: 400, color: 'var(--creator-muted)' }}>(optional)</span></label>
            <input
              value={format}
              onChange={e => setFormat(e.target.value)}
              placeholder="e.g. Video, Banner, Carousel"
              className="creator-input"
              style={{ resize: 'none' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? <><span className="spinner" />Generating…</> : output ? '↺ Regenerate' : '✦ Generate strategy'}
          </button>
          {output && !loading && (
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Last generated {project?.lastResult ? new Date(project.lastResult.generatedAt).toLocaleTimeString() : ''}
            </span>
          )}
        </div>
        {error && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--danger)' }}>{error}</p>}
      </div>

      {/* Results */}
      {loading && <GeneratingState />}

      {!loading && output && (
        <div className="anim-fade-in">
          <h2 style={{ fontSize: 11, fontWeight: 700, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AI Recommendation
          </h2>
          <ProductOutputCard
            output={output}
            isPrimary={true}
            onRegenerate={handleGenerate}
          />
        </div>
      )}

      {!loading && !output && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <p style={{ fontSize: 38, marginBottom: 16 }}>✦</p>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Ready to generate</p>
          <p style={{ fontSize: 14 }}>Hit "Generate strategy" to get your AI recommendation.</p>
        </div>
      )}
    </div>
  );
}
