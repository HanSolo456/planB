import React, { useMemo } from 'react';
import './GradualBlur.css';

export interface GradualBlurProps {
  target?: 'page' | 'parent';
  position?: 'bottom' | 'top' | 'left' | 'right';
  height?: string;
  width?: string;
  strength?: number;
  divCount?: number;
  curve?: 'linear' | 'bezier' | 'ease-in-out';
  exponential?: boolean;
  opacity?: number;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
}

function calculateBlurProgression(
  i: number,
  divCount: number,
  curve: 'linear' | 'bezier' | 'ease-in-out',
  exponential: boolean,
  strength: number
): number {
  let progress = i / divCount;

  switch (curve) {
    case 'bezier':
      progress = progress * progress * (3 - 2 * progress);
      break;
    case 'ease-in-out':
      progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      break;
    case 'linear':
    default:
      break;
  }

  // Calculate blur in pixels (0.0625rem = 1px at 16px root font size)
  if (exponential) {
    return Math.pow(2, progress * 4) * 0.0625 * strength * 16;
  }
  return 0.0625 * (progress * divCount + 1) * strength * 16;
}

function getGradientDirection(position: 'bottom' | 'top' | 'left' | 'right'): string {
  switch (position) {
    case 'top':
      return 'to top';
    case 'left':
      return 'to left';
    case 'right':
      return 'to right';
    case 'bottom':
    default:
      return 'to bottom';
  }
}

export const GradualBlur: React.FC<GradualBlurProps> = ({
  target = 'page',
  position = 'bottom',
  height = '6rem',
  width = '100%',
  strength = 2,
  divCount = 5,
  curve = 'bezier',
  exponential = true,
  opacity = 1,
  zIndex = 40,
  className = '',
  style = {},
}) => {
  const direction = getGradientDirection(position);

  const layers = useMemo(() => {
    return Array.from({ length: divCount }, (_, idx) => {
      const i = idx + 1;
      const blurPx = calculateBlurProgression(i, divCount, curve, exponential, strength);
      const startPct = Math.max(0, ((i - 1) / divCount) * 100);
      const midPct = (i / divCount) * 100;
      const maskGradient = `linear-gradient(${direction}, rgba(0,0,0,0) ${startPct.toFixed(1)}%, rgba(0,0,0,1) ${midPct.toFixed(1)}%, rgba(0,0,0,1) 100%)`;

      return {
        key: i,
        style: {
          backdropFilter: `blur(${blurPx.toFixed(2)}px)`,
          WebkitBackdropFilter: `blur(${blurPx.toFixed(2)}px)`,
          maskImage: maskGradient,
          WebkitMaskImage: maskGradient,
        } as React.CSSProperties,
      };
    });
  }, [divCount, curve, exponential, strength, direction]);

  const containerPosition = target === 'page' ? 'fixed' : 'absolute';

  const positionStyles: React.CSSProperties = {
    position: containerPosition,
    zIndex,
    width,
    height,
    opacity,
    pointerEvents: 'none',
  };

  if (position === 'bottom') {
    positionStyles.bottom = 0;
    positionStyles.left = 0;
    positionStyles.right = 0;
  } else if (position === 'top') {
    positionStyles.top = 0;
    positionStyles.left = 0;
    positionStyles.right = 0;
  } else if (position === 'left') {
    positionStyles.top = 0;
    positionStyles.bottom = 0;
    positionStyles.left = 0;
  } else if (position === 'right') {
    positionStyles.top = 0;
    positionStyles.bottom = 0;
    positionStyles.right = 0;
  }

  return (
    <div
      className={`gradual-blur-container ${className}`.trim()}
      style={{
        ...positionStyles,
        ...style,
      }}
      aria-hidden="true"
    >
      <div className="gradual-blur-inner">
        {layers.map((layer) => (
          <div key={layer.key} style={layer.style} />
        ))}
      </div>
    </div>
  );
};

export default GradualBlur;
