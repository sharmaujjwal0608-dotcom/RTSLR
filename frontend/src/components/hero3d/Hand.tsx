"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, SphereGeometry } from "three";
import type { BufferGeometry, Material } from "three";
import type { Vec3 } from "./config";

/**
 * Procedural sculptural hand.
 *
 * IMPORTANT: this is a neutral, relaxed open hand modelled as an art object.
 * It does not form, depict or imply any sign in Indian Sign Language or any
 * other sign language, and it must stay that way: the finger angles below are
 * a resting pose (a slight natural curl that increases toward the little
 * finger), not a handshape taken from any sign. Do not animate individual
 * fingers and do not re-pose the hand into a recognisable gesture.
 *
 * Local frame: fingers point along +Y, the palm faces +Z, the thumb is on -X.
 * One unit is roughly the width of the palm. Positive curl bends toward +Z.
 */

interface FingerSpec {
  /** Knuckle position on the palm. */
  base: Vec3;
  /** Fan in the palm plane (radians, positive leans toward the thumb side). */
  splay: number;
  /** Forward lean of the whole finger (radians). Used by the thumb. */
  lean?: number;
  /** Rotation about the finger's own axis, which turns the plane it curls in. */
  twist?: number;
  /** Phalanx lengths, knuckle to tip. */
  lengths: [number, number, number];
  /** Radii at the knuckle, the two joints and the tip (gentle taper). */
  radii: [number, number, number, number];
  /** Curl at each joint (radians). */
  curls: [number, number, number];
}

const FINGERS: FingerSpec[] = [
  // Index
  {
    base: [-0.355, 0.5, 0],
    splay: 0.1,
    lengths: [0.46, 0.29, 0.24],
    radii: [0.112, 0.102, 0.093, 0.084],
    curls: [0.14, 0.22, 0.16],
  },
  // Middle
  {
    base: [-0.12, 0.55, 0],
    splay: 0.02,
    lengths: [0.5, 0.33, 0.25],
    radii: [0.115, 0.105, 0.096, 0.086],
    curls: [0.2, 0.28, 0.2],
  },
  // Ring
  {
    base: [0.115, 0.51, 0],
    splay: -0.08,
    lengths: [0.46, 0.3, 0.24],
    radii: [0.108, 0.099, 0.09, 0.081],
    curls: [0.26, 0.34, 0.22],
  },
  // Little finger
  {
    base: [0.33, 0.4, 0],
    splay: -0.2,
    lengths: [0.36, 0.22, 0.2],
    radii: [0.094, 0.086, 0.078, 0.07],
    curls: [0.32, 0.38, 0.24],
  },
  // Thumb: starts inside the heel of the palm and rests out to the side.
  {
    base: [-0.36, -0.24, 0.05],
    splay: 0.72,
    lean: 0.25,
    twist: 0.7,
    lengths: [0.36, 0.32, 0.27],
    radii: [0.15, 0.125, 0.108, 0.092],
    curls: [0, 0.22, 0.2],
  },
];

const PALM = { halfWidth: 0.49, halfHeight: 0.56, halfDepth: 0.15 };

/** Signed power: keeps the sign of the base, used by the superellipsoid. */
function spow(value: number, exponent: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The palm is a superellipsoid (a soft rounded slab) that narrows toward the
 * wrist, slopes down toward the little finger, and carries a low pad at the
 * base of the thumb and a shallow hollow in the centre.
 */
function createPalmGeometry(): BufferGeometry {
  const widthSegments = 64;
  const heightSegments = 40;
  const geometry = new SphereGeometry(1, widthSegments, heightSegments);
  const position = geometry.getAttribute("position") as BufferAttribute;
  const { halfWidth, halfHeight, halfDepth } = PALM;
  const outline = 0.45; // lower = squarer front silhouette
  const section = 0.62; // lower = squarer cross-section

  for (let i = 0; i < position.count; i += 1) {
    const ux = position.getX(i);
    const uy = position.getY(i);
    const uz = position.getZ(i);
    const latitude = Math.asin(Math.min(1, Math.max(-1, uy)));
    const longitude = Math.atan2(uz, ux);
    const ring = spow(Math.cos(latitude), outline);

    let x = halfWidth * ring * spow(Math.cos(longitude), section);
    let y = halfHeight * spow(Math.sin(latitude), outline);
    let z = halfDepth * ring * spow(Math.sin(longitude), section);

    // Narrower at the wrist.
    x *= 0.74 + 0.26 * smoothstep(-halfHeight, halfHeight * 0.4, y);
    // The knuckle line drops toward the little finger.
    if (y > 0) y *= 1 - 0.16 * Math.max(0, x / halfWidth);
    if (z > 0) {
      const front = z / halfDepth;
      // Pad at the base of the thumb.
      z += 0.07 * front * Math.exp(-(((x + 0.22) ** 2) / 0.035 + ((y + 0.2) ** 2) / 0.07));
      // Shallow hollow in the centre of the palm.
      z -= 0.035 * front * Math.exp(-((x - 0.04) ** 2 + (y - 0.02) ** 2) / 0.05);
    }
    position.setXYZ(i, x, y, z);
  }

  geometry.computeVertexNormals();

  // SphereGeometry duplicates the first column of vertices as the last one
  // (the UV seam). Average their normals so the seam does not show.
  const normal = geometry.getAttribute("normal") as BufferAttribute;
  const columns = widthSegments + 1;
  for (let row = 0; row <= heightSegments; row += 1) {
    const a = row * columns;
    const b = a + widthSegments;
    const nx = normal.getX(a) + normal.getX(b);
    const ny = normal.getY(a) + normal.getY(b);
    const nz = normal.getZ(a) + normal.getZ(b);
    const length = Math.hypot(nx, ny, nz) || 1;
    normal.setXYZ(a, nx / length, ny / length, nz / length);
    normal.setXYZ(b, nx / length, ny / length, nz / length);
  }
  // The two poles sit under the middle knuckle and inside the wrist.
  for (let column = 0; column < columns; column += 1) {
    normal.setXYZ(column, 0, 1, 0);
    normal.setXYZ(heightSegments * columns + column, 0, -1, 0);
  }
  normal.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

interface PartProps {
  material: Material;
}

function Joint({ radius, material }: PartProps & { radius: number }) {
  return (
    <mesh material={material} castShadow receiveShadow>
      <sphereGeometry args={[radius, 20, 14]} />
    </mesh>
  );
}

function Phalanx({
  length,
  radiusBottom,
  radiusTop,
  material,
}: PartProps & { length: number; radiusBottom: number; radiusTop: number }) {
  return (
    <mesh position={[0, length / 2, 0]} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[radiusTop, radiusBottom, length, 22, 1, true]} />
    </mesh>
  );
}

function Finger({ spec, material }: PartProps & { spec: FingerSpec }) {
  const [l1, l2, l3] = spec.lengths;
  const [r0, r1, r2, r3] = spec.radii;
  const [c1, c2, c3] = spec.curls;

  return (
    <group position={spec.base} rotation={[spec.lean ?? 0, 0, spec.splay]}>
      <group rotation={[0, spec.twist ?? 0, 0]}>
        <group rotation={[c1, 0, 0]}>
          <Joint radius={r0 * 1.04} material={material} />
          <Phalanx length={l1} radiusBottom={r0} radiusTop={r1} material={material} />
          <group position={[0, l1, 0]} rotation={[c2, 0, 0]}>
            <Joint radius={r1} material={material} />
            <Phalanx length={l2} radiusBottom={r1} radiusTop={r2} material={material} />
            <group position={[0, l2, 0]} rotation={[c3, 0, 0]}>
              <Joint radius={r2} material={material} />
              <Phalanx length={l3} radiusBottom={r2} radiusTop={r3} material={material} />
              {/* Fingertip: slightly elongated so it reads as a pad, not a ball. */}
              <mesh
                position={[0, l3, 0]}
                scale={[1, 1.2, 1]}
                material={material}
                castShadow
                receiveShadow
              >
                <sphereGeometry args={[r3, 20, 14]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export interface HandProps {
  material: Material;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
}

export function Hand({ material, position, rotation, scale = 1 }: HandProps) {
  const palm = useMemo(() => createPalmGeometry(), []);
  useEffect(() => () => palm.dispose(), [palm]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={palm} material={material} castShadow receiveShadow />

      {FINGERS.map((spec, index) => (
        <Finger key={index} spec={spec} material={material} />
      ))}

      {/* Wrist: a short flattened column with a soft rounded end. */}
      <group scale={[1, 1, 0.5]}>
        <mesh position={[0.005, -0.78, 0]} material={material} castShadow receiveShadow>
          <cylinderGeometry args={[0.32, 0.285, 0.72, 32, 1, true]} />
        </mesh>
        <mesh
          position={[0.005, -1.14, 0]}
          scale={[1, 0.42, 1]}
          material={material}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.285, 32, 16]} />
        </mesh>
      </group>
    </group>
  );
}
