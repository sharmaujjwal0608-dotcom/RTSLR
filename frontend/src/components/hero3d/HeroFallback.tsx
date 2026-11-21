import { useId } from "react";

/**
 * Static illustration of the hero composition: the same arrangement and
 * palette as the 3D scene, drawn as inline SVG. It is shown while the 3D
 * chunk loads, on small / low-power devices, and whenever WebGL fails, so it
 * has to stand on its own.
 *
 * The hand is a neutral, relaxed open hand drawn as an art object. It does
 * not form, depict or imply any sign in ISL or any other sign language.
 *
 * Decorative: the caller wraps it in `aria-hidden`.
 */
export function HeroFallback({ className }: { className?: string }) {
  // useId can contain characters that are awkward inside url(#…).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `hero-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg
      className={className}
      viewBox="0 0 600 600"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={id("ivory")} gradientUnits="userSpaceOnUse" x1="170" y1="120" x2="400" y2="480">
          <stop offset="0" stopColor="#fffcf7" />
          <stop offset="0.55" stopColor="#f3e9db" />
          <stop offset="1" stopColor="#dfcfba" />
        </linearGradient>
        <linearGradient id={id("ivory-ribbon")} gradientUnits="userSpaceOnUse" x1="300" y1="70" x2="540" y2="500">
          <stop offset="0" stopColor="#f4eadc" />
          <stop offset="0.5" stopColor="#e2d3be" />
          <stop offset="1" stopColor="#efe4d4" />
        </linearGradient>
        <linearGradient id={id("clay")} gradientUnits="userSpaceOnUse" x1="90" y1="90" x2="470" y2="450">
          <stop offset="0" stopColor="#e9b892" />
          <stop offset="0.5" stopColor="#d79c72" />
          <stop offset="1" stopColor="#c48556" />
        </linearGradient>
        <radialGradient id={id("clay-ball")} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#f0c4a2" />
          <stop offset="0.55" stopColor="#d79c72" />
          <stop offset="1" stopColor="#b97848" />
        </radialGradient>
        <radialGradient id={id("ink-ball")} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#4a4540" />
          <stop offset="1" stopColor="#141312" />
        </radialGradient>
        <radialGradient id={id("ground")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#4a341e" stopOpacity="0.26" />
          <stop offset="0.6" stopColor="#4a341e" stopOpacity="0.08" />
          <stop offset="1" stopColor="#4a341e" stopOpacity="0" />
        </radialGradient>

        {/* Sculpted look: a warm inner shade on the lower right and a soft
            inner highlight on the upper left of whatever shape it is applied to. */}
        <filter
          id={id("sculpt")}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
          <feOffset in="blur" dx="-6" dy="-8" result="shiftedUp" />
          <feComposite in="SourceAlpha" in2="shiftedUp" operator="out" result="shadeMask" />
          <feFlood floodColor="#8a5f3c" floodOpacity="0.42" result="shadeColor" />
          <feComposite in="shadeColor" in2="shadeMask" operator="in" result="shade" />
          <feGaussianBlur in="shade" stdDeviation="1.5" result="shadeSoft" />
          <feComposite in="shadeSoft" in2="SourceAlpha" operator="in" result="shadeClipped" />

          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blurSmall" />
          <feOffset in="blurSmall" dx="4" dy="5" result="shiftedDown" />
          <feComposite in="SourceAlpha" in2="shiftedDown" operator="out" result="lightMask" />
          <feFlood floodColor="#ffffff" floodOpacity="0.85" result="lightColor" />
          <feComposite in="lightColor" in2="lightMask" operator="in" result="light" />

          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shadeClipped" />
            <feMergeNode in="light" />
          </feMerge>
        </filter>

        {/* Warm, low drop shadow for the floating pieces. */}
        <filter
          id={id("float")}
          x="-40%"
          y="-40%"
          width="180%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
          <feOffset in="blur" dy="9" result="offset" />
          <feFlood floodColor="#4a341e" floodOpacity="0.2" result="color" />
          <feComposite in="color" in2="offset" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Wider, softer shadow that grounds the hand. */}
        <filter
          id={id("hand-shadow")}
          x="-40%"
          y="-30%"
          width="180%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="blur" />
          <feOffset in="blur" dx="10" dy="20" result="offset" />
          <feFlood floodColor="#4a341e" floodOpacity="0.22" result="color" />
          <feComposite in="color" in2="offset" operator="in" />
        </filter>
      </defs>

      {/* Ambient shadow under the whole composition */}
      <ellipse cx="300" cy="540" rx="200" ry="26" fill={url("ground")} />

      {/* Ivory ribbon, behind everything */}
      <g strokeLinecap="round">
        <path
          d="M369 501 C430 505 500 470 530 400 C560 320 520 210 440 150 C400 118 350 85 300 72"
          stroke={url("ivory-ribbon")}
          strokeWidth="9"
        />
        <path
          d="M369 501 C430 505 500 470 530 400 C560 320 520 210 440 150 C400 118 350 85 300 72"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="2.5"
          transform="translate(-2 -2)"
        />
        <path
          d="M369 501 C430 505 500 470 530 400 C560 320 520 210 440 150 C400 118 350 85 300 72"
          stroke="#b79d7f"
          strokeOpacity="0.35"
          strokeWidth="2"
          transform="translate(2.5 2.5)"
        />
      </g>

      {/* Clay ribbon: the part that passes behind the hand */}
      <g strokeLinecap="round">
        <path
          d="M465 300 C470 250 400 240 355 245 C250 215 150 220 97 172 C78 150 100 104 124 86"
          stroke={url("clay")}
          strokeWidth="11"
        />
        <path
          d="M465 300 C470 250 400 240 355 245 C250 215 150 220 97 172 C78 150 100 104 124 86"
          stroke="#fff3e6"
          strokeOpacity="0.45"
          strokeWidth="3"
          transform="translate(-2 -3)"
        />
      </g>

      {/* Torus (behind the chip on the right) */}
      <g filter={url("float")}>
        <ellipse
          cx="503"
          cy="217"
          rx="25"
          ry="20"
          transform="rotate(-24 503 217)"
          stroke={url("ivory")}
          strokeWidth="14"
          filter={url("sculpt")}
        />
      </g>

      {/* The hand: a neutral, relaxed open hand. Not a sign. */}
      <g>
        <g filter={url("hand-shadow")} fill="#000" stroke="#000" strokeLinecap="round">
          <HandShapes />
        </g>
        <g
          filter={url("sculpt")}
          fill={url("ivory")}
          stroke={url("ivory")}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <HandShapes />
        </g>
        {/* Quiet modelling lines: finger separations and the base of the thumb */}
        <g stroke="#b79d7f" strokeOpacity="0.4" strokeWidth="1.6" strokeLinecap="round">
          <path d="M262.5 270 L262 252" />
          <path d="M289.5 268 L290 250" />
          <path d="M316 274 L318 258" />
          <path d="M252 362 C262 350 268 334 266 316" />
        </g>
      </g>

      {/* Clay ribbon: the part that sweeps in front of the wrist */}
      <g strokeLinecap="round">
        <path
          d="M91 443 C140 470 190 440 234 416 C300 385 380 400 410 366 C440 340 462 325 465 300"
          stroke="#4a341e"
          strokeOpacity="0.14"
          strokeWidth="11"
          transform="translate(3 9)"
        />
        <path
          d="M91 443 C140 470 190 440 234 416 C300 385 380 400 410 366 C440 340 462 325 465 300"
          stroke={url("clay")}
          strokeWidth="11"
        />
        <path
          d="M91 443 C140 470 190 440 234 416 C300 385 380 400 410 366 C440 340 462 325 465 300"
          stroke="#fff3e6"
          strokeOpacity="0.5"
          strokeWidth="3"
          transform="translate(-1.5 -3)"
        />
      </g>

      {/* Floating solids */}
      <g filter={url("float")}>
        <circle cx="151" cy="368" r="28" fill={url("clay-ball")} />
        <rect
          x="158"
          y="109"
          width="30"
          height="30"
          rx="8"
          transform="rotate(18 173 124)"
          fill={url("ink-ball")}
        />
        <circle cx="200" cy="498" r="7.5" fill={url("ink-ball")} />
        <circle cx="237" cy="64" r="9" fill={url("clay-ball")} />
      </g>

      {/* Interface symbol chips */}
      <g filter={url("float")}>
        {/* Speech bubble */}
        <g transform="translate(450 145) rotate(6)">
          <ChipPlate />
          <path
            d="M-9 -15 H9 A8 8 0 0 1 17 -7 V1 A8 8 0 0 1 9 9 H-3 L-11 17 V9 A8 8 0 0 1 -17 1 V-7 A8 8 0 0 1 -9 -15 Z"
            stroke="#101010"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <circle cx="-7.5" cy="-3" r="2.2" fill="#d79c72" />
          <circle cx="0" cy="-3" r="2.2" fill="#d79c72" />
          <circle cx="7.5" cy="-3" r="2.2" fill="#d79c72" />
        </g>

        {/* Waveform */}
        <g transform="translate(110 283) rotate(-5)">
          <ChipPlate />
          <g stroke="#101010" strokeWidth="4.4" strokeLinecap="round">
            <path d="M-16 -5 V5" />
            <path d="M-8 -11 V11" />
            <path d="M8 -9 V9" />
            <path d="M16 -4 V4" />
          </g>
          <path d="M0 -16 V16" stroke="#d79c72" strokeWidth="4.4" strokeLinecap="round" />
        </g>

        {/* Text with cursor */}
        <g transform="translate(461 444) rotate(-5)">
          <ChipPlate />
          <text
            x="-22"
            y="9"
            fill="#101010"
            fontSize="25"
            fontWeight="700"
            letterSpacing="-0.5"
            style={{ fontFamily: "inherit" }}
          >
            Aa
          </text>
          <path d="M19 -13 V13" stroke="#d79c72" strokeWidth="3.4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/** White rounded plate, 66 × 66, centred on the origin. */
function ChipPlate() {
  return (
    <rect
      x="-33"
      y="-33"
      width="66"
      height="66"
      rx="17"
      fill="#ffffff"
      stroke="#e5ded5"
      strokeWidth="1"
    />
  );
}

/**
 * Palm, wrist, four fingers and thumb as one silhouette. Fingers are thick
 * round-capped strokes with a gentle fan; lengths differ as on a real hand.
 */
function HandShapes() {
  return (
    <>
      {/* Wrist */}
      <path d="M256 378 L259 452 Q290 474 321 452 L324 378 Z" strokeWidth="2" />
      {/* Palm */}
      <path
        d="M241 286 C236 262 258 254 290 254 C322 254 347 264 344 292 L340 338 C338 366 331 382 322 392 L258 392 C246 380 238 354 238 330 Z"
        strokeWidth="2"
      />
      {/* Thumb */}
      <path d="M250 350 Q206 322 181 270" strokeWidth="29" fill="none" />
      {/* Index, middle, ring, little finger */}
      <path d="M249 268 L238 157" strokeWidth="24" fill="none" />
      <path d="M276 262 L274 143" strokeWidth="25" fill="none" />
      <path d="M303 266 L311 158" strokeWidth="23" fill="none" />
      <path d="M328 280 L344 201" strokeWidth="20" fill="none" />
    </>
  );
}
