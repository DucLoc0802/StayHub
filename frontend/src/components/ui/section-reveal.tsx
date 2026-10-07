'use client';

import { useEffect, useRef, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Progressive enhancement: content is visible during SSR and without JavaScript.
// Observe whole sections once, rather than attaching observers to every card.
export function SectionReveal({
  as: Tag = 'div',
  className,
  ...props
}: ComponentProps<'div'> & { as?: 'div' | 'section' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    // Hydration must not fade out a section the user can already see.
    const bounds = element.getBoundingClientRect();
    if (bounds.top < window.innerHeight && bounds.bottom > 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // Never fade a section while someone is already interacting with it.
        if (!element.contains(document.activeElement))
          element.dataset.revealed = 'true';
        observer.disconnect();
      },
      { threshold: 0, rootMargin: '0px 0px -24px 0px' },
    );
    observer.observe(element);
    const stop = () => {
      if (preference.matches) {
        observer.disconnect();
        delete element.dataset.revealed;
      }
    };
    preference.addEventListener('change', stop);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', stop);
    };
  }, []);
  return (
    <Tag ref={ref} className={cn('section-reveal', className)} {...props} />
  );
}
