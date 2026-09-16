import React, { useState, useEffect } from 'react';
import { useReducedMotion, Variants, Transition } from 'framer-motion';

export { useReducedMotion };

export const defaultTransition: Transition = {
  duration: 0.35,
  ease: [0.16, 1, 0.3, 1], // snappy cubic bezier
};

export const fadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: defaultTransition,
  },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.15 },
  },
};

export const accordionVariants: Variants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};

/**
 * Tab & Panel Cross-Fade Variants (for Settings, Wizard, and Pipeline tabs)
 */
export const tabContentVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
};

/**
 * Staggered List Items with index capped at 12 to maintain 60fps
 */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (customIndex: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      delay: Math.min(customIndex, 12) * 0.035,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

/**
 * Score Bar Fill Variants
 */
export const scoreBarVariants: Variants = {
  hidden: { width: '0%' },
  visible: (targetWidth: number) => ({
    width: `${Math.min(100, Math.max(0, targetWidth))}%`,
    transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },
  }),
};

/**
 * Pulse variants for live pipeline stages (animating only transform/opacity)
 */
export const pulseGlowVariants: Variants = {
  initial: { scale: 1, opacity: 0.6 },
  animate: {
    scale: [1, 1.08, 1],
    opacity: [0.6, 1, 0.6],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Count-Up Numbers Hook for Dashboard & Metric Cards
 * Respects prefers-reduced-motion and animates smoothly with easeOutQuad.
 */
export function useCountUp(
  target: number,
  duration: number = 1.0,
  trigger: boolean = true
): number {
  const shouldReduce = useReducedMotion();
  const [count, setCount] = useState<number>(shouldReduce ? target : 0);

  useEffect(() => {
    if (shouldReduce) {
      setCount(target);
      return;
    }
    if (!trigger) return;

    let start = 0;
    const end = target;
    if (start === end) {
      setCount(end);
      return;
    }

    const startTime = performance.now();
    let animationFrame: number;

    const update = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuad curve
      const ease = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(start + (end - start) * ease));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(update);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, trigger, shouldReduce]);

  return count;
}

