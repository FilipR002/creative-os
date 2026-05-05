'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getGeneratedTools, type GeneratedToolConfig } from '@/lib/api/creator-client';

const METHOD_HEX: Record<string, string> = {
  GET: '#10b981', POST: '#6366f1', PATCH: '#f59e0b', PUT: '#f59e0b', DELETE: '#ef4444',
};

export default function SystemGeneratedIndexPage() {
  const [tools,   setTools]   = useState<GeneratedToolConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGeneratedTools()
      .then(({ tools }) => { setTools(tools); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px 0' }}>✦ Auto-Generated Tools</h1>
            <p style={{ fontSize: 13, color: 'var(--sub)' }}>
              UI components auto-created by the{' '}
              <Link href="/system-audit" style={{ color: 'var(--indigo-l)', textDecoration: 'none' }}>System Audit</Link>{' '}
              self-healing engine.
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : tools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--sub)' }}>No tools generated yet</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 20px' }}>
                Go to System Audit → Orphans tab and click <strong style={{ color: 'var(--indigo-l)' }}>✦ Generate UI</strong> on any endpoint.
              </div>
              <Link href="/system-audit" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--indigo-l)', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                Open System Audit →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {tools.map(tool => (
                <Link key={tool.name} href={`/system-generated/${tool.name}`}
                  style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✦</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tool.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{tool.module}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ color: METHOD_HEX[tool.method] ?? '#888', background: `${METHOD_HEX[tool.method] ?? '#888'}14` }}>{tool.method}</span>
                    <code style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--purple)' }}>{tool.endpointPath.slice(0, 32)}{tool.endpointPath.length > 32 ? '…' : ''}</code>
                    <span className="badge tag-indigo">{tool.uiType}</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)' }}>
                    Generated {new Date(tool.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>
  );
}
