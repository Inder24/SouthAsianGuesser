import { GrabMapsBuilder, MapBuilder } from "https://maps.grab.com/developer/assets/js/grabmaps.es.js";
import { GAME_ROUNDS } from "./game-rounds.js?v=catalog-6";

const GRABMAPS_SDK_BASE_URL = "https://maps.grab.com";
const GRABMAPS_API_KEY = window.GRABMAPS_API_KEY || "";
const ROUND_SECONDS = 60;
const TOTAL_ROUNDS = 5;

const els = {
  playButton: document.querySelector("#playButton"),
  submitButton: document.querySelector("#submitButton"),
  nextButton: document.querySelector("#nextButton"),
  statusText: document.querySelector("#statusText"),
  countryText: document.querySelector("#countryText"),
  timerText: document.querySelector("#timerText"),
  scoreText: document.querySelector("#scoreText"),
  roundText: document.querySelector("#roundText"),
  hintText: document.querySelector("#hintText"),
  resultPanel: document.querySelector("#resultPanel"),
  distanceText: document.querySelector("#distanceText"),
  roundScoreText: document.querySelector("#roundScoreText"),
  emptyState: document.querySelector("#emptyState"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  resetViewButton: document.querySelector("#resetViewButton"),
  canvas: document.querySelector("#panoCanvas")
};

const ctx = els.canvas.getContext("2d");
const state = {
  config: loadConfig(),
  client: null,
  map: null,
  usingGrabMap: false,
  round: 0,
  totalScore: 0,
  phase: "idle",
  timerId: null,
  secondsLeft: ROUND_SECONDS,
  target: null,
  photo: null,
  guess: null,
  image: null,
  viewX: 0.5,
  viewY: 0.5,
  zoom: 1.25,
  drag: null,
  roundDeck: []
};

updateHud();
bindEvents();
init();

async function init() {
  try {
    setStatus("Loading GrabMaps SDK...");
    state.client = createGrabClient();
    await initMap();
    state.roundDeck = shuffle(GAME_ROUNDS);
    updatePlayAvailability();
    setStatus("Press Play to start");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not initialize");
  }
}

function createGrabClient() {
  return new GrabMapsBuilder()
    .setBaseUrl(GRABMAPS_SDK_BASE_URL)
    .setApiKey(GRABMAPS_API_KEY)
    .setTimeout(15000)
    .build();
}

async function initMap() {
  if (state.map) state.map.remove();

  try {
    const grabMap = await new MapBuilder(state.client)
      .setContainer("map")
      .setCenter([103.8198, 1.3521])
      .setZoom(4)
      .enableNavigation()
      .enableAttribution()
      .build();
    state.map = grabMap.getMap();
    state.usingGrabMap = true;
    await waitForMap(state.map);
  } catch (error) {
    console.warn("Grab map style failed, using OSM fallback map.", error);
    state.usingGrabMap = false;
    state.map = new maplibregl.Map({
      container: "map",
      center: [103.8198, 1.3521],
      zoom: 4,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "OpenStreetMap"
          }
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      }
    });
    state.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    await waitForMap(state.map);
  }

  state.map.on("click", (event) => {
    if (state.phase !== "playing") return;
    state.guess = { lat: event.lngLat.lat, lng: event.lngLat.lng };
    setPoint("guess", state.guess);
    els.submitButton.disabled = false;
    els.hintText.textContent = "Guess placed. Submit when ready.";
  });

  ensureGameLayers();
}

function bindEvents() {
  els.playButton.addEventListener("click", startGame);
  els.submitButton.addEventListener("click", () => finishRound(false));
  els.nextButton.addEventListener("click", startRound);
  els.zoomInButton.addEventListener("click", () => zoomPhoto(0.25));
  els.zoomOutButton.addEventListener("click", () => zoomPhoto(-0.25));
  els.resetViewButton.addEventListener("click", resetPhotoView);
  window.addEventListener("resize", drawPanorama);

  els.canvas.addEventListener("pointerdown", (event) => {
    if (!state.image) return;
    els.canvas.setPointerCapture(event.pointerId);
    state.drag = {
      x: event.clientX,
      y: event.clientY,
      viewX: state.viewX,
      viewY: state.viewY
    };
  });
  els.canvas.addEventListener("pointermove", (event) => {
    if (!state.drag) return;
    const rect = els.canvas.getBoundingClientRect();
    const deltaX = event.clientX - state.drag.x;
    const deltaY = event.clientY - state.drag.y;
    state.viewX = clamp(state.drag.viewX - deltaX / Math.max(1, rect.width), 0, 1);
    state.viewY = clamp(state.drag.viewY - deltaY / Math.max(1, rect.height), 0, 1);
    drawPanorama();
  });
  els.canvas.addEventListener("pointerup", () => {
    state.drag = null;
  });
  els.canvas.addEventListener("pointercancel", () => {
    state.drag = null;
  });
  els.canvas.addEventListener("wheel", (event) => {
    if (!state.image) return;
    event.preventDefault();
    zoomPhoto(Math.sign(event.deltaY) * -0.12);
  }, { passive: false });
}

async function startGame() {
  state.round = 0;
  state.totalScore = 0;
  state.roundDeck = shuffle(GAME_ROUNDS);
  updateHud();
  await startRound();
}

async function startRound() {
  if (!state.roundDeck.length) {
    state.roundDeck = shuffle(GAME_ROUNDS);
  }

  clearTimer();
  clearMapOverlays();
  clearViewer();
  state.phase = "loading";
  state.guess = null;
  state.target = null;
  state.photo = null;
  els.submitButton.disabled = true;
  els.nextButton.disabled = true;
  els.playButton.disabled = true;
  els.resultPanel.hidden = true;
  updateHud();
  setStatus("Loading round...");

  try {
    const roundData = await pickLoadableRound();
    state.round += 1;
    state.target = roundData.location;
    state.photo = roundData.photo;
    els.countryText.textContent = "Mystery location";
    state.map.flyTo({ center: [105, 8], zoom: 4, duration: 600 });
    state.phase = "playing";
    els.hintText.textContent = "Inspect the photo, then click the map to place your pin.";
    setStatus("Where in Southeast Asia is this?");
    startTimer();
  } catch (error) {
    console.warn(error);
    state.phase = "idle";
    els.playButton.disabled = false;
    setStatus("Could not load the selected photo. Try Play again.");
    updateHud();
    updatePlayAvailability();
  }
}

async function pickLoadableRound() {
  const maxAttempts = Math.max(1, GAME_ROUNDS.length);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const roundData = pickCatalogRound();
    try {
      await loadPanorama(roundData.photo);
      return roundData;
    } catch {
      /* Try another catalog entry if an external image is unavailable. */
    }
  }
  throw new Error("No loadable catalog rounds available.");
}

function pickCatalogRound() {
  const round = state.roundDeck.shift();
  if (!round) throw new Error("No catalog rounds available.");
  return {
    location: {
      id: round.id,
      name: round.name,
      country: round.country,
      lat: round.lat,
      lng: round.lng
    },
    photo: {
      id: round.id,
      lat: round.lat,
      lng: round.lng,
      imageUrl: round.imageUrl,
      fallbackUrls: [round.imageUrl],
      sourceUrl: round.sourceUrl,
      attribution: round.attribution
    }
  };
}

function loadPanorama(photo) {
  const urls = [...new Set(photo.fallbackUrls || [
    photo.imageProcUrl,
    photo.imageUrl,
    photo.imageLthUrl,
    photo.imageThUrl
  ].filter(Boolean))];

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      state.image = img;
      resetPhotoView();
      els.emptyState.hidden = true;
      drawPanorama();
      resolve();
    };
    img.onerror = () => {
      const nextUrl = urls.shift();
      if (nextUrl) img.src = nextUrl;
      else reject(new Error("Street-view image could not be loaded."));
    };
    img.src = urls.shift();
  });
}

function drawPanorama() {
  const canvas = els.canvas;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (!state.image) return;

  const img = state.image;
  const targetAspect = rect.width / rect.height;
  let srcW = img.width / state.zoom;
  let srcH = srcW / targetAspect;
  if (srcH > img.height) {
    srcH = img.height / state.zoom;
    srcW = srcH * targetAspect;
  }
  srcW = Math.min(srcW, img.width);
  srcH = Math.min(srcH, img.height);
  const x = clamp(state.viewX * Math.max(0, img.width - srcW), 0, Math.max(0, img.width - srcW));
  const y = clamp(state.viewY * Math.max(0, img.height - srcH), 0, Math.max(0, img.height - srcH));

  ctx.drawImage(img, x, y, srcW, srcH, 0, 0, rect.width, rect.height);
}

function zoomPhoto(delta) {
  if (!state.image) return;
  state.zoom = clamp(state.zoom + delta, 1, 3.8);
  drawPanorama();
}

function resetPhotoView() {
  state.viewX = 0.5;
  state.viewY = 0.5;
  state.zoom = 1.25;
  drawPanorama();
}

function startTimer() {
  state.secondsLeft = ROUND_SECONDS;
  updateHud();
  state.timerId = window.setInterval(() => {
    state.secondsLeft -= 1;
    updateHud();
    if (state.secondsLeft <= 0) finishRound(true);
  }, 1000);
}

function finishRound(timedOut) {
  if (state.phase !== "playing") return;
  clearTimer();
  state.phase = "result";
  els.submitButton.disabled = true;
  els.nextButton.disabled = state.round >= TOTAL_ROUNDS;
  els.playButton.disabled = state.round < TOTAL_ROUNDS;

  const answer = { lat: state.photo.lat, lng: state.photo.lng };
  setPoint("target", answer);
  if (state.guess) setLine(state.guess, answer);

  const distance = state.guess ? distanceMeters(state.guess, answer) : 2000000;
  const score = state.guess ? scoreForDistance(distance) : 0;
  state.totalScore += score;
  els.distanceText.textContent = state.guess
    ? `${formatDistance(distance)} from ${state.target.name}`
    : `No guess placed. Answer: ${state.target.name}`;
  els.roundScoreText.textContent = `+${score.toLocaleString()}`;
  els.resultPanel.hidden = false;
  els.countryText.textContent = `${state.target.name}, ${state.target.country}`;
  els.hintText.textContent = state.round >= TOTAL_ROUNDS
    ? "Game complete. Press Play for a new run."
    : "Review the answer, then continue.";
  setStatus(timedOut ? "Time is up" : "Round scored");
  updateHud();

  if (state.guess) {
    fitResultBounds(state.guess, answer);
  } else {
    state.map.flyTo({ center: [answer.lng, answer.lat], zoom: 12 });
  }
}

function ensureGameLayers() {
  const map = state.map;
  const add = () => {
    for (const id of ["guess", "target"]) {
      if (!map.getSource(`${id}-source`)) {
        map.addSource(`${id}-source`, emptyPointSource());
      }
    }
    if (!map.getSource("result-line-source")) {
      map.addSource("result-line-source", emptyLineSource());
    }
    addCircleLayer("guess-layer", "guess-source", "#1a73e8", "#ffffff");
    addCircleLayer("target-layer", "target-source", "#00b852", "#082018");
    if (!map.getLayer("result-line-layer")) {
      map.addLayer({
        id: "result-line-layer",
        type: "line",
        source: "result-line-source",
        paint: {
          "line-color": "#ff6b35",
          "line-width": 4,
          "line-dasharray": [1.2, 1.2]
        }
      });
    }
  };

  if (map.isStyleLoaded()) add();
  else map.once("load", add);
}

function addCircleLayer(id, source, color, stroke) {
  if (state.map.getLayer(id)) return;
  state.map.addLayer({
    id,
    type: "circle",
    source,
    paint: {
      "circle-radius": 9,
      "circle-color": color,
      "circle-stroke-color": stroke,
      "circle-stroke-width": 3
    }
  });
}

function setPoint(kind, point) {
  const source = state.map.getSource(`${kind}-source`);
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [point.lng, point.lat] }
    }]
  });
}

function setLine(start, end) {
  const source = state.map.getSource("result-line-source");
  if (!source) return;
  source.setData({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [[start.lng, start.lat], [end.lng, end.lat]]
      }
    }]
  });
}

function clearMapOverlays() {
  if (!state.map) return;
  ["guess", "target"].forEach((kind) => {
    state.map.getSource(`${kind}-source`)?.setData(emptyPointSource().data);
  });
  state.map.getSource("result-line-source")?.setData(emptyLineSource().data);
}

function clearViewer() {
  state.image = null;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  els.emptyState.hidden = false;
}

function emptyPointSource() {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  };
}

function emptyLineSource() {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  };
}

function fitResultBounds(a, b) {
  const bounds = new maplibregl.LngLatBounds();
  bounds.extend([a.lng, a.lat]);
  bounds.extend([b.lng, b.lat]);
  state.map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 700 });
}

function distanceMeters(a, b) {
  if (state.client?.streetView?.calculateDistance) {
    return state.client.streetView.calculateDistance(a.lat, a.lng, b.lat, b.lng);
  }
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function scoreForDistance(meters) {
  if (meters <= 20) return 5000;
  return Math.max(0, Math.round(5000 * Math.exp(-meters / 18000)));
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function updateHud() {
  els.roundText.textContent = `${Math.min(state.round, TOTAL_ROUNDS)}/${TOTAL_ROUNDS}`;
  els.scoreText.textContent = state.totalScore.toLocaleString();
  els.timerText.textContent = `${Math.floor(state.secondsLeft / 60)}:${String(state.secondsLeft % 60).padStart(2, "0")}`;
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function updatePlayAvailability() {
  const hasReadyRound = GAME_ROUNDS.length > 0;
  const busy = state.phase === "loading" || state.phase === "playing";
  const betweenRounds = state.phase === "result" && state.round < TOTAL_ROUNDS;
  els.playButton.disabled = busy || betweenRounds || !hasReadyRound;
  els.playButton.textContent = hasReadyRound ? "Play" : "No rounds";
}

function loadConfig() {
  return { baseUrl: GRABMAPS_SDK_BASE_URL };
}

function waitForMap(map) {
  if (map.loaded()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    map.once("load", done);
    map.once("idle", done);
    window.setTimeout(done, 3000);
  });
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function clearTimer() {
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.secondsLeft = ROUND_SECONDS;
  updateHud();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg) {
  return deg * Math.PI / 180;
}
