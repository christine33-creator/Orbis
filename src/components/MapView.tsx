import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre loads its worker from a file next to its own script, which bundling breaks.
// Bundle the (self-contained) worker source and serve it from a blob: URL, which also
// works on hosts whose security policy only allows same-page workers.
import workerSource from "maplibre-gl/dist/maplibre-gl-worker.mjs?raw";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";
import { LocateFixed } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface MapPoint {
  id: string;
  kind: "destination" | "gem" | "event";
  lat: number;
  lng: number;
  label: string;
}

const COLORS = { destination: "#B8361C", gem: "#F26B4F", event: "#7C5CFF" };

maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));

const STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

/** Offline style: country shapes only. Used when the tile server can't be reached. */
function fallbackStyle(): StyleSpecification {
  const topo = worldData as unknown as Topology<{ countries: GeometryCollection }>;
  const fc = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { name: string }>;
  // Drop Antarctica and any ring that wraps across the date line; both draw stray bands in Web Mercator.
  const sane = (ring: number[][]) => {
    const xs = ring.map((c) => c[0]);
    return Math.max(...xs) - Math.min(...xs) < 180;
  };
  const land = {
    ...fc,
    features: fc.features
      .filter((f) => f.properties.name !== "Antarctica")
      .map((f) => ({
        ...f,
        geometry: f.geometry.type === "Polygon"
          ? { ...f.geometry, coordinates: f.geometry.coordinates.filter(sane) }
          : { ...f.geometry, coordinates: f.geometry.coordinates.filter((poly) => poly.every(sane)) },
      })),
  };
  return {
    version: 8,
    sources: { land: { type: "geojson", data: land as never } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#E3ECF2" } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": "#FFFFFF" } },
      { id: "borders", type: "line", source: "land", paint: { "line-color": "#D2DBE2", "line-width": 0.6 } },
    ],
  };
}

interface Props {
  points: MapPoint[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** Picking mode: tap or drag to choose a location. */
  pick?: { lat: number; lng: number } | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number; zoom?: number };
  className?: string;
}

export default function MapView({ points, selected, onSelect, pick, onPick, center, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const latest = useRef({ points, selected, onSelect, onPick });
  latest.current = { points, selected, onSelect, onPick };
  const [offline, setOffline] = useState(false);
  const { t } = useTranslation();

  const toGeoJson = () => ({
    type: "FeatureCollection" as const,
    features: latest.current.points.map((p) => ({
      type: "Feature" as const,
      id: p.id,
      properties: { id: p.id, kind: p.kind, label: p.label, selected: p.id === latest.current.selected ? 1 : 0 },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })),
  });

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: STYLE_URL,
      center: center ? [center.lng, center.lat] : [15, 28],
      zoom: center?.zoom ?? 1.1,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    map.current = m;

    let styleLoaded = false;
    const useFallback = () => {
      if (styleLoaded && !m.getStyle()?.sources?.land) return;
      setOffline(true);
      m.setStyle(fallbackStyle());
    };
    const timer = window.setTimeout(() => !styleLoaded && useFallback(), 6000);
    m.on("error", (e) => {
      if (!styleLoaded && /style|fetch|Failed/i.test(String(e.error?.message ?? ""))) useFallback();
    });

    m.on("style.load", () => {
      styleLoaded = true;
      if (!m.getSource("points")) {
        m.addSource("points", { type: "geojson", data: toGeoJson() });
        m.addLayer({
          id: "points-halo", type: "circle", source: "points", filter: ["==", ["get", "selected"], 1],
          paint: { "circle-radius": 16, "circle-color": ["match", ["get", "kind"], "gem", COLORS.gem, "event", COLORS.event, COLORS.destination], "circle-opacity": 0.25 },
        });
        m.addLayer({
          id: "points", type: "circle", source: "points",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, ["case", ["==", ["get", "selected"], 1], 8, 5], 8, ["case", ["==", ["get", "selected"], 1], 11, 8]],
            "circle-color": ["match", ["get", "kind"], "gem", COLORS.gem, "event", COLORS.event, COLORS.destination],
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 2,
          },
        });
      }
    });

    m.on("click", "points", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) latest.current.onSelect?.(id);
    });
    m.on("mouseenter", "points", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "points", () => (m.getCanvas().style.cursor = ""));
    m.on("click", (e) => {
      if (!latest.current.onPick) return;
      latest.current.onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    return () => {
      window.clearTimeout(timer);
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep pins in sync.
  useEffect(() => {
    const src = map.current?.getSource("points") as GeoJSONSource | undefined;
    src?.setData(toGeoJson());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selected]);

  // Fly to the selected pin.
  useEffect(() => {
    const p = points.find((x) => x.id === selected);
    if (!p || !map.current) return;
    map.current.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.current.getZoom(), p.kind === "destination" ? 4 : 10), speed: 1.4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Re-center when the caller asks (e.g. choosing a destination in a form).
  useEffect(() => {
    if (center && map.current) map.current.flyTo({ center: [center.lng, center.lat], zoom: center.zoom ?? map.current.getZoom() });
  }, [center?.lat, center?.lng, center?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Location-picking marker.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!pick) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ color: COLORS.gem, draggable: true }).setLngLat([pick.lng, pick.lat]).addTo(m);
      marker.current.on("dragend", () => {
        const ll = marker.current!.getLngLat();
        latest.current.onPick?.({ lat: ll.lat, lng: ll.lng });
      });
    } else marker.current.setLngLat([pick.lng, pick.lat]);
  }, [pick?.lat, pick?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.current?.flyTo({ center: [p.lng, p.lat], zoom: 12 });
        latest.current.onPick?.(p);
      },
      () => undefined,
      { timeout: 8000 },
    );

  return (
    <div className={className}>
     <div className="relative h-full w-full overflow-hidden">
      <div ref={el} className="h-full w-full" />
      <button
        type="button"
        onClick={locate}
        aria-label={t("map.locate")}
        className="absolute right-3 bottom-8 grid h-10 w-10 place-items-center rounded-full bg-card shadow-md"
      >
        <LocateFixed size={18} />
      </button>
      {offline && (
        <span className="pointer-events-none absolute top-14 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-muted shadow-sm">
          {t("map.simplified")}
        </span>
      )}
     </div>
    </div>
  );
}
