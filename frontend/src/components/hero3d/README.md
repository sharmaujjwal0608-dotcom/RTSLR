# hero3d — Home hero artwork

An ivory hand sculpture with two ribbons, floating solids and three interface-symbol chips, on the cream page.
Built with `three`, `@react-three/fiber` and `@react-three/drei`. Everything is procedural: no model files, no
HDR, no fonts or textures fetched at run time.

**The hand is a neutral, relaxed open hand modelled as an art object. It does not form, depict or imply any sign
in ISL or any other sign language.** Keep it that way: do not animate individual fingers and do not re-pose it
into a recognisable gesture (see the comment at the top of `Hand.tsx`).

## Use

```tsx
import { HeroArtwork } from "@/components/hero3d";

<div className="aspect-square w-full">
  <HeroArtwork />
</div>
```

`HeroArtwork` has no required props and fills its parent's box (`h-full w-full`), so **the parent must have a
size**. The composition is fitted "contain" inside the box, so any aspect ratio works; square or slightly
portrait uses the space best.

| Prop | Default | Meaning |
| --- | --- | --- |
| `className` | – | Layout classes for the outer box |
| `mode` | `"auto"` | `"auto"`: 3D where allowed, otherwise the illustration. `"static"`: always the illustration |

It is decorative: `aria-hidden`, nothing focusable, `pointer-events: none` on the whole box (it cannot capture a
touch or block scrolling, and it is safe to let it overlap the headline column).

Also exported: `HeroFallback`, `usePrefersReducedMotion`, `useParallax`, `useMediaQuery`, `useInView`,
`usePageVisible`, `useHero3DCapable`, `canUseWebGL`.

## Files

| File | Role |
| --- | --- |
| `index.ts` | Public exports |
| `HeroArtwork.tsx` | Client wrapper: fallback first, capability rule, lazy 3D chunk, error boundary, cross-fade |
| `HeroFallback.tsx` | Inline SVG illustration of the same composition (no client JS needed) |
| `HeroScene.tsx` | `<Canvas>`, lights, procedural environment, materials, `Rig` (all group motion) |
| `Hand.tsx` | Procedural hand: superellipsoid palm, tapered phalanges, sphere joints, wrist |
| `Forms.tsx` | Ribbons, floating solids, symbol chips (canvas textures), baked ground shadow, `Floater` |
| `hooks.ts` | Motion and capability hooks |
| `config.ts` | **All tuning constants** |

## Fallback rules

The SVG illustration is always rendered first, on the server and on the client, so there is no layout shift and
no blank flash. The 3D canvas mounts on top and fades in after its first frame; the SVG then fades out.

The 3D scene is used only when **all** of these hold (`useHero3DCapable` in `hooks.ts`):

1. viewport width is at least 768px;
2. a WebGL2 context can be created;
3. the browser is not in data-saver mode (`navigator.connection.saveData`);
4. the device reports more than 2 logical cores;
5. it is not a coarse-pointer (touch) device with 4 or fewer cores or 4 GB or less of memory;
6. the artwork has come within 200px of the viewport (the chunk is not requested before that).

Otherwise the SVG stays. The SVG also stays, or comes back, when:

- the 3D chunk is still loading;
- the scene throws while rendering or the context cannot be created (`SceneBoundary`);
- the browser reports `webglcontextlost`.

**Reduced motion:** the 3D scene is still used, but as one still frame: `frameloop="demand"`, final pose, no
entrance, no drift, no pointer or scroll response, no listeners. (The SVG would also have been acceptable; the
still 3D frame was chosen so the page looks the same with and without the preference.)

## Performance

- three.js and the scene are a separate chunk (`next/dynamic`, `ssr: false`).
- `dpr` is capped at 1.5.
- The render loop runs only while the artwork is in view and the tab is visible; otherwise the canvas is on
  demand and draws nothing.
- One 1024px shadow map (key light), one 128px environment cube rendered once, three 256px chip textures.
- Roughly 30k triangles in total.
- Geometries, textures and materials created by hand are disposed on unmount; the rest is disposed by R3F.

## Tuning (`config.ts`)

| Want | Change |
| --- | --- |
| Brighter / darker overall | `LIGHTS.hemisphere.intensity`, `LIGHTS.env.dome` (ambient level), `LIGHTS.key.intensity` |
| More modelling on the hand | lower `hemisphere.intensity` and `env.dome`, raise `key.intensity` |
| Warmer / cooler edge light | `LIGHTS.rim.color`, `LIGHTS.env.rim.color` |
| Ivory tone | `PALETTE.ivory`; surface finish in `useSceneMaterials` (`HeroScene.tsx`) |
| More margin around the artwork | raise `DESIGN_SIZE` |
| Hand size / angle | `HAND_POSE` |
| Ribbon paths | `RIBBONS[].points` (Catmull-Rom control points, world units) |
| Solids and chips | `SOLIDS`, `CHIPS`, `CHIP_SIZE` |
| Calmer / livelier motion | `MOTION` (amplitudes in world units and radians) |
| Shadow under the piece | `GROUND_SHADOW` |

Finger proportions and the resting curl are in `FINGERS` in `Hand.tsx`. If you move anything in the 3D
composition, move the same piece in `HeroFallback.tsx` so the cross-fade stays quiet (1 world unit is about
113 SVG units; SVG centre is 300,300; Y is flipped).

Tone mapping is `NeutralToneMapping` (set in `onCreated`), which keeps the ivory and clay close to their token
colours. Colours in `PALETTE` mirror the tokens in `src/app/globals.css`.

## Swapping in a real GLB later

1. Put the file in `frontend/public/images/hero/hand.glb` (self-hosted; no CDN). Use a model that is licensed
   for this use and that is a neutral open hand, not a sign.
2. In a new `HandModel.tsx`:

   ```tsx
   import { useGLTF } from "@react-three/drei";
   import type { Material, Mesh } from "three";

   export function HandModel({ material }: { material: Material }) {
     const { nodes } = useGLTF("/images/hero/hand.glb"); // no Draco/Meshopt decoder: those are fetched from a CDN
     const mesh = nodes.Hand as Mesh;
     return <mesh geometry={mesh.geometry} material={material} castShadow receiveShadow />;
   }
   ```

   Export the GLB uncompressed (or bundle a local decoder) because drei's default Draco decoder path is a CDN,
   which the project's no-third-party-requests rule forbids.
3. In `HeroScene.tsx` replace `<Hand … />` with `<HandModel … />` inside a `<Suspense fallback={null}>`, keep
   the shared ivory material, and adjust `HAND_POSE` until the model is about 3.5 units tall.
4. `HeroArtwork` already keeps the SVG visible until the first frame, so no other change is needed.
5. Redraw the hand in `HeroFallback.tsx` to match.
