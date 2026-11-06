import { useId } from "react";
import type { Scene as SceneT } from "../types";
import { cx } from "../lib/util";

/**
 * Procedural illustrated landscape used in place of photos, so the app works
 * offline and without image licensing. Swap for real imagery when a CDN exists.
 */
export function Scene({ scene, className, seed = 0 }: { scene: SceneT; className?: string; seed?: number }) {
  const id = useId().replace(/:/g, "");
  const [skyTop, skyBottom, far, near] = scene.palette;
  const j = (n: number) => ((seed * 37 + n * 13) % 20) - 10; // small deterministic jitter

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={cx("block h-full w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id={`fade${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={near} stopOpacity="0" />
          <stop offset="1" stopColor={near} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#sky${id})`} />
      <circle cx={300 + j(1)} cy={70 + j(2)} r="28" fill="#fff" opacity="0.55" />
      {LAYERS[scene.kind](far, near, j)}
      <rect width="400" height="240" fill={`url(#fade${id})`} />
    </svg>
  );
}

type J = (n: number) => number;

const LAYERS: Record<SceneT["kind"], (far: string, near: string, j: J) => React.ReactNode> = {
  mountain: (far, near, j) => (
    <>
      <path d={`M0 170 L70 ${80 + j(3)} L120 140 L190 ${55 + j(4)} L260 150 L320 ${90 + j(5)} L400 150 V240 H0Z`} fill={far} opacity="0.75" />
      <path d={`M190 ${55 + j(4)} L170 85 L185 80 L200 90 L210 75Z`} fill="#fff" opacity="0.85" />
      <path d={`M0 200 L90 ${130 + j(6)} L170 190 L250 ${140 + j(7)} L340 200 L400 170 V240 H0Z`} fill={near} />
    </>
  ),
  water: (far, near, j) => (
    <>
      <path d={`M0 120 Q80 ${90 + j(3)} 160 120 T400 110 V240 H0Z`} fill={far} opacity="0.8" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={140 + i * 26 + j(i)} y="100" width="14" height="90" rx="7" fill="#fff" opacity={0.5 - i * 0.08} />
      ))}
      <path d="M0 190 Q100 170 200 190 T400 185 V240 H0Z" fill={near} opacity="0.9" />
      <path d="M40 205 H120 M220 215 H330" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
    </>
  ),
  city: (far, near, j) => (
    <>
      {Array.from({ length: 12 }).map((_, i) => {
        const h = 60 + ((i * 47 + j(i) * 3) % 90);
        return <rect key={i} x={i * 34} y={200 - h} width="30" height={h + 40} fill={far} opacity="0.75" />;
      })}
      {Array.from({ length: 9 }).map((_, i) => {
        const h = 40 + ((i * 61 + j(i + 4) * 2) % 70);
        return (
          <g key={i}>
            <rect x={i * 46 - 6} y={240 - h} width="40" height={h} fill={near} />
            {Array.from({ length: 3 }).map((__, k) => (
              <rect key={k} x={i * 46 + 2 + k * 10} y={250 - h} width="5" height="5" fill="#FFD9A0" opacity={(i + k) % 3 ? 0.8 : 0.2} />
            ))}
          </g>
        );
      })}
    </>
  ),
  temple: (far, near, j) => (
    <>
      <path d="M0 175 Q120 140 240 165 T400 150 V240 H0Z" fill={far} opacity="0.35" />
      <g transform={`translate(${200 + j(2)} 80)`} fill={far}>
        <path d="M-70 40 H70 L50 25 H-50Z" />
        <rect x="-40" y="40" width="80" height="14" />
        <path d="M-55 70 H55 L40 54 H-40Z" />
        <rect x="-30" y="70" width="60" height="40" />
        <rect x="-3" y="-5" width="6" height="30" />
      </g>
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i} cx={i * 44 + j(i)} cy={205 + (i % 3) * 6} r={26 + (i % 4) * 5} fill={near} opacity="0.95" />
      ))}
    </>
  ),
  forest: (far, near, j) => (
    <>
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={i} d={`M${i * 30 + j(i)} 190 l16 -${70 + (i % 4) * 14} l16 ${70 + (i % 4) * 14}Z`} fill={far} opacity="0.8" />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <path key={i} d={`M${i * 44 - 10} 240 l22 -${80 + (i % 3) * 18} l22 ${80 + (i % 3) * 18}Z`} fill={near} />
      ))}
    </>
  ),
  desert: (far, near, j) => (
    <>
      <path d={`M0 160 Q100 ${120 + j(1)} 200 150 T400 140 V240 H0Z`} fill={far} opacity="0.7" />
      <g fill={far}>
        {Array.from({ length: 6 }).map((_, i) => (
          <rect key={i} x={110 + i * 28} y={110 - (i % 3) * 12} width="24" height={60 + (i % 3) * 12} />
        ))}
      </g>
      <path d="M0 200 Q140 170 260 200 T400 195 V240 H0Z" fill={near} />
    </>
  ),
  coast: (far, near, j) => (
    <>
      <path d="M0 150 H400 V240 H0Z" fill={near} opacity="0.55" />
      <path d={`M0 110 L60 ${70 + j(2)} L140 130 L0 160Z`} fill={far} />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={20 + i * 14} y={120 + (i % 2) * 6} width="10" height="16" fill="#fff" opacity="0.8" />
      ))}
      <path d="M150 175 Q230 165 400 178 M180 200 Q280 190 400 205" stroke="#fff" strokeWidth="3" fill="none" opacity="0.45" />
      <path d={`M260 150 l14 -${20 + j(4)} l14 ${20 + j(4)}Z M300 150 l8 -14 l8 14Z`} fill={far} opacity="0.6" />
    </>
  ),
};
