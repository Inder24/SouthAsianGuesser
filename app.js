import { GrabMapsBuilder, MapBuilder } from "https://maps.grab.com/developer/assets/js/grabmaps.es.js";
import { GAME_ROUNDS, REAL_VIEW_LOCATIONS } from "./game-rounds.js?v=game-v16";

const GRABMAPS_SDK_BASE_URL = "https://maps.grab.com";
const GRABMAPS_API_KEY = window.GRABMAPS_API_KEY || "";
const KARTAVIEW_API_BASE_URL = "https://kartaview.org";
const KARTAVIEW_DETAILS_BASE_URL = "https://api.openstreetcam.org";
const KARTAVIEW_SEARCH_RADIUS_METERS = 1200;
const KARTAVIEW_FETCH_TIMEOUT_MS = 6500;
const TIMEOUT_PENALTY = -750;
const TIMEOUT_AUTO_NEXT_MS = 2800;
const COUNTRY_CHOICES = ["Singapore", "Thailand", "Malaysia", "Vietnam", "Indonesia", "Philippines", "Cambodia", "Laos", "Myanmar", "Brunei"];
const PRE_GUESS_TAG_REWRITES = new Map([
  ["thai script", "local script"],
  ["vietnamese signage", "local signage"],
  ["malaysia flag", "flag visible"],
  ["indonesian road name", "road-name clue"],
  ["indonesian signage", "local signage"],
  ["old quarter", "historic quarter"]
]);
const PRE_GUESS_BLOCKED_TERMS = [
  "singapore",
  "thailand",
  "thai",
  "malaysia",
  "malaysian",
  "vietnam",
  "vietnamese",
  "indonesia",
  "indonesian",
  "philippines",
  "filipino",
  "cambodia",
  "cambodian",
  "khmer",
  "laos",
  "laotian",
  "myanmar",
  "burmese",
  "brunei",
  "orchard",
  "bangkok",
  "phuket",
  "kuala lumpur",
  "jalan alor",
  "ho chi minh",
  "siem reap",
  "hanoi",
  "malacca",
  "makati",
  "jakarta",
  "yogyakarta"
];
const MODES = {
  classic: {
    label: "Classic",
    totalRounds: 5,
    seconds: 60,
    prompt: "Where in Southeast Asia is this?",
    hint: "Inspect the photo, then click the map to place your pin."
  },
  country: {
    label: "Country",
    totalRounds: 8,
    seconds: 30,
    prompt: "Which country is this?",
    hint: "Pick the country. Faster correct guesses score higher."
  }
};

const els = {
  startScreen: document.querySelector("#startScreen"),
  gameShell: document.querySelector("#gameShell"),
  launchButton: document.querySelector("#launchButton"),
  backButton: document.querySelector("#backButton"),
  playButton: document.querySelector("#playButton"),
  submitButton: document.querySelector("#submitButton"),
  nextButton: document.querySelector("#nextButton"),
  statusText: document.querySelector("#statusText"),
  countryText: document.querySelector("#countryText"),
  mapStatusText: document.querySelector("#mapStatusText"),
  timerText: document.querySelector("#timerText"),
  scoreText: document.querySelector("#scoreText"),
  roundText: document.querySelector("#roundText"),
  streakText: document.querySelector("#streakText"),
  hintText: document.querySelector("#hintText"),
  resultPanel: document.querySelector("#resultPanel"),
  resultKicker: document.querySelector("#resultKicker"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSubtitle: document.querySelector("#resultSubtitle"),
  roundScoreText: document.querySelector("#roundScoreText"),
  placeText: document.querySelector("#placeText"),
  grabContextText: document.querySelector("#grabContextText"),
  sourceText: document.querySelector("#sourceText"),
  clueText: document.querySelector("#clueText"),
  emptyState: document.querySelector("#emptyState"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  resetViewButton: document.querySelector("#resetViewButton"),
  canvas: document.querySelector("#panoCanvas"),
  countryPanel: document.querySelector("#countryPanel"),
  roundBadges: document.querySelector("#roundBadges"),
  startModeButtons: [...document.querySelectorAll(".start-mode-button")],
  startSourceButtons: [...document.querySelectorAll(".start-source-button")]
};

const ctx = els.canvas.getContext("2d");
const state = {
  client: null,
  map: null,
  usingGrabMap: false,
  mode: "classic",
  startMode: "classic",
  sourceMode: "real",
  startSourceMode: "real",
  launched: false,
  round: 0,
  totalScore: 0,
  streak: 0,
  bestStreak: 0,
  phase: "idle",
  timerId: null,
  timeoutAutoNextId: null,
  secondsLeft: MODES.classic.seconds,
  target: null,
  photo: null,
  guess: null,
  countryGuess: "",
  image: null,
  viewX: 0.5,
  viewY: 0.5,
  zoom: 1.18,
  drag: null,
  roundDeck: [],
  lastOpeningRoundId: "",
  usedKartaPhotoIds: new Set()
};

updateHud();
bindEvents();
init();

async function init() {
  try {
    setStatus("Loading GrabMaps SDK...");
    setMapStatus("GrabMaps SDK loading");
    state.client = createGrabClient();
    await initMap();
    state.roundDeck = buildRoundDeck();
    renderCountryChoices();
    updatePlayAvailability();
    updateSourceButtons();
    els.launchButton.disabled = false;
    setStatus("Choose a mode, then press Play");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not initialize");
    setMapStatus("Map unavailable");
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
    setMapStatus("GrabMaps map active");
    await waitForMap(state.map);
  } catch (error) {
    console.warn("Grab map style failed, using OSM fallback map.", error);
    state.usingGrabMap = false;
    setMapStatus("GrabMaps style down, fallback map active");
    state.map = new maplibregl.Map({
      container: "map",
      center: [103.8198, 1.3521],
      zoom: 4,
      attributionControl: true,
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
    if (state.phase !== "playing" || state.mode !== "classic") return;
    state.guess = { lat: event.lngLat.lat, lng: event.lngLat.lng };
    setPoint("guess", state.guess, { kind: "guess" });
    els.submitButton.disabled = false;
    els.hintText.textContent = "Guess placed. Submit when ready.";
  });

  ensureGameLayers();
}

function bindEvents() {
  els.launchButton.addEventListener("click", launchGame);
  els.backButton.addEventListener("click", showTitleScreen);
  els.playButton.addEventListener("click", startGame);
  els.submitButton.addEventListener("click", () => finishRound(false));
  els.nextButton.addEventListener("click", startRound);
  els.zoomInButton.addEventListener("click", () => zoomPhoto(0.25));
  els.zoomOutButton.addEventListener("click", () => zoomPhoto(-0.25));
  els.resetViewButton.addEventListener("click", resetPhotoView);
  els.startModeButtons.forEach((button) => {
    button.addEventListener("click", () => setStartMode(button.dataset.mode));
  });
  els.startSourceButtons.forEach((button) => {
    button.addEventListener("click", () => setStartSourceMode(button.dataset.source));
  });
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

async function launchGame() {
  if (state.launched) return;
  state.launched = true;
  setMode(state.startMode);
  setSourceMode(state.startSourceMode);
  els.startScreen.hidden = true;
  els.gameShell.classList.remove("is-waiting");
  els.gameShell.removeAttribute("aria-hidden");
  window.setTimeout(() => {
    state.map?.resize?.();
    drawPanorama();
  }, 50);
  await startGame();
}

function showTitleScreen() {
  cancelTimeoutAutoNext();
  clearTimer();
  clearMapOverlays();
  clearViewer();
  state.launched = false;
  state.phase = "idle";
  state.round = 0;
  state.totalScore = 0;
  state.streak = 0;
  state.countryGuess = "";
  state.guess = null;
  state.target = null;
  state.photo = null;
  els.resultPanel.hidden = true;
  els.submitButton.disabled = true;
  els.nextButton.disabled = true;
  els.playButton.disabled = false;
  els.countryPanel.hidden = true;
  els.countryText.textContent = "Southeast Asia";
  els.hintText.textContent = "Click the map to place your pin.";
  setStatus("Choose a mode, then press Play");
  updateHud();
  updatePlayAvailability();
  els.gameShell.classList.add("is-waiting");
  els.gameShell.setAttribute("aria-hidden", "true");
  els.startScreen.hidden = false;
}

function setStartMode(mode) {
  if (!MODES[mode]) return;
  state.startMode = mode;
  els.startModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function setStartSourceMode(sourceMode) {
  if (!["real", "photo"].includes(sourceMode)) return;
  state.startSourceMode = sourceMode;
  els.startSourceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.source === sourceMode);
  });
}

function setMode(mode) {
  if (!MODES[mode] || state.phase === "loading" || state.phase === "playing") return;
  state.mode = mode;
  state.secondsLeft = modeConfig().seconds;
  els.countryPanel.hidden = mode !== "country";
  els.submitButton.textContent = mode === "country" ? "Lock Country" : "Submit Guess";
  clearMapOverlays();
  clearViewer();
  state.round = 0;
  state.totalScore = 0;
  state.streak = 0;
  state.countryGuess = "";
  state.phase = "idle";
  updateHud();
  updatePlayAvailability();
  updateSourceButtons();
  setStatus(`${modeConfig().label} mode ready`);
  els.hintText.textContent = modeConfig().hint;
}

function setSourceMode(sourceMode) {
  if (!["real", "photo"].includes(sourceMode) || state.phase === "loading" || state.phase === "playing") return;
  state.sourceMode = sourceMode;
  clearMapOverlays();
  clearViewer();
  state.round = 0;
  state.totalScore = 0;
  state.streak = 0;
  state.countryGuess = "";
  state.phase = "idle";
  updateHud();
  updatePlayAvailability();
  updateSourceButtons();
  setStatus(`${sourceMode === "real" ? "Real View" : "Photo View"} ready`);
  els.hintText.textContent = sourceMode === "real"
    ? "KartaView street imagery will load where available."
    : "Curated catalog photos will load.";
}

async function startGame() {
  cancelTimeoutAutoNext();
  state.round = 0;
  state.totalScore = 0;
  state.streak = 0;
  state.countryGuess = "";
  state.roundDeck = buildRoundDeck(state.lastOpeningRoundId);
  updateHud();
  await startRound();
}

async function startRound() {
  cancelTimeoutAutoNext();
  if (!state.roundDeck.length) {
    state.roundDeck = buildRoundDeck(state.lastOpeningRoundId);
  }

  clearTimer();
  clearMapOverlays();
  clearViewer();
  state.phase = "loading";
  state.guess = null;
  state.countryGuess = "";
  state.target = null;
  state.photo = null;
  els.submitButton.disabled = true;
  els.nextButton.disabled = true;
  els.playButton.disabled = true;
  els.resultPanel.hidden = true;
  els.countryPanel.hidden = state.mode !== "country";
  updateCountryButtons();
  updateSourceButtons();
  updateHud();
  setStatus("Loading round...");

  try {
    const roundData = await pickLoadableRound();
    state.round += 1;
    state.target = roundData.location;
    state.photo = roundData.photo;
    if (state.round === 1) {
      state.lastOpeningRoundId = roundData.location.id;
    }
    els.countryText.textContent = "Mystery location";
    renderRoundBadges(roundData.location);
    state.map.flyTo({ center: [105, 8], zoom: 4, duration: 600 });
    state.phase = "playing";
    updateCountryButtons();
    updateSourceButtons();
    els.hintText.textContent = modeConfig().hint;
    setStatus(modeConfig().prompt);
    startTimer();
  } catch (error) {
    console.warn(error);
    state.phase = "idle";
    els.playButton.disabled = false;
    setStatus("Could not load the selected photo. Try Play again.");
    updateHud();
    updatePlayAvailability();
    updateSourceButtons();
  }
}

async function pickLoadableRound() {
  const maxAttempts = Math.max(1, state.sourceMode === "real" ? Math.min(24, roundPool().length) : roundPool().length);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const catalogRound = pickCatalogRound();
    const roundData = state.sourceMode === "real" ? await attachKartaPhoto(catalogRound) : catalogRound;
    if (state.sourceMode === "real" && roundData.photo.provider !== "KartaView") {
      continue;
    }
    try {
      await loadPanorama(roundData.photo);
      if (roundData.photo.provider === "KartaView" && roundData.photo.kartaPhotoId) {
        state.usedKartaPhotoIds.add(roundData.photo.kartaPhotoId);
      }
      return roundData;
    } catch {
      if (roundData.photo.provider === "KartaView" && state.sourceMode !== "real") {
        try {
          await loadPanorama(catalogRound.photo);
          return catalogRound;
        } catch {
          /* Try another catalog entry if both KartaView and the catalog image fail. */
        }
      }
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
      city: round.city || "",
      country: round.country,
      lat: round.lat,
      lng: round.lng,
      difficulty: round.difficulty || "Medium",
      clueTypes: round.clueTypes || [],
      reveal: round.reveal || "",
      fact: round.fact || ""
    },
    photo: {
      id: round.id,
      provider: "Catalog",
      lat: round.lat,
      lng: round.lng,
      imageUrl: round.imageUrl,
      fallbackUrls: [round.imageUrl],
      sourceUrl: round.sourceUrl,
      attribution: round.attribution
    }
  };
}

async function attachKartaPhoto(roundData) {
  try {
    const kartaPhoto = await findKartaPhoto(roundData.location);
    if (!kartaPhoto) {
      return state.sourceMode === "real" ? nullKartaRound(roundData) : roundData;
    }
    return {
      location: {
        ...roundData.location,
        lat: kartaPhoto.lat,
        lng: kartaPhoto.lng
      },
      photo: kartaPhoto
    };
  } catch (error) {
    console.warn("KartaView photo lookup failed; using catalog image.", error);
    return state.sourceMode === "real" ? nullKartaRound(roundData) : roundData;
  }
}

function nullKartaRound(roundData) {
  return {
    ...roundData,
    photo: { ...roundData.photo, provider: "KartaMissing" }
  };
}

async function findKartaPhoto(location) {
  const searches = [
    { radius: KARTAVIEW_SEARCH_RADIUS_METERS, fieldOfView: "360" },
    { radius: KARTAVIEW_SEARCH_RADIUS_METERS }
  ];

  for (const search of searches) {
    const body = new URLSearchParams({
      lat: String(location.lat),
      lng: String(location.lng),
      radius: String(search.radius),
      page: "1",
      ipp: "12"
    });
    if (search.fieldOfView) body.set("fieldOfView", search.fieldOfView);

    const nearby = await fetchJsonWithTimeout(`${KARTAVIEW_API_BASE_URL}/1.0/list/nearby-photos/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    }, KARTAVIEW_FETCH_TIMEOUT_MS);

    const candidates = nearby?.currentPageItems || [];
    const shuffledCandidates = shuffle(candidates)
      .filter((item) => (
        item?.id
        && !state.usedKartaPhotoIds.has(String(item.id))
        && Number.isFinite(Number(item.lat))
        && Number.isFinite(Number(item.lng))
      ));

    for (const item of shuffledCandidates) {
      const photo = await getKartaPhotoDetails(item.id, item);
      if (photo) return photo;
    }
  }

  return null;
}

async function getKartaPhotoDetails(photoId, nearbyItem) {
  try {
    const details = await fetchJsonWithTimeout(
      `${KARTAVIEW_DETAILS_BASE_URL}/2.0/photo/${encodeURIComponent(photoId)}`,
      {},
      KARTAVIEW_FETCH_TIMEOUT_MS
    );
    const data = details?.result?.data;
    if (!data) return null;
    const kartaPhotoId = String(data.id || photoId);
    if (state.usedKartaPhotoIds.has(kartaPhotoId)) return null;

    const fallbackUrls = [
      data.imageProcUrl,
      ...optimizeKartaImageUrls(data.imageProcUrl),
      data.imageLthUrl,
      data.imageThUrl
    ].filter(Boolean);
    if (!fallbackUrls.length) return null;

    const lat = Number(data.lat || nearbyItem.lat);
    const lng = Number(data.lng || nearbyItem.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      id: `karta-${data.id || photoId}`,
      kartaPhotoId,
      provider: "KartaView",
      lat,
      lng,
      imageUrl: fallbackUrls[0],
      fallbackUrls,
      sourceUrl: `https://kartaview.org/details/${data.sequenceId || nearbyItem.sequence_id}/${data.id || photoId}`,
      attribution: `KartaView public imagery${data.username ? ` by ${data.username}` : ""}, CC BY-SA 4.0`,
      projection: data.projection || nearbyItem.projection || "",
      fieldOfView: data.fieldOfView || nearbyItem.field_of_view || "",
      heading: data.heading || nearbyItem.heading || ""
    };
  } catch (error) {
    console.warn("KartaView photo details failed.", error);
    return null;
  }
}

function optimizeKartaImageUrls(url) {
  if (!url || !url.includes("cdn.kartaview.org/pr:sharp/")) return [];
  if (url.includes("cdn.kartaview.org/pr:sharp/rs:fit:")) return [url];
  return [
    url.replace("/pr:sharp/", "/pr:sharp/rs:fit:8192:4096/"),
    url.replace("/pr:sharp/", "/pr:sharp/rs:fit:4096:2048/")
  ];
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
  state.zoom = 1.18;
  drawPanorama();
}

function startTimer() {
  state.secondsLeft = modeConfig().seconds;
  updateHud();
  state.timerId = window.setInterval(() => {
    state.secondsLeft = Math.max(0, state.secondsLeft - 1);
    updateHud();
    if (state.secondsLeft <= 0) finishRound(true);
  }, 1000);
}

function finishRound(timedOut) {
  if (state.phase !== "playing") return;
  clearTimer(false);
  state.phase = "result";
  els.submitButton.disabled = true;
  els.nextButton.disabled = state.round >= modeConfig().totalRounds;
  els.playButton.disabled = state.round < modeConfig().totalRounds;

  const answer = { lat: state.photo.lat, lng: state.photo.lng };
  setPoint("target", answer, { kind: "target" });

  let score = 0;
  let title = "";
  let subtitle = "";
  let kicker = "Round result";

  if (timedOut) {
    score = TIMEOUT_PENALTY;
    title = "Time up";
    subtitle = `Answer: ${state.target.name}, ${state.target.country}`;
    kicker = "Time is up";
    state.streak = 0;
    if (state.guess) {
      setLine(state.guess, answer);
      fitResultBounds(state.guess, answer);
    } else {
      state.map.flyTo({ center: [answer.lng, answer.lat], zoom: 12, duration: 700 });
    }
  } else if (state.mode === "classic") {
    if (state.guess) {
      setLine(state.guess, answer);
      const distance = distanceMeters(state.guess, answer);
      score = scoreForDistance(distance);
      title = `${formatDistance(distance)} away`;
      subtitle = `${state.target.name}, ${state.target.country}`;
      kicker = score >= 4500 ? "Pinpoint" : score >= 3000 ? "Strong read" : "Reveal";
      fitResultBounds(state.guess, answer);
    } else {
      title = "No pin placed";
      subtitle = `Answer: ${state.target.name}, ${state.target.country}`;
      state.map.flyTo({ center: [answer.lng, answer.lat], zoom: 12 });
    }
  } else {
    const correct = state.countryGuess === state.target.country;
    const timeBonus = correct ? Math.round((state.secondsLeft / modeConfig().seconds) * 1200) : 0;
    score = correct ? 3800 + timeBonus : 0;
    state.streak = correct ? state.streak + 1 : 0;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    title = correct ? "Correct country" : "Country missed";
    subtitle = state.countryGuess
      ? `You chose ${state.countryGuess}. Answer: ${state.target.country}.`
      : `No country selected. Answer: ${state.target.country}.`;
    kicker = correct ? `Streak ${state.streak}` : "Streak reset";
    state.map.flyTo({ center: [answer.lng, answer.lat], zoom: 9, duration: 700 });
  }

  state.totalScore += score;
  els.resultKicker.textContent = timedOut ? "Time is up" : kicker;
  els.resultTitle.textContent = title;
  els.resultSubtitle.textContent = subtitle;
  els.roundScoreText.textContent = formatScoreDelta(score);
  els.placeText.textContent = `${state.target.name}${state.target.city ? `, ${state.target.city}` : ""}`;
  els.clueText.textContent = buildClueText(state.target);
  els.sourceText.textContent = buildSourceText(state.photo);
  els.grabContextText.textContent = "Checking nearby map context...";
  els.resultPanel.hidden = false;
  els.countryText.textContent = `${state.target.name}, ${state.target.country}`;
  els.hintText.textContent = state.round >= modeConfig().totalRounds
    ? "Run complete. Press Play for a new run."
    : timedOut
      ? "Time up. Next round starts automatically."
      : "Review the answer, then continue.";
  setStatus(timedOut ? "Time is up" : "Round scored");
  updateHud();
  updateCountryButtons(true);
  updateSourceButtons();
  loadGrabContext(answer);
  scheduleTimeoutAutoNext(timedOut);
}

async function loadGrabContext(point) {
  if (!GRABMAPS_API_KEY) {
    els.grabContextText.textContent = state.usingGrabMap ? "GrabMaps map active" : "Local config missing GrabMaps key";
    return;
  }
  try {
    const reverseParams = new URLSearchParams({ location: `${point.lat},${point.lng}` });
    const nearbyParams = new URLSearchParams({
      location: `${point.lat},${point.lng}`,
      radius: "1",
      limit: "3",
      rankBy: "distance"
    });
    const [reverseResult, nearbyResult] = await Promise.all([
      grabGatewayJson(`/api/v1/maps/poi/v1/reverse-geo?${reverseParams}`),
      grabGatewayJson(`/api/v1/maps/place/v2/nearby?${nearbyParams}`)
    ]);
    const reversePlace = reverseResult?.places?.[0];
    const nearbyNames = (nearbyResult?.places || [])
      .map((place) => place.name)
      .filter(Boolean)
      .slice(0, 2);
    const address = reversePlace?.formatted_address || reversePlace?.street || reversePlace?.city;
    els.grabContextText.textContent = [
      address ? `Address: ${address}` : "",
      nearbyNames.length ? `Nearby: ${nearbyNames.join(", ")}` : ""
    ].filter(Boolean).join(" | ") || "GrabMaps returned no nearby label";
  } catch (error) {
    console.warn("GrabMaps map context failed.", error);
    els.grabContextText.textContent = state.usingGrabMap ? "GrabMaps map active" : "Fallback map active";
  }
}

async function grabGatewayJson(path) {
  const response = await fetch(`${GRABMAPS_SDK_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${GRABMAPS_API_KEY}` }
  });
  if (!response.ok) throw new Error(`GrabMaps gateway failed: ${response.status}`);
  return response.json();
}

async function fetchJsonWithTimeout(url, options = {}, timeout = 6000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function renderCountryChoices() {
  els.countryPanel.innerHTML = COUNTRY_CHOICES.map((country) => (
    `<button class="country-choice" type="button" data-country="${country}">${country}</button>`
  )).join("");
  els.countryPanel.querySelectorAll(".country-choice").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.phase !== "playing" || state.mode !== "country") return;
      state.countryGuess = button.dataset.country;
      updateCountryButtons();
      els.submitButton.disabled = false;
      els.hintText.textContent = `${state.countryGuess} locked in. Submit when ready.`;
    });
  });
}

function updateCountryButtons(revealed = false) {
  els.countryPanel.querySelectorAll(".country-choice").forEach((button) => {
    const country = button.dataset.country;
    button.classList.toggle("selected", country === state.countryGuess);
    button.classList.toggle("correct", revealed && country === state.target?.country);
    button.classList.toggle("wrong", revealed && country === state.countryGuess && country !== state.target?.country);
    button.disabled = state.mode !== "country" || (state.phase !== "playing" && !revealed);
  });
}

function updateSourceButtons() {
  els.startSourceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.source === state.startSourceMode);
  });
}

function renderRoundBadges(location) {
  const tags = getPreGuessTags(location);
  els.roundBadges.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  els.roundBadges.hidden = tags.length === 0;
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
    addCircleLayer("guess-layer", "guess-source", "#2b6ce8", "#ffffff");
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
  els.roundBadges.hidden = true;
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
  try {
    const west = Math.min(a.lng, b.lng);
    const east = Math.max(a.lng, b.lng);
    const south = Math.min(a.lat, b.lat);
    const north = Math.max(a.lat, b.lat);
    state.map.fitBounds([[west, south], [east, north]], { padding: 72, maxZoom: 13, duration: 700 });
  } catch (error) {
    console.warn("Could not fit result bounds; using answer camera instead.", error);
    state.map.flyTo({ center: [b.lng, b.lat], zoom: 8, duration: 700 });
  }
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
  if (meters <= 25) return 5000;
  return Math.max(0, Math.round(5000 * Math.exp(-meters / 18000)));
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatScoreDelta(score) {
  if (score < 0) return `-${Math.abs(score).toLocaleString()}`;
  return `+${score.toLocaleString()}`;
}

function updateHud() {
  const total = modeConfig().totalRounds;
  els.roundText.textContent = `${Math.min(state.round, total)}/${total}`;
  els.scoreText.textContent = state.totalScore.toLocaleString();
  els.streakText.textContent = state.mode === "country" ? String(state.streak) : String(state.bestStreak);
  els.timerText.textContent = `${Math.floor(state.secondsLeft / 60)}:${String(state.secondsLeft % 60).padStart(2, "0")}`;
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function setMapStatus(message) {
  els.mapStatusText.textContent = message;
}

function updatePlayAvailability() {
  const hasReadyRound = roundPool().length > 0;
  const busy = state.phase === "loading" || state.phase === "playing";
  const betweenRounds = state.phase === "result" && state.round < modeConfig().totalRounds;
  els.playButton.disabled = busy || betweenRounds || !hasReadyRound;
  els.playButton.textContent = hasReadyRound ? "Play" : "No rounds";
}

function buildClueText(location) {
  const tags = location.clueTypes?.length ? location.clueTypes.join(", ") : "street scene";
  return location.reveal ? `${tags}. ${location.reveal}` : tags;
}

function buildSourceText(photo) {
  const provider = photo?.provider === "KartaView" ? "KartaView live imagery" : "Curated catalog image";
  return photo?.attribution ? `${provider}: ${photo.attribution}` : provider;
}

function modeConfig() {
  return MODES[state.mode];
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

function buildRoundDeck(avoidFirstId = "") {
  const deck = shuffle(roundPool());
  if (avoidFirstId && deck.length > 1 && deck[0]?.id === avoidFirstId) {
    const swapIndex = deck.findIndex((round) => round.id !== avoidFirstId);
    if (swapIndex > 0) {
      [deck[0], deck[swapIndex]] = [deck[swapIndex], deck[0]];
    }
  }
  return deck;
}

function roundPool() {
  return state.sourceMode === "real" ? REAL_VIEW_LOCATIONS : GAME_ROUNDS;
}

function shuffle(items) {
  const deck = [...items];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function getPreGuessTags(location) {
  const tags = [location.difficulty, ...location.clueTypes]
    .map(neutralizePreGuessTag)
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 4);
}

function neutralizePreGuessTag(tag) {
  const normalized = String(tag || "").trim().toLowerCase();
  if (!normalized) return "";
  const rewritten = PRE_GUESS_TAG_REWRITES.get(normalized) || tag;
  const safeText = String(rewritten).trim();
  const lowered = safeText.toLowerCase();
  return PRE_GUESS_BLOCKED_TERMS.some((term) => lowered.includes(term)) ? "" : safeText;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function scheduleTimeoutAutoNext(timedOut) {
  cancelTimeoutAutoNext();
  if (!timedOut || state.round >= modeConfig().totalRounds) return;
  state.timeoutAutoNextId = window.setTimeout(() => {
    state.timeoutAutoNextId = null;
    if (state.phase === "result" && state.round < modeConfig().totalRounds) {
      startRound();
    }
  }, TIMEOUT_AUTO_NEXT_MS);
}

function cancelTimeoutAutoNext() {
  if (!state.timeoutAutoNextId) return;
  window.clearTimeout(state.timeoutAutoNextId);
  state.timeoutAutoNextId = null;
}

function clearTimer(resetSeconds = true) {
  window.clearInterval(state.timerId);
  state.timerId = null;
  if (resetSeconds) {
    state.secondsLeft = modeConfig().seconds;
  }
  updateHud();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg) {
  return deg * Math.PI / 180;
}
