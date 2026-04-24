# SEA Street Guess

A lightweight browser guessing game for Southeast Asia. Each round shows a location photo, lets the player inspect it, and uses a GrabMaps-powered map for placing guesses and calculating distance.

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

- The game uses a hardcoded catalog of SEA location photos for gameplay.
- GrabMaps is used for the map UI and distance scoring.
- `grabmaps-streetview-diagnostic.html` and `grabmaps-streetview-http-check.mjs` are included to test current GrabMaps SDK street-view availability.
