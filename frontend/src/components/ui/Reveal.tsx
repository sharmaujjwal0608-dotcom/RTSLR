"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export type RevealProps = {
  children: ReactNode;
  /** Seconds to wait after entering the viewport. Use small steps (0.06–0.12) to stagger siblings. */
  delay?: number;
  /** Rise distance in px. Keep it small; 0 gives a pure fade. */
  y?: number;
  as?: "div" | "section" | "li" | "span";
  className?: string;
};

const elements = {
  div: motion.div,
  section: motion.section,
  li: motion.li,
  span: motion.span,
} as const;

/**
 * Fades content in once as it scrolls into view.
 *
 * It is decoration only. Under `prefers-reduced-motion`, when printing and
 * when scripts are off, globals.css and the root layout force `[data-reveal]`
 * fully visible, so nothing may depend on this animation to be readable.
 * Use it on a few key blocks per page, not on every section.
 */
export function Reveal({ children, delay = 0, y = 14, as = "div", className }: RevealProps) {
  const reduce = useReducedMotion();
  const Element = elements[as];
  return (
    <Element
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </Element>
  );
}
