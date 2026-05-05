'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getResource,
  upsertResource,
  scanUrl,
  createPersona,
  updatePersona,
  deletePersona,
  type Resource,
  type Persona,
  type BrandScan,
  type CreatePersonaPayload,
} from '@/lib/api/resources-client';

// ─── Image References ─────────────────────────────────────────────────────────

function ImageReferences({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        onChange([...images, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function remove(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8 }}>
        Reference Images
        <span style={{ color: '#555', fontWeight: 400, marginLeft: 6 }}>
          — visual style, product shots, mood boards (optional)
        </span>
      </label>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: '1px dashed #2a2a3e',
          borderRadius: 10,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          background: '#0d0d0d',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#4f46e5')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a3e')}
      >
        <span style={{ fontSize: 22 }}>🖼</span>
        <span style={{ fontSize: 13, color: '#555' }}>
          Drop images here or <span style={{ color: '#a78bfa' }}>browse</span>
        </span>
        <span style={{ fontSize: 11, color: '#444' }}>PNG, JPG, WEBP — max 4 MB each</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 10,
          marginTop: 12,
        }}>
          {images.map((src, idx) => (
            <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #1e1e2e' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Reference ${idx + 1}`}
                style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
              />
              <button
                onClick={() => remove(idx)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                  width: 20, height: 20, color: '#fff', cursor: 'pointer',
                  fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tag helpers ──────────────────────────────────────────────────────────────

function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
  }

  function remove(item: string) {
    onChange(value.filter(v => v !== item));
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Add item, press Enter'}
          style={{
            flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
            padding: '8px 12px', color: '#fff', fontSize: 13,
          }}
        />
        <button
          onClick={add}
          style={{
            background: '#1a1a2e', border: '1px solid #2a2a2e', borderRadius: 8,
            padding: '8px 14px', color: '#a78bfa', cursor: 'pointer', fontSize: 13,
          }}
        >
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {value.map(item => (
          <span
            key={item}
            style={{
              background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 20,
              padding: '3px 10px', fontSize: 12, color: '#c4b5fd',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {item}
            <button
              onClick={() => remove(item)}
              style={{ background: 'none', border: 'none', color: '#6b6b8a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const sharedStyle = {
    width: '100%', background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
    padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none',
    resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={sharedStyle} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={sharedStyle} />
      }
    </div>
  );
}

// ─── Persona card ─────────────────────────────────────────────────────────────

function PersonaCard({
  persona,
  onDelete,
  onUpdate,
}: {
  persona: Persona;
  onDelete: (id: string) => void;
  onUpdate: (id: string, p: Persona) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    name:         persona.name,
    description:  persona.description,
    painPoints:   persona.painPoints,
    desires:      persona.desires,
    demographics: persona.demographics ?? '',
  });

  async function save() {
    setSaving(true);
    try {
      const updated = await updatePersona(persona.id, {
        name:         form.name,
        description:  form.description,
        painPoints:   form.painPoints,
        desires:      form.desires,
        demographics: form.demographics || undefined,
      });
      onUpdate(persona.id, updated);
      setEditing(false);
    } catch {
      alert('Failed to save persona');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete persona "${persona.name}"?`)) return;
    await deletePersona(persona.id);
    onDelete(persona.id);
  }

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #1e1e2e', borderRadius: 12,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {!editing ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{persona.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{persona.description}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(true)} style={btnStyle('ghost')}>Edit</button>
              <button onClick={handleDelete} style={btnStyle('danger')}>Delete</button>
            </div>
          </div>
          {persona.demographics && (
            <div style={{ fontSize: 12, color: '#a78bfa' }}>📍 {persona.demographics}</div>
          )}
          {persona.painPoints.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>PAIN POINTS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {persona.painPoints.map(p => (
                  <span key={p} style={tagStyle('red')}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {persona.desires.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>DESIRES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {persona.desires.map(d => (
                  <span key={d} style={tagStyle('green')}>{d}</span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Who they are" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline />
          <Field label="Demographics" value={form.demographics} onChange={v => setForm(f => ({ ...f, demographics: v }))} placeholder="e.g. Age 25-35, urban, tech-savvy" />
          <TagInput label="Pain Points" value={form.painPoints} onChange={v => setForm(f => ({ ...f, painPoints: v }))} placeholder="e.g. Not enough time" />
          <TagInput label="Desires" value={form.desires} onChange={v => setForm(f => ({ ...f, desires: v }))} placeholder="e.g. Grow revenue faster" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={btnStyle('ghost')}>Cancel</button>
            <button onClick={save} disabled={saving} style={btnStyle('primary')}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function btnStyle(variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
    border: '1px solid transparent',
  };
  if (variant === 'primary')  return { ...base, background: '#4f46e5', color: '#fff', border: '1px solid #4f46e5' };
  if (variant === 'ghost')    return { ...base, background: 'transparent', color: '#888', border: '1px solid #2a2a2a' };
  if (variant === 'danger')   return { ...base, background: 'transparent', color: '#ef4444', border: '1px solid #3a1a1a' };
  return base;
}

function tagStyle(color: 'red' | 'green'): React.CSSProperties {
  if (color === 'red')   return { background: '#1e0a0a', border: '1px solid #3a1010', borderRadius: 20, padding: '2px 10px', fontSize: 12, color: '#f87171' };
  if (color === 'green') return { background: '#0a1e0a', border: '1px solid #103a10', borderRadius: 20, padding: '2px 10px', fontSize: 12, color: '#4ade80' };
  return {};
}

// ─── New persona form ─────────────────────────────────────────────────────────

function NewPersonaForm({ onCreated }: { onCreated: (p: Persona) => void }) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState<CreatePersonaPayload & { demographics: string }>({
    name: '', description: '', painPoints: [], desires: [], demographics: '',
  });

  async function submit() {
    if (!form.name.trim() || !form.description.trim()) {
      alert('Name and description are required');
      return;
    }
    setSaving(true);
    try {
      const created = await createPersona({
        name:         form.name,
        description:  form.description,
        painPoints:   form.painPoints,
        desires:      form.desires,
        demographics: form.demographics || undefined,
      });
      onCreated(created);
      setForm({ name: '', description: '', painPoints: [], desires: [], demographics: '' });
      setOpen(false);
    } catch {
      alert('Failed to create persona');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', background: '#0d0d0d', border: '1px dashed #2a2a3e',
          borderRadius: 12, padding: 16, color: '#a78bfa', cursor: 'pointer',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>+</span> Add Persona
      </button>
    );
  }

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #2a2a3e', borderRadius: 12, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>New Persona</div>
      <Field label="Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Growth-Stage Founder" />
      <Field label="Who they are *" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} multiline placeholder="Describe this persona in 1–2 sentences" />
      <Field label="Demographics" value={form.demographics} onChange={v => setForm(f => ({ ...f, demographics: v }))} placeholder="e.g. Age 28-40, B2B SaaS, $2M–$10M ARR" />
      <TagInput label="Pain Points" value={form.painPoints ?? []} onChange={v => setForm(f => ({ ...f, painPoints: v }))} placeholder="e.g. Can't scale paid ads profitably" />
      <TagInput label="Desires" value={form.desires ?? []} onChange={v => setForm(f => ({ ...f, desires: v }))} placeholder="e.g. Predictable revenue growth" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setOpen(false)} style={btnStyle('ghost')}>Cancel</button>
        <button onClick={submit} disabled={saving} style={btnStyle('primary')}>{saving ? 'Creating…' : 'Create Persona'}</button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'product' | 'brand' | 'personas' | 'photos';

function ResourcesPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    if (t === 'brand' || t === 'personas' || t === 'photos') return t;
    return 'product';
  });
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Product form state
  const [productName,        setProductName]        = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productBenefits,    setProductBenefits]    = useState<string[]>([]);
  const [referenceImages,    setReferenceImages]    = useState<string[]>([]);

  // Media library state (separate from brand reference images)
  const [mediaImages, setMediaImages] = useState<string[]>([]);

  // Brand form state
  const [brandTone,  setBrandTone]  = useState('');
  const [brandVoice, setBrandVoice] = useState('');

  // URL scanner state (brand)
  const [scanInput,   setScanInput]   = useState('');
  const [scanning,    setScanning]    = useState(false);
  const [scanError,   setScanError]   = useState<string | null>(null);
  const [scanApplied, setScanApplied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getResource();
      setResource(r);
      setProductName(r.productName ?? '');
      setProductDescription(r.productDescription ?? '');
      setProductBenefits(r.productBenefits ?? []);
      setBrandTone(r.brandTone ?? '');
      setBrandVoice(r.brandVoice ?? '');
      // Load reference images from localStorage (stored separately — too large for API)
      try {
        const saved = localStorage.getItem('cos_ref_images');
        if (saved) setReferenceImages(JSON.parse(saved));
      } catch { /* ignore */ }
      // Load media library images
      try {
        const savedMedia = localStorage.getItem('cos_media_images');
        if (savedMedia) setMediaImages(JSON.parse(savedMedia));
      } catch { /* ignore */ }
    } catch { /* first visit — empty state */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-save media images whenever they change
  useEffect(() => {
    try { localStorage.setItem('cos_media_images', JSON.stringify(mediaImages)); } catch { /* ignore */ }
  }, [mediaImages]);

  async function saveProduct() {
    setSaving(true);
    try {
      const updated = await upsertResource({ productName, productDescription, productBenefits });
      setResource(prev => prev ? { ...prev, ...updated } : updated);
      // Persist reference images to localStorage
      localStorage.setItem('cos_ref_images', JSON.stringify(referenceImages));
    } catch { alert('Failed to save'); }
    setSaving(false);
  }

  async function saveBrand() {
    setSaving(true);
    try {
      const updated = await upsertResource({ brandTone, brandVoice });
      setResource(prev => prev ? { ...prev, ...updated } : updated);
    } catch { alert('Failed to save'); }
    setSaving(false);
  }

  async function handleScan() {
    const url = scanInput.trim();
    if (!url) return;
    setScanning(true);
    setScanError(null);
    setScanApplied(false);
    try {
      const result: BrandScan = await scanUrl(url);
      // Pre-fill all form fields — user reviews before saving
      if (result.productName)        setProductName(result.productName);
      if (result.productDescription) setProductDescription(result.productDescription);
      if (result.productBenefits?.length) setProductBenefits(result.productBenefits);
      if (result.brandTone)          setBrandTone(result.brandTone);
      if (result.brandVoice)         setBrandVoice(result.brandVoice);
      setScanApplied(true);
      // Switch to product tab so user sees the filled fields
      setTab('product');
    } catch (err: any) {
      setScanError(err?.message ?? 'Scan failed — check the URL and try again');
    } finally {
      setScanning(false);
    }
  }

  function handlePersonaCreated(p: Persona) {
    setResource(prev => prev ? { ...prev, personas: [...prev.personas, p] } : prev);
  }

  function handlePersonaDeleted(id: string) {
    setResource(prev => prev ? { ...prev, personas: prev.personas.filter(p => p.id !== id) } : prev);
  }

  function handlePersonaUpdated(id: string, updated: Persona) {
    setResource(prev => prev
      ? { ...prev, personas: prev.personas.map(p => p.id === id ? updated : p) }
      : prev
    );
  }

  const tabBase: React.CSSProperties = {
    padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    fontWeight: 500, border: 'none', transition: 'all 0.15s',
  };
  const activeTab:   React.CSSProperties = { ...tabBase, background: '#4f46e5', color: '#fff' };
  const inactiveTab: React.CSSProperties = { ...tabBase, background: 'transparent', color: '#666' };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080808', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ borderBottom: '1px solid #111', padding: '20px 32px', flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: '#e2e8f0' }}>Resources</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
            Your product, brand, and audience knowledge — injected into every creative
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: 720 }}>

            {/* ── URL Scanner ── */}
            <div style={{
              background: '#0d0d0d', border: '1px solid #1a1a2e', borderRadius: 12,
              padding: '16px 20px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>
                🔍 Auto-fill from website
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={scanInput}
                  onChange={e => { setScanInput(e.target.value); setScanApplied(false); setScanError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleScan(); }}
                  placeholder="https://yourproduct.com"
                  disabled={scanning}
                  style={{
                    flex: 1, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
                    padding: '9px 14px', color: '#e2e8f0', fontSize: 13, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleScan}
                  disabled={scanning || !scanInput.trim()}
                  style={{
                    background: scanning ? '#1a1a2e' : '#4f46e5',
                    border: 'none', borderRadius: 8, padding: '9px 20px',
                    color: scanning ? '#666' : '#fff', fontSize: 13, fontWeight: 600,
                    cursor: scanning || !scanInput.trim() ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'background 0.15s',
                  }}
                >
                  {scanning ? '⏳ Scanning…' : 'Scan'}
                </button>
              </div>
              {scanError && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#f87171', background: '#1e0a0a', borderRadius: 6, padding: '8px 12px' }}>
                  ⚠️ {scanError}
                </div>
              )}
              {scanApplied && !scanError && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#4ade80', background: '#0a1e0a', borderRadius: 6, padding: '8px 12px' }}>
                  ✓ Fields pre-filled from <strong>{scanInput}</strong> — review below, then save.
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 4, background: '#0d0d0d', borderRadius: 10, padding: 4,
              marginBottom: 28, border: '1px solid #1a1a1a', width: 'fit-content',
            }}>
              {(['product', 'brand', 'personas', 'photos'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={tab === t ? activeTab : inactiveTab}>
                  {t === 'product' ? 'Product' : t === 'brand' ? 'Brand' : t === 'personas' ? 'Personas' : 'Photos'}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>
            ) : (
              <>
                {/* ── Product Tab ── */}
                {tab === 'product' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                      Tell the AI what you're selling. This context shapes the core message, offer, and angle in every ad.
                    </div>
                    <Field
                      label="Product Name"
                      value={productName}
                      onChange={setProductName}
                      placeholder="e.g. CreativeOS Pro"
                    />
                    <Field
                      label="Product Description"
                      value={productDescription}
                      onChange={setProductDescription}
                      placeholder="What does it do and who is it for? 2–3 sentences."
                      multiline
                    />
                    <TagInput
                      label="Key Benefits"
                      value={productBenefits}
                      onChange={setProductBenefits}
                      placeholder="e.g. 10x faster creative output"
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={saveProduct} disabled={saving} style={btnStyle('primary')}>
                        {saving ? 'Saving…' : 'Save Product'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Brand Tab ── */}
                {tab === 'brand' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                      Define your brand voice. The AI uses this to write in your tone — not generic copy.
                    </div>
                    <Field
                      label="Brand Tone"
                      value={brandTone}
                      onChange={setBrandTone}
                      placeholder="e.g. Bold, direct, no fluff. Like a confident founder talking to a peer."
                      multiline
                    />
                    <Field
                      label="Brand Voice Rules"
                      value={brandVoice}
                      onChange={setBrandVoice}
                      placeholder="e.g. Never use buzzwords. Always lead with the outcome, not the feature. Short sentences."
                      multiline
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={saveBrand} disabled={saving} style={btnStyle('primary')}>
                        {saving ? 'Saving…' : 'Save Brand Voice'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Photos Tab ── */}
                {tab === 'photos' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                      Upload photos to use in your carousels and ads. These are available when building a Photo Reveal carousel in Create.
                    </div>
                    <ImageReferences
                      images={mediaImages}
                      onChange={setMediaImages}
                    />
                    {mediaImages.length > 0 && (
                      <div style={{ fontSize: 12, color: '#444', marginTop: -8 }}>
                        {mediaImages.length} photo{mediaImages.length !== 1 ? 's' : ''} saved — auto-saved to your library
                      </div>
                    )}
                  </div>
                )}

                {/* ── Personas Tab ── */}
                {tab === 'personas' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                      Create target personas. Select one on the Create page and every ad is written specifically for that person's pain points and desires.
                    </div>

                    {(resource?.personas ?? []).map(p => (
                      <PersonaCard
                        key={p.id}
                        persona={p}
                        onDelete={handlePersonaDeleted}
                        onUpdate={handlePersonaUpdated}
                      />
                    ))}

                    <NewPersonaForm onCreated={handlePersonaCreated} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <Suspense fallback={null}>
      <ResourcesPageInner />
    </Suspense>
  );
}
