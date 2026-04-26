// Base Coordinates for Bamenda Zones (Fallback when exact GPS is unknown)
const ZONES = {
  NKWEN: { lat: "5.9885", lon: "10.1841" },
  MANKON: { lat: "5.9500", lon: "10.1500" },
  BAMENDA_1: { lat: "5.9320", lon: "10.1650" },
  NDZAH: { lat: "5.9900", lon: "10.1900" },
  HOTSPOTS: { lat: "5.9610", lon: "10.1510" },
};

export const CUSTOM_BAMENDA_LOCATIONS = [
  // 🟢 1. NKWEN ZONE (Bamenda III)
  ...[
    "Alalie", "Atieba", "Atielah", "Atielah-Mbelewa", "Atiesu", "Atiesu-Mbessi",
    "Bayelle", "Bayelle I", "Bayelle II", "Bayelle III", "Bayelle IV", "Bayelle Manda",
    "Bujong-Mambu", "Futru I", "Futru II", "Lower Menteh", "Upper Menteh", "Manka-Mambu",
    "Mbefi-Mambu", "Mbelem", "Mbeso-Mambu", "Mbung", "Menjung", "Menka-Menda", "Mubang",
    "Mugheb", "Nchang", "Njejefor", "Njengang", "Nkwenjang", "Nkwesi", "Ntaghem I",
    "Ntaghem II", "Ntakeka", "Ntambang", "Ntambru", "Ntamuche", "Ntasen", "Ntefinki",
    "Ntela", "Ntenetene", "Ntenjung-Mbessi", "Ntensu-Mbelewa", "Sisia I", "Sisia II",
    "Sisia III", "Sisia IV", "Teken", "Town Green"
  ].map(name => ({
    lat: ZONES.NKWEN.lat,
    lon: ZONES.NKWEN.lon,
    display_name: `${name}, Nkwen, Bamenda III, Northwest Region, Cameroon`,
    clean_name: `${name}, Nkwen`
  })),

  // 🟡 2. NDZAH / OUTSKIRTS (still Bamenda III)
  ...[
    "Mokop", "Mubakuh", "Terrekoh", "Chamkoh", "Ntaw", "Wumsei", "Wumkien", "Tarri", "Njimben"
  ].map(name => ({
    lat: ZONES.NDZAH.lat,
    lon: ZONES.NDZAH.lon,
    display_name: `${name}, Ndzah, Bamenda III, Northwest Region, Cameroon`,
    clean_name: `${name}, Ndzah`
  })),

  // 🔵 3. MANKON / BAMENDA II
  ...[
    "Core", "Mankon", "Ntarikon", "Ntamulung", "Musang", "Mulang", "Azire (Small Mankon)",
    "Atu-Azire (Big Mankon)", "Alakuma", "Atuakom", "Chindeh", "Lower Ngomgham", 
    "Upper Ngomgham", "Mbinkfibil", "Nitop I", "Nitop II", "Nitop III", "Nitop IV",
    "Ntambeng I (Old Town)", "Ntambeng II", "Ntatrü", "Muwatsu", "Nkvura", "Akumlam",
    "Alabukom", "Alachu", "Alafrumbe", "Alamandom", "Alamatu", "Alatah", "Alatakoh",
    "Asongkah", "Atua Mambu", "Atuafon", "Atualakom", "Bagbanong", "Bagmande", "Kukvung",
    "Maso", "Matsam", "Matsom", "Ndzong", "Ndzumabua", "Ngulung", "Ntakimbari", "Ntamafe",
    "Ntamambu", "Ntangien", "Ntankah", "Ntumbong"
  ].map(name => ({
    lat: ZONES.MANKON.lat,
    lon: ZONES.MANKON.lon,
    display_name: `${name}, Mankon, Bamenda II, Northwest Region, Cameroon`,
    clean_name: `${name}, Mankon`
  })),

  // 🔴 4. BAMENDA I / BAMENDA NKWE / ABANGOH AREA
  ...[
    "Abangoh Central", "Abangoh Ntahsa", "Abangoh Ntangang", "Achichum", "Alahnting",
    "Aningdoh", "Ayaba", "Nta’afi", "Ntanche", "Menda-Nkwe", "Bamenda-Nkwe", "Kenelari", "Ntafebuh"
  ].map(name => ({
    lat: ZONES.BAMENDA_1.lat,
    lon: ZONES.BAMENDA_1.lon,
    display_name: `${name}, Bamenda I, Northwest Region, Cameroon`,
    clean_name: `${name}, Bamenda I`
  })),

  // 🟣 5. HISTORICAL + OLD QUARTERS
  ...[
    "Station", "Abakpa (Old Town)", "Ntabesi"
  ].map(name => ({
    lat: ZONES.HOTSPOTS.lat,
    lon: ZONES.HOTSPOTS.lon,
    display_name: `${name}, Bamenda, Northwest Region, Cameroon`,
    clean_name: name
  })),

  // 🟠 6. POPULAR EVERYDAY LOCATION NAMES (CRITICAL FOR ERIDE)
  ...[
    "Mile 1", "Mile 2", "Mile 3", "Mile 4", "Mile 5", "Mile 6", "Mile 7", "Mile 8", "Mile 9", "Mile 10",
    "Mile 2 Junction", "Mile 4 Junction", "Veterinary Junction", "Hospital Roundabout", "City Chemist",
    "Food Market", "Commercial Avenue", "Up Station", "Down Town"
  ].map(name => ({
    lat: ZONES.HOTSPOTS.lat,
    lon: ZONES.HOTSPOTS.lon,
    display_name: `${name}, Bamenda, Northwest Region, Cameroon`,
    clean_name: name
  })),

  // 7. SPECIFICS WITH EXACT KNOWN GPS
  {
    lat: "5.9885",
    lon: "10.1841",
    display_name: "Below Noble Man, Nkwen, Bamenda, Northwest, Cameroun",
    clean_name: "Below Noble Man, Nkwen"
  },
  {
    lat: "6.0043",
    lon: "10.2573",
    display_name: "Bambili 3 Corners, Tubah, Northwest, Cameroun",
    clean_name: "Bambili 3 Corners"
  }
];
