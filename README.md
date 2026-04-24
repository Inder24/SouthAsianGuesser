# SEA Street Guess

A lightweight browser guessing game for Southeast Asia. Each round shows a location photo, lets the player inspect it, and uses GrabMaps for maps, scoring context, reverse geocoding, and nearby POI reveals.

## Run locally

1. Copy the example config:

   ```bash
   cp config.example.js config.local.js
   ```

2. Put your GrabMaps browser key in `config.local.js`.

3. Serve the folder:

   ```bash
   python3 -m http.server 5177
   ```

4. Open:

   ```text
   http://localhost:5177/
   ```

## Notes

- Classic mode uses a map pin and distance-based scoring.
- Country mode is a faster country-choice challenge with streak scoring.
- The game uses a hardcoded catalog of SEA location photos with clue metadata for gameplay.
- GrabMaps is used for the map UI, distance scoring, reverse geocode context, and nearby POI reveal text.
- `grabmaps-streetview-diagnostic.html` and `grabmaps-streetview-http-check.mjs` are included to test current GrabMaps SDK street-view availability.

## What this project is

SEA Street Guess is a Southeast Asia-first geography game inspired by the core thrill of GeoGuessr: look at a place, read the environment, make a guess, and feel the hit when the map reveals how close you were.

The game now supports two play styles:

- **Classic Mode**: inspect the scene, drop a pin on the GrabMaps map, and score based on distance.
- **Country Mode**: move faster, choose the country, and build a streak.

It also supports two view sources:

- **Real View**: uses KartaView public street-level imagery, selected dynamically around Southeast Asian anchor points.
- **Photo View**: uses a curated high-resolution photo catalog, with image panning, zooming, clue tags, attribution, and reveal logic.

The result is a fully playable browser game with a title screen, mode selection, live map interaction, scoring, timers, streaks, answer reveals, and replayable random rounds.

## How to run it

From the project folder:

```bash
python3 -m http.server 5177
```

Then open:

```text
http://localhost:5177/
```

For a fresh clone, copy the config template first:

```bash
cp config.example.js config.local.js
```

`config.local.js` is intentionally ignored by git so local browser keys stay out of commits.

## What makes it special

This started as a straight GrabMaps street-view experiment, but it turned into something more interesting: a hybrid game engine that can keep working even while one imagery provider is incomplete.

The game uses GrabMaps where GrabMaps is strongest today: the interactive map, controls, geographic context, distance scoring, reverse geocoding, and nearby place reveal. For street-level visuals, it intelligently switches between KartaView live imagery and a curated high-quality photo catalog.

That means the project is not blocked by GrabMaps street view availability. It still showcases GrabMaps as the game map layer while proving the full game loop end to end.

## Out-of-the-box touches

- A real game-style start screen instead of a plain form.
- Separate **Classic** and **Country** modes so the same content supports two pacing styles.
- Separate **Real View** and **Photo View** modes so the game can use live street-level imagery or curated photos.
- A larger Southeast Asia location pool for better randomization and fewer repeated starts.
- KartaView photo selection avoids reusing the same image ID during a session.
- Photo View supports drag-to-pan and zoom, so static images still feel exploratory.
- Pre-guess clue tags are sanitized so they do not accidentally reveal the country or exact location.
- Reveal cards show the answer, distance, score, attribution, and contextual map feedback after the guess.
- GrabMaps diagnostics are included so the street-view SDK behavior can be tested and discussed with GrabMaps developers.

## Hacks and engineering wins

- **Street-view fallback strategy**: GrabMaps street view is not publicly released yet, so the app separates the game engine from the imagery provider. KartaView and curated photos can power the scene while GrabMaps continues to power the map and scoring.
- **Provider-agnostic round model**: rounds carry location metadata separately from photo metadata, which lets Real View and Photo View share scoring, reveals, map pins, and country logic.
- **High-resolution image strategy**: Photo View uses large Wikimedia Commons images where available, while KartaView requests the strongest image URLs exposed by its API first.
- **Random deck behavior**: rounds are shuffled into decks and KartaView image IDs are tracked, reducing repeated images during normal play.
- **Browser-only deployability**: the whole game runs as static files. A simple local server is enough; there is no backend requirement.
- **SDK diagnostic harness**: separate test pages capture the current GrabMaps street-view limitation cleanly, which makes it easier to hand concrete feedback to the GrabMaps team.

This is a small project with a surprisingly complete loop: a custom Southeast Asia game identity, a real map SDK, live and curated imagery modes, scoring math, reveal UX, and practical fallbacks where the ecosystem is still catching up.
