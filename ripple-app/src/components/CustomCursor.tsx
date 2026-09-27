import { useEffect, useRef, useState, useCallback } from 'react';

interface ClickStamp {
  id: number;
  x: number;
  y: number;
}



// Scroll direction drives the plane rotation
type ScrollDir = 'idle' | 'up' | 'down';

// Rotation applied to the emoji span for each state
// The ✈️ emoji points right by default.
// • idle  → -45deg  (nose pointing up-right, classic cursor angle)
// • down  → 90deg   (nose pointing straight down)
// • up    → -90deg  (nose pointing straight up)
const SCROLL_ROTATION: Record<ScrollDir, number> = {
  idle: -45,
  down:  90,
  up:   -90,
};

/** Returns true on touch-primary devices (phones, tablets). */
function isTouchDevice() {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

export default function CustomCursor() {
  const planeRef = useRef<HTMLDivElement>(null);
  const dotRef   = useRef<HTMLDivElement>(null);

  const mousePos = useRef({ x: -200, y: -200 });
  const dotPos   = useRef({ x: -200, y: -200 });
  const rafId    = useRef<number>(0);
  const isHovering = useRef(false);

  const [stamps, setStamps] = useState<ClickStamp[]>([]);
  const stampCounter = useRef(0);

  const scrollDir    = useRef<ScrollDir>('idle');
  const scrollTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY  = useRef(0);
  const [scrollState, setScrollState] = useState<ScrollDir>('idle');

  // Don't render anything on touch devices — no cursor exists there
  const [isTouch] = useState(() => isTouchDevice());

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const animate = useCallback(() => {
    dotPos.current.x = lerp(dotPos.current.x, mousePos.current.x, 0.12);
    dotPos.current.y = lerp(dotPos.current.y, mousePos.current.y, 0.12);

    if (planeRef.current) {
      planeRef.current.style.transform = `translate(${mousePos.current.x}px, ${mousePos.current.y}px)`;
    }
    if (dotRef.current) {
      dotRef.current.style.transform = `translate(${dotPos.current.x}px, ${dotPos.current.y}px)`;
    }

    rafId.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Skip all event listeners and animation loop on touch devices
    if (isTouch) return;

    const onMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;
    };

    const onEnter = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const interactive = el.closest(
        'a, button, [role="button"], input, textarea, select, label, [tabindex]'
      );
      if (interactive && dotRef.current && planeRef.current) {
        isHovering.current = true;
        dotRef.current.classList.add('cursor-dot--hover');
        planeRef.current.classList.add('cursor-plane--hover');
      }
    };

    const onLeave = () => {
      if (dotRef.current && planeRef.current) {
        isHovering.current = false;
        dotRef.current.classList.remove('cursor-dot--hover');
        planeRef.current.classList.remove('cursor-plane--hover');
      }
    };

    const onClick = (_e: MouseEvent) => {
      // no click effect
    };

    const setDir = (dir: ScrollDir) => {
      scrollDir.current = dir;
      setScrollState(dir);
    };

    const onScroll = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;

      if (Math.abs(diff) < 2) return;

      setDir(diff > 0 ? 'down' : 'up');
      lastScrollY.current = currentY;

      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setDir('idle'), 400);
    };

    window.addEventListener('mousemove', onMove,   { passive: true });
    window.addEventListener('mouseover', onEnter,  { passive: true });
    window.addEventListener('mouseout',  onLeave,  { passive: true });
    window.addEventListener('click',     onClick,  { passive: true });
    window.addEventListener('scroll',    onScroll, { passive: true });

    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onEnter);
      window.removeEventListener('mouseout',  onLeave);
      window.removeEventListener('click',     onClick);
      window.removeEventListener('scroll',    onScroll);
      cancelAnimationFrame(rafId.current);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [animate, isTouch]);

  // Nothing to render on touch devices
  if (isTouch) return null;

  const rotation = SCROLL_ROTATION[scrollState];

  return (
    <>
      {/* ── Airplane cursor ── */}
      <div ref={planeRef} className="cursor-plane" aria-hidden="true">
        {/* Default ✈️ — hidden while hovering */}
        <span
          className="cursor-plane__emoji cursor-plane__emoji--default"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          ✈️
        </span>
        {/* Hover 🛫 — shown while over interactive elements */}
        <span
          className="cursor-plane__emoji cursor-plane__emoji--hover"
          style={{ transform: `rotate(${rotation}deg) scale(1.15)` }}
        >
          🛫
        </span>
      </div>

      {/* ── Trailing dot ── */}
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />

      {/* ── No click effect ── */}
      {stamps.length > 0 && null}
    </>
  );
}
