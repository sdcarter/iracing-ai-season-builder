# iRacing AI: Season Builder
It generates an iRacing AI season JSON in the browser from curated static inputs. Users pick a series and car from the latest upstream season, then download a ready-to-import file.

## What This App Does

The live flow is:

1. Load the latest upstream season.
2. Pick any listed series.
3. Pick your car.
4. Download generated JSON.

Current supported product set is driven by the public community season file at:

- https://raw.githubusercontent.com/Girgetto/iracing-calendar/main/data/iracing-season-data.json

The UI uses the most recent season found in that feed and exposes every series it can parse from it.

Important caveat:

- The upstream feed does not expose whether a series is AI-enabled.
- The upstream feed also omits several hosted-session details that iRacing stores in exported AI seasons.
- Generation is therefore best-effort, using one shared generic AI season template plus local track/car lookups.

Output filename format:

- <series-name>--<season>.json
- Example: production-car-challenge-by-sim-lab--2026s3.json

## How Generation Works

Generation is runtime, in the browser.

On download, the app:

1. Fetches the public community season JSON directly in the browser.
2. Loads one generic AI season template JSON.
3. Maps the selected series schedule into local week rows.
4. Resolves remote track labels to iRacing track IDs using the checked-in lookup plus a few runtime overrides and fuzzy prefix matching.
5. Resolves the remote car labels against the local car lookup.
6. Applies selected driver car values (`carId`, `car_name`, and class IDs only when known).
7. Clones and updates events for each week.
8. Downloads the final JSON blob.

If a series has unresolved cars or tracks, the UI warns before download.

## Data Sources

Primary data files:

- data/templates/default-ai-season-template.json
- data/track-data/track-ids.lookup.json
- data/car-data/car-ids.lookup.json
- data/car-data/car-class.lookup.json
- https://raw.githubusercontent.com/Girgetto/iracing-calendar/main/data/iracing-season-data.json

Additional upstreams used for lookup research and manual refreshes:

- https://github.com/adrianulima/my-racing-planner

Data policy:

- Track lookup remains canonical, with a very small runtime alias layer only where the upstream feed renamed an existing layout without a new track ID.
- Car roster resolution uses [car-ids.lookup.json](/Users/steve.carter/Library/CloudStorage/OneDrive-Slalom/Documents/GitHub/personal/iracing-ai-season-builder.worktrees/refactor-oauth-to-static-data-fetch/data/car-data/car-ids.lookup.json) plus the verified overlay in [car-class.lookup.json](/Users/steve.carter/Library/CloudStorage/OneDrive-Slalom/Documents/GitHub/personal/iracing-ai-season-builder.worktrees/refactor-oauth-to-static-data-fetch/data/car-data/car-class.lookup.json).
- The checked-in car file still does not include `carClassId` on individual cars, so generic coverage improves as the dedicated class lookup grows.
- Each car-class mapping carries provenance (`confidence`, `source`, and `evidence`) so verified exports override softer inferred mappings over time.

**Current class lookup status:**
- **46 total mappings** (24 verified, 22 inferred)
- Single-car series (NASCAR, Indycar, etc.) are 100% verified
- Multiclass series (IMSA, GT Endurance) use verified + inferred mappings
- To improve multiclass coverage: export one AI season per major class (one GTP, one GT3, one GTE, etc.) and share with the maintainer

## Repository Layout

- docs/: GitHub Pages UI (index, app logic, styles)
- data/: generic template plus track and car lookup data
- scripts/: validation and maintenance scripts
- .github/workflows/deploy-pages.yml: Pages deployment pipeline

## Local Verification

Serve locally from repository root:

1. Run: python3 -m http.server 4173
2. Open: http://127.0.0.1:4173/docs/index.html
3. Test download flow for the default season/series/car.

Validate lookup integrity:

- python3 scripts/validate-lookups.py

## GitHub Pages Deployment

Deployment is handled by GitHub Actions via .github/workflows/deploy-pages.yml.

The workflow stages required runtime assets into docs/assets before publishing.

To enable or re-enable Pages:

1. Push to main.
2. In repository Settings -> Pages, set Source to GitHub Actions.
3. Run Deploy Pages workflow (or trigger by push).

Published site URL pattern:

- https://supersagee.github.io/AiSeasonCreator/

## Contribution Notes

When adding a new season or series:

1. Update the generic template or lookup entries in data/ when generation quality needs to improve.
2. Update car aliases, category fallbacks, or track overrides in [docs/app.js](/Users/steve.carter/Library/CloudStorage/OneDrive-Slalom/Documents/GitHub/personal/iracing-ai-season-builder.worktrees/refactor-oauth-to-static-data-fetch/docs/app.js) when the upstream feed changes naming.
3. Ensure deployment workflow stages any newly required files.
4. Run scripts/validate-lookups.py and local browser test before pushing.

When you confirm a new `carId -> carClassId` pair from an exported iRacing AI season, add it to [car-class.lookup.json](/Users/steve.carter/Library/CloudStorage/OneDrive-Slalom/Documents/GitHub/personal/iracing-ai-season-builder.worktrees/refactor-oauth-to-static-data-fetch/data/car-data/car-class.lookup.json) with proper provenance (`confidence: "verified"`, `source: "exported-ai-season-json"`, and `evidence` field noting the series and season).
