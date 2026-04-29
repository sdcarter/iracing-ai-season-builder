# AiSeasonCreator Constitution

## Mission

Build and maintain a reliable GitHub Pages app (iRacing AI: Season Builder) that generates iRacing season JSON files from curated static sources with deterministic behavior.

## Product Contract

The shipped product must always provide:

1. A public GitHub Pages entrypoint.
2. A user flow to select season, series, and car.
3. A generated downloadable season JSON, produced at runtime in-browser.
4. A deterministic output filename: <series-name>--<season>.json.

Current baseline support:

- Season: 2026s2
- Series: Production Car Challenge

## Data Contract

Canonical runtime data lives under data/ and is staged for Pages deployment.

Required input classes:

1. Series template JSON.
2. Season schedule PDF.
3. Track lookup JSON.
4. Car lookup JSON.

Data integrity rules:

1. Track mapping is canonical and layout-specific where required.
2. No alias-table fallback as a primary data strategy.
3. Car class catalog must be preserved when car lookup data is refreshed.

## Architecture and Runtime Rules

1. Prefer plain JavaScript and static assets over framework complexity.
2. Runtime generation logic must remain deterministic and testable locally.
3. Avoid hidden server-side mutation or external API requirements for base generation.
4. Keep UX clear and task-focused: select inputs plus one-click download.

## Delivery and Deployment Rules

1. GitHub Actions is the deployment authority for Pages.
2. Workflow must stage required data assets into docs/assets before publish.
3. A main-branch push must be sufficient to publish without manual artifact editing.

## Scope Boundaries

Out of scope unless explicitly re-chartered:

1. Desktop app feature development.
2. Live iRacing API integration for core generation path.
3. Broad multi-series orchestration that degrades reliability of the baseline path.

## Quality Gates

A change is complete only when all are true:

1. Pages UI loads and renders selection controls correctly.
2. User can generate and download JSON for supported season/series/car combinations.
3. Lookup validation script passes.
4. Deployment workflow succeeds.

## Change Governance

When adding a season or series:

1. Update source data files.
2. Update docs/app.js product configuration.
3. Update staging workflow if new runtime assets are required.
4. Re-run local verification and lookup validation before merge.