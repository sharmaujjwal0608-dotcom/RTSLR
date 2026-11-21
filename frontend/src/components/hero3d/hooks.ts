"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

/* -------------------------------------------------------------------------- */
/* Media queries                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Subscribes to a CSS media query. Returns `serverValue` during server render
 * and hydration, then the live value, so it never causes a hydration mismatch.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** True when the user asked the system to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/* -------------------------------------------------------------------------- */
/* Visibility                                                                 */
/* -------------------------------------------------------------------------- */

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** False while the browser tab is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

export interface InViewState {
  /** The element intersects the viewport (plus `rootMargin`) right now. */
  inView: boolean;
  /** The element has intersected at least once. */
  hasEntered: boolean;
}

/** IntersectionObserver wrapper. Without IntersectionObserver it reports "in view". */
export function useInView(ref: RefObject<Element | null>, rootMargin = "0px"): InViewState {
  const [state, setState] = useState<InViewState>({ inView: false, hasEntered: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setState({ inView: true, hasEntered: true }), 0);
      return () => window.clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const inView = entry.isIntersecting;
        setState((previous) =>
          previous.inView === inView && (previous.hasEntered || !inView)
            ? previous
            : { inView, hasEntered: previous.hasEntered || inView },
        );
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return state;
}

/* -------------------------------------------------------------------------- */
/* Pointer parallax                                                           */
/* -------------------------------------------------------------------------- */

export interface ParallaxOptions {
  /** Stop listening and return to the centre. */
  disabled?: boolean;
}

export interface ParallaxPoint {
  /** -1 (left edge of the window) … 1 (right edge). */
  x: number;
  /** -1 (top edge of the window) … 1 (bottom edge). */
  y: number;
}

/**
 * Tracks the mouse position across the window as a normalised target, for
 * small eased parallax effects. It returns a ref (no re-renders): read
 * `ref.current` inside an animation frame and ease toward it yourself.
 *
 * - Listens on `window` with a passive listener, so it never captures the
 *   pointer or blocks scrolling.
 * - Ignores touch and pen input: on touch screens the target stays centred.
 * - Returns to the centre when the pointer leaves the window.
 */
export function useParallax({ disabled = false }: ParallaxOptions = {}): RefObject<ParallaxPoint> {
  const target = useRef<ParallaxPoint>({ x: 0, y: 0 });

  useEffect(() => {
    const point = target.current;
    if (disabled) {
      point.x = 0;
      point.y = 0;
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      point.x = Math.max(-1, Math.min(1, (event.clientX / width) * 2 - 1));
      point.y = Math.max(-1, Math.min(1, (event.clientY / height) * 2 - 1));
    };
    const onLeave = () => {
      point.x = 0;
      point.y = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [disabled]);

  return target;
}

/* -------------------------------------------------------------------------- */
/* Capability                                                                 */
/* -------------------------------------------------------------------------- */

let webglProbe: boolean | undefined;

/** True when a WebGL2 context can be created (three.js 0.187 requires WebGL2). Probed once. */
export function canUseWebGL(): boolean {
  if (webglProbe !== undefined) return webglProbe;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webglProbe = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

interface NavigatorHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

let deviceProbe: boolean | undefined;

/** Device-level part of the rule: WebGL2 present, not a data-saver session, not a very small CPU. */
function deviceCanRender3D(): boolean {
  if (deviceProbe !== undefined) return deviceProbe;
  const hints = navigator as Navigator & NavigatorHints;
  const cores = hints.hardwareConcurrency ?? 8;
  const saveData = hints.connection?.saveData === true;
  deviceProbe = !saveData && cores > 2 && canUseWebGL();
  return deviceProbe;
}

function isLowPowerTouchDevice(): boolean {
  const hints = navigator as Navigator & NavigatorHints;
  const cores = hints.hardwareConcurrency ?? 8;
  const memory = hints.deviceMemory ?? 8;
  return cores <= 4 || memory <= 4;
}

const subscribeNever = () => () => {};

/**
 * The rule that decides between the live 3D scene and the static SVG.
 * 3D is used only when ALL of these hold:
 *  - the viewport is at least 768px wide;
 *  - WebGL2 is available;
 *  - the browser is not in data-saver mode;
 *  - the device reports more than 2 logical cores;
 *  - it is not a coarse-pointer (touch) device with <= 4 cores or <= 4 GB.
 * Always false on the server and during hydration.
 */
export function useHero3DCapable(): boolean {
  const wide = useMediaQuery("(min-width: 768px)");
  const coarse = useMediaQuery("(pointer: coarse)");
  const device = useSyncExternalStore(subscribeNever, deviceCanRender3D, () => false);
  const lowPowerTouch = useSyncExternalStore(subscribeNever, isLowPowerTouchDevice, () => true);
  return wide && device && !(coarse && lowPowerTouch);
}
