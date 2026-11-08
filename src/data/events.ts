import type { PulseCategory } from "../types";

/**
 * SAMPLE Global Pulse items used to demo the feed. They are tagged source="sample" in the
 * database seed and should be replaced with verified editorial events or the event sync
 * (supabase/functions/sync-events) before launch. Dates are offsets from "today".
 */
export interface EventSeed {
  key: string;
  destinationId: string;
  city: string;
  category: PulseCategory;
  title: string;
  summary: string;
  startInDays: number;
  lengthDays: number;
}

export const EVENT_SEEDS: EventSeed[] = [
  { key: "tokyo-run", destinationId: "tokyo", city: "Tokyo", category: "sports", title: "Imperial Palace Shakeout Run", summary: "International runners meet for an easy 5 km loop around the palace moat.", startInDays: 3, lengthDays: 1 },
  { key: "lisbon-tech", destinationId: "lisbon", city: "Lisbon", category: "tech", title: "Founder Sunset Meetups", summary: "Rooftop founder meetups and coworking sessions around the city's tech week.", startInDays: 5, lengthDays: 4 },
  { key: "milan-design", destinationId: "milan", city: "Milan", category: "fashion", title: "Brera Design Pop-ups", summary: "Studios and courtyards in Brera open to the public with installations after dark.", startInDays: 12, lengthDays: 6 },
  { key: "oaxaca-art", destinationId: "oaxaca", city: "Oaxaca", category: "art", title: "Street Mural Walk", summary: "Local artists lead walks through the murals of Jalatlaco and Xochimilco.", startInDays: 8, lengthDays: 2 },
  { key: "reykjavik-music", destinationId: "reykjavik", city: "Reykjavík", category: "music", title: "Off-Venue Music Nights", summary: "Free shows in record shops, cafés and hostels around the city.", startInDays: 2, lengthDays: 3 },
  { key: "nyc-sports", destinationId: "nyc", city: "New York", category: "sports", title: "Brooklyn Run Club Takeover", summary: "Neighbourhood run clubs host open runs across the bridges.", startInDays: 6, lengthDays: 1 },
  { key: "melbourne-food", destinationId: "melbourne", city: "Melbourne", category: "food", title: "Laneway Night Noodle Market", summary: "Hawker stalls take over the riverbank for three weeks.", startInDays: 10, lengthDays: 21 },
  { key: "capetown-tech", destinationId: "capetown", city: "Cape Town", category: "tech", title: "Waterfront Startup Demos", summary: "Startup demos at the V&A Waterfront with sundowners after.", startInDays: 14, lengthDays: 2 },
  { key: "kyoto-festival", destinationId: "kyoto", city: "Kyoto", category: "festival", title: "Autumn Maple Light-ups", summary: "Temples in Higashiyama illuminate their maple gardens in the evenings.", startInDays: 1, lengthDays: 20 },
  { key: "marrakech-art", destinationId: "marrakech", city: "Marrakech", category: "art", title: "Medina Craft Open Studios", summary: "Artisans in the medina open their workshops for demonstrations.", startInDays: 9, lengthDays: 5 },
];
