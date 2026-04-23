'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

interface EditableBlockProps {
  blockId:    string;
  value:      string;
  onChange:   (blockId: string, value: string) => void;
  onImprove:  (blockId: string, anchorEl: HTMLElement) => void;
  className:  string;
  improving?: boolean;
  multiline?: boolean;
  isAnchor?:  boolean;   // true when this block is the anchor of the active branch
  onBranch?:  (blockId: string) => void;  // undefined = branch not available
}

export function EditableBlock({
  blockId,
  value,
  onChange,
  onImprove,
  className,
  improving  = false,
  multiline  = false,
  isAnchor   = false,
  onBranch,
}: EditableBlockProps) {
  const ref     = useRef<HTMLDivElement>(null);
  const prevVal = useRef(value);
  const focused = useRef(false);

  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value !== prevVal.current) {
      prevVal.current = value;
      if (ref.current && !focused.current) {
        ref.current.textContent = value;
      }
    }
  }, [value]);

  function handleFocus()  { focused.current = true; }
  function handleBlur()   {
    focused.current = false;
    const next = ref.current?.textContent ?? '';
    if (next !== prevVal.current) {
      prevVal.current = next;
      onChange(blockId, next);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
  }

  function handleImprove(e: React.MouseEvent) {
    e.stopPropagation();
    const wrap = (e.currentTarget as HTMLElement).closest('.eb-wrap') as HTMLElement;
    onImprove(blockId, wrap ?? (e.currentTarget as HTMLElement));
  }

  function handleBranch(e: React.MouseEvent) {
    e.stopPropagation();
    onBranch?.(blockId);
  }

  return (
    <div className={`eb-wrap${improving ? ' eb-wrap--improving' : ''}${isAnchor ? ' eb-wrap--anchor' : ''}`}>
      {isAnchor && <div className="eb-anchor-badge">anchor</div>}
      <div
        ref={ref}
        className={`${className} eb-text`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {improving && <div className="eb-spinner-overlay"><div className="eb-spinner" /></div>}
      <div className="eb-actions">
        {onBranch && (
          <button className="eb-branch-btn" onClick={handleBranch} tabIndex={-1} aria-label="Branch from this block" title="Fork a new variation keeping this block">
            ⊕
          </button>
        )}
        <button className="eb-improve-btn" onClick={handleImprove} tabIndex={-1} aria-label="Improve this block">
          ✦
        </button>
      </div>
    </div>
  );
}
