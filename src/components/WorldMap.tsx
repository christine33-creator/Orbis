import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";
import { Minus, Plus, LocateFixed } from "lucide-react";
import { cx } from "../lib/util";
import { useTranslation } from "react-i18next";

const W = 960;
const H = 500;

type CountryProps = { name: string };
const topo = worldData as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
const countries = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, CountryProps>).features.filter(
  (f) => f.properties.name !== "Antarctica",
);

export const COUNTRY_NAMES = countries.map((c) => c.properties.name).sort((a, b) => a.localeCompare(b));

const projection = geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: "Sphere" });
const path = geoPath(projection);
const graticule = path(geoGraticule10()) ?? "";
const sphere = path({ type: "Sphere" }) ?? "";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone: "gem" | "popular" | "event" | "mine";
}

const TONES = {
  gem: "#F26B4F",
  popular: "#B8361C",
  event: "#7C5CFF",
  mine: "#1E8A5A",
};

interface Props {
  pins?: MapPin[];
  visited?: string[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  dark?: boolean;
  className?: string;
  showLabels?: boolean;
  /** Fill the container (crop like background-size: cover) instead of letterboxing. */
  cover?: boolean;
  initialZoom?: number;
}

export function WorldMap({ pins = [], visited = [], selected, onSelect, interactive = true, dark, className, showLabels, cover, initialZoom = 1 }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState(() => ({ k: initialZoom, x: (W - W * initialZoom) / 2, y: (H - H * initialZoom) / 2 }));
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const visitedSet = useMemo(() => new Set(visited), [visited]);

  const projected = useMemo(
    () => pins.map((p) => ({ ...p, xy: projection([p.lng, p.lat]) ?? [0, 0] })),
    [pins],
  );

  // Fly to the selected pin.
  useEffect(() => {
    if (!interactive || !selected) return;
    const p = projected.find((x) => x.id === selected);
    if (!p) return;
    const k = Math.max(view.k, 2.4);
    setView(clamp({ k, x: W / 2 - p.xy[0] * k, y: H / 2 - p.xy[1] * k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /** Pixel→viewBox scale and the part of the viewBox actually visible. */
  const metrics = () => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return { s: W / 1, r, x0: 0, y0: 0, vw: W, vh: H };
    const px = cover ? Math.max(r.width / W, r.height / H) : Math.min(r.width / W, r.height / H);
    const vw = r.width / px;
    const vh = r.height / px;
    return { s: 1 / px, r, x0: (W - vw) / 2, y0: (H - vh) / 2, vw, vh };
  };
  const clamp = (v: { k: number; x: number; y: number }) => {
    const k = Math.min(8, Math.max(1, v.k));
    const m = metrics();
    const fit = (pos: number, size: number, start: number, vis: number) =>
      size * k <= vis ? start + (vis - size * k) / 2 : Math.min(start, Math.max(start + vis - size * k, pos));
    return { k, x: fit(v.x, W, m.x0, m.vw), y: fit(v.y, H, m.y0, m.vh) };
  };
  const zoom = (factor: number, cx = W / 2, cy = H / 2) =>
    setView((v) => {
      const k = Math.min(8, Math.max(1, v.k * factor));
      return clamp({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k });
    });

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const m = metrics();
    return [m.x0 + (e.clientX - m.r!.left) * m.s, m.y0 + (e.clientY - m.r!.top) * m.s];
  };

  const pinR = (cover ? 4.5 : 7) / Math.sqrt(view.k);

  return (
    <div className={cx("relative overflow-hidden", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMid meet"}
        className={cx("block h-full w-full touch-none select-none", interactive && "cursor-grab active:cursor-grabbing")}
        role="img"
        aria-label={t("map.worldMap")}
        onPointerDown={(e) => {
          if (!interactive) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const s = metrics().s;
          const dx = (e.clientX - d.px) * s;
          const dy = (e.clientY - d.py) * s;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          setView((v) => clamp({ ...v, x: d.x + dx, y: d.y + dy }));
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
        onWheel={(e) => {
          if (!interactive) return;
          const [x, y] = toSvg(e);
          zoom(e.deltaY < 0 ? 1.25 : 0.8, x, y);
        }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <path d={sphere} fill={dark ? "#1E2839" : "#EAF0F4"} />
          <path d={graticule} fill="none" stroke={dark ? "#2A3548" : "#DCE5EB"} strokeWidth={0.6 / view.k} />
          {countries.map((c: Feature<Geometry, CountryProps>, i) => {
            const v = visitedSet.has(c.properties.name);
            return (
              <path
                key={i}
                d={path(c) ?? ""}
                fill={v ? (dark ? "#B8361C" : "#F2A28A") : dark ? "#33405A" : "#FFFFFF"}
                stroke={dark ? "#1E2839" : "#D7DEE4"}
                strokeWidth={0.6 / view.k}
              >
                <title>{c.properties.name}</title>
              </path>
            );
          })}
          {projected.map((p) => {
            const isSel = p.id === selected;
            return (
              <g
                key={p.id}
                transform={`translate(${p.xy[0]} ${p.xy[1]})`}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (drag.current?.moved) return;
                  onSelect?.(p.id);
                }}
              >
                <title>{p.label}</title>
                {(isSel || p.tone === "gem") && (
                  <circle r={pinR * 1.4} fill={TONES[p.tone]} opacity={0.35} className="animate-ping-soft" />
                )}
                <circle r={pinR * 2.6} fill="transparent" />
                <circle r={isSel ? pinR * 1.5 : pinR} fill={TONES[p.tone]} stroke="#fff" strokeWidth={2 / Math.sqrt(view.k)} />
                {(isSel || (showLabels && view.k > 3.2)) && view.k > 1.6 && (
                  <text
                    y={-pinR * 2}
                    textAnchor="middle"
                    fontSize={(cover ? 10 : 13) / Math.sqrt(view.k)}
                    fontWeight={700}
                    fill={dark ? "#fff" : "#1B1D22"}
                    stroke={dark ? "#1E2839" : "#fff"}
                    strokeWidth={3 / Math.sqrt(view.k)}
                    paintOrder="stroke"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {interactive && (
        <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-2xl bg-card shadow-md">
          <button aria-label={t("map.zoomIn")} className="grid h-10 w-10 place-items-center hover:bg-chip" onClick={() => zoom(1.5)}>
            <Plus size={18} />
          </button>
          <button aria-label={t("map.zoomOut")} className="grid h-10 w-10 place-items-center border-t border-line hover:bg-chip" onClick={() => zoom(1 / 1.5)}>
            <Minus size={18} />
          </button>
          <button aria-label={t("map.reset")} className="grid h-10 w-10 place-items-center border-t border-line hover:bg-chip" onClick={() => setView(clamp({ k: initialZoom, x: (W - W * initialZoom) / 2, y: (H - H * initialZoom) / 2 }))}>
            <LocateFixed size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
