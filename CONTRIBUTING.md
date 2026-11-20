# Contributing to UMLens

[← Back to README](README.md) · [User Guide →](docs/USER_GUIDE.md)

Thank you for contributing to **UMLens**. This guide covers the project structure, architecture, development workflow, and verification steps.

---

## 1. Tech Stack

- **Framework:** React 19 + Vite 8
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Icons:** `lucide-react`
- **PWA & Offline Support:** `vite-plugin-pwa`
- **Linting:** `oxlint` (configured via `.oxlintrc.json`)

---

## 2. Repository Structure

```text
.
├── .github/workflows/
│   ├── capture-docs.yml           # On-demand workflow to regenerate docs/media/*
│   └── deploy.yml                 # GitHub Pages build & deployment workflow
├── .oxlintrc.json                 # Oxlint React + Oxc rules
├── docs/
│   ├── media/                     # Generated screenshots & animated WebP clips
│   └── USER_GUIDE.md              # End-user guide
├── examples/
│   ├── checkout-payment-auth.puml # Standalone PlantUML showcase
│   └── order-fulfillment-pipeline.mmd # Standalone Mermaid showcase
├── public/
│   ├── icon.svg                   # Master SVG app icon
│   ├── icon-192.png               # Generated PWA icon
│   └── icon-512.png               # Generated PWA icon
├── scripts/
│   ├── capture-docs.mjs           # Playwright + ffmpeg visual doc generator
│   └── generate-icons.sh          # Regenerates PNG icons from public/icon.svg (macOS)
├── src/
│   ├── App.jsx                    # Parsers, Unified AST, Layout Engine, SVG Canvas & UI
│   ├── App.css
│   ├── index.css                  # Tailwind CSS entry
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js                 # Vite, Tailwind, PWA manifest & GH Pages base path
```

---

## 3. Local Development & Scripts

### Prerequisites
- Node.js 20+ (CI uses Node 22)
- `npm`
- *(Optional, for regenerating docs media locally)* `ffmpeg` and `playwright` Chromium (`npm install --no-save playwright && npx playwright install chromium`)

### Common Commands

```bash
# Install dependencies
npm install

# Start Vite dev server on http://0.0.0.0:3000
npm run dev

# Build production bundle to ./dist
npm run build

# Preview production build locally
npm run preview

# Run oxlint across the codebase
npm run lint

# Regenerate PWA PNG icons from public/icon.svg (macOS only: uses qlmanage + sips)
npm run icons

# Regenerate docs/media/ screenshots and animated WebP clips
npm run docs:capture
```

---

## 4. Architecture Overview (`src/App.jsx`)

UMLens processes source text through a deterministic, client-side pipeline:

1. **Preloaded Samples & Color Helpers (`Section 1`):**
   - `PRESET_DIAGRAMS`: Built-in PlantUML and Mermaid demos.
   - Color utilities (`normalizeUmlColor`, `applyAlphaToColor`, `blendWithBg`) convert explicit UML colors into theme-safe fills and strokes.
2. **Dialect Detection & Unified AST Parsers (`Section 2`):**
   - `detectDialect`: Distinguishes `plantuml` vs. `mermaid`.
   - `parsePlantUML` and `parseMermaid`: Parse participants, `box` groups, fragments (`alt`/`else`/`opt`/`loop`/`par`/`critical`), `rect` highlight bands, `== Divider ==` sections, notes, activations, and `@contract`/`@question`/`@decision` metadata comments into a shared AST (`participants`, `boxes`, `rootChildren`, `orderedSteps`, `allNodesById`, `warnings`, `stats`).
   - `finalizeSequenceAST`: Computes call/return pairing and foldable subtree node IDs (`subtreeNodeIds`) for every call.
3. **Unified Layout Engine (`Section 3 — computeSequenceLayout`):**
   - Builds effective visible columns (`buildEffectiveColumns`), collapsing `box` groups into `group:<boxId>` columns when collapsed.
   - Walks AST nodes recursively (`layoutNodes`) applying:
     - `foldedCallIds` subtree skipping
     - `foldedBranchIds` branch collapsing
     - `foldedDividerIds` section collapsing with accurate cross-section `activationSpans` (`startActivation` / `endActivation`)
     - `hiddenLifelines` coalescing (`hidden_stub` and `coalesced_hidden`)
     - `group_internal_cluster` coalescing for collapsed `box` groups
     - `stepLimit` progressive step filtering
4. **SVG Canvas & Workbench UI (`Sections 4 & 5`):**
   - Renders swimlane boxes, participant headers (drag-to-reorder), lifelines, activation bars, fragments, notes, dividers, arrows, and hover tooltips.
   - Provides the collapsible left source editor, right Arrow & Review Inspector drawer, SVG export, and Markdown notes export.

---

## 5. Deployment & GitHub Pages

- `.github/workflows/deploy.yml` builds and deploys `./dist` to GitHub Pages on pushes to `main`.
- `vite.config.js` sets `base: process.env.GITHUB_ACTIONS === 'true' ? '/umlens/' : '/'`, so root-relative assets work both locally and under the `/umlens/` GitHub Pages subpath.
- Because `VitePWA` uses `registerType: 'autoUpdate'`, keep PWA manifest changes (`icons`, `file_handlers`, `start_url`, `scope`) relative (`./`) in `vite.config.js`.

---

## 6. Regenerating Documentation Visuals (`docs/media/`)

The screenshots and animated WebP clips embedded in `README.md` and `docs/USER_GUIDE.md` are generated deterministically by `scripts/capture-docs.mjs` (Playwright + headless Chromium + lossless `ffmpeg` `libwebp_anim` encoding).

You can refresh them in two ways whenever the UI changes:

- **In GitHub Actions (no local Chromium needed):** Go to the repository's **Actions** tab, select **Capture Documentation Media** (`.github/workflows/capture-docs.yml`), and click **Run workflow**. It builds the app, runs `npm run docs:capture`, and commits updated files in `docs/media/`.
- **Locally on your workstation:**
  ```bash
  npm install --no-save playwright
  npx playwright install chromium
  npm run docs:capture
  ```
  *(Requires `ffmpeg` on your `PATH`, e.g., `brew install ffmpeg` on macOS.)*

When adding new visual demos to `scripts/capture-docs.mjs`, prefer tightly cropped `<main>` clips and lossless animated `.webp` so dark-mode arrows and text stay crisp.

---

## 7. Pull Request & Quality Checklist

Before opening a pull request:

1. Run `npm run lint` and verify there are **0 errors** (and avoid introducing new warnings).
2. Run `npm run build` to verify Vite bundling and PWA service worker generation succeed.
3. Keep both `examples/` files and the corresponding preloaded presets in `src/App.jsx` free of parse warnings if you modify parser syntax rules.
4. If your PR changes visible UI controls, refresh `docs/media/` via `npm run docs:capture` or the **Capture Documentation Media** workflow.
