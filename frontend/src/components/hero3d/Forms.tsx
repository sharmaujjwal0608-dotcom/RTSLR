"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import type { Group, Material } from "three";
import {
  CHIP_SIZE,
  CHIPS,
  GROUND_SHADOW,
  PALETTE,
  RIBBONS,
  SOLIDS,
  type ChipSymbol,
  type Vec3,
} from "./config";

/* -------------------------------------------------------------------------- */
/* Shared scene state                                                         */
/* -------------------------------------------------------------------------- */

export interface SceneMotion {
  /** No animation at all: everything sits in its final pose. */
  reducedMotion: boolean;
  /** Seconds of animation played so far (pauses with the render loop). */
  time: RefObject<number>;
}

export const SceneMotionContext = createContext<SceneMotion | null>(null);

function useSceneMotion(): SceneMotion {
  const value = useContext(SceneMotionContext);
  if (!value) throw new Error("hero3d: SceneMotionContext is missing");
  return value;
}

export interface SceneMaterials {
  ivory: Material;
  ivoryLight: Material;
  clay: Material;
  ink: Material;
  chipSide: Material;
}

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/* -------------------------------------------------------------------------- */
/* Floater: idle drift plus a staggered entrance for one piece                */
/* -------------------------------------------------------------------------- */

interface FloaterProps {
  position: Vec3;
  /** Phase offset so pieces do not move in unison. */
  phase?: number;
  /** Vertical drift in world units. */
  amplitude?: number;
  /** Entrance delay in seconds. */
  delay?: number;
  /** Slow continuous turn about Y (radians per second). */
  spin?: number;
  children: ReactNode;
}

export function Floater({
  position,
  phase = 0,
  amplitude = 0.06,
  delay = 0,
  spin = 0,
  children,
}: FloaterProps) {
  const ref = useRef<Group>(null);
  const { reducedMotion, time } = useSceneMotion();
  const [x, y, z] = position;

  useFrame(() => {
    const group = ref.current;
    if (!group || reducedMotion) return;
    const t = time.current;
    const enter = easeOutCubic((t - delay) / 0.9);
    group.scale.setScalar(Math.max(0.0001, enter));
    group.position.set(x, y + Math.sin(t * 0.7 + phase) * amplitude, z);
    group.rotation.z = Math.sin(t * 0.45 + phase * 1.7) * 0.05;
    if (spin !== 0) group.rotation.y = t * spin;
  });

  return (
    <group ref={ref} position={position} scale={reducedMotion ? 1 : 0.0001}>
      {children}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Ribbons                                                                    */
/* -------------------------------------------------------------------------- */

function Ribbon({
  points,
  radius,
  material,
}: {
  points: Vec3[];
  radius: number;
  material: Material;
}) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      points.map(([px, py, pz]) => new Vector3(px, py, pz)),
      false,
      "centripetal",
    );
    return new TubeGeometry(curve, 180, radius, 12, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <group>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      {/* Rounded ends */}
      {[first, last].map((point, index) =>
        point ? (
          <mesh key={index} position={point} material={material}>
            <sphereGeometry args={[radius, 12, 8]} />
          </mesh>
        ) : null,
      )}
    </group>
  );
}

export function Ribbons({ materials }: { materials: SceneMaterials }) {
  return (
    <>
      {RIBBONS.map((ribbon, index) => (
        <Ribbon
          key={index}
          points={ribbon.points}
          radius={ribbon.radius}
          material={ribbon.tone === "clay" ? materials.clay : materials.ivoryLight}
        />
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Floating solids                                                            */
/* -------------------------------------------------------------------------- */

export function Solids({ materials }: { materials: SceneMaterials }) {
  const { claySphere, torus, inkBox, inkDot, clayDot } = SOLIDS;
  return (
    <>
      <Floater position={claySphere.position} phase={0.4} delay={0.35}>
        <mesh material={materials.clay} castShadow>
          <sphereGeometry args={[claySphere.radius, 40, 28]} />
        </mesh>
      </Floater>

      <Floater position={torus.position} phase={2.1} delay={0.5} amplitude={0.08}>
        <mesh rotation={[1.05, 0.5, 0.2]} material={materials.ivory} castShadow>
          <torusGeometry args={[torus.radius, torus.tube, 24, 64]} />
        </mesh>
      </Floater>

      <Floater position={inkBox.position} phase={3.6} delay={0.65} amplitude={0.05}>
        <RoundedBox
          args={[inkBox.size, inkBox.size, inkBox.size]}
          radius={inkBox.size * 0.24}
          smoothness={5}
          rotation={[0.5, 0.6, 0.3]}
          material={materials.ink}
        />
      </Floater>

      <Floater position={inkDot.position} phase={5.0} delay={0.8} amplitude={0.04}>
        <mesh material={materials.ink}>
          <sphereGeometry args={[inkDot.radius, 24, 16]} />
        </mesh>
      </Floater>

      <Floater position={clayDot.position} phase={1.3} delay={0.9} amplitude={0.05}>
        <mesh material={materials.clay}>
          <sphereGeometry args={[clayDot.radius, 24, 16]} />
        </mesh>
      </Floater>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Interface symbol chips                                                     */
/* -------------------------------------------------------------------------- */

const CHIP_TEXTURE_SIZE = 256;
/** Symbols are drawn in the same 66-unit box as the SVG fallback. */
const SYMBOL_BOX = 66;

function drawSymbol(context: CanvasRenderingContext2D, symbol: ChipSymbol, fontFamily: string) {
  const ink = "#101010";
  const clay = PALETTE.clay;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (symbol === "bubble") {
    context.strokeStyle = ink;
    context.lineWidth = 3.2;
    context.beginPath();
    context.moveTo(-9, -15);
    context.lineTo(9, -15);
    context.arcTo(17, -15, 17, -7, 8);
    context.lineTo(17, 1);
    context.arcTo(17, 9, 9, 9, 8);
    context.lineTo(-3, 9);
    context.lineTo(-11, 17);
    context.lineTo(-11, 9);
    context.arcTo(-17, 9, -17, 1, 6);
    context.lineTo(-17, -7);
    context.arcTo(-17, -15, -9, -15, 8);
    context.closePath();
    context.stroke();
    context.fillStyle = clay;
    for (const dotX of [-7.5, 0, 7.5]) {
      context.beginPath();
      context.arc(dotX, -3, 2.2, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }

  if (symbol === "wave") {
    const bars: [number, number, string][] = [
      [-16, 5, ink],
      [-8, 11, ink],
      [0, 16, clay],
      [8, 9, ink],
      [16, 4, ink],
    ];
    context.lineWidth = 4.4;
    for (const [barX, half, colour] of bars) {
      context.strokeStyle = colour;
      context.beginPath();
      context.moveTo(barX, -half);
      context.lineTo(barX, half);
      context.stroke();
    }
    return;
  }

  // "text": two letters and a cursor. Uses a font that is already on the
  // page (the document's own font stack); nothing is fetched.
  context.fillStyle = ink;
  context.font = `700 25px ${fontFamily}`;
  context.textBaseline = "alphabetic";
  context.fillText("Aa", -22, 9);
  context.strokeStyle = clay;
  context.lineWidth = 3.4;
  context.beginPath();
  context.moveTo(19, -13);
  context.lineTo(19, 13);
  context.stroke();
}

function createChipTexture(symbol: ChipSymbol): CanvasTexture | null {
  const canvas = document.createElement("canvas");
  canvas.width = CHIP_TEXTURE_SIZE;
  canvas.height = CHIP_TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const fontFamily = window.getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  context.fillStyle = PALETTE.surface;
  context.fillRect(0, 0, CHIP_TEXTURE_SIZE, CHIP_TEXTURE_SIZE);
  context.translate(CHIP_TEXTURE_SIZE / 2, CHIP_TEXTURE_SIZE / 2);
  const scale = CHIP_TEXTURE_SIZE / SYMBOL_BOX;
  context.scale(scale, scale);
  drawSymbol(context, symbol, fontFamily);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A thin rounded plate whose front face is mapped 0…1 across its width and height. */
function createChipGeometry(size: number): ExtrudeGeometry {
  const bevel = size * 0.02;
  const half = size / 2 - bevel;
  const corner = size * 0.24;
  const shape = new Shape();
  shape.moveTo(-half + corner, -half);
  shape.lineTo(half - corner, -half);
  shape.quadraticCurveTo(half, -half, half, -half + corner);
  shape.lineTo(half, half - corner);
  shape.quadraticCurveTo(half, half, half - corner, half);
  shape.lineTo(-half + corner, half);
  shape.quadraticCurveTo(-half, half, -half, half - corner);
  shape.lineTo(-half, -half + corner);
  shape.quadraticCurveTo(-half, -half, -half + corner, -half);

  const depth = size * 0.06;
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);

  const position = geometry.getAttribute("position") as BufferAttribute;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = position.getX(i) / size + 0.5;
    uv[i * 2 + 1] = position.getY(i) / size + 0.5;
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  return geometry;
}

function Chip({ symbol, sideMaterial }: { symbol: ChipSymbol; sideMaterial: Material }) {
  const geometry = useMemo(() => createChipGeometry(CHIP_SIZE), []);
  const texture = useMemo(() => createChipTexture(symbol), [symbol]);
  useEffect(
    () => () => {
      geometry.dispose();
      texture?.dispose();
    },
    [geometry, texture],
  );

  return (
    <mesh geometry={geometry} castShadow>
      {/* ExtrudeGeometry groups: 0 = front and back faces, 1 = edge. */}
      <meshStandardMaterial
        attach="material-0"
        map={texture}
        // A little self-illumination keeps the plate white (and the symbol
        // dark) even where the key light does not reach it.
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0.5}
        roughness={0.55}
        metalness={0}
      />
      <primitive object={sideMaterial} attach="material-1" />
    </mesh>
  );
}

export function Chips({ materials }: { materials: SceneMaterials }) {
  return (
    <>
      {CHIPS.map((chip, index) => (
        <Floater
          key={chip.symbol}
          position={chip.position}
          phase={index * 2.2 + 0.9}
          delay={0.55 + index * 0.14}
          amplitude={0.07}
        >
          <group rotation={chip.rotation}>
            <Chip symbol={chip.symbol} sideMaterial={materials.chipSide} />
          </group>
        </Floater>
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Ground shadow                                                              */
/* -------------------------------------------------------------------------- */

function createShadowTexture(): CanvasTexture | null {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${PALETTE.shadow}, 1)`);
  gradient.addColorStop(0.35, `rgba(${PALETTE.shadow}, 0.55)`);
  gradient.addColorStop(0.7, `rgba(${PALETTE.shadow}, 0.14)`);
  gradient.addColorStop(1, `rgba(${PALETTE.shadow}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Baked ambient shadow: a soft radial gradient on a plane tilted toward the
 * camera. Cheaper and more predictable than a rendered contact shadow, and it
 * needs no extra render pass.
 */
export function GroundShadow() {
  const texture = useMemo(() => createShadowTexture(), []);
  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <mesh
      position={[0, GROUND_SHADOW.y, 0]}
      rotation={[-Math.PI / 2 + 0.35, 0, 0]}
      renderOrder={-1}
    >
      <planeGeometry args={[GROUND_SHADOW.width, GROUND_SHADOW.depth]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={GROUND_SHADOW.opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
