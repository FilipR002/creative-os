/**
 * BentoCard.tsx
 * Drop-in bento feature card for Creative OS landing page.
 * Usage:
 *   <BentoCard featured span2 icon={<YourIcon />} tag="Core" title="Ad Library" description="..." />
 */

import React from 'react';

interface BentoCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  tag?: string;
  featured?: boolean;   // green-tinted gradient background
  span2?: boolean;      // spans 2 grid columns
  children?: React.ReactNode;
}

export function BentoCard({ title, description, icon, tag, featured, span2, children }: BentoCardProps) {
  return (
    <div
      className={[
        'bento-card',
        featured ? 'bento-card--featured' : '',
        span2 ? 'bento-card--span2' : '',
      ].join(' ')}
    >
      {icon && <div className="bento-card__icon">{icon}</div>}
      <div className="bento-card__title">{title}</div>
      <div className="bento-card__desc">{description}</div>
      {tag && <span className="bento-card__tag">{tag}</span>}
      {children}
    </div>
  );
}

/**
 * BentoGrid wrapper — 4-column responsive grid
 */
export const BentoGrid = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function BentoGrid({ children }, ref) {
  return <div ref={ref} className="bento-grid">{children}</div>;
});

/**
 * useBentoReveal — hook to trigger scroll reveal on bento cards
 * Call once in your page component after mount.
 *
 * Example:
 *   const gridRef = useBentoReveal();
 *   <BentoGrid ref={gridRef}>...</BentoGrid>
 */
export function useBentoReveal() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('.bento-card');
    if (!cards) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = (i % 4) * 100;
            setTimeout(() => el.classList.add('is-visible'), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.15 }
    );

    cards.forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, []);

  return ref;
}
