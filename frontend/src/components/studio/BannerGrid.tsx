'use client';

import type { BannerVariant } from '@/lib/api/creative-client';

interface Props {
  banners:  BannerVariant[];
  headline: string;
  cta:      string;
}

// Standard IAB banner sizes and their display proportions
const SIZE_META: Record<string, { label: string; cols: number; rows: number }> = {
  '1080x1080': { label: 'Square',   cols: 1, rows: 1 },
  '1080x1920': { label: 'Story',    cols: 1, rows: 2 },
  '1200x628':  { label: 'Leaderboard', cols: 2, rows: 1 },
  '300x250':   { label: 'Rectangle', cols: 1, rows: 1 },
  '728x90':    { label: 'Banner',    cols: 2, rows: 0.5 },
  '160x600':   { label: 'Skyscraper', cols: 0.5, rows: 2 },
};

function BannerCard({
  banner,
  headline,
  cta,
}: {
  banner:   BannerVariant;
  headline: string;
  cta:      string;
}) {
  const meta  = SIZE_META[banner.size] ?? { label: banner.size, cols: 1, rows: 1 };
  const [w, h] = banner.size.split('x').map(Number);
  const ratio  = h / w;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
        {meta.label} <span style={{ color: 'var(--border2)' }}>·</span> {banner.size}
      </div>
      <div style={{
        width:        '100%',
        aspectRatio:  `${w}/${h}`,
        background:   banner.imageUrl
          ? `url(${banner.imageUrl}) center/cover`
          : 'linear-gradient(145deg, #0F1621, #1A2235)',
        border:       '1px solid var(--border)',
        borderRadius: 8,
        overflow:     'hidden',
        position:     'relative',
        display:      'flex',
        flexDirection: 'column',
        justifyContent: ratio > 1 ? 'flex-end' : 'center',
        padding:      ratio > 0.5 ? 16 : 8,
        gap:          6,
      }}>
        {!banner.imageUrl && (
          <>
            <div style={{
              fontSize:   ratio < 0.3 ? 10 : 13,
              fontWeight: 700,
              color:      'var(--text)',
              lineHeight: 1.3,
            }}>
              {(banner.headline || headline).slice(0, ratio < 0.3 ? 40 : 80)}
            </div>
            {ratio >= 0.4 && (
              <div style={{
                display:      'inline-flex',
                alignItems:   'center',
                alignSelf:    'flex-start',
                fontSize:     10,
                fontWeight:   600,
                color:        'var(--accent)',
                background:   'rgba(0,201,122,0.12)',
                border:       '1px solid rgba(0,201,122,0.25)',
                borderRadius: 4,
                padding:      '3px 8px',
              }}>
                {cta}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function BannerGrid({ banners, headline, cta }: Props) {
  // If no banners from backend, show placeholders for standard sizes
  const displayBanners: BannerVariant[] = banners.length > 0 ? banners : [
    { size: '1080x1080', imageUrl: '', headline },
    { size: '1200x628',  imageUrl: '', headline },
    { size: '1080x1920', imageUrl: '', headline },
  ];

  return (
    <div style={{
      display:               'grid',
      gridTemplateColumns:   'repeat(2, 1fr)',
      gap:                   16,
      width:                 '100%',
      maxWidth:              520,
    }}>
      {displayBanners.map((banner, i) => (
        <BannerCard key={i} banner={banner} headline={headline} cta={cta} />
      ))}
    </div>
  );
}
