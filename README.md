# iRacing AI: Season Builder
It generates an iRacing season JSON in the browser from curated static inputs. Users pick season, series, and car, then download a ready-to-import file.

## What This App Does

The live flow is:

1. Pick season.
2. Pick series.
3. Pick your car.
4. Download generated JSON.

Current supported product set:

- Season: 2026s2
- Series: Production Car Challenge
- Cars: Global Mazda MX-5 Cup, Toyota GR86, Renault Clio, BMW M2 CS Racing

Output filename format:

- <series-name>--<season>.json
- Example: production-car-challenge--2026s2.json

## How Generation Works

Generation is runtime, in the browser.

On download, the app:

1. Loads a base series template JSON.
2. Parses the season PDF schedule.
3. Resolves parsed track labels to canonical track IDs.
4. Applies selected driver car values (`carId`, `car_name`, `userCarClassId`).
5. Clones and updates events for each parsed week.
6. Downloads the final JSON blob.

If any track in the schedule cannot be resolved to an ID, generation fails with a clear missing-track message.

## Data Sources

Primary data files:

- data/templates/production-car-challenge-template.json
- data/schedule/2026s2.pdf
- data/track-data/track-ids.lookup.json
- data/car-data/car-ids.lookup.json

Data policy:

- Track lookup uses canonical entries (no alias table).
- Car lookup refresh preserves car class catalog.

## Repository Layout

- docs/: GitHub Pages UI (index, app logic, styles)
- data/: templates, schedule PDF, track and car lookup data
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

1. Add/update template, PDF, and lookup entries in data/.
2. Add product config in docs/app.js.
3. Ensure deployment workflow stages any newly required files.
4. Run scripts/validate-lookups.py and local browser test before pushing.
