import type { GemCategory, TravelStyle } from "../types";

/** Editorial starter gems, credited to the Orbis Team account. Coordinates are approximate. */
export interface GemSeed {
  key: string;
  destinationId: string;
  name: string;
  description: string;
  tip: string;
  category: GemCategory;
  styles: TravelStyle[];
  lat: number;
  lng: number;
  country: string;
}

export const GEM_SEEDS: GemSeed[] = [
  { key: "otagi", destinationId: "kyoto", name: "Otagi Nenbutsu-ji", category: "culture", styles: ["culture", "photography"], lat: 35.0275, lng: 135.6627, country: "Japan",
    description: "A hillside temple above Arashiyama where 1,200 moss-covered stone rakan statues each wear a different expression.",
    tip: "Walk up from Saga-Toriimoto after the bamboo grove. The steps get slick with morning dew, so wear shoes with grip." },
  { key: "saga-toriimoto", destinationId: "kyoto", name: "Saga-Toriimoto Preserved Street", category: "culture", styles: ["culture", "photography"], lat: 35.0265, lng: 135.668, country: "Japan",
    description: "A quiet lane of thatched machiya houses north of the bamboo grove that most day-trippers never reach.",
    tip: "Take the northern path out of the bamboo grove and keep walking. Early morning is almost empty." },
  { key: "kibune", destinationId: "kyoto", name: "Kibune Shrine", category: "nature", styles: ["culture", "eco", "wellness"], lat: 35.1218, lng: 135.7625, country: "Japan",
    description: "A mountain shrine in a cedar valley, reached by the Kurama–Kibune ridge trail. Lantern-lined steps glow at dusk.",
    tip: "Hike over from Kurama in about 90 minutes, then eat lunch on a platform built over the river." },
  { key: "yanaka", destinationId: "tokyo", name: "Yanaka Ginza", category: "food", styles: ["food", "culture"], lat: 35.7277, lng: 139.766, country: "Japan",
    description: "An old-Tokyo shopping street of croquette stands, sweet shops and cats, spared from wartime bombing.",
    tip: "Come at dusk and start from the 'Yuyake Dandan' steps at the top for the sunset view." },
  { key: "gotokuji", destinationId: "tokyo", name: "Gotokuji Temple", category: "culture", styles: ["culture", "photography"], lat: 35.6489, lng: 139.6473, country: "Japan",
    description: "The temple said to be the birthplace of the maneki-neko, with thousands of beckoning-cat figurines.",
    tip: "Ride the little Setagaya tram line to get here. It's a sight in itself." },
  { key: "senhora-monte", destinationId: "lisbon", name: "Miradouro da Senhora do Monte", category: "viewpoint", styles: ["photography", "vacation"], lat: 38.7192, lng: -9.1328, country: "Portugal",
    description: "Lisbon's highest viewpoint, looking over the castle, the Baixa and the river.",
    tip: "Skip Tram 28 and walk up through Graça. Bring a bottle of vinho verde for sunset." },
  { key: "torel", destinationId: "lisbon", name: "Jardim do Torel", category: "viewpoint", styles: ["vacation", "wellness"], lat: 38.7183, lng: -9.1426, country: "Portugal",
    description: "A small terraced garden with a city view, deck chairs and, in summer, a pop-up pool and bar.",
    tip: "Take the Elevador do Lavra funicular from Restauradores and you'll arrive at the gate." },
  { key: "ushguli", destinationId: "svaneti", name: "Ushguli", category: "culture", styles: ["adventure", "culture", "photography"], lat: 42.9167, lng: 43.0167, country: "Georgia",
    description: "One of Europe's highest inhabited villages, with medieval Svan towers beneath Shkhara glacier.",
    tip: "There are no ATMs after Mestia. Bring cash in lari for guesthouses." },
  { key: "pocitelj", destinationId: "kravice", name: "Počitelj Old Town", category: "culture", styles: ["culture", "photography"], lat: 43.1347, lng: 17.7311, country: "Bosnia and Herz.",
    description: "A walled Ottoman-era village climbing a hillside over the Neretva river, 15 minutes from Kravice.",
    tip: "Climb the tower at the top before 10 AM, then swim at Kravice in the afternoon." },
  { key: "rodeno", destinationId: "albarracin", name: "Pinares de Rodeno Rock Art", category: "nature", styles: ["adventure", "culture", "eco"], lat: 40.4, lng: -1.37, country: "Spain",
    description: "Red sandstone outcrops in a pine forest, with prehistoric rock paintings and bouldering.",
    tip: "Pick up a free trail map at the Dornaque visitor centre." },
  { key: "kvalvika", destinationId: "lofoten", name: "Kvalvika Beach", category: "beach", styles: ["adventure", "photography"], lat: 68.0762, lng: 13.0256, country: "Norway",
    description: "A white-sand Arctic beach enclosed by mountains, reached only on foot.",
    tip: "Hike up Ryten for the view straight down onto the beach, and skip the Reinebringen crowds." },
  { key: "murgia", destinationId: "matera", name: "Belvedere di Murgia Timone", category: "viewpoint", styles: ["photography", "culture"], lat: 40.6667, lng: 16.6219, country: "Italy",
    description: "The viewpoint across the Gravina gorge where the cave city of Matera lights up at dusk.",
    tip: "Cross the hanging bridge from the Sassi; it's about a 40-minute walk." },
  { key: "hierve", destinationId: "oaxaca", name: "Hierve el Agua", category: "nature", styles: ["adventure", "eco", "photography"], lat: 16.8656, lng: -96.2761, country: "Mexico",
    description: "Mineral springs that formed petrified 'waterfalls' on a cliff edge, with natural infinity pools.",
    tip: "Go on a weekday morning and combine it with a mezcal palenque in Santiago Matatlán." },
  { key: "mulafossur", destinationId: "faroe", name: "Múlafossur Waterfall", category: "nature", styles: ["adventure", "photography"], lat: 62.1105, lng: -7.4352, country: "Faroe Islands",
    description: "A waterfall dropping straight from the cliffs of Gásadalur into the Atlantic.",
    tip: "Fog lifts fast. Keep a backup hike on the other side of the island." },
  { key: "anbang", destinationId: "hoian", name: "An Bàng Beach", category: "beach", styles: ["vacation", "food"], lat: 15.9136, lng: 108.3415, country: "Vietnam",
    description: "A relaxed beach with seafood shacks, reached through rice paddies from Hội An.",
    tip: "Cycle out at sunrise; the paddy road is cooler and empty." },
  { key: "phousi", destinationId: "luangprabang", name: "Mount Phousi at Sunrise", category: "viewpoint", styles: ["culture", "photography", "wellness"], lat: 19.8913, lng: 102.1386, country: "Laos",
    description: "A hilltop stupa above the old town with views over the Mekong and Nam Khan rivers.",
    tip: "Sunset is packed; sunrise is calm. Watch the morning alms silently, from across the street." },
  { key: "grotta", destinationId: "reykjavik", name: "Grótta Lighthouse", category: "viewpoint", styles: ["photography", "wellness"], lat: 64.1641, lng: -22.0213, country: "Iceland",
    description: "A lighthouse on a tidal islet at the edge of Reykjavík, with a tiny geothermal foot bath.",
    tip: "One of the best low-light-pollution spots in town for the northern lights. Check the tide before crossing." },
  { key: "kalkbay", destinationId: "capetown", name: "Kalk Bay Harbour", category: "food", styles: ["food", "vacation"], lat: -34.1278, lng: 18.4489, country: "South Africa",
    description: "A working fishing harbour with fish-and-chips spots, tidal pools and seals.",
    tip: "Take the coastal train from Muizenberg and sit on the sea side." },
  { key: "jardin-secret", destinationId: "marrakech", name: "Le Jardin Secret", category: "culture", styles: ["culture", "wellness"], lat: 31.6296, lng: -7.9893, country: "Morocco",
    description: "A restored riad garden in the medina, quiet even when the souks are at their busiest.",
    tip: "Pay the small extra fee for the tower; it has the best rooftop view in the medina." },
  { key: "skenduli", destinationId: "gjirokaster", name: "Skenduli House", category: "culture", styles: ["culture", "photography"], lat: 40.0745, lng: 20.14, country: "Albania",
    description: "An Ottoman tower-house still owned by the family that built it, with guided tours of its rooms.",
    tip: "Tours are given by family members; ask about the hidden room." },
  { key: "kaneo", destinationId: "ohrid", name: "Church of St. John at Kaneo", category: "viewpoint", styles: ["culture", "photography"], lat: 41.111, lng: 20.7893, country: "Macedonia",
    description: "A 13th-century church on a cliff above Lake Ohrid.",
    tip: "Get there by 7 AM, then take a boat to the springs of St. Naum." },
];
