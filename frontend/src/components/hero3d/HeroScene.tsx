"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import {
  BackSide,
  MathUtils,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
} from "three";
import type { Group } from "three";
import { CAMERA, DESIGN_SIZE, HAND_POSE, LIGHTS, MOTION, PALETTE } from "./config";
import {
  Chips,
  GroundShadow,
  Ribbons,
  SceneMotionContext,
  Solids,
  type SceneMaterials,
  type SceneMotion,
} from "./Forms";
import { Hand } from "./Hand";
import { useParallax } from "./hooks";

export interface HeroSceneProps {
  /** Run the render loop. Pass false while off-screen or while the tab is hidden. */
  active: boolean;
  /** Render one still frame in the final pose and never animate. */
  reducedMotion: boolean;
  /** Called once, after the first frame has been drawn. */
  onReady?: () => void;
  /** Called if the browser takes the WebGL context away. */
  onContextLost?: () => void;
}

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/** Materials are created once and shared by every mesh, then disposed on unmount. */
function useSceneMaterials(): SceneMaterials {
  const materials = useMemo<SceneMaterials>(
    () => ({
      ivory: new MeshPhysicalMaterial({
        color: PALETTE.ivory,
        roughness: 0.46,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.5,
        sheen: 0.5,
        sheenRoughness: 0.6,
        sheenColor: "#ffe6cf",
      }),
      ivoryLight: new MeshPhysicalMaterial({
        color: PALETTE.ivoryLight,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.35,
        clearcoatRoughness: 0.45,
      }),
      clay: new MeshPhysicalMaterial({
        color: PALETTE.clay,
        roughness: 0.52,
        metalness: 0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.55,
      }),
      ink: new MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.45, metalness: 0 }),
      chipSide: new MeshStandardMaterial({ color: PALETTE.chipEdge, roughness: 0.7, metalness: 0 }),
    }),
    [],
  );

  useEffect(
    () => () => {
      for (const material of Object.values(materials)) material.dispose();
    },
    [materials],
  );

  return materials;
}

/** Key, warm rim and soft fill, plus a tiny procedural environment for the clearcoat. */
function Lighting() {
  const { hemisphere, key, rim, fill, env } = LIGHTS;
  return (
    <>
      <hemisphereLight args={[hemisphere.sky, hemisphere.ground, hemisphere.intensity]} />
      <directionalLight
        position={key.position}
        color={key.color}
        intensity={key.intensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={5}
      >
        <orthographicCamera attach="shadow-camera" args={[-3.4, 3.4, 3.4, -3.4, 0.5, 22]} />
      </directionalLight>
      <directionalLight position={rim.position} color={rim.color} intensity={rim.intensity} />
      <directionalLight position={fill.position} color={fill.color} intensity={fill.intensity} />

      {/* Children only: rendered once into a small cube map. No preset, no files, no network. */}
      <Environment resolution={128} frames={1}>
        <mesh scale={30}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color={env.dome} side={BackSide} toneMapped={false} />
        </mesh>
        <Lightformer
          form="rect"
          position={env.key.position}
          scale={env.key.scale}
          color={env.key.color}
          intensity={env.key.intensity}
        />
        <Lightformer
          form="rect"
          position={env.rim.position}
          scale={env.rim.scale}
          color={env.rim.color}
          intensity={env.rim.intensity}
        />
        <Lightformer
          form="rect"
          position={env.fill.position}
          scale={env.fill.scale}
          color={env.fill.color}
          intensity={env.fill.intensity}
        />
      </Environment>
    </>
  );
}

/**
 * Owns all group-level motion: responsive fit, entrance, idle drift, pointer
 * parallax and the scroll response. Under reduced motion it does nothing and
 * the composition simply sits in its final pose.
 */
function Rig({
  reducedMotion,
  onReady,
  children,
  ground,
}: {
  reducedMotion: boolean;
  onReady?: () => void;
  children: ReactNode;
  ground: ReactNode;
}) {
  const sway = useRef<Group>(null);
  const time = useRef(0);
  const announced = useRef(false);
  const pointer = useParallax({ disabled: reducedMotion });
  const viewport = useThree((state) => state.viewport);
  const invalidate = useThree((state) => state.invalidate);
  const fit = Math.min(viewport.width, viewport.height) / DESIGN_SIZE;

  const motion = useMemo<SceneMotion>(() => ({ reducedMotion, time }), [reducedMotion]);

  // With frameloop="demand" nothing draws until something asks for a frame.
  useEffect(() => {
    invalidate();
    const id = window.setTimeout(() => invalidate(), 120);
    return () => window.clearTimeout(id);
  }, [invalidate, reducedMotion, fit]);

  useFrame((_, delta) => {
    if (!announced.current) {
      announced.current = true;
      onReady?.();
    }
    const group = sway.current;
    if (!group || reducedMotion) return;

    // Clamp so a paused loop (off-screen, hidden tab) resumes without a jump.
    const dt = Math.min(delta, 0.05);
    time.current += dt;
    const t = time.current;

    const enter = easeOutCubic(t / MOTION.entrance);
    const scroll = MathUtils.clamp(window.scrollY / (window.innerHeight || 1), 0, 1);

    group.position.y =
      (1 - enter) * -0.35 + Math.sin(t * 0.6) * MOTION.floatY + scroll * MOTION.scrollLift;
    group.scale.setScalar(0.94 + 0.06 * enter);

    const targetY = pointer.current.x * MOTION.parallaxY + Math.sin(t * 0.25) * MOTION.swayY;
    const targetX = pointer.current.y * MOTION.parallaxX + scroll * MOTION.scrollTilt;
    group.rotation.y = MathUtils.damp(group.rotation.y, targetY, MOTION.damping, dt);
    group.rotation.x = MathUtils.damp(group.rotation.x, targetX, MOTION.damping, dt);
  });

  return (
    <SceneMotionContext.Provider value={motion}>
      <group scale={fit}>
        {ground}
        <group ref={sway}>{children}</group>
      </group>
    </SceneMotionContext.Provider>
  );
}

function Composition({ reducedMotion, onReady }: { reducedMotion: boolean; onReady?: () => void }) {
  const materials = useSceneMaterials();
  return (
    <>
      <Lighting />
      <Rig reducedMotion={reducedMotion} onReady={onReady} ground={<GroundShadow />}>
        <Hand
          material={materials.ivory}
          position={HAND_POSE.position}
          rotation={HAND_POSE.rotation}
          scale={HAND_POSE.scale}
        />
        <Ribbons materials={materials} />
        <Solids materials={materials} />
        <Chips materials={materials} />
      </Rig>
    </>
  );
}

export default function HeroScene({ active, reducedMotion, onReady, onContextLost }: HeroSceneProps) {
  const lostHandler = useRef(onContextLost);
  useEffect(() => {
    lostHandler.current = onContextLost;
  }, [onContextLost]);

  return (
    <Canvas
      // The artwork is decorative: no pointer events reach the canvas, so it
      // can never capture a touch or block page scrolling.
      style={{ pointerEvents: "none", touchAction: "auto" }}
      aria-hidden="true"
      tabIndex={-1}
      frameloop={active && !reducedMotion ? "always" : "demand"}
      dpr={[1, 1.5]}
      shadows="percentage"
      gl={{ antialias: true, alpha: true, powerPreference: "default" }}
      camera={{
        fov: CAMERA.fov,
        near: CAMERA.near,
        far: CAMERA.far,
        position: CAMERA.position,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1;
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            lostHandler.current?.();
          },
          { once: true },
        );
      }}
    >
      <Composition reducedMotion={reducedMotion} onReady={onReady} />
    </Canvas>
  );
}
