"use client";

type SVGProps = {
  color?: string;
  className?: string;
};

/**
 * Star Stretch — feet apart, both arms diagonally up and out.
 * Used when the target pose is "star".
 */
export function StarStretchSVG({
  color = "#20213F",
  className = "",
}: SVGProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      stroke={color}
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Star Stretch pose"
    >
      {/* Head */}
      <circle cx="100" cy="42" r="17" />
      {/* Torso */}
      <line x1="100" y1="59" x2="100" y2="120" />
      {/* Left arm — diagonal up-out */}
      <line x1="100" y1="80" x2="45" y2="48" />
      {/* Right arm — diagonal up-out */}
      <line x1="100" y1="80" x2="155" y2="48" />
      {/* Left leg — angled out */}
      <line x1="100" y1="120" x2="62" y2="182" />
      {/* Right leg — angled out */}
      <line x1="100" y1="120" x2="138" y2="182" />
      {/* Hands */}
      <circle cx="45" cy="48" r="4" fill={color} />
      <circle cx="155" cy="48" r="4" fill={color} />
      {/* Feet */}
      <circle cx="62" cy="182" r="4" fill={color} />
      <circle cx="138" cy="182" r="4" fill={color} />
    </svg>
  );
}

/**
 * Side Stretch — one arm raised overhead, upper body leaning sideways.
 * Used when the target pose is "side".
 */
export function SideStretchSVG({
  color = "#20213F",
  className = "",
}: SVGProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      stroke={color}
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Side Stretch pose"
    >
      {/* Head — tilted slightly to the raised-arm side */}
      <circle cx="115" cy="45" r="17" />
      {/* Torso — leaning to the right */}
      <line x1="115" y1="62" x2="105" y2="120" />
      {/* Raised arm (right side) — over the head */}
      <line x1="115" y1="78" x2="150" y2="28" />
      {/* Lower arm (left side) — extended down-out */}
      <line x1="115" y1="78" x2="68" y2="108" />
      {/* Left leg */}
      <line x1="105" y1="120" x2="92" y2="182" />
      {/* Right leg */}
      <line x1="105" y1="120" x2="125" y2="182" />
      {/* Raised hand */}
      <circle cx="150" cy="28" r="4" fill={color} />
      {/* Lower hand */}
      <circle cx="68" cy="108" r="4" fill={color} />
      {/* Feet */}
      <circle cx="92" cy="182" r="4" fill={color} />
      <circle cx="125" cy="182" r="4" fill={color} />
    </svg>
  );
}

/**
 * Standing Reach — upright body, both arms straight up.
 * Used when the target pose is "reach".
 */
export function StandingReachSVG({
  color = "#20213F",
  className = "",
}: SVGProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      stroke={color}
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Standing Reach pose"
    >
      {/* Head */}
      <circle cx="100" cy="58" r="17" />
      {/* Torso */}
      <line x1="100" y1="75" x2="100" y2="130" />
      {/* Left arm — straight up */}
      <line x1="100" y1="92" x2="72" y2="32" />
      {/* Right arm — straight up */}
      <line x1="100" y1="92" x2="128" y2="32" />
      {/* Left leg */}
      <line x1="100" y1="130" x2="88" y2="186" />
      {/* Right leg */}
      <line x1="100" y1="130" x2="112" y2="186" />
      {/* Hands */}
      <circle cx="72" cy="32" r="4" fill={color} />
      <circle cx="128" cy="32" r="4" fill={color} />
      {/* Feet */}
      <circle cx="88" cy="186" r="4" fill={color} />
      <circle cx="112" cy="186" r="4" fill={color} />
    </svg>
  );
}