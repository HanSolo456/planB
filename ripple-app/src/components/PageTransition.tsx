import { useLayoutEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLenis } from 'lenis/react';

const EASE = [0.16, 1, 0.3, 1] as const;

const variants = {
  page: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  login: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  nested: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
  },
};

interface Props {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}

export function pageScope(pathname: string): string {
  return pathname.startsWith('/app') ? '/app' : pathname;
}

export default function PageTransition({
  children,
  variant = 'page',
  className,
}: Props) {
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();

  useLayoutEffect(() => {
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [lenis]);

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={variants[variant]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: variant === 'nested' ? 0.26 : 0.4,
        ease: EASE,
      }}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}
