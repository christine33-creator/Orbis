import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";
import type { Destination } from "../types";

type Props = { name: string };
const topo = worldData as unknown as Topology<{ countries: GeometryCollection<Props> }>;
let countries: Feature<Geometry, Props>[] | null = null;

/** Country (world-atlas name) containing a point, using bundled boundaries; null at sea. */
export function countryAt(lat: number, lng: number): string | null {
  countries ??= (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, Props>).features;
  return countries.find((c) => geoContains(c, [lng, lat]))?.properties.name ?? null;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Closest curated destination within `maxKm`, if any. */
export function nearestDestination(p: { lat: number; lng: number }, list: Destination[], maxKm = 150) {
  let best: Destination | undefined;
  let bestKm = Infinity;
  for (const d of list) {
    const km = distanceKm(p, d);
    if (km < bestKm) [best, bestKm] = [d, km];
  }
  return bestKm <= maxKm ? best : undefined;
}
