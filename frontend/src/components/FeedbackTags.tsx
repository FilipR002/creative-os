'use client';

import { useState } from 'react';
import { ingestSignal } from '@/lib/style-profile';

interface FeedbackTagsProps {
  onFeedback?: (type: 'worked' | 'didnt_work') => void;
}

export function FeedbackTags({ onFeedback }: FeedbackTagsProps) {
  const [choice, setChoice] = useState<'worked' | 'didnt_work' | null>(null);

  function handleClick(type: 'worked' | 'didnt_work') {
    if (choice) return;
    setChoice(type);
    ingestSignal(type === 'worked' ? 'feedback_worked' : 'feedback_didnt_work');
    onFeedback?.(type);
  }

  if (choice) {
    return (
      <div className="feedback-tags">
        <span className="feedback-recorded">
          {choice === 'worked' ? '✓ Marked as worked — AI will learn from this' : '✓ Noted — AI will adjust'}
        </span>
      </div>
    );
  }

  return (
    <div className="feedback-tags">
      <span className="feedback-label">How did this perform?</span>
      <button className="feedback-tag worked"     onClick={() => handleClick('worked')}>👍 This worked</button>
      <button className="feedback-tag didnt-work" onClick={() => handleClick('didnt_work')}>👎 Didn't work</button>
    </div>
  );
}
