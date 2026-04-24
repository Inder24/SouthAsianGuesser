const SEA_ANCHORS = [
  { name: "Orchard Road", country: "Singapore", lat: 1.3048, lng: 103.8318 },
  { name: "Marina Bay", country: "Singapore", lat: 1.2836, lng: 103.8602 },
  { name: "Bugis", country: "Singapore", lat: 1.3008, lng: 103.8559 },
  { name: "Joo Chiat Road", country: "Singapore", lat: 1.3127, lng: 103.9019 },
  { name: "Chinatown Singapore", country: "Singapore", lat: 1.2838, lng: 103.8430 },
  { name: "Bangla Road", country: "Thailand", lat: 7.8939, lng: 98.2968 },
  { name: "Sukhumvit Road", country: "Thailand", lat: 13.7379, lng: 100.5600 },
  { name: "Khao San Road", country: "Thailand", lat: 13.7589, lng: 100.4971 },
  { name: "Chiang Mai Old City", country: "Thailand", lat: 18.7883, lng: 98.9853 },
  { name: "Ao Nang", country: "Thailand", lat: 8.0324, lng: 98.8246 },
  { name: "Bukit Bintang", country: "Malaysia", lat: 3.1468, lng: 101.7113 },
  { name: "KLCC", country: "Malaysia", lat: 3.1579, lng: 101.7116 },
  { name: "George Town", country: "Malaysia", lat: 5.4141, lng: 100.3288 },
  { name: "Jonker Street", country: "Malaysia", lat: 2.1960, lng: 102.2465 },
  { name: "Kota Kinabalu Waterfront", country: "Malaysia", lat: 5.9804, lng: 116.0735 },
  { name: "Jakarta Sudirman", country: "Indonesia", lat: -6.2146, lng: 106.8189 },
  { name: "Bundaran HI", country: "Indonesia", lat: -6.1931, lng: 106.8230 },
  { name: "Seminyak", country: "Indonesia", lat: -8.6913, lng: 115.1682 },
  { name: "Ubud", country: "Indonesia", lat: -8.5069, lng: 115.2625 },
  { name: "Malioboro Street", country: "Indonesia", lat: -7.7928, lng: 110.3660 },
  { name: "Bonifacio Global City", country: "Philippines", lat: 14.5503, lng: 121.0501 },
  { name: "Makati Avenue", country: "Philippines", lat: 14.5633, lng: 121.0299 },
  { name: "Intramuros", country: "Philippines", lat: 14.5896, lng: 120.9747 },
  { name: "Cebu IT Park", country: "Philippines", lat: 10.3317, lng: 123.9073 },
  { name: "Davao Roxas Avenue", country: "Philippines", lat: 7.0712, lng: 125.6128 },
  { name: "Hoan Kiem Lake", country: "Vietnam", lat: 21.0287, lng: 105.8523 },
  { name: "Old Quarter Hanoi", country: "Vietnam", lat: 21.0358, lng: 105.8500 },
  { name: "Nguyen Hue Walking Street", country: "Vietnam", lat: 10.7730, lng: 106.7038 },
  { name: "Ben Thanh Market", country: "Vietnam", lat: 10.7721, lng: 106.6983 },
  { name: "Da Nang Dragon Bridge", country: "Vietnam", lat: 16.0614, lng: 108.2270 },
  { name: "Pub Street Siem Reap", country: "Cambodia", lat: 13.3549, lng: 103.8552 },
  { name: "Phnom Penh Riverside", country: "Cambodia", lat: 11.5686, lng: 104.9307 },
  { name: "Norodom Boulevard", country: "Cambodia", lat: 11.5564, lng: 104.9282 },
  { name: "Vientiane Riverside", country: "Laos", lat: 17.9634, lng: 102.6060 },
  { name: "Luang Prabang Night Market", country: "Laos", lat: 19.8886, lng: 102.1341 },
  { name: "Yangon Sule Pagoda", country: "Myanmar", lat: 16.7741, lng: 96.1588 },
  { name: "Mandalay Palace", country: "Myanmar", lat: 21.9769, lng: 96.0836 },
  { name: "Bandar Seri Begawan", country: "Brunei", lat: 4.8903, lng: 114.9422 },
  { name: "Gadong", country: "Brunei", lat: 4.9067, lng: 114.9163 },
  { name: "East Timor Dili Waterfront", country: "Timor-Leste", lat: -8.5537, lng: 125.5782 }
];

function seededUnit(seed) {
  const x = Math.sin(seed * 999.1337) * 43758.5453;
  return x - Math.floor(x);
}

function offsetMeters(lat, lng, meters, bearingDeg) {
  const earth = 6378137;
  const bearing = bearingDeg * Math.PI / 180;
  const dLat = (meters * Math.cos(bearing)) / earth;
  const dLng = (meters * Math.sin(bearing)) / (earth * Math.cos(lat * Math.PI / 180));
  return {
    lat: lat + dLat * 180 / Math.PI,
    lng: lng + dLng * 180 / Math.PI
  };
}

export function buildLocationPool(count = 1000) {
  return Array.from({ length: count }, (_, index) => {
    const anchor = SEA_ANCHORS[index % SEA_ANCHORS.length];
    const ring = Math.floor(index / SEA_ANCHORS.length);
    const distance = ring === 0 ? 0 : 80 + seededUnit(index + 17) * 650;
    const bearing = seededUnit(index + 101) * 360;
    const point = offsetMeters(anchor.lat, anchor.lng, distance, bearing);
    return {
      id: `sea-${String(index + 1).padStart(4, "0")}`,
      name: ring === 0 ? anchor.name : `${anchor.name} area ${ring + 1}`,
      country: anchor.country,
      lat: point.lat,
      lng: point.lng
    };
  });
}
