'use client';

import { useCallback, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const accept = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.type.includes('spreadsheet')) {
        // Still allow — sometimes CSV MIME varies; just warn
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File is too large (max 10 MB)');
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) accept(file);
    },
    [accept],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) accept(file);
      e.target.value = '';   // reset so same file can be re-selected
    },
    [accept],
  );

  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : onDrop}
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            12,
          padding:        '48px 32px',
          border:         `2px dashed ${dragging ? '#6366f1' : error ? '#ef4444' : '#1e2330'}`,
          borderRadius:   16,
          background:     dragging ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.015)',
          cursor:         disabled ? 'not-allowed' : 'pointer',
          transition:     'all 0.2s',
          opacity:        disabled ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.5 }}>⬆</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>
            Drag &amp; drop your CSV file here
          </div>
          <div style={{ fontSize: 13, color: '#555' }}>
            or{' '}
            <span style={{ color: '#6366f1', fontWeight: 600 }}>browse file</span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#333', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e2330', borderRadius: 8, padding: '6px 14px' }}>
          Supports exports from Meta Ads, Google Ads, TikTok
        </div>

        <input
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          disabled={disabled}
          onChange={onInputChange}
        />
      </label>

      {error && (
        <div style={{ marginTop: 10, fontSize: 13, color: '#ef4444', padding: '8px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
