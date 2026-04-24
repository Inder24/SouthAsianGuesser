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
