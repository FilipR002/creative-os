'use client';

import type { CreativeContent } from '@/lib/api/creative-client';
import type { Platform }        from './PlatformSelector';
import { VideoPlayer }          from './VideoPlayer';
import { CarouselPreview }      from './CarouselPreview';
import { BannerGrid }           from './BannerGrid';
import { MockupFrame }          from './MockupFrame';

interface Props {
  content:  CreativeContent;
  platform: Platform;
}

// Skeleton for loading state
function PreviewSkeleton({ format }: { format: string }) {
  const isVertical = format === 'video';
  return (
    <div style={{
      width:        isVertical ? 320 : 480,
      aspectRatio:  isVertical ? '9/16' : '4/3',
      background:   'var(--surface)',
      borderRadius: 14,
      overflow:     'hidden',
      position:     'relative',
    }}>
      <div style={{
        position:   'absolute',
        inset:      0,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
        animation:  'shimmer 1.6s infinite',
      }} />
    </div>
  );
}

export function CreativePreview({ content, platform }: Props) {
  const videoUrl = content.stitchedVideoUrl ?? content.videoUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <MockupFrame
        platform={platform}
        format={content.format}
        caption={content.copy.caption}
      >
        {/* ── VIDEO ── */}
        {content.format === 'video' && (
          videoUrl
            ? <VideoPlayer src={videoUrl} platform={platform} />
            : (
              <div style={{
                width:           320,
                aspectRatio:     '9/16',
                background:      'var(--surface-3)',
                display:         'flex',
                flexDirection:   'column',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             12,
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
                  Video processing
                </div>
                <div style={{
                  width:        120,
                  height:       4,
                  background:   'var(--surface)',
                  borderRadius: 2,
                  overflow:     'hidden',
                }}>
                  <div style={{
                    height:     '100%',
                    width:      '60%',
                    background: 'var(--accent)',
                    borderRadius: 2,
                    animation:  'pulse 1.5s ease-in-out infinite',
                  }} />
                </div>
              </div>
            )
        )}

        {/* ── CAROUSEL ── */}
        {content.format === 'carousel' && (
          <CarouselPreview slides={content.slides ?? []} />
        )}

        {/* ── BANNER ── */}
        {content.format === 'banner' && (
          <BannerGrid
            banners={content.banners ?? []}
            headline={content.copy.headline}
            cta={content.copy.cta}
          />
        )}
      </MockupFrame>

      {/* Scene count for video */}
      {content.format === 'video' && content.sceneCount && (
        <div style={{
          fontSize:  11,
          color:     'var(--muted)',
          fontWeight: 500,
          textAlign: 'center',
        }}>
          {content.sceneCount} scene{content.sceneCount !== 1 ? 's' : ''} stitched
          {content.duration ? ` · ${content.duration}s` : ''}
        </div>
      )}
    </div>
  );
}

export { PreviewSkeleton };
