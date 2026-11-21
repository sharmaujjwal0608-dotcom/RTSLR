"use client";

import { Component, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import { HeroFallback } from "./HeroFallback";
import { useHero3DCapable, useInView, usePageVisible, usePrefersReducedMotion } from "./hooks";

/**
 * three.js, react-three-fiber and the scene live in their own chunk. It is
 * requested only in the browser, only on devices that pass the capability
 * rule, and only once the artwork is near the viewport.
 */
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false, loading: () => null });

export interface HeroArtworkProps {
  /** Layout classes for the outer box. The artwork fills that box. */
  className?: string;
  /**
   * "auto" (default): live 3D where the device allows it, otherwise the
   * static illustration. "static": always the illustration.
   */
  mode?: "auto" | "static";
}

/** Catches a failed WebGL context or any render error in the scene. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Home hero artwork: an ivory hand sculpture with ribbons, floating solids
 * and interface-symbol chips.
 *
 * - Fills its parent's box (give the parent a size, e.g. `aspect-square`).
 * - Decorative: `aria-hidden`, nothing focusable, `pointer-events: none`, so
 *   it never traps focus or blocks scrolling on touch screens.
 * - The static SVG is always rendered first (server and client), so there is
 *   no layout shift and no blank flash; the 3D canvas fades in over it after
 *   its first frame and the SVG fades out.
 * - Under `prefers-reduced-motion` the 3D scene draws one still frame.
 *
 * The hand is a neutral, relaxed open hand. It does not depict any sign.
 */
export function HeroArtwork({ className, mode = "auto" }: HeroArtworkProps) {
  const box = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const capable = useHero3DCapable();
  const pageVisible = usePageVisible();
  const { inView, hasEntered } = useInView(box, "200px");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleReady = useCallback(() => setReady(true), []);
  const handleFailure = useCallback(() => setFailed(true), []);

  const mount3D = mode === "auto" && capable && hasEntered && !failed;
  const show3D = mount3D && ready;

  return (
    <div
      ref={box}
      aria-hidden="true"
      data-hero-artwork={show3D ? "3d" : "static"}
      className={cn("pointer-events-none relative h-full w-full select-none", className)}
    >
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 ease-calm",
          show3D ? "opacity-0" : "opacity-100",
        )}
      >
        <HeroFallback />
      </div>

      {mount3D ? (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-calm",
            show3D ? "opacity-100" : "opacity-0",
          )}
        >
          <SceneBoundary onError={handleFailure}>
            <HeroScene
              active={inView && pageVisible}
              reducedMotion={reducedMotion}
              onReady={handleReady}
              onContextLost={handleFailure}
            />
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
