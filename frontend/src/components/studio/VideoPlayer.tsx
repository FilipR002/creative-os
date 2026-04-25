'use client';

import { useRef, useState, useEffect } from 'react';

interface Props {
  src:        string;
  platform?:  string;
}

export function VideoPlayer({ src, platform }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying]   = useState(true);
  const [muted,   setMuted]     = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  const isVertical = !platform || platform === 'tiktok' || platform === 'instagram';

  return (
    <div style={{
      position:   'relative',
      width:      isVertical ? 320 : 480,
      aspectRatio: isVertical ? '9/16' : '16/9',
      background: '#000',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Progress bar */}
      <div style={{
        position:   'absolute',
        bottom:     0,
        left:       0,
        right:      0,
        height:     2,
        background: 'rgba(255,255,255,0.2)',
      }}>
        <div style={{
          height:     '100%',
          width:      `${progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Controls overlay */}
      <div style={{
        position:       'absolute',
        bottom:         14,
        right:          14,
        display:        'flex',
        flexDirection:  'column',
        gap:            8,
        alignItems:     'center',
      }}>
        <button
          onClick={togglePlay}
          style={{
            width:        36,
            height:       36,
            borderRadius: '50%',
            background:   'rgba(0,0,0,0.6)',
            border:       '1px solid rgba(255,255,255,0.15)',
            color:        '#fff',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     14,
            cursor:       'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={toggleMute}
          style={{
            width:        36,
            height:       36,
            borderRadius: '50%',
            background:   'rgba(0,0,0,0.6)',
            border:       '1px solid rgba(255,255,255,0.15)',
            color:        '#fff',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            fontSize:     13,
            cursor:       'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
