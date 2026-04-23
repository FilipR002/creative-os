'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  'Analyzing your idea...',
  'Selecting best angles...',
  'Generating creatives...',
  'Optimizing performance...',
];

const STEP_DELAYS = [0, 1400, 2900, 4600];

interface Props {
  visible: boolean;
}

export function LoadingOverlay({ visible }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) { setStep(0); return; }

    const timers = STEP_DELAYS.map((delay, i) =>
      setTimeout(() => setStep(i), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-inner">
        <div className="loading-logo">Creative OS</div>
        <div className="loading-steps">
          {STEPS.map((label, i) => {
            const status = i < step ? 'done' : i === step ? 'active' : 'pending';
            return (
              <div key={label} className={`loading-step ${status}`}>
                <div className="loading-step-dot" />
                <span className="loading-step-label">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
