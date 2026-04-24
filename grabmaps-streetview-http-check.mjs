import fs from "node:fs";

const localConfig = fs.existsSync(new URL("./config.local.js", import.meta.url))
  ? fs.readFileSync(new URL("./config.local.js", import.meta.url), "utf8")
  : "";
const apiKey = process.env.GRABMAPS_API_KEY || localConfig.match(/GRABMAPS_API_KEY\s*=\s*"([^"]+)"/)?.[1];

if (!apiKey) {
  throw new Error("Set GRABMAPS_API_KEY or create config.local.js before running this check.");
}

const orchard = { lat: 1.3048, lng: 103.8318 };
const photoParams = new URLSearchParams({
  lat: String(orchard.lat),
  lng: String(orchard.lng),
  limit: "1",
  radius: "5000",
  zoomLevel: "18",
  orderBy: "id",
  orderDirection: "desc",
  projection: "SPHERE",
});

const tests = [
  {
    name: "Style JSON with Bearer",
    url: "https://maps.grab.com/api/style.json",
    headers: { Authorization: `Bearer ${apiKey}` },
  },
  {
    name: "Street photos, no auth",
    url: `https://maps.grab.com/openstreetcam-api/2.0/photo/?${photoParams}`,
  },
  {
    name: "Street photos with Bearer",
    url: `https://maps.grab.com/openstreetcam-api/2.0/photo/?${photoParams}`,
    headers: { Authorization: `Bearer ${apiKey}` },
  },
  {
    name: "Street photos with X-API-Key",
    url: `https://maps.grab.com/openstreetcam-api/2.0/photo/?${photoParams}`,
    headers: { "X-API-Key": apiKey },
  },
  {
    name: "Street photos CORS preflight",
    method: "OPTIONS",
    url: `https://maps.grab.com/openstreetcam-api/2.0/photo/?${photoParams}`,
    headers: {
      Origin: "http://localhost:5177",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  },
  {
    name: "Camera dots vector tile",
    url: "https://maps.grab.com/vector-tiles/camera-dots/16/51670/32530.pbf",
    headers: { Authorization: `Bearer ${apiKey}` },
  },
  {
    name: "Coverage tile",
    url: "https://maps.grab.com/api/v1/coverage-tiles/51670/32530/16.png",
    headers: { Authorization: `Bearer ${apiKey}` },
  },
];

function previewBody(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

console.log("GrabMaps street-view HTTP check");
console.log("API key: [REDACTED]");
console.log("");

for (const test of tests) {
  const started = Date.now();
  try {
    const response = await fetch(test.url, {
      method: test.method || "GET",
      headers: test.headers || {},
    });
    const text = await response.text();
    const cors = response.headers.get("access-control-allow-origin") || "";
    const server = response.headers.get("server") || "";

    console.log(`${test.name}`);
    console.log(`  status: ${response.status} ${response.statusText}`);
    console.log(`  elapsed: ${Date.now() - started}ms`);
    console.log(`  cors: ${cors || "(none)"}`);
    console.log(`  server: ${server || "(none)"}`);
    console.log(`  body: ${previewBody(text)}`);
  } catch (error) {
    console.log(`${test.name}`);
    console.log(`  error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log("");
}
