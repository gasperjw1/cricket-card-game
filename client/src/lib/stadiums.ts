/**
 * Iconic stadiums per nation — used by the pre-match overlay to add
 * cricket-authentic flavor ("Eden Gardens, Kolkata" vs just "India").
 *
 * Curated from each nation's most-famous/historic ground. Picked at
 * match-creation time and pinned for the match so the same opponent
 * doesn't keep producing different stadium names mid-run.
 */

interface Stadium {
  /** Official name. */
  name: string;
  /** City the stadium is in. */
  city: string;
  /** Cricket-relevant flavor — capacity, surface tendency, etc. */
  tagline: string;
}

const STADIUMS_BY_NATION: Record<string, Stadium[]> = {
  India: [
    { name: "Eden Gardens", city: "Kolkata", tagline: "100,000 capacity · spin-friendly evenings" },
    { name: "Wankhede Stadium", city: "Mumbai", tagline: "Sea-breeze swing · last-ball finals" },
    { name: "M. Chinnaswamy Stadium", city: "Bengaluru", tagline: "Short boundaries · batsman's paradise" },
    { name: "Narendra Modi Stadium", city: "Ahmedabad", tagline: "132,000 capacity · world's largest cricket ground" },
  ],
  Australia: [
    { name: "Melbourne Cricket Ground", city: "Melbourne", tagline: "100,024 capacity · the home of cricket Down Under" },
    { name: "Sydney Cricket Ground", city: "Sydney", tagline: "Historic turf · spin-friendly under lights" },
    { name: "The Gabba", city: "Brisbane", tagline: "Bouncy pitch · pacers' delight" },
    { name: "Adelaide Oval", city: "Adelaide", tagline: "Picturesque setting · drop-in surfaces" },
  ],
  England: [
    { name: "Lord's", city: "London", tagline: "Home of cricket · 28,000 capacity · slope from north to south" },
    { name: "The Oval", city: "London", tagline: "Test cricket since 1880 · gas-holder views" },
    { name: "Old Trafford", city: "Manchester", tagline: "Spin assistance · classic English summer" },
    { name: "Edgbaston", city: "Birmingham", tagline: "Loud crowds · Ashes folklore" },
  ],
  "South Africa": [
    { name: "Newlands", city: "Cape Town", tagline: "Table Mountain backdrop · seam-friendly mornings" },
    { name: "Wanderers Stadium", city: "Johannesburg", tagline: "The Bullring · electric atmospheres" },
    { name: "Kingsmead", city: "Durban", tagline: "Coastal swing · humid conditions" },
  ],
  "New Zealand": [
    { name: "Eden Park", city: "Auckland", tagline: "Drop-in pitch · biggest crowd in NZ cricket" },
    { name: "Hagley Oval", city: "Christchurch", tagline: "Picturesque · cool breeze" },
    { name: "Basin Reserve", city: "Wellington", tagline: "Windy capital ground" },
  ],
  Pakistan: [
    { name: "Gaddafi Stadium", city: "Lahore", tagline: "60,000 capacity · spin-friendly under lights" },
    { name: "National Stadium", city: "Karachi", tagline: "Historic Test venue" },
    { name: "Rawalpindi Cricket Stadium", city: "Rawalpindi", tagline: "Pacer's paradise · bouncy track" },
  ],
  "Sri Lanka": [
    { name: "R. Premadasa Stadium", city: "Colombo", tagline: "Floodlight finals · spin in the second innings" },
    { name: "Galle International Stadium", city: "Galle", tagline: "Fort backdrop · spinner's heaven" },
    { name: "Pallekele International Stadium", city: "Kandy", tagline: "Hill-country setting" },
  ],
  "West Indies": [
    { name: "Kensington Oval", city: "Bridgetown, Barbados", tagline: "Caribbean atmosphere · World Cup 2007 final" },
    { name: "Sabina Park", city: "Kingston, Jamaica", tagline: "Pacer-friendly · loud reggae crowds" },
    { name: "Queen's Park Oval", city: "Port of Spain, Trinidad", tagline: "Northern Range backdrop" },
  ],
  Bangladesh: [
    { name: "Sher-e-Bangla National Cricket Stadium", city: "Dhaka", tagline: "Spin-friendly · 25,000 capacity" },
    { name: "Zahur Ahmed Chowdhury Stadium", city: "Chattogram", tagline: "Coastal ground · sea-breeze swing" },
  ],
  Zimbabwe: [
    { name: "Harare Sports Club", city: "Harare", tagline: "Picturesque ground · the historic home of ZC" },
    { name: "Queens Sports Club", city: "Bulawayo", tagline: "Bouncy surface · pacer's pitch" },
  ],
  Afghanistan: [
    { name: "Sharjah Cricket Stadium", city: "Sharjah (home venue)", tagline: "Afghanistan's adopted home · day-night cricket" },
    { name: "Greater Noida Sports Complex", city: "Greater Noida (home venue)", tagline: "Spin-friendly surface" },
  ],
  Ireland: [
    { name: "Castle Avenue", city: "Dublin", tagline: "Historic ground · Test status venue" },
    { name: "Stormont", city: "Belfast", tagline: "Windy conditions · seam-friendly" },
  ],
};

/** Pick a stadium for the given nation. Stable for the same nation +
 *  match-index combination (so re-rendering doesn't shuffle). */
export function stadiumFor(nation: string, seed: number = 0): Stadium {
  const list = STADIUMS_BY_NATION[nation];
  if (!list || list.length === 0) {
    return {
      name: "Neutral Venue",
      city: nation,
      tagline: "International cricket venue",
    };
  }
  const idx = Math.abs(hashString(nation) + seed) % list.length;
  return list[idx]!;
}

/** djb2 string hash — deterministic seed for stadium selection. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h;
}
